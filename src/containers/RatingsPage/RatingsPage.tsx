import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpLeft, ChevronDown, ChevronLeft, ChevronRight, MessageSquare, RefreshCw, Search, Star, X } from 'lucide-react';
import { Rating } from '@mui/material';
import moment from 'moment';
import api from '../../api';
import './RatingsPage.scss';

type Question = { _id?: string; name?: string; label: string; type: string; value: unknown };
type Review = {
  _id: string; createdAt?: string; questions?: Question[];
  order?: { _id: string; orderId?: string; customerInfo?: { fullName?: string } } | null;
  user?: { _id?: string; firstName?: string; lastName?: string; customerId?: string } | null;
};
const PAGE_SIZE = 20;
function score(review: Review): number | null {
  const values = (review.questions || []).filter(q => q.type === 'rating' && q.value !== '' && q.value != null)
    .map(q => Number(q.value)).filter(n => Number.isFinite(n) && n >= 0 && n <= 5);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
const customerName = (r: Review) => r.order?.customerInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || 'عميل غير متاح';
function answer(value: unknown): string {
  if (Array.isArray(value)) return value.map(answer).join('، ');
  if (value == null || value === '') return 'لم تُضف إجابة';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
const dateValue = (value?: string) => value && moment(value).isValid() ? moment(value).valueOf() : 0;

export default function RatingsPage() {
  const [ratings, setRatings] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    api.get('orders/rating', { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(response.data)) throw new Error('Invalid ratings response');
      setRatings(response.data.filter((r: Review | null) => r && r._id)); setLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const prepared = useMemo(() => ratings.map(review => ({ review, value: score(review), time: dateValue(review.createdAt) })), [ratings]);
  const summary = useMemo(() => {
    const scored = prepared.filter(r => r.value !== null);
    const distribution = [5, 4, 3, 2, 1, 0].map(star => ({ star, count: scored.filter(r => Math.round(r.value!) === star).length }));
    return { scored: scored.length, average: scored.length ? scored.reduce((sum, r) => sum + r.value!, 0) / scored.length : null, distribution };
  }, [prepared]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return prepared.filter(({ review: r, value, time }) => {
      if (search && ![customerName(r), r.order?.orderId, r.user?.customerId, ...(r.questions || []).map(q => answer(q.value))].join(' ').toLocaleLowerCase().includes(search)) return false;
      if (filter === 'unscored' ? value !== null : filter !== 'all' && (value === null || Math.round(value) !== Number(filter))) return false;
      if (from && (!time || time < moment(from).startOf('day').valueOf())) return false;
      if (to && (!time || time > moment(to).endOf('day').valueOf())) return false;
      return true;
    }).sort((a, b) => sort === 'oldest' ? a.time - b.time : sort === 'highest' ? (b.value ?? -1) - (a.value ?? -1) || b.time - a.time : sort === 'lowest' ? (a.value ?? 6) - (b.value ?? 6) || b.time - a.time : b.time - a.time);
  }, [prepared, query, filter, sort, from, to]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const hasFilters = !!(query || filter !== 'all' || from || to);
  const badRange = !!(from && to && from > to);
  const reset = () => { setQuery(''); setFilter('all'); setFrom(''); setTo(''); setPage(1); };

  return <main className="ratings-page" dir="rtl">
    <header className="ratings-header">
      <div><h1>تقييمات العملاء</h1><p>آراء العملاء حول تجربتهم مع Exios، وتفاصيل كل طلبية.</p></div>
      <button className="ratings-button" aria-label="تحديث التقييمات" disabled={loading} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} />{loading && loaded ? 'جارٍ التحديث…' : 'تحديث التقييمات'}</button>
    </header>
    {error && <div className="ratings-error" role="alert"><AlertCircle size={18} /><span>{loaded ? 'تعذر تحديث التقييمات. البيانات السابقة ما زالت معروضة.' : 'تعذر تحميل التقييمات. حاول مرة أخرى.'}</span><button onClick={() => setRefresh(n => n + 1)} disabled={loading}>إعادة المحاولة</button></div>}
    {loading && !loaded ? <div className="ratings-loading" role="status"><span>جارٍ تحميل التقييمات…</span>{[1, 2, 3].map(n => <div className="ratings-skeleton" key={n} />)}</div> : loaded && <>
      <div className="ratings-layout">
        <aside className="ratings-overview" aria-label="ملخص جميع التقييمات">
          <h2>نظرة على التقييمات</h2>
          <div className="ratings-average"><strong>{summary.average === null ? '—' : summary.average.toFixed(1)}</strong><div><Rating value={summary.average || 0} precision={0.1} readOnly size="small" getLabelText={v => `${v} من 5`} /><span>من 5 · {summary.scored} تقييم رقمي</span></div></div>
          <p className="ratings-explainer">متوسط درجات الأسئلة الرقمية في كل استجابة.</p>
          <details className="ratings-breakdown"><summary>توزيع الدرجات<ChevronDown size={15} /></summary><div className="ratings-distribution">{summary.distribution.map(({ star, count }) => <button key={star} aria-pressed={filter === String(star)} onClick={() => { setFilter(filter === String(star) ? 'all' : String(star)); setPage(1); }}><span>{star}<Star size={13} /></span><span className="ratings-bar"><span style={{ width: `${summary.scored ? count / summary.scored * 100 : 0}%` }} /></span><b>{count}</b></button>)}</div>
          <p className="ratings-distribution-note">التوزيع حسب متوسط الاستجابة مقربًا لأقرب نجمة.</p></details>
          <dl className="ratings-totals"><div><dt>إجمالي الاستجابات</dt><dd>{ratings.length}</dd></div><div><dt>بدون درجة رقمية</dt><dd>{ratings.length - summary.scored}</dd></div></dl>
          <span className="ratings-scope">الملخص لجميع التقييمات، ولا يتغير بالفلاتر.</span>
        </aside>
        <section className="ratings-content" aria-label="قائمة التقييمات" aria-busy={loading}>
          <div className="ratings-toolbar">
            <label className="ratings-search"><Search size={17} /><span className="ratings-sr">بحث بالعميل أو رقم الطلبية أو نص التقييم</span><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="ابحث بالعميل، رقم الطلبية، أو نص التقييم…" type="search" /></label>
            <div className="ratings-filter-row">
              <label>الدرجة<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">جميع الدرجات</option>{[5, 4, 3, 2, 1, 0].map(n => <option key={n} value={n}>{n} من 5</option>)}<option value="unscored">بدون درجة رقمية</option></select></label>
              <label>من تاريخ<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label>
              <label>إلى تاريخ<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(1); }} /></label>
              <label>الترتيب<select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="recent">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="highest">الأعلى تقييمًا</option><option value="lowest">الأقل تقييمًا</option></select></label>
            </div>
          </div>
          {badRange && <p role="alert" className="ratings-range-error">تاريخ البداية يجب أن يسبق تاريخ النهاية.</p>}
          <div className="ratings-results"><h2>آراء العملاء <span>{filtered.length}</span></h2>{hasFilters && <button onClick={reset}><X size={14} />مسح الفلاتر</button>}</div>
          {!filtered.length ? <div className="ratings-empty"><MessageSquare size={30} /><h3>{ratings.length ? 'لا توجد تقييمات تطابق البحث' : 'لم تصل تقييمات بعد'}</h3><p>{ratings.length ? 'جرّب تغيير كلمات البحث أو الدرجة أو نطاق التاريخ.' : 'ستظهر هنا استجابات العملاء عند إرسال تقييماتهم.'}</p>{hasFilters && <button className="ratings-button" onClick={reset}>عرض جميع التقييمات</button>}</div> : <div className="ratings-list">
            {filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(({ review: r, value }) => {
              const comment = (r.questions || []).find(q => q.type === 'text' && typeof q.value === 'string' && q.value.trim());
              const initials = customerName(r).split(/\s+/).slice(0, 2).map(n => n[0]).join('');
              return <article className="ratings-review" key={r._id}>
                <div className="ratings-review-head"><span className="ratings-avatar" aria-hidden="true">{initials}</span><div className="ratings-identity"><h3><bdi>{customerName(r)}</bdi></h3><div>{r.order?._id ? <a href={`/invoice/${r.order._id}/edit`} target="_blank" rel="noopener noreferrer">طلبية <bdi>{r.order.orderId || 'عرض الطلبية'}</bdi><ArrowUpLeft size={13} /><span className="ratings-sr">تفتح في تبويب جديد</span></a> : <span>الطلبية غير متاحة</span>}{r.user?.customerId && <bdi className="ratings-code">{r.user.customerId}</bdi>}</div></div><div className="ratings-review-score">{value !== null ? <><span className={`ratings-score ${value < 3 ? 'is-low' : ''}`}><Star size={14} fill="currentColor" />{value.toFixed(1)}<small>/ 5</small></span><span className="ratings-sr">متوسط درجات الاستجابة</span></> : <span>بدون درجة رقمية</span>}<time dateTime={dateValue(r.createdAt) ? r.createdAt : undefined}>{dateValue(r.createdAt) ? moment(r.createdAt).format('DD/MM/YYYY') : 'التاريخ غير متاح'}</time></div></div>
                {comment && <p className="ratings-comment" dir="auto">{answer(comment.value)}</p>}
                <details className="ratings-details"><summary>تفاصيل الاستجابة <span>{r.questions?.length || 0} أسئلة<ChevronDown size={15} /></span></summary><dl>{(r.questions || []).map((q, i) => <div key={q._id || `${q.name}-${i}`}><dt dir="auto">{q.label}</dt><dd>{q.type === 'rating' && q.value !== '' && q.value != null && Number.isFinite(Number(q.value)) && Number(q.value) >= 0 && Number(q.value) <= 5 ? <span className="ratings-answer-score"><Rating value={Number(q.value)} precision={0.5} readOnly size="small" getLabelText={v => `${v} من 5`} /><bdi>{Number(q.value)} / 5</bdi></span> : <span dir="auto">{answer(q.value)}</span>}</dd></div>)}</dl>{!r.questions?.length && <p>لا توجد إجابات مسجلة لهذه الاستجابة.</p>}</details>
              </article>;
            })}
          </div>}
          {!!filtered.length && <nav className="ratings-pagination" aria-label="صفحات التقييمات"><span>عرض {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} من {filtered.length}</span><div><button aria-label="الصفحة السابقة" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronRight size={18} /></button><span>{currentPage} / {pages}</span><button aria-label="الصفحة التالية" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronLeft size={18} /></button></div></nav>}
        </section>
      </div>
    </>}
  </main>;
}
