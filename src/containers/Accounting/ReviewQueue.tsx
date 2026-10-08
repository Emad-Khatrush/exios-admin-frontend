import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Badge, DataTable, FilterBar, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
import { useAccountingAccess } from './useAccountingAccess';
import { useSearchParams } from 'react-router-dom';

const categories: Record<string, string> = { cost: 'اكتمال التكاليف', duplicate: 'تكرار محتمل', purchase: 'مشتريات غير مرتبطة', bank: 'حركات الكشف', refund: 'استردادات', suspense: 'المعلّق', posting: 'تعثر الترحيل', integrity: 'فروق الحسابات والدفاتر' };
const states: Record<string, string> = { open: 'تحتاج معالجة', deferred: 'مؤجلة للمتابعة', independent: 'عمليات مستقلة موثقة' };
const ReviewQueue = () => {
  const access = useAccountingAccess();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ from: params.get('from') || '', to: params.get('to') || '', category: 'all', state: 'all', q: '' });
  const [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [data, setData] = useState<any>(null), [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<any>(null), [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState(''), [dueDay, setDueDay] = useState(''), [assignee, setAssignee] = useState('');
  const [bankBalance, setBankBalance] = useState(''), [bankNature, setBankNature] = useState('available');
  const [users, setUsers] = useState<any[]>([]), [saving, setSaving] = useState(false);
  useEffect(() => { acc.get('lookup/users').then((res: any) => setUsers(res.data.results || [])).catch(() => {}); }, []);
  useEffect(() => {
    let stale = false; setLoading(true);
    const timer = window.setTimeout(() => acc.get('review', { ...filters, page }).then((res: any) => { if (!stale) setData(res.data); })
      .catch((err: any) => { if (!stale) setMessage({ type: 'error', text: errorText(err) }); }).finally(() => { if (!stale) setLoading(false); }), 200);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [filters, page, version]);
  const change = (patch: any) => { setFilters(f => ({ ...f, ...patch })); setPage(1); };
  const choose = (row: any, action: string) => { setSelected({ ...row, action }); setReason(row.reason || ''); setDueDay(row.dueDay || ''); setAssignee(row.assignee?._id || ''); setBankBalance(''); setBankNature(row.bookBalance < 0 ? 'owed' : 'available'); };
  const save = async () => {
    setSaving(true);
    try {
      if (selected.action === 'bankComplete') await acc.post('review/bank/complete', { accountId: selected.accountId, month: selected.month, balance: Number(bankBalance), nature: bankNature, note: reason });
      else if (selected.action === 'complete') await acc.post(selected.tripId ? `review/trips/${selected.tripId}/complete` : `review/orders/${selected.orderId}/complete`, { reason, zeroCost: selected.zeroCost });
      else await acc.post('review/tasks', { key: selected.key, fingerprint: selected.fingerprint, state: selected.action, reason, dueDay, assignee,
        from: data.period.from, to: data.period.to });
      setSelected(null); setVersion(v => v + 1); setMessage({ type: 'success', text: 'حُفظت المراجعة. التأجيل لا يلغي الحاجة لمعالجة البند قبل اعتماد الحسابات.' });
    } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeader title="قائمة المراجعة المحاسبية" subtitle="مكان واحد للنواقص والتكرارات والمطابقة. يستمر العمل اليومي، وتبقى التقارير مؤقتة حتى معالجة البنود المؤثرة واعتماد الشهر." actions={<Button onClick={() => setVersion(v => v + 1)}>تحديث المراجعة</Button>} />
    {message && <Alert severity={message.type} onClose={() => setMessage(null)} className="mb-3">{message.text}</Alert>}
    <StatGrid><Stat label="جميع البنود" value={data?.summary.total ?? '—'} /><Stat label="تمنع اعتماد الحسابات" value={data?.summary.blocking ?? '—'} tone="danger" /><Stat label="أخطاء تحتاج معالجة" value={data?.summary.errors ?? '—'} /><Stat label="مؤجلة للمتابعة" value={data?.summary.deferred ?? '—'} /></StatGrid>
    <FilterBar>
      <TextField label="بحث" size="small" value={filters.q} onChange={e => change({ q: e.target.value })} />
      <TextField select label="نوع المراجعة" size="small" value={filters.category} onChange={e => change({ category: e.target.value })}><MenuItem value="all">الكل</MenuItem>{Object.entries(categories).map(([key, text]) => <MenuItem key={key} value={key}>{text}</MenuItem>)}</TextField>
      <TextField select label="الحالة" size="small" value={filters.state} onChange={e => change({ state: e.target.value })}><MenuItem value="all">الكل</MenuItem>{Object.entries(states).map(([key, text]) => <MenuItem key={key} value={key}>{text}</MenuItem>)}</TextField>
      {(['from', 'to'] as const).map(key => <TextField key={key} type="date" size="small" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={filters[key]} onChange={e => change({ [key]: e.target.value })} />)}
    </FilterBar>
    <Panel title="المعالجة والمتابعة" subtitle={data ? `الفترة ${data.period.from || 'بداية السجلات'} إلى ${data.period.to}. فتح المصدر هو الطريق لتصحيح التكلفة أو المطابقة.` : undefined}>
      <DataTable<any> loading={loading} rows={data?.results || []} rowKey={r => r.key} columns={[
        { key: 'title', header: 'المطلوب', render: r => <><strong>{r.title}</strong><Sub>{r.description}</Sub>{r.otherUrl && <Open to={r.otherUrl}>فتح الفاتورة الأخرى للمقارنة</Open>}</> },
        { key: 'category', header: 'القسم', render: r => categories[r.category] },
        { key: 'state', header: 'الحالة', render: r => <><Badge tone={r.blocking ? 'warn' : 'ok'}>{states[r.state]}</Badge><Sub>{r.blocking ? 'يحتاج معالجة قبل اعتماد الحسابات' : 'للمتابعة'}</Sub>{r.reason && <Sub>{r.reason}</Sub>}</> },
        { key: 'assignee', header: 'المتابعة', render: r => <>{[r.assignee?.firstName, r.assignee?.lastName].filter(Boolean).join(' ') || 'غير مسند'}<Sub>{r.dueDay || r.day || ''}</Sub></> },
        { key: 'action', header: '', render: r => <div className="d-flex flex-wrap gap-1">
          <Open to={r.url}>فتح المصدر</Open>
          {access.can('purchases') && (r.orderId || r.tripId) && <Button size="small" onClick={() => choose(r, 'complete')}>تأكيد اكتمال التكلفة</Button>}
          {access.can('treasury') && r.month && r.accountId && <Button size="small" onClick={() => choose(r, 'bankComplete')}>مراجعة الرصيد الختامي</Button>}
          {access.can('closing') && <Button size="small" onClick={() => choose(r, 'deferred')}>إسناد / تأجيل</Button>}
          {access.can('closing') && r.canConfirmIndependent && <Button size="small" onClick={() => choose(r, 'independent')}>تأكيد أنها عمليتان مستقلتان</Button>}
          {access.can('closing') && r.state !== 'open' && <Button size="small" onClick={() => choose(r, 'open')}>إعادة للمعالجة</Button>}
        </div> },
      ]} />
      <Pagination count={Math.max(1, Math.ceil((data?.total || 0) / 40))} page={page} onChange={(_, value) => setPage(value)} className="mt-3" />
    </Panel>
    <Dialog open={!!selected} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle>{selected?.action === 'complete' ? 'مراجعة اكتمال تكلفة الطلبية' : 'توثيق المراجعة والمتابعة'}</DialogTitle>
      <DialogContent>
        <Alert severity="info" className="mb-3">{selected?.action === 'bankComplete' ? 'أدخل الرصيد من كشف البنك في آخر يوم من الشهر، لا من شاشة المنظومة. يجب أن يساوي الدفاتر بنفس العملة؛ لن ينشئ النظام قيداً لتغطية الفرق.' : selected?.action === 'complete' ? 'أكد بعد مراجعة فواتير الشراء والعمولات والتكاليف الإضافية. هذا التأكيد لا ينشئ تكلفة؛ وأي تغيير محاسبي لاحق يعيد طلب المراجعة.' : 'التأجيل والإسناد لا يخفيان الخطأ ولا يجعلان الحسابات معتمدة. تأكيد استقلال عمليتين يحتاج سبباً واضحاً.'}</Alert>
        {selected?.action === 'bankComplete' && <div className="d-flex gap-2 mb-3"><TextField type="number" label={`الرصيد الختامي من الكشف (${selected.currency})`} value={bankBalance} onChange={e => setBankBalance(e.target.value)} fullWidth /><TextField select label="نوع الرصيد" value={bankNature} onChange={e => setBankNature(e.target.value)} fullWidth><MenuItem value="available">رصيد متاح بالحساب</MenuItem><MenuItem value="owed">مبلغ مستحق للبنك / سالب</MenuItem></TextField></div>}
        <TextField fullWidth multiline minRows={2} label={selected?.zeroCost ? 'سبب صحة عدم وجود تكلفة' : 'سبب المراجعة / ملاحظات'} value={reason} onChange={e => setReason(e.target.value)} className="mb-3" />
        {selected?.action === 'deferred' && <div className="d-flex gap-2"><TextField select label="المسؤول عن المتابعة" fullWidth value={assignee} onChange={e => setAssignee(e.target.value)}><MenuItem value="">غير مسند</MenuItem>{users.map(u => <MenuItem key={u._id} value={u._id}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.customerId || u._id}</MenuItem>)}</TextField><TextField type="date" label="موعد المتابعة" InputLabelProps={{ shrink: true }} value={dueDay} onChange={e => setDueDay(e.target.value)} /></div>}
      </DialogContent>
      <DialogActions><Button onClick={() => setSelected(null)} disabled={saving}>إلغاء</Button><Button variant="contained" onClick={save} disabled={saving || (selected?.action === 'bankComplete' ? bankBalance === '' || !Number.isFinite(Number(bankBalance)) || Number(bankBalance) < 0 : (((selected?.action !== 'complete' && selected?.action !== 'open') || selected?.zeroCost) && reason.trim().length < 10))}>حفظ المراجعة</Button></DialogActions>
    </Dialog>
  </>;
};
export default ReviewQueue;
