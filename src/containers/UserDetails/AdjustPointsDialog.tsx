import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { money, pointsText } from '../Loyalty/format';
import { LoyaltyRtl, Num, useDialogMotion } from '../Loyalty/LoyaltyRtl';
import '../Loyalty/loyalty.scss';

type Props = {
  open: boolean
  userId: string
  // The customer's points now
  balance: number
  onClose: () => void
  onSaved: () => void
}

type Mode = 'add' | 'deduct';
const MODES: [Mode, string][] = [['add', 'إضافة'], ['deduct', 'خصم']];
// Quick amounts, added to what is typed
const STEPS = [100, 500, 1000];
// Common reasons, one click fills the field
const REASONS: Record<Mode, string[]> = {
  add: ['مكافأة عميل', 'تعويض', 'عرض ترويجي'],
  deduct: ['تصحيح خطأ إدخال', 'نقاط أُضيفت بالخطأ'],
};

// Staff add points to a customer or take points away, with the reason written down
const AdjustPointsDialog = ({ open, userId, balance, onClose, onSaved }: Props) => {
  const motion = useDialogMotion();
  const [mode, setMode] = useState<Mode>('add');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('add');
    setValue('');
    setReason('');
    setError('');
  }, [open]);

  const points = Number(value) || 0;
  const invalid = value !== '' && (!Number.isInteger(points) || points <= 0);
  const tooMany = mode === 'deduct' && points > balance;
  const after = balance + (mode === 'add' ? points : -points);
  const canSave = points > 0 && !invalid && !tooMany && !!reason.trim() && !isSaving;
  // What a quick amount adds to (a broken entry starts again from zero)
  const base = invalid ? 0 : points;

  const save = async () => {
    setError('');
    setIsSaving(true);
    try {
      await api.post(`user/${userId}/loyalty/adjust`, { points: mode === 'add' ? points : -points, reason: reason.trim() });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(requestError(e, 'تعذّر تعديل النقاط.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LoyaltyRtl>
      <Dialog
        open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="xs" dir="rtl"
        PaperProps={{ className: 'lp lp-dialog' }} {...motion}
      >
        <DialogTitle>تعديل النقاط</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" dir="auto">{error}</Alert>}
          <div className="lp-segment lp-segment--full" role="group" aria-label="إضافة أو خصم">
            {MODES.map(([next, label]) => (
              <button key={next} type="button" aria-pressed={mode === next} disabled={isSaving} onClick={() => setMode(next)}>{label}</button>
            ))}
          </div>
          <div>
            <TextField
              fullWidth autoFocus label={mode === 'add' ? 'النقاط المضافة' : 'النقاط المخصومة'} type="number" value={value} disabled={isSaving}
              onChange={(event) => setValue(event.target.value)} onWheel={(event: any) => event.target.blur()}
              inputProps={{ min: 1, step: 1, dir: 'ltr' }} InputProps={{ endAdornment: <InputAdornment position="end">نقطة</InputAdornment> }}
              error={invalid || tooMany}
              helperText={tooMany ? <>لدى العميل <Num>{pointsText(balance)}</Num> نقطة فقط</> : invalid ? 'أرقام صحيحة أكبر من صفر' : ''}
            />
            <div className="lp-quick" role="group" aria-label="مبالغ سريعة">
              {STEPS.map((step) => (
                <button
                  key={step} type="button" className="lp-chip lp-press"
                  disabled={isSaving || (mode === 'deduct' && base + step > balance)}
                  onClick={() => setValue(String(base + step))}
                >
                  <Num>+{pointsText(step)}</Num>
                </button>
              ))}
            </div>
          </div>
          <div>
            <TextField
              fullWidth required multiline minRows={2} label="السبب" dir="auto" value={reason} disabled={isSaving}
              onChange={(event) => setReason(event.target.value)} error={points > 0 && !reason.trim()} helperText={points > 0 && !reason.trim() ? 'السبب إجباري' : ''}
            />
            <div className="lp-quick" role="group" aria-label="أسباب مقترحة">
              {REASONS[mode].map((text) => (
                <button key={text} type="button" className="lp-chip lp-press" aria-pressed={reason === text} disabled={isSaving} onClick={() => setReason(text)}>{text}</button>
              ))}
            </div>
          </div>
          <div className="lp-preview" aria-live="polite">
            <span className="lp-label">الرصيد الجديد</span>
            <Num className="lp-preview__now">{pointsText(balance)}</Num>
            <span className="lp-preview__arrow" aria-hidden="true">←</span>
            <span className="lp-preview__next"><Num>{pointsText(Math.max(0, after))}</Num> نقطة</span>
            <span className="lp-preview__usd">(<Num>${money(Math.max(0, after) / 100)}</Num>)</span>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button variant="contained" onClick={save} disabled={!canSave}>{isSaving ? 'جارٍ الحفظ' : 'حفظ'}</Button>
        </DialogActions>
      </Dialog>
    </LoyaltyRtl>
  );
};

export default AdjustPointsDialog;
