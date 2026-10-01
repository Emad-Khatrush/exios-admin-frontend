import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { CURRENCY_DECIMALS, EVENT_LABELS, acc, errorText } from './accountingApi';
import { AccountRef, DataTable, FilterBar, Ltr, Money, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

const AccountLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // A report that links here passes its own period, so the figures match
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      setError('');
      setData((await acc.get(`reports/account-ledger/${id}`, { from: from || undefined, to: to || undefined })).data);
    } catch (err) {
      setError(errorText(err));
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  if (error) return <Alert severity="error">{error}</Alert>;
  const account = data?.account;
  const foreign = !account?.isGroup && account?.currency && account.currency !== 'USD';
  const decimals = CURRENCY_DECIMALS[account?.currency] ?? 2;
  // Dollar accounts (receivables, revenue...) whose operations were typed in another currency
  const hasOriginal = (data?.movements || []).some((row: any) => row.original?.amount);

  return (
    <>
      <PageHeader title={account ? <AccountRef code={account.code} name={account.name} /> : 'كشف الحساب'} subtitle={account?.isGroup ? 'حركات كل الحسابات تحت هذه المجموعة برصيد جارٍ (مدين ناقص دائن).' : 'كل حركات الحساب برصيد جارٍ (مدين ناقص دائن).'} />
      {data && (
        <StatGrid>
          <Stat label="الرصيد الافتتاحي" value={<Money value={data.opening.usd} />} />
          <Stat label="الرصيد الختامي" value={<Money value={data.closing.usd} />} hint={foreign ? <Money value={data.closing.foreign} currency={account.currency} decimals={decimals} tone="plain" /> : undefined} tone="accent" />
          <Stat label="عدد الحركات" value={data.movements.length} />
        </StatGrid>
      )}
      <Panel flush>
        <div className="px-3">
          <FilterBar>
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
            <Button variant="outlined" onClick={load}>عرض</Button>
          </FilterBar>
        </div>
        {data?.truncated && <Alert severity="info" className="mx-3 mb-2">تُعرض أول 5000 حركة فقط. ضيّق الفترة.</Alert>}
        <DataTable
          loading={isLoading}
          rows={data?.movements || []}
          rowKey={(row: any, index: number) => `${row._id}-${index}`}
          onRowClick={(row: any) => navigate(`/accounting/entries/${row._id}`)}
          empty={{ title: 'لا توجد حركات في هذه الفترة' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr> },
            {
              key: 'description', header: 'البيان', render: (row: any) => (
                <>
                  <div>{row.line.label || row.description}</div>
                  <Sub><Ltr>{row.number}</Ltr> · {EVENT_LABELS[row.eventType] || row.eventType}</Sub>
                </>
              ),
            },
            ...(account?.isGroup ? [{ key: 'account', header: 'الحساب', hideOnMobile: true, render: (row: any) => <AccountRef code={row.account?.code} name={row.account?.name} /> }] : []),
            { key: 'debit', header: 'مدين', numeric: true, render: (row: any) => <Money value={row.line.debit} tone="debit" hideZero /> },
            { key: 'credit', header: 'دائن', numeric: true, render: (row: any) => <Money value={row.line.credit} tone="credit" hideZero /> },
            ...(foreign
              ? [{ key: 'foreign', header: `بالعملة (${account.currency})`, numeric: true, render: (row: any) => <><Money value={row.line.amountCurrency} currency={account.currency} decimals={decimals} tone="plain" />{row.line.rate ? <Sub>بسعر <Ltr>{row.line.rate}</Ltr></Sub> : null}</> }]
              : hasOriginal ? [{
                key: 'original', header: 'بعملة العملية', numeric: true, hideOnMobile: true,
                render: (row: any) => (row.original?.amount ? <><Money value={row.original.amount} currency={row.original.currency} decimals={CURRENCY_DECIMALS[row.original.currency]} tone="plain" />{row.original.rate ? <Sub>بسعر <Ltr>{row.original.rate}</Ltr></Sub> : null}</> : null),
              }] : []),
            { key: 'balance', header: foreign ? 'الرصيد بالدولار' : 'الرصيد', numeric: true, render: (row: any) => <Money value={row.balanceUsd} strong /> },
            ...(foreign ? [{ key: 'balanceForeign', header: `الرصيد (${account.currency})`, numeric: true, render: (row: any) => <Money value={row.balanceForeign} currency={account.currency} decimals={decimals} strong /> }] : []),
          ]}
        />
      </Panel>
    </>
  );
};

export default AccountLedger;
