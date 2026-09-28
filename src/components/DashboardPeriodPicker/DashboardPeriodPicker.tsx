import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import moment from 'moment';
import { useRef } from 'react';
import { DashboardPeriod, DATE_FORMAT, defaultPeriod, getPeriodRange, PERIOD_MODES, PeriodMode, shiftPeriod } from '../../containers/Home/period';

import './DashboardPeriodPicker.scss';

type Props = {
  period: DashboardPeriod
  onChange: (period: DashboardPeriod) => void
  isLoading?: boolean
  // Optional "All time" choice; while active no period is applied.
  allTime?: { active: boolean, onSelect: () => void }
};

const MODE_LABELS: Record<PeriodMode, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  custom: 'Custom',
};

const RESET_LABELS: Record<PeriodMode, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  custom: '',
};

const DashboardPeriodPicker = ({ period, onChange, isLoading, allTime }: Props) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const range = getPeriodRange(period);
  const today = moment().format(DATE_FORMAT);
  const isAllTime = !!allTime?.active;

  const changeMode = (mode: PeriodMode) => {
    // Coming back from "All time" starts at the current day/week/month.
    if (isAllTime) {
      onChange({ ...defaultPeriod(), mode });
      return;
    }
    if (mode === period.mode) return;
    if (mode === 'custom') {
      // Start custom from whatever is on screen, so it's easy to adjust.
      onChange({ ...period, mode, from: range.from, to: range.to });
    } else {
      onChange({ ...period, mode, date: range.to });
    }
  };

  const openDatePicker = () => {
    const input = dateInputRef.current as any;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return (
    <div className="dash-period" aria-busy={isLoading}>
      <div className="dash-period-modes" role="radiogroup" aria-label="Period">
        {allTime && (
          <button
            type="button"
            role="radio"
            aria-checked={isAllTime}
            className={`dash-period-mode ${isAllTime ? 'is-active' : ''}`}
            onClick={allTime.onSelect}
          >
            All time
          </button>
        )}
        {PERIOD_MODES.map(mode => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={!isAllTime && period.mode === mode}
            className={`dash-period-mode ${!isAllTime && period.mode === mode ? 'is-active' : ''}`}
            onClick={() => changeMode(mode)}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {isAllTime ? null : period.mode === 'custom' ? (
        <div className="dash-period-custom">
          <label>
            <span>From</span>
            <input
              type="date"
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={today}
              onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="dash-period-nav">
          <button
            type="button"
            className="dash-period-arrow"
            aria-label={`Previous ${period.mode}`}
            onClick={() => onChange(shiftPeriod(period, -1))}
          >
            <ChevronLeft size={17} />
          </button>

          <span className="dash-period-current-wrap">
            <button type="button" className="dash-period-current" onClick={openDatePicker} title="Pick a date">
              <CalendarDays size={15} strokeWidth={2} />
              <span>{range.label}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              className="dash-period-hidden-input"
              value={period.date}
              max={today}
              onChange={(e) => e.target.value && onChange({ ...period, date: e.target.value })}
            />
          </span>

          <button
            type="button"
            className="dash-period-arrow"
            aria-label={`Next ${period.mode}`}
            disabled={!range.canGoNext}
            onClick={() => onChange(shiftPeriod(period, 1))}
          >
            <ChevronRight size={17} />
          </button>

          {!range.isCurrent && (
            <button
              type="button"
              className="dash-period-reset"
              onClick={() => onChange({ ...defaultPeriod(), mode: period.mode })}
            >
              {RESET_LABELS[period.mode]}
            </button>
          )}
        </div>
      )}

      {isLoading && <Loader2 size={17} className="dash-period-spinner" aria-label="Loading" />}
    </div>
  );
};

export default DashboardPeriodPicker;
