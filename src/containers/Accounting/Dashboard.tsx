import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { acc, errorText, OFFICE_LABELS } from './accountingApi';
import { AccountRef, Badge, DataTable, Money, PageHeader, Panel, Stat, StatGrid } from './ui';
import { SubBoxesPanel } from './SubBoxes';
import { arCount } from './shared';

const CASH_KIND: Record<string, string> = { cash: 'خزينة', bank: 'بنك', ewallet: 'محفظة إلكترونية', current: 'حساب جاري' };

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [month, setMonth] = useState<any>(null);
  const [checks, setChecks] = useState<any>(null);
  const [error, setError] = useState('');
  const [isRunningSetup, setIsRunningSetup] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [dashboard, liveStatus] = await Promise.all([acc.get('dashboard'), acc.get('live')]);
      setData(dashboard.data);
      setLive(liveStatus.data);
      // This month's result and the last daily reconciliation; the dashboard works without them
      const day = dashboard.data.day;
      if (day) {
        acc.get('reports/income-statement', { from: `${day.slice(0, 7)}-01`, to: day }).then((res: any) => setMonth(res.data.summary)).catch(() => {});
        if (liveStatus.data.migrationDate) acc.get('exceptions').then((res: any) => setChecks(res.data)).catch(() => {});
      }
    } catch (err) {
      setError(errorText(err, 'تعذّر تحميل لوحة المحاسبة.'));
    }
  };

  useEffect(() => { load(); }, []);

  const runSetup = async () => {
    try {
      setIsRunningSetup(true);
      await acc.post('setup/run');
      await load();
    } catch (err) {
      setError(errorText(err));
    }
    setIsRunningSetup(false);
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (data && !data.setupDone) {
    return (
      <Panel title="النظام المحاسبي غير مُعدّ بعد" subtitle="الإعداد ينشئ شجرة الحسابات والخزائن والعملات والدفاتر والأدوار الافتراضية. يضيف الناقص فقط ولا يغيّر ما عدّلته.">
        <Button variant="contained" onClick={runSetup} disabled={isRunningSetup}>{isRunningSetup ? 'جارٍ الإعداد…' : 'تشغيل الإعداد'}</Button>
      </Panel>
    );
  }

  const balances = data?.balances || {};
  // Wallets and payables are credit balances: shown as positive amounts owed
  const owed = (item: any) => (item ? -item.usd : 0);
  const failed = live?.counts?.failed || 0;

  return (
    <>
      <PageHeader title="لوحة المحاسبة" subtitle={data ? `اليوم ${data.day}${data.lockDate ? ` · الدفاتر مقفلة حتى ${data.lockDate}` : ''}` : undefined} />

      {data?.missingRates?.length > 0 && (
        <Alert severity="warning" className="mb-3" action={<Button size="small" onClick={() => navigate('/accounting/rates')}>إدخال الأسعار</Button>}>
          لم يُدخل سعر اليوم لـ {data.missingRates.join('، ')}. العمليات بهذه العملات ستستخدم آخر سعر معروف.
        </Alert>
      )}
      {balances.suspense && balances.suspense.usd !== 0 && (
        <Alert severity="info" className="mb-3" action={<Button size="small" onClick={() => navigate('/accounting/suspense')}>تسوية</Button>}>
          في حساب المعلّق <Money value={Math.abs(balances.suspense.usd)} /> تحتاج مراجعة المحاسب وتوجيهها لحساباتها الصحيحة.
        </Alert>
      )}
      {live && !live.migrationDate && (
        <Alert severity="info" className="mb-3" action={<Button size="small" onClick={() => navigate('/accounting/migration')}>فتح</Button>}>
          الترحيل التاريخي لم يُعتمد بعد؛ عمليات المنظومة لا تدخل الدفاتر قبل اعتماده.
        </Alert>
      )}
      {failed > 0 && (
        <Alert severity="error" className="mb-3" action={<Button size="small" onClick={() => navigate('/accounting/settings?tab=live')}>عرض</Button>}>
          {failed} عملية من المنظومة لم تُرحَّل بعد بسبب خطأ.
        </Alert>
      )}

      {checks && (checks.errorCount > 0 || checks.warningCount > 0) && (
        <Alert severity={checks.errorCount ? 'error' : 'warning'} className="mb-3" action={<Button size="small" onClick={() => navigate('/accounting/exceptions')}>عرض</Button>}>
          المطابقة اليومية (<bdi dir="ltr">{checks.day}</bdi>): {checks.errorCount ? arCount(checks.errorCount, ['خطأ واحد', 'خطآن', 'أخطاء', 'خطأً']) : 'لا أخطاء'}، و{checks.warningCount ? arCount(checks.warningCount, ['فحص واحد', 'فحصان', 'فحوص', 'فحصاً']) : 'لا شيء'} للمراجعة.
        </Alert>
      )}

      <StatGrid>
        {month && <Stat label="ربح هذا الشهر" value={<Money value={month.netProfit.total} />} hint={<>إيرادات معترف بها <Money value={month.revenue.total} /></>} tone={month.netProfit.total < 0 ? 'danger' : 'accent'} />}
        <Stat label="ذمم العملاء" value={<Money value={balances.receivables?.usd} />} hint="مستحقات على العملاء" />
        <Stat label="محافظ العملاء – دولار" value={<Money value={owed(balances.walletsUsd)} />} hint="ما للعملاء عندنا بالدولار" />
        <Stat
          label="محافظ العملاء – دينار"
          value={<Money value={-(balances.walletsLyd?.foreign || 0)} currency="LYD" decimals={balances.walletsLyd?.decimals} />}
          hint={<>ما للعملاء عندنا بالدينار · قيمته في الدفاتر <Money value={owed(balances.walletsLyd)} /></>}
        />
        <Stat label="مستحق للموردين وشركات الشحن" value={<Money value={owed(balances.payableCarriers) + owed(balances.payableSuppliers)} />} />
        <Stat
          label="الترحيل من المنظومة"
          value={live?.liveEnabled ? 'مفعّل' : 'متوقف'}
          hint={live?.liveEnabled ? `${data?.entriesCount ?? 0} قيداً في الدفاتر` : 'يُفعَّل بعد اعتماد الترحيل التاريخي'}
          tone={live?.liveEnabled ? undefined : 'warn'}
        />
      </StatGrid>
      <SubBoxesPanel />

      <Panel flush title="الخزائن والبنوك والمحافظ الإلكترونية" subtitle="الرصيد بعملة كل حساب، وقيمته بالدولار في الدفاتر، ومتوسط السعر الذي يُحمل به."
        actions={<Button size="small" onClick={() => setShowEmpty((v) => !v)}>{showEmpty ? 'إخفاء الحسابات الصفرية' : `إظهار الحسابات الصفرية (${(data?.cash || []).filter((r: any) => !r.foreign && !r.usd).length})`}</Button>}>
        <DataTable
          loading={!data}
          rows={(data?.cash || []).filter((row: any) => showEmpty || row.foreign !== 0 || row.usd !== 0)}
          rowKey={(row: any) => row._id}
          onRowClick={(row: any) => navigate(`/accounting/accounts/${row._id}`)}
          rowTone={(row: any) => (row.isActive ? undefined : 'muted')}
          empty={{ title: 'لا توجد خزائن', hint: 'أضف خزينة من شجرة الحسابات أو من إعدادات المكاتب.' }}
          columns={[
            { key: 'account', header: 'الحساب', render: (row: any) => <AccountRef code={row.code} name={row.name} />, sortValue: (row: any) => row.code },
            { key: 'office', header: 'المكتب', render: (row: any) => OFFICE_LABELS[row.office] || row.office, hideOnMobile: true },
            { key: 'kind', header: 'النوع', render: (row: any) => <Badge tone={row.cashKind === 'cash' ? 'muted' : 'info'}>{CASH_KIND[row.cashKind] || row.cashKind}</Badge>, hideOnMobile: true },
            { key: 'balance', header: 'الرصيد', numeric: true, render: (row: any) => <Money value={row.foreign} currency={row.currency} decimals={row.decimals} strong />, sortValue: (row: any) => row.foreign },
            { key: 'usd', header: 'القيمة بالدولار', numeric: true, render: (row: any) => <Money value={row.usd} />, sortValue: (row: any) => row.usd },
            { key: 'rate', header: 'متوسط السعر', numeric: true, hideOnMobile: true, render: (row: any) => (row.carryingRate ? <span className="money">{row.carryingRate.toFixed(4)}</span> : <span className="acc-muted">-</span>) },
          ]}
          footer={data?.cash?.length ? { account: 'الإجمالي بالدولار', usd: <Money value={data.cash.reduce((s: number, r: any) => s + r.usd, 0)} strong /> } : undefined}
        />
      </Panel>
    </>
  );
};

export default Dashboard;
