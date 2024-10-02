import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Stack, TextField } from '@mui/material';
import moment from 'moment';
import { useState } from 'react'
import * as XLSX from 'xlsx';
import api from '../../api';

type Props = {}

const MonthReport = (props: Props) => {
  
  const [date, setDate] = useState(new Date());

  const handleDownload = async () => {
    const receivedGoods = (await api.get(`monthReport?date=${date}&&fetchType=receivedGoods`))?.data?.results;
    const invoices = (await api.get(`monthReport?date=${date}&&fetchType=invoices`))?.data?.results;
    const paymentHistory1 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=0&&limit=50`))?.data?.results;
    const paymentHistory2 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=50&&limit=100`))?.data?.results;
    const paymentHistory3 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=100&&limit=150`))?.data?.results;
    const paymentHistory4 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=150&&limit=200`))?.data?.results;
    const paymentHistory5 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=200&&limit=250`))?.data?.results;
    const paymentHistory6 = (await api.get(`monthReport?date=${date}&&fetchType=paymentHistory&&skip=250&&limit=10000`))?.data?.results;
    const paymentHistory = [...paymentHistory1, ...paymentHistory2,...paymentHistory3,...paymentHistory4,...paymentHistory5,...paymentHistory6]
    const paidDebts = (await api.get(`monthReport?date=${date}&&fetchType=paidDebts`))?.data?.results;

    const data: any = [[`Month Report Details of ${moment(date).format('MM/YYYY')}`], []];
    data.push(['CustomerId', 'Order Number', 'Customer Name', 'Phone Number', 'Placed Office', 'Total Invoice', 'Rate', 'Net Income', 'Shipped From', 'Shipped To', 'Made By', 'Created Date'])
    for (const invoice of invoices) {
      data.push([
        invoice.user.customerId,
        invoice.orderId,
        `${invoice.user.firstName} ${invoice.user.lastName}`,
        invoice.user.phone,
        invoice.placedAt,
        invoice.totalInvoice,
        ``,
        invoice.netIncome[0]?.total,
        invoice.shipment.fromWhere,
        invoice.shipment.toWhere,
        `${invoice?.madeBy?.firstName} ${invoice?.madeBy?.lastName}`,
        moment(invoice.createdAt).format('DD/MM/YYYY')
      ]);
    }
    const { totalUSD: invoiceTotalUSD, totalLYD: invoiceTotalLYD, totalEURO: invoiceTotalEURO } = getTotalPayments(paymentHistory, 'invoice');

    data.push([], [[`Total Invoices: `], []]);
    data.push([[`Total Income: `], []]);
    data.push([], [`Total Received in USD: ${invoiceTotalUSD}`]);
    data.push([`Total Received in LYD: ${invoiceTotalLYD}`]);
    data.push([`Total Received in EURO: ${invoiceTotalEURO}`]);
    
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    // Merge cells A1 and B1
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');

    // Define Received Goods data
    const receivedGoodsData = [
      ["Received Date", 'Customer Id', 'Full Name', "Order Id", 'Tracking Number', 'Weight/CBM', 'Origin Price', 'Exios Price', 'Estimated Cost'],
    ];
    for (const invoice of receivedGoods) {
      receivedGoodsData.push([
        moment(invoice.paymentList.deliveredPackages.deliveredInfo.deliveredDate).format('DD/MM/YYYY'),
        invoice.user.customerId,
        `${invoice.user.firstName} ${invoice.user.lastName}`,
        invoice.orderId,
        invoice.paymentList.deliveredPackages.trackingNumber,
        `${invoice.paymentList.deliveredPackages.weight?.total} ${invoice.paymentList.deliveredPackages.weight.measureUnit}`,
        invoice.paymentList.deliveredPackages.originPrice,
        invoice.paymentList.deliveredPackages.exiosPrice,
        invoice.paymentList.deliveredPackages.exiosPrice * (invoice.paymentList.deliveredPackages.weight?.total || 0),
      ]);
    }
    const { totalUSD, totalLYD, totalEURO } = getTotalPayments(paymentHistory, 'receivedGoods');
    receivedGoodsData.push([], [`Total Received in USD: ${totalUSD}`], []);
    receivedGoodsData.push([`Total Received in LYD: ${totalLYD}`], []);
    receivedGoodsData.push([`Total Received in EURO: ${totalEURO}`], []);

    const wsReceivedGoods = XLSX.utils.aoa_to_sheet(receivedGoodsData);
    XLSX.utils.book_append_sheet(workbook, wsReceivedGoods, "Received Goods");

    // Define expenses data
    const expenses = [
      ["Expense Type", "Amount"],
      ["Tripoli Rent", 3000],
      ["China Rent", 0],
      ["Tripoli Local Expenses", 0],
      ["Benghazi Local Expenses", 0],
      ["Turkey Taxs & fees", 0],
      ["Total Ads", 0],
      ["Paying by Lira rate loss", 0],
      ["Others", 0],
    ];
    const wsExpenses = XLSX.utils.aoa_to_sheet(expenses);
    XLSX.utils.book_append_sheet(workbook, wsExpenses, "Expenses");

    // Define Salaries data
    const salaries = [
      ["Employee Name", "Salary", "Commission", "Net Salary"],
      ["عبد الرحمن الزوي", 1200, 0, 0],
      ["يوسف بن غزي", 1600, 0, 0],
      ["معاذ", 1300, 0, 0],
      ["رنا", 800, 0, 0],
      ["مصطفى", 800, 0, 0],
      ["محمد الشلوي", 1300, 0, 0],
    ];
    const wsSalaries = XLSX.utils.aoa_to_sheet(salaries);
    XLSX.utils.book_append_sheet(workbook, wsSalaries, "Salaries");

    // Define Debts data
    const debts = [
      ["Paid Date", "Customer Full Name", "Customer Id", "Office", "Total Debt", "Paid amount", 'Rate'],
    ];
    const { totalUSD: totalDebtsUSD, totalLYD: totalDebtsLYD } = getTotalDebts(paidDebts);
    
    for (const debt of paidDebts) {
      debts.push([
        moment(debt.paymentHistory.createdAt).format('DD/MM/YYYY'),
        `${debt.owner.firstName} ${debt.owner.lastName}`,
        debt.owner.customerId,
        debt.createdOffice,
        `${debt.initialAmount} ${debt.currency}`,
        `${debt.paymentHistory.amount} ${debt.paymentHistory.currency}`,
        debt.paymentHistory.rate
      ]);
    }
    debts.push([], [`Total Received in USD: ${totalDebtsUSD}`], []);
    debts.push([`Total Received in LYD: ${totalDebtsLYD}`], []);

    const wsDebts = XLSX.utils.aoa_to_sheet(debts);
    XLSX.utils.book_append_sheet(workbook, wsDebts, "Paid Debts");

    // Define Transfer rates data
    const transferRates = [
      ["Office", "Transfered Amount", "Rate", "+/-", "Income/Expnese"],
    ];
    const wsTransferRates = XLSX.utils.aoa_to_sheet(transferRates);
    XLSX.utils.book_append_sheet(workbook, wsTransferRates, "Transfer Rates");

    XLSX.writeFile(workbook, `Month Report ${moment(date).format('MM-YYYY')}.xlsx`);
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-3">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={3}>
              <DatePicker
                label="Report Month"
                inputFormat="MM/yyyy"
                value={date}
                renderInput={(params: any) => <TextField {...params} /> }                    
                onChange={(value: any) => {
                  setDate(value)
                }}
              />
            </Stack>
          </LocalizationProvider>
        </div>

        <div className="col-md-6">
          <button onClick={handleDownload}>Download report</button>
        </div>
      </div>
    </div>
  )
}
const getTotalPayments = (paymentHistories: any[], category: 'receivedGoods' | 'invoice') => {
  let totalPayments: any = { totalUSD: 0, totalLYD: 0, totalEURO: 0 };
  (paymentHistories || []).forEach(payment => {
    if (payment.category === category) {
      totalPayments[`total${payment.currency}`] += payment.receivedAmount;
    }
  })

  return { ...totalPayments };
}

const getTotalDebts = (debts: any[]) => {
  let totalPayments: any = { totalUSD: 0, totalLYD: 0 };
  (debts || []).forEach(debt => {
    totalPayments[`total${debt.paymentHistory.currency}`] += debt.paymentHistory.amount;
  })

  return { ...totalPayments };
}

export default MonthReport;
