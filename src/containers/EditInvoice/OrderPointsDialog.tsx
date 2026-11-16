import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import api from '../../api';
import { LoyaltyRtl, Num, useDialogMotion } from '../Loyalty/LoyaltyRtl';
import '../Loyalty/loyalty.scss';

type Category = 'invoice' | 'receivedGoods';

type Props = {
  open: boolean
  // What is being paid: the purchase invoice, or the shipping of the chosen packages
  category: Category
  order: any
  packages: any[]
  // What the customer still owes for it, in dollars (the server's own figure replaces it once loaded)
  dueUsd: number
  onClose: () => void
  // The points were taken: the page re-reads its payments
  onRedeemed: (message: string) => void
  // Opens the wallet dialog for what is still due after the points
  onPayRest: (category: Category, packages: any[], dueUsd: number) => void
}

export type PointsQuote = { balance: number, maxPoints: number, owedCents: number, billedCents: number, usedOnTarget: number };

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pointsText = (value: number) => Number(value || 0).toLocaleString('en-US');
const cents = (points: number) => `$${money(points / 100)}`;

// The message of a failed request: the server writes it (in Arabic) and it is shown as it is
export const requestError = (error: any, fallback: string) => {
  const data = error?.response?.data;
  const message = typeof data === 'string' ? data : data?.message || data?.error;
  return typeof message === 'string' && message ? message : fallback;
};

// Loads what the customer's points can pay on this part of the order. The quote stays null while
// loading or when the request fails (callers then show nothing about points).
export const useOrderQuote = (open: boolean, order: any, category: string, packages: any[]) => {
  const [quote, setQuote] = useState<PointsQuote | null>(null);
  const [failed, setFailed] = useState('');
  const [loading, setLoading] = useState(false);
  const ids = packages.map((row: any) => row._id).filter(Boolean).join(',');
  useEffect(() => {
    setQuote(null);
    if (!open || !order?._id) return;
    let stale = false;
    setLoading(true);
    setFailed('');
    api.get(`order/${order._id}/loyalty`, { category, ...(ids ? { packageIds: ids } : {}) })
      .then((res: any) => { if (!stale) setQuote(res.data?.quote || null); })
      .catch((error: any) => { if (!stale) { setQuote(null); setFailed(requestError(error, 'تعذّر تحميل نقاط العميل.')); } })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [open, order?._id, category, ids]);
  return { quote, failed, loading };
};

// Pays part of an order with the customer's loyalty points. Only staff do this. It shows what is
// due, the customer's points, the most that may be used (20%), and what is left to pay.
const OrderPointsDialog = ({ open, category, order, packages, dueUsd, onClose, onRedeemed, onPayRest }: Props) => {
  const { quote, failed, loading } = useOrderQuote(open, order, category, packages);
  const motion = useDialogMotion();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Set after a successful redemption: what is left to pay
  const [done, setDone] = useState<{ points: number, remainingUsd: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setError('');
    setDone(null);
  }, [open]);

  const max = quote?.maxPoints ?? 0;
  const balance = quote?.balance ?? 0;
  // The page's own figure (it includes transport and customs fees); the quote only sets the cap
  const dueNow = dueUsd;
  const feesExcluded = !!quote && quote.owedCents / 100 < dueUsd - 0.005;
  const points = Number(value) || 0;
  const invalid = value !== '' && (!Number.isInteger(points) || points < 0);
  const over = points > max;
  const canConfirm = !!quote && points > 0 && !over && !invalid && !isSaving;
  const discount = Math.min(Math.max(points, 0), Math.max(max, 0)) / 100;

  // Typing beyond the maximum is held at the maximum
  const change = (text: string) => {
    setError('');
    if (text === '') return setValue('');
    const next = Math.floor(Number(text));
    if (Number.isNaN(next) || next < 0) return;
    setValue(String(Math.min(next, max)));
  };

  const confirm = async () => {
    setError('');
    setIsSaving(true);
    try {
      const body: any = { points, category };
      const ids = packages.map((row: any) => row._id).filter(Boolean);
      if (ids.length) body.packageIds = ids;
      const res = await api.post(`order/${order._id}/loyalty/redeem`, body);
      const result = res.data || {};
      const used = Number(result.points ?? points);
      // What is left of the page's figure (the server's own figure leaves the fees out)
      const remainingUsd = Math.max(0, dueNow - used / 100);
      setDone({ points: used, remainingUsd });
      onRedeemed(`تم استعمال ${pointsText(used)} نقطة (${cents(used)})`);
    } catch (e: any) {
      setError(requestError(e, 'تعذّر استعمال النقاط.'));
    } finally {
      setIsSaving(false);
    }
  };

  const label = category === 'invoice' ? 'فاتورة الشراء' : <>شحن الطرود المختارة (<Num>{packages.length}</Num>)</>;
  const remaining = Math.max(0, dueNow - discount);

  return (
    <LoyaltyRtl>
      <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm" dir="rtl" {...motion}>
        <DialogTitle>
          استعمال النقاط
          <span className="op-dialog__sub">{label}، طلبية <Num>{order?.orderId}</Num></span>
        </DialogTitle>
        <DialogContent dividers>
          {done ? (
            <Alert severity="success" className="op-alert op-alert--tight lp-fade-in">
              خُصمت <Num>{pointsText(done.points)}</Num> نقطة (<Num>{cents(done.points)}</Num>).{' '}
              {done.remainingUsd > 0.005 ? <>المتبقي للدفع <Num>${money(done.remainingUsd)}</Num>.</> : 'لم يبقَ شيء للدفع.'}
            </Alert>
          ) : (
            <>
              {(error || failed) && <Alert severity="error" className="op-alert op-alert--tight" dir="auto">{error || failed}</Alert>}

              <dl className="lp lp-quote">
                <div><dt>نقاط العميل</dt><dd>{loading ? '...' : quote ? <><Num>{pointsText(balance)}</Num> نقطة (<Num>${money(balance / 100)}</Num>)</> : '-'}</dd></div>
                <div><dt>الحد الأقصى (20%)</dt><dd>{loading ? '...' : quote ? <><Num>{pointsText(max)}</Num> نقطة (<Num>{cents(max)}</Num>)</> : '-'}</dd></div>
              </dl>

              {feesExcluded && <Alert severity="info" className="op-alert">النقاط لا تدفع رسوم النقل الداخلي أو التخليص.</Alert>}

              {quote && max <= 0 && !loading && <Alert severity="info" className="op-alert">لا يمكن استعمال نقاط في هذه الدفعة.</Alert>}

              <div className="op-fields">
                <TextField
                  label="النقاط المستعملة" type="number" autoFocus value={value} disabled={!quote || max <= 0 || isSaving}
                  onChange={(event) => change(event.target.value)} onWheel={(event: any) => event.target.blur()}
                  inputProps={{ min: 0, max, step: 1, dir: 'ltr' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">نقطة</InputAdornment> }}
                  error={invalid || over} helperText={over ? <>الحد الأقصى <Num>{pointsText(max)}</Num> نقطة</> : invalid ? 'أرقام صحيحة فقط' : ''}
                />
                <div className="op-actions op-actions--start">
                  <Button size="small" type="button" onClick={() => setValue(String(max))} disabled={!quote || max <= 0 || isSaving}>الحد الأقصى</Button>
                  <Button size="small" type="button" onClick={() => setValue('')} disabled={!value || isSaving}>مسح</Button>
                </div>
              </div>

              <dl className="lp lp-receipt" dir="rtl">
                <div><dt>المبلغ المستحق</dt><dd>{dueNow > 0 ? <Num>${money(dueNow)}</Num> : 'لا يوجد مبلغ مستحق'}</dd></div>
                <div className="is-discount"><dt>خصم النقاط</dt><dd>{discount > 0 ? <Num>−${money(discount)}</Num> : '—'}</dd></div>
                <div className="is-total">
                  <dt>المتبقي للدفع</dt>
                  <dd aria-live="polite"><Num key={remaining.toFixed(2)} className="lp-tick">${money(remaining)}</Num></dd>
                </div>
              </dl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {done ? (
            <>
              <Button onClick={onClose}>إغلاق</Button>
              {done.remainingUsd > 0.005 && (
                <Button variant="contained" onClick={() => { onClose(); onPayRest(category, packages, done.remainingUsd); }}>ادفع الباقي من المحفظة</Button>
              )}
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={isSaving}>إلغاء</Button>
              <Button variant="contained" onClick={confirm} disabled={!canConfirm}>{isSaving ? 'جارٍ التأكيد' : 'تأكيد'}</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </LoyaltyRtl>
  );
};

export default OrderPointsDialog;
