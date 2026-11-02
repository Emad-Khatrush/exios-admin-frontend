import { useEffect, useState } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';

// Paying from an employee's custody (owner's request 2026-11-02): only the employees who hold
// custody on that account, each with what they hold; more than that cannot be paid.
export const custodyExceeded = (employee: any, amount: number) => employee?.held !== undefined && amount > employee.held + 0.000001;

// billCurrency: on a supplier bill paid now, whose currency must be the custody's. inGrid: inside a
// form grid it takes its cell's width; in a row of fields it keeps a width of its own
const CustodyHolderPicker = ({ accountId, value, onChange, amount, billCurrency, inGrid = false }: { accountId: string; value: any; onChange: (employee: any) => void; amount: number; billCurrency?: string; inGrid?: boolean }) => {
  const [holders, setHolders] = useState<any[] | null>(null);
  const [currency, setCurrency] = useState('');
  const [elsewhere, setElsewhere] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    setHolders(null);
    setError('');
    acc.get('custody-holders', { accountId })
      .then((res: any) => { setHolders(res.data.results || []); setCurrency(res.data.currency); setElsewhere(res.data.elsewhere || []); })
      .catch((err: any) => { setHolders([]); setError(errorText(err)); });
  }, [accountId]);
  // The list is the truth: a holder picked before keeps the balance shown now
  const selected = holders?.find((h) => h._id === value?._id);
  useEffect(() => {
    if (value && holders && (!selected || selected.held !== value.held)) onChange(selected || null);
  }, [holders]); // eslint-disable-line react-hooks/exhaustive-deps
  const over = custodyExceeded(selected, amount);
  // Nobody holds custody in this currency: say who holds it in another and how to pay from it
  const nameOf = (h: any) => `${h.firstName || ''} ${h.lastName || ''}`.trim();
  const none = elsewhere.length
    ? `لا أحد عنده عهدة ${currency}. العهد الموجودة: ${elsewhere.map((h) => `${nameOf(h)} ${h.held} ${h.currency}`).join('، ')}؛ ادفع من حساب عهدة ${elsewhere[0].currency}${billCurrency ? ` (واجعل عملة الفاتورة ${elsewhere[0].currency}، أو سجّلها غير مدفوعة وادفعها من «دفعة لمورد»)` : ''}.`
    : `لا أحد عنده عهدة ${currency}`;
  return (
    <TextField select label="الموظف صاحب العهدة" value={selected?._id || ''} fullWidth={inGrid} style={inGrid ? { minWidth: 0 } : { minWidth: 240, maxWidth: 520 }}
      // The field shows the name; the balance is written under it
      SelectProps={{ renderValue: () => (selected ? nameOf(selected) : '') }}
      onChange={(e) => onChange(holders?.find((h) => h._id === e.target.value) || null)}
      error={!!error || over || (holders !== null && !holders.length)}
      helperText={error || (holders === null ? 'جارٍ التحميل...' : !holders.length ? none : selected ? `في عهدته ${selected.held} ${currency}${over ? ' — المبلغ أكبر من عهدته' : ''}` : undefined)}>
      {(holders || []).map((h) => <MenuItem key={h._id} value={h._id}>{nameOf(h)} · {h.held} {currency}</MenuItem>)}
    </TextField>
  );
};

export default CustodyHolderPicker;
