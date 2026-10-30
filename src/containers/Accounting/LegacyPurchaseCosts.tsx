import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { acc, errorText, newKey, sys, todayLibya } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
import { Badge, DataTable, Ltr, Open, Panel, Sub } from './ui';

export default function LegacyPurchaseCosts({ orderId, fallbackRows, onSaved }: { orderId: string; fallbackRows: any[]; onSaved: () => void }) {
  const access = useAccountingAccess();
  const canRead = access.can('reports', 'purchases'), canApprove = access.can('purchases');
  const [data, setData] = useState<any>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [row, setRow] = useState<any>(null), [options, setOptions] = useState<any>({ vendors: [], accounts: [] });
  const [mode, setMode] = useState('create'), [candidate, setCandidate] = useState('');
  const [vendor, setVendor] = useState<any>(null), [vendorText, setVendorText] = useState('');
  const [day, setDay] = useState(''), [rate, setRate] = useState(''), [payFrom, setPayFrom] = useState('');
  const [checked, setChecked] = useState(false), [newPayment, setNewPayment] = useState(false), [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(''), [success, setSuccess] = useState('');
  const [duplicates, setDuplicates] = useState<any>(null), [duplicateReason, setDuplicateReason] = useState('');
  const generation = useRef(0), requestKey = useRef('');
  const load = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true); setError('');
    try { const res = await acc.get(`orders/${orderId}/legacy-purchases`); if (generation.current === id) setData(res.data); }
    catch (err) { if (generation.current === id) { setError(errorText(err)); setData(null); } }
    finally { if (generation.current === id) setLoading(false); }
  }, [orderId]);
  useEffect(() => { if (canRead) load(); return () => { generation.current++; }; }, [canRead, load]);
  const open = async (item: any) => {
    setRow(item); setMode(item.candidates?.length ? 'link' : 'create'); setCandidate(''); setVendor(null); setVendorText('');
    setDay(item.date ? String(item.date).slice(0, 10) : todayLibya()); setRate(''); setPayFrom(''); setChecked(false); setNewPayment(false);
    setSaveError(''); setDuplicates(null); setDuplicateReason(''); requestKey.current = newKey();
    try { const res = await sys.get('acc/options'); setOptions(res.data); }
    catch (err) { setSaveError(errorText(err)); }
  };
  const save = async () => {
    setSaving(true); setSaveError('');
    try {
      const match = row.candidates?.find((c: any) => `${c.billId}:${c.lineId}` === candidate);
      const res = await acc.post(`orders/${orderId}/legacy-purchases/${row._id}/approve`, {
        mode, fingerprint: row.fingerprint, requestKey: requestKey.current, confirmNewCost: checked,
        ...(mode === 'link' ? { billId: match?.billId, lineId: match?.lineId } : {
          vendorId: vendor?._id, vendorName: vendor ? undefined : vendorText.trim(), day, rate: rate ? Number(rate) : undefined,
          payFromAccountId: payFrom || undefined, confirmNewPayment: newPayment,
          ...(duplicates && duplicateReason.trim().length >= 10 ? { duplicateDecision: 'independent', duplicateReason: duplicateReason.trim(), duplicateFingerprint: duplicates.fingerprint } : {}),
        }),
      });
      setSuccess(`${res.data.linkedExisting ? 'رُبط البند بالفاتورة الموجودة' : res.data.replayed ? 'البند معتمد مسبقًا على الفاتورة' : 'اعتُمد البند كتكلفة على الطلبية'} ${res.data.bill?.number || ''}.`);
      setRow(null); await load(); onSaved();
    } catch (err: any) { setSaveError(errorText(err)); if (err?.response?.data?.costDuplicatePreview) setDuplicates(err.response.data.costDuplicatePreview); }
    finally { setSaving(false); }
  };
  const rows = data?.results || fallbackRows;
  if (!rows.length && !error) return null;
  const valid = checked && (mode === 'link' ? !!candidate : (vendor || vendorText.trim().length >= 2) && !!day && (!payFrom || newPayment)
    && (!duplicates || (duplicates.canConfirmIndependent && duplicateReason.trim().length >= 10)));
  return <>
    <Panel flush title="المشتريات المسجلة داخل الطلبية" subtitle="اعتمد البند غير المرحّل كتكلفة، أو اربطه بفاتورة مورد مسجلة لنفس الطلبية. الربط بفاتورة موجودة لا يكرر التكلفة أو الدفع." actions={canRead ? <Button size="small" onClick={load} disabled={loading}>تحديث</Button> : undefined}>
      {error && <Alert severity="error">{error}<Button onClick={load}>تحديث</Button></Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <DataTable<any> rows={rows} rowKey={(r, i) => r._id || String(i)} loading={loading} columns={[
        { key: 'date', header: 'التاريخ', render: r => <Ltr>{r.date ? String(r.date).slice(0, 10) : '—'}</Ltr> },
        { key: 'description', header: 'الوصف', render: r => r.description || '—' },
        { key: 'amount', header: 'المبلغ', numeric: true, render: r => <Ltr>{Number(r.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.currency || 'USD'}</Ltr> },
        { key: 'link', header: 'الاعتماد المحاسبي', render: r => r.linkedBills?.length ? <>{r.linkedBills.map((b: any) => <div key={b._id}><Badge tone={b.status === 'draft' ? 'warn' : 'ok'}>{b.status === 'draft' ? 'مرتبط بمسودة' : 'معتمد'}</Badge> <Open to={`/accounting/bills/${b._id}`}>{b.number}</Open></div>)}</> :
          canApprove ? <Button size="small" variant="outlined" disabled={!data || loading || !!error || !r._id || data.canceled} onClick={() => open(r)}>اعتماد كتكلفة</Button> : <Sub>{canRead ? 'لم يُعتمد كفاتورة مورد' : 'حالة الاعتماد متاحة من المحاسبة'}</Sub> },
      ]} />
      <div className="p-3"><Open to={`/invoice/${orderId}/edit`}>مراجعة بيانات البند من تفاصيل الطلبية — Purchase costs</Open></div>
    </Panel>
    <Dialog open={!!row} onClose={() => !saving && setRow(null)} fullWidth maxWidth="sm" dir="rtl">
      <DialogTitle>اعتماد مشتريات الطلبية <Ltr>{data?.orderNumber}</Ltr></DialogTitle>
      {row && <DialogContent>
        <p>{row.description} · <Ltr>{Number(row.unitPrice).toFixed(2)} {row.currency || 'USD'}</Ltr></p>
        {saveError && <Alert severity="error" className="mb-3">{saveError}</Alert>}
        {!!row.candidates?.length && <TextField select fullWidth label="طريقة الاعتماد" value={mode} onChange={e => { setMode(e.target.value); setChecked(false); }} className="mt-2 mb-3" disabled={saving}>
          <MenuItem value="link">ربط بفاتورة موجودة — دون قيد أو دفع جديد</MenuItem><MenuItem value="create">إنشاء فاتورة مورد جديدة</MenuItem>
        </TextField>}
        {mode === 'link' ? <TextField select fullWidth label="الفاتورة والسطر المطابقان" value={candidate} onChange={e => setCandidate(e.target.value)} className="mt-2" disabled={saving}>
          {row.candidates.map((c: any) => <MenuItem key={`${c.billId}:${c.lineId}`} value={`${c.billId}:${c.lineId}`}>{c.number} · {c.day} · {c.description}</MenuItem>)}
        </TextField> : <>
          <Alert severity="info" className="mb-3">المبلغ والعملة من البند الأصلي. اترك الدفع آجلًا إذا لم تدفع الآن؛ إذا كانت الدفعة مسجلة في الكشف، اربط الفاتورة بها من المطابقة بدل خصمها مرة أخرى.</Alert>
          <Autocomplete freeSolo options={options.vendors || []} value={vendor} inputValue={vendorText} disabled={saving}
            getOptionLabel={(o: any) => typeof o === 'string' ? o : o.name || ''}
            onInputChange={(_, value, reason) => { setVendorText(value); if (reason === 'input' || reason === 'clear') setVendor(null); }} onChange={(_, value: any) => { setVendor(value && typeof value !== 'string' ? value : null); if (typeof value === 'string') setVendorText(value); }}
            renderInput={params => <TextField {...params} label="المورد" helperText="اختر المورد أو اكتب اسم مورد جديد" required />} />
          <div className="d-flex gap-2 flex-wrap mt-3">
            <TextField type="date" label="تاريخ الاعتماد" value={day} onChange={e => setDay(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: todayLibya() }} disabled={saving} />
            {(row.currency || 'USD') !== 'USD' && <TextField type="number" label={`سعر الصرف (${row.currency} لكل دولار)`} value={rate} onChange={e => setRate(e.target.value)} helperText="فارغ = سعر العملة المسجل في تاريخ الاعتماد" disabled={saving} />}
          </div>
          <TextField select fullWidth label="الدفع للمورد" value={payFrom} onChange={e => { setPayFrom(e.target.value); setNewPayment(false); }} className="mt-3" disabled={saving} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
            <MenuItem value="">آجلة — لا تخصم من أي حساب الآن</MenuItem>
            {(options.accounts || []).filter((a: any) => (a.currency || 'USD') === (row.currency || 'USD')).map((a: any) => <MenuItem key={a._id} value={a._id}>دفع الآن من {a.name}</MenuItem>)}
          </TextField>
          {payFrom && <FormControlLabel control={<Checkbox checked={newPayment} onChange={e => setNewPayment(e.target.checked)} disabled={saving} />} label="هذه دفعة جديدة فعلًا وليست مسجلة في كشف الحساب أو فاتورة سابقة" />}
          {duplicates && <Alert severity="warning" className="mt-3">
            راجع التكاليف المشابهة قبل إنشاء فاتورة ثانية:
            {(duplicates.results || []).map((d: any) => <div key={d.key}>{d.billId ? <Open to={`/accounting/bills/${d.billId}`}>{d.number}</Open> : d.number} · {d.reason}</div>)}
            {duplicates.canConfirmIndependent && <TextField fullWidth multiline label="إذا كانت تكلفة مستقلة، وضح السبب" value={duplicateReason} onChange={e => setDuplicateReason(e.target.value)} helperText="10 أحرف على الأقل؛ لن يُسمح بتجاوز فاتورة مورد مكررة بنفس المرجع" disabled={saving} />}
          </Alert>}
        </>}
        <FormControlLabel className="mt-3" control={<Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} disabled={saving} />} label={mode === 'link' ? 'راجعت أن الفاتورة المختارة تخص بند المشتريات نفسه' : 'راجعت البند وأن هذه التكلفة لم تُسجّل محاسبيًا سابقًا'} />
      </DialogContent>}
      <DialogActions><Button disabled={saving} onClick={() => setRow(null)}>إلغاء</Button><Button variant="contained" disabled={saving || !valid} onClick={save}>{saving ? 'جارٍ الاعتماد…' : mode === 'link' ? 'ربط دون تكرار التكلفة' : 'اعتماد كتكلفة'}</Button></DialogActions>
    </Dialog>
  </>;
}
