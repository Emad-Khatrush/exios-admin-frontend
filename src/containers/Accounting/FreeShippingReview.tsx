import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { Badge, DataTable, FilterBar, Ltr, Money, Open, Sub } from './ui';

type Row = {
  key: string; orderId: string; packageId: string; orderNumber: string; tracking: string; customer: any;
  date: string; invoiceMinor: number; chargeMinor: number; billedMinor: number; openMinor: number; paidMinor: number;
  revenueMinor: number; purchaseCostMinor: number; profitImpactMinor: number; blocked: string;
  enabled: boolean; offerReason: string; delivered: boolean; postingDay: string; fingerprint: string;
};
const money = (value: number) => <Money value={value} />;
const name = (row: Row) => `${row.customer?.customerId || ''} ${row.customer?.firstName || ''} ${row.customer?.lastName || ''}`.trim();
const total = (rows: Row[], key: 'openMinor' | 'revenueMinor' | 'purchaseCostMinor' | 'profitImpactMinor') => rows.reduce((sum, row) => sum + row[key], 0);

export default function FreeShippingReview({ orderId, disabled = false, onApplied }: { orderId?: string; disabled?: boolean; onApplied?: () => void }) {
  const access = useAccountingAccess();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [onlyReady, setOnlyReady] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState<Row[] | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);
  const load = async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setSelected([]);
    try {
      const response = await acc.get('free-shipping/review', orderId ? { orderId } : undefined);
      if (id === request.current) setRows(response.data.results || []);
    } catch (err) { if (id === request.current) setError(errorText(err)); }
    finally { if (id === request.current) setLoading(false); }
  };
  useEffect(() => { if (open) load(); return () => { request.current++; }; }, [open, orderId]);
  const visible = useMemo(() => rows.filter(row => (!onlyReady || !row.blocked) &&
    (!search.trim() || `${row.orderNumber} ${row.tracking} ${name(row)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [rows, search, onlyReady]);
  const selectable = visible.filter(row => !row.blocked).slice(0, 100);
  const chosen = rows.filter(row => selected.includes(row.key) && !row.blocked);
  const allSelected = !!selectable.length && selectable.every(row => selected.includes(row.key));
  const close = () => { if (!busy.current) { setOpen(false); setReview(null); } };
  const apply = async () => {
    if (busy.current || !review?.length || !confirmed || !reason.trim()) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const response = await acc.post('free-shipping/apply', {
        items: review.map(row => ({ orderId: row.orderId, packageId: row.packageId, fingerprint: row.fingerprint })),
        reason: reason.trim(), confirmFreeShipping: true,
      });
      setSuccess(`تم اعتماد الشحن المجاني لـ${response.data.packages} طرد، وتصحيح المطالبات والإيرادات والتكاليف المرتبطة.`);
      setReview(null); setSelected([]); setConfirmed(false); setReason('');
      onApplied?.(); await load();
    } catch (err) { setError(errorText(err)); }
    finally { busy.current = false; setSaving(false); }
  };
  if (!access.can('reports') && !access.isOwner) return null;
  return <>
    <Button type="button" size="small" variant="outlined" disabled={disabled} onClick={() => { setOpen(true); setSuccess(''); }}>
      {orderId ? 'شحن مجاني ضمن عرض الشراء' : 'مراجعة الشحن المجاني للطلبيات القديمة'}
    </Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="lg" dir="rtl" aria-labelledby="free-shipping-title">
      <DialogTitle id="free-shipping-title">{review ? 'تأكيد الشحن المجاني وأثره المحاسبي' : 'مراجعة عروض الشحن المجاني'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {!review ? <>
          <Alert severity="info" sx={{ mb: 2 }}>اختر فقط الطرود المؤكد أنها ضمن عرض شحن مجاني. عدم الدفع وحده لا يعني أن الشحن مجاني. رسوم النقل الداخلي والتخليص تبقى كما هي.</Alert>
          <FilterBar>
            <TextField size="small" label="رقم الطلبية أو التتبع أو العميل" value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }} />
            <FormControlLabel label="القابلة للمعالجة فقط" control={<Checkbox checked={onlyReady} onChange={(_, checked) => { setOnlyReady(checked); setSelected([]); }} />} />
            <Button size="small" disabled={loading || saving} onClick={load}>تحديث</Button>
            <span>{visible.length} طرد من {rows.length}</span>
          </FilterBar>
          <DataTable dense loading={loading} rows={visible} rowKey={(row: Row) => row.key} maxHeight={400}
            empty={{ title: 'لا توجد طرود بهذه الفلاتر', hint: 'ألغِ خيار القابلة للمعالجة فقط لعرض أسباب الاستبعاد والعروض المعتمدة.' }} columns={[
              ...(access.isOwner ? [{ key: 'select', header: <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && selected.length > 0}
                disabled={loading || saving || !!error || !selectable.length} inputProps={{ 'aria-label': 'اختيار أول 100 طرد متاح' }}
                onChange={(_, checked) => setSelected(checked ? selectable.map(row => row.key) : [])} />,
              render: (row: Row) => <Checkbox size="small" checked={selected.includes(row.key)} disabled={loading || saving || !!error || !!row.blocked || (!selected.includes(row.key) && selected.length >= 100)}
                inputProps={{ 'aria-label': `اعتماد عرض شحن مجاني للطرد ${row.tracking || row.packageId}` }}
                onChange={(_, checked) => setSelected(before => checked ? [...before, row.key] : before.filter(key => key !== row.key))} /> }] : []),
              { key: 'order', header: 'الطلبية والعميل', render: (row: Row) => <><Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open><Sub>{name(row)}</Sub><Sub><Ltr>{row.tracking}</Ltr></Sub></> },
              { key: 'invoice', header: 'فاتورة الشراء', numeric: true, render: (row: Row) => money(row.invoiceMinor) },
              { key: 'charge', header: 'أجرة الشحن', numeric: true, render: (row: Row) => money(row.chargeMinor) },
              { key: 'paid', header: 'المحصّل', numeric: true, render: (row: Row) => money(row.paidMinor) },
              { key: 'remaining', header: 'المتبقي', numeric: true, render: (row: Row) => money(row.openMinor) },
              { key: 'revenue', header: 'إيراد سيُعكس', numeric: true, render: (row: Row) => money(row.revenueMinor) },
              { key: 'cost', header: 'تكلفة على الفاتورة', numeric: true, render: (row: Row) => money(row.purchaseCostMinor) },
              { key: 'state', header: 'الحالة', render: (row: Row) => <>{row.enabled ? <Badge tone="ok">عرض معتمد</Badge> : row.blocked ? <Badge tone="warn">تحتاج مراجعة</Badge> : <Badge tone="muted">متاح للاختيار</Badge>}<Sub>{row.blocked || (row.delivered ? 'تم تسليم الطرد' : 'قبل التسليم')}{row.offerReason ? ` · ${row.offerReason}` : ''}</Sub></> },
            ]} />
          {chosen.length > 0 && <p>المختار: {chosen.length} طرد · إلغاء مطالبات {money(total(chosen, 'openMinor'))} · عكس إيراد {money(total(chosen, 'revenueMinor'))} · تكلفة على فواتير الشراء {money(total(chosen, 'purchaseCostMinor'))}</p>}
        </> : <>
          <Alert severity="warning" sx={{ mb: 2 }}>سيصبح شحن الطرود المختارة مجانيًا. تُلغى المطالبة والإيراد الخاطئ بقيود تصحيح، وتُحمّل تكلفة الرحلة على فاتورة الشراء. قيمة الفاتورة المدفوعة ومحفظة العميل لا تتغيران.</Alert>
          <DataTable dense rows={review} rowKey={(row: Row) => row.key} maxHeight={300} columns={[
            { key: 'order', header: 'الطلبية / التتبع', render: (row: Row) => <><Ltr>{row.orderNumber}</Ltr><Sub><Ltr>{row.tracking}</Ltr></Sub></> },
            { key: 'claim', header: 'مطالبة ستُلغى', numeric: true, render: (row: Row) => money(row.openMinor) },
            { key: 'revenue', header: 'إيراد سيُعكس', numeric: true, render: (row: Row) => money(row.revenueMinor) },
            { key: 'cost', header: 'تكلفة فاتورة الشراء', numeric: true, render: (row: Row) => money(row.purchaseCostMinor) },
            { key: 'profit', header: 'أثر ربح الطلبية', numeric: true, render: (row: Row) => money(row.profitImpactMinor) },
            { key: 'day', header: 'تاريخ التصحيح', render: (row: Row) => <Ltr>{row.postingDay}</Ltr> },
          ]} footer={{ order: `إجمالي ${review.length} طرد`, claim: money(total(review, 'openMinor')), revenue: money(total(review, 'revenueMinor')), cost: money(total(review, 'purchaseCostMinor')), profit: money(total(review, 'profitImpactMinor')) }} />
          <p>الحسابات: ذمم العملاء، إيرادات الشحن، وتكلفة فواتير الشراء (510400). تبقى القيود الأصلية محفوظة، وتُلغى الدفعة كاملة إذا فشلت أي معالجة.</p>
          <TextField fullWidth required label="سبب العرض أو تصحيح البيانات القديمة" multiline minRows={2} value={reason} disabled={saving}
            onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 1000 }} />
          <FormControlLabel label="راجعت الاختيارات وأؤكد أن الشحن مجاني فعلًا، وليس دينًا مطلوبًا من العميل" control={<Checkbox checked={confirmed} disabled={saving} onChange={(_, checked) => setConfirmed(checked)} />} />
        </>}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>إغلاق</Button>
        {review ? <><Button onClick={() => setReview(null)} disabled={saving}>العودة للاختيار</Button><Button variant="contained" disabled={saving || !confirmed || !reason.trim()} onClick={apply}>{saving ? 'جارٍ الاعتماد…' : `اعتماد ${review.length} طرد`}</Button></>
          : access.isOwner && <Button variant="contained" disabled={loading || saving || !!error || !chosen.length} onClick={() => { setReview(chosen); setReason(''); setConfirmed(false); }}>مراجعة المختار ({chosen.length})</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
