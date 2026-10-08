import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { acc, errorText, newKey, sys, todayLibya } from './accountingApi';
import { Badge, Ltr, Money, Open, Panel, Sub } from './ui';

// Sending the yuan of an order marked as an Alipay transfer, in one step (owner's decision, v8):
// out of an Alipay account at its average rate, recorded as the order's purchase cost. Used on
// the order page (staff, through /api) and on the Alipay page (accounting).
export const AlipaySendPanel = ({ orderId, from = 'order', defaultAccountId = '', onSent }: { orderId: string; defaultAccountId?: string; from?: 'order' | 'accounting'; onSent?: () => void }) => {
  const client = from === 'order' ? sys : acc;
  const base = from === 'order' ? `acc/orders/${orderId}/alipay` : `alipay/orders/${orderId}`;
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ accountId: '', cny: '', day: todayLibya(), transactionReference: '' });
  const [message, setMessage] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const load = useCallback(() => {
    client.get(base).then((res: any) => {
      setData(res.data);
      setForm((f) => ({ ...f, accountId: f.accountId || res.data.accounts?.find((a: any) => a._id === defaultAccountId)?._id || res.data.accounts?.[0]?._id || '', cny: res.data.suggestedCny ? String(res.data.suggestedCny) : '' }));
    }).catch(() => setData(null));
  }, [client, base, defaultAccountId]);
  useEffect(load, [load]);
  if (!data?.order?.isRemittance) return null;
  const account = data.accounts.find((a: any) => a._id === form.accountId);
  const cost = account?.rate && Number(form.cny) > 0 ? Math.round((Number(form.cny) / account.rate) * 100) : null;
  const balanceAfter = account && Number(form.cny) > 0 ? Math.round((account.cny - Number(form.cny)) * 100) / 100 : null;
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
      {balanceAfter !== null && balanceAfter < 0 && <Alert severity="warning" className="mb-2">
        مسموح بالإرسال. الرصيد الدفتري بعد الحوالة سيكون <Ltr>{balanceAfter.toLocaleString('en-US')}</Ltr> يوان، إلى حين تسجيل الإيداعات الناقصة ومطابقتها مع الكشف.
      </Alert>}
      {account && !account.rate && <Alert severity="info" className="mb-2">لا يتوفر متوسط سعر صالح للحساب؛ تُحتسب التكلفة بسعر اليوان المسجل بتاريخ العملية. يجب توفر سعر صرف حتى تُسجل الحوالة بتكلفة صحيحة.</Alert>}
      <p className="acc-muted">عند تسجيل إيداع ناقص بتاريخه الحقيقي وقيمته، يعيد النظام تقييم الحوالات المتأثرة ويسجل فرق التكلفة تلقائيًا. عند غياب وقت العملية، تُحتسب إيداعات اليوم قبل سحوباته.</p>
      <div className="acc-form-grid">
        <TextField select label="من حساب Alipay" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
          {data.accounts.map((a: any) => <MenuItem key={a._id} value={a._id}>{a.name} · {a.cny.toLocaleString('en-US')} يوان{a.rate ? ` · ${a.rate}` : ''}</MenuItem>)}
        </TextField>
        <TextField type="number" label="اليوان المرسل" value={form.cny} onChange={(e) => setForm({ ...form, cny: e.target.value })}
          helperText={cost !== null ? <>تكلفته <Money value={cost} /> بسعر <Ltr>{account.rate}</Ltr></> : undefined} />
        <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        <TextField label="رقم عملية Alipay (اختياري)" value={form.transactionReference} onChange={e => setForm({ ...form, transactionReference: e.target.value })} helperText="انسخ رقم العملية كاملًا من الكشف للمطابقة التلقائية ومنع تكرار تسجيلها" />
      </div>
      <div className="d-flex justify-content-end mt-2">
        <Button variant="contained" disabled={busy || !form.accountId || !(Number(form.cny) > 0)} onClick={send}>دفع من Alipay</Button>
      </div>
      {data.sent?.length > 0 && (
        <div className="mt-3">
          <Sub>الحوالات المسجلة وتكلفتها بعد التسوية التلقائية</Sub>
          {data.sent.map((b: any) => <div key={b._id} className="mt-2">
            <Ltr>{b.day}</Ltr> · {b.account} · <Ltr>{b.orderCny}</Ltr> يوان · التكلفة <Money value={b.alipayValuationUsd ?? b.totalUsd} />
            {b.alipayValuationProvisional && <Badge tone="warn">تقييم مؤقت · الرصيد يحتاج مراجعة</Badge>}
            {!!b.alipayValuationAdjustmentUsd && <Sub>فرق التكلفة المسجل تلقائيًا: <Money value={b.alipayValuationAdjustmentUsd} /> {from === 'accounting' && b.alipayValuationEntryId && <Open to={`/accounting/entries/${b.alipayValuationEntryId}`}>تفاصيل التسوية</Open>}</Sub>}
          </div>)}
        </div>
      )}
    </Panel>
  );
};
