import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
  default: ({ children }: any) => <div>{children}</div>,
  ReviewField: ({ children }: any) => <span>{children}</span>,
}));
beforeEach(() => {
  jest.clearAllMocks();
  (acc.get as jest.Mock).mockResolvedValue({ data: { results: [], total: 0, pageSize: 30, original: { currency: 'USD', amount: 62.34, known: true } } });
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
