import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { MdPersonAdd } from 'react-icons/md';
import { Link } from 'react-router-dom';
import api from '../../api';
import '../Loyalty/loyalty.scss';
import { requestError } from '../Loyalty/PaymentPoints';
import { fullDate, money, pointsText } from '../Loyalty/format';
import { PASSPORT_TEXT, ReferralStatus, SOURCE_TEXT, STATUS_TEXT } from '../Loyalty/LoyaltyReferralReport';
import { Num, useDialogMotion } from '../Loyalty/LoyaltyRtl';

// GET user/:id/referral (invite a friend, spec 2026-11-20 in Exios-Api)
type Info = {
  code: string | null
  by: { id: string, name: string, customerId?: string } | null
  at: string | null
  source: 'link' | 'code' | 'staff' | null
  qualifiedAt: string | null
  shareEndsAt: string | null
  canceledAt: string | null
  cancelReason: string | null
  canSet: boolean
  canSetUntil: string | null
  invited: number
  qualifyUsd?: number
  // When this customer became «سفير إكسيوس» (10 friends and $10,000): their share is 15 points per $50 since
  ambassadorAt?: string | null
  // Signs both sides may be one person or one family, and the office's review of them
  flags?: { code: string, detail: string }[]
  review?: { status: 'pending' | 'approved' | 'rejected', at: string | null, note: string | null } | null
  qualified: number
  // Every friend they invited (staff only): what the friend paid and what the inviter got from them
  friends?: Friend[]
}
type Friend = {
  id: string, name: string, customerId: string | null, at: string, source: 'link' | 'code' | 'staff' | null, status: ReferralStatus,
  qualifiedAt: string | null, canceledAt: string | null, passport: string | null, paidUsd: number, points: number, heldPoints: number,
}
// Friends shown before «عرض الكل»
const FRIENDS_FIRST = 5;

const SOURCE: Record<string, string> = { link: 'برابط الدعوة', code: 'بكتابة الكود', staff: 'أضافها موظف' };

type Props = { userId: string, canEdit: boolean, onChanged: () => void }

// Who invited the customer and how many they invited; staff with «إضافة وخصم نقاط العميل» set the
// inviter within 7 days of the account, or cancel the rewards from this friend.
const ReferralPanel = ({ userId, canEdit, onChanged }: Props) => {
  const motion = useDialogMotion();
  const [info, setInfo] = useState<Info | null>(null);
  const [dialog, setDialog] = useState<'' | 'set' | 'cancel'>('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [allFriends, setAllFriends] = useState(false);

  const load = useCallback(() => {
    api.get(`user/${userId}/referral`).then((res: any) => setInfo(res?.data || null)).catch(() => setInfo(null));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (!info) return null;

  const open = (which: 'set' | 'cancel') => { setValue(''); setError(''); setDialog(which); };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = dialog === 'set'
        ? await api.update(`user/${userId}/referral`, { code: value.trim() })
        : await api.delete(`user/${userId}/referral`, { reason: value.trim() });
      setInfo(res.data);
      setDialog('');
      onChanged();
    } catch (e: any) {
      setError(requestError(e, dialog === 'set' ? 'تعذّر حفظ الدعوة.' : 'تعذّر إلغاء الدعوة.'));
    } finally {
      setSaving(false);
    }
  };

  const status = info.canceledAt ? `أُلغيت ${fullDate(info.canceledAt)}${info.cancelReason ? ` · ${info.cancelReason}` : ''}`
    : info.qualifiedAt ? `دفع ${info.qualifyUsd || 200}$ في ${fullDate(info.qualifiedAt)} · حصة الداعي حتى ${fullDate(info.shareEndsAt as string)}`
      : `لم يصل إلى ${info.qualifyUsd || 200}$ بعد`;

  return (
    <section className="lpx-card lpx-ref">
      <header className="lpx-card__head">
        <h3 className="lpx-card__title"><MdPersonAdd aria-hidden="true" /> دعوة صديق
          {info.ambassadorAt && <span className="lpx-ref__amb" title={`منذ ${fullDate(info.ambassadorAt)} · حصته 15 نقطة عن كل 50$`}>سفير إكسيوس</span>}
        </h3>
        <span className="lpx-card__aside">
          دعا <strong><Num>{info.invited}</Num></strong>{info.invited ? <>، دفع منهم <strong><Num>{info.qualified}</Num></strong></> : null}
          {info.code && <> · كوده <bdi dir="ltr">{info.code}</bdi></>}
        </span>
      </header>
      {info.by ? (
        <p className="lpx-ref__line">
          دعاه <b>{info.by.name}</b>{info.by.customerId && <> (<bdi dir="ltr">{info.by.customerId}</bdi>)</>}
          {info.at && <> · {fullDate(info.at)}</>}{info.source && <> · {SOURCE[info.source]}</>}
          <br /><span className="lp-muted">{status}</span>
          {!!info.flags?.length && (
            <>
              <br />
              {info.flags.map((f) => <span key={f.code} className="lpr-tag lrv-flag">{f.detail}</span>)}
              {info.review && <span className={`lpr-tag${info.review.status === 'approved' ? ' is-ok' : ''}`}>
                {info.review.status === 'pending' ? <>تنتظر المراجعة · <Link to="/loyalty/referrals">مراجعة الدعوات</Link></>
                  : info.review.status === 'approved' ? 'وافق عليها المكتب' : `رُفضت${info.review.note ? `: ${info.review.note}` : ''}`}
              </span>}
            </>
          )}
        </p>
      ) : (
        <p className="lpx-ref__line lp-muted">لم يُدعَ من أحد.{info.canSet && info.canSetUntil && <> يمكن إضافة من دعاه حتى {fullDate(info.canSetUntil)}.</>}</p>
      )}
      {!!info.friends?.length && (
        <div className="lpx-ref__friends">
          <p className="lpx-ref__line"><b>من دعاهم</b> <span className="lp-muted">· أخذ منهم <Num>{pointsText(info.friends.reduce((sum, f) => sum + f.points, 0))}</Num> نقطة
            {info.friends.some((f) => f.heldPoints > 0) && <> و<Num>{pointsText(info.friends.reduce((sum, f) => sum + f.heldPoints, 0))}</Num> تنتظر</>}</span></p>
          <div className="lp-table-wrap">
            <table className="lp-table lrr-table">
              <thead><tr><th>الصديق</th><th>التسجيل</th><th>الحالة</th><th>الجواز</th><th className="is-num">دفع</th><th className="is-num">للداعي</th></tr></thead>
              <tbody>
                {(allFriends ? info.friends : info.friends.slice(0, FRIENDS_FIRST)).map((f) => (
                  <tr key={f.id}>
                    <td><Link to={`/user/${f.id}`}>{f.name}{f.customerId && <> (<bdi dir="ltr">{f.customerId}</bdi>)</>}</Link></td>
                    <td><Num>{fullDate(f.at)}</Num>{f.source && <span className="lp-muted"> · {SOURCE_TEXT[f.source]}</span>}</td>
                    <td><span className={`lpr-tag lrr-st is-${f.status}`}>{STATUS_TEXT[f.status]}</span></td>
                    <td>{PASSPORT_TEXT[f.passport || ''] || 'بدون'}</td>
                    <td className="is-num"><Num>${money(f.paidUsd)}</Num></td>
                    <td className="is-num"><Num>{pointsText(f.points)}</Num>{f.heldPoints > 0 && <div className="lp-muted lrr-why">+<Num>{pointsText(f.heldPoints)}</Num> تنتظر</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {info.friends.length > FRIENDS_FIRST && (
            <Button size="small" onClick={() => setAllFriends((v) => !v)}>{allFriends ? 'عرض أقل' : `عرض الكل (${info.friends.length})`}</Button>
          )}
        </div>
      )}
      {canEdit && (info.canSet || (info.by && !info.canceledAt)) && (
        <div className="lpx-ref__actions">
          {info.canSet && <Button size="small" variant="outlined" onClick={() => open('set')}>إضافة من دعاه</Button>}
          {info.by && !info.canceledAt && <Button size="small" color="error" onClick={() => open('cancel')}>إلغاء الدعوة</Button>}
        </div>
      )}

      <Dialog open={!!dialog} onClose={saving ? undefined : () => setDialog('')} fullWidth maxWidth="xs" dir="rtl" PaperProps={{ className: 'lp lp-dialog' }} {...motion}>
        <DialogTitle>{dialog === 'set' ? 'إضافة من دعا هذا العميل' : 'إلغاء الدعوة'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" dir="auto" sx={{ mb: 1.5 }}>{error}</Alert>}
          {dialog === 'set' ? (
            <>
              <p className="lp-muted">يأخذ العميل هدية الانضمام فوراً، ويكسب الداعي مكافأته عندما يصل مجموع ما يدفعه العميل {info.qualifyUsd || 200}$، ثم حصته لمدة سنة.</p>
              <TextField fullWidth autoFocus label="كود دعوة الداعي" value={value} disabled={saving} sx={{ mt: 2 }}
                inputProps={{ dir: 'ltr', maxLength: 8 }} onChange={(e) => setValue(e.target.value.toUpperCase())} />
            </>
          ) : (
            <>
              <p className="lp-muted">لن يكسب الداعي أي مكافأة أو حصة أخرى من هذا العميل. ما أُعطي قبل ذلك يبقى (يمكن خصمه بتعديل النقاط).</p>
              <TextField fullWidth required multiline minRows={2} label="السبب" dir="auto" value={value} disabled={saving} sx={{ mt: 2 }}
                placeholder="مثال: حساب مكرر" onChange={(e) => setValue(e.target.value)} helperText="يظهر للموظفين فقط" />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog('')} disabled={saving}>تراجع</Button>
          <Button variant="contained" color={dialog === 'cancel' ? 'error' : 'primary'} onClick={save} disabled={saving || !value.trim()}>
            {saving ? 'جارٍ الحفظ' : dialog === 'set' ? 'حفظ' : 'إلغاء الدعوة'}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
};

export default ReferralPanel;
