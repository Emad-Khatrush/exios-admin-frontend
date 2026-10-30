import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { base } from '../../api';
import XTrackingDashboard from './XTrackingDashboard';

jest.mock('../../api', () => ({ base: { axios: { get: jest.fn() } } }));
const get = base.axios.get as jest.Mock;
const observers: { callback: (entries: any[]) => void; disconnect: jest.Mock }[] = [];
const order = (id: string, fields = {}) => ({ _id: id, orderId: id, isPayment: true, isShipment: false,
  customerInfo: { fullName: 'Example customer' }, createdAt: '2026-10-01', lastActivityAt: '2026-10-01',
  orderStatus: 0, billedCents: 10000, purchaseCents: 10000, openCents: 10000, paymentState: 'unpaid',
  packages: [], packageCount: 0, ...fields });
const rows = (orders: any[], total = orders.length) => ({ data: { orders, total } });
const counts = { data: { counts: { all: 4, purchase: 2, waitingPurchase: 1 }, paymentCounts: { all: 2, paid: 1, unpaid: 1 } } };
const show = () => render(<MemoryRouter><XTrackingDashboard /></MemoryRouter>);
const listCalls = () => get.mock.calls.filter(([, config]) => !config.params.countsOnly);
const nearBottom = () => act(() => { const observer = observers[observers.length - 1]; observer.callback([{ isIntersecting: true }]); });
beforeEach(() => {
  get.mockReset(); observers.length = 0;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(query => ({ matches: false, media: query,
    addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: class {
    disconnect = jest.fn(); observe = jest.fn(); unobserve = jest.fn();
    constructor(callback: (entries: any[]) => void) { observers.push({ callback, disconnect: this.disconnect }); }
  } });
  get.mockImplementation((_url, config) => Promise.resolve(config.params.countsOnly ? counts : rows([order('ONE')])));
});

test('purchase-only cards hide package sections, shipping amounts and customer tracking', async () => {
  get.mockImplementation((_url, config) => Promise.resolve(config.params.countsOnly ? counts : rows([order('ONE', { packageCount: 1,
    packages: [{ _id: 'p1', trackingNumber: 'TRACK', chargeCents: 3000 }] })])));
  show(); const card = await screen.findByRole('article', { name: 'طلبية ONE' });
  expect(within(card).queryByText('الشحن والرسوم')).not.toBeInTheDocument();
  expect(within(card).queryByRole('region', { name: 'الشحنات المرتبطة' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /تتبع العميل/ })).not.toBeInTheDocument();
  expect(within(card).getByText('فاتورة الشراء')).toBeInTheDocument();
});

test('modern search selector contains only the two supported modes and preserves trimmed search text', async () => {
  show(); await screen.findByRole('article');
  fireEvent.mouseDown(screen.getByRole('button', { name: /البحث بواسطة/ }));
  expect(screen.getAllByRole('option')).toHaveLength(2);
  fireEvent.click(screen.getByRole('option', { name: 'Tracking Number' }));
  fireEvent.change(screen.getByLabelText('رقم تتبع الشحنة'), { target: { value: '  tr[123]  ' } });
  await waitFor(() => expect(listCalls().slice(-1)[0][1].params).toMatchObject({ searchType: 'trackingNumber', search: 'tr[123]', skip: 0 }));
});

test('payment selection keeps the chosen category, including the former Unpaid category', async () => {
  show(); await screen.findByRole('article');
  const categories = within(screen.getByRole('group', { name: 'فئات الطلبيات' }));
  fireEvent.click(categories.getByText('شراء'));
  fireEvent.click(within(screen.getByRole('group', { name: 'حالة السداد' })).getByText('غير مدفوعة'));
  await waitFor(() => expect(listCalls().slice(-1)[0][1].params).toMatchObject({ stage: 'purchase', payment: 'unpaid', skip: 0 }));
  fireEvent.click(categories.getByText('شراء بانتظار الدفع'));
  await waitFor(() => expect(listCalls().slice(-1)[0][1].params).toMatchObject({ stage: 'waitingPurchase', payment: 'unpaid' }));
});

test('approaching the bottom loads once and merges duplicate IDs without replacing prior orders', async () => {
  get.mockImplementation((_url, config) => Promise.resolve(config.params.countsOnly ? counts : config.params.skip === 0
    ? rows([order('ONE'), order('TWO')], 4) : rows([order('TWO'), order('THREE'), order('FOUR')], 4)));
  show(); await screen.findByRole('article', { name: 'طلبية TWO' });
  nearBottom(); nearBottom();
  await screen.findByRole('article', { name: 'طلبية FOUR' });
  expect(screen.getAllByRole('article')).toHaveLength(4);
  expect(listCalls()).toHaveLength(2);
  expect(listCalls()[1][1].params.skip).toBe(2);
  expect(screen.getByRole('article', { name: 'طلبية ONE' })).toBeInTheDocument();
});

test('a late response from an old search cannot overwrite a newer result', async () => {
  let oldResolve: (value: any) => void = () => undefined;
  get.mockImplementation((_url, config) => config.params.countsOnly ? Promise.resolve(counts) : config.params.search === 'new'
    ? Promise.resolve(rows([order('NEW')])) : new Promise(resolve => { oldResolve = resolve; }));
  show(); fireEvent.change(screen.getByLabelText('رقم الطلبية أو اسم العميل أو كوده'), { target: { value: 'new' } });
  await screen.findByRole('article', { name: 'طلبية NEW' });
  await act(async () => { oldResolve(rows([order('OLD')])); });
  expect(screen.queryByRole('article', { name: 'طلبية OLD' })).not.toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'طلبية NEW' })).toBeInTheDocument();
});

test('next-page failure retains current rows and can be retried', async () => {
  let fail = true;
  get.mockImplementation((_url, config) => {
    if (config.params.countsOnly) return Promise.resolve(counts);
    if (!config.params.skip) return Promise.resolve(rows([order('ONE')], 2));
    if (fail) { fail = false; return Promise.reject(new Error('network')); }
    return Promise.resolve(rows([order('TWO')], 2));
  });
  show(); await screen.findByRole('article'); nearBottom();
  await screen.findByRole('alert');
  expect(screen.getByRole('article', { name: 'طلبية ONE' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  await screen.findByRole('article', { name: 'طلبية TWO' });
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

test('switching category aborts and ignores an in-flight next page', async () => {
  let oldResolve: (value: any) => void = () => undefined;
  get.mockImplementation((_url, config) => {
    if (config.params.countsOnly) return Promise.resolve(counts);
    if (config.params.stage === 'shipping') return Promise.resolve(rows([order('SHIPPING', { isPayment: false, isShipment: true })]));
    if (config.params.skip) return new Promise(resolve => { oldResolve = resolve; });
    return Promise.resolve(rows([order('ONE')], 2));
  });
  show(); await screen.findByRole('article'); nearBottom();
  fireEvent.click(within(screen.getByRole('group', { name: 'فئات الطلبيات' })).getByText('شحن'));
  await screen.findByRole('article', { name: 'طلبية SHIPPING' });
  await act(async () => { oldResolve(rows([order('OLD-NEXT')], 2)); });
  expect(screen.queryByRole('article', { name: 'طلبية OLD-NEXT' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

test('combined orders retain shipping amounts and show three packages until expanded', async () => {
  const packages = Array.from({ length: 4 }, (_, i) => ({ _id: `p${i}`, trackingNumber: `TRACK-${i}`, chargeCents: 1000, received: false }));
  get.mockImplementation((url, config) => Promise.resolve(url.endsWith('/packages') ? { data: { packages } } : config.params.countsOnly ? counts : rows([
    order('COMBINED', { isShipment: true, packageCount: 4, packages: packages.slice(0, 3), billedCents: 14000 }),
  ])));
  show(); const card = await screen.findByRole('article', { name: 'طلبية COMBINED' });
  expect(within(card).getByText('الشحن والرسوم')).toBeInTheDocument();
  expect(within(card).queryByText('TRACK-3')).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: /عرض 1 شحنات إضافية/ }));
  await within(card).findByText('TRACK-3');
  fireEvent.click(within(card).getByRole('button', { name: 'إخفاء الشحنات الإضافية' }));
  expect(within(card).queryByText('TRACK-3')).not.toBeInTheDocument();
});

test('switching search mode during typing uses the current text immediately without a duplicate request', async () => {
  show(); await screen.findByRole('article');
  fireEvent.change(screen.getByLabelText('رقم الطلبية أو اسم العميل أو كوده'), { target: { value: '  T388  ' } });
  fireEvent.mouseDown(screen.getByRole('button', { name: /البحث بواسطة/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Tracking Number' }));
  await waitFor(() => expect(listCalls().slice(-1)[0][1].params).toMatchObject({ searchType: 'trackingNumber', search: 'T388', skip: 0 }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  expect(listCalls().filter(([, config]) => config.params.search === 'T388')).toHaveLength(1);
});

test('selector trigger shows only its label and closing an unchanged option does not refetch', async () => {
  show(); await screen.findByRole('article');
  const trigger = screen.getByRole('button', { name: /البحث بواسطة/ });
  expect(trigger.textContent).toBe('Exios Id');
  expect(trigger.querySelector('svg')).toBeNull();
  fireEvent.mouseDown(trigger);
  fireEvent.click(screen.getByRole('option', { name: 'Exios Id' }));
  expect(listCalls()).toHaveLength(1);
});

test('customer identity isolates an English name and links the code to the correct profile', async () => {
  get.mockImplementation((_url, config) => Promise.resolve(config.params.countsOnly ? counts : rows([order('PROFILE', {
    customerInfo: { fullName: 'Jane Austen', phone: '0912345678' },
    user: { _id: 'customer-mongo-id', customerId: 'T999' }, placedAt: 'tripoli', shipment: { fromWhere: 'CN', toWhere: 'LY' },
  })])));
  show(); const card = await screen.findByRole('article');
  expect(within(card).getByText('Jane Austen').tagName).toBe('BDI');
  expect(within(card).getByText('Jane Austen')).toHaveAttribute('dir', 'auto');
  expect(within(card).getByRole('link', { name: 'فتح صفحة العميل T999' })).toHaveAttribute('href', '/user/customer-mongo-id');
  expect(within(card).getByText('طرابلس')).toBeInTheDocument();
  expect(within(card).queryByText('tripoli')).not.toBeInTheDocument();
  expect(within(card).getByText('الصين ← ليبيا')).toBeInTheDocument();
});

test('first rows render without waiting for category counts and request only ten orders', async () => {
  get.mockImplementation((_url, config) => config.params.countsOnly ? new Promise(() => {}) : Promise.resolve({ data: { orders: [order('FIRST')], total: null, hasMore: true } }));
  show(); await screen.findByRole('article', { name: 'طلبية FIRST' });
  expect(screen.getByText('1 طلبيات محمّلة')).toBeInTheDocument();
  expect(listCalls()[0][1].params).toMatchObject({ limit: 10, quick: true });
  expect(screen.getByRole('button', { name: 'تحميل المزيد' })).toBeInTheDocument();
});

test('the exact total arriving later does not replace already loaded rows', async () => {
  get.mockImplementation((_url, config) => Promise.resolve(config.params.countsOnly ? counts : { data: { orders: [order('FIRST')], total: null, hasMore: true } }));
  show(); await screen.findByRole('article', { name: 'طلبية FIRST' });
  await screen.findByText('1 من 4 طلبية');
  expect(screen.getByRole('article', { name: 'طلبية FIRST' })).toBeInTheDocument();
});
