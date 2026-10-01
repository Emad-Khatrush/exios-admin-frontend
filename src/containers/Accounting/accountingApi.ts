import { base } from '../../api';

// Every accounting endpoint lives under /api/accounting and is admin only.
// The shared client has no PATCH helper, so its generic send() is used for all methods.
const url = (path: string) => `/accounting/${path.replace(/^\//, '')}`;

export const acc = {
  get: (path: string, params?: any) => base.send('get', url(path), params),
  post: (path: string, body: any = {}) => base.send('post', url(path), body),
  put: (path: string, body: any = {}) => base.send('put', url(path), body),
  patch: (path: string, body: any = {}) => base.send('patch', url(path), body),
  delete: (path: string, body: any = {}) => base.send('delete', url(path), body),
};

// Server messages, including the list of reasons a delete/archive was refused
export const errorText = (error: any, fallback = 'حدث خطأ. حاول مرة أخرى.') => {
  const data = error?.response?.data;
  if (!data) return fallback;
  const reasons = data.reasons || data.problems?.map((p: any) => `${p.role}: ${p.problem}`);
  return [data.message, ...(reasons || [])].filter(Boolean).join(' · ') || fallback;
};

// Ledger amounts are integers: USD in cents, other currencies in their smallest unit
export const formatUsd = (cents: number | null | undefined) => {
  const value = (cents || 0) / 100;
  const text = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `-$${text}` : `$${text}`;
};

export const formatMinor = (minor: number | null | undefined, currency?: string | null, decimals = 2) => {
  const value = (minor || 0) / 10 ** decimals;
  const text = value.toLocaleString('en-US', { minimumFractionDigits: Math.min(decimals, 2), maximumFractionDigits: decimals });
  return currency ? `${text} ${currency}` : text;
};

export const CURRENCY_DECIMALS: Record<string, number> = { USD: 2, LYD: 3, CNY: 2, TRY: 2, EUR: 2 };

export const todayLibya = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const ACCOUNT_TYPES = [
  { value: 'asset', label: 'أصول' },
  { value: 'liability', label: 'التزامات' },
  { value: 'equity', label: 'حقوق ملكية' },
  { value: 'income', label: 'إيرادات' },
  { value: 'expense', label: 'مصروفات' },
];
export const ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));

export const DIMENSIONS = [
  { value: 'partner', label: 'العميل' },
  { value: 'vendor', label: 'المورد' },
  { value: 'employee', label: 'الموظف' },
  { value: 'trip', label: 'الرحلة' },
  { value: 'order', label: 'الطلب' },
  { value: 'package', label: 'الطرد' },
  { value: 'office', label: 'المكتب' },
];

export const EVENT_LABELS: Record<string, string> = {
  MANUAL: 'قيد يدوي',
  CANCEL: 'إلغاء',
  REVERSAL: 'قيد عكسي',
  DEPOSIT: 'إيداع في المحفظة',
  WITHDRAWAL: 'سحب من المحفظة',
  COMPENSATION: 'تعويض عميل',
  REFUND: 'مبلغ مسترد للعميل',
  WALLET_PAYMENT: 'دفع من المحفظة',
  SETTLEMENT_CANCEL: 'إرجاع دفعة للمحفظة',
  CASH_PAYMENT: 'دفع نقدي على طلب',
  CLAIM: 'مطالبة على عميل',
  RECLASS_PARTNER: 'نقل مطالبة لعميل آخر',
  RECOGNITION: 'الاعتراف بالإيراد',
  COST_RECOGNITION: 'تحميل التكلفة',
  GENERAL_DEBT: 'دين عام على عميل',
  DEBT_WRITEOFF: 'شطب دين',
  BILL: 'فاتورة مورد',
  VENDOR_PAYMENT: 'دفعة لمورد',
  TRANSFER: 'تحويل خزينة',
  CASHCOUNT: 'جرد خزينة',
  OPENING_CASH: 'رصيد افتتاحي',
  DEPRECIATION: 'إهلاك',
  ASSET_DISPOSAL: 'بيع/استبعاد أصل',
  PREPAID_AMORT: 'قسط مصروف مقدم',
  SALARY: 'راتب',
  EQUITY: 'رأس مال / قروض',
  NETTING: 'مقاصة',
  BANK_LINE: 'حركة من كشف البنك',
  YEAR_CLOSE: 'إقفال السنة',
};

export const OFFICE_LABELS: Record<string, string> = {
  tripoli: 'طرابلس', benghazi: 'بنغازي', misurata: 'مصراتة', turkey: 'تركيا', china: 'الصين',
};

// The system's own screens record accounting documents through /api (not /api/accounting):
// staff use them with their ordinary access (trip costs, order purchases, office expenses)
const sysUrl = (path: string) => `/${path.replace(/^\//, '')}`;
export const sys = {
  get: (path: string, params?: any) => base.send('get', sysUrl(path), params),
  post: (path: string, body: any = {}) => base.send('post', sysUrl(path), body),
  put: (path: string, body: any = {}) => base.send('put', sysUrl(path), body),
  delete: (path: string, body: any = {}) => base.send('delete', sysUrl(path), body),
  // multipart (receipts): resolves with the saved document, rejects with the server's message
  form: async (path: string, method: 'POST' | 'PUT', body: FormData) => {
    const result = await base.fetchFormData(path.replace(/^\//, ''), method, body);
    if (!result || result.success === false || result instanceof Error) {
      // eslint-disable-next-line no-throw-literal
      throw { response: { data: { message: result?.message || 'تعذّر الحفظ. حاول مرة أخرى.' } } };
    }
    return result;
  },
};
