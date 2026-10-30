import { ReactNode } from 'react';

// Native details starts closed and supports keyboard activation without extra state.
export default function AccountingFold({ title, summary, children }: { title: string; summary?: ReactNode; children: ReactNode }) {
  return <details className="acc-fold">
    <summary className="acc-fold__summary"><strong>{title}</strong>{summary && <span>{summary}</span>}<span className="acc-fold__toggle">عرض / إخفاء <span aria-hidden="true">▾</span></span></summary>
    <div className="acc-fold__body">{children}</div>
  </details>;
}
