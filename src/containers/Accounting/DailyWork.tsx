import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { acc, errorText, todayLibya } from './accountingApi';
import { Amount, Badge, DataTable, FilterBar, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
import { useAccountingAccess } from './useAccountingAccess';
import EmployeeOperations from './EmployeeOperations';

// One place for the accountant's day: review today's operations by office, work the open backlog,
// then close the day with a saved report (several reports a day are allowed).
const ITEM_STATES: Record<string, { text: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  pending: { text: 'لم يُراجع', tone: 'muted' }, ok: { text: 'تمت المراجعة', tone: 'ok' }, issue: { text: 'فيه مشكلة', tone: 'danger' },
};
const TALLY_STATES: Record<string, { text: string; tone: 'ok' | 'warn' | 'danger' | 'muted' | 'info' }> = {
  matched: { text: 'مطابق', tone: 'ok' }, difference: { text: 'فرق مفتوح', tone: 'danger' }, explained: { text: 'فرق مُفسَّر', tone: 'info' }, adopted: { text: 'اعتُمد جرداً', tone: 'warn' },
};
const REVIEW_STATES: Record<string, string> = { open: 'تحتاج معالجة', deferred: 'مؤجلة للمتابعة', independent: 'مستقلة موثقة' };
const userName = (u: any) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.customerId || u?._id;

const PeriodicWork = () => {
  const access = useAccountingAccess();
  const canWork = access.can('treasury', 'closing');
  const [tab, setTab] = useState(0);
  const [day, setDay] = useState(todayLibya());
  const [today, setToday] = useState<any>(null), [backlog, setBacklog] = useState<any>(null), [closes, setCloses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true), [backlogLoading, setBacklogLoading] = useState(true);
  const [filters, setFilters] = useState({ category: 'all', q: '' });
  const [message, setMessage] = useState<any>(null), [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<any>(null), [note, setNote] = useState(''), [assignee, setAssignee] = useState(''), [dueDay, setDueDay] = useState('');
  const [users, setUsers] = useState<any[]>([]), [report, setReport] = useState<any>(null);

  const loadToday = useCallback(() => {
    setLoading(true);
    acc.get('daily-work/today', { day }).then((res: any) => setToday(res.data)).catch((err: any) => setMessage({ type: 'error', text: errorText(err) })).finally(() => setLoading(false));
  }, [day]);
  const loadBacklog = useCallback(() => {
    setBacklogLoading(true);
    acc.get('daily-work/backlog').then((res: any) => setBacklog(res.data)).catch((err: any) => setMessage({ type: 'error', text: errorText(err) })).finally(() => setBacklogLoading(false));
  }, []);
  const loadCloses = useCallback(() => { acc.get('daily-work/closes').then((res: any) => setCloses(res.data.results || [])).catch(() => {}); }, []);
  useEffect(() => { loadToday(); }, [loadToday]);
  useEffect(() => { loadBacklog(); loadCloses(); }, [loadBacklog, loadCloses]);
  useEffect(() => { acc.get('lookup/users').then((res: any) => setUsers(res.data.results || [])).catch(() => {}); }, []);
  const refresh = () => { loadToday(); loadBacklog(); loadCloses(); };

  const run = async (fn: () => Promise<any>, success: string, after: () => void = refresh) => {
    setSaving(true);
    try { await fn(); setMessage({ type: 'success', text: success }); setDialog(null); after(); }
    catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    finally { setSaving(false); }
  };
  const open = (kind: string, row: any = {}) => { setDialog({ kind, row }); setNote(''); setAssignee(row.assignee?._id || ''); setDueDay(row.dueDay || ''); };

  const saveCount = (box: any) => run(() => acc.post('daily-work/tallies', { day, accountId: box.accountId, counted: Number(counts[box.accountId]) }),
    'حُفظ العدّ.', () => { setCounts(c => ({ ...c, [box.accountId]: '' })); loadToday(); loadBacklog(); });
  const markItem = (row: any, state: string, text = '') => run(() => acc.post('daily-work/items', { key: row.key, day, state, note: text, title: row.title, url: row.url }),
    state === 'ok' ? 'عُلّم البند كمراجَع.' : state === 'issue' ? 'سُجّلت المشكلة، وانتقلت إلى المتراكم حتى تُعالج.' : 'أُعيد البند لغير المراجَع.');

  const submitDialog = () => {
    const { kind, row } = dialog;
    if (kind === 'issue') return markItem(row, 'issue', note);
    if (kind === 'explain') return run(() => acc.post(`daily-work/tallies/${row.tallyId || row.tally?._id}/explain`, { note }), 'سُجّل سبب الفرق.');
    if (kind === 'adopt') return run(() => acc.post(`daily-work/tallies/${row.tallyId || row.tally?._id}/adopt`, { note }), 'اعتُمد الفرق جرداً اليوم وسُجّل قيد العجز أو الزيادة.');
    if (kind === 'defer') return run(() => acc.post('daily-work/tasks', { key: row.key, fingerprint: row.fingerprint, state: 'deferred', reason: note, assignee, dueDay }), 'أُسند البند للمتابعة.');
    if (kind === 'reopen') return run(() => acc.post('daily-work/tasks', { key: row.key, fingerprint: row.fingerprint, state: 'open', reason: note }), 'أُعيد البند للمعالجة.');
    if (kind === 'complete') return run(() => acc.post(row.tripId ? `review/trips/${row.tripId}/complete` : `review/orders/${row.orderId}/complete`, { reason: note, zeroCost: row.zeroCost }), 'حُفظ تأكيد اكتمال التكلفة.');
    if (kind === 'close') return run(async () => {
      const res = await acc.post('daily-work/close', { day, note });
      const full = await acc.get(`daily-work/closes/${res.data._id}`);
      setReport(full.data);
    }, 'حُفظ تقرير الإقفال.');
    return undefined;
  };
  const needsNote = ['issue', 'explain'].includes(dialog?.kind) || (dialog?.kind === 'defer') || (dialog?.kind === 'complete' && dialog?.row?.zeroCost);
  const noteMin = dialog?.kind === 'issue' ? 5 : 10;

  const s = today?.summary;
  const categoryCounts = backlog?.summary?.byCategory || {};
  const visible = (backlog?.results || []).filter((r: any) => (filters.category === 'all' || r.category === filters.category)
    && (!filters.q || `${r.title} ${r.description}`.toLowerCase().includes(filters.q.toLowerCase())));

  return <>
    <PageHeader title="الأعمال الأسبوعية والدورية" subtitle="أدوات الجرد والمتابعة والتقارير للمراجعة الدورية. اختر يوم الجرد؛ كل تقرير يحفظ بيانات ذلك اليوم والمتراكم وقت إصداره، ولا يقفل التعديل."
      actions={<>
        <TextField type="date" size="small" label="اليوم" InputLabelProps={{ shrink: true }} value={day} inputProps={{ max: todayLibya() }} onChange={e => setDay(e.target.value)} />
        <Button onClick={refresh}>تحديث</Button>
        {canWork && <Button variant="contained" onClick={() => open('close')}>إقفال اليوم بتقرير</Button>}
      </>} />
    {message && <Alert severity={message.type} onClose={() => setMessage(null)} className="mb-3">{message.text}</Alert>}
    {today?.closes?.length > 0 && <Alert severity="info" className="mb-3">أُغلق هذا اليوم {today.closes.length} مرة؛ آخرها النسخة {today.closes[0].version} بواسطة {today.closes[0].closedBy || '—'} الساعة {new Date(today.closes[0].createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}. أي إقفال جديد يصبح نسخة جديدة.</Alert>}
    {today?.changes?.length > 0 && <Alert severity="warning" className="mb-3">
      <strong>{today.changes.length} تغيير على أيام مغلقة منذ آخر تقرير</strong> — سيظهر في التقرير القادم.
      <div className="mt-1">{today.changes.slice(0, 5).map((c: any) => <div key={c._id}><Open to={c.url}>{c.number}</Open> · بتاريخ {c.day} · {c.description} · {c.by}</div>)}</div>
    </Alert>}

    <Tabs value={tab} onChange={(_, value) => setTab(value)} className="mb-3">
      <Tab label={`الجرد والمتابعة${s ? ` (${s.pending} للمراجعة)` : ''}`} />
      <Tab label={`المتراكم${backlog ? ` (${backlog.summary.total})` : ''}`} />
      <Tab label={`التقارير (${closes.length})`} />
    </Tabs>

    {tab === 0 && <>
      <StatGrid>
        <Stat label="خزائن عُدّت" value={s ? `${s.counted} / ${s.boxes}` : '—'} hint={s ? `${s.matched} مطابقة` : undefined} />
        <Stat label="فروق عدّ مفتوحة" value={s?.differences ?? '—'} tone={s?.differences ? 'danger' : undefined} />
        <Stat label="عمليات تحتاج نظرة" value={s ? `${s.pending} / ${s.items}` : '—'} hint="الباقي يُقبل بمطابقة الخزائن" tone={s?.pending ? 'warn' : undefined} />
        <Stat label="مشاكل سُجّلت اليوم" value={s?.issues ?? '—'} />
      </StatGrid>

      {(today?.offices || []).map((office: any) => <Panel key={office.office} title={office.name} subtitle="اكتب المبلغ المعدود فعلاً في نهاية اليوم. الفرق يُسجَّل وينتقل للمتراكم؛ لا قيد حتى تعتمده جرداً.">
        <DataTable<any> dense loading={loading} rows={office.boxes} rowKey={b => b.accountId} columns={[
          { key: 'name', header: 'الخزينة', render: b => <><strong>{b.name}</strong><Sub>{b.code}{b.subBox ? ' · خزينة فرعية' : ''}</Sub></> },
          { key: 'opening', header: 'أول اليوم', align: 'end', render: b => <Money value={b.opening} currency={b.currency} decimals={b.decimals} /> },
          { key: 'in', header: 'داخل', align: 'end', render: b => <Money value={b.in} currency={b.currency} decimals={b.decimals} hideZero /> },
          { key: 'out', header: 'خارج', align: 'end', render: b => <Money value={-b.out} currency={b.currency} decimals={b.decimals} hideZero /> },
          { key: 'expected', header: 'المتوقع آخر اليوم', align: 'end', render: b => <Money value={b.expected} currency={b.currency} decimals={b.decimals} strong /> },
          { key: 'count', header: 'المعدود', render: b => b.tally && b.tally.status !== 'difference'
            ? <><Badge tone={TALLY_STATES[b.tally.status].tone}>{TALLY_STATES[b.tally.status].text}</Badge>{b.tally.note && <Sub>{b.tally.note}</Sub>}</>
            : <div className="d-flex gap-1 align-items-center">
              {b.tally && <div><Badge tone="danger">فرق <Money value={b.tally.difference} currency={b.currency} decimals={b.decimals} tone="plain" /></Badge></div>}
              {canWork && <><TextField size="small" type="number" placeholder={b.tally ? 'إعادة العدّ' : 'المبلغ'} style={{ width: 120 }} value={counts[b.accountId] ?? ''} onChange={e => setCounts(c => ({ ...c, [b.accountId]: e.target.value }))} />
                <Button size="small" disabled={saving || counts[b.accountId] === undefined || counts[b.accountId] === ''} onClick={() => saveCount(b)}>حفظ</Button></>}
            </div> },
          { key: 'actions', header: '', render: b => b.tally?.status === 'difference' && canWork ? <div className="d-flex gap-1">
            <Button size="small" onClick={() => open('explain', b)}>تفسير الفرق</Button>
            {access.can('treasury') && <Button size="small" color="warning" onClick={() => open('adopt', b)}>اعتماده جرداً</Button>}
          </div> : null },
        ]} />
      </Panel>)}
      {!loading && !today?.offices?.length && <Alert severity="info" className="mb-3">لا توجد خزائن نقدية عليها رصيد أو حركة في هذا اليوم.</Alert>}

      <Panel title="عمليات اليوم التي تحتاج نظرة" subtitle="مصروف بلا إيصال، مبلغ كبير، تعويض، تعديل أو حذف كشف، عملية بتاريخ سابق، دفع زائد. علّم كل بند: تمت المراجعة، أو فيه مشكلة لتتابعه في المتراكم.">
        <DataTable<any> loading={loading} rows={today?.items || []} rowKey={r => r.key} empty={{ title: "لا توجد عمليات غير عادية في هذا اليوم." }} columns={[
          { key: 'title', header: 'البند', render: r => <><strong>{r.title}</strong><Sub>{r.description}</Sub>{r.note && <Sub>ملاحظة: {r.note}</Sub>}</> },
          { key: 'amount', header: 'المبلغ', align: 'end', render: r => r.amount ? <Amount value={r.amount} currency={r.currency} /> : '' },
          { key: 'who', header: 'من / المكتب', render: r => <>{r.by || '—'}<Sub>{r.office || ''}</Sub></> },
          { key: 'state', header: 'الحالة', render: r => <><Badge tone={ITEM_STATES[r.state].tone}>{ITEM_STATES[r.state].text}</Badge>{r.reviewedBy && <Sub>{r.reviewedBy}</Sub>}</> },
          { key: 'actions', header: '', render: r => <div className="d-flex flex-wrap gap-1">
            <Open to={r.url}>فتح</Open>
            {canWork && r.state !== 'ok' && <Button size="small" color="success" disabled={saving} onClick={() => markItem(r, 'ok')}>✓ تمت المراجعة</Button>}
            {canWork && r.state !== 'issue' && <Button size="small" color="error" onClick={() => open('issue', r)}>⚠ فيه مشكلة</Button>}
            {canWork && r.state !== 'pending' && <Button size="small" onClick={() => markItem(r, 'pending')}>تراجع</Button>}
          </div> },
        ]} />
      </Panel>
    </>}

    {tab === 1 && <>
      <StatGrid>
        <Stat label="كل البنود المفتوحة" value={backlog?.summary.total ?? '—'} />
        <Stat label="تمنع اعتماد الحسابات" value={backlog?.summary.blocking ?? '—'} tone="danger" />
        <Stat label="أخطاء" value={backlog?.summary.errors ?? '—'} />
        <Stat label="مؤجلة للمتابعة" value={backlog?.summary.deferred ?? '—'} hint={backlog?.checksRanAt ? `آخر فحص يومي ${new Date(backlog.checksRanAt).toLocaleString('ar-LY')}` : undefined} />
      </StatGrid>
      <div className="d-flex flex-wrap gap-1 mb-2">
        <Chip label={`الكل (${backlog?.summary.total || 0})`} color={filters.category === 'all' ? 'primary' : 'default'} onClick={() => setFilters(f => ({ ...f, category: 'all' }))} />
        {Object.entries(backlog?.categories || {}).filter(([key]) => categoryCounts[key]).map(([key, text]) =>
          <Chip key={key} label={`${text} (${categoryCounts[key]})`} color={filters.category === key ? 'primary' : 'default'} onClick={() => setFilters(f => ({ ...f, category: key }))} />)}
      </div>
      <FilterBar>
        <TextField label="بحث" size="small" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
        <Button disabled={saving} onClick={() => run(() => acc.post('daily-work/run-checks'), 'شُغّلت الفحوص اليومية.', loadBacklog)}>تشغيل الفحوص الآن</Button>
      </FilterBar>
      <Panel title="المتراكم" subtitle="كل ما يحتاج معالجة من كل الشاشات، بلا تكرار، مرتب: ما يمنع الاعتماد أولاً ثم الأخطاء ثم الأقدم.">
        <DataTable<any> loading={backlogLoading} rows={visible} rowKey={r => r.key} empty={{ title: "لا توجد بنود مفتوحة." }} columns={[
          { key: 'title', header: 'المطلوب', render: r => <><strong>{r.title}</strong><Sub>{r.description}</Sub>
            {r.examples?.length > 0 && <Sub>أمثلة: {r.examples.join(' · ')}</Sub>}{r.otherUrl && <Open to={r.otherUrl}>الفاتورة الأخرى للمقارنة</Open>}</> },
          { key: 'category', header: 'القسم', render: r => <>{backlog.categories[r.category] || r.category}{r.amount ? <Sub><Amount value={r.amount} currency={r.currency} /></Sub> : null}</> },
          { key: 'age', header: 'العمر', sortValue: r => r.age ?? -1, render: r => r.age === null || r.age === undefined ? '' : <>{r.age} يوم<Sub>{r.day}</Sub></> },
          { key: 'state', header: 'الحالة', render: r => <><Badge tone={r.blocking ? 'danger' : r.severity === 'info' ? 'muted' : 'warn'}>{REVIEW_STATES[r.state] || 'تحتاج معالجة'}</Badge>
            {r.assignee && <Sub>مسند: {userName(r.assignee)}{r.dueDay ? ` · ${r.dueDay}` : ''}</Sub>}{r.reason && <Sub>{r.reason}</Sub>}</> },
          { key: 'actions', header: '', render: r => <div className="d-flex flex-wrap gap-1">
            <Open to={r.url}>فتح</Open>
            {r.source === 'review' && access.can('purchases') && (r.orderId || r.tripId) && <Button size="small" onClick={() => open('complete', r)}>تأكيد اكتمال التكلفة</Button>}
            {r.source === 'review' && access.can('closing') && r.state === 'open' && <Button size="small" onClick={() => open('defer', r)}>إسناد / تأجيل</Button>}
            {r.source === 'review' && access.can('closing') && r.state !== 'open' && <Button size="small" onClick={() => open('reopen', r)}>إعادة للمعالجة</Button>}
            {r.source === 'tally' && canWork && <Button size="small" onClick={() => open('explain', r)}>تفسير الفرق</Button>}
            {r.source === 'tally' && access.can('treasury') && <Button size="small" color="warning" onClick={() => open('adopt', r)}>اعتماده جرداً</Button>}
            {r.source === 'issue' && canWork && <Button size="small" color="success" disabled={saving} onClick={() => markItem({ ...r, key: r.reviewKey }, 'ok')}>تمت المعالجة</Button>}
          </div> },
        ]} />
      </Panel>
    </>}

    {tab === 2 && <Panel title="تقارير الإقفال" subtitle="كل إقفال يُحفظ نسخة مستقلة. اضغط التقرير لعرضه أو طباعته.">
      <DataTable<any> rows={closes} rowKey={r => r._id} onRowClick={r => acc.get(`daily-work/closes/${r._id}`).then((res: any) => setReport(res.data))} empty={{ title: "لم يُغلق أي يوم بعد." }} columns={[
        { key: 'day', header: 'اليوم', render: r => <><strong>{r.day}</strong><Sub>النسخة {r.version}</Sub></> },
        { key: 'by', header: 'أغلقه', render: r => <>{r.closedBy}<Sub>{new Date(r.createdAt).toLocaleString('ar-LY')}</Sub></> },
        { key: 'boxes', header: 'الخزائن', render: r => r.summary ? `${r.summary.counted}/${r.summary.boxes} عُدّت · ${r.summary.differences} فرق` : '' },
        { key: 'items', header: 'عمليات اليوم', render: r => r.summary ? `${r.summary.items - r.summary.pending}/${r.summary.items} روجعت` : '' },
        { key: 'backlog', header: 'المتراكم', render: r => r.backlog ? <>{r.backlog.total} مفتوح<Sub>عولج {r.backlog.resolvedCount} · جديد {r.backlog.addedCount}</Sub></> : '' },
        { key: 'changes', header: 'تغييرات بعد الإقفال', render: r => r.changes || '' },
        { key: 'note', header: 'ملاحظة', render: r => r.note },
      ]} />
    </Panel>}

    <Dialog open={!!dialog} onClose={() => !saving && setDialog(null)} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle>{({ close: 'إقفال اليوم بتقرير', issue: 'تسجيل مشكلة', explain: 'تفسير فرق العدّ', adopt: 'اعتماد الفرق جرداً', defer: 'إسناد / تأجيل', reopen: 'إعادة للمعالجة', complete: 'تأكيد اكتمال التكلفة' } as any)[dialog?.kind]}</DialogTitle>
      <DialogContent>
        <Alert severity="info" className="mb-3">{({
          close: `يُحفظ تقرير لليوم ${day}: الخزائن وعدّها، عمليات اليوم وحالتها، المتراكم وما عولج منذ آخر تقرير، والتغييرات على أيام مغلقة. لا يُقفل أي شيء، ويمكنك الإقفال مرة أخرى لاحقاً.`,
          issue: 'تنتقل المشكلة إلى المتراكم حتى تعلّمها «تمت المعالجة».',
          explain: 'استعمله عندما تعرف سبب الفرق (عملية لم تُدخل بعد، خطأ في العدّ). لا يُنشأ قيد. أدخل العملية الناقصة من شاشتها.',
          adopt: 'لم يُعرف سبب الفرق: يُسجَّل جرد اليوم بقيمة الفرق نفسه (عجز أو زيادة على 530900). لا يُتراجع عنه إلا بإلغاء الجرد.',
          defer: 'الإسناد والتأجيل لا يخفيان البند ولا يجعلان الحسابات معتمدة.',
          reopen: 'يعود البند لقائمة ما يحتاج معالجة.',
          complete: 'أكد بعد مراجعة فواتير الشراء والعمولات. لا يُنشئ تكلفة، وأي تغيير لاحق يعيد طلب المراجعة.',
        } as any)[dialog?.kind]}</Alert>
        {dialog?.kind === 'close' && today && <div className="mb-3"><Sub>الخزائن المعدودة {today.summary.counted}/{today.summary.boxes} · عمليات لم تُراجع {today.summary.pending} · المتراكم {backlog?.summary.total ?? '—'}</Sub></div>}
        <TextField fullWidth multiline minRows={2} label={dialog?.kind === 'close' ? 'ملاحظة على التقرير (اختياري)' : 'السبب / الملاحظة'} value={note} onChange={e => setNote(e.target.value)} className="mb-3" />
        {dialog?.kind === 'defer' && <div className="d-flex gap-2">
          <TextField select label="المسؤول" fullWidth value={assignee} onChange={e => setAssignee(e.target.value)}><MenuItem value="">غير مسند</MenuItem>{users.map(u => <MenuItem key={u._id} value={u._id}>{userName(u)}</MenuItem>)}</TextField>
          <TextField type="date" label="موعد المتابعة" InputLabelProps={{ shrink: true }} value={dueDay} onChange={e => setDueDay(e.target.value)} />
        </div>}
      </DialogContent>
      <DialogActions><Button onClick={() => setDialog(null)} disabled={saving}>إلغاء</Button>
        <Button variant="contained" onClick={submitDialog} disabled={saving || (needsNote && note.trim().length < noteMin)}>{dialog?.kind === 'close' ? 'حفظ التقرير' : 'حفظ'}</Button></DialogActions>
    </Dialog>

    <Dialog open={!!report} onClose={() => setReport(null)} fullWidth maxWidth="lg" dir="rtl">
      <DialogTitle>تقرير إقفال {report?.day} — النسخة {report?.version}</DialogTitle>
      <DialogContent><CloseReport report={report} /></DialogContent>
      <DialogActions><Button onClick={() => window.print()}>طباعة</Button><Button onClick={() => setReport(null)}>إغلاق</Button></DialogActions>
    </Dialog>
  </>;
};

const CloseReport = ({ report }: { report: any }) => {
  if (!report) return null;
  const r = report.report || {};
  const b = r.backlog || {};
  return <div className="daily-close-report">
    <Sub>أغلقه {report.closedBy || '—'} · {new Date(report.createdAt).toLocaleString('ar-LY')}{report.note ? ` · ${report.note}` : ''}</Sub>
    <StatGrid>
      <Stat label="خزائن عُدّت" value={`${r.summary?.counted ?? 0} / ${r.summary?.boxes ?? 0}`} hint={`${r.summary?.differences ?? 0} فرق مفتوح`} />
      <Stat label="عمليات اليوم" value={`${(r.summary?.items ?? 0) - (r.summary?.pending ?? 0)} / ${r.summary?.items ?? 0}`} hint="روجعت" />
      <Stat label="المتراكم" value={b.total ?? 0} hint={`يمنع الاعتماد ${b.blocking ?? 0}`} />
      <Stat label="منذ آخر تقرير" value={`عولج ${b.resolvedCount ?? 0}`} hint={`جديد ${b.addedCount ?? 0}`} />
    </StatGrid>
    {(r.offices || []).map((o: any) => <Panel key={o.office} title={o.name}>
      <DataTable<any> dense rows={o.boxes} rowKey={x => x.accountId} columns={[
        { key: 'name', header: 'الخزينة', render: x => x.name },
        { key: 'opening', header: 'أول اليوم', align: 'end', render: x => <Money value={x.opening} currency={x.currency} decimals={x.decimals} /> },
        { key: 'in', header: 'داخل', align: 'end', render: x => <Money value={x.in} currency={x.currency} decimals={x.decimals} hideZero /> },
        { key: 'out', header: 'خارج', align: 'end', render: x => <Money value={-x.out} currency={x.currency} decimals={x.decimals} hideZero /> },
        { key: 'expected', header: 'المتوقع', align: 'end', render: x => <Money value={x.expected} currency={x.currency} decimals={x.decimals} strong /> },
        { key: 'counted', header: 'المعدود', align: 'end', render: x => x.tally ? <Money value={x.tally.counted} currency={x.currency} decimals={x.decimals} /> : 'لم يُعدّ' },
        { key: 'status', header: 'الحالة', render: x => x.tally ? <><Badge tone={TALLY_STATES[x.tally.status].tone}>{TALLY_STATES[x.tally.status].text}</Badge>{x.tally.note && <Sub>{x.tally.note}</Sub>}</> : '' },
      ]} />
    </Panel>)}
    <Panel title="عمليات اليوم">
      <DataTable<any> dense rows={r.items || []} rowKey={x => x.key} empty={{ title: "لا توجد" }} columns={[
        { key: 'title', header: 'البند', render: x => <>{x.title}<Sub>{x.description}</Sub></> },
        { key: 'amount', header: 'المبلغ', render: x => x.amount ? <Amount value={x.amount} currency={x.currency} /> : '' },
        { key: 'by', header: 'من', render: x => x.by },
        { key: 'state', header: 'الحالة', render: x => <>{ITEM_STATES[x.state]?.text}{x.note && <Sub>{x.note}</Sub>}</> },
      ]} />
    </Panel>
    {(b.resolved || []).length > 0 && <Panel title={`عولج منذ آخر تقرير (${b.resolvedCount})`}>{b.resolved.map((x: any) => <div key={x.key}>✓ {x.title}{x.description ? ` — ${x.description}` : ''}</div>)}</Panel>}
    <Panel title={`ما بقي مفتوحاً (${b.total ?? 0})`}>
      <DataTable<any> dense maxHeight={400} rows={b.items || []} rowKey={x => x.key} columns={[
        { key: 'title', header: 'البند', render: x => <>{x.title}<Sub>{x.description}</Sub></> },
        { key: 'day', header: 'التاريخ', render: x => x.day || '' },
        { key: 'blocking', header: '', render: x => x.blocking ? <Badge tone="danger">يمنع الاعتماد</Badge> : '' },
      ]} />
    </Panel>
    {(r.changes || []).length > 0 && <Panel title={`تغييرات على أيام مغلقة (${r.changes.length})`}>
      {r.changes.map((c: any) => <div key={c._id}>{c.number} · بتاريخ {c.day} · {c.description} · {c.by} · {new Date(c.createdAt).toLocaleString('ar-LY')}</div>)}
    </Panel>}
  </div>;
};

const DailyWork = () => {
  const [section, setSection] = useState('daily');
  return <>
    <PageHeader title="العمل اليومي والدوري" subtitle="مراجعة عمليات الموظفين يوميًا، والجرد والمتابعة في قسم مستقل." />
    <Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto" className="mb-3" aria-label="أقسام المراجعة">
      <Tab value="daily" label="عمليات الموظفين — يومي" />
      <Tab value="periodic" label="الأعمال الأسبوعية والدورية" />
    </Tabs>
    {section === 'daily' ? <EmployeeOperations /> : <PeriodicWork />}
  </>;
};
export default DailyWork;
