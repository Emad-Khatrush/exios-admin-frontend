import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, Tab, Tabs, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { useAccountingAccess } from './useAccountingAccess';
import { useVendors } from './shared';
import { Amount, Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
import BankReviewComparison, { ReviewField } from './BankReviewComparison';
import BankLineDetails from './BankLineDetails';

const labels: Record<string, string> = { unlinked: 'غير مرتبطة', partial: 'مرتبطة جزئياً', linked: 'مرتبطة بالكامل' };
const initial = { from: '', to: '', period: 'current', source: 'order', status: 'unlinked', q: '', vendorId: '', accountId: '', currency: '' };
const PurchaseReconciliation = () => {
  const navigate = useNavigate();
  const { accounts, offices, currencies } = useAccountingData();
  const { vendors } = useVendors();
  const access = useAccountingAccess();
  const banks = accounts.filter(a => a.isCash && a.isActive);
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState({ accountId: '', from: '', to: '', showAll: false });
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidates, setCandidates] = useState<any>(null);
  const [chosen, setChosen] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [historical, setHistorical] = useState({ accountId: '', from: '', to: '', office: '', page: 1 });
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [confirmHistorical, setConfirmHistorical] = useState(false);
  const [reason, setReason] = useState('');
  const [completed, setCompleted] = useState(false);
  const change = (values: any) => { setFilters(f => ({ ...f, ...values })); setPage(1); };
  useEffect(() => {
    if (tab !== 0) return;
    let stale = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      acc.get('bank/purchase-reconciliation', { ...filters, page }).then((res: any) => { if (!stale) setData(res.data); })
        .catch((err: any) => { if (!stale) { setData(null); setMessage({ type: 'error', text: errorText(err) }); } })
        .finally(() => { if (!stale) setLoading(false); });
    }, 250);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [filters, page, refresh, tab]);
  useEffect(() => {
    if (!selected) return;
    let stale = false;
    setCandidates(null); setChosen(null); setConfirmed(false);
    acc.get('bank/purchase-reconciliation/candidates', { billId: selected.billId, orderId: selected.orderId, itemId: selected.itemId,
      ...search, showAll: String(search.showAll), page: candidatePage }).then((res: any) => { if (!stale) setCandidates(res.data); })
      .catch((err: any) => { if (!stale) { setCandidates({ results: [], total: 0 }); setMessage({ type: 'error', text: errorText(err) }); } });
    return () => { stale = true; };
  }, [selected, search, candidatePage]);
  const openMatch = (row: any) => { setSelected(row); setSearch({ accountId: '', from: '', to: '', showAll: false }); setCandidatePage(1); };
  const match = async () => {
    if (!chosen || !selected) return;
    setSaving(true);
    try {
      await acc.post(`bank/lines/${chosen._id}/purchase-match`, { kind: selected.kind, billId: selected.billId,
        orderId: selected.orderId, itemId: selected.itemId, confirmDifference: confirmed });
      setSelected(null); setRefresh(v => v + 1);
      setMessage({ type: 'success', text: 'تم الربط. استُخدمت الفاتورة المسجلة ومعالجة السداد دون إنشاء تكلفة مكررة.' });
    } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    finally { setSaving(false); }
  };
  const loadHistorical = async (targetPage = historical.page) => {
    setHistorical(h => ({ ...h, page: targetPage }));
    setLoading(true); setHistoricalData(null); setChecked([]);
    try { setHistoricalData((await acc.get('bank/historical-purchases', { ...historical, page: targetPage })).data); }
    catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    finally { setLoading(false); }
  };
  const settle = async () => {
    setSaving(true);
    try {
      const res = await acc.post('bank/historical-purchases/settle', { ...historical, lineIds: checked, reason, confirmCompleted: completed });
      setConfirmHistorical(false); setReason(''); setCompleted(false);
      setMessage({ type: 'success', text: `سُويت ${res.data.posted} حركة بتاريخها الأصلي. لم يتغير رصيد البنك الافتتاحي.` });
      await loadHistorical(1); setRefresh(v => v + 1);
    } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    finally { setSaving(false); }
  };
  const current = historicalData?.results?.filter((r: any) => checked.includes(r._id)) || [];
  return <>
    <PageHeader title="متابعة مشتريات الطلبيات" subtitle="راجع المشتريات المسجلة التي لم ترتبط بكشف، ثم طابقها مع حركة السداد الأصلية." actions={access.can('treasury') && <Button component={RouterLink} to="/accounting/bank" variant="contained">تحميل كشف حساب</Button>} />
    {message && <Alert className="mb-3" severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}
    <Tabs value={tab} onChange={(_, value) => { setTab(value); setMessage(null); }} className="mb-3">
      <Tab label="المشتريات والمطابقة" />
      {access.can('treasury') && access.can('setup') && <Tab label="تسوية المشتريات السابقة للجرد" />}
    </Tabs>
    {tab === 0 ? <>
      <StatGrid>{(['total', 'unlinked', 'partial', 'linked'] as const).map(key => <Stat key={key} label={key === 'total' ? 'المشتريات المسجلة' : labels[key]} value={data?.summary?.[key] ?? '—'} />)}</StatGrid>
      <FilterBar>
        <TextField size="small" label="بحث بالطلبية أو الفاتورة أو الوصف" value={filters.q} onChange={e => change({ q: e.target.value })} />
        <TextField select size="small" label="فترة المتابعة" value={filters.period} onChange={e => change({ period: e.target.value })}><MenuItem value="current">من بداية التشغيل الجديدة</MenuItem><MenuItem value="historical">ما قبل الجرد</MenuItem><MenuItem value="all">كل الفترات</MenuItem></TextField>
        <TextField select size="small" label="حالة الربط" value={filters.status} onChange={e => change({ status: e.target.value })}><MenuItem value="all">الكل</MenuItem>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        <TextField select size="small" label="المصدر" value={filters.source} onChange={e => change({ source: e.target.value })}><MenuItem value="order">مشتريات الطلبيات</MenuItem><MenuItem value="direct">فواتير مباشرة</MenuItem><MenuItem value="all">الكل</MenuItem></TextField>
        <TextField select size="small" label="المورد" value={filters.vendorId} onChange={e => change({ vendorId: e.target.value })}><MenuItem value="">الكل</MenuItem>{vendors.map((v: any) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}</TextField>
        <TextField select size="small" label="حساب السداد أو الكشف" value={filters.accountId} onChange={e => change({ accountId: e.target.value })}><MenuItem value="">الكل</MenuItem>{banks.map(b => <MenuItem key={b._id} value={b._id}>{accountLabel(b)}</MenuItem>)}</TextField>
        <TextField select size="small" label="العملة" value={filters.currency} onChange={e => change({ currency: e.target.value })}><MenuItem value="">الكل</MenuItem>{currencies.map(c => <MenuItem key={c.code} value={c.code}>{c.code}</MenuItem>)}</TextField>
        {(['from', 'to'] as const).map(key => <TextField key={key} size="small" type="date" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={filters[key]} onChange={e => change({ [key]: e.target.value })} />)}
        <Button onClick={() => { setFilters(initial); setPage(1); }}>مسح الفلاتر</Button>
      </FilterBar>
      <Panel title="مشتريات مسجلة وحالة ارتباطها بالكشوف" subtitle={data?.operationalStartDate ? `بداية المتابعة الجديدة: ${data.operationalStartDate}. اختر فترة ما بعد البداية لمراجعة العمل الجديد.` : undefined}>
        <DataTable<any> rows={data?.results || []} rowKey={r => r._id} loading={loading} columns={[
          { key: 'day', header: 'التاريخ', render: r => <><Ltr>{r.day || 'غير محدد'}</Ltr>{r.historical && <Sub>قبل الجرد</Sub>}</> },
          { key: 'number', header: 'الفاتورة والطلبية', render: r => <>{r.billId ? <Open to={`/accounting/bills/${r.billId}`}>{r.number}</Open> : r.number}{r.orders.map((o: any, i: number) => <Sub key={i}><Open to={`/invoice/${o._id}/edit`}>{o.number}</Open></Sub>)}{r.documentStatus === 'unrecorded' && <Sub>لم تُنشأ فاتورة لها</Sub>}</> },
          { key: 'vendorName', header: 'المورد والبيان', render: r => <>{r.vendorName || 'غير محدد'}<Sub>{r.description}</Sub>{r.ambiguous && <Badge tone="warn">فواتير متشابهة تحتاج مراجعة</Badge>}</> },
          { key: 'amount', header: 'المبلغ الأصلي', render: r => <Amount value={r.amount} currency={r.currency} /> },
          { key: 'status', header: 'المطابقة', render: r => <><Badge tone={r.status === 'linked' ? 'ok' : 'warn'}>{labels[r.status]}</Badge>{r.totalUsd != null && r.remainingUsd > 0 && <Sub>متبقي للمطابقة <Money value={r.remainingUsd} /></Sub>}</> },
          { key: 'links', header: 'الكشوف والسداد', render: r => <>{r.links.map((l: any) => <Sub key={l._id}><Button size="small" onClick={() => setDetailsId(l._id)}>{l.account?.name} · {l.day}</Button></Sub>)}{!r.links.length && r.payments.map((p: any) => <Sub key={p._id}>سداد مسجل: {p.account?.name} · {p.day}</Sub>)}</> },
          { key: 'action', header: '', render: r => access.can('treasury') && r.status !== 'linked' && <Button size="small" variant="outlined" onClick={() => openMatch(r)}>البحث والربط</Button> },
        ]} />
        <Pagination count={Math.max(1, Math.ceil((data?.total || 0) / 30))} page={page} onChange={(_, v) => setPage(v)} className="mt-3" />
      </Panel>
    </> : <Panel title="تسوية جماعية للمشتريات القديمة دون إنشاء طلبيات">
      <Alert severity="info" className="mb-3">تُسجّل المشتريات المكتملة الناقصة بتاريخها مقابل الأرصدة الافتتاحية. لا تتغير أموال البنك ولا أرباح الفترة الجديدة. الحركات المحتمل تسجيل تكلفتها سابقاً تُترك للمطابقة. الفترات المقفلة تحتاج مراجعتها قبل التسوية.</Alert>
      <FilterBar>
        <TextField select size="small" label="البنك أو الكرت" value={historical.accountId} onChange={e => { setHistorical(h => ({ ...h, accountId: e.target.value })); setHistoricalData(null); setChecked([]); }}>{banks.map(b => <MenuItem key={b._id} value={b._id}>{accountLabel(b)}</MenuItem>)}</TextField>
        {(['from', 'to'] as const).map(key => <TextField key={key} size="small" type="date" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={historical[key]} onChange={e => { setHistorical(h => ({ ...h, [key]: e.target.value })); setHistoricalData(null); setChecked([]); }} />)}
        <TextField select size="small" label="المكتب" value={historical.office} onChange={e => setHistorical(h => ({ ...h, office: e.target.value }))}>{offices.map(o => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>
        <Button variant="outlined" disabled={!historical.accountId || loading} onClick={() => loadHistorical(1)}>مراجعة الحركات القديمة</Button>
      </FilterBar>
      {historicalData && <>
        <Sub>تاريخ الجرد: {historicalData.openingCountDay}. تظهر حتى 50 حركة في الدفعة؛ بعد التسوية تظهر الدفعة التالية.</Sub>
        <FormControlLabel label="اختيار المشتريات المتاحة كلها" control={<Checkbox checked={checked.length > 0 && checked.length === historicalData.results.filter((r: any) => r.eligible).length} onChange={(_, v) => setChecked(v ? historicalData.results.filter((r: any) => r.eligible).map((r: any) => r._id) : [])} />} />
        <DataTable<any> rows={historicalData.results} rowKey={r => r._id} columns={[
          { key: 'select', header: '', render: r => <Checkbox disabled={!r.eligible} checked={checked.includes(r._id)} onChange={(_, v) => setChecked(ids => v ? [...ids, r._id] : ids.filter(i => i !== r._id))} /> },
          { key: 'day', header: 'التاريخ' }, { key: 'description', header: 'البيان', render: r => <>{r.description}<Sub>{r.vendorName}</Sub></> },
          { key: 'amount', header: 'المبلغ', render: r => <Money value={r.amount} currency={historicalData.bank.currency} /> },
          { key: 'valuationUsd', header: 'التكلفة بالدولار', render: r => r.valuationUsd ? <Money value={r.valuationUsd} /> : 'غير محددة' },
          { key: 'eligible', header: 'المراجعة', render: r => r.eligible ? <Badge tone="ok">متاحة للتسوية</Badge> : <><Badge tone="warn">تحتاج مراجعة</Badge><Sub>{r.valuationError || (r.candidates.length ? 'تكلفة محتملة مسجلة: ' + r.candidates.map((c: any) => c.number || c._id).join('، ') : 'المورد غير معروف كمورد مشتريات')}</Sub><Button component={RouterLink} to={`/accounting/bank?accountId=${historical.accountId}`} size="small">فتح المطابقة</Button></> },
        ]} />
        <Pagination className="mt-3" count={Math.max(1, Math.ceil((historicalData.total || 0) / 50))} page={historicalData.page || 1} disabled={loading || saving} onChange={(_, value) => loadHistorical(value)} />
        <Button className="mt-3" variant="contained" disabled={!checked.length || !historical.office} onClick={() => { setCompleted(false); setReason(''); setConfirmHistorical(true); }}>تسوية {checked.length} حركة محددة</Button>
      </>}
    </Panel>}
    <Dialog open={!!selected} onClose={() => !saving && setSelected(null)} maxWidth="lg" fullWidth>
      <DialogTitle>البحث عن حركة الكشف وربط المشتريات</DialogTitle>
      <DialogContent>
        <Alert severity="info" className="mb-3">{selected?.number} · {selected?.orders?.map((o: any) => o.number).join('، ')} · {selected?.amount} {selected?.currency}. إذا لم تجد الحركة، حمّل كشف حسابها أولاً.</Alert>
        <FilterBar>
          <TextField select size="small" label="حساب الكشف" value={search.accountId} onChange={e => { setSearch(s => ({ ...s, accountId: e.target.value })); setCandidatePage(1); }}><MenuItem value="">كل الحسابات</MenuItem>{banks.map(b => <MenuItem key={b._id} value={b._id}>{accountLabel(b)}</MenuItem>)}</TextField>
          {(['from', 'to'] as const).map(key => <TextField key={key} size="small" type="date" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={search[key]} onChange={e => { setSearch(s => ({ ...s, [key]: e.target.value })); setCandidatePage(1); }} />)}
          <FormControlLabel label="إظهار المبالغ المختلفة أيضاً" control={<Checkbox checked={search.showAll} onChange={(_, v) => { setSearch(s => ({ ...s, showAll: v })); setCandidatePage(1); }} />} />
        </FilterBar>
        <DataTable<any> rows={candidates?.results || []} rowKey={r => r._id} loading={!candidates} columns={[
          { key: 'day', header: 'التاريخ' }, { key: 'description', header: 'حركة الكشف', render: r => <>{r.description}<Sub>{r.accountId?.name}</Sub></> },
          { key: 'amount', header: 'المدفوع', render: r => <Money value={r.amount} currency={r.accountId?.currency} /> },
          { key: 'reasons', header: 'سبب الاقتراح', render: r => <>{r.reasons.map((s: string) => <Sub key={s}>{s}</Sub>)}{r.merchantMismatch && <Badge tone="danger">المورد مختلف عن {r.statementVendorName}</Badge>}<Sub>فرق التاريخ: {r.daysApart ?? 'غير محدد'} يوم</Sub></> },
          { key: 'choose', header: '', render: r => <Button disabled={r.canMatch === false} variant={chosen?._id === r._id ? 'contained' : 'outlined'} onClick={() => { setChosen(r); setConfirmed(false); }}>اختيار</Button> },
        ]} />
        <Pagination className="my-3" count={Math.max(1, Math.ceil((candidates?.total || 0) / 30))} page={candidatePage} onChange={(_, v) => setCandidatePage(v)} />
        {chosen && <BankReviewComparison line={chosen} paid={Math.abs(chosen.amount) / 10 ** (currencies.find(c => c.code === chosen.accountId?.currency)?.decimals ?? 2)} currency={chosen.accountId?.currency} bankName={chosen.accountId?.name} original={chosen.original} reasons={chosen.reasons} warnings={chosen.sameAmount ? [] : ['المبلغ أو العملة مختلفان؛ راجع الاختيار قبل الاعتماد.']} leftTitle="المشتريات المسجلة">
          <ReviewField label="الفاتورة">{selected?.number}</ReviewField><ReviewField label="المبلغ الأصلي"><Amount value={selected?.amount} currency={selected?.currency} /></ReviewField><ReviewField label="التاريخ">{selected?.day}</ReviewField>
          <ReviewField label="الطلبية">{selected?.orders?.map((o: any) => o.number).join('، ')}</ReviewField>
          <ReviewField label="سعر التصريف المباشر"><Ltr>1 {selected?.currency} = {(Math.abs(chosen.amount) / 10 ** (currencies.find(c => c.code === chosen.accountId?.currency)?.decimals ?? 2) / selected?.amount).toFixed(6)} {chosen.accountId?.currency}</Ltr></ReviewField>
        </BankReviewComparison>}
        {chosen && (!chosen.sameAmount || chosen.daysApart > 7) && <FormControlLabel label="راجعت فرق المبلغ أو التاريخ وأؤكد الاختيار" control={<Checkbox checked={confirmed} onChange={(_, v) => setConfirmed(v)} />} />}
        {message?.type === 'error' && <Alert severity="error" className="mt-3">{message.text}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setSelected(null)}>إلغاء</Button><Button variant="contained" disabled={saving || !chosen || ((!chosen.sameAmount || chosen.daysApart > 7) && !confirmed)} onClick={match}>موافقة وربط</Button></DialogActions>
    </Dialog>
    <Dialog open={confirmHistorical} onClose={() => !saving && setConfirmHistorical(false)} maxWidth="sm" fullWidth>
      <DialogTitle>اعتماد تسوية المشتريات القديمة</DialogTitle><DialogContent>
        <Alert severity="warning" className="mb-3">تُحمّل تكلفة {checked.length} حركة على فترتها التاريخية، دون تغيير البنك أو إنشاء طلبيات.</Alert>
        <p>إجمالي التكلفة: <Money value={current.reduce((s: number, r: any) => s + r.valuationUsd, 0)} /></p>
        <TextField fullWidth multiline label="سبب التسوية" value={reason} onChange={e => setReason(e.target.value)} />
        <FormControlLabel label="أؤكد أن هذه مشتريات مكتملة، وليست دفعات مقدمة أو تكاليف طلبيات ما زالت قيد التنفيذ، ولم تسجل تكلفتها سابقاً" control={<Checkbox checked={completed} onChange={(_, v) => setCompleted(v)} />} />
        {message?.type === 'error' && <Alert severity="error">{message.text}</Alert>}
      </DialogContent><DialogActions><Button disabled={saving} onClick={() => setConfirmHistorical(false)}>إلغاء</Button><Button variant="contained" disabled={saving || !completed || !reason.trim()} onClick={settle}>اعتماد التسوية</Button></DialogActions>
    </Dialog>
    {detailsId && <BankLineDetails id={detailsId} onClose={() => setDetailsId(null)} onChanged={async () => { setRefresh(v => v + 1); }} onReview={async line => { navigate(`/accounting/bank?accountId=${line.accountId?._id || line.accountId}`); }} />}
  </>;
};
export default PurchaseReconciliation;
