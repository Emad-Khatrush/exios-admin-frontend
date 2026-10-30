import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import HistoricalCash from './HistoricalCash';
import { acc } from './accountingApi';
import api from '../../api';
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, newKey: () => `history-${Math.random().toString(36).slice(2)}-request`, errorText: (e: any) => e?.response?.data?.message || 'Request failed' }));
jest.mock('./useAccountingAccess', () => ({ useAccountingAccess: () => ({ can: () => true }) }));
jest.mock('../../api', () => ({ __esModule: true, default: { fetchFormData: jest.fn() }, base: { axios: { get: jest.fn() } } }));
const options = { offices: [{ code: 'tripoli', name: 'طرابلس' }], accounts: [{ _id: 'bank1', name: 'Tripoli USD', office: 'tripoli', currency: 'USD' }], categories: { customer_receipt: { label: 'مقبوضات العملاء' }, unknown: { label: 'بانتظار التصنيف' } } };
beforeEach(() => { jest.clearAllMocks(); });
test('report keeps currencies separate and exposes historical entry without labelling cash surplus profit', async () => {
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('options') ? options : { count: 0, batches: [], groups: [{ month: '2026-01', office: 'tripoli', currency: 'USD', decimals: 2, category: 'customer_receipt', incoming: 10000, outgoing: 0, drafts: 1, count: 1 }, { month: '2026-01', office: 'tripoli', currency: 'LYD', decimals: 3, category: 'operating', incoming: 0, outgoing: 9000, drafts: 1, count: 1 }] } }));
  render(<MemoryRouter><HistoricalCash /></MemoryRouter>);
  await screen.findAllByText('مبدئي: 1 سطر غير معتمد');
  expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
  expect(screen.getAllByText('LYD').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'كشف جديد / استيراد Excel' }));
  expect(await screen.findByRole('button', { name: 'تحميل قالب Excel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'حفظ المسودة' })).toBeDisabled();
});
test('unsaved edits cannot approve the previously saved draft', async () => {
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('options') ? options : { _id: 'batch1', title: 'Saved draft', office: 'tripoli', accountId: 'bank1', from: '2026-01-01', to: '2026-01-31', openingMinor: 0, closingMinor: 10000, currency: 'USD', decimals: 2, requestKey: 'history-request-123456', revision: 1, status: 'draft', rows: [{ day: '2026-01-05', description: 'Receipt', direction: 'in', amountMinor: 10000, category: 'customer_receipt' }] } }));
  render(<MemoryRouter initialEntries={['/?batch=batch1']}><HistoricalCash /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'اعتماد الكشف' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('اسم الكشف'), { target: { value: 'Unsaved changes' } });
  expect(screen.getByRole('button', { name: 'اعتماد الكشف' })).toBeDisabled();
});

test('editing a date-sorted table row changes the selected movement rather than its original array position', async () => {
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('options') ? options : { _id: 'batch1', title: 'Two movements', office: 'tripoli', accountId: 'bank1', from: '2026-01-01', to: '2026-01-31', openingMinor: 0, closingMinor: 20000, currency: 'USD', decimals: 2, requestKey: 'history-request-123456', revision: 1, status: 'draft', rows: [
    { day: '2026-01-05', description: 'Earlier receipt', direction: 'in', amountMinor: 10000, category: 'customer_receipt' },
    { day: '2026-01-10', description: 'Later receipt', direction: 'in', amountMinor: 10000, category: 'customer_receipt' },
  ] } }));
  render(<MemoryRouter initialEntries={['/?batch=batch1']}><HistoricalCash /></MemoryRouter>);
  await screen.findByText('Later receipt');
  fireEvent.click(screen.getAllByRole('button', { name: 'تعديل' })[0]);
  expect(screen.getByLabelText('البيان')).toHaveValue('Later receipt');
});

test('existing full draft switches to wallet-only review without inventing balances and requires saving the change before approval', async () => {
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('options') ? options : { _id: 'batch1', title: 'Wallet history', office: 'tripoli', accountId: 'bank1', from: '2026-01-01', to: '2026-04-03', openingMinor: 138900, closingMinor: 211400, currency: 'USD', decimals: 2, requestKey: 'history-request-123456', revision: 1, status: 'draft', rows: [{ day: '2026-01-05', description: 'Old customer deposit', direction: 'in', amountMinor: 10000, category: 'customer_receipt' }] } }));
  (api.fetchFormData as jest.Mock).mockResolvedValue({ scope: 'wallets', errors: 0, reconciliation: null, inflow: 10000, outflow: 0, currency: 'USD', decimals: 2, rows: [] });
  render(<MemoryRouter initialEntries={['/?batch=batch1']}><HistoricalCash /></MemoryRouter>);
  await screen.findByLabelText('رصيد بداية الكشف (USD)');
  fireEvent.mouseDown(screen.getByLabelText('نوع الكشف'));
  fireEvent.click(await screen.findByRole('option', { name: 'حركات محافظ تاريخية فقط' }));
  expect(screen.queryByLabelText('رصيد بداية الكشف (USD)')).not.toBeInTheDocument();
  expect(screen.getByText(/رصيدا الخزينة السابقان محفوظان كمرجع فقط/)).toHaveTextContent('1389');
  expect(screen.getByRole('button', { name: 'اعتماد الكشف' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'معاينة الأخطاء والتكرارات' }));
  await waitFor(() => expect(api.fetchFormData).toHaveBeenCalled());
  const formData = (api.fetchFormData as jest.Mock).mock.calls[0][2] as FormData;
  expect(JSON.parse(formData.get('payload') as string)).toMatchObject({ scope: 'wallets', opening: '1389', closing: '2114' });
  expect(await screen.findByText(/مراجعة حركات محافظ فقط؛ لا تُجرى مطابقة رصيد الخزينة/)).toBeInTheDocument();
  expect(screen.queryByText(/أدخل رصيدي البداية والنهاية للاعتماد/)).not.toBeInTheDocument();
});

test('normal source opens its original record and links the existing historical movement without creating another payment', async () => {
  const source = { key: 'JE:entry1:bank1', fingerprint: 'current-original-snapshot', day: '2026-01-05',
    sourceModel: 'JournalEntry', number: 'JV/2026/001', description: 'Normal office payment', cash: true, contributes: true,
    amountMinor: 10000, direction: 'in', currency: 'USD', decimals: 2, category: 'customer_receipt', state: 'pending',
    url: '/accounting/entries/entry1', candidates: [{ batchId: 'batch1', rowId: 'row1', title: 'Old statement', description: 'Same receipt' }] };
  (acc.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('options') ? options : { count: 0, batches: [], groups: [], sources: { rows: [source], total: 1, pending: 1 } } }));
  (acc.post as jest.Mock).mockResolvedValue({ data: { success: true } });
  render(<MemoryRouter><HistoricalCash /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /JV\/2026\/001/ })).toHaveAttribute('href', '/accounting/entries/entry1');
  fireEvent.click(screen.getByRole('button', { name: 'مراجعة / ربط' }));
  fireEvent.change(screen.getByLabelText('ملاحظة المراجعة'), { target: { value: 'Verified this is the same historical receipt' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المراجعة والربط' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('historical-cash/source-review', expect.objectContaining({
    key: source.key, fingerprint: source.fingerprint, state: 'linked', batchId: 'batch1', rowId: 'row1',
    note: 'Verified this is the same historical receipt', query: expect.objectContaining({ mode: 'combined' }),
  })));
});
