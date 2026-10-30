import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocalBankReset from './LocalBankReset';
import { acc } from './accountingApi';
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, errorText: () => 'تغيرت السطور' }));
const lines = [{ _id: 'line', day: '2026-09-20', description: 'Rent test' }];
beforeEach(() => {
  jest.clearAllMocks(); (acc.get as jest.Mock).mockResolvedValue({ data: { available: true } });
  (acc.post as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: path.endsWith('/preview')
    ? { requested: 1, deletedCount: 1, canceledLines: 1, matchedLines: 0, fingerprint: 'local-snapshot', rows: lines }
    : { deleted: 1 } }));
});
test('reset requires a preview and explicit confirmation before cancellation and deletion', async () => {
  const onDone = jest.fn(); render(<LocalBankReset accountId="bank" lines={lines} onDone={onDone} />);
  fireEvent.click(await screen.findByRole('button', { name: /Local: إلغاء التجربة/ }));
  const check = await screen.findByRole('checkbox', { name: 'راجعت السطور وأوافق على إلغاء ترحيلها وحذفها من قاعدة Local' });
  const confirm = screen.getByRole('button', { name: 'إلغاء الترحيل وحذف السطور' }); expect(confirm).toBeDisabled();
  fireEvent.click(check); fireEvent.click(confirm);
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bank/local-reset', expect.objectContaining({ confirm: true, fingerprint: 'local-snapshot', lineIds: ['line'] })));
  expect(onDone).toHaveBeenCalledWith({ deleted: 1 });
});
test('a local browser with a nonlocal backend/database does not show the reset button', async () => {
  (acc.get as jest.Mock).mockResolvedValue({ data: { available: false } });
  render(<LocalBankReset accountId="bank" lines={lines} onDone={() => {}} />);
  await waitFor(() => expect(acc.get).toHaveBeenCalledWith('bank/local-reset/available'));
  expect(screen.queryByRole('button', { name: /Local:/ })).not.toBeInTheDocument();
});
test('a stale snapshot requires a fresh preview and never reports a completed deletion', async () => {
  const onDone = jest.fn();
  (acc.post as jest.Mock).mockImplementation((path: string) => path.endsWith('/preview') ? Promise.resolve({ data: {
    requested: 1, deletedCount: 1, canceledLines: 1, matchedLines: 0, fingerprint: 'local-snapshot', rows: lines,
  } }) : Promise.reject(new Error('changed')));
  render(<LocalBankReset accountId="bank" lines={lines} onDone={onDone} />);
  fireEvent.click(await screen.findByRole('button', { name: /Local:/ }));
  fireEvent.click(await screen.findByRole('checkbox', { name: /راجعت السطور وأوافق/ }));
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء الترحيل وحذف السطور' }));
  await screen.findByText('تغيرت السطور');
  expect(screen.getByRole('button', { name: 'إلغاء الترحيل وحذف السطور' })).toBeDisabled(); expect(onDone).not.toHaveBeenCalled();
});
