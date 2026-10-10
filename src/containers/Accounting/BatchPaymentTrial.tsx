import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, MenuItem, TextField } from '@mui/material';
import { acc, errorText, newKey, todayLibya } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { useVendors } from './shared';
import { DataTable, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

export const batchTrialAvailable = process.env.REACT_APP_ENVIRONMENT === 'qa' || ['localhost', '127.0.0.1'].includes(window.location.hostname);

export default function BatchPaymentTrial() {
  const { accounts } = useAccountingData({ referenceOnly: true });
  const { vendors } = useVendors();
  const [vendorId, setVendorId] = useState('');
  const [bills, setBills] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ day: todayLibya(), fromAccountId: '', amount: '', excessPurpose: 'advance', toAccountId: '', note: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const key = useRef(newKey());
  const previousTotal = useRef(0);
  useEffect(() => {
    let active = true;
    setBills([]); setSelected(new Set()); setError('');
    if (!vendorId || !batchTrialAvailable) { setLoading(false); return; }
    setLoading(true);
    acc.get(`vendors/${vendorId}/open-bills`, { batchTrial: true }).then((res: any) => {
      if (active) setBills(res.data.results);
    }).catch((err: any) => { if (active) setError(errorText(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vendorId]);
  const chosen = bills.filter(bill => selected.has(bill._id));
  const total = chosen.reduce((sum, bill) => sum + bill.open, 0);
  useEffect(() => {
    const previous = previousTotal.current;
    setForm(current => !current.amount || Math.round(Number(current.amount) * 100) === previous
      ? { ...current, amount: total ? (total / 100).toFixed(2) : '' } : current);
    previousTotal.current = total;
  }, [total]);
  const paid = Math.round(Number(form.amount) * 100);
  const excess = paid - total;
  const paymentAccounts = accounts.filter(account => account.isActive && !account.isGroup && account.isCash && account.currency === 'USD');
  const wallets = accounts.filter(account => account.isActive && !account.isGroup && account.isCash && account.currency === 'CNY');
  const visible = useMemo(() => bills.filter(bill => [bill.number, bill.vendorRef, ...(bill.orders || []).flatMap((order: any) => [order.number, order.customer])]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())), [bills, search]);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const response = await acc.post('payments/batch-trial', { ...form, vendorId, amount: Number(form.amount),
        allocations: chosen.map(bill => ({ billId: bill._id, amountUsd: bill.open })), idempotencyKey: key.current });
      setResult(response.data);
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  if (!batchTrialAvailable) return <Alert severity="info">هذا الإجراء متاح في نسخة التجربة فقط.</Alert>;
  if (result) return <>
    <PageHeader title="سُجلت الدفعة المجمعة" />
    <Alert severity="success" className="mb-3">سُددت الفواتير المختارة من دفعة واحدة. عند استيراد الكشف، طابق قيد هذه الدفعة.</Alert>
    <Panel title={result.payment.number}>
      <StatGrid><Stat label="المدفوع" value={<Money value={Math.round(result.payment.amount * 100)} />} /><Stat label="الفواتير المسددة" value={result.payment.allocations.length} /></StatGrid>
      <Open to={`/accounting/entries/${result.payment.entryId}`}>فتح قيد الدفعة لمطابقة الكشف</Open>
      {result.purchase && <Alert severity="info" className="mt-3">شحن محفظتك بقيمة <Money value={result.purchase.usd} /> بانتظار وصول اليوان. <Open to={`/accounting/alipay?accountId=${result.purchase.toAccountId}`}>فتح Alipay وتأكيد الوصول</Open></Alert>}
      {!result.purchase && result.payment.advanceUsd > 0 && <Alert severity="info" className="mt-3">المتبقي لك لدى المورد: <Money value={result.payment.advanceUsd} />.</Alert>}
      <Button className="mt-3" href="/accounting/payments">العودة إلى دفعات الموردين</Button>
    </Panel>
  </>;
  return <>
    <PageHeader title="دفعة مجمعة للمورد — تجريبية" subtitle="اختر فواتير الطلبيات، ثم أدخل المبلغ الإجمالي الذي دفعته." />
    <Alert severity="info" className="mb-3">إجراء اختياري تحت التجربة في QA. يستخدم فواتير المورد الموجودة ولا ينشئ فاتورة أخرى.</Alert>
    {error && <Alert severity="error" className="mb-3">{error}</Alert>}
    <Panel title="1. المورد والحساب الدافع">
      <div className="acc-form-grid">
        <Autocomplete disabled={busy} options={vendors} value={vendors.find(v => v._id === vendorId) || null} getOptionLabel={(v: any) => v.name}
          isOptionEqualToValue={(a: any, b: any) => a._id === b._id} onChange={(_, v: any) => setVendorId(v?._id || '')} renderInput={props => <TextField {...props} label="المورد" />} />
        <TextField disabled={busy} select label="دُفعت من" value={form.fromAccountId} onChange={e => setForm({ ...form, fromAccountId: e.target.value })}>
          {paymentAccounts.map(account => <MenuItem key={account._id} value={account._id}>{accountLabel(account)}</MenuItem>)}
        </TextField>
        <TextField disabled={busy} type="date" label="تاريخ الدفع" InputLabelProps={{ shrink: true }} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} />
      </div>
    </Panel>
    <Panel flush title="2. اختر فواتير المورد التي دفعتها" subtitle="تظهر فواتير الطلبيات المرحلة وغير المسددة لهذا المورد. الاختيار يسدد المتبقي على كل فاتورة بالكامل.">
      <div className="p-3"><TextField disabled={busy} fullWidth label="بحث برقم الفاتورة أو الطلبية أو العميل" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <DataTable loading={loading} rows={visible} rowKey={(row: any) => row._id}
        selection={busy ? undefined : { selected, onChange: next => setSelected(current => {
          const updated = new Set(current);
          visible.forEach(bill => { if (next.has(bill._id)) updated.add(bill._id); else updated.delete(bill._id); });
          return updated;
        }) }}
        empty={{ title: vendorId ? 'لا توجد فواتير ضمن هذا الاختيار' : 'اختر المورد أولاً', hint: vendorId ? 'سجل فاتورة المورد على الطلبية ورحّلها دون سداد، ثم افتح هذه الشاشة.' : undefined }}
        columns={[
          { key: 'number', header: 'فاتورة المورد', render: (row: any) => <><Open to={`/accounting/bills/${row._id}`}><Ltr>{row.number}</Ltr></Open><Sub>{row.vendorRef}</Sub></> },
          { key: 'orders', header: 'الطلبية والعميل', render: (row: any) => row.orders?.map((order: any) => <div key={order._id}><Open to={`/invoice/${order._id}/edit`}><Ltr>{order.number}</Ltr></Open><Sub>{order.customer}</Sub></div>) },
          { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
          { key: 'open', header: 'يُسدد الآن', numeric: true, render: (row: any) => <Money value={row.open} /> },
        ]} />
    </Panel>
    <Panel title="3. راجع إجمالي الدفع">
      <StatGrid><Stat label="الفواتير المختارة" value={chosen.length} /><Stat label="مجموع الفواتير" value={<Money value={total} />} /><Stat label="المبلغ الزائد" value={<Money value={Math.max(excess || 0, 0)} />} /></StatGrid>
      <div className="acc-form-grid mt-3">
        <TextField disabled={busy} type="number" label="إجمالي المدفوع من الحساب ($)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        {excess > 0 && <TextField disabled={busy} select label="استخدام المبلغ الزائد" value={form.excessPurpose} onChange={e => setForm({ ...form, excessPurpose: e.target.value })}>
          <MenuItem value="advance">يبقى رصيدًا لي لدى المورد</MenuItem><MenuItem value="alipay">شحن محفظة Alipay الخاصة بي</MenuItem>
        </TextField>}
        {excess > 0 && form.excessPurpose === 'alipay' && <TextField disabled={busy} select label="محفظة Alipay المستلمة" value={form.toAccountId} onChange={e => setForm({ ...form, toAccountId: e.target.value })}>
          {wallets.map(account => <MenuItem key={account._id} value={account._id}>{accountLabel(account)}</MenuItem>)}
        </TextField>}
      </div>
      {excess < 0 && <Alert severity="warning" className="mt-3">المبلغ المدفوع أقل من مجموع الفواتير المحددة. عدّل المبلغ أو الاختيار.</Alert>}
      {excess > 0 && form.excessPurpose === 'alipay' && <Alert severity="info" className="mt-3">يُحفظ شحن محفظتك بانتظار الوصول. عند وصول اليوان، أدخل الكمية في Alipay واضغط «وصل».</Alert>}
      <TextField disabled={busy} className="mt-3" fullWidth label="ملاحظة أو مرجع التحويل" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      <div className="d-flex justify-content-end gap-2 mt-3"><Button disabled={busy} href="/accounting/payments">رجوع</Button>
        <Button variant="contained" onClick={save} disabled={busy || loading || !vendorId || !form.fromAccountId || !form.day || !chosen.length || !Number.isFinite(paid) || paid <= 0 || excess < 0 || (excess > 0 && form.excessPurpose === 'alipay' && !form.toAccountId)}>{busy ? 'جارٍ تسجيل الدفعة…' : 'تأكيد الدفعة التجريبية'}</Button>
      </div>
    </Panel>
  </>;
}
