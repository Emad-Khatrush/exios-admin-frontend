import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, TextField, Typography } from '@mui/material';
import { acc, CURRENCY_DECIMALS, errorText, EVENT_LABELS, formatMinor, formatUsd } from './accountingApi';
import { DataTable, Ltr, Open, StatusBadge, Sub } from './ui';
import BankReviewComparison, { ReviewField } from './BankReviewComparison';

type Props = { id: string; onClose: () => void; onChanged: () => Promise<void>; onReview: (line: any) => void };
const timestamp = (value: string) => value ? new Date(value).toLocaleString('ar-LY') : '—';
const person = (value: any) => value?.name || [value?.firstName, value?.lastName].filter(Boolean).join(' ') || '—';
const actions: Record<string, string> = { 'bank.lineEdit': 'تعديل بيانات الكشف', 'bank.cancelEntry': 'إلغاء الترحيل', 'bank.match': 'مطابقة', 'bank.manualMatch': 'مطابقة يدوية', 'bank.unmatch': 'فك المطابقة', 'bank.ignore': 'تجاهل', 'bank.createEntry': 'ترحيل قيد', 'bank.createBill': 'إنشاء فاتورة وسداد', 'bank.payExistingBill': 'سداد فاتورة موجودة', 'bank.createDebt': 'إنشاء دين', 'bank.linkGroup': 'ربط مشتريات الطلب', 'bank.import': 'استيراد' };
const valuationLabels: Record<string, string> = { statement: 'مقابل الدولار المذكور في الكشف', direct_cross: 'تصريف مباشر بين العملة الأصلية وعملة البنك', invoice: 'قيمة الفاتورة الأصلية', account_value: 'القيمة الدفترية لحركة البنك', daily: 'سعر اليوم في المنظومة', daily_rate: 'سعر اليوم في المنظومة' };
const sourceLabels: Record<string, string> = { day: 'التاريخ', description: 'البيان', reference: 'مرجع البنك', amount: 'المبلغ بعملة البنك', balanceAfter: 'الرصيد بعد العملية', originalAmount: 'المبلغ الأصلي', originalCurrency: 'العملة الأصلية', counterAmount: 'المبلغ المقابل للتحويل', counterCurrency: 'عملة التحويل المقابلة', settlementUsd: 'مقابل الدولار في الكشف' };

export default function BankLineDetails({ id, onClose, onChanged, onReview }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const [edit, setEdit] = useState<any>(null);
  useEffect(() => {
    let active = true;
    acc.get(`bank/lines/${id}`).then((res: any) => { if (active) setData(res.data); }).catch((err: any) => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [id]);
  const line = data?.line;
  const bank = line?.accountId;
  const currency = bank?.currency || 'USD';
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const beginEdit = () => setEdit({ day: line.day, description: line.description || '', reference: line.reference || '', amount: line.amount / 10 ** decimals,
    balanceAfter: line.balanceAfter == null ? '' : line.balanceAfter / 10 ** decimals,
    originalAmount: line.originalAmount ?? '', originalCurrency: line.originalCurrency || '', counterAmount: line.counterAmount ?? '', counterCurrency: line.counterCurrency || '', settlementUsd: line.settlementUsd ?? '', reason: '' });
  const saveSource = async () => {
    if (busy || !edit?.reason?.trim()) return;
    setBusy(true); setError('');
    try {
      await acc.patch(`bank/lines/${id}`, edit);
      const response = await acc.get(`bank/lines/${id}`);
      setData(response.data); setEdit(null); await onChanged();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  const correction = async () => {
    if (busy || !reason.trim()) return;
    setBusy(true); setError('');
    try {
      const endpoint = line.lineStatus === 'created_entry' ? 'cancel-entry' : 'unignore';
      const res = await acc.post(`bank/lines/${id}/${endpoint}`, { reason: reason.trim() });
      await onChanged();
      onReview({ ...res.data, accountId: bank?._id });
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>تفاصيل سطر الكشف والتعديل</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!data && !error && <CircularProgress size={28} />}
      {data && <>
        {edit && <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography fontWeight={700} mb={1}>تعديل بيانات سطر الكشف</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>عدّل وفق مستند البنك. المبلغ الموجب إيداع والسالب سحب. تُحفظ البيانات الأصلية وسبب التعديل، ولا ينشأ قيد حتى تعتمد الترحيل.</Alert>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
            {[
              ['day', 'التاريخ', 'date'], ['amount', `المبلغ المدفوع / المستلم (${currency})`, 'number'],
              ['description', 'البيان', 'text'], ['reference', 'مرجع البنك', 'text'],
              ['balanceAfter', `الرصيد بعد العملية (${currency})`, 'number'], ['settlementUsd', 'مقابل الدولار المذكور في الكشف (اختياري)', 'number'],
              ['originalAmount', 'المبلغ الأصلي (اختياري)', 'number'], ['originalCurrency', 'العملة الأصلية مثل SAR أو USD', 'text'],
              ['counterAmount', 'المبلغ المستلم بالحساب المقابل للتحويل (اختياري)', 'number'], ['counterCurrency', 'عملة الحساب المقابل للتحويل', 'text'],
            ].map(([key, label, type]) => <TextField key={key} label={label} type={type} value={edit[key]} disabled={busy} InputLabelProps={{ shrink: true }} inputProps={type === 'number' ? { step: 'any' } : undefined} onChange={e => setEdit({ ...edit, [key]: key.includes('Currency') ? e.target.value.toUpperCase() : e.target.value })} />)}
            {line.walletImpact === 'unknown' && <FormControlLabel control={<Checkbox checked={!!edit.confirmWalletImpact} disabled={busy} onChange={e => setEdit({ ...edit, confirmWalletImpact: e.target.checked })} />} label="تأكدت من مستند Alipay أن المبلغ دخل رصيد الحساب" />}
            <TextField label="سبب تعديل بيانات الكشف" value={edit.reason} disabled={busy} onChange={e => setEdit({ ...edit, reason: e.target.value })} />
          </Box>
          <Box mt={2} display="flex" gap={1}><Button disabled={busy || !edit.reason.trim()} variant="contained" onClick={saveSource}>حفظ بيانات الكشف</Button><Button disabled={busy} onClick={() => setEdit(null)}>إلغاء التعديل</Button></Box>
        </Paper>}
        <BankReviewComparison line={line} currency={currency} paid={Math.abs(line.amount) / 10 ** decimals} bankName={`${bank?.code || ''} · ${bank?.name || ''}`} leftTitle="ما سُجل فعلياً في المحاسبة">
          <ReviewField label="الحالة"><StatusBadge status={line.lineStatus} /></ReviewField>
          <ReviewField label="الرصيد بعد العملية">{line.balanceAfter == null ? 'غير مذكور في الكشف' : <Ltr>{formatMinor(line.balanceAfter, currency, decimals)}</Ltr>}</ReviewField>
          <ReviewField label="تاريخ الاستيراد">{timestamp(line.createdAt)}</ReviewField>
          <ReviewField label="آخر تحديث">{timestamp(line.updatedAt)}</ReviewField>
          <ReviewField label="أُدخل بواسطة">{person(line.createdBy)}</ReviewField>
          {line.importBatchId && <ReviewField label="دفعة الاستيراد"><Ltr>{line.importBatchId}</Ltr></ReviewField>}
          {line.orderId && <ReviewField label="الطلبية"><Open to={`/invoice/${line.orderId._id}/edit`}><Ltr>{line.orderId.orderId}</Ltr></Open></ReviewField>}
          {line.valuationUsd != null && <ReviewField label="القيمة المحاسبية بالدولار"><Ltr>{formatUsd(line.valuationUsd * 100)}</Ltr></ReviewField>}
          {line.valuationSource && <ReviewField label="مصدر التقييم">{valuationLabels[line.valuationSource] || line.valuationSource}</ReviewField>}
          {line.crossRate > 0 && <ReviewField label="سعر التصريف المحفوظ"><Ltr>1 {line.rateBaseCurrency} = {Number(line.crossRate).toFixed(6)} {line.rateQuoteCurrency}</Ltr></ReviewField>}
          {line.matchedOriginalAmount > 0 && <ReviewField label="القيمة الأصلية في الفاتورة"><Ltr>{line.matchedOriginalAmount} {line.matchedOriginalCurrency}</Ltr></ReviewField>}
          {line.historicalSettlementPaymentId && <Alert severity="info">تسوية سداد تاريخي: سُوّي مبلغ <Ltr>{formatUsd(line.historicalSettlementUsd)}</Ltr> من المعلّق مقابل خروج البنك. الفاتورة وتكلفة الرحلة الأصلية محفوظتان دون تكلفة أو دفعة مورد مكررة. يظهر السداد التاريخي وقيد التسوية أدناه.</Alert>}
          {line.matchDifferenceConfirmed && <Alert severity="warning">اعتمد المستخدم اختلاف القيمة أو التاريخ عند المطابقة.</Alert>}
          {line.importedValues && <Alert severity="info">عُدلت بيانات هذا السطر. الأصل المستورد: {line.importedValues.day} · {formatMinor(line.importedValues.amount, currency, decimals)} · {line.importedValues.description}{line.importedValues.originalAmount > 0 && ` · ${line.importedValues.originalAmount} ${line.importedValues.originalCurrency}`}. تفاصيل التغييرات محفوظة في سجل الإجراءات.</Alert>}
          {!data.entries.some((e: any) => e.role !== 'history') && <Alert severity="info">لم يُسجل قيد مرتبط حالياً بهذا السطر. الحساب المقترح في الجدول يحتاج موافقة.</Alert>}
          {line.lineStatus === 'matched' && <Alert severity="success">{data.refunds?.some((refund: any) => refund.bankValuationEntryIds?.length) ? 'طُوبق مع الريفاند الموجود، وسُجل فرق تقييم البنك بقيد تسوية مستقل. مبلغ العملة الأصلية ومحفظة العميل محفوظان.' : 'طُوبق مع قيد موجود؛ المطابقة لا تنشئ سداداً جديداً.'}</Alert>}
        </BankReviewComparison>
        {data.bills.map((bill: any) => <Paper key={bill._id} variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700}>فاتورة المورد <Ltr>{bill.number}</Ltr></Typography>
          <ReviewField label="المورد">{bill.vendorId?.name || '—'}</ReviewField>
          <ReviewField label="التاريخ والحالة"><Ltr>{bill.day}</Ltr> · <StatusBadge status={bill.status} /></ReviewField>
          <ReviewField label="قيمة الفاتورة"><Ltr>{bill.total} {bill.currency} · {formatUsd(bill.totalUsd)}</Ltr></ReviewField>
          {bill.rate > 0 && <ReviewField label="سعر التقييم"><Ltr>1 USD = {bill.rate} {bill.currency}</Ltr></ReviewField>}
        </Paper>)}
        {(data.refunds || []).map((refund: any) => <Paper key={refund._id} variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700}>ريفاند الطلبية <Ltr>{refund.number}</Ltr> · <StatusBadge status={refund.status} /></Typography>
          <ReviewField label="المبلغ المرتجع إلى البنك"><Ltr>{refund.amount} {refund.currency}</Ltr></ReviewField>
          <ReviewField label="تخفيض تكلفة الطلبية"><Ltr>{formatUsd(refund.usd)}</Ltr></ReviewField>
          <ReviewField label="المضاف لمحفظة العميل"><Ltr>{formatUsd(refund.walletUsd)}</Ltr></ReviewField>
          {refund.bankValuationBeforeUsd != null && <ReviewField label="تسوية التقييم حسب البنك"><Ltr>{formatUsd(refund.bankValuationBeforeUsd)} → {formatUsd(refund.usd)}</Ltr></ReviewField>}
          <Alert severity="info">استلام البنك وخفض التكلفة مسجلان في هذا الريفاند. إضافة مبلغ العميل لاحقاً تتم على نفس المستند دون تكرار حركة البنك.</Alert>
        </Paper>)}
        {data.payments.map((payment: any) => <Paper key={payment._id} variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700}>سداد المورد <Ltr>{payment.number}</Ltr></Typography>
          <ReviewField label="المبلغ المدفوع"><Ltr>{payment.amount} {payment.currency}</Ltr></ReviewField>
          <ReviewField label="التاريخ والحالة"><Ltr>{payment.day}</Ltr> · <StatusBadge status={payment.status} /></ReviewField>
          {payment.rate > 0 && <ReviewField label="سعر تقييم السداد"><Ltr>1 USD = {payment.rate} {payment.currency}</Ltr></ReviewField>}
          {payment.costDifferenceUsd != null && <ReviewField label="فرق تكلفة السداد"><Ltr>{formatUsd(payment.costDifferenceUsd)}</Ltr></ReviewField>}
        </Paper>)}
        {data.entries.map((entry: any) => <Paper key={entry._id} variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Box display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
            <Typography fontWeight={700}>{entry.role === 'cost' ? 'قيد تكلفة الفاتورة' : entry.role === 'history' ? 'سجل القيود السابقة والعكسية' : 'قيد الحركة / السداد'} · <Open to={`/accounting/entries/${entry._id}`}><Ltr>{entry.number}</Ltr></Open></Typography>
            <StatusBadge status={entry.status} />
          </Box>
          <Sub>{entry.day} · {entry.journalId?.name} · {EVENT_LABELS[entry.eventType] || entry.eventType}</Sub>
          {entry.reversedBy && <Sub><Open to={`/accounting/entries/${entry.reversedBy}`}>عرض القيد العكسي</Open></Sub>}
          {entry.reversalOf && <Sub><Open to={`/accounting/entries/${entry.reversalOf}`}>عرض القيد الذي أُلغي</Open></Sub>}
          <Typography sx={{ my: 1 }}>{entry.description}</Typography>
          <DataTable rows={entry.lines} rowKey={(_: any, i: number) => String(i)} dense columns={[
            { key: 'account', header: 'الحساب الذي تأثر', render: (l: any) => <><Ltr>{l.accountId?.code || l.accountCode}</Ltr> · {l.accountId?.name || 'حساب غير متاح'}<Sub>{l.label}</Sub></> },
            { key: 'debit', header: 'مدين USD', numeric: true, render: (l: any) => <Ltr>{formatUsd(l.debit)}</Ltr> },
            { key: 'credit', header: 'دائن USD', numeric: true, render: (l: any) => <Ltr>{formatUsd(l.credit)}</Ltr> },
            { key: 'native', header: 'المبلغ بعملة الحساب', numeric: true, render: (l: any) => l.amountCurrency == null ? '—' : <Ltr>{formatMinor(l.amountCurrency, l.currency, CURRENCY_DECIMALS[l.currency] ?? ({ KWD: 3, OMR: 3 } as Record<string, number>)[l.currency] ?? 2)}</Ltr> },
            { key: 'rate', header: 'سعر التقييم مقابل الدولار', render: (l: any) => l.rate > 0 ? <Ltr>1 USD = {l.rate} {l.currency}</Ltr> : '—' },
            { key: 'dimensions', header: 'مرتبط بـ', render: (l: any) => <>{l.office && <Sub>المكتب: {l.office}</Sub>}{l.orderId && <Sub>الطلبية: {l.orderId.orderId}</Sub>}{l.tripId && <Sub>الرحلة: {l.tripId.inventoryId || l.tripId.name || l.tripId._id}</Sub>}{l.vendorId && <Sub>المورد: {l.vendorId.name}</Sub>}{l.partnerId && <Sub>العميل: {person(l.partnerId)}</Sub>}{l.employeeId && <Sub>الموظف: {person(l.employeeId)}</Sub>}{l.apKey && <Sub>مرجع المورد: <Ltr>{l.apKey}</Ltr></Sub>}{l.arKey && <Sub>مرجع العميل: <Ltr>{l.arKey}</Ltr></Sub>}</> },
          ]} />
          <Alert severity={entry.totalDebit === entry.totalCredit ? 'success' : 'error'} sx={{ mt: 1 }}>إجمالي المدين {formatUsd(entry.totalDebit)} · إجمالي الدائن {formatUsd(entry.totalCredit)} · {entry.totalDebit === entry.totalCredit ? 'القيد متوازن' : 'القيد غير متوازن'}</Alert>
          {[...(entry.notes || []), ...(entry.fallbacks || [])].map((note: string, i: number) => <Alert key={i} severity="info" sx={{ mt: 1 }}>{note}</Alert>)}
          <Sub>أُنشئ: {timestamp(entry.createdAt)} · بواسطة: {person(entry.createdBy)}{entry.isHistorical && ' · قيد تاريخي'}</Sub>
        </Paper>)}
        {data.audit.length > 0 && <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700} mb={1}>سجل الإجراءات على السطر</Typography>
          {data.audit.map((a: any) => <Box key={a._id}><Sub>{timestamp(a.at)} · {actions[a.action] || a.action} · {person(a.userId)}{a.after?.reason && ` · السبب: ${a.after.reason}`}</Sub>{a.action === 'bank.lineEdit' && Object.entries(sourceLabels).filter(([key]) => (a.before?.[key] ?? '') !== (a.after?.[key] ?? '')).map(([key, label]) => <Sub key={key}>{label}: {['amount', 'balanceAfter'].includes(key) && a.before?.[key] != null ? formatMinor(a.before[key], currency, decimals) : a.before?.[key] ?? '—'} ← {['amount', 'balanceAfter'].includes(key) && a.after?.[key] != null ? formatMinor(a.after[key], currency, decimals) : a.after?.[key] ?? '—'}</Sub>)}</Box>)}
        </Paper>}
      </>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onClose}>إغلاق</Button>
      {line && ['unmatched', 'ignored'].includes(line.lineStatus) && <Button disabled={busy || !!edit} onClick={beginEdit}>تعديل بيانات الكشف</Button>}
      {line && ['unmatched', 'ignored'].includes(line.lineStatus) && <Button disabled={busy || !!edit} variant="contained" onClick={async () => {
        if (busy) return;
        if (line.lineStatus === 'ignored') { setBusy(true); try { const res = await acc.post(`bank/lines/${id}/unignore`); await onChanged(); onReview(res.data); } catch (err) { setError(errorText(err)); } finally { setBusy(false); } }
        else onReview(line);
      }}>اختيار الحساب والمطابقة</Button>}
      {line && ['matched', 'created_entry'].includes(line.lineStatus) && <Button color="warning" variant="outlined" onClick={() => { setReason(''); setCorrecting(true); }}>تصحيح الحساب أو المطابقة</Button>}
    </DialogActions>
    {/* The correction in its own window: what will happen, the reason, then confirm */}
    <Dialog open={correcting && !!line} onClose={busy ? undefined : () => setCorrecting(false)} maxWidth="sm" fullWidth>
      <DialogTitle>تصحيح الحساب أو المطابقة</DialogTitle>
      {line && <DialogContent dividers>
        <Typography mb={1}><Ltr>{line.day}</Ltr> · {line.description} · <b><Ltr>{formatMinor(line.amount, currency, decimals)}</Ltr></b></Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>ما سيحدث:</b> {line.lineStatus === 'created_entry'
            ? 'سيُعكس الترحيل الحالي بقيد عكسي مع حفظ القيود السابقة في السجل، ثم تفتح المراجعة لتختار الحساب أو الفاتورة الصحيحة. الفاتورة التي كانت موجودة قبل الكشف تبقى محفوظة.'
            : line.groupPaymentIds?.length ? `سيُفك ربط السطر وتُلغى ${line.groupPaymentIds.length} دفعة سددها لفواتير الحوالات، فتعود الفواتير غير مسددة، ثم تفتح المراجعة لتختار المطابقة الصحيحة.`
            : 'سيُفك ربط السطر بالقيد الحالي دون تغيير القيد نفسه، ثم تفتح المراجعة لتختار المطابقة الصحيحة.'}
        </Alert>
        <TextField fullWidth autoFocus label="سبب التصحيح (إلزامي)" value={reason} onChange={e => setReason(e.target.value)} disabled={busy}
          helperText="مثلاً: رُحّل كمصروف جديد والصحيح سداد فاتورة الطلبية" />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>}
      <DialogActions>
        <Button disabled={busy} onClick={() => setCorrecting(false)}>إلغاء</Button>
        <Button color="warning" variant="contained" disabled={busy || !reason.trim()} onClick={correction}>{busy ? 'جارٍ التصحيح…' : 'تأكيد وفتح المراجعة'}</Button>
      </DialogActions>
    </Dialog>
  </Dialog>;
}
