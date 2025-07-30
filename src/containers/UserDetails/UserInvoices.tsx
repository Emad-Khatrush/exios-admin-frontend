// src/pages/UserInvoices.tsx

import { useEffect, useRef, useState } from 'react';
import { Button, CardContent, CircularProgress, Typography } from '@mui/material';
import api from '../../api'; // adjust to your actual path
import { useReactToPrint } from 'react-to-print';
import InvoicePDFPreview from './InvoicePDFPreview';
import './UserOrders.scss';
import Card from '../../components/Card/Card';
import { User } from '../../models';

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
};

const UserInvoices = ({ customerId }: { customerId: string }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

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
    documentTitle: selectedInvoice ? `Invoice-${selectedInvoice._id}` : 'Invoice',
  });

  const handleDownload = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setTimeout(() => {
      handlePrint();
    }, 200); // Wait for the ref to update
  };

  return (
    <div className='container user-invoices'>
      <div className="row">
        {loading ? (
          <CircularProgress />
        ) : invoices.length === 0 ? (
          <Typography>No invoices found.</Typography>
        ) : (
          invoices.map((invoice) => (
            <Card key={invoice._id} className="col-md-6 mb-3 mr-5">
              <CardContent>
                <Typography variant="h6">Freight Invoice #0{invoice.referenceId}</Typography>
                <Typography>Client Code: {invoice.customer.customerId}</Typography>
                <Typography>Full Name: {`${invoice.customer.firstName} ${invoice.customer.lastName}`}</Typography>
                <Typography>Date: {new Date(invoice.createdAt).toLocaleDateString()}</Typography>
                <Typography>Total: {invoice.total} {invoice.currency}</Typography>
                <Typography className='mt-0 mb-2'>Customer Paid: {invoice.amountUSD} $, {invoice.amountLYD} LYD, Rate: {invoice.rate}</Typography>
                {invoice.note && <Typography>Note: {invoice.note}</Typography>}

                <div className="order-card">
                  <div className="packages">
                    <h4>Packages</h4>
                    {invoice.list.map((pkg, index) => {
                      const measureValue = pkg?.weight.total || 0;
                      const measureUnit = pkg?.weight.measureUnit || '';
                      return (
                        <div key={pkg._id} className="package-item">
                          <div className="package-details">
                            <p>Tracking: {pkg.trackingNumber || 'N/A'}</p>
                            <p>Measure: {measureValue} {measureUnit}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  style={{ marginTop: '10px' }}
                  onClick={() => handleDownload(invoice)}
                >
                  Download PDF
                </Button>
              </CardContent>
            </Card>
          ))
        )}

        {/* Hidden render for PDF preview */}
        <div style={{ display: 'none' }}>
          {selectedInvoice && (
            <div ref={componentRef}>
              <InvoicePDFPreview invoice={selectedInvoice} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserInvoices;
