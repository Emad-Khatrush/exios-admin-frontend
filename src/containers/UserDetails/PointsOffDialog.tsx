import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { useDialogMotion } from '../Loyalty/LoyaltyRtl';

type Props = {
  open: boolean
  userId: string
  // true: the dialog switches the points off; false: back on
  turningOff: boolean
  onClose: () => void
  // The customer's points as the server returns them after the change
  onSaved: (data: any) => void
}

// Switching a customer's points off (a reason is required: partners on a special price, for whom
// the points would be a loss) or back on. PUT user/:id/loyalty/off
const PointsOffDialog = ({ open, userId, turningOff, onClose, onSaved }: Props) => {
  const motion = useDialogMotion();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setReason(''); setError(''); } }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.update(`user/${userId}/loyalty/off`, { off: turningOff, reason: reason.trim() });
      onSaved(res.data);
    } catch (e: any) {
      setError(requestError(e, turningOff ? 'تعذّر إيقاف النقاط.' : 'تعذّر تفعيل النقاط.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" dir="rtl" PaperProps={{ className: 'lp lp-dialog' }} {...motion}>
      <DialogTitle>{turningOff ? 'إيقاف النقاط لهذا العميل' : 'تفعيل النقاط لهذا العميل'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" dir="auto" sx={{ mb: 1.5 }}>{error}</Alert>}
        {turningOff ? (
          <>
            <ul className="lpx-off-list">
              <li>لا يكسب نقاطاً على طلبياته، حتى بعد إعادة التفعيل للطلبيات التي اكتملت أثناء الإيقاف.</li>
              <li>لا يمكن الدفع من نقاطه.</li>
              <li>تختفي النقاط من حسابه في التطبيق.</li>
              <li>رصيده الحالي يبقى كما هو ويعود عند التفعيل (وتنتهي صلاحيته كالعادة).</li>
            </ul>
            <TextField fullWidth required multiline minRows={2} label="السبب" dir="auto" value={reason} disabled={saving} sx={{ mt: 2 }}
              placeholder="مثال: شريك بسعر خاص" onChange={(event) => setReason(event.target.value)}
              helperText="يظهر للموظفين فقط" />
          </>
        ) : (
          <p className="lp-muted">يعود العميل يكسب النقاط على طلبياته الجديدة ويرى نقاطه في التطبيق، ويمكن الدفع من رصيده.</p>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>تراجع</Button>
        <Button variant="contained" color={turningOff ? 'error' : 'primary'} onClick={save} disabled={saving || (turningOff && !reason.trim())}>
          {saving ? 'جارٍ الحفظ' : turningOff ? 'إيقاف النقاط' : 'تفعيل النقاط'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PointsOffDialog;
