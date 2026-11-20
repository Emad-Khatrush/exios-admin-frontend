import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, TextField } from '@mui/material';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { fullDate, pointsText } from './format';
import { LoyaltyRtl, Num, stagger, useDialogMotion } from './LoyaltyRtl';
import { useStaffAccess } from '../../utils/useStaffAccess';
import './loyalty.scss';

type Person = { id: string, name: string, customerId?: string } | null
type Flagged = { friend: Person, inviter: Person, at: string, flags: { code: string, detail: string }[], passport: string | null, paidUsd: number, heldPoints: number }
type Step = { id: string, inviter: Person, friends: number, usd: number, points: number, ambassador: boolean, at: string, qualified?: number, paidUsd?: number }
type Manual = {
  byStaff: { staff: { id: string | null, name: string }, count: number, inviters: number }[]
  latest: { friend: Person, inviter: Person, staff: string, at: string, canceled: boolean }[]
}
type Acting = { kind: 'friend' | 'step', id: string, approve: boolean, title: string } | null

const PASSPORT: Record<string, string> = { verified: 'موثّق', pending: 'بانتظار التوثيق', rejected: 'مرفوض' };
const personLink = (p: Person) => (p ? <Link to={`/user/${p.id}`}>{p.name}{p.customerId ? <> (<bdi dir="ltr">{p.customerId}</bdi>)</> : null}</Link> : '—');

// Reviewing invites (owner, 2026-11-20): referrals that look like one person or one family on both
// sides wait here, and so do the big step rewards (always); and who set referrals by hand.
const LoyaltyReferrals = () => {
  const motion = useDialogMotion();
  const canAct = useStaffAccess().can('loyalty_adjust');
  const [queue, setQueue] = useState<{ referrals: Flagged[], steps: Step[] } | null>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<Acting>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get('loyalty/referrals/review').then((res: any) => setQueue(res.data)).catch((e: any) => setError(requestError(e, 'تعذّر تحميل المراجعة.')));
    api.get('loyalty/referrals/manual').then((res: any) => setManual(res.data)).catch(() => setManual({ byStaff: [], latest: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async () => {
    if (!acting) return;
    setBusy(true);
    try {
      const base = acting.kind === 'friend' ? `loyalty/referrals/friend/${acting.id}` : `loyalty/referrals/reward/${acting.id}`;
      await api.post(`${base}/${acting.approve ? 'approve' : 'reject'}`, acting.approve ? {} : { reason: reason.trim() });
      setActing(null);
      setReason('');
      load();
    } catch (e: any) {
      setError(requestError(e, 'لم تتم العملية. حاول مرة أخرى.'));
      setActing(null);
    }
    setBusy(false);
  };

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>مراجعة الدعوات</h1>
          <p>دعوات تبدو لنفس الشخص أو نفس العائلة، والمكافآت الإضافية الكبيرة: لا تُعطى حتى توافق عليها.</p>
          <nav className="lp-head__nav">
            <Link to="/loyalty" className="lp-head__link">→ العودة إلى النقاط</Link>
          </nav>
        </header>

        {error && <Alert severity="error" action={<Button size="small" onClick={load}>إعادة</Button>}>{error}</Alert>}

        <section className="lpr-group" style={stagger(1)} aria-label="دعوات مشبوهة">
          <h2>دعوات تحتاج مراجعة {queue && <Num>{queue.referrals.length}</Num>}</h2>
          {!queue ? <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} /> : !queue.referrals.length ? <p className="lp-muted">لا توجد دعوات تنتظر.</p> : (
            <ul className="lpr-list">
              {queue.referrals.map((r) => (
                <li key={r.friend?.id} className="lpr-card">
                  <p className="lrv-line"><b>الصديق:</b> {personLink(r.friend)} · <b>دعاه:</b> {personLink(r.inviter)}</p>
                  <p className="lrv-line">{r.flags.map((f) => <span key={f.code} className="lpr-tag lrv-flag">{f.detail}</span>)}</p>
                  <p className="lrv-line lp-muted">
                    سجّل <Num>{fullDate(r.at)}</Num> · الجواز: {PASSPORT[r.passport || ''] || 'بدون'} · دفع <Num>{pointsText(r.paidUsd)}$</Num>
                    {r.heldPoints > 0 && <> · مكافآت تنتظر <Num>{pointsText(r.heldPoints)}</Num> نقطة</>}
                  </p>
                  {canAct && r.friend && (
                    <div className="lpr-actions">
                      <Button size="small" variant="contained" onClick={() => setActing({ kind: 'friend', id: r.friend!.id, approve: true, title: 'الموافقة على الدعوة' })}>موافقة</Button>
                      <Button size="small" color="error" onClick={() => setActing({ kind: 'friend', id: r.friend!.id, approve: false, title: 'رفض الدعوة' })}>رفض</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lpr-group" style={stagger(2)} aria-label="مكافآت إضافية">
          <h2>مكافآت إضافية تنتظر الموافقة {queue && <Num>{queue.steps.length}</Num>}</h2>
          {!queue ? <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} /> : !queue.steps.length ? <p className="lp-muted">لا توجد مكافآت تنتظر.</p> : (
            <ul className="lpr-list">
              {queue.steps.map((s) => (
                <li key={s.id} className="lpr-card">
                  <p className="lrv-line"><b>{personLink(s.inviter)}</b></p>
                  <p className="lrv-line">
                    مكافأة <Num>{s.friends}</Num> أصدقاء و<Num>{pointsText(s.usd)}$</Num>: <b><Num>{pointsText(s.points)}</Num> نقطة</b>
                    {s.ambassador && <span className="lpr-tag is-ok">ولقب سفير إكسيوس</span>}
                  </p>
                  <p className="lrv-line lp-muted">
                    الآن: <Num>{s.qualified ?? 0}</Num> أصدقاء وصلوا 200$ بجوازات موثّقة · دفع أصدقاؤه <Num>{pointsText(s.paidUsd ?? 0)}$</Num> · منذ <Num>{fullDate(s.at)}</Num>
                  </p>
                  {canAct && (
                    <div className="lpr-actions">
                      <Button size="small" variant="contained" onClick={() => setActing({ kind: 'step', id: s.id, approve: true, title: 'الموافقة على المكافأة' })}>موافقة</Button>
                      <Button size="small" color="error" onClick={() => setActing({ kind: 'step', id: s.id, approve: false, title: 'رفض المكافأة' })}>رفض</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lpr-group" style={stagger(3)} aria-label="دعوات أضافها موظفون">
          <h2>دعوات أضافها موظفون يدوياً</h2>
          {!manual ? <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} /> : !manual.byStaff.length ? <p className="lp-muted">لم يُضف أي موظف دعوة يدوياً.</p> : (
            <>
              <ul className="lrv-staff">
                {manual.byStaff.map((s) => (
                  <li key={s.staff.id || 'none'}><b>{s.staff.name}</b> <span><Num>{s.count}</Num> دعوة لـ <Num>{s.inviters}</Num> داعٍ</span></li>
                ))}
              </ul>
              <ul className="lpr-list">
                {manual.latest.map((r) => (
                  <li key={r.friend?.id} className="lrv-row">
                    {personLink(r.friend)} ← {personLink(r.inviter)} <span className="lp-muted">· {r.staff} · <Num>{fullDate(r.at)}</Num>{r.canceled ? ' · ملغاة' : ''}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <Dialog open={!!acting} onClose={() => !busy && setActing(null)} className="lp-dialog" fullWidth maxWidth="xs" {...motion}>
        <DialogTitle>{acting?.title}</DialogTitle>
        <DialogContent dir="rtl">
          {acting?.approve
            ? (acting.kind === 'friend' ? 'تُعطى مكافآت هذه الدعوة كالعادة، بعد توثيق جواز الصديق.' : 'تُضاف المكافأة للداعي خلال ساعة.')
            : (
              <>
                <p className="lp-muted">{acting?.kind === 'friend' ? 'تُلغى الدعوة وكل مكافأة تنتظر منها، ولن يكسب الداعي من هذا العميل.' : 'لن تُعطى هذه المكافأة ولن تُعرض مرة أخرى.'}</p>
                <TextField fullWidth required multiline minRows={2} label="السبب" dir="auto" value={reason} disabled={busy} sx={{ mt: 2 }}
                  onChange={(e) => setReason(e.target.value)} helperText="يظهر للموظفين فقط" />
              </>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActing(null)} disabled={busy}>تراجع</Button>
          <Button variant="contained" color={acting?.approve ? 'primary' : 'error'} onClick={act} disabled={busy || (!acting?.approve && !reason.trim())}>
            {acting?.approve ? 'موافقة' : 'رفض'}
          </Button>
        </DialogActions>
      </Dialog>
    </LoyaltyRtl>
  );
};

export default LoyaltyReferrals;
