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

test('detail cells expose native links, preserve modified clicks and ordinary SPA navigation', () => {
  const navigate = jest.fn();
  render(<DataTable rows={[{ id: 'a' }, { id: 'summary' }]} rowKey={r => r.id}
    getRowHref={r => r.id === 'a' ? '/accounting/accounts/a?from=2026-10-27&to=2026-10-27' : undefined}
    onRowClick={navigate} columns={[{ key: 'id', header: 'ID' }]} />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '/accounting/accounts/a?from=2026-10-27&to=2026-10-27');
  expect(fireEvent.contextMenu(link)).toBe(true);
  expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
  expect(fireEvent.click(link, { metaKey: true })).toBe(true);
  expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  expect(fireEvent.click(link)).toBe(false);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith({ id: 'a' });
});

test('embedded buttons and links do not trigger row navigation', () => {
  const navigate = jest.fn(); const action = jest.fn();
  render(<DataTable rows={[{ id: 'a' }]} rowKey={r => r.id} getRowHref={() => '/accounting/accounts/a'}
    onRowClick={navigate} columns={[{ key: 'id', header: 'ID', render: () => <>
      <button onClick={action}>Action</button><a href="/other">Other</a>
    </> }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Action' }));
  fireEvent.click(screen.getByRole('link', { name: 'Other' }), { ctrlKey: true });
  expect(action).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
});
