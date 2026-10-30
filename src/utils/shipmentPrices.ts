// Order origins are free text (usually Arabic); the price list uses country codes.
// Keep unknown origins distinct rather than silently quoting another country's rate.
export const shippingPriceCountry = (value?: string): string => {
  const key = String(value || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    china: 'china', cn: 'china', الصين: 'china', صين: 'china',
    uae: 'uae', ae: 'uae', 'united arab emirates': 'uae', الامارات: 'uae', امارات: 'uae', 'الامارات العربية المتحدة': 'uae', دبي: 'uae', dubai: 'uae',
    turkey: 'turkey', turkiye: 'turkey', 'türkiye': 'turkey', tr: 'turkey', تركيا: 'turkey', اسطنبول: 'turkey', istanbul: 'turkey',
    usa: 'usa', us: 'usa', america: 'usa', 'united states': 'usa', 'united states of america': 'usa', امريكا: 'usa', 'الولايات المتحدة': 'usa',
    uk: 'uk', gb: 'uk', britain: 'uk', 'united kingdom': 'uk', بريطانيا: 'uk', انجلترا: 'uk',
  };
  return aliases[key] || key;
};
