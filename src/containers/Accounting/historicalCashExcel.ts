import * as XLSX from 'xlsx';

export type HistoryRow = { day: string; description: string; amount: string; direction: string; category: string; reference: string; transferRef: string; duplicateReason?: string; sourceRow: number; clientKey?: string };
export type HistoryMapping = Record<'day' | 'description' | 'amount' | 'incoming' | 'outgoing' | 'direction' | 'category' | 'reference' | 'transferRef', string>;
export const fields: Record<keyof HistoryMapping, string> = { day: 'التاريخ', description: 'البيان', amount: 'المبلغ', incoming: 'مقبوضات (عمود مستقل)', outgoing: 'مدفوعات (عمود مستقل)', direction: 'الاتجاه', category: 'التصنيف', reference: 'رقم الإيصال / المرجع', transferRef: 'مرجع التحويل الداخلي' };
const digits = (value: any) => String(value ?? '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
export function excelDay(value: any, date1904 = false): string {
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value, { date1904 });
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : String(value);
  }
  const v = digits(value).trim();
  const match = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : v;
}
export function excelAmount(value: any, european: boolean): string {
  if (typeof value === 'number') return String(value);
  let v = digits(value).trim().replace(/\s/g, '').replace(/٬/g, ',').replace(/٫/g, '.');
  const negative = /^\(.*\)$/.test(v);
  if (negative) v = v.slice(1, -1);
  const pattern = european ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/ : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!pattern.test(v)) return v;
  v = european ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  return negative ? `-${v}` : v;
}
export function inferMapping(headers: any[]): HistoryMapping {
  const aliases: Record<keyof HistoryMapping, string[]> = {
    day: ['التاريخ', 'date', 'day', 'تاريخ العملية'], description: ['البيان', 'الوصف', 'description', 'details'],
    amount: ['المبلغ', 'amount'], incoming: ['مقبوضات', 'قبض', 'incoming', 'receipt'], outgoing: ['مدفوعات', 'صرف', 'outgoing', 'payment'],
    direction: ['الاتجاه', 'direction', 'نوع الحركة'], category: ['التصنيف', 'category'], reference: ['المرجع', 'رقم الإيصال', 'reference', 'receipt number'], transferRef: ['مرجع التحويل', 'transfer reference'],
  };
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, String(headers.findIndex(h => values.includes(String(h ?? '').trim().toLowerCase())))]).map(([key, value]) => [key, value === '-1' ? '' : value])) as HistoryMapping;
}
export function mapHistoryRows(cells: any[][], header: number, mapping: HistoryMapping, categories: Record<string, any>, european = false, date1904 = false): HistoryRow[] {
  const cell = (r: any[], key: keyof HistoryMapping) => mapping[key] === '' ? '' : r[Number(mapping[key])];
  return cells.slice(header + 1).map((r, i) => ({ r, sourceRow: header + i + 2 })).filter(({ r }) => r.some(c => c !== null && c !== undefined && String(c).trim() !== '')).map(({ r, sourceRow }) => {
    const incoming = excelAmount(cell(r, 'incoming'), european), outgoing = excelAmount(cell(r, 'outgoing'), european);
    const split = mapping.incoming !== '' || mapping.outgoing !== '';
    const two = split && Number(incoming) !== 0 && incoming !== '' && Number(outgoing) !== 0 && outgoing !== '';
    const raw = split ? (Number(incoming) ? incoming : outgoing) : excelAmount(cell(r, 'amount'), european);
    const d = String(cell(r, 'direction') ?? '').trim().toLowerCase();
    const direction = split ? (Number(incoming) ? 'in' : 'out') : ['قبض', 'ايداع', 'إيداع', 'in', 'receipt', '+'].includes(d) ? 'in' : ['صرف', 'سحب', 'out', 'payment', '-'].includes(d) ? 'out' : d ? d : Number(raw) < 0 ? 'out' : 'in';
    const categoryValue = String(cell(r, 'category') ?? '').trim();
    const category = Object.keys(categories).find(k => k === categoryValue || categories[k].label === categoryValue) || 'unknown';
    return { day: excelDay(cell(r, 'day'), date1904), description: String(cell(r, 'description') ?? '').trim(),
      amount: two ? 'خطأ: قبض وصرف في السطر نفسه' : /^-?\d+(\.\d+)?$/.test(raw) ? String(Math.abs(Number(raw))) : raw,
      direction, category, reference: String(cell(r, 'reference') ?? '').trim(), transferRef: String(cell(r, 'transferRef') ?? '').trim(), sourceRow };
  });
}
export function templateHistory(categories: Record<string, any>) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['التاريخ', 'البيان', 'المبلغ', 'الاتجاه', 'التصنيف', 'المرجع', 'مرجع التحويل'],
    ['2026-01-05', 'مثال: إيداع عميل — احذف المثال قبل الاستيراد', 100, 'قبض', 'customer_receipt', 'REC-001', ''],
    ['2026-01-06', 'مثال: مدفوعات تشغيل — احذف المثال قبل الاستيراد', 25, 'صرف', 'operating', 'EXP-001', ''],
  ]), 'الحركات');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(categories).map(([code, c]: [string, any]) => ({ 'رمز التصنيف': code, 'المعنى': c.label, 'الاتجاه': c.direction === 'in' ? 'قبض' : c.direction === 'out' ? 'صرف' : 'حسب الحركة' }))), 'التصنيفات');
  XLSX.writeFile(wb, 'historical-cash-template.xlsx');
}
