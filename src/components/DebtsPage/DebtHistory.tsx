import moment from 'moment';
import { Debt } from '../../models'
import CreateDebtHistoryDialog from './CreateDebtHistoryDialog';
import CloseDebtDialog from './CloseDebtDialog';
import DeleteDebtDialog from './DeleteDebtDialog';
import { useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar, TextField } from '@mui/material';
import SwipeableTextMobileStepper from '../SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import { useSelector } from 'react-redux';
import api from '../../api';
import { convertGoogleStorageUrl } from '../../utils/methods';
import { DEBT_STATUS_LABELS, DEBT_TYPE_LABELS, formatAmount } from './wrapper-util';
import { Building2, CheckCircle2, ChevronDown, CircleAlert, ExternalLink, HandCoins, Lock, ShieldCheck, Trash2 } from 'lucide-react';

type Props = {
  debt: Debt
  setDialog: (state: any) => void
  fetchData: () => void
}

const DebtHistory = (props: Props) => {
  const { debt } = props;
  const payments = debt?.paymentHistory || [];
  const debtHasHistoryPayments = payments.length > 0;
  const debtType = (debt as any)?.debtType;

  const [showHistoryPayment, setShowHistoryPayments] = useState(false);
  const [previewImages, setPreviewImages] = useState<any>();
  const [form, setForm] = useState<any>();
  const [inventoryId, setInventoryId] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [alert, setAlert] = useState({
    open: false,
    message: '',
    isError: false
  });

  const roles = useSelector((state: any) => state.session.account.roles);
  const isAdmin = !!roles?.isAdmin;
  const allowViewHiddenFields = isAdmin || !!roles?.isAccountant;

  const handleChange = (event: any) => setForm({ ...form, [event.target.name]: event.target.value })

  const showAlert = (message: string, isError = false) => setAlert({ open: true, message, isError });

  const onSubmit = async (event: any) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      await api.update(`balances/${debt._id}/paymentHistory?historyPaymentId=${inventoryId}`, form);
      setInventoryId(undefined);
      showAlert('Inventory details saved');
      props.fetchData();
    } catch (error) {
      console.log(error);
      showAlert('Could not save inventory details. Try again.', true);
    } finally {
      setIsLoading(false);
    }
  }

  const confirmDebt = async () => {
    try {
      setIsConfirming(true);
      await api.update(`balances/${debt._id}/confirmed`, {});
      setConfirmOpen(false);
      props.fetchData();
    } catch (error) {
      console.log(error);
      showAlert('Could not confirm this debt. Try again.', true);
    } finally {
      setIsConfirming(false);
    }
  }

  const isOpen = debt.status === 'open';
  const isOwed = isOpen || debt.status === 'overdue';
  const canCloseManually = allowViewHiddenFields && isOwed;
  const closure = debt.manualClosure;
  const closedBy = closure?.closedBy && typeof closure.closedBy === 'object'
    ? `${closure.closedBy.firstName || ''} ${closure.closedBy.lastName || ''}`.trim()
    : '';
  const initialAmount = Number(debt.initialAmount) || 0;
  const remaining = Number(debt.amount) || 0;
  const writtenOff = Number(closure?.writtenOffAmount) || 0;
  const paidShare = isOwed && initialAmount > 0 ? Math.min(Math.max((initialAmount - remaining) / initialAmount, 0), 1) : 0;

  return (
    <div className='debt-item'>
      <div className='debt-item-top'>
        <div className='debt-tags'>
          <span className={`debt-status is-${debt.status}`}>{DEBT_STATUS_LABELS[debt.status] || debt.status}</span>
          <span className='debt-tag'>
            <Building2 size={12} strokeWidth={2} />
            {debt?.createdOffice}
          </span>
          {debtType && DEBT_TYPE_LABELS[debtType] &&
            <span className='debt-tag' dir='rtl'>{DEBT_TYPE_LABELS[debtType]}</span>
          }
          {closure &&
            <span className='debt-tag'>
              <Lock size={12} strokeWidth={2} />
              Closed manually
            </span>
          }
          {debt.sourceBalance &&
            <span className='debt-tag'>Written off from a closed debt</span>
          }
        </div>

        <div className='debt-actions'>
        {isOpen &&
          <button
            className='debts-btn is-primary is-small'
            onClick={() => props.setDialog({ customComponentTag: CreateDebtHistoryDialog, isOpen: true, item: debt, onSaved: props.fetchData })}
          >
            <HandCoins size={15} strokeWidth={2} />
            Record payment
          </button>
        }
        {canCloseManually &&
          <button
            className='debts-btn is-ghost is-small'
            onClick={() => setCloseOpen(true)}
            title='Close this debt and move the remaining amount to lost'
          >
            <Lock size={14} strokeWidth={2} />
            Close manually
          </button>
        }
        {debt.status === 'waitingApproval' && isAdmin &&
          <button className='debts-btn is-primary is-small' onClick={() => setConfirmOpen(true)} disabled={Number(debt.amount) !== 0}>
            <ShieldCheck size={15} strokeWidth={2} />
            Confirm settlement
          </button>
        }
        {isAdmin &&
          <button
            className='debts-icon-btn'
            onClick={() => setDeleteOpen(true)}
            disabled={debtHasHistoryPayments}
            aria-label='Delete debt'
            title={debtHasHistoryPayments ? 'Debts with payments can not be deleted' : 'Delete debt (created by mistake)'}
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        }
        </div>
      </div>

      <div className='debt-amount'>
        <div className={`debt-amount-main ${isOwed ? 'is-owed' : 'is-paid'}`}>
          <strong>{formatAmount(isOwed ? remaining : initialAmount - writtenOff)} {debt.currency}</strong>
          {isOwed && paidShare > 0 &&
            <span>left of {formatAmount(initialAmount)} {debt.currency}</span>
          }
          {!isOwed && writtenOff > 0 &&
            <span>paid of {formatAmount(initialAmount)} {debt.currency}</span>
          }
        </div>
        {isOwed && paidShare > 0 &&
          <div
            className='debt-progress'
            role='meter'
            aria-label='Paid so far'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidShare * 100)}
          >
            <span style={{ transform: `scaleX(${paidShare})` }} />
          </div>
        }
      </div>

      <dl className='debt-meta'>
        <div>
          <dt>Created</dt>
          <dd title={moment(debt.createdAt).format('DD/MM/YYYY hh:mm A')}>
            {moment(debt.createdAt).format('DD/MM/YYYY')} ({moment(debt.createdAt).fromNow()})
          </dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{`${debt.createdBy?.firstName || ''} ${debt.createdBy?.lastName || ''}`}</dd>
        </div>
        {debt.order &&
          <div>
            <dt>Order</dt>
            <dd>
              <a target='_blank' rel='noreferrer' href={`/invoice/${debt.order._id}/edit`}>
                {debt.order.orderId}
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            </dd>
          </div>
        }
      </dl>

      {debt.notes &&
        <p className='debt-notes' dir='auto'>{debt.notes}</p>
      }

      {closure &&
        <div className='debt-closure'>
          <p className='debt-closure-title'>
            {formatAmount(writtenOff)} {debt.currency} moved to lost
            {closedBy && ` by ${closedBy}`}
            {closure.closedAt && `, ${moment(closure.closedAt).format('DD/MM/YYYY')}`}
          </p>
          <p dir='auto'>{closure.note}</p>
        </div>
      }

      {debtHasHistoryPayments &&
        <button
          type='button'
          className='debt-payments-toggle'
          aria-expanded={showHistoryPayment}
          onClick={() => setShowHistoryPayments(!showHistoryPayment)}
        >
          {showHistoryPayment ? 'Hide payments' : `Show payments (${payments.length})`}
          <ChevronDown size={15} strokeWidth={2} />
        </button>
      }

      {showHistoryPayment && debtHasHistoryPayments &&
        <ol className='debt-payments'>
          {payments.map((payment) => {
            const attachments = payment?.attachments || [];
            return (
              <li className='debt-payment' key={payment._id}>
                <div className='debt-payment-row'>
                  <div className='debt-payment-amount'>
                    <strong>{formatAmount(payment.amount)} {payment.currency}</strong>
                    <span>{moment(payment.createdAt).format('DD/MM/YYYY')}, rate {payment.rate}</span>
                  </div>

                  {attachments.length > 0 &&
                    <button
                      type='button'
                      className='debt-receipts'
                      onClick={() => setPreviewImages(attachments)}
                      title='View receipts'
                    >
                      {attachments.slice(0, 3).map((img) => (
                        <img key={img.filename} alt={img.filename} src={convertGoogleStorageUrl(img.path)} />
                      ))}
                      {attachments.length > 3 &&
                        <span className='debt-receipts-more'>+{attachments.length - 3}</span>
                      }
                    </button>
                  }
                </div>

                {payment.notes &&
                  <p className='debt-payment-notes' dir='auto'>{payment.notes}</p>
                }

                {allowViewHiddenFields &&
                  <div className='debt-inventory'>
                    {payment.companyBalance?.isExist ?
                      <span className='debt-inventory-state is-ok'>
                        <CheckCircle2 size={14} strokeWidth={2} />
                        In accounting inventory
                      </span>
                      :
                      <span className='debt-inventory-state is-missing'>
                        <CircleAlert size={14} strokeWidth={2} />
                        Not in accounting inventory
                      </span>
                    }
                    <span>
                      Reference: <strong>{payment.companyBalance?.reference || 'Not added yet'}</strong>
                    </span>

                    {inventoryId !== payment._id && !payment.companyBalance?.isExist &&
                      <button
                        type='button'
                        className='debts-btn is-ghost is-small'
                        onClick={() => { setForm(undefined); setInventoryId(payment._id) }}
                      >
                        Add inventory
                      </button>
                    }
                  </div>
                }

                {allowViewHiddenFields && inventoryId === payment._id &&
                  <form className='debt-inventory-form' onSubmit={onSubmit}>
                    <FormControl size='small' required>
                      <InputLabel id={`isExist-${payment._id}`}>Receipt exists?</InputLabel>
                      <Select
                        labelId={`isExist-${payment._id}`}
                        label='Receipt exists?'
                        name='isExist'
                        value={form?.isExist || ''}
                        onChange={handleChange}
                      >
                        <MenuItem value={'true'}>Yes</MenuItem>
                        <MenuItem value={'false'}>No</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      size='small'
                      label='Reference'
                      name='reference'
                      onChange={handleChange}
                      required
                    />

                    <button type='button' className='debts-btn is-ghost' onClick={() => setInventoryId(undefined)} disabled={isLoading}>
                      Cancel
                    </button>
                    <button type='submit' className='debts-btn is-primary' disabled={isLoading}>
                      {isLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save'}
                    </button>
                  </form>
                }
              </li>
            )
          })}
        </ol>
      }

      <Dialog
        open={!!previewImages}
        onClose={() => setPreviewImages(undefined)}
      >
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)} >Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => !isConfirming && setConfirmOpen(false)}
        maxWidth='xs'
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle>
          <span className='debt-dialog-title'>
            <strong>Confirm this settlement?</strong>
            <span>{debt.owner?.firstName} {debt.owner?.lastName} ({debt.owner?.customerId})</span>
          </span>
        </DialogTitle>
        <DialogContent>
          <div className='debt-dialog-facts'>
            <div>
              <span>Amount</span>
              <strong className='is-owed'>{formatAmount(debt.amount)} {debt.currency}</strong>
            </div>
            <div>
              <span>Office</span>
              <strong style={{ textTransform: 'capitalize' }}>{debt.createdOffice}</strong>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#5b6673', margin: 0 }}>
            Confirm that this debt has been fully paid. It will move to the closed list.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <button className='debts-btn is-ghost' onClick={() => setConfirmOpen(false)} disabled={isConfirming}>Cancel</button>
          <button className='debts-btn is-primary' onClick={confirmDebt} disabled={isConfirming}>
            {isConfirming ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Confirm settlement'}
          </button>
        </DialogActions>
      </Dialog>

      {canCloseManually &&
        <CloseDebtDialog
          debt={debt}
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          onClosed={() => {
            setCloseOpen(false);
            props.fetchData();
          }}
        />
      }

      {isAdmin &&
        <DeleteDebtDialog
          debt={debt}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            props.fetchData();
          }}
        />
      }

      <Snackbar
        open={alert.open}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setAlert({ ...alert, open: false })}
      >
        <Alert
          severity={alert.isError ? 'error' : 'success'}
          sx={{ width: '100%' }}
          onClose={() => setAlert({ ...alert, open: false })}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default DebtHistory
