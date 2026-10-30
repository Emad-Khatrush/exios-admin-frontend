import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, TextField } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import api, { base } from '../../api';
import { acc, errorText, newKey } from './accountingApi';
import { Badge, DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Sub } from './ui';
import { useAccountingAccess } from './useAccountingAccess';
import { fields, HistoryMapping, HistoryRow, inferMapping, mapHistoryRows, templateHistory } from './historicalCashExcel';

const fresh = () => ({ title: '', office: 'tripoli', accountId: '', scope: 'full', from: '2026-01-01', to: '2026-04-03', opening: '', closing: '', requestKey: `history-${newKey()}`, revision: 0 });
const row = (): HistoryRow => ({ day: '2026-01-01', description: '', amount: '', direction: 'in', category: 'unknown', reference: '', transferRef: '', duplicateReason: '', sourceRow: 1 });
const initialFilter = { from: '2026-01-01', to: '2026-04-03', office: '', accountId: '', currency: '', status: '', mode: 'combined' };
const statusLabel: Record<string, string> = { draft: 'مسودة', approved: 'معتمد', void: 'ملغى' };
const sourceStates: Record<string, string> = { pending: 'بانتظار المراجعة', reviewed: 'تمت المراجعة', issue: 'تحتاج معالجة', excluded: 'مستبعد من التقرير', linked: 'مرتبط بكشف تاريخي' };
const postFile = async (path: string, payload: any, file: File | null) => {
  const body = new FormData(); body.append('payload', JSON.stringify(payload)); if (file) body.append('file', file);
  const result: any = await api.fetchFormData(`accounting/historical-cash${path}`, 'POST', body);
  if (result?.success === false || result instanceof Error) throw { response: { data: result } };
  return result;
};

export default function HistoricalCash() {
  const access = useAccountingAccess(), canEdit = access.can('treasury'), canReview = access.can('closing');
  const [params, setParams] = useSearchParams();
  const batchId = params.get('batch') || '';
  const [options, setOptions] = useState<any>({ offices: [], accounts: [], categories: {} });
  const [filters, setFilters] = useState(initialFilter), [query, setQuery] = useState(initialFilter);
  const [data, setData] = useState<any>(null), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(false), [detail, setDetail] = useState<any>(null), [form, setForm] = useState(fresh), [dirty, setDirty] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]), [preview, setPreview] = useState<any>(null), [editing, setEditing] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null), [workbook, setWorkbook] = useState<any>(null), [sheet, setSheet] = useState('');
  const [header, setHeader] = useState(0), [mapping, setMapping] = useState<HistoryMapping>(inferMapping([])), [european, setEuropean] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [review, setReview] = useState(''), [reason, setReason] = useState('');
  const [sourcePage, setSourcePage] = useState(1), [sourceRow, setSourceRow] = useState<any>(null);
  const [sourceState, setSourceState] = useState('reviewed'), [sourceCategory, setSourceCategory] = useState('unknown');
  const [sourceNote, setSourceNote] = useState(''), [sourceCandidate, setSourceCandidate] = useState(''), [independent, setIndependent] = useState(false);
  const generation = useRef(0);
  const categories = options.categories || {};
  const readonly = !canEdit || (!!batchId && (!detail || detail.status !== 'draft'));
  const accounts = options.accounts.filter((a: any) => !form.office || !a.office || a.office === form.office);
  const account = options.accounts.find((a: any) => String(a._id) === form.accountId);
  useEffect(() => { let active = true; acc.get('historical-cash/options').then((r: any) => { if (active) setOptions(r.data); }).catch((e: any) => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const current = ++generation.current; setLoading(true); setError('');
    if (batchId) { setDetail(null); setPreview(null); }
    const request = batchId ? acc.get(`historical-cash/${batchId}`) : acc.get('historical-cash', { ...query, page, sourcePage });
    request.then((r: any) => {
      if (current !== generation.current) return;
      if (batchId) {
        const b = r.data; setDetail(b); setEditor(true); setPreview(null); setFile(null); setWorkbook(null); setEditing(null); setDirty(false);
        setForm({ title: b.title, office: b.office, accountId: String(b.accountId), scope: b.scope || 'full', from: b.from, to: b.to,
          opening: b.openingMinor == null ? '' : String(b.openingMinor / 10 ** b.decimals), closing: b.closingMinor == null ? '' : String(b.closingMinor / 10 ** b.decimals), requestKey: b.requestKey, revision: b.revision });
        setRows(b.rows.map((r: any) => ({ ...r, clientKey: newKey(), amount: String(r.amountMinor / 10 ** b.decimals) })));
      } else { setData(r.data); setEditor(false); setDetail(null); }
    }).catch((e: any) => { if (current === generation.current) setError(errorText(e)); }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { if (current === generation.current) generation.current++; };
  }, [batchId, query, page, sourcePage, revision]);
  const change = (key: string, value: any) => { setForm(f => ({ ...f, [key]: value, ...(key === 'office' && { accountId: '' }) })); setPreview(null); setDirty(true); };
  const changeRows = (next: HistoryRow[]) => { setRows(next.map(r => ({ ...r, clientKey: r.clientKey || newKey() }))); setPreview(null); setDirty(true); };
  const start = () => { setParams({}); setDetail(null); setEditor(true); setForm(fresh()); setRows([]); setPreview(null); setFile(null); setWorkbook(null); setEditing(null); setError(''); setNotice(''); setDirty(true); };
  const back = () => { setParams({}); setEditor(false); setError(''); setRevision(v => v + 1); };
  const payload = () => ({ ...form, rows, sheet, batchId: batchId || undefined });
  const check = async () => {
    setBusy(true); setError('');
    try { setPreview(await postFile('/preview', payload(), file)); }
    catch (e) { setError(errorText(e)); setPreview(null); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!preview || preview.errors) return; setBusy(true); setError('');
    try { const result = await postFile('', { ...payload(), fingerprint: preview.fingerprint }, file); setNotice('حُفظ الكشف كمسودة مستقلة دون تغيير المحافظ أو القيود.'); setParams({ batch: result._id }); setRevision(v => v + 1); }
    catch (e) { setError(errorText(e)); setPreview(null); }
    finally { setBusy(false); }
  };
  const fileChange = async (selected: File | undefined) => {
    if (!selected) return; setBusy(true); setError(''); setPreview(null);
    try {
      if (selected.size > 5 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 5 MB.');
      const XLSX = await import('xlsx'); const wb = XLSX.read(await selected.arrayBuffer(), { type: 'array', sheetRows: 1035 });
      if (!wb.SheetNames.length) throw new Error('الملف لا يحتوي أوراق عمل.');
      setFile(selected); setWorkbook(wb); setSheet(wb.SheetNames[0]); setHeader(0); setDirty(true);
      const cells = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      setMapping(inferMapping(cells[0] || []));
    } catch (e: any) { setError(e.message || 'تعذرت قراءة الملف.'); }
    finally { setBusy(false); }
  };
  const cells = useMemo(() => {
    if (!workbook || !sheet) return [];
    const XLSX = require('xlsx'); return XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, raw: true, defval: '' }) as any[][];
  }, [workbook, sheet]);
  const mapFile = () => {
    if (workbook.Sheets[sheet]?.['!fullref']) { setError('الورقة تتجاوز حد القراءة. قسّم الملف إلى كشوف أصغر بدل استيراد جزء منه.'); return; }
    if (!mapping.day || !mapping.description || (mapping.amount === '' && mapping.incoming === '' && mapping.outgoing === '')) { setError('حدد أعمدة التاريخ والبيان والمبلغ أو عمودي المقبوضات والمدفوعات.'); return; }
    const next = mapHistoryRows(cells, header, mapping, categories, european, !!workbook.Workbook?.WBProps?.date1904);
    if (!next.length || next.length > 1000) { setError('الملف يجب أن يحتوي من سطر إلى 1000 سطر. قسّمه إلى كشوف أصغر.'); return; }
    changeRows(next); setEditing(null); setError('');
  };
  const submitReview = async () => {
    setBusy(true); setError('');
    try { await acc.post(`historical-cash/${batchId}/${review === 'void' ? 'void' : 'review'}`, { action: review, revision: detail.revision, reason }); setReview(''); setNotice('حُفظ إجراء المراجعة. لم تُنشأ قيود محاسبية.'); if (review === 'void') back(); else setRevision(v => v + 1); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const reviewSource = (r: any) => {
    setSourceRow(r); setSourceState(r.warning ? 'issue' : r.candidates?.length ? 'linked' : 'reviewed');
    setSourceCategory(r.category); setSourceNote(r.note || ''); setIndependent(false);
    setSourceCandidate(r.candidates?.length ? `${r.candidates[0].batchId}:${r.candidates[0].rowId}` : ''); setError('');
  };
  const saveSource = async () => {
    if (!sourceRow) return; setBusy(true); setError('');
    const [batchId, rowId] = sourceCandidate.split(':');
    try {
      await acc.post('historical-cash/source-review', { query, key: sourceRow.key, fingerprint: sourceRow.fingerprint,
        state: sourceState, category: sourceCategory, note: sourceNote, independent, batchId, rowId });
      setSourceRow(null); setRevision(v => v + 1); setNotice('حُفظت المراجعة والربط دون تعديل السجل الأصلي أو المحافظ.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const downloadSource = async () => {
    setBusy(true); setError('');
    try { const res = await base.axios.get(`/accounting/historical-cash/${batchId}/source`, { responseType: 'blob', headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }); const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = detail.sourceFile.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { setError(errorText(e, 'تعذر تحميل الملف الأصلي.')); } finally { setBusy(false); }
  };
  const monthly = useMemo(() => {
    const result = new Map<string, any>();
    for (const g of data?.groups || []) {
      const key = [g.month, g.office, g.currency].join(':');
      const r = result.get(key) || { key, month: g.month, office: g.office, currency: g.currency, decimals: g.decimals, incoming: 0, outgoing: 0, transferIn: 0, transferOut: 0, drafts: 0, unknown: 0 };
      r.incoming += g.incoming; r.outgoing += g.outgoing; r.drafts += g.drafts;
      if (g.category === 'transfer') { r.transferIn += g.incoming; r.transferOut += g.outgoing; }
      if (g.category === 'unknown') r.unknown += g.count;
      result.set(key, r);
    }
    return Array.from(result.values());
  }, [data]);
  const company = useMemo(() => {
    const result = new Map<string, any>();
    for (const r of monthly) {
      const total = result.get(r.currency) || { currency: r.currency, decimals: r.decimals, incoming: 0, outgoing: 0, transferIn: 0, transferOut: 0, drafts: 0 };
      for (const key of ['incoming', 'outgoing', 'transferIn', 'transferOut', 'drafts']) total[key] += r[key];
      result.set(r.currency, total);
    }
    return Array.from(result.values());
  }, [monthly]);
  const exportReport = async () => {
    setBusy(true); setError('');
    try { const X = await import('xlsx'); const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(monthly.map(r => ({ 'الشهر': r.month, 'المكتب': options.offices.find((o: any) => o.code === r.office)?.name || r.office, 'العملة': r.currency, 'المقبوضات': r.incoming / 10 ** r.decimals, 'المدفوعات': r.outgoing / 10 ** r.decimals, 'صافي الحركة': (r.incoming - r.outgoing) / 10 ** r.decimals, 'تحويلات داخلة': r.transferIn / 10 ** r.decimals, 'تحويلات خارجة': r.transferOut / 10 ** r.decimals, 'الصافي دون التحويلات': (r.incoming - r.outgoing - r.transferIn + r.transferOut) / 10 ** r.decimals, 'سطور غير معتمدة': r.drafts }))), 'الملخص الشهري');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet((data?.groups || []).map((g: any) => ({ 'الشهر': g.month, 'المكتب': g.office, 'العملة': g.currency, 'التصنيف': categories[g.category]?.label, 'قبض': g.incoming / 10 ** g.decimals, 'صرف': g.outgoing / 10 ** g.decimals }))), 'التصنيفات');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(company.map(r => ({ 'العملة': r.currency, 'المقبوضات': r.incoming / 10 ** r.decimals, 'المدفوعات': r.outgoing / 10 ** r.decimals, 'صافي الحركة دون التحويلات': (r.incoming - r.outgoing - r.transferIn + r.transferOut) / 10 ** r.decimals, 'سطور مسودة': r.drafts }))), 'إجمالي النطاق');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet([{ 'النوع': 'حركة نقدية تاريخية مستقلة — ليست ربحًا أو خسارة', 'من': query.from, 'إلى': query.to,
        'المكتب': options.offices.find((o: any) => o.code === query.office)?.name || 'كل المكاتب', 'الحساب': options.accounts.find((a: any) => String(a._id) === query.accountId)?.name || 'كل الحسابات', 'العملة': query.currency || 'كل العملات — منفصلة',
        'مصدر الإجماليات': query.mode === 'normal' ? 'الأقسام العادية' : query.mode === 'manual' ? 'الكشوف التاريخية' : 'موحد مع ربط التكرارات',
        'الحالة': query.status === 'approved' ? 'المعتمد والمراجع فقط' : 'تشمل السجلات غير المعتمدة', 'تنبيه': 'لا تجمع أرقام هذا التقرير مع تقارير الدفاتر لنفس الحركات. اعتماد كشف محافظ جزئي يعني مراجعة حركاته فقط ولا يثبت اتزان الخزينة.' }]), 'نطاق التقرير');
      X.writeFile(wb, 'historical-cash-report.xlsx');
    } catch (e) { setError('تعذر تصدير التقرير.'); } finally { setBusy(false); }
  };
  const rowEdit = editing === null ? null : rows[editing];
  const rowIndex = (r: HistoryRow) => rows.findIndex(item => item.clientKey === r.clientKey);
  const money = (value: number, r: any) => <Money value={value} currency={r.currency} decimals={r.decimals} tone="plain" />;
  return <div className="acc-history">
    <PageHeader title="الحركة النقدية التاريخية" subtitle="مركز مراجعة للحركات التاريخية وسجلات الأقسام العادية. الإدخال هنا لا يغيّر المحافظ أو الدفاتر، وصافي النقد ليس صافي الربح." actions={editor ? <Button onClick={back} disabled={busy}>العودة للتقرير</Button> : <>{canEdit && <Button variant="contained" onClick={start} disabled={loading}>كشف جديد / استيراد Excel</Button>}<Button onClick={exportReport} disabled={busy || loading || !data?.groups?.length}>تصدير Excel</Button></>} />
    {error && <Alert severity="error" className="mb-3">{error}</Alert>}{notice && <Alert severity="success" className="mb-3">{notice}</Alert>}
    {editor ? <>
      <Panel title={detail ? <>{detail.title} <Badge tone={detail.status === 'approved' ? 'ok' : 'warn'}>{statusLabel[detail.status]}</Badge></> : 'بيانات الكشف'}>
        <div className="acc-history-form">
          <TextField select label="نوع الكشف" value={form.scope} onChange={e => change('scope', e.target.value)} disabled={busy || readonly}><MenuItem value="full">كشف كامل للخزينة</MenuItem><MenuItem value="wallets">حركات محافظ تاريخية فقط</MenuItem></TextField>
          <TextField label="اسم الكشف" value={form.title} onChange={e => change('title', e.target.value)} disabled={busy || readonly} />
          <TextField select label="المكتب" value={form.office} onChange={e => change('office', e.target.value)} disabled={busy || readonly}>{options.offices.map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>
          <TextField select label="الحساب والعملة" value={form.accountId} onChange={e => change('accountId', e.target.value)} disabled={busy || readonly}>{accounts.map((a: any) => <MenuItem key={a._id} value={String(a._id)}>{a.name} · {a.currency}</MenuItem>)}</TextField>
          {(['from', 'to'] as const).map(key => <TextField key={key} type="date" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={form[key]} onChange={e => change(key, e.target.value)} disabled={busy || readonly} />)}
          {form.scope === 'full' && (['opening', 'closing'] as const).map(key => <TextField key={key} label={`${key === 'opening' ? 'رصيد بداية الكشف' : 'رصيد نهاية الكشف'} (${account?.currency || detail?.currency || 'العملة'})`} value={form[key]} onChange={e => change(key, e.target.value)} disabled={busy || readonly} inputProps={{ inputMode: 'decimal', dir: 'ltr' }} helperText="الرصيد المتاح موجب، والسحب المكشوف سالب. مطلوب للاعتماد." />)}
        </div>
        {form.scope === 'wallets' && <Alert severity="info" className="mt-3">كشف جزئي لإيداعات وسحوبات العملاء فقط. يعتمد بعد مراجعة الحركات والتصنيف والتكرار؛ لا يثبت اتزان الخزينة ولا يتطلب رصيد بداية أو نهاية، ولا يغيّر المحافظ الحالية.{(form.opening !== '' || form.closing !== '') && <Sub>رصيدا الخزينة السابقان محفوظان كمرجع فقط: البداية {form.opening || 'غير محدد'}، والنهاية {form.closing || 'غير محدد'} {account?.currency || detail?.currency}. لا يدخلان مطابقة هذا الكشف الجزئي.</Sub>}</Alert>}
        {detail?.sourceFile?.name && <Button onClick={downloadSource} disabled={busy}>تحميل الملف الأصلي: {detail.sourceFile.name}</Button>}
        {detail && <div className="d-flex flex-wrap gap-2 mt-3">{canReview && detail.status === 'draft' && <Button onClick={() => { setReason(''); setReview('approve'); }} disabled={busy || dirty}>اعتماد الكشف</Button>}{canReview && detail.status === 'approved' && <Button onClick={() => { setReason(''); setReview('reopen'); }} disabled={busy}>إعادة فتح للمراجعة</Button>}{canEdit && detail.status === 'draft' && <Button color="error" onClick={() => { setReason(''); setReview('void'); }} disabled={busy}>إلغاء الكشف</Button>}</div>}
        {detail?.transferProblems?.length > 0 && <Alert severity="warning" className="mt-3">يوجد تحويل داخلي يحتاج طرفًا مقابلًا بنفس المرجع؛ لا يمكن اعتماد الكشف قبل ربطه.</Alert>}
      </Panel>
      {!readonly && <Panel title="إضافة الحركات" subtitle="استخدم قالبنا أو اختر أعمدة ملفك. كل كشف لحساب واحد وعملة واحدة، بحد أقصى 1000 حركة و5 MB.">
        <div className="d-flex flex-wrap gap-2"><Button variant="outlined" component="label" disabled={busy}>اختيار Excel / CSV<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={e => { void fileChange(e.target.files?.[0]); e.target.value = ''; }} /></Button><Button onClick={() => templateHistory(categories)} disabled={busy}>تحميل قالب Excel</Button><Button onClick={() => { changeRows([...rows, { ...row(), day: form.from, sourceRow: rows.length + 1 }]); setEditing(rows.length); }} disabled={busy || rows.length >= 1000}>إضافة سطر يدوي</Button>
          {!!rows.length && <TextField className="acc-history-bulk" select label="تصنيف غير المصنف دفعة واحدة" value="" disabled={busy} onChange={e => { const c = e.target.value; changeRows(rows.map(r => r.category === 'unknown' && (!categories[c]?.direction || categories[c].direction === r.direction) ? { ...r, category: c } : r)); }}><MenuItem value="">اختر التصنيف</MenuItem>{Object.entries(categories).filter(([k]) => k !== 'unknown').map(([k, c]: [string, any]) => <MenuItem key={k} value={k}>{c.label}</MenuItem>)}</TextField>}
        </div>
        {workbook && <div className="mt-3"><p>{file?.name} — تحويل الملف يستبدل السطور في النموذج قبل الحفظ.</p><div className="acc-history-form">
          <TextField select label="ورقة العمل" value={sheet} onChange={e => { setSheet(e.target.value); setPreview(null); }} disabled={busy}>{workbook.SheetNames.map((s: string) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
          <TextField type="number" label="رقم صف العناوين" value={header + 1} onChange={e => { const h = Math.max(0, Math.min(30, Number(e.target.value) - 1)); setHeader(h); setMapping(inferMapping(cells[h] || [])); }} disabled={busy} />
          <TextField select label="تنسيق الأرقام النصية" value={european ? 'eu' : 'en'} onChange={e => setEuropean(e.target.value === 'eu')} disabled={busy}><MenuItem value="en">1,234.56</MenuItem><MenuItem value="eu">1.234,56</MenuItem></TextField>
          {Object.entries(fields).map(([key, label]) => <TextField key={key} select label={label} value={mapping[key as keyof HistoryMapping]} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))} disabled={busy}><MenuItem value="">غير موجود</MenuItem>{(cells[header] || []).map((h: any, i: number) => <MenuItem key={i} value={String(i)}>{i + 1}: {String(h || 'عمود دون عنوان')}</MenuItem>)}</TextField>)}
        </div><Button onClick={mapFile} disabled={busy}>تحويل الملف إلى سطور للمراجعة</Button><Sub>في عمود مبلغ واحد: السالب صرف والموجب قبض إذا لم تحدد عمود الاتجاه. التواريخ النصية يوم/شهر/سنة.</Sub></div>}
      </Panel>}
      {rowEdit && !readonly && <Panel title={`تعديل السطر ${editing! + 1}`} actions={<Button onClick={() => setEditing(null)}>إنهاء تعديل السطر</Button>}><div className="acc-history-form">
        {(['day', 'description', 'amount', 'reference', 'transferRef', 'duplicateReason'] as const).map(key => <TextField key={key} label={key === 'duplicateReason' ? 'سبب استقلال الحركة عن المشابهة' : fields[key as keyof HistoryMapping] || key} value={rowEdit[key] || ''} onChange={e => changeRows(rows.map((r, i) => i === editing ? { ...r, [key]: e.target.value } : r))} disabled={busy} />)}
        <TextField select label="الاتجاه" value={rowEdit.direction} onChange={e => changeRows(rows.map((r, i) => i === editing ? { ...r, direction: e.target.value } : r))} disabled={busy}><MenuItem value="in">قبض</MenuItem><MenuItem value="out">صرف</MenuItem>{!['in', 'out'].includes(rowEdit.direction) && <MenuItem value={rowEdit.direction}>{rowEdit.direction || 'غير صالح'}</MenuItem>}</TextField>
        <TextField select label="التصنيف" value={rowEdit.category} onChange={e => changeRows(rows.map((r, i) => i === editing ? { ...r, category: e.target.value } : r))} disabled={busy}>{Object.entries(categories).map(([key, c]: [string, any]) => <MenuItem key={key} value={key}>{c.label}</MenuItem>)}</TextField>
      </div></Panel>}
      <Panel flush title={`الحركات (${rows.length})`} subtitle="إيداعات المحافظ هنا مقبوضات تاريخية فقط؛ لا تضيف رصيدًا للعميل ولا تُسجّل إيرادًا.">
        <DataTable<any> rows={rows} rowKey={r => r.clientKey} dense maxHeight={420} empty={{ title: 'اختر ملفًا أو أضف أول حركة يدويًا' }} columns={[
          { key: 'day', header: 'التاريخ', render: r => <Ltr>{r.day}</Ltr> },
          { key: 'description', header: 'البيان', render: r => { const p = preview?.rows?.[rowIndex(r)]; return <>{r.description}<Sub>{r.reference}</Sub>{p?.error && <span role="alert" className="acc-history-error">{p.error}</span>}{p?.duplicate && <Sub>مشابهة: {p.duplicate}</Sub>}{p?.bookMatches?.length > 0 && <Sub>حركة محتملة في الدفاتر: {p.bookMatches.join('، ')} — لن تُرحّل مرة ثانية</Sub>}</>; } },
          { key: 'amount', header: 'المبلغ', numeric: true, render: r => <Ltr>{r.amount} {account?.currency || detail?.currency}</Ltr> },
          { key: 'direction', header: 'الاتجاه', render: r => r.direction === 'in' ? 'قبض' : r.direction === 'out' ? 'صرف' : 'غير صالح' },
          { key: 'category', header: 'التصنيف', render: r => categories[r.category]?.label || 'بانتظار التصنيف' },
          { key: 'transferRef', header: 'مرجع التحويل', render: r => r.transferRef },
          { key: 'action', header: '', render: r => !readonly && <><Button size="small" disabled={busy} onClick={() => setEditing(rowIndex(r))}>تعديل</Button><Button size="small" color="error" disabled={busy} onClick={() => { changeRows(rows.filter(item => item.clientKey !== r.clientKey)); setEditing(null); }}>استبعاد</Button></> },
        ]} />
      </Panel>
      {preview && <Alert severity={preview.errors ? 'error' : preview.scope === 'wallets' || preview.reconciliation === 0 ? 'success' : 'warning'} className="mb-3">أخطاء: {preview.errors} · قبض {money(preview.inflow, preview)} · صرف {money(preview.outflow, preview)} · {preview.scope === 'wallets' ? 'مراجعة حركات محافظ فقط؛ لا تُجرى مطابقة رصيد الخزينة' : preview.reconciliation == null ? 'أدخل رصيدي البداية والنهاية للاعتماد' : <>فرق المطابقة: {money(preview.reconciliation, preview)}</>}. الحفظ مسودة، والاعتماد يتطلب اكتمال التصنيف ومراجعة التكرار{preview.scope !== 'wallets' && ' واتزان الرصيد'}.</Alert>}
      {!readonly && preview?.rows?.some((r: any) => r.duplicate && r.error) && <Button disabled={busy} onClick={() => { changeRows(rows.filter((_, i) => !(preview.rows[i]?.duplicate && preview.rows[i]?.error))); setEditing(null); }}>استبعاد السطور المكررة غير المعتمدة من المعاينة</Button>}
      {!readonly && <div className="d-flex flex-wrap gap-2"><Button variant="outlined" onClick={check} disabled={busy || !rows.length || !form.accountId}>معاينة الأخطاء والتكرارات</Button><Button variant="contained" onClick={save} disabled={busy || !preview || !!preview.errors}>حفظ المسودة</Button></div>}
    </> : <>
      <Panel title="نطاق التقرير"><FilterBar>
        {(['from', 'to'] as const).map(key => <TextField key={key} type="date" label={key === 'from' ? 'من' : 'إلى'} InputLabelProps={{ shrink: true }} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} />)}
        <TextField select label="المكتب" value={filters.office} onChange={e => setFilters(f => ({ ...f, office: e.target.value, accountId: '' }))}><MenuItem value="">كل المكاتب</MenuItem>{options.offices.map((o: any) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>
        <TextField select label="الحساب" value={filters.accountId} onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}><MenuItem value="">كل الحسابات والعملات</MenuItem>{options.accounts.filter((a: any) => !filters.office || a.office === filters.office).map((a: any) => <MenuItem key={a._id} value={String(a._id)}>{a.name}</MenuItem>)}</TextField>
        <TextField select label="العملة" value={filters.currency} onChange={e => setFilters(f => ({ ...f, currency: e.target.value, accountId: '' }))}><MenuItem value="">كل العملات — منفصلة</MenuItem>{Array.from(new Set<string>(options.accounts.map((a: any) => a.currency))).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
        <TextField select label="الاعتماد" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><MenuItem value="">تشمل المسودات — مبدئي</MenuItem><MenuItem value="approved">المعتمدة فقط</MenuItem></TextField><Button variant="outlined" onClick={() => { setQuery({ ...filters }); setPage(1); }}>عرض</Button>
        <TextField select label="مصدر الإجماليات" value={filters.mode} onChange={e => setFilters(f => ({ ...f, mode: e.target.value }))}><MenuItem value="combined">موحد مع منع التكرار بالربط</MenuItem><MenuItem value="manual">الكشوف التاريخية فقط</MenuItem><MenuItem value="normal">الأقسام العادية فقط</MenuItem></TextField>
      </FilterBar></Panel>
      {!!data?.sources?.pending && <Alert severity="warning" className="mb-3">{data.sources.pending} سجلًا من الأقسام العادية يحتاج مراجعة. الإجماليات التي تشمل السجلات غير المراجعة مبدئية. اربط الحركات الموجودة في كشف تاريخي حتى تُحسب مرة واحدة.</Alert>}
      <Panel flush title="إجمالي النطاق لكل عملة" subtitle="المكاتب والحسابات المحددة في الفلاتر فقط. لا نجمع عملات مختلفة."><DataTable<any> rows={company} loading={loading} rowKey={r => r.currency} empty={{ title: 'لا إجماليات بعد' }} columns={[
        { key: 'currency', header: 'العملة', render: r => <Ltr>{r.currency}</Ltr> }, { key: 'incoming', header: 'المقبوضات', numeric: true, render: r => money(r.incoming, r) }, { key: 'outgoing', header: 'المدفوعات', numeric: true, render: r => money(r.outgoing, r) }, { key: 'external', header: 'الصافي دون التحويلات', numeric: true, render: r => money(r.incoming - r.outgoing - r.transferIn + r.transferOut, r) },
      ]} /></Panel>
      <Panel flush title="الملخص الشهري" subtitle="كل عملة مستقلة. التحويلات الداخلية معروضة منفصلة؛ والصافي دونها ليس ربحًا محاسبيًا. لا تجمع هذا التقرير مع الدفاتر لنفس الحركات."><DataTable<any> rows={monthly} loading={loading} rowKey={r => r.key} empty={{ title: 'لا توجد حركات ضمن الفترة', hint: 'ابدأ بكشف جديد أو عدّل الفلاتر.' }} columns={[
        { key: 'month', header: 'الشهر والمكتب', render: r => <><Ltr>{r.month} · {r.currency}</Ltr><Sub>{options.offices.find((o: any) => o.code === r.office)?.name || r.office}</Sub>{r.drafts > 0 && <Badge tone="warn">مبدئي: {r.drafts} سطر غير معتمد</Badge>}{r.unknown > 0 && <Sub>غير مصنف: {r.unknown}</Sub>}</> },
        { key: 'incoming', header: 'المقبوضات', numeric: true, render: r => money(r.incoming, r) }, { key: 'outgoing', header: 'المدفوعات', numeric: true, render: r => money(r.outgoing, r) },
        { key: 'net', header: 'صافي الحركة', numeric: true, render: r => money(r.incoming - r.outgoing, r) },
        { key: 'transfers', header: 'تحويلات الشركة', render: r => <>داخل {money(r.transferIn, r)}<Sub>خارج {money(r.transferOut, r)}</Sub></> },
        { key: 'external', header: 'الصافي دون التحويلات', numeric: true, render: r => money(r.incoming - r.outgoing - r.transferIn + r.transferOut, r) },
      ]} /></Panel>
      <Panel flush title={`من الأقسام العادية (${data?.sources?.total || 0})`} subtitle="تظهر الحركات النقدية المرحّلة وسطور كشوف البنك تلقائيًا ضمن الفترة. مستندات التكلفة تظهر للمراجعة فقط ولا تُحسب مرة ثانية كدفع. التعديل المالي يتم من المصدر الأصلي.">
        <DataTable<any> rows={data?.sources?.rows || []} rowKey={r => r.key} loading={loading} dense maxHeight={500} empty={{ title: 'لا توجد سجلات عادية ضمن الفترة' }} columns={[
          { key: 'day', header: 'التاريخ', render: r => <Ltr>{r.day}</Ltr> },
          { key: 'description', header: 'السجل والمصدر', render: r => <><Open to={r.url}>{r.number}</Open><Sub>{r.description}</Sub>{r.changedSinceReview && <Badge tone="warn">تغيّر بعد المراجعة</Badge>}{r.warning && <Sub>{r.warning}</Sub>}{r.relatedEntries?.map((e: any) => <Sub key={e.url}><Open to={e.url}>{e.number}</Open></Sub>)}</> },
          { key: 'account', header: 'الحساب والمكتب', hideOnMobile: true, render: r => <>{r.accountName || 'مستند تكلفة'}<Sub>{r.officeName}</Sub></> },
          { key: 'amount', header: 'المبلغ', numeric: true, render: r => <>{money(r.amountMinor, r)}<Sub>{r.direction === 'in' ? 'قبض' : 'صرف'}{!r.cash && ' · مستند غير نقدي'}</Sub></> },
          { key: 'category', header: 'التصنيف', render: r => categories[r.category]?.label || 'بانتظار التصنيف' },
          { key: 'state', header: 'المراجعة', render: r => <><Badge tone={['reviewed', 'linked'].includes(r.state) ? 'ok' : 'warn'}>{sourceStates[r.state] || r.state}</Badge><Sub>{r.state === 'linked' ? 'يُحسب من الكشف التاريخي مرة واحدة' : !r.contributes ? 'للمراجعة فقط — لا يدخل الإجماليات' : 'يدخل صافي الحركة النقدية'}</Sub></> },
          { key: 'action', header: '', render: r => canReview && !r.orphanLink && <Button size="small" onClick={() => reviewSource(r)} disabled={busy}>مراجعة / ربط</Button> },
        ]} />{data?.sources?.total > 30 && <Pagination count={Math.ceil(data.sources.total / 30)} page={sourcePage} onChange={(_, value) => setSourcePage(value)} />}
      </Panel>
      <Panel flush title={`الكشوف (${data?.count || 0})`}><DataTable<any> rows={data?.batches || []} loading={loading} rowKey={r => r._id} getRowHref={r => `?batch=${r._id}`} onRowClick={r => setParams({ batch: r._id })} empty={{ title: 'لم يُضف كشف بعد' }} columns={[
        { key: 'title', header: 'الكشف', render: r => <><Open to={`?batch=${r._id}`}>{r.title}</Open><Sub>{r.scope === 'wallets' ? 'حركات محافظ فقط · ليست مطابقة خزينة' : 'كشف كامل للخزينة'}</Sub></> }, { key: 'account', header: 'الحساب', hideOnMobile: true, render: r => <>{r.accountName}<Sub>{r.officeName} · {r.currency}</Sub></> },
        { key: 'period', header: 'الفترة', hideOnMobile: true, render: r => <Ltr>{r.from} — {r.to}</Ltr> }, { key: 'status', header: 'الحالة', render: r => <Badge tone={r.status === 'approved' ? 'ok' : 'warn'}>{statusLabel[r.status]}</Badge> },
      ]} />{data?.count > 25 && <Pagination count={Math.ceil(data.count / 25)} page={page} onChange={(_, p) => setPage(p)} />}</Panel>
    </>}
    <Dialog open={!!review} onClose={() => { if (!busy) setReview(''); }} fullWidth maxWidth="sm" dir="rtl"><DialogTitle>{review === 'approve' ? 'اعتماد الكشف التاريخي' : review === 'reopen' ? 'إعادة فتح الكشف للمراجعة' : 'إلغاء الكشف التاريخي'}</DialogTitle><DialogContent><p>هذا الإجراء يخص التقرير التاريخي وحده. لا يغيّر المحافظ أو القيود المحاسبية.</p><TextField fullWidth multiline minRows={2} label="ملاحظة المراجعة / السبب" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></DialogContent><DialogActions><Button onClick={() => setReview('')} disabled={busy}>رجوع</Button><Button onClick={submitReview} variant="contained" disabled={busy || reason.trim().length < 10}>تأكيد الإجراء</Button></DialogActions></Dialog>
    {sourceRow && <Dialog open onClose={() => { if (!busy) setSourceRow(null); }} fullWidth maxWidth="sm" dir="rtl"><DialogTitle>مراجعة سجل مرتبط</DialogTitle><DialogContent>
      <p>{sourceRow?.description}</p><p>المراجعة والتصنيف هنا للتقرير فقط؛ لا ترحّل الحركة ولا تعتمد مطابقتها في البنك. لتغيير القيمة أو إلغاء العملية افتح مصدرها الأصلي.</p>
      <div className="acc-history-form">
        <TextField select label="إجراء المراجعة" value={sourceState} onChange={e => setSourceState(e.target.value)} disabled={busy}><MenuItem value="reviewed" disabled={!!sourceRow.warning}>اعتماد المراجعة للتقرير</MenuItem><MenuItem value="issue">تحتاج معالجة</MenuItem><MenuItem value="excluded">استبعاد من هذا التقرير فقط</MenuItem>{sourceRow?.candidates?.length > 0 && !sourceRow.warning && <MenuItem value="linked">ربط بحركة تاريخية موجودة</MenuItem>}</TextField>
        <TextField select label="تصنيف السجل" value={sourceCategory} onChange={e => setSourceCategory(e.target.value)} disabled={busy}>{Object.entries(categories).map(([key, c]: [string, any]) => <MenuItem key={key} value={key}>{c.label}</MenuItem>)}</TextField>
        {sourceState === 'linked' && <TextField select label="الحركة التاريخية المطابقة" value={sourceCandidate} onChange={e => setSourceCandidate(e.target.value)} disabled={busy}>{sourceRow?.candidates?.map((c: any) => <MenuItem key={`${c.batchId}:${c.rowId}`} value={`${c.batchId}:${c.rowId}`}>{c.title} · {c.description}</MenuItem>)}</TextField>}
        <TextField multiline minRows={2} label="ملاحظة المراجعة" value={sourceNote} onChange={e => setSourceNote(e.target.value)} disabled={busy} />
      </div>
      {sourceState === 'reviewed' && sourceRow?.candidates?.length > 0 && <FormControlLabel label="راجعت الحركات المشابهة وهذه عملية مستقلة فعلًا" control={<Checkbox checked={independent} onChange={(_, checked) => setIndependent(checked)} disabled={busy} />} />}
      {error && <Alert severity="error">{error}</Alert>}
    </DialogContent><DialogActions><Button onClick={() => setSourceRow(null)} disabled={busy}>رجوع</Button><Button variant="contained" onClick={saveSource} disabled={busy || sourceNote.trim().length < 10 || (sourceState === 'linked' && !sourceCandidate) || (sourceState === 'reviewed' && sourceRow?.candidates?.length > 0 && !independent)}>حفظ المراجعة والربط</Button></DialogActions></Dialog>}
  </div>;
}
