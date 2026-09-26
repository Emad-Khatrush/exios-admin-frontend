import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Megaphone, Phone, Trash2, UserRound, XCircle } from 'lucide-react';
import api from '../../api';

type CampaignSummary = {
  _id: string;
  content: string;
  imgUrl?: string | null;
  target: 'allUsers' | 'onlyNewClients';
  status: 'sending' | 'completed' | 'cancelled';
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
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
};

type CampaignDetail = CampaignSummary & { users: CampaignUser[] };

type Props = {
  focusCampaignId?: string | null;
  onFocused?: () => void;
};

const TARGET_LABELS: Record<CampaignSummary['target'], string> = {
  allUsers: 'All clients',
  onlyNewClients: 'New clients only',
};

const STATUS_LABELS: Record<CampaignSummary['status'], string> = {
  sending: 'Sending',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const RECIPIENT_FILTERS = ['all', 'pending', 'sent', 'failed'] as const;
type RecipientFilter = typeof RECIPIENT_FILTERS[number];

const recipientName = (user: CampaignUser) => [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';

const PAGE_SIZE = 25;

const Campaigns = (props: Props) => {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [page, setPage] = useState(1);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const loadDetail = useCallback(async (id: string, silent?: boolean) => {
    try {
      if (!silent) setIsDetailLoading(true);
      const response = await api.get(`campaigns/${id}`);
      setDetail(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load this campaign.');
      setSelectedId(null);
    } finally {
      if (!silent) setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (props.focusCampaignId) {
      setSelectedId(props.focusCampaignId);
      props.onFocused?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusCampaignId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setPage(1);
    setRecipientFilter('all');
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Keeps the open campaign's progress live while it's still sending.
  useEffect(() => {
    if (!selectedId || detail?.status !== 'sending') return;
    const interval = setInterval(() => loadDetail(selectedId, true), 5000);
    return () => clearInterval(interval);
  }, [selectedId, detail?.status, loadDetail]);

  const deleteCampaign = async (id: string) => {
    try {
      setDeletingId(id);
      await api.delete(`campaigns/${id}`, {});
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(null);
      setCampaigns((prev) => prev?.filter((campaign) => campaign._id !== id) || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not delete this campaign.');
    } finally {
      setDeletingId(null);
    }
  };

  if (selectedId) {
    const filteredUsers = detail?.users.filter((user) => recipientFilter === 'all' || user.status === recipientFilter) || [];
    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const progressPct = detail && detail.totalUsers > 0 ? Math.round(((detail.sentCount + detail.failedCount) / detail.totalUsers) * 100) : 0;

    return (
      <div className="marketing">
        <button type="button" className="campaigns__back" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={15} strokeWidth={2} />
          Back to campaigns
        </button>

        {isDetailLoading && !detail &&
          <div className="marketing__list">
            <div className="marketing__row marketing__row--skeleton">
              <span className="marketing__skeleton-bar" style={{ width: '40%', height: 14 }} />
              <span className="marketing__skeleton-bar" style={{ width: '60%', height: 12 }} />
            </div>
          </div>
        }

        {detail &&
          <>
            <header className="marketing__header">
              <div>
                <h5 className="marketing__title">
                  <Megaphone size={18} strokeWidth={2} />
                  Campaign details
                  <span className={`campaigns__status is-${detail.status}`}>{STATUS_LABELS[detail.status]}</span>
                </h5>
                <p className="marketing__subtitle campaign-detail__content">{detail.content}</p>
              </div>
            </header>

            <div className="campaign-detail__stats">
              <div className="campaign-detail__stat">
                <span className="campaign-detail__stat-value">{detail.totalUsers}</span>
                <span className="campaign-detail__stat-label">Total targeted</span>
              </div>
              <div className="campaign-detail__stat is-success">
                <span className="campaign-detail__stat-value">{detail.sentCount}</span>
                <span className="campaign-detail__stat-label">Sent</span>
              </div>
              <div className="campaign-detail__stat is-danger">
                <span className="campaign-detail__stat-value">{detail.failedCount}</span>
                <span className="campaign-detail__stat-label">Failed</span>
              </div>
              <div className="campaign-detail__stat">
                <span className="campaign-detail__stat-value">{Math.max(0, detail.totalUsers - detail.sentCount - detail.failedCount)}</span>
                <span className="campaign-detail__stat-label">Pending</span>
              </div>
            </div>

            <div className="campaign-detail__progress">
              <div className="campaign-detail__progress-track">
                <div className="campaign-detail__progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span>{progressPct}% processed &middot; {TARGET_LABELS[detail.target]} &middot; sent {moment(detail.createdAt).fromNow()}</span>
            </div>

            <div className="campaign-detail__filters">
              {RECIPIENT_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={recipientFilter === filter ? 'is-active' : ''}
                  onClick={() => { setRecipientFilter(filter); setPage(1); }}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            <div className="marketing__list">
              {pagedUsers.map((user) => (
                <article key={user.user} className="marketing__row campaign-detail__row">
                  <div className="marketing__who">
                    <span className="marketing__avatar"><UserRound size={15} strokeWidth={2} /></span>
                    <div>
                      <span className="marketing__name">
                        {recipientName(user)}
                        {user.customerId && <span className="marketing__code">{user.customerId}</span>}
                      </span>
                      <div className="marketing__meta">
                        {user.phone && <span><Phone size={12} strokeWidth={2} /> {user.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <span className={`campaigns__status is-${user.status}`}>
                    {user.status === 'sent' && <CheckCircle2 size={13} strokeWidth={2} />}
                    {user.status === 'failed' && <XCircle size={13} strokeWidth={2} />}
                    {user.status === 'pending' && <Clock size={13} strokeWidth={2} />}
                    {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                  </span>
                </article>
              ))}

              {filteredUsers.length === 0 &&
                <div className="marketing__empty">
                  <Megaphone size={28} strokeWidth={1.5} />
                  <p className="m-0 fw-semibold">No recipients match this filter</p>
                </div>
              }
            </div>

            {pageCount > 1 &&
              <div className="campaign-detail__pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            }
          </>
        }
      </div>
    );
  }

  return (
    <div className="marketing">
      <header className="marketing__header">
        <div>
          <h5 className="marketing__title">
            <Megaphone size={18} strokeWidth={2} />
            Campaigns
          </h5>
          <p className="marketing__subtitle">
            Every campaign you've sent, who it reached, and how far along it is.
          </p>
        </div>
      </header>

      {error && <p className="marketing__error" role="alert">{error}</p>}

      <div className="marketing__list">
        {isLoading && Array.from({ length: 3 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="marketing__row marketing__row--skeleton">
            <span className="marketing__skeleton-bar" style={{ width: '35%', height: 14 }} />
            <span className="marketing__skeleton-bar" style={{ width: '55%', height: 12 }} />
          </div>
        ))}

        {!isLoading && campaigns?.map((campaign) => {
          const progressPct = campaign.totalUsers > 0 ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalUsers) * 100) : 0;
          return (
            <article key={campaign._id} className="marketing__row campaigns__row">
              <div className="campaigns__row-main" onClick={() => setSelectedId(campaign._id)} role="button" tabIndex={0}>
                <div className="marketing__who">
                  <span className="marketing__avatar"><Megaphone size={15} strokeWidth={2} /></span>
                  <div>
                    <span className="marketing__name campaign-detail__content">{campaign.content}</span>
                    <div className="marketing__meta">
                      <span>{TARGET_LABELS[campaign.target]}</span>
                      <span>{campaign.totalUsers} recipients</span>
                      <span>{moment(campaign.createdAt).fromNow()}</span>
                    </div>
                  </div>
                </div>

                <div className="campaigns__row-progress">
                  <span className={`campaigns__status is-${campaign.status}`}>
                    {campaign.status === 'sending' && <Loader2 size={13} strokeWidth={2} className="campaigns__spin" />}
                    {campaign.status === 'completed' && <CheckCircle2 size={13} strokeWidth={2} />}
                    {STATUS_LABELS[campaign.status]}
                  </span>
                  <div className="campaign-detail__progress-track campaign-detail__progress-track--compact">
                    <div className="campaign-detail__progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="campaigns__row-count">{campaign.sentCount}/{campaign.totalUsers} sent{campaign.failedCount > 0 ? `, ${campaign.failedCount} failed` : ''}</span>
                </div>
              </div>

              <button
                type="button"
                className="campaigns__delete"
                title="Delete campaign"
                disabled={deletingId === campaign._id}
                onClick={() => setConfirmDeleteId(campaign._id)}
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>

              {confirmDeleteId === campaign._id &&
                <div className="campaigns__confirm">
                  <span>Delete this campaign and cancel any messages still queued?</span>
                  <div>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    <button type="button" className="is-danger" onClick={() => deleteCampaign(campaign._id)}>
                      {deletingId === campaign._id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              }
            </article>
          );
        })}

        {!isLoading && campaigns?.length === 0 &&
          <div className="marketing__empty">
            <Megaphone size={28} strokeWidth={1.5} />
            <p className="m-0 fw-semibold">No campaigns yet</p>
            <p className="m-0">Send your first campaign and it will show up here with live progress.</p>
          </div>
        }
      </div>
    </div>
  );
};

export default Campaigns;
