import React, { Component } from 'react';
import { connect } from 'react-redux';
import { NavigateFunction } from 'react-router-dom';
import { Alert, Backdrop, Button, CircularProgress, Snackbar } from '@mui/material';

import api from '../../api';
import { createInvoice, resetInvoice } from '../../actions/invoices';
import { IInvoice } from '../../reducers/invoices';
import { User } from '../../models';
import withRouter from '../../utils/WithRouter/WithRouter';
import { formatInvoiceFields } from '../XTrackingPage/utils';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import InvoiceForm from '../../components/InvoiceForm/InvoiceForm';
import OrderTheme from '../EditInvoice/OrderTheme';
import { totalOfItems } from '../EditInvoice/orderConstants';

import '../EditInvoice/orderPage.scss';

type FileGroup = 'invoice' | 'receipts';

type Props = {
  createInvoice: (data: FormData) => void
  resetInvoice: () => void
  invoice: IInvoice
  isEmployee: boolean
  router: { navigate: NavigateFunction }
}

type State = {
  employees: User[]
  // What the form's plain fields hold; rows and files are kept apart
  formData: Record<string, any>
  items: any[]
  paymentList: any[]
  files: Record<FileGroup, File[]>
  previews: Record<FileGroup, any[]>
  toast: { open: boolean, type: 'success' | 'error', message: string }
}

const rowIndex = () => Math.floor(Math.random() * 100000);

const blankItem = () => ({ index: rowIndex(), description: '', quantity: 1, unitPrice: 0 });

// A package as the create endpoint expects it (flat checkpoints, weight and unit side by side)
const blankPackage = () => ({
  index: rowIndex(),
  paymentLink: '',
  paid: false,
  arrived: false,
  arrivedLibya: false,
  received: false,
  note: '',
  deliveredPackages: {
    trackingNumber: '',
    weight: null,
    arrivedAt: new Date(),
    measureUnit: '',
    exiosPrice: null,
    boxesCount: null,
  },
});

const PACKAGE_ROW_TEXT = ['paymentLink', 'note'];
const PACKAGE_CHECKPOINTS = ['paid', 'arrived', 'arrivedLibya', 'received'];
const PACKAGE_FIELDS = ['trackingNumber', 'packageWeight', 'locationPlace', 'measureUnit', 'exiosPrice', 'arrivedAt', 'shipmentMethod', 'boxesCount', 'volumetric', 'actualWeight', 'domesticFee', 'customsFee'];
const ITEM_FIELDS = ['description', 'itemQuantity', 'unitPrice'];

const readAsDataUrl = (file: File) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

class AddInvoice extends Component<Props, State> {
  state: State = {
    employees: [],
    formData: { isPayment: false, isShipment: true },
    items: [blankItem()],
    paymentList: [blankPackage()],
    files: { invoice: [], receipts: [] },
    previews: { invoice: [], receipts: [] },
    toast: { open: false, type: 'success', message: '' },
  };

  private invoiceFileRef = React.createRef<HTMLInputElement>();
  private receiptsFileRef = React.createRef<HTMLInputElement>();
  private redirectTimer?: number;

  componentDidMount() {
    this.props.resetInvoice();
    api.get('employees')
      .then((res) => this.setState({ employees: res.data.results || [] }))
      .catch(() => this.toast('error', 'The employees list could not be loaded.'));
  }

  componentDidUpdate(previous: Props) {
    const { listStatus, order } = this.props.invoice as any;
    const before = previous.invoice.listStatus;
    // Once, when the create request finishes
    if (listStatus.isSuccess && !before.isSuccess) {
      this.toast('success', listStatus.message || 'Invoice created');
      this.redirectTimer = window.setTimeout(() => this.props.router.navigate(`/invoice/${order?._id}/edit`), 1000);
    }
    if (listStatus.isError && !before.isError) this.toast('error', listStatus.message || 'The invoice could not be created. Check the required fields and try again.');
  }

  componentWillUnmount() {
    window.clearTimeout(this.redirectTimer);
  }

  toast = (type: 'success' | 'error', message: string) => this.setState({ toast: { open: true, type, message } });

  // ---------- Files ----------

  addFiles = async (event: any) => {
    const group: FileGroup = event.target.id === 'invoice' ? 'invoice' : 'receipts';
    const added: File[] = Array.from(event.target.files as FileList).reverse();
    added.forEach((file: any) => { file.category = group; });
    const files = [...this.state.files[group], ...added];
    const previews = await Promise.all(files.map(readAsDataUrl));
    this.setState((state) => ({ files: { ...state.files, [group]: files }, previews: { ...state.previews, [group]: previews } }));
  };

  // The uploader hands back the preview it was given
  removeFile = (preview: any) => this.setState((state) => {
    const group: FileGroup = state.previews.invoice.includes(preview) ? 'invoice' : 'receipts';
    const index = state.previews[group].indexOf(preview);
    if (index === -1) return null;
    const without = (list: any[]) => list.filter((_, position) => position !== index);
    return { files: { ...state.files, [group]: without(state.files[group]) }, previews: { ...state.previews, [group]: without(state.previews[group]) } };
  });

  // ---------- Form ----------

  // Every field of the form reports here. `child` is the chosen option of a select inside the
  // package dialog (it carries the row index); `customFieldName` is for pickers with no name.
  handleChange = (event: any, checked?: any, child?: any, customFieldName?: string) => {
    const name = customFieldName || event.target.name;
    const id = event.target.id;

    // Rows are updated from the latest state: one action can report several fields in a row
    const typedValue = event.target.value;
    const updateRow = (key: 'paymentList' | 'items', index: any, change: (row: any) => any) => this.setState((state) => {
      if (!state[key][index]) return null;
      const rows = [...state[key]];
      rows[index] = change(rows[index]);
      return { [key]: rows } as any;
    });

    if (PACKAGE_CHECKPOINTS.includes(name)) return updateRow('paymentList', id, (row) => ({ ...row, [name]: !row[name] }));
    if (PACKAGE_ROW_TEXT.includes(name)) return updateRow('paymentList', id, (row) => ({ ...row, [name]: typedValue }));

    if (PACKAGE_FIELDS.includes(name)) {
      const field = formatInvoiceFields(name);
      return updateRow('paymentList', child ? Number(child.props.id) : id, (row) => ({ ...row, deliveredPackages: { ...row.deliveredPackages, [field]: typedValue } }));
    }

    if (ITEM_FIELDS.includes(name)) return updateRow('items', id, (row) => ({ ...row, [formatInvoiceFields(name)]: typedValue }));

    // A package's visibility is a setting of the saved order; a new order starts with the default
    if (name === 'visableForClient') return;

    const typed = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;
    const value = checked === true || checked === false ? checked : typed;
    this.setState((state) => ({ formData: { ...state.formData, [name]: value } }));
  };

  addItem = () => this.setState((state) => ({ items: [...state.items, blankItem()] }));
  removeItem = (index: number) => this.setState((state) => (state.items.length > 1 ? { items: state.items.filter((_, position) => position !== index) } : null));
  addPackage = (defaults: { shipmentMethod?: string, measureUnit?: string } = {}) => this.setState((state) => {
    const row = blankPackage();
    return { paymentList: [...state.paymentList, { ...row, deliveredPackages: { ...row.deliveredPackages, ...defaults } }] };
  });
  removePackage = (index: number) => this.setState((state) => (state.paymentList.length > 1 ? { paymentList: state.paymentList.filter((_, position) => position !== index) } : null));

  submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { formData, files, items, paymentList } = this.state;
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => { if (value !== undefined && value !== null) data.append(key, value as any); });
    // Invoice images first: the server tells the two groups apart by their count
    [...files.invoice, ...files.receipts].forEach((file) => data.append('files', file));
    data.append('paymentList', JSON.stringify(paymentList));
    // A shipment has no items to bill: only a purchase sends its list
    data.append('items', JSON.stringify(formData.isPayment ? items : []));
    data.append('invoicesCount', String(files.invoice.length));
    this.props.createInvoice(data);
  };

  render() {
    const { employees, files, previews, toast, items } = this.state;
    const { invoice, isEmployee } = this.props;
    const { isLoading, isSuccess } = invoice.listStatus;

    return (
      <OrderTheme>
        <div className="order-page">
          <header className="op-header">
            <nav className="op-crumbs" aria-label="Breadcrumb">
              <a href="/">Home</a><span>/</span><a href="/invoices">Invoices</a><span>/</span><span>New</span>
            </nav>
            <div className="op-header__title"><h1>New invoice</h1></div>
            <p className="op-header__sub">Fill in the customer and the order. Packages, prices and payments can be completed after it is created.</p>
          </header>

          <form className="op-layout" onSubmit={this.submit}>
            <div className="op-main">
              <InvoiceForm
                handleChange={this.handleChange}
                employees={employees}
                isEmployee={isEmployee}
                totalInvoice={totalOfItems(items)}
                displayAlert={(alert) => this.toast(alert.type, alert.message)}
                items={items}
                onAddItem={this.addItem}
                onRemoveItem={this.removeItem}
                paymentList={this.state.paymentList}
                onAddPackage={this.addPackage}
                onRemovePackage={this.removePackage}
              />
              <div className="op-savebar">
                <span className="op-muted">{isSuccess ? 'Created. Opening the order.' : 'Fields marked with * are required.'}</span>
                <Button variant="contained" type="submit" disabled={isLoading || isSuccess}>Create invoice</Button>
              </div>
            </div>

            <aside className="op-sidebar">
              <section className="op-panel">
                <h3 className="op-panel__title">Admin images</h3>
                <ImageUploader id="invoice" inputFileRef={this.invoiceFileRef} fileUploaderHandler={this.addFiles} previewFiles={previews.invoice} deleteImage={this.removeFile} files={files.invoice} />
              </section>
              <section className="op-panel">
                <h3 className="op-panel__title">Client images</h3>
                <ImageUploader id="receipts" inputFileRef={this.receiptsFileRef} fileUploaderHandler={this.addFiles} previewFiles={previews.receipts} deleteImage={this.removeFile} files={files.receipts} />
              </section>
            </aside>
          </form>

          <Backdrop sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }} open={isLoading}>
            <CircularProgress color="inherit" />
          </Backdrop>

          <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => this.setState({ toast: { ...toast, open: false } })}>
            <Alert severity={toast.type} sx={{ width: '100%' }} onClose={() => this.setState({ toast: { ...toast, open: false } })}>{toast.message}</Alert>
          </Snackbar>
        </div>
      </OrderTheme>
    );
  }
}

const mapStateToProps = (state: any) => ({
  invoice: state.invoice,
  isEmployee: state.session.account?.roles.isEmployee,
});

export default connect(mapStateToProps, { createInvoice, resetInvoice })(withRouter(AddInvoice));
