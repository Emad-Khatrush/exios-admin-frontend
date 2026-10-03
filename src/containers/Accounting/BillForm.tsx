import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, TextField,
} from '@mui/material';
import { Plus, X } from 'lucide-react';
import { acc, errorText, newKey, sys } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { RemotePicker, VENDOR_TYPES, orderLabel, today, tripLabel, userLabel, useVendors } from './shared';
import { Amount, Ltr, Money, PageHeader, Panel } from './ui';
import { TARGET_LABELS } from './Bills';
import { beforeCountText, isBeforeCount, useCountDay } from '../../utils/useCountDay';

const blankLine = (target = 'expense') => ({
  key: newKey(), description: '', amount: '', target, office: '', accountId: '', trip: null as any, order: null as any, packageId: '', packages: [] as any[],
  asset: { name: '', usefulLifeMonths: '', salvageValue: '' }, prepaid: { expenseAccountId: '', months: '', startMonth: '' },
});

const BillForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { accounts, offices, currencies } = useAccountingData();
  const { vendors, reload: reloadVendors } = useVendors();
  const [form, setForm] = useState<any>({
    vendorId: '', vendorRef: '', day: today(), currency: 'USD', rate: '', note: '',
    isCreditNote: !!params.get('creditFor'), originalBillId: params.get('creditFor') || '', payNow: false, paidBeforeCount: false, paidImmediatelyFrom: '', employee: null,
  });
  const [lines, setLines] = useState<any[]>([blankLine(params.get('tripId') ? 'trip' : params.get('orderId') ? 'order' : 'expense')]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newVendor, setNewVendor] = useState<any>(null);
  const idempotencyKey = useRef(newKey());

  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === 'expense' && !a.isGroup && a.isActive), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter((a) => a.type === 'asset' && !a.isGroup && a.isActive && !a.isCash && a.code.startsWith('15')), [accounts]);
  const payAccounts = useMemo(() => accounts.filter((a) => a.isActive && !a.isGroup && (a.isCash || a.requires?.includes('employee'))), [accounts]);
  const payAccount = payAccounts.find((a) => a._id === form.paidImmediatelyFrom);
  // Paid on or before the count day: accounting takes it from the opening balance by itself
  const count = useCountDay();
  const paidBeforeCount = !form.isCreditNote && (form.payNow || form.paidBeforeCount) && isBeforeCount(count, form.day);

  // Prefilled from the "add expense" buttons (?tripId), or a draft / the original bill of a credit note
  useEffect(() => {
    const tripId = params.get('tripId');
    if (tripId) {
      acc.get('trips', { limit: 200 }).then((res: any) => {
        const trip = res.data.results.find((t: any) => t._id === tripId);
        if (trip) setLines([{ ...blankLine('trip'), trip }]);
      }).catch(() => {});
    }
    // From the accounting tab of an order: ?orderId (the document id) and ?orderNumber (to find it)
    const orderId = params.get('orderId');
    if (orderId && params.get('orderNumber')) {
      acc.get('lookup/orders', { search: params.get('orderNumber') }).then((res: any) => {
        const order = res.data.results.find((o: any) => o._id === orderId);
        if (order) setLines([{ ...blankLine('order'), order }]);
      }).catch(() => {});
    }
    const loadId = id || params.get('creditFor');
    if (!loadId) return;
    acc.get(`bills/${loadId}`).then((res: any) => {
      const { bill, trips, orders } = res.data;
      const findById = (list: any[], value: any) => list.find((item) => item._id === value) || null;
      setForm((prev: any) => ({
        ...prev, vendorId: bill.vendorId?._id || bill.vendorId, currency: bill.currency, rate: bill.rate || '',
        ...(id ? { vendorRef: bill.vendorRef || '', day: bill.day, note: bill.note || '', isCreditNote: bill.isCreditNote, originalBillId: bill.originalBillId || '' } : { isCreditNote: true }),
      }));
      const loaded = bill.lines.map((line: any) => ({
        ...blankLine(line.target), description: line.description, amount: id ? String(line.amount) : '', office: line.office || '',
        accountId: line.accountId || '', costCategory: line.costCategory || '', trip: findById(trips, line.tripId), order: findById(orders, line.orderId), packageId: line.packageId || '',
        asset: { name: line.asset?.name || '', usefulLifeMonths: line.asset?.usefulLifeMonths || '', salvageValue: line.asset?.salvageValue || '' },
        prepaid: { expenseAccountId: line.prepaid?.expenseAccountId || '', months: line.prepaid?.months || '', startMonth: line.prepaid?.startMonth || '' },
      }));
      setLines(loaded);
      loaded.forEach((line: any, index: number) => {
        if (line.target === 'customs') loadPackages(line.key, bill.lines[index].orderId, line.packageId);
      });
    }).catch((err: any) => setError(errorText(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = (key: string, change: any) => setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...change } : line)));
  // A customs line names the package cleared: the order's packages, the only one picked by itself
  const loadPackages = (key: string, orderId?: string, keep = '') => {
    if (!orderId) return update(key, { packages: [], packageId: '' });
    sys.get(`acc/orders/${orderId}/packages-state`)
      .then((res: any) => {
        const packages = res.data.results || [];
        update(key, { packages, packageId: keep || (packages.length === 1 ? packages[0]._id : '') });
      })
      .catch(() => update(key, { packages: [] }));
  };
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const rateValue = Number(form.rate) || (form.currency === 'USD' ? 1 : 0);

  const body = () => ({
    vendorId: form.vendorId, vendorRef: form.vendorRef || undefined, day: form.day, currency: form.currency,
    rate: Number(form.rate) || undefined, note: form.note || undefined, idempotencyKey: idempotencyKey.current,
    isCreditNote: form.isCreditNote || undefined, originalBillId: form.isCreditNote ? form.originalBillId : undefined,
    paidImmediatelyFrom: form.payNow && !form.paidBeforeCount && !form.isCreditNote ? form.paidImmediatelyFrom : undefined,
    paidBeforeCount: form.paidBeforeCount && !form.isCreditNote ? true : undefined,
    employeeId: form.payNow && payAccount?.requires?.includes('employee') ? form.employee?._id : undefined,
    lines: lines.map((line) => ({
      description: line.description, amount: Number(line.amount), target: line.target, office: line.office || undefined,
      tripId: line.target === 'trip' ? line.trip?._id : undefined,
      costCategory: line.target === 'trip' ? line.costCategory || undefined : undefined,
      orderId: ['order', 'customs'].includes(line.target) ? line.order?._id : undefined,
      packageId: line.target === 'customs' ? line.packageId || undefined : undefined,
      accountId: ['expense', 'asset'].includes(line.target) ? line.accountId : undefined,
      asset: line.target === 'asset' ? { name: line.asset.name, usefulLifeMonths: Number(line.asset.usefulLifeMonths), salvageValue: Number(line.asset.salvageValue) || 0 } : undefined,
      prepaid: line.target === 'prepaid' ? { expenseAccountId: line.prepaid.expenseAccountId, months: Number(line.prepaid.months), startMonth: line.prepaid.startMonth || undefined } : undefined,
    })),
  });

  const save = async (asDraft: boolean) => {
    try {
      setIsSaving(true);
      setError('');
      let saved;
      if (id) {
        await acc.patch(`bills/${id}`, body());
        saved = asDraft ? { _id: id } : (await acc.post(`bills/${id}/post`)).data;
      } else {
        saved = (await acc.post('bills', { ...body(), asDraft })).data;
      }
      navigate(`/accounting/bills/${saved._id}`);
    } catch (err) {
      setError(errorText(err));
    }
    setIsSaving(false);
  };

  const addVendor = async () => {
    try {
      const res = await acc.post('vendors', newVendor);
      await reloadVendors();
      setForm({ ...form, vendorId: res.data._id, currency: newVendor.defaultCurrency });
      setNewVendor(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const officeSelect = (line: any) => (
    <TextField select label="المكتب" value={line.office} onChange={(e) => update(line.key, { office: e.target.value })} style={{ minWidth: 130 }}>
      {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
    </TextField>
  );

  return (
    <>
      <PageHeader
        title={form.isCreditNote ? 'إشعار دائن (مرتجع من المورد)' : id ? 'تعديل مسودة فاتورة' : 'فاتورة مورد جديدة'}
        subtitle="كل سطر يُحمَّل على رحلة أو طلب شراء أو مصروف أو أصل ثابت أو مصروف مقدم. تكاليف الرحلات والطلبات تبقى «قيد التنفيذ» حتى يُعترف بإيرادها."
      />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}

      <Panel title="بيانات الفاتورة">
        <div className="acc-form-grid">
          <div className="d-flex gap-1 align-items-start" style={{ gridColumn: 'span 2' }}>
            <Autocomplete size="small" style={{ flex: 1 }} options={vendors} disabled={form.isCreditNote && !id}
              value={vendors.find((v) => v._id === form.vendorId) || null}
              getOptionLabel={(v: any) => `${v.name} · ${VENDOR_TYPES[v.type] || v.type}`} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, v: any) => setForm({ ...form, vendorId: v?._id || '', currency: v?.defaultCurrency || form.currency })}
              renderInput={(p) => <TextField {...p} label="المورد" />} />
            {!form.isCreditNote && <Button onClick={() => setNewVendor({ name: '', type: 'supplier', defaultCurrency: 'USD' })}>جديد</Button>}
          </div>
          <TextField label="رقم فاتورة المورد" value={form.vendorRef} onChange={(e) => setForm({ ...form, vendorRef: e.target.value })} />
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          <TextField select label="العملة" value={form.currency} disabled={form.isCreditNote && !id} onChange={(e) => setForm({ ...form, currency: e.target.value, paidImmediatelyFrom: '' })}>
            {currencies.filter((c) => c.isActive).map((c) => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}
          </TextField>
          {form.currency !== 'USD' && (
            <TextField type="number" label={`السعر (${form.currency} لكل دولار)`} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} helperText="فارغ = سعر تاريخ العملية" />
          )}
        </div>
      </Panel>

      <Panel title="السطور" actions={<span className="acc-muted">الإجمالي <Amount value={total} currency={form.currency} /></span>}>
        <div className="acc-lines">
          {lines.map((line) => (
            <div key={line.key} className="acc-line">
              <div className="d-flex gap-2 flex-wrap align-items-start">
                <TextField select label="يُحمَّل على" value={line.target} onChange={(e) => update(line.key, { target: e.target.value })} style={{ width: 170 }} disabled={form.isCreditNote}>
                  {Object.entries(TARGET_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField label="الوصف" value={line.description} onChange={(e) => update(line.key, { description: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
                <TextField type="number" label={`المبلغ (${form.currency})`} value={line.amount} onChange={(e) => update(line.key, { amount: e.target.value })} style={{ width: 160 }}
                  helperText={form.currency !== 'USD' && rateValue && Number(line.amount) ? <>≈ <Money value={Math.round((Number(line.amount) / rateValue) * 100)} /></> : undefined} />
                <IconButton size="small" aria-label="حذف السطر" disabled={lines.length <= 1} onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}><X size={16} /></IconButton>
              </div>
              <div className="d-flex gap-2 flex-wrap mt-2">
                {line.target === 'trip' && (
                  <div style={{ minWidth: 320, flex: 1 }}>
                    <RemotePicker endpoint="trips" minLength={0} label="الرحلة" value={line.trip} getLabel={tripLabel} onChange={(trip) => update(line.key, { trip })} disabled={form.isCreditNote} />
                  </div>
                )}
                {line.target === 'trip' && (
                  <TextField select size="small" label="نوع التكلفة" value={line.costCategory || ''} onChange={(e) => update(line.key, { costCategory: e.target.value })} style={{ minWidth: 150 }}>
                    <MenuItem value="">غير مصنف</MenuItem>
                    {[['shipping', 'شحن'], ['customs', 'جمارك'], ['clearance', 'تخليص'], ['transport', 'نقل'], ['other', 'أخرى']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </TextField>
                )}
                {line.target === 'order' && (
                  <div style={{ minWidth: 320, flex: 1 }}>
                    <RemotePicker endpoint="lookup/orders" label="رقم الطلب" value={line.order} getLabel={orderLabel} onChange={(order) => update(line.key, { order })} disabled={form.isCreditNote} />
                  </div>
                )}
                {line.target === 'customs' && (
                  <>
                    <div style={{ minWidth: 320, flex: 1 }}>
                      <RemotePicker endpoint="lookup/orders" label="رقم الطلب" value={line.order} getLabel={orderLabel} onChange={(order) => { update(line.key, { order }); loadPackages(line.key, order?._id); }} disabled={form.isCreditNote} />
                    </div>
                    <TextField select size="small" label="الطرد المُخلَّص" value={line.packageId || ''} onChange={(e) => update(line.key, { packageId: e.target.value })} style={{ minWidth: 220 }} disabled={!line.order || form.isCreditNote}
                      helperText="التكلفة تنتظر حتى يُسلَّم الطرد ويُدفع ما بِيع به التخليص">
                      {(line.packages || []).map((p: any) => <MenuItem key={p._id} value={p._id}><Ltr>{p.tracking || p._id}</Ltr></MenuItem>)}
                    </TextField>
                  </>
                )}
                {line.target === 'expense' && (
                  <>
                    <Autocomplete size="small" style={{ minWidth: 300, flex: 1 }} options={expenseAccounts} disabled={form.isCreditNote}
                      value={expenseAccounts.find((a) => a._id === line.accountId) || null}
                      getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                      onChange={(_, a: any) => update(line.key, { accountId: a?._id || '' })}
                      renderInput={(p) => <TextField {...p} label="حساب المصروف" />} />
                    {officeSelect(line)}
                  </>
                )}
                {line.target === 'asset' && (
                  <>
                    <TextField select label="حساب الأصل" value={line.accountId} onChange={(e) => update(line.key, { accountId: e.target.value })} style={{ minWidth: 220 }}>
                      {assetAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
                    </TextField>
                    <TextField label="اسم الأصل" value={line.asset.name} onChange={(e) => update(line.key, { asset: { ...line.asset, name: e.target.value } })} />
                    <TextField type="number" label="العمر (بالأشهر)" value={line.asset.usefulLifeMonths} onChange={(e) => update(line.key, { asset: { ...line.asset, usefulLifeMonths: e.target.value } })} style={{ width: 150 }} />
                    <TextField type="number" label="قيمة الخردة ($)" value={line.asset.salvageValue} onChange={(e) => update(line.key, { asset: { ...line.asset, salvageValue: e.target.value } })} style={{ width: 150 }} />
                    {officeSelect(line)}
                  </>
                )}
                {line.target === 'prepaid' && (
                  <>
                    <Autocomplete size="small" style={{ minWidth: 280 }} options={expenseAccounts}
                      value={expenseAccounts.find((a) => a._id === line.prepaid.expenseAccountId) || null}
                      getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                      onChange={(_, a: any) => update(line.key, { prepaid: { ...line.prepaid, expenseAccountId: a?._id || '' } })}
                      renderInput={(p) => <TextField {...p} label="يُوزَّع على مصروف" />} />
                    <TextField type="number" label="عدد الأشهر" value={line.prepaid.months} onChange={(e) => update(line.key, { prepaid: { ...line.prepaid, months: e.target.value } })} style={{ width: 120 }} />
                    <TextField type="month" label="أول شهر" InputLabelProps={{ shrink: true }} value={line.prepaid.startMonth} onChange={(e) => update(line.key, { prepaid: { ...line.prepaid, startMonth: e.target.value } })} />
                    {officeSelect(line)}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {!form.isCreditNote && <Button className="mt-2" startIcon={<Plus size={16} />} onClick={() => setLines((prev) => [...prev, blankLine(prev[prev.length - 1]?.target)])}>إضافة سطر</Button>}
      </Panel>

      <Panel>
        {!form.isCreditNote && (
          <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
            <FormControlLabel control={<Checkbox checked={form.payNow} onChange={(e) => setForm({ ...form, payNow: e.target.checked, paidBeforeCount: false })} />} label="دُفعت الآن من" />
            {form.payNow && (
              <>
                <TextField select value={form.paidImmediatelyFrom} onChange={(e) => setForm({ ...form, paidImmediatelyFrom: e.target.value })} style={{ minWidth: 280 }} label="حساب الدفع">
                  {payAccounts.filter((a) => !a.currency || a.currency === form.currency).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
                </TextField>
                {payAccount?.requires?.includes('employee') && (
                  <div style={{ minWidth: 240 }}><RemotePicker endpoint="lookup/users" label="الموظف صاحب العهدة" value={form.employee} getLabel={userLabel} onChange={(employee) => setForm({ ...form, employee })} /></div>
                )}
              </>
            )}
          </div>
        )}
        {paidBeforeCount && count && <Alert severity="info" className="mb-3">{beforeCountText(count)}</Alert>}
        <TextField label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} fullWidth />
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button onClick={() => navigate(-1)}>رجوع</Button>
          {!form.isCreditNote && <Button variant="outlined" disabled={isSaving} onClick={() => save(true)}>حفظ كمسودة</Button>}
          <Button variant="contained" disabled={isSaving || !form.vendorId} onClick={() => save(false)}>{isSaving ? 'جارٍ الترحيل…' : 'ترحيل'}</Button>
        </div>
      </Panel>

      <Dialog open={!!newVendor} onClose={() => setNewVendor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>مورد جديد</DialogTitle>
        {newVendor && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الاسم" value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} />
            <TextField select fullWidth className="mt-3" label="النوع" value={newVendor.type} onChange={(e) => setNewVendor({ ...newVendor, type: e.target.value })}>
              {Object.entries(VENDOR_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField select fullWidth className="mt-3" label="العملة المعتادة" value={newVendor.defaultCurrency} onChange={(e) => setNewVendor({ ...newVendor, defaultCurrency: e.target.value })}>
              {currencies.filter((c) => c.isActive).map((c) => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}
            </TextField>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setNewVendor(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!newVendor?.name} onClick={addVendor}>إضافة</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BillForm;
