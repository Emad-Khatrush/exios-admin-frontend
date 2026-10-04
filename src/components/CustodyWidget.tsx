import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card/Card';
import { sys } from '../containers/Accounting/accountingApi';

// Custody and loans on the Home page (owner's request 2026-10-04): a staff member sees what they
// hold and how it was spent; the admin and the accountant also see everyone's balances. Each is
// kept in its own currency (dollars, dinars).
type Held = Record<string, number>;
const CURRENCIES = ['USD', 'LYD'];
const amount = (value: number, currency: string) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
// "250.00 USD · 760.00 LYD", or 0
const held = (value?: Held) => {
  const shown = CURRENCIES.filter((c) => Math.abs(Number(value?.[c] || 0)) > 0.0001);
  return shown.length ? shown.map((c) => amount(value?.[c] || 0, c)).join(' · ') : '0';
};
const holds = (value?: Held) => CURRENCIES.some((c) => Math.abs(Number(value?.[c] || 0)) > 0.0001);
const KIND: Record<string, string> = { given: 'تسليم', spent: 'مصروف', returned: 'إرجاع', deducted: 'خصم من الراتب', canceled: 'إلغاء', other: 'أخرى' };

type Movements = { balance: Held; given: Held; used: Held; movements: any[] };

export const MyCustodyWidget = () => {
  const [data, setData] = useState<{ custody: Movements; loan: Movements } | null>(null);
  useEffect(() => {
    sys.get('acc/my-custody').then((res: any) => setData(res.data)).catch(() => setData(null));
  }, []);
  if (!data || (!data.custody.movements.length && !data.loan.movements.length)) return null;
  return (
    <Card>
      <div dir="rtl">
        <h6>عهدتي</h6>
        <hr />
        <div className="d-flex justify-content-between mb-2">
          <span>الرصيد في عهدتي</span>
          <strong dir="ltr" style={{ color: holds(data.custody.balance) ? '#0f766e' : undefined }}>{held(data.custody.balance)}</strong>
        </div>
        <div className="d-flex justify-content-between mb-2 text-muted small">
          <span>سُلِّم لي <span dir="ltr">{held(data.custody.given)}</span></span>
          <span>صُرف أو أُرجع <span dir="ltr">{held(data.custody.used)}</span></span>
        </div>
        {data.custody.movements.slice(0, 8).map((m) => (
          <div key={`${m.entryId}-${m.currency}`} className="d-flex justify-content-between small mb-1" style={{ opacity: m.canceled ? 0.5 : 1 }}>
            <span><span dir="ltr">{m.day}</span> · {KIND[m.kind] || m.kind} · {m.description}</span>
            <span dir="ltr">{amount(m.amount, m.currency)}{m.cash && m.cash.currency !== m.currency && <span className="text-muted"> ({amount(m.cash.amount, m.cash.currency)})</span>}</span>
          </div>
        ))}
        {holds(data.custody.balance) && <p className="small text-muted mt-2">تصرف من عهدتك بنفس عملتها من شاشة <Link to="/expenses">المصاريف</Link> ← «My custody».</p>}
        {data.loan.movements.length > 0 && (
          <>
            <hr />
            <div className="d-flex justify-content-between mb-2">
              <span>سلفة عليّ</span>
              <strong dir="ltr">{held(data.loan.balance)}</strong>
            </div>
            <div className="d-flex justify-content-between mb-2 text-muted small">
              <span>أخذت <span dir="ltr">{held(data.loan.given)}</span></span>
              <span>سدّدت <span dir="ltr">{held(data.loan.used)}</span></span>
            </div>
            {data.loan.movements.slice(0, 5).map((m) => (
              <div key={`${m.entryId}-${m.currency}`} className="d-flex justify-content-between small mb-1" style={{ opacity: m.canceled ? 0.5 : 1 }}>
                <span><span dir="ltr">{m.day}</span> · {KIND[m.kind] || m.kind}</span>
                <span dir="ltr">{amount(m.amount, m.currency)}{m.cash && m.cash.currency !== m.currency && <span className="text-muted"> ({amount(m.cash.amount, m.cash.currency)})</span>}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </Card>
  );
};

export const StaffCustodyWidget = () => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    sys.get('acc/custody-summary').then((res: any) => setData(res.data)).catch(() => setData(null));
  }, []);
  if (!data || !data.results.length) return null;
  return (
    <Card>
      <div dir="rtl">
        <h6>عهد وسلف الموظفين</h6>
        <hr />
        <div className="d-flex justify-content-between small text-muted mb-2">
          <span>الموظف</span>
          <span>عهدة · سلفة</span>
        </div>
        {data.results.map((row: any) => (
          <div key={row._id} className="d-flex justify-content-between mb-1">
            <span>{row.name}</span>
            <span><span dir="ltr">{held(row.custody)}</span> <span className="text-muted">|</span> <span dir="ltr">{held(row.loan)}</span></span>
          </div>
        ))}
        <hr />
        <div className="d-flex justify-content-between">
          <strong>الإجمالي</strong>
          <strong><span dir="ltr">{held(data.totals.custody)}</span> <span className="text-muted">|</span> <span dir="ltr">{held(data.totals.loan)}</span></strong>
        </div>
        <p className="small text-muted mt-2">التفاصيل من <Link to="/accounting/employees">المحاسبة ← الموظفون</Link>.</p>
      </div>
    </Card>
  );
};
