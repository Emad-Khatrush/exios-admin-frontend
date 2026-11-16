import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Skeleton, TablePagination } from '@mui/material';
import { MdAdd, MdHourglassBottom, MdRemove, MdToll, MdTune, MdUndo } from 'react-icons/md';
import moment from 'moment';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { dayHeading, fullDate, money, pageAriaLabel, pageLabel, pointsText, usdOf } from '../Loyalty/format';
import { LoyaltyRtl, Num, stagger } from '../Loyalty/LoyaltyRtl';
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
  payment: 'بانتظار الدفع', delivery: 'بانتظار التسليم', processing: 'تُضاف خلال ساعة',
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
    ? <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer"><Num>{row.orderNumber || 'طلبية'}</Num></a>
    : null;
  const onOrder = (text: string, fallback: string) => (order ? <>{text} {order}</> : fallback);
  switch (row.kind) {
    case 'earn': return onOrder('كسب من طلبية', 'كسب نقاط');
    case 'redeem': return onOrder('استعمال على طلبية', 'استعمال نقاط');
    case 'restore': return onOrder('إرجاع نقاط طلبية ملغاة', 'إرجاع نقاط');
    case 'revoke': return onOrder('سحب نقاط طلبية ملغاة', 'سحب نقاط');
    case 'expire': return 'انتهت صلاحية النقاط';
    case 'add': return 'إضافة من الموظف';
    case 'deduct': return 'خصم من الموظف';
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
  // Bumped on every load that lands, so the history fades in again
  const [loads, setLoads] = useState(0);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`user/${userId}/loyalty`, { page: nextPage + 1 });
      setData(res.data);
      setLoads((n) => n + 1);
    } catch (e: any) {
      setError(requestError(e, 'تعذّر تحميل النقاط.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(page); }, [load, page, version]);

  if (!data) {
    return (
      <LoyaltyRtl>
        <div className="lp lp-tab" dir="rtl">
          {error ? (
            <Alert severity="error" dir="auto" action={<Button color="inherit" size="small" onClick={() => load(page)}>إعادة المحاولة</Button>}>{error}</Alert>
          ) : (
            <div className="lp-passbook" aria-busy="true">
              <Skeleton width={70} />
              <Skeleton width={260} height={48} />
              <Skeleton width={200} />
            </div>
          )}
        </div>
      </LoyaltyRtl>
    );
  }

  const rows: any[] = data.history?.rows || [];
  const pending: any[] = data.pending || [];

  return (
    <LoyaltyRtl>
      <div className="lp lp-tab lp-enter" dir="rtl">
        {error && <Alert severity="error" dir="auto">{error}</Alert>}

        <section className="lp-passbook lp-enter__card" style={stagger(0)}>
          <div className="lp-passbook__top">
            <div>
              <span className="lp-label">الرصيد</span>
              <div className="lp-balance">
                <MdToll className="lp-coin-icon" aria-hidden="true" />
                <strong><Num>{pointsText(data.points)}</Num></strong>
                <span className="lp-balance__unit">نقطة</span>
                <span className="lp-balance__usd">= <Num>${money(usdOf(data))}</Num></span>
              </div>
            </div>
            <Button variant="contained" type="button" startIcon={<MdTune />} onClick={() => setAdjusting(true)}>تعديل النقاط</Button>
          </div>
          <div className="lp-passbook__meta">
            <span className="lp-chip lp-chip--coin"><MdToll aria-hidden="true" />كل <Num>100</Num> نقطة = <Num>$1</Num></span>
            {data.expiringSoon && (
              <span className="lp-expiring">
                <MdHourglassBottom aria-hidden="true" />
                تنتهي <Num>{pointsText(data.expiringSoon.points)}</Num> نقطة في <Num>{fullDate(data.expiringSoon.at)}</Num>
              </span>
            )}
          </div>
          <dl className="lp-totals">
            <div><dt>إجمالي المكتسب</dt><dd><Num>{pointsText(data.earnedTotal)}</Num></dd></div>
            <div><dt>إجمالي المستعمل</dt><dd><Num>{pointsText(data.redeemedTotal)}</Num></dd></div>
          </dl>
        </section>

        {pending.length > 0 && (
          <section className="lp-section" style={stagger(1)}>
            <h3 className="lp-section__title">نقاط في الطريق <span className="lp-chip"><Num>{pending.length}</Num></span></h3>
            <ul className="lp-list">
              {pending.map((row) => (
                <li key={row.arKey} className="lp-pending">
                  <span className="lp-pending__order">
                    طلبية <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer"><Num>{row.orderNumber || 'طلبية'}</Num></a>
                  </span>
                  <span className="lp-pending__pts"><Num>+{pointsText(row.points)}</Num> نقطة</span>
                  <span className={`lp-chip lp-waiting--${row.waitingFor}`}>{WAITING[row.waitingFor] || row.waitingFor}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="lp-section" style={stagger(pending.length > 0 ? 2 : 1)}>
          <h3 className="lp-section__title">السجل</h3>
          {rows.length === 0 ? (
            <div className="lp-list">
              <div className="lp-state-box">
                <span className="lp-state-box__icon"><MdToll /></span>
                <strong>{loading ? 'جارٍ التحميل' : 'لا توجد حركات بعد'}</strong>
                {!loading && <p>تظهر هنا النقاط المكتسبة والمستعملة والمضافة والمنتهية.</p>}
              </div>
            </div>
          ) : (
            <div key={loads} className={`lp-history${loading ? ' is-loading' : ''}`} aria-busy={loading}>
              {byDay(rows).map((day) => (
                <div key={day.key} className="lp-day lp-fade-in">
                  <h4 className="lp-day__title"><bdi>{dayHeading(day.at)}</bdi></h4>
                  <ul className="lp-list">
                    {day.rows.map((row, index) => {
                      const tone = TONE[row.kind] || 'spend';
                      const expires = LOTS.has(row.kind) && row.expiresAt ? fullDate(row.expiresAt) : '';
                      return (
                        <li key={`${row.createdAt}-${index}`} className={`lp-move lp-move--${tone}`}>
                          <span className="lp-move__icon" aria-hidden="true">{row.kind === 'revoke' ? <MdUndo /> : ICON[tone]}</span>
                          <div className="lp-move__body">
                            <div className="lp-move__title">{titleOf(row)}</div>
                            {row.reason && <div className="lp-move__note" dir="auto">{row.reason}</div>}
                            <div className="lp-move__note">
                              <Num>{moment(row.createdAt).format('HH:mm')}</Num>
                              {expires && <> · تنتهي في <Num>{expires}</Num></>}
                            </div>
                          </div>
                          <div className="lp-move__side">
                            <div className="lp-move__delta"><Num>{signed(row.kind, row.points)}</Num></div>
                            {typeof row.balanceAfter === 'number' && <div className="lp-move__after">الرصيد <Num>{pointsText(row.balanceAfter)}</Num></div>}
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
            labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
          />
        </section>

        <AdjustPointsDialog
          open={adjusting} userId={userId} balance={Number(data.points || 0)} onClose={() => setAdjusting(false)}
          onSaved={() => { setPage(0); onChanged(); }}
        />
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyTab;
