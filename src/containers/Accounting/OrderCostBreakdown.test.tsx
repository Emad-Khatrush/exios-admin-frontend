import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OrderCostBreakdown from './OrderCostBreakdown';
jest.mock('./ui', () => ({
  Panel: ({ children, title }: any) => <section><h2>{title}</h2>{children}</section>,
  StatGrid: ({ children }: any) => <div>{children}</div>,
  Stat: ({ label, value }: any) => <div>{label}{value}</div>,
  Money: ({ value }: any) => <span>{(Number(value) / 100).toFixed(2)}</span>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Ltr: ({ children }: any) => <span>{children}</span>,
  Open: ({ children, to }: any) => <a href={to}>{children}</a>,
  Sub: ({ children }: any) => <div>{children}</div>,
  DataTable: ({ rows, columns }: any) => <div>{rows.map((row: any) => <div key={row.entryId || row._id}>{columns.map((column: any) => <div key={column.key}>{column.render(row)}</div>)}</div>)}</div>,
}));
test('waits safely for the order cost report', () => {
  expect(render(<OrderCostBreakdown data={undefined} />).container.innerHTML).toBe('');
});
test('shows cost sources and opens actual account and refund valuation details', () => {
  const data = { increases: 10270, decreases: 6234, total: 4036, recognizedCost: 4036, inProgress: 0, rows: [
    { entryId: 'bill', number: 'PURCH/1', kind: 'bill', day: '2026-08-01', impact: 10270, runningCost: 10270 },
    { entryId: 'refund', number: 'RF/1', kind: 'refund', day: '2026-08-02', impact: -6051, runningCost: 4219 },
    { entryId: 'adjustment', number: 'JV/1', kind: 'refund_valuation', day: '2026-08-02', impact: -183, runningCost: 4036,
      document: { number: 'RF/1', currency: 'TRY', amount: 3013.22, valuationUsd: 6234, beforeBankUsd: 6051, walletUsd: 6200 },
      lines: [{ _id: 'line', account: { code: '130200', name: 'Purchase cost' }, debit: 0, credit: 183, affectsCost: true }], notes: [] },
  ] };
  render(<OrderCostBreakdown data={data} />);
  expect(screen.getAllByText('40.36').length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole('button', { name: 'الحسابات والمستند' })[2]);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('62.00')).toBeTruthy();
  expect(dialog.getByText('62.34')).toBeTruthy();
  expect(dialog.getByText('60.51')).toBeTruthy();
  expect(dialog.getByText('يدخل في حساب تكلفة الطلبية')).toBeTruthy();
});
