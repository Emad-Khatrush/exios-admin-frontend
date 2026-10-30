import { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Amount, Ltr } from './ui';

type Props = { billId: string | null; onClose: () => void; onDone: () => void | Promise<void> };

export default function BillDetailsEditDialog({ billId, onClose, onDone }: Props) {
  const [bill, setBill] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [revision, setRevision] = useState(0);
  const [editLock, setEditLock] = useState('');

  useEffect(() => {
    if (!billId) return;
    let active = true;
    setBill(null); setForm(null); setError(''); setEditLock(''); setLoading(true);
    Promise.all([acc.get(`bills/${billId}`), acc.get('vendors', { active: 'true' })]).then(([details, options]) => {
      if (!active) return;
      const current = details.data.bill;
      setEditLock(details.data.editLock || '');
      setBill(current);
      const supplier = current.vendorId;
      const list = options.data.results || [];
      setVendors(supplier?._id && !list.some((row: any) => row._id === supplier._id) ? [supplier, ...list] : list);
      setForm({ vendorId: supplier?._id || supplier, vendorRef: current.vendorRef || '', note: current.note || '', reason: '',
        updatedAt: current.updatedAt, descriptions: current.lines.map((line: any) => ({ id: line._id, description: line.description })) });
    }).catch(err => { if (active) setError(errorText(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [billId, revision]);

  const close = () => { if (!busy.current) onClose(); };
  const save = async () => {
    if (busy.current || !form || !billId || !form.reason.trim()) return;
    busy.current = true; setSaving(true); setError('');
    try {
      await acc.post(`bills/${billId}/edit-details`, form);
      await onDone();
      onClose();
    } catch (err) { setError(errorText(err)); }
    finally { busy.current = false; setSaving(false); }
  };

  return <Dialog open={!!billId} onClose={close} fullWidth maxWidth="sm" dir="rtl" aria-labelledby="bill-details-edit-title">
    <DialogTitle id="bill-details-edit-title">تعديل بيانات الفاتورة {bill && <Ltr>{bill.number}</Ltr>}</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {editLock && <Alert severity="warning" sx={{ mb: 2 }}>{editLock}؛ لا يمكن تعديل الفاتورة.</Alert>}
      {loading && <p role="status">جارٍ تحميل بيانات الفاتورة…</p>}
      {!loading && !form && error && <Button onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</Button>}
      {bill && form && <div className="d-flex flex-column gap-3">
        <p className="acc-muted mb-0"><Ltr>{bill.day}</Ltr> · <Amount value={bill.total} currency={bill.currency} /></p>
        <Alert severity="info">يُحفظ سبب التعديل في السجل. عند تغيير المورد تُحدّث الفاتورة ودفعاتها المرتبطة، مع تصحيح حساب المورد دون صرف مبلغ جديد.</Alert>
        <Autocomplete options={vendors} value={vendors.find(row => row._id === form.vendorId) || null} disabled={saving}
          getOptionLabel={option => option.name || ''} isOptionEqualToValue={(option, value) => option._id === value._id}
          onChange={(_, vendor) => setForm({ ...form, vendorId: vendor?._id || '' })}
          renderInput={params => <TextField {...params} label="المورد" required />} />
        <TextField label="رقم فاتورة المورد" value={form.vendorRef} disabled={saving} inputProps={{ maxLength: 200 }}
          onChange={event => setForm({ ...form, vendorRef: event.target.value })} />
        {form.descriptions.map((line: any, index: number) => <TextField key={line.id} label={form.descriptions.length > 1 ? `وصف السطر ${index + 1}` : 'الوصف'}
          required multiline minRows={2} value={line.description} disabled={saving} inputProps={{ maxLength: 1000 }}
          onChange={event => setForm({ ...form, descriptions: form.descriptions.map((row: any) => row.id === line.id ? { ...row, description: event.target.value } : row) })} />)}
        <TextField label="الملاحظات" multiline minRows={2} value={form.note} disabled={saving} inputProps={{ maxLength: 5000 }}
          onChange={event => setForm({ ...form, note: event.target.value })} />
        <TextField label="سبب التعديل" required multiline minRows={2} value={form.reason} disabled={saving} inputProps={{ maxLength: 1000 }}
          onChange={event => setForm({ ...form, reason: event.target.value })} />
      </div>}
    </DialogContent>
    <DialogActions>
      <Button onClick={close} disabled={saving}>إلغاء</Button>
      <Button variant="contained" onClick={save} disabled={!!editLock || loading || saving || !form?.vendorId || !form?.reason?.trim() || form?.descriptions?.some((row: any) => !row.description.trim())}>
        {saving ? 'جارٍ الحفظ…' : 'حفظ التعديل'}
      </Button>
    </DialogActions>
  </Dialog>;
}
