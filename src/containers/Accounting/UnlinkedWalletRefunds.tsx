import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Stack, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { DataTable, Ltr, Money, Open, Sub } from './ui';

export default function UnlinkedWalletRefunds({ onClose, onSelect }: any) {
  const [filters, setFilters] = useState({ q: '', kind: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let stale = false; setBusy(true); setError(''); setData(null);
    const timer = window.setTimeout(() => acc.get('bank/previous-wallet-refunds/all', { ...filters, page })
      .then((res: any) => { if (!stale) setData(res.data); })
      .catch((err: any) => { if (!stale) setError(errorText(err)); })
      .finally(() => { if (!stale) setBusy(false); }), 200);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [filters, page]);
  const change = (values: any) => { setFilters(current => ({ ...current, ...values })); setPage(1); };
  return <Dialog open onClose={onClose} maxWidth="lg" fullWidth dir="rtl">
    <DialogTitle>Refund والتعويضات السابقة غير المرتبطة</DialogTitle>
    <DialogContent>
      <Alert severity="info" className="mb-3">هذه إضافات مسجلة بالفعل لمحافظ العملاء. {onSelect ? 'اختر الحركة ثم راجع المقارنة وأكد الربط؛ الربط المباشر لا يحتاج فاتورة ولا يضيف للمحفظة مرة ثانية.' : 'الاختيار والربط متاحان عند مراجعة سطر استرداد الكشف أو تسجيل ريفاند الطلبية.'}</Alert>
      <Stack direction="row" flexWrap="wrap" sx={{ mb: 2, gap: 1 }}>
        <TextField size="small" label="بحث بالعميل أو البيان أو رقم القيد" value={filters.q} onChange={e => change({ q: e.target.value })} />
        <TextField size="small" select label="النوع" value={filters.kind} onChange={e => change({ kind: e.target.value })} sx={{ minWidth: 150 }}><MenuItem value="">Refund والتعويض</MenuItem><MenuItem value="refund">Refund</MenuItem><MenuItem value="compensation">تعويض</MenuItem></TextField>
        <TextField size="small" type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={e => change({ from: e.target.value })} />
        <TextField size="small" type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={e => change({ to: e.target.value })} />
        <Button onClick={() => change({ q: '', kind: '', from: '', to: '' })}>مسح الفلاتر</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {busy && <Alert severity="info">جارٍ جلب الحركات السابقة...</Alert>}
      {data?.truncated && <Alert severity="warning">تُعرض أحدث ألف حركة للفحص؛ القائمة ليست شاملة لما قبلها.</Alert>}
      {!busy && data && <>
        <Sub>{data.total} حركة غير مرتبطة ومتاحة للربط</Sub>
        <DataTable rows={data.results || []} rowKey={(row: any) => row._id} columns={[
          { key: 'customer', header: 'العميل', render: (row: any) => <><Open to={`/user/${row.partnerId}`}>{row.customerName}</Open><Sub>{row.customerId}</Sub></> },
          { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
          { key: 'kind', header: 'النوع', render: (row: any) => row.kind === 'compensation' ? 'تعويض' : 'Refund' },
          { key: 'amount', header: 'المبلغ الأصلي', render: (row: any) => <Ltr>{row.amount} {row.currency}</Ltr> },
          { key: 'usd', header: 'القيمة الدفترية', render: (row: any) => <Money value={row.usd} /> },
          { key: 'description', header: 'البيان', render: (row: any) => <>{row.description}<Sub>{row.note}</Sub><Sub><Ltr>{row.entryNumber}</Ltr></Sub></> },
          ...(onSelect ? [{ key: 'select', header: '', render: (row: any) => <Button onClick={() => onSelect(row)}>اختيار</Button> }] : []),
        ]} />
        {data.total > 30 && <Pagination className="mt-3" count={Math.ceil(data.total / 30)} page={page} onChange={(_, value) => setPage(value)} />}
      </>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>إغلاق</Button></DialogActions>
  </Dialog>;
}
