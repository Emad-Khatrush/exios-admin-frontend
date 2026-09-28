import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar } from '@mui/material';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, DollarSign, Loader2, PackageCheck, Plane, RotateCcw, Scale, Search, Ship, X } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { COUNTRY_OPTIONS, OFFICE_OPTIONS, optionLabel } from './InventoryFields';
import { formatWeight, Progress } from './inventoryUi';

const PAGE_SIZE = 20;

type View = 'open' | 'attention' | 'finished';
type FlightType = '' | 'air' | 'sea';
type Office = '' | 'tripoli' | 'benghazi';

type FlightFlag = 'readyToClose' | 'missingPackages' | 'noPackages' | 'noArrivalDate' | 'noExpenses' | 'openTooLong';

type Flight = {
  _id: string
  voyage: string
  shippingType: 'air' | 'sea'
  shippedCountry: string
  inventoryPlace: string
  status: 'processing' | 'finished'
  arrivalDate?: string
  inventoryFinishedDate?: string
  createdAt: string
  note?: string
  stats: { packagesCount: number, receivedCount: number, missingCount: number, totalKG: number, totalCBM: number }
  expenses: { usd: number, unconvertedLYD: number, count: number }
  costPerUnit: number | null
  daysOpen: number | null
  flags: FlightFlag[]
};

type FlightsResponse = {
  results: Flight[]
  total: number
  counts: Record<View, number>
  openSummary: { packages: number, received: number, totalKG: number, totalCBM: number, expensesUSD: number, readyToClose: number }
};

// What each flag means and what to do about it
const FLAG_INFO: Record<FlightFlag, { label: string, hint: string, tone: 'ok' | 'warn' | 'danger' }> = {
  readyToClose: { label: 'Ready to close', hint: 'Every package reached its customer. Close the flight.', tone: 'ok' },
  missingPackages: { label: 'Missing packages', hint: 'Some packages are marked missing. Follow up or compensate.', tone: 'danger' },
  noPackages: { label: 'No packages', hint: 'Added over a week ago and still empty. Add the packages or delete it.', tone: 'warn' },
  noArrivalDate: { label: 'No arrival date', hint: 'Set the day it arrived in Libya.', tone: 'warn' },
  noExpenses: { label: 'No expenses', hint: 'No costs recorded yet, so cost per KG and profit are unknown.', tone: 'warn' },
  openTooLong: { label: 'Open 30+ days', hint: 'Arrived more than a month ago and still not closed.', tone: 'danger' },
};

const VIEW_LABELS: Record<View, string> = {
  open: 'Open',
  attention: 'Needs attention',
  finished: 'Finished',
};

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const FlightsManagement = () => {
  const [view, setView] = useState<View>('open');
  const [type, setType] = useState<FlightType>('');
  const [office, setOffice] = useState<Office>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [flights, setFlights] = useState<Flight[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<FlightsResponse['counts'] | null>(null);
  const [summary, setSummary] = useState<FlightsResponse['openSummary'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [confirm, setConfirm] = useState<{ flight: Flight, action: 'close' | 'reopen' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, isError?: boolean } | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (skip: number) => {
    const params: Record<string, string | number> = { view, skip, limit: PAGE_SIZE };
    if (type) params.shippingType = type;
    if (office) params.office = office;
    if (debouncedSearch) params.search = debouncedSearch;
    const { data } = await api.get('inventory/flights', params);
    return data as FlightsResponse;
  }, [view, type, office, debouncedSearch]);

  useEffect(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError('');
    fetchPage(0)
      .then((data) => {
        if (id !== requestId.current) return;
        setFlights(data.results);
        setTotal(data.total);
        setCounts(data.counts);
        setSummary(data.openSummary);
      })
      .catch(() => { if (id === requestId.current) setError('Could not load flights. Try again.'); })
      .finally(() => { if (id === requestId.current) setIsLoading(false); });
  }, [fetchPage, reload]);

  const loadMore = async () => {
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(flights.length);
      if (id !== requestId.current) return;
      setFlights((prev) => [...prev, ...data.results.filter((f) => !prev.some((p) => p._id === f._id))]);
      setTotal(data.total);
    } catch {
      setError('Could not load more flights.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const applyStatus = async () => {
    if (!confirm) return;
    const { flight, action } = confirm;
    setIsSaving(true);
    try {
      const changes = action === 'close'
        ? { status: 'finished' }
        : { status: 'processing', inventoryFinishedDate: null };
      await api.update(`inventory?id=${flight._id}`, changes);
      setToast({ message: action === 'close' ? `${flight.voyage} closed` : `${flight.voyage} reopened` });
      setConfirm(null);
      setReload((n) => n + 1);
    } catch {
      setToast({ message: 'Could not update the flight. Try again.', isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const deliveredPercent = summary && summary.packages ? Math.round((summary.received / summary.packages) * 100) : 0;
  const tiles = [
    { label: 'Open flights', value: counts?.open ?? '—', note: summary?.readyToClose ? `${summary.readyToClose} ready to close` : 'none ready to close', icon: Plane, tone: '' },
    { label: 'Needs attention', value: counts?.attention ?? '—', note: 'open flights with a flag', icon: AlertTriangle, tone: counts?.attention ? 'is-warn' : '' },
    { label: 'Delivered on open flights', value: summary ? `${deliveredPercent}%` : '—', note: summary ? `${summary.received.toLocaleString('en-US')} of ${summary.packages.toLocaleString('en-US')} packages` : '', icon: PackageCheck, tone: '' },
    { label: 'Open weight', value: summary ? formatWeight(summary.totalKG, summary.totalCBM) : '—', note: summary ? `${money(summary.expensesUSD)} expenses so far` : '', icon: Scale, tone: '' },
  ];

  return (
    <div className="flm">
      <section className="ivl-tiles" aria-label="Open flights summary">
        {tiles.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className={`ivl-tile ${tone}`}>
            <span className="ivl-tile__icon"><Icon size={18} strokeWidth={2} /></span>
            <span className="ivl-tile__body">
              <span className="ivl-tile__label">{label}</span>
              <strong className="ivl-tile__value">{value}</strong>
              <span className="ivl-tile__note">{note}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="ivl-toolbar">
        <div className="ivl-segment" role="radiogroup" aria-label="Flights">
          {(Object.keys(VIEW_LABELS) as View[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              className={`${view === key ? 'is-active' : ''} ${key === 'attention' ? 'is-attention' : ''}`}
              onClick={() => setView(key)}
            >
              {VIEW_LABELS[key]} <span>{counts ? counts[key].toLocaleString('en-US') : ''}</span>
            </button>
          ))}
        </div>

        <div className="ivl-segment" role="radiogroup" aria-label="Type">
          {([['', 'All'], ['air', 'Air'], ['sea', 'Sea']] as [FlightType, string][]).map(([value, label]) => (
            <button key={label} type="button" role="radio" aria-checked={type === value} className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>
              {value === 'air' && <Plane size={13} />}{value === 'sea' && <Ship size={13} />} {label}
            </button>
          ))}
        </div>

        <select className="ivl-select" value={office} onChange={(e) => setOffice(e.target.value as Office)} aria-label="Office">
          <option value="">All offices</option>
          {OFFICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="ivl-search ivl-search--compact">
          <Search size={16} className="ivl-search__icon" />
          <input type="search" placeholder="Voyage" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search voyage" />
          {search && (
            <button type="button" className="ivl-search__clear" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && <Alert severity="error" className="ivl-error">{error}</Alert>}

      <div className={isLoading && flights.length > 0 ? 'ivl-refreshing' : ''} aria-busy={isLoading}>
        {isLoading && flights.length === 0 ? (
          <div className="flm-grid">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="inv-skeleton flm-skeleton" />)}
          </div>
        ) : flights.length === 0 && !error ? (
          <div className="ivl-empty">
            {view === 'attention' ? <CheckCircle2 size={28} strokeWidth={1.6} /> : <Plane size={28} strokeWidth={1.6} />}
            <strong>
              {view === 'attention' ? 'Nothing needs attention' : view === 'finished' ? 'No finished flights' : 'No open flights'}
            </strong>
            <p>{view === 'attention' ? 'Every open flight has its dates, costs and packages in order.' : 'Try another type, office or search.'}</p>
          </div>
        ) : (
          <div className="flm-grid">
            {flights.map((flight) => {
              const TypeIcon = flight.shippingType === 'sea' ? Ship : Plane;
              const unit = flight.shippingType === 'sea' ? 'CBM' : 'KG';
              const isFinished = flight.status === 'finished';
              const canClose = !isFinished;
              const readyToClose = flight.flags.includes('readyToClose');
              return (
                <article key={flight._id} className={`flm-card ${flight.flags.some((f) => FLAG_INFO[f].tone === 'danger') ? 'is-danger' : ''}`}>
                  <header className="flm-card__head">
                    <span className={`ivl-type ivl-type--${flight.shippingType}`}><TypeIcon size={18} strokeWidth={2} /></span>
                    <div className="flm-card__title">
                      <Link to={`/inventory/${flight._id}/edit`} className="ivl-voyage">{flight.voyage}</Link>
                      <p className="ivl-route">
                        {optionLabel(COUNTRY_OPTIONS, flight.shippedCountry) || flight.shippedCountry}
                        <ChevronRight size={13} />
                        {optionLabel(OFFICE_OPTIONS, flight.inventoryPlace) || flight.inventoryPlace}
                      </p>
                    </div>
                    <span className={`inv-badge ${isFinished ? 'is-ok' : 'is-warn'}`}>{isFinished ? 'Finished' : 'Open'}</span>
                  </header>

                  <Progress done={flight.stats.receivedCount} total={flight.stats.packagesCount} />

                  <dl className="flm-metrics">
                    <div>
                      <dt>Weight</dt>
                      <dd>{formatWeight(flight.stats.totalKG, flight.stats.totalCBM)}</dd>
                    </div>
                    <div>
                      <dt>Expenses</dt>
                      <dd>
                        {flight.expenses.count ? money(flight.expenses.usd) : '—'}
                        {flight.expenses.unconvertedLYD > 0 && (
                          <small title="LYD expenses without an exchange rate aren't included in the USD total">
                            + {flight.expenses.unconvertedLYD.toLocaleString('en-US')} LYD
                          </small>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Cost per {unit}</dt>
                      <dd>{flight.costPerUnit ? `$${flight.costPerUnit.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</dd>
                    </div>
                    <div>
                      <dt>{isFinished ? 'Finished' : 'Open for'}</dt>
                      <dd>
                        {isFinished
                          ? (flight.inventoryFinishedDate ? moment(flight.inventoryFinishedDate).format('D MMM YYYY') : '—')
                          : <><Clock size={12} /> {flight.daysOpen} {flight.daysOpen === 1 ? 'day' : 'days'}</>}
                      </dd>
                    </div>
                  </dl>

                  {flight.flags.length > 0 && (
                    <ul className="flm-flags">
                      {flight.flags.map((flag) => (
                        <li key={flag} className={`flm-flag flm-flag--${FLAG_INFO[flag].tone}`} title={FLAG_INFO[flag].hint}>
                          {FLAG_INFO[flag].tone === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {FLAG_INFO[flag].label}
                        </li>
                      ))}
                    </ul>
                  )}

                  <footer className="flm-card__foot">
                    <span className="ivl-muted flm-card__meta">
                      {flight.arrivalDate ? `Arrived ${moment(flight.arrivalDate).format('D MMM YYYY')}` : `Added ${moment(flight.createdAt).format('D MMM YYYY')}`}
                    </span>
                    <div className="flm-card__actions">
                      {canClose ? (
                        <button
                          type="button"
                          className={`inv-btn is-small ${readyToClose ? 'is-primary' : 'is-ghost'}`}
                          onClick={() => setConfirm({ flight, action: 'close' })}
                        >
                          <CheckCircle2 size={14} /> Close
                        </button>
                      ) : (
                        <button type="button" className="inv-btn is-small is-ghost" onClick={() => setConfirm({ flight, action: 'reopen' })}>
                          <RotateCcw size={14} /> Reopen
                        </button>
                      )}
                      <Link to={`/inventory/${flight._id}/edit`} className="inv-btn is-small is-ghost">
                        Details <ChevronRight size={14} />
                      </Link>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {flights.length < total && !isLoading && (
          <div className="ivl-more">
            <button type="button" className="inv-btn is-ghost" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? <><Loader2 size={15} className="ivl-spin" /> Loading</> : `Load more (${total - flights.length} left)`}
            </button>
          </div>
        )}
      </div>

      <Dialog open={!!confirm} onClose={() => !isSaving && setConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ className: 'flm-dialog' }}>
        {confirm && (
          <>
            <DialogTitle className="flm-dialog__title">
              {confirm.action === 'close' ? `Close ${confirm.flight.voyage}?` : `Reopen ${confirm.flight.voyage}?`}
            </DialogTitle>
            <DialogContent className="flm-dialog__body">
              {confirm.action === 'close' ? (
                <>
                  <p>The flight moves to Finished and today becomes its ready date.</p>
                  {confirm.flight.stats.receivedCount < confirm.flight.stats.packagesCount && (
                    <p className="flm-dialog__warn">
                      <AlertTriangle size={14} />
                      {confirm.flight.stats.packagesCount - confirm.flight.stats.receivedCount} of {confirm.flight.stats.packagesCount} packages haven't reached their customers yet.
                    </p>
                  )}
                  {!confirm.flight.expenses.count && (
                    <p className="flm-dialog__warn"><DollarSign size={14} /> No expenses are recorded for this flight.</p>
                  )}
                </>
              ) : (
                <p>The flight goes back to Open and its ready date is cleared.</p>
              )}
            </DialogContent>
            <DialogActions className="flm-dialog__actions">
              <button type="button" className="inv-btn is-ghost" onClick={() => setConfirm(null)} disabled={isSaving}>Cancel</button>
              <button type="button" className="inv-btn is-primary" onClick={applyStatus} disabled={isSaving}>
                {isSaving && <Loader2 size={15} className="ivl-spin" />}
                {confirm.action === 'close' ? 'Close flight' : 'Reopen flight'}
              </button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)}>
        <Alert severity={toast?.isError ? 'error' : 'success'} onClose={() => setToast(null)}>{toast?.message}</Alert>
      </Snackbar>
    </div>
  );
};

export default FlightsManagement;
