import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { acc, errorText, newKey, sys, todayLibya } from './accountingApi';
import { Ltr, Money, Panel, Sub } from './ui';

// Sending the yuan of an order marked as an Alipay transfer, in one step (owner's decision, v8):
// out of an Alipay account at its average rate, recorded as the order's purchase cost. Used on
// the order page (staff, through /api) and on the Alipay page (accounting).
export const AlipaySendPanel = ({ orderId, from = 'order', onSent }: { orderId: string; from?: 'order' | 'accounting'; onSent?: () => void }) => {
  const client = from === 'order' ? sys : acc;
  const base = from === 'order' ? `acc/orders/${orderId}/alipay` : `alipay/orders/${orderId}`;
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ accountId: '', cny: '', day: todayLibya() });
  const [message, setMessage] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const load = useCallback(() => {
    client.get(base).then((res: any) => {
      setData(res.data);
      setForm((f) => ({ ...f, accountId: f.accountId || res.data.accounts?.[0]?._id || '', cny: res.data.suggestedCny ? String(res.data.suggestedCny) : '' }));
    }).catch(() => setData(null));
  }, [client, base]);
  useEffect(load, [load]);
  if (!data?.order?.isRemittance) return null;
  const account = data.accounts.find((a: any) => a._id === form.accountId);
  const cost = account?.rate && Number(form.cny) > 0 ? Math.round((Number(form.cny) / account.rate) * 100) : null;
  const send = async () => {
    try {
      setBusy(true);
      setMessage(null);
      await (from === 'order' ? sys.post(base, { ...form, cny: Number(form.cny), idempotencyKey: key.current }) : acc.post(`${base}/send`, { ...form, cny: Number(form.cny), idempotencyKey: key.current }));
      key.current = newKey();
      setMessage({ type: 'success', text: `أُرسل ${form.cny} يوان من ${account?.name}.` });
      load();
      onSent?.();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="دفع الحوالة من Alipay" subtitle={`الطلب حوالة Alipay. اليوان المكتوب على الطلب ${data.typedCny || 0}، أُرسل منه ${data.sentCny || 0}. يُسجَّل تكلفةً على الطلب بمتوسط سعر الحساب.`}>
      {message && <Alert severity={message.type} className="mb-2" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <div className="acc-form-grid">
        <TextField select label="من حساب Alipay" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
          {data.accounts.map((a: any) => <MenuItem key={a._id} value={a._id}>{a.name} · {a.cny.toLocaleString('en-US')} يوان{a.rate ? ` · ${a.rate}` : ''}</MenuItem>)}
        </TextField>
        <TextField type="number" label="اليوان المرسل" value={form.cny} onChange={(e) => setForm({ ...form, cny: e.target.value })}
          helperText={cost !== null ? <>تكلفته <Money value={cost} /> بسعر <Ltr>{account.rate}</Ltr></> : undefined} />
        <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
      </div>
      <div className="d-flex justify-content-end mt-2">
        <Button variant="contained" disabled={busy || !form.accountId || !(Number(form.cny) > 0)} onClick={send}>دفع من Alipay</Button>
      </div>
      {data.sent?.length > 0 && (
        <Sub>أُرسل سابقاً: {data.sent.map((b: any) => `${b.total} يوان (${b.day}، ${b.account || ''})`).join('، ')}</Sub>
      )}
    </Panel>
  );
};
