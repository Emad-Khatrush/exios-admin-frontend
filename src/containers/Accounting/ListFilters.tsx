import { ReactNode } from 'react';
import { Button, TextField } from '@mui/material';
import { FilterBar } from './ui';

// The filters of the accounting lists (owner's request 2026-10-04): any fields of the page, then
// the dates and a search on the document number or its note. "عرض" asks the server again.
export type ListFilterValue = Record<string, string>;

// The filled fields only, as query parameters
export const queryOf = (value: ListFilterValue) => Object.fromEntries(Object.entries(value).filter(([, v]) => v));

export const ListFilters = ({ value, onChange, onApply, blank, searchLabel = 'رقم المستند أو الملاحظة', children }: {
  value: ListFilterValue; onChange: (value: ListFilterValue) => void; onApply: (value: ListFilterValue) => void; blank: ListFilterValue;
  searchLabel?: string | null; children?: ReactNode;
}) => {
  const active = Object.entries(value).some(([key, v]) => v && v !== blank[key]);
  return (
    <FilterBar>
      {children}
      <TextField size="small" type="date" label="من" InputLabelProps={{ shrink: true }} value={value.from || ''} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      <TextField size="small" type="date" label="إلى" InputLabelProps={{ shrink: true }} value={value.to || ''} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      {searchLabel !== null && (
        <TextField size="small" placeholder={searchLabel} value={value.search || ''} onChange={(e) => onChange({ ...value, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && onApply(value)} />
      )}
      <Button variant="outlined" onClick={() => onApply(value)}>عرض</Button>
      {active && <Button onClick={() => { onChange(blank); onApply(blank); }}>مسح</Button>}
    </FilterBar>
  );
};
