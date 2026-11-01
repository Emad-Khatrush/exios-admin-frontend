import { statementPeriod, statementSnapshot, statementKind, statementText } from './statementReport';

const rows = [
  { _id: '1', createdAt: '2026-10-01T12:00:00Z', calculationType: '+', amount: 100, total: 125, actionType: 'cash' },
  { _id: '2', createdAt: '2026-10-02T12:00:00Z', calculationType: '-', amount: 40, total: 85 },
  { _id: '3', createdAt: '2026-10-03T12:00:00Z', calculationType: '+', amount: 10, total: 95, actionType: 'refund' },
];
test('period balances include the balance carried from earlier movements, and an empty later period retains it', () => {
  expect(statementPeriod(rows, '2026-10-02', '2026-10-03')).toMatchObject({ opening: 125, closing: 95, incoming: 10, outgoing: 40 });
  expect(statementPeriod(rows, '2026-10-04', '2026-10-05')).toMatchObject({ rows: [], opening: 95, closing: 95 });
  expect(statementPeriod(rows, '', '2026-09-30')).toMatchObject({ rows: [], opening: 25, closing: 25 });
});
test('last fifteen export carries its own true opening and separates refunds from cash received', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ createdAt: '2026-10-01', amount: 10, calculationType: '+', total: 35 + index * 10 }));
  expect(statementSnapshot(many.slice(-15))).toMatchObject({ opening: 75, closing: 225, incoming: 150 });
  expect(statementPeriod(rows).summary).toMatchObject({ cashIn: 100, credit: 10, spent: 40 });
});
test('legacy purchase notes and internal exchange keep their real type and exported markup becomes safe text', () => {
  expect(statementKind({ calculationType: '-', note: 'Order #1234-5678' })).toBe('purchase');
  expect(statementKind({ calculationType: '-', actionType: 'withdrawal' })).toBe('withdrawal');
  expect(statementKind({ calculationType: '+', actionType: 'exchange' })).toBe('exchange');
  expect(statementText('<b>فاتورة</b><br/>Order &amp; shipping<script>bad()</script>')).toBe('فاتورة\nOrder & shipping');
});
