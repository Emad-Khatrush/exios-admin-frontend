// Special Exios shipment prices (USD) for chosen customers: air is per KG, sea is per CBM

export type ShippingMode = 'air' | 'sea';

export type SpecialPriceCategory = {
  name: string
  air?: number
  sea?: number
};

export type SpecialPrices = {
  enabled?: boolean
  categories?: SpecialPriceCategory[]
  note?: string
  updatedAt?: string
  updatedBy?: { firstName?: string, lastName?: string }
};

// Every customer starts with these; they can be renamed, removed, or added to
export const DEFAULT_CATEGORY_NAMES = ['Normal', 'Copy + Cosmetic', 'Medical'];

export const MAX_CATEGORIES = 20;
export const MAX_CATEGORY_NAME_LENGTH = 40;

export const MODE_UNIT: Record<ShippingMode, string> = { air: 'KG', sea: 'CBM' };

// Prices saved before categories became editable used three fixed fields
const LEGACY_FIELDS: { key: string, name: string }[] = [
  { key: 'normal', name: 'Normal' },
  { key: 'copyCosmetic', name: 'Copy + Cosmetic' },
  { key: 'medical', name: 'Medical' },
];

export const getCategories = (prices?: SpecialPrices): SpecialPriceCategory[] => {
  if (Array.isArray(prices?.categories)) return prices!.categories;

  const legacy = prices as any;
  return LEGACY_FIELDS
    .filter(({ key }) => legacy?.[key]?.air || legacy?.[key]?.sea)
    .map(({ key, name }) => ({ name, air: legacy[key].air, sea: legacy[key].sea }));
};

export const hasSpecialPrices = (prices?: SpecialPrices) =>
  !!prices?.enabled && getCategories(prices).some(category => category.air || category.sea);

// A package measured in CBM ships by sea, in KG by air; otherwise fall back to the shipment method
export const getShippingMode = (measureUnit?: string, shipmentMethod?: string): ShippingMode | undefined => {
  if (measureUnit === 'CBM') return 'sea';
  if (measureUnit === 'KG') return 'air';
  if (shipmentMethod === 'air' || shipmentMethod === 'sea') return shipmentMethod;
  return undefined;
};

// Only quote the enabled rates for this shipment's mode, never the customer's
// other mode or private pricing notes.
export const specialPriceMessage = (prices?: SpecialPrices, shipmentMethod?: string, country?: string): string => {
  const mode = getShippingMode(undefined, shipmentMethod);
  if (!prices?.enabled || !mode) return '';
  const labels: Record<string, string> = { Normal: 'البضائع العادية', 'Copy + Cosmetic': 'بضائع التجميل، الصحة، والماركات', Medical: 'البضائع الطبية' };
  const lines = getCategories(prices).filter(category => Number.isFinite(category[mode]) && Number(category[mode]) > 0)
    .map(category => `${labels[category.name] || category.name}: $${category[mode]} ${mode === 'air' ? 'للكيلو جرام' : 'للمتر المكعب'}.`);
  if (!lines.length) return '';
  if (mode === 'air' && country === 'china') return `📦 قائمة أسعار الشحن الجوي من الصين 🇨🇳
💰 أسعار الشحن الجوي (للخط السريع)

${lines.join('\n')}

🎁 عرض خاص لأصحاب الكميات (تخفيض)
لأننا ندعم تجارنا، نقدم خصمًا خاصًا عند شحن كميات كبيرة:

⏱️ مدة الوصول المتوقعة
يتم احتساب المدة من تاريخ وصول الشحنة لمخازننا في الصين:

إلى طرابلس: من 7 إلى 12 أيام.
إلى بنغازي: من 10 إلى 14 يومًا.
(ملاحظة: قد يحدث تأخير خارج عن إرادتنا في ظروف استثنائية).

📋 ملاحظات وشروط هامة
لا يوجد حد أدنى: يمكنك الشحن بأي وزن، لا يوجد أقل قيمة للشحن.

تاريخ التسعير: يُعتمد السعر السائد في تاريخ وصول البضاعة إلى المخزن.

الوزن الحجمي: يتم احتساب الوزن الحجمي فقط في حال تجاوزه نسبة 50% من الوزن الفعلي.`;
  return `أسعار الشحن ${mode === 'air' ? 'الجوي' : 'البحري'} الخاصة بك:\n${lines.join('\n')}`;
};
