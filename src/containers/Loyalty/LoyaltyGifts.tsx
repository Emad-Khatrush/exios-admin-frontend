import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, TablePagination, Skeleton } from '@mui/material';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { fullDate, money, pageAriaLabel, pageLabel, pointsText } from './format';
import { LoyaltyRtl, Num, stagger } from './LoyaltyRtl';
import './loyalty.scss';

// Gifts held for the first invoice (owner 2026-11-27): the sign-up gift (100) and the invite welcome
// (300) are not points and not booked until the customer first really ships — a purchase invoice, a
// package arrived abroad, something billed. Without that within 90 days they lapse. This page shows
// every one still waiting, and the ones given and lapsed. GET loyalty/gifts (Exios-Api giftsReport).

type Status = 'pending' | 'granted' | 'expired'
type Sum = { count: number, points: number }
type Row = {
  id: string, userId: string, name: string, customerId?: string, kind: 'signup' | 'invite', points: number, reason: string,
  createdAt: string, expiresAt: string, grantedAt?: string, daysLeft: number | null,
}
type Report = { totals: Record<Status, Sum>, status: Status, total: number, page: number, limit: number, rows: Row[] }

const TABS: [Status, string][] = [['pending', 'تنتظر أول فاتورة'], ['granted', 'صارت نقاطاً'], ['expired', 'انتهت دون شحن']];
const KIND_TEXT: Record<Row['kind'], string> = { signup: 'هدية فتح الحساب', invite: 'هدية الدعوة' };
const PAGE = 50;
const usd = (points: number) => money(points / 100);

const LoyaltyGifts = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: Status = raw === 'granted' || raw === 'expired' ? raw : 'pending';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const request = useRef(0);

  const setParam = (next: Record<string, string | null>) => {
    const copy = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => (value ? copy.set(key, value) : copy.delete(key)));
    setParams(copy, { replace: true });
  };

  const load = useCallback(() => {
    const id = ++request.current;
    setError('');
    api.get('loyalty/gifts', { status, page, limit: PAGE })
      .then((res: any) => { if (id === request.current) setData(res.data); })
      .catch((e: any) => { if (id === request.current) setError(requestError(e, 'تعذّر تحميل الهدايا.')); });
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const stat = (key: Status, label: string, note: string) => (
    <div className="lp-stat">
      <span className="lp-label">{label}</span>
      <strong><Num>{t ? pointsText(t[key].points) : '—'}</Num></strong>
      <small>{t ? <><Num>{pointsText(t[key].count)}</Num> عميل · <Num>${usd(t[key].points)}</Num> · {note}</> : ' '}</small>
    </div>
  );
  const shown = data && data.status === status ? data : null;

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>النقاط المعلّقة</h1>
          <p>
            هدية فتح الحساب وهدية الدعوة لا تصير نقاطاً ولا تُقيَّد في المحاسبة إلا عند أول دليل أن العميل يشحن فعلاً:
            فاتورة شراء يفتحها الموظف، أو شحنة له تصل مخزننا في الخارج، أو مبلغ يُسجَّل عليه. إن لم يحدث ذلك خلال 90 يوماً تنتهي الهدية.
          </p>
          <nav className="lp-head__nav">
            <Link to="/loyalty" className="lp-head__link">→ العودة إلى النقاط</Link>
          </nav>
        </header>

        {error && <Alert severity="error" action={<Button size="small" onClick={load}>إعادة</Button>}>{error}</Alert>}

        <section className="lrr-stats" aria-label="الملخص" style={stagger(1)}>
          {stat('pending', 'نقاط معلّقة الآن', 'غير مقيّدة')}
          {stat('granted', 'صارت نقاطاً', 'قُيّدت عند أول فاتورة')}
          {stat('expired', 'انتهت دون شحن', 'لم تُقيّد أبداً')}
        </section>

        <section className="lpr-group" style={stagger(2)} aria-labelledby="lg-list">
          <h2 id="lg-list">الهدايا {shown && <Num>{pointsText(shown.total)}</Num>}</h2>
          <div className="lp-toolbar">
            <div className="lp-segment" role="group" aria-label="الحالة">
              {TABS.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setParam({ status: value === 'pending' ? null : value, page: null })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="lp-card">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>العميل</th><th>الهدية</th><th className="is-num">النقاط</th><th>منذ</th>
                    <th>{status === 'pending' ? 'تنتهي' : status === 'granted' ? 'صارت نقاطاً في' : 'انتهت في'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!shown ? (
                    <tr><td colSpan={5}><Skeleton height={28} /><Skeleton height={28} /></td></tr>
                  ) : !shown.rows.length ? (
                    <tr><td colSpan={5} className="lp-muted">لا توجد هدايا هنا.</td></tr>
                  ) : shown.rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link to={`/user/${r.userId}`}>{r.name || '—'}{r.customerId ? <> (<bdi dir="ltr">{r.customerId}</bdi>)</> : null}</Link></td>
                      <td>{KIND_TEXT[r.kind]}</td>
                      <td className="is-num"><Num>{pointsText(r.points)}</Num> <span className="lp-muted">(<Num>${usd(r.points)}</Num>)</span></td>
                      <td><Num>{fullDate(r.createdAt)}</Num></td>
                      <td>
                        {status === 'granted' ? <Num>{r.grantedAt ? fullDate(r.grantedAt) : '—'}</Num> : <Num>{fullDate(r.expiresAt)}</Num>}
                        {status === 'pending' && r.daysLeft !== null && (
                          <span className={`lpr-tag${r.daysLeft <= 14 ? ' is-warn' : ''}`}>باقي <Num>{r.daysLeft}</Num> يوم</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!!shown && shown.total > PAGE && (
              <TablePagination
                component="div" count={shown.total} page={page - 1} rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]}
                onPageChange={(_, next) => setParam({ page: next ? String(next + 1) : null })}
                labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
              />
            )}
          </div>
        </section>
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyGifts;
