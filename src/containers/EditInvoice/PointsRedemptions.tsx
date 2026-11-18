import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { fullDate, money, pointsText, usdOf } from '../Loyalty/format';
import { LoyaltyRtl, Num, useDialogMotion } from '../Loyalty/LoyaltyRtl';
import '../Loyalty/loyalty.scss';

// One use of points on the order (GET order/:id/loyalty, staff): `canceled` once staff undid it
// (or the order was cancelled and they came back)
export type Redemption = {
  id: string
  points: number
  usd?: number
  createdAt?: string
  by?: string
  canceled: { at?: string | null, by?: string | null, reason?: string } | null
  // The delivery invoice its packages were handed over in: cancelled only from the customer's
  // Created Invoices (by cancelling the invoice or the shipment), never here
  invoice?: { id: string, referenceId: number } | null
}

type Props = {
  orderId: string
  redemptions: Redemption[]
  // Staff with `loyalty` or `invoices_payments` (or an admin) may cancel
  canCancel: boolean
  // After a cancel: the payments, the order's dues and the points are read again
  onChanged: () => void
}

const SHOWN = 3;
const REASONS = ['استُعملت بالخطأ', 'طلب العميل', 'تعديل الفاتورة'];

// The points the order was paid with, one line per use, newest first; an active one can be cancelled
const PointsRedemptions = ({ orderId, redemptions, canCancel, onChanged }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const [target, setTarget] = useState<Redemption | null>(null);
  if (!redemptions.length) return null;
  const rows = showAll ? redemptions : redemptions.slice(0, SHOWN);

  return (
    <LoyaltyRtl>
      <div className="lp-redemptions" dir="rtl">
        <span className="lp-label">مدفوع بالنقاط</span>
        <ul>
          {rows.map((row) => (
            <li key={row.id} className={row.canceled ? 'is-canceled' : undefined}>
              <span className="lp-redemptions__when"><Num>{fullDate(row.createdAt)}</Num></span>
              <span className="lp-redemptions__amount"><Num>{pointsText(row.points)}</Num> نقطة (<Num>${money(usdOf(row))}</Num>)</span>
              {row.by && <span className="lp-redemptions__by">بواسطة <bdi>{row.by}</bdi></span>}
              {row.canceled
                ? <span className="lp-redemptions__note">أُلغيت: <bdi>{row.canceled.reason || '—'}</bdi>{row.canceled.by ? <> (<bdi>{row.canceled.by}</bdi>)</> : null}</span>
                : row.invoice
                  ? <span className="lp-redemptions__note">في فاتورة التسليم <Num>#0{row.invoice.referenceId}</Num>: تُلغى من فواتير العميل</span>
                  : canCancel && <button type="button" className="lp-text-btn" onClick={() => setTarget(row)}>إلغاء</button>}
            </li>
          ))}
        </ul>
        {redemptions.length > SHOWN && (
          <button type="button" className="lp-text-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'عرض أقل' : <>عرض الكل (<Num>{redemptions.length}</Num>)</>}
          </button>
        )}
      </div>
      <CancelRedemptionDialog orderId={orderId} redemption={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); onChanged(); }} />
    </LoyaltyRtl>
  );
};

const CancelRedemptionDialog = ({ orderId, redemption, onClose, onDone }: { orderId: string, redemption: Redemption | null, onClose: () => void, onDone: () => void }) => {
  const motion = useDialogMotion();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!redemption) return;
    setReason('');
    setError('');
  }, [redemption]);

  const save = async () => {
    if (!redemption) return;
    setError('');
    setIsSaving(true);
    try {
      await api.post(`order/${orderId}/loyalty/redemptions/${redemption.id}/cancel`, { reason: reason.trim() });
      onDone();
    } catch (e: any) {
      setError(requestError(e, 'تعذّر إلغاء النقاط.'));
    } finally {
      setIsSaving(false);
    }
  };

  const points = redemption?.points || 0;
  return (
    <Dialog
      open={!!redemption} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="xs" dir="rtl"
      PaperProps={{ className: 'lp lp-dialog' }} {...motion}
    >
      <DialogTitle>إلغاء استعمال <Num>{pointsText(points)}</Num> نقطة؟</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" dir="auto">{error}</Alert>}
        <p className="lp-muted" style={{ margin: 0 }}>
          ترجع النقاط إلى رصيد العميل، ويعود <Num>${money(redemption ? usdOf(redemption) : 0)}</Num> مستحقاً عليه في هذه الطلبية.
        </p>
        <div>
          <TextField
            fullWidth required multiline minRows={2} autoFocus label="سبب الإلغاء" dir="auto" value={reason} disabled={isSaving}
            onChange={(event) => setReason(event.target.value)} helperText={!reason.trim() ? 'السبب إجباري' : ''}
          />
          <div className="lp-quick" role="group" aria-label="أسباب مقترحة">
            {REASONS.map((text) => (
              <button key={text} type="button" className="lp-chip lp-press" aria-pressed={reason === text} disabled={isSaving} onClick={() => setReason(text)}>{text}</button>
            ))}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>تراجع</Button>
        <Button variant="contained" color="error" onClick={save} disabled={isSaving || !reason.trim()}>{isSaving ? 'جارٍ الإلغاء' : 'تأكيد الإلغاء'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PointsRedemptions;
