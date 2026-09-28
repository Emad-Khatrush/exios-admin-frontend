import { ArrowDownLeft, ArrowUpRight, History, Loader2, Paperclip, Scale } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import DashboardPeriodPicker from '../../components/DashboardPeriodPicker/DashboardPeriodPicker';
import { DashboardPeriod, defaultPeriod, getPeriodRange } from '../Home/period';
import { convertGoogleStorageUrl } from '../../utils/methods';

interface UserStatement {
  _id: string;
  description: string;
  amount: number;
  currency: 'USD' | 'LYD';
  total: number;
  calculationType: '+' | '-';
  createdAt: string;
  attachments?: { path: string }[];
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    customerId: string;
  };
  createdBy?: { firstName: string };
}

type Direction = 'all' | 'plus' | 'minus';

type Summary = {
  count: number
  deposits: { USD: number, LYD: number, count: number }
  payments: { USD: number, LYD: number, count: number }
};

const PAGE_SIZE = 20;

const DIRECTION_LABELS: Record<Direction, string> = {
  all: 'All',
  plus: 'Deposits',
  minus: 'Payments',
};

const formatMoney = (value: number) =>
  (value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// "$1,200 · 3,500 LYD" - skips a currency with nothing in it
const formatPair = (usd: number, lyd: number, sign = '') => {
  const parts = [];
  if (usd) parts.push(`${sign}$${formatMoney(Math.abs(usd))}`);
  if (lyd) parts.push(`${sign}${formatMoney(Math.abs(lyd))} LYD`);
  return parts.length ? parts.join(' · ') : '—';
};

// Latest wallet deposits and payments across all clients, newest first, for any period.
const StatementList = () => {
  const [isAllTime, setIsAllTime] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>(defaultPeriod());
  const [direction, setDirection] = useState<Direction>('all');

  const [items, setItems] = useState<UserStatement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestId = useRef(0);
  const observer = useRef<IntersectionObserver | null>(null);

  const range = getPeriodRange(period);
  const from = isAllTime ? '' : range.from;
  const to = isAllTime ? '' : range.to;

  // Page 1 (with totals) whenever the period or direction changes; later pages append.
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    if (page === 1) setItems([]);

    const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
    if (from) params.startDate = from;
    if (to) params.endDate = to;
    if (direction !== 'all') params.calculationType = direction;
    if (page === 1) params.withSummary = 'true';

    api.get('statements/latest', params)
      .then(({ data }) => {
        if (id !== requestId.current) return;
        setItems((prev) => {
          if (page === 1) return data.statements;
          const seen = new Set(prev.map((item) => item._id));
          return [...prev, ...data.statements.filter((item: UserStatement) => !seen.has(item._id))];
        });
        setHasMore(data.hasMore);
        if (data.summary) setSummary(data.summary);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setError('Could not load wallet activity.');
        setHasMore(false);
      })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [page, from, to, direction]);

  const resetTo = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const lastElementRef = useCallback((node: HTMLLIElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const netUSD = (summary?.deposits.USD || 0) - (summary?.payments.USD || 0);
  const netLYD = (summary?.deposits.LYD || 0) - (summary?.payments.LYD || 0);
  const isFirstLoad = loading && page === 1;

  const tiles = [
    {
      key: 'in',
      label: 'Deposits',
      value: formatPair(summary?.deposits.USD || 0, summary?.deposits.LYD || 0, '+'),
      note: `${(summary?.deposits.count || 0).toLocaleString('en-US')} deposits`,
      icon: ArrowDownLeft,
      hidden: direction === 'minus',
    },
    {
      key: 'out',
      label: 'Payments',
      value: formatPair(summary?.payments.USD || 0, summary?.payments.LYD || 0, '−'),
      note: `${(summary?.payments.count || 0).toLocaleString('en-US')} payments`,
      icon: ArrowUpRight,
      hidden: direction === 'plus',
    },
    {
      key: 'net',
      label: 'Net change',
      value: [
        netUSD ? `${netUSD > 0 ? '+' : '−'}$${formatMoney(Math.abs(netUSD))}` : '',
        netLYD ? `${netLYD > 0 ? '+' : '−'}${formatMoney(Math.abs(netLYD))} LYD` : '',
      ].filter(Boolean).join(' · ') || '—',
      note: `${(summary?.count || 0).toLocaleString('en-US')} transactions`,
      icon: Scale,
      hidden: direction !== 'all',
    },
  ].filter((tile) => !tile.hidden);

  return (
    <div className="wl-activity">
      <div className="wl-activity__filters">
        <DashboardPeriodPicker
          period={period}
          onChange={(next) => resetTo(() => { setIsAllTime(false); setPeriod(next); })}
          isLoading={isFirstLoad}
          allTime={{ active: isAllTime, onSelect: () => resetTo(() => setIsAllTime(true)) }}
        />
        <div className="cl-tabs wl-direction" role="radiogroup" aria-label="Type">
          {(Object.keys(DIRECTION_LABELS) as Direction[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={direction === key}
              className={`${direction === key ? 'is-active' : ''} wl-direction--${key}`}
              onClick={() => direction !== key && resetTo(() => setDirection(key))}
            >
              {DIRECTION_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className={`cl-stats wl-summary ${isFirstLoad && summary ? 'cl-refreshing' : ''}`}>
        {tiles.map(({ key, label, value, note, icon: Icon }) => (
          <div key={key} className={`cl-stat wl-summary--${key}`}>
            <span className="cl-stat__icon"><Icon size={18} strokeWidth={2.2} /></span>
            <span className="cl-stat__body">
              <span className="cl-stat__label">{label} · {isAllTime ? 'all time' : range.label}</span>
              <span className="cl-stat__value wl-summary__value">{summary ? value : '—'}</span>
              <span className="wl-summary__note">{summary ? note : ''}</span>
            </span>
          </div>
        ))}
      </div>

      {error && <p className="cl-inline-error">{error}</p>}

      {!loading && !error && items.length === 0 ? (
        <div className="cl-empty">
          <History size={26} strokeWidth={1.6} />
          <strong>{isAllTime && direction === 'all' ? 'No wallet activity yet' : 'Nothing in this period'}</strong>
          <p>{isAllTime && direction === 'all' ? 'Deposits and payments will appear here.' : 'Try another day, week or month, or choose All time.'}</p>
        </div>
      ) : (
        <ul className={`wl-statements ${isFirstLoad && items.length === 0 ? 'wl-statements--empty' : ''}`}>
          {items.map((item, index) => {
            const isPlus = item.calculationType === '+';
            const attachment = item.attachments?.[0]?.path;
            const created = moment(item.createdAt);

            return (
              <li key={item._id} ref={items.length === index + 1 ? lastElementRef : null} className="wl-statement">
                <span className={`wl-statement__icon ${isPlus ? 'is-in' : 'is-out'}`} aria-label={isPlus ? 'Deposit' : 'Payment'}>
                  {isPlus ? <ArrowDownLeft size={16} strokeWidth={2.4} /> : <ArrowUpRight size={16} strokeWidth={2.4} />}
                </span>

                <div className="wl-statement__main">
                  <div className="wl-statement__who">
                    {item.user?._id
                      ? <Link to={`/user/${item.user._id}`} className="wl-statement__name">{item.user.firstName} {item.user.lastName}</Link>
                      : <span className="wl-statement__name">Unknown client</span>}
                    {item.user?.customerId && <span className="wl-client__id">{item.user.customerId}</span>}
                    {attachment && (
                      <a
                        className="wl-statement__file"
                        href={convertGoogleStorageUrl(attachment)}
                        target="_blank"
                        rel="noreferrer"
                        title="View attachment"
                      >
                        <Paperclip size={13} /> Receipt
                      </a>
                    )}
                  </div>
                  {item.description && <p className="wl-statement__desc" dir="auto">{item.description}</p>}
                  <span className="wl-statement__meta" title={created.format('dddd, D MMMM YYYY, HH:mm')}>
                    {created.format('D MMM YYYY, HH:mm')} · by {item.createdBy?.firstName || 'System'}
                  </span>
                </div>

                <div className="wl-statement__amounts">
                  <span className={`wl-statement__amount ${isPlus ? 'is-in' : 'is-out'}`}>
                    {isPlus ? '+' : '−'}{formatMoney(item.amount)} {item.currency}
                  </span>
                  <span className="wl-statement__balance">Balance {formatMoney(item.total)} {item.currency}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loading && (
        <div className="cl-more"><Loader2 size={20} className="cl-spin" aria-label="Loading" /></div>
      )}
    </div>
  );
};

export default StatementList;
