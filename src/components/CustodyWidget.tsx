import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card/Card';
import { sys } from '../containers/Accounting/accountingApi';

// Custody and loans on the Home page (owner's request 2026-10-04): a staff member sees what they
// hold and how it was spent; the admin and the accountant also see everyone's balances.
const usd = (cents: number) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KIND: Record<string, string> = { given: 'تسليم', spent: 'مصروف', returned: 'إرجاع', deducted: 'خصم من الراتب', canceled: 'إلغاء', other: 'أخرى' };

type Movements = { balance: number; given: number; used: number; movements: any[] };

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
          <strong style={{ color: data.custody.balance > 0 ? '#0f766e' : undefined }}>{usd(data.custody.balance)}</strong>
        </div>
        <div className="d-flex justify-content-between mb-2 text-muted small">
          <span>سُلِّم لي {usd(data.custody.given)}</span>
          <span>صُرف أو أُرجع {usd(data.custody.used)}</span>
        </div>
        {data.custody.movements.slice(0, 8).map((m) => (
          <div key={m.entryId} className="d-flex justify-content-between small mb-1" style={{ opacity: m.canceled ? 0.5 : 1 }}>
            <span><span dir="ltr">{m.day}</span> · {KIND[m.kind] || m.kind} · {m.description}</span>
            <span dir="ltr">{usd(m.usd)}</span>
          </div>
        ))}
        {data.custody.balance > 0 && <p className="small text-muted mt-2">تصرف من عهدتك من شاشة <Link to="/expenses">المصاريف</Link> ← «My custody».</p>}
        {data.loan.balance !== 0 && (
          <>
            <hr />
            <div className="d-flex justify-content-between">
              <span>سلفة عليّ</span>
              <strong>{usd(data.loan.balance)}</strong>
            </div>
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
            <span dir="ltr">{usd(row.custody)} · {usd(row.loan)}</span>
          </div>
        ))}
        <hr />
        <div className="d-flex justify-content-between">
          <strong>الإجمالي</strong>
          <strong dir="ltr">{usd(data.totals.custody)} · {usd(data.totals.loan)}</strong>
        </div>
        <p className="small text-muted mt-2">التفاصيل من <Link to="/accounting/employees">المحاسبة ← الموظفون</Link>.</p>
      </div>
    </Card>
  );
};
