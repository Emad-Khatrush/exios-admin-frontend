import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Slider, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { acc, errorText, todayLibya } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { DataTable, FilterBar, Ltr, Money, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
// @ts-ignore
import './FinancialAnalysis.scss';

const LABELS: Record<string, string> = { revenue: 'الإيرادات', cost: 'تكلفة الإيرادات', expenses: 'المصروفات التشغيلية', depreciation: 'الإهلاك', fx: 'فروقات الصرف', grossProfit: 'مجمل الربح', operatingProfit: 'الربح التشغيلي', netProfit: 'صافي الربح' };
const TABS = [['overview', 'الملخص'], ['comparisons', 'المقارنات والمصاريف'], ['ratios', 'المؤشرات المالية'], ['cash', 'النقد وحقوق الملكية'], ['budget', 'الموازنة مقابل الفعلي'], ['scenarios', 'التعادل والسيناريوهات'], ['method', 'مصادر الحساب والإيضاحات']];
const percent = (n: any) => n == null ? 'غير متاح' : `${n}%`;
const usdInput = (value: any) => value == null ? '' : String(value / 100);
function download(name: string, text: string, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const FinancialAnalysis = () => {
  const access = useAccountingAccess();
  const day = todayLibya();
  const [filters, setFilters] = useState({ from: `${day.slice(0, 7)}-01`, to: day, previousFrom: '', previousTo: '' });
  const [data, setData] = useState<any>(null), [config, setConfig] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [tab, setTab] = useState('overview'), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false), [settingsForm, setSettingsForm] = useState<any>(null), [settingsSearch, setSettingsSearch] = useState('');
  const [plan, setPlan] = useState<any>(null), [budgetSearch, setBudgetSearch] = useState('');
  const [planRange, setPlanRange] = useState({ from: filters.from, to: filters.to });
  const [scenario, setScenario] = useState({ activity: 0, variable: 0, fixed: 0 });
  const generation = useRef(0);
  const load = async (period = filters) => {
    const request = ++generation.current;
    setBusy(true); setError(''); setData(null); setReview(null); setPlan(null);
    try {
      const [r, c] = await Promise.all([acc.get('financial-analysis', Object.fromEntries(Object.entries(period).filter(([, v]) => v))), acc.get('financial-analysis/configuration')]);
      if (request !== generation.current) return;
      setData(r.data); setConfig(c.data);
      setPlanRange({ from: r.data.period.from, to: r.data.period.to });
      setPlan({ ...r.data.planning, from: r.data.period.from, to: r.data.period.to, amounts: Object.fromEntries((r.data.planning.budget || []).map((row: any) => [row.accountId, usdInput(row.amount)])), creditSales: usdInput(r.data.planning.creditSales), creditPurchases: usdInput(r.data.planning.creditPurchases), inventoryCost: usdInput(r.data.planning.inventoryCost), interestExpense: usdInput(r.data.planning.interestExpense) });
      acc.get('review/status', { from: r.data.period.from, to: r.data.period.to })
        .then((response: any) => { if (generation.current === request) setReview(response.data); })
        .catch(() => { if (generation.current === request) setReview({ status: 'unavailable' }); });
    } catch (e) { if (request === generation.current) setError(errorText(e)); }
    finally { if (request === generation.current) setBusy(false); }
  };
  useEffect(() => { load(); return () => { generation.current++; }; /* initial period only */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const editSettings = () => {
    setSettingsForm({ ...config.settings, reliableFrom: config.settings.reliableFrom || config.suggestedReliableFrom || '', classifications: { ...Object.fromEntries(config.accounts.filter((a: any) => a.analysisCategory).map((a: any) => [a._id, a.analysisCategory])), ...Object.fromEntries(config.settings.classifications.map((r: any) => [r.accountId, r.category])) }, costBehavior: Object.fromEntries(config.settings.costBehavior.map((r: any) => [r.accountId, r.behavior])) });
    setSettingsSearch(''); setError(''); setSettingsOpen(true);
  };
  const saveSettings = async () => {
    setSaving(true); setError('');
    try {
      await acc.put('financial-analysis/settings', { ...settingsForm, classifications: Object.entries(settingsForm.classifications).filter(([, value]) => value).map(([accountId, category]) => ({ accountId, category })), costBehavior: Object.entries(settingsForm.costBehavior).filter(([, value]) => value).map(([accountId, behavior]) => ({ accountId, behavior })) });
      setSettingsOpen(false); setSuccess('حُفظت إعدادات التحليل.'); await load(data.period);
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  const savePlan = async () => {
    setSaving(true); setError('');
    try {
      const body: any = { from: plan.from, to: plan.to, version: plan.version || 0, notes: plan.notes || '', budget: Object.entries(plan.amounts).filter(([, value]) => value !== '').map(([accountId, value]) => ({ accountId, amount: Math.round(Number(value) * 100) })) };
      for (const key of ['creditSales', 'creditPurchases', 'inventoryCost', 'interestExpense']) body[key] = plan[key] === '' ? null : Math.round(Number(plan[key]) * 100);
      const saved = await acc.put('financial-analysis/period', body); setSuccess('حُفظت الموازنة ومعلومات الفترة دون إنشاء قيود.');
      if (plan.from === data.period.from && plan.to === data.period.to) await load(data.period);
      else setPlan({ ...plan, version: saved.data.version });
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  const loadPlan = async () => {
    setSaving(true); setError('');
    try { const r = await acc.get('financial-analysis/plan', planRange); const p = r.data;
      setPlan({ ...p, amounts: Object.fromEntries((p.budget || []).map((row: any) => [row.accountId, usdInput(row.amount)])), creditSales: usdInput(p.creditSales), creditPurchases: usdInput(p.creditPurchases), inventoryCost: usdInput(p.inventoryCost), interestExpense: usdInput(p.interestExpense) });
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  const exportReport = () => {
    const lines = [`# تقرير التحليل المالي`, `الفترة: ${data.period.from} إلى ${data.period.to}`, `المقارنة: ${data.period.previousFrom} إلى ${data.period.previousTo}`, `حالة المراجعة: ${review?.status === 'approved' ? 'معتمدة' : 'مؤقتة / غير معتمدة'}`, `المصدر: دفتر الأستاذ؛ الأرقام المسجلة فقط.`, `\n## النتائج بالدولار`];
    for (const row of data.changes) lines.push(`- ${LABELS[row.key]}: ${(row.current / 100).toFixed(2)}؛ المقارنة ${(row.previous / 100).toFixed(2)}؛ التغير ${percent(row.growth)}`);
    lines.push('\n## المؤشرات');
    for (const r of data.ratios) lines.push(`- ${r.title}: ${r.value == null ? `غير متاح — ${r.reason}` : `${r.unit === 'USD' ? (r.value / 100).toFixed(2) : r.value} ${r.unit}`}\n  الحساب: ${r.formula}`);
    lines.push('\n## التطور الشهري');
    for (const m of data.months) lines.push(`- ${m.key}: الإيراد ${(m.revenue / 100).toFixed(2)}؛ الصافي ${(m.netProfit / 100).toFixed(2)} USD`);
    lines.push('\n## المكاتب');
    for (const o of data.offices) lines.push(`- ${o.label}: الإيراد ${(o.revenue / 100).toFixed(2)}؛ النتيجة قبل توزيع المصاريف غير المنسوبة ${(o.netProfit / 100).toFixed(2)} USD`);
    lines.push('\n## الأنشطة — قبل المصاريف العامة وفروق الصرف');
    for (const a of data.activities) lines.push(`- ${a.title}: الإيراد ${(a.revenue / 100).toFixed(2)}؛ التكلفة ${(a.cost / 100).toFixed(2)}؛ الفرق ${(a.grossProfit / 100).toFixed(2)} USD`);
    lines.push('\n## بنود الإيرادات والمصاريف');
    for (const a of data.accounts) lines.push(`- ${a.code} ${a.name}: ${(a.current / 100).toFixed(2)} USD؛ من الإيراد ${percent(a.share)}؛ التغير ${percent(a.growth)}`);
    lines.push('\n## التنبيهات', ...data.insights.map((i: any) => `- ${i.text}`), '\n## الموازنة');
    for (const r of data.budget.rows) lines.push(`- ${r.code} ${r.name}: المستهدف ${(r.planned / 100).toFixed(2)}؛ الفعلي ${(r.actual / 100).toFixed(2)}؛ الفرق ${(r.variance / 100).toFixed(2)}`);
    lines.push('\n## النقد وحقوق الملكية', `- صافي التدفق: ${(data.cashFlow.net / 100).toFixed(2)} USD`, `- فرق تصالح التدفق: ${(data.cashFlow.unexplained / 100).toFixed(2)} USD`, `- حقوق الملكية أول الفترة: ${(data.equityChanges.opening / 100).toFixed(2)} USD`, `- حقوق الملكية آخر الفترة: ${(data.equityChanges.closing / 100).toFixed(2)} USD`, '\n## نقطة التعادل', data.breakEven.available ? `إيراد التعادل ${(data.breakEven.revenue / 100).toFixed(2)} USD؛ هامش الأمان ${percent(data.breakEven.safetyMargin)}` : data.breakEven.reason, '\n## المنهجية', ...data.methodology.map((s: string) => `- ${s}`), `\n## ملاحظات المحاسب\n${data.planning.notes || 'لا توجد ملاحظات'}`);
    download(`financial-analysis-${data.period.from}-${data.period.to}.md`, lines.join('\n'));
  };
  const exportAccounts = () => {
    const cell = (x: any) => `"${String(x ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    download(`analysis-accounts-${data.period.to}.csv`, [['الحساب', 'الاسم', 'الفترة الحالية USD', 'المقارنة USD', 'الفرق USD', 'التغير %', 'النسبة من الإيراد %'], ...data.accounts.map((r: any) => [r.code, r.name, r.current / 100, r.previous / 100, r.change / 100, r.growth, r.share])].map(row => row.map(cell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };
  const comparisonColumns: any[] = [
    { key: 'name', header: 'البند', render: (r: any) => r.name || LABELS[r.key] },
    { key: 'current', header: 'الفترة الحالية', numeric: true, render: (r: any) => <Money value={r.current} /> },
    { key: 'previous', header: 'فترة المقارنة', numeric: true, render: (r: any) => <Money value={r.previous} /> },
    { key: 'change', header: 'الفرق', numeric: true, render: (r: any) => <Money value={r.change} /> },
    { key: 'growth', header: 'التغير', render: (r: any) => percent(r.growth) },
  ];
  const classifications = config?.accounts.filter((a: any) => ['asset', 'liability'].includes(a.type) && `${a.code} ${a.name}`.includes(settingsSearch)) || [];
  const behaviorAccounts = config?.accounts.filter((a: any) => a.type === 'expense' && `${a.code} ${a.name}`.includes(settingsSearch)) || [];
  const budgetAccounts = config?.accounts.filter((a: any) => ['income', 'expense'].includes(a.type) && `${a.code} ${a.name}`.includes(budgetSearch)) || [];
  let projected: any = null;
  if (data?.breakEven.available) {
    const revenue = Math.round(data.summary.revenue * (1 + scenario.activity / 100));
    const variable = Math.round(data.breakEven.variable * (1 + scenario.activity / 100) * (1 + scenario.variable / 100));
    const fixed = Math.round(data.breakEven.fixed * (1 + scenario.fixed / 100));
    projected = { revenue, variable, fixed, operatingProfit: revenue - variable - fixed, netProfit: revenue - variable - fixed - data.summary.fx };
  }
  return <div className="financial-analysis">
    <PageHeader title="التحليل المالي" subtitle="اقرأ الأداء والسيولة والتكلفة من الدفاتر، وقارن الفترات وخطط للموازنة." actions={<Stack direction="row" sx={{ gap: 1 }}>{access.can('setup') && <Button disabled={!config || busy} onClick={editSettings}>إعدادات التحليل</Button>}<Button disabled={!data || busy} onClick={exportReport}>تنزيل التقرير MD</Button><Button disabled={!data || busy} onClick={exportAccounts}>تصدير CSV</Button><Button disabled={!data || busy} onClick={() => window.print()}>طباعة</Button></Stack>} />
    <Panel><FilterBar>
      {(['from', 'to'] as const).map(key => <TextField key={key} type="date" size="small" label={key === 'from' ? 'من تاريخ' : 'إلى تاريخ'} InputLabelProps={{ shrink: true }} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} />)}
      {(['previousFrom', 'previousTo'] as const).map(key => <TextField key={key} type="date" size="small" label={key === 'previousFrom' ? 'المقارنة من (اختياري)' : 'المقارنة إلى (اختياري)'} InputLabelProps={{ shrink: true }} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} />)}
      <Button variant="contained" disabled={busy || saving} onClick={() => load()}>{busy ? 'جارٍ التحليل…' : 'عرض التحليل'}</Button>
    </FilterBar><Sub>عند ترك المقارنة فارغة تُستخدم الفترة السابقة بنفس عدد الأيام. التحليل على مستوى الشركة، وتفصيل المكاتب أدناه.</Sub></Panel>
    {error && <Alert severity="error" className="mb-3">{error}</Alert>}{success && <Alert severity="success" className="mb-3" onClose={() => setSuccess('')}>{success}</Alert>}
    {data && <>
      <Alert severity={review?.status === 'approved' ? 'success' : 'info'} className="mb-3">حالة البيانات: {review?.status === 'approved' ? 'الفترة معتمدة محاسبيًا' : !review ? 'جارٍ التحقق من المراجعة؛ التقرير مؤقت' : review.status === 'unavailable' ? 'تعذر التحقق من الاعتماد؛ التقرير مؤقت' : `الفترة غير معتمدة${review.blocking ? `، ${review.blocking} بندًا يحتاج مراجعة` : ''}`}. المقارنة <Ltr>{data.period.previousFrom} — {data.period.previousTo}</Ltr>. {data.coverage.reliableFrom && <>بداية البيانات الموثوقة: <Ltr>{data.coverage.reliableFrom}</Ltr>.</>}</Alert>
      <div className="acc-noprint"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">{TABS.map(([key, label]) => <Tab key={key} value={key} label={label} />)}</Tabs></div>
      {tab === 'overview' && <>
        <StatGrid><Stat label="الإيرادات المسجلة" value={<Money value={data.summary.revenue} />} /><Stat label="صافي الربح المسجل" value={<Money value={data.summary.netProfit} />} tone={data.summary.netProfit < 0 ? 'danger' : 'accent'} /><Stat label="التدفق التشغيلي" value={<Money value={data.cashFlow.categories.find((r: any) => r.key === 'operating')?.total || 0} />} /><Stat label="هامش الربح" value={percent(data.ratios.find((r: any) => r.key === 'netMargin')?.value)} /></StatGrid>
        <Panel title="ما الذي يحتاج مراجعة؟">{data.insights.length ? data.insights.map((i: any, index: number) => <Alert key={index} severity={i.tone} sx={{ mb: 1 }}>{i.text}{i.action && <Button component={Link} to={i.action} size="small">فتح القسم</Button>}</Alert>) : <Typography>لا توجد تنبيهات آلية من هذه الحسابات. يبقى اعتماد الفترة ومراجعة اكتمال القيود مطلوبين.</Typography>}</Panel>
        <Panel title="اتجاه الإيرادات والربح" subtitle="الأشهر الجزئية تُعرض كما هي؛ العمود يمثل المبلغ المسجل في الفترة المختارة.">
          <div className="analysis-trend">{data.months.map((m: any) => {
            const max = Math.max(1, ...data.months.map((x: any) => Math.max(Math.abs(x.revenue), Math.abs(x.netProfit))));
            return <div className="analysis-trend__row" key={m.key}><strong>{m.key}</strong><div><span className="analysis-trend__bar" style={{ width: `${Math.abs(m.revenue) / max * 100}%` }} /><small>الإيراد <Money value={m.revenue} /></small><span className={`analysis-trend__bar ${m.netProfit < 0 ? 'analysis-trend__bar--loss' : 'analysis-trend__bar--profit'}`} style={{ width: `${Math.abs(m.netProfit) / max * 100}%` }} /><small>{m.netProfit < 0 ? 'خسارة' : 'ربح'} <Money value={m.netProfit} /></small></div></div>;
          })}</div>
        </Panel>
        <Panel flush title="المكاتب" subtitle="القيود غير المنسوبة لمكتب تظهر منفصلة، فلا توزع المصاريف العامة تلقائيًا."><DataTable rows={data.offices} rowKey={(r: any) => r.key} columns={[{ key: 'label', header: 'المكتب', render: (r: any) => r.label }, { key: 'revenue', header: 'الإيرادات', render: (r: any) => <Money value={r.revenue} /> }, { key: 'cost', header: 'التكلفة', render: (r: any) => <Money value={r.cost} /> }, { key: 'expenses', header: 'المصاريف والإهلاك', render: (r: any) => <Money value={r.expenses + r.depreciation} /> }, { key: 'netProfit', header: 'النتيجة قبل توزيع غير المنسوب', render: (r: any) => <Money value={r.netProfit} /> }, { key: 'margin', header: 'الهامش', render: (r: any) => percent(r.margin) }]} /></Panel>
        <Panel flush title="الأنشطة والخدمات" subtitle="حسب حسابات الإيراد والتكلفة المخصصة للأنشطة؛ النتائج قبل المصاريف العامة وفروق الصرف، وقد تتغير عند وصول تكاليف الموردين."><DataTable rows={data.activities} rowKey={(r: any) => r.key} columns={[{ key: 'title', header: 'النشاط', render: (r: any) => r.title }, { key: 'revenue', header: 'الإيراد', render: (r: any) => <Money value={r.revenue} /> }, { key: 'cost', header: 'التكلفة المسجلة', render: (r: any) => <Money value={r.cost} /> }, { key: 'grossProfit', header: 'الفرق قبل المصاريف العامة', render: (r: any) => <Money value={r.grossProfit} /> }, { key: 'margin', header: 'الهامش', render: (r: any) => percent(r.margin) }]} /></Panel>
        <Stack direction="row" sx={{ gap: 2, mb: 2 }}><Button component={Link} to="/accounting/reports?tab=trips">تحليل ربحية الرحلات</Button><Button component={Link} to="/accounting/reports?tab=purchases">تحليل ربحية المشتريات</Button></Stack>
      </>}
      {tab === 'comparisons' && <>
        <Panel flush title="التحليل الأفقي — مقارنة الفترات"><DataTable rows={data.changes} rowKey={(r: any) => r.key} columns={comparisonColumns} /></Panel>
        <Panel flush title="التحليل الرأسي والتفصيلي" subtitle="النسبة من إجمالي الإيرادات؛ اختلاف حجم الفترة أو عدم اكتمالها يؤثر على المقارنة."><DataTable rows={data.accounts} rowKey={(r: any) => r.accountId} columns={[...comparisonColumns.map((c, i) => i === 0 ? { ...c, render: (r: any) => <><Link to={`/accounting/accounts/${r.accountId}`}>{r.code} · {r.name}</Link><Sub>{LABELS[r.section]}</Sub></> } : c), { key: 'share', header: 'من الإيراد', render: (r: any) => percent(r.share) }]} /></Panel>
        <Panel flush title="التطور الشهري"><DataTable rows={data.months} rowKey={(r: any) => r.key} columns={[{ key: 'key', header: 'الشهر', render: (r: any) => r.key }, ...['revenue', 'cost', 'expenses', 'netProfit'].map(key => ({ key, header: LABELS[key], render: (r: any) => <Money value={r[key]} /> }))]} /></Panel>
      </>}
      {tab === 'ratios' && <Panel flush title="مؤشرات الربحية والسيولة والنشاط والمديونية" subtitle="لا توجد قيمة مثالية واحدة لكل الشركات. قارن النشاط والفترة والسياسات قبل الحكم."><DataTable rows={data.ratios} rowKey={(r: any) => r.key} columns={[{ key: 'title', header: 'المؤشر', render: (r: any) => r.title }, { key: 'value', header: 'النتيجة', render: (r: any) => r.value == null ? <span className="acc-muted">غير متاح</span> : r.unit === 'USD' ? <Money value={r.value} /> : `${r.value} ${r.unit}` }, { key: 'formula', header: 'طريقة الحساب', render: (r: any) => <>{r.formula}{r.reason && <Sub>{r.reason}</Sub>}</> }]} /></Panel>}
      {tab === 'cash' && <>
        <StatGrid><Stat label="النقد أول الفترة" value={<Money value={data.cashFlow.opening} />} /><Stat label="النقد آخر الفترة" value={<Money value={data.cashFlow.closing} />} /><Stat label="فرق التصالح" value={<Money value={data.cashFlow.unexplained} />} tone={data.cashFlow.unexplained ? 'danger' : undefined} /></StatGrid>
        <Panel flush title="مصادر النقد واستخداماته"><DataTable rows={data.cashFlow.categories} rowKey={(r: any) => r.key} columns={[{ key: 'title', header: 'النشاط', render: (r: any) => r.title }, { key: 'total', header: 'صافي التدفق', render: (r: any) => <Money value={r.total} /> }]} /></Panel>
        <Panel title="التغير في حقوق الملكية"><StatGrid><Stat label="أول الفترة" value={<Money value={data.equityChanges.opening} />} /><Stat label="نتيجة الفترة" value={<Money value={data.equityChanges.profit} />} /><Stat label="صافي الحركات الأخرى" value={<Money value={data.equityChanges.otherMovements} />} /><Stat label="آخر الفترة" value={<Money value={data.equityChanges.closing} />} /></StatGrid><Sub>صافي الحركات الأخرى يجمع رأس المال والسحوبات والتسويات؛ لا يفترض أنها كلها توزيعات أرباح.</Sub></Panel>
        <Panel flush title="حسابات حقوق الملكية — الأرصدة المباشرة"><DataTable rows={data.equityChanges.accounts} rowKey={(r: any) => r.accountId} columns={[{ key: 'name', header: 'الحساب', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'opening', header: 'أول الفترة', render: (r: any) => <Money value={r.opening} /> }, { key: 'change', header: 'التغير المباشر', render: (r: any) => <Money value={r.change} /> }, { key: 'closing', header: 'آخر الفترة', render: (r: any) => <Money value={r.closing} /> }]} /></Panel>
      </>}
      {tab === 'budget' && <>
        {!data.budget.rows.length && <Alert severity="info" sx={{ mb: 2 }}>لم تُدخل موازنة لهذه الفترة بالضبط. اختر إعدادها أدناه إذا كانت لديك صلاحية الإعداد.</Alert>}
        {!!data.budget.missing.length && <Alert severity="warning" sx={{ mb: 2 }}>الموازنة جزئية: {data.budget.missing.length} حسابًا له نشاط دون مستهدف؛ لا يُعرض ربح مستهدف شامل.</Alert>}
        {data.budget.complete && <StatGrid><Stat label="الربح المستهدف" value={<Money value={data.budget.summary.netProfit} />} /><Stat label="الربح الفعلي المسجل" value={<Money value={data.summary.netProfit} />} /><Stat label="فرق الربح" value={<Money value={data.summary.netProfit - data.budget.summary.netProfit} />} /></StatGrid>}
        <Panel flush title="مقارنة المستهدف بالفعلي" subtitle="الفرق = الفعلي − المستهدف؛ ارتفاع المصروف غير مواتٍ، وارتفاع الإيراد مواتٍ من ناحية هذا البند فقط."><DataTable rows={data.budget.rows} rowKey={(r: any) => r.accountId} columns={[{ key: 'name', header: 'البند', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'planned', header: 'المستهدف', render: (r: any) => <Money value={r.planned} /> }, { key: 'actual', header: 'الفعلي', render: (r: any) => <Money value={r.actual} /> }, { key: 'variance', header: 'الفرق', render: (r: any) => <Money value={r.variance} /> }, { key: 'variancePct', header: 'الانحراف', render: (r: any) => percent(r.variancePct) }, { key: 'favorable', header: 'اتجاه الفرق', render: (r: any) => r.favorable ? 'مواتٍ لهذا البند' : 'يحتاج مراجعة' }]} /></Panel>
        {plan && access.can('setup') && <Panel title="إعداد الموازنة والمعلومات الإضافية" subtitle={`بالدولار فقط للفترة المحملة ${plan.from} إلى ${plan.to}. اترك المستهدف فارغًا للحسابات غير المشمولة؛ الصفر يعني مستهدفًا صريحًا.`}>
          <FilterBar><TextField type="date" size="small" label="الموازنة من" InputLabelProps={{ shrink: true }} value={planRange.from} onChange={e => setPlanRange({ ...planRange, from: e.target.value })} /><TextField type="date" size="small" label="الموازنة إلى" InputLabelProps={{ shrink: true }} value={planRange.to} onChange={e => setPlanRange({ ...planRange, to: e.target.value })} /><Button disabled={saving || busy} onClick={loadPlan}>تحميل / إنشاء الموازنة</Button></FilterBar>
          <Sub>يمكن إعداد فترة مستقبلية هنا. المقارنة أعلى الشاشة تظل للفترة الفعلية المختارة، ولا تعرض توقعات كأرقام فعلية.</Sub>
          {(planRange.from !== plan.from || planRange.to !== plan.to) && <Alert severity="info">اضغط «تحميل / إنشاء الموازنة» قبل تعديل أو حفظ الفترة الجديدة.</Alert>}
          <TextField size="small" placeholder="بحث عن حساب الموازنة" value={budgetSearch} onChange={e => setBudgetSearch(e.target.value)} />
          <div className="analysis-editor"><DataTable rows={budgetAccounts} rowKey={(r: any) => r._id} columns={[{ key: 'name', header: 'الحساب', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'target', header: 'المستهدف USD', render: (r: any) => <TextField size="small" type="number" value={plan.amounts[r._id] ?? ''} onChange={e => setPlan({ ...plan, amounts: { ...plan.amounts, [r._id]: e.target.value } })} inputProps={{ step: '0.01' }} /> }]} /></div>
          <Typography fontWeight={700} sx={{ mt: 2 }}>معلومات نشاط اختيارية للمؤشرات</Typography><Sub>قيم مقاسة لنفس الفترة بالدولار، ليست تقديرات بدل القيود. الصفر يختلف عن عدم توفر المعلومات.</Sub>
          <div className="acc-form-grid">{[['creditSales', 'المبيعات الآجلة المعترف بها'], ['creditPurchases', 'المشتريات الآجلة'], ['inventoryCost', 'تكلفة المخزون المملوك المباع'], ['interestExpense', 'الفوائد المسجلة ضمن مصروفات الفترة']].map(([key, label]) => <TextField key={key} disabled={plan.to > day} type="number" label={`${label} USD`} value={plan[key]} onChange={e => setPlan({ ...plan, [key]: e.target.value })} inputProps={{ min: 0, step: '0.01' }} />)}</div>
          <TextField label="ملاحظات المحاسب والسياسات والبيانات الناقصة" fullWidth multiline minRows={3} value={plan.notes || ''} onChange={e => setPlan({ ...plan, notes: e.target.value })} sx={{ mt: 2 }} />
          <Button variant="contained" disabled={saving || busy || planRange.from !== plan.from || planRange.to !== plan.to} sx={{ mt: 2 }} onClick={savePlan}>{saving ? 'جارٍ الحفظ…' : 'حفظ الموازنة ومعلومات الفترة'}</Button>
        </Panel>}
      </>}
      {tab === 'scenarios' && <>
        {!data.breakEven.available ? <Alert severity="info">نقطة التعادل غير متاحة: {data.breakEven.reason}. {access.can('setup') && <Button onClick={editSettings}>إعداد سلوك المصاريف</Button>}</Alert> : <>
          <StatGrid><Stat label="المصاريف الثابتة" value={<Money value={data.breakEven.fixed} />} /><Stat label="التكاليف المتغيرة" value={<Money value={data.breakEven.variable} />} /><Stat label="إيراد التعادل التشغيلي" value={<Money value={data.breakEven.revenue} />} /><Stat label="هامش الأمان" value={percent(data.breakEven.safetyMargin)} /></StatGrid>
          <Panel title="سيناريو افتراضي للفترة نفسها" subtitle="نفترض تغير حجم النشاط والإيراد بنفس النسبة، والتكلفة المتغيرة تتبع النشاط. هذا حساب افتراضي وليس توقعًا مضمونًا. فروق الصرف تبقى كما هي.">
            {([['activity', 'تغير حجم النشاط والإيراد'], ['variable', 'تغير تكلفة المتغير لكل وحدة نشاط'], ['fixed', 'تغير المصاريف الثابتة']] as const).map(([key, label]) => <div key={key} className="analysis-slider"><Typography>{label}: {scenario[key]}%</Typography><Slider min={-100} max={100} value={scenario[key]} onChange={(_, value) => setScenario({ ...scenario, [key]: Number(value) })} valueLabelDisplay="auto" /></div>)}
            <StatGrid><Stat label="إيراد السيناريو" value={<Money value={projected.revenue} />} /><Stat label="الربح التشغيلي الافتراضي" value={<Money value={projected.operatingProfit} />} /><Stat label="الصافي الافتراضي" value={<Money value={projected.netProfit} />} /></StatGrid><Button onClick={() => setScenario({ activity: 0, variable: 0, fixed: 0 })}>إعادة الافتراضات للصفر</Button>
          </Panel>
        </>}
        {!!data.breakEven.unclassified.length && <Panel flush title="حسابات تحتاج تصنيف ثابت / متغير"><DataTable rows={data.breakEven.unclassified} rowKey={(r: any) => r.accountId} columns={[{ key: 'name', header: 'الحساب', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'amount', header: 'المبلغ', render: (r: any) => <Money value={r.amount} /> }]} /></Panel>}
      </>}
      {tab === 'method' && <>
        <Panel title="كيف تُقرأ النتائج؟"><ul>{data.methodology.map((s: string) => <li key={s}>{s}</li>)}</ul><Typography>التقرير يعطي حسابات وتنبيهات، ولا يحكم وحده على سلامة الشركة أو يتنبأ بالمستقبل. المقارنة بالقطاع تحتاج مصدرًا خارجيًا موثوقًا، ولا تُخترع معايير أو أسعار سوق.</Typography></Panel>
        <Panel title="إيضاحات المحاسب">{data.planning.notes || 'أضف السياسات والبيانات الناقصة من تبويب الموازنة ومعلومات الفترة.'}</Panel>
        {!!data.balance.unclassified.length && <Panel flush title="حسابات المركز المالي غير المصنفة"><DataTable rows={data.balance.unclassified} rowKey={(r: any) => r.accountId} columns={[{ key: 'name', header: 'الحساب', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'amount', header: 'الرصيد', render: (r: any) => <Money value={r.amount} /> }]} /></Panel>}
      </>}
    </>}
    <Dialog open={settingsOpen} onClose={() => !saving && setSettingsOpen(false)} maxWidth="lg" fullWidth>
      <DialogTitle>إعدادات التحليل المالي</DialogTitle><DialogContent>{settingsForm && <>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info">التصنيفات تخص التحليل فقط ولا تنقل أرصدة أو تعدل القيود. لا تصنف محفظة عميل كإيراد، أو شحنات العملاء كمخزون للشركة. الجاري مع مورد ليس بالضرورة نقدًا متاحًا.</Alert>
        <TextField type="date" label="تاريخ بداية البيانات الموثوقة" InputLabelProps={{ shrink: true }} value={settingsForm.reliableFrom} onChange={e => setSettingsForm({ ...settingsForm, reliableFrom: e.target.value })} sx={{ my: 2 }} helperText="أكد تاريخًا تكتمل البيانات منه فعلًا؛ الرصيد الافتتاحي لا يعيد إيرادات السنوات المفقودة." />
        <TextField size="small" placeholder="بحث بالاسم أو الرمز" value={settingsSearch} onChange={e => setSettingsSearch(e.target.value)} fullWidth sx={{ mb: 2 }} />
        <Typography fontWeight={700}>تصنيف الأصول والالتزامات</Typography>
        <DataTable rows={classifications} rowKey={(r: any) => r._id} columns={[{ key: 'name', header: 'الحساب', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'category', header: 'التصنيف', render: (r: any) => <TextField select size="small" fullWidth value={settingsForm.classifications[r._id] || ''} onChange={e => setSettingsForm({ ...settingsForm, classifications: { ...settingsForm.classifications, [r._id]: e.target.value } })}><MenuItem value="">غير مصنف</MenuItem>{Object.entries(config.categories).filter(([key]) => r.type === 'liability' ? key.endsWith('liability') || key === 'trade_payables' : !key.endsWith('liability') && key !== 'trade_payables').map(([key, label]) => <MenuItem key={key} value={key}>{String(label)}</MenuItem>)}</TextField> }]} />
        <Typography fontWeight={700} sx={{ mt: 3 }}>سلوك المصاريف لنقطة التعادل</Typography><Sub>الحساب المختلط يحتاج فصلًا إلى حسابات ثابتة ومتغيرة؛ لن نضع نسبة اعتباطية.</Sub>
        <DataTable rows={behaviorAccounts} rowKey={(r: any) => r._id} columns={[{ key: 'name', header: 'حساب المصروف', render: (r: any) => `${r.code} · ${r.name}` }, { key: 'behavior', header: 'السلوك', render: (r: any) => <TextField select size="small" fullWidth value={settingsForm.costBehavior[r._id] || ''} onChange={e => setSettingsForm({ ...settingsForm, costBehavior: { ...settingsForm.costBehavior, [r._id]: e.target.value } })}><MenuItem value="">غير مصنف</MenuItem><MenuItem value="fixed">ثابت</MenuItem><MenuItem value="variable">متغير</MenuItem></TextField> }]} />
      </>}</DialogContent><DialogActions><Button disabled={saving} onClick={() => setSettingsOpen(false)}>إلغاء</Button><Button variant="contained" disabled={saving} onClick={saveSettings}>حفظ الإعدادات</Button></DialogActions>
    </Dialog>
  </div>;
};
export default FinancialAnalysis;
