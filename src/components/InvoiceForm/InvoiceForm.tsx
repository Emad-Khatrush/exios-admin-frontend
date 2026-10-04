import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Avatar, AvatarGroup, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl,
  IconButton, InputAdornment, InputLabel, MenuItem, Select, TextField, Tooltip,
} from '@mui/material';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import moment from 'moment';
import { BiNote } from 'react-icons/bi';
import { BsCheck2Circle } from 'react-icons/bs';
import { MdAdd, MdAttachFile, MdOpenInNew, MdOutlineEdit } from 'react-icons/md';

import api from '../../api';
import { Invoice, OrderItem, User } from '../../models';
import { convertGoogleStorageUrl, getOrderSteps } from '../../utils/methods';
import { getErrorMessage } from '../../utils/errorHandler';
import { SpecialPrices, getShippingMode } from '../../utils/specialPrices';
import Badge from '../Badge/Badge';
import ImageUploader from '../ImageUploader/ImageUploader';
import SpecialPricePicker from '../SpecialPricePicker/SpecialPricePicker';
import SwipeableTextMobileStepper from '../SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import PackageDialog, { CLOSED_PACKAGE, PackageDraft, reportPackageField } from './PackageDialog';
import { LIBYAN_CITIES, ORIGIN_COUNTRIES, OrderKind, PACKAGE_STEPS, PURCHASE_CURRENCIES, SHIPMENT_METHODS, apiErrorMessage, toDate, unitForMethod } from './constants';
import { Checkpoints, ComboField, NUMBER_INPUT, OrderKindPicker, RemoveRowButton, Section, SelectField, ToggleChip, blurOnWheel, formatMoney, packageFees, packageFigures, packageTotal, PackagesSummary, totalText } from './parts';
import { useOffices } from '../../utils/useOffices';
import './InvoiceForm.scss';

type Props = {
  // Every field reports here as (event, checked?, child?, fieldName?); rows pass their index as the id
  handleChange: any
  invoice?: Invoice
  employees?: User[]
  isEmployee?: boolean
  totalInvoice: number
  displayAlert: (alert: { type: 'error' | 'success', message: string }) => void

  items?: OrderItem[]
  onAddItem: () => void
  onRemoveItem: (index: number) => void

  // Purchase costs exist on a saved order only; without these the section is hidden
  purchaseItems?: any[]
  onAddPurchaseItem?: () => void
  onRemovePurchaseItem?: (index: number) => void

  paymentList?: any[]
  // A new package starts with the order's shipping method and the unit that goes with it
  onAddPackage: (defaults: { shipmentMethod?: string, measureUnit?: string }) => void
  onRemovePackage: (index: number) => void
  onUploadPackageFiles?: (event: any) => Promise<any[]>
  onDeletePackageFile?: (file: any, packageId: string) => Promise<any[]>
}

const rowKey = (row: any, index: number) => row?._id || row?.index || index;
const isLink = (value: any) => /^https?:\/\//i.test(String(value || '').trim());
const kindOf = (invoice?: Invoice): OrderKind => (invoice?.isPayment ? (invoice?.isShipment ? 'both' : 'payment') : 'shipment');
// A purchase link is only bought and paid; it has no journey to follow
const PAID_STEP = PACKAGE_STEPS.slice(0, 1);
// A shipment is not bought by us, so its packages have nothing to be paid at the seller
const SHIPPING_STEPS = PACKAGE_STEPS.slice(1);
// The shared account for shipments whose owner is not known yet
const UNKNOWN_CUSTOMER = { id: 'A000', name: 'مجهول' };

const InvoiceForm = (props: Props) => {
  // Offices are data (spec C4)
  const offices = useOffices();
  const officeOptions: [string, string][] = offices.map((o) => [o.code, `${o.nameEn || o.name} office`]);
  const { handleChange, employees, items = [], purchaseItems = [], paymentList = [] } = props;
  const { roles } = useSelector((state: any) => state.session.account);

  // A local copy for what this form shows about the customer; the page keeps the data to save
  const [invoice, setInvoice] = useState<Invoice | undefined>(props.invoice);
  const [customerId, setCustomerId] = useState<string | undefined>(props.invoice?.user?.customerId);
  const [userId, setUserId] = useState<string | undefined>(props.invoice?.user?._id);
  const [customerCity, setCustomerCity] = useState<string | undefined>();
  const [isChecking, setIsChecking] = useState(false);
  const [specialPrices, setSpecialPrices] = useState<SpecialPrices | undefined>((props.invoice?.user as any)?.specialPrices);
  const [shipmentMethod, setShipmentMethod] = useState<string | undefined>(props.invoice?.shipment?.method);
  const [shipmentPrice, setShipmentPrice] = useState<number | string>(props.invoice?.shipment?.exiosShipmentPrice ?? '');

  const [kind, setKind] = useState<OrderKind>(kindOf(props.invoice));
  const [packageDialog, setPackageDialog] = useState<PackageDraft>(CLOSED_PACKAGE);
  // The row whose note is being written, and the text so far
  const [noteDialog, setNoteDialog] = useState<{ index: number, text: string } | null>(null);
  // The purchase link whose photos and files are open
  const [filesDialog, setFilesDialog] = useState<{ index: number, _id?: string, images: any[] } | null>(null);
  const filesRef = useRef();
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(toDate((props.invoice as any)?.createdAt) || new Date());
  const [removingPackage, setRemovingPackage] = useState<number | null>(null);
  const [previewImages, setPreviewImages] = useState<any[] | undefined>();

  // Read from the page's order, so cancelling or confirming locks the form at once
  const isCanceled = !!props.invoice?.isCanceled;
  const isConfirmed = !!props.invoice?.invoiceConfirmed;
  const itemsLocked = isCanceled || isConfirmed;
  const canChangeDate = !!roles.isAdmin && !itemsLocked;
  // Supplier costs are entered as bills from the order's Accounting section (owner's request
  // 2026-10-04): the old section shows only on an order that already has costs typed in it
  const canSeeCosts = (roles.isAccountant || roles.isAdmin) && !!props.onAddPurchaseItem && (props.purchaseItems || []).length > 0;
  const hasShipping = kind !== 'payment';
  const hasLinks = kind !== 'shipment';
  const steps = getOrderSteps({ ...(invoice || {}), isPayment: hasLinks, isShipment: hasShipping } as any);
  const total = props.totalInvoice || invoice?.totalInvoice || 0;

  useEffect(() => {
    handleChange({ target: { value: props.invoice?.user?.customerId, name: 'customerId' } });
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCustomerInfo = (field: 'fullName' | 'email' | 'phone') => (event: any) => {
    handleChange(event);
    const value = event.target.value;
    setInvoice((current) => ({ ...(current || {}), customerInfo: { ...(current?.customerInfo || {}), [field]: value } } as any));
  };

  // Fills name, phone and email from the customer's account. `knownAs` replaces the account's
  // name (the shared account of shipments whose owner is not known yet).
  const checkCustomer = async (id = customerId, knownAs?: string) => {
    if (!String(id || '').trim()) return props.displayAlert({ type: 'error', message: 'Type the customer id first' });
    try {
      setIsChecking(true);
      const user: User = (await api.get(`customer/${String(id).trim()}`)).data;
      const fullName = knownAs || `${user.firstName} ${user.lastName}`;
      setUserId(user._id);
      setCustomerCity(user.city);
      setSpecialPrices((user as any).specialPrices);
      setInvoice((current) => ({ ...(current || {}), customerInfo: { fullName, phone: user.phone, email: user.username } } as any));
      handleChange({ target: { value: fullName, name: 'fullName' } });
      handleChange({ target: { value: user.phone, name: 'phone' } });
      handleChange({ target: { value: user.username, name: 'email' } });
      props.displayAlert({ type: 'success', message: 'Customer details filled in' });
    } catch (error: any) {
      const code = error?.response?.data?.message;
      props.displayAlert({ type: 'error', message: (code && getErrorMessage(code)) || apiErrorMessage(error) });
    }
    setIsChecking(false);
  };

  // A shipment that arrived with no known owner goes on the shared account until it is claimed
  const pickUnknownCustomer = () => {
    setCustomerId(UNKNOWN_CUSTOMER.id);
    handleChange({ target: { name: 'customerId', value: UNKNOWN_CUSTOMER.id } });
    checkCustomer(UNKNOWN_CUSTOMER.id, UNKNOWN_CUSTOMER.name);
  };

  const changeShipmentPrice = (price: number | string) => {
    setShipmentPrice(price);
    handleChange({ target: { name: 'exiosShipmentPrice', value: price, inputMode: 'numeric' } });
  };

  const changeKind = (next: OrderKind) => {
    setKind(next);
    handleChange({ target: { name: 'isPayment' } }, next !== 'shipment');
    handleChange({ target: { name: 'isShipment' } }, next !== 'payment');
  };

  // What a package takes from the order when it has no method or unit of its own
  const packageDefaults = (method = shipmentMethod): { shipmentMethod?: string, measureUnit?: string } => (
    method === 'air' || method === 'sea' ? { shipmentMethod: method, measureUnit: unitForMethod(method) } : {}
  );

  // The order's shipping method is also the method of every package that has none yet
  const changeShipmentMethod = (event: any) => {
    const method = String(event.target.value);
    setShipmentMethod(method);
    handleChange(event);
    const defaults = packageDefaults(method);
    if (!defaults.shipmentMethod) return;
    paymentList.forEach((payment: any, index: number) => {
      const details = payment?.deliveredPackages || {};
      if (details.shipmentMethod) return;
      reportPackageField(handleChange, index, 'shipmentMethod', defaults.shipmentMethod);
      if (!packageFigures(details).unit) reportPackageField(handleChange, index, 'measureUnit', defaults.measureUnit);
    });
  };

  const stepDone = (payment: any, name: string) => !!(payment?.[name] || payment?.status?.[name]);

  const openPackage = (payment: any, index: number) => {
    const details = payment?.deliveredPackages || {};
    const { weight, unit } = packageFigures(details);
    // An older package with no method or unit takes them from the order, and keeps them
    const defaults = isCanceled ? {} : packageDefaults();
    const method = details.shipmentMethod || defaults.shipmentMethod || '';
    const measureUnit = unit || (isCanceled ? '' : unitForMethod(method));
    if (method && !details.shipmentMethod) reportPackageField(handleChange, index, 'shipmentMethod', method);
    if (measureUnit && !unit) reportPackageField(handleChange, index, 'measureUnit', measureUnit);
    setPackageDialog({
      open: true,
      id: index,
      _id: payment?._id,
      trackingNumber: details.trackingNumber || '',
      shipmentMethod: method,
      locationPlace: details.locationPlace || '',
      packageWeight: weight || '',
      measureUnit,
      exiosPrice: details.exiosPrice ?? '',
      boxesCount: details.boxesCount ?? '',
      arrivedAt: details.arrivedAt,
      visableForClient: payment?.settings?.visableForClient !== false,
      images: payment?.images || [],
      volumetric: details.volumetric || {},
      actualWeight: details.weight?.actual ?? details.actualWeight ?? '',
      domesticFee: details.domesticFee || {},
      customsFee: details.customsFee || {},
      savedWithWeight: !!payment?._id && Number(weight) > 0,
    });
  };

  const changeNote = (text: string) => {
    if (!noteDialog) return;
    setNoteDialog({ ...noteDialog, text });
    handleChange({ target: { id: String(noteDialog.index), name: 'note', value: text } });
  };

  return (
    <div className="order-form">
      <Section title="Order type" hint="Choose this first. The packages section below follows it.">
        <OrderKindPicker value={kind} onChange={changeKind} disabled={isCanceled} />
        {kind !== 'shipment' && (
          <div style={{ marginTop: 12 }}>
            {/* An Alipay transfer is billed like a purchase: the customer pays in dollars, the yuan is
                sent to their supplier from Alipay (add it under the order's purchases) */}
            <ToggleChip
              label="Alipay transfer (yuan sent to the customer's supplier)"
              name="isRemittance"
              defaultChecked={!!(props.invoice as any)?.isRemittance}
              onChange={(event: any, checked: boolean) => handleChange(event, checked)}
              disabled={isCanceled}
            />
          </div>
        )}
      </Section>

      <Section title="Customer" hint="Type the customer id and press Check to fill the rest from their account.">
        <div className="of-grid of-grid--2">
          <div>
            <div className="of-inline">
              <TextField
                name="customerId" required label="Customer id" value={customerId || ''} disabled={isCanceled}
                onChange={(event: any) => { handleChange(event); setCustomerId(event.target.value); }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); checkCustomer(); } }}
              />
              <Button variant="contained" type="button" onClick={() => checkCustomer()} disabled={isCanceled || isChecking}>{isChecking ? 'Checking' : 'Check'}</Button>
            </div>
            <div className="of-under">
              <button type="button" className="of-textlink" onClick={pickUnknownCustomer} disabled={isCanceled || isChecking}>Unknown owner? Use {UNKNOWN_CUSTOMER.id} ({UNKNOWN_CUSTOMER.name})</button>
              {userId && <a className="of-link" target="_blank" href={`/user/${userId}`} rel="noreferrer">Open customer page</a>}
            </div>
          </div>
          <TextField name="fullName" required label="Full name" value={invoice?.customerInfo?.fullName || ''} onChange={changeCustomerInfo('fullName')} disabled={isCanceled} />
          <TextField name="phone" required label="Phone" value={invoice?.customerInfo?.phone ?? ''} onChange={changeCustomerInfo('phone')} disabled={isCanceled} />
          <TextField name="email" label="Email" value={invoice?.customerInfo?.email || ''} onChange={changeCustomerInfo('email')} disabled={isCanceled} />
          <FormControl disabled={isCanceled}>
            <InputLabel>Made by</InputLabel>
            <Select className="of-made-by" label="Made by" name="madeBy" defaultValue={invoice?.madeBy?._id || ''} onChange={(event) => handleChange(event)}>
              {(employees || []).map((employee) => (
                <MenuItem key={employee._id} value={employee._id}>
                  <Avatar sx={{ width: 26, height: 26, marginRight: '10px' }} alt={`${employee.firstName} ${employee.lastName}`} src={employee.imgUrl} />
                  {employee.firstName} {employee.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </Section>

      <Section title="Order">
        <div className="of-grid of-grid--2">
          <TextField name="productName" required label="Products category" onChange={handleChange} defaultValue={invoice?.productName} disabled={isCanceled} />
          <SelectField label="Office" name="placedAt" options={officeOptions} defaultValue={invoice?.placedAt} onChange={handleChange} required disabled={isCanceled} />
          <ComboField label="Shipment from" name="fromWhere" options={ORIGIN_COUNTRIES} defaultValue={invoice?.shipment?.fromWhere} onChange={handleChange} required disabled={isCanceled} helperText="Choose غير to write a country that is not listed" />
          <ComboField
            label="Shipment to" name="toWhere" options={LIBYAN_CITIES} defaultValue={invoice?.shipment?.toWhere} onChange={handleChange} required disabled={isCanceled}
            helperText={customerCity ? `Customer city: ${customerCity}` : 'Choose غير to write a city that is not listed'}
          />
          {/* A shipment's invoice is final from the moment it is created; only a purchase has a date to set */}
          {hasLinks && <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Invoice date" inputFormat="dd/MM/yyyy" value={invoiceDate} disabled={!canChangeDate}
              renderInput={(params: any) => (
                <TextField
                  {...params}
                  helperText={!roles.isAdmin ? 'Only admins can change the date' : isConfirmed ? 'Locked: the invoice is confirmed' : 'Can be changed until the invoice is confirmed'}
                />
              )}
              onChange={(date: any) => {
                setInvoiceDate(date);
                if (toDate(date)) handleChange({ target: { name: 'createdAt', value: toDate(date)!.toISOString() } });
              }}
            />
          </LocalizationProvider>}
          <div className="of-grid__wide">
            <TextField name="orderNote" label="Order note" multiline minRows={2} maxRows={8} dir="auto" onChange={handleChange} defaultValue={invoice?.orderNote} disabled={isCanceled} />
          </div>
        </div>

        <div className="of-flags">
          <div className="of-chips">
            <ToggleChip label="Not active order" name="unsureOrder" tone="warn" defaultChecked={invoice?.unsureOrder} onChange={handleChange} disabled={isCanceled} />
            <ToggleChip label="Has remaining payment" name="hasRemainingPayment" tone="warn" defaultChecked={invoice?.hasRemainingPayment} onChange={handleChange} disabled={isCanceled} />
            <ToggleChip label="Order has a problem" name="hasProblem" tone="danger" defaultChecked={invoice?.hasProblem} onChange={handleChange} disabled={isCanceled} />
          </div>
        </div>
      </Section>

      <Section title="Shipping and status">
        <div className="of-grid of-grid--2">
          <SelectField
            label="Order status" name="orderStatus" required disabled={isCanceled} defaultValue={invoice?.orderStatus || 0} onChange={handleChange}
            options={steps.map((step: any, index: number) => [index as any, step.label])}
          />
          <SelectField
            label="Shipping method" name="method" options={SHIPMENT_METHODS} required disabled={isCanceled} defaultValue={invoice?.shipment?.method}
            onChange={changeShipmentMethod}
          />
          <div>
            <TextField
              label="Exios price" name="exiosShipmentPrice" required type="number" inputProps={NUMBER_INPUT} onWheel={blurOnWheel} disabled={isCanceled}
              value={shipmentPrice} onChange={(event) => changeShipmentPrice(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              helperText="What the customer pays per KG or CBM"
            />
            <SpecialPricePicker prices={specialPrices} mode={getShippingMode(undefined, shipmentMethod)} selected={shipmentPrice} onPick={changeShipmentPrice} disabled={isCanceled} />
          </div>
          {!props.isEmployee && (
            <TextField
              label="Net income" name="netIncome" type="number" inputProps={{ ...NUMBER_INPUT, min: undefined }} onChange={handleChange} onWheel={blurOnWheel} disabled={isCanceled}
              defaultValue={invoice?.netIncome?.length ? invoice.netIncome[0]?.total : ''}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          )}
        </div>
      </Section>

      {/* A shipment bills by the weight of its packages, so it has no items to list */}
      {hasLinks && <Section
        title="Invoice items"
        hint={isConfirmed ? 'The invoice is confirmed. To change its items, request an edit from the Payments tab.' : 'What the customer is billed for.'}
        action={<div className="of-total"><span>Total</span><strong>{formatMoney(Number(total))}</strong></div>}
      >
        {items.map((item: OrderItem, index: number) => (
          <div className="of-item-row" key={rowKey(item, index)}>
            <span className="of-row-no">{index + 1}</span>
            <TextField id={String(index)} label="Description" name="description" onChange={handleChange} disabled={itemsLocked} dir="auto" defaultValue={item.description} />
            <TextField id={String(index)} label="Quantity" name="itemQuantity" type="number" inputProps={NUMBER_INPUT} onChange={handleChange} onWheel={blurOnWheel} disabled={itemsLocked} defaultValue={item.quantity} />
            <TextField id={String(index)} label="Unit price" name="unitPrice" type="number" inputProps={NUMBER_INPUT} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} onChange={handleChange} onWheel={blurOnWheel} disabled={itemsLocked} defaultValue={item.unitPrice} />
            <span className="of-row-sum">{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</span>
            <RemoveRowButton label="Remove this item" onClick={() => props.onRemoveItem(index)} disabled={itemsLocked || items.length <= 1} />
          </div>
        ))}
        <div className="of-row-actions">
          <Button variant="outlined" size="small" type="button" startIcon={<MdAdd />} onClick={props.onAddItem} disabled={itemsLocked}>Add item</Button>
        </div>
      </Section>}

      {canSeeCosts && (
        <Section title="Purchase costs" hint="What was paid to the seller for this order. Visible to admins and accountants only.">
          {purchaseItems.length === 0 && <p className="of-empty">No purchase costs recorded.</p>}
          {purchaseItems.map((item: any, index: number) => (
            <div className="of-cost-row" key={rowKey(item, index)}>
              <span className="of-row-no">{index + 1}</span>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Payment date" inputFormat="dd/MM/yyyy" value={toDate(item?.date) || new Date()}
                  renderInput={(params: any) => <TextField {...params} />}
                  onChange={(value) => handleChange({ target: { value, id: String(index) } }, undefined, undefined, 'purchaseItemDate')}
                />
              </LocalizationProvider>
              <TextField id={String(index)} label="Description" name="purchaseItemDescription" onChange={handleChange} dir="auto" defaultValue={item.description} />
              <TextField id={String(index)} label="Amount" name="purchaseItemUnitPrice" type="number" inputProps={NUMBER_INPUT} onChange={handleChange} onWheel={blurOnWheel} defaultValue={item.unitPrice} />
              <SelectField
                label="Currency" name="purchaseItemCurrency" id={String(index)} defaultValue={item?.currency}
                options={PURCHASE_CURRENCIES.map(([code, name]) => [code, `${code} - ${name}`])}
                onChange={(event) => handleChange(event, undefined, undefined, 'purchaseItemCurrency')}
              />
              <RemoveRowButton label="Remove this cost" onClick={() => props.onRemovePurchaseItem!(index)} />
            </div>
          ))}
          <div className="of-row-actions">
            <Button variant="outlined" size="small" type="button" startIcon={<MdAdd />} onClick={props.onAddPurchaseItem}>Add cost</Button>
          </div>
        </Section>
      )}

      <Section
        title={`${hasShipping ? 'Packages' : 'Payment links'} (${paymentList.length})`}
        hint={hasShipping
          ? `Each package has its own journey, weight and price${hasLinks ? ', and the link it was bought from' : ''}. Click a step to tick it.`
          : 'What we buy for the customer: one row per link, with its note and whether it is paid.'}
        action={(
          <Button variant="outlined" size="small" type="button" startIcon={<MdAdd />} onClick={() => props.onAddPackage(packageDefaults())} disabled={isCanceled}>
            {hasShipping ? 'Add package' : 'Add link'}
          </Button>
        )}
      >
        {hasShipping && paymentList.length > 0 && <PackagesSummary paymentList={paymentList} />}
        {paymentList.map((payment: any, index: number) => {
          const details = payment?.deliveredPackages || {};
          const figures = packageFigures(details);
          const deliveredAt = toDate(details.deliveredInfo?.deliveredDate);
          const link = payment?.link ?? payment?.paymentLink;
          const hidden = payment?.settings?.visableForClient === false;
          const paid = stepDone(payment, 'paid');
          const toggleStep = (name: string) => handleChange({ target: { id: String(index), name } });

          const images = payment?.images?.length > 0 && (
            <AvatarGroup max={3} className="of-package__images">
              {payment.images.map((img: any) => (
                <Avatar key={img.filename} alt={img.filename} src={convertGoogleStorageUrl(img.path)} onClick={() => setPreviewImages(payment.images)} />
              ))}
            </AvatarGroup>
          );
          const noteButton = (
            <Button variant="outlined" size="small" type="button" startIcon={<BiNote />} onClick={() => setNoteDialog({ index, text: payment?.note || '' })} disabled={isCanceled}>
              {payment?.note ? 'Edit note' : 'Add note'}
            </Button>
          );
          const remove = (
            <RemoveRowButton label={hasShipping ? 'Remove this package' : 'Remove this link'} onClick={() => setRemovingPackage(index)} disabled={isCanceled || paymentList.length <= 1} />
          );
          const note = payment?.note && <p className="of-package__note" dir="auto"><BiNote /> {payment.note}</p>;
          const linkField = (
            <div className="of-inline">
              <TextField id={String(index)} label={hasShipping ? 'Purchase link' : 'Payment link'} name="paymentLink" onChange={handleChange} defaultValue={link} disabled={isCanceled} placeholder="https://" />
              {isLink(link) && (
                <Tooltip title="Open the link">
                  <IconButton component="a" href={String(link).trim()} target="_blank" rel="noreferrer" aria-label="Open the link"><MdOpenInNew /></IconButton>
                </Tooltip>
              )}
            </div>
          );

          // A purchase with no shipping: the link, its note and whether it is paid
          if (!hasShipping) {
            return (
              <article className="of-package" key={rowKey(payment, index)}>
                <header className="of-package__head">
                  <div className="of-package__title">
                    <strong>Link {index + 1}</strong>
                    <Badge text={paid ? 'Paid' : 'Not paid'} color={paid ? 'success' : 'warning'} />
                  </div>
                  <div className="of-package__actions">
                    {images}
                    <Button variant="outlined" size="small" type="button" startIcon={<MdAttachFile />} onClick={() => setFilesDialog({ index, _id: payment?._id, images: payment?.images || [] })}>
                      Files{payment?.images?.length ? ` (${payment.images.length})` : ''}
                    </Button>
                    {noteButton}
                    {remove}
                  </div>
                </header>
                {linkField}
                {note}
                <Checkpoints steps={PAID_STEP} disabled={isCanceled} isDone={(name) => stepDone(payment, name)} onToggle={toggleStep} />
              </article>
            );
          }

          return (
            <article className="of-package" key={rowKey(payment, index)}>
              <header className="of-package__head">
                <div className="of-package__title">
                  <strong>Package {index + 1}</strong>
                  {details.trackingNumber ? <span className="of-package__tracking">{details.trackingNumber}</span> : <span className="of-package__missing">No tracking number yet</span>}
                  {details.shipmentMethod && <Badge text={String(details.shipmentMethod).toUpperCase()} color="primary" />}
                  {details.locationPlace && <Badge text={details.locationPlace} color="warning" />}
                  {payment?.flight && <a href={`/inventory/${payment.flight._id}/edit`} target="_blank" rel="noreferrer"><Badge text={payment.flight.voyage} color="sky" /></a>}
                  {hidden && <Badge text="Hidden from customer" color="danger" />}
                </div>
                <div className="of-package__actions">
                  {images}
                  {noteButton}
                  <Button variant="contained" size="small" type="button" startIcon={<MdOutlineEdit />} onClick={() => openPackage(payment, index)}>Details</Button>
                  {remove}
                </div>
              </header>

              <Checkpoints steps={hasLinks ? PACKAGE_STEPS : SHIPPING_STEPS} disabled={isCanceled} isDone={(name) => stepDone(payment, name)} onToggle={toggleStep} />

              <dl className="of-package__facts">
                <div><dt>Weight</dt><dd>{figures.weight ? `${figures.weight} ${figures.unit}` : 'Not set'}</dd></div>
                <div><dt>Exios price</dt><dd>{figures.price ? formatMoney(figures.price) : 'Not set'}</dd></div>
                <div><dt>Charge</dt><dd className="of-package__charge">{figures.charge ? formatMoney(figures.charge) : 'Not set'}</dd></div>
                {packageFees(details).map((fee) => (
                  <div key={fee.label}><dt>{fee.label}</dt><dd>{fee.currency === 'USD' ? formatMoney(fee.amount) : `${fee.amount.toLocaleString('en-US')} LYD`}</dd></div>
                ))}
                {packageFees(details).length > 0 && <div><dt>Package total</dt><dd className="of-package__charge">{totalText(packageTotal(details))}</dd></div>}
                <div><dt>Boxes</dt><dd>{details.boxesCount || 'Not set'}</dd></div>
                {deliveredAt && stepDone(payment, 'received') && <div><dt>Delivered</dt><dd><BsCheck2Circle /> {moment(deliveredAt).format('DD/MM/YYYY HH:mm')}</dd></div>}
              </dl>

              {note}
              {hasLinks && linkField}
            </article>
          );
        })}
      </Section>

      <Dialog open={!!filesDialog} onClose={() => setFilesDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Link {(filesDialog?.index ?? 0) + 1} files</DialogTitle>
        <DialogContent dividers>
          {filesDialog?._id && props.onUploadPackageFiles ? (
            <ImageUploader
              id={filesDialog._id}
              inputFileRef={filesRef}
              fileUploaderHandler={async (event: any) => { const images = await props.onUploadPackageFiles!(event); setFilesDialog((current) => current && { ...current, images }); }}
              previewFiles={filesDialog.images}
              deleteImage={props.onDeletePackageFile && !isCanceled
                ? async (file: any) => { const images = await props.onDeletePackageFile!(file, filesDialog._id!); setFilesDialog((current) => current && { ...current, images }); }
                : undefined}
            />
          ) : (
            <p className="of-empty">Photos and files can be attached after the link is saved. Save the invoice, then open Files again.</p>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setFilesDialog(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!noteDialog} onClose={() => setNoteDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{hasShipping ? 'Package' : 'Link'} {(noteDialog?.index ?? 0) + 1} note</DialogTitle>
        <DialogContent>
          <TextField
            className="mt-2" label="Note" multiline minRows={4} maxRows={10} fullWidth autoFocus dir="auto"
            value={noteDialog?.text || ''} onChange={(event) => changeNote(event.target.value)}
            helperText="Kept with the form and stored when you save the invoice."
          />
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => changeNote('')} disabled={!noteDialog?.text}>Clear</Button>
          <Button variant="contained" onClick={() => setNoteDialog(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <PackageDialog
        value={packageDialog}
        onChange={setPackageDialog}
        onClose={() => setPackageDialog({ ...packageDialog, open: false })}
        handleChange={handleChange}
        specialPrices={specialPrices}
        disabled={isCanceled}
        onUploadFiles={props.onUploadPackageFiles}
        onDeleteFile={props.onDeletePackageFile}
      />

      <Dialog open={removingPackage !== null} onClose={() => setRemovingPackage(null)}>
        <DialogTitle dir="rtl">حذف طرد</DialogTitle>
        <DialogContent>
          <DialogContentText dir="rtl">هل انت متاكد من حذف الطرد رقم {(removingPackage ?? 0) + 1} ورابطه؟ يُحذف نهائياً عند حفظ الفاتورة.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemovingPackage(null)}>تراجع</Button>
          <Button color="error" variant="contained" autoFocus onClick={() => { props.onRemovePackage(removingPackage!); setRemovingPackage(null); }}>نعم، اريد حذفه</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!previewImages} onClose={() => setPreviewImages(undefined)}>
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InvoiceForm;
