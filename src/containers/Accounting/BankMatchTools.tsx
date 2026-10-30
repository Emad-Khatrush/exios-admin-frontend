import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { acc, CURRENCY_DECIMALS, errorText } from './accountingApi';

const money = (n: number, currency: string) => `${(n / 10 ** (CURRENCY_DECIMALS[currency] ?? 2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: CURRENCY_DECIMALS[currency] ?? 2 })} ${currency}`;
export function MatchQuality({ quality }: { quality: any }) {
  return quality ? <div style={{ fontSize: 12, marginTop: 6, color: quality.level === 'strong' ? '#087f5b' : '#885400' }}>
    <b>{quality.label}</b><span> · {quality.reasons?.join(' · ')}</span>
  </div> : null;
}
export function BankDuplicateReview({ line, candidates, currency, onClose, onDone }: any) {
  const [selected, setSelected] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async (action: string) => {
    setBusy(true); setError('');
    try { await acc.post(`bank/lines/${line._id}/review-duplicate`, { action, existingLineId: selected, reason }); await onDone(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Dialog open fullWidth maxWidth="md" dir="rtl" onClose={() => !busy && onClose()}>
    <DialogTitle>مراجعة سطر مستورد محتمل</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="warning">المرجع والمبلغ والتاريخ موجودة في كشف سابق، لكن البيان مختلف. راجع الأصل قبل التسجيل مرة ثانية.</Alert>
      <p><b>السطر الجديد:</b> {line.day} · {money(line.amount, currency)} · {line.description}</p>
      {candidates.map((item: any) => <label key={item._id} style={{ display: 'block', border: '1px solid #ddd', padding: 10, marginBottom: 8 }}>
        <Checkbox disabled={busy || !!item.duplicateReviewPending} checked={selected === item._id} onChange={() => setSelected(item._id)} />
        {item.day} · {money(item.amount, currency)} · {item.description} · {item.reference}
      </label>)}
      <TextField fullWidth multiline minRows={2} label="إذا كانت عملية أخرى مستقلة، اكتب سبب الاختلاف" value={reason} onChange={e => setReason(e.target.value)} />
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>إلغاء</Button>
      <Button disabled={busy || !selected} onClick={() => save('same')}>نفس العملية — استخدام السطر الأصلي</Button>
      <Button disabled={busy || reason.trim().length < 10} onClick={() => save('independent')}>عملية أخرى — إتاحة التسجيل</Button>
    </DialogActions>
  </Dialog>;
}
export function BankGroupMatch({ lines, movements, currency, onClose, onDone }: any) {
  const [entryIds, setEntryIds] = useState<string[]>([]); const [query, setQuery] = useState('');
  const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const lineKey = lines.map((l: any) => l._id).join(',');
  useEffect(() => {
    const current = ++version.current; setPreview(null); setConfirmed(false); setError('');
    if (!entryIds.length) return;
    acc.post('bank/group-match/preview', { lineIds: lineKey.split(','), entryIds }).then((res: any) => {
      if (current === version.current) setPreview(res.data);
    }).catch((e: any) => { if (current === version.current) setError(errorText(e)); });
    return () => { version.current++; };
  }, [entryIds, lineKey]);
  const total = lines.reduce((s: number, l: any) => s + l.amount, 0);
  const selectedTotal = movements.filter((e: any) => entryIds.includes(e._id)).reduce((s: number, e: any) => s + e.amount, 0);
  const match = async () => {
    setBusy(true); setError('');
    try { await acc.post('bank/group-match', { lineIds: lines.map((l: any) => l._id), entryIds, fingerprint: preview.fingerprint, confirmReviewed: confirmed, reason }); await onDone(); }
    catch (e) { setError(errorText(e)); setPreview(null); } finally { setBusy(false); }
  };
  return <Dialog open fullWidth maxWidth="lg" dir="rtl" onClose={() => !busy && onClose()}>
    <DialogTitle>مطابقة سطور الكشف مع الدفعات الموجودة</DialogTitle>
    <DialogContent>
      <Alert severity="info">اختر دفعة واحدة أو عدة قيود. راجع البيان والتاريخ؛ الاعتماد يربط الموجود دون إنشاء حركة مالية إضافية.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18, marginTop: 16 }}>
        <div><h4>سطور الكشف ({lines.length})</h4><div style={{ maxHeight: 300, overflow: 'auto' }}>{lines.map((l: any) => <p key={l._id}>{l.day} · <b>{money(l.amount, currency)}</b><br />{l.description}</p>)}</div></div>
        <div><h4>القيود غير المرتبطة</h4><TextField size="small" fullWidth label="بحث في الدفعات والقيود" value={query} onChange={e => setQuery(e.target.value)} />
          <div style={{ maxHeight: 300, overflow: 'auto' }}>{movements.filter((e: any) => `${e.number} ${e.description} ${e.day}`.toLowerCase().includes(query.toLowerCase())).map((e: any) => <label key={e._id} style={{ display: 'block', padding: 6 }}>
            <Checkbox disabled={busy} checked={entryIds.includes(e._id)} onChange={(_, checked) => setEntryIds(current => checked ? [...current, e._id] : current.filter(id => id !== e._id))} />
            {e.number} · {e.day} · <b>{money(e.amount, currency)}</b><div>{e.description}</div>
          </label>)}</div>
        </div>
      </div>
      <Alert severity={total === selectedTotal && entryIds.length ? 'success' : 'warning'}>مجموع الكشف: {money(total, currency)} · المحدد من الدفاتر: {money(selectedTotal, currency)} · الفرق: {money(total - selectedTotal, currency)}</Alert>
      <TextField className="mt-3" fullWidth label="بيان ربط المجموعة" value={reason} onChange={e => setReason(e.target.value)} />
      <FormControlLabel control={<Checkbox checked={confirmed} onChange={(_, checked) => setConfirmed(checked)} />} label="راجعت العمليات وأؤكد أنها نفس الدفعات" />
      <p style={{ fontSize: 12 }}>أي عمولة أو فرق يُراجع ويُسجل أولًا. استردادات المشتريات وعمليات Alipay تُربط من مساراتها الخاصة.</p>
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>إلغاء</Button><Button variant="contained" disabled={busy || !preview || preview.difference !== 0 || !confirmed || reason.trim().length < 10} onClick={match}>اعتماد مطابقة المجموعة</Button></DialogActions>
  </Dialog>;
}
export function BankIntegrityDialog({ accountId, currency, onClose, onDone }: any) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => acc.get('bank/integrity', { accountId }).then((res: any) => setData(res.data)).catch((e: any) => setError(errorText(e)));
  useEffect(() => { load(); }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps
  const release = async (item: any) => {
    setBusy(true); setError('');
    try { await acc.post('bank/integrity/release', { accountId, lineId: item.lineId, fingerprint: item.fingerprint, reason }); await load(); await onDone(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Dialog open fullWidth maxWidth="md" dir="rtl" onClose={() => !busy && onClose()}>
    <DialogTitle>فحص المطابقات السابقة</DialogTitle><DialogContent>
      <Alert severity="info">يفحص القيود المرتبطة وحالتها ومجموعها. فك الربط يعيد السطر للمراجعة؛ لا يعكس قيدًا ماليًا.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <p>جارٍ الفحص…</p>}
      {data && <p>فُحص {data.scanned} سطرًا · {data.results.length} نتائج تحتاج مراجعة</p>}
      {data?.hasMore && <Alert severity="warning">الفحص محدود بأحدث 2000 سطر؛ توجد سطور أقدم خارج هذه النتيجة.</Alert>}
      {!!data?.results.length && <TextField fullWidth label="سبب فك الربط غير الصحيح" value={reason} onChange={e => setReason(e.target.value)} />}
      {data?.results.map((item: any) => <div key={item.lineId} style={{ borderBottom: '1px solid #ddd', padding: 14 }}>
        <b>{item.issue}</b><p>{item.day} · {item.description}</p>
        <p>الكشف: {money(item.statement, currency)} · القيود: {money(item.ledger, currency)}</p>
        <Button component="a" href={`/accounting/bank?accountId=${accountId}&lineId=${item.lineId}`} target="_blank" rel="noopener noreferrer">فتح السطر للمراجعة</Button>
        {item.canRelease && <Button disabled={busy || reason.trim().length < 10} onClick={() => release(item)}>فك الربط وإعادته للمراجعة</Button>}
      </div>)}
    </DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>إغلاق</Button><Button disabled={busy} onClick={load}>تحديث الفحص</Button></DialogActions>
  </Dialog>;
}
export function LateExpenseNotice({ billId }: { billId: string }) {
  const [data, setData] = useState<any>(null); const [selected, setSelected] = useState<any>(null); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; setData(null); setSelected(null); setError('');
    acc.get('bank/late-expense', { billId }).then((res: any) => { if (active) setData(res.data); }).catch(() => {});
    return () => { active = false; };
  }, [billId]);
  if (!data?.results.length) return null;
  return <Alert severity="info" className="mb-3">
    وجدنا {data.results.length} سطور كشف محتملة لهذا المصروف. راجع السطر ثم اربطه بالدفع الموجود.
    {data.results.map((l: any) => <div key={l._id}><Button onClick={() => { setSelected(l); setConfirmed(false); }}>{l.day} · {money(l.amount, data.currency)} · {l.description}</Button></div>)}
    {selected && <Dialog open fullWidth maxWidth="sm" dir="rtl" onClose={() => !busy && setSelected(null)}>
      <DialogTitle>ربط المصروف بسطر الكشف</DialogTitle><DialogContent>
        <p>{selected.day} · {money(selected.amount, data.currency)} · {selected.description}</p><MatchQuality quality={selected.quality} />
        {error && <Alert severity="error">{error}</Alert>}
        <FormControlLabel control={<Checkbox checked={confirmed} onChange={(_, checked) => setConfirmed(checked)} />} label="راجعت البيان وأؤكد أنها نفس العملية" />
      </DialogContent><DialogActions><Button disabled={busy} onClick={() => setSelected(null)}>إلغاء</Button><Button disabled={busy || !confirmed} onClick={async () => {
        setBusy(true); setError(''); try { await acc.post(`bank/lines/${selected._id}/match`, { entryIds: [data.entryId] }); setData(null); setSelected(null); }
        catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }}>اعتماد الربط</Button></DialogActions>
    </Dialog>}
  </Alert>;
}
