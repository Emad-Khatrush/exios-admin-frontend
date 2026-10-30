import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, useMediaQuery } from '@mui/material';
import moment from 'moment';
import { acc, errorText, todayLibya } from './accountingApi';
import { Amount, Badge, DataTable, FilterBar, Ltr, Open, Panel, Stat, StatGrid, Sub } from './ui';
import { useAccountingAccess } from './useAccountingAccess';

export const OPERATION_TYPES: Record<string, string> = {
  deposit: 'إيداع', withdrawal: 'سحب كاش', refund: 'استرداد / إلغاء', compensation: 'تعويض',
  wallet_payment: 'دفع من المحفظة', purchase_payment: 'دفع فاتورة شراء', shipping_payment: 'دفع شحن',
  purchase_invoice: 'فاتورة شراء', shipping_order: 'إنشاء طلبية شحن', shipping_invoice: 'فاتورة تسليم شحن', supplier_bill: 'فاتورة مورد',
  expense: 'مصروف', supplier_payment: 'دفعة مورد', supplier_receipt: 'استلام من مورد', transfer: 'تحويل خزينة',
  salary: 'راتب / عمولة', change: 'تعديل / حذف / إلغاء', manual_entry: 'قيد يدوي',
  yuan: 'شراء يوان', equity: 'رأس مال / قرض', netting: 'مقاصة', writeoff: 'شطب مطالبة',
};
const STATES: Record<string, string> = { pending: 'بانتظار المراجعة', reviewed: 'تمت المراجعة', issue: 'تحتاج معالجة' };
const STATUS: Record<string, string> = { entered: 'مدخلة', posted: 'مرحّلة', draft: 'مسودة', canceled: 'ملغاة', deleted: 'محذوفة', reversed: 'ملغاة' };
const initialFilters = () => ({ from: todayLibya(), to: todayLibya(), employee: '', office: '', kind: '', state: '' });
type Filters = ReturnType<typeof initialFilters>;

export default function EmployeeOperations() {
  const access = useAccountingAccess();
  const canReview = access.can('treasury', 'closing');
  const mobile = useMediaQuery('(max-width:640px)');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [query, setQuery] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [data, setData] = useState<any>(null), [options, setOptions] = useState<any>({ users: [], offices: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<any>(null), [reviewRows, setReviewRows] = useState<any[] | null>(null);
  const [state, setState] = useState('reviewed'), [note, setNote] = useState(''), [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    acc.get('daily-work/operations/options').then((res: any) => { if (active) setOptions(res.data); })
      .catch((err: any) => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setError(''); setSelected(new Set());
    acc.get('daily-work/operations', { ...query, page }).then((res: any) => { if (current === generation.current) setData(res.data); })
      .catch((err: any) => { if (current === generation.current) { setError(errorText(err)); setData(null); } })
      .finally(() => { if (current === generation.current) setLoading(false); });
    return () => { if (current === generation.current) generation.current++; };
  }, [query, page, revision]);

  const apply = (next = filters) => { setFilters(next); setQuery({ ...next }); setPage(1); };
  const quickRange = (key: string) => {
    const day = todayLibya();
    const from = key === 'month' ? day.slice(0, 7) + '-01' : key === 'week' ? moment(day).subtract(6, 'days').format('YYYY-MM-DD') : key === 'yesterday' ? moment(day).subtract(1, 'day').format('YYYY-MM-DD') : day;
    apply({ ...filters, from, to: key === 'yesterday' ? from : day });
  };
  const openReview = (rows: any[]) => {
    setReviewRows(rows); setState(rows.length === 1 ? (rows[0].reviewState === 'pending' ? 'reviewed' : rows[0].reviewState) : 'reviewed');
    setNote(rows.length === 1 ? rows[0].review?.note || '' : ''); setSaveError('');
  };
  const save = async () => {
    if (!reviewRows) return;
    setSaving(true); setSaveError('');
    try {
      await acc.post('daily-work/operations/review', { state, note, items: reviewRows.map(row => ({ key: row.key, fingerprint: row.fingerprint })) });
      setReviewRows(null); setDetail(null); setRevision(n => n + 1);
    } catch (err) { setSaveError(errorText(err)); }
    finally { setSaving(false); }
  };
  const count = (key: string) => data?.states?.find((r: any) => r._id === key)?.count || 0;
  const name = (user: any) => [user.firstName, user.lastName].filter(Boolean).join(' ');
  const officeName = (office: string) => options.offices.find((o: any) => o.code === office)?.name || office || 'غير محدد';
  const amount = (row: any) => row.amount == null ? '—' : <Amount value={row.amount} currency={row.currency} />;
  const badge = (row: any) => <Badge tone={row.reviewState === 'reviewed' ? 'ok' : row.reviewState === 'issue' ? 'danger' : 'muted'}>{STATES[row.reviewState]}</Badge>;

  return <div className="acc-employee-operations">
    <p className="acc-muted">عمليات جميع المكاتب حسب وقت إدخالها، بما فيها غير المرحّلة. المراجعة توثّق الفحص ولا تغيّر المبالغ أو القيود؛ تعديل العملية يعيدها للمراجعة.</p>
    <Panel flush>
      <div className="px-3"><FilterBar>
        <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} inputProps={{ max: filters.to }} />
        <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} inputProps={{ min: filters.from, max: todayLibya() }} />
        <TextField select label="الموظف" value={filters.employee} onChange={e => setFilters({ ...filters, employee: e.target.value })} style={{ minWidth: 160 }}>
          <MenuItem value="">كل الموظفين</MenuItem>{options.users.map((u: any) => <MenuItem key={u._id} value={u._id}>{name(u)}</MenuItem>)}
        </TextField>
        <TextField select label="المكتب" value={filters.office} onChange={e => setFilters({ ...filters, office: e.target.value })} style={{ minWidth: 130 }}>
          <MenuItem value="">كل المكاتب</MenuItem>{options.offices.map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
        </TextField>
        <TextField select label="نوع العملية" value={filters.kind} onChange={e => setFilters({ ...filters, kind: e.target.value })} style={{ minWidth: 165 }}>
          <MenuItem value="">كل العمليات</MenuItem>{Object.entries(OPERATION_TYPES).map(([key, title]) => <MenuItem key={key} value={key}>{title}</MenuItem>)}
        </TextField>
        <TextField select label="المراجعة" value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value })} style={{ minWidth: 160 }}>
          <MenuItem value="">كل الحالات</MenuItem>{Object.entries(STATES).map(([key, title]) => <MenuItem key={key} value={key}>{title}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={() => apply()}>عرض</Button>
        <Button onClick={() => quickRange('today')}>اليوم</Button><Button onClick={() => quickRange('yesterday')}>أمس</Button>
        <Button onClick={() => quickRange('week')}>آخر 7 أيام</Button><Button onClick={() => quickRange('month')}>هذا الشهر</Button>
        <Button onClick={() => apply(initialFilters())}>مسح الفلاتر</Button>
      </FilterBar></div>
    </Panel>
    {error && <Alert severity="error" className="mb-3">{error}<Button onClick={() => setRevision(n => n + 1)}>إعادة المحاولة</Button></Alert>}
    <StatGrid>
      <Stat label="إجمالي العمليات" value={data?.total ?? '—'} />
      <Stat label="بانتظار المراجعة" value={data ? count('pending') : '—'} />
      <Stat label="تمت المراجعة" value={data ? count('reviewed') : '—'} tone="accent" />
      <Stat label="تحتاج معالجة" value={data ? count('issue') : '—'} tone={count('issue') ? 'danger' : undefined} />
    </StatGrid>
    <Panel flush title="سجل عمليات الموظفين" actions={<>
      {canReview && <Button variant="outlined" disabled={!selected.size || loading || saving} onClick={() => openReview(data.results.filter((r: any) => selected.has(r.key)))}>مراجعة المختار ({selected.size})</Button>}
      <Button disabled={loading} onClick={() => setRevision(n => n + 1)}>تحديث</Button>
    </>}>
      {mobile && !loading ? <div className="acc-ops-list">
        {!data?.results?.length && <p className="acc-muted">لا توجد عمليات ضمن الفترة والفلاتر المختارة.</p>}
        {(data?.results || []).map((r: any) => <article key={r.key} className="acc-ops-item">
          <div className="acc-ops-item__line">
            <strong dir="auto">{r.actorName || 'النظام / غير مسجل'}</strong><span>{amount(r)}</span>
          </div>
          <div className="acc-ops-item__line"><Badge tone="info">{OPERATION_TYPES[r.kind]}</Badge><Sub><Ltr>{moment(r.at).format('DD/MM HH:mm')}</Ltr></Sub></div>
          <Sub>{r.officeCodes?.length > 1 ? r.officeCodes.map(officeName).join('، ') : officeName(r.office)}{r.officeInferred && r.office && ' (مكتب الموظف الحالي)'} · {STATUS[r.status] || r.status}</Sub>
          <Open to={r.url}>{r.number || 'فتح العملية'}</Open>
          {r.partnerName && <Sub>{r.partnerName} · {r.customerCode}</Sub>}
          <Sub>{r.description}</Sub>
          <div className="acc-ops-item__line"><span>{badge(r)}</span><span>
            <Button size="small" onClick={() => setDetail(r)}>التفاصيل</Button>
            {canReview && <Button size="small" onClick={() => openReview([r])}>مراجعة</Button>}
          </span></div>
          {r.review?.note && <Sub>{r.review.note}</Sub>}
          {canReview && <label className="acc-ops-item__pick"><input type="checkbox" checked={selected.has(r.key)} onChange={() => setSelected(prev => {
            const next = new Set(prev); next.has(r.key) ? next.delete(r.key) : next.add(r.key); return next;
          })} /> تحديد للمراجعة الجماعية</label>}
        </article>)}
      </div> : <DataTable<any> rows={data?.results || []} rowKey={r => r.key} loading={loading} onRowClick={setDetail}
        rowTone={r => ['canceled', 'deleted', 'reversed'].includes(r.status) ? 'canceled' : undefined}
        selection={canReview ? { selected, onChange: setSelected } : undefined}
        empty={{ title: 'لا توجد عمليات ضمن الفترة والفلاتر المختارة' }}
        columns={[
          { key: 'at', header: 'وقت الإدخال', width: 135, render: r => <><Ltr>{moment(r.at).format('YYYY-MM-DD HH:mm')}</Ltr>{r.operationDay !== moment(r.at).utcOffset(120).format('YYYY-MM-DD') && <Sub>تاريخ العملية: {r.operationDay}</Sub>}</> },
          { key: 'actor', header: 'الموظف / المكتب', render: r => <>{r.actorName || 'النظام / غير مسجل'}<Sub>{r.officeCodes?.length > 1 ? r.officeCodes.map(officeName).join('، ') : officeName(r.office)}{r.officeInferred && r.office && ' (مكتب الموظف الحالي)'}</Sub></> },
          { key: 'kind', header: 'العملية', render: r => <><Badge tone="info">{OPERATION_TYPES[r.kind] || r.kind}</Badge><Sub>{STATUS[r.status] || r.status}</Sub></> },
          { key: 'description', header: 'المستند والعميل', render: r => <><Open to={r.url}>{r.number || 'فتح العملية'}</Open><Sub>{r.partnerName}{r.customerCode ? ` · ${r.customerCode}` : ''}</Sub><Sub>{r.description}</Sub></> },
          { key: 'amount', header: 'قيمة العملية', numeric: true, render: amount },
          { key: 'posting', header: 'الربط المحاسبي', render: r => r.entries?.length ? <>{r.entries.map((entry: any) => <div key={entry._id}><Open to={`/accounting/entries/${entry._id}`}>{entry.reversalOf ? 'قيد إلغاء' : entry.status === 'reversed' ? 'قيد ملغى' : 'فتح القيد'}</Open></div>)}</> : <Sub>لا قيد مباشر مرتبط</Sub> },
          { key: 'review', header: 'المراجعة', render: r => <>{badge(r)}{r.review?.note && <Sub>{r.review.note}</Sub>}{canReview && <div><Button size="small" onClick={() => openReview([r])}>مراجعة</Button></div>}</> },
        ]} />}
      {data?.total > 0 && <div className="d-flex justify-content-end align-items-center gap-2 px-3 py-2">
        <Sub>الصفحة {page} من {Math.ceil(data.total / data.limit)}</Sub>
        <Button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>السابق</Button>
        <Button disabled={page * data.limit >= data.total || loading} onClick={() => setPage(p => p + 1)}>التالي</Button>
      </div>}
    </Panel>
    {data?.currencies?.length > 0 && <Panel><details><summary>قيم العمليات حسب النوع والعملة</summary>
      <Sub>قيم المستندات والدفعات غير الملغاة، كل نوع وعملة على حدة؛ ليست صافي الخزينة أو الإيرادات.</Sub>
      <DataTable<any> dense rows={data.currencies} rowKey={r => `${r._id.kind}:${r._id.currency}`} columns={[
        { key: 'kind', header: 'النوع', render: r => OPERATION_TYPES[r._id.kind] }, { key: 'count', header: 'العدد' },
        { key: 'amount', header: 'القيمة', render: r => <Amount value={r.amount} currency={r._id.currency} /> },
      ]} />
    </details></Panel>}
    <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle>{detail && OPERATION_TYPES[detail.kind]}</DialogTitle>
      {detail && <DialogContent><p>{detail.actorName || 'النظام / غير مسجل'} · {officeName(detail.office)}</p>
        <p><Ltr>{moment(detail.at).format('YYYY-MM-DD HH:mm:ss')}</Ltr></p><p>{detail.description}</p>{detail.note && <p>ملاحظة العملية: {detail.note}</p>}
        <p>{amount(detail)}</p><p>{badge(detail)}</p>{detail.review && <Sub>آخر مراجعة: {detail.reviewer?.[0] && name(detail.reviewer[0])} · {moment(detail.review.updatedAt).format('YYYY-MM-DD HH:mm')} · {detail.review.note}</Sub>}
        {detail.entries?.map((entry: any) => <p key={entry._id}><Open to={`/accounting/entries/${entry._id}`}>{entry.reversalOf ? 'فتح قيد الإلغاء' : entry.status === 'reversed' ? 'فتح القيد الملغى' : 'فتح القيد المحاسبي'}</Open></p>)}
        <Open to={detail.url}>فتح المستند الأصلي</Open>
      </DialogContent>}
      <DialogActions><Button onClick={() => setDetail(null)}>إغلاق</Button>{canReview && <Button onClick={() => { openReview([detail]); setDetail(null); }}>تسجيل المراجعة</Button>}</DialogActions>
    </Dialog>
    <Dialog open={!!reviewRows} onClose={() => !saving && setReviewRows(null)} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle>مراجعة {reviewRows?.length} عملية</DialogTitle>
      <DialogContent>
        {saveError && <Alert severity="error">{saveError}</Alert>}
        <TextField select fullWidth label="نتيجة المراجعة" value={state} onChange={e => setState(e.target.value)} className="mt-3" disabled={saving}>
          {Object.entries(STATES).map(([key, title]) => <MenuItem key={key} value={key}>{title}</MenuItem>)}
        </TextField>
        <TextField multiline minRows={3} fullWidth label="ملاحظة المحاسب" value={note} onChange={e => setNote(e.target.value)} className="mt-3" inputProps={{ maxLength: 1000 }} required={state === 'issue'} disabled={saving} helperText={state === 'issue' ? 'وضح سبب المشكلة في 5 أحرف على الأقل.' : 'اختياري؛ تُحفظ مع اسم المراجع وتاريخ المراجعة.'} />
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setReviewRows(null)}>إلغاء</Button><Button variant="contained" disabled={saving || (state === 'issue' && note.trim().length < 5)} onClick={save}>{saving ? 'جارٍ الحفظ…' : 'حفظ المراجعة'}</Button></DialogActions>
    </Dialog>
  </div>;
}
