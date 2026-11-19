import { useEffect, useState } from 'react';
import { Alert, Button, InputAdornment, TextField } from '@mui/material';
import { Coins } from 'lucide-react';
import api from '../../api';
import { LoyaltyRtl, Num } from './LoyaltyRtl';
import { money, pointsText } from './format';
// @ts-ignore -- intentional side-effect stylesheet import
import './loyalty.scss';

// Points are not a step of their own (owner's decision): they are a field inside each payment form
// (a wallet payment on an order, a delivery). The form sends `points` with its payment and the
// server takes both in one transaction. This file holds that field and the quote it reads.

// `off`: the customer's points are switched off (nothing can be paid with them)
export type PointsQuote = { balance: number, maxPoints: number, owedCents: number, billedCents: number, usedOnTarget: number, off?: boolean };

// The message of a failed request: the server writes it (in Arabic) and it is shown as it is
export const requestError = (error: any, fallback: string) => {
  const data = error?.response?.data;
  const message = typeof data === 'string' ? data : data?.message || data?.error;
  return typeof message === 'string' && message ? message : fallback;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// Reads what the customer's points can pay on a target. `url` null: nothing is read (no permission,
// dialog closed). A new target clears the old figures at once; the last balance is kept so the row
// does not jump while the new quote loads.
export const usePointsQuote = (url: string | null, params: Record<string, string>) => {
  const [quote, setQuote] = useState<PointsQuote | null>(null);
  const [balance, setBalance] = useState(0);
  const [failed, setFailed] = useState('');
  const [loading, setLoading] = useState(false);
  const key = url ? `${url}?${new URLSearchParams(params).toString()}` : '';
  useEffect(() => {
    setQuote(null);
    setFailed('');
    if (!url) { setBalance(0); return; }
    let stale = false;
    setLoading(true);
    api.get(url, params)
      .then((res: any) => {
        if (stale) return;
        const next = res.data?.quote ?? res.data ?? null;
        setQuote(next);
        setBalance(Number(next?.balance) || 0);
      })
      .catch((error: any) => { if (!stale) setFailed(requestError(error, 'تعذّر تحميل نقاط العميل.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
    // `key` stands for url and params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote, balance, failed, loading };
};

// The points typed, held to whole numbers and to the maximum; '' when none
export const holdPoints = (text: string, max: number) => {
  if (text === '') return '';
  const next = Math.floor(Number(text));
  if (Number.isNaN(next) || next < 0) return null;
  return String(Math.min(next, Math.max(max, 0)));
};

// The points that go with the payment and what they take off, given the quote (0 while it loads)
export const pointsOf = (value: string, quote: PointsQuote | null) => {
  const max = Math.max(quote?.maxPoints ?? 0, 0);
  const points = quote ? Math.min(Math.max(Math.floor(Number(value) || 0), 0), max) : 0;
  return { points, usd: points / 100 };
};

// What is left to pay once the points are taken off (never below zero)
export const remainingAfter = (totalUsd: number, pointsUsd: number) => Math.max(0, round2(totalUsd - pointsUsd));

type Props = {
  quote: PointsQuote | null
  balance: number
  loading: boolean
  failed: string
  value: string
  onChange: (value: string) => void
  // The form's total before points (dollars, fees included)
  totalUsd: number
  disabled?: boolean
}

// The compact "النقاط" row of a payment form: the customer's points and the most this payment may
// use, the points typed, and the form's totals as a receipt (total, points, what is left to pay)
const PaymentPoints = ({ quote, balance, loading, failed, value, onChange, totalUsd, disabled }: Props) => {
  // No points, or the customer's points switched off: the form shows no points row
  if ((!(balance > 0) && !failed) || quote?.off) return null;
  const max = Math.max(quote?.maxPoints ?? 0, 0);
  const { usd: discount } = pointsOf(value, quote);
  const remaining = remainingAfter(totalUsd, discount);
  const feesLeft = !!quote && quote.owedCents / 100 < totalUsd - 0.005;
  const change = (text: string) => {
    const held = holdPoints(text, max);
    if (held !== null) onChange(held);
  };
  return (
    <LoyaltyRtl>
      <section className="lp lp-pay-points lp-fade-in" dir="rtl" aria-label="النقاط">
        <header className="lp-pay-points__head">
          <span className="lp-pay-points__coin" aria-hidden="true"><Coins size={15} strokeWidth={2} /></span>
          <span className="lp-pay-points__title">النقاط</span>
          <span className="lp-pay-points__facts">
            لدى العميل <Num>{pointsText(quote?.balance ?? balance)}</Num> نقطة (= <Num>${money((quote?.balance ?? balance) / 100)}</Num>)
            {' · '}الحد الأقصى {loading || !quote ? '…' : <Num>{pointsText(max)}</Num>}
          </span>
        </header>

        {failed && <Alert severity="error" className="lp-pay-points__alert" dir="auto">{failed}</Alert>}

        {quote && max > 0 && (
          <div className="lp-pay-points__row">
            <TextField
              size="small" label="النقاط المستعملة" type="number" value={value} disabled={disabled || loading}
              onChange={(event) => change(event.target.value)} onWheel={(event: any) => event.target.blur()}
              inputProps={{ min: 0, max, step: 1, dir: 'ltr', inputMode: 'numeric' }}
              InputProps={{ endAdornment: <InputAdornment position="end">نقطة</InputAdornment> }}
            />
            <Button size="small" type="button" onClick={() => onChange(String(max))} disabled={disabled || loading}>الحد الأقصى</Button>
            <Button size="small" type="button" onClick={() => onChange('')} disabled={disabled || !value}>مسح</Button>
          </div>
        )}
        {quote && max <= 0 && !loading && <p className="lp-pay-points__note">لا يمكن استعمال نقاط في هذه الدفعة (الحد الأقصى 20%، وما دُفع بالنقاط منها يُحسب).</p>}
        {feesLeft && max > 0 && <p className="lp-pay-points__note">النقاط لا تدفع رسوم النقل الداخلي أو التخليص.</p>}

        <dl className="lp-receipt lp-pay-points__receipt">
          <div><dt>الإجمالي</dt><dd><Num>${money(totalUsd)}</Num></dd></div>
          <div className="is-discount"><dt>خصم النقاط</dt><dd>{discount > 0 ? <Num>−${money(discount)}</Num> : '—'}</dd></div>
          <div className="is-total">
            <dt>المتبقي للدفع</dt>
            <dd aria-live="polite"><Num key={remaining.toFixed(2)} className="lp-tick">${money(remaining)}</Num></dd>
          </div>
        </dl>
      </section>
    </LoyaltyRtl>
  );
};

export default PaymentPoints;
