import moment from 'moment';

export type GoalMetric = 'sales' | 'air' | 'lcl' | 'fcl';
export type GoalPeriod = 'week' | 'month';

export type GoalScore = {
  target: number
  actual: number
  remaining: number
  progress: number | null
  incentiveLYD: number
  hit: boolean
  earnedLYD?: number
};

export type MetricScores = Record<GoalMetric, GoalScore>;

export type GoalOffice = { code: string, name: string };

export type GoalHistoryItem = {
  key: string
  label: string
  from: string
  to: string
  isCurrent: boolean
  offices: Record<string, MetricScores>
  totals: MetricScores
};

export type GoalDay = {
  day: string
  label: string
  isFuture: boolean
  offices: Record<string, Record<GoalMetric, number>>
};

// Only China is tracked for now; everything else is grouped as "other"
export type CountryCode = 'CN';
export type CountryFilter = 'all' | CountryCode;
type Breakdown = Record<string, Partial<Record<CountryCode | 'other', Record<GoalMetric | 'orders', number>>>>;

export type GoalsDashboard = {
  period: GoalPeriod
  country: CountryFilter
  countries: CountryCode[]
  breakdown: { current: Breakdown, previous: Breakdown }
  from: string
  to: string
  label: string
  isCurrent: boolean
  canGoNext: boolean
  totalDays: number
  elapsedDays: number
  offices: GoalOffice[]
  board: Record<string, MetricScores>
  totals: MetricScores
  history: GoalHistoryItem[]
  daily: GoalDay[]
  leaderboard?: { userId: string, name: string, office: string, sales: number, orders: number }[]
  me?: { office: string, sales: number, orders: number, air: number, lcl: number, shareOfOffice: number | null }
};

export type GoalSetting = { office: string, country: CountryFilter, metric: GoalMetric, period: GoalPeriod, target: number, incentiveLYD: number };

export const METRICS: GoalMetric[] = ['sales', 'air', 'lcl', 'fcl'];

export const COUNTRY_LABEL: Record<CountryFilter | 'other', string> = {
  all: 'كل الدول',
  CN: 'الصين',
  other: 'دول أخرى',
};

export type CountryRow = { country: CountryCode | 'other', value: number, share: number, previous: number, change: number | null };

// Where the selected metric came from in the period, biggest first, with the period before for comparison
export const countryRows = (dashboard: Pick<GoalsDashboard, 'breakdown'>, scope: string, metric: GoalMetric): CountryRow[] => {
  const sum = (side: Breakdown) => {
    const totals: Record<string, number> = {};
    Object.entries(side || {}).forEach(([office, byCountry]) => {
      if (scope !== 'all' && office !== scope) return;
      Object.entries(byCountry || {}).forEach(([country, values]) => { totals[country] = (totals[country] || 0) + (values?.[metric] || 0); });
    });
    return totals;
  };
  const current = sum(dashboard.breakdown?.current);
  const previous = sum(dashboard.breakdown?.previous);
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  return (Object.keys({ ...current, ...previous }) as (CountryCode | 'other')[])
    .map((country) => {
      const value = current[country] || 0;
      const before = previous[country] || 0;
      return { country, value, share: total > 0 ? value / total : 0, previous: before, change: before > 0 ? (value - before) / before : null };
    })
    .filter((row) => row.value > 0 || row.previous > 0)
    .sort((a, b) => b.value - a.value || b.previous - a.previous);
};

export const METRIC_META: Record<GoalMetric, { label: string, hint: string, unit: string, digits: number }> = {
  sales: { label: 'المبيعات', hint: 'كل الفواتير بالدولار، من كل الدول', unit: 'دولار', digits: 0 },
  air: { label: 'الشحن الجوي', hint: 'الكيلوغرامات المستلمة جواً من الصين', unit: 'كجم', digits: 1 },
  lcl: { label: 'بحري LCL', hint: 'شحن مشترك من الصين، بالمتر المكعب', unit: 'CBM', digits: 2 },
  fcl: { label: 'بحري FCL', hint: 'حاوية كاملة لعميل من الصين', unit: 'حاوية', digits: 0 },
};

// "هدف الأسبوع" / "هدف الشهر", and the plural for "in the last N weeks"
export const PERIOD_WORD: Record<GoalPeriod, string> = { week: 'الأسبوع', month: 'الشهر' };
export const PERIOD_PLURAL: Record<GoalPeriod, string> = { week: 'أسابيع', month: 'أشهر' };
export const THIS_PERIOD: Record<GoalPeriod, string> = { week: 'هذا الأسبوع', month: 'هذا الشهر' };

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Western digits are kept on purpose: the rest of the admin uses them and they read the same in RTL
export const formatNumber = (value: number, digits = 0) =>
  (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const containersWord = (value: number) => (Number.isInteger(value) && value >= 3 && value <= 10 ? 'حاويات' : 'حاوية');

export const formatMetric = (metric: GoalMetric, value: number) => {
  const meta = METRIC_META[metric];
  if (metric === 'sales') return `$${formatNumber(value, meta.digits)}`;
  if (metric === 'fcl') return `${formatNumber(value, 1)} ${containersWord(Number(value) || 0)}`;
  return `${formatNumber(value, meta.digits)} ${meta.unit}`;
};

export const formatLYD = (value: number) => `${formatNumber(value)} د.ل`;

const OFFICE_NAMES: Record<string, string> = {
  tripoli: 'طرابلس',
  benghazi: 'بنغازي',
  misurata: 'مصراتة',
  turkey: 'تركيا',
  china: 'الصين',
};

export const officeName = (offices: GoalOffice[], code: string) => {
  const name = offices.find((office) => office.code === code)?.name;
  // Offices without a name of their own come back named by their code
  return (name && name !== code ? name : OFFICE_NAMES[code]) || name || code;
};

const day = (date: string) => moment(date, 'YYYY-MM-DD');

// "4 - 10 أكتوبر 2026", "28 سبتمبر - 4 أكتوبر 2026" or "أكتوبر 2026"
export const periodLabel = (period: GoalPeriod, from: string, to: string) => {
  const start = day(from);
  const end = day(to);
  if (period === 'month') return `${MONTHS[start.month()]} ${start.year()}`;
  return start.month() === end.month()
    ? `${start.date()} - ${end.date()} ${MONTHS[end.month()]} ${end.year()}`
    : `${start.date()} ${MONTHS[start.month()]} - ${end.date()} ${MONTHS[end.month()]} ${end.year()}`;
};

// Short axis label for a bar: the month's name, or the week's first day as day/month
export const shortPeriodLabel = (period: GoalPeriod, from: string) => {
  const start = day(from);
  return period === 'month' ? MONTHS[start.month()] : `${start.date()}/${start.month() + 1}`;
};

export const dayLabel = (period: GoalPeriod, date: string) => {
  const value = day(date);
  return period === 'week' ? `${DAYS[value.day()]} ${value.date()}` : String(value.date());
};

export const fullDayLabel = (date: string) => {
  const value = day(date);
  return `${DAYS[value.day()]} ${value.date()} ${MONTHS[value.month()]}`;
};

// The API names periods in English; the page shows them in Arabic
export const localizeDashboard = (data: GoalsDashboard): GoalsDashboard => ({
  ...data,
  label: periodLabel(data.period, data.from, data.to),
  history: data.history.map((item) => ({ ...item, label: periodLabel(data.period, item.from, item.to) })),
  daily: data.daily.map((item) => ({ ...item, label: dayLabel(data.period, item.day) })),
  offices: data.offices.map((office) => ({ ...office, name: officeName(data.offices, office.code) })),
});

export type PaceStatus = 'reached' | 'onPace' | 'behind' | 'missed' | 'upcoming' | 'noGoal';

export type Pace = {
  status: PaceStatus
  // What is still needed each day, today included (running periods only)
  perDay: number | null
  // Where the period ends at the current speed (running periods only)
  projected: number | null
  daysLeft: number
};

// How a goal is going given how much of the period has passed
export const paceOf = (score: GoalScore, dashboard: Pick<GoalsDashboard, 'totalDays' | 'elapsedDays' | 'isCurrent'>): Pace => {
  const { totalDays, elapsedDays, isCurrent } = dashboard;
  const daysLeft = isCurrent ? Math.max(1, totalDays - elapsedDays + 1) : 0;
  if (!score.target) return { status: 'noGoal', perDay: null, projected: null, daysLeft };
  if (score.hit) return { status: 'reached', perDay: null, projected: isCurrent ? score.actual / Math.max(1, elapsedDays) * totalDays : null, daysLeft };
  if (elapsedDays === 0) return { status: 'upcoming', perDay: score.target / totalDays, projected: null, daysLeft: totalDays };
  if (!isCurrent) return { status: 'missed', perDay: null, projected: null, daysLeft };
  // Today counts as half gone, so a quiet morning does not read as behind
  const expected = score.target * Math.max(0, elapsedDays - 0.5) / totalDays;
  return {
    status: score.actual >= expected ? 'onPace' : 'behind',
    perDay: score.remaining / daysLeft,
    projected: score.actual / elapsedDays * totalDays,
    daysLeft,
  };
};

export const PACE_LABEL: Record<PaceStatus, string> = {
  reached: 'تحقق',
  onPace: 'على المسار',
  behind: 'متأخر',
  missed: 'لم يتحقق',
  upcoming: 'لم يبدأ',
  noGoal: 'بدون هدف',
};

// The scores to show for one office, or every office together
export const scoresFor = (scope: string, board: Record<string, MetricScores>, totals: MetricScores) =>
  scope === 'all' ? totals : board[scope];

export type HistoryStats = { periods: number, hits: number, best: { label: string, value: number } | null, average: number, averageProgress: number | null };

// Over the periods before the selected one: how often the goal was hit, the best result and the average
export const historyStats = (history: GoalHistoryItem[], scope: string, metric: GoalMetric): HistoryStats => {
  const done = history.filter((item) => !item.isCurrent && moment(item.to).isBefore(moment(), 'day'));
  const rows = done.map((item) => ({ label: item.label, score: (scope === 'all' ? item.totals : item.offices[scope])?.[metric] })).filter((row) => row.score);
  const withGoal = rows.filter((row) => row.score.target > 0);
  const best = rows.reduce<HistoryStats['best']>((top, row) => (!top || row.score.actual > top.value ? { label: row.label, value: row.score.actual } : top), null);
  return {
    periods: withGoal.length,
    hits: withGoal.filter((row) => row.score.hit).length,
    best: best && best.value > 0 ? best : null,
    average: rows.length ? rows.reduce((sum, row) => sum + row.score.actual, 0) / rows.length : 0,
    averageProgress: withGoal.length ? withGoal.reduce((sum, row) => sum + row.score.actual / row.score.target, 0) / withGoal.length : null,
  };
};

export const dailyValues = (daily: GoalDay[], scope: string, metric: GoalMetric) => daily.map((item) => ({
  ...item,
  value: scope === 'all'
    ? Object.values(item.offices).reduce((sum, office) => sum + (office[metric] || 0), 0)
    : item.offices[scope]?.[metric] || 0,
}));

// Numbers with "$" or a Latin unit keep their order inside an Arabic sentence
const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);
const iso = (text: string) => FSI + text + PDI;
const fmt = (metric: GoalMetric, value: number) => iso(formatMetric(metric, value));

const daysLeftText = (days: number) => (days === 1 ? 'اليوم الأخير' : days === 2 ? 'اليومين المتبقيين' : days <= 10 ? `${days} أيام متبقية` : `${days} يوماً متبقياً`);

// Short sentences that point at what to do next, most useful first
export const buildInsights = (dashboard: GoalsDashboard, scope: string): string[] => {
  const scores = scoresFor(scope, dashboard.board, dashboard.totals);
  if (!scores) return [];
  const needs = scope === 'all' ? 'جميع المكاتب تحتاج' : `مكتب ${officeName(dashboard.offices, scope)} يحتاج`;
  const word = PERIOD_WORD[dashboard.period];
  const notes: string[] = [];
  const lydIso = (value: number) => iso(formatLYD(value));

  METRICS.forEach((metric) => {
    const score = scores[metric];
    const pace = paceOf(score, dashboard);
    const label = METRIC_META[metric].label;
    if (pace.status === 'behind' && metric === 'fcl') {
      notes.push(`${needs} ${fmt(metric, score.remaining)} إضافية لتحقيق هدف ${word}.`);
    } else if (pace.status === 'behind' && pace.perDay !== null) {
      notes.push(`${needs} ${fmt(metric, pace.perDay)} يومياً في ${label} خلال ${daysLeftText(pace.daysLeft)} لتحقيق هدف ${word}.`);
    } else if (pace.status === 'onPace' && pace.projected !== null) {
      notes.push(`${label} على المسار: بهذه الوتيرة ينتهي ${word} عند حوالي ${fmt(metric, pace.projected)} مقابل هدف ${fmt(metric, score.target)}.`);
    } else if (pace.status === 'reached' && score.incentiveLYD > 0) {
      notes.push(`تحقق هدف ${label}، وحصل الفريق على ${lydIso(score.incentiveLYD)}.`);
    }
  });

  const sales = historyStats(dashboard.history, scope, 'sales');
  if (sales.periods >= 2) {
    notes.push(`تحقق هدف المبيعات في ${sales.hits} من آخر ${sales.periods} ${PERIOD_PLURAL[dashboard.period]}.`);
  }
  if (sales.averageProgress !== null && sales.averageProgress < 0.8) {
    notes.push(`متوسط المبيعات ${Math.round(sales.averageProgress * 100)}% من الهدف. قد يحتاج الهدف إلى خطة عمل أو مراجعة.`);
  }
  if (scope === 'all') {
    const lagging = dashboard.offices
      .map((office) => ({ office, score: dashboard.board[office.code]?.sales }))
      .filter((row) => row.score && row.score.target > 0 && !row.score.hit)
      .sort((a, b) => (a.score.progress || 0) - (b.score.progress || 0))[0];
    if (lagging && dashboard.isCurrent) {
      notes.push(`مكتب ${officeName(dashboard.offices, lagging.office.code)} هو الأبعد عن هدف المبيعات، بنسبة ${Math.round((lagging.score.progress || 0) * 100)}%.`);
    }
  }
  if (dashboard.country !== 'all') {
    const row = countryRows(dashboard, scope, 'sales').find((item) => item.country === dashboard.country);
    const name = COUNTRY_LABEL[dashboard.country];
    if (row && row.value > 0) {
      notes.unshift(`${name} تمثل ${Math.round(row.share * 100)}% من المبيعات في ${THIS_PERIOD[dashboard.period]}${row.change !== null ? `، ${row.change >= 0 ? 'بزيادة' : 'بانخفاض'} ${Math.abs(Math.round(row.change * 100))}% عن ${PERIOD_WORD[dashboard.period]} السابق` : ''}.`);
    } else {
      notes.unshift(`لا توجد مبيعات من ${name} في ${THIS_PERIOD[dashboard.period]} حتى الآن.`);
    }
  }
  return notes.slice(0, 5);
};
