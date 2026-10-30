import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AccountingFold from './AccountingFold';

test('cost center and ledger start closed and can be opened independently', () => {
  render(<>
    <AccountingFold title="مركز تكلفة الطلبية" summary="40.36 USD"><div>cost details</div></AccountingFold>
    <AccountingFold title="القيود المحاسبية" summary="6 قيد"><div>ledger details</div></AccountingFold>
  </>);
  const folds = screen.getAllByRole('group') as HTMLDetailsElement[];
  expect(folds[0].open).toBe(false); expect(folds[1].open).toBe(false);
  fireEvent.click(screen.getByText('مركز تكلفة الطلبية'));
  expect(folds[0].open).toBe(true); expect(folds[1].open).toBe(false);
  fireEvent.click(screen.getByText('مركز تكلفة الطلبية'));
  expect(folds[0].open).toBe(false);
  fireEvent.click(screen.getByText('القيود المحاسبية'));
  expect(folds[1].open).toBe(true);
});
