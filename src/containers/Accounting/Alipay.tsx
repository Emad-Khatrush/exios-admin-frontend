import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, RemotePicker, orderLabel, today, useVendors } from './shared';
import { AlipaySendPanel } from './AlipaySend';
import { Amount, Badge, DataTable, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

// The Alipay section (spec 19.5): yuan bought from brokers, yuan waiting to arrive, the Alipay
// accounts at their average rate, and the profit of the orders marked as Alipay transfers.
const rateText = (rate: number | null) => (rate ? <Ltr>{rate.toFixed(4)}</Ltr> : '—');
const cny = (minor: number) => <Amount value={minor / 100} currency="CNY" />;

const Alipay = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(false);
  const [arriving, setArriving] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendOrder, setSendOrder] = useState<any>(null);
  const load = () => acc.get('alipay').then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => (data?.months || []).find((m: any) => m.month === today().slice(0, 7)), [data]);
  return (
    <>
      <PageHeader
        title="Alipay"
        subtitle="شراء اليوان من الوسطاء وأرصدة حسابات Alipay بمتوسط سعرها، والحوالات لعملاء الصين بربح كل منها. الحوالة نفسها فاتورة شراء معلَّمة «حوالة Alipay» تُسجَّل من المنظومة."
        actions={<div className="d-flex gap-2"><Button variant="outlined" onClick={() => setSending(true)}>إرسال حوالة</Button><Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setBuying(true)}>شراء يوان</Button></div>}
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {data && (
        <>
          <StatGrid>
            {data.accounts.map((a: any) => (
              <Stat key={a._id} label={a.name} value={cny(a.cny)} hint={<>قيمته <Money value={a.usd} /> · متوسط السعر {rateText(a.rate)}</>} />
            ))}
            <Stat label="أرباح الحوالات هذا الشهر" value={<Money value={totals?.profit || 0} />} hint={<>إيراد <Money value={totals?.revenue || 0} /> · تكلفة <Money value={totals?.cost || 0} /></>} tone="accent" />
          </StatGrid>

          {data.pending.length > 0 && (
            <Panel flush title={`بانتظار الوصول (${data.pending.length})`} subtitle={`دُفع للوسيط ولم يصل اليوان بعد. ما تأخر أكثر من ${data.pendingDays} أيام يظهر في الاستثناءات.`}>
              <DataTable
                dense rows={data.pending} rowKey={(row: any) => row._id}
                columns={[
                  { key: 'day', header: 'التاريخ', render: (row: any) => <><Ltr>{row.day}</Ltr>{row.late && <Badge tone="warn">متأخر</Badge>}</> },
                  { key: 'broker', header: 'الوسيط', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr></Sub></> },
                  { key: 'usd', header: 'المدفوع', numeric: true, render: (row: any) => <Money value={row.usd} /> },
                  { key: 'cny', header: 'المتوقع', numeric: true, render: (row: any) => <Amount value={row.cnyExpected} currency="CNY" /> },
                  { key: 'actions', header: '', align: 'end', render: (row: any) => <Button size="small" variant="outlined" onClick={() => setArriving(row)}>وصل</Button> },
                ]}
              />
            </Panel>
          )}

          <Panel flush title="عمليات شراء اليوان" subtitle="السعر = اليوان ÷ الدولار المدفوع.">
            <DataTable
              dense maxHeight={420} rows={data.purchases} rowKey={(row: any) => row._id}
              empty={{ title: 'لا عمليات بعد' }}
              columns={[
                { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
                { key: 'broker', header: 'الوسيط', render: (row: any) => <>{row.broker}<Sub><Ltr>{row.number}</Ltr> · {row.toAccountId?.name}</Sub></> },
                { key: 'from', header: 'من', hideOnMobile: true, render: (row: any) => <>{row.fromAccountId?.name}<Sub><Amount value={row.amount} currency={row.currency} /></Sub></> },
                { key: 'usd', header: 'بالدولار', numeric: true, render: (row: any) => <Money value={row.usd} /> },
                { key: 'cny', header: 'اليوان', numeric: true, render: (row: any) => (row.arrived ? <Amount value={row.cnyReceived} currency="CNY" /> : <Badge tone="warn">بانتظار الوصول</Badge>) },
                { key: 'rate', header: 'السعر', numeric: true, render: (row: any) => rateText(row.rate) },
                { key: 'actions', header: '', align: 'end', render: (row: any) => <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> },
              ]}
            />
          </Panel>

          <div className="acc-grid-2">
            <Panel flush title="متوسط سعر كل وسيط">
              <DataTable
                dense rows={data.brokers} rowKey={(row: any) => String(row.vendorId)}
                empty={{ title: 'لا عمليات واصلة' }}
                columns={[
                  { key: 'name', header: 'الوسيط', render: (row: any) => <>{row.name}<Sub>{row.count} عملية</Sub></> },
                  { key: 'usd', header: 'الدولار', numeric: true, render: (row: any) => <Money value={row.usd} /> },
                  { key: 'cny', header: 'اليوان', numeric: true, render: (row: any) => <Amount value={row.cny} currency="CNY" /> },
                  { key: 'rate', header: 'المتوسط', numeric: true, render: (row: any) => rateText(row.rate) },
                ]}
              />
            </Panel>
            <Panel flush title="الأشهر">
              <DataTable
                dense rows={data.months} rowKey={(row: any) => row.month}
                columns={[
                  { key: 'month', header: 'الشهر', render: (row: any) => <Ltr>{row.month}</Ltr> },
                  { key: 'bought', header: 'شراء يوان', numeric: true, render: (row: any) => <Money value={row.boughtUsd} tone="plain" /> },
                  { key: 'revenue', header: 'إيراد الحوالات', numeric: true, render: (row: any) => <Money value={row.revenue} /> },
                  { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => <Money value={row.profit} strong /> },
                ]}
              />
            </Panel>
          </div>

          <Panel flush title="الحوالات (الطلبات المعلَّمة حوالة Alipay)" subtitle="الإيراد والتكلفة بعد الاعتراف (عند السداد الكامل).">
            <DataTable
              dense maxHeight={420} rows={data.transfers} rowKey={(row: any) => String(row.orderId)}
              empty={{ title: 'لا حوالات معترف بها بعد' }}
              columns={[
                { key: 'order', header: 'الطلب', render: (row: any) => (row.orderNumber
                  ? <><Open to={`/accounting/customer-invoices/${row.orderId}`}><Ltr>{row.orderNumber}</Ltr></Open><Sub>{row.customer}</Sub></>
                  : <><span className="acc-muted">تكلفة بلا طلب</span><Sub>من فاتورة مورد أو قيد على حساب تكلفة الحوالات</Sub></>) },
                { key: 'revenue', header: 'الإيراد', numeric: true, render: (row: any) => <Money value={row.revenue} /> },
                { key: 'cost', header: 'التكلفة', numeric: true, render: (row: any) => <Money value={row.cost} tone="plain" /> },
                { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => <Money value={row.profit} strong /> },
              ]}
            />
          </Panel>
          <Panel flush title="الحوالات لكل عميل">
            <DataTable
              dense maxHeight={360} rows={data.customers} rowKey={(row: any) => String(row.userId || row.customer)}
              empty={{ title: 'لا حوالات' }}
              columns={[
                { key: 'customer', header: 'العميل', render: (row: any) => <>{row.userId ? <Open to={`/accounting/customers/${row.userId}`}>{row.customer || 'العميل'}</Open> : row.customer}<Sub>{row.count} حوالة</Sub></> },
                { key: 'revenue', header: 'الإيراد', numeric: true, render: (row: any) => <Money value={row.revenue} /> },
                { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => <Money value={row.profit} strong /> },
              ]}
            />
          </Panel>
        </>
      )}
      <Dialog open={sending} onClose={() => { setSending(false); setSendOrder(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>إرسال حوالة لطلب</DialogTitle>
        <DialogContent>
          <RemotePicker endpoint="lookup/orders" label="رقم الطلب (معلَّم حوالة Alipay)" value={sendOrder} getLabel={orderLabel} onChange={setSendOrder} />
          {sendOrder && <div className="mt-3"><AlipaySendPanel key={sendOrder._id} orderId={sendOrder._id} from="accounting" onSent={load} /></div>}
          {sendOrder && <p className="acc-muted mt-2">إن لم يظهر نموذج الدفع فالطلب غير معلَّم «حوالة Alipay».</p>}
        </DialogContent>
        <DialogActions><Button onClick={() => { setSending(false); setSendOrder(null); }}>إغلاق</Button></DialogActions>
      </Dialog>
      {buying && <BuyDialog onClose={() => setBuying(false)} onDone={() => { setBuying(false); load(); }} />}
      {arriving && <ArrivalDialog purchase={arriving} onClose={() => setArriving(null)} onDone={() => { setArriving(null); load(); }} />}
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingYuanPurchase" id={cancel._id} title={`شراء اليوان ${cancel.number}`} />}
    </>
  );
};

const BuyDialog = ({ onClose, onDone }: { onClose: () => void; onDone: () => void }) => {
  const { accounts } = useAccountingData();
  const { vendors } = useVendors();
  const payAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && a.isCash && a.currency !== 'CNY'), [accounts]);
  const alipays = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && a.isCash && a.currency === 'CNY'), [accounts]);
  const [form, setForm] = useState<any>({ vendor: null, day: today(), fromAccountId: '', amount: '', toAccountId: '', cny: '', arrived: true, rate: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(newKey());
  const from = payAccounts.find((a) => a._id === form.fromAccountId);
  const usdGuess = from?.currency === 'USD' ? Number(form.amount) : null;
  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await acc.post('yuan-purchases', {
        vendorId: form.vendor?._id, day: form.day, fromAccountId: form.fromAccountId, amount: Number(form.amount), rate: Number(form.rate) || undefined,
        toAccountId: form.toAccountId, arrived: form.arrived, [form.arrived ? 'cnyReceived' : 'cnyExpected']: Number(form.cny), idempotencyKey: idempotencyKey.current,
      });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>شراء يوان من وسيط</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}
        <div className="acc-form-grid">
          <Autocomplete size="small" options={vendors} value={form.vendor} getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onChange={(_, vendor: any) => setForm({ ...form, vendor })} renderInput={(p) => <TextField {...p} label="الوسيط - شركة الحوالة" />} />
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          <TextField select label="دُفع من" value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}>
            {payAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
          </TextField>
          <TextField type="number" label={`المدفوع (${from?.currency || 'USD'})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          {from?.currency && from.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = متوسط الحساب)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />}
          <TextField select label="إلى حساب Alipay" value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
            {alipays.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
          </TextField>
          <TextField type="number" label={form.arrived ? 'اليوان المستلم' : 'اليوان المتوقع'} value={form.cny} onChange={(e) => setForm({ ...form, cny: e.target.value })}
            helperText={usdGuess && Number(form.cny) > 0 ? <>السعر <Ltr>{(Number(form.cny) / usdGuess).toFixed(4)}</Ltr></> : undefined} />
        </div>
        <FormControlLabel className="mt-2" control={<Checkbox checked={form.arrived} onChange={(e) => setForm({ ...form, arrived: e.target.checked })} />} label="وصل اليوان" />
        {!form.arrived && <p className="acc-muted">تُحفظ «مدفوعة، بانتظار الوصول»؛ أكّد الوصول بالكمية الفعلية عندما يصل.</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !form.vendor || !form.fromAccountId || !form.toAccountId || !(Number(form.amount) > 0) || !(Number(form.cny) > 0)} onClick={save}>ترحيل</Button>
      </DialogActions>
    </Dialog>
  );
};

const ArrivalDialog = ({ purchase, onClose, onDone }: { purchase: any; onClose: () => void; onDone: () => void }) => {
  const [form, setForm] = useState({ cny: String(purchase.cnyExpected || ''), day: today() });
  const [error, setError] = useState('');
  const save = async () => {
    try {
      setError('');
      await acc.post(`yuan-purchases/${purchase._id}/complete`, { cnyReceived: Number(form.cny), day: form.day });
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>وصول اليوان {purchase.number}</DialogTitle>
      <DialogContent>
        <p className="acc-muted">المدفوع <Money value={purchase.usd} />. الكمية الفعلية تغيّر السعر فقط، لا الدولار.</p>
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        <div className="acc-form-grid">
          <TextField type="number" label="اليوان الواصل" value={form.cny} onChange={(e) => setForm({ ...form, cny: e.target.value })} />
          <TextField type="date" label="تاريخ الوصول" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={!(Number(form.cny) > 0)} onClick={save}>تأكيد الوصول</Button>
      </DialogActions>
    </Dialog>
  );
};

export default Alipay;
