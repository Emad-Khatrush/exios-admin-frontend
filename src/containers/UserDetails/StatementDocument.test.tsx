import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatementDocument from './StatementDocument';
import * as XLSX from 'xlsx';
import moment from 'moment';

jest.mock('react-to-print', () => ({ useReactToPrint: () => jest.fn() }));
jest.mock('xlsx', () => ({ utils: { aoa_to_sheet: jest.fn(), book_new: jest.fn(), book_append_sheet: jest.fn() }, writeFile: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  (XLSX.utils.aoa_to_sheet as jest.Mock).mockReturnValue({});
  (XLSX.utils.book_new as jest.Mock).mockReturnValue({});
});
const user = { firstName: 'عميل', lastName: 'تجربة', customerId: 'C1' };
const rows = [
  { _id: '1', user, createdAt: '2026-10-01T12:00:00Z', calculationType: '+', amount: 100, total: 125, currency: 'USD', description: 'إيداع', actionType: 'cash' },
  { _id: '2', user, createdAt: '2026-10-02T12:00:00Z', calculationType: '-', amount: 40, total: 85, currency: 'USD', description: 'شراء', note: 'Order #1234' },
];
test('date controls only appear after downloading is opened and Excel exports the chosen period with its carried balance', async () => {
  render(<StatementDocument userStatements={rows} />);
  expect(screen.queryByLabelText('من تاريخ')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'تحميل كشف الحساب' }));
  fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-10-02' } });
  fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-10-02' } });
  expect(screen.getByLabelText('نطاق التقرير')).toHaveTextContent('جميع حركات الفترة (1)');
  fireEvent.click(screen.getByRole('button', { name: 'تحميل Excel' }));
  await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
  const data = (XLSX.utils.aoa_to_sheet as jest.Mock).mock.calls[0][0];
  expect(data[3]).toEqual(['الرصيد', 85]);
  expect(data[5]).toEqual(['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد']);
  expect(data[6]).toEqual(['', 'الرصيد قبل أول حركة في هذا الكشف', 0, 0, 125]);
  expect(data.slice(7)).toHaveLength(1);
  expect(data[7].slice(2)).toEqual([40, 0, 85]);
  expect(screen.queryByRole('columnheader', { name: 'المكتب / الحساب' })).not.toBeInTheDocument();
  expect(screen.queryByText('Order #1234')).not.toBeInTheDocument();
});
test('this year selects January first through today inside the download dialog', () => {
  render(<StatementDocument userStatements={rows} />);
  fireEvent.click(screen.getByRole('button', { name: 'تحميل كشف الحساب' }));
  fireEvent.click(screen.getByRole('button', { name: 'هذه السنة' }));
  expect(screen.getByLabelText('من تاريخ')).toHaveValue(moment().startOf('year').format('YYYY-MM-DD'));
  expect(screen.getByLabelText('إلى تاريخ')).toHaveValue(moment().format('YYYY-MM-DD'));
});
test('empty or invalid periods cannot be printed or exported and all-period reset restores export', () => {
  render(<StatementDocument userStatements={rows} />);
  fireEvent.click(screen.getByRole('button', { name: 'تحميل كشف الحساب' }));
  fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-11-01' } });
  expect(screen.getByRole('button', { name: 'طباعة / حفظ PDF' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'تحميل Excel' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-10-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('تاريخ البداية يجب أن يسبق تاريخ النهاية.');
  fireEvent.click(screen.getByRole('button', { name: 'كل الفترة' }));
  expect(screen.getByRole('button', { name: 'طباعة / حفظ PDF' })).toBeEnabled();
});
