import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';

type Props = {
  open: boolean
  userId: string
  // The customer's points now
  balance: number
  onClose: () => void
  onSaved: () => void
}

const pointsText = (value: number) => Number(value || 0).toLocaleString('en-US');
const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Staff add points to a customer or take points away, with the reason written down
const AdjustPointsDialog = ({ open, userId, balance, onClose, onSaved }: Props) => {
  const [mode, setMode] = useState<'add' | 'deduct'>('add');
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
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Adjust points</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} dir="auto">{error}</Alert>}
        <ToggleButtonGroup exclusive fullWidth size="small" value={mode} onChange={(_, next) => { if (next) setMode(next); }} sx={{ mb: 2 }}>
          <ToggleButton value="add">Add</ToggleButton>
          <ToggleButton value="deduct">Deduct</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          fullWidth autoFocus label="Points" type="number" value={value} disabled={isSaving}
          onChange={(event) => setValue(event.target.value)} onWheel={(event: any) => event.target.blur()}
          inputProps={{ min: 1, step: 1 }} InputProps={{ endAdornment: <InputAdornment position="end">pts</InputAdornment> }}
          error={invalid || tooMany} helperText={tooMany ? `The customer has only ${pointsText(balance)} points` : invalid ? 'Whole points above zero' : ''}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth required multiline minRows={2} label="Reason" dir="auto" value={reason} disabled={isSaving}
          onChange={(event) => setReason(event.target.value)} error={points > 0 && !reason.trim()} helperText={points > 0 && !reason.trim() ? 'A reason is required' : ''}
        />
        <p style={{ margin: '16px 0 0' }}>
          New balance: <strong>{pointsText(Math.max(0, after))} pts (${money(Math.max(0, after) / 100)})</strong>
          <span style={{ opacity: 0.7 }}> from {pointsText(balance)}</span>
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>{isSaving ? 'Saving' : mode === 'add' ? 'Add points' : 'Deduct points'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdjustPointsDialog;
