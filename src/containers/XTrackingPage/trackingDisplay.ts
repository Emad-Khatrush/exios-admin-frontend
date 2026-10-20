const LOCATION_LABELS: Record<string, string> = {
  tripoli: 'طرابلس', benghazi: 'بنغازي', misurata: 'مصراتة', misrata: 'مصراتة',
  china: 'الصين', cn: 'الصين', turkey: 'تركيا', tr: 'تركيا',
  usa: 'أمريكا', us: 'أمريكا', america: 'أمريكا', 'united states': 'أمريكا',
  uk: 'بريطانيا', gb: 'بريطانيا', britain: 'بريطانيا', 'united kingdom': 'بريطانيا',
  uae: 'الإمارات', ae: 'الإمارات', 'united arab emirates': 'الإمارات',
  libya: 'ليبيا', ly: 'ليبيا',
};
export const locationLabel = (value?: string | null) => {
  const text = String(value || '').trim();
  return LOCATION_LABELS[text.toLowerCase()] || text;
};
export const customerInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2)
  .map(part => Array.from(part)[0] || '').join('').toLocaleUpperCase();
