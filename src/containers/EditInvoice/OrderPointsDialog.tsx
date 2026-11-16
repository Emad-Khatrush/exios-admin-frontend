import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import api from '../../api';
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
      .catch((error: any) => { if (!stale) { setQuote(null); setFailed(requestError(error, 'Could not load the customer points.')); } })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [open, order?._id, category, ids]);
  return { quote, failed, loading };
};

// Pays part of an order with the customer's loyalty points. Only staff do this. It shows what is
// due, the customer's points, the most that may be used (20%), and what is left to pay.
const OrderPointsDialog = ({ open, category, order, packages, dueUsd, onClose, onRedeemed, onPayRest }: Props) => {
  const { quote, failed, loading } = useOrderQuote(open, order, category, packages);
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
      onRedeemed(`${pointsText(used)} points used (${cents(used)})`);
    } catch (e: any) {
      setError(requestError(e, 'Could not use the points.'));
    } finally {
      setIsSaving(false);
    }
  };

  const label = category === 'invoice' ? 'Purchase invoice' : `Shipping of ${packages.length} package${packages.length === 1 ? '' : 's'}`;

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Use points
        <span className="op-dialog__sub">{label}, order {order?.orderId}</span>
      </DialogTitle>
      <DialogContent dividers>
        {done ? (
          <Alert severity="success" className="op-alert op-alert--tight">
            {pointsText(done.points)} points ({cents(done.points)}) were taken off. {done.remainingUsd > 0.005 ? `$${money(done.remainingUsd)} is still due.` : 'Nothing is left to pay.'}
          </Alert>
        ) : (
          <>
            {(error || failed) && <Alert severity="error" className="op-alert op-alert--tight" dir="auto">{error || failed}</Alert>}

            <dl className="lp lp-quote">
              <div><dt>Customer points</dt><dd>{loading ? '...' : quote ? `${pointsText(balance)} ($${money(balance / 100)})` : '-'}</dd></div>
              <div><dt>Max usable (20%)</dt><dd>{loading ? '...' : quote ? `${pointsText(max)} points (${cents(max)})` : '-'}</dd></div>
            </dl>

            {feesExcluded && <Alert severity="info" className="op-alert">Points can't pay transport or customs fees.</Alert>}

            {quote && max <= 0 && !loading && <Alert severity="info" className="op-alert">No points can be used on this payment.</Alert>}

            <div className="op-fields">
              <TextField
                label="Points to use" type="number" autoFocus value={value} disabled={!quote || max <= 0 || isSaving}
                onChange={(event) => change(event.target.value)} onWheel={(event: any) => event.target.blur()}
                inputProps={{ min: 0, max, step: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">pts</InputAdornment> }}
                error={invalid || over} helperText={over ? `At most ${pointsText(max)} points` : invalid ? 'Whole points only' : ''}
              />
              <div className="op-actions op-actions--start">
                <Button size="small" type="button" onClick={() => setValue(String(max))} disabled={!quote || max <= 0 || isSaving}>Max</Button>
                <Button size="small" type="button" onClick={() => setValue('')} disabled={!value || isSaving}>Clear</Button>
              </div>
            </div>

            <dl className="lp lp-receipt">
              <div><dt>Amount due</dt><dd>{dueNow > 0 ? `$${money(dueNow)}` : 'Nothing is due'}</dd></div>
              <div className="is-discount"><dt>Points discount</dt><dd>{discount > 0 ? `−$${money(discount)}` : '—'}</dd></div>
              <div className="is-total"><dt>Remaining to pay</dt><dd>${money(Math.max(0, dueNow - discount))}</dd></div>
            </dl>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {done ? (
          <>
            <Button onClick={onClose}>Close</Button>
            {done.remainingUsd > 0.005 && (
              <Button variant="contained" onClick={() => { onClose(); onPayRest(category, packages, done.remainingUsd); }}>Pay the rest from wallet</Button>
            )}
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button variant="contained" onClick={confirm} disabled={!canConfirm}>{isSaving ? 'Confirming' : 'Confirm'}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default OrderPointsDialog;
