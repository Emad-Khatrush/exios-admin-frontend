import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import api from '../../api';
// @ts-ignore -- stylesheet handled by the bundler
import './WalletExchangeDialog.scss';

type Props = { open: boolean; onClose: () => void; customerId: string; balances: { walletUsd: number; walletLyd: number }; onSaved: () => Promise<void> };
type Quote = { fromCurrency: string; toCurrency: string; fromMinor: number; toMinor: number; rate: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value: number, currency: string) => `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const requestKey = () => Array.from(window.crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, '0')).join('');

export default function WalletExchangeDialog({ open, onClose, customerId, balances, onSaved }: Props) {
  const [from, setFrom] = useState('USD');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [received, setReceived] = useState('');
  const [pricingMode, setPricingMode] = useState<'rate' | 'received'>('rate');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [key, setKey] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedInput, setQuotedInput] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const balance = Number(from === 'USD' ? balances.walletUsd : balances.walletLyd) || 0;
  const to = from === 'USD' ? 'LYD' : 'USD';
  const insufficient = !!quote && quote.fromMinor > Math.round(balance * 100);
  const pricingValue = pricingMode === 'rate' ? rate : received;
  const inputSignature = JSON.stringify([from, amount, pricingMode, pricingValue]);
  const quoteIsCurrent = !!quote && quotedInput === inputSignature;

  useEffect(() => {
    if (!open) return;
    setFrom('USD'); setAmount(''); setRate(''); setReceived(''); setPricingMode('rate'); setDay(today()); setNote('');
    setKey(requestKey()); setReceipt(null); setError(''); setQuote(null);
  }, [open, customerId]);

  useEffect(() => {
    let stale = false;
    setQuote(null); setQuoteError('');
    if (!open || !amount || !pricingValue || receipt) { setQuoting(false); return; }
    setQuoting(true);
    const timer = window.setTimeout(() => {
      api.post(`wallet/${customerId}/exchange/quote`, { fromCurrency: from, amount, pricingMode,
        ...(pricingMode === 'received' ? { toAmount: pricingValue } : { rate: pricingValue }) })
        .then((res: any) => { if (!stale) {
          const next: Quote = res.data.results;
          setQuote(next); setQuotedInput(inputSignature);
          if (pricingMode === 'received') setRate(String(Number(next.rate)));
          else setReceived((next.toMinor / 100).toFixed(2));
        } })
        .catch((err: any) => { if (!stale) setQuoteError(err?.response?.data?.message || 'تعذّر حساب التحويل. تحقق من الاتصال وأعد المحاولة.'); })
        .finally(() => { if (!stale) setQuoting(false); });
    }, 250);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [open, customerId, from, amount, pricingMode, pricingValue, inputSignature, receipt]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || quoting || !quoteIsCurrent || insufficient) return;
    setSaving(true); setError('');
    try {
      const response = await api.post(`wallet/${customerId}/exchange`, { fromCurrency: from, amount, pricingMode,
        ...(pricingMode === 'received' ? { toAmount: received } : { rate }), day, note, idempotencyKey: key });
      setReceipt(response.data.results);
      await onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'لم نتمكن من تأكيد النتيجة. أعد المحاولة من النافذة نفسها لتجنب تكرار الصرافة.');
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="sm" PaperProps={{ className: 'wallet-exchange' }}>
    <form onSubmit={save} dir="rtl">
      <DialogTitle className="wallet-exchange__title">{receipt ? 'تمت الصرافة' : 'صرافة داخل المحفظة'}</DialogTitle>
      <DialogContent>
        {receipt ? <div className="wallet-exchange__receipt" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <p>خُصم <b dir="ltr">{money(receipt.fromMinor / 100, receipt.fromCurrency)}</b> وأُضيف <b dir="ltr">{money(receipt.toMinor / 100, receipt.toCurrency)}</b> إلى محفظة العميل.</p>
          <dl><div><dt>سعر الدولار</dt><dd>{Number(receipt.rate)} دينار</dd></div><div><dt>تاريخ العملية</dt><dd dir="ltr">{receipt.day}</dd></div></dl>
          <p className="wallet-exchange__muted">ستجد طرفي الصرافة في كشف حساب الدولار والدينار.</p>
        </div> : <>
          <p className="wallet-exchange__intro">حوّل بين رصيدي العميل. لا يوجد إيداع أو سحب نقدي.</p>
          <div className="wallet-exchange__fields">
            <TextField select label="من المحفظة" value={from} onChange={e => { setFrom(e.target.value); setRate(''); setReceived(''); setPricingMode('rate'); setQuote(null); setError(''); }} disabled={saving} fullWidth>
              <MenuItem value="USD">الدولار الأمريكي USD</MenuItem><MenuItem value="LYD">الدينار الليبي LYD</MenuItem>
            </TextField>
            <div className="wallet-exchange__destination"><ArrowLeftRight size={17} aria-hidden="true" /><span>إلى محفظة {to === 'LYD' ? 'الدينار' : 'الدولار'}</span></div>
            <TextField label={`المبلغ المراد تحويله (${from})`} value={amount} onChange={e => { setAmount(e.target.value); setQuote(null); if (pricingMode === 'received') setRate(''); else setReceived(''); }} required disabled={saving} fullWidth
              inputProps={{ inputMode: 'decimal', dir: 'ltr', maxLength: 16 }} helperText={`الرصيد المتاح: ${money(balance, from)}`} />
            <TextField label={`المبلغ بعد الصرافة (${to})`} value={received} onChange={e => { setReceived(e.target.value); setPricingMode('received'); setRate(''); setQuote(null); }} required={pricingMode === 'received'} disabled={saving} fullWidth
              inputProps={{ inputMode: 'decimal', dir: 'ltr', maxLength: 16 }} helperText="أدخل المبلغ المستلم ليُحسب سعر الصرف تلقائيًا" />
            <TextField label="سعر الدولار بالدينار" value={rate} onChange={e => { setRate(e.target.value); setPricingMode('rate'); setReceived(''); setQuote(null); }} required={pricingMode === 'rate'} disabled={saving} fullWidth
              inputProps={{ inputMode: 'decimal', dir: 'ltr', maxLength: 14 }} helperText={pricingMode === 'received' ? 'محسوب من المبلغين؛ يمكنك تعديله لحساب المبلغ المستلم' : 'عدد الدنانير مقابل 1 دولار؛ يُحسب المبلغ المستلم تلقائيًا'} />
            <TextField label="تاريخ العملية" type="date" value={day} onChange={e => setDay(e.target.value)} required disabled={saving} fullWidth
              InputLabelProps={{ shrink: true }} inputProps={{ max: today(), dir: 'ltr' }} />
            <TextField label="ملاحظة (اختياري)" value={note} onChange={e => setNote(e.target.value)} disabled={saving} fullWidth inputProps={{ maxLength: 500 }} />
          </div>
          <div className="wallet-exchange__preview" aria-live="polite" aria-busy={quoting}>
            {quoting ? <span><CircularProgress size={15} /> جارٍ حساب التحويل…</span> : quote ? <>
              <div><span>سيُخصم</span><strong dir="ltr">{money(quote.fromMinor / 100, quote.fromCurrency)}</strong></div>
              <div><span>سيُضاف</span><strong dir="ltr">{money(quote.toMinor / 100, quote.toCurrency)}</strong></div>
              <p>الرصيد المتبقي في المصدر: <b dir="ltr">{money(balance - quote.fromMinor / 100, from)}</b></p>
            </> : <p>أدخل المبلغ وسعر الصرف لمعاينة التحويل.</p>}
          </div>
          {insufficient && <Alert severity="warning">رصيد محفظة المصدر لا يكفي لهذا التحويل.</Alert>}
          {(error || quoteError) && <Alert severity="error">{error || quoteError}</Alert>}
        </>}
      </DialogContent>
      <DialogActions className="wallet-exchange__actions">
        {receipt ? <Button onClick={onClose}>تم</Button> : <><Button disabled={saving} onClick={onClose}>إلغاء</Button><Button type="submit" variant="contained" disableElevation disableRipple disabled={saving || quoting || !quoteIsCurrent || insufficient || !day}>
          {saving ? 'جارٍ تنفيذ الصرافة…' : 'تأكيد الصرافة'}
        </Button></>}
      </DialogActions>
    </form>
  </Dialog>;
}
