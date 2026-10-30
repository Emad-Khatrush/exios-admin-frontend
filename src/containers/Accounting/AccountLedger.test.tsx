import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AccountLedger from './AccountLedger';

jest.mock('./accountingApi', () => ({
  CURRENCY_DECIMALS: { USD: 2 }, EVENT_LABELS: {}, todayLibya: () => '2026-10-27', errorText: String,
  acc: { get: async () => ({ data: {
    account: { code: '110121', name: 'Cash', currency: 'USD' },
    opening: { usd: 0 }, closing: { usd: 4500 },
    movements: [
      { _id: 'original', number: 'JV1', day: '2026-10-25', status: 'reversed', description: 'Withdrawal', line: { credit: 1000 }, balanceUsd: 3500 },
      { _id: 'reversal', number: 'JV2', day: '2026-10-25', status: 'posted', reversalOf: 'original', description: 'Withdrawal', line: { debit: 1000 }, balanceUsd: 4500 },
      { _id: 'active', number: 'JV3', day: '2026-10-24', status: 'posted', description: 'Deposit', line: { debit: 4500 }, balanceUsd: 4500 },
    ],
  } }) },
}));

test('ledger distinguishes the canceled entry from its posted reversal and links back to the original', async () => {
  render(<MemoryRouter><AccountLedger /></MemoryRouter>);
  const canceled = await screen.findByText('قيد مُلغى');
  const reversal = screen.getByText('قيد إلغاء — عكس العملية الأصلية');
  expect(canceled.closest('tr')).toHaveClass('dt-row--canceled');
  expect(reversal.closest('tr')).toHaveClass('dt-row--reversal');
  expect(screen.getByRole('link', { name: /عرض القيد الأصلي/ })).toHaveAttribute('href', '/accounting/entries/original');
  expect(screen.getByText('Deposit').closest('tr')).not.toHaveClass('dt-row--canceled', 'dt-row--reversal');
});
