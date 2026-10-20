import { Alert, CircularProgress } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Wallet, X } from 'lucide-react';
import moment from 'moment';
import api from '../../api';
import { calculateTotalWallet } from '../../utils/methods';
import { getErrorMessage } from '../../utils/errorHandler';
import { Debt } from '../../models';
import { formatAmount } from './wrapper-util';
import './Debts.scss';

type Props = { setDialog: (state: any) => void; item: Debt[]; onSaved?: (message: string) => void; onBusyChange?: (busy: boolean) => void };
type Currency = 'USD' | 'LYD';
const round2 = (n: number) => Math.round(n * 100) / 100;
const fullAmount = (amount: number, currency: Currency, debtCurrency: Currency, rate: number) => currency === debtCurrency ? amount : rate > 0 && Number.isFinite(rate) ? round2(amount * rate) : 0;

export default function BulkDebtPayDialog({ item, setDialog, onSaved, onBusyChange }: Props) {
  const open = useMemo(() => item.filter(d => d.status === 'open' && Number(d.amount) > 0), [item]);
  const owner = item[0]?.owner;
  const [chosen, setChosen] = useState(() => open.map(d => d._id));
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rate, setRate] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [wallet, setWallet] = useState<any>();
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);
  const [walletRetry, setWalletRetry] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Record<string, { amount: number; currency: Currency }>>({});
  const lock = useRef(false);
  useEffect(() => {
    let active = true; setWalletLoading(true); setWalletError(false);
    api.get(`wallet/${owner?._id}`).then(res => { if (active) { if (!Array.isArray(res.data?.results)) throw new Error('Invalid wallet'); setWallet(res.data.results); } })
      .catch(() => { if (active) setWalletError(true); }).finally(() => { if (active) setWalletLoading(false); });
    return () => { active = false; };
  }, [owner?._id, walletRetry]);
  const rowCurrency = (debt: Debt): Currency => debt.currency === 'LYD' ? 'LYD' : currency;
  const selected = open.filter(d => chosen.includes(d._id) && !done[d._id]);
  const needsRate = selected.some(d => rowCurrency(d) !== d.currency);
  const plan = selected.map(debt => {
    const paidCurrency = rowCurrency(debt);
    const maximum = fullAmount(Number(debt.amount), paidCurrency, debt.currency, Number(rate));
    const amount = amounts[debt._id] === undefined ? maximum : Number(amounts[debt._id]);
    const settled = paidCurrency === debt.currency ? round2(amount) : round2(amount / Number(rate));
    return { debt, currency: paidCurrency, maximum, amount, settled };
  });
  const needed = { USD: 0, LYD: 0 };
  plan.forEach(r => { if (Number.isFinite(r.amount)) needed[r.currency] = round2(needed[r.currency] + r.amount); });
  const { totalUsd, totalLyd } = calculateTotalWallet(wallet);
  const spent = { USD: 0, LYD: 0 };
  Object.values(done).forEach(r => { spent[r.currency] = round2(spent[r.currency] + r.amount); });
  const available = { USD: round2(totalUsd - spent.USD), LYD: round2(totalLyd - spent.LYD) };
  const problems: string[] = [];
  if (!owner?._id || open.some(d => d.owner?._id !== owner._id)) problems.push('يجب أن تكون الديون المختارة لعميل واحد.');
  if (!plan.length) problems.push('اختر دينًا واحدًا على الأقل لم يُسدَّد بعد.');
  if (needsRate && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) problems.push('أدخل سعر صرف صحيحًا أكبر من صفر.');
  if (plan.some(r => !Number.isFinite(r.amount) || r.amount <= 0 || Math.abs(r.amount - round2(r.amount)) > .000001)) problems.push('أدخل مبلغًا أكبر من صفر، وبحد أقصى منزلتين عشريتين لكل دين.');
  if (plan.some(r => Number.isFinite(r.settled) && r.settled <= 0)) problems.push('أحد المبالغ صغير جدًا بعد التحويل؛ عدّله قبل السداد.');
  if (plan.some(r => Number.isFinite(r.settled) && r.settled > Number(r.debt.amount) + .000001)) problems.push('أحد المبالغ يتجاوز الرصيد المتبقي للدين.');
  if (!walletLoading && !walletError) {
    if (needed.USD > available.USD + .001) problems.push('رصيد المحفظة بالدولار لا يكفي للمبالغ المحددة.');
    if (needed.LYD > available.LYD + .001) problems.push('رصيد المحفظة بالدينار لا يكفي للمبالغ المحددة.');
  }
  const close = () => { if (lock.current) return; if (Object.keys(done).length && onSaved) onSaved(`تم تسجيل ${Object.keys(done).length} دفعات للعميل ${owner?.customerId || ''}`); else setDialog({ customComponentTag: undefined, isOpen: false }); };
  const pay = async () => {
    if (lock.current || problems.length || walletLoading || walletError) return;
    lock.current = true; setSaving(true); onBusyChange?.(true); setError('');
    const paid = { ...done };
    try {
      for (const row of plan) {
        const body = new FormData();
        body.append('createdAt', new Date().toISOString()); body.append('amount', String(row.amount)); body.append('currency', row.currency);
        body.append('rate', row.currency === row.debt.currency ? '0' : rate); body.append('sameCurrency', String(row.currency === row.debt.currency));
        if ((row.debt as any).debtType) body.append('debtType', (row.debt as any).debtType);
        const res: any = await api.fetchFormData(`balances/${row.debt._id}/paymentHistory`, 'POST', body);
        if (res?.success === false) throw new Error(res.message);
        paid[row.debt._id] = { amount: row.amount, currency: row.currency }; setDone({ ...paid });
      }
      onSaved?.(`تم تسجيل ${Object.keys(paid).length} دفعات للعميل ${owner?.customerId || ''}`);
    } catch (err: any) { setError(`توقف السداد. الدفعات المؤكدة محفوظة ولن تُرسل مجددًا. ${getErrorMessage(err?.message || 'تعذر تسجيل الدفعة')}`); }
    finally { lock.current = false; setSaving(false); onBusyChange?.(false); }
  };

  return <div className="bulk-debt-pay" dir="rtl">
    <header className="bdp-header"><div><h2>سداد الديون المجمّع</h2><p><bdi>{owner?.firstName} {owner?.lastName}</bdi><bdi>{owner?.customerId}</bdi></p></div><button type="button" className="bdp-close" aria-label="إغلاق" disabled={saving} onClick={close}><X size={20} /></button></header>
    <div className="bdp-body">
      <p className="bdp-intro">اختر الديون وعدّل مبلغ كل دفعة. تُخصم المبالغ من محفظة العميل، ويظل الجزء غير المسدَّد دينًا عليه.</p>
      <div className="bdp-wallet"><Wallet size={18} /><span>المتاح في المحفظة</span>{walletLoading ? <span role="status">جارٍ التحميل…</span> : walletError ? <button type="button" onClick={() => setWalletRetry(n => n + 1)}>تعذر التحميل · إعادة المحاولة</button> : <strong><bdi>{formatAmount(available.USD)} USD</bdi><bdi>{formatAmount(available.LYD)} LYD</bdi></strong>}</div>
      <fieldset className="bdp-settings" disabled={saving || Object.keys(done).length > 0}>
        <legend>طريقة السداد</legend>
        <div className="bdp-currencies" role="group" aria-label="عملة سداد الديون الدولارية"><button type="button" aria-pressed={currency === 'USD'} onClick={() => { setCurrency('USD'); setAmounts({}); }}>بالدولار <bdi>USD</bdi></button><button type="button" aria-pressed={currency === 'LYD'} onClick={() => { setCurrency('LYD'); setAmounts({}); }}>بالدينار <bdi>LYD</bdi></button></div>
        {currency === 'LYD' && open.some(d => d.currency === 'USD') && <label className="bdp-rate">سعر الصرف<input type="number" inputMode="decimal" step="any" min="0" value={rate} onChange={e => { setRate(e.target.value); setAmounts({}); }} placeholder="مثال: 7.5" /><small>عدد الدنانير مقابل دولار واحد · <bdi dir="ltr">1 USD = {rate || '…'} LYD</bdi></small></label>}
        {open.some(d => d.currency === 'LYD') && <p className="bdp-note">الديون الأصلية بالدينار تُسدَّد من محفظة الدينار. اختيار العملة أعلاه يخص الديون الدولارية.</p>}
      </fieldset>
      <div className="bdp-list-head"><h3>الديون المفتوحة <span>{open.length}</span></h3><button type="button" disabled={saving} onClick={() => setChosen(chosen.length === open.length ? [] : open.map(d => d._id))}>{chosen.length === open.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</button></div>
      <div className="bdp-list">{open.map(debt => {
        const row = plan.find(r => r.debt._id === debt._id), completed = done[debt._id], checked = chosen.includes(debt._id), paidCurrency = rowCurrency(debt);
        return <article className={`bdp-row ${completed ? 'is-done' : ''}`} key={debt._id}>
          <label className="bdp-debt"><input type="checkbox" checked={checked} disabled={saving || !!completed} onChange={() => setChosen(prev => prev.includes(debt._id) ? prev.filter(id => id !== debt._id) : [...prev, debt._id])} /><span><strong>{debt.notes || 'دين بدون وصف'}</strong><small>{moment(debt.createdAt).format('DD/MM/YYYY')}{debt.order?.orderId && <> · طلبية <bdi>{debt.order.orderId}</bdi></>}</small></span><bdi className="bdp-debt-balance">{formatAmount(debt.amount)} {debt.currency}</bdi></label>
          {completed ? <p className="bdp-confirmed"><CheckCircle2 size={16} />تم تسجيل <bdi>{formatAmount(completed.amount)} {completed.currency}</bdi></p> : checked && row && <div className="bdp-payment"><label>المبلغ الذي سيُخصم <span className="bdp-amount"><input aria-label={`مبلغ سداد ${debt.notes || debt._id}`} type="number" inputMode="decimal" min="0.01" step="0.01" value={amounts[debt._id] ?? (row.maximum || '')} disabled={saving || (paidCurrency !== debt.currency && !(Number(rate) > 0))} onChange={e => setAmounts(prev => ({ ...prev, [debt._id]: e.target.value }))} /><bdi>{paidCurrency}</bdi></span></label><div className="bdp-remainder"><span>المتبقي بعد هذه الدفعة</span><strong><bdi>{Number.isFinite(row.settled) ? formatAmount(Math.max(0, round2(Number(debt.amount) - row.settled))) : '—'} {debt.currency}</bdi></strong><button type="button" disabled={saving} onClick={() => setAmounts(prev => { const next = { ...prev }; delete next[debt._id]; return next; })}>سداد كامل المتبقي</button></div></div>}
        </article>;
      })}</div>
      {!saving && problems.length > 0 && <Alert severity="warning">{problems.join(' ')}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {saving && <p role="status" className="bdp-note">جارٍ تسجيل الدفعات… تم تأكيد {Object.keys(done).length} دفعات. انتظر حتى تكتمل العملية.</p>}
    </div>
    <footer className="bdp-footer"><div><span>إجمالي الخصم لهذه الدفعة</span><strong><bdi>{formatAmount(needed.USD)} USD</bdi><bdi>{formatAmount(needed.LYD)} LYD</bdi></strong></div><div className="bdp-actions"><button type="button" className="debts-btn is-ghost" disabled={saving} onClick={close}>إغلاق</button><button type="button" className="debts-btn is-primary" disabled={saving || walletLoading || walletError || problems.length > 0} onClick={pay}>{saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : `تأكيد سداد ${plan.length} ديون`}</button></div></footer>
  </div>;
}
