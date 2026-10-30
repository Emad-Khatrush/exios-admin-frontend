// Currencies a purchase cost can be entered in
export const PURCHASE_CURRENCIES: [string, string][] = [
  ['USD', 'US Dollar'], ['LYD', 'Libyan Dinar'], ['EUR', 'Euro'], ['CNY', 'Chinese Yuan'], ['TRY', 'Turkish Lira'], ['AED', 'UAE Dirham'],
  ['GBP', 'British Pound'], ['SAR', 'Saudi Riyal'], ['KWD', 'Kuwaiti Dinar'], ['QAR', 'Qatari Riyal'], ['OMR', 'Omani Rial'], ['BHD', 'Bahraini Dinar'],
  ['JPY', 'Japanese Yen'], ['INR', 'Indian Rupee'], ['JOD', 'Jordanian Dinar'], ['EGP', 'Egyptian Pound'], ['IQD', 'Iraqi Dinar'], ['LBP', 'Lebanese Pound'],
  ['YER', 'Yemeni Rial'], ['SYP', 'Syrian Pound'], ['SDG', 'Sudanese Pound'], ['IRR', 'Iranian Rial'],
];

export const OFFICES: [string, string][] = [['tripoli', 'Tripoli office'], ['benghazi', 'Benghazi office']];

// Where goods are usually shipped from; anything else can be typed
export const ORIGIN_COUNTRIES = ['الصين', 'الامارات', 'السعودية', 'تركيا', 'الكويت', 'امريكا', 'بريطانيا', 'المانيا', 'ايطاليا', 'مصر', 'تونس', 'الاردن', 'قطر', 'الهند'];

// Libyan cities and towns, the offices' cities first
export const LIBYAN_CITIES = [
  'طرابلس', 'بنغازي', 'مصراتة',
  'الزاوية', 'زليتن', 'الخمس', 'سبها', 'سرت', 'البيضاء', 'طبرق', 'درنة', 'اجدابيا', 'غريان', 'صبراتة', 'زوارة', 'ترهونة', 'بني وليد', 'المرج',
  'تاجوراء', 'جنزور', 'القره بوللي', 'قصر بن غشير', 'العزيزية', 'صرمان', 'العجيلات', 'الجميل', 'رقدالين', 'زلطن', 'مسلاتة', 'تاورغاء',
  'نالوت', 'يفرن', 'جادو', 'الزنتان', 'الرجبان', 'ككلة', 'القلعة', 'الرياينة', 'الأصابعة', 'مزدة', 'غدامس', 'كاباو', 'الحرابة', 'وازن',
  'شحات', 'القبة', 'سوسة', 'الأبيار', 'توكرة', 'قمينس', 'سلوق', 'امساعد', 'البريقة', 'راس لانوف', 'بن جواد', 'النوفلية', 'هراوة',
  'الكفرة', 'جالو', 'أوجلة', 'اجخرة', 'تازربو', 'الجغبوب',
  'هون', 'ودان', 'سوكنة', 'زلة', 'الشويرف', 'براك الشاطئ', 'ادري', 'أوباري', 'مرزق', 'تراغن', 'القطرون', 'ام الأرانب', 'غات', 'العوينات',
];

export const SHIPMENT_METHODS: [string, string][] = [['air', 'By air'], ['sea', 'By sea'], ['unknown', 'Unknown']];

// A package shipped by air is weighed in KG, one shipped by sea is measured in CBM
export const unitForMethod = (method?: string) => (method === 'air' ? 'KG' : method === 'sea' ? 'CBM' : '');

// locked: never ticked by hand; what to do instead, before and after it is done
export type PackageStep = { name: string, label: string, hint: string, locked?: { open: string, done: string } };

// Order of the four package checkpoints, as staff tick them
export const PACKAGE_STEPS: PackageStep[] = [
  { name: 'paid', label: 'Paid', hint: 'Customer paid' },
  { name: 'arrived', label: 'Origin warehouse', hint: 'Reached our warehouse abroad' },
  { name: 'arrivedLibya', label: 'Arrived in Libya', hint: 'Reached our Libya warehouse' },
  {
    name: 'received', label: 'Received', hint: 'Handed to the customer',
    // Closed only when the customer pays and takes it; undone only by cancelling that delivery
    locked: {
      open: 'يُسكَّر عند التسليم فقط: من صفحة العميل ← Ready to deliver ← اختر الطرد وسجّل الدفع ثم Mark as delivered. الطرد بشحن مجاني يُسلَّم بلا دفعة.',
      done: 'سُلِّم للعميل مع فاتورة تسليم. لإرجاعه: ألغِ فاتورة التسليم من صفحة الفواتير (Invoices)، فيرجع الطرد غير مستلم وترجع الدفعة للمحفظة.',
    },
  },
];

export type OrderKind = 'shipment' | 'payment' | 'both';

// What an order is: only shipping, only buying for the customer, or both
export const ORDER_KINDS: { value: OrderKind, label: string, hint: string }[] = [
  { value: 'shipment', label: 'Shipment', hint: 'The customer bought the goods. We ship their packages.' },
  { value: 'payment', label: 'Purchase invoice', hint: 'We buy for the customer. Payment links only, no shipping.' },
  { value: 'both', label: 'Purchase and shipment', hint: 'We buy the goods and ship them.' },
];

// A valid Date for the date pickers, whatever the record holds (missing, text, Date)
export const toDate = (value: any): Date | null => {
  if (!value || value === 'undefined' || value === 'null') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// The server's message for a failed request, whichever shape the error has
export const apiErrorMessage = (error: any, fallback = 'Something went wrong. Please try again.'): string => (
  error?.response?.data?.message || error?.data?.message || error?.message || fallback
);
