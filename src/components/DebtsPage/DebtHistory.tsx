import moment from 'moment';
import { Debt } from '../../models'
import CustomButton from '../CustomButton/CustomButton';
import CreateDebtHistoryDialog from './CreateDebtHistoryDialog';
import { useState } from 'react';
import { Alert, Avatar, AvatarGroup, Button, CircularProgress, Dialog, DialogActions, DialogContent, FormControl, InputLabel, MenuItem, Select, Snackbar, TextField } from '@mui/material';
import SwipeableTextMobileStepper from '../SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import { useSelector } from 'react-redux';
import api from '../../api';
import Badge from '../Badge/Badge';

type Props = {
  debt: Debt
  setDialog: (state: any) => void
  fetchData: () => void
}

const DebtHistory = (props: Props) => {
  const { debt } = props;
  const debtHasHistoryPayments = debt?.paymentHistory && debt.paymentHistory.length > 0;

  const [showHistoryPayment, setShowHistoryPayments] = useState(false);
  const [previewImages, setPreviewImages] = useState<any>();  
  const [form, setForm] = useState<any>();  
  const [inventoryId, setInventoryId] = useState<string>();  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState({
    message: '',
    isError: false
  });

  const allowViewHiddenFields = useSelector((state: any) => state.session.account.roles.isAdmin || state.session.account.roles.accountant)

  const handleChange = (event: any) => setForm({ ...form, [event.target.name]: event.target.value })

  const onSubmit = async (event: any) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      await api.update(`balances/${debt._id}/paymentHistory?historyPaymentId=${inventoryId}`, form);
      props.fetchData();
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='row debt-details mb-2'>
      <Badge 
        text={`${debt?.createdOffice.toLocaleUpperCase()}`}
        color="warning"
      />
      <div className='d-flex justify-content-between mt-2'>
        <p className='m-0 created-date debt-info'>Debt {'=>'} {moment(debt.createdAt).format('DD/MM/YYYY')}</p>
        {debt.status === 'open' &&
          <CustomButton 
            children={'Close Debt'}
            color="error"
            style={{
              height: '25px'
            }}
            onClick={() => props.setDialog({ customComponentTag: CreateDebtHistoryDialog, isOpen: true, item: debt })}
          />
        }
      </div>

      {debt.order &&
        <div className='col-12 mb-2'>
          <a className='order-link' target='__blank' href={`/invoice/${debt.order._id}/edit`}>OrderId: {debt.order.orderId}</a>
        </div>
      }

      <div className='col-md-4 mb-2'>
        <p className='debt-info m-0'><span className='info-field'>Amount</span></p>
        <p className='debt-info m-0' style={{ color: `${debt.status === 'open' ? '#ec4848' : 'rgb(5, 151, 0)'}`}}>{debt.status === 'open' ? debt.amount : debt.initialAmount} {debt.currency}</p>
      </div>

      <div className='col-md-4 mb-2 d-flex flex-column'>
        <p className='debt-info m-0'><span className='info-field'>Created Date</span></p>
        <p className='debt-info m-0'>{moment(debt.createdAt).fromNow()}</p>
      </div>
      
      <div className='col-md-4 mb-2 d-flex flex-column'>
        <p className='debt-info m-0'><span className='info-field'>Created By</span></p>
        <p className='debt-info m-0'>{`${debt.createdBy.firstName} ${debt.createdBy.lastName}`}</p>
      </div>

      {debtHasHistoryPayments && !showHistoryPayment &&
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <a className='see-all-button' href="#" onClick={() => setShowHistoryPayments(true)}>View History Payment</a>
      }

      {showHistoryPayment && debtHasHistoryPayments && debt?.paymentHistory.map((payment, i) => (
        <div className='col-md-12 mb-2'>
          <hr />
          <p className='debt-info m-0 mb-2'><span className='info-field'>{i + 1}- Payment History {moment(payment.createdAt).format('DD/MM/YYYY')}</span></p>

          <div className='row'>
            <div className='col-md-4 d-flex flex-column'>
              <p className='debt-info m-0'><span className='info-field'>Paid Amount</span></p>
              <p className='debt-info paid-debt-amount m-0'>{`${payment.amount} ${payment.currency}`}</p>
            </div>

            <div className='col-md-4 d-flex flex-column'>
              <p className='debt-info m-0'><span className='info-field'>Rate</span></p>
              <p className='debt-info paid-debt-amount m-0'>{`${payment.rate}`}</p>
            </div>

            <div className='col-md-4 d-flex flex-column'>
              <p className='debt-info m-0'><span className='info-field'>Receipt</span></p>
              <AvatarGroup className='justify-content-end' max={3}>
                {payment?.attachments && payment?.attachments.map((img) => (
                  <Avatar
                    key={img.filename}
                    className='file-view'
                    alt={img.filename} 
                    src={img.path}
                    onClick={() => setPreviewImages(payment.attachments)}
                  />
                ))}
              </AvatarGroup>
            </div>
            
            {payment.notes &&
              <div className='col-md-12 d-flex flex-column'>
                <p className='debt-info m-0'><span className='info-field'>Notes</span></p>
                <p className='debt-info paid-debt-amount m-0'>{payment.notes}</p>
              </div>
            }

            {allowViewHiddenFields &&
              <>
                <div className='col-md-6 d-flex flex-column mt-2'>
                  <p className='debt-info m-0'><span className='info-field'>Exist In Accounting Inventory</span></p>
                  <p className='debt-info paid-debt-amount m-0'>{payment.companyBalance.isExist ? 'Yes' : 'Not Found'}</p>
                </div>
                
                <div className='col-md-6 d-flex flex-column mt-2'>
                  <p className='debt-info m-0'><span className='info-field'>Reference Paper</span></p>
                  <p className='debt-info paid-debt-amount m-0'>{payment.companyBalance.reference ? payment.companyBalance.reference : 'Not Added Yet'}</p>
                </div>

                {inventoryId !== payment._id && !payment.companyBalance.isExist &&
                  // eslint-disable-next-line jsx-a11y/anchor-is-valid
                  <a className='see-all-button mt-2' href="#" onClick={() => { setForm(undefined); setInventoryId(payment._id) }}>Add Inventory</a>
                }

                {inventoryId === payment._id &&
                  <form className='row' onSubmit={onSubmit}>
                    <div className='col-md-6 mt-3'>
                      <FormControl style={{ width: '170px', height: '50px' }} required>
                        <InputLabel id="demo-select-small">Receipt Exist?</InputLabel>
                        <Select
                          labelId={'Receipt Exist'}
                          id={'isExist'}
                          label={'Select Office'}
                          name="isExist"
                          onChange={(event) => {
                            handleChange(event);
                          }}
                        >
                          <MenuItem value={'true'}>
                            <em> Yes </em>
                          </MenuItem>
                          <MenuItem value={'false'}>
                            <em> No </em>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </div>

                    <div className='col-md-6 mt-3'>
                      <TextField
                        label={'Add Reference'}
                        name="reference"
                        onChange={handleChange}
                        onWheel={(event: any) => event.target.blur()}
                        required
                      />
                    </div>

                    <div className='col-md-6 mt-3'>
                      <CustomButton 
                        children={isLoading ? <CircularProgress /> : 'Save'}
                        color="success"
                        style={{
                          height: '25px'
                        }}
                      />
                    </div>
                  </form>
                }
              </>
            }
          </div>

        </div>
      ))}
      {debtHasHistoryPayments && showHistoryPayment &&
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <a className='see-all-button mt-2' href="#" onClick={() => setShowHistoryPayments(false)}>Hide History Payment</a>
      }

      <Dialog 
        open={previewImages}
        onClose={() => setPreviewImages(undefined)}
      >
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)} >Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={isLoading} 
        autoHideDuration={6000}
        onClose={() => {
          setIsLoading(false);
          setAlert({
            message: '',
            isError: false
          })
        }}
      >
        <Alert 
          severity={alert.isError ? 'error' : 'success'}
          sx={{ width: '100%' }}
          onClose={() => {
            setIsLoading(false);
            setAlert({
              message: '',
              isError: false
            })
          }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default DebtHistory
