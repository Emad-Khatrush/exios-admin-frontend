import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, TextField,
} from '@mui/material';
import { Download, Play, Upload } from 'lucide-react';
import { EVENT_LABELS, acc, errorText, todayLibya } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { AccountRef, Badge, DataTable, Ltr, Money, Notice, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

const RUN_STATUS: Record<string, { label: string; tone: any }> = {
  running: { label: 'يعمل الآن', tone: 'info' },
  review: { label: 'بانتظار المراجعة', tone: 'warn' },
  failed: { label: 'فشل', tone: 'danger' },
  discarded: { label: 'أُلغي', tone: 'muted' },
  committing: { label: 'جارٍ الاعتماد', tone: 'info' },
  committed: { label: 'مُعتمد', tone: 'ok' },
};
const PHASES: Record<string, string> = {
  rates: 'تجهيز الأسعار', replay: 'إعادة تشغيل العمليات', final: 'مطابقة الطلبات', reconcile: 'مطابقة المحافظ والخزائن', done: 'اكتمل',
};
const SOURCES: Record<string, string> = {
  order: 'طلب', orderEdit: 'تعديل فاتورة', orderCancel: 'إلغاء طلب', legacyReceived: 'مبلغ مستلم على الطلب', purchaseItem: 'تكلفة شراء',
  delivery: 'تسليم طرد', statement: 'حركة محفظة', cashPayment: 'دفع نقدي', debt: 'دين', debtWriteOff: 'شطب دين', tripExpense: 'مصروف رحلة',
  legacyExpense: 'مصروف قديم', legacyIncome: 'إيراد قديم', finalSync: 'مطابقة طلب', walletAdjust: 'تسوية محفظة', openingCash: 'رصيد افتتاحي',
  suspenseClose: 'إقفال المعلّق',
};
const ACTIVE = ['running', 'review', 'committing'];

const pick = (row: any, names: string[]) => {
  const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()));
  return key ? row[key] : undefined;
};
const toDayString = (value: any) => {
  if (value instanceof Date) return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return text;
};
const readSheet = async (file: File): Promise<any[]> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
};
const download = (rows: any[], name: string) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Sheet1');
  XLSX.writeFile(workbook, name);
};
const dateText = (value: any) => (value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Tripoli', dateStyle: 'short', timeStyle: 'short' }) : '');
const dayText = (value: any) => (value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli' }).format(new Date(value)) : '-');

// The historical migration (spec 6-أ): prepare, dry run, review the report, then commit or discard
const Migration = () => {
  const navigate = useNavigate();
  const { accounts } = useAccountingData();
  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive && !a.isGroup), [accounts]);
  const [overview, setOverview] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [costAccounts, setCostAccounts] = useState<any[]>([]);
  const [closeSuspense, setCloseSuspense] = useState(true);
  const [countDay, setCountDay] = useState(todayLibya());
  const [confirm, setConfirm] = useState<'commit' | 'discard' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const timer = useRef<any>();

  const loadRun = async (runId: string) => {
    const res = await acc.get(`migration/runs/${runId}`);
    setRun(res.data);
    return res.data;
  };

  const load = async () => {
    try {
      const res = await acc.get('migration');
      setOverview(res.data);
      const current = res.data.runs.find((r: any) => ACTIVE.includes(r.status)) || res.data.runs.find((r: any) => ['committed', 'failed'].includes(r.status));
      if (current) await loadRun(current.runId);
      else setRun(null);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  useEffect(() => { load(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While the server works on the run, its progress is polled
  useEffect(() => {
    clearTimeout(timer.current);
    if (!run || !['running', 'committing'].includes(run.status)) return;
    timer.current = setTimeout(async () => {
      try {
        const fresh = await loadRun(run.runId);
        if (!['running', 'committing'].includes(fresh.status)) await load();
      } catch { /* next tick retries */ }
    }, 3000);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: () => Promise<any>, success?: string) => {
    try {
      setIsBusy(true);
      setMessage(null);
      await action();
      if (success) setMessage({ type: 'success', text: success });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response ? errorText(err) : err.message });
    }
    setIsBusy(false);
    await load();
  };

  const importRates = (file?: File) => file && act(async () => {
    const rows = (await readSheet(file)).map((row) => ({
      currency: String(pick(row, ['currency', 'العملة']) || 'LYD').trim().toUpperCase(),
      day: toDayString(pick(row, ['day', 'date', 'التاريخ', 'اليوم'])),
      rate: Number(pick(row, ['rate', 'السعر'])),
    }));
    if (!rows.length) throw new Error('الملف فارغ. الأعمدة المطلوبة: currency, day, rate.');
    const { data } = await acc.post('rates/import', { rows });
    setMessage({
      type: data.invalid.length ? 'warning' : 'success',
      text: `الأسعار: أُضيف ${data.created}، حُدّث ${data.updated}، بقي ${data.keptUsed} مستخدماً كما هو${data.invalid.length ? ` · سطور غير صالحة: ${data.invalid.slice(0, 20).join('، ')}` : ''}.`,
    });
  });

  const downloadCostTemplate = () => act(async () => {
    const { data } = await acc.get('migration/cost-template');
    if (!data.results.length) throw new Error('لا توجد رحلات بمصاريف ولا طلبات بتكاليف شراء قديمة.');
    download(data.results.map((row: any) => ({
      kind: row.kind, key: row.key,
      totals: Object.entries(row.totals).map(([currency, total]) => `${total} ${currency}`).join(' + '),
      accountCode: '',
    })), 'exios-old-costs-cash-boxes.xlsx');
  });

  const importCostAccounts = async (file?: File) => {
    if (!file) return;
    try {
      const rows = (await readSheet(file)).map((row) => ({
        kind: String(pick(row, ['kind', 'النوع']) || '').trim(),
        key: String(pick(row, ['key', 'المرجع']) || '').trim(),
        accountCode: String(pick(row, ['accountcode', 'account', 'الحساب', 'الخزينة']) || '').trim(),
      })).filter((row) => row.key && row.accountCode);
      setCostAccounts(rows);
      setMessage({ type: 'success', text: `قُرئ ${rows.length} سطر ربط. تُطبَّق عند بدء التشغيل التجريبي.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const start = () => act(async () => {
    const openingCounts = Object.entries(counts).filter(([, amount]) => amount !== '').map(([accountId, amount]) => ({ accountId, amount: Number(amount) }));
    await acc.post('migration/runs', { costAccounts, openingCounts, countDay, closeSuspense });
  });

  const decide = () => {
    const action = confirm;
    setConfirm(null);
    setAgreed(false);
    if (action === 'commit') return act(() => acc.post(`migration/runs/${run.runId}/commit`), 'اعتُمد الترحيل التاريخي. كل عملية جديدة في المنظومة تُرحَّل الآن تلقائياً.');
    return act(() => acc.post(`migration/runs/${run.runId}/discard`), 'أُلغي التشغيل وحُذف كل ما كتبه. يمكنك تصحيح البيانات وإعادة التشغيل.');
  };

  const committed = !!overview?.migrationDate;
  const active = run && ACTIVE.includes(run.status);
  const report = run?.report;
  const warnings = overview?.warnings || {};
  const progress = run?.progress;
  const percent = progress?.total ? Math.round((progress.done / progress.total) * 100) : undefined;

  return (
    <>
      <PageHeader
        title="الترحيل التاريخي"
        subtitle="يعيد تشغيل كل عمليات المنظومة منذ أول سجل بتواريخها الأصلية لبناء الدفاتر. التشغيل تجريبي أولاً: راجع التقرير ثم اعتمده أو ألغِه وأعد التشغيل."
      />
      <Notice message={message} onClose={() => setMessage(null)} />

      {committed && (
        <Alert severity="success" className="mb-3">
          اعتُمد الترحيل التاريخي بتاريخ <Ltr>{overview.migrationDate}</Ltr>. الترحيل الحي {overview.liveEnabled ? 'مفعّل' : 'متوقف'}، ولا يمكن تشغيل الترحيل التاريخي مرة أخرى.
        </Alert>
      )}

      <StatGrid>
        <Stat label="أقدم سجل" value={<Ltr>{dayText(overview?.oldest)}</Ltr>} hint="بداية التاريخ المحاسبي" tone="accent" />
        <Stat label="حركات المحافظ" value={overview?.counts?.statements ?? '-'} hint={`${overview?.counts?.cashPayments ?? 0} دفعة نقدية على الطلبات`} />
        <Stat label="الطلبات" value={overview?.counts?.orders ?? '-'} hint={`${overview?.counts?.debts ?? 0} دين`} />
        <Stat label="الرحلات" value={overview?.counts?.trips ?? '-'} hint={`${overview?.counts?.expenses ?? 0} مصروف و${overview?.counts?.incomes ?? 0} إيراد من الشاشات القديمة`} />
      </StatGrid>

      {!committed && !active && (
        <>
          <Panel title="ما يحتاج انتباهك في البيانات القديمة" subtitle="لا يمنع أيٌّ منها التشغيل؛ كل حالة تُعالَج بافتراض يُذكر في التقرير.">
            <ul className="acc-muted mb-0">
              <li>{warnings.lydDaysWithoutRate ?? 0} يوماً فيه حركات بالدينار بلا سعر يومي: يُشتق السعر من عمليات اليوم نفسه أو أقرب يوم قبله. ارفع ملف الأسعار لتفادي ذلك.</li>
              <li>{warnings.depositsWithoutOffice ?? 0} إيداعاً و{warnings.cashPaymentsWithoutOffice ?? 0} دفعة نقدية بلا خزينة محددة: تُسجَّل في حساب المعلّق.</li>
              <li>{warnings.tripsWithoutExpenses ?? 0} رحلة بلا مصاريف و{warnings.purchasesWithoutItems ?? 0} فاتورة شراء بلا تكلفة: ربحها سيظهر أعلى من الحقيقة.</li>
              <li>{warnings.deliveredWithoutDate ?? 0} طلباً فيه طرود مسلّمة بلا تاريخ تسليم: يُؤخذ التاريخ من سجل النشاط أو الفاتورة أو آخر تحديث.</li>
            </ul>
          </Panel>

          <Panel title="1. الأسعار التاريخية (اختياري)" subtitle="ملف Excel بالأعمدة currency, day, rate. السعر = عدد وحدات العملة مقابل دولار واحد.">
            <div className="d-flex gap-2 flex-wrap">
              <Button variant="outlined" startIcon={<Download size={16} />} onClick={() => download([{ currency: 'LYD', day: '2024-01-01', rate: 7.2 }], 'exios-historical-rates.xlsx')}>تنزيل القالب</Button>
              <Button variant="outlined" component="label" startIcon={<Upload size={16} />} disabled={isBusy}>رفع ملف الأسعار<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { importRates(e.target.files?.[0]); e.target.value = ''; }} /></Button>
            </div>
          </Panel>

          <Panel title="2. من أي خزينة دُفعت التكاليف القديمة؟ (اختياري)" subtitle="نزّل القائمة المعبأة بالرحلات والطلبات، اكتب كود الخزينة في عمود accountCode ثم ارفعها. ما يبقى فارغاً يُسجَّل في حساب المعلّق.">
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <Button variant="outlined" startIcon={<Download size={16} />} disabled={isBusy} onClick={downloadCostTemplate}>تنزيل القائمة</Button>
              <Button variant="outlined" component="label" startIcon={<Upload size={16} />}>رفع ملف الربط<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { importCostAccounts(e.target.files?.[0]); e.target.value = ''; }} /></Button>
              {costAccounts.length > 0 && <Badge tone="ok">{costAccounts.length} سطر ربط جاهز</Badge>}
            </div>
          </Panel>

          <Panel flush title="3. جرد الخزائن والبنوك" subtitle="اختر تاريخ الجرد، ثم اكتب ما كان في كل حساب في نهاية ذلك اليوم بعملته. رصيد الحساب في الدفاتر سيساوي هذا المبلغ في ذلك التاريخ بالضبط: حركات المنظومة قبله تُرحَّل كما هي، والفرق بينها وبين جردك يُسوّى بقيد واحد في تاريخ الجرد. ما بعده من حركات يُضاف فوقه. الحساب المتروك فارغاً يبدأ من حركاته فقط.">
            <div className="px-3 pb-2 d-flex gap-2 align-items-center flex-wrap">
              <TextField type="date" label="تاريخ الجرد" InputLabelProps={{ shrink: true }} inputProps={{ max: todayLibya() }} value={countDay} onChange={(e) => setCountDay(e.target.value)} />
              <span className="acc-muted">هذا هو التاريخ الذي تطابق عليه: افتح كشف أي خزينة حتى هذا اليوم وستجد رصيدها يساوي ما كتبته.</span>
            </div>
            <DataTable
              dense
              rows={cashAccounts}
              rowKey={(row: any) => row._id}
              empty={{ title: 'لا توجد خزائن' }}
              columns={[
                { key: 'account', header: 'الحساب', render: (row: any) => <AccountRef code={row.code} name={row.name} /> },
                { key: 'currency', header: 'العملة', render: (row: any) => <Ltr>{row.currency || 'USD'}</Ltr> },
                {
                  key: 'amount', header: 'المبلغ الفعلي', align: 'end', width: 200,
                  render: (row: any) => <TextField type="number" placeholder="لم يُجرد" value={counts[row._id] ?? ''} onChange={(e) => setCounts({ ...counts, [row._id]: e.target.value })} />,
                },
              ]}
            />
          </Panel>

          <Panel title="يوم التشغيل الحقيقي (مرة واحدة)" subtitle="يتوقف الإدخال في المنظومة نحو ساعتين، بهذا الترتيب. لا يُعاد فتح الإدخال قبل تفعيل الترحيل الحي.">
            <ol className="acc-steps" style={{ paddingInlineStart: 20, lineHeight: 1.9, margin: 0 }}>
              <li>إيقاف الإدخال في المنظومة (إبلاغ كل الموظفين).</li>
              <li>نسخة احتياطية كاملة: <Ltr>npm run db:backup</Ltr> (على جهاز فيه MongoDB Database Tools)، ثم تجربة استعادتها محلياً: <Ltr>npm run db:restore-local -- backups/الملف.archive.gz</Ltr> ومقارنة الأعداد.</li>
              <li>تشغيل الإعداد على القاعدة الحقيقية: <Ltr>npm run accounting:setup</Ltr>.</li>
              <li>تشغيل تجريبي أخير من هذه الصفحة (الخطوة 4).</li>
              <li>مقارنة الإجماليات (النتائج لكل سنة، المعلّق، فروقات المحافظ) بالتشغيل الذي اعتمدته على النسخة.</li>
              <li>نسخة احتياطية ثانية قبل الاعتماد.</li>
              <li>اعتماد الترحيل: يُضبط وقت الانتقال بدقة، ويبدأ الترحيل الحي تلقائياً.</li>
              <li>إعادة فتح الإدخال، ثم مراجعة «المطابقة والاستثناءات» (فحص «عملية بعد لحظة الانتقال لم تُسجَّل» يجب أن يكون صفراً).</li>
            </ol>
          </Panel>

          <Panel title="4. التشغيل التجريبي" subtitle="يكتب القيود تحت رقم تشغيل ويحجز الفترة التاريخية حتى تعتمده أو تلغيه. يمكن إلغاؤه وإعادته بلا حد.">
            <FormControlLabel
              control={<Checkbox checked={closeSuspense} onChange={(e) => setCloseSuspense(e.target.checked)} />}
              label="البدء من أرصدة الجرد: إقفال معلّق الفترة التاريخية في الرصيد الافتتاحي"
            />
            <p className="acc-muted" style={{ maxWidth: '78ch' }}>
              مناسب إن كنت لا تعرف من أي خزينة أو مكتب دخلت وخرجت المبالغ القديمة. الخزائن تبدأ بما جردته اليوم، وكل ما لم يُعرف طرفه قبل اليوم يُقفل مرة واحدة مقابل الرصيد الافتتاحي،
              فتبدأ وحساب المعلّق صفر. الإيرادات والتكاليف وأرصدة العملاء التاريخية تُرحَّل كما هي. ألغِ هذا الخيار فقط إن أردت توجيه البنود القديمة بنداً بنداً من شاشة «تسوية المعلّق».
            </p>
            <Button variant="contained" startIcon={<Play size={16} />} disabled={isBusy || !overview} onClick={start}>بدء التشغيل التجريبي</Button>
          </Panel>
        </>
      )}

      {run && (
        <Panel
          title={<>التشغيل <Ltr>{run.runId}</Ltr> <Badge tone={RUN_STATUS[run.status]?.tone}>{RUN_STATUS[run.status]?.label || run.status}</Badge></>}
          subtitle={<>بدأ {dateText(run.startedAt)}{run.message ? ` · ${run.message}` : ''}</>}
          actions={(
            <>
              {(run.status === 'review' || run.status === 'failed') && <Button color="error" variant="outlined" disabled={isBusy} onClick={() => setConfirm('discard')}>إلغاء التشغيل</Button>}
              {run.status === 'review' && <Button variant="contained" disabled={isBusy} onClick={() => setConfirm('commit')}>اعتماد الترحيل</Button>}
            </>
          )}
        >
          {['running', 'committing'].includes(run.status) && (
            <>
              <div className="acc-muted mb-2">{PHASES[progress?.phase] || 'جارٍ التحضير'}{progress?.total ? <> · <Ltr>{progress.done} / {progress.total}</Ltr></> : null}</div>
              <LinearProgress variant={percent === undefined ? 'indeterminate' : 'determinate'} value={percent} />
              {run.status === 'running' && <Button className="mt-3" size="small" color="error" disabled={isBusy} onClick={() => setConfirm('discard')}>التشغيل متوقف بعد إعادة تشغيل الخادم؟ ألغِه</Button>}
            </>
          )}
          {report && (
            <StatGrid>
              <Stat label="القيود المُنشأة" value={report.entries} hint={`من ${report.events} عملية`} />
              <Stat label="توازن الدفاتر" value={report.balanced ? 'متوازنة' : 'غير متوازنة'} tone={report.balanced ? undefined : 'danger'} hint={<Money value={report.totals?.debit} />} />
              <Stat
                label="حساب المعلّق"
                value={<Money value={report.suspenseBalance} />}
                hint={report.suspenseClosed ? <>أُقفل <Money value={report.suspenseClosed} /> في الرصيد الافتتاحي</> : 'يصفّره المحاسب بعد الاعتماد'}
                tone={report.suspenseBalance ? 'warn' : undefined}
              />
              <Stat label="سجلات تعذّر ترحيلها" value={run.problems?.length || 0} tone={run.problems?.length ? 'danger' : undefined} hint="مفصّلة في الأسفل" />
            </StatGrid>
          )}
        </Panel>
      )}

      {report && (
        <>
          <Panel flush title="النتائج لكل سنة" subtitle="الإيراد المعترف به، تكلفته، والمصروفات. التكاليف غير المسجلة قديماً تُظهر ربحاً أعلى من الحقيقة.">
            <DataTable
              dense
              rows={report.years || []}
              rowKey={(row: any) => row.year}
              columns={[
                { key: 'year', header: 'السنة', render: (row: any) => <Ltr>{row.year}</Ltr> },
                { key: 'revenue', header: 'الإيرادات', numeric: true, render: (row: any) => <Money value={row.revenue} /> },
                { key: 'costOfSales', header: 'تكلفة الإيرادات', numeric: true, render: (row: any) => <Money value={row.costOfSales} /> },
                { key: 'grossProfit', header: 'مجمل الربح', numeric: true, render: (row: any) => <Money value={row.grossProfit} /> },
                { key: 'expenses', header: 'المصروفات', numeric: true, render: (row: any) => <Money value={row.expenses} /> },
                { key: 'netProfit', header: 'صافي الربح', numeric: true, render: (row: any) => <Money value={row.netProfit} strong /> },
              ]}
            />
          </Panel>

          <Panel flush title="القيود حسب نوع العملية">
            <DataTable
              dense
              rows={report.byEventType || []}
              rowKey={(row: any) => row.eventType}
              columns={[
                { key: 'eventType', header: 'النوع', render: (row: any) => EVENT_LABELS[row.eventType] || (row.eventType === 'MIGRATION_ADJUST' ? 'تسوية ترحيل' : row.eventType) },
                { key: 'count', header: 'عدد القيود', numeric: true },
                { key: 'amount', header: 'الإجمالي', numeric: true, render: (row: any) => <Money value={row.amount} /> },
              ]}
            />
          </Panel>

          {report.suspenseBreakdown?.length > 0 && (
            <Panel
              flush
              title="ما مرّ بحساب المعلّق"
              subtitle={report.suspenseClosed !== null && report.suspenseClosed !== undefined
                ? 'مبالغ لم يُعرف طرفها الآخر (خزينة أو طلب). أُقفل صافيها في الرصيد الافتتاحي لأنك اخترت البدء من أرصدة الجرد.'
                : 'مبالغ لم يُعرف طرفها الآخر (خزينة أو طلب). تبقى بنوداً مفتوحة في شاشة «تسوية المعلّق» بعد الاعتماد.'}
            >
              <DataTable
                dense
                rows={report.suspenseBreakdown}
                rowKey={(row: any) => row.eventType}
                columns={[
                  { key: 'eventType', header: 'نوع العملية', render: (row: any) => EVENT_LABELS[row.eventType] || (row.eventType === 'MIGRATION_ADJUST' ? 'تسوية ترحيل' : row.eventType) },
                  { key: 'count', header: 'عدد البنود', numeric: true },
                  { key: 'net', header: 'الصافي', numeric: true, render: (row: any) => <Money value={row.net} strong /> },
                ]}
              />
            </Panel>
          )}

          {report.openingCash?.some((row: any) => row.uncounted) && (
            <Alert severity="warning" className="mb-3">
              <b>خزائن لم تُجرد.</b>{' '}
              هذه الحسابات فيها رصيد في الدفاتر ولم يُكتب لها جرد، فبقيت على ما سجلته المنظومة:{' '}
              {report.openingCash.filter((row: any) => row.uncounted).map((row: any) => `${row.code} ${row.name}`).join('، ')}.
              اجردها قبل يوم التشغيل واكتب رصيدها (صفر إن كانت فارغة)، ثم أعد التشغيل التجريبي.
            </Alert>
          )}
          {report.openingCash?.length > 0 && (
            <Panel
              flush
              title={<>أرصدة الخزائن بتاريخ الجرد <Ltr>{report.openingCash[0].countDay}</Ltr></>}
              subtitle="رصيد كل خزينة في الدفاتر في هذا التاريخ هو ما كتبته أنت في الجرد (العمود الأخير). كل حركات المنظومة قبله مُرحَّلة كما هي، وما لم تفسّره تلك الحركات سُوّي بقيد واحد في تاريخ الجرد مقابل الرصيد الافتتاحي."
            >
              <DataTable
                dense
                rows={report.openingCash.filter((row: any) => !row.uncounted)}
                rowKey={(row: any) => row.accountId}
                columns={[
                  { key: 'account', header: 'الحساب', render: (row: any) => <AccountRef code={row.code} name={row.name} /> },
                  { key: 'booked', header: 'حسب حركات المنظومة', numeric: true, render: (row: any) => <Money value={row.booked} currency={row.currency} tone="plain" /> },
                  { key: 'opening', header: 'فرق سُوّي بقيد', numeric: true, render: (row: any) => (row.opening ? <Money value={row.opening} currency={row.currency} /> : <span className="acc-muted">مطابق</span>) },
                  { key: 'counted', header: 'الرصيد في الدفاتر = جردك', numeric: true, render: (row: any) => <Money value={row.counted} currency={row.currency} strong /> },
                  { key: 'sheet', header: 'ورقة الجرد', align: 'end', render: (row: any) => (row.entryId ? <AttachSheet entryId={row.entryId} /> : null) },
                ]}
              />
            </Panel>
          )}

          <Panel flush title={`فروقات المحافظ (${report.walletDifferencesCount || 0})`} subtitle="رصيد المحفظة في المنظومة لا يفسّره تاريخ الحركات (سجلات حُذفت أو تعديل يدوي قديم). سُوّي الفرق مقابل حساب المعلّق.">
            <DataTable
              dense
              maxHeight={360}
              rows={report.walletDifferences || []}
              rowKey={(row: any) => `${row.partnerId}${row.currency}`}
              empty={{ title: 'كل المحافظ مطابقة' }}
              columns={[
                { key: 'customer', header: 'العميل', render: (row: any) => (row.customer ? <><Open to={`/user/${row.partnerId}`}>{row.customer.firstName} {row.customer.lastName}</Open><Sub><Ltr>{row.customer.customerId}</Ltr></Sub></> : <Ltr>{row.partnerId}</Ltr>) },
                { key: 'system', header: 'في المنظومة', numeric: true, render: (row: any) => <Money value={row.system} currency={row.currency} /> },
                { key: 'booked', header: 'من التاريخ', numeric: true, render: (row: any) => <Money value={row.booked} currency={row.currency} /> },
                { key: 'difference', header: 'الفرق', numeric: true, render: (row: any) => <Money value={row.difference} currency={row.currency} strong />, sortValue: (row: any) => Math.abs(row.difference) },
              ]}
            />
          </Panel>

          {[
            { data: report.deliveredUnpaid, title: 'مسلّمة وغير مسددة', hint: 'طرود سُلّمت ولم تُسدد: إيرادها مؤجل حتى السداد.' },
            { data: report.unpaidClaims, title: 'مطالبات مفتوحة أخرى', hint: 'فواتير شراء وطرود غير مسلّمة عليها رصيد.' },
            { data: report.overpaid, title: 'مدفوعة بأكثر من قيمتها', hint: 'دُفع عليها أكثر من المطالبة؛ غالباً دفعة مكررة أو سعر تغيّر بعد الدفع.' },
          ].map(({ data, title, hint }) => (data?.count > 0 ? (
            <Panel key={title} flush title={`${title} (${data.count})`} subtitle={<>{hint} الإجمالي <Money value={data.total} />{data.count > data.list.length ? ` · تُعرض أكبر ${data.list.length}` : ''}</>}>
              <DataTable
                dense
                maxHeight={320}
                rows={data.list}
                rowKey={(row: any) => row.arKey}
                columns={[
                  { key: 'order', header: 'الطلب', render: (row: any) => <Open to={row.kind === 'GEN' ? '/balances' : `/invoice/${row.arKey.split(':')[1]}/edit`}><Ltr>{row.orderNumber || row.arKey}</Ltr></Open> },
                  { key: 'kind', header: 'النوع', render: (row: any) => (row.kind === 'SHP' ? <>شحن <Ltr>{row.tracking}</Ltr></> : row.kind === 'PUR' ? 'فاتورة شراء' : 'دين') },
                  { key: 'open', header: 'الرصيد', numeric: true, render: (row: any) => <Money value={row.open} /> },
                ]}
              />
            </Panel>
          ) : null))}

          {report.purchasesWithoutCost?.length > 0 && (
            <Panel flush title={`فواتير شراء مسددة بلا أي تكلفة (${report.purchasesWithoutCost.length})`} subtitle="ربح 100% يعني غالباً تكلفة لم تُسجَّل. أضف فاتورة مورد بتاريخها القديم بعد الاعتماد.">
              <DataTable
                dense
                maxHeight={320}
                rows={report.purchasesWithoutCost}
                rowKey={(row: any) => row.orderId}
                columns={[
                  { key: 'order', header: 'الطلب', render: (row: any) => <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open> },
                  { key: 'revenue', header: 'الإيراد', numeric: true, render: (row: any) => <Money value={row.revenue} /> },
                ]}
              />
            </Panel>
          )}

          {report.tripsWithoutCost?.length > 0 && (
            <Panel flush title={`رحلات بلا أي تكلفة (${report.tripsWithoutCost.length})`}>
              <DataTable
                dense
                maxHeight={320}
                rows={report.tripsWithoutCost}
                rowKey={(row: any) => row.tripId}
                columns={[
                  { key: 'voyage', header: 'الرحلة', render: (row: any) => <Open to={`/inventory/${row.tripId}/edit`}><Ltr>{row.voyage}</Ltr></Open> },
                  { key: 'type', header: 'النوع', render: (row: any) => (row.shippingType === 'air' ? 'جوي' : row.shippingType === 'sea' ? 'بحري' : 'داخلي') },
                  { key: 'date', header: 'التاريخ', render: (row: any) => <Ltr>{dayText(row.date)}</Ltr> },
                ]}
              />
            </Panel>
          )}

          {report.overpaidSettled?.count > 0 && (
            <Panel flush title={`دفع زائد سُجّل إيرادات أخرى (${report.overpaidSettled.count})`} subtitle={<>ما دفعه العميل على طلب فوق كل ما عليه (جمرك من المحفظة، دين على الطلب أكبر من فاتورته…). سُجّل إيرادات أخرى على نفس الطلب. راجِع القائمة: ما كان خطأً يُعاد للعميل. الإجمالي <Money value={report.overpaidSettled.total} /></>}>
              <DataTable
                dense
                maxHeight={320}
                rows={report.overpaidSettled.list || []}
                rowKey={(row: any) => row.arKey}
                columns={[
                  { key: 'order', header: 'الطلب', render: (row: any) => (row.orderId ? <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open> : 'دين عام') },
                  { key: 'kind', header: 'المطالبة', render: (row: any) => ({ PUR: 'فاتورة شراء', SHP: 'شحن', GEN: 'دين' } as any)[row.arKey.split(':')[0]] || row.arKey },
                  { key: 'amount', header: 'الزائد', numeric: true, render: (row: any) => <Money value={row.amount} /> },
                ]}
              />
            </Panel>
          )}

          {report.unsurePaid?.count > 0 && (
            <Panel flush title={`طلبات غير مؤكدة عليها دفعات (${report.unsurePaid.count})`} subtitle="دُفع عليها وهي غير مؤكدة. لا تُحسب إيراداً؛ ما دُفع يبقى رصيداً للعميل على الطلب. صحّحها يدوياً: أكّد الطلب إن كان حقيقياً، أو صحّح الدفعة. تظهر أيضاً في المطابقة والاستثناءات.">
              <DataTable
                dense
                rows={report.unsurePaid.list || []}
                rowKey={(row: any) => String(row.orderId)}
                columns={[
                  { key: 'order', header: 'الطلب', render: (row: any) => <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open> },
                  { key: 'total', header: 'قيمة الفاتورة', numeric: true, render: (row: any) => <Ltr>{row.totalInvoice}$</Ltr> },
                  { key: 'paid', header: 'المدفوع', numeric: true, render: (row: any) => <Money value={row.paid} /> },
                ]}
              />
            </Panel>
          )}

          {report.debtsWithoutSource?.count > 0 && (
            <Panel title={`ديون عامة قديمة بلا مصدر (${report.debtsWithoutSource.count})`} subtitle="لا يُعرف من أي خزينة خرج مالها، فسُجّلت مقابل حساب المعلّق (لا كإيراد)، وتُقفل معه في الرصيد الافتتاحي إن اخترت ذلك.">
              <p className="acc-muted m-0">الإجمالي <Money value={report.debtsWithoutSource.usd} /></p>
            </Panel>
          )}

          {report.refunds && (report.refunds.linkedToOrders.count > 0 || report.refunds.toRefundsExpense.count > 0) && (
            <Panel title="ريفاند الموردين المضاف للمحافظ" subtitle="ما ارتبط بطلب خفّض مبيعات ذلك الطلب؛ وما لم يرتبط بقي في «مبالغ مستردة للعملاء».">
              <StatGrid>
                <Stat label="مرتبط بطلب" value={report.refunds.linkedToOrders.count} hint={<Money value={report.refunds.linkedToOrders.usd} />} />
                <Stat label="غير مرتبط (520200)" value={report.refunds.toRefundsExpense.count} hint={<Money value={report.refunds.toRefundsExpense.usd} />} tone={report.refunds.toRefundsExpense.count ? 'warn' : undefined} />
              </StatGrid>
            </Panel>
          )}

          {report.creditBalances?.count > 0 && (
            <Panel
              flush
              title={`أرصدة «دائن» قديمة غير صفرية (${report.creditBalances.count})`}
              subtitle={<>
                نوع قديم كان بديلاً عن المحفظة، ولا يُرحَّل. الإجمالي: {Object.entries(report.creditBalances.totals || {}).map(([currency, amount]: any) => `${amount} ${currency}`).join(' · ')}.
                اقتراح: إن كان المبلغ ما زال للعميل فعلاً يُنقل إلى محفظته (إيداع بتاريخ قديم مقابل حساب المعلّق)، وإلا يُغلق السجل في المنظومة. القرار لك.
              </>}
            >
              <DataTable
                dense
                maxHeight={320}
                rows={report.creditBalances.list || []}
                rowKey={(row: any) => row.balanceId}
                columns={[
                  { key: 'customer', header: 'العميل', render: (row: any) => (row.customer ? <Open to={`/user/${row.customer._id}`}>{row.customer.customerId} {row.customer.firstName} {row.customer.lastName}</Open> : '-') },
                  { key: 'amount', header: 'المبلغ', numeric: true, render: (row: any) => <Ltr>{row.amount} {row.currency}</Ltr> },
                  { key: 'status', header: 'الحالة', render: (row: any) => row.status },
                  { key: 'notes', header: 'ملاحظة', render: (row: any) => row.notes },
                  { key: 'date', header: 'التاريخ', render: (row: any) => <Ltr>{dayText(row.createdAt)}</Ltr> },
                ]}
              />
            </Panel>
          )}

          <Panel flush title="الافتراضات المستخدمة" subtitle={`تواريخ بديلة وأسعار غير مُدخلة. أسعار مشتقة: ${report.rates?.derived || 0}${report.rates?.missingEntirely ? ' · لا يوجد أي سعر للدينار في كل البيانات' : ''}.`}>
            <DataTable
              dense
              maxHeight={320}
              rows={report.fallbacks || []}
              rowKey={(row: any, index: number) => String(index)}
              onRowClick={(row: any) => navigate(`/accounting/entries/${row.entryId}`)}
              empty={{ title: 'لم يُستخدم أي افتراض' }}
              columns={[
                { key: 'message', header: 'الافتراض (مثال)' },
                { key: 'count', header: 'عدد القيود', numeric: true, sortValue: (row: any) => row.count },
              ]}
            />
          </Panel>

          {report.rates?.list?.length > 0 && (
            <Panel flush title="الأسعار المشتقة" subtitle="متوسط أسعار عمليات اليوم نفسه. لتغييرها: ألغِ التشغيل، ارفع ملف الأسعار، ثم أعد التشغيل.">
              <DataTable
                dense
                maxHeight={280}
                rows={report.rates.list}
                rowKey={(row: any) => `${row.currency}${row.day}`}
                columns={[
                  { key: 'day', header: 'اليوم', render: (row: any) => <Ltr>{row.day}</Ltr>, sortValue: (row: any) => row.day },
                  { key: 'currency', header: 'العملة', render: (row: any) => <Ltr>{row.currency}</Ltr> },
                  { key: 'rate', header: 'السعر', numeric: true, render: (row: any) => <span className="money">{row.rate}</span> },
                ]}
              />
            </Panel>
          )}
        </>
      )}

      {run?.problems?.length > 0 && (
        <Panel flush title={`سجلات تعذّر ترحيلها (${run.problems.length})`} subtitle="لم تدخل الدفاتر. صحّح سببها ثم ألغِ التشغيل وأعده، أو اعتمد وعالجها بقيود يدوية.">
          <DataTable
            dense
            maxHeight={360}
            rows={run.problems}
            rowKey={(row: any, index: number) => String(index)}
            columns={[
              { key: 'source', header: 'المصدر', render: (row: any) => <>{SOURCES[row.source] || row.source}<Sub><Ltr>{row.ref}</Ltr></Sub></> },
              { key: 'at', header: 'التاريخ', render: (row: any) => <Ltr>{dayText(row.at)}</Ltr>, hideOnMobile: true },
              { key: 'message', header: 'السبب' },
            ]}
          />
        </Panel>
      )}

      {overview?.runs?.length > 0 && (
        <Panel flush title="سجل التشغيلات">
          <DataTable
            dense
            rows={overview.runs}
            rowKey={(row: any) => row.runId}
            onRowClick={(row: any) => loadRun(row.runId).catch((err) => setMessage({ type: 'error', text: errorText(err) }))}
            columns={[
              { key: 'runId', header: 'الرقم', render: (row: any) => <Ltr>{row.runId}</Ltr> },
              { key: 'status', header: 'الحالة', render: (row: any) => <Badge tone={RUN_STATUS[row.status]?.tone}>{RUN_STATUS[row.status]?.label || row.status}</Badge> },
              { key: 'startedAt', header: 'بدأ', render: (row: any) => <Ltr>{dateText(row.startedAt)}</Ltr>, hideOnMobile: true },
              { key: 'message', header: 'ملاحظة', hideOnMobile: true, render: (row: any) => <span className="acc-muted">{row.message}</span> },
            ]}
          />
        </Panel>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth dir="rtl">
        <DialogTitle>{confirm === 'commit' ? 'اعتماد الترحيل التاريخي' : 'إلغاء التشغيل'}</DialogTitle>
        <DialogContent>
          {confirm === 'commit' ? (
            <>
              <p className="acc-muted">الاعتماد نهائي ولا يمكن التراجع عنه: تصبح القيود التاريخية جزءاً من الدفاتر، تُضاف العمليات التي حدثت أثناء المراجعة، ويبدأ ترحيل كل عملية جديدة في المنظومة تلقائياً. أي تصحيح بعده يكون بقيود.</p>
              <FormControlLabel control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />} label="راجعتُ التقرير وأوافق على اعتماده" />
            </>
          ) : (
            <p className="acc-muted mb-0">سيُحذف كل ما كتبه هذا التشغيل (القيود، فواتير الموردين التاريخية، الأسعار المشتقة) وتعود الأرقام التسلسلية. بيانات المنظومة نفسها لا تتأثر.</p>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirm(null); setAgreed(false); }}>تراجع</Button>
          <Button variant="contained" color={confirm === 'commit' ? 'primary' : 'error'} disabled={confirm === 'commit' && !agreed} onClick={decide}>
            {confirm === 'commit' ? 'اعتماد نهائي' : 'إلغاء التشغيل'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Migration;

// The signed count sheet kept with the opening entry of a box
const AttachSheet = ({ entryId }: { entryId: string }) => {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState('');
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const body = new FormData();
    Array.from(files).forEach((file) => body.append('files', file));
    try {
      setState('…');
      await acc.post(`entries/${entryId}/attachments`, body);
      setState('أُرفقت');
    } catch (err) {
      setState(errorText(err));
    }
  };
  return (
    <>
      <input ref={input} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => upload(e.target.files)} />
      <button type="button" className="acc-link" onClick={() => input.current?.click()}>إرفاق</button>
      {state && <Sub>{state}</Sub>}
    </>
  );
};
