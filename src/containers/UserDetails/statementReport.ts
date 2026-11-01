import moment from 'moment';
import { statementFlow, summarizeStatements } from './statementUtils';

export const statementText = (value: any): string => {
  const text = String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p\s*>/gi, '\n');
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('script,style').forEach(node => node.remove());
    return (doc.body.textContent || '').trim();
  }
  return text.replace(/<[^>]*>/g, '').trim();
};
export const statementOffice = (row: any) => row.walletExchangeId || row.actionType === 'exchange' ? 'داخل المحفظة'
  : row.accountId?.name || ({ tripoli: 'طرابلس', benghazi: 'بنغازي', turkey: 'تركيا', china: 'الصين', bank: 'البنك الليبي', almutahidaTrBank: 'المتحدة — تركيا' } as Record<string, string>)[row.office] || row.office || 'غير محدد';
export const statementKind = (row: any) => {
  const flow = statementFlow(row);
  if (flow === 'exchangeIn' || flow === 'exchangeOut') return 'exchange';
  if (flow === 'cashOut') return 'withdrawal';
  if (flow === 'cashIn') return 'deposit';
  if (flow === 'credit') return row.actionType === 'compensation' ? 'compensation' : row.actionType === 'cancellation' ? 'cancellation' : 'refund';
  if (row.debtType === 'invoice' || /\bOrder\s*[:#-]?\s*[\w-]+/i.test(statementText(row.note))) return 'purchase';
  if (row.debtType === 'receivedGoods' || row.paymentType === 'shipping') return 'shipping';
  return 'payment';
};
export const statementKinds: Record<string, string> = {
  deposit: 'إيداع رصيد', withdrawal: 'سحب نقدي', purchase: 'فاتورة شراء', shipping: 'سداد شحن',
  payment: 'سداد من المحفظة', refund: 'استرداد للمحفظة', compensation: 'تعويض', cancellation: 'إلغاء / عكس عملية', exchange: 'صرافة داخلية',
};
export const statementDay = (row: any) => moment(row.createdAt).isValid() ? moment(row.createdAt).format('YYYY-MM-DD') : '';
export const statementDate = (value: any) => moment(value).isValid() ? moment(value).format('DD/MM/YYYY') : '—';
const signed = (row: any) => (row.calculationType === '-' ? -1 : 1) * Number(row.amount || 0);
const round = (value: number) => Math.round(value * 100) / 100;

// Search/type filters must never be applied here: an exported period is a complete ledger.
export function statementPeriod(chronological: any[], from = '', to = '') {
  const initial = chronological.length ? round(Number(chronological[0].total) - signed(chronological[0])) : 0;
  const before = from ? chronological.filter(row => statementDay(row) < from) : [];
  const opening = before.length ? Number(before[before.length - 1].total) : initial;
  const rows = chronological.filter(row => (!from || statementDay(row) >= from) && (!to || statementDay(row) <= to));
  return statementSnapshot(rows, opening);
}
export function statementSnapshot(rows: any[], emptyOpening = 0) {
  const opening = rows.length ? round(Number(rows[0].total) - signed(rows[0])) : emptyOpening;
  const incoming = round(rows.filter(row => row.calculationType !== '-').reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const outgoing = round(rows.filter(row => row.calculationType === '-').reduce((sum, row) => sum + Number(row.amount || 0), 0));
  return { rows, opening, closing: rows.length ? Number(rows[rows.length - 1].total) : opening,
    incoming, outgoing, summary: summarizeStatements(rows) };
}
