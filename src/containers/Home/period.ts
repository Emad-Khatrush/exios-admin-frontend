import moment, { Moment } from 'moment';

export type PeriodMode = 'day' | 'week' | 'month' | 'custom';

// `date` anchors day/week/month; `from`/`to` are used by custom. All YYYY-MM-DD.
export type DashboardPeriod = {
  mode: PeriodMode
  date: string
  from: string
  to: string
}

export type PeriodRange = {
  from: string
  to: string
  prevFrom?: string
  prevTo?: string
  label: string
  compareLabel: string
  isCurrent: boolean
  canGoNext: boolean
}

export const DATE_FORMAT = 'YYYY-MM-DD';
export const PERIOD_MODES: PeriodMode[] = ['day', 'week', 'month', 'custom'];

const fmt = (date: Moment) => date.format(DATE_FORMAT);

export const defaultPeriod = (): DashboardPeriod => {
  const today = fmt(moment());
  return { mode: 'month', date: today, from: fmt(moment().startOf('month')), to: today };
};

// Reads the period from the page URL (?period=week&date=2026-09-20 or ?period=custom&from=..&to=..)
export const periodFromSearch = (params: URLSearchParams): DashboardPeriod => {
  const fallback = defaultPeriod();
  const mode = params.get('period') as PeriodMode;
  const valid = (value: string | null) => !!value && moment(value, DATE_FORMAT, true).isValid();

  if (!PERIOD_MODES.includes(mode)) return fallback;
  if (mode === 'custom') {
    const from = params.get('from');
    const to = params.get('to');
    if (!valid(from) || !valid(to) || to! < from!) return fallback;
    return { ...fallback, mode, from: from!, to: to! };
  }
  const date = params.get('date');
  return { ...fallback, mode, date: valid(date) ? date! : fallback.date };
};

export const periodToSearch = (period: DashboardPeriod): Record<string, string> =>
  period.mode === 'custom'
    ? { period: 'custom', from: period.from, to: period.to }
    : { period: period.mode, date: period.date };

// Turns the selection into the API range. Periods that are still running end today
// and are compared with the same stretch of the period before (1-28 Sep vs 1-28 Aug).
export const getPeriodRange = (period: DashboardPeriod): PeriodRange => {
  const today = moment().endOf('day');

  if (period.mode === 'custom') {
    const from = moment(period.from, DATE_FORMAT);
    const to = moment(period.to, DATE_FORMAT);
    const sameYear = from.year() === to.year();
    return {
      from: period.from,
      to: period.to,
      label: from.isSame(to, 'day')
        ? to.format('ddd, D MMM YYYY')
        : `${from.format(sameYear ? 'D MMM' : 'D MMM YYYY')} – ${to.format('D MMM YYYY')}`,
      compareLabel: 'previous period',
      isCurrent: false,
      canGoNext: false,
    };
  }

  const unit = period.mode;
  const anchor = moment(period.date, DATE_FORMAT);
  const start = anchor.clone().startOf(unit);
  const fullEnd = anchor.clone().endOf(unit);
  const end = moment.min(fullEnd, today);
  const isCurrent = today.isBetween(start, fullEnd, undefined, '[]');
  const prevStart = start.clone().subtract(1, unit);
  const prevEnd = moment.min(end.clone().subtract(1, unit), start.clone().subtract(1, 'day'));

  let label: string;
  let compareLabel: string;
  if (unit === 'day') {
    label = isCurrent ? 'Today' : start.isSame(moment().subtract(1, 'day'), 'day') ? 'Yesterday' : start.format('ddd, D MMM YYYY');
    compareLabel = 'previous day';
  } else if (unit === 'week') {
    const startFormat = start.year() !== fullEnd.year() ? 'D MMM YYYY' : start.month() !== fullEnd.month() ? 'D MMM' : 'D';
    const range = `${start.format(startFormat)} – ${fullEnd.format('D MMM YYYY')}`;
    label = isCurrent ? `This week · ${range}` : range;
    compareLabel = 'last week';
  } else {
    label = isCurrent ? `This month · ${start.format('MMMM YYYY')}` : start.format('MMMM YYYY');
    compareLabel = 'last month';
  }

  return {
    from: fmt(start),
    to: fmt(end),
    prevFrom: fmt(prevStart),
    prevTo: fmt(prevEnd),
    label,
    compareLabel,
    isCurrent,
    canGoNext: fullEnd.isBefore(today),
  };
};

export const shiftPeriod = (period: DashboardPeriod, step: 1 | -1): DashboardPeriod => {
  if (period.mode === 'custom') return period;
  return { ...period, date: fmt(moment(period.date, DATE_FORMAT).add(step, period.mode)) };
};
