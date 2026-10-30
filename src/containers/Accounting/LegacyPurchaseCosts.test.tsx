import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import LegacyPurchaseCosts from './LegacyPurchaseCosts';
import { acc, sys } from './accountingApi';
jest.mock('./useAccountingAccess', () => ({ useAccountingAccess: () => ({ can: () => true }) }));
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, sys: { get: jest.fn() }, newKey: () => 'legacy_ui_test_key_123456', todayLibya: () => '2026-10-28', errorText: () => 'Request failed' }));
const item = { _id: 'item1', description: '1688 purchase', currency: 'USD', unitPrice: 100, date: '2026-10-08', fingerprint: 'snapshot1', candidates: [], linkedBills: [] };
const load = (row: any = item) => (acc.get as jest.Mock).mockResolvedValue({ data: { orderNumber: 'ORDER1', results: [row] } });
beforeEach(() => {
  load(); (sys.get as jest.Mock).mockResolvedValue({ data: { vendors: [], accounts: [] } });
  (acc.post as jest.Mock).mockResolvedValue({ data: { bill: { number: 'BILL1' } } });
});
const view = () => render(<MemoryRouter><LegacyPurchaseCosts orderId="order1" fallbackRows={[item]} onSaved={() => {}} /></MemoryRouter>);

test('new adoption is confirmed and deferred by default, using the source snapshot rather than editable amounts', async () => {
  view();
  const open = await screen.findByRole('button', { name: 'اعتماد كتكلفة' });
  await waitFor(() => expect(open).toBeEnabled()); fireEvent.click(open);
  const dialog = screen.getByRole('dialog');
  await waitFor(() => expect(sys.get).toHaveBeenCalledWith('acc/options'));
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: '1688 Shop' } });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /راجعت البند/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'اعتماد كتكلفة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('orders/order1/legacy-purchases/item1/approve', expect.objectContaining({
    mode: 'create', fingerprint: 'snapshot1', day: '2026-10-08', vendorName: '1688 Shop', confirmNewCost: true,
    payFromAccountId: undefined, confirmNewPayment: false,
  })));
});

test('already adopted items offer their original invoice rather than another approval', async () => {
  load({ ...item, linkedBills: [{ _id: 'bill1', number: 'BILL1', status: 'posted' }] }); view();
  expect(await screen.findByRole('link', { name: /BILL1/ })).toHaveAttribute('href', '/accounting/bills/bill1');
  expect(screen.queryByRole('button', { name: 'اعتماد كتكلفة' })).not.toBeInTheDocument();
});

test('an existing invoice candidate defaults to linking and creates no new payment request', async () => {
  load({ ...item, candidates: [{ billId: 'bill1', lineId: 'line1', number: 'BILL1', day: '2026-10-08', description: 'Original purchase' }] }); view();
  const open = await screen.findByRole('button', { name: 'اعتماد كتكلفة' }); await waitFor(() => expect(open).toBeEnabled()); fireEvent.click(open);
  const dialog = screen.getByRole('dialog');
  fireEvent.mouseDown(within(dialog).getByLabelText('الفاتورة والسطر المطابقان'));
  fireEvent.click(screen.getByRole('option', { name: /BILL1/ }));
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /راجعت أن الفاتورة/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'ربط دون تكرار التكلفة' }));
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('orders/order1/legacy-purchases/item1/approve', expect.objectContaining({ mode: 'link', billId: 'bill1', lineId: 'line1' })));
});
