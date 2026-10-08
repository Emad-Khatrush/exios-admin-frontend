import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import { acc, errorText, todayLibya } from './accountingApi';
import { Badge, Ltr, Money, Notice, PageHeader, Panel, Stat, StatGrid } from './ui';
import { useAccountingAccess } from './useAccountingAccess';
import { arCount } from './shared';

const NEEDS = ['بند واحد يحتاج نظرة', 'بندان يحتاجان نظرة', 'بنود تحتاج نظرة', 'بنداً يحتاج نظرة'];


// The last twelve months, newest first, for the closed/open strip
const lastMonths = () => {
  const [year, month] = todayLibya().split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
};
const monthEndOf = (value: string) => {
  const [y, m] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const previousMonth = () => {
  const [year, month] = todayLibya().split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
};

// Closing (spec 11, E33): a month is locked after its checklist; a year is closed by one entry
// that moves its result to retained earnings.
const Closing = () => {
  const navigate = useNavigate();
  // Reopening a closed year is the owner's emergency action only (decision 65)
  const { isOwner } = useAccountingAccess();
  const [month, setMonth] = useState(previousMonth());
  const [checklist, setChecklist] = useState<any>(null);
  const [year, setYear] = useState(String(Number(todayLibya().slice(0, 4)) - 1));
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState<any>(null);
  const [confirm, setConfirm] = useState<'month' | 'approve' | 'year' | 'reopen' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const loadMonth = async (value = month) => {
    try { setChecklist(null); setChecklist((await acc.get('close/month', { month: value })).data); } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
  };
  const loadYear = async (value = year) => {
    try { setStatus(null); setStatus((await acc.get('close/year', { year: value })).data); } catch (err) { setMessage({ type: 'error', text: errorText(err) }); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMonth(); loadYear(); }, []);

  const run = async () => {
    const action = confirm;
    setConfirm(null);
    try {
      setIsBusy(true);
      if (action === 'month') {
        const res = await acc.post('close/month', { month });
        setMessage({ type: 'success', text: `أُقفل شهر ${month}. الدفاتر مقفلة حتى ${res.data.lockDate}.` });
      } else if (action === 'approve') {
        await acc.post('review/month/approve', { month });
        setMessage({ type: 'success', text: `اعتمدت حسابات ${month} بعد مراجعة النواقص. أي تغير مؤثر يعيد التقرير إلى مؤقت.` });
      } else if (action === 'year') {
        const res = await acc.post('close/year', { year });
        setMessage({ type: 'success', text: `أُقفلت السنة ${year} بالقيد ${res.data.entry.number}.` });
      } else {
        await acc.post('close/year/reopen', { year, reason });
        setMessage({ type: 'success', text: `أُعيد فتح السنة ${year}. صحّح ثم أقفلها من جديد.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsBusy(false);
    setAgreed(false);
    setReason('');
    await Promise.all([loadMonth(), loadYear()]);
  };

  const open = (checklist?.items || []).filter((item: any) => !item.ok);

  return (
    <>
      <PageHeader title="إقفال الشهر والسنة" subtitle="الإقفال يمنع أي قيد في الفترة المقفلة. عمليات المنظومة التي تقع فيها تُرحَّل بأول يوم مفتوح مع ملاحظة." />
      <Notice message={message} onClose={() => setMessage(null)} />
      {checklist?.lockDate && <Alert severity="info" className="mb-3">الدفاتر مقفلة الآن حتى <Ltr>{checklist.lockDate}</Ltr> (شاملاً). لتغيير التاريخ يدوياً: الإعدادات ← عام.</Alert>}

      <Panel
        title="قفل إدخال الشهر"
        subtitle="القفل يحمي الفترة من التعديل، ولا يعني أن الحسابات معتمدة. عالج البنود المتبقية قبل اعتماد الحسابات في القسم التالي."
        actions={<Button variant="contained" disabled={isBusy || !checklist?.canClose || checklist?.alreadyLocked} onClick={() => setConfirm('month')}>إقفال {month}</Button>}
      >
        {/* Which months are closed: everything up to the lock date. A click picks the month */}
        <div className="acc-months mb-3">
          {lastMonths().reverse().map((m) => {
            const closed = !!checklist?.lockDate && checklist.lockDate >= monthEndOf(m);
            const current = m === todayLibya().slice(0, 7);
            return (
              <button key={m} type="button" className={`acc-months__item${closed ? ' is-closed' : ''}${m === month ? ' is-selected' : ''}`} onClick={() => { setMonth(m); loadMonth(m); }} title={closed ? 'مقفل' : current ? 'الشهر الحالي' : 'مفتوح'}>
                <span className="acc-months__label"><Ltr>{m}</Ltr></span>
                <span className="acc-months__state">{closed ? 'مقفل' : current ? 'جارٍ' : 'مفتوح'}</span>
              </button>
            );
          })}
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
          <TextField type="month" label="الشهر" InputLabelProps={{ shrink: true }} value={month} onChange={(e) => { setMonth(e.target.value); if (e.target.value) loadMonth(e.target.value); }} />
          {checklist?.alreadyLocked && <Badge tone="muted">مقفل مسبقاً</Badge>}
          {checklist && !checklist.alreadyLocked && (open.length ? <Badge tone="warn">{arCount(open.length, NEEDS)}</Badge> : <Badge tone="ok">جاهز للإقفال</Badge>)}
        </div>
        {!checklist && <div className="acc-empty">جارٍ الفحص…</div>}
        {checklist && (
          <>
            <StatGrid>
              <Stat label={`إيرادات ${month}`} value={<Money value={checklist.revenue} />} />
              <Stat label={`صافي ربح ${month}`} value={<Money value={checklist.netProfit} />} tone={checklist.netProfit < 0 ? 'danger' : 'accent'} />
            </StatGrid>
            <ul className="acc-checklist">
              {checklist.items.map((item: any) => (
                <li key={item.key} className={item.ok ? 'is-ok' : item.blocking ? 'is-blocking' : 'is-warn'}>
                  {item.ok ? <CheckCircle2 size={18} /> : item.blocking ? <XCircle size={18} /> : <CircleAlert size={18} />}
                  <div>
                    <div>{item.title}</div>
                    {!item.ok && item.detail && <div className="acc-sub">{item.detail}</div>}
                  </div>
                  {!item.ok && item.link && <Button size="small" onClick={() => navigate(item.link)}>فتح</Button>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="اعتماد حسابات الشهر" subtitle="قفل الإدخال يحمي الفترة؛ اعتماد الحسابات يؤكد اكتمال فحوصها ومراجعتها. لا ينشئ قيوداً أو يغيّر الربح.">
        <Alert severity={checklist?.reviewStatus?.status === 'approved' ? 'success' : 'warning'} className="mb-3">
          {checklist?.reviewStatus?.status === 'approved' ? 'حسابات هذا الشهر معتمدة وفق المراجعة المسجلة.' : `حسابات الشهر مؤقتة. ${checklist?.reviewStatus?.blocking ?? '—'} بنداً ينتظر المعالجة.`}
          {checklist?.reviewStatus?.changedSinceApproval && ' تغيرت البيانات منذ الاعتماد السابق؛ أعد مراجعتها.'}
        </Alert>
        <Button onClick={() => navigate(`/accounting/review?from=${month}-01&to=${monthEndOf(month)}`)}>فتح قائمة المراجعة</Button>
        <Button variant="contained" disabled={isBusy || !checklist?.alreadyLocked || checklist?.reviewStatus?.blocking !== 0 || checklist?.reviewStatus?.status === 'approved'} onClick={() => setConfirm('approve')}>اعتماد حسابات {month}</Button>
      </Panel>

      <Panel
        title="إقفال السنة المالية"
        subtitle="قيد واحد في آخر يوم من السنة ينقل أرصدة كل حسابات الإيرادات والمصروفات ومسحوبات الشركاء إلى الأرباح المحتجزة، ثم تُقفل السنة. تقارير السنة المقفلة تبقى تعرض نتيجتها."
        actions={status && (status.closed
          ? (isOwner ? <Button color="error" variant="outlined" disabled={isBusy} onClick={() => setConfirm('reopen')}>إعادة فتح {year}</Button> : <Badge tone="ok">مقفلة</Badge>)
          : <Button variant="contained" disabled={isBusy || !status.ended || !status.accounts} onClick={() => setConfirm('year')}>إقفال {year}</Button>)}
      >
        <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
          <TextField type="number" label="السنة" value={year} onChange={(e) => { setYear(e.target.value); if (/^\d{4}$/.test(e.target.value)) loadYear(e.target.value); }} style={{ width: 130 }} />
          {status && <span className="acc-muted">من <Ltr>{status.start}</Ltr> إلى <Ltr>{status.end}</Ltr></span>}
          {status?.closed && <Badge tone="ok">مقفلة بالقيد <Ltr>{status.entry.number}</Ltr></Badge>}
          {status && !status.closed && !status.ended && <Badge tone="muted">لم تنتهِ بعد</Badge>}
          {status && !status.closed && status.ended && !status.accounts && <Badge tone="muted">لا إيرادات ولا مصروفات في هذه السنة؛ لا شيء لإقفاله</Badge>}
        </div>
        {status && !status.closed && (
          <StatGrid>
            <Stat label="نتيجة غير مقفلة حتى نهاية السنة" value={<Money value={status.profit} />} hint="تشمل أي سنة سابقة لم تُقفل" tone={status.profit < 0 ? 'danger' : 'accent'} />
            <Stat label="مسحوبات الشركاء" value={<Money value={status.withdrawals} />} />
            <Stat label="يُرحَّل للأرباح المحتجزة" value={<Money value={status.toRetained} />} />
          </StatGrid>
        )}
        {status?.closed && <Button size="small" onClick={() => navigate(`/accounting/entries/${status.entry._id}`)}>عرض قيد الإقفال</Button>}
      </Panel>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth dir="rtl">
        <DialogTitle>{confirm === 'approve' ? `اعتماد حسابات ${month}` : confirm === 'month' ? `إقفال شهر ${month}` : confirm === 'year' ? `إقفال السنة ${year}` : `إعادة فتح السنة ${year}`}</DialogTitle>
        <DialogContent>
          {confirm === 'approve' && <Alert severity="info">سيعاد فحص قائمة المراجعة وفحوص الإقفال قبل الاعتماد. التأجيل وحده لا يعالج نقص التكلفة أو فرق المطابقة.</Alert>}
          {confirm === 'month' && <p className="acc-muted">بعد الإقفال لا يُرحَّل ولا يُلغى شيء بتاريخ <Ltr>{checklist?.end}</Ltr> أو قبله. {open.length > 0 && `ما زال هناك ${open.length} بنداً غير مكتمل في القائمة.`}</p>}
          {confirm === 'year' && <p className="acc-muted">سيُنشأ قيد الإقفال بتاريخ <Ltr>{status?.end}</Ltr> وتُقفل الدفاتر حتى ذلك اليوم. التراجع ممكن فقط بإعادة فتح السنة مع ذكر السبب.</p>}
          {confirm === 'reopen' && (
            <>
              <p className="acc-muted">يُعكس قيد الإقفال ويعود تاريخ الإقفال إلى ما قبل بداية السنة، فتُفتح السنة كلها للتصحيح. أقفلها من جديد بعد الانتهاء.</p>
              <TextField label="سبب إعادة الفتح" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} required />
            </>
          )}
          {confirm !== 'reopen' && <FormControlLabel control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />} label={confirm === 'approve' ? 'راجعتُ البنود وأريد اعتماد الحسابات' : 'راجعتُ الأرقام وأريد الإقفال'} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirm(null); setAgreed(false); }}>تراجع</Button>
          <Button variant="contained" color={confirm === 'reopen' ? 'error' : 'primary'} disabled={confirm === 'reopen' ? !reason.trim() : !agreed} onClick={run}>تأكيد</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Closing;
