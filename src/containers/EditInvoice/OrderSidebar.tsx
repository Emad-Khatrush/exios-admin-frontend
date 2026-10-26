import React, { useEffect, useRef, useState } from 'react';
import { Autocomplete, Button, ButtonGroup, FormControlLabel, IconButton, Switch, TextField, Tooltip } from '@mui/material';
import { MdDeleteOutline } from 'react-icons/md';
import QRCode from 'qrcode.react';
import moment from 'moment';
import api from '../../api';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import { apiErrorMessage } from '../../components/InvoiceForm/constants';
import { OrderActivity } from '../../models';
import { countries, customerMessages, removeBr, supplierMessage } from './orderConstants';
import ActivityMessagePicker from '../../components/TransferOrdersList/ActivityMessagePicker';
import { specialPriceMessage } from '../../utils/specialPrices';
import { shippingPriceCountry } from '../../utils/shipmentPrices';

type Toast = (type: 'success' | 'error', message: string) => void;

type Props = {
  order: any
  disabled: boolean
  toast: Toast
  onUploadImages: (event: any, type: 'invoice' | 'receipts') => void
  onDeleteImage: (file: any) => void
  // Called after something on the order changed on the server (a new activity)
  onOrderChanged: () => void
  onOpenLabel: () => void
  // Only admins may remove an activity from the customer's timeline
  canDeleteActivity: boolean
  onDeleteActivity: (activity: any) => void
}

const Panel = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <section className="op-panel">
    <h3 className="op-panel__title">{title}</h3>
    {children}
  </section>
);

const Images = ({ order, onUploadImages, onDeleteImage }: Pick<Props, 'order' | 'onUploadImages' | 'onDeleteImage'>) => {
  const invoiceRef = useRef();
  const receiptsRef = useRef();
  const imagesOf = (category: string) => (order.images || []).filter((img: any) => img.category === category);
  return (
    <>
      <Panel title="Admin images">
        <ImageUploader id="invoice" inputFileRef={invoiceRef} fileUploaderHandler={(event: any) => onUploadImages(event, 'invoice')} previewFiles={imagesOf('invoice')} deleteImage={onDeleteImage} />
      </Panel>
      <Panel title="Client images">
        <ImageUploader id="receipts" inputFileRef={receiptsRef} fileUploaderHandler={(event: any) => onUploadImages(event, 'receipts')} previewFiles={imagesOf('receipts')} deleteImage={onDeleteImage} />
      </Panel>
    </>
  );
};

// A step the customer sees in the order's timeline
const AddActivity = ({ order, disabled, toast, onOrderChanged }: Pick<Props, 'order' | 'disabled' | 'toast' | 'onOrderChanged'>) => {
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!description.trim() || !country.trim()) return toast('error', 'حدد الموقع وأدخل نص التحديث أولًا.');
    try {
      setIsSaving(true);
      await api.post(`order/${order._id}/addActivity`, { country: country.trim(), description: description.trim() });
      setCountry('');
      setDescription('');
      toast('success', 'تمت إضافة التحديث إلى سجل تتبع الطلبية.');
      onOrderChanged();
    } catch (error) {
      toast('error', apiErrorMessage(error));
    }
    setIsSaving(false);
  };

  return (
    <Panel title="إضافة تحديث للطلبية">
      <div className="op-stack">
        <Autocomplete
          freeSolo options={countries} inputValue={country} onInputChange={(_, value) => setCountry(value)}
          disabled={disabled || isSaving}
          ListboxProps={{ style: { direction: 'rtl', textAlign: 'right' } }}
          renderInput={(params) => <TextField {...params} label="الموقع" helperText="حدد موقع البضائع وقت هذا التحديث." dir="rtl" />}
        />
        <ActivityMessagePicker value={description} onChange={setDescription} disabled={disabled || isSaving} id="order-activity-message" initialGroup={order.isPayment ? 'الشراء' : 'الوصول'} order={order} />
        <div className="op-actions">
          <Button variant="contained" type="button" onClick={submit} disabled={disabled || isSaving || !country.trim() || !description.trim()}>{isSaving ? 'جارٍ الإضافة…' : 'إضافة التحديث'}</Button>
        </div>
      </div>
    </Panel>
  );
};

const Whatsapp = ({ order, disabled, toast }: Pick<Props, 'order' | 'disabled' | 'toast'>) => {
  const [message, setMessage] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const priceRequest = useRef(0);
  useEffect(() => {
    setIsLoadingPrices(false);
    return () => { priceRequest.current++; };
  }, [order._id]);
  const messages = customerMessages(order);
  const chooseMessage = (text: string) => {
    priceRequest.current++;
    setIsLoadingPrices(false);
    setMessage(text);
  };

  // The warehouse message followed by the current price list of the order's shipping method
  const withPrices = async () => {
    const request = ++priceRequest.current;
    setIsLoadingPrices(true);
    setMessage('');
    try {
      const customerId = order.user?._id || (typeof order.user === 'string' ? order.user : undefined);
      // Re-read the customer's prices when preparing the message, since they may
      // have changed since the order page was opened.
      const customer = customerId ? (await api.get(`customer/${customerId}`)).data : order.user;
      const origin = shippingPriceCountry(order?.shipment?.fromWhere);
      const special = specialPriceMessage(customer?.specialPrices, order?.shipment?.method, origin);
      let description = special;
      if (!special) {
        const prices = (await api.get('shipmentPrices'))?.data || [];
        const price = prices.find((item: any) => item.shippingType === order?.shipment?.method && shippingPriceCountry(item.country) === origin);
        if (!price) throw new Error('لا توجد أسعار شحن لهذا البلد وطريقة الشحن.');
        description = price.priceDescription || `سعر الشحن: ${price.sellingPrice} دولار / ${price.shippingType === 'sea' ? 'متر مكعب' : 'كجم'}`;
      }
      if (request === priceRequest.current) setMessage(removeBr(`${special ? 'سعر حصري لك\n\n' : ''}${messages.arrivedWarehouse} -----------------------\n${description}`));
    } catch (error) {
      if (request === priceRequest.current) toast('error', apiErrorMessage(error));
    } finally {
      if (request === priceRequest.current) setIsLoadingPrices(false);
    }
  };

  const send = async () => {
    if (!message.trim()) return toast('error', 'Write the message first');
    try {
      setIsSending(true);
      await api.post('sendWhatsupMessage', { phoneNumber: `${order.customerInfo.phone}@s.whatsapp.net`, message });
      toast('success', 'WhatsApp message sent');
    } catch (error: any) {
      const code = error?.response?.data?.message;
      toast('error', code === 'whatsup-auth-not-found' ? 'WhatsApp is not linked. Get the QR code and scan it from your phone.' : apiErrorMessage(error));
    }
    setIsSending(false);
  };

  const getQr = async () => {
    try {
      setQrCode((await api.get('get-qr-code')).data.qrCode || '');
      setShowQr(true);
    } catch (error) {
      toast('error', apiErrorMessage(error));
    }
  };

  return (
    <Panel title="WhatsApp message">
      <div className="op-stack">
        <ButtonGroup variant="outlined" size="small" className="op-templates" aria-label="Message templates">
          <Button type="button" onClick={withPrices} disabled={isLoadingPrices}>{isLoadingPrices ? 'تجهيز الأسعار…' : 'وصلت مخزن باسعار'}</Button>
          <Button type="button" onClick={() => chooseMessage(messages.arrivedWarehouse)}>وصلت بدون اسعار</Button>
          <Button type="button" onClick={() => chooseMessage(messages.invoicePaid)}>الفاتورة دفعت</Button>
          <Button type="button" onClick={() => chooseMessage('')}>فارغ</Button>
        </ButtonGroup>
        <TextField label="Message" multiline minRows={6} maxRows={14} dir="rtl" value={message} onChange={(event) => chooseMessage(event.target.value)} />
        <div className="op-actions op-actions--between">
          <FormControlLabel label="Show QR code" control={<Switch size="small" checked={showQr} onChange={(event) => setShowQr(event.target.checked)} />} />
          <div className="op-actions">
            <Button variant="outlined" type="button" onClick={getQr}>Get QR</Button>
            <Button variant="contained" type="button" onClick={send} disabled={disabled || isSending || isLoadingPrices}>{isSending ? 'Sending' : 'Send'}</Button>
          </div>
        </div>
        {showQr && (qrCode ? <QRCode value={qrCode} /> : <p className="op-muted">Press Get QR to load the code.</p>)}
      </div>
    </Panel>
  );
};

const Activities = ({ order, canDeleteActivity, onDeleteActivity }: Pick<Props, 'order' | 'canDeleteActivity' | 'onDeleteActivity'>) => {
  // The activity waiting for a second click to be deleted
  const [confirming, setConfirming] = useState<string | null>(null);
  const activities: OrderActivity[] = [...(order.activity || [])].sort((a: any, b: any) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any));
  return (
    <Panel title={`Activities (${activities.length})`}>
      {activities.length === 0 && <p className="op-muted">No activity yet. Add the first one above.</p>}
      <ul className="op-timeline" dir="rtl">
        {activities.map((activity: any, index: number) => (
          <li key={activity._id || index}>
            <div className="op-timeline__text">
              <span className="op-timeline__meta">{moment(activity.createdAt).format('DD/MM/YYYY HH:mm')} · {activity.country}</span>
              <span>{activity.description}</span>
            </div>
            {canDeleteActivity && activity._id && (confirming === activity._id ? (
              <span className="op-timeline__confirm" dir="ltr">
                <Button size="small" color="error" variant="contained" type="button" onClick={() => { setConfirming(null); onDeleteActivity(activity); }}>Delete</Button>
                <Button size="small" type="button" onClick={() => setConfirming(null)}>Keep</Button>
              </span>
            ) : (
              <Tooltip title="Delete this activity">
                <IconButton size="small" aria-label="Delete this activity" onClick={() => setConfirming(activity._id)}><MdDeleteOutline /></IconButton>
              </Tooltip>
            ))}
          </li>
        ))}
      </ul>
    </Panel>
  );
};

// Everything around the form of an order: its images, the customer timeline and messaging
const OrderSidebar = (props: Props) => (
  <aside className="op-sidebar">
    <Images order={props.order} onUploadImages={props.onUploadImages} onDeleteImage={props.onDeleteImage} />
    <AddActivity order={props.order} disabled={props.disabled} toast={props.toast} onOrderChanged={props.onOrderChanged} />
    <Activities order={props.order} canDeleteActivity={props.canDeleteActivity} onDeleteActivity={props.onDeleteActivity} />
    <Whatsapp order={props.order} disabled={props.disabled} toast={props.toast} />
    <Panel title="Supplier note">
      <div className="op-stack">
        <TextField multiline minRows={6} maxRows={12} defaultValue={supplierMessage(props.order)} inputProps={{ 'aria-label': 'Message for the supplier' }} />
        <div className="op-actions">
          <Button variant="outlined" type="button" onClick={props.onOpenLabel} disabled={props.disabled}>Shipping label</Button>
        </div>
      </div>
    </Panel>
  </aside>
);

export default OrderSidebar;
