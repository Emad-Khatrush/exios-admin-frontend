import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { MenuItem, Select, useMediaQuery } from '@mui/material';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Ban, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronUp, CircleHelp, Clock3, Copy, MapPin, Package, Phone, Plane, RefreshCw, Search, Ship, ShoppingBag, Truck, Wallet, X } from 'lucide-react';
import { base } from '../../api';
import { getOrderSteps } from '../../utils/methods';
import { customerInitials, locationLabel } from './trackingDisplay';
import './XTrackingDashboard.scss';

type Parcel = { _id: string; trackingNumber?: string; arrivedAt?: string; weight?: { total: number; measureUnit: string }; chargeCents: number; received: boolean; arrivedLibya: boolean; arrived: boolean; mark?: string; trip?: { _id: string; name: string; method: string } | null };
type Order = {
  _id: string; orderId: string; customerInfo?: { fullName: string; phone: string };
  user?: { _id?: string; customerId: string; firstName?: string; lastName?: string }; shipment?: { fromWhere: string; toWhere: string; method: string };
  placedAt: string; officeLabel?: string; productName: string; isPayment: boolean; isShipment: boolean; unsureOrder?: boolean;
  isFinished: boolean; hasProblem: boolean; orderNote?: string; orderStatus: number;
  shippingBlocked?: boolean; shippingBlockReason?: string;
  createdAt: string; lastActivityAt: string; ageIsEstimated?: boolean;
  billedCents: number; purchaseCents: number; openCents: number; paymentState: string; moneySource: string;
  packages: Parcel[]; packageCount: number; matchedTrackings?: string[];
};
type Result = { orders: Order[]; total: number | null; counts: Record<string, number> };
type Criteria = { searchType: string; stage: string; sort: string; payment: string; query: string };
type CountMap = Record<string, number>;
type CounterSnapshot = { key: string; categoryAt: number; matrixAt: number; reload: number; counts?: CountMap;
  countsByPayment?: Record<string, CountMap>; paymentCountsByStage?: Record<string, CountMap> };
const DEFAULT_CRITERIA: Criteria = { searchType: 'orderId', stage: 'all', sort: 'recent', payment: 'all', query: '' };
const sameCriteria = (a: Criteria, b: Criteria) => a.searchType === b.searchType && a.stage === b.stage && a.sort === b.sort && a.payment === b.payment && a.query === b.query;
const PAGE_SIZE = 10;
const COUNTS_REFRESH_MS = 60_000;
const sameCounts = (previous: Record<string, number>, next: Record<string, number>) =>
  Object.keys(previous).length === Object.keys(next).length && Object.keys(next).every(key => previous[key] === next[key]);
const FILTERS = [ ['all', 'الطلبيات النشطة'], ['purchase', 'شراء'], ['shipping', 'شحن'], ['combined', 'شراء وشحن'], ['waitingPurchase', 'شراء بانتظار الدفع'], ['blocked', 'ممنوعة من الشحن'], ['hasProblem', 'فيها مشكلة'], ['finished', 'مكتملة'] ];
const PAYMENT_OPTIONS = [['all', 'كل حالات السداد'], ['paid', 'مدفوعة بالكامل'], ['unpaid', 'غير مدفوعة'], ['partial', 'متبقي عليها'], ['unknown', 'تحتاج مراجعة']];
const PAYMENT: Record<string, string> = { paid: 'مدفوعة بالكامل', unpaid: 'لم تدفع بعد', partial: 'مدفوعة جزئيًا', pending: 'لا يوجد مبلغ مستحق مسجل', unknown: 'السداد يحتاج مراجعة' };
const SUMMARY = [
  { key: 'all', label: 'الطلبيات النشطة', hint: 'طلبيات غير مكتملة من جميع الأنواع', icon: Package },
  { key: 'waitingPurchase', label: 'شراء بانتظار الدفع', hint: 'بانتظار إتمام عملية الشراء', icon: ShoppingBag },
  { key: 'finished', label: 'مكتملة', hint: 'طلبيات اكتملت', icon: CheckCircle2 },
  { key: 'hasProblem', label: 'تحتاج متابعة', hint: 'طلبيات مؤشرة بوجود مشكلة', icon: AlertCircle },
];
function CompactSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return <div className="xt-select-field"><label id={`${id}-label`}>{label}</label><Select
    id={id} labelId={`${id}-label`} value={value} size="small" fullWidth
    className="xt-modern-select" onChange={event => {
      const next = String(event.target.value);
      if (next !== value && options.some(([key]) => key === next)) onChange(next);
    }}
    renderValue={selected => options.find(([key]) => key === selected)?.[1] || ''}
    IconComponent={ChevronDown} MenuProps={{ PaperProps: { className: 'xt-select-menu', dir: 'rtl' }, MenuListProps: { 'aria-labelledby': `${id}-label` }, transitionDuration: reducedMotion ? 0 : 140 }}
  >{options.map(([key, text]) => <MenuItem key={key} value={key}><span>{text}</span>{value === key && <Check size={15} aria-hidden="true" />}</MenuItem>)}</Select></div>;
}
const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const date = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-GB') : '—';
export const statusAgeDays = (value: string, now = Date.now()) => {
  const at = new Date(value).getTime();
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 86400000)) : null;
};
const plainNote = (note?: string) => {
  if (!note) return '';
  return new DOMParser().parseFromString(note, 'text/html').body.textContent || '';
};

function OrderCard({ order, search, packagesOpen }: { order: Order; search: string; packagesOpen: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  const kind = order.isPayment ? order.isShipment ? 'combined' : 'purchase' : order.isShipment ? 'shipping' : 'other';
  const purchaseOnly = kind === 'purchase';
  const shippingMethod = order.shipment?.method;
  const shippingLabel = shippingMethod === 'air' ? 'جوي' : shippingMethod === 'sea' ? 'بحري' : 'غير معروف';
  const ShippingIcon = shippingMethod === 'air' ? Plane : shippingMethod === 'sea' ? Ship : CircleHelp;
  const customerName = order.customerInfo?.fullName?.trim() || [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'عميل غير محدد';
  const customerCode = order.user?.customerId;
  const [showStages, setShowStages] = useState(false);
  const Icon = kind === 'purchase' ? ShoppingBag : kind === 'combined' ? Package : Truck;
  const days = statusAgeDays(order.lastActivityAt || order.createdAt);
  const steps = getOrderSteps(order as any);
  const currentStep = order.isFinished ? steps.length - 1 : Math.min(Math.max(order.orderStatus || 0, 0), steps.length - 1);
  const paidCents = Math.min(order.billedCents, Math.max(0, order.billedCents - order.openCents));
  const paymentPercent = order.billedCents > 0 ? Math.floor((paidCents / order.billedCents) * 100) : 0;
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.orderId); setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1800); }
    catch { setError('تعذر النسخ؛ يمكنك تحديد رقم الطلبية ونسخه.'); }
  };
  const expand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (parcels) return;
    setLoading(true); setError('');
    try {
      const { data } = await base.axios.get(`orders/tracking/${order._id}/packages`);
      if (active.current) setParcels(data.packages);
    } catch { if (active.current) { setExpanded(false); setError('تعذر جلب الشحنات. اضغط عرض الشحنات مجددًا للمحاولة.'); } }
    finally { if (active.current) setLoading(false); }
  };
  const visible = expanded && parcels ? parcels : order.packages;
  return <article className={`xt-order xt-order--${kind}`} aria-label={`طلبية ${order.orderId}`}>
    <div className="xt-order-head">
      <div className="xt-order-identity"><span className="xt-kind-icon"><Icon size={23} aria-hidden="true" /></span><div>
        <span className="xt-kind-label">{kind === 'purchase' ? 'طلبية شراء' : kind === 'combined' ? 'طلبية شراء وشحن' : kind === 'shipping' ? 'طلبية شحن' : 'طلبية غير مصنفة'}</span>
        <div className="xt-number"><Link to={`/invoice/${order._id}/edit`}><span>رقم الطلبية</span><h3 dir="ltr">{order.orderId}</h3></Link><button type="button" onClick={copy} aria-label={copied ? 'تم نسخ رقم الطلبية' : 'نسخ رقم الطلبية'}>{copied ? <CheckCircle2 size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button>{copied && <span className="xt-copy-confirmation" role="status">تم النسخ</span>}</div>
      </div></div>
      <div className="xt-statuses">
        <span className="xt-tag" aria-label={`نوع الشحن: ${shippingLabel}`} title="نوع الشحن"><ShippingIcon size={15} aria-hidden="true" />{shippingLabel}</span>
        {order.unsureOrder && <span className="xt-tag">غير مؤكدة</span>}
        {order.shippingBlocked && <span className="xt-tag xt-tag--blocked"><Ban size={15} aria-hidden="true" />ممنوعة من الشحن</span>}
        {order.hasProblem && <span className="xt-tag xt-tag--problem"><AlertCircle size={15} aria-hidden="true" />تحتاج متابعة</span>}
        <span className={`xt-payment xt-payment--${order.paymentState}`}>{order.paymentState === 'paid' ? <CheckCircle2 size={15} aria-hidden="true" /> : <Wallet size={15} aria-hidden="true" />}{PAYMENT[order.paymentState] || PAYMENT.unknown}</span>
      </div>
    </div>
    <div className="xt-order-main">
      <div className="xt-order-information">
        <div className="xt-customer-status-row">
        <div className="xt-customer"><span className="xt-customer-avatar" aria-hidden="true">{customerInitials(customerName)}</span><div className="xt-customer-profile"><div className="xt-customer-heading"><strong className="xt-customer-name"><bdi dir="auto">{customerName}</bdi></strong>{order.user?._id ? <Link className="xt-customer-code" to={`/user/${order.user._id}`} aria-label={`فتح صفحة العميل ${customerCode || customerName}`}><span>كود العميل</span><bdi dir="ltr">{customerCode || 'عرض العميل'}</bdi><ArrowUpRight size={14} aria-hidden="true" /></Link> : customerCode ? <span className="xt-customer-code"><span>كود العميل</span><bdi dir="ltr">{customerCode}</bdi></span> : null}</div><dl className="xt-customer-facts"><div><dt><MapPin size={13} aria-hidden="true" />المكتب</dt><dd>{locationLabel(order.officeLabel || order.placedAt) || 'غير محدد'}</dd></div>{order.customerInfo?.phone && <div><dt><Phone size={13} aria-hidden="true" />الهاتف</dt><dd><bdi dir="ltr">{order.customerInfo.phone}</bdi></dd></div>}</dl></div></div>
        <section className="xt-current-state" aria-label="الحالة الحالية ومدة الانتظار">
          <span className="xt-state-label">الحالة الحالية</span>
          <strong>{order.isFinished ? 'مكتملة' : steps[currentStep]?.label || 'قيد المتابعة'}</strong>
          <div className="xt-current-age"><span><Clock3 size={14} aria-hidden="true" />{days === null ? 'المدة غير متاحة' : `${order.ageIsEstimated ? 'نحو ' : ''}${days} يوم`}</span>{order.ageIsEstimated && <small>تقديري</small>}</div>
        <button type="button" className="xt-show-stages" aria-expanded={showStages} aria-controls={`xt-stages-${order._id}`} onClick={() => setShowStages(v => !v)}>{showStages ? 'إخفاء المراحل' : 'عرض المراحل'}<ChevronDown size={14} aria-hidden="true" className={showStages ? 'is-open' : ''} /></button>
        </section>
        </div>
        {showStages && <ol id={`xt-stages-${order._id}`} className="xt-stage-track" aria-label="مراحل الطلبية">{steps.map((step, i) => <li key={step.value} className={i < currentStep || order.isFinished ? 'is-complete' : i === currentStep ? 'is-current' : ''} aria-current={!order.isFinished && i === currentStep ? 'step' : undefined}><span className="xt-step-dot" aria-hidden="true">{i < currentStep || order.isFinished ? <Check size={13} /> : i + 1}</span><span>{step.label}</span></li>)}</ol>}
        <div className="xt-order-meta"><span>تاريخ الإنشاء: <b dir="ltr">{date(order.createdAt)}</b></span>{order.shipment?.fromWhere && <span className="xt-route"><Truck size={14} aria-hidden="true" />{locationLabel(order.shipment.fromWhere)} ← {locationLabel(order.shipment.toWhere)}</span>}</div>
      </div>
      <aside className={`xt-financial xt-financial--${order.paymentState}`} aria-label="ملخص السداد">
        <div className="xt-financial-heading"><Wallet size={16} aria-hidden="true" /><span>ملخص السداد</span><span>USD</span></div>
        <dl className="xt-amounts">
          {order.isPayment && <div><dt>فاتورة الشراء</dt><dd dir="ltr">{order.unsureOrder ? 'غير مؤكدة' : dollars(order.purchaseCents)}</dd></div>}
          {!purchaseOnly && (order.isShipment || order.packageCount > 0) && <div><dt>الشحن والرسوم</dt><dd dir="ltr">{dollars(order.billedCents - order.purchaseCents)}</dd></div>}
          {kind === 'combined' && <div className="xt-total"><dt>الإجمالي</dt><dd dir="ltr">{dollars(order.billedCents)}</dd></div>}
        </dl>
        {order.paymentState !== 'unknown' && order.billedCents > 0 ? <>
          <div className="xt-payment-progress"><span>المسدّد <b>{paymentPercent}%</b></span><div role="progressbar" aria-label="نسبة سداد الطلبية" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paymentPercent}><span style={{ transform: `scaleX(${paymentPercent / 100})` }} /></div></div>
          <div className="xt-open"><span>{order.openCents < 0 ? 'رصيد زائد' : order.openCents === 0 ? 'المتبقي · تم السداد' : 'المبلغ المتبقي'}</span><strong dir="ltr">{dollars(Math.abs(order.openCents))}</strong></div>
        </> : <p className="xt-payment-hint">{order.paymentState === 'unknown' ? 'راجع سعر صرف الدفعات لتحديد المتبقي.' : 'سيظهر ملخص السداد عند تسجيل قيمة الطلبية.'}</p>}
      </aside>
    </div>
    {order.matchedTrackings?.length ? <div className="xt-search-match">Tracking مطابق للبحث: <b dir="ltr">{order.matchedTrackings.join(' · ')}</b></div> : null}
    {!purchaseOnly && (order.isShipment || order.packageCount > 0) && <details className="xt-packages" aria-label="الشحنات المرتبطة" open={packagesOpen}>
      <summary className="xt-package-heading"><h4><Package size={17} aria-hidden="true" /> الشحنات المرتبطة <b>{order.packageCount}</b></h4><span className="xt-package-toggle"><small>{expanded ? 'جميع الشحنات' : order.packageCount > 3 ? 'آخر 3 شحنات' : `${order.packageCount} شحنات`}</small><ChevronDown size={16} aria-hidden="true" /></span></summary>
      {!!order.packageCount && <div className="xt-parcel-columns" aria-hidden="true"><span>رقم التتبع</span><span>حالة الشحنة</span><span>الرحلة</span><span>الوزن</span><span>الشحن</span></div>}
      {!order.packageCount && <p className="xt-no-packages">لم تضاف شحنات لهذه الطلبية بعد.</p>}
      <ul className="xt-parcel-list">{visible.map(p => <li className={`xt-parcel ${search && p.trackingNumber?.toLowerCase().includes(search.toLowerCase()) ? 'xt-parcel--match' : ''}`} key={p._id}>
        <div><span className="xt-parcel-icon" aria-hidden="true"><Package size={15} /></span><div><small>Tracking</small><strong dir="ltr">{p.trackingNumber || 'لم يسجل رقم التتبع'}</strong></div></div>
        <span className={`xt-parcel-stage ${p.mark === 'missing' ? 'is-missing' : p.received ? 'is-delivered' : ''}`}><span aria-hidden="true" />{p.mark === 'missing' ? 'مفقودة' : p.received ? 'تم الاستلام' : p.arrivedLibya ? 'جاهزة للاستلام' : p.arrived ? 'بالمخزن الخارجي' : 'بانتظار الوصول'}</span>
        <span className={`xt-trip ${p.trip ? '' : 'xt-trip--empty'}`}>{p.trip?.method === 'sea' ? <Ship size={15} aria-hidden="true" /> : <Plane size={15} aria-hidden="true" />}{p.trip ? <Link to={`/inventory/${p.trip._id}/edit`}>{p.trip.name}<ArrowUpRight size={13} aria-hidden="true" /></Link> : 'غير مرتبطة برحلة'}</span>
        <span className="xt-weight"><small>الوزن</small><b dir="ltr">{p.weight?.total || 0} {p.weight?.measureUnit || '—'}</b></span><span className="xt-parcel-amount"><small>الشحن</small><b dir="ltr">{dollars(p.chargeCents)}</b></span>
      </li>)}</ul>
      {order.packageCount > 3 && <button className="xt-expand" type="button" onClick={expand} disabled={loading} aria-expanded={expanded}>{loading ? 'جاري جلب الشحنات…' : expanded ? 'إخفاء الشحنات الإضافية' : `عرض ${order.packageCount - 3} شحنات إضافية`}{expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button>}
    </details>}
    {order.hasProblem && <div className="xt-problem-note"><AlertCircle size={18} aria-hidden="true" /><div><strong>ملاحظة المتابعة</strong><p>{plainNote(order.orderNote) || 'هذه الطلبية مؤشرة بوجود مشكلة وتحتاج متابعة.'}</p></div></div>}
    {order.shippingBlocked && <div className="xt-problem-note"><Ban size={18} aria-hidden="true" /><div><strong>ممنوعة من الشحن</strong><p>{order.shippingBlockReason || 'يجب رفع المنع من داخل الطلبية قبل إضافتها إلى رحلة.'}</p></div></div>}
    {error && <div className="xt-inline-error" role="alert">{error}</div>}
    <div className="xt-order-footer"><span>{!purchaseOnly && <><Package size={15} aria-hidden="true" />{order.packageCount ? `${order.packageCount} شحنات مرتبطة` : 'لا توجد شحنات مرتبطة'}</>}</span><Link className="xt-open-order" to={`/invoice/${order._id}/edit`}>فتح الطلبية <ChevronLeft size={15} aria-hidden="true" /></Link></div>
  </article>;
}

const MemoizedOrderCard = memo(OrderCard);

export default function XTrackingDashboard() {
  const [search, setSearch] = useState('');
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criteria>(DEFAULT_CRITERIA);
  const { searchType, stage, sort, payment, query } = criteria;
  const searchPending = search.trim() !== query;
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result>({ orders: [], total: 0, counts: {} });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsError, setCountsError] = useState(false);
  const [paymentCounts, setPaymentCounts] = useState<Record<string, number>>({});
  const countsCache = useRef(new Map<string, CounterSnapshot>());
  const [counterSnapshot, setCounterSnapshot] = useState<CounterSnapshot | null>(null);
  const [counterRetry, setCounterRetry] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchValueRef = useRef(search);
  searchValueRef.current = search;
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingNext = useRef(false);
  const nextOffset = useRef(0);
  const generation = useRef(0);
  const nextController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const criteriaRef = useRef(criteria);
  const reloadRef = useRef(reload);
  const loadedContext = useRef<{ criteria: Criteria; reload: number } | null>(null);
  const invalidateRequests = useCallback(() => {
    // Invalidate at the click, before effect cleanup or a queued observer callback can run.
    generation.current += 1;
    listController.current?.abort(); nextController.current?.abort();
    loadedContext.current = null; loadingNext.current = false;
    setBusy(true); setMoreBusy(false); setHasMore(false); setError(''); setMoreError('');
  }, []);
  const commitCriteria = useCallback((next: Criteria) => {
    if (sameCriteria(criteriaRef.current, next)) return;
    // A fresh object also preserves a reset after several changes batched in one event.
    const committed = { ...next };
    criteriaRef.current = committed;
    invalidateRequests();
    setCriteria(committed);
  }, [invalidateRequests]);
  const updateSearch = (value: string) => { searchValueRef.current = value; setSearch(value); };
  const refreshData = () => {
    reloadRef.current += 1;
    invalidateRequests();
    setReload(reloadRef.current);
  };
  const retryCounts = () => {
    countsCache.current.delete(JSON.stringify([criteriaRef.current.query, criteriaRef.current.searchType]));
    setCounterRetry(value => value + 1);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = search.trim();
      if (searchValueRef.current.trim() !== value) return;
      const previous = criteriaRef.current;
      if (previous.query !== value) commitCriteria({ ...previous, query: value, stage: 'all', payment: 'all' });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, commitCriteria]);
  useEffect(() => {
    if (searchPending || !counterSnapshot || counterSnapshot.key !== JSON.stringify([query, searchType])) return;
    const currentCounts = payment === 'all' && counterSnapshot.counts && counterSnapshot.categoryAt >= counterSnapshot.matrixAt
      ? counterSnapshot.counts : counterSnapshot.countsByPayment?.[payment];
    const currentPayments = counterSnapshot.paymentCountsByStage?.[stage];
    if (currentCounts) setCounts(previous => sameCounts(previous, currentCounts) ? previous : currentCounts);
    if (currentPayments) setPaymentCounts(previous => sameCounts(previous, currentPayments) ? previous : currentPayments);
    const total = currentCounts?.[stage];
    if (!busy && loadedContext.current?.criteria === criteria && loadedContext.current.reload === reload && typeof total === 'number') {
      setResult(previous => previous.total === total ? previous : { ...previous, total });
    }
  }, [counterSnapshot, criteria, query, searchType, stage, payment, busy, reload, searchPending]);
  useEffect(() => {
    if (searchPending) return;
    const key = JSON.stringify([query, searchType]);
    let active = true;
    let controller: AbortController | null = null;
    const isCurrent = () => active && criteriaRef.current.query === query && criteriaRef.current.searchType === searchType && reloadRef.current === reload;
    const publish = (changes: Partial<CounterSnapshot>) => {
      if (!isCurrent()) return;
      const snapshot: CounterSnapshot = { key, categoryAt: 0, matrixAt: 0, reload: -1, ...countsCache.current.get(key), ...changes };
      countsCache.current.delete(key); countsCache.current.set(key, snapshot);
      if (countsCache.current.size > 30) countsCache.current.delete(countsCache.current.keys().next().value!);
      setCounterSnapshot(snapshot);
    };
    const cached = countsCache.current.get(key);
    if (cached) setCounterSnapshot(cached);
    setCountsError(false);
    const refresh = async (force = false) => {
      if (!isCurrent() || controller || document.visibilityState === 'hidden') return;
      const current = countsCache.current.get(key);
      if (!force && current?.reload === reload && Date.now() - current.matrixAt < COUNTS_REFRESH_MS) return;
      controller = new AbortController();
      const request = controller;
      try {
        if (force || !current?.counts || current.reload !== reload || Date.now() - current.categoryAt >= COUNTS_REFRESH_MS) {
          try {
            const { data } = await base.axios.get('orders/tracking', { params: { countsOnly: true, countsPart: 'categories', search: query, searchType }, signal: request.signal });
            if (isCurrent() && !request.signal.aborted && data.counts && typeof data.counts === 'object') publish({ counts: data.counts, categoryAt: Date.now() });
          } catch { /* Financial counters can still refresh if the lightweight request fails. */ }
        }
        if (!isCurrent() || request.signal.aborted) return;
        const { data } = await base.axios.get('orders/tracking', { params: { countsOnly: true, countsPart: 'matrix', search: query, searchType }, signal: request.signal });
        if (!isCurrent() || request.signal.aborted) return;
        if (!data.countsByPayment?.all || !data.paymentCountsByStage?.all) throw new Error('Invalid counter matrix');
        publish({ countsByPayment: data.countsByPayment, paymentCountsByStage: data.paymentCountsByStage, matrixAt: Date.now(), reload });
        setCountsError(false);
      } catch { if (isCurrent() && !request.signal.aborted) setCountsError(true); }
      finally { if (controller === request) controller = null; }
    };
    const timer = setTimeout(() => void refresh(), 50);
    const interval = setInterval(() => void refresh(true), COUNTS_REFRESH_MS);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false; clearTimeout(timer); clearInterval(interval); controller?.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [query, searchType, reload, searchPending, counterRetry]);
  useEffect(() => {
    const controller = new AbortController();
    listController.current = controller;
    const sequence = ++generation.current;
    loadedContext.current = null;
    const isCurrent = () => !controller.signal.aborted && generation.current === sequence && criteriaRef.current === criteria && reloadRef.current === reload;
    nextController.current?.abort(); loadingNext.current = false; nextOffset.current = 0;
    setBusy(true); setError(''); setMoreError(''); setMoreBusy(false); setHasMore(false);
    setResult({ orders: [], total: 0, counts: {} });
    const timer = setTimeout(() => {
      if (!isCurrent()) return;
      base.axios.get('orders/tracking', { params: { ...criteria, search: criteria.query, skip: 0, limit: PAGE_SIZE, quick: true }, signal: controller.signal })
      .then(({ data }) => { if (isCurrent()) {
        loadedContext.current = { criteria, reload };
        setResult(data); setBusy(false); setUpdatedAt(new Date());
        nextOffset.current = data.orders.length;
        setHasMore(data.hasMore ?? (data.orders.length > 0 && data.orders.length < data.total));
      } })
      .catch(err => { if (isCurrent()) { setError(err.response?.data?.message || 'تعذر جلب الطلبيات. أعد المحاولة.'); setBusy(false); } });
    }, criteria === DEFAULT_CRITERIA && reload === 0 ? 0 : 100);
    return () => { clearTimeout(timer); controller.abort(); nextController.current?.abort(); };
  }, [criteria, reload]);
  const loadMore = useCallback(async (retry = false) => {
    if (busy || loadingNext.current || !hasMore || (moreError && !retry) || searchValueRef.current.trim() !== criteria.query ||
      criteriaRef.current !== criteria || reloadRef.current !== reload || loadedContext.current?.criteria !== criteria || loadedContext.current.reload !== reload) return;
    loadingNext.current = true;
    const sequence = generation.current;
    const offset = nextOffset.current;
    const controller = new AbortController(); nextController.current = controller;
    setMoreBusy(true); setMoreError('');
    try {
      const { data } = await base.axios.get('orders/tracking', { params: { ...criteria, search: criteria.query, skip: offset, limit: PAGE_SIZE, quick: true }, signal: controller.signal });
      if (controller.signal.aborted || sequence !== generation.current || criteriaRef.current !== criteria || reloadRef.current !== reload || searchValueRef.current.trim() !== criteria.query) return;
      setResult(previous => ({ ...data, total: data.total ?? previous.total, orders: Array.from(new Map([...previous.orders, ...data.orders].map((order: Order) => [order._id, order])).values()) }));
      nextOffset.current = offset + data.orders.length;
      setHasMore(data.hasMore ?? (data.orders.length > 0 && nextOffset.current < data.total));
    } catch { if (!controller.signal.aborted && sequence === generation.current) setMoreError('تعذر تحميل الطلبيات التالية. الطلبيات الحالية محفوظة في القائمة.'); }
    finally { if (!controller.signal.aborted && sequence === generation.current) { loadingNext.current = false; setMoreBusy(false); } }
  }, [busy, hasMore, moreError, criteria, reload]);
  useEffect(() => {
    if (busy || searchPending || moreBusy || moreError || !hasMore || !sentinel.current || typeof IntersectionObserver === 'undefined') return;
    let active = true;
    const observer = new IntersectionObserver(entries => { if (active && entries.some(entry => entry.isIntersecting)) void loadMore(); }, { rootMargin: '450px 0px' });
    observer.observe(sentinel.current);
    return () => { active = false; observer.disconnect(); };
  }, [busy, searchPending, moreBusy, moreError, hasMore, loadMore, result.orders.length]);
  const change = (key: 'searchType' | 'stage' | 'sort' | 'payment', value: string) => {
    const previous = criteriaRef.current;
    const nextQuery = searchValueRef.current.trim();
    const newSearch = previous.query !== nextQuery || (key === 'searchType' && previous.searchType !== value);
    commitCriteria({ ...previous, ...(newSearch ? { stage: 'all', payment: 'all' } : {}), [key]: value, query: nextQuery });
  };
  const selectStage = (value: string) => change('stage', value);
  const resetFilters = () => { updateSearch(''); commitCriteria(DEFAULT_CRITERIA); };
  return <main className="xt-page" dir="rtl">
    <header className="xt-header"><div><h1>X-Tracking</h1><p>متابعة طلبيات الشراء والشحن</p></div><div className="xt-header-actions"><button className="xt-refresh" onClick={refreshData} disabled={busy || searchPending}><RefreshCw size={17} aria-hidden="true" className={busy ? 'xt-spin' : ''} />{busy ? 'جاري التحديث' : 'تحديث البيانات'}</button><span>{updatedAt ? `آخر جلب ${updatedAt.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}` : 'جاري جلب البيانات'}</span></div></header>
    <section className="xt-summary" aria-label={query ? 'ملخص نتائج البحث' : 'ملخص الطلبيات'}>{SUMMARY.map(item => <button key={item.key} className={`xt-summary-card xt-summary-card--${item.key} ${stage === item.key ? 'is-selected' : ''}`} type="button" aria-pressed={stage === item.key} onClick={() => selectStage(item.key)}><span className="xt-summary-icon"><item.icon size={22} aria-hidden="true" /></span><span className="xt-summary-label">{item.key === 'all' && query ? 'كل الطلبيات' : item.label}</span><strong>{counts[item.key]?.toLocaleString() ?? '—'}</strong><span className="xt-summary-hint">{query ? 'ضمن نتائج البحث الحالية' : item.hint}</span><ChevronLeft className="xt-summary-arrow" size={17} aria-hidden="true" /></button>)}</section>
    <section className="xt-toolbar" aria-label="البحث وتصفية الطلبيات">
      <div className="xt-search-controls"><CompactSelect id="xt-search-type" label="البحث بواسطة" value={searchType} options={[['orderId', 'Exios Id'], ['trackingNumber', 'Tracking Number']]} onChange={value => change('searchType', value)} /><div className="xt-search-field"><label htmlFor="xt-search-value">{searchType === 'orderId' ? 'رقم الطلبية أو اسم العميل أو كوده' : 'رقم تتبع الشحنة'}</label><div className={`xt-search ${searchPending ? 'is-searching' : ''}`}><Search size={17} aria-hidden="true" /><input id="xt-search-value" ref={input} value={search} onChange={e => updateSearch(e.target.value)} placeholder={searchType === 'orderId' ? 'رقم الطلبية، الاسم، أو كود العميل…' : 'رقم التتبع فقط…'} autoComplete="off" dir="auto" maxLength={120} aria-describedby="xt-search-hint" />{(searchPending || (busy && !!query)) && <RefreshCw size={14} className="xt-spin" aria-hidden="true" />}{search && <button type="button" onClick={() => { updateSearch(''); input.current?.focus(); }} aria-label="مسح البحث"><X size={16} aria-hidden="true" /></button>}</div></div><CompactSelect id="xt-sort" label="ترتيب النتائج" value={sort} options={[['recent', 'الأحدث أولًا'], ['waiting', 'الأطول انتظارًا']]} onChange={value => change('sort', value)} /></div>
      <p id="xt-search-hint" className="xt-search-hint">{searchType === 'orderId' ? 'Exios Id: ابحث برقم الطلبية أو اسم العميل أو كود العميل.' : 'Tracking Number: يبحث في أرقام تتبع الشحنات فقط.'}</p>
      <label className="xt-packages-preference"><input type="checkbox" checked={packagesOpen} onChange={event => setPackagesOpen(event.target.checked)} /><span>فتح الشحنات المرتبطة</span></label>
      <div className="xt-filters" role="group" aria-label="فئات الطلبيات"><span className="xt-filter-label">الطلبيات</span>{FILTERS.map(([key, label]) => <button type="button" key={key} aria-pressed={stage === key} className={[stage === key ? 'is-active' : '', key === 'finished' ? 'xt-filter-finished' : ''].filter(Boolean).join(' ')} onClick={() => selectStage(key)}>{key === 'blocked' ? <Ban size={15} aria-hidden="true" /> : key === 'finished' ? <CheckCircle2 size={15} aria-hidden="true" /> : key === 'purchase' ? <ShoppingBag size={15} aria-hidden="true" /> : key === 'shipping' ? <Truck size={15} aria-hidden="true" /> : key === 'combined' ? <Package size={15} aria-hidden="true" /> : null}{key === 'all' && query ? 'كل الطلبيات' : label}<span>{counts[key]?.toLocaleString() ?? '—'}</span></button>)}</div>
      <div className="xt-payment-filters" role="group" aria-label="حالة السداد"><span><Wallet size={14} aria-hidden="true" />حالة السداد</span><div>{PAYMENT_OPTIONS.map(([key, label]) => <button key={key} type="button" aria-pressed={payment === key} className={payment === key ? 'is-active' : ''} onClick={() => change('payment', key)}>{label}<span>{paymentCounts[key]?.toLocaleString() ?? '—'}</span></button>)}</div></div>
      {countsError && <p className="xt-count-error" role="status">تعذر تحديث بعض العدادات. <button type="button" onClick={retryCounts}>إعادة المحاولة</button></p>}
    </section>
    <div className="xt-list-heading"><div><h2>{FILTERS.find(([key]) => key === stage)?.[1]}</h2><span className="xt-result-count" role="status" aria-atomic="true">{busy || searchPending ? 'جاري جلب الطلبيات…' : result.total === null ? `${result.orders.length.toLocaleString()} طلبيات محمّلة` : `${result.orders.length.toLocaleString()} من ${result.total.toLocaleString()} طلبية`}</span>{payment !== 'all' && <span className="xt-selected-payment">{PAYMENT_OPTIONS.find(([key]) => key === payment)?.[1]}</span>}</div>{(search || stage !== 'all' || sort !== 'recent' || payment !== 'all') && <button className="xt-reset" type="button" onClick={resetFilters}><X size={15} aria-hidden="true" />مسح الفلاتر</button>}</div>
    {query && <p className="xt-query-caption">نتائج البحث عن <b dir="ltr">{query}</b> · يشمل البحث الطلبيات النشطة والمكتملة</p>}
    {searchPending || busy ? <div className="xt-skeletons" aria-label="جاري تحميل الطلبيات" aria-busy="true">{[1, 2, 3].map(n => <div key={n} className="xt-skeleton"><span /><span /><span /></div>)}</div> : error ? <div className="xt-empty" role="alert"><span className="xt-empty-icon"><AlertCircle size={30} aria-hidden="true" /></span><h3>تعذر تحميل الطلبيات</h3><p>{error}</p><button type="button" onClick={refreshData}>إعادة المحاولة</button></div> : result.orders.length ? <div className="xt-order-list">{result.orders.map(order => <MemoizedOrderCard key={`${order._id}:${reload}`} order={order} search={searchType === 'trackingNumber' ? query : ''} packagesOpen={packagesOpen} />)}</div> : <div className="xt-empty"><span className="xt-empty-icon"><Search size={30} aria-hidden="true" /></span><h3>لا توجد طلبيات هنا</h3><p>جرّب رقمًا آخر أو اعرض الطلبيات النشطة.</p><button type="button" onClick={resetFilters}>عرض الطلبيات النشطة</button></div>}
    {!busy && !searchPending && !error && result.orders.length > 0 && <div ref={sentinel} className="xt-load-next" aria-busy={moreBusy}>{moreError ? <><p role="alert">{moreError}</p><button type="button" onClick={() => void loadMore(true)}>إعادة المحاولة</button></> : moreBusy ? <span><RefreshCw size={16} aria-hidden="true" className="xt-spin" />جاري تحميل الطلبيات التالية…</span> : hasMore ? <button type="button" onClick={() => void loadMore()}>تحميل المزيد<ChevronDown size={16} aria-hidden="true" /></button> : <span>نهاية النتائج الحالية · {result.orders.length.toLocaleString()} طلبية</span>}</div>}
  </main>;
}
