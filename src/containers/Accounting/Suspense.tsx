import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Button, MenuItem, TextField } from '@mui/material';
import { EVENT_LABELS, acc, errorText, todayLibya } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { RemotePicker, userLabel } from './shared';
import { ClaimPicker } from './EntryForm';
import { DataTable, FilterBar, Ltr, Money, Open, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';

const CHUNK = 200;
const emptyTarget = { account: null as any, office: '', partner: null as any, arKey: '', dateMode: 'today', day: todayLibya(), note: '' };

// The suspense account as a work list: pick items (one or hundreds), name the account they
// belong to, and each gets its own entry that moves it out of suspense.
const Suspense = () => {
  const navigate = useNavigate();
  const { accounts, offices } = useAccountingData();
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState({ cause: '', search: '', from: '', to: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(emptyTarget);
  const [receivableCode, setReceivableCode] = useState('');
  const [message, setMessage] = useState<any>(null);
  const [progress, setProgress] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async (current = filters) => {
    try {
      setIsLoading(true);
      const query: any = {};
      Object.entries(current).forEach(([key, value]) => { if (value) query[key] = value; });
      setData((await acc.get('suspense', query)).data);
      setSelected(new Set());
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    acc.get('settings').then((res: any) => setReceivableCode(res.data.roles?.find((r: any) => r.role === 'customer_receivable')?.account?.code || '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targets = useMemo(() => accounts.filter((a) => !a.isGroup && a.isActive && a.allowManualEntry && a.code !== '399000').sort((a, b) => a.code.localeCompare(b.code)), [accounts]);
  const rows: any[] = data?.results || [];
  const picked = rows.filter((row) => selected.has(row.id));
  const pickedNet = picked.reduce((sum, row) => sum + row.debit - row.credit, 0);
  const toReceivable = !!target.account && target.account.code === receivableCode;
  const needsOffice = !!target.account?.requires?.includes('office') && !target.account?.office;

  const setCause = (cause: string) => { const next = { ...filters, cause }; setFilters(next); load(next); };

  const settle = async () => {
    const ids = picked.map((row) => row.id);
    const body = {
      accountId: target.account._id, office: target.office || undefined, partnerId: target.partner?._id, arKey: target.arKey || undefined,
      day: target.dateMode === 'original' ? 'original' : target.dateMode === 'fixed' ? target.day : undefined, note: target.note || undefined,
    };
    let settled = 0;
    const failures: any[] = [];
    try {
      for (let start = 0; start < ids.length; start += CHUNK) {
        setProgress(`جارٍ التسوية ${Math.min(start + CHUNK, ids.length)} / ${ids.length}`);
        const res = await acc.post('suspense/settle', { ...body, items: ids.slice(start, start + CHUNK) });
        settled += res.data.settled;
        failures.push(...res.data.failures);
      }
      const byId = new Map(rows.map((row) => [row.id, row]));
      setMessage({
        type: failures.length ? 'warning' : 'success',
        text: `سُوّي ${settled} من ${ids.length} بنداً إلى ${accountLabel(target.account)}.`,
        failures: failures.slice(0, 30).map((f) => `${byId.get(f.id)?.number || f.id}: ${f.message}`),
      });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setProgress('');
    await load();
  };

  return (
    <>
      <PageHeader
        title="تسوية حساب المعلّق"
        subtitle="كل مبلغ لم يعرف النظام حسابه الصحيح بند هنا. حدّد البنود المتشابهة، اختر الحساب الذي تخصّه، وسوِّها دفعة واحدة؛ لكل بند قيد يخرجه من المعلّق."
      />
      {message && (
        <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>
          {message.text}
          {message.failures?.length > 0 && <ul className="mb-0 mt-1">{message.failures.map((f: string) => <li key={f}>{f}</li>)}</ul>}
        </Alert>
      )}
      {data?.closedAtMigration && <Alert severity="info" className="mb-3">معلّق الفترة التاريخية أُقفل في الرصيد الافتتاحي عند الترحيل؛ تظهر هنا البنود التي جاءت بعده فقط.</Alert>}

      <StatGrid>
        <Stat label="بنود مفتوحة" value={data?.count ?? '-'} tone={data?.count ? 'warn' : undefined} />
        <Stat label="صافي رصيد المعلّق المفتوح" value={<Money value={data?.net} />} hint="مدين ناقص دائن" />
        <Stat label="المحدد الآن" value={selected.size} hint={selected.size ? <Money value={pickedNet} /> : 'حدّد بنوداً من الجدول'} tone={selected.size ? 'accent' : undefined} />
      </StatGrid>

      <Panel flush title="الأسباب" subtitle="اضغط سبباً لعرض بنوده فقط؛ البنود ذات السبب الواحد تُسوّى غالباً إلى الحساب نفسه.">
        <DataTable
          dense
          loading={!data}
          rows={data?.groups || []}
          rowKey={(row: any) => row.cause}
          onRowClick={(row: any) => setCause(filters.cause === row.cause ? '' : row.cause)}
          rowTone={(row: any) => (filters.cause && filters.cause !== row.cause ? 'muted' : undefined)}
          empty={{ title: 'حساب المعلّق نظيف', hint: 'لا توجد بنود تحتاج توجيهاً.' }}
          columns={[
            { key: 'cause', header: 'السبب', render: (row: any) => <>{row.cause}{filters.cause === row.cause && <Sub>معروض الآن · اضغط لإظهار الكل</Sub>}</> },
            { key: 'count', header: 'عدد البنود', numeric: true, sortValue: (row: any) => row.count },
            { key: 'net', header: 'الصافي', numeric: true, render: (row: any) => <Money value={row.net} strong />, sortValue: (row: any) => Math.abs(row.net) },
          ]}
        />
      </Panel>

      {selected.size > 0 && (
        <Panel title={`تسوية ${selected.size} بنداً`} subtitle="البند الدائن في المعلّق يصبح دائناً في الحساب المختار، والمدين مديناً؛ أي أن الحساب المختار يأخذ مكان المعلّق في العملية الأصلية.">
          <div className="acc-form-grid">
            <Autocomplete
              size="small" options={targets} value={target.account} style={{ gridColumn: 'span 2' }}
              getOptionLabel={(option: any) => accountLabel(option)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
              onChange={(_, account: any) => setTarget({ ...target, account, arKey: '', partner: null })}
              renderInput={(params) => <TextField {...params} label="الحساب الذي تخصّه هذه المبالغ" />}
            />
            {needsOffice && (
              <TextField select label="المكتب *" value={target.office} onChange={(e) => setTarget({ ...target, office: e.target.value })}>
                {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
              </TextField>
            )}
            <TextField select label="تاريخ قيد التسوية" value={target.dateMode} onChange={(e) => setTarget({ ...target, dateMode: e.target.value })}>
              <MenuItem value="today">اليوم</MenuItem>
              <MenuItem value="original">تاريخ كل عملية الأصلي</MenuItem>
              <MenuItem value="fixed">تاريخ محدد</MenuItem>
            </TextField>
            {target.dateMode === 'fixed' && <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={target.day} onChange={(e) => setTarget({ ...target, day: e.target.value })} />}
            {toReceivable && <>
              <RemotePicker endpoint="lookup/users" label="العميل (فارغ = عميل كل عملية)" value={target.partner} getLabel={userLabel} onChange={(partner) => setTarget({ ...target, partner, arKey: '' })} />
              <ClaimPicker partnerId={target.partner?._id} value={target.arKey} onChange={(arKey) => setTarget({ ...target, arKey })} />
            </>}
            <TextField label="ملاحظة على القيود" value={target.note} onChange={(e) => setTarget({ ...target, note: e.target.value })} style={{ gridColumn: 'span 2' }} />
          </div>
          {target.account?.currency && target.account.currency !== 'USD' && <p className="acc-muted mt-2 mb-0">الحساب بعملة {target.account.currency}: يُحوَّل كل مبلغ بسعر يوم قيد التسوية.</p>}
          <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
            {progress && <span className="acc-muted">{progress}</span>}
            <Button onClick={() => setSelected(new Set())} disabled={!!progress}>إلغاء التحديد</Button>
            <Button variant="contained" disabled={!!progress || !target.account || (needsOffice && !target.office)} onClick={settle}>تسوية المحدد</Button>
          </div>
        </Panel>
      )}

      <Panel flush title="البنود المفتوحة" subtitle={data && data.total > rows.length ? `تُعرض أول ${rows.length} من ${data.total}. سوِّ المعروض أو ضيّق البحث.` : undefined}>
        <div className="px-3">
          <FilterBar>
            <TextField placeholder="رقم القيد أو الوصف" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <TextField type="date" label="من" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <TextField type="date" label="إلى" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <Button variant="outlined" onClick={() => load()}>بحث</Button>
            {filters.cause && <Button onClick={() => setCause('')}>إظهار كل الأسباب</Button>}
          </FilterBar>
        </div>
        <DataTable
          selection={{ selected, onChange: setSelected }}
          loading={isLoading}
          rows={rows}
          rowKey={(row: any) => row.id}
          onRowClick={(row: any) => navigate(`/accounting/entries/${row.entryId}`)}
          maxHeight="60vh"
          empty={{ title: 'لا توجد بنود مفتوحة' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (row: any) => <Ltr>{row.day}</Ltr>, sortValue: (row: any) => row.day },
            { key: 'description', header: 'العملية', render: (row: any) => <>{row.description}<Sub><Ltr>{row.number}</Ltr> · {EVENT_LABELS[row.eventType] || row.eventType}</Sub></> },
            { key: 'cause', header: 'السبب', hideOnMobile: true, render: (row: any) => <span className="acc-muted">{row.cause}</span> },
            { key: 'partner', header: 'العميل', hideOnMobile: true, render: (row: any) => (row.partner ? <Open to={`/user/${row.partner._id}`}>{userLabel(row.partner)}</Open> : '') },
            { key: 'foreign', header: 'بعملة العملية', numeric: true, hideOnMobile: true, render: (row: any) => (row.foreign ? <Money value={row.foreign.amount} currency={row.foreign.currency} tone="plain" /> : null) },
            { key: 'debit', header: 'مدين', numeric: true, render: (row: any) => <Money value={row.debit} tone="debit" hideZero />, sortValue: (row: any) => row.debit },
            { key: 'credit', header: 'دائن', numeric: true, render: (row: any) => <Money value={row.credit} tone="credit" hideZero />, sortValue: (row: any) => row.credit },
          ]}
        />
      </Panel>
    </>
  );
};

export default Suspense;
