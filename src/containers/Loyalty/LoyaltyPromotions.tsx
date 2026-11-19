import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton } from '@mui/material';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { fullDate, pointsText } from './format';
import { LoyaltyRtl, Num, stagger, useDialogMotion } from './LoyaltyRtl';
import PromotionDialog, { Promotion, coverText, toDayOf } from './PromotionDialog';
import './loyalty.scss';

const GROUPS: { state: Promotion['state'], title: string, empty: string }[] = [
  { state: 'active', title: 'جارية الآن', empty: 'لا يوجد عرض جارٍ.' },
  { state: 'upcoming', title: 'قادمة', empty: 'لا توجد عروض قادمة.' },
  { state: 'ended', title: 'منتهية', empty: 'لا توجد عروض منتهية.' },
];

// Points offers (spec 2026-11-19): orders created during an offer earn ×N points (the higher of the
// customer's level and the offer). The points staff create them here; customers are told on start.
const LoyaltyPromotions = () => {
  const motion = useDialogMotion();
  const [list, setList] = useState<Promotion[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Promotion | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ kind: 'end' | 'delete', promotion: Promotion } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get('loyalty/promotions')
      .then((res: any) => setList(Array.isArray(res.data) ? res.data : []))
      .catch((e: any) => setError(requestError(e, 'تعذّر تحميل العروض.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'end') await api.post(`loyalty/promotions/${confirm.promotion._id}/end`, {});
      else await api.delete(`loyalty/promotions/${confirm.promotion._id}`, {});
      setConfirm(null);
      load();
    } catch (e: any) {
      setError(requestError(e, 'لم تتم العملية. حاول مرة أخرى.'));
      setConfirm(null);
    }
    setBusy(false);
  };

  const card = (p: Promotion) => (
    <li key={p._id} className={`lpr-card is-${p.state}`}>
      <div className="lpr-card__top">
        <span className="lpr-times"><Num>×{p.multiplierPct / 100}</Num></span>
        <div className="lpr-card__name">
          <b dir="auto">{p.name}</b>
          <span className="lp-muted">على {coverText(p)}</span>
        </div>
      </div>
      <p className="lpr-dates">
        من <Num>{fullDate(p.startsAt)}</Num> إلى <Num>{fullDate(toDayOf(p))}</Num>
        {p.endedEarlyAt && <span className="lpr-tag">أُنهي مبكراً</span>}
        {p.notifiedAt ? <span className="lpr-tag is-ok">أُبلغ العملاء</span> : p.notify && <span className="lpr-tag">يُبلَّغ العملاء عند بدايته</span>}
      </p>
      {p.state !== 'upcoming' && (
        <dl className="lpr-stats">
          <div><dt>طلبيات كسبت به</dt><dd><Num>{pointsText(p.orders)}</Num></dd></div>
          <div><dt>نقاط أضافها العرض</dt><dd><Num>{pointsText(p.bonusPoints)}</Num></dd></div>
        </dl>
      )}
      {p.state !== 'ended' && (
        <div className="lpr-actions">
          <Button size="small" onClick={() => setEditing(p)}>{p.state === 'active' ? 'تعديل الاسم والإبلاغ' : 'تعديل'}</Button>
          {p.state === 'active'
            ? <Button size="small" color="error" onClick={() => setConfirm({ kind: 'end', promotion: p })}>إنهاء العرض الآن</Button>
            : <Button size="small" color="error" onClick={() => setConfirm({ kind: 'delete', promotion: p })}>حذف</Button>}
        </div>
      )}
    </li>
  );

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>عروض النقاط</h1>
          <p>مضاعفة النقاط لطلبيات تُنشأ في أيام محددة، مثل الجمعة البيضاء. يأخذ العميل الأعلى بين عضويته والعرض.</p>
          <Link to="/loyalty" className="lp-head__link">العودة إلى النقاط</Link>
          <Button variant="contained" onClick={() => setEditing(null)} sx={{ mt: 1 }}>عرض جديد</Button>
        </header>

        {error && <Alert severity="error" action={<Button size="small" onClick={load}>إعادة</Button>}>{error}</Alert>}

        {GROUPS.map((g, i) => {
          const mine = (list || []).filter((p) => p.state === g.state);
          return (
            <section key={g.state} className="lpr-group" style={stagger(i + 1)} aria-label={g.title}>
              <h2>{g.title} {list && <Num>{mine.length}</Num>}</h2>
              {!list ? <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} /> : mine.length ? <ul className="lpr-list">{mine.map(card)}</ul> : <p className="lp-muted">{g.empty}</p>}
            </section>
          );
        })}
      </div>

      <PromotionDialog open={editing !== undefined} promotion={editing || null} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />

      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)} className="lp-dialog" {...motion}>
        <DialogTitle>{confirm?.kind === 'end' ? 'إنهاء العرض الآن؟' : 'حذف العرض؟'}</DialogTitle>
        <DialogContent dir="rtl">
          {confirm?.kind === 'end'
            ? 'لن تدخل العرض الطلبيات التي تُنشأ من الآن. الطلبيات التي أُنشئت قبل الإنهاء تبقى بنقاط العرض.'
            : 'لم يبدأ العرض بعد، ولن يراه العملاء.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={busy}>تراجع</Button>
          <Button color="error" variant="contained" onClick={act} disabled={busy}>{confirm?.kind === 'end' ? 'إنهاء' : 'حذف'}</Button>
        </DialogActions>
      </Dialog>
    </LoyaltyRtl>
  );
};

export default LoyaltyPromotions;
