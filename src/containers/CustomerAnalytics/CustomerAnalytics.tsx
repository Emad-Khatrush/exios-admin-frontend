import { ComponentType, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, FormControlLabel, MenuItem, Switch, Tab, Tabs, TextField } from '@mui/material';
import { RefreshCw, Target, Users } from 'lucide-react';
import { LoyaltyRtl } from '../Loyalty/LoyaltyRtl';
import { time } from './format';
import { En, Num, SectionContext, SectionEnv } from './shared';
import RepeatSection from './RepeatSection';
import CohortsSection from './CohortsSection';
import ChurnSection from './ChurnSection';
import ConversionSection from './ConversionSection';
import ValueSection from './ValueSection';
import RfmSection from './RfmSection';
import MixSection from './MixSection';
import GeoSection from './GeoSection';
import StaffSection from './StaffSection';
import DeliverySection from './DeliverySection';
import RatingsSection from './RatingsSection';
import LoyaltySection from './LoyaltySection';
import CacSection from './CacSection';
import SettingsDialog from './SettingsDialog';
import './customerAnalytics.scss';

// تحليل العملاء والمبيعات: thirteen views of the customers built from the orders (not the accounting
// books), GET analytics/customers/:section (Exios-Api accounting/services/customerAnalytics/CONTRACT.md).
// The open tab and every filter live in the URL; a section is read only when its tab is opened.

// compare: the API sends `previous` for this section, so the «مقارنة بالفترة السابقة» switch shows
type SectionDef = { key: string, label: string, en: string, Component: ComponentType, dates: boolean, office: boolean, compare?: boolean, note?: string }
const SECTIONS: SectionDef[] = [
  { key: 'repeat', label: 'رجوع العملاء', en: 'Repeat Rate', Component: RepeatSection, dates: true, office: true, compare: true },
  { key: 'cohorts', label: 'الاحتفاظ', en: 'Cohort Retention', Component: CohortsSection, dates: false, office: true, note: 'هذا القسم يعرض آخر الأشهر حسب العدد الذي تختاره، ولا يتقيد بالتاريخ.' },
  { key: 'churn', label: 'العملاء الخاملون', en: 'Churn', Component: ChurnSection, dates: false, office: true, note: 'هذا القسم يُحسب حتى اليوم ولا يتقيد بالتاريخ.' },
  { key: 'conversion', label: 'من التسجيل إلى الطلب', en: 'Signup Conversion', Component: ConversionSection, dates: true, office: false, compare: true, note: 'هذا القسم يشمل كل المكاتب: الحساب لا يتبع مكتباً.' },
  { key: 'value', label: 'قيمة العميل', en: 'CLV · AOV', Component: ValueSection, dates: true, office: true, compare: true },
  { key: 'rfm', label: 'شرائح العملاء', en: 'RFM', Component: RfmSection, dates: false, office: true, note: 'الشرائح محسوبة على كل الطلبات منذ البداية حتى اليوم، ولا تتقيد بالتاريخ.' },
  { key: 'mix', label: 'مزيج الخدمات', en: 'Service Mix', Component: MixSection, dates: true, office: true },
  { key: 'geo', label: 'المدن والمكاتب', en: 'Geo', Component: GeoSection, dates: true, office: false, note: 'هذا القسم يقارن المكاتب، فيعرضها كلها.' },
  { key: 'staff', label: 'موظفو المبيعات', en: 'Sales Reps', Component: StaffSection, dates: true, office: true },
  { key: 'delivery', label: 'مدة التوصيل', en: 'Delivery Time · SLA', Component: DeliverySection, dates: true, office: true, compare: true, note: 'التاريخ هنا تاريخ تسليم الشحنة للعميل.' },
  { key: 'ratings', label: 'التقييمات', en: 'CSAT', Component: RatingsSection, dates: false, office: true, note: 'هذا القسم يُحسب على كل التقييمات حتى اليوم ولا يتقيد بالتاريخ.' },
  { key: 'loyalty', label: 'أثر النقاط', en: 'Loyalty Impact', Component: LoyaltySection, dates: false, office: true, note: 'هذا القسم يُحسب على كل الطلبات حتى اليوم ولا يتقيد بالتاريخ.' },
  { key: 'cac', label: 'تكلفة جلب العميل', en: 'CAC', Component: CacSection, dates: true, office: true, compare: true },
];
const SHARED_KEYS = ['tab', 'from', 'to', 'office', 'compare', 'companies'];
const OFFICES: [string, string][] = [['', 'الكل'], ['tripoli', 'طرابلس'], ['benghazi', 'بنغازي']];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const CustomerAnalytics = () => {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.find((s) => s.key === params.get('tab')) || SECTIONS[0];
  const from = DAY.test(params.get('from') || '') ? params.get('from') as string : '';
  const to = DAY.test(params.get('to') || '') ? params.get('to') as string : '';
  const office = OFFICES.some(([k]) => k && k === params.get('office')) ? params.get('office') as string : '';
  const [nonce, setNonce] = useState(0);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Both live in the URL: compare=0 turns the comparison off (on by default), companies=exclude drops company accounts
  const compare = params.get('compare') !== '0';
  const excludeCompanies = params.get('companies') === 'exclude';

  const setParam = useCallback((next: Record<string, string | null>) => {
    const copy = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => (value ? copy.set(key, value) : copy.delete(key)));
    setParams(copy, { replace: true });
  }, [params, setParams]);

  // A new tab keeps the shared filters and drops the old tab's own (page, segment, …)
  const openTab = (key: string) => {
    const copy = new URLSearchParams();
    SHARED_KEYS.forEach((k) => { const v = params.get(k); if (v) copy.set(k, v); });
    if (key === SECTIONS[0].key) copy.delete('tab'); else copy.set('tab', key);
    setBuiltAt(null);
    setParams(copy, { replace: true });
  };
  // A changed filter starts the list from its first page
  const setFilter = (key: string, value: string) => setParam({ [key]: value || null, page: null });

  const env: SectionEnv = useMemo(() => ({
    filters: {
      from: section.dates ? from : '',
      to: section.dates ? to : '',
      office: section.office ? office : '',
    },
    common: { companies: excludeCompanies ? 'exclude' : '', compare: compare ? '' : '0' },
    param: (key: string) => params.get(key) || '',
    setParam,
    nonce,
    onBuilt: setBuiltAt,
  }), [section, from, to, office, params, setParam, nonce, compare, excludeCompanies]);

  const badRange = !!from && !!to && from > to;
  const { Component } = section;

  return (
    <LoyaltyRtl>
      <div className="ca-page" dir="rtl">
        <header className="ca-head">
          <div className="ca-head__title">
            <span className="ca-head__icon" aria-hidden="true"><Users size={20} /></span>
            <div>
              <h1>تحليل العملاء والمبيعات</h1>
              <p>
                الأرقام من الطلبات، لا من الدفاتر المحاسبية. لا تُحسب الطلبات الملغاة ولا طلبات التطبيق التي لم تُؤكَّد.
                تُحدَّث البيانات كل 10 دقائق.
              </p>
            </div>
          </div>
          <div className="ca-head__refresh">
            <span className="ca-muted">{builtAt ? <>آخر قراءة: <Num>{time(builtAt)}</Num></> : ' '}</span>
            <Button variant="outlined" size="small" startIcon={<Target size={16} />} onClick={() => setSettingsOpen(true)}>الأهداف</Button>
            <Button variant="outlined" size="small" startIcon={<RefreshCw size={16} />} onClick={() => setNonce((n) => n + 1)}>تحديث</Button>
          </div>
        </header>

        <div className="ca-tabs">
          <Tabs value={section.key} onChange={(_, key) => openTab(key)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="أقسام التحليل">
            {SECTIONS.map((s) => <Tab key={s.key} value={s.key} label={<span>{s.label}<En>{s.en}</En></span>} />)}
          </Tabs>
        </div>

        <div className="ca-filters">
          {section.dates && (
            <>
              <TextField
                type="date" size="small" label="من" value={from} InputLabelProps={{ shrink: true }}
                onChange={(e) => setFilter('from', e.target.value)} error={badRange}
              />
              <TextField
                type="date" size="small" label="إلى" value={to} InputLabelProps={{ shrink: true }}
                onChange={(e) => setFilter('to', e.target.value)} error={badRange} helperText={badRange ? '«من» بعد «إلى»' : undefined}
              />
              {(from || to) && <Button size="small" onClick={() => setParam({ from: null, to: null, page: null })}>آخر 12 شهراً</Button>}
              {!from && !to && <span className="ca-muted">بدون تاريخ: آخر 12 شهراً كاملة والشهر الحالي.</span>}
            </>
          )}
          {section.office && (
            <TextField select size="small" label="المكتب" value={office} onChange={(e) => setFilter('office', e.target.value)} sx={{ minWidth: 140 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
              {OFFICES.map(([k, t]) => <MenuItem key={k || 'all'} value={k}>{t}</MenuItem>)}
            </TextField>
          )}
          {section.compare && (
            <FormControlLabel
              className="ca-switch"
              control={<Switch size="small" checked={compare} onChange={(e) => setParam({ compare: e.target.checked ? null : '0' })} />}
              label="مقارنة بالفترة السابقة"
            />
          )}
          <FormControlLabel
            className="ca-switch"
            control={<Switch size="small" checked={excludeCompanies} onChange={(e) => setParam({ companies: e.target.checked ? 'exclude' : null, page: null })} />}
            label="استثناء حسابات الشركات"
          />
          {section.note && <span className="ca-muted ca-filters__note">{section.note}</span>}
        </div>

        <SectionContext.Provider value={env}>
          <main className="ca-body" aria-label={section.label}>
            <Component key={section.key} />
          </main>
        </SectionContext.Provider>
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => setNonce((n) => n + 1)} />
      </div>
    </LoyaltyRtl>
  );
};

export default CustomerAnalytics;
