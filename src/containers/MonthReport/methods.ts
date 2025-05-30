import api from "../../api"

export const getTotalShipment = async (data: any) => {
  let totalReceivedLyd = 0, totalReceivedUSD = 0, totalLYDToUSD = 0;

  const orders = data.orders || [];
  let rateNotFound = false;

  for (const order of orders) {
    const payments = (await api.get(`order/${order._id}/payments`))?.data?.results || [];

    const onlyReceivedGoodsShipments = payments.filter((payment: any) => payment.category === 'receivedGoods');

    for (const payment of onlyReceivedGoodsShipments) {

      if (payment.currency === 'LYD') {
        if (payment?.rate && !rateNotFound) {
          totalLYDToUSD += payment?.rate ? Number(payment.receivedAmount) / Number(payment.rate) : 0;
        } else {
          rateNotFound = true;
        }
        totalReceivedLyd += Number(payment.receivedAmount);
      } else if (payment.currency === 'USD') {
        totalReceivedUSD += Number(payment.receivedAmount);
      }
    }
  }
  if (rateNotFound) {
    totalLYDToUSD = 0;
  }
  return { totalReceivedLyd, totalReceivedUSD, totalLYDToUSD };
};

export const getFirstAndLastOfMonth = (date: any) => {
  const d = new Date(date);

  // First day of the month
  const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0); // Optional: set to start of day

  // Last day of the month
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  endDate.setHours(23, 59, 59, 999); // Optional: set to end of day

  return { startDate, endDate };
};

