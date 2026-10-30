import { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, TextField } from '@mui/material';
import { acc, errorText, newKey } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, RemotePicker, today, userLabel } from './shared';
import { Amount, Badge, DataTable, Ltr, Money, Open, PageHeader, Panel, Sub } from './ui';

const instructions: Record<string, string> = {
  mistaken_transfer: 'سجل الحوالة الخاطئة مرة واحدة، ثم سجل المبلغ الذي رجع. الفرق غير المسترد يمكن شطبه مع كتابة السبب.',
  transfer_in_transit: 'سجل المبلغ الخارج الآن. عند وصوله، اختر الحساب المستلم وسجل المبلغ الواصل.',
  refundable_deposit: 'التأمين المسترد يبقى مستحقًا للشركة. سجل رجوعه هنا عند استلامه.',
  salary_accrual: 'اكتب الراتب المستحق للموظف. الصرف اللاحق يسدد هذا المستحق ولا يسجل راتبًا ثانيًا.',
  commission_accrual: 'اكتب العمولة المستحقة للموظف. يمكنك صرفها على دفعات لاحقًا.',
  receivables_allowance: 'تقدير خسارة التحصيل يخفض صافي الذمم في التقارير، دون تغيير دين العميل أو محفظته.',
  inventory_allowance: 'سجل انخفاض قيمة مخزون الشركة، ويمكن تخفيض المخصص لاحقًا.',
  company_stock: 'لبضائع اشترتها الشركة لحسابها. لا تدخل بضائع العملاء أو الطرود التي سجلت تكلفة شحنها هنا.',
  loan_current_portion: 'اكتب قيمة الأقساط المستحقة خلال سنة. تسديدها هنا يخفض القرض ولا يسجل مصروفًا جديدًا.',
  fx_revaluation: 'اكتب فرق القيمة بالدولار فقط بعد حسابه. عدد وحدات العملة في الحساب يبقى كما هو.',
};
const blank = (kind: string) => ({ kind, day: today(), month: today().slice(0, 7), currency: 'USD', amount: '', advanceDeduction: '', quantity: '', office: '', fromAccountId: '', description: '', partyName: '', rate: '', transactionReference: '', employee: null as any, partner: null as any, confirmCompanyOwned: false, gain: true });

const FinancialOperations = () => {
  const { accounts, offices, currencies } = useAccountingData();
  const [catalog, setCatalog] = useState<any>({ kinds: [], employees: [] });
  const [data, setData] = useState<any>({ results: [], total: 0 });
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState(new URLSearchParams(window.location.search).get('kind') || '');
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null); const [action, setAction] = useState<any>(null);
  const [details, setDetails] = useState<any>(null); const [cancel, setCancel] = useState<any>(null);
  const key = useRef(newKey()); const version = useRef(0);
  const load = async () => {
    const request = ++version.current; setBusy(true);
    try { const response = await acc.get('financial-operations', { page, kind: kind || undefined }); if (request === version.current) setData(response.data); }
    catch (err) { if (request === version.current) setError(errorText(err)); }
    finally { if (request === version.current) setBusy(false); }
  };
  useEffect(() => { acc.get('financial-operations/catalog').then((r: any) => setCatalog(r.data)).catch((err: any) => setError(errorText(err))); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, kind]);
  const type = catalog.kinds.find((t: any) => t.value === form?.kind);
  const moneyAccounts = accounts.filter(a => a.isActive && !a.isGroup && a.isCash);
  const factor = (currency: string) => 10 ** (currencies.find(c => c.code === currency)?.decimals ?? 2);
  const selected = data.results.find((r: any) => r._id === details) || null;
  const save = async () => {
    setSaving(true); setError('');
    try {
      await acc.post('financial-operations', { ...form, amount: Number(form.amount), quantity: Number(form.quantity),
        employeeId: form.employee?._id, partnerId: form.partner?._id, rate: Number(form.rate) || undefined, idempotencyKey: key.current });
      setForm(null); setMessage('تم تسجيل العملية.'); await load();
    } catch (err) { setError(errorText(err)); } finally { setSaving(false); }
  };
  const settle = async () => {
    setSaving(true); setError('');
    try {
      await acc.post(`financial-operations/${action.doc._id}/settle`, { ...action, doc: undefined, amount: Number(action.amount),
        quantity: Number(action.quantity), receivedAmount: Number(action.receivedAmount), rate: Number(action.rate) || undefined, idempotencyKey: key.current });
      setAction(null); setMessage('تم تسجيل التسوية.'); await load();
    } catch (err) { setError(errorText(err)); } finally { setSaving(false); }
  };
  const create = () => { key.current = newKey(); setError(''); setForm(blank(catalog.kinds.some((t: any) => t.value === kind) ? kind : catalog.kinds[0]?.value || '')); };
  const openSettlement = (doc: any) => { key.current = newKey(); setError(''); setAction({ doc, day: today(), mode: doc.kind.includes('allowance') ? 'release' : 'settle', amount: String(doc.openMinor / factor(doc.currency)), quantity: String(doc.openMinor / 1000), accountId: '', receivedAmount: '', rate: '', reason: '', transactionReference: '' }); };
  return <>
    <PageHeader title="التسويات والمستحقات" subtitle="الحوالات المعلقة والتأمينات ومستحقات الموظفين ومخزون الشركة، مع متابعة المتبقي لكل عملية."
      actions={<Button variant="contained" disabled={!catalog.kinds.length} onClick={create}>عملية جديدة</Button>} />
    {error && !form && !action && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success" className="mb-3" onClose={() => setMessage('')}>{message}</Alert>}
    <Panel flush>
      <div className="p-3"><TextField select label="نوع العملية" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} style={{ minWidth: 300 }}>
        <MenuItem value="">كل العمليات</MenuItem>{catalog.kinds.map((t: any) => <MenuItem key={t.value} value={t.value}>{t.name}</MenuItem>)}
      </TextField><Button onClick={load}>تحديث</Button></div>
      <DataTable loading={busy} rows={data.results} rowKey={(r: any) => r._id} onRowClick={(r: any) => setDetails(r._id)} columns={[
        { key: 'number', header: 'العملية', render: (r: any) => <><Ltr>{r.number}</Ltr><Sub>{r.name}</Sub></> },
        { key: 'day', header: 'التاريخ', render: (r: any) => <Ltr>{r.day}</Ltr> },
        { key: 'description', header: 'البيان', render: (r: any) => <>{r.description}<Sub>{r.partyName}</Sub></> },
        { key: 'usd', header: 'قيمة العملية', numeric: true, render: (r: any) => <Money value={r.usd} /> },
        { key: 'open', header: 'المتبقي', numeric: true, render: (r: any) => r.kind === 'fx_revaluation' ? '—' : r.kind === 'company_stock' ? <>{r.openMinor / 1000} وحدة<Sub><Money value={r.openUsd} /></Sub></> : <Amount value={r.openMinor / factor(r.currency)} currency={r.currency} /> },
        { key: 'actions', header: '', render: (r: any) => <span onClick={e => e.stopPropagation()}>
          {r.openMinor > 0 && r.kind !== 'fx_revaluation' && catalog.kinds.some((t: any) => t.value === r.kind) && <Button size="small" onClick={() => openSettlement(r)}>{r.kind === 'company_stock' ? 'بيع' : r.kind.includes('allowance') ? 'تخفيض المخصص' : 'تسوية'}</Button>}
          {r.openMinor === 0 && <Badge tone="accent">مسوّاة</Badge>}
          <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingFinancialOperation', id: r._id, title: r.number })}>إلغاء</Button>
        </span> },
      ]} />
      <Pagination className="p-3" count={Math.max(1, Math.ceil(data.total / 50))} page={page} onChange={(_, p) => setPage(p)} />
    </Panel>
    {selected && <Panel title={`تفاصيل ${selected.number}`} actions={<Button onClick={() => setDetails(null)}>إغلاق</Button>}>
      <p>{selected.description} · <Open to={`/accounting/entries/${selected.entryId}`}>قيد العملية</Open>{selected.sourceBillId && <> · <Open to={`/accounting/bills/${selected.sourceBillId}`}>فاتورة المورد</Open></>}</p>
      <DataTable rows={selected.actions} rowKey={(r: any) => r._id} empty={{ title: 'لا تسويات بعد' }} columns={[
        { key: 'number', header: 'التسوية', render: (r: any) => <Open to={`/accounting/entries/${r.entryId}`}><Ltr>{r.number}</Ltr></Open> },
        { key: 'day', header: 'التاريخ', render: (r: any) => <Ltr>{r.day}</Ltr> },
        { key: 'mode', header: 'الإجراء', render: (r: any) => <>{r.mode === 'writeoff' ? 'شطب فرق' : r.mode === 'release' ? 'تخفيض مخصص' : 'تسوية'}<Sub>{r.accountId?.name} · {r.description}</Sub></> },
        { key: 'value', header: 'المبلغ / الكمية', render: (r: any) => selected.kind === 'company_stock' ? <>{r.amountMinor / 1000} وحدة<Sub>ثمن البيع {r.receivedAmount} {r.accountId?.currency}</Sub></> : <Amount value={r.amountMinor / factor(selected.currency)} currency={selected.currency} /> },
        { key: 'actions', header: '', render: (r: any) => r.status === 'canceled' ? <Badge tone="muted">ملغاة</Badge> : <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingFinancialOperationAction', id: r._id, title: r.number })}>إلغاء التسوية</Button> },
      ]} />
    </Panel>}
    <Dialog open={!!form} onClose={saving ? undefined : () => setForm(null)} fullWidth maxWidth="sm">
      <DialogTitle>تسجيل عملية</DialogTitle><DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {form && <><TextField select fullWidth label="نوع العملية" value={form.kind} onChange={e => setForm(blank(e.target.value))} className="mt-2">{catalog.kinds.map((t: any) => <MenuItem key={t.value} value={t.value}>{t.name}</MenuItem>)}</TextField>
          <Alert severity="info" className="my-3">{instructions[form.kind]}</Alert>
          <div className="acc-form-grid">
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} />
            <TextField select label="المكتب" value={form.office} onChange={e => setForm({ ...form, office: e.target.value })}>{offices.filter(o => o.isActive).map(o => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>
            {(type?.monetary || type?.stock || type?.reclass || type?.valuation) && <TextField select label={type?.reclass || type?.valuation ? 'الحساب' : 'دُفع من'} value={form.fromAccountId} onChange={e => { const a = accounts.find(x => x._id === e.target.value); setForm({ ...form, fromAccountId: e.target.value, currency: type?.valuation || type?.reclass ? 'USD' : a?.currency || 'USD' }); }}>
              {(type?.reclass ? accounts.filter(a => a.isActive && !a.isGroup && a.type === 'liability' && (!a.currency || a.currency === 'USD')) : type?.valuation ? moneyAccounts.filter(a => a.currency && a.currency !== 'USD') : moneyAccounts).map(a => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>}
            {type?.employee && <><Autocomplete options={catalog.employees} value={form.employee} getOptionLabel={(e: any) => `${e.firstName} ${e.lastName || ''}`} onChange={(_, employee) => setForm({ ...form, employee, currency: employee?.salaryCurrency || 'USD' })} renderInput={p => <TextField {...p} label="الموظف" />} />
              <TextField type="month" label="الشهر" InputLabelProps={{ shrink: true }} value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
              <TextField select label="عملة الاستحقاق" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{currencies.filter(c => c.isActive).map(c => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}</TextField></>}
            {form.kind === 'receivables_allowance' && <RemotePicker endpoint="lookup/users" label="العميل" value={form.partner} getLabel={userLabel} onChange={partner => setForm({ ...form, partner })} />}
            <TextField type="number" label={`المبلغ (${form.currency})`} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            {form.kind === 'salary_accrual' && <>
              <TextField type="number" label={`خصم من سلفة الموظف (${form.currency})`} value={form.advanceDeduction} onChange={e => setForm({ ...form, advanceDeduction: e.target.value })} />
              <TextField label={`المستحق للصرف بعد خصم السلفة (${form.currency})`} value={Number(form.amount || 0) - Number(form.advanceDeduction || 0)} InputProps={{ readOnly: true }} />
            </>}
            {form.currency !== 'USD' && <TextField type="number" label="سعر الصرف إن وُجد" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />}
            {type?.stock && <TextField type="number" label="كمية البضائع" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />}
            {type?.valuation && <TextField select label="نتيجة إعادة التقييم" value={form.gain ? 'gain' : 'loss'} onChange={e => setForm({ ...form, gain: e.target.value === 'gain' })}><MenuItem value="gain">ربح</MenuItem><MenuItem value="loss">خسارة</MenuItem></TextField>}
          </div>
          <TextField fullWidth className="mt-3" label="البيان" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <TextField fullWidth className="mt-3" label="اسم الطرف / المرجع (اختياري)" value={form.partyName} onChange={e => setForm({ ...form, partyName: e.target.value })} />
          {(type?.monetary || type?.stock) && <TextField fullWidth className="mt-3" label="رقم عملية الكشف (اختياري)" value={form.transactionReference} onChange={e => setForm({ ...form, transactionReference: e.target.value })} />}
          {type?.stock && <FormControlLabel control={<Checkbox checked={form.confirmCompanyOwned} onChange={e => setForm({ ...form, confirmCompanyOwned: e.target.checked })} />} label="هذه بضائع تملكها الشركة، وتكلفة شرائها لم تسجل سابقًا" />}
        </>}
      </DialogContent><DialogActions><Button disabled={saving} onClick={() => setForm(null)}>إلغاء</Button><Button variant="contained" disabled={saving || !form?.office || !form?.description || !(Number(form?.amount) > 0) || (type?.employee && !form?.employee) || (type?.stock && (!form?.confirmCompanyOwned || !(Number(form?.quantity) > 0)))} onClick={save}>تسجيل</Button></DialogActions>
    </Dialog>
    <Dialog open={!!action} onClose={saving ? undefined : () => setAction(null)} fullWidth maxWidth="sm">
      <DialogTitle>تسوية {action?.doc.number}</DialogTitle><DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {action && <div className="acc-form-grid">
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={action.day} onChange={e => setAction({ ...action, day: e.target.value })} />
          {['mistaken_transfer', 'refundable_deposit'].includes(action.doc.kind) && <TextField select label="الإجراء" value={action.mode} onChange={e => setAction({ ...action, mode: e.target.value })}><MenuItem value="settle">استلام المبلغ المسترد</MenuItem><MenuItem value="writeoff">شطب مبلغ لن يُسترد</MenuItem></TextField>}
          <TextField type="number" label={action.doc.kind === 'company_stock' ? 'الكمية المباعة' : `المبلغ المسوّى (${action.doc.currency})`} value={action.doc.kind === 'company_stock' ? action.quantity : action.amount} onChange={e => setAction({ ...action, [action.doc.kind === 'company_stock' ? 'quantity' : 'amount']: e.target.value })} />
          {action.mode === 'settle' && <>
            <TextField select label={['salary_accrual', 'commission_accrual', 'loan_current_portion'].includes(action.doc.kind) ? 'دُفع من' : 'دخل المال في'} value={action.accountId} onChange={e => setAction({ ...action, accountId: e.target.value })}>
              {moneyAccounts.map(a => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            {(action.doc.kind === 'company_stock' || (action.accountId && accounts.find(a => a._id === action.accountId)?.currency !== action.doc.currency)) && <TextField type="number" label="المبلغ الواصل بعملة الحساب المستلم" value={action.receivedAmount} onChange={e => setAction({ ...action, receivedAmount: e.target.value })} />}
            <TextField type="number" label="سعر الصرف عند الحاجة" value={action.rate} onChange={e => setAction({ ...action, rate: e.target.value })} />
            <TextField label="رقم عملية الكشف (اختياري)" value={action.transactionReference} onChange={e => setAction({ ...action, transactionReference: e.target.value })} />
          </>}
          {action.mode === 'writeoff' && <TextField label="سبب الشطب" fullWidth multiline value={action.reason} onChange={e => setAction({ ...action, reason: e.target.value })} />}
        </div>}
      </DialogContent><DialogActions><Button disabled={saving} onClick={() => setAction(null)}>إلغاء</Button><Button variant="contained" disabled={saving} onClick={settle}>تسجيل التسوية</Button></DialogActions>
    </Dialog>
    {cancel && <CancelDialog open model={cancel.model} id={cancel.id} title={cancel.title} onClose={() => setCancel(null)} onDone={load} />}
  </>;
};
export default FinancialOperations;
