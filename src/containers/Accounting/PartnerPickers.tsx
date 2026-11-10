import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, TextField } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { acc, errorText } from './accountingApi';
import { useVendors } from './shared';
import { Badge, DataTable, Ltr, Sub } from './ui';

const money = (value: number, currency = 'USD') => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
const yuanText = (value: number) => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}¥`;

// The line's dollars (cents) over its parts, as the server splits them: a recorded purchase keeps its
// own dollars, the rest goes over the other parts by their yuan, the last taking the cents left
export function splitUsd(paid: number, items: { yuan: number, fixed?: number }[]): { shares?: number[], error?: string } {
  const fixed = items.reduce((s, item) => s + (item.fixed ?? 0), 0);
  const free = items.filter((item) => item.fixed === undefined);
  const rest = paid - fixed;
  if (!free.length) return rest === 0 ? { shares: items.map((item) => item.fixed as number) } : { error: `قيمة شراء اليوان المسجل ${money(fixed / 100)} والسطر ${money(paid / 100)}` };
  if (rest <= 0) return { error: `مشتريات اليوان المسجلة (${money(fixed / 100)}) تستهلك كل السطر (${money(paid / 100)})` };
  const yuan = free.reduce((s, item) => s + item.yuan, 0);
  let left = rest;
  let seen = 0;
  const shares = items.map((item) => {
    if (item.fixed !== undefined) return item.fixed;
    seen += 1;
    const usd = seen === free.length ? left : Math.round(rest * item.yuan / yuan);
    left -= usd;
    return usd;
  });
  return shares.some((usd) => usd <= 0) ? { error: 'حصة أحد الأجزاء من دولار السطر صفر أو أقل' } : { shares };
}

// What the server needs for each proposed part of a grouped line
export const proposedParts = (proposal: any) => proposal.parts.map((p: any) => (p.choice === 'bill' ? { kind: 'bill', billId: p.bill.billId }
  : p.choice === 'purchase' ? { kind: 'purchase', purchaseId: p.purchase.purchaseId }
    : { kind: 'new', cny: p.arrival.amount, toAccountId: p.arrival.accountId, arrivalLineId: p.arrival.lineId }));

// What one part of a grouped line was found to be, in words
export const partLabel = (p: any) => (p.choice === 'bill' ? <>فاتورة <Ltr>{p.bill.number}</Ltr>{p.bill.orders?.length > 0 && <> (طلبية <Ltr>{p.bill.orders.join('، ')}</Ltr>)</>}</>
  : p.choice === 'purchase' ? <>شراء يوان مسجل <Ltr>{p.purchase.number}</Ltr></>
    : p.choice === 'new' ? <>شراء يوان جديد إلى {p.arrival.account} (وصل <Ltr>{p.arrival.day}</Ltr>)</>
      : <b>لا يوجد ما يطابقه</b>);

type Row = { key: number, amount: string, kind: '' | 'bill' | 'purchase' | 'new', billId?: string, purchaseId?: string, toAccountId?: string, arrivalLineId?: string };
let rowKey = 0;

// One line of the partner's statement taken apart: for each yuan part, the order bill it paid, a yuan
// purchase already recorded from the current account, or a new yuan purchase into an Alipay account
// (with its arrival line in the Alipay statement). Shows the dollars of each part before approving.
// The parts read from the description can be corrected, removed or added to when it is written wrong;
// the person then confirms that the statement's figures are wrong (kept in the audit).
export function GroupedLineDialog({ line, proposal, accounts, onClose, onDone }: { line: any, proposal: any, accounts: any[], onClose: () => void, onDone: (text: string) => void }) {
  const { vendors } = useVendors();
  const alipays = useMemo(() => accounts.filter((a: any) => a.isCash && a.isActive && !a.isGroup && a.currency === 'CNY'), [accounts]);
  const [data, setData] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>(() => proposal.parts.map((p: any) => ({ key: rowKey++, amount: String(p.amount),
    ...(p.choice === 'bill' ? { kind: 'bill', billId: String(p.bill.billId) }
      : p.choice === 'purchase' ? { kind: 'purchase', purchaseId: String(p.purchase.purchaseId) }
        : p.choice === 'new' ? { kind: 'new', toAccountId: String(p.arrival.accountId), arrivalLineId: String(p.arrival.lineId) }
          : { kind: '' }) })));
  const [vendorId, setVendorId] = useState<string>(proposal.broker?.vendorId ? String(proposal.broker.vendorId) : '');
  const [corrected, setCorrected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    acc.get(`bank/lines/${line._id}/partner-transfer-options`).then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  }, [line._id]);
  const bills: any[] = data?.results || [];
  const purchases: any[] = data?.purchases || [];
  const arrivals: any[] = data?.arrivals || [];
  const byCloseness = (list: any[], amount: number) => [...list].sort((a, b) => Math.abs(a.amount - amount) - Math.abs(b.amount - amount));
  const set = (i: number, patch: Partial<Row>) => setRows((current) => current.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setRows((current) => current.filter((_, j) => j !== i));
  const add = () => setRows((current) => [...current, { key: rowKey++, amount: '', kind: '' }]);
  const takenElsewhere = (i: number, key: keyof Row, id: string) => rows.some((row, j) => j !== i && row[key] === id);
  const amountOf = (row: Row) => Math.round(Number(String(row.amount).replace(/,/g, '')) * 100) / 100 || 0;

  // Each part's yuan as it will be posted (a bill's or recorded purchase's own yuan, an arrival's amount, or the yuan typed)
  const items = rows.map((row) => {
    if (row.kind === 'bill') { const bill = bills.find((b) => String(b.billId) === row.billId); return bill ? { yuan: bill.amount } : null; }
    if (row.kind === 'purchase') { const p = purchases.find((x) => String(x.purchaseId) === row.purchaseId); return p ? { yuan: p.amount, fixed: p.usd } : null; }
    if (row.kind === 'new') {
      if (!row.toAccountId) return null;
      const arrival = arrivals.find((a) => String(a.lineId) === row.arrivalLineId);
      const yuan = arrival ? arrival.amount : amountOf(row);
      return yuan > 0 ? { yuan } : null;
    }
    return null;
  });
  const ready = !!data && rows.length > 0 && items.every(Boolean);
  const split = ready ? splitUsd(-line.amount, items as any[]) : null;
  const yuan = Math.round(items.reduce((s, item) => s + (item?.yuan || 0), 0) * 100) / 100;
  const gap = Math.round((proposal.total - yuan) * 100) / 100;
  const yuanOk = Math.abs(gap) <= rows.length;
  // Parts changed from the description: removed, added, or an amount retyped
  const edited = rows.length !== proposal.parts.length || rows.some((row, i) => amountOf(row) !== proposal.parts[i]?.amount);
  const needsBroker = rows.some((row) => row.kind === 'new') && !proposal.beforeCount;
  const ok = ready && !!split?.shares && (yuanOk || corrected) && (!needsBroker || !!vendorId);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const parts = rows.map((row, i) => (row.kind === 'bill' ? { kind: 'bill', billId: row.billId }
        : row.kind === 'purchase' ? { kind: 'purchase', purchaseId: row.purchaseId }
          : { kind: 'new', cny: (items[i] as any).yuan, toAccountId: row.toAccountId, arrivalLineId: row.arrivalLineId || undefined }));
      await acc.post(`bank/lines/${line._id}/partner-transfers`, { parts, vendorId: vendorId || undefined, statementCorrected: !yuanOk && corrected ? true : undefined });
      onDone(`طوبق السطر: ${rows.filter((r) => r.kind === 'bill').length} فاتورة مسددة، ${rows.filter((r) => r.kind !== 'bill').length} شراء يوان، دون تكرار التكلفة.`);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>تفكيك سطر الحوالات<Sub><Ltr>{line.day}</Ltr> · {line.description} · <b><Ltr>{money(-line.amount / 100)}</Ltr></b></Sub></DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" className="mb-3">
          الكشف يذكر <b>{proposal.parts.map((p: any) => yuanText(p.amount)).join(' + ')}</b> = <b>{yuanText(proposal.total)}</b>{proposal.rate && <> بسعر <Ltr>{proposal.rate}</Ltr></>}.
          لكل جزء اختر: <b>فاتورة طلبية</b> إن دفعه الوسيط مباشرة للبائع، أو <b>شراء يوان</b> إن وصل اليوان إلى حسابك في Alipay.
          إذا كان البيان مكتوبًا خطأ، عدّل مبلغ الجزء أو احذفه أو أضف جزءًا.
          {proposal.beforeCount && <> <b>السطر قبل الجرد:</b> تُسدَّد الفواتير، ولا يُسجَّل شراء يوان لأن رصيد Alipay المجرود يشمله.</>}
        </Alert>
        {needsBroker && <Autocomplete size="small" className="mb-3" options={vendors} value={vendors.find((v: any) => v._id === vendorId) || null}
          getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id} onChange={(_, v: any) => setVendorId(v?._id || '')}
          renderInput={(p) => <TextField {...p} label="الوسيط الذي باع اليوان" helperText={!vendorId ? 'اختر الوسيط لتسجيل شراء اليوان' : undefined} />} />}
        {rows.map((row, i) => {
          const amount = amountOf(row);
          const share = split?.shares?.[i];
          const itemYuan = items[i]?.yuan;
          const recordDiffers = itemYuan !== undefined && amount > 0 && Math.abs(itemYuan - amount) > 1 && row.kind !== 'new';
          return <div key={row.key} className="mb-3 pb-2" style={{ borderBottom: '1px solid var(--acc-border, #e3e8e8)' }}>
            <div className="d-flex gap-2 flex-wrap align-items-center mb-2">
              <TextField size="small" label={`الجزء ${i + 1} (¥)`} value={row.amount} sx={{ width: 160 }} inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
                onChange={(e) => set(i, { amount: e.target.value, ...(row.kind === 'new' && { arrivalLineId: undefined }) })} />
              {share !== undefined && <span>← <b><Ltr>{money(share / 100)}</Ltr></b>{itemYuan ? <Sub>سعر <Ltr>{(itemYuan / (share / 100)).toFixed(4)}</Ltr></Sub> : null}</span>}
              {recordDiffers && <Sub>يُسجَّل بمبلغ {row.kind === 'bill' ? 'الفاتورة' : 'العملية'}: <Ltr>{yuanText(itemYuan as number)}</Ltr></Sub>}
              <IconButton size="small" aria-label="حذف الجزء" title="حذف الجزء" sx={{ marginInlineStart: 'auto' }} disabled={rows.length === 1} onClick={() => remove(i)}><Trash2 size={16} /></IconButton>
            </div>
            <div className="acc-form-grid">
              <TextField select size="small" label="هذا الجزء" value={row.kind} onChange={(e) => set(i, { kind: e.target.value as Row['kind'], billId: undefined, purchaseId: undefined,
                toAccountId: e.target.value === 'new' ? (row.toAccountId || alipays[0]?._id) : undefined, arrivalLineId: undefined })}>
                <MenuItem value="bill">فاتورة طلبية (دفعه الوسيط للبائع)</MenuItem>
                <MenuItem value="purchase">شراء يوان مسجل من الحساب الجاري</MenuItem>
                <MenuItem value="new">شراء يوان جديد إلى Alipay</MenuItem>
              </TextField>
              {row.kind === 'bill' && <TextField select size="small" label="الفاتورة" value={row.billId || ''} onChange={(e) => set(i, { billId: e.target.value })}>
                {byCloseness(bills, amount).filter((b) => !takenElsewhere(i, 'billId', String(b.billId))).slice(0, 40).map((b) =>
                  <MenuItem key={String(b.billId)} value={String(b.billId)}>{b.number} · {yuanText(b.amount)} · {b.orders.join('، ') || '-'} · {b.day}</MenuItem>)}
              </TextField>}
              {row.kind === 'purchase' && <TextField select size="small" label="عملية شراء اليوان" value={row.purchaseId || ''} onChange={(e) => set(i, { purchaseId: e.target.value })}>
                {byCloseness(purchases, amount).filter((p) => !takenElsewhere(i, 'purchaseId', String(p.purchaseId))).map((p) =>
                  <MenuItem key={String(p.purchaseId)} value={String(p.purchaseId)}>{p.number} · {yuanText(p.amount)} · {money(p.usd / 100)} · {p.day}</MenuItem>)}
              </TextField>}
              {row.kind === 'new' && <>
                <TextField select size="small" label="إلى حساب Alipay" value={row.toAccountId || ''} onChange={(e) => set(i, { toAccountId: e.target.value, arrivalLineId: undefined })}>
                  {alipays.map((a: any) => <MenuItem key={a._id} value={a._id}>{a.code} · {a.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="وصوله في كشف Alipay" value={row.arrivalLineId || ''} onChange={(e) => set(i, { arrivalLineId: e.target.value || undefined })}>
                  <MenuItem value="">لم يُستورد بعد (يُطابق لاحقًا)</MenuItem>
                  {byCloseness(arrivals.filter((a) => String(a.accountId) === row.toAccountId && Math.abs(a.amount - amount) <= 1), amount)
                    .filter((a) => !takenElsewhere(i, 'arrivalLineId', String(a.lineId))).map((a) =>
                      <MenuItem key={String(a.lineId)} value={String(a.lineId)}>{yuanText(a.amount)} · {a.day}{a.reference ? ` · ${a.reference}` : ''}</MenuItem>)}
                </TextField>
              </>}
            </div>
          </div>;
        })}
        <Button size="small" startIcon={<Plus size={16} />} onClick={add} className="mb-3">إضافة جزء</Button>
        {ready && <Alert severity={ok ? 'success' : 'warning'}>
          اليوان <b><Ltr>{yuanText(yuan)}</Ltr></b> من <b><Ltr>{yuanText(proposal.total)}</Ltr></b> · الدولار <b><Ltr>{money(-line.amount / 100)}</Ltr></b>
          {!yuanOk && <>: {gap > 0 ? `ينقص ${yuanText(gap)}` : `يزيد ${yuanText(-gap)}`} عن البيان</>}
          {split?.error && <>: {split.error}</>}
        </Alert>}
        {ready && !yuanOk && <FormControlLabel className="mt-2" control={<Checkbox checked={corrected} onChange={(e) => setCorrected(e.target.checked)} />}
          label={edited ? 'البيان مكتوب خطأ: أعتمد الأجزاء والمبالغ التي أدخلتها (تُحفظ أرقام البيان في السجل)' : 'البيان مكتوب خطأ: أعتمد الأجزاء المختارة رغم اختلاف المجموع'} />}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !ok} onClick={save}>{busy ? 'جارٍ الاعتماد…' : 'اعتماد ومطابقة السطر'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// The partner's wallet deposits around a statement line (Wasl): pick one or several whose total is
// the line, up to 1$ apart (the difference goes to rounding)
export function DepositPicker({ line, accountName, onClose, onDone }: { line: any, accountName?: string, onClose: () => void, onDone: (text: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    acc.get(`bank/lines/${line._id}/partner-deposit-options`).then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  }, [line._id]);
  const rows = data?.results || [];
  const chosen = rows.filter((r: any) => picked.includes(String(r.statementId)));
  const lineUsd = line.amount / 100;
  const sum = chosen.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const difference = Math.round((lineUsd - sum) * 100) / 100;
  const ok = chosen.length > 0 && Math.abs(difference) <= (data?.tolerance ?? 1) && chosen.every((r: any) => !!r.beforeCount === !!chosen[0].beforeCount);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await acc.post(`bank/lines/${line._id}/partner-deposit`, { statementIds: picked, confirmDifference: true });
      onDone(chosen[0]?.beforeCount ? 'رُبط السطر بالإيداعات المختارة للمتابعة فقط (قبل الجرد).' : `رُبط السطر بـ ${chosen.length} إيداع${difference ? `، والفرق ${difference}$ في فروقات التقريب` : ''}.`);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>اختيار إيداعات المحفظة<Sub><Ltr>{line.day}</Ltr> · {line.description} · <b><Ltr>{money(lineUsd)}</Ltr></b></Sub></DialogTitle>
      <DialogContent dividers>
        <Sub>إيداعات محفظة صاحب {accountName || 'الحساب'} خلال 60 يوماً، الأقرب مبلغاً أولاً. اختر واحداً أو أكثر؛ مجموعها يجب أن يساوي السطر أو يختلف بدولار واحد على الأكثر.</Sub>
        <DataTable dense loading={!data && !error} rows={rows} rowKey={(r: any) => String(r.statementId)}
          empty={{ title: 'لا توجد إيداعات متاحة', hint: 'لا يوجد إيداع غير مربوط لهذا الشريك قريب من التاريخ.' }}
          columns={[
            { key: 'pick', header: '', width: 44, render: (r: any) => <Checkbox size="small" checked={picked.includes(String(r.statementId))}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, String(r.statementId)] : p.filter((x) => x !== String(r.statementId))))} /> },
            { key: 'day', header: 'التاريخ', render: (r: any) => <><Ltr>{r.day}</Ltr><Sub>{r.daysApart ? `فرق ${r.daysApart} يوماً` : 'نفس اليوم'}</Sub></> },
            { key: 'amount', header: 'المبلغ', render: (r: any) => <><b><Ltr>{money(r.amount)}</Ltr></b>{r.difference !== 0 && <Sub>الفرق عن السطر <Ltr>{(r.difference / 100).toFixed(2)}</Ltr></Sub>}</> },
            { key: 'what', header: 'الإيداع', render: (r: any) => <>{r.customer}{r.note && <Sub>{r.note}</Sub>}<Sub>{r.beforeCount ? <Badge tone="muted">قبل الجرد</Badge> : r.onAccount ? <Badge tone="ok">على الحساب الجاري</Badge> : <Badge tone="warn">على «{r.recordedOn || 'خزينة'}»: سيُنقل</Badge>}</Sub></> },
          ]} />
        {chosen.length > 0 && <Alert severity={ok ? 'success' : 'warning'} className="mt-3">
          المختار <b><Ltr>{money(sum)}</Ltr></b> · السطر <b><Ltr>{money(lineUsd)}</Ltr></b> · الفرق <b><Ltr>{difference.toFixed(2)}$</Ltr></b>
          {Math.abs(difference) > (data?.tolerance ?? 1) && ' — أكثر من دولار واحد؛ أضف أو أزل إيداعاً.'}
          {ok && difference !== 0 && ' — يُسجّل الفرق في فروقات التقريب.'}
        </Alert>}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !ok} onClick={save}>{busy ? 'جارٍ الربط…' : 'ربط المختار'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Yuan bought from a broker (one Alipay line or several): one paying account, the amount paid for
// each line in its currency (filled from a rate, editable); recorded and matched in one step
export function YuanPurchaseDialog({ lines, hints, accounts, onClose, onDone }: { lines: any[], hints: Record<string, any>, accounts: any[], onClose: () => void, onDone: (text: string) => void }) {
  const payers = accounts.filter((a: any) => a.isCash && a.isActive && !a.isGroup && a.currency !== 'CNY');
  const [fromAccountId, setFromAccountId] = useState(() => { try { return localStorage.getItem('acc-yuan-payer') || ''; } catch { return ''; } });
  const [rate, setRate] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const payer = payers.find((a: any) => a._id === fromAccountId);
  const currency = payer?.currency || 'USD';
  const fill = (value: string) => {
    setRate(value);
    const r = Number(value);
    if (r > 0) setAmounts(Object.fromEntries(lines.map((l) => [l._id, (Math.round((l.amount / 100 / r) * 100) / 100).toFixed(2)])));
  };
  const total = lines.reduce((s, l) => s + (Number(amounts[l._id]) || 0), 0);
  const yuan = lines.reduce((s, l) => s + l.amount / 100, 0);
  const ok = !!payer && lines.every((l) => Number(amounts[l._id]) > 0);
  const save = async () => {
    setBusy(true); setError('');
    try {
      try { localStorage.setItem('acc-yuan-payer', fromAccountId); } catch { /* storage may be blocked */ }
      const res: any = await acc.post('bank/yuan-lines', { lineIds: lines.map((l) => l._id), fromAccountId, amounts });
      onDone(`سُجّلت ${res.data.recorded} عملية شراء يوان (${res.data.numbers.join('، ')}) وطوبقت مع الكشف.`);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  };
  const broker = hints[lines[0]?._id]?.broker?.name;
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>تسجيل شراء يوان{lines.length > 1 ? ` (${lines.length} سطور)` : ''}<Sub>من {broker || 'الوسيط'} · <Ltr>{yuan.toLocaleString('en-US')}¥</Ltr> وصلت إلى Alipay</Sub></DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" className="mb-3">يخرج المبلغ المدفوع من الحساب الذي دفع للوسيط، ويدخل اليوان إلى Alipay بسعره. ليست إيراداً ولا مصروفاً؛ وتُطابق السطور تلقائياً.</Alert>
        <TextField select fullWidth size="small" label="الحساب الذي دُفع منه للوسيط" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}>
          <option value="" />
          {payers.map((a: any) => <option key={a._id} value={a._id}>{a.code} · {a.name} ({a.currency})</option>)}
        </TextField>
        <TextField fullWidth size="small" className="mt-3" type="number" label={`السعر: كم يوان مقابل 1 ${currency}`} value={rate} onChange={(e) => fill(e.target.value)}
          helperText="يملأ المبالغ تلقائياً؛ يمكنك تعديل مبلغ أي سطر بعدها" />
        <DataTable dense rows={lines} rowKey={(l: any) => l._id} columns={[
          { key: 'day', header: 'التاريخ', render: (l: any) => <Ltr>{l.day}</Ltr> },
          { key: 'cny', header: 'اليوان', render: (l: any) => <b><Ltr>{(l.amount / 100).toLocaleString('en-US')}¥</Ltr></b> },
          { key: 'paid', header: `المدفوع (${currency})`, render: (l: any) => <TextField size="small" type="number" value={amounts[l._id] || ''}
            onChange={(e) => setAmounts((a) => ({ ...a, [l._id]: e.target.value }))} inputProps={{ step: '0.01', min: 0 }} style={{ maxWidth: 140 }} /> },
          { key: 'rate', header: 'سعره', render: (l: any) => Number(amounts[l._id]) > 0 ? <Ltr>{(l.amount / 100 / Number(amounts[l._id])).toFixed(4)}</Ltr> : '—' },
        ]} />
        {total > 0 && <Sub>المجموع: <b><Ltr>{total.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}</Ltr></b> مقابل <b><Ltr>{yuan.toLocaleString('en-US')}¥</Ltr></b></Sub>}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !ok} onClick={save}>{busy ? 'جارٍ التسجيل…' : 'تسجيل ومطابقة'}</Button>
      </DialogActions>
    </Dialog>
  );
}
