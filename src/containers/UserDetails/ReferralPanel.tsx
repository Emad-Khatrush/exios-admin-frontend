import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { MdPersonAdd } from 'react-icons/md';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { fullDate } from '../Loyalty/format';
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
  qualified: number
}

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
    : info.qualifiedAt ? `دفع 50$ في ${fullDate(info.qualifiedAt)} · حصة الداعي حتى ${fullDate(info.shareEndsAt as string)}`
      : 'لم يدفع 50$ بعد';

  return (
    <section className="lpx-card lpx-ref">
      <header className="lpx-card__head">
        <h3 className="lpx-card__title"><MdPersonAdd aria-hidden="true" /> دعوة صديق</h3>
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
        </p>
      ) : (
        <p className="lpx-ref__line lp-muted">لم يُدعَ من أحد.{info.canSet && info.canSetUntil && <> يمكن إضافة من دعاه حتى {fullDate(info.canSetUntil)}.</>}</p>
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
              <p className="lp-muted">يأخذ العميل هدية الانضمام فوراً، ويكسب الداعي مكافأته عندما يدفع العميل 50$، ثم حصته لمدة سنة.</p>
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
