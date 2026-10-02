import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Autocomplete, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, RemotePicker, today, userLabel, useVendors } from './shared';
import { useBulk } from './bulk';
import { AccountRef, Amount, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';

export const PaymentsList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>({ results: [] });
  const [cancel, setCancel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const load = () => acc.get('payments').then((res: any) => setData(res.data)).catch(() => {}).finally(() => setIsLoading(false));
  useEffect(() => { load(); }, []);

  const bulk = useBulk<any>({
    rows: data.results,
    rowKey: (row) => row._id,
    rowLabel: (row) => row.number,
    onDone: load,
    actions: [{
      key: 'cancel', label: 'إلغاء الدفعات', done: 'أُلغيت', danger: true, needsReason: true,
      applies: (row) => row.status === 'posted' && !row.autoFromBillId,
      run: (row, reason) => acc.post(`documents/AccountingSupplierPayment/${row._id}/cancel`, { reason }),
      confirm: (count) => `سيُلغى ${count} دفعة بقيد عكسي لكل منها، وتعود فواتيرها غير مسددة.`,
    }],
  });

  return (
    <>
      <PageHeader
        title="دفعات الموردين"
        subtitle="المبالغ المدفوعة للموردين موزعة على فواتيرهم. ما لا يُوزَّع يبقى دفعة مقدمة لدى المورد."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => navigate('/accounting/payments/new')}>دفعة جديدة</Button>}
      />
      <Panel flush>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={data.results}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد دفعات بعد', action: <Button variant="outlined" onClick={() => navigate('/accounting/payments/new')}>دفعة جديدة</Button> }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr>{row.autoFromBillId ? ' · دفع فوري مع الفاتورة' : ''}</Sub></> },
            { key: 'from', header: 'من', hideOnMobile: true, render: (row: any) => (row.fromAdvance ? 'الدفعة المقدمة' : row.fromAccountId ? <AccountRef code={row.fromAccountId.code} name={row.fromAccountId.name} /> : null) },
            {
              key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => (row.amount
                ? <Amount value={row.amount} currency={row.currency} />
                : <Money value={row.allocations.reduce((s: number, a: any) => s + a.amountUsd, 0)} />),
            },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' && !row.autoFromBillId ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingSupplierPayment" id={cancel._id} title={`الدفعة ${cancel.number}`} />}
      <ReceiptsList />
    </>
  );
};

// Money a supplier gave us back (spec 19.13): a refund on a credited bill, or from their balance
const ReceiptsList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [cancel, setCancel] = useState<any>(null);
  const load = () => acc.get('receipts').then((res: any) => setRows(res.data.results)).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <Panel flush title="الاستلام من الموردين" subtitle="مبالغ أعادها مورد أو أودعها لنا (مثل 50 يواناً في Alipay): تُسدِّد ما عليه لنا من إشعار دائن، والباقي يُخصم من دفعتنا المقدمة لديه أو يبقى رصيداً له."
      actions={<Button size="small" startIcon={<Plus size={14} />} onClick={() => navigate('/accounting/receipts/new')}>استلام جديد</Button>}>
      <DataTable
        dense rows={rows} rowKey={(row: any) => row._id}
        rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
        empty={{ title: 'لا استلامات بعد' }}
        columns={[
          { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
          { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr>{row.allocations?.length ? ` · على ${row.allocations.map((a: any) => a.billId?.number).join('، ')}` : ''}</Sub></> },
          { key: 'to', header: 'إلى', hideOnMobile: true, render: (row: any) => (row.toAccountId ? <AccountRef code={row.toAccountId.code} name={row.toAccountId.name} /> : null) },
          { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.amount} currency={row.currency} /> },
          { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
          { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
        ]}
      />
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model="AccountingSupplierReceipt" id={cancel._id} title={`الاستلام ${cancel.number}`} />}
    </Panel>
  );
};

export const ReceiptForm = () => {
  const navigate = useNavigate();
  const { accounts } = useAccountingData();
  const { vendors } = useVendors();
  const [vendorId, setVendorId] = useState('');
  const [form, setForm] = useState<any>({ day: today(), toAccountId: '', amount: '', rate: '', note: '' });
  const [owed, setOwed] = useState<any[]>([]);
  const [advance, setAdvance] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const idempotencyKey = useRef(newKey());
  const toAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && a.isCash), [accounts]);
  const to = toAccounts.find((a) => a._id === form.toAccountId);

  useEffect(() => {
    if (!vendorId) { setOwed([]); setAdvance(0); return; }
    acc.get(`vendors/${vendorId}/open-bills`).then((res: any) => {
      // Bills on which the vendor owes us (paid, then credited)
      setOwed(res.data.results.filter((b: any) => b.open < 0));
      setAdvance(res.data.advance);
      setAllocations({});
    }).catch(() => {});
  }, [vendorId]);

  const save = async () => {
    try {
      setIsSaving(true);
      setError('');
      await acc.post('receipts', {
        vendorId, day: form.day, toAccountId: form.toAccountId, amount: Number(form.amount), rate: Number(form.rate) || undefined, note: form.note || undefined,
        allocations: Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([billId, v]) => ({ billId, amountUsd: Math.round(Number(v) * 100) })),
        idempotencyKey: idempotencyKey.current,
      });
      navigate('/accounting/payments');
    } catch (err) {
      setError(errorText(err));
    }
    setIsSaving(false);
  };

  return (
    <>
      <PageHeader title="استلام من مورد" subtitle="ما دخل الخزينة أو البنك أو Alipay من مورد، بعملة الحساب. وزّعه على ما عليه لنا من فواتير أُرجعت؛ والباقي يُخصم من دفعتنا المقدمة لديه (أو يبقى رصيداً له)." />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Panel title="الاستلام">
        <div className="acc-form-grid">
          <Autocomplete size="small" options={vendors} value={vendors.find((v) => v._id === vendorId) || null}
            getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onChange={(_, v: any) => setVendorId(v?._id || '')} renderInput={(p) => <TextField {...p} label="المورد" />} />
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          <TextField select label="استُلم في" value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
            {toAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
          </TextField>
          <TextField type="number" label={`المبلغ (${to?.currency || 'USD'})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          {to?.currency && to.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر اليوم)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />}
        </div>
        {vendorId && <p className="acc-muted mt-2">{advance > 0 ? <>دفعتنا المقدمة لديه: <Money value={advance} /></> : advance < 0 ? <>نحتفظ له برصيد: <Money value={-advance} /></> : 'لا دفعة مقدمة ولا رصيد له.'}</p>}
      </Panel>
      {owed.length > 0 && (
        <Panel flush title="ما عليه لنا" subtitle="فواتير دُفعت ثم صدر عليها إشعار دائن.">
          <DataTable
            rows={owed} rowKey={(row: any) => row._id}
            columns={[
              { key: 'number', header: 'الفاتورة', render: (row: any) => <Ltr>{row.number}</Ltr> },
              { key: 'open', header: 'عليه لنا', numeric: true, render: (row: any) => <Money value={-row.open} strong /> },
              {
                key: 'take', header: 'يُسدَّد الآن ($)', align: 'end', width: 220, render: (row: any) => (
                  <span className="d-inline-flex gap-1">
                    <TextField type="number" value={allocations[row._id] || ''} onChange={(e) => setAllocations({ ...allocations, [row._id]: e.target.value })} style={{ width: 120 }} />
                    <Button size="small" onClick={() => setAllocations({ ...allocations, [row._id]: (-row.open / 100).toFixed(2) })}>الكل</Button>
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      )}
      <Panel>
        <TextField label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} fullWidth />
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button onClick={() => navigate(-1)}>رجوع</Button>
          <Button variant="contained" disabled={isSaving || !vendorId || !form.toAccountId || !(Number(form.amount) > 0)} onClick={save}>ترحيل الاستلام</Button>
        </div>
      </Panel>
    </>
  );
};

export const PaymentForm = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { accounts } = useAccountingData();
  const { vendors } = useVendors();
  const [vendorId, setVendorId] = useState(params.get('vendorId') || '');
  const [form, setForm] = useState<any>({ day: today(), fromAccountId: '', amount: '', rate: '', note: '', fromAdvance: false, employee: null });
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [advance, setAdvance] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const idempotencyKey = useRef(newKey());

  const payAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && (a.isCash || a.requires?.includes('employee'))), [accounts]);
  const from = payAccounts.find((a) => a._id === form.fromAccountId);

  useEffect(() => {
    if (!vendorId) { setOpenBills([]); return; }
    acc.get(`vendors/${vendorId}/open-bills`).then((res: any) => {
      setOpenBills(res.data.results);
      setAdvance(res.data.advance);
      const bill = res.data.results.find((b: any) => b._id === params.get('billId'));
      setAllocations(bill ? { [bill._id]: (bill.open / 100).toFixed(2) } : {});
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const allocatedUsd = Object.values(allocations).reduce((sum, value) => sum + Math.round((Number(value) || 0) * 100), 0);

  const save = async () => {
    try {
      setIsSaving(true);
      setError('');
      await acc.post('payments', {
        vendorId, day: form.day, fromAdvance: form.fromAdvance || undefined,
        fromAccountId: form.fromAdvance ? undefined : form.fromAccountId,
        employeeId: from?.requires?.includes('employee') ? form.employee?._id : undefined,
        amount: form.fromAdvance ? undefined : Number(form.amount), rate: Number(form.rate) || undefined, note: form.note || undefined,
        allocations: Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([billId, v]) => ({ billId, amountUsd: Math.round(Number(v) * 100) })),
        idempotencyKey: idempotencyKey.current,
      });
      navigate(vendorId ? `/accounting/vendors/${vendorId}` : '/accounting/payments');
    } catch (err) {
      setError(errorText(err));
    }
    setIsSaving(false);
  };

  return (
    <>
      <PageHeader title="دفعة لمورد" subtitle="اكتب ما خرج من الخزينة بعملتها، ثم وزّعه على الفواتير بالدولار. الفاتورة المدفوعة بعملتها تُغلق بالكامل حتى لو تغيّر السعر، والفرق يُسجَّل ربح/خسارة صرف." />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Panel title="الدفعة">
        <div className="acc-form-grid">
          <Autocomplete size="small" options={vendors} value={vendors.find((v) => v._id === vendorId) || null}
            getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onChange={(_, v: any) => setVendorId(v?._id || '')} renderInput={(p) => <TextField {...p} label="المورد" />} />
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          {!form.fromAdvance && <>
            <TextField select label="دُفعت من" value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}>
              {payAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label={`المبلغ (${from?.currency || 'USD'})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {from?.currency && from.currency !== 'USD' && (
              <TextField type="number" label="السعر (فارغ = سعر اليوم)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })}
                helperText={allocatedUsd > 0 && Number(form.amount) > 0 ? (
                  <span>المقترح: المدفوع ÷ الموزَّع = <Ltr>{(Number(form.amount) / (allocatedUsd / 100)).toFixed(4)}</Ltr>{' '}
                    <Button size="small" onClick={() => setForm({ ...form, rate: (Number(form.amount) / (allocatedUsd / 100)).toFixed(6) })}>استخدمه</Button>
                  </span>
                ) : 'وزّع المبلغ على الفواتير ليُقترح السعر الذي يُقفلها على صفر'} />
            )}
            {from?.requires?.includes('employee') && <RemotePicker endpoint="lookup/users" label="الموظف صاحب العهدة" value={form.employee} getLabel={userLabel} onChange={(employee) => setForm({ ...form, employee })} />}
          </>}
        </div>
        {advance > 0 && <FormControlLabel className="mt-2" control={<Checkbox checked={form.fromAdvance} onChange={(e) => setForm({ ...form, fromAdvance: e.target.checked })} />} label={<>استخدام الدفعة المقدمة لدى المورد (<Money value={advance} />)</>} />}
      </Panel>

      <Panel flush title="الفواتير المفتوحة" subtitle="اكتب ما يُسدَّد من كل فاتورة بالدولار، أو اضغط «الكل».">
        <DataTable
          rows={openBills}
          rowKey={(row: any) => row._id}
          empty={{ title: vendorId ? 'لا توجد فواتير مفتوحة' : 'اختر المورد أولاً', hint: vendorId ? 'الدفعة ستُسجَّل كدفعة مقدمة لدى المورد.' : undefined }}
          columns={[
            { key: 'number', header: 'الفاتورة', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.vendorRef && <Sub>رقم المورد <Ltr>{row.vendorRef}</Ltr></Sub>}</> },
            { key: 'day', header: 'التاريخ', hideOnMobile: true, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'total', header: 'الإجمالي', numeric: true, hideOnMobile: true, render: (row: any) => <Amount value={row.total} currency={row.currency} /> },
            { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong /> },
            {
              key: 'pay', header: 'يُسدَّد الآن ($)', align: 'end', width: 220, render: (row: any) => (
                <span className="d-inline-flex gap-1">
                  <TextField type="number" value={allocations[row._id] || ''} onChange={(e) => setAllocations({ ...allocations, [row._id]: e.target.value })} style={{ width: 120 }} />
                  <Button size="small" onClick={() => setAllocations({ ...allocations, [row._id]: (row.open / 100).toFixed(2) })}>الكل</Button>
                </span>
              ),
            },
          ]}
          footer={openBills.length ? { number: 'الموزَّع على الفواتير', pay: <Money value={allocatedUsd} strong /> } : undefined}
        />
      </Panel>

      <Panel>
        <TextField label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} fullWidth />
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button onClick={() => navigate(-1)}>رجوع</Button>
          <Button variant="contained" disabled={isSaving || !vendorId || (form.fromAdvance ? !allocatedUsd : !(form.fromAccountId && Number(form.amount) > 0))} onClick={save}>ترحيل الدفعة</Button>
        </div>
      </Panel>
    </>
  );
};
