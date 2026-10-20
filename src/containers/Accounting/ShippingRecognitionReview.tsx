import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { DataTable, Ltr, Money, Stat, StatGrid } from './ui';

export default function ShippingRecognitionReview({ onApplied }: { onApplied: () => void }) {
  const access = useAccountingAccess();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const busy = useRef(false);
  const preview = async () => {
    if (busy.current) return;
    busy.current = true;
    setOpen(true); setLoading(true); setData(null); setError(''); setResult(null); setReviewed(false); setSelected([]);
    try { setData((await acc.get('shipping-recognition/review')).data); }
    catch (err) { setError(errorText(err)); }
    finally { setLoading(false); busy.current = false; }
  };
  const apply = async () => {
    if (busy.current || !reviewed || !selected.length || !data) return;
    busy.current = true; setSaving(true); setError('');
    try {
      setResult((await acc.post('shipping-recognition/apply', { orderIds: selected, fingerprint: data.fingerprint })).data);
      onApplied();
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); busy.current = false; }
  };
  const close = () => { if (!busy.current) setOpen(false); };
  const selectedRows = (data?.rows || []).filter((row: any) => selected.includes(String(row.orderId)));
  const sum = (key: string) => selectedRows.reduce((total: number, row: any) => total + Number(row[key] || 0), 0);
  return <>
    <Button size="small" variant="outlined" onClick={preview}>مراجعة التسليمات القديمة</Button>
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" dir="rtl">
      <DialogTitle>مراجعة إيرادات التسليمات القديمة</DialogTitle>
      <DialogContent>
        <p>طرود مسلّمة ما زال إيرادها مؤجلًا في الدفاتر. تعرض المعاينة أثر احتساب الإيراد والتكلفة عند التسليم، دون تغيير المحفظة أو المبلغ المطلوب من العميل.</p>
        {error && <Alert severity="error">{error}</Alert>}
        {result ? <Alert severity="success">تمت تسوية {result.orders} طلبية بتاريخ {result.day} وتسجيل {result.entries} قيدًا. لم تُعدّل تواريخ القيود السابقة.</Alert> : <>
          {data && <>
            <p>{data.packages} طردًا في {data.orders} طلبية تحتاج مراجعة. اختر الطلبيات المراد تطبيق التسوية عليها، بحد أقصى 100 في كل دفعة.</p>
            <StatGrid>
              <Stat label="زيادة الإيراد للمحدد" value={<Money value={sum('revenueToRecognize')} />} />
              <Stat label="تحميل تكلفة للمحدد" value={<Money value={sum('costToRecognize')} />} />
              <Stat label="أثر الربح للمحدد" value={<Money value={sum('profitImpact')} />} />
            </StatGrid>
          </>}
          <DataTable dense loading={loading} rows={data?.rows || []} rowKey={(row: any) => String(row.packageId)} maxHeight={360}
            empty={{ title: 'لا توجد تسليمات قديمة تحتاج تسوية' }}
            columns={[
              { key: 'select', header: 'اختيار', render: (row: any) => <Checkbox size="small" checked={selected.includes(String(row.orderId))}
                disabled={!access.isOwner || saving || (!selected.includes(String(row.orderId)) && selected.length >= 100)}
                inputProps={{ 'aria-label': `اختيار الطلبية ${row.orderNumber}` }}
                onChange={(_, checked) => { const id = String(row.orderId); setSelected(before => checked ? Array.from(new Set([...before, id])) : before.filter(value => value !== id)); setReviewed(false); }} /> },
              { key: 'order', header: 'الطلبية', render: (row: any) => <Ltr>{row.orderNumber}</Ltr> },
              { key: 'tracking', header: 'التتبع', render: (row: any) => <Ltr>{row.tracking || '—'}</Ltr> },
              { key: 'revenue', header: 'زيادة الإيراد', numeric: true, render: (row: any) => <Money value={row.revenueToRecognize} /> },
              { key: 'cost', header: 'تحميل التكلفة', numeric: true, render: (row: any) => <Money value={row.costToRecognize} /> },
              { key: 'profit', header: 'أثر الربح', numeric: true, render: (row: any) => <Money value={row.profitImpact} /> },
            ]} />
          {!!data?.rows?.length && <Alert severity="info" sx={{ mt: 2 }}>تُسجل فروق التسوية في الفترة المفتوحة الحالية. عند إقفالها يستخدم النظام أول يوم مفتوح. القيود السابقة تبقى محفوظة، ولا تُنشأ دفعات أو ديون جديدة.</Alert>}
          {access.isOwner && !!selected.length && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={reviewed} disabled={saving} onChange={(_, checked) => setReviewed(checked)} />} label="راجعت أثر التسوية للطلبيات المختارة" />}
          {!access.isOwner && <p>تطبيق التسوية متاح لمالك النظام.</p>}
        </>}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={loading || saving}>إغلاق</Button>
        {!result && error && <Button onClick={preview} disabled={saving || loading}>تحديث المعاينة</Button>}
        {!result && access.isOwner && <Button variant="contained" onClick={apply} disabled={loading || saving || !reviewed || !selected.length}>{saving ? 'جارٍ تسجيل التسوية…' : 'تطبيق التسوية للمحدد'}</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
