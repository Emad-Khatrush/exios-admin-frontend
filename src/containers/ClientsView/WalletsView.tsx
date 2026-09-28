import { Alert } from '@mui/material';
import { ArrowDownUp, ChevronRight, Download, History, Landmark, Search, Users, Wallet, X } from 'lucide-react';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../../api';
import StatementList from './StatementList';

type WalletRow = {
  _id: string
  lydBalance: number
  usdBalance: number
  user?: {
    _id: string
    firstName: string
    lastName: string
    customerId: string
    phone?: number | string
    imgUrl?: string
  }
};

type SortKey = 'usd' | 'lyd' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  usd: 'Highest USD',
  lyd: 'Highest LYD',
  name: 'Name A–Z',
};

const formatMoney = (value: number) =>
  (value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fullName = (row: WalletRow) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim();

const initials = (row: WalletRow) =>
  `${(row.user?.firstName || '').charAt(0)}${(row.user?.lastName || '').charAt(0)}`.toUpperCase() || '?';

const Amount = ({ value, currency }: { value: number, currency: 'USD' | 'LYD' }) => (
  <span className={`wl-amount ${value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-zero'}`}>
    {currency === 'USD' ? '$' : ''}{formatMoney(value)}{currency === 'LYD' ? ' LYD' : ''}
  </span>
);

const WalletsView = () => {
  const [tab, setTab] = useState<'balances' | 'activity'>('balances');
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('usd');

  useEffect(() => {
    api.get('wallets')
      .then((response) => setWallets(response.data.results || []))
      .catch(() => setError('Could not load wallets. Try again.'))
      .finally(() => setIsLoading(false));
  }, []);

  const totalLYD = wallets.reduce((sum, w) => sum + (w.lydBalance || 0), 0);
  const totalUSD = wallets.reduce((sum, w) => sum + (w.usdBalance || 0), 0);
  const negativeCount = wallets.filter((w) => w.lydBalance < 0 || w.usdBalance < 0).length;

  const query = search.trim().toLowerCase();
  const visible = wallets
    .filter((w) => !query
      || fullName(w).toLowerCase().includes(query)
      || String(w.user?.customerId || '').toLowerCase().includes(query)
      || String(w.user?.phone || '').includes(query))
    .sort((a, b) => {
      if (sort === 'name') return fullName(a).localeCompare(fullName(b));
      if (sort === 'lyd') return (b.lydBalance || 0) - (a.lydBalance || 0);
      return (b.usdBalance || 0) - (a.usdBalance || 0);
    });

  const handleDownloadExcel = () => {
    const excelData = visible.map((row) => ({
      'Customer ID': row.user?.customerId,
      'Name': fullName(row),
      'Phone': row.user?.phone,
      'LYD Balance': row.lydBalance,
      'USD Balance': row.usdBalance,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Wallets');
    XLSX.writeFile(workbook, `Wallets_Report_${moment().format('YYYY-MM-DD')}.xlsx`);
  };

  const stats = [
    { label: 'Total USD held', value: `$${formatMoney(totalUSD)}`, icon: Landmark, tone: 'usd' },
    { label: 'Total LYD held', value: `${formatMoney(totalLYD)} LYD`, icon: Wallet, tone: 'lyd' },
    { label: 'Clients with a balance', value: wallets.length.toLocaleString('en-US'), icon: Users, tone: 'neutral', note: negativeCount ? `${negativeCount} below zero` : undefined },
  ];

  return (
    <div className="wl-wallets">
      <div className="cl-tabs" role="tablist" aria-label="Wallet views">
        <button type="button" role="tab" aria-selected={tab === 'balances'} className={tab === 'balances' ? 'is-active' : ''} onClick={() => setTab('balances')}>
          <Wallet size={15} /> Balances
        </button>
        <button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'is-active' : ''} onClick={() => setTab('activity')}>
          <History size={15} /> Activity
        </button>
      </div>

      {tab === 'activity' ? (
        <StatementList />
      ) : (
        <>
          <div className="cl-stats">
            {stats.map(({ label, value, icon: Icon, tone, note }) => (
              <div key={label} className={`cl-stat cl-stat--${tone}`}>
                <span className="cl-stat__icon"><Icon size={18} strokeWidth={2} /></span>
                <span className="cl-stat__body">
                  <span className="cl-stat__label">{label}</span>
                  <span className="cl-stat__value">{isLoading ? '—' : value}</span>
                  {note && !isLoading && <span className="cl-stat__note">{note}</span>}
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
                aria-label="Search wallets"
              />
              {search && (
                <button type="button" className="cl-search__clear" aria-label="Clear search" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <label className="cl-select">
              <ArrowDownUp size={14} />
              <span className="visually-hidden">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </label>
            <button type="button" className="cl-btn cl-btn--primary" onClick={handleDownloadExcel} disabled={isLoading || visible.length === 0}>
              <Download size={15} /> Export Excel
            </button>
          </div>

          {error && <Alert severity="error" className="cl-error">{error}</Alert>}

          <div className="wl-table" role="table" aria-label="Wallet balances" aria-busy={isLoading}>
            <div className="wl-row wl-row--head" role="row">
              <span role="columnheader">Client</span>
              <span role="columnheader" className="wl-num">USD</span>
              <span role="columnheader" className="wl-num">LYD</span>
              <span role="columnheader"><span className="visually-hidden">Actions</span></span>
            </div>

            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="wl-row" role="row">
                  <span className="wl-client">
                    <span className="cl-skeleton cl-skeleton--avatar-sm" />
                    <span className="cl-skeleton cl-skeleton--line" />
                  </span>
                  <span className="cl-skeleton cl-skeleton--amount" />
                  <span className="cl-skeleton cl-skeleton--amount" />
                  <span />
                </div>
              ))
            ) : visible.length === 0 ? (
              <div className="cl-empty cl-empty--flat">
                <Wallet size={26} strokeWidth={1.6} />
                <strong>{query ? `No wallets match "${search.trim()}"` : 'No wallet balances'}</strong>
                <p>{query ? 'Try the customer ID or phone number.' : 'Clients with money in their wallet will show here.'}</p>
              </div>
            ) : (
              visible.map((row) => (
                <div key={row._id} className="wl-row" role="row">
                  <span className="wl-client" role="cell">
                    {row.user?.imgUrl
                      ? <img className="cl-avatar cl-avatar--sm" src={row.user.imgUrl} alt="" />
                      : <span className="cl-avatar cl-avatar--sm cl-avatar--initials">{initials(row)}</span>}
                    <span className="wl-client__text">
                      <span className="wl-client__name">{fullName(row) || 'Unknown client'}</span>
                      <span className="wl-client__id">{row.user?.customerId}</span>
                    </span>
                  </span>
                  <span className="wl-num" role="cell"><span className="wl-label">USD</span><Amount value={row.usdBalance} currency="USD" /></span>
                  <span className="wl-num" role="cell"><span className="wl-label">LYD</span><Amount value={row.lydBalance} currency="LYD" /></span>
                  <span role="cell" className="wl-action">
                    {row.user?._id && (
                      <Link to={`/user/${row.user._id}`} className="wl-open" aria-label={`Open ${fullName(row)}`}>
                        Profile <ChevronRight size={15} />
                      </Link>
                    )}
                  </span>
                </div>
              ))
            )}

            {!isLoading && visible.length > 0 && (
              <div className="wl-row wl-row--foot" role="row">
                <span role="cell">{query ? `${visible.length} shown` : 'Total'}</span>
                <span className="wl-num" role="cell">
                  <Amount value={visible.reduce((s, w) => s + (w.usdBalance || 0), 0)} currency="USD" />
                </span>
                <span className="wl-num" role="cell">
                  <Amount value={visible.reduce((s, w) => s + (w.lydBalance || 0), 0)} currency="LYD" />
                </span>
                <span role="cell" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WalletsView;
