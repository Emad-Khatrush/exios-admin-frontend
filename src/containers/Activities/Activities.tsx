import { Alert, Dialog } from '@mui/material';
import { History, Layers, Loader2, X } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { ActivitiesResponse, ActivityKind, ActivityStatus, ActivityType, ActivityUser } from '../../models';
import ActivityItem, { TYPE_ICONS } from './ActivityItem';
import { dayHeading, FILTER_STATUSES, FILTER_TYPES, STATUS_LABELS, TYPE_LABELS } from './activityFormat';

import './Activities.scss';

const PAGE_SIZE = 30;
const FILTER_KEYS = ['type', 'status', 'user', 'from', 'to'] as const;

type Counts = ActivitiesResponse['counts'];

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
];

const Activities = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    user: searchParams.get('user') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  };
  const filterKey = FILTER_KEYS.map((key) => filters[key]).join('|');
  const hasFilters = FILTER_KEYS.some((key) => filters[key]);

  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ byType: {}, byStatus: {} });
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (skip: number) => {
    const params: Record<string, string | number> = { limit: PAGE_SIZE, skip };
    FILTER_KEYS.forEach((key) => { if (filters[key]) params[key] = filters[key]; });
    const { data } = await api.get('activities', params);
    return data as ActivitiesResponse;
    // filterKey captures every filter value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // First page whenever the filters change
  useEffect(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError('');
    fetchPage(0)
      .then((data) => {
        if (id !== requestId.current) return;
        setActivities(data.activities);
        setTotal(data.total);
        setCounts(data.counts || { byType: {}, byStatus: {} });
      })
      .catch(() => { if (id === requestId.current) setError('Could not load activities. Try again.'); })
      .finally(() => { if (id === requestId.current) setIsLoading(false); });
  }, [fetchPage]);

  useEffect(() => {
    api.get('activities/users').then(({ data }) => setUsers(data)).catch(() => setUsers([]));
  }, []);

  const hasMore = activities.length < total;

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(activities.length);
      if (id !== requestId.current) return;
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a._id));
        return [...prev, ...data.activities.filter((a) => !seen.has(a._id))];
      });
      setTotal(data.total);
    } catch {
      if (id === requestId.current) setError('Could not load more activities.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activities.length, fetchPage, hasMore, isLoading, isLoadingMore]);

  // Load the next page when the bottom of the list scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const setFilter = (key: typeof FILTER_KEYS[number], value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const setDateRange = (from: string, to: string) => {
    const next = new URLSearchParams(searchParams);
    if (from) next.set('from', from); else next.delete('from');
    if (to) next.set('to', to); else next.delete('to');
    setSearchParams(next, { replace: true });
  };

  const applyPreset = (days: number) => {
    const today = moment().format('YYYY-MM-DD');
    setDateRange(moment().subtract(days, 'days').format('YYYY-MM-DD'), today);
  };

  const isPresetActive = (days: number) =>
    filters.to === moment().format('YYYY-MM-DD') && filters.from === moment().subtract(days, 'days').format('YYYY-MM-DD');

  const typeTotal = Object.values(counts.byType).reduce((sum, n) => sum + (n || 0), 0);
  const statusTotal = Object.values(counts.byStatus).reduce((sum, n) => sum + (n || 0), 0);

  // Group into days, newest first (the API already sorts)
  const groups: { day: string, items: ActivityType[] }[] = [];
  activities.forEach((activity) => {
    const day = moment(activity.createdAt).format('YYYY-MM-DD');
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(activity);
    else groups.push({ day, items: [activity] });
  });

  return (
    <div className="activities-page">
      <header className="act-header">
        <div className="act-header__title">
          <span className="act-header__icon"><History size={20} strokeWidth={2} /></span>
          <div>
            <h1>Activities</h1>
            <p>Everything your team added, changed or deleted, newest first.</p>
          </div>
        </div>
        {!isLoading && (
          <span className="act-header__count">
            <strong>{total.toLocaleString('en-US')}</strong> {total === 1 ? 'activity' : 'activities'}
            {hasFilters ? ' match' : ''}
          </span>
        )}
      </header>

      <section className="act-filters" aria-label="Filters">
        <div className="act-chips" role="radiogroup" aria-label="Record type">
          <button
            type="button"
            role="radio"
            aria-checked={!filters.type}
            className={`act-chip ${!filters.type ? 'is-active' : ''}`}
            onClick={() => setFilter('type', '')}
          >
            <Layers size={14} /> All <span className="act-chip__count">{typeTotal.toLocaleString('en-US')}</span>
          </button>
          {FILTER_TYPES.map((type: ActivityKind) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={filters.type === type}
                className={`act-chip act-chip--${type} ${filters.type === type ? 'is-active' : ''}`}
                onClick={() => setFilter('type', filters.type === type ? '' : type)}
              >
                <Icon size={14} /> {TYPE_LABELS[type].many}
                <span className="act-chip__count">{(counts.byType[type] || 0).toLocaleString('en-US')}</span>
              </button>
            );
          })}
        </div>

        <div className="act-filter-row">
          <div className="act-segment" role="radiogroup" aria-label="Action">
            <button
              type="button"
              role="radio"
              aria-checked={!filters.status}
              className={!filters.status ? 'is-active' : ''}
              onClick={() => setFilter('status', '')}
            >
              All actions <span>{statusTotal.toLocaleString('en-US')}</span>
            </button>
            {FILTER_STATUSES.map((status: ActivityStatus) => (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={filters.status === status}
                className={`act-segment--${status} ${filters.status === status ? 'is-active' : ''}`}
                onClick={() => setFilter('status', filters.status === status ? '' : status)}
              >
                {STATUS_LABELS[status]} <span>{(counts.byStatus[status] || 0).toLocaleString('en-US')}</span>
              </button>
            ))}
          </div>

          <label className="act-select">
            <span className="visually-hidden">Person</span>
            <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)}>
              <option value="">Everyone</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName} ({user.count.toLocaleString('en-US')})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="act-filter-row">
          <div className="act-presets">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`act-preset ${isPresetActive(preset.days) ? 'is-active' : ''}`}
                onClick={() => applyPreset(preset.days)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="act-dates">
            <label>
              <span>From</span>
              <input
                type="date"
                value={filters.from}
                max={filters.to || moment().format('YYYY-MM-DD')}
                onChange={(e) => setFilter('from', e.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                max={moment().format('YYYY-MM-DD')}
                onChange={(e) => setFilter('to', e.target.value)}
              />
            </label>
          </div>
          {hasFilters && (
            <button type="button" className="act-clear" onClick={() => setSearchParams({}, { replace: true })}>
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </section>

      {error && <Alert severity="error" className="act-error">{error}</Alert>}

      <section className={`act-feed ${isLoading && activities.length > 0 ? 'is-refreshing' : ''}`} aria-busy={isLoading}>
        {isLoading && activities.length === 0 ? (
          <div className="act-group">
            <div className="act-skeleton act-skeleton--heading" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="act-skeleton-row">
                <div className="act-skeleton act-skeleton--avatar" />
                <div className="act-skeleton-lines">
                  <div className="act-skeleton act-skeleton--line" />
                  <div className="act-skeleton act-skeleton--short" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 && !error ? (
          <div className="act-empty">
            <History size={28} strokeWidth={1.6} />
            <strong>{hasFilters ? 'No activities match these filters' : 'No activities yet'}</strong>
            <p>{hasFilters ? 'Try a wider date range or clear the filters.' : 'Changes your team makes will show up here.'}</p>
            {hasFilters && (
              <button type="button" className="act-clear" onClick={() => setSearchParams({}, { replace: true })}>
                <X size={14} /> Clear filters
              </button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.day} className="act-group">
              <h2 className="act-group__heading">
                {dayHeading(group.items[0].createdAt)}
                <span>{group.items.length}{hasMore && group === groups[groups.length - 1] ? '+' : ''}</span>
              </h2>
              <ul className="act-list">
                {group.items.map((activity) => (
                  <ActivityItem key={activity._id} activity={activity} onPreviewImage={setPreviewUrl} />
                ))}
              </ul>
            </div>
          ))
        )}

        <div ref={sentinelRef} />

        {hasMore && !isLoading && (
          <div className="act-more">
            <button type="button" className="act-more__btn" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? <><Loader2 size={15} className="act-spin" /> Loading</> : `Load more (${(total - activities.length).toLocaleString('en-US')} left)`}
            </button>
          </div>
        )}
        {!hasMore && activities.length > PAGE_SIZE && (
          <p className="act-end">That's everything{hasFilters ? ' for these filters' : ''}.</p>
        )}
      </section>

      <Dialog open={!!previewUrl} onClose={() => setPreviewUrl(null)} maxWidth="md" PaperProps={{ className: 'act-preview' }}>
        {previewUrl && (
          <>
            <button type="button" className="act-preview__close" aria-label="Close" onClick={() => setPreviewUrl(null)}>
              <X size={18} />
            </button>
            <img src={previewUrl} alt="Activity attachment" />
            <a className="act-preview__link" href={previewUrl} target="_blank" rel="noreferrer">Open original</a>
          </>
        )}
      </Dialog>
    </div>
  );
};

export default Activities;
