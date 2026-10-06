import { useEffect, useState } from 'react';
import { Dialog } from '@mui/material';
import { Coins, X } from 'lucide-react';
import api from '../../api';
import { GoalOffice, GoalPeriod, GoalSetting, METRIC_META, METRICS, officeName, PERIOD_WORD } from './goalsData';

type Props = {
  open: boolean
  initialPeriod: GoalPeriod
  onClose: () => void
  onSaved: () => void
};

type Draft = Record<string, { target: string, incentiveLYD: string }>;

const keyOf = (office: string, country: string, metric: string, period: string) => `${office}|${country}|${metric}|${period}`;

// Shipping goals count goods from China; the API stores every goal under it
const country = 'CN';

// Every office's weekly or monthly goals in one form. A change starts with the current week or month.
const GoalsEditor = ({ open, initialPeriod, onClose, onSaved }: Props) => {
  const [period, setPeriod] = useState<GoalPeriod>(initialPeriod);
  const [offices, setOffices] = useState<GoalOffice[]>([]);
  const [saved, setSaved] = useState<Draft>({});
  const [draft, setDraft] = useState<Draft>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setPeriod(initialPeriod);
    setError(undefined);
    setIsLoading(true);
    api.get('goals')
      .then((res: any) => {
        const values: Draft = {};
        (res.data.goals as GoalSetting[]).forEach((goal) => {
          values[keyOf(goal.office, goal.country || country, goal.metric, goal.period)] = { target: String(goal.target || ''), incentiveLYD: String(goal.incentiveLYD || '') };
        });
        const list: GoalOffice[] = res.data.offices || [];
        setOffices(list.map((office) => ({ ...office, name: officeName(list, office.code) })));
        setSaved(values);
        setDraft(values);
      })
      .catch((err: any) => setError(err?.response?.data?.message || 'تعذر تحميل الأهداف'))
      .finally(() => setIsLoading(false));
  }, [open, initialPeriod]);

  const valueOf = (key: string, field: 'target' | 'incentiveLYD') => draft[key]?.[field] ?? '';
  const change = (key: string, field: 'target' | 'incentiveLYD', value: string) =>
    setDraft((current) => ({ ...current, [key]: { ...(current[key] || { target: '', incentiveLYD: '' }), [field]: value } }));

  const changed = Object.keys(draft).filter((key) =>
    (Number(draft[key]?.target) || 0) !== (Number(saved[key]?.target) || 0)
    || (Number(draft[key]?.incentiveLYD) || 0) !== (Number(saved[key]?.incentiveLYD) || 0));

  const invalid = changed.some((key) => Number(draft[key].target) < 0 || Number(draft[key].incentiveLYD) < 0
    || Number.isNaN(Number(draft[key].target || 0)) || Number.isNaN(Number(draft[key].incentiveLYD || 0)));

  const save = async () => {
    if (!changed.length || invalid) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const goals = changed.map((key) => {
        const [office, goalCountry, metric, goalPeriod] = key.split('|');
        return { office, country: goalCountry, metric, period: goalPeriod, target: Number(draft[key].target) || 0, incentiveLYD: Number(draft[key].incentiveLYD) || 0 };
      });
      await api.update('goals', { goals });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر حفظ الأهداف');
    } finally {
      setIsSaving(false);
    }
  };

  const changedHere = changed.filter((key) => key.endsWith(`|${period}`)).length;
  const changedOther = changed.length - changedHere;
  const word = PERIOD_WORD[period];

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} maxWidth="md" fullWidth PaperProps={{ className: 'goal-editor', dir: 'rtl', lang: 'ar' } as any}>
      <header className="goal-editor__head">
        <div>
          <h2>تحديد الأهداف</h2>
          <p>التعديلات تُحتسب من بداية {word} الحالي، والفترات السابقة تبقى على أهدافها.</p>
        </div>
        <button type="button" className="goal-icon-btn" aria-label="إغلاق" onClick={onClose} disabled={isSaving}>
          <X size={16} strokeWidth={2} />
        </button>
      </header>

      <div className="goal-editor__tabs">
        <div className="goal-segment" role="tablist" aria-label="فترة الهدف">
          {(['week', 'month'] as GoalPeriod[]).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={period === value} className={period === value ? 'is-active' : ''} onClick={() => setPeriod(value)}>
              {value === 'week' ? 'الأهداف الأسبوعية' : 'الأهداف الشهرية'}
            </button>
          ))}
        </div>
        {changedOther > 0 && <span className="goal-editor__pending">تعديلات غير محفوظة ({changedOther}) في الأهداف {period === 'week' ? 'الشهرية' : 'الأسبوعية'}</span>}
      </div>

      <p className="goal-editor__scope">المبيعات تحسب كل الفواتير من كل الدول، والشحن (جوي، LCL، FCL) يحسب ما جاء من الصين فقط.</p>

      <div className="goal-editor__body">
        {isLoading ? (
          <div className="goal-skeleton__block goal-skeleton__block--wide" />
        ) : offices.map((office) => (
          <section key={office.code} className="goal-editor__office">
            <h3>{office.name}</h3>
            <div className="goal-editor__grid">
              <span className="goal-editor__col-head">الهدف</span>
              <span className="goal-editor__col-head">الرقم المطلوب</span>
              <span className="goal-editor__col-head">حافز الفريق</span>
              {METRICS.map((metric) => {
                const key = keyOf(office.code, country, metric, period);
                const meta = METRIC_META[metric];
                const id = `goal-${office.code}-${metric}`;
                return (
                  <div key={metric} className="goal-editor__row">
                    <label htmlFor={`${id}-target`} className="goal-editor__metric">
                      <strong>{meta.label}</strong>
                      <span>{meta.hint}</span>
                    </label>
                    <div className="goal-input">
                      <input
                        id={`${id}-target`}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        dir="ltr"
                        value={valueOf(key, 'target')}
                        onChange={(event) => change(key, 'target', event.target.value)}
                      />
                      <span>{meta.unit}</span>
                    </div>
                    <div className="goal-input">
                      <Coins size={14} strokeWidth={2} aria-hidden="true" />
                      <input
                        id={`${id}-incentive`}
                        aria-label={`حافز ${meta.label} لمكتب ${office.name} بالدينار`}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        dir="ltr"
                        value={valueOf(key, 'incentiveLYD')}
                        onChange={(event) => change(key, 'incentiveLYD', event.target.value)}
                      />
                      <span>د.ل</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="goal-editor__foot">
        {error ? <p className="goal-error" role="alert">{error}</p> : <p className="goal-editor__note">اترك الرقم فارغاً أو 0 إذا لا يوجد هدف.</p>}
        <div className="goal-editor__actions">
          <button type="button" className="goal-btn goal-btn--ghost" onClick={onClose} disabled={isSaving}>إلغاء</button>
          <button type="button" className="goal-btn" onClick={save} disabled={!changed.length || invalid || isSaving}>
            {isSaving ? 'جارٍ الحفظ...' : changed.length ? `حفظ التعديلات (${changed.length})` : 'حفظ'}
          </button>
        </div>
      </footer>
    </Dialog>
  );
};

export default GoalsEditor;
