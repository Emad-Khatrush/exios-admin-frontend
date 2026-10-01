import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, MenuItem, TextField, Tooltip,
} from '@mui/material';
import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, CURRENCY_DECIMALS, DIMENSIONS, acc, errorText } from './accountingApi';
import { AccountingAccount, toTree, useAccountingData } from './useAccountingData';
import { useBulk } from './bulk';
import { AccountRef, Badge, DataTable, FilterBar, Money, PageHeader, Panel } from './ui';

const emptyForm = {
  code: '', name: '', nameEn: '', type: 'expense', isGroup: false, parentId: '', currency: '',
  isCash: false, cashKind: 'cash', office: '', requires: [] as string[], allowManualEntry: true,
};

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const { accounts, offices, currencies, isLoading, reload } = useAccountingData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AccountingAccount | null>(null);
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const parentIds = useMemo(() => new Set(accounts.map((a) => a.parentId).filter(Boolean) as string[]), [accounts]);
  const rows = useMemo(() => {
    const tree = toTree(accounts);
    const term = search.trim().toLowerCase();
    if (term) return tree.filter(({ account }) => `${account.code} ${account.name} ${account.nameEn || ''}`.toLowerCase().includes(term));
    const hidden = new Set<string>();
    return tree.filter(({ account }) => {
      if (account.parentId && hidden.has(account.parentId)) { hidden.add(account._id); return false; }
      if (!showArchived && !account.isActive) { hidden.add(account._id); return false; }
      if (collapsed.has(account._id)) hidden.add(account._id);
      return true;
    });
  }, [accounts, collapsed, showArchived, search]);

  const groups = accounts.filter((account) => account.isGroup && account.isActive);
  const toggle = (id: string) => setCollapsed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const openCreate = (parent?: AccountingAccount) => { setEditing(null); setForm({ ...emptyForm, parentId: parent?._id || '', type: parent?.type || 'expense' }); };
  const openEdit = (account: AccountingAccount) => {
    setEditing(account);
    setForm({ ...emptyForm, ...account, parentId: account.parentId || '', currency: account.currency || '', office: account.office || '', cashKind: account.cashKind || 'cash', nameEn: account.nameEn || '' });
  };

  const save = async () => {
    try {
      setIsSaving(true);
      const body: any = {
        code: form.code.trim(), name: form.name.trim(), nameEn: form.nameEn.trim() || undefined, type: form.type,
        parentId: form.parentId || null, requires: form.requires, allowManualEntry: form.allowManualEntry,
        currency: form.currency || null, office: form.office || null,
      };
      if (!editing) {
        body.isGroup = form.isGroup;
        body.isCash = form.isCash;
        if (form.isCash) body.cashKind = form.cashKind;
        await acc.post('accounts', body);
      } else {
        await acc.patch(`accounts/${editing._id}`, body);
      }
      setForm(null);
      setMessage({ type: 'success', text: editing ? 'تم حفظ الحساب.' : 'تمت إضافة الحساب.' });
      await reload();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsSaving(false);
  };

  const act = async (account: AccountingAccount, action: 'archive' | 'unarchive' | 'delete') => {
    if (action === 'delete' && !window.confirm(`حذف الحساب ${account.code} ${account.name} نهائياً؟`)) return;
    try {
      if (action === 'delete') await acc.delete(`accounts/${account._id}`);
      else await acc.post(`accounts/${account._id}/${action}`);
      setMessage({ type: 'success', text: action === 'delete' ? 'تم حذف الحساب.' : action === 'archive' ? 'تمت أرشفة الحساب.' : 'أُعيد الحساب.' });
      await reload();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const visible = useMemo(() => rows.map((r) => r.account), [rows]);
  const bulk = useBulk<AccountingAccount>({
    rows: visible,
    rowKey: (row) => row._id,
    rowLabel: (row) => `${row.code} ${row.name}`,
    onDone: reload,
    actions: [
      {
        key: 'archive', label: 'أرشفة', done: 'أُرشف', applies: (row) => row.isActive,
        run: (row) => acc.post(`accounts/${row._id}/archive`),
        confirm: (count) => `سيُؤرشف ${count} حساباً. الحساب الذي عليه رصيد أو مربوط بدور يُرفض ويبقى كما هو.`,
      },
      {
        key: 'unarchive', label: 'إلغاء الأرشفة', done: 'أُعيد', applies: (row) => !row.isActive,
        run: (row) => acc.post(`accounts/${row._id}/unarchive`),
        confirm: (count) => `سيعود ${count} حساباً إلى شاشات الإدخال.`,
      },
      {
        key: 'delete', label: 'حذف', done: 'حُذف', danger: true, applies: () => true,
        run: (row) => acc.delete(`accounts/${row._id}`),
        confirm: (count) => `سيُحذف ${count} حساباً نهائياً. الحساب المستخدم في أي قيد أو إعداد يُرفض ويبقى كما هو.`,
      },
    ],
  });

  const decimalsOf = (code: string | null) => currencies.find((c) => c.code === code)?.decimals ?? CURRENCY_DECIMALS[code || ''] ?? 2;
  const depthOf = new Map(rows.map(({ account, depth }) => [account._id, depth]));

  return (
    <>
      <PageHeader
        title="شجرة الحسابات"
        subtitle="الأرصدة بالدولار. الحساب الذي عليه قيود يُعاد تسميته أو نقله ولا يُحذف؛ يُؤرشف بعد تصفير رصيده."
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => openCreate()}>حساب جديد</Button>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField placeholder="ابحث بالرقم أو الاسم" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FormControlLabel control={<Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />} label="إظهار المؤرشف" />
          </FilterBar>
        </div>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={visible}
          rowKey={(row) => row._id}
          indent={(row) => depthOf.get(row._id) || 0}
          rowTone={(row) => (!row.isActive ? 'muted' : row.isGroup ? 'group' : undefined)}
          columns={[
            {
              key: 'account', header: 'الحساب', render: (row) => (
                <span className="d-inline-flex align-items-center gap-1">
                  {parentIds.has(row._id) && !search ? (
                    <IconButton size="small" aria-label="طي/فتح" onClick={() => toggle(row._id)}>
                      {collapsed.has(row._id) ? <ChevronLeft size={15} /> : <ChevronDown size={15} />}
                    </IconButton>
                  ) : <span style={{ width: 30, display: 'inline-block' }} />}
                  <button type="button" className="acc-link" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => navigate(`/accounting/accounts/${row._id}`)}><AccountRef code={row.code} name={row.name} /></button>
                  {row.isCash && <Badge tone="info">{row.cashKind === 'bank' ? 'بنك' : row.cashKind === 'ewallet' ? 'محفظة' : 'خزينة'}</Badge>}
                  {!row.isActive && <Badge tone="muted">مؤرشف</Badge>}
                </span>
              ),
            },
            { key: 'type', header: 'النوع', hideOnMobile: true, render: (row) => <span className="acc-muted">{ACCOUNT_TYPE_LABEL[row.type]}{row.currency ? ` · ${row.currency}` : ''}</span> },
            { key: 'balance', header: 'الرصيد', numeric: true, render: (row) => <Money value={row.totals?.closingUsd} strong={row.isGroup} /> },
            {
              key: 'currency', header: 'بالعملة', numeric: true, hideOnMobile: true, render: (row) => (
                !row.isGroup && row.currency && row.currency !== 'USD' ? <Money value={row.totals?.foreign} currency={row.currency} decimals={decimalsOf(row.currency)} tone="plain" /> : null
              ),
            },
            {
              key: 'actions', header: '', align: 'end', width: 150, render: (row) => (
                <span className="d-inline-flex">
                  {row.isGroup && row.isActive && <Tooltip title="حساب تحت هذه المجموعة"><IconButton size="small" onClick={() => openCreate(row)}><Plus size={15} /></IconButton></Tooltip>}
                  <Tooltip title="تعديل"><IconButton size="small" onClick={() => openEdit(row)}><Pencil size={15} /></IconButton></Tooltip>
                  {row.isActive
                    ? <Tooltip title="أرشفة (يجب أن يكون الرصيد صفراً)"><IconButton size="small" onClick={() => act(row, 'archive')}><Archive size={15} /></IconButton></Tooltip>
                    : <Tooltip title="إلغاء الأرشفة"><IconButton size="small" onClick={() => act(row, 'unarchive')}><ArchiveRestore size={15} /></IconButton></Tooltip>}
                  <Tooltip title="حذف (فقط إن لم يُستخدم)"><IconButton size="small" onClick={() => act(row, 'delete')}><Trash2 size={15} /></IconButton></Tooltip>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `تعديل الحساب ${editing.code}` : 'حساب جديد'}</DialogTitle>
        {form && (
          <DialogContent>
            <div className="d-flex gap-2 mt-2">
              <TextField label="الرقم" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} style={{ width: 140 }} />
              <TextField label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            </div>
            <TextField label="الاسم بالإنجليزية" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} fullWidth className="mt-3" />
            <div className="d-flex gap-2 mt-3">
              <TextField select label="النوع" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, parentId: '' })} style={{ width: 160 }}>
                {ACCOUNT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
              <TextField select label="المجموعة" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} fullWidth>
                <MenuItem value="">(مستوى أعلى)</MenuItem>
                {groups.filter((g) => g.type === form.type && g._id !== editing?._id).map((g) => <MenuItem key={g._id} value={g._id}>{g.code} · {g.name}</MenuItem>)}
              </TextField>
            </div>
            {!editing && <FormControlLabel className="mt-2" control={<Checkbox checked={form.isGroup} onChange={(e) => setForm({ ...form, isGroup: e.target.checked, isCash: false })} />} label="مجموعة (تضم حسابات، ولا يُرحَّل عليها)" />}
            {!form.isGroup && (
              <>
                <div className="d-flex gap-2 mt-2">
                  <TextField select label="العملة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={{ width: 200 }} helperText="فارغ = بالدولار فقط">
                    <MenuItem value="">-</MenuItem>
                    {currencies.filter((c) => c.isActive).map((c) => <MenuItem key={c.code} value={c.code}>{c.code} · {c.name}</MenuItem>)}
                  </TextField>
                  <TextField select label="المكتب" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} fullWidth>
                    <MenuItem value="">-</MenuItem>
                    {offices.map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
                  </TextField>
                </div>
                {!editing && (
                  <div className="d-flex gap-2 align-items-center mt-2">
                    <FormControlLabel control={<Checkbox checked={form.isCash} onChange={(e) => setForm({ ...form, isCash: e.target.checked, type: e.target.checked ? 'asset' : form.type })} />} label="خزينة / بنك / محفظة إلكترونية" />
                    {form.isCash && (
                      <TextField select value={form.cashKind} onChange={(e) => setForm({ ...form, cashKind: e.target.value })} style={{ width: 170 }}>
                        <MenuItem value="cash">خزينة نقدية</MenuItem>
                        <MenuItem value="bank">بنك</MenuItem>
                        <MenuItem value="ewallet">محفظة إلكترونية</MenuItem>
                      </TextField>
                    )}
                  </div>
                )}
                <TextField select label="بيانات إلزامية في كل سطر" value={form.requires} fullWidth className="mt-3" SelectProps={{ multiple: true }}
                  onChange={(e) => setForm({ ...form, requires: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}>
                  {DIMENSIONS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
                <FormControlLabel className="mt-2" control={<Checkbox checked={form.allowManualEntry} onChange={(e) => setForm({ ...form, allowManualEntry: e.target.checked })} />} label="يقبل القيود اليدوية" />
              </>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>إلغاء</Button>
          <Button variant="contained" onClick={save} disabled={isSaving || !form?.code || !form?.name}>{isSaving ? 'جارٍ الحفظ…' : 'حفظ'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChartOfAccounts;
