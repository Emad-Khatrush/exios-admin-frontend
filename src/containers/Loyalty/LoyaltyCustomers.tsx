import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, IconButton, InputAdornment, Skeleton, TablePagination, TextField, useMediaQuery } from '@mui/material';
import {
  MdAdd, MdCardGiftcard, MdChevronLeft, MdClose, MdErrorOutline, MdHourglassBottom, MdLayers, MdLocalFireDepartment, MdPersonSearch, MdRemove, MdSearch, MdShoppingBag, MdToll, MdUndo,
} from 'react-icons/md';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { initials, money, monthTitle, pageAriaLabel, pageLabel, pointsText, relativeDay, shortDate, shortDay, usdOf } from './format';
import { LoyaltyRtl, Num, stagger } from './LoyaltyRtl';
import { LevelBadge, useTiers } from './levels';
import './loyalty.scss';

const PAGE_SIZE = 25;

type Sort = 'balance' | 'expiring';
const SORTS: [Sort, string][] = [['balance', 'الرصيد'], ['expiring', 'الأقرب انتهاءً']];

// "عميل واحد", "عميلان", "3 عملاء", "11 عميلاً": the count with the noun Arabic grammar asks for
const customersText = (n: number) => {
  if (n === 0) return 'لا يوجد';
  if (n === 1) return 'عميل واحد';
  if (n === 2) return 'عميلان';
  return <><Num>{pointsText(n)}</Num> {n >= 3 && n <= 10 ? 'عملاء' : 'عميلاً'}</>;
};

// A number that glides to its new value when it changes (from 0 the first time), so a refreshed
// total reads as "this moved" instead of a jump. Off under reduced motion.
const useTween = (target: number | undefined, reduced: boolean) => {
  const [value, setValue] = useState(target ?? 0);
  const from = useRef(0);
  useEffect(() => {
    if (target === undefined) return undefined;
    if (reduced) { setValue(target); from.current = target; return undefined; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 550);
      const eased = 1 - (1 - k) ** 3;
      setValue(Math.round(origin + (target - origin) * eased));
      if (k < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); from.current = target; };
  }, [target, reduced]);
  return value;
};

// What each kind of movement is called in the activity feed, and how it looks
const MOVE: Record<string, { label: string, tone: 'gain' | 'spend' | 'warn', Icon: any }> = {
  earn: { label: 'كسب', tone: 'gain', Icon: MdAdd },
  add: { label: 'إضافة من الموظف', tone: 'gain', Icon: MdAdd },
  restore: { label: 'إرجاع نقاط', tone: 'gain', Icon: MdUndo },
  redeem: { label: 'استعمال', tone: 'spend', Icon: MdShoppingBag },
  deduct: { label: 'خصم من الموظف', tone: 'spend', Icon: MdRemove },
  expire: { label: 'انتهت صلاحيتها', tone: 'warn', Icon: MdHourglassBottom },
  revoke: { label: 'سحب نقاط طلبية ملغاة', tone: 'warn', Icon: MdHourglassBottom },
};

// This month's movement, by what it did; last month's figure beside each for comparison
const MONTH_ROWS: [string, string, 'gain' | 'spend' | 'warn'][] = [
  ['earned', 'كسبها العملاء', 'gain'],
  ['used', 'استُعملت في الدفع', 'spend'],
  ['expired', 'انتهت أو سُحبت', 'warn'],
  ['added', 'أضافها الموظفون', 'gain'],
  ['deducted', 'خصمها الموظفون', 'spend'],
];

const LoyaltyCustomers = () => {
  const navigate = useNavigate();
  const tiers = useTiers();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Search, sort, filter and page live in the address, so coming back from a customer lands on the same list
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const sort: Sort = params.get('sort') === 'expiring' ? 'expiring' : 'balance';
  const expiringOnly = params.get('exp') === '1';
  const page = Math.max(0, Number(params.get('page') || 1) - 1);
  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const [search, setSearch] = useState(query);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [overview, setOverview] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // The search runs when typing pauses; a new search starts on page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      if (next !== query) setParam({ q: next || null, page: null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // "/" jumps to the search box, like most admin tools
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The list. While a new page or filter loads, the current rows stay (dimmed) instead of blinking
  // into placeholders; only the very first load shows the skeleton.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    api.get('loyalty/customers', { search: query, sort, expiringOnly, page: page + 1, limit: PAGE_SIZE })
      .then((res: any) => { if (!stale) setData(res.data); })
      .catch((e: any) => { if (!stale) setError(requestError(e, 'تعذّر تحميل العملاء الذين لديهم نقاط.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [query, sort, expiringOnly, page, attempt]);

  useEffect(() => {
    let stale = false;
    api.get('loyalty/overview', { recent: 8 })
      .then((res: any) => { if (!stale) setOverview(res.data); })
      .catch(() => { if (!stale) setOverview({ failed: true }); });
    return () => { stale = true; };
  }, [attempt]);

  const totals = data?.totals;
  const rows: any[] = data?.rows || [];
  const firstLoad = loading && !data;
  const refreshing = loading && !!data;
  const filtered = !!query || expiringOnly;
  const toggleExpiring = () => setParam({ exp: expiringOnly ? null : '1', page: null });
  const open = (userId: string) => navigate(`/user/${userId}?tab=points`);
  const shownPoints = useTween(totals?.points, reduced);

  const table = () => {
    if (error) {
      return (
        <div className="lp-state-box lp-state-box--error lp-fade-in" role="alert">
          <span className="lp-state-box__icon"><MdErrorOutline /></span>
          <strong>تعذّر تحميل النقاط</strong>
          <p dir="auto">{error}</p>
          <Button variant="outlined" size="small" onClick={() => setAttempt((n) => n + 1)}>إعادة المحاولة</Button>
        </div>
      );
    }
    if (!loading && rows.length === 0) {
      return (
        <div className="lp-state-box lp-fade-in">
          <span className="lp-state-box__icon"><MdToll /></span>
          <strong>{filtered ? 'لا يوجد عميل مطابق' : 'لا يوجد عميل لديه نقاط بعد'}</strong>
          <p>
            {filtered
              ? 'جرّب اسماً أو كوداً أو هاتفاً آخر، أو أوقف تصفية النقاط التي تنتهي قريباً.'
              : 'تظهر هنا عندما يكسب العملاء نقاطاً من فواتير مدفوعة.'}
          </p>
          {filtered && <Button size="small" onClick={() => { setSearch(''); setParam({ q: null, exp: null, page: null }); }}>عرض كل العملاء</Button>}
        </div>
      );
    }
    return (
      <div className="lp-table-wrap">
        <table className="lp-table" aria-busy={loading}>
          <thead>
            <tr>
              <th>العميل</th>
              <th>الكود</th>
              <th>المستوى</th>
              <th>الهاتف</th>
              <th className="is-num">النقاط</th>
              <th>تنتهي قريباً</th>
              <th>آخر حركة</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          {/* Each new page or filter gets its own body, so it fades in as a whole */}
          <tbody key={firstLoad ? 'loading' : `${query}|${sort}|${expiringOnly}|${page}`} className={firstLoad ? '' : 'lp-fade-in'}>
            {firstLoad ? Array.from({ length: 6 }, (_, index) => (
              <tr key={index}>
                <td>
                  <div className="lp-person">
                    <Skeleton variant="rectangular" width={34} height={34} sx={{ borderRadius: '8px' }} />
                    <Skeleton width={140} />
                  </div>
                </td>
                <td><Skeleton width={60} /></td>
                <td><Skeleton width={60} /></td>
                <td><Skeleton width={90} /></td>
                <td className="is-num"><Skeleton width={60} sx={{ ml: 'auto' }} /><Skeleton width={44} sx={{ ml: 'auto' }} /></td>
                <td><Skeleton width={90} /></td>
                <td><Skeleton width={70} /></td>
                <td />
              </tr>
            )) : rows.map((row) => (
              <tr
                key={row.userId} className="lp-row" tabIndex={0}
                onClick={() => open(row.userId)}
                onKeyDown={(event) => { if (event.key === 'Enter') open(row.userId); }}
              >
                <td>
                  <div className="lp-person">
                    <span className="lp-person__avatar" aria-hidden="true">{initials(row.name)}</span>
                    <div className="lp-person__name" dir="auto">{row.name || '—'}</div>
                  </div>
                </td>
                <td className="lp-muted">{row.customerId ? <Num>{row.customerId}</Num> : '—'}</td>
                <td>{tiers.length > 0 ? <LevelBadge level={row.level} tiers={tiers} size="sm" /> : null}</td>
                <td className="lp-muted">{row.phone ? <Num>{row.phone}</Num> : '—'}</td>
                <td className="is-num">
                  <div className="lp-amount">
                    <strong><Num>{pointsText(row.points)}</Num> نقطة</strong>
                    <span><Num>${money(usdOf(row))}</Num></span>
                  </div>
                </td>
                <td>
                  {row.expiringSoon
                    ? <span className="lp-chip lp-chip--coin"><Num>{pointsText(row.expiringSoon.points)}</Num> نقطة · <Num>{shortDate(row.expiringSoon.at)}</Num></span>
                    : <span className="lp-muted">—</span>}
                </td>
                <td className="lp-muted"><bdi>{relativeDay(row.lastMovementAt)}</bdi></td>
                <td className="lp-row__go" aria-hidden="true"><MdChevronLeft /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const expiringText = () => {
    if (expiringOnly && data) return customersText(data.total || 0);
    if (totals?.expiring && !totals.expiring.customers) return 'لا يوجد';
    if (totals?.expiring) return <>{customersText(totals.expiring.customers)} · <Num>{pointsText(totals.expiring.points)}</Num> نقطة</>;
    return 'عرض العملاء';
  };

  const month = overview && !overview.failed ? monthTitle(overview.month) : null;

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>نقاط الولاء</h1>
          <p>النقاط التي يملكها العملاء، وقيمتها، وما سينتهي قريباً.</p>
          <nav className="lp-head__nav" aria-label="صفحات الولاء">
            <Link to="/loyalty/levels" className="lp-head__link"><MdLayers aria-hidden /> المستويات وتقريرها</Link>
            <Link to="/loyalty/promotions" className="lp-head__link is-offer"><MdLocalFireDepartment aria-hidden /> عروض النقاط</Link>
            <Link to="/loyalty/referrals" className="lp-head__link"><MdPersonSearch aria-hidden /> مراجعة الدعوات</Link>
            <Link to="/loyalty/referrals/report" className="lp-head__link"><MdPersonSearch aria-hidden /> تقرير الدعوات</Link>
            <Link to="/loyalty/gifts" className="lp-head__link"><MdCardGiftcard aria-hidden /> النقاط المعلّقة</Link>
          </nav>
        </header>

        <section className="lp-summary lp-enter__card" aria-label="الملخص" style={stagger(1)}>
          <div className="lp-summary__main">
            <span className="lp-label">نقاط قائمة للعملاء</span>
            <div className="lp-figure" aria-live="polite">
              <MdToll className="lp-coin-icon" aria-hidden="true" />
              <Num>{totals ? pointsText(shownPoints) : '—'}</Num>
              <small>نقطة</small>
            </div>
            <div className="lp-figure-sub">= <strong><Num>${totals ? money(shownPoints / 100) : '—'}</Num></strong> مستحقة للعملاء</div>
          </div>
          <div className="lp-summary__side">
            <div className="lp-stat">
              <span className="lp-label">عملاء لديهم نقاط</span>
              <strong><Num>{totals ? pointsText(totals.customers) : '—'}</Num></strong>
            </div>
            <button type="button" className="lp-stat lp-stat--toggle lp-press" aria-pressed={expiringOnly} onClick={toggleExpiring}>
              <span className="lp-label">تنتهي خلال 30 يوماً</span>
              <strong>{expiringText()}</strong>
              <small>{expiringOnly ? 'تُعرض هذه فقط · اضغط للإلغاء' : 'اضغط لعرضهم فقط'}</small>
            </button>
          </div>
        </section>

        <div className="lp-layout">
          <div className="lp-layout__main" style={stagger(2)}>
            <div className="lp-toolbar">
              <TextField
                className="lp-search" size="small" placeholder="الاسم أو الكود أو الهاتف" value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputRef={searchRef}
                inputProps={{ 'aria-label': 'بحث', 'aria-keyshortcuts': '/' }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><MdSearch /></InputAdornment>,
                  endAdornment: search
                    ? <InputAdornment position="end"><IconButton size="small" aria-label="مسح البحث" onClick={() => { setSearch(''); setParam({ q: null, page: null }); }}><MdClose /></IconButton></InputAdornment>
                    : <InputAdornment position="end"><kbd className="lp-kbd" aria-hidden="true">/</kbd></InputAdornment>,
                }}
              />
              <div className="lp-segment" role="group" aria-label="الترتيب">
                {SORTS.map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={sort === value} onClick={() => setParam({ sort: value === 'balance' ? null : value, page: null })}>{label}</button>
                ))}
              </div>
              {expiringOnly && (
                <button type="button" className="lp-chip lp-chip--coin lp-filter lp-press lp-fade-in" onClick={toggleExpiring} aria-label="إلغاء تصفية النقاط التي تنتهي قريباً">
                  <MdHourglassBottom aria-hidden="true" /> تنتهي خلال 30 يوماً <MdClose aria-hidden="true" />
                </button>
              )}
              {data && !error && (
                <span className="lp-count" aria-live="polite">{filtered ? 'النتائج: ' : 'المجموع: '}{customersText(data.total || 0)}</span>
              )}
            </div>

            <div className={`lp-card${refreshing ? ' is-refreshing' : ''}`}>
              <div className="lp-progress" aria-hidden="true" />
              {table()}
              {!error && (data?.total || 0) > PAGE_SIZE && (
                <TablePagination
                  component="div" count={data?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
                  onPageChange={(_, next) => setParam({ page: next ? String(next + 1) : null })}
                  labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
                />
              )}
            </div>
          </div>

          <aside className="lp-layout__side" aria-label="نشاط البرنامج" style={stagger(3)}>
            <section className="lp-panel" aria-labelledby="lp-month">
              <h2 id="lp-month" className="lp-panel__title">
                هذا الشهر{month && <span className="lp-muted"> · {month.name} <Num>{month.year}</Num></span>}
              </h2>
              {!overview ? (
                <div className="lp-panel__rows">{MONTH_ROWS.map(([key]) => <Skeleton key={key} height={26} />)}</div>
              ) : overview.failed ? (
                <p className="lp-muted lp-panel__empty">تعذّر تحميل ملخص الشهر.</p>
              ) : (
                <dl className="lp-panel__rows lp-fade-in">
                  {MONTH_ROWS.map(([key, label, tone]) => (
                    <div key={key} className={`lp-month-row is-${tone}`}>
                      <dt>{label}</dt>
                      <dd>
                        <strong><Num>{pointsText(overview.current[key])}</Num></strong>
                        <small title="الشهر الماضي">الماضي <Num>{pointsText(overview.previous[key])}</Num></small>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="lp-panel" aria-labelledby="lp-recent">
              <h2 id="lp-recent" className="lp-panel__title">آخر الحركات</h2>
              {!overview ? (
                <div className="lp-panel__rows">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}</div>
              ) : overview.failed || !overview.recent?.length ? (
                <p className="lp-muted lp-panel__empty">{overview.failed ? 'تعذّر تحميل الحركات.' : 'لا توجد حركات بعد.'}</p>
              ) : (
                <ul className="lp-feed lp-fade-in">
                  {overview.recent.map((m: any) => {
                    const look = MOVE[m.kind] || MOVE.earn;
                    return (
                      <li key={m.id} className={`lp-feed__item is-${look.tone}`}>
                        <span className="lp-feed__icon" aria-hidden="true"><look.Icon /></span>
                        <div className="lp-feed__body">
                          <button type="button" className="lp-feed__who" onClick={() => open(m.userId)} dir="auto">{m.name || m.customerId || 'عميل'}</button>
                          <div className="lp-feed__what">
                            {look.label}
                            {m.orderNumber && <> · <Link to={`/invoice/${m.orderId}/edit`}><Num>{m.orderNumber}</Num></Link></>}
                            {m.reason && <span className="lp-feed__why" title={m.reason}> · {m.reason}</span>}
                          </div>
                        </div>
                        <div className="lp-feed__side">
                          <strong><Num>{m.delta > 0 ? '+' : '−'}{pointsText(Math.abs(m.delta))}</Num></strong>
                          <small><bdi>{shortDay(m.createdAt)}</bdi></small>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyCustomers;
