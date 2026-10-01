import { useEffect, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, TextField,
} from '@mui/material';
import { acc, errorText } from './accountingApi';
import { StatusBadge } from './ui';
import { useAccountingAccess } from './useAccountingAccess';

export const StatusChip = ({ status }: { status: string }) => <StatusBadge status={status} />;

// Cancels any posted accounting document: a reversing entry is posted, the document stays as
// "cancelled". The reason is required; the server refuses when something depends on it.
export const CancelDialog = ({
  open, onClose, onDone, model, id, title, askConfirm,
}: {
  open: boolean; onClose: () => void; onDone: () => void; model: string; id: string; title: string; askConfirm?: string;
}) => {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Cancelling is its own permission (the owner and the accountant), apart from entering documents
  const access = useAccountingAccess();
  const allowed = access.loading || access.can('cancel');

  useEffect(() => { if (open) { setReason(''); setError(''); setConfirm(false); } }, [open]);

  const submit = async () => {
    try {
      setIsSaving(true);
      setError('');
      await acc.post(`documents/${model}/${id}/cancel`, { reason, confirm });
      onDone();
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth dir="rtl">
      <DialogTitle>إلغاء {title}</DialogTitle>
      <DialogContent>
        <p className="acc-muted mb-3">سيُنشأ قيد عكسي يلغي أثر المستند في الدفاتر، ويبقى المستند ظاهراً بحالة «ملغى». لا يمكن التراجع عن الإلغاء؛ لإعادته أنشئ مستنداً جديداً.</p>
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}
        {!allowed && <Alert severity="warning" className="mb-3">إلغاء المستندات المُرحَّلة يحتاج صلاحية «إلغاء المستندات المُرحَّلة». اطلبه من المحاسب أو المالك.</Alert>}
        <TextField label="سبب الإلغاء" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} required />
        {askConfirm && <FormControlLabel className="mt-2" control={<Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />} label={askConfirm} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>تراجع</Button>
        <Button color="error" variant="contained" disabled={!allowed || !reason.trim() || isSaving} onClick={submit}>تأكيد الإلغاء</Button>
      </DialogActions>
    </Dialog>
  );
};

// Autocomplete that searches the server as the admin types
export const RemotePicker = ({
  endpoint, value, onChange, label, getLabel, params = {}, minLength = 2, disabled,
}: {
  endpoint: string; value: any; onChange: (value: any) => void; label: string; getLabel: (item: any) => string;
  params?: any; minLength?: number; disabled?: boolean;
}) => {
  const [options, setOptions] = useState<any[]>([]);
  const timer = useRef<any>();
  const search = (text: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (text.trim().length < minLength) return;
      try {
        const res = await acc.get(endpoint, { ...params, search: text });
        setOptions(res.data.results);
      } catch { /* keeps the previous options */ }
    }, 300);
  };
  useEffect(() => {
    if (minLength === 0) acc.get(endpoint, params).then((res: any) => setOptions(res.data.results)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);
  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      options={options}
      value={value}
      noOptionsText={minLength ? 'اكتب للبحث' : 'لا توجد نتائج'}
      filterOptions={minLength === 0 ? undefined : (x) => x}
      getOptionLabel={(item: any) => (item ? getLabel(item) : '')}
      isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
      onInputChange={(_, text) => search(text)}
      onChange={(_, item) => onChange(item)}
      renderInput={(props) => <TextField {...props} label={label} />}
    />
  );
};

export const userLabel = (user: any) => `${user.customerId ? `${user.customerId} ` : ''}${user.firstName} ${user.lastName}`;
export const tripLabel = (trip: any) => `${trip.voyage} · ${trip.shippingType === 'air' ? 'جوي' : trip.shippingType === 'sea' ? 'بحري' : 'داخلي'}${trip.status === 'finished' ? ' (مكتملة)' : ''}`;
export const orderLabel = (order: any) => `${order.orderId} · ${order.customerInfo?.fullName || ''}`;

export const useVendors = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const reload = () => acc.get('vendors', { active: 'true' }).then((res: any) => setVendors(res.data.results)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return { vendors, reload };
};

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const Message = ({ message, onClose }: { message: { type: 'error' | 'success'; text: string } | null; onClose: () => void }) => (
  message ? <Alert severity={message.type} className="mb-3" onClose={onClose}>{message.text}</Alert> : null
);

export const VENDOR_TYPES: Record<string, string> = { carrier: 'شركة شحن', supplier: 'مورد', service: 'مقدم خدمة', other: 'أخرى' };
export const SHIPPING_TYPES: Record<string, string> = { air: 'جوي', sea: 'بحري', domestic: 'داخلي' };
