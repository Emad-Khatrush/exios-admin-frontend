import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Tab, Tabs, TextField, Tooltip,
} from '@mui/material';
import { Archive, ArchiveRestore, RotateCw, Trash2 } from 'lucide-react';
import moment from 'moment';
import { acc, errorText, OFFICE_LABELS } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { AccountRef, Badge, DataTable, Ltr, PageHeader, Panel, Stat, StatGrid, StatusBadge } from './ui';

type Message = { type: 'error' | 'success'; text: string } | null;

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const JOURNAL_TYPES: Record<string, string> = {
  cash: 'خزينة', bank: 'بنك', ewallet: 'محفظة إلكترونية', sales: 'مبيعات', purchases: 'مشتريات', wallet: 'محافظ العملاء',
  general: 'قيود عامة', fx: 'فروقات عملة', depreciation: 'إهلاك وأقساط', migration: 'ترحيل تاريخي',
};
const EVENT_TYPES: Record<string, string> = {
  statement: 'حركة محفظة', statementUpdated: 'تعديل حركة محفظة', statementDeleted: 'حذف حركة محفظة', cashPayment: 'دفع نقدي على طلب',
  cashPaymentDeleted: 'حذف دفعة نقدية', order: 'تغيّر في طلب', trip: 'تغيّر في رحلة', balance: 'دين جديد', balanceWriteOff: 'شطب دين', balanceDeleted: 'حذف دين',
};

const AccountingSettings = () => {
  const [params] = useSearchParams();
  const { accounts, offices, currencies, reload } = useAccountingData();
  const [tab, setTab] = useState(params.get('tab') || 'general');
  const [data, setData] = useState<any>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [general, setGeneral] = useState<any>({});
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});
  const [officeDialog, setOfficeDialog] = useState<any>(null);
  const [currencyDialog, setCurrencyDialog] = useState<any>(null);
  const [journalDialog, setJournalDialog] = useState<any>(null);

  const load = async () => {
    try {
      const [settingsRes, journalsRes] = await Promise.all([acc.get('settings'), acc.get('journals')]);
      setData(settingsRes.data);
      setGeneral(settingsRes.data.settings || {});
      setJournals(journalsRes.data.results);
      setRoleChanges({});
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (action: () => Promise<any>, success: string) => {
    try {
      await action();
      setMessage({ type: 'success', text: success });
      await Promise.all([load(), reload()]);
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
      return false;
    }
  };

  const detailAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.isActive), [accounts]);
  const cashAccounts = useMemo(() => detailAccounts.filter((a) => a.isCash), [detailAccounts]);

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="كل ما يُضاف أو يُعدَّل هنا يسري على القيود الجديدة فقط، ويُسجَّل في سجل التدقيق." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" className="mb-3">
          <Tab value="general" label="عام" />
          <Tab value="live" label="الترحيل من المنظومة" />
          <Tab value="roles" label="أدوار الحسابات" />
          <Tab value="cash" label="خزائن المكاتب" />
          <Tab value="offices" label="المكاتب" />
          <Tab value="currencies" label="العملات" />
          <Tab value="journals" label="الدفاتر" />
          <Tab value="expenseTypes" label="أنواع المصروفات" />
        </Tabs>

        {!data && <div className="acc-empty">جارٍ التحميل…</div>}

        {data && tab === 'general' && (
          <div style={{ maxWidth: 520 }}>
            <TextField type="date" label="الدفاتر مقفلة حتى (شاملاً)" InputLabelProps={{ shrink: true }} fullWidth value={general.lockDate || ''}
              onChange={(e) => setGeneral({ ...general, lockDate: e.target.value || null })}
              helperText="لا يُرحَّل شيء في هذا اليوم أو قبله. العمليات التلقائية المؤرخة قبله تُرحَّل بأول يوم مفتوح." />
            <TextField select label="بداية السنة المالية" fullWidth className="mt-3" value={general.fiscalYearStartMonth || 1} onChange={(e) => setGeneral({ ...general, fiscalYearStartMonth: Number(e.target.value) })}>
              {MONTHS.map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
            </TextField>
            <TextField select label="توزيع تكلفة الرحلة على الطرود حسب" fullWidth className="mt-3" value={general.tripCostAllocationBase || 'charge'} onChange={(e) => setGeneral({ ...general, tripCostAllocationBase: e.target.value })}>
              <MenuItem value="charge">أجرة الشحن (الوزن × سعر إكسيوس)</MenuItem>
              <MenuItem value="weight">الوزن</MenuItem>
            </TextField>
            <div className="d-flex gap-2 mt-3">
              <Button variant="contained" onClick={() => run(() => acc.patch('settings', {
                lockDate: general.lockDate || null, fiscalYearStartMonth: general.fiscalYearStartMonth, tripCostAllocationBase: general.tripCostAllocationBase,
              }), 'تم حفظ الإعدادات.')}>حفظ</Button>
              <Button variant="outlined" onClick={() => run(() => acc.post('setup/run'), 'تم فحص الإعداد وإضافة الناقص.')}>إعادة تشغيل الإعداد</Button>
            </div>
            <p className="acc-muted small mt-3">المنطقة الزمنية: ليبيا · إعادة تشغيل الإعداد تضيف الناقص فقط ولا تغيّر ما عدّلته.</p>
          </div>
        )}

        {data && tab === 'live' && <LivePosting />}

        {data && tab === 'roles' && (
          <>
            <p className="acc-muted">القيود التلقائية لا تستخدم أرقام الحسابات مباشرة؛ كل منها يستخدم دوراً، والدور مربوط بحساب. تغيير الحساب يسري على القيود الجديدة فقط.</p>
            <DataTable
              rows={data.roles}
              rowKey={(row: any) => row.role}
              columns={[
                { key: 'role', header: 'الدور', render: (row: any) => <><div>{row.label}</div><div className="acc-sub"><Ltr>{row.role}</Ltr></div></> },
                {
                  key: 'account', header: 'الحساب', width: '45%', render: (row: any) => (
                    <Autocomplete size="small" options={detailAccounts}
                      value={detailAccounts.find((a) => a._id === (roleChanges[row.role] ?? row.account?._id)) || null}
                      getOptionLabel={(option: any) => accountLabel(option)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                      onChange={(_, value: any) => setRoleChanges({ ...roleChanges, [row.role]: value?._id || '' })}
                      renderInput={(p) => <TextField {...p} />} />
                  ),
                },
                { key: 'problem', header: '', render: (row: any) => (row.problem ? <Badge tone="danger">{row.problem}</Badge> : <Badge tone="ok">سليم</Badge>) },
              ]}
            />
            <Button variant="contained" className="mt-3" disabled={!Object.keys(roleChanges).length} onClick={() => run(() => acc.put('settings/roles', { roles: roleChanges }), 'تم حفظ الأدوار.')}>حفظ الأدوار</Button>
          </>
        )}

        {data && tab === 'cash' && (
          <>
            <p className="acc-muted">الخزينة أو البنك المستخدم لكل مكتب وعملة عند دخول المال أو خروجه (الإيداعات والسحب والدفع النقدي).</p>
            <DataTable
              rows={data.officeAccounts}
              rowKey={(row: any) => `${row.office}-${row.currency}`}
              columns={[
                { key: 'office', header: 'المكتب', render: (row: any) => <>{OFFICE_LABELS[row.office] || row.office}{row.alias && <div className="acc-sub">حساب تابع لمكتب {OFFICE_LABELS[row.alias] || row.alias}</div>}</> },
                { key: 'currency', header: 'العملة', render: (row: any) => <Ltr>{row.currency}</Ltr> },
                {
                  key: 'account', header: 'الخزينة', width: '50%', render: (row: any) => (
                    <TextField select fullWidth value={row.account?._id || ''}
                      onChange={(e) => run(() => acc.put('settings/office-accounts', { officeAccounts: { [row.office]: { [row.currency]: e.target.value } } }), 'تم تحديث الخزينة.')}>
                      {cashAccounts.filter((a) => a.currency === row.currency).map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
                    </TextField>
                  ),
                },
              ]}
            />
          </>
        )}

        {data && tab === 'offices' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <p className="acc-muted m-0">إضافة مكتب تنشئ خزينة ودفتراً لكل عملة تختارها.</p>
              <Button variant="contained" onClick={() => setOfficeDialog({ code: '', name: '', nameEn: '', country: 'LY', currencies: ['USD', 'LYD'] })}>مكتب جديد</Button>
            </div>
            <DataTable
              rows={offices}
              rowKey={(row: any) => row.code}
              rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
              columns={[
                { key: 'name', header: 'المكتب', render: (row: any) => <>{row.name}{!row.isActive && <> <Badge tone="muted">مؤرشف</Badge></>}<div className="acc-sub"><Ltr>{row.code}</Ltr>{row.nameEn ? ` · ${row.nameEn}` : ''}</div></> },
                { key: 'cash', header: 'الخزائن', render: (row: any) => (row.cashAccounts.length ? row.cashAccounts.map((a: any) => <div key={a._id}><AccountRef code={a.code} name={a.currency} /></div>) : <span className="acc-muted">-</span>) },
                {
                  key: 'actions', header: '', align: 'end', render: (row: any) => (
                    <>
                      {row.isActive
                        ? <Tooltip title="أرشفة (يجب أن تكون خزائنه صفراً)"><IconButton size="small" onClick={() => run(() => acc.post(`offices/${row.code}/archive`), 'تمت أرشفة المكتب.')}><Archive size={15} /></IconButton></Tooltip>
                        : <Tooltip title="إلغاء الأرشفة"><IconButton size="small" onClick={() => run(() => acc.post(`offices/${row.code}/unarchive`), 'أُعيد المكتب.')}><ArchiveRestore size={15} /></IconButton></Tooltip>}
                      <Tooltip title="حذف (فقط إن لم يُستخدم)"><IconButton size="small" onClick={() => window.confirm(`حذف المكتب ${row.name}؟`) && run(() => acc.delete(`offices/${row.code}`), 'تم حذف المكتب.')}><Trash2 size={15} /></IconButton></Tooltip>
                    </>
                  ),
                },
              ]}
            />
          </>
        )}

        {data && tab === 'currencies' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <p className="acc-muted m-0">العملة الجديدة تظهر فوراً في الأسعار اليومية وعند إنشاء الحسابات.</p>
              <Button variant="contained" onClick={() => setCurrencyDialog({ code: '', name: '', decimals: 2, symbol: '' })}>عملة جديدة</Button>
            </div>
            <DataTable
              rows={currencies}
              rowKey={(row: any) => row.code}
              rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
              columns={[
                { key: 'code', header: 'الرمز', render: (row: any) => <><Ltr>{row.code}</Ltr> {row.isBase && <Badge tone="accent">أساسية</Badge>}</> },
                { key: 'name', header: 'الاسم', render: (row: any) => row.name },
                { key: 'decimals', header: 'الخانات العشرية', numeric: true, render: (row: any) => <span className="money">{row.decimals}</span> },
                {
                  key: 'actions', header: '', align: 'end', render: (row: any) => (!row.isBase && (
                    <>
                      {row.isActive
                        ? <IconButton size="small" aria-label="أرشفة" onClick={() => run(() => acc.post(`currencies/${row.code}/archive`), 'تمت أرشفة العملة.')}><Archive size={15} /></IconButton>
                        : <IconButton size="small" aria-label="إلغاء الأرشفة" onClick={() => run(() => acc.post(`currencies/${row.code}/unarchive`), 'أُعيدت العملة.')}><ArchiveRestore size={15} /></IconButton>}
                      <IconButton size="small" aria-label="حذف" onClick={() => window.confirm(`حذف ${row.code}؟`) && run(() => acc.delete(`currencies/${row.code}`), 'تم حذف العملة.')}><Trash2 size={15} /></IconButton>
                    </>
                  )),
                },
              ]}
            />
          </>
        )}

        {data && tab === 'journals' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <p className="acc-muted m-0">لكل دفتر ترقيمه الخاص (مثل <Ltr>CASH-TRP-USD/2026/000001</Ltr>). لا يتغير الترقيم بعد أول قيد.</p>
              <Button variant="contained" onClick={() => setJournalDialog({ code: '', name: '', type: 'general', sequencePrefix: '' })}>دفتر جديد</Button>
            </div>
            <DataTable
              rows={journals}
              rowKey={(row: any) => row._id}
              rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
              columns={[
                { key: 'name', header: 'الدفتر', render: (row: any) => <>{row.name}<div className="acc-sub"><Ltr>{row.code}</Ltr></div></> },
                { key: 'type', header: 'النوع', render: (row: any) => <Badge tone="muted">{JOURNAL_TYPES[row.type] || row.type}</Badge> },
                { key: 'account', header: 'الحساب', hideOnMobile: true, render: (row: any) => (row.defaultAccountId ? <AccountRef code={row.defaultAccountId.code} name={row.defaultAccountId.name} /> : null) },
                {
                  key: 'actions', header: '', align: 'end', render: (row: any) => (
                    <>
                      {row.isActive
                        ? <IconButton size="small" aria-label="أرشفة" onClick={() => run(() => acc.post(`journals/${row._id}/archive`), 'تمت أرشفة الدفتر.')}><Archive size={15} /></IconButton>
                        : <IconButton size="small" aria-label="إلغاء الأرشفة" onClick={() => run(() => acc.post(`journals/${row._id}/unarchive`), 'أُعيد الدفتر.')}><ArchiveRestore size={15} /></IconButton>}
                      <IconButton size="small" aria-label="حذف" onClick={() => window.confirm(`حذف الدفتر ${row.name}؟`) && run(() => acc.delete(`journals/${row._id}`), 'تم حذف الدفتر.')}><Trash2 size={15} /></IconButton>
                    </>
                  ),
                },
              ]}
            />
          </>
        )}

        {data && tab === 'expenseTypes' && <ExpenseTypes accounts={detailAccounts} offices={offices} />}
      </Panel>

      <Dialog open={!!officeDialog} onClose={() => setOfficeDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>مكتب جديد</DialogTitle>
        {officeDialog && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الرمز (بالإنجليزية بدون مسافات)" value={officeDialog.code} onChange={(e) => setOfficeDialog({ ...officeDialog, code: e.target.value })} />
            <TextField fullWidth className="mt-3" label="الاسم" value={officeDialog.name} onChange={(e) => setOfficeDialog({ ...officeDialog, name: e.target.value })} />
            <TextField fullWidth className="mt-3" label="الاسم بالإنجليزية" value={officeDialog.nameEn} onChange={(e) => setOfficeDialog({ ...officeDialog, nameEn: e.target.value })} />
            <TextField fullWidth className="mt-3" label="رمز الدولة" value={officeDialog.country} onChange={(e) => setOfficeDialog({ ...officeDialog, country: e.target.value })} />
            <div className="mt-3 acc-muted">إنشاء خزينة بعملة:</div>
            {currencies.filter((c) => c.isActive).map((c) => (
              <FormControlLabel key={c.code} label={`${c.code} · ${c.name}`} control={<Checkbox checked={officeDialog.currencies.includes(c.code)}
                onChange={(e) => setOfficeDialog({ ...officeDialog, currencies: e.target.checked ? [...officeDialog.currencies, c.code] : officeDialog.currencies.filter((x: string) => x !== c.code) })} />} />
            ))}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setOfficeDialog(null)}>إلغاء</Button>
          <Button variant="contained" onClick={async () => { if (await run(() => acc.post('offices', officeDialog), 'أُضيف المكتب مع خزائنه.')) setOfficeDialog(null); }}>إضافة</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!currencyDialog} onClose={() => setCurrencyDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>عملة جديدة</DialogTitle>
        {currencyDialog && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الرمز (مثل AED)" value={currencyDialog.code} onChange={(e) => setCurrencyDialog({ ...currencyDialog, code: e.target.value.toUpperCase() })} />
            <TextField fullWidth className="mt-3" label="الاسم" value={currencyDialog.name} onChange={(e) => setCurrencyDialog({ ...currencyDialog, name: e.target.value })} />
            <TextField fullWidth className="mt-3" type="number" label="الخانات العشرية" value={currencyDialog.decimals} onChange={(e) => setCurrencyDialog({ ...currencyDialog, decimals: Number(e.target.value) })} />
            <TextField fullWidth className="mt-3" label="الرمز المختصر" value={currencyDialog.symbol} onChange={(e) => setCurrencyDialog({ ...currencyDialog, symbol: e.target.value })} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setCurrencyDialog(null)}>إلغاء</Button>
          <Button variant="contained" onClick={async () => { if (await run(() => acc.post('currencies', currencyDialog), 'أُضيفت العملة.')) setCurrencyDialog(null); }}>إضافة</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!journalDialog} onClose={() => setJournalDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>دفتر جديد</DialogTitle>
        {journalDialog && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الرمز (بالإنجليزية)" value={journalDialog.code} onChange={(e) => setJournalDialog({ ...journalDialog, code: e.target.value.toUpperCase() })} />
            <TextField fullWidth className="mt-3" label="الاسم" value={journalDialog.name} onChange={(e) => setJournalDialog({ ...journalDialog, name: e.target.value })} />
            <TextField select fullWidth className="mt-3" label="النوع" value={journalDialog.type} onChange={(e) => setJournalDialog({ ...journalDialog, type: e.target.value })}>
              {Object.entries(JOURNAL_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField fullWidth className="mt-3" label="بادئة الترقيم (افتراضياً الرمز)" value={journalDialog.sequencePrefix} onChange={(e) => setJournalDialog({ ...journalDialog, sequencePrefix: e.target.value })} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setJournalDialog(null)}>إلغاء</Button>
          <Button variant="contained" onClick={async () => { if (await run(() => acc.post('journals', journalDialog), 'أُضيف الدفتر.')) setJournalDialog(null); }}>إضافة</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Operations from the rest of the system waiting to be posted, with their errors
const LivePosting = () => {
  const [status, setStatus] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('failed');
  const [message, setMessage] = useState<Message>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      const [statusRes, eventsRes] = await Promise.all([acc.get('live'), acc.get('live/events', { status: filter || undefined })]);
      setStatus(statusRes.data);
      setEvents(eventsRes.data.results);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  const act = async (action: () => Promise<any>, text: string) => {
    try { await action(); setMessage({ type: 'success', text }); await load(); } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
  };

  return (
    <>
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <p className="acc-muted">
        العمليات من باقي المنظومة (الإيداعات، الطلبات، التسليم، الديون، الرحلات) تُسجَّل في قائمة انتظار وتُرحَّل تلقائياً بالترتيب.
        إن تعذّر ترحيل عملية (مثلاً سعر ناقص) تبقى هنا مع السبب حتى تُصلَح ويُعاد ترحيلها، ولا تتعطل العملية في المنظومة.
      </p>
      <StatGrid>
        <Stat label="الحالة" value={status?.liveEnabled ? 'مفعّل' : 'متوقف'} hint={status?.liveEnabled ? undefined : 'يُفعَّل عند اعتماد الترحيل التاريخي'} tone={status?.liveEnabled ? 'accent' : 'warn'} />
        <Stat label="بالانتظار" value={status?.counts?.pending || 0} />
        <Stat label="فشل" value={status?.counts?.failed || 0} tone={status?.counts?.failed ? 'danger' : undefined} />
        <Stat label="تم" value={status?.counts?.done || 0} />
      </StatGrid>
      <div className="d-flex gap-2 mb-2 flex-wrap">
        <TextField select label="عرض" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 150 }}>
          <MenuItem value="">الكل</MenuItem>
          <MenuItem value="failed">فشل</MenuItem>
          <MenuItem value="pending">بالانتظار</MenuItem>
          <MenuItem value="done">تم</MenuItem>
        </TextField>
        <Button variant="outlined" startIcon={<RotateCw size={15} />} onClick={() => act(() => acc.post('live/process'), 'تمت معالجة القائمة.')}>معالجة الآن</Button>
      </div>
      <DataTable
        loading={isLoading}
        rows={events}
        rowKey={(row: any) => row._id}
        empty={{ title: filter === 'failed' ? 'لا توجد عمليات فاشلة' : 'القائمة فارغة' }}
        columns={[
          { key: 'at', header: 'الوقت', render: (row: any) => <Ltr>{moment(row.createdAt).format('YYYY-MM-DD HH:mm')}</Ltr> },
          { key: 'type', header: 'العملية', render: (row: any) => <>{EVENT_TYPES[row.type] || row.type}<div className="acc-sub">{row.userId ? `${row.userId.firstName} ${row.userId.lastName}` : ''}</div></> },
          { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status} /> },
          { key: 'error', header: 'السبب', render: (row: any) => <span className="acc-muted">{row.lastError || (row.result?.skipped ? row.result.skipped : '')}</span> },
          { key: 'retry', header: '', align: 'end', render: (row: any) => (row.status === 'failed' ? <Button size="small" onClick={() => act(() => acc.post(`live/events/${row._id}/retry`), 'أُعيدت المحاولة.')}>إعادة المحاولة</Button> : null) },
        ]}
      />
    </>
  );
};

// The list offered in the quick expense screen; each type posts to its expense account
const ExpenseTypes = ({ accounts, offices }: { accounts: any[]; offices: any[] }) => {
  const [types, setTypes] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState<Message>(null);
  const expenseAccounts = accounts.filter((a) => a.type === 'expense');

  const load = () => acc.get('expense-types').then((res: any) => setTypes(res.data.results)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (body: any, id?: string) => {
    try {
      if (id) await acc.patch(`expense-types/${id}`, body); else await acc.post('expense-types', body);
      setForm(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  return (
    <>
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <p className="acc-muted m-0">قائمة المصروفات في شاشة المصروف السريع. كل نوع يُرحَّل على حسابه.</p>
        <Button variant="contained" onClick={() => setForm({ name: '', nameEn: '', accountId: '', defaultOffice: '' })}>نوع جديد</Button>
      </div>
      <DataTable
        rows={types}
        rowKey={(row: any) => row._id}
        rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
        columns={[
          { key: 'name', header: 'النوع', render: (row: any) => <>{row.name}{row.nameEn && <div className="acc-sub">{row.nameEn}</div>}</> },
          { key: 'account', header: 'الحساب', render: (row: any) => <AccountRef code={row.accountId?.code} name={row.accountId?.name} /> },
          { key: 'office', header: 'المكتب الافتراضي', hideOnMobile: true, render: (row: any) => OFFICE_LABELS[row.defaultOffice] || row.defaultOffice || '-' },
          {
            key: 'actions', header: '', align: 'end', render: (row: any) => (
              <>
                <Button size="small" onClick={() => setForm({ ...row, accountId: row.accountId?._id })}>تعديل</Button>
                <Button size="small" onClick={() => save({ isActive: !row.isActive }, row._id)}>{row.isActive ? 'أرشفة' : 'إعادة'}</Button>
              </>
            ),
          },
        ]}
      />
      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{form?._id ? 'تعديل نوع المصروف' : 'نوع مصروف جديد'}</DialogTitle>
        {form && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField fullWidth className="mt-3" label="الاسم بالإنجليزية" value={form.nameEn || ''} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            <Autocomplete size="small" className="mt-3" options={expenseAccounts} value={expenseAccounts.find((a) => a._id === form.accountId) || null}
              getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, a: any) => setForm({ ...form, accountId: a?._id || '' })} renderInput={(p) => <TextField {...p} label="حساب المصروف" />} />
            <TextField select fullWidth className="mt-3" label="المكتب الافتراضي" value={form.defaultOffice || ''} onChange={(e) => setForm({ ...form, defaultOffice: e.target.value })}>
              <MenuItem value="">-</MenuItem>
              {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
            </TextField>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!form?.name || !form?.accountId} onClick={() => save({ name: form.name, nameEn: form.nameEn, accountId: form.accountId, defaultOffice: form.defaultOffice || null }, form._id)}>حفظ</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AccountingSettings;
