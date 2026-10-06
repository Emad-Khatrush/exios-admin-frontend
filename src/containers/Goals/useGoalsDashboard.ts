import { useCallback, useEffect, useRef, useState } from 'react';
import moment from 'moment';
import api from '../../api';
import { GoalPeriod, GoalsDashboard, localizeDashboard } from './goalsData';

// Loads the goals dashboard for a week or month. `date` is any day inside it, '' for the current one.
// Shipping is counted from China only; sales from every country (the API's rule).
export const useGoalsDashboard = () => {
  const [period, setPeriodState] = useState<GoalPeriod>('week');
  const [date, setDate] = useState('');
  const [data, setData] = useState<GoalsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const res = await api.get('goals/dashboard', { period, ...(date ? { date } : {}) });
      if (id === request.current) setData(localizeDashboard(res.data));
    } catch (err: any) {
      if (id === request.current) setError(err?.response?.data?.message || 'تعذر تحميل الأهداف. حاول مرة أخرى.');
    } finally {
      if (id === request.current) setIsLoading(false);
    }
  }, [period, date]);

  useEffect(() => { load(); }, [load]);

  const setPeriod = (next: GoalPeriod) => {
    setPeriodState(next);
    setDate('');
  };

  const shift = (direction: -1 | 1) => {
    if (!data) return;
    const next = moment(data.from).add(direction, period);
    setDate(next.isAfter(moment(), 'day') ? '' : next.format('YYYY-MM-DD'));
  };

  return { period, date, data, isLoading, error, reload: load, setPeriod, setDate, shift };
};
