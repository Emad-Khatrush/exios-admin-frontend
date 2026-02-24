import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  CircularProgress, 
  Paper 
} from '@mui/material';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AssessmentIcon from '@mui/icons-material/Assessment';
import moment from 'moment';
import * as XLSX from 'xlsx';

import api from '../../api';
import { getFirstAndLastOfMonth } from './methods'; // Ensure these are exported from methods.ts
import './MonthReport.scss';

const MonthReport = () => {
  const [date, setDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);

  // Helper: Fetch payment history in chunks if needed, or all at once
  const fetchAllPaymentHistory = async (targetDate: string) => {
    const limits = [
        { skip: 0, limit: 100 },
        { skip: 100, limit: 10000 }
    ];
    const requests = limits.map(range => 
        api.get(`monthReport?date=${targetDate}&&fetchType=paymentHistory&&skip=${range.skip}&&limit=${range.limit}`)
    );
    const responses = await Promise.all(requests);
    return responses.flatMap(res => res?.data?.results || []);
  };

  const handleDownload = async () => {
    if (!date) return;
    setLoading(true);

    try {
      const formattedDate = moment(date).format('YYYY-MM-DD');
      
      // 1. Concurrent Initial Data Fetch
      const [receivedRes, invoicesRes, paidDebtsRes] = await Promise.all([
        api.get(`monthReport?date=${formattedDate}&&fetchType=receivedGoods`),
        api.get(`monthReport?date=${formattedDate}&&fetchType=invoices`),
        api.get(`monthReport?date=${formattedDate}&&fetchType=paidDebts`)
      ]);

      const invoices = invoicesRes?.data?.results || [];
      const paymentHistory = await fetchAllPaymentHistory(formattedDate);
      const paidDebts = paidDebtsRes?.data?.results || [];

      // 2. Build Invoice Sheet Data
      const data: any = [[`Month Report Details of ${moment(date).format('MM/YYYY')}`], []];
      data.push(['CustomerId', 'Order Number', 'Customer Name', 'Phone Number', 'Placed Office', 'Total Invoice', 'LYD Paid', 'USD Paid', 'EURO Paid', 'LYD To USD Rate (Total)', 'Remaining Balance $', 'LYD Rate History', 'Net Income', 'Shipped From', 'Shipped To', 'Made By', 'Created Date']);

      for (const invoice of invoices) {
        const orderPayments = (await api.get(`order/${invoice._id}/payments`))?.data?.results || [];
        const onlyInvoicePayments = orderPayments.filter((p: any) => p.category === 'invoice');
        
        const totalPaidInvoice = getTotalPayments(onlyInvoicePayments, 'invoice');
        const { totalRatesText, totalUSD } = getRateForEachPayment(onlyInvoicePayments);

        data.push([
          invoice.user?.customerId,
          invoice.orderId,
          `${invoice.user?.firstName} ${invoice.user?.lastName}`,
          invoice.user?.phone,
          invoice.placedAt,
          invoice.totalInvoice,
          totalPaidInvoice.totalLYD,
          totalPaidInvoice.totalUSD,
          totalPaidInvoice.totalEURO,
          (totalUSD + totalPaidInvoice.totalUSD) || 0,
          (invoice.totalInvoice - (totalUSD + totalPaidInvoice.totalUSD)) || 0,
          totalRatesText.join(', '),
          invoice.netIncome?.[0]?.total,
          invoice.shipment?.fromWhere,
          invoice.shipment?.toWhere,
          `${invoice?.madeBy?.firstName} ${invoice?.madeBy?.lastName}`,
          moment(invoice.createdAt).format('DD/MM/YYYY')
        ]);
      }

      // 3. Invoice Totals
      const { totalUSD: invUSD, totalLYD: invLYD, totalEURO: invEURO } = getTotalPayments(paymentHistory, 'invoice');
      data.push([], [`Summary`], [`Total Received in USD: ${invUSD}`], [`Total Received in LYD: ${invLYD}`], [`Total Received in EURO: ${invEURO}`]);

      // 4. Expenses Sheet
      const expenses = [["Created Date", "Description", "Amount(LYD)", "Amount(USD)", "Office", "Created By"]];
      const { startDate, endDate } = getFirstAndLastOfMonth(date);
      const expensesRes = await api.get(`expenses?startDate=${startDate}&&endDate=${endDate}`);
      
      let totalExpUSD = 0; let totalExpLYD = 0;
      (expensesRes.data || []).forEach((exp: any) => {
        const isLYD = exp.cost.currency === 'LYD';
        totalExpLYD += isLYD ? exp.cost.total : 0;
        totalExpUSD += !isLYD ? exp.cost.total : 0;
        expenses.push([
          moment(exp.createdAt).format('DD/MM/YYYY'),
          exp.description,
          isLYD ? exp.cost.total : 0,
          !isLYD ? exp.cost.total : 0,
          exp.placedAt,
          `${exp.user?.firstName} ${exp.user?.lastName}`
        ]);
      });
      expenses.push([], [`Total Expenses USD: ${totalExpUSD}`, `Total Expenses LYD: ${totalExpLYD}`]);

      // 5. Build Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'Invoices');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(expenses), 'Expenses');

      // 6. Paid Debts Sheet
      const debtsData = [["Paid Date", "Customer Full Name", "Customer Id", "Office", "Total Debt", "Paid amount", 'Rate']];
      paidDebts.forEach((debt: any) => {
        debtsData.push([
          moment(debt.paymentHistory.createdAt).format('DD/MM/YYYY'),
          `${debt.owner?.firstName} ${debt.owner?.lastName}`,
          debt.owner?.customerId,
          debt.createdOffice,
          `${debt.initialAmount} ${debt.currency}`,
          `${debt.paymentHistory.amount} ${debt.paymentHistory.currency}`,
          debt.paymentHistory.rate
        ]);
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(debtsData), 'Paid Debts');

      XLSX.writeFile(workbook, `Month_Report_${moment(date).format('MM_YYYY')}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="report-container">
      <Paper className="report-card" elevation={0}>
        <AssessmentIcon className="header-icon" />
        <Typography variant="h5" gutterBottom>Monthly Financials</Typography>
        <Typography variant="body2">Generate and download comprehensive reports for your records.</Typography>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box className="picker-section">
            <DatePicker
              views={['year', 'month']}
              label="Select Month"
              value={date}
              onChange={(val) => setDate(val)}
              renderInput={(params) => <TextField {...params} fullWidth size="medium" />}
            />
          </Box>
        </LocalizationProvider>

        <Button
          variant="contained"
          fullWidth
          disabled={loading || !date}
          onClick={handleDownload}
          className="download-btn"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
        >
          {loading ? 'Processing Data...' : 'Download Excel Report'}
        </Button>

        <Typography className="status-text">
          {loading ? 'Fetching records from server, please wait...' : 'Ready for export'}
        </Typography>
      </Paper>
    </Box>
  );
};

// --- Helper Functions ---
const getTotalPayments = (paymentHistories: any[], category: string) => {
  let totals: any = { totalUSD: 0, totalLYD: 0, totalEURO: 0 };
  (paymentHistories || []).forEach(p => {
    if (p.category === category) {
      const key = `total${p.currency}`;
      if (totals[key] !== undefined) totals[key] += p.receivedAmount || 0;
    }
  });
  return totals;
};

const getRateForEachPayment = (paymentHistories: any[]) => {
  const totalRatesText: string[] = [];
  let totalUSD = 0;
  (paymentHistories || []).forEach(p => {
    if (p.currency === 'LYD' && p.rate > 0) {
      totalRatesText.push(`(${p.receivedAmount} LYD @ ${p.rate})`);
      totalUSD += p.receivedAmount / p.rate;
    }
  });
  return { totalRatesText, totalUSD };
};

export default MonthReport;