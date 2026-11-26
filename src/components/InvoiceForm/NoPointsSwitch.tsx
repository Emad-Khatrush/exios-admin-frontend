import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Button, FormControlLabel, Switch, TextField } from '@mui/material';
import moment from 'moment';
import api from '../../api';
import { useStaffAccess } from '../../utils/useStaffAccess';
import { requestError } from '../../containers/Loyalty/PaymentPoints';
import { LoyaltyRtl, Num } from '../../containers/Loyalty/LoyaltyRtl';
import '../../containers/Loyalty/loyalty.scss';

type NoPoints = { reason?: string, by?: any, at?: string } | null;

// "No loyalty points" for one order: the customer earns nothing on it. Saved on its own (not with
// the order form) and only for staff with the loyalty permission; a reason is required.
const NoPointsSwitch = ({ orderId, disabled }: { orderId: string, disabled?: boolean }) => {
  const staff = useStaffAccess();
  const isAdmin = useSelector((state: any) => !!state.session.account?.roles?.isAdmin);
  const allowed = isAdmin || staff.can('loyalty');
  const [state, setState] = useState<NoPoints>(null);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowed || !orderId) return;
    let stale = false;
    api.get(`order/${orderId}/loyalty`, { category: 'invoice' })
      .then((res: any) => {
        if (stale) return;
        const noPoints: NoPoints = res.data?.noPoints || null;
        setState(noPoints);
        setEnabled(!!noPoints);
        setReason(noPoints?.reason || '');
        setLoaded(true);
      })
      .catch(() => { /* the backend may not be there yet: the switch stays hidden */ });
    return () => { stale = true; };
  }, [allowed, orderId]);

  if (!allowed || !loaded) return null;

  const changed = enabled !== !!state || (enabled && reason.trim() !== (state?.reason || ''));
  const save = async () => {
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      const res = await api.update(`order/${orderId}/loyalty/no-points`, { enabled, reason: reason.trim() });
      const noPoints: NoPoints = res.data?.noPoints !== undefined ? res.data.noPoints : (enabled ? { reason: reason.trim(), at: new Date().toISOString() } : null);
      setState(enabled ? noPoints || { reason: reason.trim() } : null);
      setSaved(true);
    } catch (e: any) {
      setError(requestError(e, 'تعذّر الحفظ.'));
    } finally {
      setBusy(false);
    }
  };

  const by = state?.by ? (typeof state.by === 'string' ? state.by : [state.by.firstName, state.by.lastName].filter(Boolean).join(' ') || state.by.username) : '';

  return (
    <LoyaltyRtl>
      <div className="lp-switch" dir="rtl" style={{ marginTop: 12 }}>
        <FormControlLabel
          control={<Switch checked={enabled} disabled={disabled || busy} onChange={(event) => { setEnabled(event.target.checked); setSaved(false); setError(''); }} />}
          label="بدون نقاط ولاء"
        />
        {(enabled || state) && (
          <TextField
            className="lp-fade-in" fullWidth size="small" label="سبب الاستثناء" required multiline minRows={2} dir="auto" value={reason} disabled={disabled || busy || !enabled}
            onChange={(event) => { setReason(event.target.value); setSaved(false); }}
            error={enabled && changed && !reason.trim()} helperText={enabled && !reason.trim() ? 'السبب إجباري' : 'للموظفين فقط؛ العميل يرى أن يتواصل معنا'}
          />
        )}
        {state && (
          <p className="op-muted" style={{ margin: '6px 0 0' }}>
            {by ? <>بواسطة <bdi>{by}</bdi></> : 'حُدّد'}
            {state.at ? <> في <Num>{moment(state.at).format('DD/MM/YYYY HH:mm')}</Num></> : ''}
          </p>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }} dir="auto">{error}</Alert>}
        {saved && !error && <Alert severity="success" sx={{ mt: 1 }} className="lp-fade-in">تم الحفظ</Alert>}
        {changed && (
          <Button sx={{ mt: 1 }} variant="outlined" size="small" type="button" onClick={save} disabled={busy || disabled || (enabled && !reason.trim())}>حفظ إعداد النقاط</Button>
        )}
      </div>
    </LoyaltyRtl>
  );
};

export default NoPointsSwitch;
