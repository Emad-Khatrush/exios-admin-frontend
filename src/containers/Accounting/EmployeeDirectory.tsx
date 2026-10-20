import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { Amount, DataTable, FilterBar, Ltr, Open, Panel, Sub } from './ui';
import { today } from './shared';

export default function EmployeeDirectory({ employees, onReload, onPay }: { employees: any[], onReload: () => Promise<void>, onPay: (row: any, paymentKind?: 'salary' | 'commission') => void }) {
  const { currencies, offices } = useAccountingData();
  const [form, setForm] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [adjustment, setAdjustment] = useState<any>(null);
  const [archive, setArchive] = useState<any>(null);
  const [closure, setClosure] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const name = (e: any) => `${e.firstName || ''} ${e.lastName || ''}`.trim();
  const openDetail = async (row: any) => {
    setError(''); setDetail({ employee: row, loading: true });
    try { const r = await acc.get(`employees/${row._id}`); setDetail(r.data); }
    catch (e) { setDetail(null); setError(errorText(e)); }
  };
  const run = async (fn: () => Promise<any>, done: () => void) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); done(); await onReload(); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const edit = (row?: any) => { setError(''); setForm(row ? { ...row } : { firstName: '', lastName: '', phone: '', office: '', baseSalary: '', salaryCurrency: 'USD' }); };
  const rows = employees.filter(e => (showArchived || e.isActive !== false) && (!search || `${name(e)} ${e.phone || ''}`.toLowerCase().includes(search.toLowerCase())));
  const totals = (kind: string) => {
    const sums: Record<string, number> = {};
    for (const r of detail?.adjustments || []) if (!r.isCanceled && r.kind === kind) sums[r.currency] = (sums[r.currency] || 0) + r.amount;
    return Object.entries(sums).map(([currency, amount]) => <span key={currency} className="me-2"><Amount value={amount} currency={currency} /></span>);
  };
  return <>
    {error && <Alert severity="error" onClose={() => setError('')} className="mb-2">{error}</Alert>}
    <Panel flush title="قائمة الموظفين" subtitle="أضف موظفًا أو مستفيد راتب دون إنشاء حساب دخول." actions={<Button variant="contained" onClick={() => edit()}>إضافة موظف</Button>}>
      <div className="px-3"><FilterBar>
        <TextField size="small" placeholder="بحث بالاسم أو الهاتف" value={search} onChange={e => setSearch(e.target.value)} />
        <TextField size="small" select label="القائمة" value={showArchived ? 'all' : 'active'} onChange={e => setShowArchived(e.target.value === 'all')}>
          <MenuItem value="active">الموظفون الحاليون</MenuItem><MenuItem value="all">الكل مع المؤرشفين</MenuItem>
        </TextField>
      </FilterBar></div>
      <DataTable rows={rows} rowKey={(e: any) => e._id} empty={{ title: 'لا يوجد موظفون في القائمة' }} columns={[
        { key: 'name', header: 'الموظف', render: (e: any) => <><Button onClick={() => openDetail(e)}>{name(e)}</Button><Sub>{e.hasLogin ? 'مرتبط بحساب منظومة' : 'دون حساب دخول'}{e.isActive === false ? ' · مؤرشف' : ''}</Sub></> },
        { key: 'salary', header: 'الراتب الأساسي', render: (e: any) => <Amount value={e.baseSalary || 0} currency={e.salaryCurrency || 'USD'} /> },
        { key: 'phone', header: 'الهاتف', render: (e: any) => e.phone || '—' },
        { key: 'actions', header: '', render: (e: any) => <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => openDetail(e)}>البيان والتفاصيل</Button>
          <Button size="small" onClick={() => edit(e)}>تعديل</Button>
          {e.isActive !== false && <><Button size="small" onClick={() => onPay(e)}>صرف راتب أساسي</Button><Button size="small" onClick={() => onPay(e, 'commission')}>صرف عمولة</Button></>}
          {e.isActive === false ? <Button size="small" disabled={busy} onClick={() => run(() => acc.post(`employees/${e._id}/restore`), () => {})}>إعادة للقائمة</Button>
            : <Button size="small" color="error" onClick={() => setArchive(e)}>إزالة من القائمة</Button>}
        </Stack> },
      ]} />
    </Panel>
    <Dialog open={!!form} onClose={() => !busy && setForm(null)} maxWidth="sm" fullWidth>
      <DialogTitle>{form?._id ? 'تعديل الموظف والراتب الأساسي' : 'إضافة موظف جديد'}</DialogTitle>
      <DialogContent>{form && <Stack sx={{ gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="الاسم" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
        <TextField label="اللقب / اسم العائلة" value={form.lastName || ''} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        <TextField label="الهاتف" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <TextField select label="المكتب" value={form.office || ''} onChange={e => setForm({ ...form, office: e.target.value })}><MenuItem value="">غير محدد</MenuItem>{offices.filter(o => o.isActive).map(o => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>
        <TextField select label="عملة الراتب" value={form.salaryCurrency || 'USD'} onChange={e => setForm({ ...form, salaryCurrency: e.target.value })}>{currencies.filter(c => c.isActive).map(c => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}</TextField>
        <TextField type="number" label="الراتب الأساسي" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} inputProps={{ min: 0 }} />
      </Stack>}</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setForm(null)}>إلغاء</Button><Button variant="contained" disabled={busy || !form?.firstName?.trim()} onClick={() => run(() => form._id ? acc.put(`employees/${form._id}`, form) : acc.post('employees', form), () => setForm(null))}>حفظ الموظف</Button></DialogActions>
    </Dialog>
    <Dialog open={!!archive} onClose={() => !busy && setArchive(null)} maxWidth="xs" fullWidth><DialogTitle>إزالة {archive && name(archive)} من القائمة؟</DialogTitle><DialogContent>سيُؤرشف الموظف مع حفظ الرواتب والعمولات والخصومات، ويمكن إعادته للقائمة لاحقًا.{error && <Alert severity="error">{error}</Alert>}</DialogContent><DialogActions><Button onClick={() => setArchive(null)}>رجوع</Button><Button color="error" disabled={busy} onClick={() => run(() => acc.delete(`employees/${archive._id}`), () => setArchive(null))}>أرشفة الموظف</Button></DialogActions></Dialog>
    <Dialog open={!!detail} onClose={() => !busy && setDetail(null)} maxWidth="lg" fullWidth>
      <DialogTitle>بيان الموظف · {detail && name(detail.employee)}</DialogTitle>
      <DialogContent>{detail?.loading ? <p>جارٍ تحميل البيان…</p> : detail && <>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', mb: 2 }}><div>الراتب الأساسي<br /><Amount value={detail.employee.baseSalary || 0} currency={detail.employee.salaryCurrency} /></div><div>إجمالي العمولات<br />{totals('commission')}</div><div>إجمالي الخصومات<br />{totals('deduction')}</div></Stack>
        <Typography variant="body2" color="text.secondary">الإجماليات تشمل جميع الأشهر، وتعرض كل عملة منفصلة. تُصرف العمولات مستقلة عن الراتب بالدولار أو بالدينار، مع حفظ مبلغ الاستحقاق الأصلي وسعر التحويل. يمكن صرفها جزئيًا وعلى دفعات.</Typography>
        {detail.employee.isActive !== false && <Stack direction="row" sx={{ gap: 1, my: 2 }}>
          {['commission', 'deduction'].map(kind => <Button key={kind} variant="outlined" onClick={() => { setError(''); setAdjustment({ kind, day: today(), month: today().slice(0, 7), currency: detail.employee.salaryCurrency, amount: '', reason: '' }); }}>{kind === 'commission' ? 'إضافة عمولة' : 'إضافة خصم'}</Button>)}
          <Button onClick={() => { onPay(detail.employee); setDetail(null); }}>صرف راتب أساسي</Button>
          <Button onClick={() => { onPay(detail.employee, 'commission'); setDetail(null); }}>صرف عمولة</Button>
        </Stack>}
        <Typography fontWeight={700} sx={{ mt: 2 }}>العمولات والخصومات</Typography>
        <DataTable rows={detail.adjustments || []} rowKey={(r: any) => r._id} empty={{ title: 'لا عمولات أو خصومات' }} columns={[
          { key: 'day', header: 'التاريخ', render: (r: any) => <Ltr>{r.day}</Ltr> },
          { key: 'month', header: 'شهر الاستحقاق', render: (r: any) => <Ltr>{r.month}</Ltr> },
          { key: 'kind', header: 'النوع', render: (r: any) => r.kind === 'commission' ? 'عمولة' : 'خصم' },
          { key: 'amount', header: 'المبلغ الأصلي / عند الصرف', render: (r: any) => {
            const converted = (detail.salaries || []).find((s: any) => s._id === r.salaryId)?.commissionConversions?.find((c: any) => c.adjustmentId === r._id);
            return <><Amount value={r.amount} currency={r.currency} />{converted && converted.currency !== converted.salaryCurrency && <Sub>عند الصرف: <Amount value={converted.salaryAmount} currency={converted.salaryCurrency} /> · السعر: {converted.sourceRate} {converted.currency} / USD، {converted.targetRate} {converted.salaryCurrency} / USD</Sub>}</>;
          } },
          { key: 'reason', header: 'السبب / البيان', render: (r: any) => <>{r.reason}{r.remainderClosure?.reason && <Sub>تسوية المتبقي: {r.remainderClosure.reason}</Sub>}</> },
          { key: 'remaining', header: 'المتبقي', render: (r: any) => r.kind === 'commission' ? <Amount value={r.remainingAmount || 0} currency={r.currency} /> : '—' },
          { key: 'waived', header: 'المتبقي المُلغى', render: (r: any) => r.waivedAmount > 0 ? <Amount value={r.waivedAmount} currency={r.currency} /> : '—' },
          { key: 'status', header: 'الحالة', render: (r: any) => r.isCanceled ? 'ملغاة' : r.salaryId ? 'ضمن راتب مصروف' : r.kind === 'commission' ? (r.remainingAmount <= 0 ? r.waivedAmount > 0 ? 'مقفلة · أُلغي المتبقي' : 'مصروفة بالكامل' : r.paidAmount > 0 ? 'مصروفة جزئيًا' : 'بانتظار صرف العمولة') : 'بانتظار خصم الراتب' },
          { key: 'actions', header: '', render: (r: any) => !r.isCanceled && !r.salaryId && <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {r.kind === 'commission' && r.remainingAmount > 0 && !(r.remainderClosure?.amountMinor > 0) && <Button size="small" disabled={busy} onClick={() => { setError(''); setClosure({ row: r, mode: 'close', reason: 'تسوية نهائية للعمولة وإلغاء المتبقي' }); }}>إقفال المتبقي</Button>}
            {r.remainderClosure?.amountMinor > 0 && <Button size="small" disabled={busy} onClick={() => { setError(''); setClosure({ row: r, mode: 'reopen', reason: 'إلغاء التسوية النهائية وإعادة فتح المتبقي' }); }}>إلغاء الإقفال</Button>}
            {!(r.paidAmount > 0) && !(r.waivedAmount > 0) && <Button color="error" disabled={busy} onClick={() => run(() => acc.delete(`employees/${detail.employee._id}/adjustments/${r._id}`), () => { openDetail(detail.employee); })}>إلغاء الحركة</Button>}
          </Stack> },
        ]} />
        <Typography fontWeight={700} sx={{ mt: 3 }}>سجل صرف الرواتب والعمولات</Typography>
        {!!detail.accruals?.length && <>
          <Typography fontWeight={700} sx={{ mt: 2 }}>الرواتب والعمولات المسجلة كمستحقات</Typography>
          <DataTable rows={detail.accruals} rowKey={(r: any) => r._id} columns={[
            { key: 'number', header: 'المستحق', render: (r: any) => <><Open to={`/accounting/financial-operations?kind=${r.kind}`}><Ltr>{r.number}</Ltr></Open><Sub>{r.kind === 'salary_accrual' ? 'راتب' : 'عمولة'} · {r.month}</Sub></> },
            { key: 'day', header: 'التاريخ', render: (r: any) => <Ltr>{r.day}</Ltr> },
            { key: 'amount', header: 'القيمة', render: (r: any) => <Amount value={r.totalMinor / 10 ** (currencies.find(c => c.code === r.currency)?.decimals ?? 2)} currency={r.currency} /> },
            { key: 'open', header: 'المتبقي للصرف', render: (r: any) => r.status === 'canceled' ? 'ملغى' : <Amount value={r.openMinor / 10 ** (currencies.find(c => c.code === r.currency)?.decimals ?? 2)} currency={r.currency} /> },
            { key: 'payments', header: 'الدفعات', render: (r: any) => r.settlements.map((s: any) => <Sub key={s._id}><Ltr>{s.day}</Ltr> · <Open to={`/accounting/entries/${s.entryId}`}>{s.number}</Open> · {s.accountId?.name}{s.status === 'canceled' && ' · ملغاة'}</Sub>) },
          ]} />
        </>}
        <DataTable rows={detail.salaries || []} rowKey={(r: any) => r._id} empty={{ title: 'لا دفعات رواتب أو عمولات' }} columns={[
          { key: 'day', header: 'تاريخ الصرف', render: (r: any) => <><Ltr>{r.day}</Ltr><Sub>{r.number}</Sub></> },
          { key: 'month', header: 'الشهر', render: (r: any) => <Ltr>{r.month}</Ltr> },
          { key: 'kind', header: 'نوع الصرف', render: (r: any) => <>{r.paymentKind === 'commission' ? 'عمولة' : r.commissionAmount > 0 ? 'راتب وعمولات (سابق)' : 'راتب أساسي'}{r.closeCommissions && <Sub>تسوية نهائية · {r.commissionCloseReason}</Sub>}</> },
          { key: 'base', header: 'الأساسي', render: (r: any) => <Amount value={r.paymentKind === 'commission' ? 0 : r.baseSalary ?? r.grossAmount} currency={r.currency} /> },
          { key: 'commission', header: 'العمولات', render: (r: any) => <><Amount value={r.commissionAmount || 0} currency={r.currency} />{r.paymentKind === 'commission' && r.commissionConversions?.filter((c: any) => c.currency !== c.salaryCurrency).map((c: any) => <Sub key={c.adjustmentId}><Amount value={c.amount} currency={c.currency} /> ← <Amount value={c.salaryAmount} currency={c.salaryCurrency} /> · سعر المصدر {c.sourceRate}، سعر الصرف {c.targetRate}</Sub>)}</> },
          { key: 'deductions', header: 'الخصومات / السلفة', render: (r: any) => <><Amount value={r.salaryDeduction || 0} currency={r.currency} /><Sub>سلفة: <Amount value={r.advanceDeduction || 0} currency={r.currency} /></Sub></> },
          { key: 'net', header: 'الصافي المدفوع', render: (r: any) => <Amount value={r.grossAmount - (r.advanceDeduction || 0)} currency={r.currency} /> },
          { key: 'status', header: 'الحالة', render: (r: any) => r.status === 'canceled' ? 'ملغى' : 'مصروف' },
        ]} />
        {((detail.adjustments || []).length >= detail.limit || (detail.salaries || []).length >= detail.limit) && <Alert severity="info">يُعرض أحدث {detail.limit} سجلًا لكل قائمة.</Alert>}
      </>}</DialogContent><DialogActions><Button onClick={() => setDetail(null)}>إغلاق البيان</Button></DialogActions>
    </Dialog>
    <Dialog open={!!closure} onClose={() => !busy && setClosure(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{closure?.mode === 'reopen' ? 'إلغاء إقفال العمولة' : 'إقفال المتبقي من العمولة'}</DialogTitle>
      <DialogContent>{closure && <Stack sx={{ gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography>{closure.mode === 'reopen' ? 'سيعود المبلغ المُلغى بهذه التسوية إلى المستحق للصرف.' : <>سيُلغى المتبقي <Amount value={closure.row.remainingAmount} currency={closure.row.currency} /> وتصبح العمولة مقفلة. المبلغ المدفوع سابقًا يبقى كما هو، ولا تُسجّل دفعة نقدية جديدة.</>}</Typography>
        <TextField label="بيان التسوية" value={closure.reason} disabled={busy} multiline minRows={2} inputProps={{ maxLength: 1000 }} onChange={e => setClosure({ ...closure, reason: e.target.value })} />
      </Stack>}</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setClosure(null)}>رجوع</Button>
        <Button variant="contained" disabled={busy || !closure?.reason?.trim()} onClick={() => run(() => acc.post(`employees/${detail.employee._id}/adjustments/${closure.row._id}/${closure.mode}`, { reason: closure.reason, expectedRemainingAmount: closure.row.remainingAmount }), () => { setClosure(null); openDetail(detail.employee); })}>{closure?.mode === 'reopen' ? 'تأكيد إلغاء الإقفال' : 'تأكيد إقفال المتبقي'}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={!!adjustment} onClose={() => !busy && setAdjustment(null)} maxWidth="xs" fullWidth><DialogTitle>{adjustment?.kind === 'commission' ? 'إضافة عمولة' : 'إضافة خصم'}</DialogTitle><DialogContent>{adjustment && <Stack sx={{ gap: 2, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField type="date" label="تاريخ الحركة" InputLabelProps={{ shrink: true }} value={adjustment.day} onChange={e => setAdjustment({ ...adjustment, day: e.target.value })} />
      <TextField type="month" label="شهر الاستحقاق" InputLabelProps={{ shrink: true }} value={adjustment.month} onChange={e => setAdjustment({ ...adjustment, month: e.target.value })} />
      {adjustment.kind === 'commission' ? <TextField select label="عملة العمولة" value={adjustment.currency} onChange={e => setAdjustment({ ...adjustment, currency: e.target.value, rate: '' })}>{currencies.filter(c => c.isActive).map(c => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}</TextField>
        : <TextField label="العملة" value={adjustment.currency} InputProps={{ readOnly: true }} helperText="الخصم بعملة الراتب الأساسي" />}
      {adjustment.kind === 'commission' && adjustment.currency !== 'USD' && adjustment.currency !== detail?.employee.salaryCurrency && <TextField type="number" label={`سعر خاص للعمولة: ${adjustment.currency} مقابل 1 USD`} value={adjustment.rate || ''} onChange={e => setAdjustment({ ...adjustment, rate: e.target.value })} helperText="اختياري؛ إذا تركته فارغًا يستخدم سعر تاريخ صرف الراتب" />}
      <TextField type="number" label="المبلغ" value={adjustment.amount} onChange={e => setAdjustment({ ...adjustment, amount: e.target.value })} />
      <TextField label="السبب / البيان" multiline minRows={2} value={adjustment.reason} onChange={e => setAdjustment({ ...adjustment, reason: e.target.value })} />
    </Stack>}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setAdjustment(null)}>إلغاء</Button><Button variant="contained" disabled={busy || !(Number(adjustment?.amount) > 0) || !adjustment?.reason?.trim()} onClick={() => run(() => acc.post(`employees/${detail.employee._id}/adjustments`, adjustment), () => { setAdjustment(null); openDetail(detail.employee); })}>حفظ الحركة</Button></DialogActions></Dialog>
  </>;
}
