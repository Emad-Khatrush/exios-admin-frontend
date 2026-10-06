import { useCallback, useEffect, useRef, useState } from 'react';
import moment from 'moment';
import api from '../../api';
import { GoalPeriod, GoalsDashboard, localizeDashboard } from './goalsData';

// Dashboards already loaded, by period and date: shown at once when switching back, then refreshed
// quietly. Kept for a minute, like the API's own cache.
const CACHE_TTL = 60 * 1000;
const cache = new Map<string, { at: number, data: GoalsDashboard }>();
const cacheKey = (period: GoalPeriod, date: string) => `${period}|${date}`;

export const clearGoalsCache = () => cache.clear();

const fetchDashboard = async (period: GoalPeriod, date: string) => {
  const res = await api.get('goals/dashboard', { period, ...(date ? { date } : {}) });
  const data = localizeDashboard(res.data);
  cache.set(cacheKey(period, date), { at: Date.now(), data });
  return data;
};

// Loads the goals dashboard for a week or month. `date` is any day inside it, '' for the current one.
// Shipping is counted from China only; sales from every country (the API's rule).
export const useGoalsDashboard = () => {
  const [period, setPeriodState] = useState<GoalPeriod>('week');
  const [date, setDate] = useState('');
  const [data, setData] = useState<GoalsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const request = useRef(0);

  const load = useCallback(async (force = false) => {
    const id = ++request.current;
    const cached = force ? undefined : cache.get(cacheKey(period, date));
    setError(undefined);
    if (cached) {
      setData(cached.data);
      if (Date.now() - cached.at < CACHE_TTL) {
        setIsLoading(false);
        return;
      }
    }
    // With something already on screen the refresh happens without dimming the page
    setIsLoading(!cached);
    try {
      const fresh = await fetchDashboard(period, date);
      if (id !== request.current) return;
      setData(fresh);
      // The other view is one click away; have it ready
      const other: GoalPeriod = period === 'week' ? 'month' : 'week';
      if (!cache.has(cacheKey(other, ''))) fetchDashboard(other, '').catch(() => {});
    } catch (err: any) {
      if (id === request.current) setError(err?.response?.data?.message || 'تعذر تحميل الأهداف. حاول مرة أخرى.');
    } finally {
      if (id === request.current) setIsLoading(false);
    }
  }, [period, date]);

  useEffect(() => { load(); }, [load]);

  // After goals are saved every cached copy is out of date
  const reload = useCallback(() => {
    cache.clear();
    return load(true);
  }, [load]);

  const setPeriod = (next: GoalPeriod) => {
    setPeriodState(next);
    setDate('');
  };

  const shift = (direction: -1 | 1) => {
    if (!data) return;
    const next = moment(data.from).add(direction, period);
    setDate(next.isAfter(moment(), 'day') ? '' : next.format('YYYY-MM-DD'));
  };

  return { period, date, data, isLoading, error, reload, setPeriod, setDate, shift };
};
