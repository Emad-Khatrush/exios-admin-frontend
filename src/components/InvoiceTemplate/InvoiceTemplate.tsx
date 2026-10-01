import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode.react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { MdClose, MdOutlineFileDownload, MdOutlinePrint } from 'react-icons/md';
import moment from 'moment';
import { Invoice, OrderItem } from '../../models';
import './InvoiceTemplate.scss';

export const officeDetails: any = {
  tripoli: {
    phone: '0915643265',
    address: 'فرع طرابلس، باب بن غشير'
  },
  benghazi: {
    phone: '0919734019',
    address: 'فرع بنغازي، سيدي حسين'
  }
}

type Props = {
  invoice: Invoice
  // What was changed in the form and not saved yet; the invoice shows it as it will be
  changedFields: any
  onClose?: () => void
}

const A4 = { width: 210, height: 297 };
const METHODS: Record<string, string> = { air: 'Air', sea: 'Sea', unknown: 'Not set' };
const money = (value: number) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The customer's invoice: a preview on screen, downloaded or printed as an A4 PDF
export const InvoiceTemplate = ({ invoice, changedFields, onClose }: Props) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const [error, setError] = useState('');

  const order: any = {
    ...invoice,
    ...changedFields,
    customerInfo: { ...invoice.customerInfo, ...changedFields?.customerInfo },
    shipment: { ...invoice.shipment, ...changedFields?.shipment },
    items: changedFields?.items || invoice?.items || [],
  };
  const items: OrderItem[] = order.items;
  const total = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const office: any = officeDetails[order?.placedAt] || officeDetails.tripoli;
  const customerId = order.customerId || (invoice as any)?.user?.customerId;

  // The page is drawn once at double size (sharp text) and cut into A4 pages if it is long
  const buildPdf = async () => {
    const canvas = await html2canvas(pageRef.current as HTMLElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imageHeight = (canvas.height * A4.width) / canvas.width;
    const image = canvas.toDataURL('image/png');
    let offset = 0;
    pdf.addImage(image, 'PNG', 0, offset, A4.width, imageHeight);
    while (imageHeight + offset > A4.height + 1) {
      offset -= A4.height;
      pdf.addPage();
      pdf.addImage(image, 'PNG', 0, offset, A4.width, imageHeight);
    }
    return pdf;
  };

  const run = async (kind: 'download' | 'print') => {
    try {
      setBusy(kind);
      setError('');
      const pdf = await buildPdf();
      if (kind === 'download') {
        pdf.save(`invoice-${order.orderId || 'exios'}.pdf`);
      } else {
        pdf.autoPrint();
        window.open(pdf.output('bloburl') as any, '_blank');
      }
    } catch (failure) {
      setError('The invoice file could not be created. Try again.');
    }
    setBusy(null);
  };

  return (
    <div className="inv-view">
      <div className="inv-toolbar">
        <div>
          <h2>Invoice {order.orderId}</h2>
          <p>This is what the customer receives. Unsaved changes in the form are included.</p>
        </div>
        <div className="inv-toolbar__actions">
          <Button variant="contained" startIcon={busy === 'download' ? <CircularProgress size={16} color="inherit" /> : <MdOutlineFileDownload />} disabled={!!busy} onClick={() => run('download')}>Download PDF</Button>
          <Button variant="outlined" startIcon={busy === 'print' ? <CircularProgress size={16} color="inherit" /> : <MdOutlinePrint />} disabled={!!busy} onClick={() => run('print')}>Print</Button>
          {onClose && <Button startIcon={<MdClose />} onClick={onClose}>Close</Button>}
        </div>
      </div>
      {error && <Alert severity="error" className="inv-alert">{error}</Alert>}

      <div className="inv-stage">
        <div className="inv-doc" ref={pageRef}>
          <header className="inv-doc__head">
            <img src="/images/exios-logo-without-background.png" alt="Exios" />
            <div className="inv-doc__title">
              <h1>INVOICE</h1>
              <dl>
                <div><dt>Invoice no.</dt><dd>{order.orderId}</dd></div>
                <div><dt>Date</dt><dd>{moment(order.createdAt).format('DD/MM/YYYY')}</dd></div>
              </dl>
            </div>
          </header>

          <section className="inv-doc__parties">
            <div>
              <h2>Bill to</h2>
              <p className="inv-doc__name" dir="auto">{order.customerInfo?.fullName}</p>
              <p>Customer ID: {customerId}</p>
              {order.customerInfo?.phone && <p>Phone: {order.customerInfo.phone}</p>}
            </div>
            <div>
              <h2>Shipment</h2>
              <p>Method: {METHODS[order.shipment?.method] || order.shipment?.method || 'Not set'}</p>
              <p dir="auto">From: {order.shipment?.fromWhere}</p>
              <p dir="auto">To: {order.shipment?.toWhere}</p>
            </div>
            <div className="inv-doc__qr">
              <QRCode size={86} value={`https://www.exioslibya.com/order/${order?._id}`} />
              <span>Track this order</span>
            </div>
          </section>

          <table className="inv-doc__items">
            <thead>
              <tr>
                <th className="inv-num">#</th>
                <th>Description</th>
                <th className="inv-num">Qty</th>
                <th className="inv-amount">Unit price</th>
                <th className="inv-amount">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="inv-num">{index + 1}</td>
                  <td dir="auto">{item.description}</td>
                  <td className="inv-num">{item.quantity}</td>
                  <td className="inv-amount">{money(item.unitPrice)}</td>
                  <td className="inv-amount">{money(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="inv-empty">No items on this invoice.</td></tr>}
            </tbody>
          </table>

          <div className="inv-doc__totals">
            <div className="inv-doc__total"><span>Total invoice</span><strong>{money(total)}</strong></div>
            <div className="inv-doc__received"><span>Received amount</span><i /></div>
          </div>

          <div className="inv-doc__signatures" dir="rtl">
            <div><span>توقيع العميل</span><i /></div>
            <div><span>ختم الشركة</span><i /></div>
          </div>

          <div className="inv-doc__notes" dir="rtl">
            <h2>ملاحظة</h2>
            <ol>
              <li>توقيعك على هذه الفاتورة يقر ان العميل قد وافق على شروط وسياسات الشركة.</li>
              <li>عملية تتبع البضائع بعد الشراء هي مسؤولية العميل، والشركة غير مسؤولة عن ذلك بعد إتمام عملية الشراء.</li>
            </ol>
          </div>

          <footer className="inv-doc__foot">
            <span>Exios Company</span>
            <span dir="rtl">{office.address}</span>
            <span>{office.phone}</span>
            <span>www.exioslibya.com</span>
          </footer>
        </div>
      </div>
    </div>
  );
};
