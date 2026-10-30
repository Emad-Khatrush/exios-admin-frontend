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
