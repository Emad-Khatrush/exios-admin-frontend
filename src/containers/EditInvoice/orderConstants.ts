import { Debt, OrderItem } from '../../models';

export const countries = ['الصين', 'امريكا', 'بريطانيا', 'تركيا', 'الامارات', 'طرابلس', 'بنغازي'];

// Shared by the order sidebar and the inventory bulk activity dialog.
// These are editable customer timeline messages, not automatic status transitions.
export const activityMessageTemplates = [
  { group: 'الشراء ومتابعة المورد', text: 'طلبية الشراء قيد المراجعة. يرجى التأكد من تفاصيل المنتجات والكميات قبل تأكيد الشراء.' },
  { group: 'الشراء ومتابعة المورد', text: 'طلبية الشراء بانتظار استكمال السداد لإتمام إجراءات الشراء.' },
  { group: 'الشراء ومتابعة المورد', text: 'تم شراء المنتجات، ونحن بانتظار إرسالها من المورد إلى مخزننا.' },
  { group: 'الشراء ومتابعة المورد', text: 'تم شراء جزء من المنتجات، وجارٍ متابعة استكمال بقية الطلبية مع المورد.' },
  { group: 'الشراء ومتابعة المورد', text: 'أرسل المورد البضائع إلى مخزننا، وهي قيد النقل الداخلي في بلد المنشأ.' },
  { group: 'الشراء ومتابعة المورد', text: 'بعض المنتجات غير متوفرة لدى المورد. يرجى التواصل مع خدمة العملاء لمراجعة البدائل قبل استكمال الطلبية.' },
  { group: 'الاستلام والتجهيز', text: 'وصل طرد جديد تابع لطلبيتكم إلى مخزننا. يمكنكم مراجعة رقم التتبع وتفاصيل الطرد من صفحة الطلبية.' },
  { group: 'الاستلام والتجهيز', text: 'وصل جزء من بضائع الطلبية إلى مخزننا، ونحن بانتظار وصول بقية الطرود.' },
  { group: 'الاستلام والتجهيز', text: 'وصلت البضائع إلى مخزننا في بلد المنشأ، وهي قيد الاستلام والمراجعة قبل التجهيز للشحن.' },
  { group: 'الاستلام والتجهيز', text: 'البضائع قيد الفحص للتأكد من حالتها ومطابقتها لبيانات الطلبية.' },
  { group: 'الاستلام والتجهيز', text: 'البضائع قيد إعادة التغليف والتجهيز للشحن إلى ليبيا.' },
  { group: 'الاستلام والتجهيز', text: 'اكتمل تجهيز البضائع، وهي بانتظار إدراجها ضمن رحلة شحن إلى ليبيا.' },
  { group: 'الشحن والتخليص', text: 'غادرت الشحنة بلد المنشأ ضمن رحلة شحن جوي، وهي في طريقها إلى ليبيا.' },
  { group: 'الشحن والتخليص', text: 'غادرت الشحنة بلد المنشأ ضمن رحلة شحن بحري، وهي في طريقها إلى ليبيا.' },
  { group: 'الشحن والتخليص', text: 'وصلت الشحنة إلى منفذ الوصول في ليبيا، وهي بانتظار استكمال إجراءات التخليص والنقل إلى المخزن.' },
  { group: 'الشحن والتخليص', text: 'الشحنة قيد إجراءات التخليص الجمركي. ستُحدَّث الطلبية عند اكتمال الإجراءات وانتقالها إلى المخزن.' },
  { group: 'الشحن والتخليص', text: 'اكتملت إجراءات التخليص الجمركي، والشحنة قيد النقل إلى مخزن الشركة.' },
  { group: 'الشحن والتخليص', text: 'طرأ تأخير على رحلة الشحن، وجارٍ متابعة الموعد المحدَّث مع جهة النقل. يمكنكم التواصل معنا للاستفسار عن آخر المستجدات.' },
  { group: 'الوصول والتسليم', text: 'وصلت البضائع إلى مخزن طرابلس وأصبحت جاهزة للاستلام. يرجى التواصل مع المكتب لتنسيق الاستلام ومراجعة أي مبالغ مستحقة.' },
  { group: 'الوصول والتسليم', text: 'وصلت البضائع إلى طرابلس، وهي قيد التجهيز للنقل إلى مخزن بنغازي.' },
  { group: 'الوصول والتسليم', text: 'غادرت البضائع مخزن طرابلس وهي في طريقها إلى مخزن بنغازي. يرجى انتظار إشعار الجاهزية قبل التوجه للاستلام.' },
  { group: 'الوصول والتسليم', text: 'وصلت البضائع إلى مخزن بنغازي وأصبحت جاهزة للاستلام. يرجى التواصل مع المكتب لتنسيق الاستلام ومراجعة أي مبالغ مستحقة.' },
  { group: 'الوصول والتسليم', text: 'البضائع جاهزة للاستلام من مكتب الشركة. يرجى التنسيق مع المكتب قبل الحضور.' },
  { group: 'الوصول والتسليم', text: 'تذكير: لا تزال لديكم بضائع جاهزة للاستلام في مخزن الشركة. يرجى التواصل معنا لتحديد موعد مناسب للاستلام.' },
  { group: 'الوصول والتسليم', text: 'البضائع قيد التوصيل إلى عنوان الاستلام المتفق عليه. يرجى إبقاء رقم الهاتف متاحًا للتنسيق مع المندوب.' },
  { group: 'الوصول والتسليم', text: 'تم تسليم جزء من بضائع الطلبية، ولا تزال هناك طرود بانتظار الاستلام. يرجى مراجعة التفاصيل في صفحة الطلبية.' },
  { group: 'الوصول والتسليم', text: 'تم تسليم البضائع للعميل أو للمستلم المفوَّض. شكرًا لثقتكم بشركة إكسيوس للشراء والشحن.' },
  { group: 'المتابعة ومعالجة الملاحظات', text: 'نحتاج إلى تأكيد بعض بيانات الطلبية قبل استكمال الإجراءات. يرجى التواصل مع خدمة العملاء.' },
  { group: 'المتابعة ومعالجة الملاحظات', text: 'توجد ملاحظة على البضائع قيد المراجعة. يرجى التواصل مع خدمة العملاء للاطلاع على التفاصيل وتحديد الإجراء المناسب.' },
  { group: 'المتابعة ومعالجة الملاحظات', text: 'جارٍ متابعة طلب إرجاع المنتجات مع المورد. ستُضاف المستجدات إلى سجل الطلبية عند تأكيدها.' },
];
export const orderActions = activityMessageTemplates.map(template => template.text);
const activityGroups = new Map(activityMessageTemplates.map(template => [template.text, template.group]));
export const activityMessageGroup = (text: string) => activityGroups.get(text) || 'تحديث مخصص';

// Accounts that may cancel an order besides admins
export const CANCEL_ALLOWED_ACCOUNTS = ['62bb47b22aabe070791f8278', '632aeb399aefb9b93b7a7527'];

// Fields the form reports that live inside order.shipment
export const SHIPMENT_FIELDS = ['fromWhere', 'toWhere', 'packageCount', 'exiosShipmentPrice', 'method', 'originShipmentPrice', 'weight'];

// Fields of one package (a row of paymentList), as the package dialog names them
export const PACKAGE_FIELDS = ['trackingNumber', 'boxesCount', 'packageWeight', 'measureUnit', 'exiosPrice', 'locationPlace', 'arrivedAt', 'visableForClient', 'shipmentMethod', 'volumetric', 'actualWeight', 'domesticFee', 'customsFee'];
export const PACKAGE_ROW_FIELDS = ['paid', 'arrived', 'arrivedLibya', 'received', 'paymentLink', 'note'];
export const PACKAGE_CHECKPOINTS = ['paid', 'arrived', 'arrivedLibya', 'received'];
export const ITEM_FIELDS = ['description', 'itemQuantity', 'unitPrice'];
export const PURCHASE_FIELDS = ['purchaseItemDate', 'purchaseItemDescription', 'purchaseItemUnitPrice', 'purchaseItemCurrency'];

const rowIndex = () => Math.floor(Math.random() * 100000);

export const newItem = () => ({ index: rowIndex(), description: '', quantity: 1, unitPrice: 0 });

export const newPurchaseItem = () => ({ index: rowIndex(), date: new Date(), description: '', currency: '', unitPrice: 0 });

// A new package takes the order's shipping method and the unit that goes with it
export const newPackage = (defaults: { shipmentMethod?: string, measureUnit?: string } = {}) => ({
  index: rowIndex(),
  link: '',
  status: { paid: false, arrived: false, arrivedLibya: false, received: false },
  note: '',
  settings: { visableForClient: true },
  deliveredPackages: {
    trackingNumber: '',
    arrivedAt: new Date(),
    boxesCount: null,
    weight: { total: null, measureUnit: defaults.measureUnit || null },
    ...(defaults.shipmentMethod ? { shipmentMethod: defaults.shipmentMethod } : {}),
  },
});

// A payment in dollars: dinars are converted with the rate they were paid at. Dinars paid
// with no rate cannot be converted and are reported apart.
export const paidInUsd = (payments: any[] = [], category = 'invoice') => {
  const totals = { usd: 0, lydWithoutRate: 0 };
  (payments || []).filter((payment) => payment.category === category).forEach((payment) => {
    const amount = Number(payment.receivedAmount || 0);
    if (payment.currency === 'USD') totals.usd += amount;
    else if (payment.currency === 'LYD' && Number(payment.rate) > 0) totals.usd += amount / Number(payment.rate);
    else if (payment.currency === 'LYD') totals.lydWithoutRate += amount;
  });
  return totals;
};

// What the customer owes for one package: its chargeable weight at the Exios price, plus the
// transport fee to another office and the customs clearance when there are (spec v8)
export const packageCharge = (row: any) => Number(row?.deliveredPackages?.weight?.total || 0) * Number(row?.deliveredPackages?.exiosPrice || 0)
  + Number(row?.deliveredPackages?.domesticFee?.usd || 0) + Number(row?.deliveredPackages?.customsFee?.usd || 0);

export const removeBr = (text: string): string => (text ? text.replace(/<\/br>/g, '') : '');

export const totalOfItems = (items: OrderItem[] = []) => (items || []).reduce((total, item) => total + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);

export const totalDebts = (debts: Debt[] = []) => {
  const totals = { totalUsd: 0, totalLyd: 0 };
  (Array.isArray(debts) ? debts : []).forEach((debt) => {
    if (debt.currency === 'USD') totals.totalUsd += debt.amount;
    else if (debt.currency === 'LYD') totals.totalLyd += debt.amount;
  });
  return totals;
};

// What was paid on the order in each currency, for one kind of payment
export const totalPaid = (payments: any[] = [], category = 'invoice') => {
  const totals = { totalUsd: 0, totalLyd: 0, totalEuro: 0 };
  (payments || []).filter((payment) => payment.category === category).forEach((payment) => {
    if (payment.currency === 'USD') totals.totalUsd += payment.receivedAmount;
    else if (payment.currency === 'LYD') totals.totalLyd += payment.receivedAmount;
    else if (payment.currency === 'EURO') totals.totalEuro += payment.receivedAmount;
  });
  return totals;
};

const SITE = 'https://www.exioslibya.com/login';

// Ready-made WhatsApp messages for the customer of an order
export const customerMessages = (order: any) => {
  const name = order?.customerInfo?.fullName || '';
  const arrivedWarehouse = `
اهلا بك عميلنا ${name}
لقد حدثنا طلبيتك رقم ${order?.orderId} على ان تم وصوله الى مخازننا الخارجية
يرجى زيارة موقعنا الاكتروني لكي تتابع شحنتك بالتفصيل
${SITE}
شركة اكسيوس للشراء والشحن
شكرا لكم
    `;
  const invoicePaid = `
مرحباً ${name}،

نود إبلاغكم بأن عملية الشراء تمت بنجاح، ورقم الطلبية هو ${order?.orderId}. تم إضافة صور الدفع إلى الطلبية، ويمكنكم تسجيل الدخول إلى موقعنا الإلكتروني للاطلاع على تفاصيل الطلب عبر الرابط التالي:
${SITE}

يرجى ملاحظة أن عملية تتبع الطلبية والتواصل مع البائع بشأن الشحن والتوصيل هي مسؤوليتكم الشخصية، وليست مسؤولية الشركة. يُنصح بنسخ عنوان الشحن الخاص بالطلبية مع علامة الشحن وإرساله إلى البائع لتسهيل عملية التوصيل.
لأي استفسارات أو مزيد من المعلومات، يمكنكم التواصل معنا عبر الرقم التالي: 0915643265.
شكراً لاختياركم شركة إكسيوس للشحن، ونتطلع لخدمتكم مجدداً.

مع تحياتنا،
شركة إكسيوس للشحن
    `;
  return { arrivedWarehouse, invoicePaid };
};

// The note sent to the supplier with the shipping mark
export const supplierMessage = (order: any) => `Hello, we placed the order, please print and put this label on the packages, it is our shipping mark.
also before shipping do not forget to send us photos.

Hello, we placed the order, please write this on the package,
Exios39 - by ${order?.shipment?.method}(${order?.orderId})
it is our shipping mark

also before shipping do not forget
to send us photos.
thanks`;
