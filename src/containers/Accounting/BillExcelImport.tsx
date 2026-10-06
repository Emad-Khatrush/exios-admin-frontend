import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';
import { Download, Upload } from 'lucide-react';
import { acc, errorText, todayLibya } from './accountingApi';

const FIELDS: Record<string, string> = {
  reference: 'معرّف الفاتورة/المصروف', vendorRef: 'رقم فاتورة المورد', vendor: 'المورد', day: 'التاريخ', currency: 'العملة', amount: 'المبلغ', description: 'الوصف',
  target: 'التصنيف', account: 'كود حساب التكلفة', office: 'المكتب', paymentAccount: 'كود حساب الدفع', rate: 'سعر الصرف', expenseType: 'نوع المصروف',
  order: 'رقم الطلبية', trip: 'رقم الرحلة', package: 'معرّف الطرد', assetName: 'اسم الأصل', months: 'عدد الأشهر', salvageValue: 'قيمة الخردة بالدولار', startMonth: 'شهر بداية التوزيع', note: 'ملاحظات',
};
const TARGETS: Record<string, string> = { expense: 'مصروف', order: 'تكلفة طلب', trip: 'تكلفة رحلة', asset: 'أصل', prepaid: 'مصروف مقدم', customs: 'تخليص طرد' };
const labels: Record<string, string> = { ready: 'جاهزة للمراجعة', error: 'تحتاج تصحيحًا', duplicate: 'مستوردة سابقًا', saved: 'تم الحفظ' };
const colors: Record<string, 'success' | 'error' | 'warning' | 'default'> = { ready: 'success', error: 'error', duplicate: 'warning', saved: 'success' };

export default function BillExcelImport({ kind, onDone }: { kind: 'bills' | 'expenses'; onDone: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filename, setFilename] = useState('');
  const [mode, setMode] = useState('draft');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState<any[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [refs, setRefs] = useState<any>(null);
  const title = kind === 'expenses' ? 'استيراد المصروفات من Excel' : 'استيراد فواتير الموردين من Excel';
  const fieldKeys = Object.keys(FIELDS).filter(key => kind !== 'expenses' || !['vendor', 'target', 'order', 'trip', 'package', 'assetName', 'months', 'salvageValue', 'startMonth'].includes(key));

  const getRefs = async () => {
    const value = (await acc.get('bills/import/references')).data;
    setRefs(value);
    return value;
  };
  const downloadTemplate = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      const data = await getRefs();
      const XLSX = await import('xlsx');
      const book = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([fieldKeys.map(key => FIELDS[key])]);
      sheet['!cols'] = fieldKeys.map(() => ({ wch: 25 }));
      // The data sheet is empty so the example can never become a real expense accidentally.
      XLSX.utils.book_append_sheet(book, sheet, 'البيانات');
      const notes = [
        ['الحقل / الإجراء', 'كيفية الاستعمال'],
        ['معرّف الفاتورة/المصروف', 'مطلوب. معرّف ثابت وفريد مثل EXP-2026-0001. كرره لسطور نفس الفاتورة فقط. لا تغيّره عند إعادة رفع الملف.'],
        ['التاريخ', 'مطلوب: YYYY-MM-DD مثل 2026-09-01. يقبل أيضًا خلية تاريخ Excel.'],
        ['المبلغ', 'مبلغ موجب بعملة الفاتورة. اكتب الكسور بالنقطة؛ بدون فواصل الآلاف في الخلايا النصية.'],
        ['سعر الصرف', 'عدد وحدات العملة مقابل 1 USD، مثل 50 TRY لكل دولار. للدولار: 1 أو فارغ. الفارغ يستخدم قواعد النظام ويظهر في المراجعة.'],
        ['المورد', 'لفواتير الموردين: الاسم كما يظهر بورقة الموردين. لن ينشئ موردًا مجهولًا تلقائيًا.'],
        ['التصنيف', 'مصروف / تكلفة طلب / تكلفة رحلة / أصل / مصروف مقدم / تخليص طرد.'],
        ['المكتب وحساب التكلفة', 'للمصروفات والأصول والمصروفات المقدمة. استخدم كود الحساب، وكود المكتب أو اسمه.'],
        ['نوع المصروف', 'مطلوب للمصروفات السريعة؛ يحدد حساب المصروف والمكتب الافتراضي إن وجد.'],
        ['كود حساب الدفع', 'مطلوب للمصروفات السريعة. في فواتير الموردين: اتركه فارغًا للآجلة، أو اختر حسابًا بنفس عملة الفاتورة للسداد الكامل.'],
        ['رقم الطلبية / الرحلة', 'لتحميل التكلفة على الطلب أو الرحلة. اختر الرقم من الأوراق المرجعية، وليس على مصروف عام.'],
        ['أصل / مصروف مقدم', 'حدد عدد أشهر موجبًا وصحيحًا. قيمة خردة الأصل بالدولار. شهر بداية التوزيع: YYYY-MM.'],
        ['تخليص طرد', 'رقم الطلبية ومعرّف الطرد الموجود داخلها مطلوبان.'],
        ['فاتورة متعددة السطور', 'كرر نفس المعرّف والمورد والتاريخ والعملة والسعر وحساب الدفع والملاحظات. لا تكرر السطر نفسه مرتين.'],
        ['المراجعة', 'رفع الملف والمعاينة لا ينشئان أي سجلات. اختر الفواتير ثم وافق على حفظ مسودات أو على الترحيل المحاسبي.'],
        ['التكرار', 'المعرّف نفسه لا ينشئ تكلفة ثانية. عند تغيير محتواه راجع الفاتورة السابقة بدل إنشاء عملية أخرى.'],
        ['حد الملف', '500 سطر، وحجم 10 MB كحد أقصى. لا تغيّر عناوين الأعمدة.'],
      ];
      const instructions = XLSX.utils.aoa_to_sheet(notes); instructions['!cols'] = [{ wch: 32 }, { wch: 110 }];
      XLSX.utils.book_append_sheet(book, instructions, 'التعليمات');
      const example: any = { reference: 'EXAMPLE-0001', vendor: data.vendors[0]?.name || '', day: todayLibya(), currency: 'USD', amount: 100, description: 'مثال للتوضيح فقط — لا تنقله دون تعديل', target: 'مصروف', expenseType: data.expenseTypes[0]?.name || '', account: data.expenseTypes[0]?.account || '', office: data.expenseTypes[0]?.office || data.offices[0]?.code || '' };
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([fieldKeys.map(key => FIELDS[key]), fieldKeys.map(key => example[key] ?? '')]), 'مثال فقط');
      const sheets: [string, any[]][] = [
        ['الموردون', data.vendors.map((v: any) => ({ 'المورد': v.name, 'العملة الافتراضية': v.currency }))],
        ['الحسابات', data.accounts.map((a: any) => ({ 'كود الحساب': a.code, 'اسم الحساب': a.name, 'العملة': a.currency || 'USD', 'النوع': a.type, 'حساب دفع': a.isCash && !a.requires?.includes('employee') ? 'نعم' : 'لا' }))],
        ['المكاتب', data.offices.map((o: any) => ({ 'الكود': o.code, 'المكتب': o.name }))],
        ['العملات', data.currencies.map((c: any) => ({ 'العملة': c.code, 'الاسم': c.name }))],
        ['أنواع المصروفات', data.expenseTypes.map((t: any) => ({ 'نوع المصروف': t.name, 'كود الحساب': t.account, 'المكتب الافتراضي': t.office }))],
        ['الطلبيات', data.orders.map((o: any) => ({ 'رقم الطلبية': o.number, 'المكتب': o.office }))],
        ['الرحلات', data.trips.map((t: any) => ({ 'رقم الرحلة': t.number, 'المكتب': t.office }))],
      ];
      sheets.forEach(([name, values]) => XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(values), name));
      XLSX.writeFile(book, kind === 'expenses' ? 'Exios-Expenses-Template.xlsx' : 'Exios-Supplier-Bills-Template.xlsx');
    } catch (error) { setMessage(errorText(error, 'تعذر تحميل القالب.')); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const readFile = async (file?: File) => {
    if (!file || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage(''); setPreview(null); setSelected([]); setRows([]); setFilename(''); setProgress({ done: 0, total: 0 });
    try {
      if (!/\.xlsx?$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('اختر ملف Excel بحجم لا يتجاوز 10 MB.');
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheet = book.Sheets['البيانات'];
      if (!sheet) throw new Error('لم أجد ورقة «البيانات». استخدم القالب المتاح هنا.');
      const cells = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });
      const headers = (cells[0] || []).map(value => String(value).trim());
      const keys = headers.map(header => Object.keys(FIELDS).find(key => FIELDS[key] === header || key === header));
      if (headers.some((header, index) => header && !keys[index])) throw new Error('الملف يحتوي عنوان عمود غير معروف؛ استخدم عناوين القالب دون تغيير.');
      if (new Set(keys.filter(Boolean)).size !== keys.filter(Boolean).length) throw new Error('يوجد عنوان عمود مكرر.');
      const required = ['reference', 'day', 'currency', 'amount', ...(kind === 'expenses' ? ['expenseType', 'paymentAccount'] : ['vendor', 'target'])];
      if (required.some(key => !keys.includes(key))) throw new Error('بعض الأعمدة المطلوبة ناقصة؛ استخدم القالب.');
      const data = cells.slice(1).map((values, index) => {
        const row: any = { rowNumber: index + 2 };
        keys.forEach((key, column) => {
          if (!key) return;
          let value = values[column];
          if (key === 'day' && typeof value === 'number') {
            const date = XLSX.SSF.parse_date_code(value, { date1904: book.Workbook?.WBProps?.date1904 });
            value = date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : '';
          }
          row[key] = value ?? '';
        });
        return row;
      }).filter(row => Object.keys(FIELDS).some(key => String(row[key] ?? '').trim()));
      if (!data.length || data.length > 500) throw new Error('يجب أن تحتوي ورقة البيانات من 1 إلى 500 سطر.');
      setRows(data); setFilename(file.name);
      const result = (await acc.post('bills/import/preview', { kind, rows: data })).data;
      setPreview(result); setSelected([]);
    } catch (error: any) { setMessage(error?.response ? errorText(error) : error.message); }
    finally { busyRef.current = false; setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const review = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try { setPreview((await acc.post('bills/import/preview', { kind, rows })).data); setSelected([]); }
    catch (error) { setMessage(errorText(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const approve = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setConfirm(false); setMessage('');
    const chosen = preview.groups.filter((group: any) => group.status === 'ready' && selected.includes(group.reference));
    setProgress({ done: 0, total: chosen.length });
    let successes = 0;
    const updated = [...preview.groups];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const group = chosen[i];
        try {
          const saved = (await acc.post('bills/import/commit', { kind, mode, rows: group.sourceRows, previewHash: group.previewHash })).data;
          updated[updated.findIndex(g => g.reference === group.reference)] = { ...group, status: 'saved', savedId: saved._id, savedLabel: saved.duplicate ? 'موجودة سابقًا؛ لم تتكرر' : saved.status === 'draft' ? 'حُفظت مسودة' : 'رُحّلت مع قيودها وسدادها إن وجد' };
          successes++;
        } catch (error) { updated[updated.findIndex(g => g.reference === group.reference)] = { ...group, saveError: errorText(error) }; }
        setPreview({ ...preview, groups: [...updated] }); setProgress({ done: i + 1, total: chosen.length });
      }
      setSelected(updated.filter(g => g.status === 'ready' && g.saveError).map(g => g.reference));
      setMessage(`اكتمل حفظ ${successes} من ${chosen.length}. ${successes < chosen.length ? 'راجع الأخطاء بجانب العمليات المتبقية؛ يمكنك إعادة المحاولة دون تكرار العمليات الناجحة.' : ''}`);
      if (successes) onDone();
    } finally { busyRef.current = false; setBusy(false); }
  };
  const groups = preview?.groups || [];
  const ready = groups.filter((group: any) => group.status === 'ready');
  const shown = groups.filter((group: any) => filter === 'all' || group.status === filter);
  const picked = ready.filter((group: any) => selected.includes(group.reference));
  const totals = picked.reduce((result: Record<string, number>, group: any) => {
    const currency = group.currency; result[currency] = (result[currency] || 0) + group.total; return result;
  }, {});
  return <>
    <Button variant="outlined" startIcon={<Upload size={16} />} onClick={() => { setOpen(true); if (!refs) getRefs().catch(() => {}); }}>استيراد Excel</Button>
    <Dialog open={open} fullWidth maxWidth="xl" onClose={() => { if (!busy) setOpen(false); }} PaperProps={{ dir: 'rtl' }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Alert severity="info">ارفع الملف، راجع كل فاتورة وحساب دفعها، ثم وافق على المختار فقط. المعاينة لا تحفظ بيانات ولا تُنشئ قيودًا.</Alert>
        <div className="d-flex flex-wrap align-items-center gap-2 my-3">
          <Button disabled={busy} startIcon={<Download size={16} />} onClick={downloadTemplate}>تحميل القالب</Button>
          <Button variant="outlined" disabled={busy} onClick={() => fileInput.current?.click()}>رفع ملف Excel</Button>
          <input hidden ref={fileInput} type="file" accept=".xlsx,.xls" onChange={event => readFile(event.target.files?.[0])} />
          {filename && <span>{filename} · {rows.length} سطر</span>}
          {!!rows.length && <Button disabled={busy} onClick={review}>إعادة فحص البيانات</Button>}
        </div>
        {busy && <LinearProgress variant={progress.total ? 'determinate' : 'indeterminate'} value={progress.total ? progress.done / progress.total * 100 : undefined} />}
        {!!progress.total && <p>حُفظ / عولج {progress.done} من {progress.total}</p>}
        {message && <Alert severity={message.startsWith('اكتمل') ? 'info' : 'error'} className="my-2">{message}</Alert>}
        {preview && <>
          <div className="d-flex flex-wrap align-items-center gap-2 my-3">
            <Chip label={`${ready.length} جاهزة`} color="success" /><Chip label={`${groups.filter((g: any) => g.status === 'error').length} تحتاج تصحيحًا`} color="error" /><Chip label={`${groups.filter((g: any) => g.status === 'duplicate').length} مستوردة سابقًا`} color="warning" />
            <TextField select size="small" label="عرض" value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: 180 }}><MenuItem value="all">الكل</MenuItem>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            <Button disabled={busy || !ready.length} onClick={() => setSelected(ready.map((g: any) => g.reference))}>اختيار كل الصالح</Button>
          </div>
          <div style={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>اختيار</TableCell><TableCell>المعرّف / التاريخ</TableCell><TableCell>المورد / الوصف</TableCell><TableCell>التكلفة والربط</TableCell><TableCell>المبلغ والسعر</TableCell><TableCell>الدفع</TableCell><TableCell>نتيجة المراجعة</TableCell></TableRow></TableHead><TableBody>
            {shown.map((group: any, index: number) => <TableRow key={group.reference || index}>
              <TableCell><Checkbox disabled={busy || group.status !== 'ready'} checked={selected.includes(group.reference)} onChange={e => setSelected(e.target.checked ? [...selected, group.reference] : selected.filter(value => value !== group.reference))} /></TableCell>
              <TableCell><strong>{group.reference || 'معرّف ناقص'}</strong><div dir="ltr">{group.sourceRows[0].day}</div><small>سطور {group.sourceRows.map((row: any) => row.rowNumber).join('، ')}</small></TableCell>
              <TableCell>{group.vendorName || group.sourceRows[0].vendor || 'مصروفات نقدية'}{group.sourceRows.map((row: any) => <div key={row.rowNumber}><small>{row.description || row.expenseType}</small></div>)}</TableCell>
              <TableCell>{(group.details.length ? group.details : group.sourceRows).map((row: any) => <div key={row.rowNumber}>{TARGETS[row.target] || row.target || 'مصروف'}<small style={{ display: 'block' }}>{[row.order, row.trip, row.account, row.office, row.expenseType].filter(Boolean).join(' · ')}</small></div>)}</TableCell>
              <TableCell><div dir="ltr">{group.total?.toLocaleString('en-US', { maximumFractionDigits: 3 }) || group.sourceRows[0].amount} {group.currency || group.sourceRows[0].currency}</div>{group.rate && <small dir="ltr">1 USD = {group.rate} {group.currency}</small>}{group.valuationSource === 'carrying' && <div><small>متوسط تكلفة رصيد الحساب</small></div>}</TableCell>
              <TableCell>{group.paymentLabel || group.sourceRows[0].paymentAccount || 'آجلة'}</TableCell>
              <TableCell><Chip size="small" label={group.savedLabel || labels[group.status]} color={colors[group.status] || 'default'} />{[...(group.errors || []), ...(group.warnings || []), group.saveError].filter(Boolean).map((error, i) => <div key={i} style={{ color: group.errors?.length || group.saveError ? '#b42318' : '#885400', maxWidth: 350 }}>{error}</div>)}{group.existingId || group.savedId ? <Button href={`/accounting/bills/${group.existingId || group.savedId}`} target="_blank">فتح الفاتورة</Button> : <Button disabled={busy} onClick={() => setEdit(group.sourceRows.map((row: any) => ({ ...row })))}>تعديل البيانات</Button>}</TableCell>
            </TableRow>)}
          </TableBody></Table></div>
          <div className="d-flex flex-wrap align-items-center gap-3 my-3">
            <TextField select label="بعد الموافقة" size="small" disabled={busy} value={mode} onChange={e => setMode(e.target.value)} style={{ minWidth: 220 }}><MenuItem value="draft">حفظ كمسودات للمراجعة</MenuItem><MenuItem value="post">ترحيل الفواتير والعمليات</MenuItem></TextField>
            <span>{picked.length} مختارة · {Object.entries(totals).map(([currency, total]) => `${Number(total).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${currency}`).join(' + ')}</span>
            <Button variant="contained" disabled={busy || !picked.length} onClick={() => setConfirm(true)}>موافقة على المختار</Button>
          </div>
        </>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>إغلاق</Button></DialogActions>
    </Dialog>
    <Dialog open={confirm} onClose={() => setConfirm(false)} PaperProps={{ dir: 'rtl' }}><DialogTitle>تأكيد الموافقة</DialogTitle><DialogContent><Alert severity={mode === 'post' ? 'warning' : 'info'}>{mode === 'post' ? `سيتم ترحيل ${picked.length} فاتورة وإنشاء قيود التكلفة والسداد الكامل من الحساب المختار إن وجد. الفواتير الآجلة تسجل التزامًا على المورد.` : `سيتم حفظ ${picked.length} مسودة فقط؛ لن تتغير أرصدة الحسابات حتى تُرحّلها.`}</Alert></DialogContent><DialogActions><Button onClick={() => setConfirm(false)}>رجوع للمراجعة</Button><Button variant="contained" onClick={approve} disabled={busy}>تأكيد {mode === 'post' ? 'الترحيل' : 'حفظ المسودات'}</Button></DialogActions></Dialog>
    <Dialog open={!!edit} fullWidth maxWidth="lg" onClose={() => setEdit(null)} PaperProps={{ dir: 'rtl' }}><DialogTitle>تعديل بيانات الاستيراد</DialogTitle><DialogContent>{edit?.map((row, index) => <div key={row.rowNumber} className="mb-4"><h4>سطر {row.rowNumber}</h4><div className="acc-form-grid">{fieldKeys.map(key => <TextField key={key} size="small" label={FIELDS[key]} value={row[key] ?? ''} onChange={e => setEdit(previous => previous!.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))} />)}</div></div>)}</DialogContent><DialogActions><Button onClick={() => setEdit(null)}>إلغاء</Button><Button variant="contained" onClick={() => { setRows(previous => previous.map(row => edit!.find(updated => updated.rowNumber === row.rowNumber) || row)); setEdit(null); setPreview(null); setSelected([]); setMessage('تم تعديل البيانات. اضغط «إعادة فحص البيانات» لمراجعتها قبل الموافقة.'); }}>حفظ التعديل وإعادة المراجعة</Button></DialogActions></Dialog>
  </>;
}
