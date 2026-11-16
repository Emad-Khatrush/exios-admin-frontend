import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';
import { money, pointsText } from '../Loyalty/format';
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
const MODES: [Mode, string][] = [['add', 'Add'], ['deduct', 'Deduct']];
// Quick amounts, added to what is typed
const STEPS = [100, 500, 1000];
// Common reasons, one click fills the field
const REASONS: Record<Mode, string[]> = {
  add: ['Customer reward', 'Compensation', 'Promotion'],
  deduct: ['Data-entry correction', 'Points given by mistake'],
};

// Staff add points to a customer or take points away, with the reason written down
const AdjustPointsDialog = ({ open, userId, balance, onClose, onSaved }: Props) => {
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
      setError(requestError(e, 'Could not adjust the points.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ className: 'lp lp-dialog' }}>
      <DialogTitle>Adjust points</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" dir="auto">{error}</Alert>}
        <div className="lp-segment lp-segment--full" role="group" aria-label="Add or deduct">
          {MODES.map(([next, label]) => (
            <button key={next} type="button" aria-pressed={mode === next} disabled={isSaving} onClick={() => setMode(next)}>{label}</button>
          ))}
        </div>
        <div>
          <TextField
            fullWidth autoFocus label={mode === 'add' ? 'Points to add' : 'Points to deduct'} type="number" value={value} disabled={isSaving}
            onChange={(event) => setValue(event.target.value)} onWheel={(event: any) => event.target.blur()}
            inputProps={{ min: 1, step: 1 }} InputProps={{ endAdornment: <InputAdornment position="end">pts</InputAdornment> }}
            error={invalid || tooMany} helperText={tooMany ? `The customer has only ${pointsText(balance)} points` : invalid ? 'Whole points above zero' : ''}
          />
          <div className="lp-quick" role="group" aria-label="Quick amounts">
            {STEPS.map((step) => (
              <button
                key={step} type="button" className="lp-chip lp-press"
                disabled={isSaving || (mode === 'deduct' && base + step > balance)}
                onClick={() => setValue(String(base + step))}
              >
                +{pointsText(step)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <TextField
            fullWidth required multiline minRows={2} label="Reason" dir="auto" value={reason} disabled={isSaving}
            onChange={(event) => setReason(event.target.value)} error={points > 0 && !reason.trim()} helperText={points > 0 && !reason.trim() ? 'A reason is required' : ''}
          />
          <div className="lp-quick" role="group" aria-label="Suggested reasons">
            {REASONS[mode].map((text) => (
              <button key={text} type="button" className="lp-chip lp-press" aria-pressed={reason === text} disabled={isSaving} onClick={() => setReason(text)}>{text}</button>
            ))}
          </div>
        </div>
        <div className="lp-preview" aria-live="polite">
          <span className="lp-label">New balance</span>
          <span className="lp-preview__now">{pointsText(balance)}</span>
          <span className="lp-preview__arrow" aria-hidden="true">→</span>
          <span className="lp-preview__next">{pointsText(Math.max(0, after))} pts</span>
          <span className="lp-preview__usd">(${money(Math.max(0, after) / 100)})</span>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>{isSaving ? 'Saving' : mode === 'add' ? 'Add points' : 'Deduct points'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdjustPointsDialog;
