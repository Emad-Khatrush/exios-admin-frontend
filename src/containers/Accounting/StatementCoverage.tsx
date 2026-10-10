import { useEffect, useState } from 'react';
import { Alert, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DataTable, Ltr, Sub } from './ui';

const KIND: Record<string, string> = { bank: 'بنك أو بطاقة', ewallet: 'محفظة إلكترونية', current: 'حساب جارٍ' };

// Which months each paying account has a statement for. With purchase costs taken from the
// statements, a month with no statement is a month whose purchases are not in the books.
export default function StatementCoverage({ onPick }: { onPick?: (accountId: string) => void }) {
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stale = false;
    setData(null); setError('');
    acc.get('bank/coverage', { from }).then((res: any) => { if (!stale) setData(res.data); }).catch((err: any) => { if (!stale) setError(errorText(err)); });
    return () => { stale = true; };
  }, [from]);
  const gaps = (data?.accounts || []).filter((a: any) => a.missing.length).length;
  return (
    <details className="acc-bank-coverage">
      <summary className="acc-bank-coverage__summary">
        <span className="acc-bank-coverage__icon"><CalendarDays size={18} /></span>
        <span className="acc-bank-coverage__title"><strong>تغطية الكشوف</strong><span>متابعة الأشهر المرفوعة لكل حساب</span></span>
        <span className={`acc-bank-coverage__status${gaps ? ' acc-bank-coverage__status--gap' : ''}`}>{error ? 'تعذر تحميل التغطية' : data ? (gaps ? `${gaps} حسابات بها أشهر غير مرفوعة` : 'الكشوف مكتملة') : 'جارٍ تحميل التغطية…'}</span>
        <span className="acc-bank-coverage__toggle">التفاصيل <ChevronDown size={16} /></span>
      </summary>
      <div className="acc-bank-coverage__body">
      <div className="acc-bank-coverage__intro"><Sub>✓ يوجد كشف للشهر · — لم يُرفع كشف. راجع الأشهر التي استُخدم فيها الحساب؛ غياب الكشف لا يثبت وجود خطأ في الرصيد.</Sub>
      <TextField size="small" type="date" label="بداية فترة التغطية" value={from} onChange={(e) => { if (e.target.value) setFrom(e.target.value); }} InputLabelProps={{ shrink: true }} /></div>
      {error && <Alert severity="error">{error}</Alert>}
      <DataTable dense loading={!data && !error} rows={data?.accounts || []} rowKey={(a: any) => a._id}
        columns={[
          { key: 'account', header: 'الحساب', render: (a: any) => <><button type="button" className="acc-link-button" onClick={() => onPick?.(a._id)}><Ltr>{a.code}</Ltr> · {a.name}</button><Sub>{KIND[a.kind] || a.kind}{a.lastDay && <> · آخر سطر <Ltr>{a.lastDay}</Ltr></>}</Sub></> },
          ...(data?.months || []).map((m: string) => ({ key: m, header: <Ltr>{m.slice(5)}/{m.slice(2, 4)}</Ltr>, align: 'center' as const,
            render: (a: any) => (a.months[m] ? <span className="acc-cover acc-cover--ok" title={`${a.months[m]} سطر`}>✓</span> : <span className="acc-cover acc-cover--gap" title="لم يُرفع كشف لهذا الشهر">—</span>) })),
        ]} />
      </div>
    </details>
  );
}
