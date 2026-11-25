import { Alert } from '@mui/material';
import {
  ArrowRight, Banknote, Container as ContainerIcon, Copy, DollarSign, Landmark, MessageCircle, Plane, Plus, RefreshCw, Save, ShoppingBag, Ship, Trash2,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api from '../../api';
import './SettingsCommon.scss';
import './CustomerPrices.scss';

type Tier = { upTo: number | null, type?: 'fixed' | 'percent', value?: number, rate?: number, fee?: number };
type Category = { key: string, label: string, price: number };
type Route = { key: string, label: string, method: 'air' | 'sea', unit: 'kg' | 'cbm', price: number, visible: boolean, duration: string, note: string, minCharge: number, minWeight?: number, message?: string, categories: Category[], carrier?: string, updatedAt?: string };
// A full-container offer: one container type on one shipping line between two ports
type Offer = {
  key: string, label: string, carrier: string, fromPort: string, toPort: string, route: string,
  price: number, duration: string, visible: boolean, pricesUpdatedAt?: string,
};
// A shopping site: the site's own fee, and its own commission in place of the brackets when set
type SiteCommission = 'default' | 'none' | 'percent' | 'fixed';
type Site = { key: string, label: string, feePercent: number, commission?: SiteCommission, commissionValue?: number, freeShipping?: boolean };
// Suggestions only: any line, port or site can be typed
const SITES = ['شي ان - Shein', 'علي بابا', 'موقع 1688 او Taobao', 'علي إكسبريس - AliExpress', 'تيمو - Temu', 'أمازون - Amazon', 'ترينديول - Trendyol', 'آي هيرب - iHerb', 'إيباي - eBay', 'مواقع أخرى'];
const CONTAINER_TYPES = ['حاوية 20 قدم', 'حاوية 40 قدم', 'حاوية 40 قدم عالية (HQ)'];
const CARRIERS = ['MSC', 'Maersk', 'CMA CGM', 'COSCO', 'Hapag-Lloyd', 'ONE', 'Evergreen', 'Yang Ming', 'ZIM', 'Arkas'];
const AIRLINES = ['Turkish Airlines', 'Emirates', 'Qatar Airways', 'Etihad', 'EgyptAir', 'Libyan Airlines', 'China Southern', 'China Eastern'];
const FROM_PORTS = ['شنغهاي', 'نينغبو', 'شنتشن', 'قوانغتشو', 'تشينغداو', 'شيامن', 'تيانجين', 'إسطنبول', 'مرسين', 'جبل علي'];
const TO_PORTS = ['طرابلس', 'مصراتة', 'بنغازي', 'الخمس'];
const updatedOn = (value?: string) => (value
  ? new Intl.DateTimeFormat('ar-LY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
  : '');

// What a customer pays on top, in qirsh (1/100 dinar) a dollar, by where they pay
type Delivery = { libya: number, turkey: number };

type Config = {
  // current: what customers see; own: set on this page (else it follows accounting); accounting: reference only
  exchangeRate: { visible: boolean, current: { rate: number, updatedAt: string } | null, own?: boolean, accounting?: { rate: number } | null },
  shipping: { visible: boolean, note: string, volumetricDivisor: number, routes: Route[], delivery?: Delivery },
  purchase: { visible: boolean, note: string, minCommission: number, tiers: Tier[], sites: Site[], delivery?: Delivery },
  alipay: { visible: boolean, note: string, tiers: Tier[], delivery?: Delivery },
  swift: { visible: boolean, note: string, tiers: Tier[], fixedFee: number, minFee: number, delivery?: Delivery },
  fcl: { visible: boolean, note: string, containers: Offer[] },
  offices: { key: string, label: string, whatsapp: string, cities: string[] }[],
  updatedAt?: string,
};

const messageOf = (error: any) => {
  const message = error?.response?.data?.message || error?.data?.message;
  if (message === 'permission-denied') return 'ليست لديك صلاحية تعديل الأسعار.';
  return message || 'تعذر الاتصال بالخادم. حاول مرة أخرى.';
};
const n = (v: string) => (v === '' ? 0 : Number(v));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const Switch = ({ checked, onChange, label }: { checked: boolean, onChange: (v: boolean) => void, label: string }) => (
  <span className="cp-switch">
    <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    <span className="cp-switch__track" aria-hidden><span className="cp-switch__thumb" /></span>
  </span>
);

const NumberField = ({ label, value, onChange, unit, step = 'any', min = 0, placeholder, wide }: {
  label: string, value: number | null | undefined, onChange: (v: number) => void, unit?: string, step?: string, min?: number, placeholder?: string, wide?: boolean,
}) => (
  <label className={`cp-field${wide ? ' cp-field--wide' : ''}`}>
    <span>{label}</span>
    <span className="cp-input">
      <input type="number" dir="ltr" inputMode="decimal" step={step} min={min} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(n(e.target.value))} />
      {unit && <em>{unit}</em>}
    </span>
  </label>
);

const TextField = ({ label, value, onChange, placeholder, wide, multiline, dir, list }: {
  label: string, value: string, onChange: (v: string) => void, placeholder?: string, wide?: boolean, multiline?: boolean, dir?: string, list?: string,
}) => (
  <label className={`cp-field${wide ? ' cp-field--wide' : ''}`}>
    <span>{label}</span>
    {multiline
      ? <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} dir={dir || 'auto'} />
      : <input type="text" value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} dir={dir || 'auto'} />}
  </label>
);

const Suggestions = ({ id, items }: { id: string, items: string[] }) => (
  <datalist id={id}>{items.map((v) => <option key={v} value={v} />)}</datalist>
);

const Section = ({ icon, title, sub, visible, onVisible, children }: {
  icon: ReactNode, title: string, sub: string, visible?: boolean, onVisible?: (v: boolean) => void, children: ReactNode,
}) => (
  <section className={`cp-card${visible === false ? ' is-hidden' : ''}`}>
    <header className="cp-card__head">
      <span className="cp-card__icon">{icon}</span>
      <div className="cp-card__title">
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {onVisible && (
        <span className="cp-visibility">
          <small>{visible ? 'ظاهر للعملاء' : 'مخفي'}</small>
          <Switch checked={!!visible} onChange={onVisible} label={`إظهار ${title} للعملاء`} />
        </span>
      )}
    </header>
    <div className="cp-card__body">{children}</div>
  </section>
);

// The qirsh a dollar added by where the customer pays. 10 qirsh on a $100 total = $100 + 10 LYD.
const DeliveryFields = ({ value, onChange, of }: { value?: Delivery, onChange: (v: Delivery) => void, of: string }) => {
  const v = value || { libya: 0, turkey: 0 };
  // $100 x q qirsh = q x 100 / 100 LYD = q LYD
  const example = (q: number) => (q ? `فاتورة 100$ = 100$ + ${Math.round(q * 100) / 100} د.ل` : 'لا يُضاف شيء');
  return (
    <>
      <h3 className="cp-subtitle">فرق القروش حسب مكان التسليم</h3>
      <div className="cp-row">
        <NumberField label="فرق قروش تسليم ليبيا" value={v.libya} unit="قرش / دولار" step="1" placeholder="0" onChange={(x) => onChange({ ...v, libya: x })} />
        <NumberField label="فرق قروش تسليم تركيا (مكاتب الصرافة)" value={v.turkey} unit="قرش / دولار" step="1" placeholder="0" onChange={(x) => onChange({ ...v, turkey: x })} />
      </div>
      <p className="cp-hint">
        يُضاف بالدينار على كل دولار من إجمالي {of}، حسب مكان تسليم العميل للمبلغ. ليبيا: {example(v.libya)}. تركيا (عبر مكاتب الصرافة): {example(v.turkey)}.
        الحاسبة في التطبيق تعرض المبلغين معاً.
      </p>
    </>
  );
};

// Brackets: "up to X" rows, then a last "and above" row that cannot be removed
const TierRows = ({ tiers, onChange, unit, render }: {
  tiers: Tier[], onChange: (t: Tier[]) => void, unit: string, render: (t: Tier, set: (patch: Partial<Tier>) => void) => ReactNode,
}) => {
  const bounded = tiers.filter((t) => t.upTo !== null);
  const open = tiers.find((t) => t.upTo === null) || { upTo: null };
  const set = (i: number, patch: Partial<Tier>) => {
    const next = [...bounded]; next[i] = { ...next[i], ...patch }; onChange([...next, open]);
  };
  const lastBound = bounded.length ? bounded[bounded.length - 1].upTo || 0 : 0;
  return (
    <div className="cp-tiers">
      {bounded.map((t, i) => (
        <div key={i} className="cp-tier">
          <NumberField label={i === 0 ? 'حتى' : `من ${bounded[i - 1].upTo || 0} حتى`} value={t.upTo} unit={unit} onChange={(v) => set(i, { upTo: v })} />
          {render(t, (patch) => set(i, patch))}
          <button type="button" className="cp-icon-btn" aria-label="حذف الشريحة" onClick={() => onChange([...bounded.filter((_, j) => j !== i), open])}><Trash2 size={16} /></button>
        </div>
      ))}
      <div className="cp-tier cp-tier--open">
        <div className="cp-field"><span>الشريحة الأخيرة</span><strong className="cp-open-label">أكثر من {lastBound} {unit}</strong></div>
        {render(open, (patch) => onChange([...bounded, { ...open, ...patch }]))}
        <span className="cp-icon-btn cp-icon-btn--ghost" />
      </div>
      <button type="button" className="cp-add" onClick={() => onChange([...bounded, { ...(bounded[bounded.length - 1] || open), upTo: (lastBound || 0) * 2 || 1000 }, open])}>
        <Plus size={15} /> أضف شريحة
      </button>
    </div>
  );
};

// Settings > Customer prices: everything the customer Prices page shows, each part can be hidden
const CustomerPrices = () => {
  const [saved, setSaved] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('pricing/config');
      setSaved(res.data); setDraft(clone(res.data));
    } catch (err) { setError(messageOf(err)); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = <K extends keyof Config>(key: K, value: Partial<Config[K]>) => {
    setDraft((d) => (d ? { ...d, [key]: Array.isArray(value) ? value : { ...(d[key] as any), ...value } } : d));
    setNotice(''); setError('');
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await api.update('pricing/config', {
        exchangeRate: { visible: draft.exchangeRate.visible, rate: draft.exchangeRate.current?.rate },
        shipping: draft.shipping,
        purchase: draft.purchase,
        alipay: draft.alipay,
        swift: draft.swift,
        fcl: draft.fcl,
        offices: draft.offices,
      });
      setSaved(res.data); setDraft(clone(res.data));
      setNotice('حُفظت الأسعار. تظهر للعملاء فوراً عند فتح صفحة الأسعار.');
    } catch (err) { setError(messageOf(err)); }
    setSaving(false);
  };

  const header = (
    <>
      <Link className="settings-page__back" to="/settings"><ArrowRight size={15} /> الإعدادات</Link>
      <header className="cp-header">
        <div>
          <h1>الأسعار</h1>
          <p>أسعار الشحن التي تقرؤها الفواتير، وكل ما يظهر في صفحة الأسعار والحاسبة في تطبيق العميل. أخفِ أي قسم عن العملاء بالمفتاح بجانبه.</p>
        </div>
        <button type="button" className="cp-btn cp-btn--quiet" disabled={loading || saving}
          onClick={() => { if (!dirty || window.confirm('التحديث سيتجاهل تعديلاتك غير المحفوظة. متابعة؟')) void load(); }}>
          <RefreshCw size={15} className={loading && draft ? 'cp-spin' : ''} /> تحديث
        </button>
      </header>
    </>
  );

  if (!draft) {
    return (
      <div className="settings-page cp" dir="rtl" lang="ar">
        {header}
        {error ? <Alert severity="error">{error}</Alert> : (
          <div className="cp-grid" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="cp-skel" style={{ animationDelay: `${i * 100}ms` }} />)}</div>
        )}
      </div>
    );
  }

  const d = draft;
  return (
    <div className="settings-page cp" dir="rtl" lang="ar">
      {header}
      {error && <Alert severity="error" className="cp-alert" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" className="cp-alert" onClose={() => setNotice('')}>{notice}</Alert>}

      <div className="cp-grid">
        {/* Exchange rate */}
        <Section icon={<DollarSign size={18} />} title="سعر الصرف للعملاء" sub="سعر الدولار بالدينار الذي يراه العملاء في أعلى صفحة الأسعار."
          visible={d.exchangeRate.visible} onVisible={(v) => patch('exchangeRate', { visible: v })}>
          <div className="cp-row">
            <NumberField label="1 دولار =" value={d.exchangeRate.current?.rate ?? null} unit="د.ل" step="0.01"
              onChange={(v) => patch('exchangeRate', { current: { rate: v, updatedAt: d.exchangeRate.current?.updatedAt || '' } })} />
          </div>
          <p className="cp-hint">
            للعملاء فقط، ولا يغيّر سعر المحاسبة (يُغيَّر من أسعار الصرف في المحاسبة).
            {!d.exchangeRate.own && ' لم يُحدَّد بعد: يظهر للعملاء سعر المحاسبة حتى تكتب سعراً هنا.'}
            {d.exchangeRate.accounting?.rate ? <> سعر المحاسبة الآن <bdi dir="ltr">{d.exchangeRate.accounting.rate}</bdi> د.ل.</> : null}
          </p>
        </Section>

        {/* Shipping */}
        <Section icon={<Plane size={18} />} title="أسعار الشحن" sub="السعر هنا هو نفسه الذي تقرؤه الفواتير لكل خط."
          visible={d.shipping.visible} onVisible={(v) => patch('shipping', { visible: v })}>
          {/* Shared by the shipping routes here and the FCL offers below */}
          <Suggestions id="cp-carriers" items={CARRIERS} />
          <Suggestions id="cp-airlines" items={AIRLINES} />
          <div className="cp-routes">
            {d.shipping.routes.map((r, i) => {
              const set = (p: Partial<Route>) => { const routes = [...d.shipping.routes]; routes[i] = { ...r, ...p }; patch('shipping', { routes }); };
              return (
                <div key={r.key} className={`cp-route${r.visible ? '' : ' is-hidden'}`}>
                  <div className="cp-route__head">
                    <span className="cp-route__icon">{r.method === 'sea' ? <Ship size={16} /> : <Plane size={16} />}</span>
                    <strong>{r.label}</strong>
                    {r.updatedAt && <small className="cp-updated">آخر تغيير للسعر {updatedOn(r.updatedAt)}</small>}
                    <span className="cp-visibility"><small>{r.visible ? 'ظاهر' : 'مخفي'}</small><Switch checked={r.visible} onChange={(v) => set({ visible: v })} label={`إظهار ${r.label}`} /></span>
                  </div>
                  <div className="cp-kinds">
                    {r.categories.map((c, ci) => {
                      const setKind = (p: Partial<Category>) => { const categories = [...r.categories]; categories[ci] = { ...c, ...p }; set({ categories }); };
                      return (
                        <div key={ci} className="cp-kind">
                          <TextField label={ci === 0 ? 'النوع الأساسي (سعر الفواتير)' : 'نوع البضاعة'} value={c.label} placeholder="بضائع عادية" onChange={(v) => setKind({ label: v })} />
                          <NumberField label="السعر" value={c.price} unit={r.unit === 'kg' ? '$ / كجم' : '$ / CBM'} onChange={(v) => setKind({ price: v })} />
                          {ci === 0
                            ? <span className="cp-icon-btn cp-icon-btn--ghost" />
                            : <button type="button" className="cp-icon-btn" aria-label="حذف النوع" onClick={() => set({ categories: r.categories.filter((_, j) => j !== ci) })}><Trash2 size={16} /></button>}
                        </div>
                      );
                    })}
                    <button type="button" className="cp-add" onClick={() => set({ categories: [...r.categories, { key: `kind-${Date.now()}`, label: '', price: 0 }] })}><Plus size={15} /> أضف نوع بضاعة</button>
                    <p className="cp-hint">النوع الذي سعره صفر لا يظهر للعملاء.</p>
                  </div>
                  <div className="cp-row">
                    <TextField
                      label={r.method === 'sea' ? 'الخط الملاحي (الشحن المشترك)' : 'شركة الطيران'}
                      value={r.carrier || ''}
                      list={r.method === 'sea' ? 'cp-carriers' : 'cp-airlines'}
                      dir="auto"
                      placeholder={r.method === 'sea' ? 'COSCO' : 'Turkish Airlines'}
                      onChange={(v) => set({ carrier: v })}
                    />
                    <TextField label="المدة" value={r.duration} placeholder="15 - 20 يوماً" onChange={(v) => set({ duration: v })} />
                    <NumberField label="أقل تكلفة للشحنة" value={r.minCharge} unit="$" onChange={(v) => set({ minCharge: v })} />
                    <NumberField label={r.unit === 'kg' ? 'أقل وزن للشحن' : 'أقل حجم للشحن'} value={r.minWeight || 0} unit={r.unit === 'kg' ? 'كجم' : 'CBM'}
                      placeholder="0 = بدون" onChange={(v) => set({ minWeight: v })} />
                  </div>
                  <TextField label="ملاحظة تظهر تحت الخط" value={r.note} multiline wide onChange={(v) => set({ note: v })} />
                  <TextField label="نص رسالة «وصلت طلبيتك للمخزن»" value={r.message || ''} multiline wide
                    placeholder={`سعر الشحن: ${r.price || 0} دولار / ${r.unit === 'kg' ? 'كجم' : 'متر مكعب'}`} onChange={(v) => set({ message: v })} />
                  <p className="cp-hint">يُضاف لرسالة وصول الطلبية للمخزن التي يرسلها الموظف من صفحة الطلبية. فارغ = سطر السعر كما في المثال. لا يظهر في صفحة الأسعار.</p>
                </div>
              );
            })}
          </div>
          <div className="cp-row">
            <NumberField label="قاسم الوزن الحجمي (جوي)" value={d.shipping.volumetricDivisor} step="1" min={1000} onChange={(v) => patch('shipping', { volumetricDivisor: v })} />
            <TextField label="ملاحظة عامة للشحن" value={d.shipping.note} wide multiline onChange={(v) => patch('shipping', { note: v })} />
          </div>
          <DeliveryFields value={d.shipping.delivery} of="تكلفة الشحن" onChange={(delivery) => patch('shipping', { delivery })} />
        </Section>

        {/* Purchase */}
        <Section icon={<ShoppingBag size={18} />} title="عمولات الشراء" sub="عمولة الشراء حسب قيمة الفاتورة بالدولار."
          visible={d.purchase.visible} onVisible={(v) => patch('purchase', { visible: v })}>
          <TierRows tiers={d.purchase.tiers} unit="$" onChange={(tiers) => patch('purchase', { tiers })} render={(t, set) => (
            <>
              <label className="cp-field">
                <span>نوع العمولة</span>
                <select value={t.type || 'percent'} onChange={(e) => set({ type: e.target.value as any })}>
                  <option value="percent">نسبة %</option>
                  <option value="fixed">مبلغ ثابت $</option>
                </select>
              </label>
              <NumberField label="العمولة" value={t.value} unit={t.type === 'fixed' ? '$' : '%'} onChange={(v) => set({ value: v })} />
            </>
          )} />
          <div className="cp-row">
            <NumberField label="أقل عمولة" value={d.purchase.minCommission} unit="$" onChange={(v) => patch('purchase', { minCommission: v })} />
          </div>
          <h3 className="cp-subtitle">المواقع</h3>
          <p className="cp-hint">لكل موقع رسومه، ويمكن أن تكون له عمولة خاصة بدل الشرائح أعلاه، مثل شي ان بدون عمولة وشحن مجاني.</p>
          <Suggestions id="cp-sites" items={SITES} />
          <div className="cp-list">
            {d.purchase.sites.map((s, i) => {
              const set = (p: Partial<Site>) => { const sites = [...d.purchase.sites]; sites[i] = { ...s, ...p }; patch('purchase', { sites }); };
              const commission = s.commission || 'default';
              return (
                <div key={s.key || i} className="cp-site">
                  <div className="cp-row cp-row--item">
                    <TextField label="الموقع" value={s.label} list="cp-sites" placeholder="اختر أو اكتب اسم الموقع" onChange={(v) => set({ label: v })} />
                    <NumberField label="رسوم الموقع" value={s.feePercent} unit="%" onChange={(v) => set({ feePercent: v })} />
                    <button type="button" className="cp-icon-btn" aria-label="حذف الموقع" onClick={() => patch('purchase', { sites: d.purchase.sites.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                  </div>
                  <div className="cp-row cp-row--item">
                    <label className="cp-field">
                      <span>عمولة الشراء</span>
                      <select value={commission} onChange={(e) => set({ commission: e.target.value as SiteCommission, commissionValue: 0 })}>
                        <option value="default">العمولة العادية (الشرائح)</option>
                        <option value="none">بدون عمولة</option>
                        <option value="percent">عمولة خاصة: نسبة %</option>
                        <option value="fixed">عمولة خاصة: مبلغ ثابت $</option>
                      </select>
                    </label>
                    {commission === 'percent' || commission === 'fixed'
                      ? <NumberField label="العمولة الخاصة" value={s.commissionValue || 0} unit={commission === 'fixed' ? '$' : '%'} onChange={(v) => set({ commissionValue: v })} />
                      : <span />}
                    <span className="cp-site__ship">
                      <Switch checked={!!s.freeShipping} onChange={(v) => set({ freeShipping: v })} label={`شحن مجاني من ${s.label || 'الموقع'}`} />
                      <small>شحن مجاني</small>
                    </span>
                  </div>
                </div>
              );
            })}
            <button type="button" className="cp-add" onClick={() => patch('purchase', { sites: [...d.purchase.sites, { key: `site-${Date.now()}`, label: '', feePercent: 0, commission: 'default', commissionValue: 0, freeShipping: false }] })}><Plus size={15} /> أضف موقعاً</button>
          </div>
          <p className="cp-hint">«أقل عمولة» تُطبَّق على العمولة الخاصة أيضاً، ولا تُطبَّق على «بدون عمولة».</p>
          <DeliveryFields value={d.purchase.delivery} of="الفاتورة (المشتريات ورسوم الموقع والعمولة)" onChange={(delivery) => patch('purchase', { delivery })} />
          <TextField label="ملاحظة" value={d.purchase.note} wide multiline onChange={(v) => patch('purchase', { note: v })} />
        </Section>

        {/* Alipay */}
        <Section icon={<Banknote size={18} />} title="حوالات علي باي" sub="الشرائح حسب المبلغ باليوان: سعر اليوان لكل دولار ورسوم ثابتة بالدولار."
          visible={d.alipay.visible} onVisible={(v) => patch('alipay', { visible: v })}>
          <TierRows tiers={d.alipay.tiers} unit="¥" onChange={(tiers) => patch('alipay', { tiers })} render={(t, set) => (
            <>
              <NumberField label="يوان لكل دولار" value={t.rate} unit="¥" onChange={(v) => set({ rate: v })} />
              <NumberField label="الرسوم" value={t.fee} unit="$" onChange={(v) => set({ fee: v })} />
            </>
          )} />
          <DeliveryFields value={d.alipay.delivery} of="الحوالة بالدولار مع رسومها" onChange={(delivery) => patch('alipay', { delivery })} />
          <TextField label="ملاحظة" value={d.alipay.note} wide multiline onChange={(v) => patch('alipay', { note: v })} />
        </Section>

        {/* SWIFT */}
        <Section icon={<Landmark size={18} />} title="حوالات سويفت" sub="العمولة حسب مبلغ الحوالة بالدولار، ثم تُضاف الرسوم البنكية الثابتة."
          visible={d.swift.visible} onVisible={(v) => patch('swift', { visible: v })}>
          <TierRows tiers={d.swift.tiers} unit="$" onChange={(tiers) => patch('swift', { tiers })} render={(t, set) => (
            <>
              <label className="cp-field">
                <span>نوع العمولة</span>
                <select value={t.type || 'percent'} onChange={(e) => set({ type: e.target.value as any })}>
                  <option value="percent">نسبة %</option>
                  <option value="fixed">مبلغ ثابت $</option>
                </select>
              </label>
              <NumberField label="العمولة" value={t.value} unit={t.type === 'fixed' ? '$' : '%'} onChange={(v) => set({ value: v })} />
            </>
          )} />
          <div className="cp-row">
            <NumberField label="أقل عمولة" value={d.swift.minFee} unit="$" onChange={(v) => patch('swift', { minFee: v })} />
            <NumberField label="رسوم بنكية ثابتة" value={d.swift.fixedFee} unit="$" onChange={(v) => patch('swift', { fixedFee: v })} />
          </div>
          <DeliveryFields value={d.swift.delivery} of="الحوالة مع عمولتها ورسومها" onChange={(delivery) => patch('swift', { delivery })} />
          <TextField label="ملاحظة" value={d.swift.note} wide multiline onChange={(v) => patch('swift', { note: v })} />
        </Section>

        {/* FCL */}
        <Section icon={<ContainerIcon size={18} />} title="الحاويات الكاملة FCL" sub="كل سطر عرض: نوع حاوية على خط ملاحي من ميناء إلى ميناء بسعره. لا يظهر العرض للعملاء حتى تضع له سعراً."
          visible={d.fcl.visible} onVisible={(v) => patch('fcl', { visible: v })}>
          <Suggestions id="cp-container-types" items={CONTAINER_TYPES} />
          <Suggestions id="cp-from-ports" items={FROM_PORTS} />
          <Suggestions id="cp-to-ports" items={TO_PORTS} />
          <div className="cp-list">
            {d.fcl.containers.map((c, i) => {
              const set = (p: Partial<Offer>) => { const containers = [...d.fcl.containers]; containers[i] = { ...c, ...p }; patch('fcl', { containers }); };
              const title = [c.label || 'حاوية جديدة', c.carrier].filter(Boolean).join(' - ');
              return (
                <div key={c.key} className={`cp-route${c.visible ? '' : ' is-hidden'}`}>
                  <div className="cp-route__head">
                    <span className="cp-route__icon"><ContainerIcon size={16} /></span>
                    <strong>{title}</strong>
                    {c.pricesUpdatedAt && <small className="cp-updated">آخر تغيير للسعر {updatedOn(c.pricesUpdatedAt)}</small>}
                    <span className="cp-visibility"><small>{c.visible ? 'ظاهر' : 'مخفي'}</small><Switch checked={c.visible} onChange={(v) => set({ visible: v })} label="إظهار العرض" /></span>
                    <button type="button" className="cp-icon-btn" aria-label="نسخ العرض لخط آخر" title="نسخ لخط آخر"
                      onClick={() => { const containers = [...d.fcl.containers]; containers.splice(i + 1, 0, { ...c, key: `container-${Date.now()}`, carrier: '', price: 0, pricesUpdatedAt: undefined }); patch('fcl', { containers }); }}>
                      <Copy size={16} />
                    </button>
                    <button type="button" className="cp-icon-btn" aria-label="حذف العرض" onClick={() => patch('fcl', { containers: d.fcl.containers.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                  </div>
                  <div className="cp-row">
                    <TextField label="نوع الحاوية" value={c.label} list="cp-container-types" placeholder="حاوية 40 قدم" onChange={(v) => set({ label: v })} />
                    <TextField label="الخط الملاحي" value={c.carrier} list="cp-carriers" dir="auto" placeholder="COSCO" onChange={(v) => set({ carrier: v })} />
                    <NumberField label="السعر" value={c.price} unit="$" onChange={(v) => set({ price: v })} />
                  </div>
                  <div className="cp-row">
                    <TextField label="ميناء الشحن" value={c.fromPort} list="cp-from-ports" placeholder="شنغهاي" onChange={(v) => set({ fromPort: v })} />
                    <TextField label="ميناء الوصول" value={c.toPort} list="cp-to-ports" placeholder="طرابلس" onChange={(v) => set({ toPort: v })} />
                    <TextField label="المدة" value={c.duration} placeholder="35 - 45 يوماً" onChange={(v) => set({ duration: v })} />
                  </div>
                  {!c.fromPort && !c.toPort && c.route && (
                    <p className="cp-hint">الخط القديم «{c.route}» يظهر للعملاء حتى تكتب الميناءين.</p>
                  )}
                </div>
              );
            })}
            <button type="button" className="cp-add" onClick={() => patch('fcl', { containers: [...d.fcl.containers, { key: `container-${Date.now()}`, label: '', carrier: '', fromPort: '', toPort: 'طرابلس', route: '', price: 0, duration: '', visible: true }] })}><Plus size={15} /> أضف عرض حاوية</button>
          </div>
          <TextField label="ملاحظة" value={d.fcl.note} wide multiline onChange={(v) => patch('fcl', { note: v })} />
        </Section>

        {/* Offices */}
        <Section icon={<MessageCircle size={18} />} title="واتساب المكاتب" sub="زر «أرسل الحساب على واتساب» يذهب لمكتب مدينة العميل، ويستطيع تغييره.">
          <div className="cp-list">
            {d.offices.map((o, i) => {
              const set = (p: any) => { const offices = [...d.offices]; offices[i] = { ...o, ...p }; patch('offices', offices); };
              return (
                <div key={i} className="cp-row cp-row--item">
                  <TextField label="المكتب" value={o.label} onChange={(v) => set({ label: v })} />
                  <TextField label="رقم واتساب (دولي)" value={o.whatsapp} dir="ltr" placeholder="218915643265" onChange={(v) => set({ whatsapp: v })} />
                  <TextField label="المدن التي يخدمها" value={(o.cities || []).join(', ')} dir="ltr" placeholder="tripoli, misrata" onChange={(v) => set({ cities: v.split(',').map((c) => c.trim()).filter(Boolean) })} />
                  <button type="button" className="cp-icon-btn" aria-label="حذف المكتب" onClick={() => patch('offices', d.offices.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                </div>
              );
            })}
            <button type="button" className="cp-add" onClick={() => patch('offices', [...d.offices, { key: `office-${Date.now()}`, label: '', whatsapp: '', cities: [] }])}><Plus size={15} /> أضف مكتباً</button>
          </div>
        </Section>
      </div>

      {createPortal(
      <div className={`cp-savebar${dirty ? ' is-visible' : ''}`} aria-hidden={!dirty} dir="rtl" lang="ar">
        <span>تعديلات على الأسعار لم تُحفظ</span>
        <div>
          <button type="button" className="cp-btn cp-btn--ghost" tabIndex={dirty ? 0 : -1} disabled={saving} onClick={() => setDraft(clone(saved))}>تراجع</button>
          <button type="button" className="cp-btn cp-btn--primary" tabIndex={dirty ? 0 : -1} disabled={saving} onClick={save}>
            {saving ? <RefreshCw size={15} className="cp-spin" /> : <Save size={15} />} حفظ
          </button>
        </div>
      </div>,
      document.body,
      )}
    </div>
  );
};

export default CustomerPrices;
