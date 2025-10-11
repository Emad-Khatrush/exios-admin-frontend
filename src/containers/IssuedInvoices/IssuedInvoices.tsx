import { useEffect, useRef, useState } from 'react';
import {
  Button,
  CardContent,
  CircularProgress,
  Typography,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import api from '../../api';
import { useReactToPrint } from 'react-to-print';
import './IssuedInvoices.scss';
import Card from '../../components/Card/Card';
import { User } from '../../models';
import InvoicePDFPreview from '../UserDetails/InvoicePDFPreview';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import DatePicker from '@mui/lab/DatePicker';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import moment from 'moment';

interface Invoice {
  _id: string;
  total: number;
  currency: 'USD' | 'EURO' | 'LYD';
  category: 'invoice' | 'shipment';
  rate: number;
  note?: string;
  createdAt: string;
  list: any[];
  referenceId: number;
  amountUSD?: number;
  amountLYD?: number;
  customer: User;
}

type FilterType = 'daily' | 'last7days' | 'currentMonth' | 'all';

const DailyInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedDate, setSelectedDate] = useState<any | null>(new Date());
  const [filterType, setFilterType] = useState<FilterType>('daily');
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, filterType]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let query = '';

      if (filterType === 'daily') {
        const formattedDate = moment(selectedDate).format('YYYY-MM-DD');
        query = `invoices/issued?date=${formattedDate}`;
      } else if (filterType === 'last7days') {
        const to = moment().format('YYYY-MM-DD');
        const from = moment().subtract(7, 'days').format('YYYY-MM-DD');
        query = `invoices/issued?from=${from}&to=${to}`;
      } else if (filterType === 'currentMonth') {
        const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
        query = `invoices/issued?from=${startOfMonth}&to=${endOfMonth}`;
      } else if (filterType === 'all') {
        query = `invoices/issued`;
      }

      const response = await api.get(query);
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
    }, 200);
  };

  const handleFilterChange = (
    event: React.MouseEvent<HTMLElement>,
    newFilter: FilterType | null
  ) => {
    if (newFilter !== null) {
      setFilterType(newFilter);
    }
  };

  return (
    <div className='container user-invoices'>
      <div className="filter-container mb-4 d-flex align-items-center gap-3">
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Select Date"
            value={selectedDate}
            onChange={(newValue: any) => setSelectedDate(newValue)}
            renderInput={(params: any) => <TextField {...params} />}
            disabled={filterType !== 'daily'}
          />
        </LocalizationProvider>

        <ToggleButtonGroup
          value={filterType}
          exclusive
          onChange={handleFilterChange}
          size="small"
          aria-label="Filter Type"
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="last7days">Last 7 Days</ToggleButton>
          <ToggleButton value="currentMonth">This Month</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="row">
        {loading ? (
          <CircularProgress />
        ) : invoices.length === 0 ? (
          <Typography>No invoices found for this filter.</Typography>
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
                        <div key={pkg._id || index} className="package-item">
                          <div className="package-details">
                            <p>Tracking: {pkg.trackingNumber || 'N/A'}</p>
                            <p>Measure: {measureValue} {measureUnit}</p>
                          </div>
                        </div>
                      );
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

        {/* Hidden PDF Render */}
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

export default DailyInvoices;
