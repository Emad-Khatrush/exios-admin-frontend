import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PurchaseMatchPicker from './PurchaseMatchPicker';
import { acc } from './accountingApi';

jest.mock('./accountingApi', () => ({ acc: { get: jest.fn() }, errorText: String }));
jest.mock('./ui', () => ({
  DataTable: () => <div>purchase results</div>,
  FilterBar: ({ children }: any) => <div>{children}</div>,
  Ltr: ({ children }: any) => <span>{children}</span>,
  Open: ({ children }: any) => <span>{children}</span>,
  Sub: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('./BankReviewComparison', () => ({ __esModule: true,
  default: ({ children, reasons = [], warnings = [] }: any) => <div>{children}{reasons.map((s: string) => <div key={s}>{s}</div>)}{warnings.map((s: string) => <div key={s}>{s}</div>)}</div>,
  ReviewField: ({ children }: any) => <span>{children}</span>,
}));
beforeEach(() => {
  jest.clearAllMocks();
  (acc.get as jest.Mock).mockResolvedValue({ data: { results: [], total: 0, pageSize: 30, original: { currency: 'USD', amount: 62.34, known: true } } });
});

const refundBill = (extra: any = {}) => ({ _id: 'bill:wrong', kind: 'bill', billId: 'wrong', number: 'BILL/2026/0072',
  day: '2026-07-29', amount: 81, currency: 'USD', source: 'direct', vendorName: 'Shipping company', orders: [],
  canMatch: true, refundableAmount: 81, refundLines: [{ _id: 'cost', target: 'expense', amount: 81 }], ...extra });
const prepare = (row: any, amount: number) => (acc.get as jest.Mock).mockResolvedValue({ data: { results: [row], total: 1, pageSize: 30,
  original: { known: true, currency: 'USD', amount } } });

test('the reported outgoing Alibaba 109.39 / shipping invoice 81 case never claims amount equality or permits refund', async () => {
  prepare(refundBill(), 109.39);
  render(<PurchaseMatchPicker embedded open refund accountId="bank" currency="TRY" paid={5227.53} suggestedBillId="wrong"
    line={{ day: '2026-08-05', amount: -5227.53, description: 'Alibaba.com (109.39 USD)', originalAmount: 109.39, originalCurrency: 'USD' }} />);
  await waitFor(() => expect(screen.getByText('BILL/2026/0072')).toBeTruthy());
  expect(screen.queryByText('المبلغ الأصلي مطابق')).toBeNull();
  expect(screen.getByText(/هذه حركة خارجة من البنك/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'موافقة واعتماد الاسترداد' }).hasAttribute('disabled')).toBe(true);
});

test('a legitimate partial refund is labelled partial and requires explicit approval', async () => {
  prepare(refundBill({ amount: 100, refundableAmount: 100, refundLines: [{ _id: 'cost', target: 'expense', amount: 100 }], merchantMatch: true }), 20);
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  render(<PurchaseMatchPicker embedded open refund accountId="bank" currency="TRY" paid={1000} suggestedBillId="wrong" onConfirm={onConfirm}
    line={{ day: '2026-08-05', amount: 1000, description: 'Alibaba refund', originalAmount: 20, originalCurrency: 'USD' }} />);
  await waitFor(() => expect(screen.getByText(/استرداد جزئي بقيمة/)).toBeTruthy());
  expect(screen.queryByText('المبلغ الأصلي مطابق')).toBeNull();
  const accept = screen.getByRole('button', { name: 'موافقة واعتماد الاسترداد' });
  expect(accept.hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'راجعت بيانات العملية والاختلافات وأؤكد أنها نفس العملية' }));
  expect(accept.hasAttribute('disabled')).toBe(false);
  fireEvent.click(accept);
  await waitFor(() => expect(onConfirm).toHaveBeenCalled());
});

test('choosing a different merchant remains blocked even when amounts are equal', async () => {
  prepare(refundBill({ merchantMismatch: true, statementVendorName: 'Alibaba' }), 81);
  render(<PurchaseMatchPicker embedded open refund accountId="bank" currency="TRY" paid={4000} suggestedBillId="wrong"
    line={{ day: '2026-08-05', amount: 4000, originalAmount: 81, originalCurrency: 'USD' }} />);
  await waitFor(() => expect(screen.getByText(/المورد المختار مختلف/)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'موافقة واعتماد الاسترداد' }).hasAttribute('disabled')).toBe(true);
});

test('closed picker renders safely without a selected statement row', () => {
  const { container } = render(<PurchaseMatchPicker open={false} currency="TRY" />);
  expect(container.innerHTML).toBe('');
  expect(acc.get).not.toHaveBeenCalled();
});

test('open picker waits for a row before reading settlement or requesting matches', () => {
  const { container } = render(<PurchaseMatchPicker open currency="TRY" line={undefined} />);
  expect(container.innerHTML).toBe('');
  expect(acc.get).not.toHaveBeenCalled();
});

test('picker can open with a refund row and close back to an undefined row', async () => {
  const { rerender, container } = render(<PurchaseMatchPicker open={false} currency="TRY" />);
  rerender(<PurchaseMatchPicker embedded open refund accountId="bank" currency="TRY" paid={3013.22}
    line={{ _id: 'row', day: '2026-08-02', description: '1688 refund', settlementUsd: 62.34 }} />);
  await waitFor(() => expect(acc.get).toHaveBeenCalledWith('bank/refunds', expect.objectContaining({ lineId: 'row' })));
  expect(screen.getByText('purchase results')).toBeTruthy();
  rerender(<PurchaseMatchPicker open={false} currency="TRY" line={undefined} />);
  expect(container.innerHTML).toBe('');
});
