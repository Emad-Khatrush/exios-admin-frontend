import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Stack, TextField } from '@mui/material';
import moment from 'moment';
import { useState } from 'react'
import * as XLSX from 'xlsx';
import api from '../../api';
import { getFirstAndLastOfMonth, getTotalShipment } from './methods';

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
    data.push(['CustomerId', 'Order Number', 'Customer Name', 'Phone Number', 'Placed Office', 'Total Invoice', 'LYD Paid', 'USD Paid', 'EURO Paid', 'LYD To USD Rate (Total)', 'Remaining Balance $', 'LYD Rate History', 'Net Income', 'Shipped From', 'Shipped To', 'Made By', 'Created Date'])
    for (const invoice of invoices) {
      const paymentHistoryResponse = (await api.get(`order/${invoice._id}/payments`))?.data?.results;
      const onlyInvoicePayments = paymentHistoryResponse.filter((payment: any) => payment.category === 'invoice');
      const totalPaidInvoice = getTotalPayments(onlyInvoicePayments, 'invoice');
      const { totalRatesText, totalUSD } = getRateForEachPayment(onlyInvoicePayments);

      data.push([
        invoice.user.customerId,
        invoice.orderId,
        `${invoice.user.firstName} ${invoice.user.lastName}`,
        invoice.user.phone,
        invoice.placedAt,
        invoice.totalInvoice,
        totalPaidInvoice.totalLYD,
        totalPaidInvoice.totalUSD,
        totalPaidInvoice.totalEURO,
        (totalUSD + totalPaidInvoice.totalUSD) || 0,
        (invoice.totalInvoice - (totalUSD + totalPaidInvoice.totalUSD)) || 0,
        `${totalRatesText.join(', ')}`,
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
      ["Received Date", 'Customer Id', 'Full Name', "Order Id", 'Tracking Number', 'Weight', 'Measure', 'Exios Price', 'Cost Price(Flight)', 'Cost Price(Package)', 'Estimated Sell($)', 'Estimated Cost($)', 'Gross Profit($)', 'Customer Paid (LYD)', 'Customer Paid (USD)', 'Rate', 'Converted LYD Amount($)'],
    ];

   const uniqueReceivedGoods = receivedGoods.filter((item: any, index: any, self: any) => 
      index === self.findIndex((obj: any) => obj.orderId === item.orderId)
    );

    const processedTrackingNumbers = new Set();

    for (const invoice of uniqueReceivedGoods) {
      const paymentHistoryResponse = (await api.get(`order/${invoice._id}/payments`))?.data?.results;
      const onlyReceivedGoodsPayments = paymentHistoryResponse.filter((payment: any) => payment.category === 'receivedGoods');

      const allTrackingGroups = new Map<string, any>();

      onlyReceivedGoodsPayments.forEach((payment: any) => {
        const trackingNumbersInThisPayment = new Set<string>();

        payment.list.forEach((item: any) => {
          const trackingNumber = item.deliveredPackages?.trackingNumber;
          trackingNumbersInThisPayment.add(trackingNumber);

          if (!allTrackingGroups.has(trackingNumber)) {
            allTrackingGroups.set(trackingNumber, {
              items: [],
              lydPaid: 0,
              usdPaid: 0,
              rate: 0,
              lydConverted: 0,
            });
          }

          const group = allTrackingGroups.get(trackingNumber);
          group.items.push(item);
        });

        // Distribute the payment amounts only to the first tracking number
        const trackingNumbersArray = Array.from(trackingNumbersInThisPayment);
        const mainTrackingNumber = trackingNumbersArray[0];

        if (payment.currency === 'LYD') {
          const group = allTrackingGroups.get(mainTrackingNumber);
          group.lydPaid += payment.receivedAmount;
          if (payment.rate) {
            group.lydConverted += payment.receivedAmount / payment.rate;
            group.rate = payment.rate;
          }
        } else if (payment.currency === 'USD') {
          const group = allTrackingGroups.get(mainTrackingNumber);
          group.usdPaid += payment.receivedAmount;
        }
      });

      for (const [trackingNumber, group] of Array.from(allTrackingGroups.entries())) {
        if (processedTrackingNumbers.has(trackingNumber)) continue;
        processedTrackingNumbers.add(trackingNumber);

        const item = group.items[0]; // Reference item
        const weight = item.deliveredPackages?.weight?.total || 0;
        const measure = item.deliveredPackages?.weight?.measureUnit || '';
        const exiosPrice = item.deliveredPackages?.exiosPrice || 0;
        const costFlight = item?.flight?.costPrice || 0;
        const originPrice = item.deliveredPackages?.originPrice || 0;

        const sellPrice = exiosPrice * weight;
        const costPrice = costFlight * weight;
        const grossProfit = sellPrice - costPrice;

        const row = [
          moment(invoice.paymentList.deliveredPackages.deliveredInfo.deliveredDate).format('DD/MM/YYYY'),
          invoice.user.customerId,
          `${invoice.user.firstName} ${invoice.user.lastName}`,
          invoice.orderId,
          trackingNumber,
          weight,
          measure,
          exiosPrice,
          costFlight,
          originPrice,
          sellPrice,
          costPrice,
          grossProfit,
          group.lydPaid ? group?.lydPaid : undefined,
          group.usdPaid ? group?.usdPaid : undefined,
          group.rate ? group.rate : undefined,
          (group.lydConverted + group.usdPaid ? (group.lydConverted + group.usdPaid).toFixed(2) : undefined),
        ];

        receivedGoodsData.push(row);
      }
    }

    const { totalUSD, totalLYD, totalEURO } = getTotalPayments(paymentHistory, 'receivedGoods');
    receivedGoodsData.push([], [`Total Received in USD: ${totalUSD}`], []);
    receivedGoodsData.push([`Total Received in LYD: ${totalLYD}`], []);
    receivedGoodsData.push([`Total Received in EURO: ${totalEURO}`], []);

    const wsReceivedGoods = XLSX.utils.aoa_to_sheet(receivedGoodsData);
    XLSX.utils.book_append_sheet(workbook, wsReceivedGoods, "Received Goods");

    // Define Shipments data
    const shipmentsCols = [
      ["Departure Date", "Arrival Date", "Flight Name", "Shipped From", "Shipping Method", "Cost Price", "Total Received(USD)", "Total Received(LYD)", "Total Incomes(USD)", "Total Expenses(USD)", "Net Income(USD)"],
    ];

    const shipments = (await api.get(`monthReport?date=${date}&&fetchType=inventory`))?.data?.results;
    for (const shipment of shipments) {
      const { totalReceivedLyd, totalReceivedUSD, totalLYDToUSD } = await getTotalShipment(shipment);
      
      shipmentsCols.push([
        moment(shipment?.departureDate).format('DD/MM/YYYY'),
        moment(shipment.inventoryFinishedDate).format('DD/MM/YYYY'),
        shipment.voyage,
        shipment.shippedCountry,
        shipment.shippingType,
        shipment?.costPrice,
        totalReceivedUSD,
        totalReceivedLyd,
        (totalReceivedUSD + totalLYDToUSD),
        shipment?.voyageAmount || 0,
        (totalReceivedUSD + totalLYDToUSD) - (shipment?.voyageAmount || 0)
      ]);
    }
    
    const wsShipmentsCols = XLSX.utils.aoa_to_sheet(shipmentsCols);
    XLSX.utils.book_append_sheet(workbook, wsShipmentsCols, "Shipments");

    // Define expenses data
    const expenses = [
      ["Created Date", "Description", "Amount(LYD)", "Amount(USD)", "Office", "Created By"],
    ];

    const { startDate, endDate } = getFirstAndLastOfMonth(date);
    const expensesResponse = (await api.get(`expenses?startDate=${startDate}&&endDate=${endDate}`))?.data;
    let totalExpensesUSD: number = 0;
    let totalExpensesLYD: number = 0;

    expensesResponse.forEach((expense: any) => {
      const createdAt = moment(expense.createdAt).format('DD/MM/YYYY');
      const amount = expense.cost.currency === 'LYD' ? expense.cost.total : 0;
      const amountUSD = expense.cost.currency === 'USD' ? expense.cost.total : 0;
      const office = expense.placedAt;
      const createdBy = `${expense.user.firstName} ${expense.user.lastName}`;
      totalExpensesLYD += expense.cost.currency === 'LYD' ? expense.cost.total : 0;
      totalExpensesUSD += expense.cost.currency === 'USD' ? expense.cost.total : 0;
      
      expenses.push([createdAt, expense.description, amount, amountUSD, office, createdBy]);
    })
    
    expenses.push([], [], [`Total Expenses in USD:`, totalExpensesUSD.toString()]);
    expenses.push([`Total Expenses in LYD:`, totalExpensesLYD.toString()]);

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

const getRateForEachPayment = (paymentHistories: any[]) => {
  const totalRatesText: any = [];
  let totalUSD = 0;
  (paymentHistories || []).forEach(payment => {
    if (payment.currency === 'LYD') {
      totalRatesText.push(`(${payment.receivedAmount} LYD / Rate: ${payment.rate})`);
      if (payment.rate !== 0) {
        totalUSD += payment.receivedAmount / payment.rate;
      }
    }
  })

  return { totalRatesText, totalUSD, };
}

const getTotalDebts = (debts: any[]) => {
  let totalPayments: any = { totalUSD: 0, totalLYD: 0 };
  (debts || []).forEach(debt => {
    totalPayments[`total${debt.paymentHistory.currency}`] += debt.paymentHistory.amount;
  })

  return { ...totalPayments };
}

export default MonthReport;
