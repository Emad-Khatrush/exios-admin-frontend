import { Alert, Snackbar } from '@mui/material';
import { AtSign, CalendarDays, ChevronRight, Copy, Loader2, MapPin, Phone, Search, ShieldAlert, ShieldCheck, ShieldQuestion, UserPlus, Users, X } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PassportVerification } from '../../models';

const PAGE_SIZE = 30;

type Client = {
  _id: string
  firstName: string
  lastName: string
  customerId: string
  username?: string
  phone?: number | string
  city?: string
  imgUrl?: string
  createdAt: string
  passportVerification?: PassportVerification
};

type ClientsResponse = {
  results: Client[]
  meta: {
    total: number
    counts: { userCounts: number, newThisWeek: number, newThisMonth: number }
  }
};

const PASSPORT_BADGES = {
  verified: { label: 'Verified', icon: ShieldCheck },
  pending: { label: 'Passport pending', icon: ShieldQuestion },
  rejected: { label: 'Passport rejected', icon: ShieldAlert },
};

const initials = (client: Client) =>
  `${(client.firstName || '').charAt(0)}${(client.lastName || '').charAt(0)}`.toUpperCase() || '?';

const formatNumber = (value: number) => value.toLocaleString('en-US');

const ClientsList = () => {
  const isAdmin = useSelector((state: any) => !!state.session.account?.roles?.isAdmin);

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ClientsResponse['meta']['counts'] | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Wait for a short pause in typing before searching
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (skip: number) => {
    const params: Record<string, string | number> = { limit: PAGE_SIZE, skip };
    if (debouncedSearch) params.searchValue = debouncedSearch;
    const { data } = await api.get('clients', params);
    return data as ClientsResponse;
  }, [debouncedSearch]);

  useEffect(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError('');
    fetchPage(0)
      .then((data) => {
        if (id !== requestId.current) return;
        setClients(data.results);
        setTotal(data.meta.total);
        setCounts(data.meta.counts);
      })
      .catch(() => { if (id === requestId.current) setError('Could not load clients. Try again.'); })
      .finally(() => { if (id === requestId.current) setIsLoading(false); });
  }, [fetchPage]);

  const hasMore = clients.length < total;

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(clients.length);
      if (id !== requestId.current) return;
      setClients((prev) => {
        const seen = new Set(prev.map((c) => c._id));
        return [...prev, ...data.results.filter((c) => !seen.has(c._id))];
      });
      setTotal(data.meta.total);
    } catch {
      if (id === requestId.current) setError('Could not load more clients.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [clients.length, fetchPage, hasMore, isLoading, isLoadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(`${label} copied`);
  };

  const stats = [
    { label: 'Total clients', value: counts?.userCounts, icon: Users },
    { label: 'New this month', value: counts?.newThisMonth, icon: UserPlus },
    { label: 'New this week', value: counts?.newThisWeek, icon: CalendarDays },
  ];

  return (
    <div className="cl-clients">
      <div className="cl-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="cl-stat">
            <span className="cl-stat__icon"><Icon size={18} strokeWidth={2} /></span>
            <span className="cl-stat__body">
              <span className="cl-stat__label">{label}</span>
              <span className="cl-stat__value">{value === undefined ? '—' : formatNumber(value)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="cl-toolbar">
        <div className="cl-search">
          <Search size={16} className="cl-search__icon" />
          <input
            type="search"
            placeholder="Search by name, customer ID or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
          {search && (
            <button type="button" className="cl-search__clear" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {!isLoading && (
          <span className="cl-toolbar__count">
            {debouncedSearch
              ? <><strong>{formatNumber(total)}</strong> {total === 1 ? 'match' : 'matches'}</>
              : <>Showing <strong>{formatNumber(clients.length)}</strong> of {formatNumber(total)}</>}
          </span>
        )}
      </div>

      {error && <Alert severity="error" className="cl-error">{error}</Alert>}

      <div className={isLoading && clients.length > 0 ? 'cl-refreshing' : ''} aria-busy={isLoading}>
        {isLoading && clients.length === 0 ? (
          <ul className="cl-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="cl-card cl-card--skeleton">
                <div className="cl-skeleton cl-skeleton--avatar" />
                <div className="cl-skeleton-lines">
                  <div className="cl-skeleton cl-skeleton--line" />
                  <div className="cl-skeleton cl-skeleton--short" />
                  <div className="cl-skeleton cl-skeleton--short" />
                </div>
              </li>
            ))}
          </ul>
        ) : clients.length === 0 && !error ? (
          <div className="cl-empty">
            <Users size={28} strokeWidth={1.6} />
            <strong>{debouncedSearch ? `No clients match "${debouncedSearch}"` : 'No clients yet'}</strong>
            <p>{debouncedSearch ? 'Check the spelling, or search by customer ID or phone number.' : 'New sign-ups will appear here.'}</p>
          </div>
        ) : (
          <ul className="cl-grid">
            {clients.map((client) => {
              const passport = client.passportVerification?.status ? PASSPORT_BADGES[client.passportVerification.status] : null;
              const PassportIcon = passport?.icon;
              const joined = moment(client.createdAt);
              return (
                <li key={client._id} className="cl-card">
                  <div className="cl-card__head">
                    {client.imgUrl
                      ? <img className="cl-avatar" src={client.imgUrl} alt="" />
                      : <span className="cl-avatar cl-avatar--initials">{initials(client)}</span>}
                    <div className="cl-card__title">
                      <Link to={`/user/${client._id}`} className="cl-card__name">
                        {client.firstName} {client.lastName}
                      </Link>
                      <div className="cl-card__badges">
                        <button
                          type="button"
                          className="cl-id"
                          title="Copy customer ID"
                          onClick={() => copy(client.customerId, 'Customer ID')}
                        >
                          {client.customerId} <Copy size={11} />
                        </button>
                        {passport && PassportIcon && (
                          <span className={`cl-passport cl-passport--${client.passportVerification!.status}`}>
                            <PassportIcon size={12} /> {passport.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <dl className="cl-details">
                    {isAdmin && client.phone && (
                      <div className="cl-detail">
                        <dt><Phone size={13} /><span className="visually-hidden">Phone</span></dt>
                        <dd>
                          <button type="button" className="cl-copyable" title="Copy phone" onClick={() => copy(String(client.phone), 'Phone')}>
                            {client.phone}
                          </button>
                        </dd>
                      </div>
                    )}
                    {client.city && (
                      <div className="cl-detail">
                        <dt><MapPin size={13} /><span className="visually-hidden">City</span></dt>
                        <dd className="cl-capitalize">{client.city}</dd>
                      </div>
                    )}
                    {client.username && (
                      <div className="cl-detail">
                        <dt><AtSign size={13} /><span className="visually-hidden">Username</span></dt>
                        <dd title={client.username}>{client.username}</dd>
                      </div>
                    )}
                    <div className="cl-detail">
                      <dt><CalendarDays size={13} /><span className="visually-hidden">Joined</span></dt>
                      <dd title={joined.format('dddd, D MMMM YYYY')}>
                        Joined {joined.format('D MMM YYYY')} <span className="cl-muted">· {joined.fromNow()}</span>
                      </dd>
                    </div>
                  </dl>

                  <Link to={`/user/${client._id}`} className="cl-card__open">
                    View profile <ChevronRight size={15} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={sentinelRef} />

        {hasMore && !isLoading && (
          <div className="cl-more">
            <button type="button" className="cl-btn" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore
                ? <><Loader2 size={15} className="cl-spin" /> Loading</>
                : `Load more (${formatNumber(total - clients.length)} left)`}
            </button>
          </div>
        )}
      </div>

      <Snackbar open={!!copied} autoHideDuration={1500} onClose={() => setCopied('')}>
        <Alert severity="success" onClose={() => setCopied('')}>{copied}</Alert>
      </Snackbar>
    </div>
  );
};

export default ClientsList;
