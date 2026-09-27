// Labels and explanations for X-Tracking > مراقبة الطلبيات.
// The checks themselves run in the API (controllers/ordersControl.js); keep the two in step.

export type Stage = 'waiting' | 'abroad' | 'ready' | 'delivered' | 'noPackages';

export type ControlRow = {
  key: string
  orderMongoId: string
  orderId: string
  customerName: string
  customerId: string
  customerMongoId: string | null
  phone: string
  office: string
  toWhere: string
  orderType: 'purchase' | 'shipment'
  orderCreatedAt: string
  orderAge: number | null
  isFinished: boolean
  stage: Stage
  method: 'air' | 'sea' | 'unknown'
  days: number | null
  packageId?: string
  trackingNumber?: string
  receiptNo?: string
  locationPlace?: string
  boxesCount?: string
  weight: number
  unit: string
  exiosPrice: number
  shippingCost: number
  arrivedAt?: string | null
  deliveredAt?: string | null
  warehouse?: string | null
  voyage?: { _id: string, name: string, shippingType?: string } | null
  issues: string[]
}

export type ControlResponse = {
  generatedAt: string
  includeDelivered: boolean
  deliveredDays: number
  rules: {
    pickupDays: Record<string, number>
    abroadDays: Record<string, number>
    emptyOrderDays: number
  }
  rows: ControlRow[]
}

export const STAGES: { value: Stage, label: string, hint: string }[] = [
  { value: 'waiting', label: 'لم تصل للمخزن', hint: 'لم تصل بعد إلى مخزننا في الخارج' },
  { value: 'abroad', label: 'في مخزن الخارج', hint: 'وصلت إلى مخزننا في الخارج ولم تصل ليبيا بعد' },
  { value: 'ready', label: 'جاهزة للتسليم', hint: 'وصلت ليبيا وتنتظر استلام الزبون ودفع الشحن' },
  { value: 'delivered', label: 'تم التسليم', hint: 'استلمها الزبون' },
  { value: 'noPackages', label: 'طلبيات بدون طرود', hint: 'طلبية لم يُضف لها أي طرد بعد' },
];

export const stageLabel = (stage: Stage) => STAGES.find(item => item.value === stage)?.label || stage;

export type IssueTone = 'danger' | 'warn' | 'info';

// What each automatic check means and what to do about it
export const ISSUES: Record<string, { label: string, description: string, tone: IssueTone }> = {
  overduePickup: {
    label: 'متأخرة عن الاستلام',
    description: 'في ليبيا منذ أكثر من المدة المسموحة (25 يوم جوي، 65 يوم بحري) ولم يستلمها الزبون. تواصل معه.',
    tone: 'danger',
  },
  stuckAbroad: {
    label: 'عالقة في الخارج',
    description: 'في مخزن الخارج منذ مدة طويلة (30 يوم جوي، 90 يوم بحري) ولم تُشحن إلى ليبيا. تأكد من إرسالها.',
    tone: 'danger',
  },
  noPrice: {
    label: 'بدون سعر أو وزن',
    description: 'وصلت ليبيا أو سُلّمت لكن سعر الشحن أو الوزن غير مسجّل، فلا يمكن احتساب قيمة الشحن بشكل صحيح.',
    tone: 'danger',
  },
  finishedNotDelivered: {
    label: 'منتهية وفيها طرد لم يُسلّم',
    description: 'الطلبية معلّمة كمنتهية لكن هذا الطرد لم يُسجّل كمستلم. راجع حالة الطلبية.',
    tone: 'danger',
  },
  readyNotInWarehouse: {
    label: 'في ليبيا وليست في المخزن',
    description: 'حالتها «وصلت ليبيا» لكنها غير موجودة في مخزن طرابلس أو بنغازي. أضفها إلى المخزن أو صحّح حالتها.',
    tone: 'warn',
  },
  inWarehouseNotLibya: {
    label: 'في المخزن بدون حالة «وصلت ليبيا»',
    description: 'موجودة في مخزن مكتب لكن حالتها لا تقول إنها وصلت ليبيا. صحّح الحالة.',
    tone: 'warn',
  },
  deliveredStillInWarehouse: {
    label: 'مستلمة وما زالت في المخزن',
    description: 'سُجّلت كمستلمة لكنها ما زالت في قائمة المخزن. أزلها من المخزن.',
    tone: 'warn',
  },
  deliveredNotFinished: {
    label: 'كل طرودها مستلمة والطلبية غير منتهية',
    description: 'جميع طرود الطلبية مستلمة لكن الطلبية غير معلّمة كمنتهية.',
    tone: 'warn',
  },
  emptyOrder: {
    label: 'طلبية قديمة بدون طرود',
    description: 'مرّ أكثر من 45 يوماً على الطلبية ولم يُضف لها أي طرد. تأكد من حالتها أو ألغها.',
    tone: 'warn',
  },
  remainingPayment: {
    label: 'دفعة متبقية',
    description: 'طلبية شراء عليها مبلغ متبقٍ لم يُدفع.',
    tone: 'warn',
  },
  orderProblem: {
    label: 'مشكلة في الطلبية',
    description: 'الطلبية معلّمة بوجود مشكلة.',
    tone: 'danger',
  },
  noTracking: {
    label: 'بدون رقم تتبع',
    description: 'الطرد ليس له رقم تتبع مسجّل.',
    tone: 'info',
  },
};

export const issueLabel = (code: string) => ISSUES[code]?.label || code;

export const OFFICES: { value: string, label: string }[] = [
  { value: 'tripoli', label: 'طرابلس' },
  { value: 'benghazi', label: 'بنغازي' },
];

export const officeLabel = (value?: string | null) => OFFICES.find(item => item.value === value)?.label || value || '';

export const METHOD_LABELS: Record<string, string> = { air: 'جوي', sea: 'بحري', unknown: 'غير محدد' };

export const AGE_OPTIONS = [
  { value: 0, label: 'أي مدة' },
  { value: 7, label: 'أكثر من 7 أيام' },
  { value: 14, label: 'أكثر من 14 يوم' },
  { value: 30, label: 'أكثر من 30 يوم' },
  { value: 60, label: 'أكثر من 60 يوم' },
  { value: 90, label: 'أكثر من 90 يوم' },
];

export const SORT_OPTIONS = [
  { value: 'daysDesc', label: 'الأطول انتظاراً' },
  { value: 'daysAsc', label: 'الأحدث' },
  { value: 'costDesc', label: 'الأعلى تكلفة شحن' },
  { value: 'issuesDesc', label: 'الأكثر مشاكل' },
  { value: 'customer', label: 'اسم الزبون' },
  { value: 'orderId', label: 'رقم الطلبية' },
];

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (value: number) => numberFormat.format(Number(value) || 0);
