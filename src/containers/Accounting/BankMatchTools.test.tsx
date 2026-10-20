import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BankDuplicateReview, BankGroupMatch, BankIntegrityDialog, LateExpenseNotice } from './BankMatchTools';
import { acc } from './accountingApi';
jest.mock('./accountingApi', () => ({ acc: { get: jest.fn(), post: jest.fn() }, CURRENCY_DECIMALS: { USD: 2 }, errorText: () => 'تغيرت البيانات' }));
const line = { _id: 'line', amount: -10000, day: '2026-09-20', description: 'Bank rent' };
const movement = { _id: 'entry', number: 'PAY/1', amount: -10000, day: line.day, description: 'Paid office rent' };
beforeEach(() => { jest.clearAllMocks(); (acc.post as jest.Mock).mockResolvedValue({ data: { fingerprint: 'snapshot', difference: 0 } }); });
test('group approval requires matching totals, a reason and explicit review', async () => {
  const onDone = jest.fn();
  render(<BankGroupMatch lines={[line]} movements={[movement]} currency="USD" onClose={() => {}} onDone={onDone} />);
  const confirm = screen.getByRole('button', { name: 'اعتماد مطابقة المجموعة' }); expect(confirm).toBeDisabled();
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bank/group-match/preview', { lineIds: ['line'], entryIds: ['entry'] }));
  fireEvent.change(screen.getByLabelText('بيان ربط المجموعة'), { target: { value: 'إيجار فعلي ظاهر في سطر البنك' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'راجعت العمليات وأؤكد أنها نفس الدفعات' }));
  await waitFor(() => expect(confirm).toBeEnabled()); fireEvent.click(confirm);
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bank/group-match', expect.objectContaining({ fingerprint: 'snapshot', confirmReviewed: true })));
  expect(onDone).toHaveBeenCalled();
});
test('a nonzero group difference stays blocked despite confirmation', async () => {
  (acc.post as jest.Mock).mockResolvedValue({ data: { fingerprint: 'snapshot', difference: -100 } });
  render(<BankGroupMatch lines={[line]} movements={[{ ...movement, amount: -9900 }]} currency="USD" onClose={() => {}} onDone={() => {}} />);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  await waitFor(() => expect(acc.post).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('بيان ربط المجموعة'), { target: { value: 'يوجد فرق يحتاج تسجيلًا منفصلًا' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'راجعت العمليات وأؤكد أنها نفس الدفعات' }));
  expect(screen.getByRole('button', { name: 'اعتماد مطابقة المجموعة' })).toBeDisabled();
});
test('same-operation duplicate resolution selects the original and never creates an expense', async () => {
  render(<BankDuplicateReview line={line} candidates={[{ ...line, _id: 'original' }]} currency="USD" onClose={() => {}} onDone={() => {}} />);
  const button = screen.getByRole('button', { name: 'نفس العملية — استخدام السطر الأصلي' }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bank/lines/line/review-duplicate', expect.objectContaining({ action: 'same', existingLineId: 'original' })));
  expect((acc.post as jest.Mock).mock.calls.some(([p]) => p === 'bills')).toBe(false);
});
test('late expense notice requires review before linking the existing payment', async () => {
  (acc.get as jest.Mock).mockResolvedValue({ data: { currency: 'USD', entryId: 'entry', results: [line] } });
  render(<LateExpenseNotice billId="bill" />);
  fireEvent.click(await screen.findByRole('button', { name: /Bank rent/ }));
  const confirm = screen.getByRole('button', { name: 'اعتماد الربط' }); expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'راجعت البيان وأؤكد أنها نفس العملية' })); fireEvent.click(confirm);
  await waitFor(() => expect(acc.post).toHaveBeenCalledWith('bank/lines/line/match', { entryIds: ['entry'] }));
});
test('integrity review cannot automatically release a live amount discrepancy', async () => {
  (acc.get as jest.Mock).mockResolvedValue({ data: { scanned: 1, results: [{ lineId: 'line', issue: 'مبلغ القيد لا يساوي الكشف', canRelease: false, statement: -10000, ledger: -9900 }] } });
  render(<BankIntegrityDialog accountId="bank" currency="USD" onClose={() => {}} onDone={() => {}} />);
  await screen.findByText('مبلغ القيد لا يساوي الكشف');
  expect(screen.queryByRole('button', { name: 'فك الربط وإعادته للمراجعة' })).not.toBeInTheDocument();
  expect(acc.post).not.toHaveBeenCalled();
});
