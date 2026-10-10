import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, RemotePicker, orderLabel, today, useVendors } from './shared';
import { AlipaySendPanel } from './AlipaySend';
import { Amount, Badge, DataTable, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
import { ListFilters, ListFilterValue, queryOf } from './ListFilters';

const ALIPAY_FILTERS: ListFilterValue = { from: '', to: '', broker: '' };

// The Alipay section (spec 19.5): yuan bought from brokers, yuan waiting to arrive, the Alipay
// accounts at their average rate, and the profit of the orders marked as Alipay transfers.
const rateText = (rate: number | null) => (rate ? <Ltr>{rate.toFixed(4)}</Ltr> : '—');
const cny = (minor: number) => <Amount value={minor / 100} currency="CNY" />;

const Alipay = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [accountId, setAccountId] = useState(() => new URLSearchParams(window.location.search).get('accountId') || '');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const [buying, setBuying] = useState(false);
  const [arriving, setArriving] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendOrder, setSendOrder] = useState<any>(null);
  // The period (purchases, transfers and months in it) and a broker for the purchases list
  const [filters, setFilters] = useState<ListFilterValue>(ALIPAY_FILTERS);
  const load = async (current: ListFilterValue = filters, selected = accountId) => {
    const version = ++request.current;
    setLoading(true);
    setError('');
    try {
      const period = queryOf({ from: current.from, to: current.to });
      const initial = !selected ? await acc.get('alipay', period) : null;
      if (!selected) selected = initial?.data.accounts[0]?._id || '';
      const [response, movements] = selected ? await Promise.all([
        acc.get('alipay', { ...period, accountId: selected }),
        acc.get(`reports/account-ledger/${selected}`, period),
      ]) : [initial!, null];
      if (version !== request.current) return;
      setAccountId(selected);
      setData(response.data);
      setLedger(movements?.data || null);
    } catch (err) {
      if (version !== request.current) return;
      setData(null);
      setLedger(null);
      setError(errorText(err));
    } finally {
      if (version === request.current) setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { request.current += 1; }; }, []);
  const selectedAccount = data?.accounts.find((a: any) => a._id === accountId);
  const selectAccount = (id: string) => {
    setAccountId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('accountId', id);
    window.history.replaceState(window.history.state, '', url);
    const nextFilters = { ...filters, broker: '' };
    setFilters(nextFilters);
    load(nextFilters, id);
  };

  const totals = useMemo(() => (data?.months || []).find((m: any) => m.month === today().slice(0, 7)), [data]);
  // Per order the revenue and its cost meet; a month can hold the cost of an order whose revenue
  // was recognised the month before (yuan sent after the customer paid)
  const overall = useMemo(() => (data?.transfers || []).reduce((sum: any, t: any) => ({ revenue: sum.revenue + t.revenue, cost: sum.cost + t.cost, profit: sum.profit + t.profit }), { revenue: 0, cost: 0, profit: 0 }), [data]);
  return (
    <>
      <PageHeader
        title="Alipay"
        subtitle="متابعة مستقلة لكل حساب: الرصيد والحركات وشراء اليوان والحوالات والاستردادات، مع اختيار الحساب تلقائيًا عند إنشاء العمليات."
        actions={<div className="d-flex gap-2"><Button href={`/accounting/bank${accountId ? `?accountId=${accountId}` : ''}`} variant="outlined">استيراد ومطابقة كشف Alipay</Button><Button variant="outlined" disabled={loading || !accountId} onClick={() => setSending(true)}>إرسال حوالة</Button><Button variant="contained" disabled={loading || !accountId} startIcon={<Plus size={16} />} onClick={() => setBuying(true)}>شراء يوان</Button></div>}
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {data?.accounts.length > 0 && <Panel title="حسابات Alipay" subtitle="اختر حسابًا لعرض رصيده ومشترياته وحركاته بشكل مستقل.">
        <Tabs sx={{ '& .MuiTab-root': { minWidth: 180, textTransform: 'none', alignItems: 'flex-start', borderRadius: 2 }, '& .Mui-selected': { backgroundColor: 'action.selected' } }} value={accountId} onChange={(_, id) => selectAccount(id)} variant="scrollable" scrollButtons="auto" aria-label="حسابات Alipay">
          {data.accounts.map((a: any) => <Tab key={a._id} value={a._id} label={<span>{a.name}<Sub><Ltr>{a.code}</Ltr> · {cny(a.cny)}</Sub></span>} />)}
        </Tabs>
      </Panel>}
      {data && !data.accounts.length && <Alert severity="info" className="mb-3">لا توجد حسابات Alipay. أضف حسابًا نقديًا بعملة CNY من شجرة الحسابات.</Alert>}
      {loading && <Alert severity="info" className="mb-3">جارٍ تحميل بيانات الحساب…</Alert>}
      <ListFilters value={filters} onChange={setFilters} onApply={(value) => load(value)} blank={ALIPAY_FILTERS} searchLabel={null}>
        <TextField size="small" select label="الوسيط" value={filters.broker} onChange={(e) => setFilters({ ...filters, broker: e.target.value })} style={{ minWidth: 170 }}>
          <MenuItem value="">كل الوسطاء</MenuItem>
          {(data?.brokers || []).map((b: any) => <MenuItem key={String(b.vendorId)} value={String(b.vendorId)}>{b.name}</MenuItem>)}
        </TextField>
      </ListFilters>
      {data && !loading && (
        <>
          <StatGrid>
            {selectedAccount && <Stat label={`الرصيد الحالي · ${selectedAccount.name}`} value={cny(selectedAccount.cny)} hint={<>قيمته <Money value={selectedAccount.usd} /> · متوسط السعر {rateText(selectedAccount.rate)}</>} tone="accent" />}
            <Stat label="رصيد بداية الفترة" value={cny(ledger?.opening.foreign || 0)} hint="حسب الفترة المحددة" />
            <Stat label={ledger?.truncated ? 'الرصيد بعد الحركات المعروضة' : 'رصيد نهاية الفترة'} value={cny(ledger?.closing.foreign || 0)} hint={ledger?.truncated ? 'ضيّق الفترة لعرض الرصيد الختامي الكامل' : 'حسب الحركات المسجلة في الدفاتر'} />
            <Stat label="بانتظار الوصول لهذا الحساب" value={data.pending.length} />
          </StatGrid>
          {ledger && <Panel flush title={`حركات الحساب · ${selectedAccount?.name || ''}`} subtitle="الإيداعات والمشتريات والحوالات والاستردادات والتحويلات الخاصة بهذا الحساب. اضغط رقم القيد لعرض تفاصيله.">
            {ledger.truncated && <Alert severity="warning">تُعرض أول 5000 حركة؛ ضيّق الفترة لعرض بقية الحركات.</Alert>}
            <DataTable dense maxHeight={420} rows={ledger.movements} rowKey={(row: any, index: number) => `${row._id}-${index}`}
              empty={{ title: 'لا توجد حركات لهذا الحساب في الفترة' }} columns={[
                { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
                { key: 'description', header: 'البيان / القيد', render: (row: any) => <>{row.line.label || row.description}<Sub><Open to={`/accounting/entries/${row._id}`}><Ltr>{row.number}</Ltr></Open></Sub></> },
                { key: 'in', header: 'وارد (CNY)', numeric: true, render: (row: any) => row.line.amountCurrency > 0 ? cny(row.line.amountCurrency) : '—' },
                { key: 'out', header: 'صادر (CNY)', numeric: true, render: (row: any) => row.line.amountCurrency < 0 ? cny(-row.line.amountCurrency) : '—' },
                { key: 'rate', header: 'سعر الصرف', numeric: true, render: (row: any) => rateText(row.line.rate) },
                { key: 'balance', header: 'الرصيد (CNY)', numeric: true, render: (row: any) => cny(row.balanceForeign) },
              ]} />
          </Panel>}


          {data.pending.length > 0 && (
            <Panel flush title={`بانتظار الوصول (${data.pending.length})`} subtitle={`دُفع للوسيط ولم يصل اليوان بعد. ما تأخر أكثر من ${data.pendingDays} أيام يظهر في الاستثناءات.`}>
              <DataTable
                dense rows={data.pending} rowKey={(row: any) => row._id}
                columns={[
                  { key: 'day', header: 'التاريخ', render: (row: any) => <><Ltr>{row.day}</Ltr>{row.late && <Badge tone="warn">متأخر</Badge>}</> },
                  { key: 'broker', header: 'الوسيط', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr></Sub></> },
                  { key: 'usd', header: 'المدفوع', numeric: true, render: (row: any) => <Money value={row.usd} /> },
                  { key: 'cny', header: 'المتوقع', numeric: true, render: (row: any) => row.cnyExpected ? <Amount value={row.cnyExpected} currency="CNY" /> : <Sub>أدخل الكمية عند الوصول</Sub> },
                  { key: 'actions', header: '', align: 'end', render: (row: any) => <Button size="small" variant="outlined" onClick={() => setArriving(row)}>وصل</Button> },
                ]}
              />
            </Panel>
          )}

          <Panel flush title="عمليات شراء اليوان" subtitle="السعر = اليوان ÷ الدولار المدفوع.">
            <DataTable
              dense maxHeight={420} rows={data.purchases.filter((p: any) => !filters.broker || String(p.vendorId?._id || p.vendorId) === filters.broker)} rowKey={(row: any) => row._id}
              empty={{ title: 'لا عمليات بعد' }}
              columns={[
                { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
                { key: 'broker', header: 'الوسيط', render: (row: any) => <>{row.broker}<Sub><Ltr>{row.number}</Ltr> · {row.toAccountId?.name}</Sub></> },
                { key: 'from', header: 'من', hideOnMobile: true, render: (row: any) => <>{row.fromAccountId?.name}<Sub><Amount value={row.amount} currency={row.currency} /></Sub>{row.fundedFromPaymentId && <Sub>جزء من الدفعة المجمعة <Ltr>{row.fundedFromPaymentId.number}</Ltr> · دون دفع إضافي</Sub>}</> },
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
            <Panel flush title="مشتريات الحساب حسب الشهر">
              <DataTable
                dense rows={data.months.filter((m: any) => m.boughtUsd || m.boughtCny)} rowKey={(row: any) => row.month}
                columns={[
                  { key: 'month', header: 'الشهر', render: (row: any) => <Ltr>{row.month}</Ltr> },
                  { key: 'bought', header: 'شراء يوان', numeric: true, render: (row: any) => <Money value={row.boughtUsd} tone="plain" /> },
                  { key: 'cny', header: 'اليوان', numeric: true, render: (row: any) => <Amount value={row.boughtCny} currency="CNY" /> },
                ]}
              />
            </Panel>
          </div>

          <details className="mb-3">
            <summary style={{ cursor: 'pointer', padding: 16 }}>ملخص أرباح الحوالات العام · جميع الحسابات</summary>
            <Alert severity="info" className="mb-3">هذا الملخص على مستوى الطلبية ويشمل جميع الحسابات. ربح الطلبية لا يُوزّع بين الحسابات عند الدفع من أكثر من حساب.</Alert>
            <StatGrid>
              <Stat label="أرباح الحوالات في الفترة · جميع الحسابات" value={<Money value={overall.profit} />} hint={<>إيراد <Money value={overall.revenue} /> · تكلفة <Money value={overall.cost} /></>} />
              <Stat label="أرباح هذا الشهر · جميع الحسابات" value={<Money value={totals?.profit || 0} />} />
            </StatGrid>
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
          </details>
        </>
      )}
      <Dialog open={sending} onClose={() => { setSending(false); setSendOrder(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>إرسال حوالة لطلب</DialogTitle>
        <DialogContent>
          <RemotePicker endpoint="lookup/orders" label="رقم الطلب (معلَّم حوالة Alipay)" value={sendOrder} getLabel={orderLabel} onChange={setSendOrder} />
          {sendOrder && <div className="mt-3"><AlipaySendPanel key={sendOrder._id} orderId={sendOrder._id} defaultAccountId={accountId} from="accounting" onSent={() => load()} /></div>}
          {sendOrder && <p className="acc-muted mt-2">إن لم يظهر نموذج الدفع فالطلب غير معلَّم «حوالة Alipay».</p>}
        </DialogContent>
        <DialogActions><Button onClick={() => { setSending(false); setSendOrder(null); }}>إغلاق</Button></DialogActions>
      </Dialog>
      {buying && <BuyDialog defaultAccountId={accountId} onClose={() => setBuying(false)} onDone={() => { setBuying(false); load(); }} />}
      {arriving && <ArrivalDialog purchase={arriving} onClose={() => setArriving(null)} onDone={() => { setArriving(null); load(); }} />}
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={() => load()} model="AccountingYuanPurchase" id={cancel._id} title={`شراء اليوان ${cancel.number}`} />}
    </>
  );
};

const BuyDialog = ({ defaultAccountId, onClose, onDone }: { defaultAccountId: string; onClose: () => void; onDone: () => void }) => {
  const { accounts } = useAccountingData();
  const { vendors } = useVendors();
  const payAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && a.isCash && a.currency !== 'CNY'), [accounts]);
  const alipays = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && a.isCash && a.currency === 'CNY'), [accounts]);
  const [form, setForm] = useState<any>({ vendor: null, day: today(), fromAccountId: '', amount: '', toAccountId: defaultAccountId, cny: '', arrived: true, rate: '', transactionReference: '' });
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
        transactionReference: form.transactionReference,
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
        {form.arrived && <TextField fullWidth label="رقم عملية وصول اليوان في Alipay (اختياري)" value={form.transactionReference} onChange={e => setForm({ ...form, transactionReference: e.target.value })} helperText="رقم العملية الكامل يربط وصول اليوان بالكشف دون إيداع ثانٍ" />}
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
  const [form, setForm] = useState({ cny: String(purchase.cnyExpected || ''), day: today(), transactionReference: '' });
  const [error, setError] = useState('');
  const save = async () => {
    try {
      setError('');
      await acc.post(`yuan-purchases/${purchase._id}/complete`, { cnyReceived: Number(form.cny), day: form.day, transactionReference: form.transactionReference });
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
          <TextField label="رقم عملية Alipay (اختياري)" value={form.transactionReference} onChange={e => setForm({ ...form, transactionReference: e.target.value })} helperText="انسخ الرقم كاملًا للمطابقة مع الكشف" />
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
