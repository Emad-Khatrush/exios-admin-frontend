import { useState } from 'react';
import { Alert, Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { Badge, DataTable, Ltr, Money, Open, Panel, Stat, StatGrid, Sub } from './ui';

const labels: Record<string, string> = {
  bill: 'فاتورة مورد', credit_note: 'إشعار دائن من المورد', refund: 'Refund — استرداد مورد', refund_valuation: 'تسوية تقييم استرداد البنك',
  alipay_valuation: 'تسوية تلقائية لتكلفة حوالة Alipay',
  wallet_refund: 'إرجاع لمحفظة العميل', payment_difference: 'فرق سداد فاتورة المورد',
  recognition: 'نقل بين تكلفة قيد التنفيذ والتكلفة المعترف بها', reversal: 'عكس / إلغاء عملية', other: 'عملية تؤثر في التكلفة',
};

export default function OrderCostBreakdown({ data }: { data: any }) {
  const [selected, setSelected] = useState<any>(null);
  if (!data) return null;
  const docUrl = (doc: any) => doc?.model === 'AccountingSupplierBill' ? `/accounting/bills/${doc._id}` : undefined;
  return <Panel title="مركز تكلفة الطلبية — كيف جاءت التكلفة؟" subtitle="كل تأثير مأخوذ من القيود الفعلية لهذه الطلبية. السداد العادي لا يضيف التكلفة مرة ثانية، ونقل التكلفة بين الحسابات لا يغيّر إجماليها.">
    <StatGrid>
      <Stat label="زيادات التكلفة" value={<Money value={data.increases} />} />
      <Stat label="تخفيضات واستردادات" value={<Money value={data.decreases} />} />
      <Stat label="صافي التكلفة" value={<Money value={data.total} />} hint="الزيادات ناقص التخفيضات" />
      <Stat label="المعترف بها" value={<Money value={data.recognizedCost} />} hint={<>قيد التنفيذ <Money value={data.inProgress} /></>} />
    </StatGrid>
    <Alert severity="info" className="mb-3">مبلغ العميل المضاف للمحفظة يخفض فاتورته وإيرادها. مبلغ استرداد المورد يخفض تكلفة المشتريات. يظهران منفصلين أدناه.</Alert>
    {data.rows?.some((row: any) => row.runningCost < 0) && <Alert severity="warning" className="mb-3">بعض تخفيضات التكلفة مسجلة بتاريخ يسبق فواتير التكلفة؛ قد يظهر إجمالي مؤقت سالب في التسلسل. راجع تواريخ المستندات إذا كانت غير صحيحة. الصافي أعلاه يشمل جميع العمليات.</Alert>}
    <DataTable dense rows={data.rows || []} rowKey={(row: any) => row.entryId} empty={{ title: 'لا عمليات تكلفة مسجلة بعد' }} columns={[
      { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
      { key: 'source', header: 'مصدر العملية', render: (row: any) => <><b>{labels[row.kind] || row.kind}</b>{row.impact === 0 && <Badge tone="muted">لا يغير إجمالي التكلفة</Badge>}<Sub>{row.document?.number} {row.document?.vendor}</Sub><Sub>{row.description}</Sub><Open to={`/accounting/entries/${row.entryId}`}><Ltr>{row.number}</Ltr></Open></> },
      { key: 'impact', header: 'تأثيرها على التكلفة', numeric: true, render: (row: any) => <><Money value={row.impact} strong /><Sub>{row.impact > 0 ? 'زيادة' : row.impact < 0 ? 'تخفيض' : 'نقل أو عملية تخص العميل'}</Sub></> },
      { key: 'running', header: 'التكلفة بعد العملية', numeric: true, render: (row: any) => <Money value={row.runningCost} /> },
      { key: 'details', header: 'التفاصيل', render: (row: any) => <Button size="small" onClick={() => setSelected(row)}>الحسابات والمستند</Button> },
    ]} />
    {selected && <Dialog open onClose={() => setSelected(null)} maxWidth="md" fullWidth>
      <DialogTitle>{labels[selected.kind]} · <Ltr>{selected.number}</Ltr></DialogTitle>
      <DialogContent>
        <p>{selected.description}</p>
        {selected.document && <Alert severity="info" className="mb-3">
          المستند: {docUrl(selected.document) ? <Open to={docUrl(selected.document)!}>{selected.document.number}</Open> : selected.document.number}
          {selected.document.vendor && <Sub>المورد: {selected.document.vendor}</Sub>}
          {selected.document.account && <Sub>الحساب: {selected.document.account.code} · {selected.document.account.name}</Sub>}
          <Sub>مبلغ المستند كاملاً: <Ltr>{selected.document.amount} {selected.document.currency}</Ltr> {selected.document.rate > 0 && <>· سعر التقييم: <Ltr>{selected.document.rate}</Ltr></>}</Sub>
          {selected.document.walletUsd != null && <Sub>إجمالي استرداد المورد بعد التسويات: <Money value={selected.document.valuationUsd} /> · المضاف لمحفظة العميل: <Money value={selected.document.walletUsd} /></Sub>}
          {selected.document.beforeBankUsd != null && <Sub>تقييم البنك قبل التسوية: <Money value={selected.document.beforeBankUsd} /></Sub>}
        </Alert>}
        <p>تأثير هذه العملية على تكلفة الطلبية: <Money value={selected.impact} strong /> · الإجمالي بعد العملية: <Money value={selected.runningCost} /></p>
        <Sub>تفاصيل الحسابات قد تشمل سداد المستند كاملاً؛ تكلفة هذه الطلبية محسوبة من سطورها فقط.</Sub>
        <DataTable rows={selected.lines} rowKey={(line: any) => line._id} columns={[
          { key: 'account', header: 'الحساب', render: (line: any) => <>{line.account?.code} · {line.account?.name}{line.affectsCost && <Sub>يدخل في حساب تكلفة الطلبية</Sub>}{line.otherOrder && <Sub>يخص طلبية أخرى؛ لا يدخل تكلفة هذه الطلبية</Sub>}<Sub>{line.label}</Sub></> },
          { key: 'debit', header: 'مدين', numeric: true, render: (line: any) => <Money value={line.debit} /> },
          { key: 'credit', header: 'دائن', numeric: true, render: (line: any) => <Money value={line.credit} /> },
          { key: 'native', header: 'بعملة الحساب', render: (line: any) => <Money value={line.amountCurrency || 0} currency={line.currency || 'USD'} decimals={line.currencyDecimals} /> },
        ]} />
        {(selected.notes || []).map((note: string, index: number) => <Sub key={index}>{note}</Sub>)}
        <div className="mt-3"><Open to={`/accounting/entries/${selected.entryId}`}>فتح القيد كاملاً</Open></div>
      </DialogContent>
    </Dialog>}
  </Panel>;
}
