import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Button, IconButton, MenuItem, TextField } from '@mui/material';
import { Plus, X } from 'lucide-react';
import { acc, errorText, newKey, todayLibya } from './accountingApi';
import { AccountingAccount, accountLabel, useAccountingData } from './useAccountingData';
import { RemotePicker, userLabel } from './shared';
import { Badge, Money, PageHeader, Panel } from './ui';

type Line = { key: string; accountId: string; side: 'debit' | 'credit'; amount: string; rate: string; office: string; partner: any; label: string; arKey: string };

const blankLine = (side: 'debit' | 'credit'): Line => ({ key: newKey(), accountId: '', side, amount: '', rate: '', office: '', partner: null, label: '', arKey: '' });

// The customer's open claims, for a line on customer receivables that settles one of them
export const ClaimPicker = ({ partnerId, value, onChange }: { partnerId?: string; value: string; onChange: (arKey: string) => void }) => {
  const [claims, setClaims] = useState<any[]>([]);
  useEffect(() => {
    setClaims([]);
    if (partnerId) acc.get('lookup/claims', { partnerId }).then((res: any) => setClaims(res.data.results)).catch(() => {});
  }, [partnerId]);
  return (
    <TextField select label="المطالبة" value={claims.some((c) => c.arKey === value) ? value : ''} disabled={!partnerId} onChange={(e) => onChange(e.target.value)}
      helperText={!partnerId ? 'اختر العميل أولاً' : claims.length ? undefined : 'لا مطالبات مفتوحة'}>
      <MenuItem value="">بدون مطالبة محددة</MenuItem>
      {claims.map((c) => <MenuItem key={c.arKey} value={c.arKey}>{c.label} · مفتوح ${(c.open / 100).toFixed(2)}</MenuItem>)}
    </TextField>
  );
};

const EntryForm = () => {
  const navigate = useNavigate();
  const { accounts, offices, isLoading } = useAccountingData();
  const [date, setDate] = useState(todayLibya());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine('debit'), blankLine('credit')]);
  const [todayRates, setTodayRates] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [receivableCode, setReceivableCode] = useState('');
  // One key per form: pressing save twice never creates two entries
  const idempotencyKey = useRef(newKey());

  useEffect(() => {
    acc.get('rates/today').then((res: any) => {
      const map: Record<string, number> = {};
      res.data.results.forEach((r: any) => { if (r.rate) map[r.currency] = r.rate; });
      setTodayRates(map);
    }).catch(() => {});
    acc.get('settings').then((res: any) => setReceivableCode(res.data.roles?.find((r: any) => r.role === 'customer_receivable')?.account?.code || '')).catch(() => {});
  }, []);

  const postable = useMemo(() => accounts.filter((a) => !a.isGroup && a.isActive && a.allowManualEntry).sort((a, b) => a.code.localeCompare(b.code)), [accounts]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a._id, a])), [accounts]);
  const update = (key: string, change: Partial<Line>) => setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...change } : line)));

  // Dollar estimate of each line; foreign lines without a typed rate use today's rate (preview only)
  const usdOf = (line: Line) => {
    const account = byId.get(line.accountId);
    const amount = Number(line.amount) || 0;
    if (!account || !account.currency || account.currency === 'USD') return Math.round(amount * 100);
    const rate = Number(line.rate) || (date === todayLibya() ? todayRates[account.currency] : 0);
    return rate ? Math.round((amount / rate) * 100) : null;
  };

  const totals = lines.reduce((sum, line) => {
    const usd = usdOf(line);
    if (usd === null) return { ...sum, unknown: true };
    return line.side === 'debit' ? { ...sum, debit: sum.debit + usd } : { ...sum, credit: sum.credit + usd };
  }, { debit: 0, credit: 0, unknown: false });
  const difference = totals.debit - totals.credit;

  const save = async () => {
    try {
      setIsSaving(true);
      setError('');
      const response = await acc.post('entries', {
        date, description, idempotencyKey: idempotencyKey.current,
        lines: lines.map((line) => ({
          accountId: line.accountId, side: line.side, amount: Number(line.amount), rate: Number(line.rate) || undefined,
          office: line.office || undefined, partnerId: line.partner?._id, label: line.label || undefined, arKey: line.arKey || undefined,
        })),
      });
      navigate(`/accounting/entries/${response.data._id}`);
    } catch (err) {
      setError(errorText(err));
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className="acc-empty">جارٍ التحميل…</div>;

  return (
    <>
      <PageHeader title="قيد يدوي" subtitle="للتسويات التي لا يرحّلها النظام تلقائياً. مبالغ الحسابات بغير الدولار تُكتب بعملة الحساب وتُحوَّل بالسعر المكتوب أو سعر ذلك اليوم." />
      {error && <Alert severity="error" className="mb-3">{error}</Alert>}
      <Panel>
        <div className="acc-form-grid mb-3">
          <TextField type="date" label="التاريخ" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="البيان" value={description} onChange={(e) => setDescription(e.target.value)} style={{ gridColumn: 'span 3' }} />
        </div>

        <div className="acc-lines">
          {lines.map((line) => {
            const account = byId.get(line.accountId) as AccountingAccount | undefined;
            const foreign = account?.currency && account.currency !== 'USD';
            const needsOffice = account?.requires?.includes('office');
            const needsPartner = account?.requires?.includes('partner');
            const usd = usdOf(line);
            return (
              <div className="acc-line" key={line.key}>
                <div className="acc-line__row">
                  <Autocomplete
                    size="small" options={postable} value={account || null}
                    getOptionLabel={(option: any) => accountLabel(option)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                    onChange={(_, value: any) => update(line.key, { accountId: value?._id || '', office: value?.office || line.office })}
                    renderInput={(params) => <TextField {...params} label="الحساب" />}
                  />
                  <TextField select value={line.side} label="الجهة" onChange={(e) => update(line.key, { side: e.target.value as any })}>
                    <MenuItem value="debit">مدين</MenuItem>
                    <MenuItem value="credit">دائن</MenuItem>
                  </TextField>
                  <TextField type="number" label={`المبلغ (${account?.currency || 'USD'})`} value={line.amount} onChange={(e) => update(line.key, { amount: e.target.value })}
                    helperText={foreign ? (usd !== null ? <>≈ <Money value={usd} /></> : 'بسعر اليوم') : undefined} />
                  <TextField type="number" label="السعر" value={line.rate} disabled={!foreign} onChange={(e) => update(line.key, { rate: e.target.value })} />
                  <TextField select value={line.office} label={needsOffice ? 'المكتب *' : 'المكتب'} error={needsOffice && !line.office} onChange={(e) => update(line.key, { office: e.target.value })}>
                    <MenuItem value="">-</MenuItem>
                    {offices.filter((o) => o.isActive).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
                  </TextField>
                  <RemotePicker endpoint="lookup/users" label={needsPartner ? 'العميل *' : 'العميل'} value={line.partner} getLabel={userLabel} onChange={(partner) => update(line.key, { partner, arKey: '' })} />
                  {account?.code === receivableCode && <ClaimPicker partnerId={line.partner?._id} value={line.arKey} onChange={(arKey) => update(line.key, { arKey })} />}
                  <TextField label="ملاحظة السطر" value={line.label} onChange={(e) => update(line.key, { label: e.target.value })} />
                  <IconButton size="small" aria-label="حذف السطر" disabled={lines.length <= 2} onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}><X size={16} /></IconButton>
                </div>
              </div>
            );
          })}
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <Button startIcon={<Plus size={16} />} onClick={() => setLines((prev) => [...prev, blankLine(difference > 0 ? 'credit' : 'debit')])}>إضافة سطر</Button>
          <div className="acc-totals">
            <span>مدين <Money value={totals.debit} tone="debit" strong /></span>
            <span>دائن <Money value={totals.credit} tone="credit" strong /></span>
            {totals.unknown ? <Badge tone="info">يُحوَّل عند الحفظ</Badge> : difference === 0 ? <Badge tone="ok">متوازن</Badge> : <Badge tone="danger">فرق <Money value={Math.abs(difference)} /></Badge>}
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button onClick={() => navigate('/accounting/entries')}>رجوع</Button>
          <Button variant="contained" onClick={save} disabled={isSaving || !description.trim() || lines.some((l) => !l.accountId || !(Number(l.amount) > 0))}>
            {isSaving ? 'جارٍ الترحيل…' : 'ترحيل القيد'}
          </Button>
        </div>
      </Panel>
    </>
  );
};

export default EntryForm;
