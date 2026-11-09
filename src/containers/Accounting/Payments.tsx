import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Autocomplete, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, today, useVendors } from './shared';
import CustodyHolderPicker, { custodyExceeded } from './CustodyHolderPicker';
import { useBulk } from './bulk';
import { AccountRef, Amount, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';
import { ListFilters, queryOf, recentFrom } from './ListFilters';

const PAYMENT_FILTERS = { vendorId: '', accountId: '', status: '', from: recentFrom(), to: '', search: '' };

export const PaymentsList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>({ results: [] });
  const [cancel, setCancel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { vendors } = useVendors();
  const { accounts } = useAccountingData();
  const [filters, setFilters] = useState<any>(PAYMENT_FILTERS);
  const load = (current = filters) => acc.get('payments', { ...queryOf(current), limit: 200 }).then((res: any) => setData(res.data)).catch(() => {}).finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const bulk = useBulk<any>({
    rows: data.results,
    rowKey: (row) => row._id,
    rowLabel: (row) => row.number,
    onDone: () => load(),
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
        subtitle="المبالغ المدفوعة للموردين موزعة على فواتيرهم. ما لا يُوزَّع يبقى دفعة مقدمة لدى المورد. ما يعيده مورد لنا في «الاستلام من الموردين» أسفل الصفحة."
        actions={(
          <>
            <Button variant="outlined" onClick={() => navigate('/accounting/payments/batch-trial')}>دفعة مجمعة</Button>
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => navigate('/accounting/receipts/new')}>استلام من مورد</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => navigate('/accounting/payments/new')}>دفعة جديدة</Button>
          </>
        )}
      />
      <Panel flush>
        <div className="px-3">
          <ListFilters value={filters} onChange={setFilters} onApply={load} blank={PAYMENT_FILTERS}>
            <TextField size="small" select label="المورد" value={filters.vendorId} onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })} style={{ minWidth: 180 }}>
              <MenuItem value="">كل الموردين</MenuItem>
              {vendors.map((v: any) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="دُفعت من" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })} style={{ minWidth: 180 }}>
              <MenuItem value="">كل الحسابات</MenuItem>
              {accounts.filter((a) => a.isCash && !a.isGroup).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="الحالة" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ minWidth: 130 }}>
              <MenuItem value="">غير الملغاة</MenuItem>
              <MenuItem value="all">الكل مع الملغاة</MenuItem>
              <MenuItem value="canceled">ملغاة</MenuItem>
            </TextField>
          </ListFilters>
        </div>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={data.results}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          // The payment's journal entry shows its details and the payment voucher
          getRowHref={(row: any) => row.entryId ? `/accounting/entries/${row.entryId?._id || row.entryId}` : undefined}
          onRowClick={(row: any) => row.entryId && navigate(`/accounting/entries/${row.entryId?._id || row.entryId}`)}
          empty={{ title: 'لا توجد دفعات بعد', action: <Button variant="outlined" onClick={() => navigate('/accounting/payments/new')}>دفعة جديدة</Button> }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr>{row.autoFromBillId ? ' · دفع فوري مع الفاتورة' : ''}{row.batchTrial ? ` · دفعة مجمعة · ${row.allocations.length} فاتورة` : ''}</Sub></> },
            { key: 'from', header: 'من', hideOnMobile: true, render: (row: any) => (row.fromAdvance ? 'الدفعة المقدمة' : row.fromAccountId ? <AccountRef code={row.fromAccountId.code} name={row.fromAccountId.name} /> : null) },
            {
              key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => (row.amount
                ? <Amount value={row.amount} currency={row.currency} />
                : <Money value={row.allocations.reduce((s: number, a: any) => s + a.amountUsd, 0)} />),
            },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' && !row.autoFromBillId ? <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); setCancel(row); }}>إلغاء</Button> : null) },
          ]}
        />
      </Panel>
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={() => load()} model="AccountingSupplierPayment" id={cancel._id} title={`الدفعة ${cancel.number}`} />}
      <ReceiptsList />
    </>
  );
};

// Money a supplier gave us back (spec 19.13): a refund on a credited bill, or from their balance
const ReceiptsList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [cancel, setCancel] = useState<any>(null);
  const { vendors } = useVendors();
  const blank = { vendorId: '', from: recentFrom(), to: '', search: '' };
  const [filters, setFilters] = useState<any>(blank);
  const load = (current = filters) => acc.get('receipts', { ...queryOf(current), limit: 200 }).then((res: any) => setRows(res.data.results)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  return (
    <Panel flush title="الاستلام من الموردين" subtitle="مبالغ أعادها مورد أو أودعها لنا (مثل 50 يواناً في Alipay): تُسدِّد ما عليه لنا من إشعار دائن، والباقي يُخصم من دفعتنا المقدمة لديه أو يبقى رصيداً له."
      actions={<Button size="small" startIcon={<Plus size={14} />} onClick={() => navigate('/accounting/receipts/new')}>استلام جديد</Button>}>
      <div className="px-3">
        <ListFilters value={filters} onChange={setFilters} onApply={load} blank={blank}>
          <TextField size="small" select label="المورد" value={filters.vendorId} onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })} style={{ minWidth: 180 }}>
            <MenuItem value="">كل الموردين</MenuItem>
            {vendors.map((v: any) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
          </TextField>
        </ListFilters>
      </div>
      <DataTable
        dense rows={rows} rowKey={(row: any) => row._id}
        rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
        empty={{ title: 'لا استلامات' }}
        columns={[
          { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
          { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendorId?.name}<Sub><Ltr>{row.number}</Ltr>{row.allocations?.length ? ` · على ${row.allocations.map((a: any) => a.billId?.number).join('، ')}` : ''}</Sub></> },
          { key: 'to', header: 'إلى', hideOnMobile: true, render: (row: any) => (row.toAccountId ? <AccountRef code={row.toAccountId.code} name={row.toAccountId.name} /> : null) },
          { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Amount value={row.amount} currency={row.currency} /> },
          { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
          { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel(row)}>إلغاء</Button> : null) },
        ]}
      />
      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={() => load()} model="AccountingSupplierReceipt" id={cancel._id} title={`الاستلام ${cancel.number}`} />}
    </Panel>
  );
};

export const ReceiptForm = () => {
  const navigate = useNavigate();
  const [receiptParams] = useSearchParams();
  const { accounts } = useAccountingData();
  const { vendors } = useVendors();
  const [vendorId, setVendorId] = useState(receiptParams.get('vendorId') || '');
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
          {to?.currency && to.currency !== 'USD' && <TextField type="number" label="السعر (فارغ = سعر تاريخ العملية)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />}
        </div>
        {vendorId && <p className="acc-muted mt-2">{advance > 0 ? <>دفعتنا المقدمة لديه: <Money value={advance} /></> : advance < 0 ? <>نحتفظ له برصيد: <Money value={-advance} /></> : 'لا دفعة مقدمة ولا رصيد له.'}</p>}
      </Panel>
      {owed.length > 0 && (
        <Panel flush title="ما عليه لنا" subtitle="أرصدة لنا نتيجة تعديل فاتورة مدفوعة أو إصدار إشعار دائن.">
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
  const [form, setForm] = useState<any>({ day: today(), fromAccountId: '', amount: '', rate: '', note: '', fromAdvance: false, advancePaymentId: '', employee: null, differenceTo: 'cost' });
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [advance, setAdvance] = useState(0);
  const [advanceSources, setAdvanceSources] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const idempotencyKey = useRef(newKey());

  const payAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && (a.isCash || a.requires?.includes('employee'))), [accounts]);
  const from = payAccounts.find((a) => a._id === form.fromAccountId);

  useEffect(() => {
    let active = true;
    setOpenBills([]); setAdvance(0); setAdvanceSources([]); setAllocations({});
    setForm((previous: any) => ({ ...previous, fromAdvance: false, advancePaymentId: '' }));
    if (!vendorId) return;
    acc.get(`vendors/${vendorId}/open-bills`).then((res: any) => {
      if (!active) return;
      setOpenBills(res.data.results);
      setAdvance(res.data.advance);
      setAdvanceSources(res.data.advanceSources || []);
      const bill = res.data.results.find((b: any) => b._id === params.get('billId'));
      setAllocations(bill ? { [bill._id]: (bill.open / 100).toFixed(2) } : {});
    }).catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const allocatedUsd = Object.values(allocations).reduce((sum, value) => sum + Math.round((Number(value) || 0) * 100), 0);
  const advanceSource = advanceSources.find(source => source._id === form.advancePaymentId);
  const advanceCurrencyTotals = Object.values(advanceSources.reduce((totals: Record<string, { currency: string; amount: number; usd: number }>, source) => {
    const group = totals[source.currency] || (totals[source.currency] = { currency: source.currency, amount: 0, usd: 0 });
    group.amount += source.remainingAmount;
    group.usd += source.remainingUsd;
    return totals;
  }, {}));
  const currencyName = (currency: string) => ({ LYD: 'دينار ليبي', TRY: 'ليرة تركية', USD: 'دولار أمريكي' }[currency] || currency);
  const settlementCurrency = form.fromAdvance ? advanceSource?.currency : from?.currency || 'USD';
  const nativeRow = (row: any) => settlementCurrency && row.currency === settlementCurrency && row.totalUsd > 0;
  const nativeAmount = (row: any, usd: number) => row.total * usd / row.totalUsd;
  const sameCurrency = !!settlementCurrency && openBills.some(row => Number(allocations[row._id]) > 0)
    && openBills.filter(row => Number(allocations[row._id]) > 0).every(nativeRow);
  // The dollar value (as stored in allocations) of what was typed for a row, in the bill's currency when native
  const allocationOf = (row: any, value: string) => {
    if (value === '') return '';
    const amount = Number(value);
    const fullNative = nativeAmount(row, row.open);
    const usd = nativeRow(row) ? Math.abs(amount - fullNative) < 0.005 ? row.open : Math.round(amount * row.totalUsd / row.total) : Math.round(amount * 100);
    return (usd / 100).toFixed(2);
  };
  const setAllocationAmount = (row: any, value: string) => {
    setTyped(previous => ({ ...previous, [row._id]: value }));
    setAllocations(previous => ({ ...previous, [row._id]: allocationOf(row, value) }));
  };
  // A native amount is kept as typed: converting it to cents and back would rewrite the field
  // on every keystroke. The typed text is shown only while it still gives the stored allocation
  // («الكل», a vendor change or a reset replace it).
  const allocationText = (row: any) => {
    const stored = allocations[row._id] || '';
    const text = typed[row._id];
    if (text !== undefined && allocationOf(row, text) === stored) return text;
    if (!stored) return '';
    return nativeRow(row) ? String(Number(nativeAmount(row, Math.round(Number(stored) * 100)).toFixed(2))) : stored;
  };
  // What the payment is worth in dollars when it can be known here (a dollar box, or a typed rate)
  const paidUsd = !(Number(form.amount) > 0) ? null : (from?.currency || 'USD') === 'USD' ? Math.round(Number(form.amount) * 100) : Number(form.rate) > 0 ? Math.round((Number(form.amount) / Number(form.rate)) * 100) : null;
  const difference = paidUsd === null ? null : paidUsd - allocatedUsd;

  const save = async () => {
    try {
      setIsSaving(true);
      setError('');
      await acc.post('payments', {
        vendorId, day: form.day, fromAdvance: form.fromAdvance || undefined,
        advancePaymentId: form.fromAdvance ? form.advancePaymentId || undefined : undefined,
        fromAccountId: form.fromAdvance ? undefined : form.fromAccountId,
        employeeId: from?.requires?.includes('employee') ? form.employee?._id : undefined,
        amount: form.fromAdvance ? undefined : Number(form.amount), rate: Number(form.rate) || undefined, note: form.note || undefined,
        differenceTo: form.fromAdvance ? undefined : form.differenceTo,
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
      <PageHeader title="دفعة لمورد" subtitle="وزّع السداد على الفواتير. عند تساوي عملة الفاتورة والدفعة يُقفل المبلغ بعملته، ويُسجّل فرق التقييم كفرق صرف." />
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
              <TextField type="number" label="السعر (فارغ = سعر تاريخ العملية)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })}
                helperText={sameCurrency ? 'اترك سعر تاريخ العملية أو أدخل سعر الدفع الفعلي. لا يلزم تغييره لإغلاق فاتورة بنفس العملة.' : allocatedUsd > 0 && Number(form.amount) > 0 ? (
                  <span>المقترح: المدفوع ÷ الموزَّع = <Ltr>{(Number(form.amount) / (allocatedUsd / 100)).toFixed(4)}</Ltr>{' '}
                    <Button size="small" onClick={() => setForm({ ...form, rate: (Number(form.amount) / (allocatedUsd / 100)).toFixed(6) })}>استخدمه</Button>
                  </span>
                ) : 'وزّع المبلغ على الفواتير ليُقترح السعر الذي يُقفلها على صفر'} />
            )}
            {from?.requires?.includes('employee') && <CustodyHolderPicker inGrid accountId={form.fromAccountId} value={form.employee} amount={Number(form.amount) || 0} onChange={(employee) => setForm((f: any) => ({ ...f, employee }))} />}
          </>}
        </div>
        {!form.fromAdvance && allocatedUsd > 0 && !sameCurrency && (
          <div className="mt-3">
            <TextField select size="small" label="الفرق بين المدفوع والموزَّع" value={form.differenceTo} onChange={(e) => setForm({ ...form, differenceTo: e.target.value })} style={{ minWidth: 320 }}
              helperText={difference !== null ? <>المدفوع <Money value={paidUsd} /> والموزَّع <Money value={allocatedUsd} />: الفرق <Money value={difference} /></> : 'يُحسب الفرق بسعر الدفعة (أو سعر يومها إن تُرك فارغاً)'}>
              <MenuItem value="cost">على تكلفة الفواتير: التكلفة = ما دُفع فعلاً</MenuItem>
              <MenuItem value="advance">الزائد دفعة مقدمة للمورد، والناقص فرق صرف</MenuItem>
            </TextField>
          </div>
        )}
        {advance > 0 && <FormControlLabel className="mt-2" control={<Checkbox checked={form.fromAdvance} onChange={(e) => {
          setForm({ ...form, fromAdvance: e.target.checked, advancePaymentId: advanceSources.length === 1 ? advanceSources[0]._id : '' });
          setAllocations({});
        }} />} label={<span>استخدام الدفعة المقدمة لدى المورد
          {advanceCurrencyTotals.length ? advanceCurrencyTotals.map(group => <span key={group.currency} className="d-block">
            <Amount value={group.amount} currency={group.currency} /> {currencyName(group.currency)} — ما يعادل <Money value={group.usd} />
          </span>) : <> (<Money value={advance} />)</>}
          {advanceCurrencyTotals.length > 0 && advanceCurrencyTotals.reduce((sum, group) => sum + group.usd, 0) !== advance
            && <span className="d-block">إجمالي الرصيد الدفتري: <Money value={advance} /></span>}
        </span>} />}
        {form.fromAdvance && advanceSources.length > 0 && <TextField select fullWidth className="mt-2" label="الدفعة السابقة" value={form.advancePaymentId}
          onChange={e => { setForm({ ...form, advancePaymentId: e.target.value }); setAllocations({}); }}
          helperText="المعادل بالدولار هو القيمة الدفترية المسجلة، وليس سعر اليوم. استخدام الدفعة لا يسحب أموالًا جديدة.">
          <MenuItem value="">الرصيد المجمع بالدولار</MenuItem>
          {advanceSources.map(source => <MenuItem key={source._id} value={source._id}><span>
            <Ltr>{source.number}</Ltr> · {source.day}
            <span className="d-block"><Amount value={source.remainingAmount} currency={source.currency} /> {currencyName(source.currency)} — ما يعادل <Money value={source.remainingUsd} /></span>
          </span></MenuItem>)}
        </TextField>}
        {sameCurrency && <Alert severity="info" className="mt-2">السداد بنفس العملة يغلق المبلغ المستحق. فرق الصرف لا يغيّر تكلفة الفاتورة ولا يُترك كرصيد للمورد.</Alert>}
      </Panel>

      <Panel flush title="الفواتير المفتوحة" subtitle="يُكتب السداد بعملة الفاتورة إذا كانت نفس عملة الدفع؛ وعند اختلاف العملتين يُوزّع بالدولار. اضغط «الكل» لتسديد المتبقي.">
        <DataTable
          rows={openBills}
          rowKey={(row: any) => row._id}
          empty={{ title: vendorId ? 'لا توجد فواتير مفتوحة' : 'اختر المورد أولاً', hint: vendorId ? 'الدفعة ستُسجَّل كدفعة مقدمة لدى المورد.' : undefined }}
          columns={[
            { key: 'number', header: 'الفاتورة', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.vendorRef && <Sub>رقم المورد <Ltr>{row.vendorRef}</Ltr></Sub>}</> },
            { key: 'day', header: 'التاريخ', hideOnMobile: true, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'total', header: 'الإجمالي', numeric: true, hideOnMobile: true, render: (row: any) => <Amount value={row.total} currency={row.currency} /> },
            { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => nativeRow(row) ? <Amount value={nativeAmount(row, row.open)} currency={row.currency} /> : <Money value={row.open} strong /> },
            {
              key: 'pay', header: 'يُسدَّد الآن', align: 'end', width: 220, render: (row: any) => (
                <span className="d-inline-flex gap-1">
                  <TextField type="number" inputProps={{ 'aria-label': `سداد ${row.number}`, min: 0 }} helperText={nativeRow(row) ? row.currency : 'USD'}
                    value={allocationText(row)}
                    onChange={(e) => setAllocationAmount(row, e.target.value)} style={{ width: 120 }} />
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
          <Button variant="contained" disabled={isSaving || !vendorId || (form.fromAdvance ? !allocatedUsd : !(form.fromAccountId && Number(form.amount) > 0))
            || (!form.fromAdvance && !!from?.requires?.includes('employee') && (!form.employee || custodyExceeded(form.employee, Number(form.amount))))} onClick={save}>ترحيل الدفعة</Button>
        </div>
      </Panel>
    </>
  );
};
