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
const states: Record<string, string> = { recorded: 'مسجل في فاتورة مورد', historical_settlement: 'سداد تاريخي — متاح للتسوية', recorded_refund: 'ريفاند مسجل؛ مطابقة فقط', refundable: 'مشتريات أصلية للاسترداد', draft: 'مسودة', open: 'مستحقة', paid: 'مسددة', linked: 'مرتبطة بكشف', unrecorded: 'لم تُسجّل فاتورة لها' };

export default function PurchaseMatchPicker({ open, accountId, line, paid, currency, bankName, onClose, onConfirm, embedded = false, suggestedBillId, suggestedItemId, onBusyChange, refund = false, settlementOnly = false }: any) {
  const [filters, setFilters] = useState({ from: '', to: '', source: 'all', status: 'open', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [confirmDifference, setConfirmDifference] = useState(false);
  const [confirmHistoricalSettlement, setConfirmHistoricalSettlement] = useState(false);
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
    setFilters({ from: settlementOnly ? '' : offsetDay(line.day, refund ? -180 : -7), to: settlementOnly ? '' : offsetDay(line.day, refund ? 0 : 7), source: 'all', status: 'open', q: '' });
    setConfirmHistoricalSettlement(false);
    setWalletUsd('0'); setBillLineId(''); setRefundOriginalAmount('');
    setPage(1); setSelected(null); setOriginal(null); setBrowsing(!suggestedBillId && !suggestedItemId); initialChoice.current = true; setConfirmDifference(false); setError(''); setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line?._id, line?.day, accountId, refund, settlementOnly, suggestedBillId, suggestedItemId]);
  useEffect(() => {
    if (!open || !line?.day) { setBusy(false); return undefined; }
    let stale = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      acc.get(refund ? 'bank/refunds' : 'bank/purchases', { accountId, lineId: line._id || undefined, paid, description: line.description,
        statementAmount: line.amount, movementKind: line.movementKind, day: line.day,
        originalAmount: line.originalAmount, originalCurrency: line.originalCurrency, suggestedBillId, suggestedItemId,
        includeProposal: initialChoice.current ? 'true' : 'false', settlementOnly: settlementOnly ? 'true' : undefined, ...filters, page })
        .then((res: any) => { if (!stale) {
          setData(res.data); setOriginal(res.data.original); setError('');
          if (initialChoice.current) {
            const proposal = res.data.proposal || res.data.results.find((row: any) => ((suggestedBillId && String(row.billId) === String(suggestedBillId)) || (suggestedItemId && String(row.itemId) === String(suggestedItemId))));
            if (proposal) { setSelected({ ...proposal, isSuggestion: true }); setBrowsing(false); } else setBrowsing(true);
            initialChoice.current = false;
          }
        } })
        .catch((err: any) => { if (!stale) { setData(null); setError(errorText(err)); } })
        .finally(() => { if (!stale) setBusy(false); });
    }, 250);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [open, accountId, line?._id, line?.day, line?.amount, line?.movementKind, line?.description, line?.originalAmount, line?.originalCurrency, paid, filters, page, suggestedBillId, suggestedItemId, refund, settlementOnly]);
  useEffect(() => { onBusyChange?.(submitting); return () => onBusyChange?.(false); }, [submitting, onBusyChange]);
  useEffect(() => { contentRef.current?.closest('.MuiDialogContent-root')?.scrollTo({ top: 0 }); }, [browsing]);
  // The bank page mounts this picker before any row is selected. Keep all hooks
  // above this guard so opening/closing it never changes the hook order.
  if (!open || !line?.day) return null;
  const change = (next: any) => { setFilters(current => ({ ...current, ...next })); setPage(1); initialChoice.current = false; setData(null); };
  const sameCurrency = !original?.known || !selected || (refund && selected.kind === 'existing_refund' && !selected.nativeKnown) || original.currency === selected.currency;
  const bankRefundUsd = currency === 'USD' ? Number(paid) : Number(line.settlementUsd) || (line.originalCurrency === 'USD' ? Number(line.originalAmount) : 0);
  const valuationDifference = refund && selected?.kind === 'existing_refund' && bankRefundUsd > 0 ? Math.round((bankRefundUsd - Number(selected.valuationUsd || selected.amount)) * 100) / 100 : 0;
  const selectedRefundLine = selected?.refundLines?.find((l: any) => l._id === billLineId) || (selected?.refundLines?.length === 1 ? selected.refundLines[0] : null);
  const amountComparable = selected && (original?.known || selected.currency === currency) && original?.currency === selected.currency && original.amount > 0 && !(refund && selected.kind === 'existing_refund' && !selected.nativeKnown);
  const amountDifferent = amountComparable && Math.abs(selected.amount - original.amount) > 0.0005;
  const partialRefund = refund && selected?.kind !== 'existing_refund' && amountDifferent && original.amount < selected.amount;
  const refundAmount = original?.known ? Number(original.amount) : Number(refundOriginalAmount);
  const refundTooLarge = refund && selected && selected.kind !== 'existing_refund' && refundAmount > 0
    && (refundAmount > Number(selected.refundableAmount) + 0.0005 || (selectedRefundLine && refundAmount > Number(selectedRefundLine.amount) + 0.0005));
  const directionWrong = refund ? (line.amount !== undefined && Number(line.amount) <= 0) || line.movementKind === 'card_payment' : line.amount !== undefined && Number(line.amount) >= 0;
  const futureRefundBill = refund && selected?.kind !== 'existing_refund' && selected?.day > line.day;
  const recordedBankMismatch = refund && selected?.kind === 'existing_refund' && (selected.bankCurrency !== currency || Math.abs(Number(selected.bankAmount) - Number(paid)) > 0.0005);
  const blocked = (!!selected?.historicalSettlement && !confirmHistoricalSettlement) || directionWrong || !sameCurrency || selected?.merchantMismatch || refundTooLarge || futureRefundBill || recordedBankMismatch || selected?.canMatch === false;
  const dateDifferent = (!refund || selected?.kind === 'existing_refund') && selected && line?.day && Math.abs((Date.parse(selected.day) - Date.parse(line.day)) / 86400000) > 7;
  const needsConfirmation = !!((!refund && amountDifferent) || (partialRefund && !refundTooLarge) || dateDifferent
    || (selected && !selected.merchantMatch && !selected.merchantMismatch));
  const daysApart = selected && line?.day ? Math.abs((Date.parse(selected.day) - Date.parse(line.day)) / 86400000) : 0;
  const reasons = selected ? [
    ...(original?.known && sameCurrency ? ['عملة الشراء الأصلية مطابقة'] : []),
    ...(amountComparable && !amountDifferent ? ['المبلغ الأصلي مطابق'] : []),
    ...(refund && selected.kind === 'existing_refund' && !recordedBankMismatch ? ['المبلغ المستلم بعملة البنك مطابق'] : []),
    ...(daysApart === 0 ? ['التاريخ مطابق'] : daysApart <= 7 ? [`فرق التاريخ ${daysApart} يوم ضمن فترة البحث`] : []),
    ...(selected.merchantMatch ? ['المورد مطابق لتاجر الكشف'] : []),
  ] : [];
  const warnings = [
    ...(selected?.matchProblems || []),
    ...(selected?.canMatch === false && !selected?.matchProblems?.length ? [selected.status === 'paid' ? 'الفاتورة مسددة، ولا يوجد سداد متاح للمطابقة على هذا البنك. راجع السداد الأصلي أو اختر فاتورة أخرى.' : 'هذا الاقتراح غير متاح للربط حاليًا؛ راجع حالته أو اختر البديل.'] : []),
    ...(directionWrong ? [refund ? 'هذه حركة خارجة من البنك وليست استرداداً وارداً، أو أنها سداد بطاقة. لا يمكن اعتمادها كريفاند.' : 'هذه حركة واردة وليست سداد مشتريات.'] : []),
    ...(selected?.merchantMismatch ? [`المورد المختار مختلف عن تاجر الكشف (${selected.statementVendorName || 'المورد المعروف'}). لا يمكن اعتماد الربط.`] : []),
    ...(!sameCurrency ? ['عملة الفاتورة تختلف عن العملة الأصلية في الكشف؛ اختر المطابقة الصحيحة.'] : []),
    ...(amountDifferent ? [partialRefund ? `استرداد جزئي بقيمة ${original.amount} ${original.currency} من فاتورة قيمتها ${selected.amount} ${selected.currency}؛ هذا ليس تطابقاً كاملاً للمبلغ.` : `المبلغ غير مطابق: الكشف ${original.amount} ${original.currency} والفاتورة ${selected.amount} ${selected.currency}.`] : []),
    ...(refundTooLarge ? ['مبلغ الاسترداد أكبر من المتبقي في الفاتورة أو البند المختار. اختر الفاتورة الصحيحة.'] : []),
    ...(futureRefundBill ? ['تاريخ الفاتورة بعد الاسترداد؛ الاختيار غير صالح.'] : []),
    ...(recordedBankMismatch ? ['مبلغ الريفاند المسجل أو حساب عملته لا يطابق المبلغ المستلم في الكشف.'] : []),
    ...(selected && !selected.merchantMatch && !selected.merchantMismatch ? ['هوية المورد لم تُثبت من نص الكشف؛ تشابه المبلغ والتاريخ وحده لا يثبت أنها نفس العملية.'] : []),
    ...(dateDifferent ? [`فرق التاريخ ${daysApart} يوم؛ يحتاج تأكيدك.`] : []),
    ...(selected && !original?.known ? ['عملة الشراء ومبلغها غير موضحين في الكشف؛ راجع الفاتورة المختارة قبل الاعتماد.'] : []),
  ];
  const content = <div ref={contentRef}>
      {error && <Alert severity="error" className="my-2">{error}</Alert>}
      {data?.proposalUnavailable && <Alert severity="warning" className="my-2">{data.proposalUnavailable}</Alert>}
      {!browsing && <BankReviewComparison line={line} currency={currency} paid={paid} bankName={bankName} original={original}
        leftTitle={selected ? selected.isSuggestion ? 'المطابقة المقترحة — تحتاج موافقتك' : 'المطابقة المختارة' : 'الفاتورة أو المشتريات'} reasons={reasons} warnings={warnings}>
        {selected ? <>
          <ReviewField label="الفاتورة"><Ltr>{selected.number}</Ltr></ReviewField>
          <ReviewField label="المبلغ الأصلي"><Ltr>{selected.amount} {selected.currency}</Ltr></ReviewField>
          <ReviewField label="التاريخ"><Ltr>{selected.day}</Ltr></ReviewField>
          <ReviewField label="المورد">{selected.vendorName || 'حسب مشتريات الطلبية'}</ReviewField>
          {selected.orders.map((order: any, i: number) => <ReviewField key={`${order._id}-${i}`} label="الطلبية"><Open to={`/invoice/${order._id}/edit`}><Ltr>{order.number}</Ltr></Open> · {order.description}</ReviewField>)}
          {selected.trips?.map((trip: any, i: number) => <ReviewField key={`${trip._id}-${i}`} label="الرحلة"><Ltr>{trip.number}</Ltr> · {trip.description}</ReviewField>)}
          {selected.historicalSettlement && <>
            <ReviewField label="السداد التاريخي"><Ltr>{selected.historicalSettlement.paymentNumber} · {selected.historicalSettlement.paymentDay}</Ltr></ReviewField>
            <ReviewField label="حساب السداد السابق">{selected.historicalSettlement.accountName}</ReviewField>
            <ReviewField label="قيمة تسوية المعلّق"><Ltr>{selected.historicalSettlement.amountUsd} USD</Ltr></ReviewField>
            <Alert severity="info" className="my-2">{selected.historicalSettlement.explanation} أي فرق في التقييم بين السداد التاريخي والقيمة الدفترية للبنك يُسجل في حساب فرق الصرف.</Alert>
            <FormControlLabel control={<Checkbox checked={confirmHistoricalSettlement} onChange={e => { setConfirmHistoricalSettlement(e.target.checked); setConfirmDifference(e.target.checked); }} />} label="راجعت المورد ومرجع الحوالة وأؤكد أنها تسوية السداد التاريخي نفسه" />
          </>}
          {!refund && selected.amount > 0 && <ReviewField label="سعر التصريف حسب الفاتورة">{selected.currency === currency ? 'نفس العملة؛ بدون تصريف' : <Ltr>1 {selected.currency} = {(paid / selected.amount).toFixed(6)} {currency}</Ltr>}</ReviewField>}
          {refund && selected.refundableAmount != null && <ReviewField label="المتبقي القابل للاسترداد"><Ltr>{selected.refundableAmount} {selected.currency}</Ltr></ReviewField>}
          {refund && selected.kind === 'existing_refund' && <ReviewField label="أُضيف لمحفظة العميل سابقاً"><Ltr>{selected.walletUsd} USD</Ltr></ReviewField>}
          {selected.openUsd != null && <ReviewField label="المتبقي على الفاتورة"><Ltr>{selected.openUsd} USD</Ltr></ReviewField>}
          <div className="acc-sub mt-2">{selected.description}</div>
          {refund && selected.refundLines?.length > 1 && <TextField select fullWidth className="mt-2" label="بند المشتريات المسترد" value={billLineId} onChange={e => setBillLineId(e.target.value)}>{selected.refundLines.map((l: any) => <MenuItem key={l._id} value={l._id}>{l.description} · {l.amount} {selected.currency} {l.orderNumber && `· ${l.orderNumber}`}</MenuItem>)}</TextField>}
          {refund && selected.kind !== 'existing_refund' && !original?.known && <TextField type="number" fullWidth className="mt-2" label={`مبلغ الاسترداد الأصلي (${selected.currency})`} value={refundOriginalAmount} onChange={e => setRefundOriginalAmount(e.target.value)} />}
          {refund && selectedRefundLine?.target === 'order' && <TextField type="number" fullWidth className="mt-2" label="يُضاف لمحفظة العميل بالدولار" value={walletUsd} onChange={e => setWalletUsd(e.target.value)} helperText="صفر لحفظ استرداد البنك فقط. تستطيع إضافة مبلغ العميل لاحقاً من نفس الريفاند داخل الطلبية." />}
          {valuationDifference !== 0 && <Alert severity="warning" className="mt-3">عند الاعتماد، سيُصحح تقييم البنك من <Ltr>{selected.valuationUsd} USD</Ltr> إلى <Ltr>{bankRefundUsd} USD</Ltr> بقيد تسوية فرق <Ltr>{valuationDifference} USD</Ltr>. مبلغ الليرة لا يتكرر. مبلغ العميل يبقى <Ltr>{selected.walletUsd} USD</Ltr>؛ الفرق بين المسترد من المورد والمضاف للمحفظة <Ltr>{(Math.round((bankRefundUsd - Number(selected.walletUsd)) * 100) / 100)} USD</Ltr>.</Alert>}
          {!blocked && !selected.historicalSettlement && <Alert severity="info" className="mt-3">{refund ? selected.kind === 'existing_refund' ? 'ستُربط الحركة بالريفاند الموجود. أي فرق في مقابل الدولار المكتوب في الكشف يُسجل كتسوية لتقييم البنك وتكلفة الطلبية؛ مبلغ محفظة العميل محفوظ.' : selectedRefundLine?.target === 'order' ? 'سيظهر هذا الاسترداد في قسم الريفاند الموجود بالطلبية. يُسجل استلام البنك وخفض التكلفة مرة واحدة.' : 'سيُسجل إشعار دائن واستلام من المورد على الفاتورة الأصلية، مع خفض تكلفة المشتريات.' : selected.kind === 'order_item' ? 'سيُسجَّل بند الشراء على الطلبية ويُسدد من سطر الكشف.' : selected.status === 'paid' ? 'ستُطابق حركة السداد الموجودة دون إنشاء دفعة جديدة.' : 'سيُسجَّل السداد على الفاتورة الأصلية؛ لا تُنشأ تكلفة أخرى.'}</Alert>}
        </> : <Alert severity="info">{busy ? 'جارٍ تجهيز الاقتراح...' : 'افتح قائمة المشتريات لاختيار الفاتورة أو بند الشراء.'}</Alert>}
        {!browsing && <Button disabled={submitting} className="mt-2" onClick={() => setBrowsing(true)}>تغيير الفاتورة أو الطلبية</Button>}
      </BankReviewComparison>}
      {browsing && <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography fontWeight={700}>{settlementOnly ? 'اختيار فاتورة السداد التاريخي' : 'اختيار الفاتورة أو تكلفة الطلبية أو الرحلة'}</Typography>
        <Button disabled={!selected} onClick={() => setBrowsing(false)}>العودة للمقارنة</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>اختر العملية لعرض بياناتها في المقارنة، ثم راجعها ووافق عليها.</Typography>
      <FilterBar>
        <TextField size="small" type="date" label="من تاريخ" value={filters.from} InputLabelProps={{ shrink: true }} onChange={e => change({ from: e.target.value })} />
        <TextField size="small" type="date" label="إلى تاريخ" value={filters.to} InputLabelProps={{ shrink: true }} onChange={e => change({ to: e.target.value })} />
        <TextField select size="small" label="مصدر المشتريات" value={filters.source} onChange={e => change({ source: e.target.value })}>
          <MenuItem value="all">جميع التكاليف</MenuItem><MenuItem value="direct">فواتير موردين مباشرة</MenuItem><MenuItem value="order">مشتريات الطلبيات</MenuItem>{!refund && <MenuItem value="trip">تكاليف الرحلات والشحن</MenuItem>}
        </TextField>
        <TextField select size="small" label="حالة المشتريات" value={filters.status} onChange={e => change({ status: e.target.value })}>
          <MenuItem value="open">المتاحة للمطابقة</MenuItem><MenuItem value="all">الكل، بما فيها المسددة</MenuItem>
        </TextField>
        <TextField size="small" label="بحث برقم الطلبية أو الفاتورة أو المورد" value={filters.q} onChange={e => {
          const q = e.target.value;
          change({ q, ...(/^\s*\d{4}\s*[-–—]?\s*\d{4}\s*$/.test(q) ? { from: '', to: '', source: 'all', status: 'all' } : {}) });
        }} helperText="رقم الطلبية الكامل يبحث في جميع التواريخ والحالات" />
        <Button onClick={() => change({ from: '', to: '', source: 'all', status: 'all' })}>كل التواريخ والحالات</Button>
      </FilterBar>
      {!settlementOnly && data?.orderLookup?.map((order: any) => <Alert key={order._id} severity={order.canceled || (!order.purchaseItemsCount && !data.results.some((row: any) => row.source === 'trip')) ? 'warning' : 'info'} className="my-2">
        الطلبية <Ltr>{order.number}</Ltr> موجودة{order.canceled ? ' لكنها ملغاة ولا يمكن ربطها.' : !order.purchaseItemsCount && data.results.some((row: any) => row.source === 'trip') ? ' وتكاليف الرحلة موجودة ضمن فواتير الشحن الظاهرة أدناه؛ اختر الفاتورة الأصلية.' : !order.purchaseItemsCount ? ' ولا تحتوي بنود مشتريات. راجع فواتيرها، أو سجّل تكلفة المورد الفعلية داخل الطلبية قبل الربط؛ اختيار رقم الطلب وحده لا ينشئ تكلفة صحيحة.' : ` وبها ${order.purchaseItemsCount} بند مشتريات. راجع النتائج وسبب عدم إتاحة الاختيار إن ظهر.`}
        {' '}<Open to={`/invoice/${order._id}/edit`}>فتح الطلبية</Open>
      </Alert>)}
      {data?.truncated && <Alert severity="warning" className="my-2">النتائج كثيرة؛ ضيّق فترة التاريخ لإظهار جميع المشتريات في الفترة المختارة.</Alert>}
      <DataTable rows={data?.results || []} rowKey={(row: any) => row._id} loading={busy} columns={[
        { key: 'choose', header: 'اختيار', render: (row: any) => <Button size="small" disabled={!row.canMatch || busy || submitting} onClick={() => { setSelected(row); setBrowsing(false); setConfirmDifference(false); setConfirmHistoricalSettlement(false); setError(''); }}>{selected?._id === row._id ? 'مختارة' : 'اختيار'}</Button> },
        { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
        { key: 'source', header: 'المصدر', render: (row: any) => row.source === 'trip' ? 'تكلفة رحلة / شحن' : row.source === 'order' ? 'مشتريات طلبية' : 'فاتورة مورد مباشرة' },
        { key: 'purchase', header: 'الفاتورة / الطلبية', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.orders.map((order: any, i: number) => <Sub key={`${order._id}-${i}`}><Open to={`/invoice/${order._id}/edit`}><Ltr>{order.number}</Ltr></Open></Sub>)}<Sub>{row.vendorName} · {row.description}</Sub>{row.merchantMatch && <Sub>المورد مطابق لاسم التاجر في الكشف؛ تأكد من الطلبية والمبلغ قبل الاعتماد.</Sub>}</> },
        { key: 'amount', header: 'المبلغ الأصلي', render: (row: any) => <Ltr>{row.amount} {row.currency}</Ltr> },
        { key: 'status', header: 'الحالة', render: (row: any) => <>{states[row.status]}{row.matchProblems?.map((problem: string) => <Sub key={problem}>{problem}</Sub>)}{row.openUsd != null && <Sub>المتبقي: <Ltr>{row.openUsd} USD</Ltr></Sub>}{row.status === 'paid' && !row.canMatch && <Sub>لا يوجد قيد سداد متاح للمطابقة على هذا البنك.</Sub>}</> },
      ]} />
      {data && <div className="d-flex align-items-center justify-content-between mt-2"><Sub>{data.total} نتيجة</Sub><Pagination count={Math.max(1, Math.ceil(data.total / data.pageSize))} page={page} onChange={(_, next) => { setPage(next); initialChoice.current = false; }} /></div>}</>}
      {!browsing && selected && !selected.historicalSettlement && needsConfirmation && <FormControlLabel control={<Checkbox checked={confirmDifference} onChange={e => setConfirmDifference(e.target.checked)} />} label="راجعت بيانات العملية والاختلافات وأؤكد أنها نفس العملية" />}
      {!selected && !busy && !browsing && <Alert severity="info">اختر الفاتورة أو بند المشتريات لإكمال المطابقة.</Alert>}
  </div>;
  const actions = <><Button disabled={submitting} onClick={onClose}>إلغاء</Button>{!browsing && <Button variant="contained" disabled={busy || submitting || !selected || blocked || (needsConfirmation && !confirmDifference) || (refund && selected?.kind !== 'existing_refund' && (!selectedRefundLine || (!original?.known && !(Number(refundOriginalAmount) > 0))))} onClick={async () => {
      setSubmitting(true); setError('');
      try { await onConfirm(selected, { confirmDifference, historicalSettlement: !!selected.historicalSettlement, confirmHistoricalSettlement, refund, billLineId: selectedRefundLine?._id, walletUsd: Number(walletUsd), refundOriginalAmount: Number(refundOriginalAmount) }); } catch (err: any) { setError(errorText(err)); } finally { setSubmitting(false); }
    }}>{submitting ? 'جارٍ الاعتماد...' : refund ? 'موافقة واعتماد الاسترداد' : selected?.historicalSettlement ? 'اعتماد تسوية السداد التاريخي' : 'موافقة وتسجيل السداد'}</Button>}</>;
  if (embedded) return <>{content}<div className="d-flex justify-content-end gap-2 mt-3">{actions}</div></>;
  return <Dialog open={open} onClose={() => { if (!busy && !submitting) onClose(); }} maxWidth="lg" fullWidth>
    <DialogTitle>مراجعة المشتريات والمطابقة</DialogTitle>
    <DialogContent>{content}</DialogContent><DialogActions>{actions}</DialogActions>
  </Dialog>;
}
