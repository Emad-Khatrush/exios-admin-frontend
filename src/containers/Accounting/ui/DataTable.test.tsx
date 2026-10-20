import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable } from './DataTable';

const rows = [{ id: 'a', day: '2026-09-02' }, { id: 'b', day: '2026-10-05' }, { id: 'c', day: '2026-09-20' }];
const table = (columns: any[]) => render(<DataTable rows={rows} rowKey={(r: any) => r.id} columns={columns} />);
const order = () => screen.getAllByRole('row').slice(1).map((row) => row.textContent);

test('a date column opens newest first and sorts both ways from its header', () => {
  table([{ key: 'day', header: 'التاريخ', render: (r: any) => r.day }, { key: 'id', header: 'الرمز', render: (r: any) => r.id }]);
  expect(order()).toEqual(['2026-10-05b', '2026-09-20c', '2026-09-02a']);
  fireEvent.click(screen.getByRole('button', { name: /التاريخ/ }));
  expect(order()).toEqual(['2026-09-02a', '2026-09-20c', '2026-10-05b']);
  fireEvent.click(screen.getByRole('button', { name: /التاريخ/ }));
  expect(order()).toEqual(['2026-09-02a', '2026-10-05b', '2026-09-20c']);
});

test('a table without a date column keeps the order it was given', () => {
  table([{ key: 'id', header: 'الرمز', render: (r: any) => r.id }]);
  expect(order()).toEqual(['a', 'b', 'c']);
});
