import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Closing from './Closing';
import { acc } from './accountingApi';
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, errorText: () => 'test error', todayLibya: () => '2026-10-07' }));
jest.mock('./useAccountingAccess', () => ({ useAccountingAccess: () => ({ isOwner: true }) }));
let blockers = 1;
beforeEach(() => {
  jest.clearAllMocks(); blockers = 1;
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path === 'close/month' ? {
    alreadyLocked: true, lockDate: '2026-09-30', end: '2026-09-30', canClose: true, items: [], revenue: 100000, netProfit: 20000,
    reviewStatus: { status: 'provisional', blocking: blockers },
  } : { closed: false, ended: true, accounts: 0, start: '2025-01-01', end: '2025-12-31' } }));
  (acc.post as jest.Mock).mockResolvedValue({ data: { approved: true } });
});
const open = () => render(<MemoryRouter><Closing /></MemoryRouter>);
test('locking a period does not enable approving accounts while blockers remain', async () => {
  open(); await screen.findByText(/حسابات الشهر مؤقتة/);
  expect(screen.getByRole('button', { name: 'اعتماد حسابات 2026-09' })).toBeDisabled();
});
test('clean locked period requests explicit account approval through its separate action', async () => {
  blockers = 0; open(); await screen.findByText(/حسابات الشهر مؤقتة/);
  fireEvent.click(screen.getByRole('button', { name: 'اعتماد حسابات 2026-09' }));
  expect(screen.getByRole('button', { name: 'تأكيد' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('راجعتُ البنود وأريد اعتماد الحسابات'));
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('review/month/approve', { month: '2026-09' }));
  expect((acc.post as jest.Mock).mock.calls.some(([path]) => path === 'close/month')).toBe(false);
});
