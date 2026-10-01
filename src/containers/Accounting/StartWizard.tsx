import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, TextField } from '@mui/material';
import { Check, CircleDashed, SkipForward } from 'lucide-react';
import { acc, errorText } from './accountingApi';
import { Badge, Ltr, Notice, PageHeader } from './ui';

// What each step asks for, in the words of the person doing it
const HELP: Record<string, string> = {
  offices: 'أنشأ النظام مكتباً لكل فرع وخزينة لكل عملة ظهرت في حركاته. راجعها: أضف ما ينقص وأرشف ما لا يُستخدم.',
  todayRates: 'سعر كل عملة مقابل الدولار اليوم (كم وحدة منها تساوي دولاراً واحداً). بدونها لا تُسجَّل حركات تلك العملة.',
  historicalRates: 'اختياري. ملف Excel بأسعار الأيام الماضية، ليُحوَّل تاريخك بأسعاره الصحيحة. بدونه يُستنتج السعر من العمليات نفسها.',
  tripCosts: 'اختياري. أي خزينة دفعت تكاليف كل رحلة قديمة. القالب معبأ بالرحلات وتكاليفها. بدونه تذهب هذه التكاليف إلى حساب معلّق تسوّيه لاحقاً.',
  counts: 'المبلغ الفعلي في كل خزينة وبنك وAlipay في يوم البدء. يصبح هو الرصيد الافتتاحي. يُدخل عند تشغيل الترحيل التجريبي.',
  dryRun: 'يعيد تسجيل كل تاريخك في الدفاتر دون أن يعتمده، ويعرض تقريراً بالأرقام وما لم يُفهم.',
  commit: 'بعد مراجعة التقرير: الاعتماد يثبّت التاريخ ويبدأ التسجيل التلقائي لكل عملية جديدة.',
  live: 'كل إيداع وطلبية وتسليم ودفعة تُسجَّل قيودها تلقائياً من الآن.',
};

const StepMark = ({ step, index }: { step: any, index: number }) => (
  <span className={`acc-wizard__mark${step.done ? ' is-done' : ''}${step.skipped ? ' is-skipped' : ''}`}>
    {step.skipped ? <SkipForward size={14} /> : step.done ? <Check size={15} /> : index + 1}
  </span>
);

// The start wizard (spec 7-ب.3): eight steps from a fresh setup to live posting. Its state comes
// from the data, so it is always right even when a step was done from another screen.
const StartWizard = () => {
  const [status, setStatus] = useState<any>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<any>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await acc.get('wizard');
      setStatus(res.data);
      setOpen((current) => current || res.data.current);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (action: () => Promise<any>, done?: string) => {
    setIsBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
      if (done) setMessage({ type: 'success', text: done });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setIsBusy(false);
  };

  const mark = (step: string, value: string | null) => run(async () => {
    const res = await acc.post('wizard/mark', { step, value });
    setStatus(res.data);
    setOpen(res.data.current);
  });

  const saveRates = (step: any) => run(async () => {
    const typed = step.detail.currencies.filter((c: any) => Number(rates[c.code]) > 0);
    for (const currency of typed) await acc.post('rates', { currency: currency.code, day: step.detail.day, rate: Number(rates[currency.code]) });
    setRates({});
  }, 'حُفظت أسعار اليوم.');

  const body = (step: any): ReactNode => {
    switch (step.key) {
      case 'offices':
        return (
          <>
            <ul className="acc-wizard__list">
              {step.detail.list.map((office: any) => <li key={office.code}>{office.name} <span className="acc-sub">({office.boxes} خزينة)</span></li>)}
            </ul>
            <div className="acc-wizard__actions">
              <Button component={Link} to="/accounting/settings">إدارة المكاتب والخزائن</Button>
              {step.done
                ? <Button onClick={() => mark('offices', null)} disabled={isBusy}>أعد فتح المراجعة</Button>
                : <Button variant="contained" onClick={() => mark('offices', 'done')} disabled={isBusy}>راجعتها، التالي</Button>}
            </div>
          </>
        );
      case 'todayRates':
        return (
          <>
            <div className="acc-form-grid">
              {step.detail.currencies.map((currency: any) => (
                <TextField
                  key={currency.code} type="number" label={`${currency.name} (${currency.code})`} inputProps={{ min: 0, step: 'any', dir: 'ltr' }}
                  value={rates[currency.code] ?? (currency.rate ?? '')} placeholder="مثلاً 9.27"
                  helperText={currency.rate ? 'محفوظ لليوم' : currency.required ? 'مطلوب: خزائنك تحمل هذه العملة' : 'اختياري'}
                  onChange={(e) => setRates({ ...rates, [currency.code]: e.target.value })}
                />
              ))}
            </div>
            <div className="acc-wizard__actions">
              <Button component={Link} to="/accounting/rates">شاشة الأسعار</Button>
              <Button variant="contained" onClick={() => saveRates(step)} disabled={isBusy || !Object.values(rates).some((v) => Number(v) > 0)}>حفظ أسعار اليوم</Button>
            </div>
          </>
        );
      case 'historicalRates':
      case 'tripCosts':
        return (
          <>
            {step.key === 'historicalRates' && <p className="acc-sub">أسعار مُدخلة قبل اليوم: {step.detail.enteredBefore}</p>}
            {step.key === 'tripCosts' && step.detail.links > 0 && <p className="acc-sub">في آخر ترحيل: {step.detail.links} رحلة مربوطة بخزينتها.</p>}
            <div className="acc-wizard__actions">
              <Button component={Link} to={step.key === 'historicalRates' ? '/accounting/rates' : '/accounting/migration'}>
                {step.key === 'historicalRates' ? 'رفع ملف الأسعار' : 'تنزيل القالب ورفعه'}
              </Button>
              {step.done ? (
                <Button onClick={() => mark(step.key, null)} disabled={isBusy}>تراجع</Button>
              ) : (
                <>
                  <Button onClick={() => mark(step.key, 'skipped')} disabled={isBusy}>تخطي الآن</Button>
                  <Button variant="contained" onClick={() => mark(step.key, 'done')} disabled={isBusy}>تم</Button>
                </>
              )}
            </div>
          </>
        );
      case 'counts':
        return (
          <>
            {step.detail.counts > 0 && <p className="acc-sub">أُدخل جرد {step.detail.counts} حساب{step.detail.countDay ? <> بتاريخ <Ltr>{step.detail.countDay}</Ltr></> : ''}.</p>}
            <div className="acc-wizard__actions">
              {!step.done && <Button onClick={() => mark('counts', 'skipped')} disabled={isBusy}>ليس لدي جرد</Button>}
              {step.skipped && <Button onClick={() => mark('counts', null)} disabled={isBusy}>تراجع</Button>}
              <Button variant="contained" component={Link} to="/accounting/migration">إدخال الجرد في شاشة الترحيل</Button>
            </div>
          </>
        );
      case 'dryRun':
      case 'commit':
        return (
          <>
            {step.key === 'dryRun' && step.detail.status && <p className="acc-sub">آخر تشغيل: <Ltr>{step.detail.runId}</Ltr> ({step.detail.status === 'review' ? 'بانتظار المراجعة' : step.detail.status === 'committed' ? 'معتمد' : 'يعمل'})</p>}
            {step.key === 'commit' && step.detail.migrationDate && <p className="acc-sub">اعتُمد بتاريخ <Ltr>{step.detail.migrationDate}</Ltr>.</p>}
            <div className="acc-wizard__actions">
              <Button variant="contained" component={Link} to="/accounting/migration">{step.key === 'dryRun' ? 'تشغيل الترحيل التجريبي' : 'مراجعة التقرير واعتماده'}</Button>
            </div>
          </>
        );
      default:
        return (
          <div className="acc-wizard__actions">
            <Button variant="contained" component={Link} to="/accounting">لوحة المحاسبة</Button>
          </div>
        );
    }
  };

  const progress = status ? Math.round((status.progress.done / status.progress.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="معالج البدء"
        subtitle="ثماني خطوات من الإعداد إلى التشغيل. حالة كل خطوة تُقرأ من البيانات، فما تنجزه من شاشة أخرى يظهر هنا تلقائياً."
        actions={status?.completed ? <Badge tone="ok">اكتمل</Badge> : <Button component={Link} to="/accounting?later=1">لاحقاً</Button>}
      />
      <Notice message={message} onClose={() => setMessage(null)} />

      <div className="acc-wizard__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="acc-sub mb-3">{status ? `${status.progress.done} من ${status.progress.total} خطوات` : 'جارٍ التحميل…'}</p>

      <ol className="acc-wizard">
        {(status?.steps || []).map((step: any, index: number) => {
          const isOpen = open === step.key;
          return (
            <li key={step.key} className={`acc-wizard__step${isOpen ? ' is-open' : ''}${status.current === step.key ? ' is-current' : ''}`}>
              <button type="button" className="acc-wizard__head" onClick={() => setOpen(isOpen ? null : step.key)} aria-expanded={isOpen}>
                <StepMark step={step} index={index} />
                <span className="acc-wizard__title">{step.title}</span>
                {step.optional && <Badge>اختياري</Badge>}
                {step.skipped && <Badge tone="warn">تُخطّي</Badge>}
                {!step.done && status.current === step.key && <Badge tone="accent">الخطوة الحالية</Badge>}
                {!step.done && status.current !== step.key && <CircleDashed size={14} className="acc-wizard__pending" />}
              </button>
              {isOpen && (
                <div className="acc-wizard__body">
                  <p>{HELP[step.key]}</p>
                  {body(step)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
};

export default StartWizard;
