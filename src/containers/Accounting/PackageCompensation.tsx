import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { errorText, sys } from './accountingApi';
import { Badge, DataTable, Ltr, Panel, Sub } from './ui';

// A lost or partly damaged package (owner's request 2026-11-02). An admin or the owner compensates
// the value of its goods into the customer's dollar or dinar wallet; shipping is never compensated.
// A lost package is closed; a damaged one is closed or kept open (delivered and paid as usual).
// Closed: no longer delivered, and the shipping not paid yet is cancelled.

const TYPE_LABEL: Record<string, string> = { lost: 'مفقود', damaged: 'تالف جزئياً' };
const usdText = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}$`;

const CompensationDialog = ({ orderId, row, onClose, onDone }: { orderId: string; row: any; onClose: () => void; onDone: () => void }) => {
  const [quote, setQuote] = useState<any>(null);
  const [form, setForm] = useState<any>({ type: row.received ? 'damaged' : 'lost', close: false, currency: 'USD', rate: '', goodsAmount: '', reason: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    sys.get(`acc/orders/${orderId}/packages/${row._id}/compensation`)
      .then((res: any) => { setQuote(res.data); setForm((f: any) => ({ ...f, rate: res.data.rate ? String(res.data.rate) : '' })); })
      .catch((err: any) => setError(errorText(err)));
  }, [orderId, row._id]);
  const set = (patch: any) => setForm({ ...form, ...patch });

  const lost = form.type === 'lost';
  const closed = lost || form.close;
  const rate = form.currency === 'USD' ? 1 : Number(form.rate);
  const valid = rate > 0 && Number(form.goodsAmount) > 0 && form.reason.trim();

  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await sys.post(`acc/orders/${orderId}/packages/${row._id}/compensation`, {
        type: form.type, close: closed, currency: form.currency, rate: form.currency === 'USD' ? 1 : Number(form.rate),
        goodsAmount: Number(form.goodsAmount), reason: form.reason, note: form.note,
      });
      onDone();
    } catch (err: any) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // What closing does to the shipping, in words
  const shippingText = quote && (quote.unpaidUsd > 0
    ? `يُلغى عن العميل الشحن غير المدفوع (${usdText(quote.unpaidUsd)})${quote.paidUsd > 0 ? ` ويبقى ما دفعه (${usdText(quote.paidUsd)})` : ''}.`
    : quote.paidUsd > 0 ? `الشحن مدفوع (${usdText(quote.paidUsd)}) ويبقى كما هو.` : '');

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>تعويض الطرد <Ltr>{row.tracking || ''}</Ltr></DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" className="mb-2">{error}</Alert>}
        {!quote ? <p className="acc-muted">جارٍ التحميل...</p> : <>
          <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={form.type} onChange={(_, value) => value && set({ type: value })} className="mb-3">
            <ToggleButton value="lost" disabled={quote.received}>مفقود</ToggleButton>
            <ToggleButton value="damaged">تالف جزئياً</ToggleButton>
          </ToggleButtonGroup>

          {lost
            ? <p className="acc-muted">الطرد المفقود يُقفل بعد التعويض: لا يُسلَّم، وتُحمَّل تكلفة شحنه على الشركة. {shippingText}</p>
            : <RadioGroup value={form.close ? 'close' : 'open'} onChange={(e) => set({ close: e.target.value === 'close' })} className="mb-2">
              <FormControlLabel value="open" control={<Radio size="small" />} label={<>يبقى مفتوحاً: يُسلَّم للعميل ويدفع شحنه كالمعتاد{quote.chargeUsd > 0 && <> ({usdText(quote.chargeUsd)})</>}</>} />
              <FormControlLabel value="close" control={<Radio size="small" />} label={<>يُقفل بعد التعويض: لا يدفع شيئاً بعده. <span className="acc-muted">{shippingText}</span></>} />
            </RadioGroup>}

          <div className="acc-form-grid">
            <TextField select label="المحفظة" value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              <MenuItem value="USD">دولار</MenuItem>
              <MenuItem value="LYD">دينار</MenuItem>
            </TextField>
            {form.currency === 'LYD' && <TextField type="number" label="سعر الدولار بالدينار" value={form.rate} onChange={(e) => set({ rate: e.target.value })} />}
            <TextField type="number" label={`تعويض قيمة البضاعة (${form.currency})`} value={form.goodsAmount} onChange={(e) => set({ goodsAmount: e.target.value })} />
          </div>

          <TextField fullWidth label="السبب" required value={form.reason} onChange={(e) => set({ reason: e.target.value })} className="mt-3" />
          <TextField fullWidth label="ملاحظة" value={form.note} onChange={(e) => set({ note: e.target.value })} className="mt-2" />

          {valid && <Alert severity="info" className="mt-3">
            يدخل محفظة العميل: <strong><Ltr>{Number(form.goodsAmount)} {form.currency}</Ltr></strong> · الطرد {closed ? 'يُقفل' : 'يبقى مفتوحاً'}
          </Alert>}
        </>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>إلغاء</Button>
        <Button variant="contained" disabled={busy || !quote || !valid} onClick={save}>تسجيل التعويض</Button>
      </DialogActions>
    </Dialog>
  );
};

// The order's packages with their compensation: compensate one, or undo it
export const PackageCompensationPanel = ({ orderId, onChanged }: { orderId: string; onChanged: () => void }) => {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    sys.get(`acc/orders/${orderId}/packages-state`).then((res: any) => setData(res.data)).catch(() => {});
  }, [orderId]);
  useEffect(load, [load]);
  if (!data) return null;
  const rows = (data.results || []).filter((p: any) => !p.abandoned && (p.compensation || data.canManage));
  if (!rows.length) return null;
  const done = () => { setOpen(null); load(); onChanged(); };
  const undo = async (row: any) => {
    if (!window.confirm('التراجع عن التعويض؟ يُسحب المبلغ من محفظة العميل ويعود الطرد كما كان.')) return;
    try {
      setError('');
      await sys.delete(`acc/orders/${orderId}/packages/${row._id}/compensation`);
      done();
    } catch (err: any) {
      setError(errorText(err));
    }
  };
  return (
    <Panel flush title="تعويض الطرود المفقودة أو التالفة" subtitle="يدخل تعويض قيمة البضاعة محفظة العميل (دولار أو دينار). الطرد المُقفل لا يُسلَّم، ويُلغى شحنه غير المدفوع. التراجع ممكن ما دام الرصيد في المحفظة.">
      {error && <Alert severity="error" className="mx-3 mb-2">{error}</Alert>}
      <DataTable
        dense rows={rows} rowKey={(row: any) => row._id}
        columns={[
          { key: 'tracking', header: 'الطرد', render: (row: any) => <><Ltr>{row.tracking || '-'}</Ltr> {row.compensation
            ? <Badge tone={row.compensation.type === 'lost' ? 'danger' : 'warn'}>{TYPE_LABEL[row.compensation.type]} · {row.compensation.closed ? 'مُقفل' : 'مفتوح'}</Badge>
            : row.received && <Badge tone="muted">مُسلَّم</Badge>}</> },
          { key: 'comp', header: 'التعويض', render: (row: any) => (row.compensation ? <><Ltr>{row.compensation.goods?.amount} {row.compensation.currency}</Ltr><Sub>{row.compensation.reason}</Sub></> : null) },
          ...(data.canManage ? [{
            key: 'actions', header: '', align: 'end' as const, render: (row: any) => (row.compensation
              ? <Button size="small" onClick={() => undo(row)}>تراجع</Button>
              : <Button size="small" color="warning" onClick={() => setOpen(row)}>مفقود / تالف</Button>),
          }] : []),
        ]}
      />
      {open && <CompensationDialog orderId={orderId} row={open} onClose={() => setOpen(null)} onDone={done} />}
    </Panel>
  );
};
