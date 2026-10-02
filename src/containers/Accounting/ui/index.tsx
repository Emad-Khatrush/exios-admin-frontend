import { ReactNode } from 'react';
import { Alert } from '@mui/material';

export { DataTable } from './DataTable';
export type { Column } from './DataTable';

const SYMBOLS: Record<string, string> = { USD: '$', LYD: 'د.ل', CNY: '¥', TRY: '₺', EUR: '€' };
export const CURRENCY_NAMES: Record<string, string> = { USD: 'دولار', LYD: 'دينار', CNY: 'يوان', TRY: 'ليرة', EUR: 'يورو' };

const group = (value: number, decimals: number) => Math.abs(value).toLocaleString('en-US', {
  minimumFractionDigits: Math.min(decimals, 2),
  maximumFractionDigits: decimals,
});

// An amount from the ledger: cents for USD (default), or minor units of `currency` with
// `decimals`. Numbers always read left to right, in tabular figures; negatives are red.
export const Money = ({
  value, currency = 'USD', decimals, tone = 'auto', strong, hideZero,
}: {
  value: number | null | undefined; currency?: string | null; decimals?: number;
  tone?: 'auto' | 'debit' | 'credit' | 'plain'; strong?: boolean; hideZero?: boolean;
}) => {
  if ((value === null || value === undefined || value === 0) && hideZero) return null;
  const places = decimals ?? (currency === 'LYD' ? 3 : 2);
  const amount = (value || 0) / 10 ** places;
  const symbol = SYMBOLS[currency || 'USD'] || currency || '';
  const text = currency === 'USD' || !currency ? `${symbol}${group(amount, places)}` : `${group(amount, places)} ${symbol}`;
  const toneClass = tone === 'debit' ? 'm-debit' : tone === 'credit' ? 'm-credit' : tone === 'auto' && amount < 0 ? 'm-negative' : '';
  return <span className={`money ${toneClass}${strong ? ' money--strong' : ''}`}>{amount < 0 ? `-${text}` : text}</span>;
};

// A plain amount typed by a person (already in major units)
export const Amount = ({ value, currency = 'USD' }: { value: number; currency?: string }) => {
  const text = group(Number(value) || 0, currency === 'LYD' ? 3 : 2);
  const symbol = SYMBOLS[currency] || currency;
  return <span className="money">{currency === 'USD' ? `${symbol}${text}` : `${text} ${symbol}`}</span>;
};

export const PageHeader = ({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) => (
  <header className="acc-page-header">
    <div className="acc-page-header__text">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {actions && <div className="acc-page-header__actions">{actions}</div>}
  </header>
);

export const Panel = ({
  title, subtitle, actions, children, flush,
}: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) => (
  <section className={`acc-panel${flush ? ' acc-panel--flush' : ''}`}>
    {(title || actions) && (
      <div className="acc-panel__head">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="acc-panel__actions">{actions}</div>}
      </div>
    )}
    <div className="acc-panel__body">{children}</div>
  </section>
);

export const Stat = ({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'accent' | 'warn' | 'danger' }) => (
  <div className={`acc-stat${tone ? ` acc-stat--${tone}` : ''}`}>
    <div className="acc-stat__label">{label}</div>
    <div className="acc-stat__value">{value}</div>
    {hint && <div className="acc-stat__hint">{hint}</div>}
  </div>
);

export const StatGrid = ({ children }: { children: ReactNode }) => <div className="acc-stats">{children}</div>;

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'مسودة', tone: 'warn' },
  posted: { label: 'مُرحَّل', tone: 'ok' },
  canceled: { label: 'ملغى', tone: 'muted' },
  reversed: { label: 'معكوس', tone: 'muted' },
  archived: { label: 'مؤرشف', tone: 'muted' },
  active: { label: 'نشط', tone: 'ok' },
  fully_depreciated: { label: 'مُهلك بالكامل', tone: 'info' },
  disposed: { label: 'مُستبعد', tone: 'muted' },
  pending: { label: 'بالانتظار', tone: 'info' },
  done: { label: 'تم', tone: 'ok' },
  failed: { label: 'فشل', tone: 'danger' },
  skipped: { label: 'تُجوهل', tone: 'muted' },
  unmatched: { label: 'غير مطابق', tone: 'warn' },
  matched: { label: 'مطابق', tone: 'ok' },
  created_entry: { label: 'أُنشئ له قيد', tone: 'info' },
  ignored: { label: 'مُتجاهَل', tone: 'muted' },
  processing: { label: 'مفتوحة', tone: 'info' },
  finished: { label: 'مكتملة', tone: 'muted' },
};

export const Badge = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'accent' }) => (
  <span className={`acc-badge acc-badge--${tone}`}>{children}</span>
);

export const StatusBadge = ({ status }: { status: string }) => {
  const item = STATUS[status] || { label: status, tone: 'muted' };
  return <Badge tone={item.tone as any}>{item.label}</Badge>;
};

export const Notice = ({ message, onClose }: { message: { type: 'error' | 'success' | 'info' | 'warning'; text: string } | null; onClose?: () => void }) => (
  message ? <Alert severity={message.type} className="mb-3" onClose={onClose}>{message.text}</Alert> : null
);

export const FilterBar = ({ children }: { children: ReactNode }) => <div className="acc-filters">{children}</div>;

// Two-part label for an account: code in a quiet mono chip, then its name
export const AccountRef = ({ code, name }: { code?: string; name?: string }) => (
  <span className="acc-account"><span className="acc-account__code">{code}</span><span>{name}</span></span>
);

// Small grey detail line under a cell's main text
export const Sub = ({ children }: { children: ReactNode }) => <div className="acc-sub">{children}</div>;

// A link to the document behind a number (order, customer, trip, bill...). Opens in a new tab
// so the accounting screen being reviewed stays where it is.
export const Open = ({ to, children }: { to?: string | null; children: ReactNode }) => (to
  ? <a className="acc-link acc-open" href={to} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{children}<span aria-hidden="true"> ↗</span></a>
  : <>{children}</>);

// What an entry moved in currencies other than the dollar (one figure per currency), so amounts
// typed in dinars can be checked against the system without converting
export const ForeignTotals = ({ lines }: { lines: any[] }) => {
  const totals = new Map<string, number>();
  (lines || []).forEach((line) => {
    if (line.currency && line.currency !== 'USD' && line.amountCurrency > 0) totals.set(line.currency, (totals.get(line.currency) || 0) + line.amountCurrency);
  });
  // Entries with only a credit side in the currency (money leaving a box)
  if (!totals.size) {
    (lines || []).forEach((line) => {
      if (line.currency && line.currency !== 'USD' && line.amountCurrency < 0) totals.set(line.currency, (totals.get(line.currency) || 0) - line.amountCurrency);
    });
  }
  if (!totals.size) return null;
  return <>{Array.from(totals).map(([currency, amount]) => <div key={currency}><Money value={amount} currency={currency} tone="plain" /></div>)}</>;
};

export const Ltr = ({ children }: { children: ReactNode }) => <bdi dir="ltr" className="acc-ltr">{children}</bdi>;

// Cancelled documents and their reversals are hidden by default; this brings them back
export const ShowCanceled = ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="acc-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    إظهار الملغى
  </label>
);
