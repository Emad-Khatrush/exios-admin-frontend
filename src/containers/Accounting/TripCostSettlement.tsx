import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, TextField } from '@mui/material';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { acc, errorText, formatMinor } from './accountingApi';
import { Badge, DataTable, FilterBar, Money, Open, Sub } from './ui';
import { useAccountingAccess } from './useAccountingAccess';

const endpoint = 'bank/trip-cost-settlements';
const countries: Record<string, string> = { CN: 'الصين', UAE: 'الإمارات', TR: 'تركيا', USA: 'أمريكا', UK: 'بريطانيا', LY: 'ليبيا' };
const steps = ['الكشف والنطاق', 'مراجعة التكاليف', 'الرحلات والتوزيع', 'المعاينة والاعتماد'];
export default function TripCostSettlement({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const access = useAccountingAccess();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<'work' | 'history'>('work');
  const [lineView, setLineView] = useState('all');
  const [lineSearch, setLineSearch] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [step, tab]);
  const [params, setParams] = useState({ accountId: '', vendorId: '', countries: '', expenseOffice: '', mode: 'air', method: 'weight', from: '', to: '', services: true, seaLoadType: '' });
  const [catalog, setCatalog] = useState<{ accounts: any[]; vendors: any[]; offices: any[] }>({ accounts: [], vendors: [], offices: [] });
  const [lineKinds, setLineKinds] = useState<Record<string, string>>({});
  const [matchChoices, setMatchChoices] = useState<Record<string, string>>({});
  const [matchPreview, setMatchPreview] = useState<any>(null);
  const [matchConfirmed, setMatchConfirmed] = useState(false);
  const [conflictsConfirmed, setConflictsConfirmed] = useState(false);
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [confirmAdditional, setConfirmAdditional] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (error) contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [error]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tripSearch, setTripSearch] = useState('');
  const [cancelFor, setCancelFor] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState<any>(null);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    if (open) {
      setStep(0); setTab('work'); setLineView('all'); setLineSearch(''); setLineIds([]); setTripIds([]); setTripSearch('');
      setData(null); setPreview(null); setMatchPreview(null); setMatchChoices({}); setSaved(null); setCancelFor(null); setError(''); setMessage('');
      acc.get(endpoint).then((r: any) => { if (alive) setHistory(r.data.results); }).catch((e: any) => { if (alive) setError(errorText(e)); });
      Promise.all([acc.get('accounts'), acc.get('vendors'), acc.get('offices')]).then(([a, v, o]: any[]) => {
        if (alive) setCatalog({ accounts: a.data.results.filter((x: any) => x.isCash && !x.isGroup && x.isActive && x.cashKind === 'current'), vendors: v.data.results.filter((x: any) => x.isActive !== false), offices: o.data.results.filter((x: any) => x.isActive) });
      }).catch((e: any) => { if (alive) setError(errorText(e)); });
    }
    return () => { alive = false; };
  }, [open]);
  const change = (key: string, value: any) => {
    generation.current++;
    setParams(p => ({ ...p, [key]: value, ...(key === 'mode' ? { seaLoadType: '' } : {}), ...(key === 'accountId' ? { vendorId: '', expenseOffice: '' } : {}) }));
    setData(null); setLineKinds({}); setLineIds([]); setTripIds([]); setPreview(null); setMatchChoices({}); setMatchPreview(null); setConfirmed(false); setConfirmAdditional(false);
    setStep(0);
  };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  const load = () => run(async () => {
    const version = ++generation.current;
    const result = (await acc.get(`${endpoint}/options`, params)).data;
    if (version !== generation.current) return;
    setData(result); setLineKinds({}); setLineIds([]); setTripIds([]); setPreview(null); setMatchChoices({}); setMatchPreview(null); setConfirmed(false); setConfirmAdditional(false); setMessage('');
    setStep(1); setLineView('all'); setLineSearch('');
  });
  const toggle = (type: 'line' | 'trip', id: string, checked: boolean) => {
    const setter = type === 'line' ? setLineIds : setTripIds;
    setter(list => checked ? Array.from(new Set([...list, id])) : list.filter(x => x !== id));
    setPreview(null); setConfirmed(false); setConfirmAdditional(false);
  };
  const view = () => run(async () => { const selectedTrips = needsTrips ? tripIds : []; if (!needsTrips) setTripIds([]); setPreview((await acc.post(`${endpoint}/preview`, { ...params, lineIds, tripIds: selectedTrips, lineKinds })).data); setConfirmed(false); setConfirmAdditional(false); setStep(3); });
  const apply = () => run(async () => {
    await acc.post(endpoint, { ...params, lineIds, tripIds, lineKinds, fingerprint: preview.fingerprint, confirmAdditional });
    setMessage('اعتمدت التسوية وربطت سطور الكشف دون تكرار.'); setPreview(null); setData(null); setLineIds([]); setTripIds([]);
    setStep(0);
    setHistory((await acc.get(endpoint)).data.results); onDone();
  });
  const cancel = () => run(async () => {
    await acc.post(`${endpoint}/${cancelFor._id}/cancel`, { reason }); setCancelFor(null); setReason(''); setData(null); setPreview(null);
    setStep(0); setLineIds([]); setTripIds([]); setMatchChoices({}); setMatchPreview(null);
    setHistory((await acc.get(endpoint)).data.results); setMessage('ألغيت التسوية وعادت سطورها للمراجعة.'); onDone();
  });
  const trips = (data?.trips || []).filter((t: any) => String(t.voyage || '').toLowerCase().includes(tripSearch.trim().toLowerCase()));
  const selectableLines = (data?.lines || []).filter((l: any) => (lineKinds[l._id] || l.kind) !== 'review' && !l.tripMatches?.length);
  const picks = Object.entries(matchChoices).filter(([, billId]) => billId).map(([lineId, billId]) => ({ lineId, billId }));
  const chooseMatch = (lineId: string, billId: string) => {
    setMatchChoices(current => ({ ...current, [lineId]: billId })); setLineIds(current => current.filter(x => x !== lineId));
    setMatchPreview(null); setMatchConfirmed(false); setConflictsConfirmed(false); setPreview(null);
  };
  const previewMatches = () => run(async () => {
    setMatchPreview((await acc.post(`${endpoint}/match-preview`, { ...params, matches: picks })).data);
    setMatchConfirmed(false); setConflictsConfirmed(false);
  });
  const approveMatches = () => run(async () => {
    const result = (await acc.post(`${endpoint}/match`, { ...params, matches: picks, fingerprint: matchPreview.fingerprint, confirmed: matchConfirmed, confirmConflicts: conflictsConfirmed })).data;
    setData(null); setMatchChoices({}); setMatchPreview(null); setPreview(null); setLineIds([]); setTripIds([]);
    setMessage(`طابقت ${result.matched} سطر مع فواتير الرحلات الموجودة دون إنشاء تكلفة جديدة. اختر السطور المتبقية لتوزيع التكاليف الجديدة.`); onDone();
    setData((await acc.get(`${endpoint}/options`, params)).data);
  });
  const dateInvalid = !!(params.from && params.to && params.from > params.to);
  const needsTrips = (data?.lines || []).some((line: any) => lineIds.includes(line._id) && (lineKinds[line._id] || line.kind) !== 'service');
  const lineCategory = (line: any) => line.tripMatches?.length ? 'existing' : (lineKinds[line._id] || line.kind) === 'review' ? 'review' : 'new';
  const visibleLines = (data?.lines || []).filter((line: any) => (lineView === 'all' || lineCategory(line) === lineView)
    && `${line.description} ${line.reference || ''} ${line.day}`.toLowerCase().includes(lineSearch.trim().toLowerCase()));
  const selectedTotal = (data?.lines || []).filter((line: any) => lineIds.includes(line._id)).reduce((total: number, line: any) => total - line.amount, 0);
  const emptyReasons: Record<string, string> = {
    no_statement: 'لم يُستورد أي كشف على هذا الحساب. اختر الحساب المسجل عليه الكشف أو استورده من مطابقة البنك.',
    outside_period: 'يوجد كشف على هذا الحساب، لكن لا توجد سطور ضمن الفترة المختارة. عدّل تاريخ البداية أو النهاية.',
    no_available_costs: 'لا توجد حركات تكلفة خارجة غير معالجة ضمن هذه الفترة. قد تكون السطور مطابقة أو مرحّلة أو متجاهلة، أو حركات واردة لا تدخل في التكلفة.',
    excluded_by_type: 'توجد سطور تكلفة، لكنها مستبعدة بسبب نوع الشحن أو تعطيل الفواتير الخدمية. عدّل هذه الخيارات في الخطوة الأولى.',
  };
  return <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="lg" fullWidth dir="rtl" className="acc-root acc-settlement-dialog">
    <DialogTitle className="acc-settlement-title"><div><strong>تسوية تكاليف الرحلات جماعيًا</strong><Sub>طابق الموجود أولًا، ثم وزّع التكاليف الجديدة على الرحلات.</Sub></div><Button aria-label="إغلاق التسوية" disabled={busy} onClick={onClose}><X size={20} /></Button></DialogTitle>
    {busy && <LinearProgress />}
    <div className="acc-settlement-navigation">
      <Button variant={tab === 'work' ? 'contained' : 'text'} disabled={busy} onClick={() => setTab('work')}>تسوية جديدة</Button>
      <Button variant={tab === 'history' ? 'contained' : 'text'} disabled={busy} onClick={() => setTab('history')}>التسويات السابقة ({history.length})</Button>
    </div>
    {tab === 'work' && <div className="acc-settlement-steps">{steps.map((label, index) => <button type="button" key={label} className={`acc-settlement-step${step === index ? ' is-active' : ''}${step > index ? ' is-complete' : ''}`} aria-current={step === index ? 'step' : undefined} disabled={busy || (index > 0 && !data) || (index === 2 && (!lineIds.length || picks.length > 0)) || (index === 3 && !preview)} onClick={() => setStep(index)}><span>{step > index ? <Check size={15} /> : index + 1}</span>{label}</button>)}</div>}
    <DialogContent ref={contentRef}>
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      {message && <Alert severity="success" className="mb-3">{message}</Alert>}
      {tab === 'work' && <>
      {step === 0 && <section className="acc-settlement-section">
      <h3>اختر الكشف ونطاق التسوية</h3><Sub>استورد كشف الشركة في «مطابقة البنك» أولًا. اختر فترة محددة، ونوع شحن واحد لكل تسوية.</Sub>
      <div className="acc-settlement-fields">
        <TextField select label="الحساب الجاري للشركة" value={params.accountId} disabled={busy} onChange={e => change('accountId', e.target.value)} style={{ minWidth: 220 }}><MenuItem value="">اختر الحساب</MenuItem>{catalog.accounts.map(a => <MenuItem key={a._id} value={a._id}>{a.code} · {a.name} · {a.currency || 'USD'}</MenuItem>)}</TextField>
        <TextField select label="المورد صاحب الكشف" value={params.vendorId} disabled={busy} onChange={e => change('vendorId', e.target.value)} style={{ minWidth: 200 }}><MenuItem value="">اختر المورد</MenuItem>{catalog.vendors.map(v => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}</TextField>
        <TextField select label="دول الرحلات" value={params.countries ? params.countries.split(',') : []} SelectProps={{ multiple: true }} disabled={busy} onChange={e => { const value = e.target.value as unknown as string[] | string; change('countries', Array.isArray(value) ? value.join(',') : value); }} style={{ minWidth: 180 }}>{Object.entries(countries).map(([code, name]) => <MenuItem key={code} value={code}>{name}</MenuItem>)}</TextField>
        <TextField select label="نوع الشحن" value={params.mode} disabled={busy} onChange={e => change('mode', e.target.value)}><MenuItem value="air">جوي</MenuItem><MenuItem value="sea">بحري</MenuItem></TextField>
        {params.mode === 'sea' && <TextField select label="البحري" value={params.seaLoadType} disabled={busy} onChange={e => change('seaLoadType', e.target.value)}><MenuItem value="">الكل</MenuItem><MenuItem value="FCL">FCL</MenuItem><MenuItem value="LCL">LCL</MenuItem><MenuItem value="unknown">غير محدد</MenuItem></TextField>}
        <TextField type="date" label="سطور الكشف من" InputLabelProps={{ shrink: true }} value={params.from} disabled={busy} onChange={e => change('from', e.target.value)} />
        <TextField type="date" label="سطور الكشف إلى" InputLabelProps={{ shrink: true }} value={params.to} error={dateInvalid} helperText={dateInvalid ? 'تاريخ النهاية قبل البداية' : undefined} disabled={busy} onChange={e => change('to', e.target.value)} />
      </div>
      <div className="acc-settlement-services">
        <FormControlLabel control={<Checkbox checked={params.services} disabled={busy} onChange={e => change('services', e.target.checked)} />} label="عرض الفواتير الخدمية كمصاريف شراء" />
        {params.services && <TextField select size="small" label="مكتب المصروف الخدمي" value={params.expenseOffice} disabled={busy} onChange={e => change('expenseOffice', e.target.value)}><MenuItem value="">مكتب الحساب الجاري</MenuItem>{catalog.offices.map(o => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}</TextField>}
      </div>
      <Alert severity="info">الشحن الجوي والبحري في تسويتين منفصلتين. السداد والأرصدة لا تُوزّع كتكلفة؛ الفواتير الخدمية تُسجل كمصاريف شراء.</Alert>
      </section>}
      {data && step === 1 && <section className="acc-settlement-section">
        <h3>راجع سطور الكشف — {data.account.name}</h3><Sub>اربط التكاليف الموجودة بفواتيرها. حدّد «تكلفة جديدة» فقط للسطور التي لم تُسجل سابقًا.</Sub>
        <div className="acc-settlement-selection">الحساب: <strong>{data.account.name}</strong> · {params.mode === 'air' ? 'شحن جوي' : 'شحن بحري'} · {params.countries.split(',').map(code => countries[code] || code).join('، ')} · الفترة: {params.from || 'من أول كشف'} — {params.to || 'حتى آخر كشف'}</div>
        {!!data.lines.length && <>
        <div className="acc-settlement-line-tabs">{[['all', 'كل السطور'], ['existing', 'تكاليف موجودة'], ['new', 'تكاليف جديدة'], ['review', 'تحتاج تصنيفًا']].map(([value, label]) => <Button key={value} variant={lineView === value ? 'contained' : 'outlined'} disabled={busy} onClick={() => setLineView(value)}>{label} ({value === 'all' ? data.lines.length : data.lines.filter((line: any) => lineCategory(line) === value).length})</Button>)}</div>
        <TextField size="small" fullWidth label="بحث في سطور الكشف" value={lineSearch} disabled={busy} onChange={e => setLineSearch(e.target.value)} />
        <div className="acc-settlement-tools">
        <Button disabled={busy || !access.can('treasury')} onClick={() => {
          const choices: Record<string, string> = {};
          data.lines.forEach((l: any) => { const clear = l.tripMatches?.find((m: any) => m.clear); if (clear) choices[l._id] = clear.billId; });
          setMatchChoices(choices); setLineIds(current => current.filter(x => !choices[x])); setMatchPreview(null); setPreview(null);
        }}>اختيار المطابقات الواضحة</Button>
        <Button disabled={busy || !access.can('treasury')} onClick={() => {
          const choices: Record<string, string> = {};
          data.lines.forEach((l: any) => { const suggestion = l.tripMatches?.find((m: any) => m.suggested); if (suggestion) choices[l._id] = suggestion.billId; });
          setMatchChoices(choices); setLineIds(current => current.filter(x => !choices[x])); setMatchPreview(null); setPreview(null);
        }}>اختيار اقتراحات نفس الرحلة</Button>
        <Button disabled={busy || !picks.length || !access.can('treasury')} onClick={previewMatches}>معاينة مطابقة التكاليف الموجودة ({picks.length})</Button>
        {!!picks.length && <Button disabled={busy} onClick={() => { setMatchChoices({}); setMatchPreview(null); setMatchConfirmed(false); setConflictsConfirmed(false); }}>مسح اختيارات المطابقة</Button>}
        <FormControlLabel control={<Checkbox disabled={busy || !selectableLines.length} checked={!!selectableLines.length && lineIds.length === selectableLines.length} onChange={e => { setLineIds(e.target.checked ? selectableLines.map((l: any) => l._id) : []); setPreview(null); }} />} label={`اختيار كل التكاليف الجديدة المصنفة (${selectableLines.length})`} />
        </div>
        <div className="acc-settlement-table"><DataTable rows={visibleLines} rowKey={(l: any) => l._id} columns={[
          { key: 'pick', header: 'تكلفة جديدة', render: (l: any) => <Checkbox checked={lineIds.includes(l._id)} disabled={busy || (lineKinds[l._id] || l.kind) === 'review' || !!l.tripMatches?.length} onChange={e => toggle('line', l._id, e.target.checked)} /> },
          { key: 'day', header: 'التاريخ', render: (l: any) => l.day },
          { key: 'description', header: 'البيان', render: (l: any) => l.description },
          { key: 'kind', header: 'نوع التكلفة', render: (l: any) => <TextField select size="small" value={lineKinds[l._id] || l.kind} disabled={busy} onChange={e => { setLineKinds(current => ({ ...current, [l._id]: e.target.value })); setLineIds(current => current.filter(x => x !== l._id)); setPreview(null); setConfirmed(false); }}><MenuItem value="review">غير محدد — راجع السطر</MenuItem><MenuItem value={params.mode}>تكلفة شحن</MenuItem><MenuItem value="service">مصروف شراء خدمي</MenuItem></TextField> },
          { key: 'amount', header: 'التكلفة', render: (l: any) => formatMinor(-l.amount, data.account.currency, data.account.decimals) },
          { key: 'match', header: 'مطابقة مع تكلفة رحلة موجودة', render: (l: any) => l.tripMatches?.length ? <>
            <TextField select size="small" value={matchChoices[l._id] || ''} disabled={busy} style={{ minWidth: 260 }} onChange={e => chooseMatch(l._id, e.target.value)}>
              <MenuItem value="">راجع الاقتراح واختر الفاتورة</MenuItem>
              {l.tripMatches.map((m: any) => <MenuItem key={m.billId} value={m.billId} disabled={!m.canMatch}>{m.number} · {m.trips.map((t: any) => t.voyage).join('، ')} · {m.day} · {m.amount} {m.currency}</MenuItem>)}
            </TextField>
            {l.tripMatches.map((m: any) => <Sub key={m.billId}>{m.number}: {m.clear ? 'مطابقة واضحة تحتاج اعتمادك' : m.tripConflict ? 'رقم الرحلة مختلف؛ لا تعتمد دون مراجعة' : 'اقتراح يحتاج مراجعة'}{m.vendorConflict ? ' · المورد مختلف' : m.vendorUnidentified ? ' · مورد تاريخي عام؛ تأكد أنها تخص هذه الشركة' : ''}{m.problem ? ` · ${m.problem}` : ''}</Sub>)}
          </> : <Sub>لا توجد فاتورة رحلة محتملة بنفس المبلغ والعملة ضمن 7 أيام.</Sub> },
        ]} /></div>
        </>}
        {matchPreview && <>
          <Alert severity="info" className="my-2">هذه المطابقة تربط سطور الكشف بفواتير موجودة وتستبعدها من توزيع التكلفة الجديدة. إذا كانت الفاتورة غير مسددة تُسجل دفعتها، أو تُسوّى الدفعة التاريخية من المعلّق مع الجاري؛ لا تُنشأ تكلفة رحلة ثانية.</Alert>
          <DataTable rows={matchPreview.matches} rowKey={(m: any) => m.lineId} columns={[
            { key: 'statement', header: 'سطر الكشف', render: (m: any) => <>{m.description}<Sub>{m.day}</Sub></> },
            { key: 'bill', header: 'الفاتورة والرحلة', render: (m: any) => <><Open to={`/accounting/bills/${m.candidate.billId}`}>{m.candidate.number}</Open><Sub>{m.candidate.trips.map((t: any) => t.voyage).join('، ')} · {m.candidate.vendorName} · {m.candidate.day}</Sub></> },
            { key: 'amount', header: 'المبلغ الأصلي', render: (m: any) => `${m.candidate.amount} ${m.candidate.currency}` },
            { key: 'action', header: 'الإجراء والسداد السابق', render: (m: any) => <>{m.candidate.mode === 'pay_bill' ? 'سداد الفاتورة الموجودة' : m.candidate.mode === 'historical_settlement' ? 'تسوية السداد التاريخي من المعلّق' : 'ربط بالسداد الموجود / الجرد'}{m.candidate.payments.map((p: any, index: number) => <Sub key={index}>{p.number} · {p.day} · {p.account}</Sub>)}</> },
          ]} />
          {matchPreview.needsConfirmation && <Alert severity="warning">رقم الرحلة أو المورد مختلف، أو المورد تاريخي عام لا يثبت هوية الشركة. تطابق المبلغ والتاريخ وحده لا يثبت أنها نفس العملية.<FormControlLabel control={<Checkbox checked={conflictsConfirmed} disabled={busy} onChange={e => setConflictsConfirmed(e.target.checked)} />} label="راجعت الرحلة والمورد وتأكدت أن الفواتير المختارة تخص نفس الشركة ونفس سطور الكشف" /></Alert>}
          <FormControlLabel control={<Checkbox checked={matchConfirmed} disabled={busy} onChange={e => setMatchConfirmed(e.target.checked)} />} label="راجعت سطور الكشف والفواتير والرحلات وأؤكد المطابقة دون إضافة تكلفة جديدة" />
        </>}
        {!data.lines.length && <div>
          <Alert severity="info">{emptyReasons[data.diagnostics?.emptyReason] || 'لا توجد سطور غير معالجة ضمن النطاق المختار؛ راجع الحساب والفترة.'}
            {!!data.diagnostics?.accountCount && <Sub>على الحساب {data.diagnostics.accountCount} سطر مستورد؛ منها {data.diagnostics.periodCount} في الفترة المختارة.{data.diagnostics.periodStates?.map((state: any) => ` ${state._id === 'unmatched' ? 'غير معالج' : state._id === 'ignored' ? 'متجاهل' : state._id === 'matched' ? 'مطابق' : 'مرحّل'}: ${state.count}`).join(' · ')}</Sub>}
          </Alert>
          <div className="acc-settlement-tools"><Button variant="outlined" onClick={() => setStep(0)}>تعديل الحساب والفترة</Button><Open to={`/accounting/bank?accountId=${params.accountId}`}>فتح كشوف الحساب المختار</Open></div>
          {!!data.statementAccounts?.length && <div className="acc-settlement-services"><Sub>توجد كشوف مستوردة على هذه الحسابات. اختر الحساب الصحيح ثم راجع المورد والنطاق:</Sub>{data.statementAccounts.map((account: any) => <Button key={account._id} disabled={busy} variant="outlined" onClick={() => change('accountId', account._id)}>{account.name} ({account.count} سطر)</Button>)}</div>}
        </div>}
        {lineIds.length > 0 && <div className="acc-settlement-selection">تكاليف جديدة محددة: <strong>{lineIds.length} سطر</strong> · الإجمالي: <strong>{formatMinor(selectedTotal, data.account.currency, data.account.decimals)}</strong></div>}
      </section>}
      {data && step === 2 && <section className="acc-settlement-section">
        <h3>اختر الرحلات وطريقة التوزيع</h3>
        <div className="acc-settlement-selection">ستوزّع <strong>{formatMinor(selectedTotal, data.account.currency, data.account.decimals)}</strong> من {lineIds.length} سطر جديد. المطابقات المعتمدة لا تدخل في هذا المبلغ.</div>
        <TextField select size="small" label="طريقة توزيع تكلفة الشحن" value={params.method} disabled={busy || !needsTrips} onChange={e => { setParams(p => ({ ...p, method: e.target.value })); setPreview(null); setConfirmed(false); setConfirmAdditional(false); }}><MenuItem value="weight">حسب {params.mode === 'air' ? 'الوزن KG' : 'الحجم CBM'}</MenuItem><MenuItem value="equal">بالتساوي بين الرحلات</MenuItem></TextField>
        {!needsTrips && <Alert severity="info" className="my-3">اخترت فواتير خدمية فقط؛ ستُسجل في تكاليف الخدمات ولا تحتاج لاختيار رحلات أو عملاء.</Alert>}
        {needsTrips && <>
        <Alert severity="warning">فترة البحث أعلاه تخص سطور الكشف. اختر فقط الرحلات المتعلقة بها من الدول المختارة؛ لا تختَر جميع رحلات السنة لتكلفة شهر واحد.</Alert>
        <FilterBar><TextField size="small" label="بحث باسم الرحلة" value={tripSearch} disabled={busy} onChange={e => setTripSearch(e.target.value)} />
        <Button disabled={busy} onClick={() => { setTripIds(list => Array.from(new Set<string>([...list, ...trips.map((t: any) => String(t._id))]))); setPreview(null); }}>تحديد الرحلات الظاهرة ({trips.length})</Button>
        <Button disabled={busy} onClick={() => { setTripIds([]); setPreview(null); }}>مسح اختيار الرحلات</Button>
        <Sub>{tripIds.length} رحلة محددة · {trips.length} ظاهرة</Sub></FilterBar>
        <div className="acc-settlement-table"><DataTable rows={trips} rowKey={(t: any) => t._id} columns={[
          { key: 'pick', header: '', render: (t: any) => <Checkbox checked={tripIds.includes(t._id)} disabled={busy} onChange={e => toggle('trip', t._id, e.target.checked)} /> },
          { key: 'voyage', header: 'الرحلة', render: (t: any) => <><Open to={`/inventory/${t._id}/edit`}>{t.voyage}</Open><Sub>{t.arrivalDate ? `الوصول ${String(t.arrivalDate).slice(0, 10)}` : `الإنشاء ${String(t.createdAt).slice(0, 10)}`}</Sub></> },
          { key: 'weight', header: params.mode === 'air' ? 'KG' : 'CBM', render: (t: any) => t.weight },
          { key: 'country', header: 'الدولة', render: (t: any) => countries[t.shippedCountry] || t.shippedCountry },
          { key: 'cost', header: 'تكلفة مسجلة سابقًا', render: (t: any) => <Money value={t.existingCost} /> },
        ]} /></div>
        {params.method === 'weight' && data.trips.some((trip: any) => tripIds.includes(trip._id) && !(trip.weight > 0)) && <Alert severity="warning">إحدى الرحلات المحددة بلا وزن أو حجم. أكمل بياناتها أو اختر التوزيع بالتساوي.</Alert>}
        </>}
      </section>}
      {preview && step === 3 && <section className="acc-settlement-section">
        <h3>راجع النتيجة قبل الاعتماد</h3>
        <Alert severity="info">الحساب: {preview.account.name} · المورد: {preview.vendor.name} · الدول: {preview.countries.map((c: string) => countries[c] || c).join('، ')}. الإجماليات التالية بالدولار.</Alert>
        <div className="acc-settlement-totals">
          <div><Sub>إيراد الرحلات الكلي</Sub><strong><Money value={preview.totalRevenue} /></strong></div>
          <div><Sub>التكلفة المسجلة سابقًا</Sub><strong><Money value={preview.totalExistingCost} /></strong></div>
          <div><Sub>شحن جديد للتوزيع</Sub><strong><Money value={preview.shippingTotal} /></strong></div>
          <div><Sub>تكاليف خدمات مستقلة</Sub><strong><Money value={preview.serviceTotal} /></strong></div>
          <div className="acc-settlement-totals__net"><Sub>نتيجة الرحلات دون الخدمات</Sub><strong><Money value={preview.estimatedNet} /></strong></div>
        </div>
        {!!preview.historicalTotal && <Alert severity="info">تكلفة داخلة في الجرد لا تُحرك الجاري: <Money value={preview.historicalTotal} /></Alert>}
        <Sub>النتيجة تخص إيراد الرحلات وتكلفة شحنها فقط، وليست ربح الفترة المعترف به. تكاليف الخدمات مستقلة؛ قارنها بإيرادات الخدمات في قائمة الدخل، ولا تُحمّل على الرحلات.</Sub>
        {preview.account.currency !== 'USD' && <DataTable rows={preview.lines} rowKey={(l: any) => l._id} columns={[
          { key: 'day', header: 'التاريخ', render: (l: any) => l.day },
          { key: 'original', header: 'التكلفة بعملة الحساب', render: (l: any) => formatMinor(-l.amount, preview.account.currency, preview.account.decimals) },
          { key: 'usd', header: 'المقابل بالدولار', render: (l: any) => <Money value={l.totalUsd} /> },
          { key: 'rate', header: 'سعر الصرف المستخدم', render: (l: any) => `${l.rate} ${preview.account.currency}/USD · ${l.rateDay || l.day}` },
        ]} />}
        <DataTable rows={preview.allocations} rowKey={(t: any) => t._id} columns={[
          { key: 'voyage', header: 'الرحلة', render: (t: any) => t.voyage },
          { key: 'cost', header: 'التكلفة الإضافية الموزعة', render: (t: any) => <Money value={t.allocated} /> },
        ]} />
        {preview.blocked && <Alert severity="error">توجد قيود/فواتير محتملة لنفس السطور. راجعها من مطابقة البنك واستبعدها من هذه التسوية قبل الاعتماد.{preview.lines.filter((l: any) => l.duplicates.length).map((l: any) => <Sub key={l._id}>{l.day} · {l.description} · {l.duplicates.map((d: any) => d.number || d.billNumber || 'قيد محتمل').join('، ')}</Sub>)}</Alert>}
        {preview.existingCosts && <FormControlLabel control={<Checkbox checked={confirmAdditional} disabled={busy} onChange={e => setConfirmAdditional(e.target.checked)} />} label="راجعت التكاليف السابقة على الرحلات؛ المبالغ المختارة إضافية وليست نفس التكلفة" />}
        <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />} label="راجعت السطور والرحلات وأعتمد هذا التوزيع التقديري" />
      </section>}
      </>}
      {tab === 'history' && <>
      {!history.length && <Alert severity="info">لا توجد تسويات سابقة. افتح «تسوية جديدة» لبدء العمل.</Alert>}
      {!!history.length && <><h3>التسويات السابقة</h3><DataTable rows={history} rowKey={(b: any) => b._id} columns={[
        { key: 'date', header: 'التاريخ', render: (b: any) => String(b.createdAt).slice(0, 10) },
        { key: 'account', header: 'الحساب / المورد', render: (b: any) => <>{b.preview?.account?.name}<Sub>{b.preview?.vendor?.name}</Sub></> },
        { key: 'mode', header: 'النوع', render: (b: any) => b.mode === 'air' ? 'جوي' : 'بحري' },
        { key: 'total', header: 'التكلفة', render: (b: any) => <Money value={(b.preview?.shippingTotal || 0) + (b.preview?.serviceTotal || 0)} /> },
        { key: 'status', header: 'الحالة', render: (b: any) => <Badge>{b.status === 'posted' ? 'معتمدة' : 'ملغاة'}</Badge> },
        { key: 'details', header: '', render: (b: any) => <Button disabled={busy} onClick={() => setSaved(b)}>تفاصيل التوزيع</Button> },
        { key: 'cancel', header: '', render: (b: any) => b.status === 'posted' && access.can('cancel') && access.can('treasury') ? <Button disabled={busy} onClick={() => { setCancelFor(b); setReason(''); }}>إلغاء التسوية كاملة</Button> : null },
      ]} /></>}
      {saved && <>
        <Alert severity="info" className="mt-3">تفاصيل محفوظة وقت اعتماد التسوية {String(saved.createdAt).slice(0, 10)}؛ الإيرادات والتكاليف التالية تخص وقت المعاينة.
          <Sub>إيراد الرحلات: <Money value={saved.preview?.totalRevenue} /> · تكلفة سابقة: <Money value={saved.preview?.totalExistingCost} /> · شحن مضاف: <Money value={saved.preview?.shippingTotal} /> · خدمات: <Money value={saved.preview?.serviceTotal} /> · الناتج التقديري: <Money value={saved.preview?.estimatedNet} /></Sub>
        </Alert>
        <DataTable rows={saved.preview?.allocations || []} rowKey={(t: any) => t._id} columns={[
          { key: 'voyage', header: 'الرحلة', render: (t: any) => t.voyage },
          { key: 'allocated', header: 'التكلفة الموزعة', render: (t: any) => <Money value={t.allocated} /> },
        ]} />
        <DataTable rows={saved.preview?.lines || []} rowKey={(l: any) => l._id} columns={[
          { key: 'day', header: 'تاريخ السطر', render: (l: any) => l.day },
          { key: 'description', header: 'البيان', render: (l: any) => l.description },
          { key: 'amount', header: 'التكلفة', render: (l: any) => formatMinor(-l.amount, saved.preview?.account?.currency || 'USD', saved.preview?.account?.decimals ?? 2) },
        ]} />
        <Button onClick={() => setSaved(null)}>إخفاء التفاصيل</Button>
      </>}
      <Dialog open={!!cancelFor} onClose={() => !busy && setCancelFor(null)} maxWidth="sm" fullWidth dir="rtl" className="acc-root">
        <DialogTitle>إلغاء التسوية كاملة</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" className="mb-3">{error}</Alert>}
          <Alert severity="warning">ستُعكس فواتير هذه التسوية ودفعاتها، وتعود سطور الكشف للمراجعة.</Alert>
          <TextField className="mt-3" autoFocus multiline minRows={2} label="سبب الإلغاء" fullWidth value={reason} disabled={busy} onChange={e => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setCancelFor(null)}>تراجع</Button><Button variant="contained" color="error" disabled={busy || !reason.trim()} onClick={cancel}>تأكيد إلغاء التسوية</Button></DialogActions>
      </Dialog>
      </>}
    </DialogContent>
    <DialogActions className="acc-settlement-footer">
      <span>{busy ? 'جارٍ تنفيذ الإجراء…' : tab === 'work' ? `الخطوة ${step + 1} من ${steps.length}${data ? ` · ${lineIds.length} تكلفة جديدة · ${tripIds.length} رحلة` : ''}` : 'سجل التسويات المعتمدة والملغاة'}</span>
      <div>
        <Button disabled={busy} onClick={onClose}>إغلاق</Button>
        {tab === 'work' && step > 0 && <Button disabled={busy} startIcon={<ChevronRight size={16} />} onClick={() => setStep(step - 1)}>السابق</Button>}
        {tab === 'work' && step === 0 && <Button variant="contained" disabled={busy || !params.accountId || !params.vendorId || !params.countries || dateInvalid} onClick={load}>عرض سطور الكشف <ChevronLeft size={16} /></Button>}
        {tab === 'work' && step === 1 && picks.length > 0 && <Button variant="contained" disabled={busy || !access.can('treasury') || (!!matchPreview && (!matchConfirmed || (matchPreview.needsConfirmation && !conflictsConfirmed)))} onClick={matchPreview ? approveMatches : previewMatches}>{matchPreview ? 'اعتماد المطابقات الموجودة' : `معاينة المطابقات (${picks.length})`}</Button>}
        {tab === 'work' && step === 1 && !picks.length && <Button variant="contained" disabled={busy || !lineIds.length} onClick={() => setStep(2)}>التالي: اختيار الرحلات <ChevronLeft size={16} /></Button>}
        {tab === 'work' && step === 2 && <Button variant="contained" disabled={busy || !lineIds.length || (needsTrips && (!tripIds.length || (params.method === 'weight' && data?.trips.some((trip: any) => tripIds.includes(trip._id) && !(trip.weight > 0)))))} onClick={view}>معاينة التوزيع <ChevronLeft size={16} /></Button>}
        {tab === 'work' && step === 3 && <Button variant="contained" disabled={busy || !access.can('treasury') || !preview || preview.blocked || !confirmed || (preview.existingCosts && !confirmAdditional)} onClick={apply}>اعتماد التسوية</Button>}
      </div>
    </DialogActions>
  </Dialog>;
}
