import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { DataTable, FilterBar, Ltr, Money, Open, Panel, Sub } from './ui';

type Row = {
  key: string; userId: string; currency: string; customer: any;
  statementMinor: number | null; walletMinor: number | null; difference: number | null;
  decimals: number; ledgerMinor: number; ledgerDifference: number; postingDay: string;
  corrections: { entryId: string; number: string; day: string; foreign: number; usd: number; counterpart: string; closureId: string | null }[];
  statements: number; blocked: string; fingerprint: string;
};
const customerName = (row: Row) => `${row.customer?.customerId || ''} · ${row.customer?.firstName || ''} ${row.customer?.lastName || ''}`.trim();
const amount = (value: number | null, currency: string, decimals = 2) => value === null ? '—' : <Money value={value} currency={currency} decimals={decimals} />;
const rowAmount = (row: Row, value: number | null) => amount(value, row.currency, row.decimals);
const totalsFor = (rows: Row[]) => ['USD', 'LYD'].map(currency => {
  const group = rows.filter(row => row.currency === currency);
  const sum = (key: 'walletMinor' | 'statementMinor' | 'difference') => group.some(row => row[key] === null) ? null : group.reduce((total, row) => total + Number(row[key]), 0);
  return { currency, decimals: group[0]?.decimals || 2, count: group.length, wallet: sum('walletMinor'), statement: sum('statementMinor'), difference: sum('difference'),
    ledger: group.reduce((total, row) => total + row.ledgerMinor, 0),
    ledgerDifference: group.reduce((total, row) => total + row.ledgerDifference, 0),
    increase: group.reduce((total, row) => total + Math.max(0, row.difference || 0), 0),
    decrease: group.reduce((total, row) => total + Math.max(0, -(row.difference || 0)), 0) };
}).filter(total => total.count > 0);
const totalsFooter = (rows: Row[], label: string, review = false) => {
  const totals = totalsFor(rows);
  const values = (key: 'wallet' | 'statement' | 'difference' | 'ledger' | 'ledgerDifference') => <>{totals.map(total => <div key={total.currency}>{amount(total[key], total.currency, total.decimals)}</div>)}</>;
  return { customer: label, currency: totals.map(total => <div key={total.currency}><Ltr>{total.currency}</Ltr></div>),
    ...(review ? { before: values('wallet'), after: values('statement') } : { wallet: values('wallet'), statement: values('statement') }),
    ledger: values('ledger'), ledgerDifference: values('ledgerDifference'), difference: values('difference') };
};

export default function WalletStatementReconciliation({ revision, onRepaired, onCompared }: { revision: number; onRepaired: () => void; onCompared: (count: number | null) => void }) {
  const access = useAccountingAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const [review, setReview] = useState<Row[] | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [repairError, setRepairError] = useState('');
  const [success, setSuccess] = useState('');
  const request = useRef(0);
  const busy = useRef(false);
  const load = async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setSelected([]); onCompared(null);
    try {
      const response = await acc.get('wallet-statement-reconciliation');
      if (id === request.current) { setRows(response.data.results || []); onCompared(response.data.count || 0); }
    } catch (err) { if (id === request.current) setError(errorText(err)); }
    finally { if (id === request.current) setLoading(false); }
  };
  useEffect(() => { load(); return () => { request.current++; }; }, [revision]);
  const visible = useMemo(() => rows.filter(row => (!currency || row.currency === currency) &&
    (!search.trim() || customerName(row).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [rows, currency, search]);
  const selectable = visible.filter(row => !row.blocked).slice(0, 100);
  const allSelected = selectable.length > 0 && selectable.every(row => selected.includes(row.key));
  const openReview = () => {
    setReview(rows.filter(row => selected.includes(row.key) && !row.blocked));
    setReason(''); setRepairError('');
  };
  const repair = async () => {
    if (busy.current || !review?.length || !reason.trim()) return;
    busy.current = true; setSaving(true); setRepairError('');
    try {
      const response = await acc.post('wallet-statement-reconciliation/repair', {
        items: review.map(row => ({ userId: row.userId, currency: row.currency, fingerprint: row.fingerprint })), reason: reason.trim(),
      });
      setSuccess(`تمت تسوية ${response.data.count} محفظة مع كشف العميل والدفاتر، وحُفظت القيود وسجل المعالجة.`);
      setReview(null); setSelected([]); onRepaired();
    } catch (err) { setRepairError(errorText(err)); }
    finally { busy.current = false; setSaving(false); }
  };
  const closeReview = () => { if (!busy.current) setReview(null); };
  // Keep failed requests visible; an empty search must not hide the filters.
  if (!error && !rows.length) return null;
  return <>
    <Panel flush title="تسوية كشف العميل والمحفظة والدفاتر"
      subtitle="مقارنة الأرصدة الثلاثة لكل عميل وعملة. تعالج التسوية فرق المحفظة وأثر قيود الترحيل التاريخية المؤكدة معًا؛ الفروقات غير المفسرة تحتاج مراجعة."
      actions={<><Button size="small" onClick={load} disabled={loading || saving}>تحديث الفروقات</Button>{access.isOwner && <Button size="small" variant="contained" disabled={loading || saving || !!error || !selected.length} onClick={openReview}>مراجعة التسوية ({selected.length})</Button>}</>}>
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      {success && <Alert severity="success" className="mx-3 mb-2" onClose={() => setSuccess('')}>{success}</Alert>}
      <div className="px-3"><FilterBar>
        <TextField size="small" label="اسم العميل أو كوده" value={search} onChange={event => { setSearch(event.target.value); setSelected([]); }} />
        <TextField size="small" select label="العملة" value={currency} onChange={event => { setCurrency(event.target.value); setSelected([]); }} style={{ minWidth: 130 }}>
          <MenuItem value="">كل العملات</MenuItem><MenuItem value="USD">دولار USD</MenuItem><MenuItem value="LYD">دينار LYD</MenuItem>
        </TextField>
        <span className="acc-muted">{loading ? 'جارٍ احتساب الأرصدة…' : `${visible.length} فرقًا من ${rows.length}`}</span>
      </FilterBar></div>
      <DataTable dense loading={loading && !rows.length} rows={visible} rowKey={(row: Row) => row.key} maxHeight={380}
        empty={{ title: error ? 'تعذّر تحميل الفروقات' : 'لا توجد فروقات بهذا البحث' }}
        columns={[
          ...(access.isOwner ? [{ key: 'select', header: <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && selected.length > 0}
            disabled={loading || saving || !!error || !selectable.length} inputProps={{ 'aria-label': 'اختيار أول 100 محفظة متاحة في النتائج' }}
            onChange={(_, checked) => setSelected(checked ? selectable.map(row => row.key) : [])} />,
          render: (row: Row) => <Checkbox size="small" checked={selected.includes(row.key)} disabled={loading || saving || !!error || !!row.blocked || (!selected.includes(row.key) && selected.length >= 100)}
            inputProps={{ 'aria-label': `اختيار محفظة ${row.currency} للعميل ${customerName(row)}` }}
            onChange={(_, checked) => setSelected(before => checked ? [...before, row.key] : before.filter(key => key !== row.key))} /> }] : []),
          { key: 'customer', header: 'العميل', render: (row: Row) => row.customer ? <Open to={`/user/${row.userId}`}>{customerName(row)}</Open> : <Ltr>{row.userId}</Ltr> },
          { key: 'currency', header: 'العملة', render: (row: Row) => <Ltr>{row.currency}</Ltr> },
          { key: 'wallet', header: 'المحفظة', numeric: true, render: (row: Row) => rowAmount(row, row.walletMinor) },
          { key: 'statement', header: 'كشف العميل', numeric: true, render: (row: Row) => rowAmount(row, row.statementMinor) },
          { key: 'ledger', header: 'الدفاتر', numeric: true, render: (row: Row) => rowAmount(row, row.ledgerMinor) },
          { key: 'difference', header: 'تعديل المحفظة', numeric: true, render: (row: Row) => rowAmount(row, row.difference) },
          { key: 'ledgerDifference', header: 'تعديل الدفاتر', numeric: true, render: (row: Row) => rowAmount(row, row.ledgerDifference) },
          { key: 'source', header: 'المعالجة', render: (row: Row) => <>{row.blocked ? <Sub>{row.blocked}</Sub> : row.corrections.length ? <>عكس {row.corrections.length} قيد تاريخي<Sub>{row.corrections.map(entry => entry.number).join('، ')}</Sub></> : 'الدفاتر مطابقة؛ تحديث المحفظة فقط'}<Sub>{row.statements} حركة</Sub></> },
        ]} footer={visible.length ? totalsFooter(visible, 'إجمالي النتائج المعروضة') : undefined} />
      {visible.length > 0 && <div className="px-3 mt-2" dir="rtl">{totalsFor(visible).map(total => <p key={total.currency} className="acc-muted mb-1">
        <Ltr>{total.currency}</Ltr> · {total.count} محفظة · {total.difference === null ? 'توجد مبالغ تحتاج مراجعة قبل احتساب الإجمالي' : <>مجموع زيادات المحفظة {amount(total.increase, total.currency, total.decimals)} · مجموع التخفيضات {amount(total.decrease, total.currency, total.decimals)}</>}
      </p>)}</div>}
      <p className="acc-muted px-3 mt-2">يمكن تصحيح 100 محفظة في الدفعة الواحدة. كل اختيار يخص عميلًا وعملة محددة. التصحيح متاح لمالك النظام.</p>
    </Panel>
    <Dialog open={!!review} onClose={closeReview} fullWidth maxWidth="md" dir="rtl">
      <DialogTitle>مراجعة تسوية المحافظ والدفاتر</DialogTitle>
      <DialogContent>
        <p>سيصبح رصيد المحفظة والدفاتر مطابقًا لكشف العميل. تُعكس قيود التسوية التاريخية الموضحة أدناه بقيود جديدة في الفترة المفتوحة، وتُحدّث المحفظة في نفس العملية. لا تُضاف حركة إيداع أو سحب إلى كشف العميل.</p>
        <Alert severity="info" sx={{ mb: 2 }}>إذا أُقفلت فروقات الترحيل سابقًا، يُسجل أثر التصحيح على حساب الرصيد الافتتاحي مع إبقاء حساب الفروقات مقفلًا. إذا فشلت أي معالجة تُلغى الدفعة كاملة.</Alert>
        {repairError && <Alert severity="error">{repairError}</Alert>}
        <DataTable dense rows={review || []} rowKey={(row: Row) => row.key} maxHeight={300} columns={[
          { key: 'customer', header: 'العميل', render: (row: Row) => customerName(row) },
          { key: 'currency', header: 'العملة', render: (row: Row) => <Ltr>{row.currency}</Ltr> },
          { key: 'before', header: 'المحفظة قبل', numeric: true, render: (row: Row) => rowAmount(row, row.walletMinor) },
          { key: 'ledger', header: 'الدفاتر قبل', numeric: true, render: (row: Row) => rowAmount(row, row.ledgerMinor) },
          { key: 'after', header: 'الرصيد المطابق بعد', numeric: true, render: (row: Row) => rowAmount(row, row.statementMinor) },
          { key: 'difference', header: 'تعديل المحفظة', numeric: true, render: (row: Row) => rowAmount(row, row.difference) },
          { key: 'ledgerDifference', header: 'تعديل الدفاتر', numeric: true, render: (row: Row) => rowAmount(row, row.ledgerDifference) },
          { key: 'entries', header: 'القيود والحساب المقابل', render: (row: Row) => row.corrections.length ? <>
            {row.corrections.map(entry => <div key={entry.entryId}><Open to={`/accounting/entries/${entry.entryId}`}>{entry.number}</Open><Sub>{entry.counterpart}</Sub><Sub>أثر الالتزام بالدولار: {amount(entry.usd, 'USD')}{entry.closureId ? ' · مع معالجة الإقفال السابق' : ''}</Sub></div>)}
            <Sub>تاريخ المعالجة: <Ltr>{row.postingDay}</Ltr></Sub>
          </> : 'لا يلزم قيد؛ الدفاتر مطابقة' },
        ]} footer={review?.length ? totalsFooter(review, 'إجمالي المحافظ المختارة', true) : undefined} />
        <TextField fullWidth required multiline minRows={2} label="سبب التصحيح" value={reason} onChange={event => setReason(event.target.value)} disabled={saving} inputProps={{ maxLength: 1000 }} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions><Button onClick={closeReview} disabled={saving}>إلغاء</Button><Button variant="contained" onClick={repair} disabled={saving || !reason.trim() || !review?.length}>{saving ? 'جارٍ التسوية…' : `اعتماد تسوية ${review?.length || 0} محفظة`}</Button></DialogActions>
    </Dialog>
  </>;
}
