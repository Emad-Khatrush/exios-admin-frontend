import { ArrowDownLeft, ArrowUpRight, Banknote, History, Loader2, Paperclip, Undo2 } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import DashboardPeriodPicker from '../../components/DashboardPeriodPicker/DashboardPeriodPicker';
import { DashboardPeriod, defaultPeriod, getPeriodRange } from '../Home/period';
import { convertGoogleStorageUrl } from '../../utils/methods';
import { statementFlow } from '../UserDetails/statementUtils';

interface UserStatement {
  _id: string;
  description: string;
  amount: number;
  currency: 'USD' | 'LYD';
  total: number;
  calculationType: '+' | '-';
  actionType?: string;
  paymentType?: string;
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

type FlowTotals = { USD: number, LYD: number, count: number };

// Real cash (cashIn / cashOut) is kept apart from wallet credits and wallet spending
type Summary = {
  count: number
  cashIn: FlowTotals
  credit: FlowTotals
  spent: FlowTotals
  cashOut: FlowTotals
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

  const isFirstLoad = loading && page === 1;

  const countNote = (totals: FlowTotals | undefined, one: string, many: string) => {
    const n = totals?.count || 0;
    return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  };

  const tiles = [
    {
      key: 'in',
      label: 'Cash received',
      value: formatPair(summary?.cashIn.USD || 0, summary?.cashIn.LYD || 0, '+'),
      note: `${countNote(summary?.cashIn, 'cash or bank deposit', 'cash or bank deposits')}`,
      icon: ArrowDownLeft,
      hidden: direction === 'minus',
    },
    {
      key: 'credit',
      label: 'Wallet credits',
      value: formatPair(summary?.credit.USD || 0, summary?.credit.LYD || 0, '+'),
      note: `${countNote(summary?.credit, 'refund', 'refunds')}, compensation, cancellations · no cash`,
      icon: Undo2,
      hidden: direction === 'minus',
    },
    {
      key: 'out',
      label: 'Spent from wallet',
      value: formatPair(summary?.spent.USD || 0, summary?.spent.LYD || 0, '−'),
      note: countNote(summary?.spent, 'order or debt payment', 'order and debt payments'),
      icon: ArrowUpRight,
      hidden: direction === 'plus',
    },
    {
      key: 'cashout',
      label: 'Cash withdrawn',
      value: formatPair(summary?.cashOut.USD || 0, summary?.cashOut.LYD || 0, '−'),
      note: countNote(summary?.cashOut, 'withdrawal', 'withdrawals'),
      icon: Banknote,
      hidden: direction === 'plus',
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
            const isCredit = statementFlow(item) === 'credit';
            const attachment = item.attachments?.[0]?.path;
            const created = moment(item.createdAt);

            return (
              <li key={item._id} ref={items.length === index + 1 ? lastElementRef : null} className="wl-statement">
                <span className={`wl-statement__icon ${isCredit ? 'is-credit' : isPlus ? 'is-in' : 'is-out'}`} aria-label={isCredit ? 'Wallet credit' : isPlus ? 'Deposit' : 'Payment'}>
                  {isPlus ? <ArrowDownLeft size={16} strokeWidth={2.4} /> : <ArrowUpRight size={16} strokeWidth={2.4} />}
                </span>

                <div className="wl-statement__main">
                  <div className="wl-statement__who">
                    {item.user?._id
                      ? <Link to={`/user/${item.user._id}`} className="wl-statement__name">{item.user.firstName} {item.user.lastName}</Link>
                      : <span className="wl-statement__name">Unknown client</span>}
                    {item.user?.customerId && <span className="wl-client__id">{item.user.customerId}</span>}
                    {isCredit && <span className="wl-statement__credit" title="Added to the wallet, but no cash was received">No cash</span>}
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
                  <span className={`wl-statement__amount ${isCredit ? 'is-credit' : isPlus ? 'is-in' : 'is-out'}`}>
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
