import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { useState } from "react";
import api from "../../api";
import { Debt } from "../../models";
import { getErrorMessage } from "../../utils/errorHandler";
import { formatAmount } from "./wrapper-util";

type Props = {
  debt: Debt
  open: boolean
  onClose: () => void
  onClosed: () => void
}

// Above this share of the original amount we warn: the feature is meant for small leftovers
const LARGE_WRITE_OFF_SHARE = 0.1;

const CloseDebtDialog = (props: Props) => {
  const { debt } = props;
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const remaining = Number(debt.amount) || 0;
  const initialAmount = Number(debt.initialAmount) || 0;
  const paid = Math.max(initialAmount - remaining, 0);
  const writeOffShare = initialAmount > 0 ? remaining / initialAmount : 1;
  const isLargeWriteOff = writeOffShare > LARGE_WRITE_OFF_SHARE;

  const close = () => {
    if (isLoading) return;
    setNote('');
    setError(undefined);
    props.onClose();
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;

    try {
      setIsLoading(true);
      setError(undefined);
      await api.update(`balances/${debt._id}/close`, { note: note.trim() });
      setNote('');
      props.onClosed();
    } catch (error: any) {
      setError(getErrorMessage(error?.response?.data?.message));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={close}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>
          <span className="debt-dialog-title">
            <strong>Close debt manually</strong>
            <span>{debt.owner?.firstName} {debt.owner?.lastName} ({debt.owner?.customerId})</span>
          </span>
        </DialogTitle>

        <DialogContent>
          {error &&
            <Alert severity="error" className="mb-3">{error}</Alert>
          }

          <div className="debt-dialog-facts">
            <div>
              <span>Paid so far</span>
              <strong className="is-ok">{formatAmount(paid)} {debt.currency}</strong>
            </div>
            <div>
              <span>Moves to lost</span>
              <strong className="is-owed">{formatAmount(remaining)} {debt.currency}</strong>
            </div>
          </div>

          <p className="debt-dialog-copy">
            The debt will be marked as closed. The remaining {formatAmount(remaining)} {debt.currency} is
            recorded as a lost debt with your note. The customer's wallet is not charged.
          </p>

          {isLargeWriteOff &&
            <Alert severity="warning" className="mb-3">
              This is {Math.round(writeOffShare * 100)}% of the original debt. Manual closing is meant for small leftovers.
            </Alert>
          }

          <TextField
            fullWidth
            multiline
            minRows={3}
            required
            autoFocus
            label="Reason for closing"
            helperText="Saved on the closed debt and on the lost debt"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            inputProps={{ dir: 'auto', maxLength: 500 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <button type="button" className="debts-btn is-ghost" onClick={close} disabled={isLoading}>Cancel</button>
          <button type="submit" className="debts-btn is-danger-solid" disabled={isLoading || !note.trim()}>
            {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Close debt'}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default CloseDebtDialog;
