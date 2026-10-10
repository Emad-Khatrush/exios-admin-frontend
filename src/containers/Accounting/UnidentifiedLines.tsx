import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Radio, RadioGroup, FormControlLabel, TextField } from '@mui/material';
import { acc, CURRENCY_DECIMALS, errorText } from './accountingApi';
import { accountLabel, useAccountingData } from './useAccountingData';
import { useAccountingAccess } from './useAccountingAccess';
import { Badge, DataTable, FilterBar, Ltr, Money, PageHeader, Panel, Stat, StatGrid, Sub } from './ui';
import BankLineDetails from './BankLineDetails';

const usd = (dollars: number) => <Money value={Math.round((dollars || 0) * 100)} currency="USD" />;

// What each final decision does, in words, before the owner confirms it
const effect: Record<string, string> = {
  unallocated_purchase: 'تزيد تكاليف المشتريات وينقص ربح هذا الشهر. لا تتأثر أي طلبية.',
  unallocated_shipping: 'تزيد تكاليف الشحن وينقص ربح هذا الشهر. لا تتأثر أي رحلة.',
  unknown_expense: 'يُسجّل مصروفاً غير معروف المصدر وينقص ربح هذا الشهر. يظهر بوضوح في قائمة الدخل.',
  bank_claim: 'يصبح ديناً على البنك (ليس مصروفاً) حتى يُسترد بالاعتراض.',
  unclaimed_revenue: 'يُسجّل إيراداً من أموال لم يطالب بها أحد ويزيد ربح هذا الشهر. إن ظهر صاحبه لاحقاً يُصحح ويُعاد له.',
  purchase_cost_reduction: 'تنقص تكاليف المشتريات ويزيد ربح هذا الشهر. لا تتأثر أي طلبية.',
  account: 'ينتقل المبلغ إلى الحساب المختار (جاري شريك، قرض...) دون أثر على الربح.',
};

const UnidentifiedLines = () => {
  const navigate = useNavigate();
  const access = useAccountingAccess();
  const { accounts } = useAccountingData();
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState('open');
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<any>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [decision, setDecision] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  // Accounts a decision may move the amount to: no cash, no account needing an order, trip or person
  const otherAccounts = useMemo(() => accounts.filter((a: any) => !a.isGroup && a.isActive && !a.isCash && !(a.requires || []).some((d: string) => d !== 'office')), [accounts]);

  const load = async () => {
    setLoading(true);
    try { setData((await acc.get('bank/unidentified', { state: state || undefined, direction: direction || undefined })).data); }
    catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [state, direction]);

  const decide = async () => {
    setSaving(true);
    try {
      await acc.post(`bank/lines/${decision.row._id}/unidentified-decision`, { kind: decision.kind, accountId: decision.accountId || undefined, reason: decision.reason });
      setDecision(null); setMessage({ type: 'success', text: 'سُجّل القرار بقيد واحد بتاريخ اليوم.' }); await load();
    } catch (err) { setDecision({ ...decision, error: errorText(err) }); }
    setSaving(false);
  };

  const choices = decision ? data?.decisions?.[decision.row.direction] || [] : [];
  return (
    <>
      {detailsId && <BankLineDetails id={detailsId} onClose={() => setDetailsId(null)} onChanged={load} onReview={(line: any) => { setDetailsId(null); navigate(`/accounting/bank?accountId=${line.accountId?._id || line.accountId}`); }} />}
      <PageHeader title="حركات قيد التحديد"
        subtitle="حركات بنك سُجّلت في حساب انتظار لأن أحداً لم يعرف طلبيتها أو رحلتها أو صاحبها بعد. البنك صحيح والربح لم يتأثر. عند معرفة الحقيقة اربطها من شاشتها المعتادة؛ وإن طالت المدة يقرر المالك تصنيفها." />
      {message && <Alert severity={message.type} className="mb-3" onClose={() => setMessage(null)}>{message.text}</Alert>}
      {data && <StatGrid>
        <Stat label="صادر قيد التحديد" value={<Money value={data.summary.openOut} currency="USD" />} hint={`ينتظر حتى ${data.waitingDays.out} يوماً`} />
        <Stat label="وارد قيد التحديد" value={<Money value={data.summary.openIn} currency="USD" />} hint={`ينتظر حتى ${data.waitingDays.in} يوماً`} />
        <Stat label="حركات مفتوحة" value={data.summary.count} />
        <Stat label="تجاوزت المدة" value={data.summary.overdue} tone={data.summary.overdue ? 'danger' : undefined} hint={data.summary.overdue ? 'تحتاج قرار المالك' : undefined} />
      </StatGrid>}
      <Panel flush title="الحركات">
        <FilterBar>
          <TextField select size="small" label="الحالة" value={state} onChange={e => setState(e.target.value)} style={{ minWidth: 180 }}>
            <MenuItem value="open">مفتوحة</MenuItem><MenuItem value="decided">صُنّفت بقرار</MenuItem><MenuItem value="resolved">رُبطت بعملية</MenuItem><MenuItem value="">الكل</MenuItem>
          </TextField>
          <TextField select size="small" label="الاتجاه" value={direction} onChange={e => setDirection(e.target.value)} style={{ minWidth: 140 }}>
            <MenuItem value="">وارد وصادر</MenuItem><MenuItem value="out">صادر</MenuItem><MenuItem value="in">وارد</MenuItem>
          </TextField>
        </FilterBar>
        <DataTable loading={loading} rows={data?.results || []} rowKey={(r: any) => r._id}
          rowTone={(r: any) => (r.state !== 'open' ? 'muted' : undefined)}
          empty={{ title: 'لا حركات هنا', hint: 'من شاشة مطابقة البنك، اضغط «لا أعرف بعد» على أي سطر لا تعرف طلبيته أو رحلته أو صاحبه.' }}
          columns={[
            { key: 'day', header: 'التاريخ', width: 110, render: (r: any) => <><Ltr>{r.day}</Ltr><Sub>منذ {r.age} يوماً</Sub></> },
            { key: 'description', header: 'الحركة', render: (r: any) => <>
              {r.description}{r.reference && <span className="acc-muted"> · <Ltr>{r.reference}</Ltr></span>}
              <Sub>{r.bank?.code} · {r.bank?.name}</Sub>
              <Sub><Badge tone="info">{data?.hints?.[r.hint] || r.hint}</Badge>{r.note && ` ${r.note}`}</Sub>
            </> },
            { key: 'amount', header: 'المبلغ', numeric: true, render: (r: any) => <><Money value={r.amount} currency={r.bank?.currency || 'USD'} decimals={CURRENCY_DECIMALS[r.bank?.currency] ?? 2} tone={r.amount < 0 ? 'credit' : 'debit'} strong />{r.bank?.currency !== 'USD' && <Sub>{usd(r.usd)}</Sub>}</> },
            { key: 'waiting', header: 'المتابعة', width: 230, render: (r: any) => r.state === 'decided'
              ? <><Badge tone="muted">صُنّفت</Badge><Sub>{r.decision?.accountId?.code} · {r.decision?.accountId?.name}</Sub><Sub>{r.decision?.day} · {r.decision?.reason}</Sub></>
              : r.state === 'resolved' ? <Badge tone="ok">رُبطت بعملية</Badge>
                : <>{r.overdue ? <Badge tone="danger">تجاوزت المدة</Badge> : <Badge tone={r.age > 30 ? 'warn' : 'ok'}>{r.age > 30 ? 'تحقيق' : 'متابعة'}</Badge>}<Sub><span style={{ whiteSpace: 'nowrap' }}>القرار مستحق في <Ltr>{r.dueDay}</Ltr></span></Sub><Sub>في حساب: {r.clearingAccount?.name}</Sub>{r.hint === 'refund' && <Sub>عند معرفة الطلبية: أضف الريفاند من تبويبها، واختر هذا المبلغ.</Sub>}</> },
            { key: 'actions', header: '', align: 'end', render: (r: any) => <span className="d-inline-flex gap-1 flex-wrap justify-content-end">
              <Button size="small" onClick={() => setDetailsId(r._id)}>التفاصيل</Button>
              {r.state === 'open' && access.isOwner && <Button size="small" variant="outlined" color={r.overdue ? 'error' : 'primary'} onClick={() => setDecision({ row: r, kind: '', accountId: '', reason: '' })}>قرار نهائي</Button>}
            </span> },
          ]} />
      </Panel>
      <Panel title="كيف تعمل؟">
        <Sub>1. في مطابقة البنك، اضغط «لا أعرف بعد» على السطر. يُسجّل المبلغ في حساب انتظار، فيصبح رصيد البنك صحيحاً دون أي أثر على الربح.</Sub>
        <Sub>2. عندما تعرف الحقيقة: من «التفاصيل» اختر «تصحيح الحساب أو المطابقة»، ثم اربطه بالطلبية أو الرحلة أو الإيداع الصحيح. البنك لا يتحرك مرتين.</Sub>
        <Sub>3. إن مرت {data?.waitingDays?.out ?? 90} يوماً على الصادر أو {data?.waitingDays?.in ?? 365} يوماً على الوارد دون معرفة، يقرر المالك تصنيفه بسبب مكتوب، بقيد واحد بتاريخ القرار.</Sub>
      </Panel>

      <Dialog open={!!decision} onClose={saving ? undefined : () => setDecision(null)} maxWidth="sm" fullWidth>
        <DialogTitle>قرار نهائي<Sub><Ltr>{decision?.row.day}</Ltr> · {decision?.row.description} · {usd(decision?.row.usd)}</Sub></DialogTitle>
        {decision && <DialogContent dividers>
          {decision.row.note && <Alert severity="info" className="mb-2">ملاحظة المتابعة: {decision.row.note}</Alert>}
          <RadioGroup value={decision.kind} onChange={e => setDecision({ ...decision, kind: e.target.value, error: '' })}>
            {choices.map((c: any) => <FormControlLabel key={c.kind} value={c.kind} control={<Radio size="small" />} label={c.label} />)}
          </RadioGroup>
          {decision.kind === 'account' && <Autocomplete size="small" className="mt-2" options={otherAccounts} value={otherAccounts.find((a: any) => a._id === decision.accountId) || null}
            getOptionLabel={(a: any) => accountLabel(a)} isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
            onChange={(_, a: any) => setDecision({ ...decision, accountId: a?._id || '' })} renderInput={(p) => <TextField {...p} label="الحساب" />} />}
          {decision.kind && <Alert severity="warning" className="mt-3"><b>ما سيحدث:</b> يُقفل حساب الانتظار بمبلغ {usd(decision.row.usd)}. {effect[decision.kind]} القيد بتاريخ اليوم، والبنك لا يتحرك.</Alert>}
          <TextField fullWidth multiline minRows={2} className="mt-3" label="سبب القرار (إلزامي)" value={decision.reason} onChange={e => setDecision({ ...decision, reason: e.target.value })} helperText="مثلاً: بحثنا في طلبات 1688 وكشف المورد ولم نجد العملية" />
          {decision.error && <Alert severity="error" className="mt-2">{decision.error}</Alert>}
        </DialogContent>}
        <DialogActions>
          <Button disabled={saving} onClick={() => setDecision(null)}>إلغاء</Button>
          <Button variant="contained" disabled={saving || !decision?.kind || !decision?.reason?.trim() || (decision?.kind === 'account' && !decision?.accountId)} onClick={decide}>{saving ? 'جارٍ الحفظ…' : 'اعتماد القرار'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UnidentifiedLines;
