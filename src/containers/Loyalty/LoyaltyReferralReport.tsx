import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, IconButton, InputAdornment, Skeleton, TablePagination, TextField } from '@mui/material';
import { MdClose, MdSearch } from 'react-icons/md';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { fullDate, money, pageAriaLabel, pageLabel, pointsText } from './format';
import { LoyaltyRtl, Num, stagger } from './LoyaltyRtl';
import './loyalty.scss';

// Following invite-a-friend (owner 2026-11-26): every referral with who invited whom, what the friend
// paid and what the inviter got from them; the top inviters; the rewards still waiting and why; and
// the ones cancelled or taken back. GET loyalty/referrals/report (Exios-Api referrals.staffReport).

type Person = { id: string, name: string, customerId: string | null } | null
export type ReferralStatus = 'joined' | 'sharing' | 'ended' | 'canceled' | 'review' | 'rejected'
type Row = {
  friend: Person, inviter: Person, at: string, source: 'link' | 'code' | 'staff' | null, status: ReferralStatus,
  qualifiedAt: string | null, canceledAt: string | null, cancelReason: string | null, flags: { code: string, detail: string }[],
  passport: string | null, paidUsd: number, points: number, heldPoints: number,
}
type Reward = {
  id: string, kind: 'first' | 'share' | 'step', points: number, inviter: Person, friend: Person,
  step: { friends: number, usd: number } | null, createdAt: string, releaseAt: string,
}
type Report = {
  totals: { referrals: number, qualified: number, canceled: number, review: number, pointsGiven: number, pointsHeld: number, pointsRevoked: number, pointsCanceled: number }
  topInviters: (NonNullable<Person> & { invited: number, qualified: number, points: number, ambassador: boolean })[]
  rows: Row[], page: number, pages: number, total: number, qualifyUsd: number
  pending: (Reward & { waiting: 'approval' | 'review' | 'passport' | 'hold' | 'due' })[]
  lost: (Reward & { status: 'canceled' | 'revoked', at: string | null, reason: string | null })[]
}

export const STATUS_TEXT: Record<ReferralStatus, string> = {
  joined: 'سجّل ولم يصل بعد', sharing: 'وصل · الحصة سارية', ended: 'وصل · انتهت الحصة', canceled: 'ملغاة', review: 'تنتظر المراجعة', rejected: 'مرفوضة',
};
export const SOURCE_TEXT: Record<string, string> = { link: 'رابط', code: 'كود', staff: 'موظف' };
export const PASSPORT_TEXT: Record<string, string> = { verified: 'موثّق', pending: 'بانتظار التوثيق', rejected: 'مرفوض' };
const KIND_TEXT: Record<Reward['kind'], string> = { first: 'مكافأة الوصول', share: 'حصة', step: 'مكافأة مرحلة' };
const WAITING_TEXT: Record<string, string> = {
  approval: 'تنتظر موافقتكم', review: 'الدعوة تنتظر المراجعة', passport: 'جواز الصديق غير موثّق', hold: 'مهلة 24 ساعة', due: 'تُصرف في التشغيل القادم',
};
const FILTERS: [string, string][] = [['', 'الكل'], ['joined', 'سجّل فقط'], ['qualified', 'وصلوا'], ['review', 'تنتظر المراجعة'], ['canceled', 'ملغاة']];
const PAGE = 30;

export const personLink = (p: Person) => (p ? <Link to={`/user/${p.id}`}>{p.name}{p.customerId ? <> (<bdi dir="ltr">{p.customerId}</bdi>)</> : null}</Link> : '—');
const usd = (points: number) => money(points / 100);

const LoyaltyReferralReport = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = params.get('q') || '';
  const [search, setSearch] = useState(query);
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
    api.get('loyalty/referrals/report', { search: query, status, page })
      .then((res: any) => { if (id === request.current) setData(res.data); })
      .catch((e: any) => { if (id === request.current) setError(requestError(e, 'تعذّر تحميل تقرير الدعوات.')); });
  }, [query, status, page]);
  useEffect(() => { load(); }, [load]);

  // The search is sent a moment after typing stops
  useEffect(() => {
    if (search === query) return undefined;
    const timer = setTimeout(() => setParam({ q: search.trim() || null, page: null }), 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = data?.totals;

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>تقرير الدعوات</h1>
          <p>كل دعوة: من دعا من، وما دفعه الصديق، وما أخذه الداعي منه. وما ينتظر الصرف وما سُحب، مع السبب.</p>
          <nav className="lp-head__nav">
            <Link to="/loyalty" className="lp-head__link">→ العودة إلى النقاط</Link>
            <Link to="/loyalty/referrals" className="lp-head__link">مراجعة الدعوات</Link>
          </nav>
        </header>

        {error && <Alert severity="error" action={<Button size="small" onClick={load}>إعادة</Button>}>{error}</Alert>}

        <section className="lrr-stats" aria-label="الملخص" style={stagger(1)}>
          <div className="lp-stat"><span className="lp-label">دعوات</span><strong><Num>{t ? pointsText(t.referrals) : '—'}</Num></strong>
            <small>{t ? <>منها <Num>{t.canceled}</Num> ملغاة{t.review ? <> و<Num>{t.review}</Num> تنتظر المراجعة</> : null}</> : ' '}</small></div>
          <div className="lp-stat"><span className="lp-label">وصلوا {data?.qualifyUsd || 200}$</span><strong><Num>{t ? pointsText(t.qualified) : '—'}</Num></strong>
            <small>{t && t.referrals ? <><Num>{Math.round((t.qualified / t.referrals) * 100)}%</Num> من الدعوات</> : ' '}</small></div>
          <div className="lp-stat"><span className="lp-label">نقاط أُعطيت للداعين</span><strong><Num>{t ? pointsText(t.pointsGiven) : '—'}</Num></strong>
            <small>{t ? <Num>${usd(t.pointsGiven)}</Num> : ' '}</small></div>
          <div className="lp-stat"><span className="lp-label">نقاط تنتظر الصرف</span><strong><Num>{t ? pointsText(t.pointsHeld) : '—'}</Num></strong>
            <small>{t ? <>سُحب <Num>{pointsText(t.pointsRevoked)}</Num> وأُلغي <Num>{pointsText(t.pointsCanceled)}</Num></> : ' '}</small></div>
        </section>

        <section className="lpr-group" style={stagger(2)} aria-labelledby="lrr-top">
          <h2 id="lrr-top">أكثر الداعين</h2>
          {!data ? <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} /> : !data.topInviters.length ? <p className="lp-muted">لا توجد دعوات بعد.</p> : (
            <ol className="lrr-top">
              {data.topInviters.map((p, i) => (
                <li key={p.id}>
                  <span className="lrr-top__rank"><Num>{i + 1}</Num></span>
                  <span className="lrr-top__name">{personLink(p)}{p.ambassador && <span className="lpr-tag is-ok">سفير</span>}</span>
                  <span className="lp-muted">دعا <Num>{p.invited}</Num> · وصل <Num>{p.qualified}</Num> · <Num>{pointsText(p.points)}</Num> نقطة</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="lpr-group" style={stagger(3)} aria-labelledby="lrr-all">
          <h2 id="lrr-all">كل الدعوات {data && <Num>{pointsText(data.total)}</Num>}</h2>
          <div className="lp-toolbar">
            <TextField
              className="lp-search" size="small" placeholder="اسم أو كود الصديق أو الداعي" value={search}
              onChange={(event) => setSearch(event.target.value)} inputProps={{ 'aria-label': 'بحث' }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><MdSearch /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" aria-label="مسح البحث" onClick={() => { setSearch(''); setParam({ q: null, page: null }); }}><MdClose /></IconButton></InputAdornment> : null,
              }}
            />
            <div className="lp-segment" role="group" aria-label="الحالة">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setParam({ status: value || null, page: null })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="lp-card">
            <div className="lp-table-wrap">
              <table className="lp-table lrr-table">
                <thead>
                  <tr><th>الصديق</th><th>دعاه</th><th>التسجيل</th><th>الحالة</th><th>الجواز</th><th className="is-num">دفع الصديق</th><th className="is-num">للداعي</th></tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td colSpan={7}><Skeleton height={28} /><Skeleton height={28} /></td></tr>
                  ) : !data.rows.length ? (
                    <tr><td colSpan={7} className="lp-muted">لا توجد دعوات بهذا البحث.</td></tr>
                  ) : data.rows.map((r) => (
                    <tr key={r.friend?.id}>
                      <td>{personLink(r.friend)}</td>
                      <td>{personLink(r.inviter)}</td>
                      <td><Num>{fullDate(r.at)}</Num>{r.source && <span className="lp-muted"> · {SOURCE_TEXT[r.source]}</span>}</td>
                      <td>
                        <span className={`lpr-tag lrr-st is-${r.status}`}>{STATUS_TEXT[r.status]}</span>
                        {r.flags.map((f) => <span key={f.code} className="lpr-tag lrv-flag">{f.detail}</span>)}
                        {r.cancelReason && <div className="lp-muted lrr-why">{r.cancelReason}</div>}
                      </td>
                      <td>{PASSPORT_TEXT[r.passport || ''] || 'بدون'}</td>
                      <td className="is-num"><Num>${money(r.paidUsd)}</Num></td>
                      <td className="is-num">
                        <Num>{pointsText(r.points)}</Num>
                        {r.heldPoints > 0 && <div className="lp-muted lrr-why">+<Num>{pointsText(r.heldPoints)}</Num> تنتظر</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!!data && data.total > PAGE && (
              <TablePagination
                component="div" count={data.total} page={page - 1} rowsPerPage={PAGE} rowsPerPageOptions={[PAGE]}
                onPageChange={(_, next) => setParam({ page: next ? String(next + 1) : null })}
                labelDisplayedRows={pageLabel} getItemAriaLabel={pageAriaLabel}
              />
            )}
          </div>
        </section>

        <section className="lpr-group" style={stagger(4)} aria-labelledby="lrr-pending">
          <h2 id="lrr-pending">مكافآت تنتظر الصرف {data && <Num>{data.pending.length}</Num>}</h2>
          {!data ? <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} /> : !data.pending.length ? <p className="lp-muted">لا توجد مكافآت تنتظر.</p> : (
            <ul className="lrr-rewards">
              {data.pending.map((r) => (
                <li key={r.id}>
                  <b><Num>{pointsText(r.points)}</Num> نقطة</b> · {KIND_TEXT[r.kind]}{r.step && <> (<Num>{r.step.friends}</Num> أصدقاء)</>}
                  <span> لـ {personLink(r.inviter)}{r.friend && <> من {personLink(r.friend)}</>}</span>
                  <span className="lpr-tag">{WAITING_TEXT[r.waiting]}</span>
                  {r.waiting === 'hold' && <span className="lp-muted"> · تُصرف <Num>{fullDate(r.releaseAt)}</Num></span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lpr-group" style={stagger(5)} aria-labelledby="lrr-lost">
          <h2 id="lrr-lost">مكافآت أُلغيت أو سُحبت</h2>
          {!data ? <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} /> : !data.lost.length ? <p className="lp-muted">لا شيء.</p> : (
            <ul className="lrr-rewards">
              {data.lost.map((r) => (
                <li key={r.id}>
                  <b><Num>{pointsText(r.points)}</Num> نقطة</b> · {KIND_TEXT[r.kind]}
                  <span> لـ {personLink(r.inviter)}{r.friend && <> من {personLink(r.friend)}</>}</span>
                  <span className="lpr-tag">{r.status === 'revoked' ? 'سُحبت بعد صرفها' : 'أُلغيت قبل صرفها'}</span>
                  <span className="lp-muted">{r.at && <> · <Num>{fullDate(r.at)}</Num></>}{r.reason && <> · {r.reason}</>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyReferralReport;
