import { Alert, Avatar, AvatarGroup, Button, Dialog, DialogActions, DialogContent, Snackbar } from '@mui/material';
import { useState } from 'react';
import { AiOutlineEdit } from 'react-icons/ai';
import { Invoice } from '../../models';
import Badge from '../Badge/Badge';
import BoxText from '../BoxText/BoxText';
import Card from '../Card/Card';
import CustomButton from '../CustomButton/CustomButton';
import SwipeableTextMobileStepper from '../SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import moment from 'moment-timezone';

import './OrderWidget.scss';
import { getOrderSteps } from '../../utils/methods';
import ActionCard from '../ActionCard/ActionCard';

type Props = {
  order: Invoice
  orderIndex: number
  isSearchingForTrackingNumber: boolean
}

const OrderWidget = (props: Props) => {
  const { order, isSearchingForTrackingNumber } = props;

  const [previewImages, setPreviewImages] = useState<any>();  
  const [hasCopiedText, setHasCopiedText] = useState<boolean>(false);  
  
  const steps = getOrderSteps(order);
  const lastActivityOrder = order.activity.slice(-1)[0];  
  const diffActivityDates = moment(new Date()).diff(moment(lastActivityOrder?.createdAt));
  const remainingActivityDay = moment(diffActivityDates).format('D');
  const trackingNumber = (order as any).paymentList?.deliveredPackages?.trackingNumber;

  return (
    <Card style={{ margin: '10px' }}>
      <div className="row order-widget">
        <div className="col-lg-2 m-auto">
          <div className="preview-image h-100">
            <ActionCard 
              text={`Preview #${props.orderIndex}`}
              path={`https://www.exioslibya.com/xtracking/${order.orderId}/ar`}
            />
          </div>
        </div>
        <div className="col-lg-10">
          <div className='d-flex justify-content-between'>
            <div>
              <div className='d-flex flex-column'>

                {isSearchingForTrackingNumber && trackingNumber &&
                  <div className='mb-2'>
                    <h6 className='mb-1'> Related Tracking Number </h6>
                    <Badge 
                      style={{ width: 'fit-content' }} 
                      text={trackingNumber} 
                      color='warning'
                    />
                  </div>
                }
            
                <h5 style={{ marginRight: '8px' }} className='mb-1'> {order.customerInfo.fullName} </h5>
                <div className='mb-2'>
                  <Badge
                    style={{
                      fontFamily: 'system-ui'
                    }}
                    text={`${steps[order.orderStatus].label} - ${remainingActivityDay} يوم`} 
                    color='success' 
                  />
                  <Badge 
                    style={{ marginLeft: '6px' }} 
                    text={"by " + order.shipment.method} 
                    color='primary' 
                  />
                </div>
              </div>
              <p 
                className='description mb-2' 
                onClick={() => {
                  navigator.clipboard.writeText(order.orderId);
                  setHasCopiedText(true);
                }}
              > 
                Tracking Number: {order.orderId}
              </p>
            </div>

            <div className='d-flex'>
              <CustomButton
                background='rgb(0, 171, 85)' 
                size="small" 
                icon={<AiOutlineEdit />}
                href={`/invoice/${order._id}/edit`}
                style={{ marginRight: '8px' }}
              >
                Edit
              </CustomButton>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center">
              <BoxText 
                firstText={moment(order.createdAt).format('DD-MM-YYYY')}
                secondText='Created Date'
                style={{ marginRight: '10px' }}
              />
              <BoxText 
                firstText={order.user?.customerId}
                secondText='Customer ID'
                style={{ marginRight: '10px' }}
              />
              <BoxText 
                firstText={order.productName}
                secondText='Details'
                style={{ marginRight: '10px' }}
              />
              <BoxText 
                firstText={`${order.totalInvoice} USD`}
                secondText='Total'
                style={{ marginRight: '10px' }}
              />
              <BoxText 
                firstText={`${order.shipment.fromWhere} - ${order.shipment.toWhere}`}
                secondText='Ship'
                style={{ marginRight: '10px' }}
              />

              <BoxText 
                firstText={`${order.customerInfo.phone}`}
                secondText='Phone'
                style={{ marginRight: '10px' }}
              />
            
            <AvatarGroup max={3}>
              {order?.images && order.images.map((img) => (
                <Avatar
                  key={img.filename}
                  className='order-image'
                  alt={img.filename} 
                  src={img.path}
                  onClick={(event: React.MouseEvent) => setPreviewImages(order.images)}
                />
              ))}
            </AvatarGroup>

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

          </div>
        </div>
        <Snackbar 
          open={hasCopiedText} 
          autoHideDuration={1000}
          onClose={() => setHasCopiedText(false)}
        >
          <Alert 
            severity={'success'}
            onClose={() => setHasCopiedText(false)}
          >
            Copied!
          </Alert>
        </Snackbar>
      </div>
    </Card>
  )
}

export default OrderWidget;