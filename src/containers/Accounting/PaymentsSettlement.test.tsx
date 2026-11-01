import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PaymentForm } from './Payments';
import { acc } from './accountingApi';

jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, newKey: () => 'native-payment', errorText: () => 'Error' }));
jest.mock('./ListFilters', () => ({ ListFilters: () => null, queryOf: () => ({}), recentFrom: () => '2026-10-30' }));
jest.mock('./useAccountingData', () => ({ accountLabel: (a: any) => a.name, useAccountingData: () => ({ accounts: [
  { _id: 'cash', name: 'Tripoli LYD', currency: 'LYD', isActive: true, isCash: true },
] }) }));
jest.mock('./shared', () => ({ today: () => '2026-11-01', useVendors: () => ({ vendors: [{ _id: 'vendor', name: 'Supplier' }] }), RemotePicker: () => null }));
jest.mock('./ui', () => ({ PageHeader: () => null, Panel: ({ children }: any) => <div>{children}</div>,
  DataTable: ({ rows, columns }: any) => <>{rows.map((row: any) => <div key={row._id}>{columns.find((c: any) => c.key === 'pay').render(row)}</div>)}</>,
  Amount: ({ value, currency }: any) => <span>{value} {currency}</span>, Money: ({ value }: any) => <span>{value / 100} USD</span>, Ltr: ({ children }: any) => <span>{children}</span>, Sub: () => null }));
beforeEach(() => {
  jest.clearAllMocks();
  (acc.get as jest.Mock).mockResolvedValue({ data: { advance: 82500, advanceSources: [
    { _id: 'advance', number: 'PAY/1', day: '2026-10-31', currency: 'LYD', remainingAmount: 16500, remainingUsd: 82500 },
  ], results: [{ _id: 'bill', number: 'BILL/1', currency: 'LYD', total: 16500, totalUsd: 165000, open: 165000 }] } });
  (acc.post as jest.Mock).mockResolvedValue({ data: {} });
});
test('existing LYD advance uses native invoice amounts and sends the source without a new cash payment', async () => {
  render(<MemoryRouter initialEntries={['/accounting/payments/new?vendorId=vendor']}><PaymentForm /></MemoryRouter>);
  await screen.findByLabelText('سداد BILL/1');
  expect(screen.getByRole('checkbox')).toHaveAccessibleName(/16500 LYD دينار ليبي — ما يعادل 825 USD/);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByLabelText('الدفعة السابقة')).toHaveTextContent('PAY/1');
  fireEvent.click(screen.getByRole('button', { name: 'الكل' }));
  expect(screen.getByLabelText('سداد BILL/1')).toHaveValue(16500);
  fireEvent.click(screen.getByRole('button', { name: 'ترحيل الدفعة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('payments', expect.objectContaining({ fromAdvance: true,
    advancePaymentId: 'advance', fromAccountId: undefined, amount: undefined, allocations: [{ billId: 'bill', amountUsd: 165000 }] })));
});
test('native cash payment accepts invoice currency amounts while retaining bill carrying value for allocation', async () => {
  render(<MemoryRouter initialEntries={['/accounting/payments/new?vendorId=vendor']}><PaymentForm /></MemoryRouter>);
  await screen.findByLabelText('سداد BILL/1');
  fireEvent.mouseDown(screen.getByLabelText('دُفعت من'));
  fireEvent.click(await screen.findByRole('option', { name: 'Tripoli LYD' }));
  fireEvent.change(screen.getByLabelText('المبلغ (LYD)'), { target: { value: '16500' } });
  fireEvent.change(screen.getByLabelText('سداد BILL/1'), { target: { value: '16500' } });
  expect(screen.queryByLabelText('الفرق بين المدفوع والموزَّع')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ترحيل الدفعة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('payments', expect.objectContaining({ amount: 16500,
    allocations: [{ billId: 'bill', amountUsd: 165000 }] })));
});
