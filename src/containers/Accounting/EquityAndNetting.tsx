import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { amountLabel, CancelDialog, RemotePicker, today, userLabel, useVendors } from './shared';
import { cancelAction, useBulk } from './bulk';
import { AccountRef, Amount, Badge, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';

const EQUITY_TYPES: Record<string, { label: string; tone: 'ok' | 'warn' | 'info' | 'muted' }> = {
  capital_in: { label: 'إيداع رأس مال', tone: 'ok' },
  withdrawal: { label: 'مسحوبات شريك', tone: 'warn' },
  loan_in: { label: 'استلام قرض', tone: 'info' },
  loan_repayment: { label: 'سداد قرض', tone: 'muted' },
};

export const Equity = () => {
  const { accounts } = useAccountingData();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const key = useRef(newKey());
  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);
  const cash = form && cashAccounts.find((a) => a._id === form.accountId);

  const load = () => acc.get('equity').then((res: any) => setItems(res.data.results)).catch(() => {}).finally(() => setIsLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await acc.post('equity', { ...form, amount: Number(form.amount), rate: Number(form.rate) || undefined, idempotencyKey: key.current });
      key.current = newKey();
      setForm(null);
      setMessage({ type: 'success', text: 'تم الترحيل.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const bulk = useBulk<any>({
    rows: items, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: load,
    actions: [cancelAction('AccountingEquityTransaction', 'إلغاء العمليات', 'يعود أثرها على الخزينة ورأس المال أو القرض.')],
  });

  return (
    <>
      <PageHeader
        title="رأس المال والقروض"
        subtitle="ما يودعه الشركاء أو يسحبونه، والقروض المستلمة وسدادها."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setForm({ type: 'capital_in', partyName: '', day: today(), accountId: '', amount: '', rate: '', note: '' })}>عملية جديدة</Button>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel flush>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={items}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد عمليات بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'type', header: 'العملية', render: (row: any) => <Badge tone={EQUITY_TYPES[row.type]?.tone}>{EQUITY_TYPES[row.type]?.label}</Badge> },
            { key: 'party', header: 'الشريك / الجهة', render: (row: any) => row.partyName },
            { key: 'cash', header: 'الخزينة', hideOnMobile: true, render: (row: any) => <AccountRef code={row.accountId?.code} name={row.accountId?.name} /> },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.amount} currency={row.accountId?.currency} /> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>رأس مال / قرض</DialogTitle>
        {form && (
          <DialogContent>
            <TextField select label="العملية" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} fullWidth className="mt-2">
              {Object.entries(EQUITY_TYPES).map(([value, item]) => <MenuItem key={value} value={value}>{item.label}</MenuItem>)}
            </TextField>
            <TextField label="اسم الشريك أو الجهة المقرضة" value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} fullWidth className="mt-3" />
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="mt-3" />
            <TextField select label="الخزينة" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} fullWidth className="mt-3">
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={amountLabel(cash?.currency)} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} fullWidth className="mt-3" />
            {cash?.currency && cash.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر اليوم)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} fullWidth className="mt-3" />}
            <TextField label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} fullWidth className="mt-3" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!form?.partyName || !form?.accountId || !(Number(form?.amount) > 0)} onClick={save}>ترحيل</Button>
        </DialogActions>
      </Dialog>
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingEquityTransaction" id={cancel._id} title={cancel.number} />}
    </>
  );
};

export const Netting = () => {
  const { vendors } = useVendors();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const key = useRef(newKey());

  const load = () => acc.get('nettings').then((res: any) => setItems(res.data.results)).catch(() => {}).finally(() => setIsLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!form?.vendorId) return;
    acc.get(`vendors/${form.vendorId}/open-bills`).then((res: any) => setOpenBills(res.data.results)).catch(() => {});
  }, [form?.vendorId]);
  useEffect(() => {
    if (!form?.customer?._id) return;
    acc.get('lookup/claims', { partnerId: form.customer._id }).then((res: any) => setClaims(res.data.results)).catch(() => {});
  }, [form?.customer?._id]);

  const save = async () => {
    try {
      await acc.post('nettings', {
        vendorId: form.vendorId, customerId: form.customer._id, day: form.day, mode: form.mode, billId: form.billId,
        arKey: form.mode === 'payable_to_ar' ? form.arKey : undefined, walletCurrency: form.mode === 'payable_to_wallet' ? form.walletCurrency : undefined,
        rate: Number(form.rate) || undefined, amountUsd: Math.round(Number(form.amount) * 100), note: form.note || undefined, idempotencyKey: key.current,
      });
      key.current = newKey();
      setForm(null);
      setMessage({ type: 'success', text: 'تم ترحيل المقاصة.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const bulk = useBulk<any>({
    rows: items, rowKey: (row) => row._id, rowLabel: (row) => row.number, onDone: load,
    actions: [cancelAction('AccountingNetting', 'إلغاء المقاصات', 'تعود الذمتان مفتوحتين. المقاصة التي تجعل محفظة العميل سالبة تُرفض؛ ألغِها منفردة مع التأكيد.')],
  });

  return (
    <>
      <PageHeader
        title="المقاصة"
        subtitle="لشريك هو عميل ومورد معاً: ما تدين به الشركة له إما يسدد مطالبته، أو يُضاف لمحفظته مع سطر في كشفه."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setForm({ vendorId: '', customer: null, day: today(), mode: 'payable_to_ar', billId: '', arKey: '', walletCurrency: 'USD', rate: '', amount: '', note: '' })}>مقاصة جديدة</Button>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel flush>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={items}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد مقاصات بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <><Ltr>{row.day}</Ltr><Sub><Ltr>{row.number}</Ltr></Sub></> },
            { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendorId?.name}<Sub>فاتورة <Ltr>{row.billId?.number}</Ltr></Sub></> },
            { key: 'customer', header: 'العميل', render: (row: any) => (row.customerId ? userLabel(row.customerId) : '') },
            { key: 'mode', header: 'الطريقة', hideOnMobile: true, render: (row: any) => (row.mode === 'payable_to_ar' ? <Badge tone="info">سداد مطالبته</Badge> : <Badge tone="accent">إلى المحفظة ({row.walletCurrency})</Badge>) },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Money value={row.amountUsd} strong /> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>مقاصة جديدة</DialogTitle>
        {form && (
          <DialogContent>
            <Autocomplete size="small" className="mt-2" options={vendors} value={vendors.find((v) => v._id === form.vendorId) || null}
              getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, v: any) => setForm({ ...form, vendorId: v?._id || '', customer: v?.linkedCustomer || form.customer, billId: '' })}
              renderInput={(p) => <TextField {...p} label="المورد" />} />
            <TextField select label="فاتورة المورد" value={form.billId} onChange={(e) => setForm({ ...form, billId: e.target.value })} fullWidth className="mt-3">
              {openBills.map((b) => <MenuItem key={b._id} value={b._id}>{b.number} · متبقي ${(b.open / 100).toFixed(2)}</MenuItem>)}
            </TextField>
            <div className="mt-3"><RemotePicker endpoint="lookup/users" label="العميل" value={form.customer} getLabel={userLabel} onChange={(customer) => setForm({ ...form, customer, arKey: '' })} /></div>
            <TextField select label="تُستخدم في" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} fullWidth className="mt-3">
              <MenuItem value="payable_to_ar">سداد مطالبة العميل</MenuItem>
              <MenuItem value="payable_to_wallet">إضافة لمحفظة العميل</MenuItem>
            </TextField>
            {form.mode === 'payable_to_ar' ? (
              <TextField select label="مطالبة العميل" value={form.arKey} onChange={(e) => setForm({ ...form, arKey: e.target.value })} fullWidth className="mt-3"
                helperText={form.customer && claims.length === 0 ? 'لا توجد مطالبة مفتوحة على هذا العميل' : undefined}>
                {claims.map((c) => <MenuItem key={c.arKey} value={c.arKey}>{c.arKey} · مفتوح ${(c.open / 100).toFixed(2)}</MenuItem>)}
              </TextField>
            ) : (
              <div className="d-flex gap-2 mt-3">
                <TextField select label="المحفظة" value={form.walletCurrency} onChange={(e) => setForm({ ...form, walletCurrency: e.target.value })} style={{ width: 150 }}>
                  <MenuItem value="USD">دولار</MenuItem>
                  <MenuItem value="LYD">دينار</MenuItem>
                </TextField>
                {form.walletCurrency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر اليوم)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />}
              </div>
            )}
            <TextField type="number" label="المبلغ (بالدولار)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} fullWidth className="mt-3" />
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="mt-3" />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!form?.billId || !form?.customer || !(Number(form?.amount) > 0) || (form?.mode === 'payable_to_ar' && !form?.arKey)} onClick={save}>ترحيل</Button>
        </DialogActions>
      </Dialog>
      {cancel && (
        <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingNetting" id={cancel._id} title={`المقاصة ${cancel.number}`}
          askConfirm={cancel.mode === 'payable_to_wallet' ? 'استرجاع المبلغ حتى لو أصبحت المحفظة سالبة' : undefined} />
      )}
    </>
  );
};
