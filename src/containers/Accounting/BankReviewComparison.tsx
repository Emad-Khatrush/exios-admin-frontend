import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { Ltr } from './ui';

export const ReviewField = ({ label, children }: any) => <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: .65 }}>
  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
  <Box sx={{ textAlign: 'left', overflowWrap: 'anywhere', fontSize: 14 }}>{children}</Box>
</Box>;

export default function BankReviewComparison({ line, currency, paid, bankName, original, leftTitle, children, reasons = [], warnings = [] }: any) {
  const native = original?.known ? original : line?.originalAmount > 0 ? { amount: line.originalAmount, currency: line.originalCurrency } : null;
  return <Box>
    <Box data-bank-review-comparison style={{ direction: 'ltr' }} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
      <Paper data-bank-review-statement variant="outlined" dir="rtl" sx={{ gridColumn: { xs: 1, md: 2 }, gridRow: 1, p: 2.5, borderRadius: 3, bgcolor: '#f7fafc', borderColor: '#dbe6ee' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography fontWeight={700}>كشف الحساب</Typography>
          <Chip size="small" label={line?.amount < 0 ? 'مبلغ مدفوع' : 'مبلغ مستلم'} variant="outlined" />
        </Stack>
        <Typography sx={{ fontSize: 25, fontWeight: 700, color: line?.amount < 0 ? '#b42318' : '#067647', mb: 1 }}><Ltr>{Number(paid || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })} {currency}</Ltr></Typography>
        {bankName && <ReviewField label="الحساب">{bankName}</ReviewField>}
        <ReviewField label="التاريخ"><Ltr>{line?.day}</Ltr></ReviewField>
        {line?.reference && <ReviewField label="المرجع"><Ltr>{line.reference}</Ltr></ReviewField>}
        {line?.sourceProvider === 'alipay' && <>
          {line.counterparty && <ReviewField label="الطرف في Alipay">{line.counterparty}</ReviewField>}
          {line.merchantOrderId && <ReviewField label="رقم طلب التاجر"><Ltr>{line.merchantOrderId}</Ltr></ReviewField>}
          <ReviewField label="طريقة الدفع / الاستلام">{line.paymentMethod?.startsWith('账户余额') ? 'رصيد Alipay' : line.paymentMethod || 'غير مذكورة؛ تحتاج تأكيد وصولها للرصيد'}</ReviewField>
          <ReviewField label="حالة العملية في الكشف">{({ '交易成功': 'عملية ناجحة', '支付成功': 'دفع ناجح', '退款成功': 'استرداد ناجح' } as Record<string, string>)[line.transactionStatus] || line.transactionStatus}</ReviewField>
          {line.sourceTime && <ReviewField label="وقت العملية كما ورد في الكشف"><Ltr>{line.sourceTime}</Ltr></ReviewField>}
          {line.walletImpact === 'unknown' && <Typography color="error" variant="body2">أكد وصول المبلغ إلى رصيد Alipay من تفاصيل السطر قبل الاعتماد.</Typography>}
        </>}
        {native && <ReviewField label="عملة الشراء الأصلية"><Ltr>{native.amount} {native.currency}</Ltr></ReviewField>}
        {native?.amount > 0 && paid > 0 && <ReviewField label="سعر التصريف">{native.currency === currency ? 'نفس العملة؛ بدون تصريف' : <Ltr>1 {native.currency} = {(paid / native.amount).toFixed(6)} {currency}</Ltr>}</ReviewField>}
        {line?.counterAmount > 0 && line.counterCurrency && line.counterCurrency !== currency && native?.currency !== line.counterCurrency && paid > 0 && <>
          <ReviewField label="المبلغ في الحساب المقابل"><Ltr>{line.counterAmount} {line.counterCurrency}</Ltr></ReviewField>
          <ReviewField label="سعر تصريف التحويل"><Ltr>1 {currency === 'USD' ? currency : line.counterCurrency} = {(currency === 'USD' ? line.counterAmount / paid : paid / line.counterAmount).toFixed(6)} {currency === 'USD' ? line.counterCurrency : currency}</Ltr></ReviewField>
        </>}
        {line?.settlementUsd > 0 && <ReviewField label="مقابل الدولار في الكشف"><Ltr>{line.settlementUsd} USD</Ltr></ReviewField>}
        {line?.settlementUsd > 0 && currency !== 'USD' && native?.currency !== 'USD' && <ReviewField label="سعر الدولار في العملية"><Ltr>1 USD = {(paid / line.settlementUsd).toFixed(6)} {currency}</Ltr></ReviewField>}
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" color="text.secondary">البيان كما ورد في الكشف</Typography>
        <Typography variant="body2" sx={{ mt: .5, overflowWrap: 'anywhere', lineHeight: 1.9 }} dir="auto">{line?.description || '—'}</Typography>
      </Paper>
      <Paper data-bank-review-record variant="outlined" dir="rtl" sx={{ gridColumn: 1, gridRow: { xs: 2, md: 1 }, p: 2.5, borderRadius: 3, borderColor: '#b9d9d5', boxShadow: '0 3px 16px #0e615b08' }}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>{leftTitle}</Typography>
        {children}
      </Paper>
    </Box>
    {!!reasons.length && <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f8f5', borderRadius: 2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>معايير المقارنة — لا تعني اعتماد المطابقة</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>{reasons.map((reason: string, i: number) => <Chip key={i} size="small" label={reason} sx={{ bgcolor: '#fff', color: '#14634f' }} />)}</Stack>
    </Box>}
    {!!warnings.length && <Box sx={{ mt: 1.5, p: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2 }}>
      {warnings.map((warning: string, i: number) => <Typography key={i} variant="body2" sx={{ lineHeight: 1.9, color: '#92400e' }}>{warning}</Typography>)}
    </Box>}
  </Box>;
}
