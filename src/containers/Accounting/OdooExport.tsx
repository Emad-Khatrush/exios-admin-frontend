import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, TextField } from '@mui/material';
import * as XLSX from 'xlsx';
import moment from 'moment';
import { acc, errorText, todayLibya } from './accountingApi';
import { AccountRef, Badge, DataTable, Ltr, Money, Notice, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

type Mapping = Record<string, string>;

// Odoo's journal-entry import, as one sheet: the first row of an entry carries its header
const downloadRows = (rows: any[], name: string) => {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Journal Entries');
  XLSX.writeFile(book, `${name.replace(/[^\w-]+/g, '_')}.xlsx`);
};

const GUIDE = [
  'في أودو: المحاسبة ← المحاسبة ← القيود اليومية ← استيراد (Journal Entries).',
  'ارفع الملف وتأكد من تفعيل «استخدم الصف الأول كترويسة»، واضغط «اختبار» أولاً.',
  'إذا استخدمت ملفات التجهيز: استورد ورقة Groups ثم Accounts ثم Journals قبل القيود، داخل الشركة نفسها.',
  'احتفظ بعمودي id وline_ids/id واربطهما بالمعرّف الخارجي للقيد ولكل عنصر يومية؛ كلاهما مطلوب لمنع إضافة سطور عند إعادة الاستيراد.',
  'العملاء يُربطون برقمهم (partner_id/id)، فاستورد العملاء قبل القيود من شاشة التصدير القديمة.',
  'بعد الاستيراد رحّل القيود (Post) من أودو. إن رفض أودو الملف، ألغِ الدفعة هنا ثم صحّح الربط وصدّر من جديد.',
];

// Phase 7 (spec 13): the ledger's entries exported to Odoo in batches. Each batch takes every
// entry not exported yet up to a day; a batch can be downloaded again or undone.
const OdooExport = () => {
  const [data, setData] = useState<any>(null);
  const [upTo, setUpTo] = useState(todayLibya());
  const [settings, setSettings] = useState({ companyCurrency: 'USD', defaultJournal: '', referenceMode: 'mapping', targetVersion: '19' });
  const [accountCodes, setAccountCodes] = useState<Mapping>({});
  const [externalIds, setExternalIds] = useState<Mapping>({});
  const [journalExternalIds, setJournalExternalIds] = useState<Mapping>({});
  const [journalNames, setJournalNames] = useState<Mapping>({});
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<any>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activateMaster, setActivateMaster] = useState(false);
  const [masterDownloaded, setMasterDownloaded] = useState(false);
  const [undoing, setUndoing] = useState<any>(null);

  const load = async (day = upTo) => {
    try {
      const res = await acc.get('odoo', { upTo: day });
      setData(res.data);
      setSettings({ referenceMode: 'mapping', targetVersion: '19', ...res.data.settings });
      setAccountCodes(Object.fromEntries(res.data.accounts.map((a: any) => [a._id, a.odooCode || ''])));
      setExternalIds(Object.fromEntries(res.data.accounts.map((a: any) => [a._id, a.odooExternalId || ''])));
      setJournalExternalIds(Object.fromEntries(res.data.journals.map((j: any) => [j._id, j.odooExternalId || ''])));
      setJournalNames(Object.fromEntries(res.data.journals.map((j: any) => [j._id, j.odooJournal || ''])));
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const run = async (action: () => Promise<string | void>) => {
    setIsBusy(true);
    setMessage(null);
    try {
      const text = await action();
      if (text) setMessage({ type: 'success', text });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsBusy(false);
  };

  // Accounts the next export uses and that have no Odoo code yet come first
  const missingIds = useMemo(() => new Set((data?.pending?.unmapped || []).map((a: any) => a._id)), [data]);
  const accounts = useMemo(() => {
    const term = search.trim();
    return (data?.accounts || [])
      .filter((a: any) => (!onlyMissing || missingIds.has(a._id) || !accountCodes[a._id]))
      .filter((a: any) => !term || a.code.includes(term) || a.name.includes(term) || (accountCodes[a._id] || '').includes(term))
      .sort((a: any, b: any) => Number(missingIds.has(b._id)) - Number(missingIds.has(a._id)) || a.code.localeCompare(b.code));
  }, [data, onlyMissing, search, accountCodes, missingIds]);

  const changedAccounts = (data?.accounts || []).filter((a: any) => (a.odooCode || '') !== (accountCodes[a._id] || '').trim() || (a.odooExternalId || '') !== (externalIds[a._id] || '').trim());
  const changedJournals = (data?.journals || []).filter((j: any) => (j.odooJournal || '') !== (journalNames[j._id] || '').trim() || (j.odooExternalId || '') !== (journalExternalIds[j._id] || '').trim());
  const settingsChanged = data && (data.settings.companyCurrency !== settings.companyCurrency || data.settings.defaultJournal !== settings.defaultJournal || (data.settings.targetVersion || '19') !== settings.targetVersion || (data.settings.referenceMode || 'mapping') !== settings.referenceMode);

  const saveMapping = () => run(async () => {
    await acc.put('odoo/mapping', {
      accounts: changedAccounts.map((a: any) => ({ _id: a._id, odooCode: accountCodes[a._id] || '', odooExternalId: externalIds[a._id] || '' })),
      journals: changedJournals.map((j: any) => ({ _id: j._id, odooJournal: journalNames[j._id] || '', odooExternalId: journalExternalIds[j._id] || '' })),
    });
    await load();
    return 'حُفظ الربط مع أودو.';
  });

  const saveSettings = () => run(async () => {
    await acc.put('odoo/settings', settings);
    await load();
    return 'حُفظت إعدادات أودو.';
  });

  // Codes the same as ours, for a chart that was copied into Odoo as it is
  const fillSameCodes = () => setAccountCodes((current) => Object.fromEntries((data?.accounts || []).map((a: any) => [a._id, current[a._id] || a.code])));

  const importAccountMapping = async (file: File) => {
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      if (!book.Sheets.Mapping && !book.Sheets.JournalMapping) throw new Error('اختر ملف الربط المراجع الذي يحتوي ورقة Mapping أو JournalMapping.');
      const rows = book.Sheets.Mapping ? XLSX.utils.sheet_to_json<any>(book.Sheets.Mapping, { defval: '' }) : [];
      const next = { ...externalIds }; const used = new Set<string>();
      for (const row of rows) {
        const account = data.accounts.find((a: any) => a._id === String(row.exios_account_id));
        if (!account || account.code !== String(row.exios_code)) throw new Error('حساب الملف لا يطابق المنظومة الحالية: ' + row.exios_code);
        const id = String(row.odoo_external_id || '').trim();
        if (!id || !/^[A-Za-z0-9_.-]{1,200}$/.test(id) || used.has(id)) throw new Error('معرّف مكرر أو غير صالح في الملف');
        used.add(id); next[account._id] = id;
      }
      const journalRows = book.Sheets.JournalMapping ? XLSX.utils.sheet_to_json<any>(book.Sheets.JournalMapping, { defval: '' }) : [];
      const nextJournals = { ...journalExternalIds }; const journalUsed = new Set<string>();
      for (const row of journalRows) {
        const journal = data.journals.find((j: any) => j._id === String(row.exios_journal_id));
        if (!journal) throw new Error('دفتر الملف غير موجود في المنظومة: ' + row.exios_name);
        const id = String(row.odoo_external_id || '').trim();
        if (!id || !/^[A-Za-z0-9_.-]{1,200}$/.test(id) || journalUsed.has(id) || used.has(id)) throw new Error('معرّف دفتر مكرر أو غير صالح');
        journalUsed.add(id); nextJournals[journal._id] = id;
      }
      // Validate the complete proposed mapping before changing either editor state.
      const allRefs = [...data.accounts.map((a: any) => next[a._id] || 'exios_account_' + a._id), ...data.journals.map((j: any) => nextJournals[j._id] || 'exios_journal_' + j._id)];
      if (new Set(allRefs).size !== allRefs.length) throw new Error('يوجد ربط مكرر مع الإعدادات الحالية');
      setExternalIds(next);
      setJournalExternalIds(nextJournals);
      setOnlyMissing(false);
      setMessage({ type: 'info', text: 'تمت قراءة ' + rows.length + ' حسابًا و' + journalRows.length + ' دفترًا للمراجعة فقط. افتح جدول الربط اليدوي وراجع المعرّفات ثم اضغط حفظ الربط بعد نجاح استيراد الحسابات في أودو.' });
    } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
  };

  const downloadMaster = () => run(async () => {
    if (settingsChanged || changedAccounts.length || changedJournals.length) throw new Error('احفظ إعدادات أودو والربط المراجع أولًا.');
    const res = await acc.get('odoo/master-data');
    const book = XLSX.utils.book_new();
    const info = [
      { Step: 1, Instructions: 'اختر الشركة الصحيحة وفعّل العملات. استورد Groups من مجموعات الحسابات.' },
      { Step: 2, Instructions: 'استورد Accounts من شجرة الحسابات. الأنواع هي القيم التقنية لأودو.' },
      { Step: 3, Instructions: 'استورد Journals من دفاتر اليومية. اختر الورقة المطلوبة من ملف Excel.' },
      { Step: 4, Instructions: 'اضغط اختبار في أودو قبل كل استيراد. ثم فعّل الربط التلقائي في إكسيوس.' },
      ...res.data.warnings.map((Instructions: string) => ({ Step: '', Instructions })),
      { Step: '', Instructions: 'الحسابات غير النشطة مدرجة لتغطية قيودها القديمة؛ راجع أرشفتها بعد الاستيراد.' },
      { Step: '', Instructions: 'اليوميات الدائنة وجاري الشركاء تستخدم يومية عامة في الإصدارات السابقة لـ19. رموز الدفاتر مختصرة إلى 5 أحرف.' },
    ];
    for (const [name, rows] of [['Instructions', info], ['Groups', res.data.groups], ['Accounts', res.data.accounts], ['Journals', res.data.journals]] as [string, any[]][]) {
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
    }
    XLSX.writeFile(book, 'Exios_Odoo_Setup_' + res.data.targetVersion + '.xlsx');
    setMasterDownloaded(true);
    return 'تم تجهيز الملف. استورد المجموعات ثم الحسابات ثم اليوميات، وبعد نجاح الاستيراد فعّل الربط التلقائي.';
  });
  const enableMaster = () => run(async () => {
    if (changedAccounts.length || changedJournals.length || settingsChanged) throw new Error('احفظ الربط والإعدادات أولًا قبل التفعيل.');
    await acc.put('odoo/settings', { referenceMode: 'external_id' });
    setActivateMaster(false);
    await load();
    return 'تم تفعيل ربط القيود بمعرّفات الحسابات واليوميات المستوردة؛ لا تحتاج كتابة رموزها يدويًا.';
  });

  const exportNow = () => run(async () => {
    const res = await acc.post('odoo/exports', { upTo });
    downloadRows(res.data.rows, `Odoo_${res.data.export.number}_${upTo}`);
    await load();
    return `صُدّرت الدفعة ${res.data.export.number}: ${res.data.export.count} قيد. ارفع الملف في أودو.`;
  });

  const downloadAgain = (batch: any) => run(async () => {
    const res = await acc.get(`odoo/exports/${batch._id}/rows`);
    downloadRows(res.data.rows, `Odoo_${batch.number}_${batch.upTo}`);
  });

  const undo = () => run(async () => {
    const batch = undoing;
    setUndoing(null);
    await acc.post(`odoo/exports/${batch._id}/undo`);
    await load();
    return `أُلغيت الدفعة ${batch.number}. عادت قيودها إلى «لم تُصدَّر».`;
  });

  const pending = data?.pending;
  const last = (data?.exports || []).find((e: any) => !e.undoneAt);
  const blocked = !!pending?.unmapped?.length;

  return (
    <>
      <PageHeader
        title="التصدير إلى أودو"
        subtitle="القيود المحاسبية بصيغة استيراد القيود في أودو. كل تصدير دفعة مرقّمة تأخذ ما لم يُصدَّر من قبل. اربط المعرّف الخارجي للقيد ولكل سطر عند الاستيراد."
      />
      <Notice message={message} onClose={() => setMessage(null)} />

      <Panel title="تجهيز أودو بحسابات منظومتنا" subtitle="نفس أرقام الحسابات وأسمائها، مع المجموعات واليوميات. ملف واحد بثلاث أوراق للاستيراد؛ لا يتصل بأودو ولا يحذف بياناته.">
        <Notice message={{ type: 'info', text: 'استورد Groups ثم Accounts ثم Journals داخل نفس شركة أودو. اضغط اختبار قبل الاستيراد. إذا الرقم موجود مسبقًا دون معرّف إكسيوس، اربطه بالسجل الموجود أولًا؛ أرشف فقط الحسابات غير المطلوبة بعد مراجعة ارتباطاتها.' }} />
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Button variant="contained" disabled={isBusy || !data || !!settingsChanged} onClick={downloadMaster}>تحميل ملفات تجهيز أودو (Excel)</Button>
          <Button variant="outlined" component="label" disabled={isBusy || !data}>تحميل ملف ربط الحسابات واليوميات<input hidden type="file" accept=".xlsx" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) importAccountMapping(file); }} /></Button>
          <Button variant="outlined" disabled={isBusy || !data || settings.referenceMode === 'external_id'} onClick={() => setActivateMaster(true)}>استوردت الملفات — تفعيل الربط التلقائي</Button>
        </div>
        <Sub>{settings.referenceMode === 'external_id' ? 'الربط التلقائي مفعّل للحسابات واليوميات؛ جداول الربط اليدوي أدناه لا تُستخدم.' : masterDownloaded ? 'الملف جاهز؛ فعّل الربط بعد نجاح استيراده في أودو.' : 'الربط اليدوي الحالي يستمر إلى أن تؤكد نجاح الاستيراد.'}</Sub>
      </Panel>

      <StatGrid>
        <Stat label="قيود لم تُصدَّر" value={pending ? pending.count : '…'} hint={pending?.firstDay ? <Ltr>{pending.firstDay} → {pending.lastDay}</Ltr> : 'لا شيء جديد'} tone={pending?.count ? 'warn' : undefined} />
        <Stat label="مجموعها" value={<Money value={pending?.totalDebit || 0} />} hint="بالدولار" />
        <Stat label="حسابات بلا رمز أودو" value={pending ? pending.unmapped.length : '…'} hint="تمنع التصدير حتى تُربط" tone={blocked ? 'danger' : undefined} />
        <Stat label="آخر تصدير" value={last ? last.number : 'لم يتم'} hint={last ? moment(last.createdAt).format('DD/MM/YYYY HH:mm') : 'يُنصح بتصدير أسبوعي'} />
      </StatGrid>

      <Panel
        title="تصدير جديد"
        subtitle="يأخذ كل قيد لم يُصدَّر حتى التاريخ المختار. قيود الترحيل التجريبي التي لم تُعتمد لا تُصدَّر."
      >
        <div className="acc-form-grid">
          <TextField type="date" label="حتى تاريخ" InputLabelProps={{ shrink: true }} value={upTo} onChange={(e) => { setUpTo(e.target.value); load(e.target.value); }} />
        </div>
        {blocked && <Notice message={{ type: 'warning', text: `اربط ${pending.unmapped.length} حساباً برموزها في أودو من الجدول أدناه قبل التصدير.` }} />}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="contained" onClick={exportNow} disabled={isBusy || !pending?.count || blocked || !!settingsChanged || !!changedAccounts.length || !!changedJournals.length}>
            {isBusy ? 'جارٍ التحضير…' : `تصدير ${pending?.count || 0} قيد (Excel)`}
          </Button>
        </div>
        <details className="mt-3">
          <summary className="acc-link">طريقة الاستيراد في أودو</summary>
          <ol className="mt-2 mb-0">{GUIDE.map((step) => <li key={step} className="acc-sub">{step}</li>)}</ol>
        </details>
      </Panel>

      <Panel title="إعدادات أودو" subtitle="عملة الشركة في أودو تحدد عملة المدين والدائن في الملف. الدينار يُحوَّل بسعر يوم القيد، وخطوط الدينار تبقى بمبلغها الفعلي.">
        <div className="acc-form-grid">
          <TextField select label="عملة الشركة في أودو" value={settings.companyCurrency} onChange={(e) => setSettings({ ...settings, companyCurrency: e.target.value })}>
            {(data?.companyCurrencies || ['USD', 'LYD']).map((code: string) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
          </TextField>
          <TextField select label="إصدار أودو" value={settings.targetVersion} onChange={e => setSettings({ ...settings, targetVersion: e.target.value })}>
            {['17', '18', '19'].map(version => <MenuItem key={version} value={version}>{version}</MenuItem>)}
          </TextField>
          {settings.referenceMode === 'external_id' && <Button variant="text" onClick={() => setSettings({ ...settings, referenceMode: 'mapping' })}>العودة إلى الربط اليدوي</Button>}
          <TextField label="اليومية الافتراضية في أودو" value={settings.defaultJournal} onChange={(e) => setSettings({ ...settings, defaultJournal: e.target.value })} helperText="تُستخدم لكل دفتر ليس له يومية مربوطة أدناه" />
        </div>
        <div className="d-flex justify-content-end mt-3">
          <Button variant="outlined" onClick={saveSettings} disabled={isBusy || !settingsChanged}>حفظ الإعدادات</Button>
        </div>
      </Panel>

      <details open={settings.referenceMode !== 'external_id'}><summary className="acc-link mb-3">الربط اليدوي بالحسابات واليوميات الموجودة في أودو</summary>
      <Panel
        title="ربط الحسابات"
        subtitle="رمز الحساب المقابل في شجرة حسابات أودو. الحسابات التي يحتاجها التصدير القادم تظهر أولاً."
        actions={(
          <>
            <Button size="small" onClick={fillSameCodes}>نفس رموزنا للفارغ</Button>
            <Button size="small" onClick={() => setOnlyMissing(!onlyMissing)}>{onlyMissing ? 'عرض كل الحسابات' : 'الفارغة فقط'}</Button>
          </>
        )}
        flush
      >
        <div className="p-3 pb-0">
          <TextField size="small" label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <DataTable
          dense
          maxHeight={460}
          loading={!data}
          rows={accounts}
          rowKey={(row: any) => row._id}
          empty={{ title: onlyMissing ? 'كل الحسابات مربوطة' : 'لا حسابات' }}
          columns={[
            {
              key: 'account', header: 'الحساب', render: (row: any) => (
                <>
                  <AccountRef code={row.code} name={row.name} />
                  {missingIds.has(row._id) && <Sub><Badge tone="danger">يحتاجه التصدير القادم</Badge></Sub>}
                </>
              ),
            },
            {
              key: 'odoo', header: 'الرمز في أودو', width: 220, render: (row: any) => (
                <TextField
                  size="small" value={accountCodes[row._id] || ''} placeholder="مثلاً 401001" inputProps={{ dir: 'ltr' }}
                  onChange={(e) => setAccountCodes({ ...accountCodes, [row._id]: e.target.value })}
                />
              ),
            },
            { key: 'external', header: 'المعرّف الخارجي للحساب الموجود في أودو', width: 330, render: (row: any) => <TextField size="small" fullWidth value={externalIds[row._id] || ''} placeholder="فارغ = معرّف إكسيوس" inputProps={{ dir: 'ltr' }} onChange={e => setExternalIds({ ...externalIds, [row._id]: e.target.value })} /> },
          ]}
        />
      </Panel>

      <Panel title="ربط الدفاتر" subtitle="اسم اليومية في أودو كما هو حرفياً. الدفتر بلا يومية يذهب إلى اليومية الافتراضية." flush>
        <DataTable
          dense
          loading={!data}
          rows={data?.journals || []}
          rowKey={(row: any) => row._id}
          columns={[
            { key: 'journal', header: 'الدفتر', render: (row: any) => <AccountRef code={row.code} name={row.name} /> },
            {
              key: 'odoo', header: 'اليومية في أودو', width: 280, render: (row: any) => (
                <TextField
                  size="small" value={journalNames[row._id] || ''} placeholder={settings.defaultJournal}
                  onChange={(e) => setJournalNames({ ...journalNames, [row._id]: e.target.value })}
                />
              ),
            },
            { key: 'external', header: 'المعرّف الخارجي للدفتر الموجود في أودو', width: 330, render: (row: any) => <TextField size="small" fullWidth value={journalExternalIds[row._id] || ''} placeholder="فارغ = معرّف إكسيوس" inputProps={{ dir: 'ltr' }} onChange={e => setJournalExternalIds({ ...journalExternalIds, [row._id]: e.target.value })} /> },
          ]}
        />
      </Panel>

      <div className="acc-savebar">
        <span className="acc-sub">{changedAccounts.length + changedJournals.length ? `${changedAccounts.length + changedJournals.length} تعديل لم يُحفظ` : 'لا تعديلات على الربط'}</span>
        <Button variant="contained" onClick={saveMapping} disabled={isBusy || !(changedAccounts.length + changedJournals.length)}>حفظ الربط</Button>
      </div>

      </details>

      <Panel title="دفعات التصدير" subtitle="نزّل أي دفعة من جديد بنفس المعرّفات. ألغِ الدفعة فقط إن لم يقبلها أودو، فتعود قيودها للتصدير القادم." flush>
        <DataTable
          loading={!data}
          rows={data?.exports || []}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.undoneAt ? 'canceled' : undefined)}
          empty={{ title: 'لم يُصدَّر شيء بعد' }}
          columns={[
            { key: 'number', header: 'الدفعة', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.undoneAt && <Sub><Badge>ملغاة</Badge></Sub>}</> },
            { key: 'range', header: 'القيود', render: (row: any) => <><Ltr>{row.firstDay} → {row.lastDay}</Ltr><Sub>{row.count} قيد · عملة {row.companyCurrency}</Sub></> },
            { key: 'total', header: 'المجموع', numeric: true, render: (row: any) => <Money value={row.totalDebit} /> },
            { key: 'by', header: 'بواسطة', hideOnMobile: true, render: (row: any) => <>{row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : ''}<Sub>{moment(row.createdAt).format('DD/MM/YYYY HH:mm')}</Sub></> },
            {
              key: 'actions', header: '', align: 'end', render: (row: any) => (
                <div className="d-flex gap-1 justify-content-end">
                  <Button size="small" onClick={() => downloadAgain(row)} disabled={isBusy || !!row.undoneAt}>تنزيل</Button>
                  <Button size="small" color="error" onClick={() => setUndoing(row)} disabled={isBusy || !!row.undoneAt}>إلغاء</Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <Dialog open={activateMaster} onClose={() => setActivateMaster(false)} fullWidth maxWidth="sm">
        <DialogTitle>تفعيل الربط بملفات التجهيز</DialogTitle>
        <DialogContent><DialogContentText>فعّل هذا الخيار بعد استيراد الحسابات واليوميات بنجاح في أودو بنفس المعرّفات الخارجية. التفعيل يغيّر ملفات القيود الجديدة فقط؛ لا ينقل أي بيانات إلى أودو. إذا لم تستورد الملفات بعد، اضغط رجوع.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setActivateMaster(false)}>رجوع</Button><Button variant="contained" disabled={isBusy} onClick={enableMaster}>نجح الاستيراد — تفعيل</Button></DialogActions>
      </Dialog>
      <OdooComparison />

      <Dialog open={!!undoing} onClose={() => setUndoing(null)} fullWidth maxWidth="xs">
        <DialogTitle>إلغاء الدفعة {undoing?.number}؟</DialogTitle>
        <DialogContent>
          <DialogContentText>
            تعود قيودها ({undoing?.count}) إلى «لم تُصدَّر» وتدخل في التصدير القادم بنفس معرّفاتها، إذا استُوردت الدفعة سابقًا، تحقق من ربط معرّفات القيد وسطور اليومية قبل إعادة الاستيراد؛ الملفات القديمة بلا معرّفات سطور قد تكررها.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUndoing(null)}>رجوع</Button>
          <Button color="error" variant="contained" onClick={undo}>إلغاء الدفعة</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// While Odoo still runs beside Exios (a month or two, spec 19.14): every week the same three
// figures from both, side by side. Exios's are read from the books; Odoo's are typed in.
const FIGURES: [string, string][] = [['cash', 'أرصدة الخزائن والبنوك'], ['wallets', 'مجموع محافظ العملاء'], ['receivables', 'ذمم العملاء']];

const OdooComparison = () => {
  const [day, setDay] = useState(todayLibya());
  const [data, setData] = useState<any>(null);
  const [odoo, setOdoo] = useState<Record<string, string>>({ cash: '', wallets: '', receivables: '' });
  const [message, setMessage] = useState<any>(null);
  const load = (on = day) => acc.get('odoo/comparison', { day: on }).then((res: any) => setData(res.data)).catch((err: any) => setMessage({ type: 'error', text: errorText(err) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const save = async () => {
    try {
      await acc.post('odoo/comparison', { day, odoo });
      setMessage({ type: 'success', text: 'حُفظت المقارنة.' });
      setOdoo({ cash: '', wallets: '', receivables: '' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  const diff = (row: any, key: string) => (row.ours?.[key] || 0) - (row.odoo?.[key] || 0);
  return (
    <Panel flush title="المقارنة الأسبوعية مع أودو" subtitle="كل أسبوع: اكتب الأرقام الثلاثة من تقارير أودو بنفس التاريخ. أرقام إكسيوس تُقرأ من الدفاتر. الفرق يجب أن يكون صفراً أو مفهوماً قبل إيقاف أودو.">
      <div className="px-3">
        <Notice message={message} onClose={() => setMessage(null)} />
        <div className="acc-form-grid mb-3">
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={day} onChange={(e) => { setDay(e.target.value); load(e.target.value); }} />
          {FIGURES.map(([key, label]) => (
            <TextField key={key} type="number" label={`أودو: ${label} ($)`} value={odoo[key]} onChange={(e) => setOdoo({ ...odoo, [key]: e.target.value })}
              helperText={data?.ours ? <>إكسيوس: <Money value={data.ours[key]} /></> : undefined} />
          ))}
        </div>
        <div className="d-flex justify-content-end mb-3">
          <Button variant="contained" disabled={FIGURES.some(([key]) => odoo[key] === '')} onClick={save}>حفظ المقارنة</Button>
        </div>
      </div>
      <DataTable
        dense rows={data?.history || []} rowKey={(row: any) => row._id}
        empty={{ title: 'لا مقارنات بعد' }}
        columns={[
          { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
          ...FIGURES.map(([key, label]) => ({
            key, header: label, numeric: true, render: (row: any) => (
              <>
                <Money value={row.ours?.[key]} /> <Sub>أودو <Money value={row.odoo?.[key]} tone="plain" /></Sub>
                {diff(row, key) !== 0 ? <Badge tone="warn">فرق <Money value={diff(row, key)} tone="plain" /></Badge> : <Badge tone="ok">مطابق</Badge>}
              </>
            ),
          })),
        ]}
      />
    </Panel>
  );
};

export default OdooExport;
