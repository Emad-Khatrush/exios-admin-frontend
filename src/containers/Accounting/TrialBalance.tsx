import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { CURRENCY_DECIMALS, acc, errorText } from './accountingApi';
import { toTree } from './useAccountingData';
import { AccountRef, Badge, DataTable, FilterBar, Money, PageHeader, Panel } from './ui';

const TrialBalance = () => {
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showZero, setShowZero] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      setError('');
      setData((await acc.get('reports/trial-balance', { from: from || undefined, to: to || undefined })).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const isZero = (t: any) => !t.openingUsd && !t.debit && !t.credit && !t.closingUsd;
    return toTree(data.results).filter(({ account }) => showZero || !isZero(account.totals));
  }, [data, showZero]);
  const depthOf = new Map(rows.map(({ account, depth }) => [account._id, depth]));
  const balanced = data && data.totals.debit === data.totals.credit;

  return (
    <>
      <PageHeader
        title="ميزان المراجعة"
        subtitle="الرصيد الافتتاحي والحركة والرصيد الختامي لكل حساب بالدولار. الموجب رصيد مدين."
        actions={data && (balanced ? <Badge tone="ok">المدين = الدائن</Badge> : <Badge tone="danger">غير متوازن</Badge>)}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {data && !balanced && <Alert severity="error" className="mb-2">مجموع المدين لا يساوي مجموع الدائن. أبلغ عن هذا فوراً، فالدفاتر يجب أن تتوازن دائماً.</Alert>}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
            <Button variant="outlined" onClick={load}>عرض</Button>
            <FormControlLabel control={<Checkbox checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />} label="إظهار الحسابات الصفرية" />
          </FilterBar>
        </div>
        <DataTable
          loading={isLoading}
          rows={rows.map((r) => r.account)}
          rowKey={(row: any) => row._id}
          indent={(row: any) => depthOf.get(row._id) || 0}
          rowTone={(row: any) => (row.isGroup ? 'group' : undefined)}
          onRowClick={(row: any) => navigate(`/accounting/accounts/${row._id}`)}
          empty={{ title: 'لا توجد أرصدة', hint: 'فعّل «إظهار الحسابات الصفرية» لرؤية كل الشجرة.' }}
          columns={[
            { key: 'account', header: 'الحساب', render: (row: any) => <AccountRef code={row.code} name={row.name} /> },
            { key: 'opening', header: 'افتتاحي', numeric: true, hideOnMobile: true, render: (row: any) => <Money value={row.totals?.openingUsd} /> },
            { key: 'debit', header: 'مدين', numeric: true, render: (row: any) => <Money value={row.totals?.debit} tone="debit" hideZero /> },
            { key: 'credit', header: 'دائن', numeric: true, render: (row: any) => <Money value={row.totals?.credit} tone="credit" hideZero /> },
            { key: 'closing', header: 'ختامي', numeric: true, render: (row: any) => <Money value={row.totals?.closingUsd} strong /> },
            {
              key: 'foreign', header: 'الختامي بعملة الحساب', numeric: true, hideOnMobile: true, render: (row: any) => (
                !row.isGroup && row.currency && row.currency !== 'USD' ? <Money value={row.totals?.foreign} currency={row.currency} decimals={CURRENCY_DECIMALS[row.currency]} tone="plain" /> : null
              ),
            },
          ]}
          footer={data ? {
            account: 'الإجمالي (الحسابات التفصيلية)',
            opening: <Money value={data.totals.opening} />,
            debit: <Money value={data.totals.debit} strong />,
            credit: <Money value={data.totals.credit} strong />,
            closing: <Money value={data.totals.closing} strong />,
          } : undefined}
        />
      </Panel>
    </>
  );
};

export default TrialBalance;
