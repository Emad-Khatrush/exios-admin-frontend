import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, InputAdornment, Skeleton, TablePagination, TextField } from '@mui/material';
import { MdClose, MdErrorOutline, MdHourglassBottom, MdSearch, MdToll } from 'react-icons/md';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';
import { initials, money, pointsText, relativeDay, shortDate, usdOf } from './format';
import './loyalty.scss';

const PAGE_SIZE = 25;

type Sort = 'balance' | 'expiring';
const SORTS: [Sort, string][] = [['balance', 'Balance'], ['expiring', 'Expiring soon']];

// Customers who hold loyalty points, with what is outstanding in all
const LoyaltyCustomers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('balance');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Bumped by Retry to read the list again
  const [attempt, setAttempt] = useState(0);

  // The search runs when typing pauses
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    api.get('loyalty/customers', { search: query, sort, expiringOnly, page: page + 1, limit: PAGE_SIZE })
      .then((res: any) => { if (!stale) setData(res.data); })
      .catch((e: any) => { if (!stale) setError(requestError(e, 'Could not load the customers with points.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [query, sort, expiringOnly, page, attempt]);

  const totals = data?.totals;
  const rows: any[] = data?.rows || [];
  const filtered = !!query || expiringOnly;
  const toggleExpiring = () => { setExpiringOnly((on) => !on); setPage(0); };
  const open = (row: any) => navigate(`/user/${row.userId}?tab=points`);

  const body = () => {
    if (error) {
      return (
        <div className="lp-state-box lp-state-box--error" role="alert">
          <span className="lp-state-box__icon"><MdErrorOutline /></span>
          <strong>Couldn't load the list</strong>
          <p dir="auto">{error}</p>
          <Button variant="outlined" size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      );
    }
    if (!loading && rows.length === 0) {
      return (
        <div className="lp-state-box">
          <span className="lp-state-box__icon"><MdToll /></span>
          <strong>{filtered ? 'No customer matches' : 'No customer holds points yet'}</strong>
          <p>
            {filtered
              ? 'Try another name, code or phone, or turn off the expiring filter.'
              : 'Customers earn points once an order is paid and delivered. They show up here as soon as they do.'}
          </p>
        </div>
      );
    }
    return (
      <div className="lp-table-wrap">
        <table className="lp-table" aria-busy={loading}>
          <thead>
            <tr>
              <th>Customer</th>
              <th className="is-num">Points</th>
              <th>Expiring soon</th>
              <th>Last movement</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }, (_, index) => (
              <tr key={index}>
                <td>
                  <div className="lp-person">
                    <Skeleton variant="rectangular" width={34} height={34} sx={{ borderRadius: '8px' }} />
                    <div><Skeleton width={150} /><Skeleton width={110} /></div>
                  </div>
                </td>
                <td className="is-num"><Skeleton width={60} sx={{ ml: 'auto' }} /><Skeleton width={44} sx={{ ml: 'auto' }} /></td>
                <td><Skeleton width={90} /></td>
                <td><Skeleton width={70} /></td>
              </tr>
            )) : rows.map((row) => (
              <tr
                key={row.userId} className="lp-row" tabIndex={0}
                onClick={() => open(row)}
                onKeyDown={(event) => { if (event.key === 'Enter') open(row); }}
              >
                <td>
                  <div className="lp-person">
                    <span className="lp-person__avatar" aria-hidden="true">{initials(row.name)}</span>
                    <div>
                      <div className="lp-person__name" dir="auto">{row.name || '—'}</div>
                      <div className="lp-person__meta">{[row.customerId, row.phone].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="is-num">
                  <div className="lp-amount"><strong>{pointsText(row.points)}</strong><span>${money(usdOf(row))}</span></div>
                </td>
                <td>
                  {row.expiringSoon
                    ? <span className="lp-chip lp-chip--coin">{pointsText(row.expiringSoon.points)} pts · {shortDate(row.expiringSoon.at)}</span>
                    : <span className="lp-muted">—</span>}
                </td>
                <td className="lp-muted">{relativeDay(row.lastMovementAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="lp lp-page">
      <header className="lp-head">
        <h1>Loyalty points</h1>
        <p>Points customers hold, what they're worth, and what's about to expire.</p>
      </header>

      <section className="lp-summary" aria-label="Summary">
        <div className="lp-summary__main">
          <span className="lp-label">Outstanding points</span>
          <div className="lp-figure">
            <MdToll className="lp-coin-icon" aria-hidden="true" />
            {totals ? pointsText(totals.points) : '—'}
            <small>pts</small>
          </div>
          <div className="lp-figure-sub">= <strong>${totals ? money(usdOf(totals)) : '—'}</strong> owed to customers</div>
        </div>
        <div className="lp-summary__side">
          <div className="lp-stat">
            <span className="lp-label">Customers with points</span>
            <strong>{totals ? pointsText(totals.customers) : '—'}</strong>
          </div>
          <button type="button" className="lp-stat lp-stat--toggle lp-press" aria-pressed={expiringOnly} onClick={toggleExpiring}>
            <span className="lp-label">Expiring in 30 days</span>
            <strong>{expiringOnly && data
              ? `${pointsText(data.total || 0)} customer${data.total === 1 ? '' : 's'}`
              : totals?.expiring
                ? `${pointsText(totals.expiring.customers)} customer${totals.expiring.customers === 1 ? '' : 's'} · ${pointsText(totals.expiring.points)} pts`
                : 'Show customers'}</strong>
            <small>{expiringOnly ? 'Showing only these' : 'Filter the list'}</small>
          </button>
        </div>
      </section>

      <div className="lp-toolbar">
        <TextField
          className="lp-search" size="small" placeholder="Search name, code or phone" value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ 'aria-label': 'Search customers' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><MdSearch /></InputAdornment> }}
        />
        <div className="lp-segment" role="group" aria-label="Sort by">
          {SORTS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={sort === value} onClick={() => { setSort(value); setPage(0); }}>{label}</button>
          ))}
        </div>
        {expiringOnly && (
          <button type="button" className="lp-chip lp-chip--coin lp-filter lp-press" onClick={toggleExpiring} aria-label="Stop showing only expiring points">
            <MdHourglassBottom aria-hidden="true" /> Expiring in 30 days <MdClose aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="lp-card">
        {body()}
        {!error && (
          <TablePagination
            component="div" count={data?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
            onPageChange={(_, next) => setPage(next)}
          />
        )}
      </div>
    </div>
  );
};

export default LoyaltyCustomers;
