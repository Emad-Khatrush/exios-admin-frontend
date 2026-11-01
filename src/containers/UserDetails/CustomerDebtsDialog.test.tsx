import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import CustomerDebtsDialog from './CustomerDebtsDialog';
import api from '../../api';

jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn(), fetchFormData: jest.fn() } }));
jest.mock('../../components/DebtsPage/CreateDebtHistoryDialog', () => () => null);

const user = { _id: 'customer', firstName: 'Client', lastName: 'Test', customerId: 'C1' };
const debts: any[] = [
  { _id: 'usd-debt', owner: user, currency: 'USD', amount: 20, initialAmount: 20, status: 'open', notes: 'شراء', debtType: 'invoice', createdAt: '2026-10-30' },
  { _id: 'lyd-debt', owner: user, currency: 'LYD', amount: 30, initialAmount: 30, status: 'overdue', notes: 'شحن', debtType: 'receivedGoods', createdAt: '2026-10-30' },
];
beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockResolvedValue({ data: { results: [{ currency: 'USD', balance: 100 }, { currency: 'LYD', balance: 500 }] } });
  (api.fetchFormData as jest.Mock).mockResolvedValue({ success: true });
});
function setup() {
  const onPaymentSaved = jest.fn().mockResolvedValue(undefined), onClose = jest.fn();
  render(<MemoryRouter><CustomerDebtsDialog open onClose={onClose} user={user} debts={debts} loading={false} error={false}
    balances={{ walletUsd: 100, walletLyd: 500 }} onRetry={jest.fn()} onPaymentSaved={onPaymentSaved} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'سداد جماعي (2)' }));
  return { onPaymentSaved, onClose };
}
test('profile bulk payment reuses the debt dialog, supports overdue debt and refreshes balances after selected payments', async () => {
  const { onPaymentSaved } = setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'تأكيد سداد 2 ديون' })).toBeEnabled());
  const selected = screen.getAllByRole('checkbox');
  fireEvent.click(selected[1]);
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد سداد 1 ديون' }));
  await waitFor(() => expect(onPaymentSaved).toHaveBeenCalledTimes(1));
  expect(api.get).toHaveBeenCalledWith('wallet/customer');
  expect(api.fetchFormData).toHaveBeenCalledTimes(1);
  const [path, method, body] = (api.fetchFormData as jest.Mock).mock.calls[0];
  expect(path).toBe('balances/usd-debt/paymentHistory');
  expect(method).toBe('POST');
  expect(body.get('amount')).toBe('20');
  expect(body.get('currency')).toBe('USD');
  expect(await screen.findByText('تم تسجيل السداد بنجاح.')).toBeInTheDocument();
});
test('profile bulk payment supports dinar conversion, partial amounts and original dinar debts in the same batch', async () => {
  const { onPaymentSaved } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'بالدينار LYD' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /سعر الصرف/ }), { target: { value: '10' } });
  await waitFor(() => expect(screen.getByLabelText('مبلغ سداد شراء')).toHaveValue(200));
  fireEvent.change(screen.getByLabelText('مبلغ سداد شراء'), { target: { value: '100' } });
  expect(screen.getByLabelText('مبلغ سداد شراء')).toHaveValue(100);
  await waitFor(() => expect(screen.getByRole('button', { name: 'تأكيد سداد 2 ديون' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد سداد 2 ديون' }));
  await waitFor(() => expect(onPaymentSaved).toHaveBeenCalledTimes(1));
  const calls = (api.fetchFormData as jest.Mock).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][2].get('amount')).toBe('100');
  expect(calls[0][2].get('currency')).toBe('LYD');
  expect(calls[0][2].get('rate')).toBe('10');
  expect(calls[1][0]).toBe('balances/lyd-debt/paymentHistory');
  expect(calls[1][2].get('amount')).toBe('30');
  expect(calls[1][2].get('sameCurrency')).toBe('true');
});
