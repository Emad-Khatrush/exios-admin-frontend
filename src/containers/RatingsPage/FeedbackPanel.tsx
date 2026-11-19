import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowUpLeft, ChevronLeft, ChevronRight, ImagePlus, Inbox, Lightbulb, MessageSquareWarning, RefreshCw, Search, Send, StickyNote, Trash2, X } from 'lucide-react';
import moment from 'moment';
import api from '../../api';
import './FeedbackPanel.scss';

type Kind = 'complaint' | 'suggestion';
type Status = 'new' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high';
type Img = { url: string; name?: string };
type Person = { _id?: string; firstName?: string; lastName?: string; customerId?: string; phone?: string | number } | null;
export type Feedback = {
  _id: string;
  number: number;
  kind: Kind;
  topic: string;
  subject: string;
  message: string;
  images?: Img[];
  messages?: { _id: string; from: 'customer' | 'staff'; text: string; images?: Img[]; by?: Person; at: string }[];
  unreadByStaff?: boolean;
  lastMessageAt?: string;
  orderRef?: string;
  order?: { _id: string; orderId?: string } | null;
  // Every order a complaint is about (order is the first)
  orders?: { _id: string; orderId?: string }[];
  status: Status;
  priority: Priority;
  resolvedAt?: string | null;
  unreadByCustomer?: boolean;
  user?: Person;
  notes?: { _id?: string; text: string; by?: Person; at: string }[];
  history?: { _id?: string; action: string; value?: string; by?: Person; at: string }[];
  createdAt: string;
};

export const STATUS: Record<Status, string> = { new: 'جديد', in_progress: 'قيد المعالجة', resolved: 'تم الحل', closed: 'مغلق' };
const STATUS_ORDER: Status[] = ['new', 'in_progress', 'resolved', 'closed'];
const PRIORITY: Record<Priority, string> = { high: 'عالية', normal: 'عادية', low: 'منخفضة' };
const TOPIC: Record<string, string> = {
  delay: 'تأخير الشحنة', damage: 'تلف أو نقص', shipping: 'الشحن والاستلام', payment: 'الدفع والحوالات',
  pricing: 'الأسعار', staff: 'الموظفين / خدمة العملاء', app: 'التطبيق', other: 'أخرى',
};
const KIND: Record<Kind, string> = { complaint: 'شكوى', suggestion: 'اقتراح' };

const nameOf = (p?: Person) => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || '—';
const when = (v?: string | null) => (v ? moment(v).format('DD/MM/YYYY HH:mm') : '');
const age = (v: string) => {
  const h = moment().diff(moment(v), 'hours');
  if (h < 1) return 'الآن';
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'أمس' : `منذ ${d} يوم`;
};
const waLink = (phone?: string | number) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits.startsWith('218') ? digits : `218${digits.replace(/^0/, '')}`}`;
};
const historyText = (h: { action: string; value?: string }) => {
  if (h.action === 'created') return 'أرسل العميل الطلب';
  if (h.action === 'status') return `غيّر الحالة إلى «${STATUS[h.value as Status] || h.value}»`;
  if (h.action === 'priority') return `غيّر الأولوية إلى «${PRIORITY[h.value as Priority] || h.value}»`;
  if (h.action === 'message') return h.value === 'customer' ? 'ردّ العميل' : 'أرسل رداً للعميل';
  if (h.action === 'assign') return 'غيّر المسؤول';
  return h.action;
};

const MAX_IMAGES = 5;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/* Pictures opened full size over the whole screen. Rendered on <body>: a page container with a
   transform or overflow would otherwise trap a fixed overlay inside it, under the header. */
const Lightbox = ({ urls, start, onClose }: { urls: string[], start: number, onClose: () => void }) => {
  const [index, setIndex] = useState(start);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const url = urls[index];
  const many = urls.length > 1;
  // In Arabic the next picture is to the left
  const go = (step: number) => { if (many) { setIndex((i) => (i + step + urls.length) % urls.length); setState('loading'); } };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(1);
      if (e.key === 'ArrowRight') go(-1);
    };
    window.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.length]);

  return createPortal(
    <div className="fb-lb" role="dialog" aria-modal="true" aria-label="عرض الصورة" dir="rtl" onClick={onClose}>
      <div className="fb-lb__bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="fb-lb__btn" aria-label="إغلاق" onClick={onClose}><X size={20} /></button>
        {many && <span className="fb-lb__count">{index + 1} من {urls.length}</span>}
        <a className="fb-lb__open" href={url} target="_blank" rel="noopener noreferrer">فتح في تبويب جديد</a>
      </div>
      <div className="fb-lb__stage">
        {state === 'loading' && <span className="fb-lb__spinner" aria-label="جارٍ تحميل الصورة" />}
        {state === 'error' ? (
          <div className="fb-lb__error" onClick={(e) => e.stopPropagation()}>
            <p>تعذر تحميل الصورة.</p>
            <button type="button" onClick={() => setState('loading')}>إعادة المحاولة</button>
          </div>
        ) : (
          <img
            key={`${url}-${state === 'loading' ? 'try' : 'ok'}`}
            src={url}
            alt={`الصورة ${index + 1}`}
            className={state === 'ready' ? 'is-ready' : ''}
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
      {many && (
        <>
          <button type="button" className="fb-lb__nav fb-lb__nav--prev" aria-label="الصورة السابقة" onClick={(e) => { e.stopPropagation(); go(-1); }}><ChevronRight size={26} /></button>
          <button type="button" className="fb-lb__nav fb-lb__nav--next" aria-label="الصورة التالية" onClick={(e) => { e.stopPropagation(); go(1); }}><ChevronLeft size={26} /></button>
        </>
      )}
    </div>,
    document.body,
  );
};

/* A thumbnail that shows a quiet placeholder while loading and a clear tile if the picture fails */
const Thumb = ({ url, label, onOpen }: { url: string, label: string, onOpen: () => void }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <button type="button" className={`fb-thumb is-${state}`} onClick={onOpen} aria-label={label}>
      {state !== 'error'
        ? <img src={url} alt={label} loading="lazy" onLoad={() => setState('ready')} onError={() => setState('error')} />
        : <span>تعذر عرض الصورة</span>}
    </button>
  );
};

/* The whole conversation, oldest first: what the customer wrote and what the office answered */
function Thread({ item }: { item: Feedback }) {
  const [zoom, setZoom] = useState<{ urls: string[], at: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const all = [
    { _id: 'first', from: 'customer' as const, text: item.message, images: item.images || [], at: item.createdAt, by: item.user },
    ...(item.messages || []),
  ];
  // Opens at the latest message, scrolling only the conversation box, never the page
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [all.length, item._id]);
  return (
    <div className="fb-thread" ref={box}>
      {all.map((m) => (
        <div key={m._id} className={`fb-msg fb-msg--${m.from}`}>
          <p className="fb-msg__who">
            {m.from === 'customer' ? <>العميل <bdi>{nameOf(item.user)}</bdi></> : <>المكتب · <bdi>{nameOf(m.by)}</bdi></>}
            <span>{when(m.at)}</span>
          </p>
          {m.text && <p className="fb-msg__text" dir="auto">{m.text}</p>}
          {!!m.images?.length && (
            <div className="fb-msg__images">
              {m.images.map((img, i) => (
                <Thumb key={img.url} url={img.url} label={`فتح الصورة ${i + 1}`} onOpen={() => setZoom({ urls: (m.images || []).map((x) => x.url), at: i })} />
              ))}
            </div>
          )}
        </div>
      ))}
      {zoom && <Lightbox urls={zoom.urls} start={zoom.at} onClose={() => setZoom(null)} />}
    </div>
  );
}

/* Answering the customer: text, screenshots, or both */
function Composer({ item, onSaved }: { item: Feedback; onSaved: (f: Feedback) => void }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => { setText(''); setFiles([]); setError(''); }, [item._id]);

  const add = (list: FileList | null) => {
    const picked = Array.from(list || []);
    const ok = picked.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= 8 * 1024 * 1024);
    setError(ok.length < picked.length ? 'صور فقط (PNG أو JPG أو WEBP)، حتى 8 ميغابايت للصورة' : files.length + ok.length > MAX_IMAGES ? `${MAX_IMAGES} صور كحد أقصى` : '');
    setFiles([...files, ...ok].slice(0, MAX_IMAGES));
    if (input.current) input.current.value = '';
  };
  const send = async () => {
    if (!text.trim() && !files.length) { setError('اكتب رداً أو أرفق صورة'); return; }
    setBusy(true); setError('');
    const form = new FormData();
    form.append('text', text);
    files.forEach((f) => form.append('images', f));
    const res: any = await api.fetchFormData(`feedback/${item._id}/messages`, 'POST', form);
    setBusy(false);
    if (!res || res.success === false || !res._id) { setError(res?.message && /[\u0600-\u06FF]/.test(res.message) ? res.message : 'تعذر إرسال الرد. حاول مرة أخرى.'); return; }
    onSaved(res);
    setText(''); setFiles([]);
  };

  return (
    <section className="fb-block fb-composer">
      <h3><Send size={15} /> الرد على العميل <span className="fb-muted">يظهر للعميل في صفحة الشكاوى، ويستطيع الرد عليه</span></h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" placeholder="اكتب رداً واضحاً: ماذا حدث وما الذي سنفعله." />
      {!!files.length && (
        <ul className="fb-previews">
          {files.map((_, i) => <li key={previews[i]}><img src={previews[i]} alt={`صورة ${i + 1}`} /><button type="button" aria-label="إزالة" onClick={() => setFiles(files.filter((__, j) => j !== i))}><X size={12} /></button></li>)}
        </ul>
      )}
      <div className="fb-block__foot">
        {files.length < MAX_IMAGES && <button type="button" className="fb-btn fb-btn--ghost" onClick={() => input.current?.click()}><ImagePlus size={15} /> إرفاق صور</button>}
        <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => add(e.target.files)} />
        <span className="fb-muted">{item.unreadByCustomer ? 'آخر رد لم يقرأه العميل بعد' : ''}</span>
        <button type="button" className="fb-btn" disabled={busy} onClick={send}>{busy ? 'جارٍ الإرسال…' : 'إرسال الرد'}</button>
      </div>
      {error && <p className="fb-error" role="alert"><AlertCircle size={15} />{error}</p>}
    </section>
  );
}

function Detail({ item, onSaved, onDeleted }: { item: Feedback; onSaved: (f: Feedback) => void; onDeleted: (id: string) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { setNote(''); setError(''); }, [item._id]);
  // Opening a complaint the customer wrote into marks it read for the office
  useEffect(() => {
    if (item.kind !== 'complaint' || !item.unreadByStaff) return;
    api.update(`feedback/${item._id}`, { seen: true }).then((res: any) => res?.data?._id && onSaved(res.data)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item._id]);

  const save = async (body: Record<string, unknown>, what: string) => {
    setBusy(what); setError('');
    try {
      const res = await api.update(`feedback/${item._id}`, body);
      onSaved(res.data);
      if (what === 'note') setNote('');
    } catch {
      setError('تعذر الحفظ. حاول مرة أخرى.');
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    if (!window.confirm(`حذف الطلب #${item.number} نهائياً؟`)) return;
    setBusy('delete');
    try { await api.delete(`feedback/${item._id}`, {}); onDeleted(item._id); } catch { setError('تعذر الحذف.'); setBusy(''); }
  };

  const wa = waLink(item.user?.phone);

  return (
    <article className="fb-detail" aria-label={`الطلب ${item.number}`}>
      <header className="fb-detail__head">
        <div>
          <p className="fb-detail__eyebrow">
            <span className={`fb-kind fb-kind--${item.kind}`}>{KIND[item.kind]}</span>
            <bdi dir="ltr">#{item.number}</bdi>
            <span>{TOPIC[item.topic] || 'أخرى'}</span>
          </p>
          <h2 dir="auto">{item.subject}</h2>
          <p className="fb-detail__time">{when(item.createdAt)} · {age(item.createdAt)}</p>
        </div>
        <button type="button" className="fb-icon-btn is-danger" onClick={remove} disabled={!!busy} aria-label="حذف الطلب" title="حذف الطلب"><Trash2 size={17} /></button>
      </header>

      <dl className="fb-detail__customer">
        <div><dt>العميل</dt><dd><bdi>{nameOf(item.user)}</bdi>{item.user?.customerId && <bdi className="fb-code">{item.user.customerId}</bdi>}</dd></div>
        {item.user?.phone && <div><dt>الهاتف</dt><dd><bdi dir="ltr">{item.user.phone}</bdi>{wa && <a href={wa} target="_blank" rel="noopener noreferrer">واتساب<ArrowUpLeft size={13} /></a>}</dd></div>}
        {(item.order || item.orderRef) && <div><dt>{(item.orders?.length || 0) > 1 ? `الطلبيات (${item.orders!.length})` : 'الطلبية'}</dt><dd>{
          (item.orders?.length ? item.orders : item.order?._id ? [item.order] : []).length
            ? (item.orders?.length ? item.orders : [item.order!]).map((o) => (
              <a key={o._id} href={`/invoice/${o._id}/edit`} target="_blank" rel="noopener noreferrer" style={{ marginInlineEnd: 12, display: "inline-flex" }}><bdi>{o.orderId || item.orderRef}</bdi><ArrowUpLeft size={13} /></a>
            ))
            : <><bdi dir="ltr">{item.orderRef}</bdi><span className="fb-muted">غير موجودة في طلبيات العميل</span></>}</dd></div>}
      </dl>

      {item.kind === 'suggestion' ? (
        /* A suggestion is only received: the team marks it read, nothing goes back to the customer */
        <>
        <p className="fb-detail__message" dir="auto">{item.message}</p>
        <div className="fb-controls">
          <span className="fb-muted">{item.status === 'new' ? 'اقتراح جديد لم يُقرأ بعد' : `قُرئ ${when(item.resolvedAt)}`}</span>
          <button type="button" className={item.status === 'new' ? 'fb-btn' : 'fb-btn fb-btn--ghost'} disabled={!!busy} onClick={() => save({ status: item.status === 'new' ? 'resolved' : 'new' }, 'status')}>
            {item.status === 'new' ? 'تمت القراءة' : 'إرجاعه غير مقروء'}
          </button>
        </div>
        </>
      ) : <>
      <div className="fb-controls">
        <div>
          <span className="fb-label">الحالة</span>
          <div className="fb-seg" role="radiogroup" aria-label="الحالة">
            {STATUS_ORDER.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={item.status === s} className={`fb-seg__btn fb-seg__btn--${s} ${item.status === s ? 'is-active' : ''}`} disabled={!!busy} onClick={() => item.status !== s && save({ status: s }, 'status')}>{STATUS[s]}</button>
            ))}
          </div>
        </div>
        <label>
          <span className="fb-label">الأولوية</span>
          <select value={item.priority} disabled={!!busy} onChange={(e) => save({ priority: e.target.value }, 'priority')}>
            {(['high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
          </select>
        </label>
      </div>

      <Thread item={item} />
      {item.status === 'closed'
        ? <p className="fb-muted">الشكوى مغلقة: لا يستطيع العميل الرد عليها. غيّر الحالة لإعادة فتحها.</p>
        : <Composer item={item} onSaved={onSaved} />}
      </>}

      <section className="fb-block fb-block--notes">
        <h3><StickyNote size={15} /> ملاحظات داخلية <span className="fb-muted">للموظفين فقط</span></h3>
        {!!item.notes?.length && (
          <ul className="fb-notes">
            {item.notes.map((n, i) => <li key={n._id || i}><p dir="auto">{n.text}</p><span>{nameOf(n.by)} · {when(n.at)}</span></li>)}
          </ul>
        )}
        <div className="fb-note-add">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="أضف ملاحظة…" dir="auto" onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) save({ note }, 'note'); }} />
          <button type="button" className="fb-btn fb-btn--ghost" disabled={!note.trim() || !!busy} onClick={() => save({ note }, 'note')}>إضافة</button>
        </div>
      </section>

      {error && <p className="fb-error" role="alert"><AlertCircle size={15} />{error}</p>}

      {!!item.history?.length && (
        <details className="fb-history">
          <summary>سجل الطلب ({item.history.length})</summary>
          <ol>
            {[...item.history].reverse().map((h, i) => <li key={h._id || i}><span>{historyText(h)}</span><span className="fb-muted">{nameOf(h.by)} · {when(h.at)}</span></li>)}
          </ol>
        </details>
      )}
    </article>
  );
}

export default function FeedbackPanel({ onCounts }: { onCounts?: (open: number) => void }) {
  const [items, setItems] = useState<Feedback[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | Kind>('all');
  const [status, setStatus] = useState<'open' | 'all' | Status>('open');
  const [priority, setPriority] = useState<'all' | Priority>('all');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState((s) => (s === 'ready' ? s : 'loading'));
    api.get('feedback').then((res: any) => {
      if (!alive) return;
      setItems(Array.isArray(res.data) ? res.data : []);
      setState('ready');
    }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [refresh]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { new: 0, in_progress: 0, resolved: 0, closed: 0 };
    // The status counters follow complaints; suggestions are only read or unread
    items.forEach((f) => { if (f.kind === 'complaint') c[f.status] += 1; });
    return c;
  }, [items]);
  const newSuggestions = useMemo(() => items.filter((f) => f.kind === 'suggestion' && f.status === 'new').length, [items]);
  useEffect(() => { onCounts?.(counts.new + counts.in_progress + newSuggestions); }, [counts, newSuggestions, onCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
    return items.filter((f) => {
      if (kind !== 'all' && f.kind !== kind) return false;
      if (status === 'open' ? !(f.status === 'new' || f.status === 'in_progress') : status !== 'all' && f.status !== status) return false;
      if (priority !== 'all' && f.priority !== priority) return false;
      if (q && ![`#${f.number}`, String(f.number), f.subject, f.message, nameOf(f.user), f.user?.customerId, f.orderRef, String(f.user?.phone || '')].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (status === 'open' ? rank[a.priority] - rank[b.priority] : 0) || +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [items, query, kind, status, priority]);

  const current = items.find((f) => f._id === selected) || null;
  const hasFilters = !!query || kind !== 'all' || status !== 'open' || priority !== 'all';
  const reset = () => { setQuery(''); setKind('all'); setStatus('open'); setPriority('all'); };

  const saved = (f: Feedback) => setItems((list) => list.map((x) => (x._id === f._id ? f : x)));
  const deleted = (id: string) => { setItems((list) => list.filter((x) => x._id !== id)); setSelected(null); };

  if (state === 'loading') return <div className="fb-admin"><div className="ratings-skeleton" /><div className="ratings-skeleton" /></div>;
  if (state === 'error') return <div className="ratings-error" role="alert"><AlertCircle size={18} /><span>تعذر تحميل الشكاوى والاقتراحات.</span><button onClick={() => setRefresh((n) => n + 1)}>إعادة المحاولة</button></div>;

  return (
    <div className="fb-admin">
      <div className="fb-stats" role="group" aria-label="تصفية حسب الحالة">
        {STATUS_ORDER.map((s) => {
          const on = kind === 'complaint' && status === s;
          return (
            <button key={s} type="button" className={`fb-stat fb-stat--${s} ${on ? 'is-active' : ''}`} aria-pressed={on} onClick={() => { if (on) { setStatus('open'); setKind('all'); } else { setStatus(s); setKind('complaint'); } }}>
              <span>شكاوى · {STATUS[s]}</span><strong>{counts[s]}</strong>
            </button>
          );
        })}
        {(() => {
          const on = kind === 'suggestion' && status === 'new';
          return (
            <button type="button" className={`fb-stat fb-stat--suggestion ${on ? 'is-active' : ''}`} aria-pressed={on} onClick={() => { if (on) { setStatus('open'); setKind('all'); } else { setStatus('new'); setKind('suggestion'); } }}>
              <span>اقتراحات جديدة</span><strong>{newSuggestions}</strong>
            </button>
          );
        })()}
      </div>

      <div className="fb-toolbar">
        <label className="ratings-search"><Search size={17} /><span className="ratings-sr">بحث</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث برقم الطلب، اسم العميل، كود العميل، أو النص…" /></label>
        <div className="fb-toolbar__row">
          <div className="fb-chips" role="group" aria-label="النوع">
            {(['all', 'complaint', 'suggestion'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? 'is-active' : ''} onClick={() => setKind(k)}>
                {k === 'complaint' && <MessageSquareWarning size={15} />}{k === 'suggestion' && <Lightbulb size={15} />}
                {k === 'all' ? 'الكل' : k === 'complaint' ? 'الشكاوى' : 'الاقتراحات'}
              </button>
            ))}
          </div>
          <label>الحالة<select value={status} onChange={(e) => setStatus(e.target.value as any)}><option value="open">المفتوحة (جديد + قيد المعالجة)</option><option value="all">كل الحالات</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
          <label>الأولوية<select value={priority} onChange={(e) => setPriority(e.target.value as any)}><option value="all">كل الأولويات</option>{(['high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}</select></label>
          <button type="button" className="ratings-button" onClick={() => setRefresh((n) => n + 1)} aria-label="تحديث"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="ratings-results"><h2>الطلبات <span>{filtered.length}</span></h2>{hasFilters && <button onClick={reset}><X size={14} />مسح الفلاتر</button>}</div>

      <div className={`fb-split ${current ? 'has-detail' : ''}`}>
        <div className="fb-inbox">
          {!filtered.length ? (
            <div className="ratings-empty"><Inbox size={30} /><h3>{items.length ? 'لا توجد طلبات تطابق الفلاتر' : 'لم تصل شكاوى أو اقتراحات بعد'}</h3><p>{items.length ? (status === 'open' ? 'لا توجد طلبات مفتوحة. كل الطلبات تم التعامل معها.' : 'جرّب تغيير البحث أو الفلاتر.') : 'عندما يرسل العملاء شكوى أو اقتراحاً من التطبيق ستظهر هنا.'}</p>{hasFilters && <button className="ratings-button" onClick={reset}>عرض المفتوحة</button>}</div>
          ) : (
            <ul>
              {filtered.map((f) => (
                <li key={f._id}>
                  <button type="button" className={`fb-row ${selected === f._id ? 'is-selected' : ''}`} onClick={() => setSelected(f._id)} aria-current={selected === f._id}>
                    <span className={`fb-row__bar fb-row__bar--${f.priority}`} aria-hidden />
                    <span className="fb-row__top">
                      <span className={`fb-kind fb-kind--${f.kind}`}>{KIND[f.kind]}</span>
                      <bdi dir="ltr" className="fb-muted">#{f.number}</bdi>
                      {f.priority === 'high' && <span className="fb-high">أولوية عالية</span>}
                      {f.kind === 'complaint' && f.unreadByStaff && !!f.messages?.some((m) => m.from === 'customer') && <span className="fb-new-msg">رد جديد من العميل</span>}
                      {f.kind === 'suggestion'
                        ? <span className={`fb-status fb-status--${f.status === 'new' ? 'new' : 'closed'}`}>{f.status === 'new' ? 'جديد' : 'مقروء'}</span>
                        : <span className={`fb-status fb-status--${f.status}`}>{STATUS[f.status]}</span>}
                    </span>
                    <span className="fb-row__subject" dir="auto">{f.subject}</span>
                    <span className="fb-row__meta"><bdi>{nameOf(f.user)}</bdi>{f.user?.customerId && <bdi>{f.user.customerId}</bdi>}<span>{TOPIC[f.topic] || 'أخرى'}</span><span>{age(f.lastMessageAt || f.createdAt)}</span>{!!f.messages?.length && <span>{f.messages.length + 1} رسائل</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="fb-pane">
          {current ? (
            <>
              <button type="button" className="fb-back" onClick={() => setSelected(null)}><X size={15} /> إغلاق</button>
              <Detail item={current} onSaved={saved} onDeleted={deleted} />
            </>
          ) : (
            <div className="fb-pane__empty"><Inbox size={28} /><p>اختر طلباً من القائمة لعرض تفاصيله والرد عليه.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
