import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteMatch } from 'react-router-dom';
import { Alert, Backdrop, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Snackbar, Tab, Tabs, TextField } from '@mui/material';
import moment from 'moment';

import api from '../../api';
import { Account, Debt, User } from '../../models';
import withRouter from '../../utils/WithRouter/WithRouter';
import { calculateTotalWallet, getOrderSteps } from '../../utils/methods';
import { formatInvoiceFields, formatPurchaseFields } from '../XTrackingPage/utils';
import Badge from '../../components/Badge/Badge';
import InvoiceForm from '../../components/InvoiceForm/InvoiceForm';
import { apiErrorMessage } from '../../components/InvoiceForm/constants';
import { InvoiceTemplate } from '../../components/InvoiceTemplate/InvoiceTemplate';
import CreateDebtDialog from '../../components/DebtsPage/CreateDebtDialog';
import EditInvoiceItems from '../../components/EditInvoiceItems/EditInvoiceItems';
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper';
import { OrderAccounting } from '../Accounting/AccountingPanels';
import OrderSidebar from './OrderSidebar';
import OrderPayments from './OrderPayments';
import OrderWalletDialog from './OrderWalletDialog';
import ShippingLabelDialog from './ShippingLabelDialog';
import OrderTheme from './OrderTheme';
import {
  CANCEL_ALLOWED_ACCOUNTS, ITEM_FIELDS, PACKAGE_CHECKPOINTS, PACKAGE_FIELDS, PACKAGE_ROW_FIELDS, PURCHASE_FIELDS, SHIPMENT_FIELDS,
  newItem, newPackage, newPurchaseItem, totalDebts, totalOfItems,
} from './orderConstants';

import './orderPage.scss';

// Other screens import these from here
export { countries, orderActions, removeBr } from './orderConstants';

type TabKey = 'details' | 'payments' | 'accounting';
type WalletCategory = 'invoice' | 'receivedGoods';

type Props = {
  router: RouteMatch
  isEmployee: boolean
  account: Account
}

type State = {
  order: any
  loadError: string | null
  employees: User[]
  userDebts: Debt[]
  wallet: any
  payments: any[]
  // The rows being edited; the page keeps them because the form's inputs are uncontrolled
  items: any[]
  purchaseItems: any[]
  paymentList: any[]
  // Only what the user changed is sent on save
  changedFields: Record<string, any>
  tab: TabKey
  isBusy: boolean
  toast: { open: boolean, type: 'success' | 'error', message: string }
  copied: boolean
  cancelDialog: boolean
  cancelationReason: string
  labelDialog: boolean
  previewDialog: boolean
  debtDialog: boolean
  editItemsDialog: boolean
  // The payment being made from the wallet: what for, which packages and how much is due
  walletPayment?: { category: WalletCategory, packages: any[], dueUsd: number }
  previewImages?: any[]
  deleteDialog: boolean
  // The order number typed to confirm deleting it, and why the server refused
  deleteConfirmation: string
  deleteError: string
}

// A request that may fail without taking the page down with it
const optional = async <T,>(request: Promise<any>, pick: (response: any) => T, fallback: T): Promise<T> => {
  try { return pick(await request); } catch { return fallback; }
};

export class EditInvoice extends Component<Props, State> {
  state: State = {
    order: null,
    loadError: null,
    employees: [],
    userDebts: [],
    wallet: null,
    payments: [],
    items: [],
    purchaseItems: [],
    paymentList: [],
    changedFields: {},
    tab: 'details',
    isBusy: false,
    toast: { open: false, type: 'success', message: '' },
    copied: false,
    cancelDialog: false,
    cancelationReason: '',
    labelDialog: false,
    previewDialog: false,
    debtDialog: false,
    editItemsDialog: false,
    deleteDialog: false,
    deleteConfirmation: '',
    deleteError: '',
  };

  get orderId() { return String(this.props.router.params.id); }

  async componentDidMount() {
    let order: any;
    try {
      order = (await api.get(`order/${this.orderId}`)).data;
    } catch (error) {
      return this.setState({ loadError: apiErrorMessage(error, 'Could not load this order.') });
    }
    // The order is enough to work; the rest is loaded around it
    const [employees, userDebts, wallet, payments] = await Promise.all([
      optional(api.get('employees'), (res) => res.data?.results || [], []),
      optional(api.get(`debts/user/${order?.user?.customerId}`), (res) => res.data || [], []),
      optional(api.get(`wallet/${order?.user?._id}`), (res) => res.data?.results, null),
      optional(api.get(`order/${order?._id}/payments`), (res) => res.data?.results || [], []),
    ]);
    this.setState({ order, employees, userDebts, wallet, payments, items: order.items || [], purchaseItems: order.purchaseItems || [], paymentList: order.paymentList || [] });
  }

  toast = (type: 'success' | 'error', message: string) => this.setState({ toast: { open: true, type, message } });

  // Re-reads the order. `rows` also replaces the rows being edited (after a save or a file change).
  reloadOrder = async ({ rows = false } = {}) => {
    const order = (await api.get(`order/${this.orderId}`)).data;
    this.setState({
      order,
      ...(rows ? { items: order.items || [], purchaseItems: order.purchaseItems || [], paymentList: order.paymentList || [] } : {}),
    } as any);
    return order;
  };

  // Re-reads what a payment changes: the payments of the order and the customer's wallet
  reloadMoney = async () => {
    const { order } = this.state;
    // A payment on the order also pays down the debts opened on it, so those are re-read too
    const [wallet, payments, userDebts] = await Promise.all([
      optional(api.get(`wallet/${order?.user?._id}`), (res) => res.data?.results, this.state.wallet),
      optional(api.get(`order/${order?._id}/payments`), (res) => res.data?.results || [], this.state.payments),
      optional(api.get(`debts/user/${order?.user?.customerId}`), (res) => res.data || [], this.state.userDebts),
    ]);
    this.setState({ wallet, payments, userDebts });
  };

  // Runs a server action behind the busy overlay and reports its result
  run = async (action: () => Promise<string | void>, failure?: string) => {
    this.setState({ isBusy: true });
    try {
      const message = await action();
      if (message) this.toast('success', message);
    } catch (error) {
      this.toast('error', apiErrorMessage(error, failure));
    }
    this.setState({ isBusy: false });
  };

  change = (patch: Record<string, any>) => this.setState((state) => ({ changedFields: { ...state.changedFields, ...patch } }));
  changeNested = (key: string, patch: Record<string, any>) => this.setState((state) => ({ changedFields: { ...state.changedFields, [key]: { ...state.changedFields[key], ...patch } } }));

  // ---------- Rows ----------

  addItem = () => this.setState((state) => {
    const items = [...state.items, newItem()];
    return { items, changedFields: { ...state.changedFields, items } };
  });

  removeItem = (index: number) => this.setState((state) => {
    if (state.items.length <= 1) return null;
    const items = state.items.filter((_, position) => position !== index);
    return { items, changedFields: { ...state.changedFields, items } };
  });

  addPurchaseItem = () => this.setState((state) => {
    const purchaseItems = [...state.purchaseItems, newPurchaseItem()];
    return { purchaseItems, changedFields: { ...state.changedFields, purchaseItems } };
  });

  removePurchaseItem = (index: number) => this.setState((state) => {
    const purchaseItems = state.purchaseItems.filter((_, position) => position !== index);
    return { purchaseItems, changedFields: { ...state.changedFields, purchaseItems } };
  });

  addPackage = (defaults: { shipmentMethod?: string, measureUnit?: string } = {}) => this.setState((state) => {
    const paymentList = [...state.paymentList, newPackage(defaults)];
    return { paymentList, changedFields: { ...state.changedFields, paymentList } };
  });

  removePackage = (index: number) => this.setState((state) => {
    if (state.paymentList.length <= 1) return null;
    const paymentList = state.paymentList.filter((_, position) => position !== index);
    return { paymentList, changedFields: { ...state.changedFields, paymentList } };
  });

  // ---------- Form ----------

  // Every field of the form reports here. `child` is the chosen option of a select inside the
  // package dialog (it carries the row index); `customFieldName` is for pickers with no name.
  handleChange = (event: any, checked?: any, child?: any, customFieldName?: string) => {
    const name = customFieldName || event.target.name;
    const id = event.target.id;

    if (PACKAGE_ROW_FIELDS.includes(name)) {
      const paymentList = [...this.state.paymentList];
      const row = paymentList[id];
      if (!row) return;
      if (PACKAGE_CHECKPOINTS.includes(name)) row.status = { ...(row.status || {}), [name]: !row.status?.[name] };
      else if (name === 'paymentLink') row.link = event.target.value;
      else row[name] = event.target.value;
      this.setState({ paymentList });
      return this.change({ paymentList });
    }

    let value = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;
    if (checked === true || checked === false) value = checked;
    this.setField(name, value, id, child);
  };

  setField = (name: string, value: any, id: any, child?: any) => {
    if (['fullName', 'email', 'phone'].includes(name)) return this.changeNested('customerInfo', { [name]: value });
    if (SHIPMENT_FIELDS.includes(name)) return this.changeNested('shipment', { [name]: value });
    if (name === 'debt' || name === 'currency') return this.changeNested('debt', { [name === 'debt' ? 'total' : name]: value });
    if (name === 'credit' || name === 'creditCurrency') return this.changeNested('credit', { [name === 'credit' ? 'total' : name]: value });

    if (name === 'netIncome') {
      // The first income of an order is the income of its purchase invoice
      const netIncome = [...(this.state.order.netIncome || [])];
      netIncome[0] = { nameOfIncome: 'payment', total: value };
      return this.change({ netIncome });
    }

    if (PACKAGE_FIELDS.includes(name)) {
      const field = formatInvoiceFields(name);
      const paymentList = [...this.state.paymentList];
      const row = paymentList[child ? Number(child.props.id) : id];
      if (!row) return;
      const details = row.deliveredPackages = { ...(row.deliveredPackages || {}) };
      if (field === 'weight') details.weight = { ...(details.weight || {}), total: value };
      else if (field === 'measureUnit') details.weight = { ...(details.weight || {}), measureUnit: value };
      else if (field === 'visableForClient') row.settings = { ...(row.settings || {}), visableForClient: value };
      else details[field] = value;
      this.setState({ paymentList });
      return this.change({ paymentList });
    }

    if (ITEM_FIELDS.includes(name)) {
      const items = [...this.state.items];
      if (!items[id]) return;
      items[id] = { ...items[id], [formatInvoiceFields(name)]: value };
      this.setState({ items });
      return this.change({ items });
    }

    if (PURCHASE_FIELDS.includes(name)) {
      const purchaseItems = [...this.state.purchaseItems];
      if (!purchaseItems[id]) return;
      purchaseItems[id] = { ...purchaseItems[id], [formatPurchaseFields(name)]: value };
      this.setState({ purchaseItems });
      return this.change({ purchaseItems });
    }

    this.change({ [name]: value });
  };

  submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { order, changedFields, items } = this.state;
    const payload: any = { isPayment: order.isPayment, isShipment: order.isShipment, orderStatus: order.orderStatus, ...changedFields };
    const totalInvoice = totalOfItems(items);
    if (order.totalInvoice !== totalInvoice) payload.totalInvoice = totalInvoice;
    // The last step of the order's own path means it is finished
    payload.isFinished = getOrderSteps(payload).length - 1 === payload.orderStatus;
    // The trip attached to a package is display data; it must not be sent back
    if (payload.paymentList?.length) payload.paymentList = payload.paymentList.map(({ flight, ...row }: any) => row);

    this.run(async () => {
      await api.update(`order/${this.orderId}`, payload);
      await this.reloadOrder({ rows: true });
      this.setState({ changedFields: {} });
      return 'Invoice updated';
    }, 'The invoice could not be saved.');
  };

  // ---------- Files ----------

  uploadFiles = async (event: any, extra: Record<string, string>) => {
    const data = new FormData();
    Array.from(event.target.files as FileList).reverse().forEach((file) => data.append('files', file));
    data.append('id', this.orderId);
    Object.entries(extra).forEach(([key, value]) => data.append(key, value));
    // fetchFormData never throws: a failure comes back as the response itself
    const response: any = await api.fetchFormData(extra.paymentListId ? 'order/upload/fileLink' : 'order/uploadFiles', 'POST', data);
    if (response instanceof Error || response?.success === false) throw new Error(response?.message || 'The files could not be uploaded.');
  };

  uploadOrderImages = (event: any, type: 'invoice' | 'receipts') => this.run(async () => {
    await this.uploadFiles(event, { type });
    await this.reloadOrder();
    return 'Images uploaded';
  });

  deleteOrderImage = (file: any) => {
    const image = (this.state.order.images || []).find((img: any) => file._id === img._id);
    this.run(async () => {
      await api.delete('order/deleteFiles', { image, id: this.orderId });
      await this.reloadOrder();
      return 'Image deleted';
    });
  };

  // Files of one package; the form shows whatever this returns
  imagesOfPackage = (order: any, packageId: string) => (order.paymentList || []).find((row: any) => row?._id === packageId)?.images || [];

  uploadPackageFiles = async (event: any): Promise<any[]> => {
    const packageId = event.target.id;
    this.setState({ isBusy: true });
    try {
      await this.uploadFiles(event, { paymentListId: packageId });
      const order = await this.reloadOrder({ rows: true });
      this.toast('success', 'Files uploaded');
      return this.imagesOfPackage(order, packageId);
    } catch (error) {
      this.toast('error', apiErrorMessage(error));
      return this.imagesOfPackage(this.state.order, packageId);
    } finally {
      this.setState({ isBusy: false });
    }
  };

  deletePackageFile = async (file: any, packageId: string): Promise<any[]> => {
    this.setState({ isBusy: true });
    try {
      await api.delete('order/upload/fileLink', { filename: file.filename, id: this.orderId, paymentListId: packageId });
      const order = await this.reloadOrder({ rows: true });
      this.toast('success', 'File deleted');
      return this.imagesOfPackage(order, packageId);
    } catch (error) {
      this.toast('error', apiErrorMessage(error));
      return this.imagesOfPackage(this.state.order, packageId);
    } finally {
      this.setState({ isBusy: false });
    }
  };

  // ---------- Order actions ----------

  cancelOrder = () => {
    const { cancelationReason } = this.state;
    if (!cancelationReason.trim()) return this.toast('error', 'Write the reason for cancelling first');
    this.run(async () => {
      await api.post(`order/${this.orderId}/cancel`, { cancelationReason });
      await this.reloadOrder({ rows: true });
      this.setState({ changedFields: {}, cancelDialog: false, cancelationReason: '' });
      return 'Order cancelled';
    });
  };

  confirmInvoice = () => this.run(async () => {
    await api.post(`orders/${this.state.order._id}/confirmInvoice`, {});
    window.location.reload();
  });

  decideChanges = (status: 'accepted' | 'rejected') => this.run(async () => {
    await api.update(`orders/${this.state.order._id}/confirmItemsChanges`, { status, requestedEditDetails: this.state.order?.requestedEditDetails });
    window.location.reload();
  });

  deletePayment = (payment: any) => this.run(async () => {
    await api.delete(`wallet/${payment.customer?._id || this.state.order.user?._id}`, { payment });
    await this.reloadMoney();
    return payment.paymentType === 'wallet' ? 'Payment deleted and returned to the wallet' : 'Payment deleted';
  });

  // Only an order nothing hangs on can be deleted; the server says what is in the way
  deleteOrder = async () => {
    this.setState({ isBusy: true, deleteError: '' });
    try {
      await api.delete(`order/${this.orderId}`, {});
      window.location.href = '/invoices';
    } catch (error) {
      this.setState({ isBusy: false, deleteError: apiErrorMessage(error, 'The order could not be deleted.') });
    }
  };

  copyOrderNumber = () => {
    navigator.clipboard?.writeText(this.state.order.orderId);
    this.setState({ copied: true });
    window.setTimeout(() => this.setState({ copied: false }), 1800);
  };

  // ---------- Render ----------

  renderHeader() {
    const { order, userDebts, copied } = this.state;
    const { account } = this.props;
    const canCancel = !order.isCanceled && (CANCEL_ALLOWED_ACCOUNTS.includes(account?._id) || account?.roles.isAdmin);
    const { totalUsd, totalLyd } = totalDebts(userDebts);
    const step = getOrderSteps(order)[order.orderStatus || 0];

    return (
      <header className="op-header">
        <nav className="op-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a><span>/</span><a href="/invoices">Invoices</a><span>/</span><span>{order.orderId}</span>
        </nav>
        <div className="op-header__row">
          <div className="op-header__title">
            <h1>Order {order.orderId}</h1>
            <button type="button" className="op-copy" onClick={this.copyOrderNumber}>{copied ? 'Copied' : 'Copy'}</button>
            <div className="op-header__badges">
              {order.isPayment && <Badge text="Purchase invoice" color="primary" />}
              {order.isShipment && <Badge text="Shipment" color="sky" />}
              {step && <Badge text={step.label} color="success" />}
              {order.unsureOrder && <Badge text="Not active" color="warning" />}
              {order.hasProblem && <Badge text="Has a problem" color="danger" />}
              {order.isCanceled && <Badge text="Cancelled" color="danger" />}
            </div>
          </div>
          <div className="op-actions">
            <Button variant="outlined" size="small" onClick={() => this.setState({ previewDialog: true })}>Download invoice</Button>
            <Button variant="outlined" size="small" onClick={() => this.setState({ debtDialog: true })}>Add debt</Button>
            {canCancel && <Button variant="outlined" color="error" size="small" onClick={() => this.setState({ cancelDialog: true })}>Cancel order</Button>}
            {account?.roles.isAdmin && (
              <Button variant="outlined" color="error" size="small" onClick={() => this.setState({ deleteDialog: true, deleteConfirmation: '', deleteError: '' })}>Delete order</Button>
            )}
          </div>
        </div>
        <p className="op-header__sub">
          {order.customerInfo?.fullName}
          {order.user?._id && <>, <a href={`/user/${order.user._id}`} target="_blank" rel="noreferrer">{order.user.customerId}</a></>}
          {order.createdAt && <>, created {moment(order.createdAt).format('DD/MM/YYYY')}</>}
        </p>
        {(totalLyd > 0 || totalUsd > 0) && (
          <Alert severity="error" className="op-alert">This customer ({order.user?.customerId}) has open debts: {totalLyd} LYD and {totalUsd} USD.</Alert>
        )}
        {order.isCanceled && (
          <Alert severity="warning" className="op-alert">
            Cancelled on {moment(order.cancelation?.date).format('DD/MM/YYYY HH:mm')}. Reason: {order.cancelation?.reason || 'not given'}
          </Alert>
        )}
      </header>
    );
  }

  render() {
    return <OrderTheme>{this.renderPage()}</OrderTheme>;
  }

  deleteActivity = (activity: any) => this.run(async () => {
    await api.delete(`order/${this.orderId}/activity/${activity._id}`, {});
    await this.reloadOrder();
    return 'Activity deleted';
  });

  renderPage() {
    const { order, loadError, tab, isBusy, toast, changedFields, payments, wallet, walletPayment } = this.state;
    const { account, isEmployee } = this.props;

    if (loadError) return <div className="order-page"><Alert severity="error">{loadError}</Alert></div>;
    if (!order) {
      return (
        <div className="order-page" aria-busy="true">
          <Skeleton variant="text" width={280} height={44} />
          <Skeleton variant="rectangular" height={48} className="op-skeleton" />
          <div className="op-layout">
            <Skeleton variant="rectangular" height={520} className="op-skeleton" />
            <Skeleton variant="rectangular" height={520} className="op-skeleton" />
          </div>
        </div>
      );
    }

    const isAdmin = !!account?.roles.isAdmin;
    const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);
    // The form always reports the customer id when it opens; that alone is not a change
    const hasChanges = Object.keys(changedFields).some((key) => !(key === 'customerId' && changedFields[key] === order.user?.customerId));
    const locked = isBusy || !!order.isCanceled;

    return (
      <div className="order-page">
        {this.renderHeader()}

        <div className="op-tabs">
          <Tabs value={tab} onChange={(_, value) => this.setState({ tab: value })} variant="scrollable" scrollButtons="auto">
            <Tab value="details" label="Order details" />
            <Tab value="payments" label={`Payments (${payments.length})`} />
            {(isAdmin || account?.roles.isAccountant) && <Tab value="accounting" label="Accounting" />}
          </Tabs>
        </div>

        {/* The form stays mounted while another tab is open, so unsaved edits are not lost */}
        <div className="op-layout" hidden={tab !== 'details'}>
          <form className="op-main" onSubmit={this.submit}>
            <InvoiceForm
              handleChange={this.handleChange}
              invoice={order}
              employees={this.state.employees}
              isEmployee={isEmployee}
              totalInvoice={totalOfItems(this.state.items)}
              displayAlert={(alert) => this.toast(alert.type, alert.message)}
              items={this.state.items}
              onAddItem={this.addItem}
              onRemoveItem={this.removeItem}
              purchaseItems={this.state.purchaseItems}
              onAddPurchaseItem={this.addPurchaseItem}
              onRemovePurchaseItem={this.removePurchaseItem}
              paymentList={this.state.paymentList}
              onAddPackage={this.addPackage}
              onRemovePackage={this.removePackage}
              onUploadPackageFiles={this.uploadPackageFiles}
              onDeletePackageFile={this.deletePackageFile}
            />
            <div className="op-savebar">
              <span className={hasChanges ? 'op-savebar__dirty' : 'op-muted'}>{order.isCanceled ? 'A cancelled order cannot be changed.' : hasChanges ? 'You have unsaved changes.' : 'No changes to save.'}</span>
              <Button variant="contained" type="submit" disabled={locked}>Update invoice</Button>
            </div>
          </form>
          <OrderSidebar
            order={order}
            disabled={locked}
            toast={this.toast}
            onUploadImages={this.uploadOrderImages}
            onDeleteImage={this.deleteOrderImage}
            onOrderChanged={() => this.reloadOrder().catch(() => {})}
            canDeleteActivity={isAdmin}
            onDeleteActivity={this.deleteActivity}
            onOpenLabel={() => this.setState({ labelDialog: true })}
          />
        </div>

        {tab === 'payments' && (
          <OrderPayments
            order={order}
            isAdmin={isAdmin}
            payments={payments}
            wallet={{ walletUsd, walletLyd }}
            debts={Array.isArray(this.state.userDebts) ? this.state.userDebts : []}
            onPay={(category, packages, dueUsd) => this.setState({ walletPayment: { category, packages, dueUsd } })}
            onAddDebt={() => this.setState({ debtDialog: true })}
            onDeletePayment={this.deletePayment}
            onPreviewImages={(previewImages) => this.setState({ previewImages })}
            onConfirmInvoice={this.confirmInvoice}
            onRequestEdit={() => this.setState({ editItemsDialog: true })}
            onDecideChanges={this.decideChanges}
          />
        )}

        {tab === 'accounting' && <OrderAccounting orderId={order._id} orderNumber={order.orderId} isPayment={!!order.isPayment} />}

        <Backdrop sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1000 }} open={isBusy}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => this.setState({ toast: { ...toast, open: false } })}>
          <Alert severity={toast.type} sx={{ width: '100%' }} onClose={() => this.setState({ toast: { ...toast, open: false } })}>{toast.message}</Alert>
        </Snackbar>

        <Dialog open={this.state.cancelDialog} onClose={() => this.setState({ cancelDialog: false })} fullWidth maxWidth="sm">
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogContent>
            <TextField
              className="mt-2" label="يرجى كتابة سبب الالغاء بالتفصيل" dir="rtl" multiline minRows={6} fullWidth autoFocus
              value={this.state.cancelationReason} onChange={(event) => this.setState({ cancelationReason: event.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ cancelDialog: false })}>الرجوع</Button>
            <Button onClick={this.cancelOrder} color="error" variant="contained" disabled={!this.state.cancelationReason.trim()}>الغاء الفاتورة</Button>
          </DialogActions>
        </Dialog>

        <OrderWalletDialog
          open={!!walletPayment}
          category={walletPayment?.category || 'invoice'}
          packages={walletPayment?.packages || []}
          dueUsd={walletPayment?.dueUsd || 0}
          order={order}
          wallet={{ walletUsd, walletLyd }}
          onClose={() => this.setState({ walletPayment: undefined })}
          onDone={(message) => {
            this.setState({ walletPayment: undefined });
            this.toast('success', message);
            this.reloadMoney();
          }}
        />

        <Dialog open={this.state.deleteDialog} onClose={() => this.setState({ deleteDialog: false })} fullWidth maxWidth="sm">
          <DialogTitle>Delete order {order.orderId} for good?</DialogTitle>
          <DialogContent>
            {this.state.deleteError && <Alert severity="error" className="op-alert--tight" dir="auto">{this.state.deleteError}</Alert>}
            <ul className="op-delete-list">
              <li>The order, its packages, items and timeline are removed and cannot be brought back.</li>
              <li>In accounting, what the order billed the customer is taken back, as for a cancellation.</li>
              <li>It is refused while the order has payments, debts, supplier bills, or packages on a trip or in a warehouse. Cancel the order instead if you need to keep its history.</li>
            </ul>
            <TextField
              label={`Type ${order.orderId} to confirm`} fullWidth autoFocus value={this.state.deleteConfirmation}
              onChange={(event) => this.setState({ deleteConfirmation: event.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialog: false })}>Back</Button>
            <Button color="error" variant="contained" onClick={this.deleteOrder} disabled={isBusy || this.state.deleteConfirmation.trim() !== String(order.orderId)}>Delete order</Button>
          </DialogActions>
        </Dialog>

        <ShippingLabelDialog open={this.state.labelDialog} order={order} onClose={() => this.setState({ labelDialog: false })} onError={(message) => this.toast('error', message)} />

        <Dialog fullScreen open={this.state.previewDialog} onClose={() => this.setState({ previewDialog: false })}>
          <DialogContent>
            <InvoiceTemplate invoice={{ ...order, items: this.state.items }} changedFields={changedFields} onClose={() => this.setState({ previewDialog: false })} />
          </DialogContent>
        </Dialog>

        <Dialog open={this.state.debtDialog} onClose={() => this.setState({ debtDialog: false })}>
          <CreateDebtDialog setDialog={() => this.setState({ debtDialog: false })} orderId={order.orderId} customerId={order.user?.customerId} />
        </Dialog>

        <Dialog open={this.state.editItemsDialog} onClose={() => this.setState({ editItemsDialog: false })}>
          <EditInvoiceItems items={this.state.items} orderId={order._id} />
        </Dialog>

        <Dialog open={!!this.state.previewImages} onClose={() => this.setState({ previewImages: undefined })}>
          <DialogContent>
            <SwipeableTextMobileStepper data={this.state.previewImages} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ previewImages: undefined })}>Close</Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}

const mapStateToProps = (state: any) => ({
  isEmployee: state.session.account?.roles.isEmployee,
  account: state.session.account,
});

export default connect(mapStateToProps)(withRouter(EditInvoice));
