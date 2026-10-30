import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { OFFICE_LABELS, acc, errorText } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { CancelDialog, today } from './shared';
import { AccountRef, DataTable, Ltr, Money, PageHeader, Panel, StatusBadge, Sub } from './ui';

const lastMonth = () => {
  const [year, month] = today().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const Assets = () => {
  const navigate = useNavigate();
  const { accounts } = useAccountingData();
  const [assets, setAssets] = useState<any[]>([]);
  const [prepaid, setPrepaid] = useState<any[]>([]);
  const [upToMonth, setUpToMonth] = useState(lastMonth());
  const [dispose, setDispose] = useState<any>(null);
  const [cancel, setCancel] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCash && a.isActive), [accounts]);

  const load = async () => {
    const [a, p] = await Promise.all([acc.get('assets'), acc.get('prepaid')]);
    setAssets(a.data.results);
    setPrepaid(p.data.results);
    setIsLoading(false);
  };
  useEffect(() => { load().catch(() => setIsLoading(false)); }, []);

  const run = async (path: string, body: any, text: (data: any) => string) => {
    try {
      const res = await acc.post(path, body);
      setMessage({ type: 'success', text: text(res.data) });
      await load();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
      return false;
    }
  };

  const bookTotal = assets.filter((a) => a.status === 'posted' && a.assetStatus !== 'disposed').reduce((s, a) => s + a.bookValue, 0);

  return (
    <>
      <PageHeader
        title="الأصول الثابتة والمصروفات المقدمة"
        subtitle="الأصل يُشترى بسطر «أصل ثابت» في فاتورة مورد. الإهلاك قسط شهري ثابت يُرحَّل بآخر يوم في كل شهر، والأشهر الفائتة تُستكمل تلقائياً."
        actions={<>
          <TextField type="month" label="حتى شهر" InputLabelProps={{ shrink: true }} value={upToMonth} onChange={(e) => setUpToMonth(e.target.value)} />
          <Button variant="outlined" onClick={() => run('prepaid/amortize', { upToMonth }, (d) => `رُحِّل ${d.posted} قسطاً شهرياً (حتى ${d.upToMonth}).`)}>ترحيل أقساط المقدمات</Button>
          <Button variant="contained" onClick={() => run('assets/depreciate', { upToMonth }, (d) => `رُحِّل ${d.posted} قيد إهلاك (حتى ${d.upToMonth}).`)}>ترحيل الإهلاك</Button>
        </>}
      />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Panel flush title="الأصول الثابتة">
        <DataTable
          loading={isLoading}
          rows={assets}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : row.assetStatus === 'disposed' ? 'muted' : undefined)}
          empty={{ title: 'لا توجد أصول ثابتة', hint: 'أضف أصلاً بسطر من نوع «أصل ثابت» في فاتورة مورد.' }}
          columns={[
            { key: 'name', header: 'الأصل', render: (row: any) => <>{row.name}<Sub><Ltr>{row.number}</Ltr> · {OFFICE_LABELS[row.office] || row.office} · {row.usefulLifeMonths} شهراً</Sub></> },
            { key: 'account', header: 'الحساب', hideOnMobile: true, render: (row: any) => <AccountRef code={row.accountId?.code} name={row.accountId?.name} /> },
            { key: 'bought', header: 'تاريخ الشراء', hideOnMobile: true, render: (row: any) => <Ltr>{row.purchaseDay}</Ltr> },
            { key: 'cost', header: 'التكلفة', numeric: true, render: (row: any) => <Money value={row.cost} /> },
            { key: 'accumulated', header: 'مجمع الإهلاك', numeric: true, render: (row: any) => <><Money value={row.accumulated} /><Sub>{row.depreciationPosted.length} شهراً</Sub></> },
            { key: 'book', header: 'القيمة الدفترية', numeric: true, render: (row: any) => <Money value={row.bookValue} strong /> },
            { key: 'status', header: 'الحالة', render: (row: any) => <StatusBadge status={row.status === 'canceled' ? 'canceled' : row.assetStatus} /> },
            {
              key: 'actions', header: '', align: 'end', render: (row: any) => (
                <span className="d-inline-flex gap-1">
                  {row.sourceBillId && <Button size="small" onClick={() => navigate(`/accounting/bills/${row.sourceBillId}`)}>الفاتورة</Button>}
                  {row.status === 'posted' && row.assetStatus !== 'disposed' && <Button size="small" onClick={() => setDispose({ asset: row, day: today(), proceeds: '', toAccountId: '' })}>بيع / استبعاد</Button>}
                  {row.status === 'posted' && <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingFixedAsset', doc: row, title: row.name })}>إلغاء</Button>}
                </span>
              ),
            },
          ]}
          footer={assets.length ? { name: 'إجمالي القيمة الدفترية', book: <Money value={bookTotal} strong /> } : undefined}
        />
      </Panel>

      <Panel flush title="المصروفات المقدمة" subtitle="مبالغ دُفعت مقدماً (مثل إيجار سنة) وتنتقل للمصروف شهراً بشهر.">
        <DataTable
          loading={isLoading}
          rows={prepaid}
          rowKey={(row: any) => row._id}
          rowTone={(row: any) => (row.status === 'canceled' ? 'canceled' : undefined)}
          empty={{ title: 'لا توجد مصروفات مقدمة' }}
          columns={[
            { key: 'description', header: 'الوصف', render: (row: any) => <>{row.description}<Sub><Ltr>{row.number}</Ltr> · {OFFICE_LABELS[row.office] || row.office} · من <Ltr>{row.startMonth}</Ltr></Sub></> },
            { key: 'account', header: 'حساب المصروف', hideOnMobile: true, render: (row: any) => <AccountRef code={row.expenseAccountId?.code} name={row.expenseAccountId?.name} /> },
            { key: 'total', header: 'الإجمالي', numeric: true, render: (row: any) => <Money value={row.total} /> },
            { key: 'amortized', header: 'حُمِّل للمصروف', numeric: true, render: (row: any) => <><Money value={row.amortized} /><Sub>{row.amortizationPosted.length} من {row.months}</Sub></> },
            { key: 'remaining', header: 'المتبقي', numeric: true, render: (row: any) => <Money value={row.remaining} strong /> },
            { key: 'actions', header: '', align: 'end', render: (row: any) => (row.status === 'posted' ? <Button size="small" color="error" onClick={() => setCancel({ model: 'AccountingPrepaidExpense', doc: row, title: row.description })}>إلغاء</Button> : <StatusBadge status={row.status} />) },
          ]}
        />
      </Panel>

      <Dialog open={!!dispose} onClose={() => setDispose(null)} maxWidth="xs" fullWidth>
        <DialogTitle>بيع أو استبعاد {dispose?.asset.name}</DialogTitle>
        {dispose && (
          <DialogContent>
            <p className="acc-muted">يُرحَّل الإهلاك حتى يوم البيع أولاً. اترك السعر فارغاً للاستبعاد بدون بيع.</p>
            <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={dispose.day} onChange={(e) => setDispose({ ...dispose, day: e.target.value })} />
            <TextField select label="استُلم المبلغ في" value={dispose.toAccountId} onChange={(e) => setDispose({ ...dispose, toAccountId: e.target.value })} fullWidth className="mt-3">
              <MenuItem value="">بدون بيع</MenuItem>
              {cashAccounts.map((a) => <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>)}
            </TextField>
            <TextField type="number" label="سعر البيع" value={dispose.proceeds} onChange={(e) => setDispose({ ...dispose, proceeds: e.target.value })} fullWidth className="mt-3" disabled={!dispose.toAccountId} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setDispose(null)}>إلغاء</Button>
          <Button variant="contained" onClick={async () => {
            if (await run(`assets/${dispose.asset._id}/dispose`, { day: dispose.day, proceeds: Number(dispose.proceeds) || 0, toAccountId: dispose.toAccountId || undefined }, () => 'تم استبعاد الأصل.')) setDispose(null);
          }}>ترحيل</Button>
        </DialogActions>
      </Dialog>

      {cancel && <CancelDialog open onClose={() => setCancel(null)} onDone={load} model={cancel.model} id={cancel.doc._id} title={cancel.title} />}
    </>
  );
};

export default Assets;
