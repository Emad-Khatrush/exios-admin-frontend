import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuickExpenses from './QuickExpenses';
import BillForm from './BillForm';
import AccountingSettings from './AccountingSettings';
import { VendorStatement } from './Vendors';
import { acc } from './accountingApi';

jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn(), patch: jest.fn() }, OFFICE_LABELS: {}, newKey: () => 'expense-request', errorText: () => 'راجع المصروف الموجود' }));
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
  currencies: [{ code: 'USD', name: 'Dollar', isActive: true }, { code: 'LYD', name: 'Dinar', isActive: true }],
  reload: jest.fn().mockResolvedValue(undefined),
}) }));
jest.mock('./ui', () => ({ Panel: ({ title, children }: any) => <section><div>{title}</div>{children}</section>,
  StatGrid: ({ children }: any) => <div>{children}</div>, Stat: ({ label }: any) => <span>{label}</span>,
  PageHeader: () => null, DataTable: ({ rows, columns }: any) => <>{(rows || []).map((row: any, index: number) => <div key={index} data-testid={`row-${row._id || row.currency || index}`}>{columns?.find((column: any) => column.key === 'number')?.render(row)}{columns?.find((column: any) => column.key === 'apply')?.render(row)}</div>)}</>, Amount: () => null, Ltr: ({ children }: any) => <span>{children}</span>, Money: () => null, Badge: ({ children }: any) => <span>{children}</span>, StatusBadge: () => null, Sub: () => null }));

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

test('historical bill edits preview currency and unpaid choice before a separate confirmation', async () => {
  const bill = { _id: 'historical-bill', number: 'BILL/2026/67', vendorId: 'supplier', currency: 'USD', day: '2026-07-18',
    status: 'posted', isHistorical: true, paymentId: 'assumed-payment', updatedAt: '2026-10-31T09:00:00Z',
    lines: [{ _id: 'line', target: 'expense', accountId: 'expense', office: 'tripoli', description: 'Customs', amount: 100 }] };
  (acc.get as jest.Mock).mockResolvedValue({ data: { bill, trips: [], orders: [] } });
  (acc.post as jest.Mock).mockReset().mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('/edit-preview')
    ? { oldTotal: 100, newTotal: 1200, oldCurrency: 'USD', newCurrency: 'LYD', newOpen: 12000, settledUsd: 10000,
      remainingSettlementUsd: 0, removedSettlementUsd: 10000, historicalPayment: 'unpaid',
      settlementCounterpart: 'Opening balances', settlementFromOpening: true, settlementCorrectionDay: '2026-10-31',
      fingerprint: 'review-historical', duplicates: { results: [] } }
    : {} }));
  render(<MemoryRouter initialEntries={['/bill/historical-bill']}><Routes><Route path="/bill/:id" element={<BillForm />} /></Routes></MemoryRouter>);
  await screen.findByLabelText('معالجة السداد التاريخي');
  fireEvent.mouseDown(screen.getByLabelText('معالجة السداد التاريخي'));
  fireEvent.click(await screen.findByRole('option', { name: 'لم تُدفع فعليًا — إظهار المستحق للمورد' }));
  fireEvent.mouseDown(screen.getByLabelText('العملة'));
  fireEvent.click(await screen.findByRole('option', { name: 'LYD · Dinar' }));
  fireEvent.change(screen.getByLabelText('المبلغ (LYD)'), { target: { value: '1200' } });
  fireEvent.change(screen.getByLabelText('السعر (LYD لكل دولار)'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText(/سبب التعديل/), { target: { value: 'Correct the historical assumption' } });
  fireEvent.click(screen.getByRole('button', { name: 'معاينة التعديل' }));
  await screen.findByRole('dialog');
  expect(acc.post).toHaveBeenCalledWith('bills/historical-bill/edit-preview', expect.objectContaining({ historicalPayment: 'unpaid', currency: 'LYD', rate: 10 }));
  expect(acc.post).toHaveBeenCalledTimes(1);
  expect(screen.getByText('الحساب المقابل لتصحيح السداد')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'اعتماد التعديل' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bills/historical-bill/edit-posted', expect.objectContaining({ historicalPayment: 'unpaid', currency: 'LYD', fingerprint: 'review-historical' })));
});

test('opening valuation settings offer a weighted window and read-only preview before saving', async () => {
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path === 'settings'
    ? { settings: { openingCashRateMethod: 'legacy', migrationDate: '2026-10-31' } }
    : path === 'settings/opening-cash-valuation-preview' ? { day: '2026-10-30', readOnly: true, results: [] } : { results: [] } }));
  (acc.patch as jest.Mock).mockResolvedValue({ data: { success: true } });
  render(<MemoryRouter><AccountingSettings /></MemoryRouter>);
  await screen.findByLabelText('مدة متوسط تقييم افتتاح الخزائن التاريخي');
  fireEvent.mouseDown(screen.getByLabelText('مدة متوسط تقييم افتتاح الخزائن التاريخي'));
  expect(await screen.findByRole('option', { name: 'آخر شهرين' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'آخر سنة' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'كامل الفترة' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'آخر شهر' }));
  fireEvent.click(screen.getByRole('button', { name: 'معاينة تقييم الافتتاحي' }));
  await screen.findByRole('dialog');
  expect(acc.get).toHaveBeenCalledWith('settings/opening-cash-valuation-preview', { method: 'receipts_1m' });
  expect(acc.patch).not.toHaveBeenCalled();
  expect(acc.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
  await waitFor(() => expect(acc.patch).toHaveBeenCalledWith('settings', expect.objectContaining({ openingCashRateMethod: 'receipts_1m' })));
});

test('current cash valuation requires a reviewed account and reason before applying once', async () => {
  const row = { accountId: 'cash', code: '110102', name: 'Tripoli LYD', amount: 10000, currency: 'LYD', currentRate: 9,
    currentUsd: 111111, proposedUsd: 100000, differenceUsd: -11111, fingerprint: 'review-current', canApply: true,
    valuation: { rate: 10, sampleCount: 3, source: 'receipts' }, counterpart: { code: '710400', name: 'Valuation loss' } };
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path === 'settings'
    ? { settings: { openingCashRateMethod: 'receipts_1m' } }
    : path === 'settings/current-cash-valuation-preview' ? { scope: 'current', method: 'receipts_1m', day: '2026-10-31', results: [row] } : { results: [] } }));
  (acc.post as jest.Mock).mockReset().mockResolvedValue({ data: { number: 'JV/current', entryId: 'new-entry' } });
  render(<MemoryRouter><AccountingSettings /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'معالجة الخزائن الحالية' }));
  fireEvent.click(await screen.findByRole('button', { name: 'تطبيق المتوسط' }));
  const apply = await screen.findByRole('button', { name: 'اعتماد وتطبيق المتوسط' });
  expect(apply).toBeDisabled();
  expect(acc.post).not.toHaveBeenCalled();
  expect(screen.getByText('الرصيد بالعملة — يبقى كما هو')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/سبب معالجة تقييم الخزينة/), { target: { value: 'Review the current cash basis' } });
  fireEvent.click(apply);
  fireEvent.click(apply);
  await waitFor(() => expect(acc.post).toHaveBeenCalledTimes(1));
  expect(acc.post).toHaveBeenCalledWith('settings/current-cash-valuation-apply', {
    accountId: 'cash', method: 'receipts_1m', fingerprint: 'review-current', reason: 'Review the current cash basis', idempotencyKey: 'expense-request',
  });
});

test('supplier native report filters document currencies and includes canceled documents only on request', async () => {
  const invoice = { _id: 'invoice-cny', number: 'BILL/CNY', currency: 'CNY', status: 'posted', day: '2026-10-01', total: 700, openEquivalent: 420, openUsd: 6000 };
  const canceled = { ...invoice, _id: 'invoice-canceled', number: 'BILL/CANCELED', status: 'canceled', openEquivalent: null };
  const settlement = { _id: 'payment-usd', number: 'PAY/USD', day: '2026-10-02', currency: 'USD', amount: 40, kind: 'payment', status: 'posted' };
  (acc.get as jest.Mock).mockImplementation((path: string, params?: any) => Promise.resolve({ data: {
    vendor: { _id: 'supplier', name: 'Supplier', type: 'supplier' }, openBills: [], owed: 6000, advance: 0, movements: [],
    currencyReport: { totals: [], currencies: ['CNY', 'USD'], invoices: params?.showCanceled ? [invoice, canceled] : [invoice], settlements: [settlement] },
  } }));
  render(<MemoryRouter initialEntries={['/vendor/supplier']}><Routes><Route path="/vendor/:id" element={<VendorStatement />} /></Routes></MemoryRouter>);
  expect(await screen.findByTestId('row-invoice-cny')).toBeInTheDocument();
  expect(screen.getByTestId('row-payment-usd')).toBeInTheDocument();
  expect(screen.queryByTestId('row-invoice-canceled')).not.toBeInTheDocument();
  expect(screen.getByLabelText('إظهار الملغى')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('إظهار الملغى'));
  expect(await screen.findByTestId('row-invoice-canceled')).toBeInTheDocument();
  expect(screen.getByText('ملغاة')).toBeInTheDocument();
  expect(acc.get).toHaveBeenLastCalledWith('vendors/supplier/statement', { showCanceled: 'true' });
  fireEvent.mouseDown(screen.getByLabelText('عملة التقرير'));
  fireEvent.click(await screen.findByRole('option', { name: 'USD' }));
  expect(screen.queryByTestId('row-invoice-cny')).not.toBeInTheDocument();
  expect(screen.queryByTestId('row-invoice-canceled')).not.toBeInTheDocument();
  expect(screen.getByTestId('row-payment-usd')).toBeInTheDocument();
});
