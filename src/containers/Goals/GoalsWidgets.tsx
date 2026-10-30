import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock, Coins, Minus, TrendingUp, XCircle } from 'lucide-react';
import {
  COUNTRY_LABEL, CountryFilter, countryRows,
  dailyValues, formatLYD, formatMetric, fullDayLabel, GoalDay, GoalHistoryItem, GoalMetric, GoalPeriod, GoalScore, GoalsDashboard,
  METRIC_META, METRICS, MetricScores, Pace, PACE_LABEL, paceOf, PaceStatus, PERIOD_WORD, shortPeriodLabel, THIS_PERIOD,
} from './goalsData';

const PACE_ICON: Record<PaceStatus, typeof CheckCircle2> = {
  reached: CheckCircle2,
  onPace: TrendingUp,
  behind: AlertTriangle,
  missed: XCircle,
  upcoming: Clock,
  noGoal: Minus,
};

export const PaceBadge = ({ pace }: { pace: Pace }) => {
  const Icon = PACE_ICON[pace.status];
  return (
    <span className={`goal-pace goal-pace--${pace.status}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
      {PACE_LABEL[pace.status]}
    </span>
  );
};

// A goal meter, filling from the right: the fill is how much of the goal is done, the tick is where the pace says it should be
export const GoalMeter = ({ score, expected, label }: { score: GoalScore, expected?: number | null, label: string }) => {
  const progress = score.target > 0 ? Math.min(1, score.actual / score.target) : 0;
  return (
    <div
      className={`goal-meter ${score.hit ? 'is-hit' : ''}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={score.target || 1}
      aria-valuenow={Math.min(score.actual, score.target || score.actual)}
    >
      <span className="goal-meter__fill" style={{ transform: `scaleX(${progress})` }} />
      {score.target > 0 && !score.hit && expected !== null && expected !== undefined && expected > 0 && expected < 1 && (
        <span className="goal-meter__tick" style={{ right: `${expected * 100}%` }} title="أين يجب أن تكون حتى اليوم" />
      )}
    </div>
  );
};

const expectedShare = (dashboard: Pick<GoalsDashboard, 'isCurrent' | 'elapsedDays' | 'totalDays'>) =>
  dashboard.isCurrent ? Math.max(0, dashboard.elapsedDays - 0.5) / dashboard.totalDays : null;

type TileProps = {
  metric: GoalMetric
  score: GoalScore
  dashboard: Pick<GoalsDashboard, 'isCurrent' | 'elapsedDays' | 'totalDays'>
  isActive?: boolean
  onSelect?: () => void
};

// One metric of the selected period: done, goal, what is left and how it is going
export const MetricTile = ({ metric, score, dashboard, isActive, onSelect }: TileProps) => {
  const meta = METRIC_META[metric];
  const pace = paceOf(score, dashboard);
  const percent = score.target > 0 ? Math.round((score.actual / score.target) * 100) : null;
  const Wrapper: any = onSelect ? 'button' : 'div';
  // All-offices totals carry what the offices that reached their goals earned
  const earned = score.earnedLYD !== undefined ? score.earnedLYD : score.hit ? score.incentiveLYD : 0;
  return (
    <Wrapper
      {...(onSelect ? { type: 'button', onClick: onSelect, 'aria-pressed': !!isActive } : {})}
      className={`goal-tile ${isActive ? 'is-active' : ''} ${onSelect ? 'is-button' : ''}`}
    >
      <div className="goal-tile__head">
        <div>
          <p className="goal-tile__label">{meta.label}</p>
          <p className="goal-tile__hint">{meta.hint}</p>
        </div>
        <PaceBadge pace={pace} />
      </div>

      <p className="goal-tile__value">
        <bdi>{formatMetric(metric, score.actual)}</bdi>
        {percent !== null && <span className="goal-tile__percent">{percent}%</span>}
      </p>

      <GoalMeter score={score} expected={expectedShare(dashboard)} label={`تقدم ${meta.label}`} />

      <dl className="goal-tile__facts">
        <div>
          <dt>الهدف</dt>
          <dd>{score.target > 0 ? <bdi>{formatMetric(metric, score.target)}</bdi> : 'غير محدد'}</dd>
        </div>
        <div>
          <dt>المتبقي</dt>
          <dd>{score.target > 0 ? <bdi>{formatMetric(metric, score.remaining)}</bdi> : '-'}</dd>
        </div>
        {pace.perDay !== null && pace.status !== 'upcoming' && metric !== 'fcl' && (
          <div>
            <dt>المطلوب يومياً</dt>
            <dd><bdi>{formatMetric(metric, pace.perDay)}</bdi></dd>
          </div>
        )}
      </dl>

      {score.incentiveLYD > 0 && (
        <p className={`goal-tile__incentive ${earned > 0 ? 'is-earned' : ''}`}>
          <Coins size={14} strokeWidth={2} aria-hidden="true" />
          {earned > 0
            ? earned < score.incentiveLYD ? `تم كسب ${formatLYD(earned)} من ${formatLYD(score.incentiveLYD)}` : `تم كسب ${formatLYD(earned)}`
            : `الحافز ${formatLYD(score.incentiveLYD)}`}
        </p>
      )}
    </Wrapper>
  );
};

type OfficeProps = {
  name: string
  scores: MetricScores
  dashboard: Pick<GoalsDashboard, 'isCurrent' | 'elapsedDays' | 'totalDays'>
  isMine?: boolean
};

// One office: its four goals as compact rows
export const OfficeGoals = ({ name, scores, dashboard, isMine }: OfficeProps) => {
  const reached = METRICS.filter((metric) => scores[metric].hit).length;
  const withGoal = METRICS.filter((metric) => scores[metric].target > 0).length;
  const incentives = METRICS.reduce((sum, metric) => sum + (scores[metric].target > 0 ? scores[metric].incentiveLYD : 0), 0);
  const earned = METRICS.reduce((sum, metric) => sum + (scores[metric].hit ? scores[metric].incentiveLYD : 0), 0);
  return (
    <article className={`goal-office ${isMine ? 'is-mine' : ''}`}>
      <header className="goal-office__head">
        <h3>{name}{isMine && <span className="goal-office__mine">مكتبك</span>}</h3>
        <p>{withGoal ? `تحقق ${reached} من ${withGoal} أهداف` : 'لا توجد أهداف'}</p>
      </header>
      <ul className="goal-office__rows">
        {METRICS.map((metric) => {
          const score = scores[metric];
          const pace = paceOf(score, dashboard);
          return (
            <li key={metric}>
              <div className="goal-office__row-head">
                <span className="goal-office__metric">{METRIC_META[metric].label}</span>
                <PaceBadge pace={pace} />
              </div>
              <div className="goal-office__numbers">
                <strong><bdi>{formatMetric(metric, score.actual)}</bdi></strong>
                <span>{score.target > 0 ? <>من <bdi>{formatMetric(metric, score.target)}</bdi></> : 'بدون هدف'}</span>
                {score.target > 0 && !score.hit && <span className="goal-office__left">متبقي <bdi>{formatMetric(metric, score.remaining)}</bdi></span>}
              </div>
              <GoalMeter score={score} expected={expectedShare(dashboard)} label={`${name}: تقدم ${METRIC_META[metric].label}`} />
            </li>
          );
        })}
      </ul>
      {incentives > 0 && (
        <footer className="goal-office__foot">
          <Coins size={14} strokeWidth={2} aria-hidden="true" />
          {earned > 0 ? `تم كسب ${formatLYD(earned)} من حوافز بقيمة ${formatLYD(incentives)}` : `حوافز بقيمة ${formatLYD(incentives)} بانتظار الفريق`}
        </footer>
      )}
    </article>
  );
};

type PeriodControlsProps = {
  period: GoalPeriod
  label: string
  isCurrent: boolean
  canGoNext: boolean
  history: GoalHistoryItem[]
  selectedKey: string
  onPeriod: (period: GoalPeriod) => void
  onShift: (direction: -1 | 1) => void
  onJump: (date: string) => void
};

// In RTL the previous period sits on the right, so its arrow points right
export const PeriodControls = ({ period, label, isCurrent, canGoNext, history, selectedKey, onPeriod, onShift, onJump }: PeriodControlsProps) => (
  <div className="goal-period">
    <div className="goal-segment" role="tablist" aria-label="فترة الهدف">
      {(['week', 'month'] as GoalPeriod[]).map((value) => (
        <button key={value} type="button" role="tab" aria-selected={period === value} className={period === value ? 'is-active' : ''} onClick={() => onPeriod(value)}>
          {value === 'week' ? 'أسبوعي' : 'شهري'}
        </button>
      ))}
    </div>

    <div className="goal-period__nav">
      <button type="button" className="goal-icon-btn" aria-label={`${PERIOD_WORD[period]} السابق`} onClick={() => onShift(-1)}>
        <ChevronRight size={16} strokeWidth={2} />
      </button>
      <label className="goal-period__select">
        <span className="visually-hidden">اختر {PERIOD_WORD[period]}</span>
        <select value={selectedKey} onChange={(event) => onJump(event.target.value)}>
          {!history.some((item) => item.key === selectedKey) && <option value={selectedKey}>{label}</option>}
          {[...history].reverse().map((item) => (
            <option key={item.key} value={item.key}>{item.isCurrent ? `${item.label} (الحالي)` : item.label}</option>
          ))}
        </select>
      </label>
      <button type="button" className="goal-icon-btn" aria-label={`${PERIOD_WORD[period]} التالي`} onClick={() => onShift(1)} disabled={!canGoNext}>
        <ChevronLeft size={16} strokeWidth={2} />
      </button>
      {!isCurrent && (
        <button type="button" className="goal-link-btn" onClick={() => onJump('')}>
          {THIS_PERIOD[period]}
        </button>
      )}
    </div>
  </div>
);

type HistoryChartProps = {
  period: GoalPeriod
  history: GoalHistoryItem[]
  scope: string
  metric: GoalMetric
  selectedKey: string
  onSelect: (item: GoalHistoryItem) => void
};

// The last periods: a bar per period, a tick where its goal was. Reached bars wear the accent.
// Time runs left to right, as on the rest of the admin's charts.
export const HistoryChart = ({ period, history, scope, metric, selectedKey, onSelect }: HistoryChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const rows = history.map((item) => ({ item, score: (scope === 'all' ? item.totals : item.offices[scope])?.[metric] }));
  const max = Math.max(1, ...rows.map((row) => Math.max(row.score?.actual || 0, row.score?.target || 0))) * 1.08;
  const active = hovered !== null ? rows[hovered] : null;
  const state = (row: typeof rows[number]) => (row.score?.hit ? 'تحقق' : row.item.isCurrent ? 'جارٍ' : 'لم يتحقق');

  return (
    <div className="goal-chart">
      <div className="goal-chart__plot" dir="ltr" onMouseLeave={() => setHovered(null)}>
        {rows.map((row, index) => {
          const { item, score } = row;
          const actual = score?.actual || 0;
          const target = score?.target || 0;
          const status = !target ? 'none' : score?.hit ? 'hit' : item.isCurrent ? 'running' : 'missed';
          return (
            <button
              key={item.key}
              type="button"
              className={`goal-chart__col ${item.key === selectedKey ? 'is-selected' : ''}`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(item)}
              aria-label={`${item.label}: ${formatMetric(metric, actual)}${target ? ` من ${formatMetric(metric, target)}، ${state(row)}` : '، بدون هدف'}`}
            >
              <span className={`goal-chart__bar goal-chart__bar--${status}`} style={{ '--h': actual / max } as any} />
              {target > 0 && <span className="goal-chart__target" style={{ '--t': target / max } as any} />}
              <span className="goal-chart__label">{shortPeriodLabel(period, item.from)}</span>
            </button>
          );
        })}
        {active && (
          <div className="goal-chart__tooltip" dir="rtl" style={{ left: `${((hovered! + 0.5) / rows.length) * 100}%` }} role="status">
            <strong>{active.item.label}</strong>
            <span>{formatMetric(metric, active.score?.actual || 0)}</span>
            <span className="goal-chart__tooltip-muted">
              {active.score?.target ? `الهدف ${formatMetric(metric, active.score.target)}، ${state(active)}` : 'بدون هدف'}
            </span>
          </div>
        )}
      </div>
      <div className="goal-chart__legend" aria-hidden="true">
        <span><i className="goal-key goal-key--hit" />تحقق</span>
        <span><i className="goal-key goal-key--missed" />لم يتحقق</span>
        <span><i className="goal-key goal-key--target" />الهدف</span>
      </div>
    </div>
  );
};

type DailyChartProps = {
  daily: GoalDay[]
  scope: string
  metric: GoalMetric
  perDay: number | null
};

// The selected period day by day, with the even daily share of the goal as a reference line
export const DailyChart = ({ daily, scope, metric, perDay }: DailyChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const days = dailyValues(daily, scope, metric);
  const max = Math.max(1, perDay || 0, ...days.map((item) => item.value)) * 1.1;
  const active = hovered !== null ? days[hovered] : null;
  const dense = days.length > 10;
  return (
    <div className="goal-chart goal-chart--daily">
      <div className="goal-chart__plot" dir="ltr" onMouseLeave={() => setHovered(null)}>
        {perDay !== null && perDay > 0 && (
          <span className="goal-chart__ref" style={{ '--t': perDay / max } as any}>
            <em dir="rtl">{formatMetric(metric, perDay)} يومياً</em>
          </span>
        )}
        {days.map((item, index) => (
          <div
            key={item.day}
            className={`goal-chart__col ${item.isFuture ? 'is-future' : ''}`}
            onMouseEnter={() => setHovered(index)}
            tabIndex={0}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            aria-label={`${fullDayLabel(item.day)}: ${formatMetric(metric, item.value)}`}
          >
            <span className="goal-chart__bar goal-chart__bar--day" style={{ '--h': item.value / max } as any} />
            <span className="goal-chart__label" dir="rtl">{dense && index % 2 === 1 && index !== days.length - 1 ? '' : item.label}</span>
          </div>
        ))}
        {active && (
          <div className="goal-chart__tooltip" dir="rtl" style={{ left: `${((hovered! + 0.5) / days.length) * 100}%` }} role="status">
            <strong>{fullDayLabel(active.day)}</strong>
            <span>{active.isFuture ? 'لم يأتِ بعد' : formatMetric(metric, active.value)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const MetricSwitch = ({ value, onChange }: { value: GoalMetric, onChange: (metric: GoalMetric) => void }) => (
  <div className="goal-segment goal-segment--small" role="tablist" aria-label="الهدف">
    {METRICS.map((metric) => (
      <button key={metric} type="button" role="tab" aria-selected={value === metric} className={value === metric ? 'is-active' : ''} onClick={() => onChange(metric)}>
        {METRIC_META[metric].label}
      </button>
    ))}
  </div>
);

export const GoalsSkeleton = () => (
  <div className="goal-skeleton" aria-busy="true" aria-label="جارٍ تحميل الأهداف">
    <div className="goal-tiles">
      {METRICS.map((metric) => <div key={metric} className="goal-skeleton__block goal-skeleton__block--tile" />)}
    </div>
    <div className="goal-skeleton__block goal-skeleton__block--wide" />
  </div>
);

type BreakdownProps = {
  dashboard: Pick<GoalsDashboard, 'breakdown' | 'period' | 'country'>
  scope: string
  metric: GoalMetric
  // Without it the rows are read-only
  onPick?: (country: CountryFilter) => void
};

// Each country's part of the selected metric this period, and how it moved against the period before
export const CountryBreakdown = ({ dashboard, scope, metric, onPick }: BreakdownProps) => {
  const rows = countryRows(dashboard, scope, metric);
  const top = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="goal-muted">لا توجد بيانات في هذا {PERIOD_WORD[dashboard.period]}.</p>;
  return (
    <ul className="goal-countries">
      {rows.map((row) => {
        const pickable = !!onPick && row.country !== 'other';
        const isActive = dashboard.country === row.country;
        const content = (
          <>
            <div className="goal-countries__head">
              <strong>{COUNTRY_LABEL[row.country]}</strong>
              <span className="goal-countries__value"><bdi>{formatMetric(metric, row.value)}</bdi></span>
            </div>
            <span className="goal-countries__bar" style={{ transform: `scaleX(${row.value / top})` }} aria-hidden="true" />
            <div className="goal-countries__meta">
              <span>{Math.round(row.share * 100)}% من الإجمالي</span>
              {row.change !== null ? (
                <span className={`goal-countries__change ${row.change >= 0 ? 'is-up' : 'is-down'}`}>
                  {row.change >= 0 ? <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" /> : <ArrowDownRight size={13} strokeWidth={2.25} aria-hidden="true" />}
                  {Math.abs(Math.round(row.change * 100))}% عن {PERIOD_WORD[dashboard.period]} السابق
                </span>
              ) : row.value > 0 ? <span className="goal-countries__change">جديد في هذا {PERIOD_WORD[dashboard.period]}</span> : null}
            </div>
          </>
        );
        return (
          <li key={row.country} className={isActive ? 'is-active' : ''}>
            {pickable ? (
              <button type="button" onClick={() => onPick?.(isActive ? 'all' : row.country as CountryFilter)} aria-pressed={isActive} title={isActive ? 'عرض كل الدول' : `عرض ${COUNTRY_LABEL[row.country]} فقط`}>
                {content}
              </button>
            ) : <div>{content}</div>}
          </li>
        );
      })}
    </ul>
  );
};
