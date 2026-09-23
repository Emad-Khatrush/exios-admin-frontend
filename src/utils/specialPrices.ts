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
