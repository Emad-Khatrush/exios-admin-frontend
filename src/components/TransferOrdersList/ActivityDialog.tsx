import { Alert, Autocomplete, Backdrop, Button, ButtonGroup, CircularProgress, DialogContent, Snackbar, TextField } from '@mui/material';
import React from 'react'
import { countries, orderActions } from '../../containers/EditInvoice/EditInvoice';
import CustomButton from '../CustomButton/CustomButton';
import { arrivedPackageDetails, arrivingGoodsToPortAlert, reminderToReceiveGoodsText } from './readyTexts';
import { calculateMinTotalPrice, replaceWords } from '../../utils/methods';
import api from '../../api';
import { Inventory } from '../../models';

type Props = {
  checked: any
  setShowDialog: (value: boolean) => void
  inventory: Inventory
}

const ActivityDialog = (props: Props) => {
  const [ isLoading, setLoading ] = React.useState(false);
  const [ isSucceed, setIsSucceed ] = React.useState<boolean>(false);
  const [ showResponseMessage, setShowResponseMessage ] = React.useState<String | undefined>();
  const [ activity, setActivity ] = React.useState({
    country: '',
    description: ''
  });
  const [ whatsupMessage, setWhatsupMessage ] = React.useState('');

  const sendWhatsupMessage = async () => {
    if (!whatsupMessage) {
      return;
    }

   setLoading(true);
   const customers: any = [];
   const contacts: any = [];

   props.checked.forEach((order: any) => {
    if (!customers[`${order.user.customerId}_${order.paymentList.deliveredPackages.exiosPrice}`]) {
      customers[`${order.user.customerId}_${order.paymentList.deliveredPackages.exiosPrice}`] = [];
    }
    customers[`${order.user.customerId}_${order.paymentList.deliveredPackages.exiosPrice}`].push(...[order])
  })
  for (const customerId in customers) {
    const tokenOrderId: any = [];
    let trackingNumbers = '', orderId = '', fullName = '', weight = 0, exiosPrice = 0, measureUnit = '';
    const customerOrders = customers[customerId];
    customerOrders.forEach((order: any) => {
      fullName = order.customerInfo.fullName;
      trackingNumbers += `${order.paymentList.deliveredPackages.trackingNumber}, `;
      weight += order.paymentList.deliveredPackages.weight.total;
      exiosPrice = order.paymentList.deliveredPackages.exiosPrice;
      measureUnit = order.paymentList.deliveredPackages.weight.measureUnit;
      if (!tokenOrderId.includes(order.orderId)) {
        orderId += `${order.orderId},`;
      }
      tokenOrderId.push(order.orderId)
    })
    
    const totalPrice = calculateMinTotalPrice(exiosPrice, weight, props.inventory.shippedCountry, measureUnit);
    const message = replaceWords(whatsupMessage, {
      fullName: fullName,
      orderId: orderId,
      trackingNumber: trackingNumbers,
      weight: `${weight} ${measureUnit}`,
      exiosPrice: exiosPrice,
      totalPrice: `${totalPrice} $`,
      noteForHandlingFeesInUSA: ['USA', 'UK'].includes(props.inventory.shippedCountry)  ? 'ملاحظة: يوجد رسوم مناولة على كل شحنة لم تضف الى حسبة الاجمالية' : ''
    })
    contacts.push({ phoneNumber: customerOrders[0].user.phone , message })
  }

   api.post(`inventorySendWhatsupMessages`, { data: contacts })
   .then(() => {
     setShowResponseMessage('Whatsup message has been send successfully');
     setIsSucceed(true);
   })
   .catch((err) => {
     console.log(err);
     setShowResponseMessage(err.response.data.message === "Evaluation failed: TypeError: Cannot read properties of undefined (reading 'getContact')\n    at __puppeteer_evaluation_script__:2:34"
     ? 'You need to scan QR from your whatsup !' : err.response.data.message);
     setIsSucceed(false);
   })
   setLoading(false);
  }

  const submitNewActivity = (event: React.MouseEvent) => {
    event.preventDefault();    
    const { description, country } = activity;
    
    if (!description || !country) {
      return;
    }

    try {
      setLoading(true);
      props.checked.forEach(async (data: any) => {
        await api.post(`order/${data._id}/addActivity`, activity);
        setShowResponseMessage('New activity has been added successfully');
          setIsSucceed(true);
          setActivity({
            country: '',
            description: ''
          })
      })
    } catch (error: any) {
      setShowResponseMessage(error.data.message);
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
    
  }
  
  return (
    <div>
      <DialogContent>
        <form
          onSubmit={(event: any) => submitNewActivity(event)}
        >
          <h5 className='mb-3'> Add Activity </h5>
          <div className="row">
            <div className="col-md-12 mb-4">
              <Autocomplete
                disablePortal
                id="free-solo-demo"
                freeSolo
                options={countries}
                onChange={(event: any) => (
                  setActivity({
                    ...activity,
                    country: event.target.innerText
                  })
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    id={'outlined-helperText'}
                    name="country"
                    required={true}
                    label={'Country'}
                    defaultValue={activity.country}
                    onChange={(event: any) => (
                      setActivity({
                        ...activity,
                        country: event.target.innerText
                      })
                    )}
                    style={{ direction: 'rtl' }}
                    disabled={isLoading}
                  />
                )}
              />
            </div>

            <div className="col-md-12 mb-4">
              <Autocomplete
                disablePortal
                id="free-solo-demo"
                freeSolo
                options={orderActions}
                onChange={(event: any) => setActivity({
                  ...activity,
                  description: event.target.innerText
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    id={'outlined-helperText'}
                    name="description"
                    required={true}
                    label={'Description'}
                    defaultValue={activity.description}
                    onChange={(event: any) => ( 
                      setActivity({
                        ...activity,
                        description: event.target.value
                      })
                    )}
                    style={{ direction: 'rtl' }}
                    disabled={isLoading}
                  />
                )}
              />
            </div>
            <div className="col-md-12 mb-4 text-end">
              <CustomButton 
                background='rgb(0, 171, 85)' 
                size="small"
                disabled={isLoading}
              >
                Add Activity
              </CustomButton>
            </div>
          </div>
        </form>
        </DialogContent>

        <DialogContent>
          <hr />

          <h5 className='mb-3'> Send Whatsup Message </h5>
          <textarea 
            style={{ height: '200px', direction: 'rtl' }} 
            placeholder='Message' 
            className='form-control mb-2' 
            defaultValue={whatsupMessage}
            value={whatsupMessage}
            onChange={(e) => setWhatsupMessage(e.target.value)}
          >
          </textarea>

          <div className="col-md-12 mb-4 text-end">
            <ButtonGroup variant="outlined" aria-label="outlined button group">
              <Button onClick={() => setWhatsupMessage(arrivedPackageDetails)}>وصلت ليبيا</Button>
              <Button onClick={() => setWhatsupMessage(reminderToReceiveGoodsText)}>تذكير للاستلام</Button>
              <Button onClick={() => setWhatsupMessage(arrivingGoodsToPortAlert)}>موعد وصول الحاوية</Button>
              <Button onClick={() => setWhatsupMessage('')}>حقل فارغ</Button>
            </ButtonGroup>
          </div>
                      
          <div className="col-md-12 mb-4 text-end">
            <CustomButton 
              background='rgb(0, 171, 85)' 
              size="small"
              disabled={isLoading}
              onClick={sendWhatsupMessage}
            >
              Send Message
            </CustomButton>
          </div>
        </DialogContent>

      <Snackbar 
        open={!!showResponseMessage}
        autoHideDuration={6000}
        onClose={() => setShowResponseMessage(undefined)}
      >
        <Alert 
          severity={isSucceed ? 'success' : 'error'}
          sx={{ width: '100%' }}
          onClose={() => setShowResponseMessage(undefined)}
        >
          {showResponseMessage}
        </Alert>
      </Snackbar>

      <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={isLoading}
        >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  )
}

export default ActivityDialog;
