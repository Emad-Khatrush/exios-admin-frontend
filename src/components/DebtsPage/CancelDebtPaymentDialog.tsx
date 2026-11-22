import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import moment from "moment";
import { useState } from "react";
import api from "../../api";
import { Debt } from "../../models";
import { getErrorMessage } from "../../utils/errorHandler";
import { formatAmount } from "./wrapper-util";

/* Cancelling one payment of a debt recorded by mistake (paid from the customer's wallet).
   The API gives the money back to the wallet with a cancellation line in the statement, reverses
   the accounting entry and puts the amount back on the debt. Payments made on the order page are
   cancelled there; a delivery invoice remainder by cancelling its invoice; a debt closed by hand
   cannot have a payment cancelled. */

// Payments made on the order page are added to the debt with this note (API utils/debts.js)
const FROM_ORDER_PAGE = /^Paid with the /;

export const canCancelDebtPayment = (debt: Debt, payment: any, canManageDebts: boolean) => !!(
  canManageDebts
  && !debt.deliveryInvoiceId
  && !debt.manualClosure?.closedAt
  && !['lost', 'canceled'].includes(debt.status)
  && !FROM_ORDER_PAGE.test(payment?.notes || '')
);

type Props = {
  debt: Debt
  payment: any
  open: boolean
  onClose: () => void
  onCancelled: () => void
}

const CancelDebtPaymentDialog = ({ debt, payment, open, onClose, onCancelled }: Props) => {
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const close = () => {
    if (isLoading) return;
    setError(undefined);
    onClose();
  };

  const cancelPayment = async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      await api.delete(`balances/${debt._id}/paymentHistory/${payment._id}`, {});
      onCancelled();
    } catch (err: any) {
      // The API explains in Arabic why a payment cannot be cancelled: shown as it is
      const message = err?.response?.data?.message;
      const known = message && getErrorMessage(message);
      setError(known && !known.startsWith('unexpected error') ? known : message || 'تعذر إلغاء الدفعة، حاول مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  const otherCurrency = payment?.currency && payment.currency !== debt.currency && Number(payment.rate) > 0;
  const backOnDebt = otherCurrency ? Number(payment.amount) / Number(payment.rate) : Number(payment?.amount);

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
      <DialogTitle>
        <span className="debt-dialog-title" dir="rtl">
          <strong>إلغاء هذه الدفعة؟</strong>
          <span>{debt.owner?.firstName} {debt.owner?.lastName} ({debt.owner?.customerId})</span>
        </span>
      </DialogTitle>

      <DialogContent dir="rtl">
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}

        <div className="debt-dialog-facts">
          <div>
            <span>الدفعة</span>
            <strong>{formatAmount(payment?.amount)} {payment?.currency}</strong>
          </div>
          <div>
            <span>التاريخ</span>
            <strong>{moment(payment?.createdAt).format('DD/MM/YYYY')}</strong>
          </div>
        </div>

        <p className="debt-dialog-copy">
          {`ترجع ${formatAmount(payment?.amount)} ${payment?.currency} إلى محفظة العميل بحركة إلغاء في كشف الحساب، `}
          {`ويعود ${formatAmount(backOnDebt)} ${debt.currency} إلى الدين، ويُعكس القيد المحاسبي. استعملها فقط لدفعة سُجّلت بالخطأ.`}
        </p>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <button type="button" className="debts-btn is-ghost" onClick={close} disabled={isLoading}>تراجع</button>
        <button type="button" className="debts-btn is-danger-solid" onClick={cancelPayment} disabled={isLoading} aria-label="إلغاء الدفعة">
          {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'إلغاء الدفعة'}
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default CancelDebtPaymentDialog;
