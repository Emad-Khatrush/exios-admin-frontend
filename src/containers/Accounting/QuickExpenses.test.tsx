import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import QuickExpenses from './QuickExpenses';
import BillForm from './BillForm';
import { acc } from './accountingApi';

jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, OFFICE_LABELS: {}, newKey: () => 'expense-request', errorText: () => 'راجع المصروف الموجود' }));
jest.mock('./BillExcelImport', () => () => null);
jest.mock('./ListFilters', () => ({ ListFilters: () => null, queryOf: () => ({}), recentFrom: () => '2026-09-01' }));
jest.mock('../../utils/useCountDay', () => ({ useCountDay: () => null, isBeforeCount: () => false }));
jest.mock('./shared', () => ({ amountLabel: () => 'المبلغ', today: () => '2026-09-20', VENDOR_TYPES: { supplier: 'مورد' },
  useVendors: () => ({ vendors: [], reload: jest.fn() }), RemotePicker: () => null }));
jest.mock('./Bills', () => ({ TARGET_LABELS: { expense: 'مصروف', trip: 'رحلة' } }));
jest.mock('./useAccountingData', () => ({ accountLabel: (a: any) => a.name, useAccountingData: () => ({
  accounts: [{ _id: 'bank', name: 'United Bank', currency: 'USD', isActive: true, isCash: true, office: 'tripoli' },
    { _id: 'expense', name: 'Hospitality', code: '531300', type: 'expense', isActive: true }],
  offices: [{ code: 'tripoli', name: 'Tripoli', isActive: true }],
  currencies: [{ code: 'USD', name: 'Dollar', isActive: true }],
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

test('direct supplier bill hides the supplier and requires an actual payment account', () => {
  render(<MemoryRouter><BillForm /></MemoryRouter>);
  expect(screen.getByLabelText('المورد')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ترحيل' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('مصروف مباشر بدون مورد محدد'));
  expect(screen.queryByLabelText('المورد')).not.toBeInTheDocument();
  expect(screen.getByLabelText('دُفعت الآن من')).toBeChecked();
  expect(screen.getByLabelText('دُفعت الآن من')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'ترحيل' }));
  expect(screen.getByText('اختر حساب الدفع الفعلي للمصروف بدون مورد محدد. المصروف الآجل يحتاج موردًا.')).toBeInTheDocument();
  expect(acc.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('مصروف مباشر بدون مورد محدد'));
  expect(screen.getByLabelText('المورد')).toBeInTheDocument();
  expect(screen.getByLabelText('دُفعت الآن من')).not.toBeDisabled();
});

test('direct supplier bill submits the payment account and cost destination together', async () => {
  (acc.post as jest.Mock).mockReset().mockImplementation((path: string) => Promise.resolve({ data: path === 'bills/duplicate-preview' ? { results: [] } : { _id: 'new-bill' } }));
  render(<MemoryRouter><BillForm /></MemoryRouter>);
  fireEvent.click(screen.getByLabelText('مصروف مباشر بدون مورد محدد'));
  fireEvent.mouseDown(screen.getByLabelText('حساب الدفع'));
  fireEvent.click(await screen.findByRole('option', { name: 'United Bank' }));
  fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'Hospitality' } });
  fireEvent.change(screen.getByLabelText('المبلغ (USD)'), { target: { value: '17' } });
  fireEvent.mouseDown(screen.getByLabelText('حساب المصروف'));
  fireEvent.click(await screen.findByRole('option', { name: 'Hospitality' }));
  fireEvent.mouseDown(screen.getByLabelText('المكتب'));
  fireEvent.click(await screen.findByRole('option', { name: 'Tripoli' }));
  fireEvent.click(screen.getByRole('button', { name: 'ترحيل' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bills', expect.objectContaining({
    withoutVendor: true, vendorId: '', paidImmediatelyFrom: 'bank',
    lines: [expect.objectContaining({ target: 'expense', accountId: 'expense', amount: 17, office: 'tripoli' })],
  })));
});
