import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { useVendors } from './shared';
import { DataTable, Ltr, Open, Sub } from './ui';

const fmt = (value: number, currency: string) => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${currency}`;
const round = (value: number) => Math.round(value * 1000) / 1000;

// From the bank matching page: one outgoing line paying several supplier bills (of one vendor or
// several). Each chosen bill is paid in full from the line's account and the line is matched to
// the payments; unmatching the line later cancels them and the bills are unpaid again.
export default function BankBillsPayPicker({ line, embedded, onClose, onDone, onBusyChange }: { line: any, embedded?: boolean, onClose: () => void, onDone: (text: string) => void, onBusyChange?: (busy: boolean) => void }) {
  const { vendors } = useVendors();
  const [vendorId, setVendorId] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState<Record<string, any>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [excessVendorId, setExcessVendorId] = useState('');
  const [confirmExcess, setConfirmExcess] = useState(false);
  const [confirmDifference, setConfirmDifference] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      acc.get(`bank/lines/${line._id}/bill-options`, { q: q.trim() || undefined, vendorId: vendorId || undefined })
        .then((res: any) => { if (!active) return; setData(res.data); setError(''); setKnown((k) => ({ ...k, ...Object.fromEntries(res.data.results.map((r: any) => [String(r._id), r])) })); })
        .catch((err: any) => { if (active) setError(errorText(err)); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [line._id, q, vendorId]);
  const currency = data?.bankCurrency || line.currency || 'USD';
  const paid = data?.paid ?? 0;
  const chosen = picked.map((id) => known[id]).filter(Boolean);
  const sameCurrency = chosen.every((b: any) => b.currency === currency);
  const total = round(chosen.reduce((s: number, b: any) => s + (sameCurrency ? b.openNative : b.openUsd / 100), 0));
  const excess = sameCurrency ? round(paid - total) : 0;
  const chosenVendors = useMemo(() => {
    const map = new Map<string, string>();
    chosen.forEach((b: any) => map.set(String(b.vendorId), b.vendorName));
    return Array.from(map.entries());
  }, [chosen]);
  useEffect(() => {
    if (!chosenVendors.some(([id]) => id === excessVendorId)) setExcessVendorId(chosenVendors[0]?.[0] || '');
  }, [chosenVendors, excessVendorId]);
  useEffect(() => { setConfirmExcess(false); setConfirmDifference(false); }, [picked]);
  useEffect(() => { onBusyChange?.(busy); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const over = sameCurrency && excess < 0;
  const ready = chosen.length > 0 && !over && (!sameCurrency || excess <= 0 || (!!excessVendorId && confirmExcess)) && (sameCurrency || confirmDifference);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const res = await acc.post(`bank/lines/${line._id}/pay-bills`, { billIds: picked, excessVendorId: excess > 0 ? excessVendorId : undefined,
        confirmExcess, confirmDifference, note: note.trim() || undefined });
      onDone(`سُددت ${chosen.length} فاتورة من السطر بـ ${res.data.payments.length} دفعة (${res.data.payments.map((p: any) => p.number).join('، ')}) ورُبط السطر بها.`);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  };
  const content = <>
        <Alert severity="info" className="mb-2">اختر الفواتير التي دفعها هذا السطر، من مورد واحد أو عدة موردين. كل فاتورة تُسدد بالمتبقي عليها كاملًا، وتُنشأ دفعة واحدة لكل مورد ويُربط السطر بها. لا تُنشأ تكلفة جديدة. فك مطابقة السطر لاحقًا يلغي الدفعات وتعود الفواتير غير مسددة.</Alert>
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        <div className="d-flex gap-2 flex-wrap mb-2">
          <Autocomplete size="small" style={{ minWidth: 240 }} options={vendors} value={vendors.find((v: any) => v._id === vendorId) || null}
            getOptionLabel={(v: any) => v.name} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onChange={(_, v: any) => setVendorId(v?._id || '')} renderInput={(p) => <TextField {...p} label="المورد (اختياري)" />} />
          <TextField size="small" style={{ flex: 1, minWidth: 260 }} label="بحث برقم الفاتورة أو الطلبية أو المورد أو الملاحظة أو مرجع المورد" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {data?.truncated && <Alert severity="warning" className="mb-2">النتائج كثيرة؛ اختر المورد أو اكتب بحثًا لتضييقها.</Alert>}
        <DataTable dense loading={loading && !data} rows={data?.results || []} rowKey={(r: any) => String(r._id)}
          empty={{ title: 'لا توجد فواتير غير مسددة ضمن هذا البحث', hint: 'سجّل فاتورة المورد ورحّلها دون سداد، ثم ارجع إلى هذا السطر.' }}
          columns={[
            { key: 'pick', header: '', width: 44, render: (r: any) => <Checkbox size="small" disabled={busy} checked={picked.includes(String(r._id))} onChange={(e) => toggle(String(r._id), e.target.checked)} /> },
            { key: 'bill', header: 'الفاتورة', render: (r: any) => <><Open to={`/accounting/bills/${r._id}`}><Ltr>{r.number}</Ltr></Open><Sub><Ltr>{r.day}</Ltr> · {r.vendorName}</Sub>{r.vendorRef && <Sub>مرجع المورد: <Ltr>{r.vendorRef}</Ltr></Sub>}</> },
            { key: 'orders', header: 'الطلبية / البيان', render: (r: any) => <>{r.orders.length > 0 && <Ltr>{r.orders.join('، ')}</Ltr>}{r.description && <Sub>{r.description}</Sub>}{r.note && <Sub>📝 {r.note}</Sub>}</> },
            { key: 'amount', header: 'المتبقي', numeric: true, render: (r: any) => <><b><Ltr>{fmt(r.openNative, r.currency)}</Ltr></b>{r.currency !== 'USD' && <Sub><Ltr>{fmt(r.openUsd / 100, 'USD')}</Ltr></Sub>}{r.partial && <Sub>مسددة جزئيًا · الإجمالي <Ltr>{fmt(r.total, r.currency)}</Ltr></Sub>}</> },
          ]} />
        {chosen.length > 0 && <>
          <Alert severity={over ? 'error' : excess === 0 || !sameCurrency ? 'success' : 'warning'} className="mt-3">
            المختار {chosen.length} فاتورة لـ {chosenVendors.length} مورد: <b><Ltr>{fmt(total, sameCurrency ? currency : 'USD')}</Ltr></b> · مبلغ السطر <b><Ltr>{fmt(paid, currency)}</Ltr></b>
            {sameCurrency && excess === 0 && ' — مطابق تمامًا.'}
            {over && <> — الفواتير أكبر من السطر بـ <b><Ltr>{fmt(-excess, currency)}</Ltr></b>؛ أزل فاتورة.</>}
            {sameCurrency && excess > 0 && <> — يبقى <b><Ltr>{fmt(excess, currency)}</Ltr></b> زائدًا.</>}
            {!sameCurrency && <> — بعض الفواتير بعملة غير {currency}: يُوزَّع مبلغ السطر عليها حسب قيمتها بالدولار، والفرق يُضاف إلى تكلفتها (بحد أقصى 10%).</>}
          </Alert>
          {sameCurrency && excess > 0 && <div className="mt-2">
            <TextField select size="small" label="يبقى الزائد دفعة مقدمة لدى" value={excessVendorId} onChange={(e) => setExcessVendorId(e.target.value)} style={{ minWidth: 240 }}>
              {chosenVendors.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
            </TextField>
            <FormControlLabel className="ms-2" control={<Checkbox checked={confirmExcess} onChange={(e) => setConfirmExcess(e.target.checked)} />} label="أؤكد أن الزائد دُفع لهذا المورد ويبقى رصيدًا لي لديه" />
          </div>}
          {!sameCurrency && <FormControlLabel control={<Checkbox checked={confirmDifference} onChange={(e) => setConfirmDifference(e.target.checked)} />} label="راجعت الفواتير والمبالغ وأؤكد أن هذا السطر دفعها" />}
          <TextField size="small" fullWidth className="mt-2" label="ملاحظة على الدفعة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
        </>}
  </>;
  const actions = <>
    <Button disabled={busy} onClick={onClose}>إلغاء</Button>
    <Button variant="contained" disabled={busy || !ready} onClick={save}>{busy ? 'جارٍ السداد…' : `سداد ${chosen.length || ''} فاتورة وربط السطر`}</Button>
  </>;
  if (embedded) return <>{content}<div className="d-flex justify-content-end gap-2 mt-3">{actions}</div></>;
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth dir="rtl">
      <DialogTitle>سداد فواتير موردين من سطر الكشف
        <Sub><Ltr>{line.day}</Ltr> · {line.description} · <b><Ltr>{fmt(paid, currency)}</Ltr></b></Sub>
      </DialogTitle>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>{actions}</DialogActions>
    </Dialog>
  );
}
