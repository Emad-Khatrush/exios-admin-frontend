import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { Download, Printer } from 'lucide-react';
import { CURRENCY_DECIMALS, EVENT_LABELS, OFFICE_LABELS, acc, errorText, todayLibya } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { RemotePicker, SHIPPING_TYPES, userLabel } from './shared';
import { AccountRef, Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, StatusBadge, Sub, ShowCanceled } from './ui';

// ---------- Shared pieces ----------

const dollars = (cents: number | null | undefined) => Math.round(cents || 0) / 100;
const minor = (value: number | null | undefined, currency: string) => (value || 0) / 10 ** (CURRENCY_DECIMALS[currency] ?? 2);
const dayOf = (value: any) => (value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli' }).format(new Date(value)) : '');

const exportSheet = async (name: string, rows: Record<string, any>[], reviewStatus?: any) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Report');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'حالة الحسابات': reviewStatus?.status === 'approved' ? 'معتمدة وفق المراجعة المسجلة' : 'مؤقتة — تحتاج مراجعة', 'من': reviewStatus?.period?.from || '', 'إلى': reviewStatus?.period?.to || '', 'بنود تحتاج معالجة': reviewStatus?.blocking ?? '' }]), 'Review');
  XLSX.writeFile(workbook, `${name}-${todayLibya()}.xlsx`);
};

const Actions = ({ onExport }: { onExport: () => void | Promise<void> }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setExporting(true);
    setError('');
    try { await onExport(); }
    catch { setError('تعذّر تجهيز الملف. حاول مرة أخرى.'); }
    finally { setExporting(false); }
  };
  return <span className="acc-noprint d-inline-flex gap-2 align-items-center">
    <Button size="small" variant="outlined" disabled={exporting} startIcon={<Download size={15} />} onClick={download}>{exporting ? 'جارٍ تجهيز الملف…' : 'Excel'}</Button>
    <Button size="small" variant="outlined" startIcon={<Printer size={15} />} onClick={() => window.print()}>طباعة / PDF</Button>
    {error && <span role="alert">{error}</span>}
  </span>;
};

const year = () => todayLibya().slice(0, 4);
const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'هذا الشهر', range: () => ({ from: `${todayLibya().slice(0, 7)}-01`, to: todayLibya() }) },
  { label: 'هذه السنة', range: () => ({ from: `${year()}-01-01`, to: todayLibya() }) },
  { label: 'السنة الماضية', range: () => ({ from: `${Number(year()) - 1}-01-01`, to: `${Number(year()) - 1}-12-31` }) },
  { label: 'كل الفترات', range: () => ({ from: '', to: '' }) },
];

type Period = { from: string; to: string };
const PeriodBar = ({ value, onChange, onApply, children }: { value: Period; onChange: (next: Period) => void; onApply: (next?: Period) => void; children?: ReactNode }) => (
  <div className="px-3 acc-noprint">
    <FilterBar>
      <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      {children}
      <Button variant="contained" onClick={() => onApply()}>عرض</Button>
      {PRESETS.map((preset) => <Button key={preset.label} size="small" onClick={() => { const next = preset.range(); onChange(next); onApply(next); }}>{preset.label}</Button>)}
    </FilterBar>
  </div>
);

// Loads one report; `load(params)` refetches
function useReport(path: string, initial: any = {}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const generation = useRef(0);
  const load = async (params: any = initial) => {
    const request = ++generation.current;
    try {
      setIsLoading(true);
      setError('');
      const query: any = {};
      Object.entries(params).forEach(([key, value]) => { if (value !== '' && value !== undefined && value !== null && value !== false) query[key] = value; });
      const result = (await acc.get(path, { ...query, deferReview: true })).data;
      if (request !== generation.current) return;
      setData(result);
      setIsLoading(false);
      if (result.reviewStatus?.status === 'pending') {
        try {
          const reviewStatus = (await acc.get('review/status', { from: query.from, to: query.to || query.asOf })).data;
          if (request === generation.current) setData({ ...result, reviewStatus });
        } catch {
          if (request === generation.current) setData({ ...result, reviewStatus: { ...result.reviewStatus, status: 'provisional', checkUnavailable: true } });
        }
      }
    } catch (err) {
      if (request === generation.current) setError(errorText(err));
    }
    if (request === generation.current) setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { generation.current++; }; }, [path]);
  return { data, error, isLoading, load };
}

const thisYear = () => ({ from: `${year()}-01-01`, to: todayLibya() });
const ledgerLink = (accountId: string, period: Period) => `/accounting/accounts/${accountId}?${new URLSearchParams(Object.entries(period).filter(([, v]) => v) as any)}`;

const ReviewNotice = ({ data }: { data: any }) => data?.reviewStatus ? <Alert severity={data.reviewStatus.status === 'approved' ? 'success' : data.reviewStatus.status === 'pending' ? 'info' : 'warning'} className="mx-3 mb-2">
  {data.reviewStatus.status === 'approved' ? 'حسابات الفترة معتمدة وفق المراجعة المسجلة' : data.reviewStatus.status === 'pending' ? 'التقرير مؤقت — جارٍ التحقق من حالة مراجعة الحسابات' : 'تقرير مؤقت — يحتاج مراجعة واعتماد الحسابات'}
  {data.reviewStatus.blocking > 0 && ' · بنود تحتاج معالجة: ' + data.reviewStatus.blocking}
  {data.reviewStatus.checkUnavailable && ' · تعذّر فحص اكتمال المراجعة'}
  <Open to={'/accounting/review?' + new URLSearchParams(Object.entries(data.reviewStatus.period || {}).filter(([k,v]) => ['from','to'].includes(k) && !!v) as any)}>فتح قائمة المراجعة</Open>
</Alert> : null;

// ---------- Income statement ----------

const IncomeStatement = () => {
  const navigate = useNavigate();
  const { offices } = useAccountingData({ referenceOnly: true });
  const [period, setPeriod] = useState<Period>(thisYear());
  const [office, setOffice] = useState('');
  const [columns, setColumns] = useState('');
  const { data, error, isLoading, load } = useReport('reports/income-statement', { ...period });
  const apply = (next: Period = period, extra: any = {}) => load({ ...next, office, columns, ...extra });

  const cols: any[] = data?.columns || [];
  const many = cols.length > 1 || (cols[0] && cols[0].key !== 'total');
  const rows = useMemo(() => {
    if (!data) return [];
    const section = (key: string) => data.sections.find((s: any) => s.key === key);
    const lines = (key: string) => {
      const s = section(key);
      return s.rows.length ? [{ kind: 'head', title: s.title }, ...s.rows.map((r: any) => ({ kind: 'row', ...r })), { kind: 'subtotal', title: `إجمالي ${s.title}`, values: s.values, total: s.total }] : [];
    };
    const summary = (key: string) => ({ kind: 'summary', ...data.summary[key] });
    return [
      ...lines('revenue'), ...lines('cost'), summary('grossProfit'),
      ...lines('expenses'), ...lines('depreciation'), summary('operatingProfit'),
      ...lines('fx'), summary('netProfit'),
    ];
  }, [data]);

  const exportRows = () => exportSheet('income-statement', rows.filter((r: any) => r.kind !== 'head').map((r: any) => ({
    account: r.kind === 'row' ? `${r.code} ${r.name}` : r.title,
    ...Object.fromEntries(cols.map((c) => [c.label, dollars(r.values?.[c.key])])),
    ...(many ? { total: dollars(r.total) } : {}),
  })), data?.reviewStatus);

  return (
    <Panel flush title="قائمة الدخل" subtitle="الإيرادات المعترف بها ناقص تكلفتها والمصروفات. قيد إقفال السنة لا يدخل هنا، فتبقى نتيجة السنة المقفلة ظاهرة." actions={<Actions onExport={exportRows} />}>
      <PeriodBar value={period} onChange={setPeriod} onApply={(next) => apply(next)}>
        <TextField select label="المكتب" value={office} onChange={(e) => { setOffice(e.target.value); apply(period, { office: e.target.value }); }} style={{ minWidth: 140 }}>
          <MenuItem value="">كل المكاتب</MenuItem>
          {offices.map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
        </TextField>
        <TextField select label="الأعمدة" value={columns} onChange={(e) => { setColumns(e.target.value); apply(period, { columns: e.target.value }); }} style={{ minWidth: 150 }}>
          <MenuItem value="">الإجمالي فقط</MenuItem>
          <MenuItem value="month">مقارنة شهرية</MenuItem>
          <MenuItem value="year">مقارنة سنوية</MenuItem>
          <MenuItem value="office">حسب المكتب</MenuItem>
        </TextField>
      </PeriodBar>
      <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      {data && (
        <div className="px-3 pb-2">
          <StatGrid>
            <Stat label="الإيرادات" value={<Money value={data.summary.revenue.total} />} />
            <Stat label="مجمل الربح" value={<Money value={data.summary.grossProfit.total} />} />
            <Stat label="صافي الربح" value={<Money value={data.summary.netProfit.total} />} tone={data.summary.netProfit.total < 0 ? 'danger' : 'accent'} />
          </StatGrid>
          {data.services && <>
            <Sub>الخدمات للفترة والمكتب المختارين — الأرقام داخلة في الإجماليات أعلاه. النتيجة مؤقتة إذا لم تصل جميع تكاليف الموردين.</Sub>
            <StatGrid>
              <Stat label="إيرادات الخدمات المسددة" value={<Money value={data.services.revenue} />} />
              <Stat label="تكاليف الخدمات" value={<Money value={data.services.costs} />} />
              <Stat label="نتيجة الخدمات قبل المصاريف العامة وفروق الصرف" value={<Money value={data.services.net} />} tone={data.services.net < 0 ? 'danger' : 'accent'} />
            </StatGrid>
          </>}
        </div>
      )}
      <DataTable
        dense
        loading={isLoading}
        rows={rows}
        rowKey={(_: any, index: number) => String(index)}
        rowTone={(row: any) => (row.kind === 'row' ? undefined : 'group')}
        onRowClick={(row: any) => { if (row.kind === 'row') navigate(ledgerLink(row.accountId, period)); }}
        empty={{ title: 'لا إيرادات ولا مصروفات في هذه الفترة' }}
        columns={[
          { key: 'account', header: 'البند', render: (row: any) => (row.kind === 'row' ? <span style={{ paddingInlineStart: 14 }}><AccountRef code={row.code} name={row.name} /></span> : row.title) },
          ...cols.map((c) => ({ key: c.key, header: c.label, numeric: true, render: (row: any) => (row.kind === 'head' ? null : <Money value={row.values?.[c.key]} strong={row.kind !== 'row'} hideZero={row.kind === 'row'} />) })),
          ...(many ? [{ key: 'total', header: 'الإجمالي', numeric: true, render: (row: any) => (row.kind === 'head' ? null : <Money value={row.total} strong />) }] : []),
        ]}
      />
    </Panel>
  );
};

// ---------- Balance sheet ----------

const BalanceSheet = () => {
  const navigate = useNavigate();
  const [asOf, setAsOf] = useState(todayLibya());
  const { data, error, isLoading, load } = useReport('reports/balance-sheet', { asOf });
  const columns = [
    { key: 'account', header: 'الحساب', render: (row: any) => (row.title ? row.title : <AccountRef code={row.code} name={row.name} />) },
    { key: 'foreign', header: 'بعملة الحساب', numeric: true, hideOnMobile: true, render: (row: any) => (row.foreign ? <Money value={row.foreign} currency={row.currency} decimals={CURRENCY_DECIMALS[row.currency]} tone="plain" /> : null) },
    { key: 'amount', header: 'بالدولار', numeric: true, render: (row: any) => <Money value={row.amount} strong={row.isGroup || !!row.title} /> },
  ];
  const table = (rows: any[]) => (
    <DataTable
      dense loading={isLoading} rows={rows} rowKey={(row: any, index: number) => String(row.accountId || index)}
      indent={(row: any) => row.depth || 0} rowTone={(row: any) => (row.isGroup || row.title ? 'group' : undefined)}
      onRowClick={(row: any) => { if (row.accountId) navigate(ledgerLink(row.accountId, { from: '', to: asOf })); }}
      columns={columns}
    />
  );
  const liabilities = data ? [
    ...data.liabilities.rows, { title: 'إجمالي الالتزامات', amount: data.liabilities.total },
    ...data.equity.rows,
    // This year's result apart from earlier years not closed yet
    ...(data.equity.priorUnclosedEarnings ? [{ title: 'أرباح سنوات سابقة لم تُقفل بعد', amount: data.equity.priorUnclosedEarnings }] : []),
    { title: `نتيجة السنة الحالية (منذ ${data.equity.yearStart || ''})`, amount: data.equity.currentYearEarnings ?? data.equity.unclosedEarnings },
    { title: 'إجمالي حقوق الملكية', amount: data.equity.totalWithEarnings },
    { title: 'إجمالي الالتزامات وحقوق الملكية', amount: data.liabilities.total + data.equity.totalWithEarnings },
  ] : [];
  const exportRows = () => exportSheet('balance-sheet', [
    ...data.assets.rows.map((r: any) => ({ section: 'الأصول', account: `${r.code} ${r.name}`, usd: dollars(r.amount) })),
    ...liabilities.map((r: any) => ({ section: 'الالتزامات وحقوق الملكية', account: r.title || `${r.code} ${r.name}`, usd: dollars(r.amount) })),
  ], data?.reviewStatus);

  return (
    <>
      <Panel
        title="الميزانية العمومية"
        subtitle="ما تملكه الشركة وما عليها في تاريخ محدد. محافظ العملاء والإيرادات المؤجلة التزامات."
        actions={data && <>{data.balanced ? <Badge tone="ok">متوازنة</Badge> : <Badge tone="danger">فرق <Money value={data.difference} /></Badge>} <Actions onExport={exportRows} /></>}
      >
        <FilterBar>
          <TextField type="date" label="في تاريخ" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="contained" onClick={() => load({ asOf })}>عرض</Button>
        </FilterBar>
        <ReviewNotice data={data} />
      {error && <Alert severity="error">{error}</Alert>}
        {data && (
          <StatGrid>
            <Stat label="إجمالي الأصول" value={<Money value={data.assets.total} />} tone="accent" />
            <Stat label="إجمالي الالتزامات" value={<Money value={data.liabilities.total} />} />
            <Stat label="حقوق الملكية" value={<Money value={data.equity.totalWithEarnings} />} hint={<>منها نتيجة غير مقفلة <Money value={data.equity.unclosedEarnings} /></>} />
          </StatGrid>
        )}
      </Panel>
      <Panel flush title="الأصول">{table(data ? [...data.assets.rows, { title: 'إجمالي الأصول', amount: data.assets.total }] : [])}</Panel>
      <Panel flush title="الالتزامات وحقوق الملكية">{table(liabilities)}</Panel>
    </>
  );
};

// ---------- Cash flow and cash boxes ----------

const CashFlow = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>(thisYear());
  const flow = useReport('reports/cash-flow', period);
  const boxes = useReport('reports/cash-movements', period);
  const apply = (next: Period = period) => { flow.load(next); boxes.load(next); };
  const rows = flow.data ? flow.data.categories.flatMap((c: any) => [{ title: c.title, amount: c.total, head: true }, ...c.rows]) : [];

  return (
    <>
      <Panel
        flush title="قائمة التدفقات النقدية"
        subtitle="كل ما دخل وخرج من الخزائن والبنوك والمحافظ الإلكترونية، مصنفاً حسب الحساب المقابل: تشغيلي، استثماري (أصول)، تمويلي (رأس مال، مسحوبات، قروض)."
        actions={<Actions onExport={() => exportSheet('cash-flow', rows.map((r: any) => ({ item: r.title || `${r.code} ${r.name}`, usd: dollars(r.amount) })), flow.data?.reviewStatus)} />}
      >
        <PeriodBar value={period} onChange={setPeriod} onApply={(next) => apply(next)} />
        <ReviewNotice data={flow.data} />
        {flow.error && <Alert severity="error" className="mx-3 mb-2">{flow.error}</Alert>}
        {flow.data && (
          <div className="px-3 pb-2">
            <StatGrid>
              <Stat label="النقد أول الفترة" value={<Money value={flow.data.opening} />} />
              <Stat label="صافي التدفق" value={<Money value={flow.data.net} />} tone={flow.data.net < 0 ? 'warn' : 'accent'} />
              <Stat label="النقد آخر الفترة" value={<Money value={flow.data.closing} />} hint={flow.data.unexplained ? <>فرق غير مفسَّر <Money value={flow.data.unexplained} /></> : 'مطابق لأرصدة الخزائن'} tone={flow.data.unexplained ? 'danger' : undefined} />
            </StatGrid>
          </div>
        )}
        <DataTable
          dense loading={flow.isLoading} rows={rows} rowKey={(_: any, index: number) => String(index)} rowTone={(row: any) => (row.head ? 'group' : undefined)}
          onRowClick={(row: any) => { if (row.accountId) navigate(ledgerLink(row.accountId, period)); }}
          empty={{ title: 'لا حركة نقدية في هذه الفترة' }}
          columns={[
            { key: 'item', header: 'البند', render: (row: any) => (row.head ? row.title : <span style={{ paddingInlineStart: 14 }}><AccountRef code={row.code} name={row.name} /></span>) },
            { key: 'amount', header: 'دخل (+) / خرج (−)', numeric: true, render: (row: any) => <Money value={row.amount} strong={row.head} /> },
          ]}
        />
      </Panel>

      <Panel
        flush title="حركة الخزائن والبنوك" subtitle="لكل حساب بعملته: الرصيد أول الفترة، الوارد، الصادر، والرصيد آخرها مع قيمته بالدولار ومتوسط سعره."
        actions={<Actions onExport={() => exportSheet('cash-boxes', (boxes.data?.results || []).map((r: any) => ({
          account: `${r.code} ${r.name}`, currency: r.currency, opening: minor(r.openingForeign, r.currency), in: minor(r.inForeign, r.currency), out: minor(r.outForeign, r.currency),
          closing: minor(r.closingForeign, r.currency), closingUsd: dollars(r.closingUsd), rate: r.carryingRate,
        })), boxes.data?.reviewStatus)} />}
      >
        <DataTable
          dense loading={boxes.isLoading} rows={boxes.data?.results || []} rowKey={(row: any) => row.accountId}
          onRowClick={(row: any) => navigate(ledgerLink(row.accountId, period))}
          rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
          columns={[
            { key: 'account', header: 'الحساب', render: (row: any) => <><AccountRef code={row.code} name={row.name} /><Sub>{OFFICE_LABELS[row.office] || row.office}</Sub></> },
            { key: 'opening', header: 'أول الفترة', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.openingForeign} currency={row.currency} decimals={row.decimals} tone="plain" /> },
            { key: 'in', header: 'وارد', numeric: true, render: (row: any) => <Money value={row.inForeign} currency={row.currency} decimals={row.decimals} tone="debit" hideZero /> },
            { key: 'out', header: 'صادر', numeric: true, render: (row: any) => <Money value={row.outForeign} currency={row.currency} decimals={row.decimals} tone="credit" hideZero /> },
            { key: 'closing', header: 'آخر الفترة', numeric: true, render: (row: any) => <Money value={row.closingForeign} currency={row.currency} decimals={row.decimals} strong /> },
            { key: 'usd', header: 'بالدولار', numeric: true, render: (row: any) => <Money value={row.closingUsd} /> },
            { key: 'rate', header: 'متوسط السعر', numeric: true, hideOnMobile: true, render: (row: any) => (row.carryingRate ? <span className="money">{row.carryingRate.toFixed(4)}</span> : null) },
          ]}
          footer={boxes.data ? { account: 'الإجمالي بالدولار', usd: <Money value={boxes.data.totals.closingUsd} strong /> } : undefined}
        />
      </Panel>
    </>
  );
};

// ---------- Trips and purchase orders ----------

const profitColumns = [
  { key: 'revenue', header: 'الإيراد', numeric: true, render: (row: any) => <Money value={row.revenue} />, sortValue: (row: any) => row.revenue },
  { key: 'cost', header: 'التكلفة', numeric: true, render: (row: any) => <Money value={row.cost} />, sortValue: (row: any) => row.cost },
  { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => <Money value={row.profit} strong />, sortValue: (row: any) => row.profit },
  { key: 'margin', header: 'النسبة', numeric: true, hideOnMobile: true, render: (row: any) => (row.margin === null ? null : <span className="money">{row.margin}%</span>), sortValue: (row: any) => row.margin ?? -999 },
  { key: 'deferred', header: 'إيراد مؤجل', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.deferred} hideZero tone="plain" />, sortValue: (row: any) => row.deferred },
  { key: 'wip', header: 'تكلفة قيد التنفيذ', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.costInProgress} hideZero tone="plain" />, sortValue: (row: any) => row.costInProgress },
];
const profitFooter = (totals: any, first: string) => ({
  [first]: 'الإجمالي', revenue: <Money value={totals.revenue} strong />, cost: <Money value={totals.cost} strong />, profit: <Money value={totals.profit} strong />,
  deferred: <Money value={totals.deferred} tone="plain" />, wip: <Money value={totals.costInProgress} tone="plain" />,
});
const profitExport = (row: any) => ({ revenue: dollars(row.revenue), cost: dollars(row.cost), profit: dollars(row.profit), margin: row.margin, deferred: dollars(row.deferred), costInProgress: dollars(row.costInProgress) });

const COST_CATEGORY_LABELS: Record<string, string> = { shipping: 'شحن', customs: 'جمارك', clearance: 'تخليص', transport: 'نقل', other: 'أخرى', uncategorized: 'غير مصنف' };
const OFFICE_NAMES: Record<string, string> = { tripoli: 'طرابلس', benghazi: 'بنغازي', misurata: 'مصراتة' };

// One trip opened from the report (spec v8), shown above the list: what it earned and cost, its cost
// by kind with each kind's share, and for an air or sea trip the figures per delivery office with
// the domestic transport (for a domestic trip: the extra cost per unit and the fees charged)
const TripDetail = ({ trip, onClose }: { trip: any; onClose: () => void }) => {
  const categories = (Object.entries(trip.byCategory || {}) as [string, number][]).filter(([, value]) => value).sort((a, b) => b[1] - a[1]);
  const categoryTotal = categories.reduce((sum, [, value]) => sum + value, 0);
  const unit = trip.unit === 'CBM' ? 'CBM' : 'كغ';
  const domestic = trip.shippingType === 'domestic';
  const offices = domestic ? [] : (trip.offices || []);
  const perUnitProfit = trip.revenuePerUnit !== null && trip.costPerUnit !== null && trip.revenuePerUnit !== undefined ? trip.revenuePerUnit - trip.costPerUnit : null;
  return (
    <section className="acc-trip">
      <header className="acc-trip__head">
        <div>
          <h3>{trip.voyage}</h3>
          <div className="acc-trip__meta">
            <Badge tone="info">{SHIPPING_TYPES[trip.shippingType] || trip.shippingType}</Badge>
            <StatusBadge status={trip.status} />
            <Ltr>{dayOf(trip.date)}</Ltr>
            {trip.office && <span>{OFFICE_NAMES[trip.office] || trip.office}</span>}
            <span>{trip.packages} طرد{trip.weight ? <> · <Ltr>{Number(trip.weight).toLocaleString('en-US', { maximumFractionDigits: 3 })}</Ltr> {unit}</> : null}</span>
            {trip.volumetricPackages > 0 && <span>{trip.volumetricPackages} بالوزن الحجمي</span>}
          </div>
        </div>
        <div className="acc-trip__actions">
          <Open to={`/inventory/${trip.tripId}/edit`}>فتح الرحلة</Open>
          <Button size="small" onClick={onClose}>إغلاق</Button>
        </div>
      </header>

      <StatGrid>
        {domestic ? (
          <>
            <Stat label="تكلفة الرحلة الداخلية" value={<Money value={trip.totalCost} />} hint={trip.costInProgress ? <>منها قيد التنفيذ <Money value={trip.costInProgress} tone="plain" /></> : undefined} />
            <Stat label={`التكلفة الإضافية لكل ${unit}`} value={trip.extraCostPerUnit === null ? '—' : <Money value={trip.extraCostPerUnit} />} />
            <Stat label="رسوم النقل المفوترة" value={<Money value={trip.feesBilled} />} hint={<>المعترف بها <Money value={trip.feesRecognized} tone="plain" /></>} />
            <Stat label="الرسوم ناقص التكلفة" value={<Money value={trip.feesBilled - trip.totalCost} />} tone={trip.feesBilled - trip.totalCost < 0 ? 'danger' : 'accent'} />
          </>
        ) : (
          <>
            <Stat label="إجمالي الإيراد" value={<Money value={trip.totalRevenue} />} hint={<>معترف به <Money value={trip.revenue} tone="plain" /> · مؤجل <Money value={trip.deferred} tone="plain" /></>} />
            <Stat
              label="إجمالي التكلفة" value={<Money value={trip.totalCost} />}
              hint={trip.freeShippingCost > 0 ? <>منها شحن مجاني <Money value={trip.freeShippingCost} tone="plain" /></> : trip.costInProgress ? <>قيد التنفيذ <Money value={trip.costInProgress} tone="plain" /></> : undefined}
            />
            <Stat label="الصافي قبل النقل الداخلي" value={<Money value={trip.profitBeforeDomestic} />} tone={trip.profitBeforeDomestic < 0 ? 'danger' : undefined} />
            <Stat
              label="الصافي بعد النقل الداخلي" value={<Money value={trip.profitAfterDomestic} />} tone={trip.profitAfterDomestic < 0 ? 'danger' : 'accent'}
              hint={trip.domesticCost ? <>النقل الداخلي <Money value={trip.domesticCost} tone="plain" /></> : 'لا نقل داخلي'}
            />
            <Stat
              label={`لكل ${unit}`} value={trip.costPerUnit === null ? '—' : <>تكلفة <Money value={trip.costPerUnit} /></>}
              hint={trip.revenuePerUnit === null ? undefined : <>بيع <Money value={trip.revenuePerUnit} tone="plain" />{perUnitProfit !== null && <> · ربح <Money value={perUnitProfit} tone="plain" /></>}</>}
            />
          </>
        )}
      </StatGrid>

      <div className={`acc-trip__grid${offices.length ? '' : ' acc-trip__grid--one'}`}>
        <div className="acc-trip__box">
          <h4>التكلفة حسب النوع</h4>
          {categories.length === 0 ? <p className="acc-muted">لا فواتير تكلفة على هذه الرحلة بعد.</p> : (
            <ul className="acc-trip__costs">
              {categories.map(([key, value]) => {
                const share = categoryTotal ? Math.round((value / categoryTotal) * 100) : 0;
                return (
                  <li key={key}>
                    <div className="acc-trip__cost-row"><span>{COST_CATEGORY_LABELS[key] || key}</span><span><Money value={value} /> <span className="acc-muted">{share}%</span></span></div>
                    <div className="acc-trip__bar"><span style={{ width: `${share}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {offices.length > 0 && (
          <div className="acc-trip__box">
            <h4>حسب مكتب التسليم</h4>
            <DataTable
              dense rows={offices} rowKey={(row: any) => row.office}
              columns={[
                { key: 'office', header: 'المكتب', render: (row: any) => <><strong>{OFFICE_NAMES[row.office] || row.office}</strong><Sub>{row.packages} طرد · <Ltr>{row.weight}</Ltr> {unit}</Sub></> },
                {
                  key: 'costPerUnit', header: `تكلفة ${unit}`, numeric: true,
                  render: (row: any) => (row.costPerUnit === null ? null : <><Money value={row.costPerUnit} tone="plain" />{row.domesticCost > 0 && row.fullCostPerUnit !== null && <Sub>مع النقل <Money value={row.fullCostPerUnit} tone="plain" /></Sub>}</>),
                },
                { key: 'sellPerUnit', header: `بيع ${unit}`, numeric: true, render: (row: any) => (row.sellPerUnit === null ? null : <Money value={row.sellPerUnit} tone="plain" />) },
                { key: 'domesticCost', header: 'النقل الداخلي', numeric: true, render: (row: any) => <Money value={row.domesticCost} hideZero tone="plain" /> },
                { key: 'profit', header: 'الربح', numeric: true, render: (row: any) => <Money value={row.profit} strong /> },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
};

const Trips = () => {
  const [filters, setFilters] = useState({ status: '', shippingType: '', search: '' });
  const [opened, setOpened] = useState<any>(null);
  const { data, error, isLoading, load } = useReport('reports/trips');
  // The details open above the list, and the page scrolls to them
  const detailRef = useRef<HTMLDivElement>(null);
  const open = (row: any) => {
    setOpened(row);
    if (row) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  return (
    <Panel
      flush title="ربحية الرحلات"
      subtitle="إجمالي الإيراد = المعترف به (مسلَّم ومسدد) + المؤجل (لم يُسلَّم أو لم يُسدَّد). إجمالي التكلفة = كل مصاريف الرحلة. الصافي = إجمالي الإيراد ناقص إجمالي التكلفة. سعر الوحدة = إجمالي التكلفة (أو الإيراد) ÷ مجموع أوزان الطرود: الجوي بالكيلو والبحري بالـCBM. الرحلة الداخلية: تكلفتها تُوزَّع على طرودها بالوزن ويقابلها رسوم النقل. اضغط رحلة لتفاصيلها: التكلفة حسب النوع، والكيلو حسب مكتب التسليم، والربح قبل النقل الداخلي وبعده."
      actions={<Actions onExport={() => exportSheet('trips', (data?.results || []).map((r: any) => ({
        trip: r.voyage, type: r.shippingType, status: r.status, packages: r.packages, recognizedPackages: r.recognizedPackages, weight: r.weight, unit: r.unit || '',
        revenueRecognized: dollars(r.revenue), deferred: dollars(r.deferred), totalRevenue: dollars(r.totalRevenue), totalCost: dollars(r.totalCost), net: dollars(r.net),
        costPerUnit: r.costPerUnit === null ? '' : dollars(r.costPerUnit), revenuePerUnit: r.revenuePerUnit === null ? '' : dollars(r.revenuePerUnit),
      })), data?.reviewStatus)} />}
    >
      <div className="px-3 acc-noprint">
        <FilterBar>
          <TextField select label="النوع" value={filters.shippingType} onChange={(e) => setFilters({ ...filters, shippingType: e.target.value })} style={{ minWidth: 120 }}>
            <MenuItem value="">الكل</MenuItem>
            {Object.entries(SHIPPING_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField select label="الحالة" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ minWidth: 120 }}>
            <MenuItem value="">الكل</MenuItem>
            <MenuItem value="processing">مفتوحة</MenuItem>
            <MenuItem value="finished">مكتملة</MenuItem>
          </TextField>
          <TextField placeholder="اسم الرحلة" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
          <Button variant="contained" onClick={() => load(filters)}>عرض</Button>
        </FilterBar>
      </div>
      <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      <div ref={detailRef} className="px-3">{opened && <TripDetail trip={opened} onClose={() => setOpened(null)} />}</div>
      <DataTable
        dense loading={isLoading} rows={data?.results || []} rowKey={(row: any) => row.tripId} maxHeight="70vh" empty={{ title: 'لا توجد رحلات' }}
        onRowClick={(row: any) => open(opened?.tripId === row.tripId ? null : row)}
        rowTone={(row: any) => (row.tripId === opened?.tripId ? 'selected' : undefined)}
        columns={[
          {
            key: 'trip', header: 'الرحلة', sortValue: (row: any) => row.voyage, render: (row: any) => (
              <>
                <Open to={`/inventory/${row.tripId}/edit`}>{row.voyage}</Open>
                <Sub>{SHIPPING_TYPES[row.shippingType] || row.shippingType} · <Ltr>{dayOf(row.date)}</Ltr> · {row.recognizedPackages}/{row.packages} طرد معترف به</Sub>
              </>
            ),
          },
          { key: 'status', header: 'الحالة', hideOnMobile: true, render: (row: any) => <StatusBadge status={row.status} /> },
          { key: 'weight', header: 'الوزن', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.weight, render: (row: any) => (row.weight ? <span className="money">{row.weight.toLocaleString('en-US', { maximumFractionDigits: 3 })} {row.unit || (row.mixedUnits ? 'مختلط' : '')}</span> : null) },
          { key: 'revenue', header: 'إيراد معترف به', numeric: true, sortValue: (row: any) => row.revenue, render: (row: any) => <Money value={row.revenue} hideZero /> },
          { key: 'deferred', header: 'مؤجل', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.deferred, render: (row: any) => <Money value={row.deferred} hideZero tone="plain" /> },
          { key: 'totalRevenue', header: 'إجمالي الإيراد', numeric: true, sortValue: (row: any) => row.totalRevenue, render: (row: any) => <Money value={row.totalRevenue} /> },
          { key: 'totalCost', header: 'إجمالي التكلفة', numeric: true, sortValue: (row: any) => row.totalCost, render: (row: any) => <><Money value={row.totalCost} />{row.freeShippingCost > 0 && <Sub>منها شحن مجاني <Money value={row.freeShippingCost} tone="plain" /> على فواتير الشراء</Sub>}</> },
          { key: 'net', header: 'الصافي', numeric: true, sortValue: (row: any) => row.net, render: (row: any) => <Money value={row.net} strong /> },
          { key: 'afterDomestic', header: 'بعد النقل الداخلي', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.profitAfterDomestic ?? row.net, render: (row: any) => (row.profitAfterDomestic === undefined ? null : <Money value={row.profitAfterDomestic} tone="plain" />) },
          { key: 'costPerUnit', header: 'تكلفة الكيلو/CBM', numeric: true, sortValue: (row: any) => row.costPerUnit ?? -1, render: (row: any) => (row.costPerUnit === null ? null : <Money value={row.costPerUnit} tone="plain" />) },
          { key: 'revenuePerUnit', header: 'بيع الكيلو/CBM', numeric: true, hideOnMobile: true, sortValue: (row: any) => row.revenuePerUnit ?? -1, render: (row: any) => (row.revenuePerUnit === null ? null : <Money value={row.revenuePerUnit} tone="plain" />) },
        ]}
        footer={data ? {
          trip: 'الإجمالي', revenue: <Money value={data.totals.revenue} strong />, deferred: <Money value={data.totals.deferred} tone="plain" />,
          totalRevenue: <Money value={data.totals.totalRevenue} strong />, totalCost: <Money value={data.totals.totalCost} strong />, net: <Money value={data.totals.net} strong />,
        } : undefined}
      />
    </Panel>
  );
};

const Purchases = () => {
  const [search, setSearch] = useState('');
  const [withoutCost, setWithoutCost] = useState('');
  const { data, error, isLoading, load } = useReport('reports/purchases');
  return (
    <Panel
      flush title="ربحية فواتير الشراء"
      subtitle="قيمة الفاتورة المباعة للعميل ناقص فواتير الموردين المسجلة على الطلب. الربح يظهر بعد سداد العميل كامل الفاتورة."
      actions={<Actions onExport={() => exportSheet('purchases', (data?.results || []).map((r: any) => ({ order: r.orderNumber, customer: r.customer, date: dayOf(r.date), ...profitExport(r), open: dollars(r.open) })), data?.reviewStatus)} />}
    >
      <div className="px-3 acc-noprint">
        <FilterBar>
          <TextField placeholder="رقم الطلب أو اسم العميل" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load({ search, withoutCost })} />
          <TextField select label="عرض" value={withoutCost} onChange={(e) => { setWithoutCost(e.target.value); load({ search, withoutCost: e.target.value }); }} style={{ minWidth: 190 }}>
            <MenuItem value="">كل الطلبات</MenuItem>
            <MenuItem value="true">مسددة بلا أي تكلفة</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => load({ search, withoutCost })}>عرض</Button>
        </FilterBar>
      </div>
      <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      <DataTable
        dense loading={isLoading} rows={data?.results || []} rowKey={(row: any) => row.orderId} maxHeight="70vh" empty={{ title: 'لا توجد فواتير شراء في الدفاتر' }}
        rowTone={(row: any) => (row.isCanceled ? 'canceled' : undefined)}
        columns={[
          {
            key: 'order', header: 'الطلب', sortValue: (row: any) => row.orderNumber, render: (row: any) => (
              <>
                <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open>
                {row.withoutCost && <> <Badge tone="warn">بلا تكلفة</Badge></>}
                {row.stuckCost && <> <Badge tone="danger">ملغى وعليه تكلفة</Badge></>}
                <Sub>{row.customer} · <Ltr>{dayOf(row.date)}</Ltr></Sub>
              </>
            ),
          },
          ...profitColumns,
          { key: 'open', header: 'باقٍ على العميل', numeric: true, render: (row: any) => <Money value={row.open} hideZero />, sortValue: (row: any) => row.open },
        ]}
        footer={data ? profitFooter(data.totals, 'order') : undefined}
      />
    </Panel>
  );
};

// ---------- Customers ----------

const BUCKETS: [string, string][] = [['d0', '0–30 يوماً'], ['d31', '31–60'], ['d61', '61–90'], ['d91', 'أكثر من 90']];
const bucketColumns = BUCKETS.map(([key, label]) => ({ key, header: label, numeric: true, render: (row: any) => <Money value={row[key]} hideZero />, sortValue: (row: any) => row[key] }));
const bucketExport = (row: any) => Object.fromEntries([...BUCKETS.map(([key, label]) => [label, dollars(row[key])]), ['total', dollars(row.total)]]);
const CLAIM_KIND: Record<string, string> = { SHP: 'شحن', PUR: 'فاتورة شراء', GEN: 'دين عام', OTHER: 'بدون مطالبة محددة' };

const Receivables = ({ openStatement }: { openStatement: (customer: any) => void }) => {
  const [asOf, setAsOf] = useState(todayLibya());
  const [view, setView] = useState('all');
  const { data, error, isLoading, load } = useReport('reports/receivables', { asOf });
  const claims = (data?.claims || []).filter((c: any) => (view === 'delivered' ? c.open > 0 && c.kind === 'SHP' && c.delivered : view === 'overpaid' ? c.open < 0 : true));
  const name = (c: any) => (c ? userLabel(c) : 'غير معروف');

  return (
    <>
      <Panel
        flush title="أعمار ديون العملاء" subtitle="ما على كل عميل، موزعاً حسب عمر المطالبة من يوم تسجيلها. اضغط عميلاً لفتح كشف حسابه."
        actions={<Actions onExport={() => exportSheet('receivables-aging', (data?.customers || []).map((r: any) => ({ customer: name(r.customer), claims: r.claims, ...bucketExport(r) })), data?.reviewStatus)} />}
      >
        <div className="px-3 acc-noprint">
          <FilterBar>
            <TextField type="date" label="في تاريخ" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            <Button variant="contained" onClick={() => load({ asOf })}>عرض</Button>
          </FilterBar>
        </div>
        <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
        {data && (
          <div className="px-3 pb-2">
            <StatGrid>
              <Stat label="إجمالي ذمم العملاء" value={<Money value={data.totals.total} />} tone="accent" />
              <Stat label="مسلّمة وغير مسددة" value={<Money value={data.deliveredUnpaid.total} />} hint={`${data.deliveredUnpaid.count} طرداً · إيرادها مؤجل ولا يظهر في قائمة الدخل بعد`} tone={data.deliveredUnpaid.count ? 'warn' : undefined} />
              <Stat label="أقدم من 90 يوماً" value={<Money value={data.totals.d91} />} tone={data.totals.d91 > 0 ? 'danger' : undefined} />
              <Stat label="مدفوعة بأكثر من قيمتها" value={<Money value={data.overpaid.total} />} hint={`${data.overpaid.count} مطالبة`} />
            </StatGrid>
          </div>
        )}
        <DataTable
          dense loading={isLoading} rows={data?.customers || []} rowKey={(row: any) => String(row.partnerId)} maxHeight="50vh"
          onRowClick={(row: any) => row.customer && openStatement({ _id: row.partnerId, ...row.customer })}
          empty={{ title: 'لا ذمم على العملاء' }}
          columns={[
            { key: 'customer', header: 'العميل', sortValue: (row: any) => name(row.customer), render: (row: any) => <>{name(row.customer)}<Sub>{row.claims} مطالبة</Sub></> },
            ...bucketColumns,
            { key: 'total', header: 'الإجمالي', numeric: true, render: (row: any) => <Money value={row.total} strong />, sortValue: (row: any) => row.total },
          ]}
          footer={data ? { customer: 'الإجمالي', ...Object.fromEntries(BUCKETS.map(([key]) => [key, <Money value={data.totals[key]} strong />])), total: <Money value={data.totals.total} strong /> } : undefined}
        />
      </Panel>

      <Panel
        flush title="المطالبات المفتوحة" subtitle={data && data.claimsCount > data.claims.length ? `تُعرض أكبر ${data.claims.length} من ${data.claimsCount}.` : undefined}
        actions={<Actions onExport={() => exportSheet('open-claims', claims.map((c: any) => ({ customer: name(c.customer), order: c.orderNumber, kind: CLAIM_KIND[c.kind], tracking: c.tracking, delivered: c.delivered ? 'نعم' : '', since: c.since, days: c.age, open: dollars(c.open) })), data?.reviewStatus)} />}
      >
        <div className="px-3 acc-noprint">
          <FilterBar>
            <TextField select label="عرض" value={view} onChange={(e) => setView(e.target.value)} style={{ minWidth: 220 }}>
              <MenuItem value="all">كل المطالبات المفتوحة</MenuItem>
              <MenuItem value="delivered">مسلّمة وغير مسددة</MenuItem>
              <MenuItem value="overpaid">مدفوعة بأكثر من قيمتها</MenuItem>
            </TextField>
          </FilterBar>
        </div>
        <DataTable
          dense loading={isLoading} rows={claims} rowKey={(row: any, index: number) => `${row.arKey}-${row.partnerId}-${index}`} maxHeight="60vh" empty={{ title: 'لا توجد مطالبات' }}
          columns={[
            { key: 'customer', header: 'العميل', render: (row: any) => <Open to={row.partnerId ? `/user/${row.partnerId}` : null}>{name(row.customer)}</Open> },
            {
              key: 'claim', header: 'المطالبة', render: (row: any) => (
                <>
                  {CLAIM_KIND[row.kind]} {row.tracking && <Ltr>{row.tracking}</Ltr>} {row.delivered && <Badge tone="warn">مسلَّم</Badge>}
                  {row.orderNumber && <Sub>الطلب <Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open></Sub>}
                </>
              ),
            },
            { key: 'since', header: 'منذ', render: (row: any) => <><Ltr>{row.since}</Ltr><Sub>{row.age} يوماً</Sub></>, sortValue: (row: any) => row.age },
            { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong />, sortValue: (row: any) => row.open },
          ]}
        />
      </Panel>
    </>
  );
};

const ACCOUNT_LABEL: Record<string, string> = { receivable: 'ذمة', walletUsd: 'محفظة دولار', walletLyd: 'محفظة دينار' };

const CustomerStatement = ({ initial }: { initial: any }) => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(initial);
  const [period, setPeriod] = useState<Period>({ from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);

  const load = async (next: Period = period, who: any = customer, withCanceled = showCanceled) => {
    if (!who?._id) return;
    try {
      setIsLoading(true);
      setError('');
      const res = (await acc.get(`reports/customer-statement/${who._id}`, { from: next.from || undefined, to: next.to || undefined, showCanceled: withCanceled || undefined })).data;
      setData(res);
      // Opened by a link that only carries the customer's id: fill in the name once it is known
      if (!who.firstName && res.customer) setCustomer({ ...res.customer, _id: who._id });
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial?._id) { setCustomer(initial); load(period, initial); } }, [initial?._id]);

  return (
    <Panel
      flush title="كشف حساب عميل" subtitle="من دفتر الأستاذ: المطالبات والدفعات وحركات المحفظتين بترتيب التاريخ، مع ما عليه وما في محفظتيه بعد كل حركة."
      actions={data && <Actions onExport={() => exportSheet('customer-statement', data.movements.map((m: any) => ({
        date: m.day, entry: m.number, description: m.description, account: ACCOUNT_LABEL[m.account], debit: dollars(m.debit), credit: dollars(m.credit),
        currencyAmount: m.foreign ? minor(m.foreign, m.currency) : '', currency: m.foreign ? m.currency : '', owed: dollars(m.owed), walletUsd: dollars(m.walletUsd), walletLyd: minor(m.walletLyd, 'LYD'),
      })), data?.reviewStatus)} />}
    >
      <PeriodBar value={period} onChange={setPeriod} onApply={(next) => load(next)}>
        <div style={{ minWidth: 260 }}><RemotePicker endpoint="lookup/users" label="العميل" value={customer} getLabel={userLabel} onChange={(next) => { setCustomer(next); setData(null); load(period, next); }} /></div>
        {customer?._id && <Open to={`/user/${customer._id}`}>صفحة العميل</Open>}
        <ShowCanceled checked={showCanceled} onChange={(value) => { setShowCanceled(value); load(period, customer, value); }} />
      </PeriodBar>
      <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      {!customer && <div className="acc-empty">اختر عميلاً لعرض كشفه.</div>}
      {data && (
        <div className="px-3 pb-2">
          <StatGrid>
            <Stat label="عليه (ذمم)" value={<Money value={data.closing.owed} />} tone={data.closing.owed > 0 ? 'warn' : undefined} />
            <Stat label="محفظته بالدولار" value={<Money value={data.closing.walletUsd} />} />
            <Stat label="محفظته بالدينار" value={<Money value={data.closing.walletLyd} currency="LYD" />} />
          </StatGrid>
        </div>
      )}
      {customer && (
        <DataTable
          dense loading={isLoading} rows={data?.movements || []} rowKey={(row: any, index: number) => `${row.entryId}-${index}`} maxHeight="65vh"
          onRowClick={(row: any) => navigate(`/accounting/entries/${row.entryId}`)} empty={{ title: 'لا حركات لهذا العميل في الدفاتر' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'description', header: 'البيان', render: (row: any) => <>{row.description}<Sub><Ltr>{row.number}</Ltr> · {EVENT_LABELS[row.eventType] || row.eventType} · {ACCOUNT_LABEL[row.account]}</Sub></> },
            { key: 'foreign', header: 'بالعملة', numeric: true, hideOnMobile: true, render: (row: any) => (row.foreign ? <><Money value={Math.abs(row.foreign)} currency={row.currency} tone="plain" />{row.rate ? <Sub>بسعر <Ltr>{row.rate}</Ltr></Sub> : null}</> : null) },
            { key: 'debit', header: 'مدين', numeric: true, render: (row: any) => <Money value={row.debit} tone="debit" hideZero /> },
            { key: 'credit', header: 'دائن', numeric: true, render: (row: any) => <Money value={row.credit} tone="credit" hideZero /> },
            { key: 'owed', header: 'عليه', numeric: true, render: (row: any) => <Money value={row.owed} strong /> },
            { key: 'walletUsd', header: 'محفظة $', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.walletUsd} tone="plain" /> },
            { key: 'walletLyd', header: 'محفظة د.ل', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.walletLyd} currency="LYD" tone="plain" /> },
          ]}
        />
      )}
    </Panel>
  );
};

// ---------- Vendors and exchange differences ----------

const Payables = () => {
  const navigate = useNavigate();
  const [asOf, setAsOf] = useState(todayLibya());
  const { data, error, isLoading, load } = useReport('reports/payables', { asOf });
  return (
    <>
      <Panel
        flush title="أعمار ذمم الموردين" subtitle="ما تدين به الشركة لكل مورد، حسب عمر الفاتورة. السالب دفعة مقدمة لدى المورد."
        actions={<Actions onExport={() => exportSheet('payables-aging', (data?.vendors || []).map((r: any) => ({ vendor: r.vendor, bills: r.bills, ...bucketExport(r) })), data?.reviewStatus)} />}
      >
        <div className="px-3 acc-noprint">
          <FilterBar>
            <TextField type="date" label="في تاريخ" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            <Button variant="contained" onClick={() => load({ asOf })}>عرض</Button>
          </FilterBar>
        </div>
        <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
        <DataTable
          dense loading={isLoading} rows={data?.vendors || []} rowKey={(row: any) => String(row.vendorId)}
          onRowClick={(row: any) => row.vendorId && navigate(`/accounting/vendors/${row.vendorId}`)} empty={{ title: 'لا مستحقات للموردين' }}
          columns={[
            { key: 'vendor', header: 'المورد', render: (row: any) => <>{row.vendor || 'غير معروف'}<Sub>{row.bills} بند</Sub></>, sortValue: (row: any) => row.vendor || '' },
            ...bucketColumns,
            { key: 'total', header: 'الإجمالي', numeric: true, render: (row: any) => <Money value={row.total} strong />, sortValue: (row: any) => row.total },
          ]}
          footer={data ? { vendor: 'الإجمالي', ...Object.fromEntries(BUCKETS.map(([key]) => [key, <Money value={data.totals[key]} strong />])), total: <Money value={data.totals.total} strong /> } : undefined}
        />
      </Panel>
      <Panel flush title="الفواتير المفتوحة">
        <DataTable
          dense loading={isLoading} rows={data?.items || []} rowKey={(row: any, index: number) => `${row.apKey}-${index}`} maxHeight="60vh" empty={{ title: 'لا فواتير مفتوحة' }}
          onRowClick={(row: any) => row.billId && navigate(`/accounting/bills/${row.billId}`)}
          columns={[
            { key: 'vendor', header: 'المورد', render: (row: any) => row.vendor },
            { key: 'bill', header: 'الفاتورة', render: (row: any) => (row.kind === 'bill' ? <><Ltr>{row.number}</Ltr>{row.vendorRef && <Sub>رقم المورد <Ltr>{row.vendorRef}</Ltr></Sub>}</> : row.kind === 'advance' ? <Badge tone="info">دفعة مقدمة</Badge> : <span className="acc-muted">بدون فاتورة محددة</span>) },
            { key: 'since', header: 'منذ', render: (row: any) => <><Ltr>{row.since}</Ltr><Sub>{row.age} يوماً</Sub></>, sortValue: (row: any) => row.age },
            { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong />, sortValue: (row: any) => row.open },
          ]}
        />
      </Panel>
    </>
  );
};

const Fx = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>(thisYear());
  const { data, error, isLoading, load } = useReport('reports/fx', period);
  return (
    <>
      <Panel
        flush title="فروقات الصرف" subtitle="ربح أو خسارة تحققت عند خروج عملة من خزينة أو محفظة بسعر يختلف عن متوسط سعر دخولها. الموجب ربح."
        actions={<Actions onExport={() => exportSheet('fx', (data?.byMonth || []).map((r: any) => ({ month: r.month, entries: r.count, usd: dollars(r.amount) })), data?.reviewStatus)} />}
      >
        <PeriodBar value={period} onChange={setPeriod} onApply={(next) => load(next || period)} />
        <ReviewNotice data={data} />
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
        {data && <div className="px-3 pb-2"><StatGrid><Stat label="صافي فروقات الصرف" value={<Money value={data.total} />} tone={data.total < 0 ? 'danger' : 'accent'} hint={data.total < 0 ? 'خسارة' : 'ربح'} /></StatGrid></div>}
        <DataTable
          dense loading={isLoading} rows={data?.byEvent || []} rowKey={(row: any) => row.eventType} empty={{ title: 'لا فروقات صرف في هذه الفترة' }}
          onRowClick={() => data?.accountId && navigate(ledgerLink(data.accountId, period))}
          columns={[
            { key: 'event', header: 'مصدر الفرق', render: (row: any) => EVENT_LABELS[row.eventType] || row.eventType },
            { key: 'count', header: 'عدد القيود', numeric: true },
            { key: 'amount', header: 'ربح (+) / خسارة (−)', numeric: true, render: (row: any) => <Money value={row.amount} strong /> },
          ]}
        />
      </Panel>
      <Panel flush title="حسب الشهر">
        <DataTable
          dense loading={isLoading} rows={data?.byMonth || []} rowKey={(row: any) => row.month} empty={{ title: 'لا بيانات' }}
          columns={[
            { key: 'month', header: 'الشهر', render: (row: any) => <Ltr>{row.month}</Ltr> },
            { key: 'count', header: 'عدد القيود', numeric: true },
            { key: 'amount', header: 'ربح (+) / خسارة (−)', numeric: true, render: (row: any) => <Money value={row.amount} strong /> },
          ]}
        />
      </Panel>
    </>
  );
};

// ---------- Page ----------

const TABS: [string, string][] = [
  ['income', 'قائمة الدخل'], ['balance', 'الميزانية'], ['cash', 'التدفقات النقدية والخزائن'], ['trips', 'ربحية الرحلات'], ['purchases', 'ربحية فواتير الشراء'],
  ['receivables', 'ديون العملاء'], ['customer', 'كشف حساب عميل'], ['payables', 'ذمم الموردين'], ['fx', 'فروقات الصرف'],
];

const Reports = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab')! : 'income';
  const [statementOf, setStatementOf] = useState<any>(params.get('customer') ? { _id: params.get('customer') } : null);
  const go = (next: string) => setParams({ tab: next });

  return (
    <>
      <PageHeader title="التقارير" subtitle="كل الأرقام من دفتر الأستاذ مباشرة، بالدولار. اضغط أي حساب أو سطر للوصول إلى القيود التي كوّنته." />
      <div className="acc-tabs acc-noprint">
        <Tabs value={tab} onChange={(_, value) => go(value)} variant="scrollable" scrollButtons="auto">
          {TABS.map(([key, label]) => <Tab key={key} value={key} label={label} />)}
        </Tabs>
      </div>
      {tab === 'income' && <IncomeStatement />}
      {tab === 'balance' && <BalanceSheet />}
      {tab === 'cash' && <CashFlow />}
      {tab === 'trips' && <Trips />}
      {tab === 'purchases' && <Purchases />}
      {tab === 'receivables' && <Receivables openStatement={(customer) => { setStatementOf(customer); go('customer'); }} />}
      {tab === 'customer' && <CustomerStatement initial={statementOf} />}
      {tab === 'payables' && <Payables />}
      {tab === 'fx' && <Fx />}
    </>
  );
};

export default Reports;
