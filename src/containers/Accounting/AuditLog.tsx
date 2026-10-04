import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import moment from 'moment';
import { acc, errorText } from './accountingApi';
import { DataTable, Ltr, PageHeader, Panel } from './ui';
import { ListFilters, ListFilterValue, queryOf } from './ListFilters';

const AUDIT_FILTERS: ListFilterValue = { action: '', from: '', to: '' };
// The kinds of change, by the start of their action name
const ACTION_GROUPS: [string, string][] = [
  ['bill.', 'فواتير الموردين'], ['payment.', 'الدفعات'], ['transfer.', 'التحويلات'], ['cashcount.', 'الجرد'], ['entry.', 'القيود'],
  ['document.', 'المستندات'], ['alipay.', 'Alipay'], ['bank.', 'كشوف البنوك'], ['exception.', 'الاستثناءات'], ['backup.', 'النسخ الاحتياطي'], ['setup.', 'الإعداد'],
];

const PAGE_SIZE = 50;

const ACTIONS: Record<string, string> = {
  'account.create': 'إضافة حساب', 'account.update': 'تعديل حساب', 'account.archive': 'أرشفة حساب', 'account.unarchive': 'إلغاء أرشفة حساب', 'account.delete': 'حذف حساب',
  'exception.reviewed': 'تمت مراجعة بند', 'exception.unreviewed': 'إرجاع بند للمراجعة', 'backup.download': 'تنزيل نسخة احتياطية',
  'entry.manual': 'قيد يدوي', 'entry.cancel': 'إلغاء قيد', 'document.cancel': 'إلغاء مستند', 'document.attach': 'إرفاق ملف',
  'bill.post': 'ترحيل فاتورة', 'bill.draft': 'حفظ مسودة فاتورة', 'bill.updateDraft': 'تعديل مسودة', 'bill.deleteDraft': 'حذف مسودة',
  'payment.post': 'دفعة لمورد', 'transfer.post': 'تحويل خزينة', 'cashcount.post': 'جرد خزينة', 'salary.post': 'صرف راتب',
  'equity.post': 'رأس مال / قرض', 'netting.post': 'مقاصة', 'asset.dispose': 'بيع أصل',
  'rate.create': 'إدخال سعر', 'rate.update': 'تعديل سعر', 'rate.delete': 'حذف سعر',
  'settings.update': 'تعديل الإعدادات', 'settings.roles': 'تعديل الأدوار', 'settings.officeAccounts': 'تعديل خزائن المكاتب', 'settings.eventJournals': 'ربط الدفاتر',
  'office.create': 'إضافة مكتب', 'currency.create': 'إضافة عملة', 'journal.create': 'إضافة دفتر', 'vendor.create': 'إضافة مورد', 'vendor.update': 'تعديل مورد',
  'setup.run': 'تشغيل الإعداد', 'bank.import': 'استيراد كشف بنك', 'bank.autoMatch': 'مطابقة تلقائية', 'live.retry': 'إعادة ترحيل عملية',
};

const AuditLog = () => {
  const [data, setData] = useState<any>({ results: [], total: 0, page: 1 });
  const [open, setOpen] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<ListFilterValue>(AUDIT_FILTERS);
  const load = async (page = 1, current: ListFilterValue = filters) => {
    try {
      setIsLoading(true);
      setData((await acc.get('audit', { page, limit: PAGE_SIZE, ...queryOf(current) })).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1); }, []);
  const pages = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);

  return (
    <>
      <PageHeader title="سجل التدقيق" subtitle="كل تغيير في قسم المحاسبة: من قام به، ومتى، والقيم قبل وبعد. اضغط على أي سطر للتفاصيل." />
      {error && <Alert severity="error">{error}</Alert>}
      <Panel flush>
        <div className="px-3">
          <ListFilters value={filters} onChange={setFilters} onApply={(value) => load(1, value)} blank={AUDIT_FILTERS} searchLabel={null}>
            <TextField size="small" select label="نوع التغيير" value={filters.action} onChange={(ev) => setFilters({ ...filters, action: ev.target.value })} style={{ minWidth: 170 }}>
              <MenuItem value="">الكل</MenuItem>
              {ACTION_GROUPS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
          </ListFilters>
        </div>
        <DataTable
          loading={isLoading}
          rows={data.results}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => setOpen(row)}
          empty={{ title: 'لا يوجد شيء مسجل بعد' }}
          columns={[
            { key: 'at', header: 'الوقت', width: 150, render: (row: any) => <Ltr>{moment(row.at).format('YYYY-MM-DD HH:mm')}</Ltr> },
            { key: 'who', header: 'المستخدم', render: (row: any) => (row.userId ? `${row.userId.firstName} ${row.userId.lastName}` : 'النظام') },
            { key: 'action', header: 'العملية', render: (row: any) => ACTIONS[row.action] || row.action },
            { key: 'model', header: 'السجل', hideOnMobile: true, render: (row: any) => <span className="acc-muted"><Ltr>{row.model} {row.docId || ''}</Ltr></span> },
          ]}
        />
        {pages > 1 && (
          <div className="d-flex justify-content-end gap-2 px-3 py-2">
            <Button size="small" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>السابق</Button>
            <Button size="small" disabled={data.page >= pages} onClick={() => load(data.page + 1)}>التالي</Button>
          </div>
        )}
      </Panel>
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle>{open && (ACTIONS[open.action] || open.action)}</DialogTitle>
        {open && (
          <DialogContent>
            <div className="d-flex gap-3 flex-wrap small" dir="ltr">
              {open.before && <pre style={{ flex: 1, minWidth: 260, whiteSpace: 'pre-wrap' }}><b>قبل</b>{'\n'}{JSON.stringify(open.before, null, 2)}</pre>}
              {open.after && <pre style={{ flex: 1, minWidth: 260, whiteSpace: 'pre-wrap' }}><b>بعد</b>{'\n'}{JSON.stringify(open.after, null, 2)}</pre>}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};

export default AuditLog;
