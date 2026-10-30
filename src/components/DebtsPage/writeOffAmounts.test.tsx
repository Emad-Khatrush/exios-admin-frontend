import { debtPaidAmount } from './wrapper-util';

test('written-off debt is not shown as paid, while later recoveries count as payments', () => {
  expect(debtPaidAmount({ initialAmount: 100, amount: 100 })).toBe(0);
  expect(debtPaidAmount({ initialAmount: 100, amount: 80 })).toBe(20);
  expect(debtPaidAmount({ initialAmount: 100, amount: 0, manualClosure: { writtenOffAmount: 30 } as any })).toBe(70);
  expect(debtPaidAmount({ initialAmount: 100, amount: 0, manualClosure: { writtenOffAmount: 100 } as any })).toBe(0);
});
