import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import moment from 'moment';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, History, MapPin, Search, Weight, XCircle } from 'lucide-react';
import api from '../../api';

type Props = {
  office: string;
  officeLabel: string;
  inventoryId?: string;
  orders: any[];
  onClose: () => void;
  onSubmitted: () => void;
};

type ReviewStatus = { type: 'ok' } | { type: 'issue'; note: string };

const fullName = (order: any) => order?.customerInfo?.fullName || 'غير معروف';
const packageKey = (order: any) => order?.paymentList?._id;

const draftKey = (office: string, inventoryId?: string) => `warehouseCheckDraft:${office}:${inventoryId || 'unknown'}`;

const WeeklyCheckDialog = ({ office, officeLabel, inventoryId, orders, onClose, onSubmitted }: Props) => {
  const [history, setHistory] = useState<any[] | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, ReviewStatus>>({});
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<'all' | 'remaining' | 'flagged'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCheck, setSubmittedCheck] = useState<any>(null);
  const [view, setView] = useState<'checklist' | 'history'>('checklist');
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyLimit, setHistoryLimit] = useState(10);
  const [issueLimits, setIssueLimits] = useState<Record<string, number>>({});
  const [historyError, setHistoryError] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase();
    return (history || []).filter(check => {
      if (historyFilter === 'issues' && !check.discrepancies?.length) return false;
      if (historyFilter === 'clear' && check.discrepancies?.length) return false;
      return !query || [check.checkedBy?.firstName, check.checkedBy?.lastName, check.notes,
        moment(check.createdAt).format('DD/MM/YYYY'), ...(check.discrepancies || []).flatMap((d: any) => [d.customerName, d.trackingNumber, d.note])]
        .join(' ').toLocaleLowerCase().includes(query);
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [history, historyQuery, historyFilter]);

  const toggleExpanded = (id: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    setHistoryError(false);
    api.get(`warehouse/${office}/checks`)
      .then((response) => { if (active) { if (!Array.isArray(response.data)) throw new Error('Invalid history'); setHistory(response.data); } })
      .catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, [office, historyRefresh]);

  // Picks up where they left off, so an employee can check some packages,
  // close the dialog, and come back later to finish the rest.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(office, inventoryId));
      if (saved) {
        const parsed = JSON.parse(saved);
        setReviewed(parsed.reviewed || {});
        setNotes(parsed.notes || '');
      }
    } catch {
      // ignore a corrupt or inaccessible draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office, inventoryId]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(office, inventoryId), JSON.stringify({ reviewed, notes }));
    } catch {
      // ignore - draft saving is a convenience, not a requirement
    }
  }, [office, inventoryId, reviewed, notes]);

  const markOk = (id: string) => {
    setReviewed((prev) => ({ ...prev, [id]: { type: 'ok' } }));
  };

  const markIssue = (id: string) => {
    setReviewed((prev) => (prev[id]?.type === 'issue' ? prev : { ...prev, [id]: { type: 'issue', note: '' } }));
  };

  const undoReview = (id: string) => {
    setReviewed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setIssueNote = (id: string, note: string) => {
    setReviewed((prev) => ({ ...prev, [id]: { type: 'issue', note } }));
  };

  const totalCount = orders.length;
  const reviewedCount = Object.keys(reviewed).length;
  const flaggedEntries = Object.entries(reviewed).filter(([, status]) => status.type === 'issue') as [string, { type: 'issue'; note: string }][];
  const flaggedCount = flaggedEntries.length;
  const hasEmptyNotes = flaggedEntries.some(([, status]) => !status.note.trim());
  const remainingCount = totalCount - reviewedCount;
  const allReviewed = totalCount > 0 && remainingCount === 0;

  const visibleOrders = useMemo(() => {
    if (filter === 'remaining') return orders.filter((order) => !(packageKey(order) in reviewed));
    if (filter === 'flagged') return orders.filter((order) => reviewed[packageKey(order)]?.type === 'issue');
    return orders;
  }, [orders, reviewed, filter]);

  const submit = async () => {
    if (!allReviewed || hasEmptyNotes) return;
    try {
      setIsSubmitting(true);
      setError('');
      const discrepancies = flaggedEntries.map(([paymentListId, status]) => {
        const order = orders.find((o) => packageKey(o) === paymentListId);
        return {
          paymentListId,
          note: status.note.trim(),
          trackingNumber: order?.paymentList?.deliveredPackages?.trackingNumber,
          customerName: fullName(order),
        };
      });
      const response = await api.post(`warehouse/${office}/check`, { notes: notes.trim(), discrepancies });
      try { localStorage.removeItem(draftKey(office, inventoryId)); } catch { /* ignore */ }
      setSubmittedCheck(response.data);
      onSubmitted();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إرسال الفحص.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lastCheck = history?.[0];

  return (
    <Dialog open maxWidth="md" aria-label={`الفحص الأسبوعي للمخزن - ${officeLabel}`} onClose={() => !isSubmitting && onClose()} PaperProps={{ className: 'wh-dialog wh-dialog--wide wh-weekly-dialog', dir: 'rtl', lang: 'ar' }}>
      {submittedCheck ?
        <div className="wh-dialog__done">
          <CheckCircle2 size={32} strokeWidth={1.5} className="wh-dialog__done-icon" />
          <h6>تم إرسال الفحص الأسبوعي</h6>
          <p>
            لقد فحصت {submittedCheck.totalPackages} طرد في {officeLabel}
            {submittedCheck.discrepancies?.length > 0 && `، مع الإبلاغ عن ${submittedCheck.discrepancies.length} للمتابعة`}.
            أصبح هذا مرئيًا الآن للمدير.
          </p>

          <div className="wh-check-progress">
            <span>
              بواسطة <strong>{submittedCheck.checkedBy?.firstName} {submittedCheck.checkedBy?.lastName}</strong> - {moment(submittedCheck.createdAt).format('DD MMM YYYY, HH:mm')}
            </span>
          </div>

          <div className="wh-check-progress">
            <div className="wh-bar">
              <div className="wh-bar__fill" style={{ width: '100%' }} />
            </div>
            <span>{submittedCheck.totalPackages} / {submittedCheck.totalPackages} تم فحصه{submittedCheck.discrepancies?.length > 0 && ` · ${submittedCheck.discrepancies.length} مبلغ عنه`}</span>
          </div>

          {submittedCheck.notes &&
            <p className="wh-history-row__notes" style={{ textAlign: 'right' }}>{submittedCheck.notes}</p>
          }

          {submittedCheck.discrepancies?.length > 0 &&
            <div className="wh-picker" style={{ textAlign: 'right', width: '100%' }}>
              {submittedCheck.discrepancies.map((d: any, i: number) => (
                <div key={d.paymentListId || i} className="wh-history-row">
                  <div>
                    <strong>{d.customerName || 'غير معروف'}</strong>
                    <small>{d.trackingNumber}</small>
                  </div>
                  <p className="wh-history-row__notes">{d.note}</p>
                </div>
              ))}
            </div>
          }

          <div className="wh-dialog__actions">
            <button type="button" className="wh-btn wh-btn--primary" onClick={onClose}>تم</button>
          </div>
        </div>
        :
        <>
          <div className="wh-dialog__head">
            <h6>
              <ClipboardCheck size={17} strokeWidth={2} />
              الفحص الأسبوعي للمخزن - {officeLabel}
            </h6>
            <div className="wh-dialog__tabs">
              <button type="button" className={view === 'checklist' ? 'is-active' : ''} onClick={() => setView('checklist')}>قائمة الفحص</button>
              <button type="button" className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}>
                <History size={13} strokeWidth={2} /> السجل
              </button>
            </div>
          </div>

          {lastCheck &&
            <p className="wh-dialog__note">
              آخر فحص بواسطة <strong>{lastCheck.checkedBy?.firstName} {lastCheck.checkedBy?.lastName}</strong> {moment(lastCheck.createdAt).fromNow()}
              {' '}({lastCheck.totalPackages} طرد، {lastCheck.discrepancies?.length || 0} مبلغ عنه).
            </p>
          }

          {view === 'history' ?
            <section className="wh-check-history" aria-label="سجل الفحوصات">
              <div className="wh-history-tools">
                <label className="wh-history-search"><Search size={16} /><input type="search" aria-label="بحث في سجل الفحص" placeholder="بحث بالموظف، العميل، التتبع أو الملاحظة…" value={historyQuery} onChange={e => { setHistoryQuery(e.target.value); setHistoryLimit(10); }} /></label>
                <label className="wh-history-filter">حالة الفحص<select value={historyFilter} onChange={e => { setHistoryFilter(e.target.value); setHistoryLimit(10); }}><option value="all">جميع الفحوصات</option><option value="issues">بها بلاغات</option><option value="clear">بدون بلاغات</option></select></label>
              </div>
              {historyError && <p className="wh-dialog__error" role="alert">تعذر تحميل السجل. <button type="button" className="wh-check-row__undo" onClick={() => setHistoryRefresh(n => n + 1)}>إعادة المحاولة</button></p>}
              {!history && !historyError && <p className="wh-picker__hint" role="status">جارٍ تحميل السجل…</p>}
              {history && <p className="wh-history-count" role="status">{filteredHistory.length} فحص · الأحدث أولًا</p>}
              {history && filteredHistory.length === 0 && <p className="wh-picker__hint">{history.length ? 'لا توجد فحوصات تطابق البحث والتصفية.' : 'لم يتم إرسال أي فحص بعد.'}</p>}
              <div className="wh-history-list">
              {filteredHistory.slice(0, historyLimit).map((check) => {
                const isOpen = expandedChecks.has(check._id);
                const issueLimit = issueLimits[check._id] || 8;
                return (
                  <article key={check._id} className="wh-history-row">
                    <button type="button" className="wh-history-row__toggle" aria-expanded={isOpen} aria-controls={`check-history-${check._id}`} onClick={() => toggleExpanded(check._id)}>
                      <div className="wh-history-identity">
                        <strong><bdi>{[check.checkedBy?.firstName, check.checkedBy?.lastName].filter(Boolean).join(' ') || 'الموظف غير متاح'}</bdi></strong>
                        <time dateTime={check.createdAt}>{moment(check.createdAt).format('DD/MM/YYYY · HH:mm')}</time>
                      </div>
                      <span className={`wh-history-row__badge ${check.discrepancies?.length ? 'is-warning' : 'is-success'}`}>
                        {check.discrepancies?.length ? `${check.discrepancies.length} بلاغات` : 'بدون بلاغات'}
                      </span>
                      <span className="wh-history-total">{check.totalPackages} طرد</span>
                      <ChevronDown size={15} strokeWidth={2} className={`wh-history-row__chevron ${isOpen ? 'is-open' : ''}`} />
                    </button>

                    {isOpen &&
                      <div className="wh-history-row__details" id={`check-history-${check._id}`}>
                        <p>
                          تم تأكيد {Math.max(0, check.totalPackages - (check.discrepancies?.length || 0))} طرد سليم من أصل {check.totalPackages}.
                        </p>
                        {check.notes && <div className="wh-history-general"><strong>ملاحظة الفحص</strong><p dir="auto">{check.notes}</p></div>}

                        {check.discrepancies?.length > 0 ?
                          <><h3 className="wh-history-issues-title">الطرود المبلّغ عنها ({check.discrepancies.length})</h3>{check.discrepancies.slice(0, issueLimit).map((d: any, i: number) => (
                            <div key={d.paymentListId || i} className="wh-history-row__issue">
                              <strong><bdi>{d.customerName || 'غير معروف'}</bdi></strong>
                              {d.trackingNumber && <small>رقم التتبع: <bdi>{d.trackingNumber}</bdi></small>}
                              <p dir="auto">{d.note || 'لا توجد ملاحظة مسجلة'}</p>
                            </div>
                          ))}{check.discrepancies.length > issueLimit && <button type="button" className="wh-btn wh-history-more" onClick={() => setIssueLimits(prev => ({ ...prev, [check._id]: issueLimit + 8 }))}>عرض بلاغات إضافية ({check.discrepancies.length - issueLimit} متبقية)</button>}</>
                          :
                          <p className="wh-history-row__notes">لم يتم الإبلاغ عن أي مشكلة في هذا الفحص.</p>
                        }
                      </div>
                    }
                  </article>
                );
              })}
              </div>
              {filteredHistory.length > historyLimit && <button type="button" className="wh-btn wh-history-more" onClick={() => setHistoryLimit(n => n + 10)}>عرض فحوصات أقدم ({filteredHistory.length - historyLimit} متبقية)</button>}
              <div className="wh-dialog__actions"><button type="button" className="wh-btn" onClick={onClose}>إغلاق السجل</button></div>
            </section>
            :
            <>
              <p className="wh-dialog__note">
                راجع المخزن طردًا طردًا. أكّد وجود كل طرد فعليًا، أو أبلغ عنه مع ذكر السبب. يمكنك المغادرة والعودة لاحقًا - يتم حفظ تقدمك، ولا يمكنك الإرسال إلا بعد فحص جميع الطرود.
              </p>

              <div className="wh-check-progress">
                <div className="wh-bar">
                  <div className="wh-bar__fill" style={{ width: `${totalCount ? (reviewedCount / totalCount) * 100 : 0}%` }} />
                </div>
                <span>{reviewedCount} / {totalCount} تم فحصه{flaggedCount > 0 && ` · ${flaggedCount} مبلغ عنه`}</span>
              </div>

              <div className="wh-dialog__tabs wh-check-filters">
                <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>الكل ({totalCount})</button>
                <button type="button" className={filter === 'remaining' ? 'is-active' : ''} onClick={() => setFilter('remaining')}>المتبقي ({remainingCount})</button>
                <button type="button" className={filter === 'flagged' ? 'is-active' : ''} onClick={() => setFilter('flagged')}>المبلغ عنه ({flaggedCount})</button>
              </div>

              <div className="wh-picker">
                {visibleOrders.map((order) => {
                  const id = packageKey(order);
                  const status = reviewed[id];
                  const pkg = order.paymentList?.deliveredPackages || {};
                  return (
                    <div key={id} className={`wh-check-row ${status ? `is-${status.type}` : ''}`}>
                      <div className="wh-check-row__info">
                        <strong><bdi>{fullName(order)}</bdi></strong>
                        <div className="wh-check-row__meta">
                          {pkg.trackingNumber && <span>تتبع <bdi>{pkg.trackingNumber}</bdi></span>}
                          {pkg.receiptNo && <span>إيصال <bdi>{pkg.receiptNo}</bdi></span>}
                          {pkg.weight?.total && <span><Weight size={11} strokeWidth={2} /> {pkg.weight.total} {pkg.weight.measureUnit}</span>}
                          {pkg.volumetric?.enabled && <span style={{ color: '#b45309', fontWeight: 700 }} title={`الوزن الفعلي ${pkg.weight?.actual ?? '-'} كغ · ${pkg.volumetric.cbm} CBM`}>⚠ حجمي (الفعلي {pkg.weight?.actual ?? '-'})</span>}
                          {pkg.locationPlace && <span><MapPin size={11} strokeWidth={2} /> {pkg.locationPlace}</span>}
                        </div>
                      </div>

                      <div className="wh-check-row__buttons">
                        <button
                          type="button"
                          className={`wh-check-row__btn is-ok ${status?.type === 'ok' ? 'is-selected' : ''}`}
                          aria-pressed={status?.type === 'ok'}
                          onClick={() => markOk(id)}
                        >
                          <CheckCircle2 size={14} strokeWidth={2} />
                          موجود
                        </button>
                        <button
                          type="button"
                          className={`wh-check-row__btn is-issue ${status?.type === 'issue' ? 'is-selected' : ''}`}
                          aria-pressed={status?.type === 'issue'}
                          onClick={() => markIssue(id)}
                        >
                          <XCircle size={14} strokeWidth={2} />
                          إبلاغ عن مشكلة
                        </button>
                        {status && <button type="button" className="wh-check-row__undo" onClick={() => undoReview(id)}>تراجع</button>}
                      </div>

                      {status?.type === 'issue' &&
                        <textarea
                          rows={2}
                          aria-label={`سبب المشكلة في طرد ${pkg.trackingNumber || fullName(order)}`}
                          className="wh-check-row__note"
                          placeholder="ما المشكلة في هذا الطرد؟ (مطلوب)"
                          value={status.note}
                          onChange={(event) => setIssueNote(id, event.target.value)}
                          autoFocus
                        />
                      }
                    </div>
                  );
                })}
                {orders.length === 0 && <p className="wh-picker__hint">لا يوجد ما يُفحص - هذا المخزن فارغ.</p>}
                {orders.length > 0 && visibleOrders.length === 0 && <p className="wh-picker__hint">لا توجد نتائج مطابقة لهذا التصفية.</p>}
              </div>

              <textarea
                className="wh-dialog__general-notes"
                rows={2}
                placeholder="أي ملاحظات عامة حول هذا الفحص (اختياري)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />

              {!allReviewed && totalCount > 0 &&
                <p className="wh-dialog__flag-summary">
                  <AlertTriangle size={13} strokeWidth={2} />
                  {remainingCount} طرد متبقٍ للفحص قبل أن تتمكن من الإرسال
                </p>
              }

              {error && <p className="wh-dialog__error">{error}</p>}

              <div className="wh-dialog__actions">
                <button type="button" className="wh-btn" onClick={onClose} disabled={isSubmitting}>حفظ وإغلاق</button>
                <button type="button" className="wh-btn wh-btn--primary" onClick={submit} disabled={isSubmitting || !allReviewed || hasEmptyNotes}>
                  {isSubmitting ? 'جارٍ الإرسال…' : 'إرسال الفحص الأسبوعي'}
                </button>
              </div>
            </>
          }
        </>
      }
    </Dialog>
  );
};

export default WeeklyCheckDialog;
