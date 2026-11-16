import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, InputAdornment, Skeleton, TablePagination, TextField } from '@mui/material';
import { MdClose, MdErrorOutline, MdHourglassBottom, MdSearch, MdToll } from 'react-icons/md';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';
import { initials, money, pageAriaLabel, pageLabel, pointsText, relativeDay, shortDate, usdOf } from './format';
import { LoyaltyRtl, Num, stagger } from './LoyaltyRtl';
import './loyalty.scss';

const PAGE_SIZE = 25;

type Sort = 'balance' | 'expiring';
const SORTS: [Sort, string][] = [['balance', 'الرصيد'], ['expiring', 'الأقرب انتهاءً']];

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
      .catch((e: any) => { if (!stale) setError(requestError(e, 'تعذّر تحميل العملاء الذين لديهم نقاط.')); })
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
              <th>الهاتف</th>
              <th className="is-num">النقاط</th>
              <th>تنتهي قريباً</th>
              <th>آخر حركة</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }, (_, index) => (
              <tr key={index}>
                <td>
                  <div className="lp-person">
                    <Skeleton variant="rectangular" width={34} height={34} sx={{ borderRadius: '8px' }} />
                    <Skeleton width={140} />
                  </div>
                </td>
                <td><Skeleton width={60} /></td>
                <td><Skeleton width={90} /></td>
                <td className="is-num"><Skeleton width={60} sx={{ ml: 'auto' }} /><Skeleton width={44} sx={{ ml: 'auto' }} /></td>
                <td><Skeleton width={90} /></td>
                <td><Skeleton width={70} /></td>
              </tr>
            )) : rows.map((row) => (
              <tr
                key={row.userId} className="lp-row lp-fade-in" tabIndex={0}
                onClick={() => open(row)}
                onKeyDown={(event) => { if (event.key === 'Enter') open(row); }}
              >
                <td>
                  <div className="lp-person">
                    <span className="lp-person__avatar" aria-hidden="true">{initials(row.name)}</span>
                    <div className="lp-person__name" dir="auto">{row.name || '—'}</div>
                  </div>
                </td>
                <td className="lp-muted">{row.customerId ? <Num>{row.customerId}</Num> : '—'}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const expiringText = () => {
    if (expiringOnly && data) return <><Num>{pointsText(data.total || 0)}</Num> عملاء</>;
    if (totals?.expiring) {
      return <><Num>{pointsText(totals.expiring.customers)}</Num> عملاء · <Num>{pointsText(totals.expiring.points)}</Num> نقطة</>;
    }
    return 'عرض العملاء';
  };

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>نقاط الولاء</h1>
          <p>النقاط التي يملكها العملاء، وقيمتها، وما سينتهي قريباً.</p>
        </header>

        <section className="lp-summary lp-enter__card" aria-label="الملخص" style={stagger(1)}>
          <div className="lp-summary__main">
            <span className="lp-label">نقاط قائمة للعملاء</span>
            <div className="lp-figure">
              <MdToll className="lp-coin-icon" aria-hidden="true" />
              <Num>{totals ? pointsText(totals.points) : '—'}</Num>
              <small>نقطة</small>
            </div>
            <div className="lp-figure-sub">= <strong><Num>${totals ? money(usdOf(totals)) : '—'}</Num></strong> مستحقة للعملاء</div>
          </div>
          <div className="lp-summary__side">
            <div className="lp-stat">
              <span className="lp-label">عملاء لديهم نقاط</span>
              <strong><Num>{totals ? pointsText(totals.customers) : '—'}</Num></strong>
            </div>
            <button type="button" className="lp-stat lp-stat--toggle lp-press" aria-pressed={expiringOnly} onClick={toggleExpiring}>
              <span className="lp-label">تنتهي خلال 30 يوماً</span>
              <strong>{expiringText()}</strong>
              <small>{expiringOnly ? 'تُعرض هذه فقط' : 'تصفية القائمة'}</small>
            </button>
          </div>
        </section>

        <div className="lp-toolbar" style={stagger(2)}>
          <TextField
            className="lp-search" size="small" placeholder="الاسم أو الكود أو الهاتف" value={search}
            onChange={(event) => setSearch(event.target.value)}
            inputProps={{ 'aria-label': 'بحث' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><MdSearch /></InputAdornment> }}
          />
          <div className="lp-segment" role="group" aria-label="الترتيب">
            {SORTS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={sort === value} onClick={() => { setSort(value); setPage(0); }}>{label}</button>
            ))}
          </div>
          {expiringOnly && (
            <button type="button" className="lp-chip lp-chip--coin lp-filter lp-press lp-fade-in" onClick={toggleExpiring} aria-label="إلغاء تصفية النقاط التي تنتهي قريباً">
              <MdHourglassBottom aria-hidden="true" /> تنتهي خلال 30 يوماً <MdClose aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="lp-card" style={stagger(3)}>
          {body()}
          {!error && (
            <TablePagination
              component="div" count={data?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
              onPageChange={(_, next) => setPage(next)}
              labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
            />
          )}
        </div>
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyCustomers;
