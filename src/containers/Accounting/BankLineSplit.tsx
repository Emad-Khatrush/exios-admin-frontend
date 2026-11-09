import { useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, FormControlLabel, IconButton, MenuItem, TextField } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { acc, errorText } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { useVendors } from './shared';
import { Ltr, Sub } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
// The last day of a month ('2026-02' → '2026-02-28')
export const monthEnd = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return `${year}-${pad(m)}-${pad(new Date(Date.UTC(year, m, 0)).getUTCDate())}`;
};
const nextMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${pad(m + 1)}`;
};

// A paid amount spread over the months it pays for: one part at the end of each month (never after
// the day it was paid), equal amounts, what rounding leaves going on the last month.
export const spreadMonths = (total: number, firstMonth: string, count: number, paidDay: string, decimals = 2) => {
  const unit = 10 ** decimals;
  const minor = Math.round(total * unit);
  const share = Math.floor(minor / count);
  const parts: { day: string; month: string; amount: number }[] = [];
  let month = firstMonth;
  for (let i = 0; i < count; i += 1) {
    const end = monthEnd(month);
    parts.push({ day: end > paidDay ? paidDay : end, month, amount: (i === count - 1 ? minor - share * (count - 1) : share) / unit });
    month = nextMonth(month);
  }
  return parts;
};

type Row = { key: number; day: string; accountId: string; office: string; description: string; amount: string };

// From the bank matching page: one outgoing line split into parts, each with its own day, expense
// account, office and amount. The parts of a day become one supplier bill on that day, and the
// line pays them all.
export default function BankLineSplit({ line, currency, hint, onClose, onDone, onBusyChange }: {
  line: any, currency: string, hint?: any, onClose: () => void, onDone: (text: string) => void, onBusyChange?: (busy: boolean) => void }) {
  const { accounts, offices, currencies } = useAccountingData();
  const { vendors } = useVendors();
  const decimals = currencies.find((c: any) => c.code === currency)?.decimals ?? 2;
  const unit = 10 ** decimals;
  const paid = Math.abs(line.amount) / unit;
  const keys = useRef(0);
  const blank = (over: Partial<Row> = {}): Row => ({ key: (keys.current += 1), day: line.day, accountId: hint?.account?._id || '', office: hint?.office || '', description: line.description || '', amount: '', ...over });
  const [vendorId, setVendorId] = useState<string>(hint?.vendorBills?.vendorId || hint?.vendorId || '');
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank()]);
  const [months, setMonths] = useState({ first: '', count: '' });
  const [confirmNewCost, setConfirmNewCost] = useState(false);
  const [askConfirm, setAskConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const expenseAccounts = useMemo(() => accounts.filter((a: any) => a.type === 'expense' && !a.isGroup && a.isActive), [accounts]);
  // The vendor the statement names, once the vendor list has loaded
  const namedVendor = !vendorId && hint?.vendorName ? vendors.filter((v: any) => String(v.name).toLowerCase().includes(String(hint.vendorName).toLowerCase())) : [];
  const vendor = vendors.find((v: any) => v._id === vendorId) || (namedVendor.length === 1 ? namedVendor[0] : null);

  const change = (key: number, patch: Partial<Row>) => setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const total = Math.round(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * unit) / unit;
  const left = Math.round((paid - total) * unit) / unit;
  const complete = rows.length >= 2 && rows.every((row) => row.day && row.day <= line.day && row.accountId && row.office && row.description.trim() && Number(row.amount) > 0);
  const ready = !!vendor && complete && left === 0 && (!askConfirm || confirmNewCost);

  const spread = () => {
    const count = Number(months.count);
    if (!months.first || !(count >= 2) || count > 60) return;
    const base = rows[0];
    const name = (base?.description || line.description || '').replace(/\s*—\s*شهر \d{2}-\d{4}$/, '');
    setRows(spreadMonths(paid, months.first, count, line.day, decimals).map((part) => blank({ day: part.day, accountId: base?.accountId || '', office: base?.office || '',
      description: `${name} — شهر ${part.month.slice(5)}-${part.month.slice(0, 4)}`, amount: String(part.amount) })));
  };
  const save = async () => {
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const res = await acc.post(`bank/lines/${line._id}/split`, { vendorId: vendor._id, confirmNewCost: confirmNewCost || undefined,
        parts: rows.map((row) => ({ day: row.day, accountId: row.accountId, office: row.office, description: row.description.trim(), amount: Number(row.amount) })) });
      onDone(`قُسِّم السطر على ${res.data.bills.length} فاتورة (${res.data.bills.map((b: any) => b.number).join('، ')}) وسُدّدت منه ورُبط بها.`);
    } catch (err) {
      const text = errorText(err);
      setError(text);
      if (text.includes('تكلفة محتملة مسجلة سابقاً')) setAskConfirm(true);
    }
    setBusy(false); onBusyChange?.(false);
  };

  return <>
    <Alert severity="info" className="mb-2">قسّم مبلغ السطر على أجزاء: لكل جزء تاريخه وحساب مصروفه ومكتبه. أجزاء اليوم الواحد تصير فاتورة مورد واحدة بذلك التاريخ، ثم يسددها هذا السطر كلها ويُربط بها.</Alert>
    {error && <Alert severity="error" className="mb-2">{error}</Alert>}
    <div className="d-flex gap-2 flex-wrap mb-3 align-items-start">
      <Autocomplete size="small" style={{ minWidth: 260 }} disabled={busy} options={vendors} value={vendor}
        getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
        onChange={(_, v: any) => setVendorId(v?._id || '')} renderInput={(p) => <TextField {...p} label="المورد" />} />
      <TextField size="small" type="month" label="وزّع على أشهر: من شهر" InputLabelProps={{ shrink: true }} disabled={busy} value={months.first}
        inputProps={{ max: line.day.slice(0, 7) }} onChange={(e) => setMonths({ ...months, first: e.target.value })} />
      <TextField size="small" type="number" label="عدد الأشهر" style={{ width: 120 }} disabled={busy} value={months.count} inputProps={{ min: 2, max: 60 }}
        onChange={(e) => setMonths({ ...months, count: e.target.value })} />
      <Button variant="outlined" disabled={busy || !months.first || !(Number(months.count) >= 2)} onClick={spread}>وزّع بالتساوي</Button>
    </div>
    {rows.map((row, index) => (
      <div key={row.key} className="d-flex gap-2 flex-wrap mb-2 align-items-start">
        <TextField size="small" type="date" label="التاريخ" InputLabelProps={{ shrink: true }} disabled={busy} value={row.day} inputProps={{ max: line.day, 'aria-label': `تاريخ الجزء ${index + 1}` }}
          error={!!row.day && row.day > line.day} onChange={(e) => change(row.key, { day: e.target.value })} />
        <Autocomplete size="small" style={{ minWidth: 240, flex: 1 }} disabled={busy} options={expenseAccounts} value={expenseAccounts.find((a: any) => a._id === row.accountId) || null}
          getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
          onChange={(_, a: any) => change(row.key, { accountId: a?._id || '' })} renderInput={(p) => <TextField {...p} label="حساب المصروف" />} />
        <TextField select size="small" label="المكتب" style={{ minWidth: 120 }} disabled={busy} value={row.office} onChange={(e) => change(row.key, { office: e.target.value })}>
          {offices.filter((o: any) => o.isActive).map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
        </TextField>
        <TextField size="small" label="الوصف" style={{ minWidth: 220, flex: 1 }} disabled={busy} value={row.description} onChange={(e) => change(row.key, { description: e.target.value })} />
        <TextField size="small" type="number" label={`المبلغ (${currency})`} style={{ width: 140 }} disabled={busy} value={row.amount}
          inputProps={{ min: 0, 'aria-label': `مبلغ الجزء ${index + 1}` }} onChange={(e) => change(row.key, { amount: e.target.value })} />
        <IconButton size="small" aria-label={`حذف الجزء ${index + 1}`} disabled={busy || rows.length <= 2} onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}><Trash2 size={16} /></IconButton>
      </div>
    ))}
    <Button size="small" startIcon={<Plus size={16} />} disabled={busy} onClick={() => setRows((list) => [...list, blank({ accountId: list[list.length - 1]?.accountId || '', office: list[list.length - 1]?.office || '', amount: left > 0 ? String(left) : '' })])}>جزء آخر</Button>
    <Alert severity={left === 0 ? 'success' : 'warning'} className="mt-3">
      مجموع الأجزاء <b><Ltr>{total.toLocaleString('en-US')} {currency}</Ltr></b> · مبلغ السطر <b><Ltr>{paid.toLocaleString('en-US')} {currency}</Ltr></b>
      {left === 0 ? ' — مطابق تمامًا.' : left > 0 ? <> — بقي <b><Ltr>{left.toLocaleString('en-US')} {currency}</Ltr></b> بلا توزيع.</> : <> — الأجزاء أكبر من السطر بـ <b><Ltr>{(-left).toLocaleString('en-US')} {currency}</Ltr></b>.</>}
      <Sub>الجزء الذي تاريخه في شهر سابق يُسجَّل مصروفًا في ذلك الشهر، بسعر صرف يومه.</Sub>
    </Alert>
    {askConfirm && <FormControlLabel control={<Checkbox checked={confirmNewCost} onChange={(e) => setConfirmNewCost(e.target.checked)} />}
      label="راجعت الفواتير المذكورة وأؤكد أن هذه الأجزاء تكلفة أخرى غير مسجلة" />}
    <div className="d-flex justify-content-end gap-2 mt-3">
      <Button disabled={busy} onClick={onClose}>إلغاء</Button>
      <Button variant="contained" disabled={busy || !ready} onClick={save}>{busy ? 'جارٍ التقسيم…' : `تقسيم على ${rows.length} أجزاء وربط السطر`}</Button>
    </div>
  </>;
}
