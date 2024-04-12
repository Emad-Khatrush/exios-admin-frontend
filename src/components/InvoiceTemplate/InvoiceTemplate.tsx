import React, { useRef } from 'react';
import './InvoiceTemplate.scss';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode.react';
import { Button } from '@mui/material';
import { Invoice, OrderItem } from '../../models';
import moment from 'moment';

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
  changedFields: any
}

export const InvoiceTemplate = (props: Props) => {
  const { invoice, changedFields } = props;
  const codeRef = useRef(null);

  const updatedInvoice = {
    ...invoice,
    ...changedFields,
    customerInfo: {
      ...invoice.customerInfo,
      ...changedFields?.customerInfo
    },
    shipment: {
      ...invoice.shipment,
      ...changedFields?.shipment
    },
    items: [
      ...invoice?.items,
    ]
  }

  const totalItems = calculateTotalItems(updatedInvoice.items);

  const handleDownload = () => {
    const codeElement: any = codeRef.current;

    html2canvas(codeElement, { scale: 3 })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save('code.pdf');
      })
      .catch((error) => {
        console.error('Error generating PDF:', error);
      });
  };

  const office: any = officeDetails[updatedInvoice?.placedAt || 'tripoli'];

  return (
    <div>
      <Button 
        onClick={handleDownload}
        color='success'
        variant="contained"
      >
        Download Invoice
      </Button>
      <div className="invoice" ref={codeRef}>
        <div className="header mb-4">
          <img width={'25%'} src="/images/exios-logo-without-background.png" alt="Company Logo" />
          <div>
            <QRCode value={`https://www.exioslibya.com/order/${updatedInvoice?._id}`} />
          </div>
          <div className="company-details mr-3">
            <h1 className="company-name">Invoice</h1>
            <p className='m-0'>Exios Company</p>
            <p className='m-0'>Phone: {office.phone}</p>
            <p className='m-0'>{office.address}</p>
            <p className='m-0'>www.exioslibya.com</p>
          </div>
        </div>
        <div className='d-flex justify-content-between mb-5'>
          <div className="bill-to">
            <h2>Bill To:</h2>
            <p className='my-1'>Customer Name: {updatedInvoice?.customerInfo?.fullName}</p>
            <p className='my-1'>Customer ID: {updatedInvoice?.customerId}</p>
            <p className='my-1'>Order ID: {updatedInvoice?.orderId}</p>
          </div>

          <div className="bill-to">
            <h2>Invoice Details:</h2>
            <p className='my-1'>Created Date: {moment(updatedInvoice?.createdAt).format('DD/MM/YYYY')}</p>
            <p className='my-1'>Shipping Method: {updatedInvoice?.shipment?.method}</p>
            <p className='my-1'>Recevied Amount: .....................</p>
          </div>
        </div>
        <div className="items">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th style={{ width: '20px' }}>Quantity</th>
                <th style={{ width: '120px' }}>Unit Price</th>
                <th style={{ width: '120px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(updatedInvoice.items || []).map((item: OrderItem, i: number) => (
                <tr>
                  <td>{i + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>${item.unitPrice}</td>
                  <td>${item.unitPrice * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="total mb-5">
          <p>Total Invoice: ${totalItems}</p>
        </div>

        <div className='d-flex text-end justify-content-between mb-5'>
          <h4>
            :توقيع العميل
            <br />
            .................................
          </h4>
          <h4>
            :ختم الشركة
            <br />
            .................................
          </h4>
        </div>

        <div className="text-end">
          <p>
            <strong>
              ملاحظة: توقيعك على هذه الفاتورة يقر ان العميل قد وافق على شروط وسياسات الشركة
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}

const calculateTotalItems = (items: OrderItem[]) => {
  let total = 0;
  items.forEach((item: OrderItem) => {
    total += item.unitPrice * item.quantity;
  })
  return total;
}
