import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import moment from 'moment';
import { BsCheck2 } from 'react-icons/bs';
import api from '../../api';
import { getErrorMessage } from '../../utils/errorHandler';
import { packageCharge } from './orderConstants';

type Currency = 'USD' | 'LYD';

type Props = {
  open: boolean
  // What is being paid: the purchase invoice, or the shipping of the chosen packages
  category: 'invoice' | 'receivedGoods'
  order: any
  wallet: { walletUsd: number, walletLyd: number }
  packages: any[]
  // What the customer still owes for it, in dollars
  dueUsd: number
  onClose: () => void
  onDone: (message: string) => void
}

// The accountant's dinar rate on the payment date and the lowest rate a payment may use
type Limits = { rate: number, minimum: number, tolerance: number, day: string }

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;
// Up, so that the rate never comes out below the lowest allowed one because of rounding
const ceil6 = (value: number) => Math.ceil(value * 1000000) / 1000000;

// Pays an order from the customer's wallet. It shows what is due, what the payment counts
// for in dollars and what stays in the wallet before anything is taken.
//
// Dinars are counted at a rate. By default the rate is worked out so that the payment closes
// exactly what is due, but never below the accountant's rate minus the tolerance.
const OrderWalletDialog = ({ open, category, order, wallet, packages, dueUsd, onClose, onDone }: Props) => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  // Dinars either pay everything that is due (the rate is worked out) or part of it (the rate is typed)
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [rate, setRate] = useState('');
  const [limits, setLimits] = useState<Limits | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Each time it opens: the wallet that has money, and the amount still due
  useEffect(() => {
    if (!open) return;
    const startsWith: Currency = wallet.walletUsd > 0 || wallet.walletLyd <= 0 ? 'USD' : 'LYD';
    setCurrency(startsWith);
    setAmount(startsWith === 'USD' && dueUsd > 0 ? String(round2(Math.min(dueUsd, wallet.walletUsd))) : '');
    setMode(dueUsd > 0 ? 'full' : 'partial');
    setRate('');
    setDate(new Date());
    setNote('');
    setError('');
    // Only when it opens: typing must not be overwritten by a refreshed balance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The accountant's rate depends on the payment day
  const day = date && !Number.isNaN(date.getTime()) ? moment(date).format('YYYY-MM-DD') : '';
  useEffect(() => {
    if (!open || !day) return;
    let stale = false;
    api.get('payment-rate', { date: day })
      .then((res: any) => { if (!stale) setLimits(res.data?.limits || null); })
      .catch(() => { if (!stale) setLimits(null); });
    return () => { stale = true; };
  }, [open, day]);

  const balance = currency === 'USD' ? wallet.walletUsd : wallet.walletLyd;
  const value = Number(amount) || 0;
  const minimum = limits?.minimum ?? 0;
  // The rate is never typed: it closes what is due, held up to the lowest allowed rate (the
  // accountant's rate minus the tolerance), and is the accountant's rate when nothing is due
  const full = mode === 'full' && dueUsd > 0;
  const closingRate = currency === 'LYD' && full && value > 0 ? ceil6(value / dueUsd) : 0;
  // A partial payment takes the rate that was typed, starting from the accountant's rate
  const typedRate = rate !== '' ? Number(rate) || 0 : (limits?.rate ?? 0);
  // Full payment: the rate is always what closes what is due with this amount (dinars / due), and
  // follows the amount as it is typed. A higher rate than the accountant's is fine; it only counts
  // as a full payment while the rate is not below the lowest allowed one.
  const rateValue = currency === 'USD' ? 1 : full ? (closingRate > 0 ? closingRate : (limits?.rate ?? 0)) : typedRate;
  const tooLow = full && currency === 'LYD' && closingRate > 0 && closingRate < minimum - 1e-9;
  // The fewest dinars that still close it, for the message
  const closeFrom = dueUsd * minimum;

  const valueUsd = rateValue > 0 ? value / rateValue : null;
  const dueAfter = valueUsd === null ? null : dueUsd - valueUsd;

  const problem = (() => {
    if (balance <= 0) return `The ${currency} wallet is empty.`;
    if (!amount) return '';
    if (value <= 0) return 'The amount must be more than zero.';
    if (value > balance) return `The wallet holds only ${money(balance)} ${currency}.`;
    return '';
  })();
  const rateProblem = (() => {
    if (currency !== 'LYD' || !amount || problem) return '';
    if (tooLow) return `This amount is too low to close the invoice. Pay at least ${money(closeFrom)} LYD, or choose partial payment.`;
    if (!(rateValue > 0)) return limits ? 'Enter the rate.' : 'No dinar rate is set for this date. Ask an admin to enter it in accounting.';
    if (!full && rateValue < minimum - 1e-9) return 'This rate is too low.';
    return '';
  })();
  const canPay = !problem && !rateProblem && value > 0 && !!date && !isSaving;

  const chooseCurrency = (next: Currency) => {
    setCurrency(next);
    // Dinars start at what is due at the accountant's rate; the rate then follows the amount
    const dinars = dueUsd > 0 && limits ? String(round2(Math.min(dueUsd * limits.rate, wallet.walletLyd))) : '';
    setAmount(next === 'USD' ? (dueUsd > 0 ? String(round2(Math.min(dueUsd, wallet.walletUsd))) : '') : dinars);
    setError('');
  };

  // The amount that settles what is due at the accountant's rate, as far as the wallet allows
  const fillDue = () => {
    const due = currency === 'USD' ? dueUsd : dueUsd * (full ? (limits?.rate ?? 0) : typedRate);
    setAmount(String(round2(Math.min(due, balance))));
  };

  const pay = async () => {
    setError('');
    setIsSaving(true);
    const data = new FormData();
    data.append('createdAt', (date || new Date()).toISOString());
    data.append('amount', String(value));
    data.append('currency', currency);
    data.append('rate', String(currency === 'LYD' ? rateValue : 0));
    data.append('orderId', order.orderId);
    data.append('category', category);
    data.append('actionType', 'wallet');
    data.append('description', `تم خصم ${value} ${currency} من المحفظة`);
    data.append('note', `Order Id (${order.orderId}) => ${note.trim() || (category === 'invoice' ? 'دفع فاتورة الشراء' : 'دفع قيمة الشحن')}`);
    // The trip attached to a package is display data; it must not be sent back
    if (packages.length) data.append('list', JSON.stringify(packages.map(({ flight, ...row }: any) => row)));

    // fetchFormData never throws: a failure comes back as the response itself
    const response: any = await api.fetchFormData(`wallet/${order.user?._id}/usebalance`, 'POST', data);
    setIsSaving(false);
    if (response instanceof Error || response?.success === false) {
      // A sentence from the server is shown as it is; only known error codes are translated
      const known = getErrorMessage(response?.message);
      return setError(known.startsWith('unexpected') ? (response?.message || known) : known);
    }
    onDone(`${money(value)} ${currency} paid from the wallet`);
  };

  const wallets: [Currency, number][] = [['USD', wallet.walletUsd], ['LYD', wallet.walletLyd]];

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Pay from wallet
        <span className="op-dialog__sub">{category === 'invoice' ? 'Purchase invoice' : `Shipping of ${packages.length} package${packages.length === 1 ? '' : 's'}`}, order {order.orderId}</span>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" className="op-alert op-alert--tight">{error}</Alert>}

        <div className="op-due">
          <span>Still due</span>
          <strong>{dueUsd > 0 ? `$${money(dueUsd)}` : 'Nothing is due'}</strong>
        </div>

        {packages.length > 0 && (
          <ul className="op-picked">
            {packages.map((row: any) => (
              <li key={row._id}>
                <span>{row.deliveredPackages?.trackingNumber || 'No tracking number'}</span>
                <span>{row.deliveredPackages?.weight?.total || 0} {row.deliveredPackages?.weight?.measureUnit}, ${money(packageCharge(row))}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="op-choices" role="radiogroup" aria-label="Wallet to pay from">
          {wallets.map(([code, total]) => (
            <button
              key={code} type="button" role="radio" aria-checked={currency === code} disabled={isSaving}
              className={`op-choice${currency === code ? ' is-active' : ''}`} onClick={() => chooseCurrency(code)}
            >
              <span className="op-choice__mark">{currency === code && <BsCheck2 />}</span>
              <span className="op-choice__text">
                <span className="op-choice__label">{code} wallet</span>
                <span className="op-choice__value">{money(total)} {code}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="op-fields">
          <TextField
            label="Amount" type="number" required autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} onWheel={(event: any) => event.target.blur()}
            inputProps={{ min: 0, step: 'any' }} InputProps={{ endAdornment: <InputAdornment position="end">{currency}</InputAdornment> }}
            error={!!problem && !!amount} helperText={amount ? problem : ''}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="Payment date" inputFormat="dd/MM/yyyy" value={date} onChange={(next: any) => setDate(next)} renderInput={(params: any) => <TextField {...params} />} />
          </LocalizationProvider>
        </div>

        {currency === 'LYD' && (
          <>
            {dueUsd > 0 && (
              <div className="op-choices" role="radiogroup" aria-label="Dinar payment">
                {([['full', 'Pay in full', 'The rate closes what is due'], ['partial', 'Partial payment', 'You enter the rate']] as const).map(([key, label, hint]) => (
                  <button
                    key={key} type="button" role="radio" aria-checked={mode === key} disabled={isSaving}
                    className={`op-choice${mode === key ? ' is-active' : ''}`} onClick={() => setMode(key)}
                  >
                    <span className="op-choice__mark">{mode === key && <BsCheck2 />}</span>
                    <span className="op-choice__text">
                      <span className="op-choice__label">{label}</span>
                      <span className="op-choice__hint">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <TextField
              className="op-rate" label="Exchange rate" size="small" type="number" required={!full}
              value={full ? (rateValue > 0 ? String(round4(rateValue)) : '') : (rate !== '' ? rate : (limits?.rate ?? ''))}
              onChange={(event) => setRate(event.target.value)} onWheel={(event: any) => event.target.blur()}
              disabled={full} error={!!rateProblem} helperText={rateProblem} inputProps={{ min: 0, step: 'any' }} InputLabelProps={{ shrink: true }}
            />
          </>
        )}

        {dueUsd > 0 && (currency === 'USD' || rateValue > 0) && (
          <Button size="small" type="button" onClick={fillDue} disabled={balance <= 0}>Fill what is due</Button>
        )}

        <TextField className="op-note" label="Note" multiline minRows={2} maxRows={6} dir="auto" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />

        <dl className="op-outcome">
          <div><dt>Counts as</dt><dd>{valueUsd === null ? 'Needs the rate' : `$${money(valueUsd)}`}</dd></div>
          <div><dt>Wallet after payment</dt><dd className={balance - value < 0 ? 'is-bad' : ''}>{money(balance - value)} {currency}</dd></div>
          <div>
            <dt>Due after payment</dt>
            <dd>{dueAfter === null ? 'Needs the rate' : dueAfter > 0.005 ? `$${money(dueAfter)}` : dueAfter < -0.005 ? `Overpaid by $${money(-dueAfter)}` : 'Settled'}</dd>
          </div>
        </dl>
        {!amount && problem && <Alert severity="warning" className="op-alert">{problem}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button variant="contained" onClick={pay} disabled={!canPay}>{isSaving ? 'Paying' : `Pay ${value > 0 ? `${money(value)} ${currency}` : ''}`}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderWalletDialog;
