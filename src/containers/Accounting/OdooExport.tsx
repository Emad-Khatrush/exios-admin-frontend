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
  'العمود id هو المعرّف الخارجي: استيراد نفس الملف مرتين يحدّث القيود ولا يكررها.',
  'العملاء يُربطون برقمهم (partner_id/id)، فاستورد العملاء قبل القيود من شاشة التصدير القديمة.',
  'بعد الاستيراد رحّل القيود (Post) من أودو. إن رفض أودو الملف، ألغِ الدفعة هنا ثم صحّح الربط وصدّر من جديد.',
];

// Phase 7 (spec 13): the ledger's entries exported to Odoo in batches. Each batch takes every
// entry not exported yet up to a day; a batch can be downloaded again or undone.
const OdooExport = () => {
  const [data, setData] = useState<any>(null);
  const [upTo, setUpTo] = useState(todayLibya());
  const [settings, setSettings] = useState({ companyCurrency: 'USD', defaultJournal: '' });
  const [accountCodes, setAccountCodes] = useState<Mapping>({});
  const [journalNames, setJournalNames] = useState<Mapping>({});
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<any>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [undoing, setUndoing] = useState<any>(null);

  const load = async (day = upTo) => {
    try {
      const res = await acc.get('odoo', { upTo: day });
      setData(res.data);
      setSettings(res.data.settings);
      setAccountCodes(Object.fromEntries(res.data.accounts.map((a: any) => [a._id, a.odooCode || ''])));
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

  const changedAccounts = (data?.accounts || []).filter((a: any) => (a.odooCode || '') !== (accountCodes[a._id] || '').trim());
  const changedJournals = (data?.journals || []).filter((j: any) => (j.odooJournal || '') !== (journalNames[j._id] || '').trim());
  const settingsChanged = data && (data.settings.companyCurrency !== settings.companyCurrency || data.settings.defaultJournal !== settings.defaultJournal);

  const saveMapping = () => run(async () => {
    await acc.put('odoo/mapping', {
      accounts: changedAccounts.map((a: any) => ({ _id: a._id, odooCode: accountCodes[a._id] || '' })),
      journals: changedJournals.map((j: any) => ({ _id: j._id, odooJournal: journalNames[j._id] || '' })),
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
        subtitle="القيود المحاسبية بصيغة استيراد القيود في أودو. كل تصدير دفعة مرقّمة تأخذ ما لم يُصدَّر من قبل، فلا يتكرر قيد ولا يُنسى."
      />
      <Notice message={message} onClose={() => setMessage(null)} />

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
          <Button variant="contained" onClick={exportNow} disabled={isBusy || !pending?.count || blocked}>
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
          <TextField label="اليومية الافتراضية في أودو" value={settings.defaultJournal} onChange={(e) => setSettings({ ...settings, defaultJournal: e.target.value })} helperText="تُستخدم لكل دفتر ليس له يومية مربوطة أدناه" />
        </div>
        <div className="d-flex justify-content-end mt-3">
          <Button variant="outlined" onClick={saveSettings} disabled={isBusy || !settingsChanged}>حفظ الإعدادات</Button>
        </div>
      </Panel>

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
          ]}
        />
      </Panel>

      <div className="acc-savebar">
        <span className="acc-sub">{changedAccounts.length + changedJournals.length ? `${changedAccounts.length + changedJournals.length} تعديل لم يُحفظ` : 'لا تعديلات على الربط'}</span>
        <Button variant="contained" onClick={saveMapping} disabled={isBusy || !(changedAccounts.length + changedJournals.length)}>حفظ الربط</Button>
      </div>

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

      <Dialog open={!!undoing} onClose={() => setUndoing(null)} fullWidth maxWidth="xs">
        <DialogTitle>إلغاء الدفعة {undoing?.number}؟</DialogTitle>
        <DialogContent>
          <DialogContentText>
            تعود قيودها ({undoing?.count}) إلى «لم تُصدَّر» وتدخل في التصدير القادم بنفس معرّفاتها، فإن كان أودو قد استوردها يحدّثها ولا يكررها.
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

export default OdooExport;
