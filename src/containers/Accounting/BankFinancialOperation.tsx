import { useEffect, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { Amount, Open } from './ui';

const BankFinancialOperation = ({ line, currency, onDone }: { line: any; currency: string; onDone: () => void }) => {
  const { currencies } = useAccountingData();
  const [rows, setRows] = useState<any[]>([]); const [id, setId] = useState('');
  const [originalAmount, setOriginalAmount] = useState(''); const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    acc.get(`bank/lines/${line._id}/financial-operations`).then((r: any) => { if (alive) setRows(r.data.results); }).catch((e: any) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, [line._id]);
  const selected = rows.find(r => r._id === id);
  const factor = selected ? 10 ** (currencies.find(c => c.code === selected.currency)?.decimals ?? 2) : 100;
  const save = async () => {
    setBusy(true); setError('');
    try { await acc.post(`bank/lines/${line._id}/financial-operation`, { operationId: id, originalAmount: Number(originalAmount), rate: Number(rate) || undefined }); onDone(); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  return <div className="mt-3">
    {error && <Alert severity="error">{error}</Alert>}
    <TextField fullWidth select label="العملية الأصلية" value={id} disabled={busy} onChange={e => { setId(e.target.value); setOriginalAmount(''); }}>
      {rows.map(r => <MenuItem key={r._id} value={r._id}>{r.number} · {r.name} · {r.partyName} · {r.description}</MenuItem>)}
    </TextField>
    {selected && <p className="mt-2">المتبقي: <Amount value={selected.openMinor / factor} currency={selected.currency} /></p>}
    {selected && currency !== selected.currency && <TextField className="mt-2" fullWidth type="number" label={`المبلغ المسوّى من أصل العملية (${selected.currency})`} value={originalAmount} onChange={e => setOriginalAmount(e.target.value)} />}
    {selected && currency !== 'USD' && line.amount < 0 && <TextField className="mt-2" fullWidth type="number" label="سعر الصرف إن وُجد" value={rate} onChange={e => setRate(e.target.value)} />}
    {!rows.length && <Alert severity="info" className="mt-2">لا توجد عملية أصلية متاحة لهذا السطر. <Open to="/accounting/financial-operations">افتح التسويات والمستحقات</Open>.</Alert>}
    <Button className="mt-3" variant="contained" disabled={busy || !selected || (currency !== selected.currency && !(Number(originalAmount) > 0))} onClick={save}>تسجيل التسوية وربط سطر الكشف</Button>
  </div>;
};
export default BankFinancialOperation;
