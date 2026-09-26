import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Dialog } from '@mui/material';
import moment from 'moment';
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, Loader2, Megaphone, Plus, Search, Trash2, XCircle } from 'lucide-react';
import api from '../../api';

type CampaignStatus = 'sending' | 'completed' | 'cancelled';
type RecipientStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

type CampaignSummary = {
  _id: string;
  content: string;
  imgUrl?: string | null;
  target: 'allUsers' | 'onlyNewClients';
  status: CampaignStatus;
  totalUsers: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};

type CampaignUser = {
  user: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerId?: string;
  status: RecipientStatus;
  sentAt?: string;
};

type CampaignDetail = CampaignSummary & { users: CampaignUser[] };

type Props = {
  openCampaignId: string | null;
  onOpenCampaign: (id: string | null) => void;
  onNewCampaign: () => void;
};

const TARGET_LABELS: Record<CampaignSummary['target'], string> = {
  allUsers: 'All clients',
  onlyNewClients: 'New clients',
};

const STATUS_LABELS: Record<CampaignStatus | RecipientStatus, string> = {
  sending: 'Sending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Waiting',
  sent: 'Sent',
  failed: 'Failed',
};

const RECIPIENT_FILTERS = ['all', 'sent', 'pending', 'failed'] as const;
type RecipientFilter = typeof RECIPIENT_FILTERS[number];

const PAGE_SIZE = 20;

const fullName = (user: CampaignUser) => [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
const processed = (c: CampaignSummary) => c.sentCount + c.failedCount;
const percent = (c: CampaignSummary) => (c.totalUsers > 0 ? Math.round((processed(c) / c.totalUsers) * 100) : 0);

const StatusPill = ({ status }: { status: CampaignStatus | RecipientStatus }) => (
  <span className={`cmp-pill is-${status}`}>
    {status === 'sending' && <Loader2 size={12} strokeWidth={2.2} className="cmp-spin" />}
    {(status === 'completed' || status === 'sent') && <CheckCircle2 size={12} strokeWidth={2.2} />}
    {status === 'failed' && <XCircle size={12} strokeWidth={2.2} />}
    {status === 'pending' && <Clock size={12} strokeWidth={2.2} />}
    {STATUS_LABELS[status]}
  </span>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="cmp-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div className="cmp-bar__fill" style={{ width: `${value}%` }} />
  </div>
);

const Campaigns = ({ openCampaignId, onOpenCampaign, onNewCampaign }: Props) => {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [pendingDelete, setPendingDelete] = useState<CampaignSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get('campaigns');
      setCampaigns(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load campaigns.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const response = await api.get(`campaigns/${id}`);
      setDetail(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load this campaign.');
      onOpenCampaign(null);
    }
  }, [onOpenCampaign]);

  useEffect(() => {
    if (!openCampaignId) loadCampaigns();
  }, [openCampaignId, loadCampaigns]);

  useEffect(() => {
    setDetail(null);
    setRecipientFilter('all');
    setQuery('');
    setPage(1);
    if (openCampaignId) loadDetail(openCampaignId);
  }, [openCampaignId, loadDetail]);

  // Live progress while the open campaign is still going out.
  useEffect(() => {
    if (!openCampaignId || detail?.status !== 'sending') return;
    const interval = setInterval(() => loadDetail(openCampaignId), 5000);
    return () => clearInterval(interval);
  }, [openCampaignId, detail?.status, loadDetail]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`campaigns/${pendingDelete._id}`, {});
      setCampaigns((prev) => prev?.filter((c) => c._id !== pendingDelete._id) || null);
      if (openCampaignId === pendingDelete._id) onOpenCampaign(null);
      setPendingDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not delete this campaign.');
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const counts = useMemo(() => {
    const result: Record<RecipientFilter, number> = { all: 0, sent: 0, pending: 0, failed: 0 };
    detail?.users.forEach((user) => {
      result.all++;
      if (user.status in result) result[user.status as RecipientFilter]++;
    });
    return result;
  }, [detail]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (detail?.users || []).filter((user) => {
      if (recipientFilter !== 'all' && user.status !== recipientFilter) return false;
      if (!q) return true;
      return [fullName(user), user.customerId, user.phone].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [detail, recipientFilter, query]);

  const deleteDialog = (
    <Dialog open={!!pendingDelete} onClose={() => !isDeleting && setPendingDelete(null)} PaperProps={{ className: 'cmp-dialog' }}>
      <div className="cmp-dialog__icon"><Trash2 size={20} strokeWidth={2} /></div>
      <h6>Delete this campaign?</h6>
      <p>
        {pendingDelete && pendingDelete.status === 'sending'
          ? `${pendingDelete.totalUsers - processed(pendingDelete)} messages that haven't gone out yet will be cancelled. Messages already sent can't be recalled.`
          : 'The campaign and its recipient history will be removed.'}
      </p>
      <div className="cmp-dialog__actions">
        <button type="button" className="cmp-btn" onClick={() => setPendingDelete(null)} disabled={isDeleting}>Keep it</button>
        <button type="button" className="cmp-btn cmp-btn--danger" onClick={confirmDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Dialog>
  );

  // ----- Detail view -----
  if (openCampaignId) {
    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
      <div className="marketing cmp">
        <div className="cmp-detail__top">
          <button type="button" className="cmp-back" onClick={() => onOpenCampaign(null)}>
            <ArrowLeft size={15} strokeWidth={2} />
            All campaigns
          </button>
          {detail &&
            <button type="button" className="cmp-btn cmp-btn--ghost-danger" onClick={() => setPendingDelete(detail)}>
              <Trash2 size={14} strokeWidth={2} />
              Delete
            </button>
          }
        </div>

        {error && <p className="marketing__error" role="alert">{error}</p>}

        {!detail ? (
          <div className="cmp-detail__skeleton" aria-busy="true" aria-label="Loading campaign">
            <div className="cmp-detail__hero">
              <span className="marketing__skeleton-bar" style={{ height: 150 }} />
              <div className="cmp-stats">
                {Array.from({ length: 4 }).map((_, i) => <span key={i} className="marketing__skeleton-bar" style={{ height: 72 }} />)}
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className="marketing__skeleton-bar" style={{ height: 44 }} />)}
          </div>
        ) : (
          <>
            <div className="cmp-detail__hero">
              <div className="cmp-message">
                <div className="cmp-message__meta">
                  <StatusPill status={detail.status} />
                  <span>{TARGET_LABELS[detail.target]}</span>
                  <span>{moment(detail.createdAt).format('DD MMM YYYY, HH:mm')}</span>
                </div>
                <div className="cmp-message__bubble" dir="rtl">
                  {detail.imgUrl && <img src={detail.imgUrl} alt="" />}
                  <p>{detail.content}</p>
                </div>
              </div>

              <div>
                <div className="cmp-stats">
                  <div className="cmp-stat">
                    <span className="cmp-stat__value">{detail.totalUsers}</span>
                    <span className="cmp-stat__label">Recipients</span>
                  </div>
                  <div className="cmp-stat is-sent">
                    <span className="cmp-stat__value">{detail.sentCount}</span>
                    <span className="cmp-stat__label">Sent</span>
                  </div>
                  <div className="cmp-stat">
                    <span className="cmp-stat__value">{Math.max(0, detail.totalUsers - processed(detail))}</span>
                    <span className="cmp-stat__label">Waiting</span>
                  </div>
                  <div className="cmp-stat is-failed">
                    <span className="cmp-stat__value">{detail.failedCount}</span>
                    <span className="cmp-stat__label">Failed</span>
                  </div>
                </div>
                <div className="cmp-detail__progress">
                  <ProgressBar value={percent(detail)} />
                  <span>
                    {percent(detail)}% done
                    {detail.status === 'sending' && ` · about ${Math.max(0, detail.totalUsers - processed(detail))} min left`}
                  </span>
                </div>
              </div>
            </div>

            <div className="cmp-recipients__bar">
              <div className="cmp-chips" role="tablist" aria-label="Filter recipients">
                {RECIPIENT_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={recipientFilter === filter}
                    className={recipientFilter === filter ? 'is-active' : ''}
                    onClick={() => { setRecipientFilter(filter); setPage(1); }}
                  >
                    {filter === 'all' ? 'All' : STATUS_LABELS[filter]}
                    <span>{counts[filter]}</span>
                  </button>
                ))}
              </div>
              <label className="cmp-search">
                <Search size={14} strokeWidth={2} />
                <input
                  type="search"
                  placeholder="Search name, ID or phone"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                />
              </label>
            </div>

            <div className="cmp-table">
              <div className="cmp-table__head">
                <span>Client</span>
                <span>Phone</span>
                <span>Status</span>
              </div>
              {pagedUsers.map((user) => (
                <div key={user.user} className="cmp-table__row">
                  <span className="cmp-table__client">
                    <RouterLink to={`/user/${user.user}`}>{fullName(user)}</RouterLink>
                    {user.customerId && <span className="marketing__code">{user.customerId}</span>}
                  </span>
                  <span className="cmp-table__phone">{user.phone || '-'}</span>
                  <span className="cmp-table__status">
                    <StatusPill status={user.status} />
                    {user.sentAt && <small>{moment(user.sentAt).format('DD MMM, HH:mm')}</small>}
                  </span>
                </div>
              ))}
              {filteredUsers.length === 0 &&
                <div className="cmp-table__empty">No recipients match.</div>
              }
            </div>

            {pageCount > 1 &&
              <div className="cmp-pagination">
                <button type="button" className="cmp-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page} / {pageCount}</span>
                <button type="button" className="cmp-btn" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            }
          </>
        )}
        {deleteDialog}
      </div>
    );
  }

  // ----- List view -----
  const activeCount = campaigns?.filter((c) => c.status === 'sending').length || 0;

  return (
    <div className="marketing cmp">
      <header className="marketing__header">
        <div>
          <h5 className="marketing__title">
            <Megaphone size={18} strokeWidth={2} />
            Campaigns
          </h5>
          <p className="marketing__subtitle">
            {campaigns
              ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}${activeCount ? `, ${activeCount} sending now` : ''}`
              : 'Every campaign you sent and how far along it is.'}
          </p>
        </div>
        <button type="button" className="marketing__search" onClick={onNewCampaign}>
          <Plus size={15} strokeWidth={2} />
          New campaign
        </button>
      </header>

      {error && <p className="marketing__error" role="alert">{error}</p>}

      <div className="cmp-list">
        {isLoading && !campaigns && Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="marketing__skeleton-bar" style={{ height: 76 }} />
        ))}

        {campaigns?.map((campaign) => (
          <div key={campaign._id} className="cmp-card">
            <button type="button" className="cmp-card__main" onClick={() => onOpenCampaign(campaign._id)}>
              <span className="cmp-card__text">
                <span className="cmp-card__message" dir="rtl">{campaign.content}</span>
                <span className="cmp-card__meta">
                  {TARGET_LABELS[campaign.target]} &middot; {moment(campaign.createdAt).format('DD MMM YYYY')}
                </span>
              </span>

              <span className="cmp-card__progress">
                <span className="cmp-card__numbers">
                  <strong>{campaign.sentCount}</strong> / {campaign.totalUsers} sent
                </span>
                <ProgressBar value={percent(campaign)} />
              </span>

              <StatusPill status={campaign.status} />
              <ChevronRight size={16} strokeWidth={2} className="cmp-card__chevron" />
            </button>

            <button
              type="button"
              className="cmp-card__delete"
              aria-label="Delete campaign"
              title="Delete campaign"
              onClick={() => setPendingDelete(campaign)}
            >
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </div>
        ))}

        {!isLoading && campaigns?.length === 0 &&
          <div className="marketing__empty">
            <Megaphone size={28} strokeWidth={1.5} />
            <p className="m-0 fw-semibold">No campaigns yet</p>
            <p className="m-0">Your campaigns will show up here with live progress.</p>
          </div>
        }
      </div>
      {deleteDialog}
    </div>
  );
};

export default Campaigns;
