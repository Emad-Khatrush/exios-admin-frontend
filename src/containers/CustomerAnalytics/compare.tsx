import { count, days, decimal, pct, usd } from './format';
import { Num } from './shared';
import { TargetKey, Targets } from './types';

// The change against the previous period and the saved target, shown under a tile's value.
// The API sends `previous` (same section over the period of equal length just before) when compare is
// on, and `targets` on every answer (CONTRACT.md «Second round»).

export type Unit = 'rate' | 'money' | 'count' | 'days' | 'decimal' | 'rating' | 'ratio'
export type Better = 'up' | 'down'

export const formatUnit = (unit: Unit, v?: number | null) => {
  if (v == null) return '—';
  switch (unit) {
    case 'rate': return pct(v);
    case 'money': return usd(v);
    case 'count': return count(v);
    case 'days': return days(v);
    case 'rating': return `${decimal(v, 1)} / 5`;
    case 'ratio': return `${decimal(v, 1)}×`;
    default: return decimal(v, 2);
  }
};

// Every target the settings accept, how it is written and edited, and which way is good
export const TARGETS: { key: TargetKey, label: string, unit: Unit, better: Better, where: string }[] = [
  { key: 'repeatRate', label: 'نسبة من طلب أكثر من مرة', unit: 'rate', better: 'up', where: 'رجوع العملاء' },
  { key: 'returningRate', label: 'نسبة العملاء القدامى', unit: 'rate', better: 'up', where: 'رجوع العملاء' },
  { key: 'month1Retention', label: 'الاحتفاظ بعد شهر', unit: 'rate', better: 'up', where: 'الاحتفاظ' },
  { key: 'conversionRate', label: 'نسبة من طلب بعد التسجيل', unit: 'rate', better: 'up', where: 'من التسجيل إلى الطلب' },
  { key: 'medianDaysToFirstOrder', label: 'المدة حتى أول طلب', unit: 'days', better: 'down', where: 'من التسجيل إلى الطلب' },
  { key: 'lostCustomers', label: 'عملاء توقفوا', unit: 'count', better: 'down', where: 'العملاء الخاملون' },
  { key: 'atRiskCustomers', label: 'عملاء في خطر التوقف', unit: 'count', better: 'down', where: 'العملاء الخاملون' },
  { key: 'avgOrderCents', label: 'متوسط قيمة الطلب', unit: 'money', better: 'up', where: 'قيمة العميل' },
  { key: 'ordersPerCustomer', label: 'طلبات لكل عميل في الفترة', unit: 'decimal', better: 'up', where: 'قيمة العميل' },
  { key: 'cacCents', label: 'تكلفة جلب العميل', unit: 'money', better: 'down', where: 'تكلفة جلب العميل' },
  { key: 'valueToCac', label: 'القيمة ÷ التكلفة', unit: 'ratio', better: 'up', where: 'تكلفة جلب العميل' },
  { key: 'medianDeliveryDays', label: 'مدة التوصيل (الوسيط)', unit: 'days', better: 'down', where: 'مدة التوصيل' },
  { key: 'avgRating', label: 'متوسط التقييم', unit: 'rating', better: 'up', where: 'التقييمات' },
];
const TARGET_BY_KEY = new Map(TARGETS.map((t) => [t.key, t]));

const at = (obj: any, path: string): number | null => {
  const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

// ▲/▼ with % (points for rates, the plain difference for ratings), coloured by whether it is good
export const Change = ({ now, before, unit, better }: { now: number | null, before: number | null, unit: Unit, better: Better }) => {
  if (now == null || before == null) return null;
  const diff = now - before;
  let text: string;
  if (unit === 'rate') text = `${decimal(Math.abs(diff) * 100, 1)} نقطة`;
  else if (unit === 'rating') text = decimal(Math.abs(diff), 2);
  else if (before !== 0) text = `${decimal(Math.abs(diff / before) * 100, 1)}%`;
  else return null;
  const still = Math.abs(diff) < 1e-9 || text === '0 نقطة' || text === '0%' || text === '0';
  const good = (diff > 0) === (better === 'up');
  const was = `الفترة السابقة: ${formatUnit(unit, before)}`;
  if (still) return <span className="ca-vs is-same" title={was}>= <span>كالفترة السابقة</span></span>;
  return (
    <span className={`ca-vs ${good ? 'is-good' : 'is-bad'}`} title={was}>
      <span aria-hidden="true">{diff > 0 ? '▲' : '▼'}</span>
      <span className="ca-sr">{diff > 0 ? 'ارتفع' : 'انخفض'}</span>
      {' '}<Num>{text}</Num> <small>عن الفترة السابقة (<Num>{formatUnit(unit, before)}</Num>)</small>
    </span>
  );
};

// «الهدف: …» with ✓ when reached, ✗ when not
export const TargetMark = ({ now, target, unit, better }: { now: number | null, target: number | null | undefined, unit: Unit, better: Better }) => {
  if (target == null) return null;
  const met = now == null ? null : better === 'up' ? now >= target : now <= target;
  return (
    <span className={`ca-target${met == null ? '' : met ? ' is-good' : ' is-bad'}`}>
      الهدف: <Num>{formatUnit(unit, target)}</Num>
      {met != null && <span className="ca-target__mark" aria-label={met ? 'تحقق' : 'لم يتحقق'}>{met ? '✓' : '✗'}</span>}
    </span>
  );
};

type Answer = { previous?: Record<string, any> | null, targets?: Targets }

// For a tile: reads the value at `path` now and in `previous`, and the target `target` (when given).
// `unit`/`better` come from the target's definition unless given.
export const Versus = ({ data, path, target, unit, better }: { data: Answer, path: string, target?: TargetKey, unit?: Unit, better?: Better }) => {
  const def = target ? TARGET_BY_KEY.get(target) : undefined;
  const u = unit || def?.unit || 'count';
  const b = better || def?.better || 'up';
  const now = at(data, path);
  const before = data.previous ? at(data.previous, path) : null;
  const goal = target ? data.targets?.[target] : null;
  if (before == null && goal == null) return null;
  return (
    <span className="ca-tile__foot">
      <Change now={now} before={before} unit={u} better={b} />
      <TargetMark now={now} target={goal} unit={u} better={b} />
    </span>
  );
};
