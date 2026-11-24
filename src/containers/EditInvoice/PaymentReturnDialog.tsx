import { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import { errorText, newKey, sys } from '../Accounting/accountingApi';

// Gives back part of what the customer paid on the purchase invoice to their wallet, with a
// description (owner 2026-11-25): the invoice lowered after it was paid (200$ paid, now 180$), the
// 20$ goes back without cancelling the 200$ payment. The API caps it at the money paid on the
// invoice, less earlier returns and supplier refunds; points paid on it are never given back as money.
// The amount starts at what was paid beyond the invoice; more than that makes the invoice owed again.

type Room = { returnableUsd: number, extraUsd: number, pointsUsd: number };
type Props = { orderId: string, open: boolean, onClose: () => void, onDone: (message: string) => void };

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (value: number) => Math.round(value * 100) / 100;

const PaymentReturnDialog = ({ orderId, open, onClose, onDone }: Props) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey());

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setRoom(null); setLoadError(''); setError(''); setDescription('');
    key.current = newKey();
    sys.get(`acc/orders/${orderId}/payment-returns`)
      .then((res: any) => {
        if (stale) return;
        const next: Room = { returnableUsd: Number(res.data?.returnableUsd) || 0, extraUsd: Number(res.data?.extraUsd) || 0, pointsUsd: Number(res.data?.pointsUsd) || 0 };
        setRoom(next);
        setAmount(next.extraUsd > 0 ? String(round2(next.extraUsd)) : '');
      })
      .catch((err: any) => { if (!stale) setLoadError(errorText(err, 'تعذّر قراءة المدفوع على الفاتورة.')); });
    return () => { stale = true; };
  }, [open, orderId]);

  const value = Number(amount) || 0;
  const reopened = room ? round2(value - room.extraUsd) : 0;
  const problem = !room ? '' : value <= 0 ? (amount ? 'اكتب مبلغاً أكبر من صفر.' : '')
    : value > room.returnableUsd + 1e-9 ? `أقصى ما يُرجع $${money(room.returnableUsd)}.` : '';
  const canSave = !!room && value > 0 && !problem && !!description.trim() && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await sys.post(`acc/orders/${orderId}/payment-returns`, { amount: value, description: description.trim(), idempotencyKey: key.current });
      onDone(`أُرجع $${money(value)} إلى محفظة العميل`);
      onClose();
    } catch (err: any) {
      setError(errorText(err));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="xs" dir="rtl">
      <DialogTitle>إرجاع مبلغ من دفعات الفاتورة</DialogTitle>
      <DialogContent>
        <p className="op-muted" style={{ marginTop: 0 }}>يُضاف المبلغ لمحفظة العميل بسطر واحد في كشف حسابه، وتبقى الدفعة الأصلية كما هي.</p>
        {loadError && <Alert severity="error" className="mb-2">{loadError}</Alert>}
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        {!room && !loadError && <CircularProgress size={20} />}
        {room && (
          <>
            {room.returnableUsd <= 0 ? (
              <Alert severity="info" className="mb-2">لا يوجد مبلغ يمكن إرجاعه من هذه الفاتورة.</Alert>
            ) : (
              <Alert severity={room.extraUsd > 0 ? 'success' : 'info'} className="mb-2">
                {room.extraUsd > 0 ? <>دفع العميل <b dir="ltr">${money(room.extraUsd)}</b> أكثر من قيمة الفاتورة. </> : <>لم يدفع العميل أكثر من قيمة الفاتورة. </>}
                أقصى ما يُرجع <b dir="ltr">${money(room.returnableUsd)}</b>.
              </Alert>
            )}
            {room.pointsUsd > 0 && (
              <Alert severity="warning" className="mb-2">
                دفع <b dir="ltr">${money(room.pointsUsd)}</b> بالنقاط: لا تُرجع فلوساً. لإرجاعها ألغِ النقاط من قسم النقاط في هذه الصفحة.
              </Alert>
            )}
            <TextField
              fullWidth className="mt-2" type="number" label="المبلغ" value={amount} disabled={saving || room.returnableUsd <= 0}
              onChange={(e) => { setAmount(e.target.value); setError(''); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
              inputProps={{ min: 0, step: 'any', dir: 'ltr' }} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              error={!!problem} helperText={problem || ' '}
            />
            {value > 0 && !problem && reopened > 0.005 && (
              <Alert severity="warning" className="mb-2">
                المبلغ أكبر من الزائد بـ <b dir="ltr">${money(reopened)}</b>: يصبح هذا المبلغ مستحقاً على العميل في الفاتورة من جديد.
              </Alert>
            )}
            <TextField
              fullWidth className="mt-2" label="البيان (سبب الإرجاع)" value={description} disabled={saving || room.returnableUsd <= 0} dir="auto"
              placeholder="مثلاً: نزل سعر الفاتورة من 200 إلى 180" onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 300 }}
              helperText="يظهر للعميل في كشف حسابه"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>تراجع</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>
          {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : value > 0 ? `أرجِع $${money(value)}` : 'أرجِع'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentReturnDialog;
