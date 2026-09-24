// src/pages/UserInvoices.tsx

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Ban, Download, FileText } from 'lucide-react';
import moment from 'moment';
import api from '../../api'; // adjust to your actual path
import { useReactToPrint } from 'react-to-print';
import InvoicePDFPreview from './InvoicePDFPreview';
// @ts-ignore
import './CashflowUser.scss';
// @ts-ignore
import './UserInvoices.scss';
import { User } from '../../models';
import { formatMoney } from './statementUtils';

type Invoice = {
  _id: string;
  total: number;
  currency: 'USD' | 'EURO' | 'LYD';
  category: 'invoice' | 'shipment';
  rate: number;
  note?: string;
  createdAt: string;
  list: any[];
  referenceId: number
  amountUSD?: number;
  amountLYD?: number;
  customer: User
  isCanceled?: boolean;
  canceledAt?: string;
  canceledBy?: { firstName?: string, lastName?: string };
  cancellation?: { refundedUSD?: number, refundedLYD?: number };
};

type Props = {
  customerId: string
  onInvoiceCanceled?: () => void
}

const UserInvoices = ({ customerId, onInvoiceCanceled }: Props) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelResult, setCancelResult] = useState<any>(null);
  const canCancel = useSelector((state: any) => {
    const roles = state.session.account?.roles;
    return !!(roles?.isAdmin || roles?.isAccountant);
  });
  const componentRef = useRef<HTMLDivElement>(null);

  const openCancel = (invoice: Invoice) => {
    setInvoiceToCancel(invoice);
    setCancelError('');
    setCancelResult(null);
  };

  const closeCancel = () => {
    if (isCanceling) return;
    setInvoiceToCancel(null);
    setCancelResult(null);
  };

  const cancelInvoice = async () => {
    if (!invoiceToCancel) return;
    try {
      setIsCanceling(true);
      setCancelError('');
      const response = await api.post(`invoices/${invoiceToCancel._id}/cancel`, {});
      setCancelResult(response.data.results);
      fetchInvoices();
      onInvoiceCanceled?.();
    } catch (error: any) {
      console.error('Error cancelling invoice:', error);
      setCancelError(error?.response?.data?.message || 'Could not cancel this invoice. Please try again.');
    }
    setIsCanceling(false);
  };

  useEffect(() => {
    fetchInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await api.get(`invoices/customer/${customerId}`);
      setInvoices(response.data.results);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: selectedInvoice
      ? `Invoice-0${selectedInvoice.referenceId}-${selectedInvoice.customer?.customerId || ''}`
      : 'Invoice',
    pageStyle: '@page { size: A4 portrait; margin: 0; } html, body { margin: 0; }',
  });

  // Print after React has rendered the selected invoice into the hidden container
  useEffect(() => {
    if (!printRequested || !selectedInvoice) return;
    handlePrint?.();
    setPrintRequested(false);
  }, [printRequested, selectedInvoice, handlePrint]);

  const handleDownload = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPrintRequested(true);
  };

  return (
    <section className="invoices">
      <header className="invoices__header">
        <div>
          <h5 className="invoices__title">Freight invoices</h5>
          <p className="invoices__subtitle">
            {loading ? 'Loading invoices…' : `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}, newest first`}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="invoices__grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="invoice-card invoice-card--skeleton">
              <span className="skeleton" style={{ width: '45%', height: 18 }} />
              <span className="skeleton" style={{ width: '70%', height: 12 }} />
              <span className="skeleton" style={{ width: '100%', height: 56 }} />
              <span className="skeleton" style={{ width: '100%', height: 64 }} />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="cashflow__empty">
          <FileText size={28} strokeWidth={1.5} />
          <p className="m-0 fw-semibold">No invoices yet</p>
          <p className="m-0">An invoice is created when this customer's packages are delivered from the wallet.</p>
        </div>
      ) : (
        <div className="invoices__grid">
          {invoices.map((invoice, index) => {
            const hasLYD = (invoice.amountLYD || 0) > 0;
            return (
              <article
                key={invoice._id}
                className={`invoice-card ${invoice.isCanceled ? 'is-canceled' : ''}`}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="invoice-card__top">
                  <div>
                    <h6 className="invoice-card__number">
                      Invoice <span>#0{invoice.referenceId}</span>
                    </h6>
                    <p className="invoice-card__meta">
                      {moment(invoice.createdAt).format('DD MMM YYYY, HH:mm')}
                    </p>
                  </div>
                  {invoice.isCanceled && <span className="invoice-canceled-tag">Cancelled</span>}
                </div>

                <div className="invoice-card__figures">
                  <div className="invoice-card__total">
                    <span className="invoice-card__label">Total</span>
                    <span className="invoice-card__total-value">{formatMoney(invoice.total, invoice.currency)}</span>
                  </div>
                  <div>
                    <span className="invoice-card__label">Paid from wallet</span>
                    <span className="invoice-card__value">{formatMoney(invoice.amountUSD || 0, 'USD')}</span>
                    {hasLYD && <span className="invoice-card__value">{formatMoney(invoice.amountLYD || 0, 'LYD')}</span>}
                    {hasLYD && <span className="invoice-card__hint">Rate {invoice.rate}</span>}
                  </div>
                </div>

                {invoice.isCanceled &&
                  <p className="invoice-canceled-note">
                    Cancelled{invoice.canceledAt ? ` on ${moment(invoice.canceledAt).format('DD/MM/YYYY HH:mm')}` : ''}
                    {invoice.canceledBy?.firstName ? ` by ${invoice.canceledBy.firstName} ${invoice.canceledBy.lastName || ''}` : ''}.
                    {' '}Refunded {formatMoney(invoice.cancellation?.refundedUSD || 0, 'USD')} and {formatMoney(invoice.cancellation?.refundedLYD || 0, 'LYD')} to the wallet.
                  </p>
                }

                <div className="invoice-card__packages">
                  <p className="invoice-card__label">{invoice.list.length} {invoice.list.length === 1 ? 'package' : 'packages'}</p>
                  <ul>
                    {invoice.list.map((pkg: any, pkgIndex: number) => (
                      <li key={pkg.packageId || pkgIndex}>
                        <span className="invoice-card__tracking">{pkg.trackingNumber || 'N/A'}</span>
                        <span className="invoice-card__pkg-meta">
                          {pkg?.weight?.total ?? 0} {pkg?.weight?.measureUnit || ''}
                          {pkg.boxesCount && pkg.boxesCount !== '-' ? `, ${pkg.boxesCount} boxes` : ''}
                        </span>
                        <span className="invoice-card__pkg-cost">{formatMoney(pkg.cost || 0, invoice.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {invoice.note && <p className="invoice-card__note">{invoice.note}</p>}

                <div className="invoice-card__actions">
                  <button type="button" className="invoice-btn" onClick={() => handleDownload(invoice)}>
                    <Download size={15} strokeWidth={2} />
                    Download PDF
                  </button>
                  {canCancel && !invoice.isCanceled &&
                    <button type="button" className="invoice-btn invoice-btn--danger" onClick={() => openCancel(invoice)}>
                      <Ban size={15} strokeWidth={2} />
                      Cancel invoice
                    </button>
                  }
                </div>
              </article>
            );
          })}
        </div>
      )}

        <Dialog open={!!invoiceToCancel} onClose={closeCancel} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
            {cancelResult ? 'Invoice cancelled' : `Cancel invoice #0${invoiceToCancel?.referenceId}?`}
          </DialogTitle>
          <DialogContent>
            {!cancelResult ? (
              <>
                <dl className="cashflow-confirm">
                  <dt>Customer paid</dt>
                  <dd>{formatMoney(invoiceToCancel?.amountUSD || 0, 'USD')}, {formatMoney(invoiceToCancel?.amountLYD || 0, 'LYD')}</dd>
                  <dt>Packages</dt>
                  <dd>{invoiceToCancel?.list?.length || 0}</dd>
                </dl>
                <p className="cashflow-confirm__hint">For each tracking number:</p>
                <ul className="cashflow-confirm__hint invoice-cancel-steps">
                  <li>The wallet payment is cancelled and the amount goes back to the customer's wallet.</li>
                  <li>The package goes back to Libya on, Received off.</li>
                  <li>The order goes back to وصلت البضائع, ready for pickup again.</li>
                </ul>
                <div className="invoice-cancel-tracking">
                  {invoiceToCancel?.list?.map((pkg: any) => (
                    <span key={pkg.packageId || pkg.trackingNumber} className="cashflow-chip cashflow-chip--muted">{pkg.trackingNumber || 'N/A'}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <dl className="cashflow-confirm">
                  <dt>Refunded USD</dt>
                  <dd className="is-in">{formatMoney(cancelResult.refundedUSD || 0, 'USD')}</dd>
                  <dt>Refunded LYD</dt>
                  <dd className="is-in">{formatMoney(cancelResult.refundedLYD || 0, 'LYD')}</dd>
                </dl>
                {cancelResult.packages?.some((pkg: any) => !pkg.refunds?.length || !pkg.statusUpdated) &&
                  <p className="cashflow-confirm__error">
                    Check these tracking numbers by hand:{' '}
                    {cancelResult.packages
                      .filter((pkg: any) => !pkg.refunds?.length || !pkg.statusUpdated)
                      .map((pkg: any) => `${pkg.trackingNumber || 'N/A'} (${!pkg.refunds?.length ? 'no wallet payment found' : 'package not found in order'})`)
                      .join(', ')}
                  </p>
                }
              </>
            )}
            {cancelError && <p className="cashflow-confirm__error" role="alert">{cancelError}</p>}
          </DialogContent>
          <DialogActions>
            {cancelResult ? (
              <Button onClick={closeCancel}>Done</Button>
            ) : (
              <>
                <Button disabled={isCanceling} onClick={closeCancel}>Keep invoice</Button>
                <Button disabled={isCanceling} color="error" variant="contained" disableElevation onClick={cancelInvoice}>
                  {isCanceling ? 'Cancelling…' : 'Cancel invoice'}
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>

      {/* Hidden render for PDF preview */}
      <div style={{ display: 'none' }}>
        {selectedInvoice && (
          <div ref={componentRef}>
            <InvoicePDFPreview invoice={selectedInvoice} />
          </div>
        )}
      </div>
    </section>
  );
};

export default UserInvoices;
