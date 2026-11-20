import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Skeleton } from '@mui/material';
import { MdAdd, MdBlock, MdHourglassBottom, MdLocalShipping, MdReceiptLong, MdRemove, MdToll, MdTune, MdUndo } from 'react-icons/md';
import moment from 'moment';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { fullDate, money, monthTitle, pointsText, shortDay, usdOf } from '../Loyalty/format';
import { LoyaltyRtl, Num, stagger } from '../Loyalty/LoyaltyRtl';
import AdjustPointsDialog from './AdjustPointsDialog';
import PointsOffDialog from './PointsOffDialog';
import LevelPanel from './LevelPanel';
import ReferralPanel from './ReferralPanel';
import { useStaffAccess } from '../../utils/useStaffAccess';
import '../Loyalty/loyalty.scss';
import './loyaltyTab.scss';

type Props = {
  userId: string
  // Called after points were adjusted, so the header balance can be read again
  onChanged: () => void
  // Bumped by the parent when the balance should be read again
  version?: number
}

const WAITING: Record<string, string> = {
  payment: 'بانتظار الدفع', delivery: 'بانتظار التسليم', processing: 'تُضاف خلال ساعة',
};
const PENDING_FILTERS = ['all', 'payment', 'delivery', 'processing'];
const PENDING_FIRST = 5;

// The history's filters (the server's ?type=)
type HistoryType = 'all' | 'earn' | 'spend' | 'expire' | 'staff' | 'returned';
const HISTORY_TYPES: { type: HistoryType, label: string }[] = [
  { type: 'all', label: 'الكل' },
  { type: 'earn', label: 'كسب' },
  { type: 'spend', label: 'استعمال' },
  { type: 'expire', label: 'انتهاء' },
  { type: 'staff', label: 'تعديلات الموظف' },
  { type: 'returned', label: 'إرجاع' },
];

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

// The month of a row: the server's (Libya time, the same as its totals), else from the date
const monthOf = (row: any) => row.month || moment(row.createdAt).format('YYYY-MM');

// The rows in runs of the same month. They come newest first, so a month that goes on over the
// next page stays one group.
const byMonth = (rows: any[]) => {
  const months: { key: string, rows: { row: any, index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const key = monthOf(row);
    const last = months[months.length - 1];
    if (last && last.key === key) last.rows.push({ row, index });
    else months.push({ key, rows: [{ row, index }] });
  });
  return months;
};

type MonthSums = Record<string, { gained: number, spent: number }>;
const monthsMap = (list?: any[]) => {
  const map: MonthSums = {};
  (list || []).forEach((m) => { if (m?.month) map[m.month] = { gained: Number(m.gained || 0), spent: Number(m.spent || 0) }; });
  return map;
};

// Add a page, never showing a movement twice (rows that slid down when new ones arrived)
const appendRows = (cur: any[], next: any[]) => {
  const seen = new Set(cur.map((r) => r.id).filter(Boolean));
  return [...cur, ...next.filter((r) => !r.id || !seen.has(r.id))];
};

const ordersWord = (n: number) => (n === 2 ? 'طلبيتان' : n >= 3 && n <= 10 ? 'طلبيات' : 'طلبية');

// Points on the way: one summary line, filters by what each claim waits for, the first rows and the rest on demand
const PendingSection = ({ pending, index }: { pending: any[], index: number }) => {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const orders = new Set(pending.map((row) => String(row.orderId))).size;
  const points = pending.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const chips = PENDING_FILTERS
    .map((f) => ({ f, n: f === 'all' ? pending.length : pending.filter((row) => row.waitingFor === f).length, label: f === 'all' ? 'الكل' : WAITING[f] }))
    .filter((c) => c.f === 'all' || c.n > 0);
  const active = chips.some((c) => c.f === filter) ? filter : 'all';
  const rows = active === 'all' ? pending : pending.filter((row) => row.waitingFor === active);
  const shown = expanded ? rows : rows.slice(0, PENDING_FIRST);
  return (
    <section className="lpx-card" style={stagger(index)}>
      <header className="lpx-card__head">
        <h3 className="lpx-card__title"><MdLocalShipping aria-hidden="true" /> نقاط في الطريق</h3>
        <p className="lpx-card__aside">
          <Num>{pointsText(orders)}</Num> {ordersWord(orders)}، <strong><Num>+{pointsText(points)}</Num></strong> نقطة
        </p>
      </header>
      <div className="lp-filters" role="group" aria-label="تصفية النقاط في الطريق">
        {chips.map((c) => (
          <button key={c.f} type="button" className="lp-filter-chip" aria-pressed={active === c.f} onClick={() => setFilter(c.f)}>
            {c.label} <Num>{pointsText(c.n)}</Num>
          </button>
        ))}
      </div>
      <ul className="lp-list">
        {shown.map((row) => (
          <li key={row.arKey} className="lp-pending">
            <span className="lp-pending__order">
              طلبية <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer"><Num>{row.orderNumber || 'طلبية'}</Num></a>
            </span>
            <span className="lp-pending__pts"><Num>+{pointsText(row.points)}</Num></span>
            <span className={`lp-chip lp-waiting--${row.waitingFor}`}>{WAITING[row.waitingFor] || row.waitingFor}</span>
          </li>
        ))}
      </ul>
      {rows.length > PENDING_FIRST && (
        <div className="lp-more">
          <Button size="small" variant="outlined" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'عرض أقل' : <>عرض الكل (<Num>{pointsText(rows.length)}</Num>)</>}
          </Button>
        </div>
      )}
    </section>
  );
};

type Busy = '' | 'filter' | 'more';

// A customer's loyalty points: balance, what is coming, and every movement
const LoyaltyTab = ({ userId, onChanged, version = 0 }: Props) => {
  const [data, setData] = useState<any>(null);
  const [type, setType] = useState<HistoryType>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [months, setMonths] = useState<MonthSums>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<Busy>('filter');
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  // The points switched off / on for this customer (partners on a special price)
  const [offDialog, setOffDialog] = useState<'' | 'off' | 'on'>('');
  // «إضافة وخصم نقاط العميل» and «تغيير مستوى العميل» in Settings > Permissions (admins have both)
  const staff = useStaffAccess();
  const canAdjust = staff.can('loyalty_adjust');
  const canChangeLevel = staff.can('loyalty_level');
  // Rows from this index on came with the last page added: only they fade in
  const [freshFrom, setFreshFrom] = useState(Infinity);
  // Every request takes a number; any answer but the latest one is ignored
  const ticket = useRef(0);
  const typeRef = useRef<HistoryType>('all');
  const rowCount = useRef(0);
  rowCount.current = rows.length;

  // Page 1 of a filter starts the list over; a later page is added to it
  const load = useCallback(async (nextType: HistoryType, nextPage: number) => {
    const mine = ++ticket.current;
    const append = nextPage > 1;
    setBusy(append ? 'more' : 'filter');
    if (append) setMoreError(''); else setError('');
    try {
      const res = await api.get(`user/${userId}/loyalty`, { page: nextPage, type: nextType });
      if (mine !== ticket.current) return;
      const history = res.data?.history || {};
      const next: any[] = Array.isArray(history.rows) ? history.rows : [];
      setData(res.data);
      if (append) {
        setFreshFrom(rowCount.current);
        setRows((cur) => appendRows(cur, next));
        setMonths((cur) => ({ ...cur, ...monthsMap(history.months) }));
      } else {
        setFreshFrom(Infinity);
        setRows(next);
        setMonths(monthsMap(history.months));
      }
      setTotal(Number(history.total || 0));
      setPage(nextPage);
    } catch (e: any) {
      if (mine !== ticket.current) return;
      if (append) setMoreError(requestError(e, 'تعذّر تحميل المزيد.'));
      else setError(requestError(e, 'تعذّر تحميل النقاط.'));
    } finally {
      if (mine === ticket.current) setBusy('');
    }
  }, [userId]);

  useEffect(() => { load(typeRef.current, 1); }, [load, version]);

  const choose = (next: HistoryType) => {
    if (next === type) return;
    typeRef.current = next;
    setType(next);
    setRows([]);
    setMonths({});
    setTotal(0);
    setPage(1);
    setFreshFrom(Infinity);
    load(next, 1);
  };

  if (!data) {
    return (
      <LoyaltyRtl>
        <div className="lp lp-tab" dir="rtl">
          {error ? (
            <Alert severity="error" dir="auto" action={<Button color="inherit" size="small" onClick={() => load(type, 1)}>إعادة المحاولة</Button>}>{error}</Alert>
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

  const pending: any[] = data.pending || [];
  const pendingPoints = pending.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const loadingList = busy === 'filter';

  return (
    <LoyaltyRtl>
      <div className="lp lp-tab lp-enter" dir="rtl">
        {error && (
          <Alert severity="error" dir="auto" action={<Button color="inherit" size="small" onClick={() => load(type, 1)}>إعادة المحاولة</Button>}>{error}</Alert>
        )}

        {data.off && (
          <section className="lpx-off" role="status">
            <span className="lpx-off__icon" aria-hidden="true"><MdBlock /></span>
            <div className="lpx-off__body">
              <strong>النقاط موقوفة لهذا العميل</strong>
              <span>
                لا يكسب نقاطاً ولا يدفع بها، ولا يرى النقاط في التطبيق.
                {data.offInfo?.reason && <> السبب: <bdi dir="auto">{data.offInfo.reason}</bdi>.</>}
                {data.offInfo?.at && <> منذ <Num>{fullDate(data.offInfo.at)}</Num>{data.offInfo.by ? <> بواسطة <bdi>{data.offInfo.by}</bdi></> : null}.</>}
              </span>
            </div>
            {canAdjust && <Button size="small" variant="contained" onClick={() => setOffDialog('on')}>تفعيل النقاط</Button>}
          </section>
        )}

        <div className="lpx-hero" style={stagger(0)}>
        <section className="lp-passbook lpx-wallet lp-enter__card">
          <header className="lpx-wallet__head">
            <span className="lp-label">رصيد النقاط</span>
            {canAdjust && <Button variant="contained" size="small" type="button" startIcon={<MdTune />} onClick={() => setAdjusting(true)}>تعديل النقاط</Button>}
          </header>
          <div className="lp-balance lpx-wallet__balance">
            <MdToll className="lp-coin-icon" aria-hidden="true" />
            <strong><Num>{pointsText(data.points)}</Num></strong>
            <span className="lp-balance__unit">نقطة</span>
            <span className="lp-balance__usd">= <Num>${money(usdOf(data))}</Num></span>
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
          <dl className="lpx-stats">
            <div><dt>إجمالي المكتسب</dt><dd className="is-gain"><Num>{pointsText(data.earnedTotal)}</Num></dd></div>
            <div><dt>إجمالي المستعمل</dt><dd><Num>{pointsText(data.redeemedTotal)}</Num></dd></div>
            <div><dt>في الطريق</dt><dd><Num>{pointsText(pendingPoints)}</Num></dd></div>
          </dl>
          {canAdjust && !data.off && (
            <button type="button" className="lpx-off-link" onClick={() => setOffDialog('off')}><MdBlock aria-hidden="true" /> إيقاف النقاط لهذا العميل</button>
          )}
        </section>

        {data.level && <LevelPanel userId={userId} level={data.level} canChange={canChangeLevel} onChanged={() => { load(type, 1); onChanged(); }} />}
        </div>

        <ReferralPanel userId={userId} canEdit={canAdjust} onChanged={() => { load(type, 1); onChanged(); }} />

        {pending.length > 0 && <PendingSection pending={pending} index={1} />}

        <section className="lpx-card" style={stagger(pending.length > 0 ? 2 : 1)}>
          <header className="lpx-card__head">
            <h3 className="lpx-card__title"><MdReceiptLong aria-hidden="true" /> سجل الحركات</h3>
            {total > 0 && <p className="lpx-card__aside"><Num>{pointsText(total)}</Num> حركة</p>}
          </header>
          <div className="lp-filters" role="group" aria-label="تصفية السجل">
            {HISTORY_TYPES.map((t) => (
              <button key={t.type} type="button" className="lp-filter-chip" aria-pressed={type === t.type} onClick={() => choose(t.type)}>{t.label}</button>
            ))}
          </div>
          {rows.length === 0 ? (
            <div className="lp-list" aria-busy={loadingList}>
              <div className="lp-state-box">
                <span className="lp-state-box__icon"><MdToll /></span>
                <strong>{loadingList ? 'جارٍ التحميل' : type === 'all' ? 'لا توجد حركات بعد' : 'لا توجد حركات من هذا النوع.'}</strong>
                {!loadingList && type === 'all' && <p>تظهر هنا النقاط المكتسبة والمستعملة والمضافة والمنتهية.</p>}
              </div>
            </div>
          ) : (
            <div className={`lp-history${loadingList ? ' is-loading' : ''}`} aria-busy={loadingList}>
              {byMonth(rows).map((month) => {
                const title = monthTitle(month.key);
                const sums = months[month.key];
                return (
                  <div key={month.key} className="lp-month">
                    <h4 className="lp-month__title">
                      <span>{title.name} <Num>{title.year}</Num></span>
                      {sums && (sums.gained > 0 || sums.spent > 0) && (
                        <span className="lp-month__sums">
                          {sums.gained > 0 && <Num className="is-gain">+{pointsText(sums.gained)}</Num>}
                          {sums.spent > 0 && <Num className="is-spent">−{pointsText(sums.spent)}</Num>}
                        </span>
                      )}
                    </h4>
                    <ul className="lp-list">
                      {month.rows.map(({ row, index }) => {
                        const tone = TONE[row.kind] || 'spend';
                        const expires = LOTS.has(row.kind) && row.expiresAt ? fullDate(row.expiresAt) : '';
                        const note = [row.reason, expires ? `تنتهي في ${expires}` : ''].filter(Boolean).join(' · ');
                        return (
                          <li key={row.id || `${row.createdAt}-${index}`} className={`lp-move lp-move--${tone} lp-move--compact${index >= freshFrom ? ' lp-fade-in' : ''}`}>
                            <span className="lp-move__icon" aria-hidden="true">{row.kind === 'revoke' ? <MdUndo /> : ICON[tone]}</span>
                            <div className="lp-move__body">
                              <div className="lp-move__title">{titleOf(row)}</div>
                              <div className="lp-move__meta">
                                <span className="lp-move__when">{shortDay(row.createdAt)} <Num>{moment(row.createdAt).format('HH:mm')}</Num></span>
                                {note && <span className="lp-move__why" dir="auto" title={note}>{note}</span>}
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
                );
              })}
            </div>
          )}
          {rows.length > 0 && rows.length < total && (
            <div className="lp-more">
              {moreError && <span className="lp-muted" role="alert" dir="auto">{moreError}</span>}
              <Button size="small" variant="outlined" onClick={() => load(type, page + 1)} disabled={!!busy}>
                {busy === 'more' ? 'جارٍ التحميل...' : 'عرض المزيد'}
              </Button>
            </div>
          )}
        </section>

        <PointsOffDialog
          open={!!offDialog && canAdjust} userId={userId} turningOff={offDialog === 'off'} onClose={() => setOffDialog('')}
          onSaved={() => { setOffDialog(''); load(type, 1); onChanged(); }}
        />

        <AdjustPointsDialog
          open={adjusting && canAdjust} userId={userId} balance={Number(data.points || 0)} onClose={() => setAdjusting(false)}
          onSaved={() => { load(type, 1); onChanged(); }}
        />
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyTab;
