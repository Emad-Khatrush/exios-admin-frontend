import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { EVENT_LABELS, acc, errorText, newKey, sys, todayLibya } from './accountingApi';
import { CancelDialog, amountLabel, userLabel, SHIPPING_TYPES } from './shared';
import { AccountingTheme } from './ui/AccountingTheme';
import { useAccountingAccess } from './useAccountingAccess';
import { AlipaySendPanel } from './AlipaySend';
import OrderCostBreakdown from './OrderCostBreakdown';
import AccountingFold from './AccountingFold';
import { Badge, DataTable, Ltr, Money, Open, Panel, Stat, StatGrid, StatusBadge, Sub } from './ui';
// @ts-ignore
import './Accounting.scss';

// The accounting view of an order, a trip or a customer, shown inside their own pages (spec 7).
// What shows depends on the accounting permissions the owner gave (the figures need "reports",
// recording a supplier bill needs "purchases"); everything opens in a new tab so the page being
// worked on stays as it is.

function useSummary(path: string | null) {
  const access = useAccountingAccess();
  const canSee = access.can('reports');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  // A reload keeps what is on screen until the fresh figures arrive
  const reload = useCallback(() => {
    if (!canSee || !path) return;
    setError('');
    acc.get(path).then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  }, [canSee, path]);
  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);
  return { access, canSee, data, error, reload };
}

const Frame = ({ title, error, loading, actions, children }: { title: string; error: string; loading: boolean; actions?: ReactNode; children: ReactNode }) => (
  <AccountingTheme>
    <div className="acc-embed">
      <div className="acc-embed__head">
        <h3>{title}</h3>
        {actions && <div className="d-flex gap-3 flex-wrap">{actions}</div>}
      </div>
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {loading && !error ? <div className="acc-empty">جارٍ التحميل…</div> : children}
    </div>
  </AccountingTheme>
);

const NoAccess = () => (
  <AccountingTheme>
    <div className="acc-embed"><div className="acc-empty">عرض المحاسبة هنا يحتاج صلاحية «التقارير والأرباح». اطلبها من المالك.</div></div>
  </AccountingTheme>
);

const NoEntries = () => (
  <Alert severity="info" className="mb-3">لا قيود محاسبية بعد. عمليات المنظومة تدخل الدفاتر بعد اعتماد الترحيل التاريخي.</Alert>
);

const EntriesTable = ({ entries }: { entries: any[] }) => (
  <Panel flush title={`القيود (${entries.length})`}>
    <DataTable
      dense maxHeight={320} rows={entries} rowKey={(row: any) => row._id}
      rowTone={(row: any) => (row.status === 'reversed' ? 'canceled' : undefined)}
      empty={{ title: 'لا قيود' }}
      columns={[
        { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
        { key: 'entry', header: 'القيد', render: (row: any) => <><Open to={`/accounting/entries/${row._id}`}><Ltr>{row.number}</Ltr></Open><Sub>{EVENT_LABELS[row.eventType] || row.eventType} · {row.description}</Sub></> },
        { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Money value={row.totalDebit} /> },
      ]}
    />
  </Panel>
);

const BillsTable = ({ bills, empty }: { bills: any[]; empty: string }) => (
  <Panel flush title={`فواتير الموردين (${bills.length})`}>
    <DataTable
      dense rows={bills} rowKey={(row: any) => row.billId}
      rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
      empty={{ title: empty }}
      columns={[
        { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
        {
          key: 'bill', header: 'الفاتورة', render: (row: any) => (
            <>
              <Open to={`/accounting/bills/${row.billId}`}><Ltr>{row.number}</Ltr></Open> {row.isCreditNote && <Badge tone="info">إشعار دائن</Badge>}
              <Sub>{row.vendor} · {row.description}</Sub>
              {/* How it was paid: in what currency, at what rate, and what that changed on the cost */}
              {(row.payments || []).map((p: any) => (
                <Sub key={p.paymentId}>
                  دُفعت <Ltr>{p.number}</Ltr> · <Ltr>{p.day}</Ltr> · {p.fromAdvance ? 'من الدفعة المقدمة' : <><span className="money">{p.amount} {p.currency}</span>{p.rate ? <> بسعر <Ltr>{p.rate}</Ltr></> : null}{p.account ? ` من ${p.account}` : ''}</>}
                  {p.difference ? <> · فرق المدفوع على التكلفة <Money value={p.difference} /></> : null}
                </Sub>
              ))}
            </>
          ),
        },
        { key: 'amount', header: 'بعملتها', numeric: true, hideOnMobile: true, render: (row: any) => (row.currency !== 'USD' ? <span className="money">{row.amount} {row.currency}</span> : null) },
        {
          key: 'usd', header: 'بالدولار', numeric: true, render: (row: any) => (row.difference
            ? <><Money value={row.cost} strong /><Sub>الفاتورة <Money value={row.usd} /> + فرق الدفع <Money value={row.difference} /></Sub></>
            : <Money value={row.usd} strong />),
        },
        { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
      ]}
    />
  </Panel>
);

const CLAIM_KIND: Record<string, string> = { SHP: 'شحن', DOM: 'نقل داخلي', PUR: 'فاتورة شراء', GEN: 'دين عام' };

const blankBill = () => ({ vendor: null as any, description: '', amount: '', payFrom: '', currency: 'USD', rate: '', day: todayLibya() });

// What was bought from a supplier for this order, entered right here: one line, optionally paid
// on the spot from a cash box, bank or Alipay. It is an ordinary supplier bill charged to the
// order, recorded through the system's own route, so any staff member can enter it (spec 19.1).
// Paid from a non-dollar account with no rate typed, it costs what that money cost (the account's
// average rate): yuan sent from Alipay for an Alipay transfer, say.
const QuickOrderBill = ({ orderId, orderNumber, onSaved }: { orderId: string, orderNumber: string, onSaved: () => void }) => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [form, setForm] = useState(blankBill());
  const [vendorText, setVendorText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const key = useRef(newKey());

  const loadOptions = () => sys.get('acc/options').then((res: any) => {
    setVendors(res.data.vendors || []);
    setAccounts(res.data.accounts || []);
    setCurrencies(res.data.currencies || []);
  }).catch(() => {});
  useEffect(() => {
    loadOptions();
  }, []);

  const payAccount = accounts.find((a) => a._id === form.payFrom);
  // Paid on the spot: the bill is in the currency of the box that paid it
  const currency = payAccount ? (payAccount.currency || 'USD') : form.currency;
  const typedNewVendor = !form.vendor && vendorText.trim().length > 1;
  const canSave = (form.vendor || typedNewVendor) && Number(form.amount) > 0 && !isSaving;

  const save = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      // A name that is not in the list becomes a new supplier
      const res = await sys.post(`acc/orders/${orderId}/costs`, {
        vendorId: form.vendor?._id, vendorName: form.vendor ? undefined : vendorText.trim(),
        day: form.day, currency, rate: Number(form.rate) || undefined, idempotencyKey: key.current,
        payFromAccountId: form.payFrom || undefined,
        description: form.description.trim() || `مشتريات الطلب ${orderNumber}`, amount: Number(form.amount),
      });
      key.current = newKey();
      setMessage({ type: 'success', text: `سُجّلت الفاتورة ${res.data?.number || ''} على الطلب${form.payFrom ? ' ودُفعت' : ' (آجلة، تُدفع من دفعات الموردين)'}.` });
      setForm({ ...blankBill(), vendor: form.vendor || null, payFrom: form.payFrom, currency: form.currency });
      setVendorText(form.vendor?.name || '');
      if (!form.vendor) loadOptions();
      onSaved();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsSaving(false);
  };

  return (
    <Panel title="إضافة مشتريات لهذا الطلب" subtitle="ما دفعته للمورد عن هذا الطلب. يدخل تكلفةً على الطلب ويُحسب في ربحه عند سداد العميل.">
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <div className="acc-form-grid">
        <Autocomplete
          size="small" freeSolo options={vendors} value={form.vendor} inputValue={vendorText}
          getOptionLabel={(option: any) => (typeof option === 'string' ? option : option?.name || '')}
          isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
          onInputChange={(_, text) => setVendorText(text)}
          onChange={(_, vendor: any) => setForm({ ...form, vendor: vendor && typeof vendor !== 'string' ? vendor : null })}
          renderInput={(params) => <TextField {...params} label="المورد" helperText={typedNewVendor ? 'سيُضاف مورداً جديداً' : 'اختر أو اكتب اسم مورد جديد'} />}
        />
        <TextField label="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثلاً: شراء من علي بابا" />
        <TextField type="number" label={`المبلغ (${currency})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputProps={{ min: 0, step: 'any' }} />
        <TextField select label="دُفعت من" value={form.payFrom} onChange={(e) => setForm({ ...form, payFrom: e.target.value })}>
          <MenuItem value="">لم تُدفع بعد (آجلة)</MenuItem>
          {accounts.map((a) => <MenuItem key={a._id} value={a._id}>{a.name} ({a.currency})</MenuItem>)}
        </TextField>
        {!payAccount && (
          <TextField select label="عملة الفاتورة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {(currencies.length ? currencies : [{ code: 'USD', name: 'دولار' }]).map((c) => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}
          </TextField>
        )}
        {currency !== 'USD' && <TextField type="number" label={payAccount ? 'السعر (فارغ = متوسط سعر الحساب الدافع)' : 'السعر (فارغ = سعر ذلك اليوم)'} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} inputProps={{ min: 0, step: 'any' }} />}
        <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
      </div>
      <div className="d-flex justify-content-end align-items-center gap-3 mt-3 flex-wrap">
        <Open to={`/accounting/bills/new?orderId=${orderId}&orderNumber=${encodeURIComponent(orderNumber)}`}>فاتورة بعدة سطور أو مرفقات</Open>
        <Button variant="contained" disabled={!canSave} onClick={save}>{isSaving ? 'جارٍ الحفظ…' : 'تسجيل المشتريات'}</Button>
      </div>
    </Panel>
  );
};

// After an order moves from A000 to its real customer: A000's wallet lines for this shipment
// (a deposit made for it, the payment taken from it). The staff member ticks the ones that belong
// to the new customer; they change owner and are posted again on their own dates (spec 19.10).
const PreviousCustomerLines = ({ orderId, onMoved }: { orderId: string; onMoved: () => void }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    sys.get(`acc/orders/${orderId}/previous-statements`).then((res: any) => {
      setRows(res.data.results || []);
      setPicked((res.data.results || []).filter((r: any) => r.linked).map((r: any) => r._id));
    }).catch(() => setRows([]));
  }, [orderId]);
  useEffect(load, [load]);
  if (!rows.length) return null;
  const move = async () => {
    try {
      setBusy(true);
      setError('');
      await sys.post(`acc/orders/${orderId}/move-statements`, { statementIds: picked });
      load();
      onMoved();
    } catch (err: any) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel flush title="سطور محفظة العميل السابق لهذا الطلب" subtitle="الطلب كان على عميل آخر (مثل A000). اختر السطور التي تخص العميل الحالي لنقلها إلى محفظته بتواريخها.">
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      <DataTable
        dense rows={rows} rowKey={(row: any) => row._id}
        columns={[
          { key: 'pick', header: '', render: (row: any) => <input type="checkbox" checked={picked.includes(row._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, row._id] : picked.filter((id) => id !== row._id))} /> },
          { key: 'date', header: 'التاريخ', render: (row: any) => <Ltr>{String(row.date).slice(0, 10)}</Ltr> },
          { key: 'customer', header: 'العميل', render: (row: any) => (row.customer ? userLabel(row.customer) : '') },
          { key: 'description', header: 'البيان', render: (row: any) => <>{row.description}{row.note && <Sub>{row.note}</Sub>}{row.linked && <Badge tone="info">مرتبط بالطلب</Badge>}</> },
          { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Ltr>{row.calculationType === '-' ? '-' : '+'}{row.amount} {row.currency}</Ltr> },
        ]}
      />
      <div className="p-3"><Button variant="contained" disabled={busy || !picked.length} onClick={move}>نقل المحدد إلى العميل الحالي</Button></div>
    </Panel>
  );
};

// A refund from the supplier on a purchase invoice (spec 19.6): the money that came in (in its
// account's currency, with its real dollar value from the bank) and what is added to the wallet
const CustomerRefundPanel = ({ orderId, onSaved }: { orderId: string; onSaved: () => void }) => {
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [pendingBankLineId, setPendingBankLineId] = useState('');
  const [pendingBusy, setPendingBusy] = useState(false);
  const [existingRefundId, setExistingRefundId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: '', amount: '', usdValue: '', walletUsd: '', day: todayLibya(), note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // A refund entered by mistake is cancelled: the money in and the wallet credit are both undone
  const [canceling, setCanceling] = useState<any>(null);
  const idempotencyKey = useRef(newKey());
  const load = useCallback(() => {
    sys.get(`acc/orders/${orderId}/refunds`).then((res: any) => setRows(res.data.results || [])).catch(() => {});
  }, [orderId]);
  useEffect(() => {
    load();
    sys.get('acc/money-accounts').then((res: any) => setAccounts(res.data.results || [])).catch(() => {});
  }, [load]);
  const account = accounts.find((a) => a._id === form.accountId);
  useEffect(() => {
    if (!open || existingRefundId || !form.accountId || !(Number(form.amount) > 0 || Number(form.usdValue) > 0)) {
      setPendingMatches([]); setPendingBankLineId(''); setPendingBusy(false); return undefined;
    }
    let stale = false; setPendingBusy(true); setPendingMatches([]);
    const timer = window.setTimeout(() => {
      sys.get(`acc/orders/${orderId}/pending-refunds`, { accountId: form.accountId, amount: form.amount, usdValue: form.usdValue, day: form.day })
        .then((res: any) => { if (!stale) {
          const results = res.data.results || []; setPendingMatches(results);
          setPendingBankLineId(current => results.some((row: any) => row._id === current) ? current : '');
        } }).catch((err: any) => { if (!stale) { setPendingMatches([]); setPendingBankLineId(''); setError(errorText(err)); } })
        .finally(() => { if (!stale) setPendingBusy(false); });
    }, 200);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [open, existingRefundId, form.accountId, form.amount, form.usdValue, form.day, orderId]);
  // Valued at the day's rate in the books; what matters here is what goes to the wallet
  const usd = account?.currency === 'USD' ? Number(form.amount) : Number(form.walletUsd) + 1;
  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await sys.post(`acc/orders/${orderId}/refunds`, { ...form, existingRefundId: existingRefundId || undefined, pendingBankLineId: pendingBankLineId || undefined, amount: Number(form.amount), usdValue: Number(form.usdValue) || undefined, walletUsd: Number(form.walletUsd) || 0, idempotencyKey: idempotencyKey.current });
      idempotencyKey.current = newKey();
      setOpen(false);
      setExistingRefundId('');
      setForm({ accountId: '', amount: '', usdValue: '', walletUsd: '', day: todayLibya(), note: '' });
      load();
      onSaved();
    } catch (err: any) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel flush title="ريفاند من المورد" subtitle="مبلغ أعاده المورد على مشتريات هذا الطلب (بعملة الحساب الذي دخل فيه، ويُقيَّم بسعر اليوم): يُخفِّض التكلفة، وما يُضاف لمحفظة العميل يُخفِّض المبيعات. الفرق ربح."
      actions={<Button size="small" onClick={() => setOpen(true)}>ريفاند جديد</Button>}>
      {rows.length > 0 && (
        <DataTable
          dense rows={rows} rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          columns={[
            { key: 'day', header: 'التاريخ', render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'in', header: 'دخل في', render: (row: any) => <>{row.accountId?.name}<Sub><Ltr>{row.amount} {row.currency}</Ltr></Sub></> },
            { key: 'usd', header: 'قيمته', numeric: true, render: (row: any) => <Money value={row.usd} /> },
            { key: 'wallet', header: 'للمحفظة', numeric: true, render: (row: any) => <Money value={row.walletUsd} /> },
            { key: 'status', header: '', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <>{!row.walletUsd && <Button size="small" onClick={() => { setExistingRefundId(row._id); setForm({ accountId: row.accountId?._id || row.accountId, amount: String(row.amount), usdValue: String(row.usd / 100), walletUsd: '', day: todayLibya(), note: row.note || '' }); setOpen(true); }}>إضافة مبلغ العميل لنفس الريفاند</Button>}<Button size="small" color="error" onClick={() => setCanceling(row)}>إلغاء</Button></> : null) },
          ]}
        />
      )}
      {canceling && (
        <CancelDialog
          open onClose={() => setCanceling(null)} onDone={() => { load(); onSaved(); }}
          model="AccountingCustomerRefund" id={canceling._id} title={`الريفاند ${canceling.number}`}
          askConfirm={canceling.walletUsd > 0 ? 'إن صرف العميل ما أُضيف لمحفظته تصبح محفظته سالبة؛ أوافق على ذلك' : undefined}
        />
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ريفاند من المورد على هذا الطلب</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" className="mb-2">{error}</Alert>}
          <TextField select fullWidth className="mb-2" label="تسجيل استرداد جديد أو استخدام ريفاند موجود" value={existingRefundId} onChange={e => {
            const id = e.target.value; setExistingRefundId(id);
            const selected = rows.find((r: any) => r._id === id);
            if (selected) setForm({ accountId: selected.accountId?._id || selected.accountId, amount: String(selected.amount), usdValue: String(selected.usd / 100), walletUsd: '', day: todayLibya(), note: selected.note || '' });
          }}><MenuItem value="">استرداد جديد لم يُسجل في الكشف أو الطلبية</MenuItem>{rows.filter((r: any) => r.status === 'posted' && !r.walletUsd).map((r: any) => <MenuItem key={r._id} value={r._id}>{r.number} · {r.amount} {r.currency} · {r.day}</MenuItem>)}</TextField>
          {existingRefundId && <Alert severity="info" className="mb-2">استلام البنك وتخفيض تكلفة الطلبية مسجلان بالفعل. سيضاف مبلغ العميل لمحفظته فقط دون تكرار حركة البنك أو تخفيض التكلفة.</Alert>}
          {!existingRefundId && pendingMatches.length > 0 && <Alert severity="warning" className="mb-2">
            وجدنا استردادات في الكشف غير مرتبطة بطلبية، مرحّلة أو غير مرحّلة، بالمبلغ نفسه أو بنفس الجزء الصحيح مع اختلاف الكسور. راجع التفاصيل واختر الاسترداد؛ يُعتمد مبلغ الكشف وتاريخه. غير المرحّل سيُرحّل عند التأكيد، والمرحّل لن تتكرر حركة البنك فيه. مبلغ محفظة العميل يبقى كما أدخلته.
            {pendingMatches.map((row: any) => <div key={row._id} className="mt-2">
              <Ltr>{row.day} · {row.amount} {row.currency}{Number(row.usdValue) > 0 ? ` · ${row.usdValue} USD` : ''}</Ltr><Sub>{row.description}</Sub>
              <Badge tone={row.unposted ? 'warn' : 'info'}>{row.unposted ? 'غير مرحّل — سيُرحّل ويُربط عند التأكيد' : 'مرحّل — ربط دون تكرار استلام البنك'}</Badge>
              <Sub>{row.nativeMatch ? 'المبلغ بعملة الحساب مطابق بالكامل' : row.dollarMatch ? 'مقابل الدولار مطابق بالكامل' : row.nativeIntegerMatch ? 'الجزء الصحيح بعملة الحساب مطابق؛ الكسور مختلفة' : 'الجزء الصحيح بالدولار مطابق؛ الكسور مختلفة'}</Sub>
              {row.amountDifference !== null && row.amountDifference !== 0 && <Sub>فرق مبلغ الكشف عن المدخل: <Ltr>{Number(row.amountDifference).toFixed(3)} {row.currency}</Ltr></Sub>}
              {row.usdDifference !== null && row.usdDifference !== 0 && <Sub>فرق مقابل الدولار عن المدخل: <Ltr>{Number(row.usdDifference).toFixed(2)} USD</Ltr></Sub>}
              <Button size="small" variant={pendingBankLineId === row._id ? 'contained' : 'outlined'} onClick={() => {
                setPendingBankLineId(row._id); setForm({ ...form, amount: String(row.amount), usdValue: Number(row.usdValue) > 0 ? String(row.usdValue) : '', day: row.day });
              }}>{pendingBankLineId === row._id ? 'مختار — سيتم ربطه بهذه الطلبية' : 'اختيار هذا الاسترداد للربط'}</Button>
            </div>)}
          </Alert>}
          <div className="acc-form-grid">
            <TextField select disabled={!!existingRefundId} label="دخل المال في" value={form.accountId} onChange={(e) => { setPendingBankLineId(''); setForm({ ...form, accountId: e.target.value }); }}>
              {accounts.map((a: any) => <MenuItem key={a._id} value={a._id}>{a.name} ({a.currency})</MenuItem>)}
            </TextField>
            <TextField disabled={!!existingRefundId} type="number" label={`المبلغ المستلم (${account?.currency || ''})`} value={form.amount} onChange={(e) => { setPendingBankLineId(''); setForm({ ...form, amount: e.target.value }); }} />
            {account?.currency !== 'USD' && <TextField disabled={!!existingRefundId} type="number" label="القيمة الفعلية بالدولار (إن ذكرها البنك)" value={form.usdValue} onChange={e => { setPendingBankLineId(''); setForm({ ...form, usdValue: e.target.value }); }} helperText="اختياري؛ استخدم مقابل الدولار المطبوع في الكشف، وإلا يُستخدم تقييم المنظومة." />}
            <TextField type="number" label="يُضاف لمحفظة العميل ($)" value={form.walletUsd} onChange={(e) => setForm({ ...form, walletUsd: e.target.value })}
              helperText={account?.currency === 'USD' && usd > 0 ? <>مثلاً <Ltr>{Math.max(usd - 1, 0).toFixed(2)}</Ltr> (هامش حماية 1$)</> : 'ما يُضاف لمحفظة العميل بالدولار'} />
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => { setPendingBankLineId(''); setForm({ ...form, day: e.target.value }); }} />
            <TextField label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>إلغاء</Button>
          <Button variant="contained" disabled={busy || pendingBusy || (!existingRefundId && pendingMatches.length > 0 && !pendingBankLineId) || !form.accountId || !(Number(form.amount) > 0)} onClick={save}>{pendingBankLineId ? 'اعتماد الربط وإضافة مبلغ العميل' : 'تسجيل'}</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
};

// Abandoned goods (spec v8): a package not collected long after it reached Libya. An admin or the
// owner declares it abandoned (the customer is billed only what was paid; its whole cost is
// recognised), may undo that until it is sold, then records the sale.
const ABANDON_LABEL: Record<string, string> = { abandoned: 'متروك', sold: 'مُباع' };
const AbandonedPanel = ({ orderId, onChanged }: { orderId: string; onChanged: () => void }) => {
  const [data, setData] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selling, setSelling] = useState<any>(null);
  const [form, setForm] = useState({ accountId: '', amount: '', usdValue: '', day: todayLibya() });
  const [error, setError] = useState('');
  const load = useCallback(() => {
    sys.get(`acc/orders/${orderId}/packages-state`).then((res: any) => setData(res.data)).catch(() => {});
  }, [orderId]);
  useEffect(load, [load]);
  if (!data) return null;
  const rows = (data.results || []).filter((p: any) => !p.received && (p.arrivedLibya || p.abandoned));
  if (!rows.length) return null;
  const act = async (row: any, action: 'abandon' | 'restore', confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    try {
      setError('');
      await sys.post(`acc/orders/${orderId}/packages/${row._id}/${action}`);
      load();
      onChanged();
    } catch (err: any) {
      setError(errorText(err));
    }
  };
  const account = accounts.find((a) => a._id === form.accountId);
  const sell = async () => {
    try {
      setError('');
      await sys.post(`acc/orders/${orderId}/packages/${selling._id}/sell`, { ...form, amount: Number(form.amount), usdValue: Number(form.usdValue) || undefined });
      setSelling(null);
      load();
      onChanged();
    } catch (err: any) {
      setError(errorText(err));
    }
  };
  const openSale = (row: any) => {
    setSelling(row);
    if (!accounts.length) sys.get('acc/money-accounts').then((res: any) => setAccounts(res.data.results || [])).catch(() => {});
  };
  return (
    <Panel flush title="طرود لم تُستلم" subtitle={`ما مرّ على وصوله ${data.abandonAfterDays} يوماً أو أكثر يُعلَّم «متأخر». الإعلان «متروك» يُبقي على العميل ما دفعه فقط ويحمّل التكلفة كاملة؛ المحفظة لا تتأثر. التراجع ممكن قبل البيع.`}>
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      <DataTable
        dense rows={rows} rowKey={(row: any) => row._id}
        columns={[
          { key: 'tracking', header: 'الطرد', render: (row: any) => <><Ltr>{row.tracking || '-'}</Ltr> {row.abandoned?.status && <Badge tone={row.abandoned.status === 'sold' ? 'muted' : 'warn'}>{ABANDON_LABEL[row.abandoned.status]}</Badge>}{!row.abandoned && row.overdue && <Badge tone="danger">متأخر</Badge>}</> },
          { key: 'age', header: 'منذ الوصول', numeric: true, render: (row: any) => (row.age === null ? '-' : `${row.age} يوم`) },
          { key: 'sale', header: 'البيع', render: (row: any) => (row.abandoned?.sale ? <><Ltr>{row.abandoned.sale.amount} {row.abandoned.sale.currency}</Ltr><Sub><Ltr>{row.abandoned.sale.day}</Ltr></Sub></> : null) },
          ...(data.canManage ? [{
            key: 'actions', header: '', align: 'end' as const, render: (row: any) => (
              <span className="d-inline-flex gap-1">
                {!row.abandoned && <Button size="small" color="warning" onClick={() => act(row, 'abandon', 'إعلان الطرد متروكاً؟ يبقى على العميل ما دفعه فقط، وتُحمَّل تكلفته كاملة.')}>إعلان متروك</Button>}
                {row.abandoned?.status === 'abandoned' && <Button size="small" onClick={() => openSale(row)}>بيع</Button>}
                {row.abandoned?.status === 'abandoned' && <Button size="small" onClick={() => act(row, 'restore', 'التراجع عن إعلان الطرد متروكاً؟ تعود مطالبته وتكلفته كما كانت.')}>تراجع</Button>}
              </span>
            ),
          }] : []),
        ]}
      />
      <Dialog open={!!selling} onClose={() => setSelling(null)} maxWidth="xs" fullWidth>
        <DialogTitle>بيع بضاعة متروكة {selling?.tracking}</DialogTitle>
        <DialogContent>
          <div className="acc-form-grid">
            <TextField select label="دخل المال في" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              {accounts.map((a: any) => <MenuItem key={a._id} value={a._id}>{a.name} ({a.currency})</MenuItem>)}
            </TextField>
            <TextField type="number" label={amountLabel(account?.currency)} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {account && account.currency !== 'USD' && <TextField type="number" label="قيمته بالدولار (فارغ = سعر تاريخ العملية)" value={form.usdValue} onChange={(e) => setForm({ ...form, usdValue: e.target.value })} />}
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelling(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!form.accountId || !(Number(form.amount) > 0)} onClick={sell}>تسجيل البيع</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
};

// Writing off what is left on a delivered package or a purchase invoice (spec 19.7)
const WriteOffDialog = ({ claim, onClose, onDone }: { claim: any; onClose: () => void; onDone: () => void }) => {
  const [form, setForm] = useState({ amount: (claim.open / 100).toFixed(2), reason: '', day: todayLibya() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(newKey());
  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await acc.post('write-offs', { arKey: claim.arKey, amountUsd: Math.round(Number(form.amount) * 100), reason: form.reason, day: form.day, idempotencyKey: idempotencyKey.current });
      onDone();
    } catch (err: any) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>شطب المتبقي على المطالبة</DialogTitle>
      <DialogContent>
        <p className="acc-muted">المتبقي <Money value={claim.open} strong />. يبقى الإيراد بقدر ما دفعه العميل، وتُحمَّل التكلفة كاملة. إن دفع العميل لاحقاً يعود الإيراد تلقائياً بقدر ما دفع.</p>
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        <div className="acc-form-grid">
          <TextField type="number" label="المبلغ المشطوب ($)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </div>
        <TextField className="mt-3" fullWidth label="السبب" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>إلغاء</Button>
        <Button variant="contained" color="warning" disabled={busy || !form.reason.trim() || !(Number(form.amount) > 0)} onClick={save}>شطب</Button>
      </DialogActions>
    </Dialog>
  );
};

export const OrderCosts = ({ orderId, orderNumber }: { orderId: string; orderNumber?: string }) => {
  const { canSee, data, error, reload } = useSummary(`summary/order/${orderId}`);
  return <Frame title="إضافة التكاليف" error={error} loading={false}>
    <QuickOrderBill orderId={orderId} orderNumber={orderNumber || ''} onSaved={reload} />
    {canSee && data && <BillsTable bills={data.bills} empty="لا فواتير موردين مسجلة على هذه الطلبية" />}
  </Frame>;
};

export const OrderRefunds = ({ orderId }: { orderId: string }) => <Frame title="الريفاند / الاستردادات" error="" loading={false}>
  <CustomerRefundPanel orderId={orderId} onSaved={() => {}} />
</Frame>;

export const OrderAccounting = ({ orderId, orderNumber, isPayment, separateActions = false }: { orderId?: string, orderNumber?: string, isPayment?: boolean, separateActions?: boolean }) => {
  const { access, canSee, data, error, reload } = useSummary(orderId ? `summary/order/${orderId}` : null);
  const [writeOff, setWriteOff] = useState<any>(null);
  if (!orderId || access.loading) return null;
  // Every staff member records purchases for an order; the figures need "reports"
  if (!canSee) {
    return (
      <Frame title="المحاسبة" error="" loading={false}>
        {!separateActions && <QuickOrderBill orderId={orderId} orderNumber={orderNumber || ''} onSaved={() => {}} />}
        <PreviousCustomerLines orderId={orderId} onMoved={() => {}} />
        {!separateActions && isPayment && <CustomerRefundPanel orderId={orderId} onSaved={() => {}} />}
        <AbandonedPanel orderId={orderId} onChanged={() => {}} />
        {isPayment && <AlipaySendPanel orderId={orderId} />}
      </Frame>
    );
  }
  const totals = data?.totals;
  const empty = data && !data.claims.length && !data.entries.length;
  return (
    <Frame title="المحاسبة" error={error} loading={!data}>
      {!separateActions && data && <QuickOrderBill orderId={orderId} orderNumber={data.order.orderId} onSaved={reload} />}
      <PreviousCustomerLines orderId={orderId} onMoved={reload} />
      {!separateActions && (isPayment || data?.order?.isPayment) && <CustomerRefundPanel orderId={orderId} onSaved={reload} />}
      <AbandonedPanel orderId={orderId} onChanged={reload} />
      {(isPayment || data?.order?.isPayment) && <AlipaySendPanel orderId={orderId} onSent={reload} />}
      {empty && <NoEntries />}
      {empty && data.bills.length > 0 && <BillsTable bills={data.bills} empty="" />}
      {data && !empty && (
        <>
          <StatGrid>
            <Stat label="مطالبات على العميل" value={<Money value={totals.billed} />} hint={<>مدفوع <Money value={totals.paid} /></>} />
            <Stat label="المتبقي على العميل" value={<Money value={totals.open} />} tone={totals.open > 0 ? 'warn' : undefined} />
            <Stat label="إيراد معترف به" value={<Money value={totals.recognized} />} hint={totals.deferred ? <>مؤجل <Money value={totals.deferred} /></> : 'لا إيراد مؤجل'} />
            <Stat label="التكلفة" value={<Money value={totals.cost} />} hint={totals.costInProgress ? <>قيد التنفيذ <Money value={totals.costInProgress} /></> : undefined} />
            <Stat label="ربح الطلب" value={<Money value={totals.profit} />} tone={totals.profit < 0 ? 'danger' : 'accent'} hint="المعترف به ناقص تكلفته" />
          </StatGrid>
          <Panel flush title="المطالبات" subtitle="إيراد الطرد يُعترف به عند تسليمه وسداده كاملاً. فاتورة الشراء: يُعترف من إيرادها وتكلفتها بقدر ما دُفع منها (أقساط)، والباقي يُعترف عند السداد الكامل.">
            <DataTable
              dense rows={data.claims} rowKey={(row: any) => row.arKey} empty={{ title: 'لا مطالبات' }}
              columns={[
                { key: 'claim', header: 'المطالبة', render: (row: any) => <>{CLAIM_KIND[row.kind] || row.kind} {row.tracking && <Ltr>{row.tracking}</Ltr>} {(row.kind === 'SHP' || row.kind === 'DOM') && (row.delivered ? <Badge tone="ok">مسلَّم</Badge> : <Badge tone="muted">لم يُسلَّم</Badge>)}</> },
                { key: 'billed', header: 'المطالبة', numeric: true, render: (row: any) => <Money value={row.billed} /> },
                { key: 'paid', header: 'المدفوع', numeric: true, render: (row: any) => <Money value={row.paid} tone="plain" /> },
                { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong={row.open !== 0} hideZero /> },
                { key: 'recognized', header: 'إيراد معترف به', numeric: true, render: (row: any) => (row.recognized ? <Money value={row.recognized} /> : row.deferred ? <Badge tone="warn">مؤجل</Badge> : null) },
                { key: 'cost', header: 'التكلفة', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.cost} hideZero tone="plain" /> },
                { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => (row.recognized ? <Money value={row.profit} strong /> : null) },
                ...(access.can('entries') ? [{
                  key: 'writeOff', header: '', align: 'end' as const, render: (row: any) => (row.open > 0 && (row.kind === 'PUR' || row.delivered)
                    ? <Button size="small" color="warning" onClick={() => setWriteOff(row)}>شطب</Button> : null),
                }] : []),
              ]}
            />
          </Panel>
          {writeOff && <WriteOffDialog claim={writeOff} onClose={() => setWriteOff(null)} onDone={() => { setWriteOff(null); reload(); }} />}
          <BillsTable bills={data.bills} empty="لا تكلفة مورد مسجلة على هذا الطلب" />
        </>
      )}
      {data && <>
        <AccountingFold title="مركز تكلفة الطلبية" summary={<Money value={data.costExplanation?.total ?? (totals.cost + totals.costInProgress)} />}>
          <OrderCostBreakdown data={data.costExplanation} />
        </AccountingFold>
        <AccountingFold title="القيود المحاسبية" summary={`${data.entries.length} قيد`}>
          <EntriesTable entries={data.entries} />
        </AccountingFold>
      </>}
    </Frame>
  );
};

export const TripAccounting = ({ tripId }: { tripId?: string }) => {
  const { access, canSee, data, error } = useSummary(tripId ? `summary/trip/${tripId}` : null);
  if (!tripId || access.loading || data?.isWarehouse) return null;
  // The trip's costs are entered in the trip page's own expenses section; the figures need "reports"
  if (!canSee) return null;
  const totals = data?.totals;
  return (
    <Frame
      title="المحاسبة" error={error} loading={!data}
      actions={access.can('purchases') ? <Open to={`/accounting/bills/new?tripId=${tripId}`}>فاتورة بعدة سطور أو مرفقات</Open> : undefined}
    >
      {data && (
        <>
          {!data.entries.length && <NoEntries />}
          <StatGrid>
            <Stat label="إيراد معترف به" value={<Money value={totals.revenue} />} hint={data.international ? <>{totals.recognizedPackages} من {totals.packages} طرداً · مؤجل <Money value={totals.deferred} /></> : 'رحلة داخلية: تكلفة نقل فقط'} />
            <Stat label="تكلفة محمَّلة" value={<Money value={totals.cost} />} hint={<>قيد التنفيذ <Money value={totals.costInProgress} /></>} />
            <Stat label="إجمالي تكاليف الرحلة" value={<Money value={totals.totalCost} />} hint={data.international ? 'تُوزَّع على الطرود حسب الوزن' : 'مصروف مباشر، لا يُوزَّع على الطرود'} />
            {data.international
              ? <Stat label="ربح الرحلة" value={<Money value={totals.profit} />} tone={totals.profit < 0 ? 'danger' : 'accent'} hint={totals.margin !== null ? `${totals.margin}%` : SHIPPING_TYPES[data.trip.shippingType]} />
              : <Stat label="ربح الرحلة" value="—" hint="إيراد طرودها في رحلتها الجوية أو البحرية، وتكلفة هذه الرحلة تُخصم من ربحها هناك" />}
          </StatGrid>
          <BillsTable bills={data.bills} empty="لا مصاريف مسجلة على هذه الرحلة" />
          <Panel flush title={`الطرود (${data.packages.length})`} subtitle="حصة الطرد من التكلفة تنتقل من «قيد التنفيذ» عند الاعتراف بإيراده.">
            <DataTable
              dense maxHeight={420} rows={data.packages} rowKey={(row: any) => String(row.packageId)} empty={{ title: 'لا طرود في الرحلة' }}
              rowTone={(row: any) => (row.isCanceled ? 'canceled' : undefined)}
              columns={[
                { key: 'package', header: 'الطرد', render: (row: any) => <><Ltr>{row.tracking || '-'}</Ltr> {row.delivered && <Badge tone="ok">مسلَّم</Badge>}<Sub>الطلب <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open> · {row.weight} كغ محتسب{row.volumetric && <> <Badge tone="info">حجمي</Badge> الفعلي {row.actualWeight ?? '-'} كغ</>}</Sub></>, sortValue: (row: any) => row.orderNumber },
                { key: 'charge', header: 'أجرة الشحن', numeric: true, render: (row: any) => <Money value={row.charge} tone="plain" />, sortValue: (row: any) => row.charge },
                { key: 'open', header: 'باقٍ على العميل', numeric: true, render: (row: any) => <Money value={row.open} hideZero />, sortValue: (row: any) => row.open },
                { key: 'revenue', header: 'إيراد معترف به', numeric: true, render: (row: any) => (row.revenue ? <Money value={row.revenue} /> : row.deferred ? <Badge tone="warn">مؤجل</Badge> : null), sortValue: (row: any) => row.revenue },
                { key: 'cost', header: 'حصته من التكلفة', numeric: true, render: (row: any) => <Money value={row.cost} hideZero tone="plain" />, sortValue: (row: any) => row.cost },
              ]}
            />
          </Panel>
          <EntriesTable entries={data.entries} />
        </>
      )}
    </Frame>
  );
};

const ACCOUNT_LABEL: Record<string, string> = { receivable: 'ذمة', walletUsd: 'محفظة دولار', walletLyd: 'محفظة دينار' };

export const CustomerAccounting = ({ customerId }: { customerId?: string }) => {
  const { access, canSee, data, error } = useSummary(customerId ? `summary/customer/${customerId}` : null);
  if (!customerId || access.loading) return null;
  if (!canSee) return <NoAccess />;
  const wallet = (item: any, currency: string) => (
    <Stat
      label={`المحفظة – ${currency === 'USD' ? 'دولار' : 'دينار'}`}
      value={<Money value={item.ledger} currency={currency} />}
      hint={item.ledger === item.system ? 'مطابقة لرصيد المنظومة' : <>في المنظومة <Money value={item.system} currency={currency} tone="plain" /></>}
      tone={item.ledger === item.system ? undefined : 'danger'}
    />
  );
  return (
    <Frame
      title={data ? `كشف ${userLabel(data.customer)} المحاسبي` : 'المحاسبة'} error={error} loading={!data}
      actions={<Open to={`/accounting/reports?tab=customer&customer=${customerId}`}>الكشف الكامل والتصدير</Open>}
    >
      {data && (
        <>
          {!data.movementsCount && <NoEntries />}
          {!data.matches && <Alert severity="error" className="mb-3">رصيد المحفظة في الدفاتر لا يطابق المنظومة: عملية لم تُرحَّل أو تعديل مباشر على الرصيد. راجع المطابقة والاستثناءات.</Alert>}
          <StatGrid>
            <Stat label="عليه (ذمم)" value={<Money value={data.owed} />} tone={data.owed > 0 ? 'warn' : undefined} hint={data.aging.d91 > 0 ? <>منها أقدم من 90 يوماً <Money value={data.aging.d91} /></> : undefined} />
            {wallet(data.walletUsd, 'USD')}
            {wallet(data.walletLyd, 'LYD')}
          </StatGrid>
          <Panel flush title={`مطالبات مفتوحة (${data.claims.length})`}>
            <DataTable
              dense maxHeight={320} rows={data.claims} rowKey={(row: any, index: number) => `${row.arKey}-${index}`} empty={{ title: 'لا مطالبات مفتوحة' }}
              columns={[
                { key: 'claim', header: 'المطالبة', render: (row: any) => <>{CLAIM_KIND[row.kind] || 'أخرى'} {row.tracking && <Ltr>{row.tracking}</Ltr>} {row.delivered && <Badge tone="warn">مسلَّم</Badge>}{row.orderNumber && <Sub>الطلب <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open></Sub>}</> },
                { key: 'since', header: 'منذ', render: (row: any) => <><Ltr>{row.since}</Ltr><Sub>{row.age} يوماً</Sub></> },
                { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong /> },
              ]}
            />
          </Panel>
          <Panel flush title="آخر الحركات" subtitle={data.movementsCount > data.recent.length ? `آخر ${data.recent.length} من ${data.movementsCount}.` : undefined}>
            <DataTable
              dense rows={data.recent} rowKey={(row: any, index: number) => `${row.entryId}-${index}`} empty={{ title: 'لا حركات' }}
              columns={[
                { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
                { key: 'description', header: 'البيان', render: (row: any) => <>{row.description}<Sub><Open to={`/accounting/entries/${row.entryId}`}><Ltr>{row.number}</Ltr></Open> · {EVENT_LABELS[row.eventType] || row.eventType} · {ACCOUNT_LABEL[row.account]}</Sub></> },
                { key: 'foreign', header: 'بالعملة', numeric: true, hideOnMobile: true, render: (row: any) => (row.foreign ? <Money value={Math.abs(row.foreign)} currency={row.currency} tone="plain" /> : null) },
                { key: 'debit', header: 'مدين', numeric: true, render: (row: any) => <Money value={row.debit} tone="debit" hideZero /> },
                { key: 'credit', header: 'دائن', numeric: true, render: (row: any) => <Money value={row.credit} tone="credit" hideZero /> },
                { key: 'owed', header: 'عليه', numeric: true, render: (row: any) => <Money value={row.owed} strong /> },
              ]}
            />
          </Panel>
        </>
      )}
    </Frame>
  );
};
