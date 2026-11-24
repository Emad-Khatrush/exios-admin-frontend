import { FormEvent, useEffect, useRef, useState } from 'react';
import { Alert, CircularProgress, Dialog } from '@mui/material';
import { Coins, Wallet, X } from 'lucide-react';
import { errorText, newKey, sys } from '../Accounting/accountingApi';
import '../../components/DebtsPage/Debts.scss';
import './PaymentReturnDialog.scss';

// Gives back part of what the customer paid on the order to their wallet, with a description (owner
// 2026-11-25): the invoice lowered after it was paid (200$ paid, now 180$), the 20$ goes back without
// cancelling the 200$ payment. In dollars, or in dinars at a rate (never above the accountant's rate
// plus the tolerance). The API caps it: the invoice at the money paid on it (less earlier returns and
// supplier refunds; more than the extra makes it owed again); the shipping at its extra only. Points
// paid on the invoice are never given back as money.
// Drawn like the debt payment window (Debts.scss, dp-*): the figures on top, the wallet to pay into,
// the amount, then the description.

type Category = 'invoice' | 'receivedGoods';
type Currency = 'USD' | 'LYD';
type Room = { maxUsd: number, extraUsd: number, pointsUsd: number, lyd: { rate: number, maximum: number } | null };
type Props = { orderId: string, category?: Category, open: boolean, onClose: () => void, onDone: (message: string) => void };

const money2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number) => money2.format(Number(value) || 0);
const round2 = (value: number) => Math.round(value * 100) / 100;
const SYMBOL: Record<Currency, string> = { USD: '$', LYD: 'د.ل' };
const Money = ({ value, currency = 'USD' }: { value: number, currency?: Currency }) => (
  <span className="dp-money"><bdi dir="ltr">{money(value)}</bdi> <span>{SYMBOL[currency]}</span></span>
);
const TITLES: Record<Category, string> = { invoice: 'إرجاع مبلغ من دفعات الفاتورة', receivedGoods: 'إرجاع مبلغ من دفعات الشحن' };

const PaymentReturnDialog = ({ orderId, category = 'invoice', open, onClose, onDone }: Props) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey());

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setRoom(null); setLoadError(''); setError(''); setDescription(''); setCurrency('USD');
    key.current = newKey();
    sys.get(`acc/orders/${orderId}/payment-returns`)
      .then((res: any) => {
        if (stale) return;
        const part = res.data?.parts?.[category] || { maxUsd: res.data?.returnableUsd, extraUsd: res.data?.extraUsd, pointsUsd: res.data?.pointsUsd };
        const next: Room = { maxUsd: Number(part.maxUsd) || 0, extraUsd: Number(part.extraUsd) || 0, pointsUsd: Number(part.pointsUsd) || 0, lyd: res.data?.lyd || null };
        setRoom(next);
        setAmount(next.extraUsd > 0 ? String(round2(next.extraUsd)) : '');
        setRate(next.lyd ? String(next.lyd.rate) : '');
      })
      .catch((err: any) => { if (!stale) setLoadError(errorText(err, 'تعذّر قراءة المدفوع على الطلب.')); });
    return () => { stale = true; };
  }, [open, orderId, category]);

  const rateValue = Number(rate) || 0;
  // Switching the wallet keeps the value: dollars become dinars at the rate, and back
  const choose = (next: Currency) => {
    if (next === currency || !room) return;
    const r = rateValue || room.lyd?.rate || 0;
    const v = Number(amount) || 0;
    if (v > 0 && r > 0) setAmount(String(next === 'LYD' ? round2(v * r) : round2(v / r)));
    setCurrency(next);
    setError('');
  };

  const value = Number(amount) || 0;
  const usdValue = currency === 'USD' ? value : rateValue > 0 ? round2(value / rateValue) : 0;
  const reopened = room ? round2(usdValue - room.extraUsd) : 0;
  const nothing = !!room && room.maxUsd <= 0;
  // "The whole extra" (or all that may go back when there is no extra) in the chosen currency
  const fillValue = room ? (room.extraUsd > 0 ? room.extraUsd : room.maxUsd) : 0;
  const inCurrency = (usd: number) => (currency === 'USD' ? round2(usd) : rateValue > 0 ? round2(usd * rateValue) : 0);

  // What stops the return, said where it can be fixed
  const problem = (() => {
    if (!room || !amount) return '';
    if (currency === 'LYD') {
      if (!(rateValue > 0)) return 'اكتب سعر الصرف.';
      if (room.lyd && rateValue > room.lyd.maximum + 1e-9) return `أعلى سعر مسموح ${room.lyd.maximum}: سعر أعلى يعطي العميل دنانير أكثر من المبلغ.`;
    }
    if (value <= 0) return 'اكتب مبلغاً أكبر من صفر.';
    if (usdValue > room.maxUsd + 1e-9) return `أقصى ما يُرجع ${money(room.maxUsd)} $${currency === 'LYD' && rateValue > 0 ? ` (${money(room.maxUsd * rateValue)} د.ل)` : ''}.`;
    return '';
  })();
  const canSave = !!room && value > 0 && !problem && !!description.trim() && !saving;

  const close = () => { if (!saving) onClose(); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await sys.post(`acc/orders/${orderId}/payment-returns`, {
        category, currency, amount: value, ...(currency === 'LYD' && { rate: rateValue }), description: description.trim(), idempotencyKey: key.current,
      });
      onDone(`أُرجع ${money(value)} ${SYMBOL[currency]} إلى محفظة العميل`);
      onClose();
    } catch (err: any) {
      setError(errorText(err));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '14px' } }}>
      <form className="debt-pay" dir="rtl" onSubmit={save} aria-labelledby="pr-title">
        <header className="dp-header">
          <div>
            <h2 id="pr-title">{TITLES[category]}</h2>
            <p>يُضاف المبلغ لمحفظة العميل بسطر واحد في كشف حسابه، وتبقى الدفعة الأصلية كما هي.</p>
          </div>
          <button type="button" className="dp-close" onClick={close} aria-label="إغلاق" disabled={saving}><X size={18} /></button>
        </header>

        {/* The two figures that decide the return: what was paid beyond what is owed, and the most that may go back */}
        <div className="dp-ledger pr-ledger" aria-live="polite">
          <div className="dp-ledger__side">
            <span>دفع زيادة على المطلوب</span>
            <strong className={room && room.extraUsd > 0 ? 'is-extra' : ''}>{room ? <Money value={room.extraUsd} /> : '…'}</strong>
          </div>
          <span className="pr-ledger__rule" aria-hidden />
          <div className="dp-ledger__side">
            <span>أقصى ما يُرجع</span>
            <strong>{room ? <Money value={room.maxUsd} /> : '…'}</strong>
          </div>
        </div>

        <div className="dp-body">
          {loadError && <Alert severity="error" className="dp-alert">{loadError}</Alert>}
          {error && <Alert severity="error" className="dp-alert">{error}</Alert>}
          {!room && !loadError && <div className="pr-loading"><CircularProgress size={18} /> جارٍ قراءة المدفوع…</div>}

          {room && room.pointsUsd > 0 && (
            <p className="pr-note">
              <Coins size={16} aria-hidden />
              <span>دفع <Money value={room.pointsUsd} /> بالنقاط، والنقاط لا تُرجع فلوساً. لإرجاعها ألغِها من قسم النقاط في هذه الصفحة فترجع لرصيد نقاطه.</span>
            </p>
          )}
          {nothing && <p className="pr-note is-info">لا يوجد مبلغ يمكن إرجاعه من {category === 'invoice' ? 'هذه الفاتورة' : 'الشحن'}.</p>}

          {room && !nothing && (
            <>
              <div role="group" aria-labelledby="pr-to">
                <p className="dp-field__title" id="pr-to">تُرجع إلى</p>
                <div className="dp-wallets">
                  {(['USD', 'LYD'] as Currency[]).map((c) => (
                    <button key={c} type="button" className={`dp-wallet${currency === c ? ' is-active' : ''}`} aria-pressed={currency === c}
                      disabled={saving || (c === 'LYD' && !room.lyd)} onClick={() => choose(c)}>
                      <Wallet size={18} aria-hidden />
                      <span className="dp-wallet__name">{c === 'USD' ? 'محفظة الدولار' : 'محفظة الدينار'}</span>
                      <span className="dp-wallet__held">{c === 'USD' ? 'بالدولار' : room.lyd ? `بسعر الصرف، سعر المحاسب ${room.lyd.rate}` : 'لا يوجد سعر للدينار اليوم'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`dp-amount${currency === 'LYD' ? ' has-rate' : ''}`}>
                <div className="dp-input dp-input--amount">
                  <label htmlFor="pr-amount">المبلغ</label>
                  <div className="dp-input__box">
                    <input id="pr-amount" type="number" inputMode="decimal" min="0" step="any" dir="ltr" value={amount} disabled={saving}
                      onChange={(e) => { setAmount(e.target.value); setError(''); }} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      aria-invalid={!!problem} aria-describedby="pr-summary" />
                    <span className="dp-input__unit">{SYMBOL[currency]}</span>
                    <button type="button" className="dp-fill" disabled={saving || !(fillValue > 0) || (currency === 'LYD' && !(rateValue > 0))}
                      onClick={() => { setAmount(String(inCurrency(fillValue))); setError(''); }}>
                      {room.extraUsd > 0 ? 'كامل الزائد' : 'الحد الأقصى'}
                    </button>
                  </div>
                </div>
                {currency === 'LYD' && (
                  <div className="dp-input dp-input--rate">
                    <label htmlFor="pr-rate">سعر الصرف</label>
                    <div className="dp-input__box">
                      <input id="pr-rate" type="number" inputMode="decimal" min="0" step="any" dir="ltr" value={rate} disabled={saving}
                        onChange={(e) => { setRate(e.target.value); setError(''); }} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    {room.lyd && <small>الأعلى {room.lyd.maximum}</small>}
                  </div>
                )}
              </div>

              <p id="pr-summary" className={`dp-summary${problem ? ' is-problem' : reopened > 0.005 && value > 0 ? ' pr-warn' : ''}`} role={problem ? 'alert' : undefined}>
                {problem || (value > 0
                  ? (reopened > 0.005
                    ? <>المبلغ أكبر من الزائد بـ <Money value={reopened} />: يصبح هذا المبلغ مستحقاً على العميل في الفاتورة من جديد.</>
                    : <>يُضاف <Money value={value} currency={currency} />{currency === 'LYD' && usdValue > 0 && <> (= <Money value={usdValue} />)</>} إلى {currency === 'USD' ? 'محفظة الدولار' : 'محفظة الدينار'}.</>)
                  : 'اكتب المبلغ الذي يُرجع للمحفظة.')}
              </p>

              <label className="dp-input">
                <span>البيان <small>(سبب الإرجاع، يظهر للعميل في كشف حسابه)</small></span>
                <span className="dp-input__box">
                  <input type="text" dir="auto" value={description} disabled={saving} maxLength={300}
                    onChange={(e) => setDescription(e.target.value)} placeholder="مثلاً: نزل سعر الفاتورة من 200 إلى 180" />
                </span>
              </label>
            </>
          )}
        </div>

        <footer className="dp-footer">
          <button type="submit" className="dp-pay" disabled={!canSave}>
            {saving ? <><CircularProgress size={16} sx={{ color: '#fff' }} /> جارٍ الإرجاع…</>
              : value > 0 && !nothing ? <>أرجِع <Money value={value} currency={currency} /></> : 'أرجِع'}
          </button>
          <button type="button" className="dp-cancel" onClick={close} disabled={saving}>إلغاء</button>
        </footer>
      </form>
    </Dialog>
  );
};

export default PaymentReturnDialog;
