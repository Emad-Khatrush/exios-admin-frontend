import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { Archive, ArchiveRestore, HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';
import { EVENT_LABELS, acc, errorText } from './accountingApi';
import { useAccountingData } from './useAccountingData';
import { RemotePicker, VENDOR_TYPES, userLabel } from './shared';
import { useBulk } from './bulk';
import { Amount, Badge, DataTable, FilterBar, Ltr, Money, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

export const VendorsList = () => {
  const navigate = useNavigate();
  const { currencies } = useAccountingData();
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      setVendors((await acc.get('vendors', { search: search || undefined })).data.results);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const run = async (action: () => Promise<any>, text: string) => {
    try { await action(); setMessage({ type: 'success', text }); await load(); return true; } catch (err) { setMessage({ type: 'error', text: errorText(err) }); return false; }
  };

  const save = async () => {
    const body = { ...form, linkedCustomer: form.linkedCustomer?._id || '' };
    if (await run(() => (form._id ? acc.patch(`vendors/${form._id}`, body) : acc.post('vendors', body)), 'تم حفظ المورد.')) setForm(null);
  };

  const bulk = useBulk<any>({
    rows: vendors, rowKey: (row) => row._id, rowLabel: (row) => row.name, onDone: load,
    actions: [
      {
        key: 'archive', label: 'أرشفة', done: 'أُرشف', applies: (row) => row.isActive,
        run: (row) => acc.post(`vendors/${row._id}/archive`),
        confirm: (count) => `سيُؤرشف ${count} مورداً. المورد الذي له مستحقات يُرفض ويبقى كما هو.`,
      },
      {
        key: 'unarchive', label: 'إلغاء الأرشفة', done: 'أُعيد', applies: (row) => !row.isActive,
        run: (row) => acc.post(`vendors/${row._id}/unarchive`),
        confirm: (count) => `سيعود ${count} مورداً إلى شاشات الإدخال.`,
      },
      {
        key: 'delete', label: 'حذف', done: 'حُذف', danger: true, applies: (row) => !row.seedKey,
        run: (row) => acc.delete(`vendors/${row._id}`),
        confirm: (count) => `سيُحذف ${count} مورداً نهائياً. المورد الذي له فواتير أو دفعات يُرفض ويبقى كما هو.`,
      },
    ],
  });

  const totalOwed = vendors.reduce((sum, v) => sum + (v.owed || 0), 0);

  return (
    <>
      <PageHeader
        title="الموردون"
        subtitle="شركات الشحن والموردون ومقدمو الخدمات، مع ما تدين به الشركة لكل منهم."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setForm({ name: '', type: 'supplier', phone: '', country: '', defaultCurrency: 'USD', note: '', linkedCustomer: null })}>مورد جديد</Button>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField placeholder="ابحث بالاسم" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <Button variant="outlined" onClick={load}>بحث</Button>
          </FilterBar>
        </div>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={vendors}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => navigate(`/accounting/vendors/${row._id}`)}
          rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
          empty={{ title: 'لا يوجد موردون', hint: 'أضف مورداً، أو أضفه مباشرة من داخل الفاتورة.' }}
          columns={[
            {
              key: 'name', header: 'المورد', sortValue: (row: any) => row.name, render: (row: any) => (
                <>
                  {row.name}
                  <Sub>
                    {VENDOR_TYPES[row.type]}
                    {row.seedKey && <> · <Badge tone="muted">من النظام</Badge></>}
                    {row.linkedCustomer && <> · <Badge tone="info">عميل أيضاً {row.linkedCustomer.customerId}</Badge></>}
                    {!row.isActive && <> · <Badge tone="muted">مؤرشف</Badge></>}
                  </Sub>
                </>
              ),
            },
            { key: 'currency', header: 'العملة المعتادة', hideOnMobile: true, render: (row: any) => <Ltr>{row.defaultCurrency}</Ltr> },
            { key: 'owed', header: 'مستحق له', numeric: true, sortValue: (row: any) => row.owed || 0, render: (row: any) => <Money value={row.owed} strong={row.owed > 0} /> },
            {
              key: 'actions', header: '', align: 'end', render: (row: any) => (
                <span onClick={(e) => e.stopPropagation()}>
                  {row.owed > 0 && <Tooltip title="دفع للمورد"><IconButton size="small" color="primary" onClick={() => navigate(`/accounting/payments/new?vendorId=${row._id}`)}><HandCoins size={15} /></IconButton></Tooltip>}
                  <Tooltip title="تعديل"><IconButton size="small" onClick={() => setForm({ ...row })}><Pencil size={15} /></IconButton></Tooltip>
                  {row.isActive
                    ? <Tooltip title="أرشفة (لا مستحقات)"><IconButton size="small" onClick={() => run(() => acc.post(`vendors/${row._id}/archive`), 'تمت أرشفة المورد.')}><Archive size={15} /></IconButton></Tooltip>
                    : <Tooltip title="إلغاء الأرشفة"><IconButton size="small" onClick={() => run(() => acc.post(`vendors/${row._id}/unarchive`), 'أُعيد المورد.')}><ArchiveRestore size={15} /></IconButton></Tooltip>}
                  {!row.seedKey && <Tooltip title="حذف (فقط إن لم يُستخدم)"><IconButton size="small" onClick={() => window.confirm(`حذف ${row.name}؟`) && run(() => acc.delete(`vendors/${row._id}`), 'تم حذف المورد.')}><Trash2 size={15} /></IconButton></Tooltip>}
                </span>
              ),
            },
          ]}
          footer={vendors.length ? { name: 'إجمالي المستحق للموردين', owed: <Money value={totalOwed} strong /> } : undefined}
        />
      </Panel>

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{form?._id ? 'تعديل مورد' : 'مورد جديد'}</DialogTitle>
        {form && (
          <DialogContent>
            <TextField fullWidth className="mt-2" label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField select fullWidth className="mt-3" label="النوع" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(VENDOR_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField select fullWidth className="mt-3" label="العملة المعتادة" value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}>
              {currencies.filter((c) => c.isActive).map((c) => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}
            </TextField>
            <TextField fullWidth className="mt-3" label="الهاتف" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField fullWidth className="mt-3" label="الدولة" value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <div className="mt-3">
              <RemotePicker endpoint="lookup/users" label="عميل أيضاً (للمقاصة)" value={form.linkedCustomer} getLabel={userLabel} onChange={(linkedCustomer) => setForm({ ...form, linkedCustomer })} />
            </div>
            <TextField fullWidth className="mt-3" label="ملاحظة" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>إلغاء</Button>
          <Button variant="contained" disabled={!form?.name} onClick={save}>حفظ</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export const VendorStatement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    acc.get(`vendors/${id}/statement`).then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  }, [id]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <PageHeader
        title={data?.vendor.name || 'كشف حساب مورد'}
        subtitle={data ? `${VENDOR_TYPES[data.vendor.type]} · كشف ما تدين به الشركة لهذا المورد` : undefined}
        actions={data && <>
          <Button variant="outlined" onClick={() => navigate('/accounting/bills/new')}>فاتورة جديدة</Button>
          <Button variant="contained" onClick={() => navigate(`/accounting/payments/new?vendorId=${data.vendor._id}`)}>دفع</Button>
        </>}
      />
      {data && (
        <StatGrid>
          <Stat label="مستحق للمورد" value={<Money value={data.owed} />} tone={data.owed > 0 ? 'warn' : 'accent'} />
          <Stat label="فواتير مفتوحة" value={data.openBills.length} />
          <Stat label="دفعة مقدمة لدى المورد" value={<Money value={data.advance} />} />
        </StatGrid>
      )}
      {data?.openBills.length > 0 && (
        <Panel flush title="الفواتير المفتوحة">
          <DataTable
            rows={data.openBills}
            rowKey={(row: any) => row._id}
            onRowClick={(row: any) => navigate(`/accounting/bills/${row._id}`)}
            columns={[
              { key: 'number', header: 'الفاتورة', render: (row: any) => <><Ltr>{row.number}</Ltr>{row.vendorRef && <Sub>رقم المورد <Ltr>{row.vendorRef}</Ltr></Sub>}</> },
              { key: 'day', header: 'التاريخ', render: (row: any) => <Ltr>{row.day}</Ltr> },
              { key: 'total', header: 'الإجمالي', numeric: true, render: (row: any) => <Amount value={row.total} currency={row.currency} /> },
              { key: 'open', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.open} strong /> },
            ]}
          />
        </Panel>
      )}
      <Panel flush title="الحركات">
        <DataTable
          loading={!data}
          rows={data?.movements || []}
          rowKey={(row: any, index: number) => `${row._id}-${index}`}
          onRowClick={(row: any) => navigate(`/accounting/entries/${row._id}`)}
          empty={{ title: 'لا توجد حركات بعد' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            { key: 'description', header: 'البيان', render: (row: any) => <><div>{row.line.label || row.description}</div><Sub><Ltr>{row.number}</Ltr> · {EVENT_LABELS[row.eventType] || row.eventType}</Sub></> },
            { key: 'billed', header: 'مطالبات', numeric: true, render: (row: any) => <Money value={row.line.credit} hideZero /> },
            { key: 'paid', header: 'مدفوعات', numeric: true, render: (row: any) => <Money value={row.line.debit} hideZero /> },
            { key: 'owed', header: 'الرصيد المستحق', numeric: true, render: (row: any) => <Money value={row.owed} strong /> },
          ]}
        />
      </Panel>
    </>
  );
};
