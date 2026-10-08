import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ReviewQueue from './ReviewQueue';
import { acc } from './accountingApi';
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, errorText: () => 'test error' }));
jest.mock('./useAccountingAccess', () => ({ useAccountingAccess: () => ({ can: () => true }) }));
const item = { key: 'cost:1', fingerprint: 'snapshot', category: 'cost', title: 'اكتمال تكلفة الطلبية لم يُراجع', description: 'ORDER-1', orderId: '1',
  state: 'open', blocking: true, url: '/invoice/1/edit', zeroCost: false };
beforeEach(() => {
  jest.clearAllMocks();
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path === 'lookup/users' ? { results: [] } : {
    results: [item], total: 1, period: { from: '2026-09-01', to: '2026-09-30' }, summary: { total: 1, blocking: 1, errors: 0, deferred: 0 },
  } }));
  (acc.post as jest.Mock).mockResolvedValue({ data: { success: true } });
});
const open = () => render(<MemoryRouter initialEntries={['/accounting/review?from=2026-09-01&to=2026-09-30']}><ReviewQueue /></MemoryRouter>);
test('month review opens with dates supplied by closing and displays unresolved costs', async () => {
  open();
  expect(await screen.findByText(item.title)).toBeInTheDocument();
  expect(acc.get).toHaveBeenCalledWith('review', expect.objectContaining({ from: '2026-09-01', to: '2026-09-30' }));
  expect(screen.getByText('يحتاج معالجة قبل اعتماد الحسابات')).toBeInTheDocument();
});
test('completing review calls only certification, never creates another cost or payment', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: 'تأكيد اكتمال التكلفة' }));
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المراجعة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('review/orders/1/complete', { reason: '', zeroCost: false }));
  expect((acc.post as jest.Mock).mock.calls.some(([path]) => ['bills', 'payments'].includes(path))).toBe(false);
});
test('deferral requires a reason and submits the original snapshot and period', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: 'إسناد / تأجيل' }));
  expect(screen.getByRole('button', { name: 'حفظ المراجعة' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('سبب المراجعة / ملاحظات'), { target: { value: 'بانتظار فاتورة المورد الأصلية' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المراجعة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('review/tasks', expect.objectContaining({ state: 'deferred', key: item.key, fingerprint: item.fingerprint, from: '2026-09-01', to: '2026-09-30' })));
});
