import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField } from '@mui/material';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
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

// The system's dinar rate and the lowest rate a payment may use
type Limits = { rate: number, minimum: number, tolerance: number }

const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (value: number) => Math.round(value * 100) / 100;

// Pays an order from the customer's wallet. It shows what is due, what the payment counts
// for in dollars and what stays in the wallet before anything is taken.
//
// Dinars are counted at the rate typed, like the delivery of packages: it starts at the system's
// rate and may not be lower than it by more than the tolerance (0.2).
const OrderWalletDialog = ({ open, category, order, wallet, packages, dueUsd, onClose, onDone }: Props) => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
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
    setRate('');
    setDate(new Date());
    setNote('');
    setError('');
    // Only when it opens: typing must not be overwritten by a refreshed balance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The system's rate, the starting point and the floor of the typed rate
  useEffect(() => {
    if (!open) return;
    let stale = false;
    api.get('payment-rate')
      .then((res: any) => { if (!stale) setLimits(res.data?.limits || null); })
      .catch(() => { if (!stale) setLimits(null); });
    return () => { stale = true; };
  }, [open]);

  const balance = currency === 'USD' ? wallet.walletUsd : wallet.walletLyd;
  const value = Number(amount) || 0;
  const minimum = limits?.minimum ?? 0;
  // The rate typed, starting from the system's rate
  const rateValue = currency === 'USD' ? 1 : (rate !== '' ? Number(rate) || 0 : (limits?.rate ?? 0));

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
    if (!(rateValue > 0)) return 'Enter the rate.';
    if (limits && rateValue < minimum - 1e-9) return `The rate is too low: the system rate is ${limits.rate}, the lowest allowed is ${minimum}.`;
    return '';
  })();
  const canPay = !problem && !rateProblem && value > 0 && !!date && !isSaving;

  const chooseCurrency = (next: Currency) => {
    setCurrency(next);
    // Dinars start at what is due at the system's rate
    const dinars = dueUsd > 0 && limits ? String(round2(Math.min(dueUsd * limits.rate, wallet.walletLyd))) : '';
    setAmount(next === 'USD' ? (dueUsd > 0 ? String(round2(Math.min(dueUsd, wallet.walletUsd))) : '') : dinars);
    setError('');
  };

  // The amount that settles what is due at the rate typed, as far as the wallet allows
  const fillDue = () => {
    const due = currency === 'USD' ? dueUsd : dueUsd * rateValue;
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
            <TextField
              className="op-rate" label="Exchange rate" size="small" type="number" required
              value={rate !== '' ? rate : (limits?.rate ?? '')}
              onChange={(event) => setRate(event.target.value)} onWheel={(event: any) => event.target.blur()}
              error={!!rateProblem} helperText={rateProblem || (limits ? `System rate ${limits.rate}; not below ${limits.minimum}` : '')} inputProps={{ min: 0, step: 'any' }} InputLabelProps={{ shrink: true }}
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
