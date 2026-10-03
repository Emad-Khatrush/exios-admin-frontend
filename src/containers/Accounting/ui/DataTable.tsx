import { ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react';

export type Column<T> = {
  key: string;
  header: ReactNode;
  // start = the reading side (right in Arabic); numbers sit on the end side
  align?: 'start' | 'end' | 'center';
  numeric?: boolean;
  width?: number | string;
  render?: (row: T, index: number) => ReactNode;
  // Enables sorting on this column
  sortValue?: (row: T) => number | string;
  // Hidden on narrow screens to keep the key columns readable
  hideOnMobile?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: { title: string; hint?: string; action?: ReactNode };
  // Cells for a totals row, by column key
  footer?: Record<string, ReactNode>;
  rowTone?: (row: T) => 'group' | 'muted' | 'canceled' | 'selected' | undefined;
  // Indentation (levels) of the first column, for trees
  indent?: (row: T) => number;
  caption?: ReactNode;
  maxHeight?: number | string;
  dense?: boolean;
  // Checkboxes for bulk actions: the selected row keys, and which rows can be picked
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void; selectable?: (row: T) => boolean };
};

const SKELETON_ROWS = 6;

// The one table used across accounting: sticky header, calm separators, numbers aligned and in
// tabular figures, readable empty and loading states, optional sorting.
export function DataTable<T>({
  columns, rows, rowKey, onRowClick, loading, empty, footer, rowTone, indent, caption, maxHeight, dense, selection,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const x = column.sortValue!(a);
      const y = column.sortValue!(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x).localeCompare(String(y), 'ar') * sort.dir;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => setSort((current) => (
    current?.key !== key ? { key, dir: -1 } : current.dir === -1 ? { key, dir: 1 } : null
  ));

  const cellClass = (column: Column<T>) => [
    'dt-cell',
    column.numeric ? 'dt-num' : '',
    column.align ? `dt-${column.align}` : column.numeric ? 'dt-end' : 'dt-start',
    column.hideOnMobile ? 'dt-hide-mobile' : '',
  ].filter(Boolean).join(' ');

  const pickable = selection ? sorted.map((row, index) => ({ row, key: rowKey(row, index) })).filter(({ row }) => selection.selectable?.(row) ?? true) : [];
  const allPicked = pickable.length > 0 && pickable.every(({ key }) => selection!.selected.has(key));
  const togglePick = (key: string) => {
    const next = new Set(selection!.selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    selection!.onChange(next);
  };
  const toggleAll = () => selection!.onChange(allPicked ? new Set() : new Set(pickable.map(({ key }) => key)));

  return (
    <div className={`dt${dense ? ' dt--dense' : ''}`}>
      {caption && <div className="dt-caption">{caption}</div>}
      <div className="dt-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table>
          <thead>
            <tr>
              {selection && (
                <th className="dt-cell dt-check">
                  <input type="checkbox" aria-label="تحديد الكل" checked={allPicked} disabled={!pickable.length} onChange={toggleAll} />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} className={cellClass(column)} style={column.width ? { width: column.width } : undefined}>
                  {column.sortValue ? (
                    <button type="button" className="dt-sort" onClick={() => toggleSort(column.key)}>
                      {column.header}
                      {sort?.key === column.key
                        ? (sort.dir === -1 ? <ArrowDown size={13} /> : <ArrowUp size={13} />)
                        : <ChevronsUpDown size={13} className="dt-sort-idle" />}
                    </button>
                  ) : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="dt-skeleton">
                {selection && <td className="dt-cell dt-check" />}
                {columns.map((column) => <td key={column.key} className={cellClass(column)}><span /></td>)}
              </tr>
            ))}
            {!loading && sorted.map((row, index) => {
              const tone = rowTone?.(row);
              const key = rowKey(row, index);
              const picked = !!selection?.selected.has(key);
              return (
                <tr
                  key={key}
                  className={[tone ? `dt-row--${tone}` : '', onRowClick ? 'dt-row--link' : '', picked ? 'dt-row--picked' : ''].filter(Boolean).join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                >
                  {selection && (
                    <td className="dt-cell dt-check" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {(selection.selectable?.(row) ?? true) && <input type="checkbox" aria-label="تحديد السطر" checked={picked} onChange={() => togglePick(key)} />}
                    </td>
                  )}
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.key}
                      className={cellClass(column)}
                      style={columnIndex === 0 && indent ? { paddingInlineStart: 14 + indent(row) * 20 } : undefined}
                    >
                      {column.render ? column.render(row, index) : (row as any)[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer && !loading && sorted.length > 0 && (
            <tfoot>
              <tr>
                {selection && <td className="dt-cell dt-check" />}
                {columns.map((column) => <td key={column.key} className={cellClass(column)}>{footer[column.key] ?? ''}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && sorted.length === 0 && (
          <div className="dt-empty">
            <Inbox size={28} strokeWidth={1.5} />
            <div className="dt-empty-title">{empty?.title || 'لا توجد بيانات'}</div>
            {empty?.hint && <div className="dt-empty-hint">{empty.hint}</div>}
            {empty?.action && <div className="mt-2">{empty.action}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
