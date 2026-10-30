import * as XLSX from 'xlsx';
import { excelAmount, excelDay, inferMapping, mapHistoryRows } from './historicalCashExcel';

const categories = { customer_receipt: { label: 'مقبوضات عملاء / إيداع محفظة' }, operating: { label: 'مدفوعات تشغيل ورواتب' }, unknown: { label: 'بانتظار التصنيف' } };
test('reads an actual XLSX workbook with native dates, Arabic headings, categories and receipt/payment directions', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['التاريخ', 'البيان', 'المبلغ', 'الاتجاه', 'التصنيف', 'المرجع'],
    [46027, 'Customer deposit', 100, 'قبض', 'customer_receipt', 'R1'],
    ['06/01/2026', 'Office rent', 25, 'صرف', 'مدفوعات تشغيل ورواتب', 'E1'],
  ]), 'Jan');
  const loaded = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  const cells = XLSX.utils.sheet_to_json<any[]>(loaded.Sheets.Jan, { header: 1, raw: true });
  const rows = mapHistoryRows(cells, 0, inferMapping(cells[0]), categories);
  expect(rows[0]).toMatchObject({ day: '2026-01-05', amount: '100', direction: 'in', category: 'customer_receipt', reference: 'R1', sourceRow: 2 });
  expect(rows[1]).toMatchObject({ day: '2026-01-06', amount: '25', direction: 'out', category: 'operating' });
});
test('supports Arabic digits, explicit locale choice and 1904 dates without guessing invalid formats', () => {
  expect(excelAmount('١٬٢٣٤٫٥٦', false)).toBe('1234.56');
  expect(excelAmount('1.234,56', true)).toBe('1234.56');
  expect(excelAmount('(1,234.56)', false)).toBe('-1234.56');
  expect(excelAmount('1.234,56', false)).toBe('1.234,56');
  expect(excelDay('٠٥/٠١/٢٠٢٦')).toBe('2026-01-05');
  expect(excelDay(0, true)).toBe('1904-01-01');
});
test('separate receipt/payment columns cannot silently accept both amounts on one row; blank rows are skipped', () => {
  const cells = [['date', 'description', 'incoming', 'outgoing'], ['2026-01-01', 'Receipt', 100, ''], ['', '', '', ''], ['2026-01-02', 'Expense', '', 20], ['2026-01-03', 'Conflicting amounts', 5, 6]];
  const rows = mapHistoryRows(cells, 0, inferMapping(cells[0]), categories);
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ amount: '100', direction: 'in' });
  expect(rows[1]).toMatchObject({ amount: '20', direction: 'out', sourceRow: 4 });
  expect(rows[2].amount).toContain('خطأ');
});
