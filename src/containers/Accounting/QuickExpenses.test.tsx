import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import QuickExpenses from './QuickExpenses';
import { acc } from './accountingApi';

jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, OFFICE_LABELS: {}, newKey: () => 'expense-request', errorText: () => 'راجع المصروف الموجود' }));
jest.mock('./BillExcelImport', () => () => null);
jest.mock('./ListFilters', () => ({ ListFilters: () => null, queryOf: () => ({}), recentFrom: () => '2026-09-01' }));
jest.mock('../../utils/useCountDay', () => ({ useCountDay: () => null, isBeforeCount: () => false }));
jest.mock('./shared', () => ({ amountLabel: () => 'المبلغ', today: () => '2026-09-20' }));
jest.mock('./useAccountingData', () => ({ accountLabel: (a: any) => a.name, useAccountingData: () => ({
  accounts: [{ _id: 'bank', name: 'United Bank', currency: 'USD', isActive: true, isCash: true, office: 'tripoli' }],
  offices: [{ code: 'tripoli', name: 'Tripoli', isActive: true }],
}) }));
jest.mock('./ui', () => ({ Panel: ({ title, children }: any) => <section><div>{title}</div>{children}</section>,
  PageHeader: () => null, DataTable: () => null, Amount: () => null, Ltr: ({ children }: any) => <span>{children}</span>, Money: () => null, StatusBadge: () => null, Sub: () => null }));

const review = { fingerprint: 'review-version', canConfirmIndependent: true,
  results: [{ key: 'bill:one', number: 'BILL/2026/1', amount: 100, currency: 'USD', day: '2026-09-20', reason: 'نفس الحساب والمبلغ', url: '/accounting/bills/one' }] };
beforeEach(() => {
  jest.clearAllMocks();
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: { results: path === 'expense-types'
    ? [{ _id: 'rent', name: 'Rent', accountId: 'expense', defaultOffice: 'tripoli' }]
    : path === 'vendors' ? [{ _id: 'cash-vendor', seedKey: 'cash_expenses' }] : [] } }));
  (acc.post as jest.Mock).mockRejectedValueOnce({ response: { data: { costDuplicatePreview: review } } }).mockResolvedValue({ data: {} });
});
async function openReview() {
  render(<MemoryRouter><QuickExpenses /></MemoryRouter>);
  fireEvent.mouseDown(screen.getByLabelText('نوع المصروف'));
  fireEvent.click(await screen.findByRole('option', { name: 'Rent' }));
  fireEvent.mouseDown(screen.getByLabelText('دُفع من'));
  fireEvent.click(await screen.findByRole('option', { name: 'United Bank' }));
  fireEvent.change(screen.getByLabelText('المبلغ'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'تسجيل المصروف' }));
  return screen.findByRole('dialog');
}
test('duplicate expense review opens the original and requires a reason before an independent retry', async () => {
  await openReview();
  expect(screen.getByRole('link', { name: 'فتح المصروف الموجود' })).toHaveAttribute('href', '/accounting/bills/one');
  const confirm = screen.getByRole('button', { name: 'تسجيله كمصروف مستقل' });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('إذا كان مصروفًا آخر، اكتب سبب الاختلاف'), { target: { value: 'إيجار مستقل لمكتب آخر حسب الإيصال' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(acc.post).toHaveBeenLastCalledWith('bills', expect.objectContaining({
    duplicateDecision: 'independent', duplicateFingerprint: review.fingerprint,
    duplicateReason: 'إيجار مستقل لمكتب آخر حسب الإيصال', idempotencyKey: 'expense-request',
  })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('returning to review does not issue another expense request', async () => {
  await openReview(); fireEvent.click(screen.getByRole('button', { name: 'رجوع للمراجعة' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(acc.post).toHaveBeenCalledTimes(1);
});
