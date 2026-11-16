import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Skeleton, TablePagination } from '@mui/material';
import { MdAdd, MdHourglassBottom, MdRemove, MdToll, MdTune, MdUndo } from 'react-icons/md';
import moment from 'moment';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';
import { dayHeading, fullDate, money, pointsText, usdOf } from '../Loyalty/format';
import AdjustPointsDialog from './AdjustPointsDialog';
import '../Loyalty/loyalty.scss';

type Props = {
  userId: string
  // Called after points were adjusted, so the header balance can be read again
  onChanged: () => void
  // Bumped by the parent when the balance should be read again
  version?: number
}

const PAGE_SIZE = 20;

const WAITING: Record<string, string> = {
  payment: 'Awaiting payment', delivery: 'Awaiting delivery', processing: 'Being added (within an hour)',
};

// How each kind of movement looks: gains in green, spending neutral, expiry and take-backs in gold
type Tone = 'gain' | 'spend' | 'warn';
const TONE: Record<string, Tone> = {
  earn: 'gain', add: 'gain', restore: 'gain', redeem: 'spend', deduct: 'spend', expire: 'warn', revoke: 'warn',
};
const ICON: Record<Tone, ReactNode> = { gain: <MdAdd />, spend: <MdRemove />, warn: <MdHourglassBottom /> };
// Points that leave the balance are shown with a minus
const NEGATIVE = new Set(['redeem', 'deduct', 'expire', 'revoke']);
// Lots that expire: the date is shown beside them
const LOTS = new Set(['earn', 'add', 'restore']);

const signed = (kind: string, points: number) => {
  const value = Math.abs(Number(points || 0));
  return `${NEGATIVE.has(kind) ? '−' : '+'}${pointsText(value)}`;
};

// A movement's title, with the order linked when there is one
const titleOf = (row: any) => {
  const order = row.orderId
    ? <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer">{row.orderNumber || 'order'}</a>
    : null;
  const onOrder = (text: string, fallback: string) => (order ? <>{text} {order}</> : fallback);
  switch (row.kind) {
    case 'earn': return onOrder('Earned on order', 'Earned');
    case 'redeem': return onOrder('Used on order', 'Used');
    case 'restore': return onOrder('Returned from cancelled order', 'Returned');
    case 'revoke': return onOrder('Taken back from cancelled order', 'Taken back');
    case 'expire': return 'Expired';
    case 'add': return 'Added by staff';
    case 'deduct': return 'Deducted by staff';
    default: return row.kind;
  }
};

// The rows, in runs of the same day (they come newest first)
const byDay = (rows: any[]) => {
  const days: { key: string, at: string, rows: any[] }[] = [];
  rows.forEach((row) => {
    const key = moment(row.createdAt).format('YYYY-MM-DD');
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else days.push({ key, at: row.createdAt, rows: [row] });
  });
  return days;
};

// A customer's loyalty points: balance, what is coming, and every movement
const LoyaltyTab = ({ userId, onChanged, version = 0 }: Props) => {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`user/${userId}/loyalty`, { page: nextPage + 1 });
      setData(res.data);
    } catch (e: any) {
      setError(requestError(e, 'Could not load the points.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(page); }, [load, page, version]);

  if (!data) {
    return (
      <div className="lp lp-tab">
        {error ? (
          <Alert severity="error" dir="auto" action={<Button color="inherit" size="small" onClick={() => load(page)}>Retry</Button>}>{error}</Alert>
        ) : (
          <div className="lp-passbook" aria-busy="true">
            <Skeleton width={70} />
            <Skeleton width={260} height={48} />
            <Skeleton width={200} />
          </div>
        )}
      </div>
    );
  }

  const rows: any[] = data.history?.rows || [];
  const pending: any[] = data.pending || [];

  return (
    <div className="lp lp-tab">
      {error && <Alert severity="error" dir="auto">{error}</Alert>}

      <section className="lp-passbook">
        <div className="lp-passbook__top">
          <div>
            <span className="lp-label">Balance</span>
            <div className="lp-balance">
              <MdToll className="lp-coin-icon" aria-hidden="true" />
              <strong>{pointsText(data.points)}</strong>
              <span className="lp-balance__unit">pts</span>
              <span className="lp-balance__usd">= ${money(usdOf(data))}</span>
            </div>
          </div>
          <Button variant="contained" type="button" startIcon={<MdTune />} onClick={() => setAdjusting(true)}>Adjust points</Button>
        </div>
        <div className="lp-passbook__meta">
          <span className="lp-chip lp-chip--coin"><MdToll aria-hidden="true" />100 pts = $1</span>
          {data.expiringSoon && (
            <span className="lp-expiring">
              <MdHourglassBottom aria-hidden="true" />
              {pointsText(data.expiringSoon.points)} pts expire on {fullDate(data.expiringSoon.at)}
            </span>
          )}
        </div>
        <dl className="lp-totals">
          <div><dt>Earned in all</dt><dd>{pointsText(data.earnedTotal)}</dd></div>
          <div><dt>Used in all</dt><dd>{pointsText(data.redeemedTotal)}</dd></div>
        </dl>
      </section>

      {pending.length > 0 && (
        <section className="lp-section">
          <h3 className="lp-section__title">On the way <span className="lp-chip">{pending.length}</span></h3>
          <ul className="lp-list">
            {pending.map((row) => (
              <li key={row.arKey} className="lp-pending">
                <span className="lp-pending__order">
                  Order <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer">{row.orderNumber || 'Order'}</a>
                </span>
                <span className="lp-pending__pts">+{pointsText(row.points)} pts</span>
                <span className={`lp-chip lp-waiting--${row.waitingFor}`}>{WAITING[row.waitingFor] || row.waitingFor}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="lp-section">
        <h3 className="lp-section__title">History</h3>
        {rows.length === 0 ? (
          <div className="lp-list">
            <div className="lp-state-box">
              <span className="lp-state-box__icon"><MdToll /></span>
              <strong>{loading ? 'Loading' : 'No movements yet'}</strong>
              {!loading && <p>Points earned, used, added or expired will be listed here.</p>}
            </div>
          </div>
        ) : (
          <div className={`lp-history${loading ? ' is-loading' : ''}`} aria-busy={loading}>
            {byDay(rows).map((day) => (
              <div key={day.key} className="lp-day">
                <h4 className="lp-day__title">{dayHeading(day.at)}</h4>
                <ul className="lp-list">
                  {day.rows.map((row, index) => {
                    const tone = TONE[row.kind] || 'spend';
                    const note = [
                      moment(row.createdAt).format('HH:mm'),
                      LOTS.has(row.kind) && row.expiresAt ? `expires ${fullDate(row.expiresAt)}` : '',
                    ].filter(Boolean).join(' · ');
                    return (
                      <li key={`${row.createdAt}-${index}`} className={`lp-move lp-move--${tone}`}>
                        <span className="lp-move__icon" aria-hidden="true">{row.kind === 'revoke' ? <MdUndo /> : ICON[tone]}</span>
                        <div className="lp-move__body">
                          <div className="lp-move__title">{titleOf(row)}</div>
                          {row.reason && <div className="lp-move__note" dir="auto">{row.reason}</div>}
                          <div className="lp-move__note">{note}</div>
                        </div>
                        <div className="lp-move__side">
                          <div className="lp-move__delta">{signed(row.kind, row.points)}</div>
                          {typeof row.balanceAfter === 'number' && <div className="lp-move__after">Balance {pointsText(row.balanceAfter)}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <TablePagination
          component="div" count={data.history?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, next) => setPage(next)}
        />
      </section>

      <AdjustPointsDialog
        open={adjusting} userId={userId} balance={Number(data.points || 0)} onClose={() => setAdjusting(false)}
        onSaved={() => { setPage(0); onChanged(); }}
      />
    </div>
  );
};

export default LoyaltyTab;
