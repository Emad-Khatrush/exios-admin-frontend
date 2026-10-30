import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Badge, DataTable, Ltr, Sub } from './ui';

const money = (value: number, currency = 'USD') => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;

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

// Unpaid yuan bills of customers' Alipay transfers around a partner's line: pick those the line paid
export function TransferPicker({ line, preset, onClose, onDone }: { line: any, preset?: string[], onClose: () => void, onDone: (text: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>(preset || []);
  const [known, setKnown] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      acc.get(`bank/lines/${line._id}/partner-transfer-options`, { q: q || undefined })
        .then((res: any) => { setData(res.data); setKnown((k) => ({ ...k, ...Object.fromEntries(res.data.results.map((r: any) => [String(r.billId), r])) })); })
        .catch((err: any) => setError(errorText(err)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [line._id, q]);
  const chosen = picked.map((id) => known[id]).filter(Boolean);
  const yuan = chosen.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const total = data?.parsed?.total;
  const gap = total ? Math.round((total - yuan) * 100) / 100 : 0;
  const ok = chosen.length > 0 && (!total || Math.abs(gap) <= chosen.length);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await acc.post(`bank/lines/${line._id}/partner-transfers`, { billIds: picked, confirmDifference: true });
      onDone(`سُددت ${chosen.length} فواتير حوالات من السطر دون تكرار التكلفة.`);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>اختيار فواتير الحوالات<Sub><Ltr>{line.day}</Ltr> · {line.description} · <b><Ltr>{money(-line.amount / 100)}</Ltr></b></Sub></DialogTitle>
      <DialogContent dividers>
        {data?.parsed && <Alert severity="info" className="mb-2">الكشف يذكر <b>{data.parsed.parts.map((p: number) => `${p.toLocaleString('en-US')}¥`).join(' + ')}</b> = <b>{data.parsed.total.toLocaleString('en-US')}¥</b>{data.parsed.rate && <> بسعر <Ltr>{data.parsed.rate}</Ltr></>}. اختر فاتورة الطلبية لكل حوالة؛ يُوزَّع دولار السطر عليها حسب اليوان.</Alert>}
        <TextField size="small" fullWidth className="mb-2" label="بحث برقم الطلبية أو الفاتورة" value={q} onChange={(e) => setQ(e.target.value)} />
        <DataTable dense loading={!data && !error} rows={data?.results || []} rowKey={(r: any) => String(r.billId)}
          empty={{ title: 'لا توجد فواتير يوان غير مسددة', hint: 'إن لم تُسجّل حوالة طلبية بعد، أضف مشترياتها باليوان في صفحة الطلبية ثم ارجع.' }}
          columns={[
            { key: 'pick', header: '', width: 44, render: (r: any) => <Checkbox size="small" checked={picked.includes(String(r.billId))}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, String(r.billId)] : p.filter((x) => x !== String(r.billId))))} /> },
            { key: 'bill', header: 'الفاتورة', render: (r: any) => <><Ltr>{r.number}</Ltr><Sub><Ltr>{r.day}</Ltr> · {r.vendor}</Sub></> },
            { key: 'orders', header: 'الطلبية', render: (r: any) => <Ltr>{r.orders.join('، ') || '—'}</Ltr> },
            { key: 'amount', header: 'اليوان', render: (r: any) => <b><Ltr>{r.amount.toLocaleString('en-US')}¥</Ltr></b> },
          ]} />
        {chosen.length > 0 && <Alert severity={ok ? 'success' : 'warning'} className="mt-3">
          المختار <b><Ltr>{yuan.toLocaleString('en-US')}¥</Ltr></b>{total && <> من <b><Ltr>{total.toLocaleString('en-US')}¥</Ltr></b>{gap > chosen.length && <> — ينقص <b><Ltr>{gap.toLocaleString('en-US')}¥</Ltr></b>: اختر بقية الحوالات أو أضف مشتريات الطلبية الناقصة</>}{gap < -chosen.length && ' — أكثر من الكشف؛ أزل فاتورة'}</>}
        </Alert>}
        {error && <Alert severity="error" className="mt-2">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !ok} onClick={save}>{busy ? 'جارٍ السداد…' : 'سداد المختار من السطر'}</Button>
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
