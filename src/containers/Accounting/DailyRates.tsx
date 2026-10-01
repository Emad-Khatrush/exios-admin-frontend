import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { Lock, Trash2 } from 'lucide-react';
import { acc, errorText, todayLibya } from './accountingApi';
import { useBulk } from './bulk';
import { Badge, DataTable, FilterBar, Ltr, PageHeader, Panel } from './ui';

const DailyRates = () => {
  const [today, setToday] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ currency: '', day: todayLibya(), rate: '' });
  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      const [todayRes, historyRes] = await Promise.all([acc.get('rates/today'), acc.get('rates', { currency: currencyFilter || undefined })]);
      setToday(todayRes.data.results);
      setHistory(historyRes.data.results);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [currencyFilter]);

  const saveRate = async (currency: string, day: string, rate: string) => {
    try {
      await acc.post('rates', { currency, day, rate: Number(rate) });
      setMessage({ type: 'success', text: `حُفظ سعر ${currency} ليوم ${day}.` });
      setInputs((prev) => ({ ...prev, [currency]: '' }));
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const remove = async (rate: any) => {
    if (!window.confirm(`حذف سعر ${rate.currency} ليوم ${rate.day}؟`)) return;
    try {
      await acc.delete(`rates/${rate._id}`);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const bulk = useBulk<any>({
    rows: history,
    rowKey: (row) => row._id,
    rowLabel: (row) => `${row.currency} ${row.day}`,
    onDone: load,
    actions: [{
      key: 'delete', label: 'حذف الأسعار', done: 'حُذف', danger: true, applies: (row) => !row.isUsed,
      run: (row) => acc.delete(`rates/${row._id}`),
      confirm: (count) => `سيُحذف ${count} سعراً لم يُستخدم في أي قيد. عمليات تلك الأيام ستأخذ آخر سعر قبلها.`,
    }],
  });

  return (
    <>
      <PageHeader title="الأسعار اليومية" subtitle="عدد وحدات العملة مقابل دولار واحد (مثلاً دينار 9 = الدولار بـ 9 دنانير). العمليات بدون سعر خاص تستخدم سعر يومها أو آخر سعر قبله. سعر الدينار مصدره واحد: سعر الصرف في الإعدادات العامة؛ حفظه هناك يكتب سعر اليوم هنا، وتعديل سعر اليوم هنا يغيّره هناك." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}

      <div className="acc-stats">
        {today.map((item) => (
          <div key={item.currency} className={`acc-stat${item.isToday ? '' : ' acc-stat--warn'}`}>
            <div className="acc-stat__label">{item.name} · <Ltr>{item.currency}</Ltr></div>
            <div className="acc-stat__value"><Ltr>{item.rate ?? '-'}</Ltr></div>
            <div className="acc-stat__hint">{item.isToday ? 'أُدخل اليوم' : item.rateDay ? <>آخر إدخال <Ltr>{item.rateDay}</Ltr></> : 'لم يُدخل أبداً'}</div>
            <div className="d-flex gap-1 mt-2">
              <TextField type="number" placeholder="سعر اليوم" value={inputs[item.currency] || ''} onChange={(e) => setInputs({ ...inputs, [item.currency]: e.target.value })} />
              <Button variant="contained" disabled={!(Number(inputs[item.currency]) > 0)} onClick={() => saveRate(item.currency, todayLibya(), inputs[item.currency])}>حفظ</Button>
            </div>
          </div>
        ))}
      </div>

      <Panel flush title="سجل الأسعار" subtitle="السعر الذي استُخدم في قيد مُرحَّل يُقفل ولا يُعدَّل؛ التصحيح يكون بقيد.">
        <div className="px-3">
          <FilterBar>
            <TextField select label="العملة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={{ minWidth: 120 }}>
              {today.map((item) => <MenuItem key={item.currency} value={item.currency}>{item.currency}</MenuItem>)}
            </TextField>
            <TextField type="date" label="اليوم" InputLabelProps={{ shrink: true }} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
            <TextField type="number" label="السعر" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <Button variant="outlined" disabled={!form.currency || !(Number(form.rate) > 0)} onClick={() => saveRate(form.currency, form.day, form.rate)}>إضافة / استبدال</Button>
            <span className="ms-auto" />
            <TextField select label="عرض" value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} style={{ minWidth: 120 }}>
              <MenuItem value="">الكل</MenuItem>
              {today.map((item) => <MenuItem key={item.currency} value={item.currency}>{item.currency}</MenuItem>)}
            </TextField>
          </FilterBar>
        </div>
        {bulk.bar}
        <DataTable
          selection={bulk.selection}
          loading={isLoading}
          rows={history}
          rowKey={(row: any) => row._id}
          empty={{ title: 'لا توجد أسعار بعد', hint: 'أدخل سعر اليوم من البطاقات أعلاه.' }}
          columns={[
            { key: 'day', header: 'اليوم', render: (row: any) => <Ltr>{row.day}</Ltr>, sortValue: (row: any) => row.day },
            { key: 'currency', header: 'العملة', render: (row: any) => <Ltr>{row.currency}</Ltr> },
            { key: 'rate', header: 'السعر', numeric: true, render: (row: any) => <span className="money">{row.rate}</span> },
            { key: 'by', header: 'أدخله', hideOnMobile: true, render: (row: any) => <span className="acc-muted">{row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : ''}</span> },
            {
              key: 'state', header: '', align: 'end', render: (row: any) => (row.isUsed
                ? <Tooltip title="مستخدم في قيود مُرحَّلة"><span><Badge tone="muted"><Lock size={12} /> مستخدم</Badge></span></Tooltip>
                : <IconButton size="small" aria-label="حذف" onClick={() => remove(row)}><Trash2 size={15} /></IconButton>),
            },
          ]}
        />
      </Panel>
    </>
  );
};

export default DailyRates;
