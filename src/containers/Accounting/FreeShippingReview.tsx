import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { Badge, DataTable, FilterBar, Ltr, Money, Open, Panel, Sub } from './ui';

type Row = {
  key: string; orderId: string; packageId: string; orderNumber: string; tracking: string; customer: any;
  date: string; invoiceMinor: number; chargeMinor: number; billedMinor: number; openMinor: number; paidMinor: number;
  revenueMinor: number; purchaseCostMinor: number; profitImpactMinor: number; blocked: string;
  enabled: boolean; offerReason: string; delivered: boolean; postingDay: string; fingerprint: string;
  invoiceType: 'purchase' | 'combined';
};
const money = (value: number) => <Money value={value} />;
const name = (row: Row) => `${row.customer?.customerId || ''} ${row.customer?.firstName || ''} ${row.customer?.lastName || ''}`.trim();
const total = (rows: Row[], key: 'openMinor' | 'revenueMinor' | 'purchaseCostMinor' | 'profitImpactMinor') => rows.reduce((sum, row) => sum + row[key], 0);

export default function FreeShippingReview({ orderId, disabled = false, onApplied, card = false, revision = 0, onCompared }: {
  orderId?: string; disabled?: boolean; onApplied?: () => void; card?: boolean; revision?: number; onCompared?: (count: number | null) => void;
}) {
  const access = useAccountingAccess();
  const canView = access.can('reports') || access.isOwner;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [invoiceType, setInvoiceType] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState<Row[] | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setSelected([]);
    try {
      const response = await acc.get('free-shipping/review', orderId ? { orderId } : undefined);
      if (id === request.current) {
        const next: Row[] = response.data.results || [];
        setRows(next); onCompared?.(new Set(next.map(row => row.orderId)).size);
      }
    } catch (err) { if (id === request.current) { setError(errorText(err)); onCompared?.(null); } }
    finally { if (id === request.current) setLoading(false); }
  }, [orderId, onCompared]);
  useEffect(() => {
    if (canView && (card || open)) void load();
    return () => { request.current++; };
  }, [canView, card, open, revision, load]);
  const orderRows = useMemo(() => {
    const grouped = new Map<string, { orderId: string; orderNumber: string; customer: string; packages: number; open: number; revenue: number; cost: number }>();
    rows.forEach(row => {
      const entry = grouped.get(row.orderId) || { orderId: row.orderId, orderNumber: row.orderNumber, customer: name(row), packages: 0, open: 0, revenue: 0, cost: 0 };
      entry.packages++; entry.open += row.openMinor; entry.revenue += row.revenueMinor; entry.cost += row.purchaseCostMinor;
      grouped.set(row.orderId, entry);
    });
    return Array.from(grouped.values());
  }, [rows]);
  const visible = useMemo(() => rows.filter(row => (!onlyReady || !row.blocked) && (!invoiceType || row.invoiceType === invoiceType) &&
    (!search.trim() || `${row.orderNumber} ${row.tracking} ${name(row)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [rows, search, onlyReady, invoiceType]);
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
  if (!canView || (card && !error && !rows.length)) return null;
  const launcher = <Button type="button" size="small" variant="outlined" disabled={disabled || (card && loading)} onClick={() => {
    setSearch(''); setInvoiceType(''); setOnlyReady(false); setSelected([]); setReview(null); setOpen(true); setSuccess('');
  }}>
    {orderId ? 'شحن مجاني ضمن عرض الشراء' : 'مراجعة الطلبيات'}
  </Button>;
  return <>
    {card ? <Panel flush title={<><Badge tone="warn">للمراجعة</Badge> مراجعة الشحن المجاني ({orderRows.length} طلبية · {rows.length} طرد)</>}
      subtitle="فواتير شراء بها بيانات شحن؛ راجع العروض قبل إلغاء أي مطالبة. وجودها هنا لا يثبت أن الشحن مجاني."
      actions={<><Button size="small" disabled={loading || saving} onClick={load}>تحديث</Button>{launcher}</>}>
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      {!!orderRows.length && <DataTable dense rows={orderRows.slice(0, 10)} rowKey={row => row.orderId} maxHeight={260}
        caption={orderRows.length > 10 ? `تُعرض أول 10 طلبيات من ${orderRows.length}. افتح المراجعة لعرض البقية.` : undefined} columns={[
          { key: 'order', header: 'الطلبية', render: row => <><Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open><Sub>{row.customer}</Sub></> },
          { key: 'packages', header: 'الطرود', numeric: true, render: row => row.packages },
          { key: 'open', header: 'مطالبات الشحن', numeric: true, render: row => money(row.open) },
          { key: 'revenue', header: 'إيراد الشحن المسجل', numeric: true, render: row => money(row.revenue) },
          { key: 'cost', header: 'تكلفة الشحن', numeric: true, render: row => money(row.cost) },
        ]} />}
    </Panel> : launcher}
    <Dialog open={open} onClose={close} fullWidth maxWidth="lg" dir="rtl" aria-labelledby="free-shipping-title">
      <DialogTitle id="free-shipping-title">{review ? 'تأكيد الشحن المجاني وأثره المحاسبي' : 'مراجعة عروض الشحن المجاني'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {!review ? <>
          <Alert severity="info" sx={{ mb: 2 }}>تظهر فواتير الشراء التي تحتوي رقم تتبع أو وزنًا أو ربطًا برحلة، حتى إن كانت مصنفة «شراء» فقط. روابط الشراء الخالية من بيانات الشحن مستبعدة. راجع العرض قبل اعتماده؛ وجود شحنة أو عدم الدفع لا يثبت المجانية.</Alert>
          <FilterBar>
            <TextField size="small" label="رقم الطلبية أو التتبع أو العميل" value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }} />
            {!orderId && <TextField select size="small" label="تصنيف الفاتورة" value={invoiceType} onChange={e => { setInvoiceType(e.target.value); setSelected([]); }} sx={{ minWidth: 180 }}>
              <MenuItem value="purchase">شراء فقط وبها شحنة</MenuItem><MenuItem value="combined">شراء وشحن</MenuItem><MenuItem value="">الكل وبها بيانات شحن</MenuItem>
            </TextField>}
            <FormControlLabel label="القابلة للمعالجة فقط" control={<Checkbox checked={onlyReady} onChange={(_, checked) => { setOnlyReady(checked); setSelected([]); }} />} />
            <Button size="small" disabled={loading || saving} onClick={load}>تحديث</Button>
            <span>المعروض: {new Set(visible.map(row => row.orderId)).size} طلبية · {visible.length} طرد
              {visible.length !== rows.length && <> — الإجمالي: {orderRows.length} طلبية · {rows.length} طرد</>}</span>
          </FilterBar>
          <DataTable dense loading={loading} rows={visible} rowKey={(row: Row) => row.key} maxHeight={400}
            empty={{ title: 'لا توجد طلبيات بهذه الفلاتر', hint: 'غيّر البحث أو تصنيف الفاتورة. تظهر فقط فواتير الشراء التي بها بيانات شحنة فعلية.' }} columns={[
              ...(access.isOwner ? [{ key: 'select', header: <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && selected.length > 0}
                disabled={loading || saving || !!error || !selectable.length} inputProps={{ 'aria-label': 'اختيار أول 100 طرد متاح' }}
                onChange={(_, checked) => setSelected(checked ? selectable.map(row => row.key) : [])} />,
              render: (row: Row) => <Checkbox size="small" checked={selected.includes(row.key)} disabled={loading || saving || !!error || !!row.blocked || (!selected.includes(row.key) && selected.length >= 100)}
                inputProps={{ 'aria-label': `اعتماد عرض شحن مجاني للطرد ${row.tracking || row.packageId}` }}
                onChange={(_, checked) => setSelected(before => checked ? [...before, row.key] : before.filter(key => key !== row.key))} /> }] : []),
              { key: 'order', header: 'الطلبية والعميل', render: (row: Row) => <><Open to={`/invoice/${row.orderId}/edit`}><Ltr>{row.orderNumber}</Ltr></Open><Sub>{name(row)}</Sub><Sub>{row.invoiceType === 'purchase' ? 'شراء فقط وبها بيانات شحن' : 'شراء وشحن'}</Sub><Sub><Ltr>{row.tracking}</Ltr></Sub></> },
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
