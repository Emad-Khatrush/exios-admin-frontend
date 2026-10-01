import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { EVENT_LABELS, OFFICE_LABELS, acc, errorText } from './accountingApi';
import { AccountRef, Badge, DataTable, Ltr, Money, Open, PageHeader, Panel, Sub } from './ui';

// Internal references with no page of their own
const DIMENSIONS: [string, string][] = [['employeeId', 'الموظف'], ['assetId', 'الأصل']];

const EntryDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const load = async () => {
    try {
      setError('');
      setData((await acc.get(`entries/${id}`)).data);
    } catch (err) {
      setError(errorText(err));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const cancel = async () => {
    try {
      setIsCancelling(true);
      await acc.post(`entries/${id}/cancel`, { reason });
      setCancelOpen(false);
      await load();
    } catch (err) {
      setError(errorText(err));
      setCancelOpen(false);
    }
    setIsCancelling(false);
  };

  if (!data && error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <div className="acc-empty">جارٍ التحميل…</div>;

  const { entry, related, source } = data;
  const names = data.names || {};
  // Money into a cash box prints as a receipt voucher, money out as a payment voucher
  const cashNet = entry.lines.filter((line: any) => line.isCash).reduce((sum: number, line: any) => sum + line.debit - line.credit, 0);
  const canCancel = entry.eventType === 'MANUAL' && entry.status === 'posted';
  const relatedEntry = (entryId: string) => related.find((item: any) => item._id === entryId);
  const totalDebit = entry.lines.reduce((sum: number, line: any) => sum + line.debit, 0);
  const totalCredit = entry.lines.reduce((sum: number, line: any) => sum + line.credit, 0);

  return (
    <>
      <PageHeader
        title={<>قيد <Ltr>{entry.number}</Ltr></>}
        subtitle={<>
          <Ltr>{entry.day}</Ltr> · {entry.journalId?.name} · {EVENT_LABELS[entry.eventType] || entry.eventType}
          {entry.createdBy && ` · بواسطة ${entry.createdBy.firstName} ${entry.createdBy.lastName}`}
        </>}
        actions={<>
          {entry.status === 'reversed' && <Badge tone="muted">أُلغي</Badge>}
          {entry.reversalOf && <Badge tone="warn">قيد عكسي</Badge>}
          {entry.isHistorical && <Badge tone="info">تاريخي</Badge>}
          {cashNet !== 0 && <Button variant="outlined" component="a" href={`/accounting/vouchers/${entry._id}`} target="_blank" rel="noreferrer">{cashNet > 0 ? 'سند قبض' : 'سند صرف'} ↗</Button>}
          {source?.url && <Button variant="outlined" component="a" href={source.url} target="_blank" rel="noreferrer">فتح {source.label} ↗</Button>}
          {canCancel && <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)}>إلغاء القيد</Button>}
        </>}
      />
      {error && <Alert severity="error" className="mb-2">{error}</Alert>}
      {entry.reversedBy && relatedEntry(entry.reversedBy) && (
        <Alert severity="info" className="mb-2">أُلغي هذا القيد بالقيد <RouterLink className="acc-link" to={`/accounting/entries/${entry.reversedBy}`}>{relatedEntry(entry.reversedBy).number}</RouterLink>.</Alert>
      )}
      {entry.reversalOf && relatedEntry(entry.reversalOf) && (
        <Alert severity="info" className="mb-2">هذا القيد يعكس القيد <RouterLink className="acc-link" to={`/accounting/entries/${entry.reversalOf}`}>{relatedEntry(entry.reversalOf).number}</RouterLink>.</Alert>
      )}
      {!canCancel && entry.status === 'posted' && !entry.reversalOf && entry.eventType !== 'MANUAL' && (
        <Alert severity="info" className="mb-2">قيد تلقائي. يُلغى بإلغاء المستند الذي أنشأه، فيُعكس تلقائياً.</Alert>
      )}
      {(entry.notes || []).map((note: string) => <Alert key={note} severity="warning" className="mb-2">{note}</Alert>)}
      {(entry.fallbacks || []).length > 0 && <Alert severity="warning" className="mb-2">افتراضات استُخدمت: {entry.fallbacks.join(' · ')}</Alert>}

      <Panel flush title="البيان" subtitle={entry.description}>
        <DataTable
          rows={entry.lines}
          rowKey={(_: any, index: number) => String(index)}
          columns={[
            {
              key: 'account', header: 'الحساب', render: (line: any) => (
                <>
                  <RouterLink className="acc-link" to={`/accounting/accounts/${line.accountId}`}><AccountRef code={line.accountCode} name={line.accountName} /></RouterLink>
                  {line.label && <Sub>{line.label}</Sub>}
                </>
              ),
            },
            {
              key: 'details', header: 'التفاصيل', hideOnMobile: true, render: (line: any) => (
                <>
                  {line.partnerId && <Sub>العميل: <Open to={`/user/${line.partnerId._id}`}>{line.partnerId.customerId} {line.partnerId.firstName} {line.partnerId.lastName}</Open></Sub>}
                  {line.office && <Sub>المكتب: {OFFICE_LABELS[line.office] || line.office}</Sub>}
                  {line.orderId && <Sub>الطلب: <Open to={`/invoice/${line.orderId}/edit`}><Ltr>{names.orders?.[line.orderId] || line.orderId}</Ltr></Open></Sub>}
                  {line.packageId && <Sub>الطرد: <Ltr>{names.packages?.[line.packageId] || line.packageId}</Ltr></Sub>}
                  {line.tripId && <Sub>الرحلة: <Open to={`/inventory/${line.tripId}/edit`}><Ltr>{names.trips?.[line.tripId] || line.tripId}</Ltr></Open></Sub>}
                  {line.vendorId && <Sub>المورد: <Open to={`/accounting/vendors/${line.vendorId}`}>{names.vendors?.[line.vendorId] || line.vendorId}</Open></Sub>}
                  {String(line.apKey || '').startsWith('BILL:') && <Sub>فاتورة المورد: <Open to={`/accounting/bills/${line.apKey.split(':')[1]}`}>فتح الفاتورة</Open></Sub>}
                  {DIMENSIONS.filter(([field]) => line[field]).map(([field, label]) => <Sub key={field}>{label}: <Ltr>{String(line[field])}</Ltr></Sub>)}
                </>
              ),
            },
            {
              key: 'currency', header: 'بالعملة', numeric: true, render: (line: any) => (
                line.currency && line.currency !== 'USD'
                  ? <><Money value={line.amountCurrency} currency={line.currency} tone="plain" />{line.rate ? <Sub>بسعر <Ltr>{line.rate}</Ltr></Sub> : null}</>
                  : null
              ),
            },
            { key: 'debit', header: 'مدين', numeric: true, render: (line: any) => <Money value={line.debit} tone="debit" hideZero /> },
            { key: 'credit', header: 'دائن', numeric: true, render: (line: any) => <Money value={line.credit} tone="credit" hideZero /> },
          ]}
          footer={{ account: 'الإجمالي', debit: <Money value={totalDebit} strong />, credit: <Money value={totalCredit} strong /> }}
        />
      </Panel>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إلغاء القيد {entry.number}</DialogTitle>
        <DialogContent>
          <p className="acc-muted">سيُرحَّل قيد بنفس السطور بجهات معكوسة فيلغي أثره، ويبقى القيدان في الدفاتر. لا يمكن التراجع عن ذلك.</p>
          <TextField label="سبب الإلغاء" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>تراجع</Button>
          <Button color="error" variant="contained" onClick={cancel} disabled={!reason.trim() || isCancelling}>تأكيد الإلغاء</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EntryDetail;
