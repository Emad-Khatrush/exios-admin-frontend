import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Breadcrumbs, Link, Tooltip, Typography } from '@mui/material';
import moment from 'moment';
import { ArrowRight, Building2, Info, Trash2, UserRound } from 'lucide-react';
import api from '../../api';
import Card from '../../components/Card/Card';
import { formatMoney, getOfficeLabel } from '../UserDetails/statementUtils';
// @ts-ignore
import '../UserDetails/CashflowUser.scss';
// @ts-ignore
import './DeletedStatements.scss';

const PAGE_SIZE = 20;

const filters = [
  { value: '', label: 'All' },
  { value: 'USD', label: 'USD' },
  { value: 'LYD', label: 'LYD' },
];

const fullName = (person: any) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unknown';

const DeletedStatements = () => {
  const isAdmin = useSelector((state: any) => state.session.account?.roles?.isAdmin);

  const [items, setItems] = useState<any[]>([]);
  const [currency, setCurrency] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = async (nextPage: number, nextCurrency: string) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get('statements/deleted', { page: nextPage, limit: PAGE_SIZE, currency: nextCurrency || undefined });
      const { results, hasMore: more, totalCount: count } = response.data;
      setItems((prev) => (nextPage === 1 ? results : [...prev, ...results]));
      setHasMore(more);
      setTotalCount(count);
      setPage(nextPage);
    } catch (err: any) {
      console.log(err);
      setError(err?.response?.data?.message || 'Could not load deleted payments. Please try again.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchPage(1, currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="m-4 cashflow__empty">
        <p className="m-0 fw-semibold">Admins only</p>
        <p className="m-0">You do not have access to deleted payments.</p>
      </div>
    );
  }

  return (
    <div className="m-4">
      <Breadcrumbs separator="›" aria-label="breadcrumb" className="mb-3">
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Typography color="#28323C">Deleted payments</Typography>
      </Breadcrumbs>

      <Card>
        <div className="cashflow deleted-log">
          <header className="cashflow__header">
            <div>
              <h5 className="cashflow__title">Deleted payments</h5>
              <p className="cashflow__subtitle">
                Every payment removed from a customer statement, with who deleted it and how the wallet changed.
              </p>
            </div>
            <div className="cashflow__controls">
              <div className="cashflow__segmented" role="tablist" aria-label="Currency filter">
                {filters.map((filter) => (
                  <button
                    key={filter.value || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={currency === filter.value}
                    className={currency === filter.value ? 'is-active' : ''}
                    onClick={() => currency !== filter.value && setCurrency(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {!isLoading && !error && <p className="deleted-log__count">{totalCount} deleted {totalCount === 1 ? 'payment' : 'payments'}</p>}
          {error && <p className="cashflow-confirm__error" role="alert">{error}</p>}

          <div className="deleted-log__list">
            {items.map((item) => {
              const statement = item.statement || {};
              const isOutflow = statement.calculationType === '-';
              return (
                <article key={item._id} className={`deleted-log__item ${isOutflow ? 'is-out' : 'is-in'}`}>
                  <div className="deleted-log__top">
                    <div className="deleted-log__who">
                      <span className="deleted-log__icon"><Trash2 size={14} strokeWidth={2} /></span>
                      <span>
                        <strong>{fullName(item.deletedBy)}</strong> deleted this payment
                        <span className="deleted-log__when"> · {moment(item.deletedAt).format('DD/MM/YYYY HH:mm')}</span>
                      </span>
                    </div>
                    {item.user?._id &&
                      <RouterLink to={`/user/${item.user._id}`} className="deleted-log__customer">
                        <UserRound size={13} strokeWidth={2} />
                        {fullName(item.user)}
                        {item.user.customerId && <span className="deleted-log__code">{item.user.customerId}</span>}
                      </RouterLink>
                    }
                  </div>

                  <div className="deleted-log__body">
                    <div className="deleted-log__details">
                      <p className="cashflow-row__description" dir="rtl" dangerouslySetInnerHTML={{ __html: statement.description }} />
                      <div className="cashflow-row__meta">
                        <span className="cashflow-chip cashflow-chip--muted">
                          Payment date {moment(statement.createdAt).format('DD/MM/YYYY')}
                        </span>
                        {statement.office &&
                          <span className="cashflow-chip cashflow-chip--office">
                            <Building2 size={12} strokeWidth={2} />
                            {getOfficeLabel(statement.office)}
                          </span>
                        }
                        {statement.actionType && <span className="cashflow-chip">{statement.actionType}</span>}
                        {statement.createdByName && <span className="cashflow-chip cashflow-chip--muted">Added by {statement.createdByName}</span>}
                        {statement.note &&
                          <Tooltip title={<span dir="rtl">{statement.note}</span>} arrow enterTouchDelay={0}>
                            <button type="button" className="cashflow-chip cashflow-chip--note" aria-label="Show note">
                              <Info size={12} strokeWidth={2} />
                              Note
                            </button>
                          </Tooltip>
                        }
                      </div>
                    </div>

                    <div className="deleted-log__numbers">
                      <div>
                        <span className="cashflow-row__label d-block">Amount</span>
                        <span className={`deleted-log__amount ${isOutflow ? 'is-out' : 'is-in'}`}>
                          {isOutflow ? '−' : '+'}{formatMoney(statement.amount, item.currency)}
                        </span>
                      </div>
                      {item.walletBalanceBefore !== null && item.walletBalanceBefore !== undefined &&
                        <div>
                          <span className="cashflow-row__label d-block">Wallet</span>
                          <span className="deleted-log__wallet">
                            {formatMoney(item.walletBalanceBefore, item.currency)}
                            <ArrowRight size={13} strokeWidth={2} />
                            {formatMoney(item.walletBalanceAfter, item.currency)}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                </article>
              );
            })}

            {isLoading && Array.from({ length: items.length ? 2 : 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="deleted-log__item deleted-log__item--skeleton">
                <span className="skeleton" style={{ width: '40%', height: 14 }} />
                <span className="skeleton" style={{ width: '75%', height: 14 }} />
                <span className="skeleton" style={{ width: '30%', height: 12 }} />
              </div>
            ))}

            {!isLoading && !error && items.length === 0 &&
              <div className="cashflow__empty">
                <Trash2 size={28} strokeWidth={1.5} />
                <p className="m-0 fw-semibold">No deleted payments</p>
                <p className="m-0">Payments removed from a customer statement will be listed here.</p>
              </div>
            }
          </div>

          {hasMore && !isLoading &&
            <div className="d-flex justify-content-center mt-3">
              <button type="button" className="cashflow__print-trigger" onClick={() => fetchPage(page + 1, currency)}>
                Load more
              </button>
            </div>
          }
        </div>
      </Card>
    </div>
  );
};

export default DeletedStatements;
