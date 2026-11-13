import { Alert } from '@mui/material';
import {
  ArrowRight, Banknote, Container as ContainerIcon, DollarSign, Landmark, MessageCircle, Plane, Plus, RefreshCw, Save, ShoppingBag, Ship, Trash2,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api from '../../api';
import './SettingsCommon.scss';
import './CustomerPrices.scss';

type Tier = { upTo: number | null, type?: 'fixed' | 'percent', value?: number, rate?: number, fee?: number };
type Category = { key: string, label: string, price: number };
type Route = { key: string, label: string, method: 'air' | 'sea', unit: 'kg' | 'cbm', price: number, visible: boolean, duration: string, note: string, minCharge: number, categories: Category[] };
type Config = {
  exchangeRate: { visible: boolean, current: { rate: number, updatedAt: string } | null },
  shipping: { visible: boolean, note: string, volumetricDivisor: number, routes: Route[] },
  purchase: { visible: boolean, note: string, minCommission: number, tiers: Tier[], sites: { key: string, label: string, feePercent: number }[] },
  alipay: { visible: boolean, note: string, tiers: Tier[] },
  swift: { visible: boolean, note: string, tiers: Tier[], fixedFee: number, minFee: number },
  fcl: { visible: boolean, note: string, containers: { key: string, label: string, route: string, price: number, duration: string, visible: boolean }[] },
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

const TextField = ({ label, value, onChange, placeholder, wide, multiline, dir }: {
  label: string, value: string, onChange: (v: string) => void, placeholder?: string, wide?: boolean, multiline?: boolean, dir?: string,
}) => (
  <label className={`cp-field${wide ? ' cp-field--wide' : ''}`}>
    <span>{label}</span>
    {multiline
      ? <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} dir={dir || 'auto'} />
      : <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} dir={dir || 'auto'} />}
  </label>
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
        exchangeRate: { visible: draft.exchangeRate.visible },
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
          <h1>أسعار العملاء</h1>
          <p>كل ما يظهر في صفحة الأسعار والحاسبة في تطبيق العميل. أخفِ أي قسم بالمفتاح بجانبه.</p>
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
        <Section icon={<DollarSign size={18} />} title="سعر الصرف" sub="سعر الدولار بالدينار في أعلى صفحة الأسعار."
          visible={d.exchangeRate.visible} onVisible={(v) => patch('exchangeRate', { visible: v })}>
          <p className="cp-text">
            السعر الحالي <strong dir="ltr">1$ = {d.exchangeRate.current?.rate ?? '-'} د.ل</strong>. يُغيَّر من صفحة <Link to="/settings/pricing">Pricing</Link> لأنه سعر المحاسبة أيضاً. إخفاؤه هنا لا يؤثر على المحاسبة.
          </p>
        </Section>

        {/* Shipping */}
        <Section icon={<Plane size={18} />} title="أسعار الشحن" sub="السعر هنا هو نفسه الذي تقرؤه الفواتير لكل خط."
          visible={d.shipping.visible} onVisible={(v) => patch('shipping', { visible: v })}>
          <div className="cp-routes">
            {d.shipping.routes.map((r, i) => {
              const set = (p: Partial<Route>) => { const routes = [...d.shipping.routes]; routes[i] = { ...r, ...p }; patch('shipping', { routes }); };
              return (
                <div key={r.key} className={`cp-route${r.visible ? '' : ' is-hidden'}`}>
                  <div className="cp-route__head">
                    <span className="cp-route__icon">{r.method === 'sea' ? <Ship size={16} /> : <Plane size={16} />}</span>
                    <strong>{r.label}</strong>
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
                    <TextField label="المدة" value={r.duration} placeholder="15 - 20 يوماً" onChange={(v) => set({ duration: v })} />
                    <NumberField label="أقل تكلفة للشحنة" value={r.minCharge} unit="$" onChange={(v) => set({ minCharge: v })} />
                  </div>
                  <TextField label="ملاحظة تظهر تحت الخط" value={r.note} multiline wide onChange={(v) => set({ note: v })} />
                </div>
              );
            })}
          </div>
          <div className="cp-row">
            <NumberField label="قاسم الوزن الحجمي (جوي)" value={d.shipping.volumetricDivisor} step="1" min={1000} onChange={(v) => patch('shipping', { volumetricDivisor: v })} />
            <TextField label="ملاحظة عامة للشحن" value={d.shipping.note} wide multiline onChange={(v) => patch('shipping', { note: v })} />
          </div>
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
          <h3 className="cp-subtitle">رسوم المواقع</h3>
          <div className="cp-list">
            {d.purchase.sites.map((s, i) => {
              const set = (p: any) => { const sites = [...d.purchase.sites]; sites[i] = { ...s, ...p }; patch('purchase', { sites }); };
              return (
                <div key={i} className="cp-row cp-row--item">
                  <TextField label="الموقع" value={s.label} onChange={(v) => set({ label: v })} />
                  <NumberField label="رسوم الموقع" value={s.feePercent} unit="%" onChange={(v) => set({ feePercent: v })} />
                  <button type="button" className="cp-icon-btn" aria-label="حذف الموقع" onClick={() => patch('purchase', { sites: d.purchase.sites.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                </div>
              );
            })}
            <button type="button" className="cp-add" onClick={() => patch('purchase', { sites: [...d.purchase.sites, { key: `site-${Date.now()}`, label: '', feePercent: 0 }] })}><Plus size={15} /> أضف موقعاً</button>
          </div>
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
          <TextField label="ملاحظة" value={d.swift.note} wide multiline onChange={(v) => patch('swift', { note: v })} />
        </Section>

        {/* FCL */}
        <Section icon={<ContainerIcon size={18} />} title="الحاويات الكاملة FCL" sub="لا تظهر الحاوية للعملاء حتى تضع لها سعراً."
          visible={d.fcl.visible} onVisible={(v) => patch('fcl', { visible: v })}>
          <div className="cp-list">
            {d.fcl.containers.map((c, i) => {
              const set = (p: any) => { const containers = [...d.fcl.containers]; containers[i] = { ...c, ...p }; patch('fcl', { containers }); };
              return (
                <div key={i} className={`cp-route${c.visible ? '' : ' is-hidden'}`}>
                  <div className="cp-route__head">
                    <span className="cp-route__icon"><ContainerIcon size={16} /></span>
                    <strong>{c.label || 'حاوية جديدة'}</strong>
                    <span className="cp-visibility"><small>{c.visible ? 'ظاهرة' : 'مخفية'}</small><Switch checked={c.visible} onChange={(v) => set({ visible: v })} label="إظهار الحاوية" /></span>
                    <button type="button" className="cp-icon-btn" aria-label="حذف الحاوية" onClick={() => patch('fcl', { containers: d.fcl.containers.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                  </div>
                  <div className="cp-row">
                    <TextField label="الاسم" value={c.label} onChange={(v) => set({ label: v })} />
                    <NumberField label="السعر" value={c.price} unit="$" onChange={(v) => set({ price: v })} />
                    <TextField label="الخط" value={c.route} placeholder="الصين إلى طرابلس" onChange={(v) => set({ route: v })} />
                    <TextField label="المدة" value={c.duration} placeholder="45 - 60 يوماً" onChange={(v) => set({ duration: v })} />
                  </div>
                </div>
              );
            })}
            <button type="button" className="cp-add" onClick={() => patch('fcl', { containers: [...d.fcl.containers, { key: `container-${Date.now()}`, label: '', route: '', price: 0, duration: '', visible: true }] })}><Plus size={15} /> أضف حاوية</button>
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
