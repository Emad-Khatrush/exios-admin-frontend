import { Alert } from '@mui/material';
import { Boxes, CheckCircle2, ChevronRight, Layers, Loader2, Plane, Plus, PlaneTakeoff, Search, Ship, Truck, X } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import FlightsManagement from './FlightsManagement';
import { COUNTRY_OPTIONS, OFFICE_OPTIONS, optionLabel } from './InventoryFields';
import { Attachment, AttachmentThumb, AttachmentViewer, formatWeight, Progress, TYPE_META } from './inventoryUi';

import './InventoryForm.scss';
import './InventoryList.scss';

const PAGE_SIZE = 20;

type ListFilter = 'all' | 'air' | 'sea' | 'domestic' | 'finished';

type InventoryItem = {
  _id: string
  voyage: string
  shippingType: 'air' | 'sea' | 'domestic'
  shippedCountry: string
  inventoryPlace: string
  status: 'processing' | 'finished'
  arrivalDate?: string
  inventoryFinishedDate?: string
  createdAt: string
  note?: string
  attachments?: Attachment[]
  stats: { packagesCount: number, receivedCount: number, missingCount: number, totalKG: number, totalCBM: number }
};

type CountList = Partial<Record<ListFilter, number>>;

const FILTERS: { value: ListFilter, label: string, icon: typeof Plane }[] = [
  { value: 'all', label: 'Open', icon: Layers },
  { value: 'air', label: 'Air', icon: Plane },
  { value: 'sea', label: 'Sea', icon: Ship },
  { value: 'domestic', label: 'Domestic', icon: Truck },
  { value: 'finished', label: 'Finished', icon: CheckCircle2 },
];

const ShipmentsList = () => {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [countList, setCountList] = useState<CountList>({});
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [previewImages, setPreviewImages] = useState<InventoryItem['attachments'] | null>(null);

  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (skip: number) => {
    const params: Record<string, string | number> = { skip, limit: PAGE_SIZE };
    if (debouncedSearch) params.searchValue = debouncedSearch;
    else params.searchType = filter;
    const { data } = await api.get('inventory', params);
    return data as { results: InventoryItem[], countList: CountList };
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError('');
    fetchPage(0)
      .then((data) => {
        if (id !== requestId.current) return;
        setItems(data.results);
        setHasMore(data.results.length === PAGE_SIZE);
        // While searching the API only returns the page size, so keep the last real counts
        if (!debouncedSearch && data.countList) setCountList(data.countList);
      })
      .catch(() => { if (id === requestId.current) setError('Could not load inventory. Try again.'); })
      .finally(() => { if (id === requestId.current) setIsLoading(false); });
  }, [fetchPage, debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(items.length);
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i._id));
        return [...prev, ...data.results.filter((i) => !seen.has(i._id))];
      });
      setHasMore(data.results.length === PAGE_SIZE);
    } catch {
      if (id === requestId.current) setError('Could not load more.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, isLoading, isLoadingMore, items.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="ivl-toolbar">
        <div className="ivl-chips" role="radiogroup" aria-label="Show">
          {FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={!debouncedSearch && filter === value}
              className={`ivl-chip ${!debouncedSearch && filter === value ? 'is-active' : ''}`}
              onClick={() => { setSearch(''); setFilter(value); }}
            >
              <Icon size={14} /> {label}
              <span className="ivl-chip__count">{(countList[value] ?? 0).toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
        <div className="ivl-search">
          <Search size={16} className="ivl-search__icon" />
          <input
            type="search"
            placeholder="Voyage, order ID or tracking number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
          {search && (
            <button type="button" className="ivl-search__clear" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {debouncedSearch && !isLoading && (
        <p className="ivl-search-note">Results for “{debouncedSearch}” across open and finished shipments.</p>
      )}

      {error && <Alert severity="error" className="ivl-error">{error}</Alert>}

      <div className={isLoading && items.length > 0 ? 'ivl-refreshing' : ''} aria-busy={isLoading}>
        {isLoading && items.length === 0 ? (
          <ul className="ivl-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="ivl-row ivl-row--skeleton">
                <div className="inv-skeleton ivl-sk-icon" />
                <div className="ivl-sk-lines">
                  <div className="inv-skeleton ivl-sk-line" />
                  <div className="inv-skeleton ivl-sk-short" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 && !error ? (
          <div className="ivl-empty">
            <Boxes size={28} strokeWidth={1.6} />
            <strong>{debouncedSearch ? `Nothing matches “${debouncedSearch}”` : 'No shipments here'}</strong>
            <p>{debouncedSearch ? 'Try the full voyage number, an order ID or a tracking number.' : 'New shipments you add will show up here.'}</p>
          </div>
        ) : (
          <ul className="ivl-list">
            {items.map((item) => {
              const type = TYPE_META[item.shippingType] || TYPE_META.air;
              const TypeIcon = type.icon;
              const isFinished = item.status === 'finished';
              const images = item.attachments || [];
              return (
                <li key={item._id} className="ivl-row">
                  <span className={`ivl-type ivl-type--${item.shippingType}`} title={type.label}>
                    <TypeIcon size={18} strokeWidth={2} />
                  </span>

                  <div className="ivl-main">
                    <div className="ivl-title">
                      <Link to={`/inventory/${item._id}/edit`} className="ivl-voyage">{item.voyage}</Link>
                      <span className={`inv-badge ${isFinished ? 'is-ok' : 'is-warn'}`}>{isFinished ? 'Finished' : 'Open'}</span>
                      {item.stats.missingCount > 0 && (
                        <span className="inv-badge ivl-badge--danger">{item.stats.missingCount} missing</span>
                      )}
                    </div>
                    <p className="ivl-route">
                      {optionLabel(COUNTRY_OPTIONS, item.shippedCountry) || item.shippedCountry}
                      <ChevronRight size={13} />
                      {optionLabel(OFFICE_OPTIONS, item.inventoryPlace) || item.inventoryPlace}
                      <span className="ivl-dot">·</span>
                      {type.label}
                    </p>
                    {item.note && <p className="ivl-note" dir="auto" title={item.note}>{item.note}</p>}
                  </div>

                  <div className="ivl-packages">
                    <Progress done={item.stats.receivedCount} total={item.stats.packagesCount} />
                    <span className="ivl-weight">{formatWeight(item.stats.totalKG, item.stats.totalCBM)}</span>
                  </div>

                  <div className="ivl-dates">
                    <span title="Arrival in Libya">
                      <PlaneTakeoff size={13} /> {item.arrivalDate ? moment(item.arrivalDate).format('D MMM YYYY') : <em>No arrival date</em>}
                    </span>
                    <span className="ivl-muted">
                      {isFinished && item.inventoryFinishedDate
                        ? `Finished ${moment(item.inventoryFinishedDate).format('D MMM YYYY')}`
                        : `Added ${moment(item.createdAt).fromNow()}`}
                    </span>
                  </div>

                  <div className="ivl-actions">
                    {images.length > 0 && (
                      <button type="button" className="ivl-thumbs" onClick={() => setPreviewImages(images)} aria-label={`View ${images.length} ${images.length === 1 ? 'file' : 'files'}`}>
                        <AttachmentThumb file={images[0]} />
                        {images.length > 1 && <span>+{images.length - 1}</span>}
                      </button>
                    )}
                    <Link to={`/inventory/${item._id}/edit`} className="inv-btn is-ghost is-small">
                      Open <ChevronRight size={14} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={sentinelRef} />
        {hasMore && !isLoading && (
          <div className="ivl-more">
            <button type="button" className="inv-btn is-ghost" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? <><Loader2 size={15} className="ivl-spin" /> Loading</> : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <AttachmentViewer files={previewImages || null} onClose={() => setPreviewImages(null)} />
    </>
  );
};

const Inventory = () => {
  const { roles } = useSelector((state: any) => state.session.account);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = roles?.isAdmin && searchParams.get('view') === 'flights' ? 'flights' : 'shipments';

  return (
    <div className="inv-page ivl-page">
      <header className="inv-head">
        <div>
          <h1>Inventory</h1>
          <p className="inv-head-meta">
            {view === 'flights'
              ? 'Every air and sea flight at a glance: what is still open, what needs attention and what it cost.'
              : 'Shipments in each office, how many packages reached customers, and their paperwork.'}
          </p>
        </div>
        <div className="inv-head-actions">
          {roles?.isAdmin && (
            <div className="ivl-switcher" role="tablist" aria-label="Inventory views">
              <button type="button" role="tab" aria-selected={view === 'shipments'} className={view === 'shipments' ? 'is-active' : ''} onClick={() => setSearchParams({}, { replace: true })}>
                <Boxes size={15} /> Shipments
              </button>
              <button type="button" role="tab" aria-selected={view === 'flights'} className={view === 'flights' ? 'is-active' : ''} onClick={() => setSearchParams({ view: 'flights' }, { replace: true })}>
                <Plane size={15} /> Flight management
              </button>
            </div>
          )}
          <Link to="/inventory/add" className="inv-btn is-primary">
            <Plus size={16} /> New shipment
          </Link>
        </div>
      </header>

      {view === 'flights' ? <FlightsManagement /> : <ShipmentsList />}
    </div>
  );
};

export default Inventory;
