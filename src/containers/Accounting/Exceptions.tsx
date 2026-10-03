import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip } from '@mui/material';
import { CheckCheck, RotateCw, Undo2 } from 'lucide-react';
import { useAccountingAccess } from './useAccountingAccess';
import { CURRENCY_DECIMALS, acc, errorText } from './accountingApi';
import { Badge, DataTable, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid } from './ui';

const SEVERITY: Record<string, { label: string; tone: any }> = {
  error: { label: 'خطأ', tone: 'danger' }, warn: { label: 'للمراجعة', tone: 'warn' }, info: { label: 'معلومة', tone: 'info' },
};
const ORDER: Record<string, number> = { error: 0, warn: 1, info: 2 };
const dayOf = (value: any) => (value ? (/^\d{4}-\d{2}(-\d{2})?$/.test(String(value)) ? String(value) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli' }).format(new Date(value))) : '');

// The daily reconciliation (spec 10): what must always hold between the ledger and the system,
// and what the accountant should look at. It runs by itself once a day; this screen can run it now.
const Exceptions = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const { can } = useAccountingAccess();
  const canReview = can('closing');
  // Items accepted after review (spec: they leave the list until the mark is taken back)
  const [reviewed, setReviewed] = useState<any[]>([]);
  const [reviewing, setReviewing] = useState<any>(null);
  const [showReviewed, setShowReviewed] = useState(false);
  const loadReviewed = () => acc.get('exceptions/reviewed').then((res: any) => setReviewed(res.data.results || [])).catch(() => {});
  useEffect(() => { loadReviewed(); }, []);
  const saveReview = async () => {
    try {
      setData((await acc.post('exceptions/reviewed', { check: reviewing.check, ref: reviewing.item.ref, label: reviewing.item.label, note: reviewing.note })).data);
      setReviewing(null);
      loadReviewed();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const undoReview = async (id: string) => {
    try {
      setData((await acc.delete(`exceptions/reviewed/${id}`)).data);
      loadReviewed();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const titleOf = (key: string) => (data?.results || []).find((r: any) => r.key === key)?.title || key;

  const load = async (run = false) => {
    try {
      setIsRunning(run);
      setError('');
      setData((await acc.get('exceptions', run ? { run: 'true' } : undefined)).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsRunning(false);
  };
  useEffect(() => { load(); }, []);

  const found = (data?.results || []).filter((r: any) => r.count > 0).sort((a: any, b: any) => ORDER[a.severity] - ORDER[b.severity]);
  const clean = (data?.results || []).filter((r: any) => r.count === 0);

  return (
    <>
      <PageHeader
        title="المطابقة والاستثناءات"
        subtitle="فحوص تُنفَّذ تلقائياً مرة كل يوم: هل الدفاتر تطابق المنظومة، وما الذي يحتاج نظرتك. الفحص لا يغيّر شيئاً."
        actions={<Button variant="contained" startIcon={<RotateCw size={15} />} disabled={isRunning} onClick={() => load(true)}>{isRunning ? 'جارٍ الفحص…' : 'فحص الآن'}</Button>}
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {data && (
        <StatGrid>
          <Stat label="أخطاء" value={data.errorCount} tone={data.errorCount ? 'danger' : undefined} hint="يجب ألا تبقى" />
          <Stat label="للمراجعة" value={data.warningCount} tone={data.warningCount ? 'warn' : undefined} hint="قرار المحاسب" />
          <Stat label="فحوص سليمة" value={clean.length} tone="accent" />
          <Stat label="آخر فحص" value={<Ltr>{data.day}</Ltr>} hint={data.ranAt ? new Date(data.ranAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit' }) : undefined} />
        </StatGrid>
      )}
      {!data && !error && <div className="acc-empty">جارٍ التحميل…</div>}
      {data && found.length === 0 && <Alert severity="success" className="mb-3">كل الفحوص سليمة. الدفاتر تطابق المنظومة.</Alert>}

      {found.map((check: any) => (
        <Panel
          key={check.key}
          flush
          title={<><Badge tone={SEVERITY[check.severity]?.tone}>{SEVERITY[check.severity]?.label}</Badge> {check.title} ({check.count})</>}
          subtitle={check.hint}
          actions={<>
            {check.reviewedCount > 0 && <Button size="small" onClick={() => setShowReviewed(true)}>{check.reviewedCount} تمت مراجعتها</Button>}
            {check.link && <Button size="small" variant="outlined" onClick={() => navigate(check.link)}>فتح الشاشة</Button>}
          </>}
        >
          {check.items.length > 0 && (
            <DataTable
              dense
              maxHeight={320}
              rows={check.items}
              rowKey={(_: any, index: number) => String(index)}
              caption={check.count > check.items.length ? `تُعرض أول ${check.items.length} من ${check.count}.` : undefined}
              columns={[
                { key: 'label', header: 'البند', render: (row: any) => <Open to={row.url}>{row.label}</Open> },
                { key: 'note', header: '', hideOnMobile: true, render: (row: any) => (row.note ? <span className="acc-muted">{row.note}</span> : row.day ? <Ltr>{dayOf(row.day)}</Ltr> : null) },
                {
                  key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => (
                    row.difference !== undefined
                      ? <><Money value={row.difference} currency={row.currency} decimals={row.decimals} strong /><div className="acc-sub">المنظومة <Money value={row.system} currency={row.currency} decimals={row.decimals} tone="plain" /> · الدفاتر <Money value={row.booked} currency={row.currency} decimals={row.decimals} tone="plain" /></div></>
                      : <>
                        {row.foreign !== undefined && row.foreign !== null && <div><Money value={row.foreign} currency={row.currency} decimals={CURRENCY_DECIMALS[row.currency]} /></div>}
                        {row.usd !== undefined && <Money value={row.usd} strong />}
                      </>
                  ),
                },
                ...(canReview && check.severity !== 'error' ? [{
                  key: 'review', header: '', align: 'end' as const, render: (row: any) => (
                    <Tooltip title="تمت المراجعة: يخرج من القائمة (يمكن إرجاعه)"><IconButton size="small" onClick={() => setReviewing({ check: check.key, item: row, note: '' })}><CheckCheck size={15} /></IconButton></Tooltip>
                  ),
                }] : []),
              ]}
            />
          )}
        </Panel>
      ))}

      {reviewed.length > 0 && (
        <Panel
          flush
          title={`بنود تمت مراجعتها (${reviewed.length})`}
          subtitle="قبلها المحاسب بعد المراجعة فخرجت من القوائم أعلاه. إرجاع البند يعيده للقائمة."
          actions={<Button size="small" onClick={() => setShowReviewed((v) => !v)}>{showReviewed ? 'إخفاء' : 'عرض'}</Button>}
        >
          {showReviewed && (
            <DataTable
              dense
              maxHeight={320}
              rows={reviewed}
              rowKey={(row: any) => row._id}
              columns={[
                { key: 'check', header: 'الفحص', render: (row: any) => <span className="acc-muted">{titleOf(row.check)}</span> },
                { key: 'label', header: 'البند', render: (row: any) => (row.ref?.startsWith('/') ? <Open to={row.ref}>{row.label}</Open> : row.label) },
                { key: 'note', header: 'ملاحظة', hideOnMobile: true, render: (row: any) => row.note || '-' },
                { key: 'by', header: 'بواسطة', hideOnMobile: true, render: (row: any) => <>{row.by ? `${row.by.firstName} ${row.by.lastName}` : ''} <span className="acc-muted"><Ltr>{dayOf(row.createdAt)}</Ltr></span></> },
                ...(canReview ? [{ key: 'undo', header: '', align: 'end' as const, render: (row: any) => <Tooltip title="إرجاع للمراجعة"><IconButton size="small" onClick={() => undoReview(row._id)}><Undo2 size={15} /></IconButton></Tooltip> }] : []),
              ]}
            />
          )}
        </Panel>
      )}

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} fullWidth maxWidth="xs" dir="rtl">
        <DialogTitle>تمت مراجعة البند</DialogTitle>
        <DialogContent>
          <p className="mb-2">{reviewing?.item?.label}</p>
          <p className="acc-muted small">يخرج من القائمة اليومية ويبقى في «بنود تمت مراجعتها». لا يغيّر شيئاً في الدفاتر.</p>
          <TextField label="ملاحظة (اختياري)" placeholder="مثلاً: طلب قديم لا تُعرف تكلفته" value={reviewing?.note || ''} onChange={(e) => setReviewing({ ...reviewing, note: e.target.value })} fullWidth multiline minRows={2} className="mt-2" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>إلغاء</Button>
          <Button variant="contained" onClick={saveReview}>تأكيد</Button>
        </DialogActions>
      </Dialog>

      {clean.length > 0 && (
        <Panel title="فحوص سليمة">
          <div className="d-flex gap-2 flex-wrap">{clean.map((check: any) => <Badge key={check.key} tone="ok">{check.title}</Badge>)}</div>
          <p className="acc-muted mt-2 mb-0">العناوين تصف المشكلة التي يبحث عنها كل فحص؛ ظهورها هنا يعني أنها غير موجودة.</p>
        </Panel>
      )}
    </>
  );
};

export default Exceptions;
