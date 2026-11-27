import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Skeleton, TablePagination } from '@mui/material';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { pageAriaLabel, pageLabel } from '../Loyalty/format';
import { Num } from '../Loyalty/LoyaltyRtl';
import { day } from './format';
import { Period, Who } from './types';

export { Num };

// What every section reads from the page: the shared filters (from, to, office), the URL search
// params of the open tab, the «تحديث» counter (a new value sends fresh=1 once) and where to report builtAt
export type SectionEnv = {
  filters: { from: string, to: string, office: string }
  // Sent with every request of every section: companies=exclude, compare=0 (CONTRACT.md «Common additions»)
  common: Record<string, string>
  param: (key: string) => string
  setParam: (next: Record<string, string | null>) => void
  nonce: number
  onBuilt: (at: string | null) => void
}
export const SectionContext = createContext<SectionEnv | null>(null);
export const useEnv = () => useContext(SectionContext) as SectionEnv;

type Query = Record<string, string | number | null | undefined>

// Loads one section; a newer request wins (the older answer is ignored)
export function useSection<T extends { builtAt?: string }>(section: string, query: Query) {
  const { nonce, onBuilt, common } = useEnv();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const ticket = useRef(0);
  const seenNonce = useRef(nonce);
  const key = JSON.stringify([query, common]);

  const load = useCallback(() => {
    const id = ++ticket.current;
    const params: Record<string, string | number> = {};
    Object.entries({ ...common, ...query }).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params[k] = v; });
    if (seenNonce.current !== nonce) { params.fresh = 1; seenNonce.current = nonce; }
    setError('');
    setLoading(true);
    api.get(`analytics/customers/${section}`, params)
      .then((res: any) => {
        if (id !== ticket.current) return;
        setData(res.data);
        setLoading(false);
        onBuilt(res.data?.builtAt || null);
      })
      .catch((e: any) => {
        if (id !== ticket.current) return;
        setLoading(false);
        setError(requestError(e, 'تعذّر تحميل هذا القسم. تأكد من الاتصال ثم أعد المحاولة.'));
      });
  }, [section, key, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  return { data, error, loading, retry: load };
}

export const SectionError = ({ error, retry }: { error: string, retry: () => void }) => (
  <Alert severity="error" className="ca-alert" action={<Button size="small" color="inherit" onClick={retry}>إعادة المحاولة</Button>}>{error}</Alert>
);

export const Loading = ({ tiles = 4 }: { tiles?: number }) => (
  <div className="ca-loading" aria-busy="true" aria-label="جارٍ التحميل">
    <div className="ca-tiles">
      {Array.from({ length: tiles }, (_, i) => <Skeleton key={i} variant="rectangular" height={104} sx={{ borderRadius: '12px' }} />)}
    </div>
    <Skeleton variant="rectangular" height={280} sx={{ borderRadius: '12px' }} />
  </div>
);

// An English name or abbreviation after Arabic text: small, muted, isolated left to right so it does not upset the RTL order
export const En = ({ children }: { children: ReactNode }) => <bdi dir="ltr" className="ca-en">{children}</bdi>;

export const Empty = ({ children }: { children: ReactNode }) => <p className="ca-empty">{children}</p>;

// `foot`: the change against the previous period and the target (see Versus in compare.tsx)
// `en`: the English name or abbreviation shown small after the Arabic (see En)
export const Tile = ({ label, en, value, hint, foot }: { label: ReactNode, en?: string, value: ReactNode, hint?: ReactNode, foot?: ReactNode }) => (
  <div className="ca-tile">
    <span className="ca-tile__label">{label}{en ? <> <En>{en}</En></> : null}</span>
    <strong className="ca-tile__value"><Num>{value}</Num></strong>
    {foot}
    {hint ? <small className="ca-tile__hint">{hint}</small> : null}
  </div>
);

export const Panel = ({ title, en, sub, actions, children, className }: { title: ReactNode, en?: string, sub?: ReactNode, actions?: ReactNode, children: ReactNode, className?: string }) => (
  <section className={`ca-panel${className ? ` ${className}` : ''}`}>
    <header className="ca-panel__head">
      <div>
        <h2>{title}{en ? <> <En>{en}</En></> : null}</h2>
        {sub ? <p className="ca-panel__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="ca-panel__actions">{actions}</div> : null}
    </header>
    {children}
  </section>
);

export const PeriodLine = ({ period, extra }: { period?: Period, extra?: ReactNode }) => (period ? (
  <p className="ca-period">الفترة: من <Num>{day(period.from)}</Num> إلى <Num>{day(period.to)}</Num>{extra}</p>
) : null);

// The figures of a chart as a table (for anyone who cannot tell the colours apart, or wants the numbers)
export const ChartTable = ({ head, rows }: { head: string[], rows: ReactNode[][] }) => (
  <details className="ca-details">
    <summary>الأرقام كجدول</summary>
    <div className="ca-table-wrap">
      <table className="ca-table">
        <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'is-num' : undefined}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'is-num' : undefined}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>
);

export const Person = ({ who }: { who: Who }) => (
  <Link to={`/user/${who.id}`} className="ca-person">{who.name || 'بدون اسم'}</Link>
);

export const Pager = ({ total, page, limit, onPage }: { total: number, page: number, limit: number, onPage: (page: number) => void }) => (
  total > limit ? (
    <TablePagination
      component="div" count={total} page={Math.max(0, page - 1)} rowsPerPage={limit} rowsPerPageOptions={[limit]}
      onPageChange={(_, next) => onPage(next + 1)}
      labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
    />
  ) : null
);

export const Segment = <T extends string>({ value, options, onChange, label }: { value: T, options: [T, ReactNode][], onChange: (v: T) => void, label: string }) => (
  <div className="ca-segment" role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
);

export const PAGE_SIZE = 25;
