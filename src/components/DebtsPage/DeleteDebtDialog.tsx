import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useState } from "react";
import api from "../../api";
import { Debt } from "../../models";
import { getErrorMessage } from "../../utils/errorHandler";
import { DEBT_STATUS_LABELS, formatAmount } from "./wrapper-util";

type Props = {
  debt: Debt
  open: boolean
  onClose: () => void
  onDeleted: () => void
}

const DeleteDebtDialog = (props: Props) => {
  const { debt } = props;
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const close = () => {
    if (isLoading) return;
    setError(undefined);
    props.onClose();
  }

  const deleteDebt = async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      await api.delete(`balances/${debt._id}`, {});
      props.onDeleted();
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
      <DialogTitle>
        <span className="debt-dialog-title">
          <strong>Delete this debt?</strong>
          <span>{debt.owner?.firstName} {debt.owner?.lastName} ({debt.owner?.customerId})</span>
        </span>
      </DialogTitle>

      <DialogContent>
        {error &&
          <Alert severity="error" className="mb-3">{error}</Alert>
        }

        <div className="debt-dialog-facts">
          <div>
            <span>Amount</span>
            <strong>{formatAmount(debt.initialAmount)} {debt.currency}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{DEBT_STATUS_LABELS[debt.status] || debt.status}</strong>
          </div>
        </div>

        {debt.notes &&
          <p className="debt-notes mb-3" dir="auto">{debt.notes}</p>
        }

        <p className="debt-dialog-copy">
          Use this only for a debt created by mistake. It is removed permanently and the deletion is logged in Activities.
          {debt.manualClosure?.lostBalance && ' The lost amount created when it was closed is deleted too.'}
        </p>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <button type="button" className="debts-btn is-ghost" onClick={close} disabled={isLoading}>Cancel</button>
        <button type="button" className="debts-btn is-danger-solid" onClick={deleteDebt} disabled={isLoading}>
          {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete debt'}
        </button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteDebtDialog;
