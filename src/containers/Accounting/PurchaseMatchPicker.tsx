import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { DataTable, FilterBar, Ltr, Open, Sub } from './ui';
import BankReviewComparison, { ReviewField } from './BankReviewComparison';

const offsetDay = (day: string, offset: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const states: Record<string, string> = { recorded_refund: 'ريفاند مسجل؛ مطابقة فقط', refundable: 'مشتريات أصلية للاسترداد', draft: 'مسودة', open: 'مستحقة', paid: 'مسددة', linked: 'مرتبطة بكشف', unrecorded: 'لم تُسجّل فاتورة لها' };

export default function PurchaseMatchPicker({ open, accountId, line, paid, currency, bankName, onClose, onConfirm, embedded = false, suggestedBillId, suggestedItemId, onBusyChange, refund = false }: any) {
  const [filters, setFilters] = useState({ from: '', to: '', source: 'all', status: 'open', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [confirmDifference, setConfirmDifference] = useState(false);
  const [browsing, setBrowsing] = useState(!suggestedBillId && !suggestedItemId);
  const initialChoice = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [walletUsd, setWalletUsd] = useState('0');
  const [billLineId, setBillLineId] = useState('');
  const [refundOriginalAmount, setRefundOriginalAmount] = useState('');
  useEffect(() => {
    if (!open || !line?.day) return;
    setFilters({ from: offsetDay(line.day, refund ? -180 : -7), to: offsetDay(line.day, refund ? 0 : 7), source: 'all', status: 'open', q: '' });
    setWalletUsd('0'); setBillLineId(''); setRefundOriginalAmount('');
    setPage(1); setSelected(null); setOriginal(null); setBrowsing(!suggestedBillId && !suggestedItemId); initialChoice.current = true; setConfirmDifference(false); setError(''); setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line?._id, line?.day, accountId, refund]);
  useEffect(() => {
    if (!open || !line?.day || !filters.from || !filters.to) { setBusy(false); return undefined; }
    let stale = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      acc.get(refund ? 'bank/refunds' : 'bank/purchases', { accountId, lineId: line._id || undefined, paid, description: line.description,
        originalAmount: line.originalAmount, originalCurrency: line.originalCurrency, suggestedBillId, suggestedItemId, ...filters, page })
        .then((res: any) => { if (!stale) {
          setData(res.data); setOriginal(res.data.original); setError('');
          if (initialChoice.current) {
            const proposal = res.data.results.find((row: any) => row.canMatch && ((suggestedBillId && String(row.billId) === String(suggestedBillId)) || (suggestedItemId && String(row.itemId) === String(suggestedItemId))));
            if (proposal) { setSelected(proposal); setBrowsing(false); } else setBrowsing(true);
            initialChoice.current = false;
          }
        } })
        .catch((err: any) => { if (!stale) { setData(null); setError(errorText(err)); } })
        .finally(() => { if (!stale) setBusy(false); });
    }, 250);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [open, accountId, line?._id, line?.day, line?.description, line?.originalAmount, line?.originalCurrency, paid, filters, page, suggestedBillId, suggestedItemId, refund]);
  useEffect(() => { onBusyChange?.(submitting); return () => onBusyChange?.(false); }, [submitting, onBusyChange]);
  useEffect(() => { contentRef.current?.closest('.MuiDialogContent-root')?.scrollTo({ top: 0 }); }, [browsing]);
  // The bank page mounts this picker before any row is selected. Keep all hooks
  // above this guard so opening/closing it never changes the hook order.
  if (!open || !line?.day) return null;
  const change = (next: any) => { setFilters(current => ({ ...current, ...next })); setPage(1); initialChoice.current = false; setData(null); };
  const sameCurrency = !original?.known || !selected || (refund && selected.kind === 'existing_refund' && !selected.nativeKnown) || original.currency === selected.currency;
  const bankRefundUsd = currency === 'USD' ? Number(paid) : Number(line.settlementUsd) || (line.originalCurrency === 'USD' ? Number(line.originalAmount) : 0);
  const valuationDifference = refund && selected?.kind === 'existing_refund' && bankRefundUsd > 0 ? Math.round((bankRefundUsd - Number(selected.valuationUsd || selected.amount)) * 100) / 100 : 0;
  const amountDifferent = !refund && selected && original?.currency === selected.currency && original.amount > 0 && Math.abs(selected.amount - original.amount) > 0.0005;
  const dateDifferent = (!refund || selected?.kind === 'existing_refund') && selected && line?.day && Math.abs((Date.parse(selected.day) - Date.parse(line.day)) / 86400000) > 7;
  const needsConfirmation = !!(amountDifferent || dateDifferent);
  const daysApart = selected && line?.day ? Math.abs((Date.parse(selected.day) - Date.parse(line.day)) / 86400000) : 0;
  const reasons = selected ? [
    ...(original?.known && sameCurrency ? ['عملة الشراء الأصلية مطابقة'] : []),
    ...(original?.known && sameCurrency && !amountDifferent ? ['المبلغ الأصلي مطابق'] : []),
    ...(daysApart === 0 ? ['التاريخ مطابق'] : daysApart <= 7 ? [`فرق التاريخ ${daysApart} يوم ضمن فترة البحث`] : []),
    ...(selected.source === 'order' ? ['الفاتورة مرتبطة بطلبية'] : ['فاتورة مورد مباشرة']),
  ] : [];
  const warnings = [
    ...(!sameCurrency ? ['عملة الفاتورة تختلف عن العملة الأصلية في الكشف؛ اختر المطابقة الصحيحة.'] : []),
    ...(amountDifferent ? [`فرق المبلغ الأصلي: ${(selected.amount - original.amount).toFixed(3)} ${selected.currency}. يحتاج تأكيدك.`] : []),
    ...(dateDifferent ? [`فرق التاريخ ${daysApart} يوم؛ يحتاج تأكيدك.`] : []),
    ...(selected && !original?.known ? ['عملة الشراء ومبلغها غير موضحين في الكشف؛ راجع الفاتورة المختارة قبل الاعتماد.'] : []),
  ];
  const selectedRefundLine = selected?.refundLines?.find((l: any) => l._id === billLineId) || (selected?.refundLines?.length === 1 ? selected.refundLines[0] : null);
  const content = <div ref={contentRef}>
      {error && <Alert severity="error" className="my-2">{error}</Alert>}
      {!browsing && <BankReviewComparison line={line} currency={currency} paid={paid} bankName={bankName} original={original}
        leftTitle={selected ? (suggestedBillId && String(selected.billId) === String(suggestedBillId)) || (suggestedItemId && String(selected.itemId) === String(suggestedItemId)) ? 'المطابقة المقترحة' : 'المطابقة المختارة' : 'الفاتورة أو المشتريات'} reasons={reasons} warnings={warnings}>
        {selected ? <>
          <ReviewField label="الفاتورة"><Ltr>{selected.number}</Ltr></ReviewField>
          <ReviewField label="المبلغ الأصلي"><Ltr>{selected.amount} {selected.currency}</Ltr></ReviewField>
          <ReviewField label="التاريخ"><Ltr>{selected.day}</Ltr></ReviewField>
          <ReviewField label="المورد">{selected.vendorName || 'حسب مشتريات الطلبية'}</ReviewField>
          {selected.orders.map((order: any, i: number) => <ReviewField key={`${order._id}-${i}`} label="الطلبية"><Open to={`/invoice/${order._id}/edit`}><Ltr>{order.number}</Ltr></Open> · {order.description}</ReviewField>)}
          {!refund && selected.amount > 0 && <ReviewField label="سعر التصريف حسب الفاتورة">{selected.currency === currency ? 'نفس العملة؛ بدون تصريف' : <Ltr>1 {selected.currency} = {(paid / selected.amount).toFixed(6)} {currency}</Ltr>}</ReviewField>}
          {refund && selected.refundableAmount != null && <ReviewField label="المتبقي القابل للاسترداد"><Ltr>{selected.refundableAmount} {selected.currency}</Ltr></ReviewField>}
          {refund && selected.kind === 'existing_refund' && <ReviewField label="أُضيف لمحفظة العميل سابقاً"><Ltr>{selected.walletUsd} USD</Ltr></ReviewField>}
          {selected.openUsd != null && <ReviewField label="المتبقي على الفاتورة"><Ltr>{selected.openUsd} USD</Ltr></ReviewField>}
          <div className="acc-sub mt-2">{selected.description}</div>
          {refund && selected.refundLines?.length > 1 && <TextField select fullWidth className="mt-2" label="بند المشتريات المسترد" value={billLineId} onChange={e => setBillLineId(e.target.value)}>{selected.refundLines.map((l: any) => <MenuItem key={l._id} value={l._id}>{l.description} · {l.amount} {selected.currency} {l.orderNumber && `· ${l.orderNumber}`}</MenuItem>)}</TextField>}
          {refund && selected.kind !== 'existing_refund' && !original?.known && <TextField type="number" fullWidth className="mt-2" label={`مبلغ الاسترداد الأصلي (${selected.currency})`} value={refundOriginalAmount} onChange={e => setRefundOriginalAmount(e.target.value)} />}
          {refund && selectedRefundLine?.target === 'order' && <TextField type="number" fullWidth className="mt-2" label="يُضاف لمحفظة العميل بالدولار" value={walletUsd} onChange={e => setWalletUsd(e.target.value)} helperText="صفر لحفظ استرداد البنك فقط. تستطيع إضافة مبلغ العميل لاحقاً من نفس الريفاند داخل الطلبية." />}
          {valuationDifference !== 0 && <Alert severity="warning" className="mt-3">عند الاعتماد، سيُصحح تقييم البنك من <Ltr>{selected.valuationUsd} USD</Ltr> إلى <Ltr>{bankRefundUsd} USD</Ltr> بقيد تسوية فرق <Ltr>{valuationDifference} USD</Ltr>. مبلغ الليرة لا يتكرر. مبلغ العميل يبقى <Ltr>{selected.walletUsd} USD</Ltr>؛ الفرق بين المسترد من المورد والمضاف للمحفظة <Ltr>{(Math.round((bankRefundUsd - Number(selected.walletUsd)) * 100) / 100)} USD</Ltr>.</Alert>}
          <Alert severity="info" className="mt-3">{refund ? selected.kind === 'existing_refund' ? 'ستُربط الحركة بالريفاند الموجود. أي فرق في مقابل الدولار المكتوب في الكشف يُسجل كتسوية لتقييم البنك وتكلفة الطلبية؛ مبلغ محفظة العميل محفوظ.' : selectedRefundLine?.target === 'order' ? 'سيظهر هذا الاسترداد في قسم الريفاند الموجود بالطلبية. يُسجل استلام البنك وخفض التكلفة مرة واحدة.' : 'سيُسجل إشعار دائن واستلام من المورد على الفاتورة الأصلية، مع خفض تكلفة المشتريات.' : selected.kind === 'order_item' ? 'سيُسجَّل بند الشراء على الطلبية ويُسدد من سطر الكشف.' : selected.status === 'paid' ? 'ستُطابق حركة السداد الموجودة دون إنشاء دفعة جديدة.' : 'سيُسجَّل السداد على الفاتورة الأصلية؛ لا تُنشأ تكلفة أخرى.'}</Alert>
        </> : <Alert severity="info">{busy ? 'جارٍ تجهيز الاقتراح...' : 'افتح قائمة المشتريات لاختيار الفاتورة أو بند الشراء.'}</Alert>}
        {!browsing && <Button disabled={submitting} className="mt-2" onClick={() => setBrowsing(true)}>تغيير الفاتورة أو الطلبية</Button>}
      </BankReviewComparison>}
      {browsing && <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography fontWeight={700}>اختيار الفاتورة أو مشتريات الطلبية</Typography>
        <Button onClick={() => setBrowsing(false)}>العودة للمقارنة</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>اختر العملية لعرض بياناتها في المقارنة، ثم راجعها ووافق عليها.</Typography>
      <FilterBar>
        <TextField size="small" type="date" label="من تاريخ" value={filters.from} InputLabelProps={{ shrink: true }} onChange={e => change({ from: e.target.value })} />
        <TextField size="small" type="date" label="إلى تاريخ" value={filters.to} InputLabelProps={{ shrink: true }} onChange={e => change({ to: e.target.value })} />
        <TextField select size="small" label="مصدر المشتريات" value={filters.source} onChange={e => change({ source: e.target.value })}>
          <MenuItem value="all">جميع المشتريات</MenuItem><MenuItem value="direct">فواتير موردين مباشرة</MenuItem><MenuItem value="order">مشتريات الطلبيات</MenuItem>
        </TextField>
        <TextField select size="small" label="حالة المشتريات" value={filters.status} onChange={e => change({ status: e.target.value })}>
          <MenuItem value="open">المتاحة للمطابقة</MenuItem><MenuItem value="all">الكل، بما فيها المسددة</MenuItem>
        </TextField>
        <TextField size="small" label="بحث برقم الطلبية أو الفاتورة أو المورد" value={filters.q} onChange={e => change({ q: e.target.value })} />
      </FilterBar>
      {data?.truncated && <Alert severity="warning" className="my-2">النتائج كثيرة؛ ضيّق فترة التاريخ لإظهار جميع المشتريات في الفترة المختارة.</Alert>}
      <DataTable rows={data?.results || []} rowKey={(row: any) => row._id} loading={busy} columns={[
        { key: 'choose', header: 'اختيار', render: (row: any) => <Button size="small" disabled={!row.canMatch || busy || submitting} onClick={() => { setSelected(row); setBrowsing(false); setConfirmDifference(false); setError(''); }}>{selected?._id === row._id ? 'مختارة' : 'اختيار'}</Button> },
        { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
        { key: 'source', header: 'المصدر', render: (row: any) => row.source === 'order' ? 'مشتريات طلبية' : 'فاتورة مورد مباشرة' },
        { key: 'purchase', header: 'الفاتورة / الطلبية', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.orders.map((order: any, i: number) => <Sub key={`${order._id}-${i}`}><Open to={`/invoice/${order._id}/edit`}><Ltr>{order.number}</Ltr></Open></Sub>)}<Sub>{row.vendorName} · {row.description}</Sub>{row.merchantMatch && <Sub>المورد مطابق لاسم التاجر في الكشف؛ تأكد من الطلبية والمبلغ قبل الاعتماد.</Sub>}</> },
        { key: 'amount', header: 'المبلغ الأصلي', render: (row: any) => <Ltr>{row.amount} {row.currency}</Ltr> },
        { key: 'status', header: 'الحالة', render: (row: any) => <>{states[row.status]}{row.openUsd != null && <Sub>المتبقي: <Ltr>{row.openUsd} USD</Ltr></Sub>}{row.status === 'paid' && !row.canMatch && <Sub>لا يوجد قيد سداد متاح للمطابقة على هذا البنك.</Sub>}</> },
      ]} />
      {data && <div className="d-flex align-items-center justify-content-between mt-2"><Sub>{data.total} نتيجة</Sub><Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={page} onChange={(_, next) => { setPage(next); initialChoice.current = false; }} /></div>}</>}
      {!browsing && selected && needsConfirmation && <FormControlLabel control={<Checkbox checked={confirmDifference} onChange={e => setConfirmDifference(e.target.checked)} />} label="راجعت اختلاف المبلغ أو التاريخ وأؤكد أنها نفس العملية" />}
      {!selected && !busy && !browsing && <Alert severity="info">اختر الفاتورة أو بند المشتريات لإكمال المطابقة.</Alert>}
  </div>;
  const actions = <><Button disabled={submitting} onClick={onClose}>إلغاء</Button>{!browsing && <Button variant="contained" disabled={busy || submitting || !selected || !sameCurrency || (needsConfirmation && !confirmDifference) || (refund && selected?.kind !== 'existing_refund' && (!selectedRefundLine || (!original?.known && !(Number(refundOriginalAmount) > 0))))} onClick={async () => {
      setSubmitting(true); setError('');
      try { await onConfirm(selected, { confirmDifference, refund, billLineId: selectedRefundLine?._id, walletUsd: Number(walletUsd), refundOriginalAmount: Number(refundOriginalAmount) }); } catch (err: any) { setError(errorText(err)); } finally { setSubmitting(false); }
    }}>{submitting ? 'جارٍ الاعتماد...' : refund ? 'موافقة واعتماد الاسترداد' : 'موافقة وتسجيل السداد'}</Button>}</>;
  if (embedded) return <>{content}<div className="d-flex justify-content-end gap-2 mt-3">{actions}</div></>;
  return <Dialog open={open} onClose={() => { if (!busy && !submitting) onClose(); }} maxWidth="lg" fullWidth>
    <DialogTitle>مراجعة المشتريات والمطابقة</DialogTitle>
    <DialogContent>{content}</DialogContent><DialogActions>{actions}</DialogActions>
  </Dialog>;
}
