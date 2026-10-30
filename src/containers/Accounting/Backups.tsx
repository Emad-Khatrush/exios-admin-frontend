import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import moment from 'moment';
import { acc, errorText } from './accountingApi';
import { Badge, DataTable, Ltr, Notice, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round((bytes || 0) / 1024)} KB`);
const when = (value: any) => (value ? moment(value).format('DD/MM/YYYY HH:mm') : '—');
const STATUS: Record<string, { label: string, tone: 'ok' | 'warn' | 'danger' }> = {
  done: { label: 'تمت', tone: 'ok' },
  running: { label: 'جارية', tone: 'warn' },
  failed: { label: 'فشلت', tone: 'danger' },
};

// Daily database backups in a private Google bucket (owner only): the files kept, the latest
// runs, a download link, and a backup on demand
const Backups = () => {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = async () => {
    try {
      setData((await acc.get('backups')).data);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  useEffect(() => { load(); }, []);

  // While a backup runs, the page refreshes itself until it ends
  const running = data?.runs?.some((run: any) => run.status === 'running');
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [running]);

  const backupNow = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      await acc.post('backups');
      setMessage({ type: 'info', text: 'بدأت النسخة الاحتياطية. تظهر في الجدول عند انتهائها (دقيقة أو دقيقتان).' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setIsBusy(false);
    }
  };

  const download = async (name: string) => {
    try {
      const res = await acc.post('backups/download', { name });
      window.location.href = res.data.url;
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const files = data?.files || [];
  const lastDone = data?.runs?.find((run: any) => run.status === 'done');
  const lastRun = data?.runs?.[0];

  return (
    <>
      <PageHeader
        title="النسخ الاحتياطي"
        subtitle="نسخة كاملة من قاعدة البيانات كل يوم في مخزن Google خاص. تصلح لاسترجاع البيانات إلى Atlas جديد أو إلى جهازك إن حدثت مشكلة."
        actions={<Button variant="contained" disabled={isBusy || running || !data?.configured} onClick={backupNow}>نسخة الآن</Button>}
      />
      <Notice message={message} onClose={() => setMessage(null)} />
      {data && !data.configured && (
        <Notice message={{ type: 'warning', text: 'النسخ الاحتياطي غير مفعّل: أضف BACKUP_BUCKET على الخادم (اسم مخزن Google خاص، لا مخزن رفع الملفات).' }} />
      )}
      {data?.error && <Notice message={{ type: 'error', text: `تعذّر قراءة المخزن: ${data.error}` }} />}
      {lastRun?.status === 'failed' && <Notice message={{ type: 'error', text: `آخر محاولة فشلت: ${lastRun.error}` }} />}

      <StatGrid>
        <Stat label="آخر نسخة ناجحة" value={lastDone ? when(lastDone.finishedAt) : 'لا توجد'} hint={lastDone ? size(lastDone.bytes) : undefined} tone={!lastDone || moment().diff(lastDone.finishedAt, 'hours') > 48 ? 'danger' : undefined} />
        <Stat label="النسخ المحفوظة" value={files.length} hint={`كل يوم لمدة ${data?.keepDays ?? 30} يوماً، وأول نسخة من كل شهر لمدة سنة`} />
        <Stat label="موعد النسخة اليومية" value={<Ltr>{`${String(data?.hour ?? 3).padStart(2, '0')}:00`}</Ltr>} hint="بتوقيت ليبيا" />
        <Stat label="المخزن" value={<Ltr>{data?.bucket || '—'}</Ltr>} />
      </StatGrid>

      <Panel title="النسخ المحفوظة" subtitle="رابط التحميل صالح 15 دقيقة. الملف فيه بيانات العملاء: لا تشاركه.">
        <DataTable
          rows={files}
          rowKey={(row: any) => row.name}
          loading={!data}
          empty={{ title: 'لا توجد نسخ بعد', hint: 'اضغط «نسخة الآن» أو انتظر النسخة اليومية.' }}
          columns={[
            { key: 'name', header: 'الملف', render: (row: any) => <Ltr>{row.name.replace('db-backups/', '')}</Ltr> },
            { key: 'createdAt', header: 'التاريخ', render: (row: any) => when(row.createdAt), sortValue: (row: any) => row.createdAt },
            { key: 'bytes', header: 'الحجم', numeric: true, render: (row: any) => size(row.bytes) },
            { key: 'actions', header: '', align: 'end', render: (row: any) => <Button size="small" onClick={() => download(row.name)}>تحميل</Button> },
          ]}
        />
      </Panel>

      <Panel title="آخر المحاولات">
        <DataTable
          rows={data?.runs || []}
          rowKey={(row: any) => row._id}
          loading={!data}
          dense
          empty={{ title: 'لم تُنفَّذ أي نسخة بعد' }}
          columns={[
            { key: 'startedAt', header: 'البدء', render: (row: any) => when(row.startedAt) },
            { key: 'trigger', header: 'النوع', render: (row: any) => (row.trigger === 'daily' ? 'يومية' : 'يدوية') },
            { key: 'status', header: 'الحالة', render: (row: any) => <Badge tone={STATUS[row.status]?.tone}>{STATUS[row.status]?.label || row.status}</Badge> },
            { key: 'detail', header: 'التفاصيل', render: (row: any) => (row.status === 'failed'
              ? <Sub>{row.error}</Sub>
              : row.status === 'done' ? <Sub>{`${row.collections} جدولاً، ${row.documents} سجلاً، ${size(row.bytes)}`}</Sub> : null) },
          ]}
        />
      </Panel>

      <Panel title="الاسترجاع عند حدوث مشكلة" subtitle="الملف نسخة mongodump عادية، داخله README.txt بالأوامر.">
        <ol className="mb-0">
          <li>حمّل آخر نسخة وفك الضغط عنها.</li>
          <li>أنشئ Cluster جديداً في Atlas (أو استعمل MongoDB على جهازك).</li>
          <li>نفّذ <Ltr>mongorestore --uri="الرابط الجديد" --dir="المجلد"</Ltr> (من MongoDB Database Tools).</li>
          <li>غيّر <Ltr>MONGO_URL_2</Ltr> على الخادم إلى الرابط الجديد، ثم امسح رمز واتساب من جديد (جلسة واتساب لا تُحفظ في النسخة).</li>
        </ol>
      </Panel>
    </>
  );
};

export default Backups;
