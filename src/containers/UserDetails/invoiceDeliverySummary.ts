// Cancelled rows remain on the invoice for its audit history, but no longer
// represent goods delivered to the customer.
export const invoiceDeliverySummary = (invoice: { isCanceled?: boolean; list?: any[] }) => {
  const rows = invoice.list || [];
  const delivered = invoice.isCanceled ? [] : rows.filter(row => !row.canceledAt);
  const boxes = delivered.reduce((sum, row) => {
    const count = Number(row.boxesCount);
    return sum + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);
  return { packages: delivered.length, boxes, canceledPackages: rows.length - delivered.length };
};

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

type MoneyInvoice = {
  total: number;
  rate?: number;
  amountUSD?: number;
  amountLYD?: number;
  partialDelivery?: boolean;
  isCanceled?: boolean;
  list?: any[];
  settlement?: { paidUSD?: number; paidLYD?: number; paidEquivalentUSD?: number };
  cancellation?: { refundedUSD?: number; refundedLYD?: number; packages?: any[] };
};

// What came back to the wallet for one cancelled package: saved on the row since cancelling by
// package, else in the invoice's cancellation list by tracking number
export const packageRefund = (invoice: MoneyInvoice, pkg: any) => {
  const refunds = Array.isArray(pkg?.refunds) ? pkg.refunds
    : ((invoice.cancellation?.packages || []).find((p: any) => p.trackingNumber && p.trackingNumber === pkg?.trackingNumber)?.refunds || []);
  const sum = (currency: string) => round2(refunds.filter((r: any) => r.currency === currency).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
  return { USD: sum('USD'), LYD: sum('LYD') };
};

// The money of a delivery invoice before and after its cancelled packages.
// A wallet invoice keeps what was first paid in amountUSD/amountLYD, so the refunds are taken
// off. On credit (partial) delivery the refunded payments are deleted and the settlement is
// already what is left, so the refunds are added back to show what was first paid.
export const invoiceMoney = (invoice: MoneyInvoice) => {
  const rows = invoice.list || [];
  const canceledRows = rows.filter(row => row.canceledAt || invoice.isCanceled);
  const refundedUSD = round2(invoice.cancellation?.refundedUSD || 0);
  const refundedLYD = round2(invoice.cancellation?.refundedLYD || 0);
  const partial = !!invoice.partialDelivery;
  const netUSD = partial ? round2(invoice.settlement?.paidUSD || 0) : round2(Math.max(0, (invoice.amountUSD || 0) - refundedUSD));
  const netLYD = partial ? round2(invoice.settlement?.paidLYD || 0) : round2(Math.max(0, (invoice.amountLYD || 0) - refundedLYD));
  const paidUSD = partial ? round2(netUSD + refundedUSD) : round2(invoice.amountUSD || 0);
  const paidLYD = partial ? round2(netLYD + refundedLYD) : round2(invoice.amountLYD || 0);
  const canceledTotal = round2(canceledRows.reduce((s, row) => s + Number(row.cost || 0), 0));
  // Dinars for one dollar: the rate of the delivery, or what the credit payments came to
  const equivalentLYDinUSD = round2((invoice.settlement?.paidEquivalentUSD || 0) - (invoice.settlement?.paidUSD || 0));
  const rate = Number(invoice.rate) > 0 ? Number(invoice.rate)
    : partial && netLYD > 0 && equivalentLYDinUSD > 0 ? Math.round((netLYD / equivalentLYDinUSD) * 10000) / 10000 : 0;
  return {
    paidUSD, paidLYD, refundedUSD, refundedLYD, netUSD, netLYD, rate,
    hasCancellation: canceledRows.length > 0,
    canceledTotal,
    totalAfter: round2(Math.max(0, Number(invoice.total || 0) - canceledTotal)),
  };
};
