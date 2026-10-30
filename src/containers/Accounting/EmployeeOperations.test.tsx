import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import EmployeeOperations from './EmployeeOperations';
import DailyWork from './DailyWork';
import { acc } from './accountingApi';

jest.mock('./useAccountingAccess', () => ({ useAccountingAccess: () => ({ can: () => true }) }));
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, todayLibya: () => '2026-10-28', errorText: () => 'Request failed' }));
const row = { key: 'UserStatement:111111111111111111111111', sourceId: '111111111111111111111111', fingerprint: 'version1',
  kind: 'deposit', actorName: 'Test Employee', partnerName: 'Test Client', customerCode: 'T1', office: 'tripoli',
  at: '2026-10-28T10:00:00Z', operationDay: '2026-10-28', amount: 100, currency: 'USD', status: 'entered',
  url: '/user/test', description: 'Test deposit', reviewState: 'pending', entries: [] };
const data = { results: [row], total: 1, page: 1, limit: 30, states: [{ _id: 'pending', count: 1 }], currencies: [] };
beforeEach(() => {
  (acc.get as jest.Mock).mockImplementation(async (path: string) => ({ data: path.endsWith('/options') ? { users: [{ _id: 'u1', firstName: 'Test', lastName: 'Employee' }], offices: [{ code: 'tripoli', name: 'طرابلس' }] }
    : path === 'daily-work/operations' ? data : path === 'daily-work/closes' ? { results: [] } : path === 'daily-work/backlog' ? { summary: { total: 0 }, categories: [] } : { summary: {}, offices: [], results: [] } }));
  (acc.post as jest.Mock).mockResolvedValue({ data: { success: true } });
});

test('opens on today, applies quick periods and preserves links to original operations', async () => {
  render(<MemoryRouter><EmployeeOperations /></MemoryRouter>);
  await screen.findByText('Test Employee');
  expect(acc.get).toHaveBeenCalledWith('daily-work/operations', expect.objectContaining({ from: '2026-10-28', to: '2026-10-28', page: 1 }));
  expect(screen.getByRole('link', { name: /فتح العملية/ })).toHaveAttribute('href', '/user/test');
  fireEvent.click(screen.getByRole('button', { name: 'آخر 7 أيام' }));
  await waitFor(() => expect(acc.get).toHaveBeenLastCalledWith('daily-work/operations', expect.objectContaining({ from: '2026-10-22', to: '2026-10-28' })));
});

test('review submits the snapshot and note without changing operation amounts', async () => {
  render(<MemoryRouter><EmployeeOperations /></MemoryRouter>);
  await screen.findByText('Test Employee');
  fireEvent.click(screen.getByRole('button', { name: 'مراجعة' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('ملاحظة المحاسب'), { target: { value: 'Checked receipt' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ المراجعة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('daily-work/operations/review', {
    state: 'reviewed', note: 'Checked receipt', items: [{ key: row.key, fingerprint: 'version1' }],
  }));
});

test('periodic tools are moved behind their own tab and do not load during daily review', async () => {
  render(<MemoryRouter><DailyWork /></MemoryRouter>);
  await screen.findByText('Test Employee');
  expect(acc.get).not.toHaveBeenCalledWith('daily-work/backlog');
  fireEvent.click(screen.getByRole('tab', { name: 'الأعمال الأسبوعية والدورية' }));
  await waitFor(() => expect(acc.get).toHaveBeenCalledWith('daily-work/backlog'));
  expect(screen.queryByText('سجل عمليات الموظفين')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /الجرد والمتابعة/ })).toBeInTheDocument();
});
