import { Avatar, AvatarGroup, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from "@mui/material"
import { useState } from "react"
import { Building2, History, Info, Pencil, Trash2 } from "lucide-react"
import api from "../../api"
import { useParams } from "react-router-dom"
import moment from "moment"
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper"
import { convertGoogleStorageUrl } from "../../utils/methods"
import StatementReceipt from "./StatementReceipt"
import EditStatementDialog from "./EditStatementDialog"
import { formatMoney, getOfficeLabel } from "./statementUtils"

type Props = {
  statement: any
  canManage?: boolean
  onChanged?: () => void
  style?: React.CSSProperties
}

const PaymentDetails = ({ statement, canManage: canManageUser, onChanged, style }: Props) => {
  const { id } = useParams();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [previewImages, setPreviewImages] = useState<any>(undefined);

  const isOutflow = statement?.calculationType === '-';
  // Outgoing payments are linked to orders and debts, so only incoming ones can be edited or deleted
  const canManage = canManageUser && !isOutflow;
  const date = moment(statement?.createdAt);
  const office = statement?.office;
  const walletEffect = `${isOutflow ? '+' : '−'}${formatMoney(statement?.amount, statement?.currency)}`;

  const deleteStatement = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      await api.delete(`user/${id}/statement/${statement._id}`, {});
      setConfirmDelete(false);
      onChanged?.();
    } catch (error: any) {
      console.log(error);
      setDeleteError(error?.response?.data?.message || 'Could not delete this payment. Please try again.');
    }
    setIsDeleting(false);
  };

  return (
    <>
      <article className={`cashflow-row ${isOutflow ? 'is-out' : 'is-in'}`} style={style}>
        <div className="cashflow-row__date" title={date.format('DD/MM/YYYY')}>
          <span className="cashflow-row__day">{date.format('DD MMM')}</span>
          <span className="cashflow-row__year">{date.format('YYYY')}</span>
        </div>

        <div className="cashflow-row__main">
          <p className="cashflow-row__description" dir="rtl" dangerouslySetInnerHTML={{ __html: statement?.description }} />
          <div className="cashflow-row__meta">
            <span className={`cashflow-chip cashflow-chip--office ${office ? '' : 'is-missing'}`}>
              <Building2 size={12} strokeWidth={2} />
              {office ? getOfficeLabel(office) : 'No office'}
            </span>
            {statement?.actionType && <span className="cashflow-chip">{statement.actionType}</span>}
            {statement?.paymentType && statement?.paymentType !== statement?.actionType &&
              <span className="cashflow-chip cashflow-chip--muted">{statement.paymentType}</span>
            }
            {statement?.note &&
              <Tooltip title={<span dir="rtl">{statement.note}</span>} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
                <button type="button" className="cashflow-chip cashflow-chip--note" aria-label="Show note">
                  <Info size={12} strokeWidth={2} />
                  Note
                </button>
              </Tooltip>
            }
            {statement?.editHistory?.length > 0 &&
              <Tooltip
                arrow
                enterTouchDelay={0}
                title={`Edited ${statement.editHistory.length}× · last on ${moment(statement.editHistory[statement.editHistory.length - 1].editedAt).format('DD/MM/YYYY HH:mm')}`}
              >
                <span className="cashflow-chip cashflow-chip--edited">
                  <History size={12} strokeWidth={2} />
                  Edited
                </span>
              </Tooltip>
            }
            {statement?.attachments?.length > 0 &&
              <AvatarGroup max={3} className="cashflow-row__attachments">
                {statement.attachments.map((img: any) => (
                  <Avatar
                    key={img.filename}
                    variant="rounded"
                    alt={img.filename}
                    src={convertGoogleStorageUrl(img.path)}
                    onClick={() => setPreviewImages(statement.attachments)}
                  />
                ))}
              </AvatarGroup>
            }
          </div>
        </div>

        <div className="cashflow-row__amount">
          <span className="cashflow-row__label">Amount</span>
          {isOutflow ? '−' : '+'}{formatMoney(statement?.amount, statement?.currency)}
        </div>

        <div className="cashflow-row__balance">
          <span className="cashflow-row__label">Balance</span>
          {formatMoney(statement?.total, statement?.currency)}
        </div>

        <div className="cashflow-row__actions">
          <StatementReceipt statement={statement} />
          {canManage &&
            <Tooltip title="Edit payment" arrow>
              <button
                type="button"
                className="cashflow-icon-btn"
                aria-label="Edit payment"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={14} strokeWidth={2} />
              </button>
            </Tooltip>
          }
          {canManage &&
            <Tooltip title="Delete payment" arrow>
              <button
                type="button"
                className="cashflow-icon-btn cashflow-icon-btn--danger"
                aria-label="Delete payment"
                onClick={() => {
                  setDeleteError('');
                  setConfirmDelete(true);
                }}
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </Tooltip>
          }
        </div>
      </article>

      <Dialog open={confirmDelete} onClose={() => !isDeleting && setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.05rem' }}>Delete this payment?</DialogTitle>
        <DialogContent>
          <p className="cashflow-confirm__description" dir="rtl" dangerouslySetInnerHTML={{ __html: statement?.description }} />
          <dl className="cashflow-confirm">
            <dt>Date</dt>
            <dd>{date.format('DD/MM/YYYY')}</dd>
            <dt>Amount</dt>
            <dd className={isOutflow ? 'is-out' : 'is-in'}>{isOutflow ? '−' : '+'}{formatMoney(statement?.amount, statement?.currency)}</dd>
            <dt>Wallet change</dt>
            <dd>{walletEffect}</dd>
          </dl>
          <p className="cashflow-confirm__hint">
            The payment is removed from the statement and the {statement?.currency} wallet balance is adjusted by {walletEffect}. A copy is kept in Deleted payments with your name.
          </p>
          {deleteError && <p className="cashflow-confirm__error" role="alert">{deleteError}</p>}
        </DialogContent>
        <DialogActions>
          <Button disabled={isDeleting} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button disabled={isDeleting} color="error" variant="contained" disableElevation onClick={deleteStatement}>
            {isDeleting ? 'Deleting…' : 'Delete payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {canManage &&
        <EditStatementDialog
          open={editOpen}
          statement={statement}
          onClose={() => setEditOpen(false)}
          onSaved={() => onChanged?.()}
        />
      }

      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default PaymentDetails;
