import { Alert, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import api from "../../api";
import { calculateTotalWallet } from "../../utils/methods";
import { getErrorMessage } from "../../utils/errorHandler";
import { Debt } from "../../models";
import { formatAmount } from "./wrapper-util";

import './Debts.scss';

type Props = {
  setDialog: (state: any) => void
  // The customer's debts (owner's request 2026-10-04: pay several at once)
  item: Debt[]
  onSaved?: (message: string) => void
}

const round2 = (value: number) => Math.round(value * 100) / 100;
// The dinars that close a dollar debt: the server takes off amount / rate cut to the cent, so the
// amount is raised a cent at a time until that covers the whole debt
const inDinars = (usd: number, rate: number) => {
  if (!(rate > 0)) return 0;
  let amount = Math.ceil(usd * rate * 100) / 100;
  while (Math.trunc((amount / rate) * 100) / 100 < usd) amount = round2(amount + 0.01);
  return amount;
};

// Several debts of one customer paid in one go from their wallet: each chosen debt is paid in
// full, one after the other, through the same route as a single payment, so each one is settled
// and posted on its own
const BulkDebtPayDialog = (props: Props) => {
  const open = useMemo(() => props.item.filter((debt) => debt.status === 'open' && Number(debt.amount) > 0), [props.item]);
  const [chosen, setChosen] = useState<string[]>(open.map((debt) => debt._id));
  // 'same': each debt from the wallet of its currency; 'LYD': dollar debts paid from the dinar wallet
  const [payFrom, setPayFrom] = useState<'same' | 'LYD'>('same');
  const [rate, setRate] = useState('');
  const [wallet, setWallet] = useState<any>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const owner = props.item[0]?.owner;

  useEffect(() => {
    api.get(`wallet/${owner?._id}`).then((res: any) => setWallet(res.data?.results)).catch(() => {});
  }, [owner?._id]);

  // What each chosen debt takes from which wallet
  const plan = open.filter((debt) => chosen.includes(debt._id)).map((debt) => {
    const currency = payFrom === 'LYD' ? 'LYD' : debt.currency;
    const amount = currency === debt.currency ? Number(debt.amount) : inDinars(Number(debt.amount), Number(rate || 0));
    return { debt, currency, amount };
  });
  const needed = { USD: 0, LYD: 0 } as Record<string, number>;
  plan.forEach((row) => { needed[row.currency] = round2((needed[row.currency] || 0) + row.amount); });
  const { totalUsd, totalLyd } = calculateTotalWallet(wallet);

  const problems: string[] = [];
  if (!plan.length) problems.push('Choose at least one debt.');
  if (!(Number(rate) > 0)) problems.push('Enter the rate.');
  if (needed.USD > totalUsd + 0.001) problems.push(`The USD wallet has ${formatAmount(totalUsd)}, ${formatAmount(needed.USD)} is needed.`);
  if (needed.LYD > totalLyd + 0.001) problems.push(`The LYD wallet has ${formatAmount(totalLyd)}, ${formatAmount(needed.LYD)} is needed.`);

  const closeDialog = () => props.setDialog({ customComponentTag: undefined, isOpen: false });

  const payAll = async () => {
    setIsSaving(true);
    setError(undefined);
    const paid: string[] = [...done];
    for (const row of plan) {
      if (paid.includes(row.debt._id)) continue;
      const formData = new FormData();
      formData.append('createdAt', new Date().toISOString());
      formData.append('rate', String(rate));
      formData.append('amount', String(row.amount));
      formData.append('currency', row.currency);
      const debtType = (row.debt as any).debtType;
      if (debtType) formData.append('debtType', debtType);
      formData.append('sameCurrency', row.currency === row.debt.currency ? 'true' : 'false');
      try {
        const res: any = await api.fetchFormData(`balances/${row.debt._id}/paymentHistory`, 'POST', formData);
        if (res?.success !== undefined && !res?.success) throw new Error(res.message);
        paid.push(row.debt._id);
        setDone([...paid]);
      } catch (err: any) {
        // Stop at the first refusal: what was paid stays paid, the rest can be retried
        setError(`${row.debt.notes || row.debt._id}: ${getErrorMessage(err.message)}`);
        setIsSaving(false);
        return;
      }
    }
    setIsSaving(false);
    props.onSaved?.(`${paid.length} debts paid for ${owner?.customerId || 'customer'}`);
  };

  return (
    <>
      <DialogTitle>Pay several debts · {owner?.customerId}</DialogTitle>
      <DialogContent>
        <p className="debt-dialog-hint" style={{ marginBottom: 12 }}>
          Each chosen debt is paid in full from the customer's wallet, one after the other, and settled on its own.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {open.map((debt) => {
            const row = plan.find((r) => r.debt._id === debt._id);
            return (
              <label key={debt._id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done.includes(debt._id) ? 0.55 : 1 }}>
                <input type="checkbox" disabled={isSaving || done.includes(debt._id)} checked={chosen.includes(debt._id)}
                  onChange={() => setChosen((prev) => (prev.includes(debt._id) ? prev.filter((id) => id !== debt._id) : [...prev, debt._id]))} />
                <span style={{ flex: 1 }}>
                  {debt.notes || 'Debt'}
                  <small style={{ display: 'block', color: '#64748b' }}>{moment(debt.createdAt).format('DD/MM/YYYY')}{(debt as any).order?.orderId ? ` · ${(debt as any).order.orderId}` : ''}</small>
                </span>
                <strong>{formatAmount(debt.amount)} {debt.currency}</strong>
                {row && row.currency !== debt.currency && <small>= {formatAmount(row.amount)} {row.currency}</small>}
                {done.includes(debt._id) && <small style={{ color: '#0f766e' }}>Paid</small>}
              </label>
            );
          })}
        </div>
        <div className="row g-3">
          <div className="col-sm-7">
            <FormControl fullWidth>
              <InputLabel id="bulk-pay-from">Paid from</InputLabel>
              <Select labelId="bulk-pay-from" label="Paid from" value={payFrom} disabled={isSaving} onChange={(e) => setPayFrom(e.target.value as 'same' | 'LYD')}>
                <MenuItem value="same">Each debt from the wallet of its currency</MenuItem>
                <MenuItem value="LYD">Dollar debts from the LYD wallet, at the rate</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className="col-sm-5">
            <TextField fullWidth type="number" label="Rate" value={rate} disabled={isSaving} onChange={(e) => setRate(e.target.value)}
              inputProps={{ inputMode: 'decimal', step: 0.01 }} onWheel={(event: any) => event.target.blur()} />
          </div>
        </div>
        <p className="debt-dialog-hint" style={{ marginTop: 12 }}>
          Needed: {needed.USD > 0 && `${formatAmount(needed.USD)} USD`}{needed.USD > 0 && needed.LYD > 0 && ' + '}{needed.LYD > 0 && `${formatAmount(needed.LYD)} LYD`}
          {' · '}Wallet: {formatAmount(totalUsd)} USD, {formatAmount(totalLyd)} LYD
        </p>
        {!isSaving && problems.length > 0 && <Alert severity="warning" className="mt-2">{problems.join(' ')}</Alert>}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <button type="button" className="debts-btn is-ghost" onClick={closeDialog} disabled={isSaving}>Close</button>
        <button type="button" className="debts-btn is-primary" onClick={payAll} disabled={isSaving || problems.length > 0}>
          {isSaving ? <CircularProgress size={16} /> : `Pay ${plan.length} ${plan.length === 1 ? 'debt' : 'debts'}`}
        </button>
      </DialogActions>
    </>
  );
};

export default BulkDebtPayDialog;
