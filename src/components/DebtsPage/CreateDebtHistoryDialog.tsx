import { Alert, CircularProgress } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { CheckCircle2, Paperclip, Wallet, X } from 'lucide-react';
import moment from 'moment';
import api from '../../api';
import { calculateTotalWallet } from '../../utils/methods';
import { getErrorMessage } from '../../utils/errorHandler';
import { dinarPaymentRate, DinarRateLimits, DEBT_TYPE_LABELS, formatAmount, maxDebtPayment } from './wrapper-util';
import PaymentPoints, { pointsOf, usePointsQuote } from '../../containers/Loyalty/PaymentPoints';
import './Debts.scss';

/* Paying one debt from the customer's wallet (Record payment), in Arabic.
   - The wallet to pay from is chosen with two buttons showing what each holds; an empty one is off.
     On opening, the wallet that can pay is chosen and the amount filled: the whole debt, or all the
     wallet holds when that is less.
   - Dinars on a dollar debt are counted like an order's wallet payment: "سداد كامل" works the rate
     out so the amount closes the debt, "سداد جزئي" starts at the accountant's rate. Neither goes
     below the accountant's rate minus the tolerance (the API refuses lower too).
   - The strip at the top shows the debt now and after this payment, as it is typed.
   - Points (owner 2026-11-24): a dollar debt of an order's purchase or shipping takes the customer's
     loyalty points as a field of this form, under the 20% rule (the API's quote). They pay first;
     the wallet amount pays what they leave, or nothing when they close the debt. */

type Props = {
  setDialog: (state: any) => void
  item?: any
  debtType?: string
  // When given, the page refreshes in place after saving instead of reloading
  onSaved?: (message: string) => void
  onBusyChange?: (busy: boolean) => void
}
type Currency = 'USD' | 'LYD';

// What getErrorMessage says for a reason it has no wording of its own for
const UNEXPECTED_ERROR = getErrorMessage(undefined as any);
const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;
const SYMBOL: Record<Currency, string> = { USD: '$', LYD: 'د.ل' };
const WALLET_NAME: Record<Currency, string> = { USD: 'محفظة الدولار', LYD: 'محفظة الدينار' };

// Two decimals always, the number left-to-right and the currency after it in the Arabic flow
const money2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Money = ({ value, currency }: { value: number, currency: Currency }) => (
  <span className="dp-money"><bdi dir="ltr">{money2.format(Number(value) || 0)}</bdi> <span>{SYMBOL[currency]}</span></span>
);

const CreateDebtHistoryDialog = (props: Props) => {
  const debt = props.item || {};
  const owner = debt.owner;
  const debtLeft = Number(debt.amount) || 0;
  const debtCurrency: Currency = debt.currency === 'LYD' ? 'LYD' : 'USD';
  const { roles } = useSelector((state: any) => state.session.account);

  const [wallet, setWallet] = useState<any>();
  const [walletLoading, setWalletLoading] = useState(true);
  const [limits, setLimits] = useState<DinarRateLimits | null>(null);
  const [currency, setCurrency] = useState<Currency | ''>('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [typedRate, setTypedRate] = useState('');
  const [day, setDay] = useState(moment().format('YYYY-MM-DD'));
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The customer's points on this debt (no quote for a general debt or one in dinars)
  const points = usePointsQuote(debt._id ? `balances/${debt._id}/points` : null, {});
  const [pointsInput, setPointsInput] = useState('');
  const { points: pointsUsed, usd: pointsUsd } = pointsOf(pointsInput, points.quote?.maxPoints !== undefined ? points.quote : null);
  const canUsePoints = (points.quote?.maxPoints || 0) > 0;
  // What the wallet money pays: the debt less the points
  const remaining = Math.max(0, round2(debtLeft - pointsUsd));

  useEffect(() => {
    let active = true;
    api.get(`wallet/${owner?._id}`)
      .then((res: any) => { if (active) setWallet(res.data?.results); })
      .catch(() => undefined)
      .finally(() => { if (active) setWalletLoading(false); });
    return () => { active = false; };
  }, [owner?._id]);

  // The accountant's dinar rate depends on the payment day
  useEffect(() => {
    let active = true;
    api.get('payment-rate', { date: day })
      .then((res: any) => { if (active) setLimits(res.data?.limits || null); })
      .catch(() => { if (active) setLimits(null); });
    return () => { active = false; };
  }, [day]);

  const { totalUsd, totalLyd } = calculateTotalWallet(wallet);
  const held: Record<Currency, number> = { USD: totalUsd, LYD: totalLyd };
  // A dinar debt is paid from dinars only; a dollar debt from either wallet
  const allowed: Currency[] = debtCurrency === 'LYD' ? ['LYD'] : ['USD', 'LYD'];
  const usable = allowed.filter((c) => held[c] > 0);
  const walletEmpty = !walletLoading && usable.length === 0;
  // Nothing in the wallet, but the points can pay
  const pointsOnlyWay = walletEmpty && canUsePoints;

  // What closes the debt, in a currency (dinars at the accountant's rate)
  const dueIn = (c: Currency) => (c === debtCurrency ? remaining : limits ? remaining * limits.rate : 0);

  // Choosing a wallet fills the amount: the whole debt, or everything in it when that is less
  const choose = (c: Currency) => {
    const due = dueIn(c);
    setCurrency(c);
    setTypedRate('');
    setError(undefined);
    setMode(c !== debtCurrency && due > 0 && held[c] < due ? 'partial' : 'full');
    setAmount(due > 0 && held[c] > 0 ? String(round2(Math.min(due, held[c]))) : '');
  };

  // Once the wallet (and the rate) are known, pick the wallet that can pay
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || walletLoading || !usable.length) return;
    const first = usable.includes(debtCurrency) ? debtCurrency : usable[0];
    if (first !== debtCurrency && !limits) return; // dinars wait for the rate to fill the amount
    picked.current = true;
    choose(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletLoading, limits]);

  const converting = debtCurrency === 'USD' && currency === 'LYD';
  const value = Number(amount) || 0;
  const conversion = converting ? dinarPaymentRate({ remaining, amount: value, mode, typedRate: Number(typedRate) || 0, limits }) : null;
  const rate = conversion?.rate ?? 0;
  const counts = converting ? (rate > 0 ? value / rate : null) : value;
  const after = counts === null ? null : Math.max(0, round2(remaining - counts));
  const closes = after !== null && (value > 0 || pointsUsed > 0) && after <= 0.005;
  const left = currency ? round2(held[currency] - value) : 0;

  // What stops the payment, said where it can be fixed
  const problem = (() => {
    if (!currency || !amount) return '';
    if (pointsUsed > 0 && remaining <= 0 && value > 0) return 'النقاط تسدد كامل الدين؛ امسح المبلغ أو قلّل النقاط.';
    if (value <= 0) return 'اكتب مبلغاً أكبر من صفر.';
    if (value > held[currency] + 1e-9) return `الرصيد في ${WALLET_NAME[currency]} ${formatAmount(held[currency])} ${SYMBOL[currency]} فقط.`;
    if (converting) {
      if (!(rate > 0)) {
        return mode === 'partial'
          ? 'اكتب سعر الصرف الذي اتفقت عليه مع العميل.'
          : 'لا يوجد سعر صرف للدينار في هذا التاريخ. اطلب من الأدمن إدخاله في المحاسبة.';
      }
      if (conversion?.tooLow) {
        return mode === 'full'
          ? `المبلغ لا يكفي لإقفال الدين. ادفع ${formatAmount(conversion.closeFrom)} د.ل على الأقل، أو اختر سداد جزئي.`
          : `سعر الصرف أقل من المسموح. الأدنى ${round4(limits?.minimum || 0)}.`;
      }
    }
    const max = maxDebtPayment(remaining, debtCurrency, currency, converting ? rate : 0);
    if (max !== null && value > max + 1e-9) return `المبلغ أكبر من الدين. أقصى مبلغ ${formatAmount(max)} ${SYMBOL[currency]}.`;
    return '';
  })();

  // Points alone, or money (with or without points)
  const paysPointsOnly = pointsUsed > 0 && value <= 0;
  const canPay = !saving && !walletLoading && !problem && (paysPointsOnly || (!!currency && value > 0));

  // New points: the amount becomes what they leave (all of it from the chosen wallet, when it holds it)
  const lastPoints = useRef(0);
  useEffect(() => {
    if (lastPoints.current === pointsUsed) return;
    lastPoints.current = pointsUsed;
    if (!currency) return;
    const due = dueIn(currency);
    setAmount(due > 0 && held[currency] > 0 ? String(round2(Math.min(due, held[currency]))) : '');
    setMode(currency !== debtCurrency && due > 0 && held[currency] < due ? 'partial' : 'full');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsUsed]);

  const close = () => { if (!saving) props.setDialog({ customComponentTag: undefined, isOpen: false }); };

  // The API's own reason when the app has no wording of its own for it
  const showApiError = (message?: string) => {
    const text = getErrorMessage(message as any);
    setError(text === UNEXPECTED_ERROR && message ? message : text);
  };

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPay) return;
    const withMoney = !!currency && value > 0;
    const body = new FormData();
    body.append('createdAt', moment(day).isSame(moment(), 'day') ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString());
    if (withMoney) {
      body.append('amount', String(value));
      body.append('currency', currency as string);
      body.append('rate', String(converting ? rate : 0));
      body.append('sameCurrency', String(currency === debtCurrency));
    }
    if (pointsUsed > 0) body.append('points', String(pointsUsed));
    if (debt.debtType) body.append('debtType', debt.debtType);
    if (notes.trim()) body.append('notes', notes.trim());
    files.forEach((file) => body.append('files', file));

    setSaving(true);
    props.onBusyChange?.(true);
    setError(undefined);
    const res: any = await api.fetchFormData(`balances/${debt._id}/paymentHistory`, 'POST', body);
    setSaving(false);
    props.onBusyChange?.(false);
    if (res instanceof Error || res?.success === false) return showApiError(res?.message);
    const paid = [withMoney ? `${formatAmount(value)} ${SYMBOL[currency as Currency]}` : '', pointsUsed > 0 ? `${pointsUsed} نقطة` : ''].filter(Boolean).join(' و');
    const message = `تم تسديد ${paid} من دين ${owner?.customerId || 'العميل'}`;
    if (props.onSaved) props.onSaved(message);
    else window.location.reload();
  };

  return (
    <form className="debt-pay" dir="rtl" onSubmit={pay} aria-labelledby="dp-title">
      <header className="dp-header">
        <div>
          <h2 id="dp-title">تسديد دين</h2>
          <p>
            <bdi>{[owner?.firstName, owner?.lastName].filter(Boolean).join(' ')}</bdi>
            <bdi dir="ltr" className="dp-code">{owner?.customerId}</bdi>
            {DEBT_TYPE_LABELS[debt.debtType] && <span className="dp-tag">{DEBT_TYPE_LABELS[debt.debtType]}</span>}
          </p>
        </div>
        <button type="button" className="dp-close" onClick={close} aria-label="إغلاق" disabled={saving}><X size={18} /></button>
      </header>

      {/* The debt now, and after this payment */}
      <div className={`dp-ledger${closes ? ' is-closed' : ''}`} aria-live="polite">
        <div className="dp-ledger__side">
          <span>الدين الآن</span>
          <strong><Money value={debtLeft} currency={debtCurrency} /></strong>
        </div>
        <span className="dp-ledger__arrow" aria-hidden>←</span>
        <div className="dp-ledger__side is-after">
          <span>بعد هذه الدفعة</span>
          <strong>
            {after === null ? <span className="dp-ledger__wait">بانتظار سعر الصرف</span> : <Money value={after} currency={debtCurrency} />}
            {closes && <span className="dp-ledger__closed"><CheckCircle2 size={16} aria-hidden /> يُقفل</span>}
          </strong>
        </div>
      </div>

      <div className="dp-body">
        {error && <Alert severity="error" className="dp-alert">{error}</Alert>}
        {walletEmpty && (
          <Alert severity={pointsOnlyWay ? 'info' : 'warning'} className="dp-alert">
            العميل ليس لديه رصيد {debtCurrency === 'LYD' ? 'بالدينار ' : ''}في المحفظة.
            {pointsOnlyWay ? ' تقدر تسدد بالنقاط أدناه، أو تضيف رصيداً لمحفظته.' : ' أضف رصيداً لمحفظته أولاً، ثم سدّد الدين منه.'}
          </Alert>
        )}

        {/* The points pay first; the wallet amount below is what they leave */}
        <PaymentPoints
          quote={points.quote?.maxPoints !== undefined ? points.quote : null} balance={points.balance} loading={points.loading} failed={points.failed}
          value={pointsInput} onChange={(v) => { setPointsInput(v); setError(undefined); }} totalUsd={debtLeft} disabled={saving}
        />

        <div className="dp-field" role="group" aria-labelledby="dp-from">
          <p className="dp-field__title" id="dp-from">تدفع من</p>
          <div className="dp-wallets">
            {(['USD', 'LYD'] as Currency[]).map((c) => {
              const off = !allowed.includes(c) || held[c] <= 0;
              return (
                <button
                  key={c} type="button" className={`dp-wallet${currency === c ? ' is-active' : ''}`}
                  aria-pressed={currency === c} disabled={saving || walletLoading || off} onClick={() => choose(c)}
                >
                  <Wallet size={18} aria-hidden />
                  <span className="dp-wallet__name">{WALLET_NAME[c]}</span>
                  <span className="dp-wallet__held">
                    {walletLoading ? 'جارٍ التحميل…' : !allowed.includes(c) ? 'لا تُستعمل لدين بالدينار' : held[c] <= 0 ? 'فارغة' : <Money value={held[c]} currency={c} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {currency && (
          <>
            {converting && (
              <div className="dp-field" role="group" aria-labelledby="dp-how">
                <p className="dp-field__title" id="dp-how">طريقة السداد</p>
                <div className="dp-modes" role="radiogroup" aria-label="طريقة السداد بالدينار">
                  {([['full', 'سداد كامل', 'يُحسب السعر ليُقفل الدين'], ['partial', 'سداد جزئي', 'تكتب سعر الصرف بنفسك']] as const).map(([key, label, hint]) => (
                    <button
                      key={key} type="button" role="radio" aria-checked={mode === key}
                      className={`dp-mode${mode === key ? ' is-active' : ''}`} disabled={saving}
                      onClick={() => { setMode(key); setError(undefined); }}
                    >
                      <span>{label}</span><small>{hint}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`dp-amount${converting ? ' has-rate' : ''}`}>
              <div className="dp-input dp-input--amount">
                <label htmlFor="dp-amount">المبلغ</label>
                <div className="dp-input__box">
                  <input
                    id="dp-amount" type="number" inputMode="decimal" min="0" step="any" dir="ltr" value={amount} disabled={saving}
                    onChange={(e) => { setAmount(e.target.value); setError(undefined); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    aria-invalid={!!problem} aria-describedby="dp-problem"
                  />
                  <span className="dp-input__unit">{SYMBOL[currency]}</span>
                  <button
                    type="button" className="dp-fill" disabled={saving || held[currency] <= 0 || dueIn(currency) <= 0}
                    onClick={() => { const due = dueIn(currency); setAmount(String(round2(Math.min(due, held[currency])))); setMode(held[currency] >= due ? 'full' : 'partial'); setError(undefined); }}
                  >
                    كامل المتبقي
                  </button>
                </div>
              </div>
              {converting && (
                <div className="dp-input dp-input--rate">
                  <label htmlFor="dp-rate">سعر الصرف</label>
                  <div className="dp-input__box">
                    <input
                      id="dp-rate" type="number" inputMode="decimal" min="0" step="any" dir="ltr" disabled={saving || mode === 'full'}
                      value={mode === 'full' ? (rate > 0 ? String(round4(rate)) : '') : typedRate}
                      placeholder={mode === 'partial' ? 'اكتب السعر' : undefined}
                      onChange={(e) => { setTypedRate(e.target.value); setError(undefined); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                  <small>{!limits ? 'لا يوجد سعر لهذا التاريخ' : `سعر المحاسب ${limits.rate}، الأدنى ${round4(limits.minimum)}`}</small>
                </div>
              )}
            </div>

            <p id="dp-problem" className={`dp-summary${problem ? ' is-problem' : ''}`} role={problem ? 'alert' : undefined}>
              {problem || (value > 0
                ? <>يُخصم <Money value={value} currency={currency} /> من {WALLET_NAME[currency]}، ويبقى فيها <Money value={Math.max(0, left)} currency={currency} />.</>
                : pointsUsed > 0 ? (remaining > 0 ? 'تسدد النقاط وحدها جزءاً من الدين، أو اكتب مبلغاً للباقي.' : 'النقاط تسدد كامل الدين، فلا يُخصم شيء من المحفظة.')
                  : 'اكتب المبلغ الذي سيُخصم من المحفظة.')}
            </p>
          </>
        )}

        {/* Nothing to pay from: no date, notes or receipt to fill */}
        {(!walletEmpty || pointsOnlyWay) && (
          <>
          <div className="dp-row dp-row--extra">
            <label className="dp-input">
              <span>تاريخ الدفعة</span>
              <span className="dp-input__box">
                <input type="date" dir="ltr" value={day} max={moment().format('YYYY-MM-DD')} disabled={saving || !roles?.isAdmin} onChange={(e) => e.target.value && setDay(e.target.value)} />
              </span>
              {!roles?.isAdmin && <small>يغيّره الأدمن فقط</small>}
            </label>
            <label className="dp-input dp-input--notes">
              <span>ملاحظات <small>(اختياري)</small></span>
              <span className="dp-input__box">
                <input type="text" dir="auto" value={notes} disabled={saving} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: دفعها بنفسه في المكتب" />
              </span>
            </label>
          </div>

          <div className="dp-receipts">
            <input
              ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden
              onChange={(e) => { const picked = Array.from(e.target.files || []); setFiles((prev) => [...prev, ...picked]); e.target.value = ''; }}
            />
            <button type="button" className="dp-attach" disabled={saving} onClick={() => fileInput.current?.click()}>
              <Paperclip size={16} aria-hidden /> إرفاق إيصال <small>(اختياري)</small>
            </button>
            {files.map((file, i) => (
              <span key={`${file.name}-${i}`} className="dp-file">
                <bdi>{file.name}</bdi>
                <button type="button" aria-label={`حذف ${file.name}`} disabled={saving} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}><X size={14} /></button>
              </span>
            ))}
          </div>
          </>
        )}
      </div>

      <footer className="dp-footer">
        <button type="submit" className="dp-pay" disabled={!canPay}>
          {saving ? <><CircularProgress size={16} sx={{ color: '#fff' }} /> جارٍ التسديد…</>
            : value > 0 && currency ? <>سدّد <Money value={value} currency={currency} />{pointsUsed > 0 && ' + النقاط'}</>
              : pointsUsed > 0 ? 'سدّد بالنقاط' : 'سدّد'}
        </button>
        <button type="button" className="dp-cancel" onClick={close} disabled={saving}>إلغاء</button>
      </footer>
    </form>
  );
};

export default CreateDebtHistoryDialog;
