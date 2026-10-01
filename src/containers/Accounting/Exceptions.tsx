import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { RotateCw } from 'lucide-react';
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
          actions={check.link && <Button size="small" variant="outlined" onClick={() => navigate(check.link)}>فتح الشاشة</Button>}
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
              ]}
            />
          )}
        </Panel>
      ))}

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
