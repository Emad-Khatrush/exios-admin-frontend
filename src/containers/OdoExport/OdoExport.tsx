import React, { useState } from 'react';
import api from '../../api';
import * as XLSX from 'xlsx';

// --- Interfaces ---
interface DateFilter {
  startDate: string;
  endDate: string;
}

interface ImportGuide {
  path: string;
  steps: string[];
  warnings?: string[];
}

// =====================================================================
//  خرائط الربط مع أودو — عدّلها هنا فقط عند أي تغيير في أودو
// =====================================================================

// رموز فرق المبيعات (المكاتب) — الرقم الداخلي في أودو (crm.team)
const OFFICE_TEAM_IDS: Record<string, string> = {
  tripoli: '4',   // مكتب طرابلس
  benghazi: '5',  // مكتب بنغازي
};

// يوميات صناديق المكاتب — اسم اليومية في أودو بالضبط، لكل مكتب وعملة
// ملاحظة: الاسم يجب أن يطابق ما في أودو حرفياً وإلا سيفشل الاستيراد
const OFFICE_CASH_JOURNALS: Record<string, Record<string, string>> = {
  tripoli: {
    USD: 'الخزينة الفرعية طرابلس $',
    LYD: 'الخزينة الفرعية طرابلس LYD',
  },
  benghazi: {
    USD: 'الخزينة الفرعية بنغازي $',
    LYD: 'الخزينة الفرعية بنغازي LYD',
  },
};

// حسابات الإيراد المستخدمة في عكس الطلبيات الملغاة
const REVENUE_ACCOUNTS = {
  shipping: '401001', // إيرادات الشحن
  purchase: '401007', // إيرادات الشراء من المواقع
};

// حساب مصروف التعويضات — خسارة فعلية تتحملها الشركة، لا عكس إيراد
const COMPENSATION_ACCOUNT = '501013'; // مصروف تعويضات البضاعة المفقودة أو التالفة

// منتج التعويض عن البضاعة المفقودة أو التالفة (لا يُقسَّم حسب العملة)
const COMPENSATION_PRODUCT = 'تعويض بضاعة مفقودة أو تالفة';

// أنواع العمليات التي تُعامل كإلغاء وإرجاع للمحفظة
const REVERSAL_ACTION_TYPES = ['cancellation', 'refund'];

// كل الأنواع التي لها ملف تصدير خاص بها — تُستبعد من ملف الإيداعات
const NON_DEPOSIT_ACTION_TYPES = [...REVERSAL_ACTION_TYPES, 'compensation', 'withdrawal'];

const processDescription = (description: string = '', defaultNote: string = '', currency: string = '') => {
  let productName = 'شحن بضاعة'; // الافتراضي
  let orderLineName = defaultNote || description || 'سعر الصرف';
  let trackingRef = '';

  const cleanDesc = description.trim();

  // 1. حالة وجود عبارة "تم دفع قيمة الشحن" (شحن بضائع)
  if (cleanDesc.includes('تم دفع قيمة الشحن')) {
    productName = 'شحن بضاعة';
    const match = cleanDesc.match(/تم دفع قيمة الشحن\s+([A-Za-z0-9]+)/);
    if (match && match[1]) {
      trackingRef = match[1];
      orderLineName = `شحن بضاعة - رقم التتبع: ${trackingRef}`;
    }
  }
  // 2. حالة البداية بـ "Order Id" (شراء من المواقع)
  else if (defaultNote.trim().includes('Order Id (')) {
    productName = 'إيراد خدمة الشراء من المواقع';
    orderLineName = defaultNote.trim();
  }
  // 3. حالة البداية بـ "دفع دين" (ديون سابقة)
  else if (cleanDesc.includes('دفع دين')) {
    productName = 'إيراد خدمة الشراء من المواقع';
    orderLineName = cleanDesc;
  }

  return { productName, orderLineName, trackingRef };
};

const exportToExcel = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات للتصدير في هذه الفترة.');
    return;
  }

  // 1. Convert JSON array to a SheetJS Worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 2. Create a new Workbook and append the Worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Data');

  // 3. Generate and download the .xlsx file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// --- Formatters & Helpers ---
const formatDate = (dateString?: string) => {
  if (!dateString) return '15/04/2026';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const resolveOffice = (office?: string) => {
  const key = (office || '').trim().toLowerCase();
  return OFFICE_TEAM_IDS[key] ? key : '';
};

// رقم فريق المبيعات (المكتب) — يرجع فارغاً إذا لم يكن المكتب معروفاً
const getOfficeTeamId = (office?: string) => {
  const key = resolveOffice(office);
  return key ? OFFICE_TEAM_IDS[key] : '';
};

// --- Mock / API Fetch & Mapping Functions ---

// 1. إيداعات المحفظة (التعامل مع عمليات الشحن والمبالغ المضافة)
const fetchWalletAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'plus'}&limit=0`
  );
  const rawData = response?.data?.statements || [];

  // تحويل البيانات لتناسب أعمدة شيت "إيداعات المحفظة"
  return rawData
    .filter((item: any) => (
      !item.note?.trim().includes('Cancellation Refund')
      && !NON_DEPOSIT_ACTION_TYPES.includes(item?.actionType)
    ))
    // اذا تريد استيراد عبر اوامر البيع
    // .map((item: any) => {
    //   let productId = item.currency === 'USD' ? 'شحن محفظة إلكترونية USD' : 'شحن محفظة إلكترونية LYD';
    //   let orderLineName = `${item.description || 'إيداع محفظة'} - نوع ${item.note || ''}`;

    //   return ({
    //   'id': item._id || item.id || '',
    //   'partner_id/id': item.user?.customerId || item.user?._id || '',
    //   'date_order': formatDate(item.createdAt),
    //   'validity_date': formatDate(item.createdAt),
    //   'order_line/product_id': productId,
    //   'order_line/name': orderLineName,
    //   'order_line/price_unit': item.amount || 0,
    //   'pricelist_id': item.currency || 'LYD',
    //   'order_line/product_uom_qty': 1,
    //   'client_order_ref': item._id || item.id || '',
    // })

    // اذا تريد استيراد عبر الفواتير العملاء مباشر
    .map((item: any) => {
      let productId = `شحن رصيد محفظة ${item.currency || 'USD'}`;
      let orderLineName = `${item.description || 'إيداع محفظة'} - نوع ${item.note || ''}`;

      return ({
        'id': item._id || item.id || '',
        'partner_id/id': item.user?.customerId || item.user?._id || '',
        'invoice_date': formatDate(item.createdAt),
        'invoice_date_due': formatDate(item.createdAt),
        'invoice_line_ids/product_id': productId,
        'invoice_line_ids/name': orderLineName,
        'invoice_line_ids/price_unit': item.amount || 0,
        'currency_id': item.currency || 'USD',
        'invoice_line_ids/quantity': 1,
        'ref': item._id || item.id || '',
        'team_id/.id': getOfficeTeamId(item.office),
      });
    });
};

// 2. فواتير الشراء والشحن (التعامل مع الخصومات والمبيعات)
const fetchPaymentsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'minus'}&limit=0&includeOdoCode=true`
  );
  const rawData = response?.data?.statements || [];

  // تحويل البيانات لتناسب أعمدة شيت "فواتير الشراء والشحن"
  return rawData
    .filter((item: any) => item?.actionType !== 'withdrawal')
    .map((item: any) => {
      // معالجة الوصف واستخراج اسم المنتج والوصف ورقم التتبع
      const { productName, orderLineName, trackingRef } = processDescription(item.description, item.note, item.currency);

      // إذا تم استخراج رقم التتبع نضعه في ref، وإلا نعتمد المرجع الافتراضي
      const clientOrderRef = trackingRef || item._id || item.id || '';

      // اذا تريد استيراد عبر اوامر البيع
      // return {
      //   'id': item._id || item.id || '',
      //   'partner_id/id': item.user?.customerId || item.user?._id || '',
      //   'date_order': formatDate(item.createdAt),
      //   'validity_date': formatDate(item.createdAt),
      //   'order_line/product_id': productName,
      //   'order_line/name': orderLineName,
      //   'order_line/price_unit': item.amount || 0,
      //   'pricelist_id': item.currency || 'USD',
      //   'order_line/product_uom_qty': 1,
      //   'client_order_ref': clientOrderRef,
      //   'order_line/analytic_distribution/name': item.odoReferenceCode ? `{ "${item.odoReferenceCode}": 100 }` : '',
      //   'team_id/id': currentOfficeOdoCode || '',
      // };

      return {
        'id': item._id || item.id || '',
        'partner_id/id': item.user?.customerId || item.user?._id || '',
        'invoice_date': formatDate(item.createdAt),
        'invoice_line_ids/product_id': productName, // ديناميكي الآن (شحن بضاعة / شراء من المواقع / ديون سابقة)
        'invoice_line_ids/name': orderLineName,
        'invoice_line_ids/price_unit': item.amount || 0,
        'currency_id': item.currency || 'USD',
        'invoice_line_ids/quantity': 1,
        'ref': clientOrderRef,
        'invoice_line_ids/analytic_distribution': item.odoReferenceCode ? `{ "${item.odoReferenceCode}": 100 }` : '',
        'team_id/.id': getOfficeTeamId(item.office),
      };
    });
};

// 3. فواتير المشتريات (التعامل مع عمليات الشراء من الموردين)
const fetchPurchaseItemsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `odoReport?startDate=${filters.startDate}&endDate=${filters.endDate}&type=purchaseItems`
  );
  const rawData = response?.data?.results || [];

  // تحويل البيانات لتناسب أعمدة شيت "فواتير المشتريات"
  return rawData.map((item: any) => ({
    'id': item._id || '',
    'partner_id': 'الشراء من مواقع العالمية',
    'invoice_date': formatDate(item.date),
    'invoice_line_ids/product_id': 'خدمة شراء',
    'invoice_line_ids/name': `Order ID: ${item.orderId} => ${item.description}` || 'شراء من المورد',
    'invoice_line_ids/price_unit': item.unitPrice || 0,
    'currency_id': item.currency || 'USD',
    'invoice_line_ids/quantity': 1,
    'ref': item._id || '',
  }));
};

// 4. الإشعارات الدائنة — تشمل ثلاث حالات:
//    cancellation / refund → عكس الإيراد على حسابه الأصلي
//    compensation         → مصروف تعويضات، لا يمس الإيراد
const fetchCanceledPaymentsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'plus'}&limit=0`
  );

  const rawData = response?.data.statements || [];

  return rawData
    .filter((item: any) => (
      item.note?.trim().includes('Cancellation Refund')
      || REVERSAL_ACTION_TYPES.includes(item?.actionType)
      || item?.actionType === 'compensation'
    ))
    .map((item: any) => {
      const isCompensation = item?.actionType === 'compensation';

      // التعويض: منتج واحد وحساب مصروف — لا يمس حساب الإيراد الأصلي
      // الإلغاء والاسترداد: عكس الإيراد على نفس حسابه الأصلي
      const productId = isCompensation
        ? COMPENSATION_PRODUCT
        : (item.currency === 'USD' ? 'استرداد قيمة ملغاة - محفظة USD' : 'استرداد قيمة ملغاة - محفظة LYD');

      const accountId = isCompensation
        ? COMPENSATION_ACCOUNT
        : (item.note?.trim().includes('receivedGoods') ? REVENUE_ACCOUNTS.shipping : REVENUE_ACCOUNTS.purchase);

      const lineName = isCompensation
        ? `تعويض - ${item.description || ''}`.trim()
        : (`Order ID: ${item?.orderId} => ${item.description}` || 'شراء من المورد');

      return ({
        'id': item._id || '',
        'partner_id/id': item.user?.customerId || item.user?._id || '',
        'invoice_date': formatDate(item.createdAt),
        'invoice_line_ids/product_id': productId,
        'invoice_line_ids/account_id': accountId,
        'invoice_line_ids/name': lineName,
        'invoice_line_ids/price_unit': item.amount || 0,
        'currency_id': item.currency || 'USD',
        'invoice_line_ids/quantity': 1,
        'ref': item._id || '',
        'team_id/.id': getOfficeTeamId(item.office),
      });
    });
};

// 5. سحوبات المحفظة كاش (العميل يسحب رصيده نقداً من مكتب فرعي)
//    تُستورد في أودو كـ "مدفوعات" (account.payment) وليس كفواتير
const fetchWalletWithdrawalsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'minus'}&limit=0&includeOdoCode=true`
  );
  const rawData = response?.data?.statements || [];

  return rawData
    .filter((item: any) => item?.actionType === 'withdrawal')
    .map((item: any) => {
      const currency = item.currency || 'USD';
      const officeKey = resolveOffice(item.office);
      const cashJournal = officeKey ? OFFICE_CASH_JOURNALS[officeKey]?.[currency] : '';

      return {
        'id': item._id || item.id || '',
        'payment_type': 'outbound',
        'partner_type': 'customer',
        'partner_id/id': item.user?.customerId || item.user?._id || '',
        'date': formatDate(item.createdAt),
        'amount': item.amount || 0,
        'currency_id': currency,
        'journal_id': cashJournal || '',
        'is_wallet_withdrawal': 'TRUE',
        'memo': 'سحب كاش من محفظة العميل',
      };
    });
};

// =====================================================================
//  إرشادات الاستيراد داخل أودو لكل قسم
// =====================================================================

const IMPORT_GUIDES: Record<string, ImportGuide> = {
  wallet: {
    path: 'المحاسبة ← العملاء ← فواتير العملاء ← استيراد',
    steps: [
      'افتح قائمة فواتير العملاء أولاً حتى يأخذ الاستيراد نوع الفاتورة الصحيح.',
      'ارفع الملف، وتأكد من تفعيل «استخدم الصف الأول كترويسة».',
      'بعد الاستيراد: اختار جميع الفواتير ثم اعمل تاكيد قيود، ثم سجّل الدفعة من يومية الصندوق الذي استلم المبلغ.',
    ],
    warnings: [
      'بدون تسجيل الدفعة يبقى العميل مديناً والرصيد غير مكتمل.',
      'عمود المكتب يبقى فارغاً إذا لم يُسجَّل المكتب في العملية — راجعها يدوياً بعد الاستيراد.',
    ],
  },
  payments: {
    path: 'المحاسبة ← العملاء ← فواتير العملاء ← استيراد',
    steps: [
      'ارفع الملف من نفس شاشة فواتير العملاء.',
      'اضغط «اختبار» أولاً — أي خطأ في مطابقة العميل أو المنتج يظهر هنا.',
      'بعد الاستيراد: قم باختيار جميع الفواتير واعمل تاكيد القيود، ثم اختارهم جميعا مجددا واختار خصم من محفظة العملاء (اخر خيار).',
    ],
    warnings: [
      'أرقام المكاتب (4 و 5) هي أرقام داخلية في قاعدة البيانات، وستتغير عند النقل إلى بيئة أخرى.',
      'عمود التوزيع التحليلي يحتاج معرّف الحساب التحليلي الرقمي، لا اسمه النصي.',
    ],
  },
  purchase: {
    path: 'المحاسبة ← الموردون ← فواتير الموردين ← استيراد',
    steps: [
      'افتح قائمة فواتير الموردين تحديداً (وليس فواتير العملاء).',
      'ارفع الملف واضغط «اختبار».',
      'بعد الاستيراد: راجع أن المورد «الشراء من مواقع العالمية» مطابق لسجل واحد فقط.',
    ],
    warnings: [
      'عمود partner_id هنا يطابق بالاسم — أي تكرار في أسماء الموردين سيوقف الاستيراد.',
    ],
  },
  canceled: {
    path: 'المحاسبة ← العملاء ← إشعارات دائنة ← استيراد',
    steps: [
      'افتح قائمة الإشعارات الدائنة تحديداً حتى يكون نوع المستند out_refund.',
      'ارفع الملف واضغط «اختبار».',
      'بعد الاستيراد: اختار جميع فواتير ودير تاكيد، المفترض يظهر لك معكوس على حالتها.',
    ],
    warnings: [
      'الإشعار وحده يلغي الإيراد فقط — بدون خطوة الدفع لن تعود القيمة إلى المحفظة.',
      'الإلغاء والاسترداد يعكسان حساب الفاتورة الأصلية (401001 للشحن، 401007 للشراء).',
      'التعويض مختلف: يذهب إلى حساب مصروف (501013) ولا يمس إيراد الرحلة، لأن الخدمة تمت والشركة تحملت الخسارة.',
    ],
  },
  withdrawals: {
    path: 'المحاسبة ← العملاء ← الدفعات ← استيراد',
    steps: [
      'افتح قائمة المدفوعات (وليس الفواتير) وارفع الملف.',
      'تأكد من ربط عمود journal_id بيومية صندوق المكتب الصحيحة.',
      'اضغط «اختبار» ثم «استيراد»، ورحّل المدفوعات بعدها.',
      'راجع رصيد المحفظة ورصيد الصندوق — يجب أن ينقص كلاهما بنفس المبلغ.',
    ],
    warnings: [
      'يعتمد على حقل is_wallet_withdrawal المضاف عبر SH — بدونه ستُخصم القيمة من ذمم العميل لا من المحفظة.',
      'أسماء يوميات الصناديق يجب أن تطابق أودو حرفياً، وإلا سيرفض الاستيراد السطر.',
      'لا تستخدم يومية المحفظة هنا — النقد يخرج من صندوق المكتب.',
    ],
  },
};

// --- Import Guide Sub-component ---
const ImportGuideBox = ({ guide, accent }: { guide: ImportGuide; accent: string }): JSX.Element => (
  <details className="mb-3">
    <summary className={`small fw-semibold text-${accent}`} style={{ cursor: 'pointer' }}>
      طريقة الاستيراد في أودو
    </summary>
    <div className="mt-2 p-3 bg-white border rounded">
      <div className="small fw-semibold text-dark mb-2">{guide.path}</div>
      <ol className="small text-muted mb-0 ps-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="mb-1">{step}</li>
        ))}
      </ol>
      {guide.warnings && guide.warnings.length > 0 && (
        <ul className="small text-danger mb-0 mt-2 ps-3">
          {guide.warnings.map((w, i) => (
            <li key={i} className="mb-1">{w}</li>
          ))}
        </ul>
      )}
    </div>
  </details>
);

// --- Export Card Sub-component ---
interface ExportCardProps {
  title: string;
  badgeLabel: string;
  badgeClass: string;
  buttonClass: string;
  guide: ImportGuide;
  accent: string;
  filters: DateFilter;
  onFiltersChange: (f: DateFilter) => void;
  onExport: () => void;
  loading: boolean;
  buttonLabel: string;
}

const ExportCard = ({
  title,
  badgeLabel,
  badgeClass,
  buttonClass,
  guide,
  accent,
  filters,
  onFiltersChange,
  onExport,
  loading,
  buttonLabel,
}: ExportCardProps): JSX.Element => (
  <div className="col-12 col-md-6">
    <div className="card h-100 shadow-sm border-0 bg-light">
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
        <h5 className="card-title mb-0 fw-bold text-secondary">{title}</h5>
        <span className={badgeClass}>{badgeLabel}</span>
      </div>
      <div className="card-body d-flex flex-column justify-content-between">
        <div className="mb-3">
          <div className="mb-3">
            <label className="form-label small fw-semibold text-muted">من تاريخ</label>
            <input
              type="date"
              className="form-control"
              value={filters.startDate}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold text-muted">إلى تاريخ</label>
            <input
              type="date"
              className="form-control"
              value={filters.endDate}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
            />
          </div>
          <ImportGuideBox guide={guide} accent={accent} />
        </div>
        <button onClick={onExport} disabled={loading} className={`${buttonClass} w-100 mt-2`}>
          {loading ? 'جاري التحضير...' : buttonLabel}
        </button>
      </div>
    </div>
  </div>
);

// --- Component ---
const OdoExport = (): JSX.Element => {
  const [shipmentFilters, setShipmentFilters] = useState<DateFilter>({ startDate: '', endDate: '' });
  const [paymentFilters, setPaymentFilters] = useState<DateFilter>({ startDate: '', endDate: '' });
  const [purchaseFilters, setPurchaseFilters] = useState<DateFilter>({ startDate: '', endDate: '' });
  const [canceledPaymentFilters, setCanceledPaymentFilters] = useState<DateFilter>({ startDate: '', endDate: '' });
  const [withdrawalFilters, setWithdrawalFilters] = useState<DateFilter>({ startDate: '', endDate: '' });

  const [loadingShipment, setLoadingShipment] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [loadingCanceledPayments, setLoadingCanceledPayments] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  const handleExportShipments = async () => {
    setLoadingShipment(true);
    try {
      const data = await fetchWalletAPI(shipmentFilters);
      exportToExcel(data, `Odoo_Wallet_Deposits_${shipmentFilters.startDate || 'all'}`);
    } catch (error) {
      console.error('Failed to export shipments:', error);
    } finally {
      setLoadingShipment(false);
    }
  };

  const handleExportPayments = async () => {
    setLoadingPayment(true);
    try {
      const data = await fetchPaymentsAPI(paymentFilters);
      exportToExcel(data, `Odoo_Invoices_And_Shipping_${paymentFilters.startDate || 'all'}`);
    } catch (error) {
      console.error('Failed to export payments:', error);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleExportPurchaseItems = async () => {
    setLoadingPurchase(true);
    try {
      const data = await fetchPurchaseItemsAPI(purchaseFilters);
      exportToExcel(data, `Odoo_Purchase_Items_${purchaseFilters.startDate || 'all'}`);
    } catch (error) {
      console.error('Failed to export purchase items:', error);
    } finally {
      setLoadingPurchase(false);
    }
  };

  const handleExportCanceledPayments = async () => {
    setLoadingCanceledPayments(true);
    try {
      const data = await fetchCanceledPaymentsAPI(canceledPaymentFilters);
      exportToExcel(data, `Odoo_Canceled_Payments_${canceledPaymentFilters.startDate || 'all'}`);
    } catch (error) {
      console.error('Failed to export canceled payments:', error);
    } finally {
      setLoadingCanceledPayments(false);
    }
  };

  const handleExportWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const data = await fetchWalletWithdrawalsAPI(withdrawalFilters);
      exportToExcel(data, `Odoo_Wallet_Withdrawals_${withdrawalFilters.startDate || 'all'}`);
    } catch (error) {
      console.error('Failed to export wallet withdrawals:', error);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  return (
    <div className="container mt-4 mb-5">
      <div className="border-bottom pb-3 mb-4">
        <h2 className="fw-bold text-dark mb-1">Odoo Data Export Center</h2>
        <p className="text-muted small mb-0">
          تصدير بيانات المحفظة والفواتير المجهزة تماماً للاستيراد المباشر في أودو.
        </p>
      </div>

      <div className="row g-4">
        {/* --- 1. قسم إيداعات المحفظة --- */}
        <ExportCard
          title="أرصدة تم إضافتها"
          badgeLabel="إيداعات المحفظة"
          badgeClass="badge bg-success"
          buttonClass="btn btn-success"
          buttonLabel="تصدير إيداعات المحفظة (Excel)"
          guide={IMPORT_GUIDES.wallet}
          accent="success"
          filters={shipmentFilters}
          onFiltersChange={setShipmentFilters}
          onExport={handleExportShipments}
          loading={loadingShipment}
        />

        {/* --- 2. قسم استيراد الطلبيات الملغاه --- */}
        <ExportCard
          title="فواتير طلبيات ملغاه"
          badgeLabel="إشعارات دائنة"
          badgeClass="badge bg-warning text-dark"
          buttonClass="btn btn-warning text-white"
          buttonLabel="تصدير فواتير طلبيات ملغاه (Excel)"
          guide={IMPORT_GUIDES.canceled}
          accent="warning"
          filters={canceledPaymentFilters}
          onFiltersChange={setCanceledPaymentFilters}
          onExport={handleExportCanceledPayments}
          loading={loadingCanceledPayments}
        />

        {/* --- 3. قسم فواتير الشراء والشحن --- */}
        <ExportCard
          title="فواتير الشراء والشحن"
          badgeLabel="فواتير خصم"
          badgeClass="badge bg-info text-dark"
          buttonClass="btn btn-info text-white"
          buttonLabel="تصدير فواتير الشراء والشحن (Excel)"
          guide={IMPORT_GUIDES.payments}
          accent="info"
          filters={paymentFilters}
          onFiltersChange={setPaymentFilters}
          onExport={handleExportPayments}
          loading={loadingPayment}
        />

        {/* --- 4. قسم سحوبات المحفظة كاش --- */}
        <ExportCard
          title="سحوبات المحفظة كاش"
          badgeLabel="مدفوعات صادرة"
          badgeClass="badge bg-danger"
          buttonClass="btn btn-danger"
          buttonLabel="تصدير سحوبات المحفظة (Excel)"
          guide={IMPORT_GUIDES.withdrawals}
          accent="danger"
          filters={withdrawalFilters}
          onFiltersChange={setWithdrawalFilters}
          onExport={handleExportWithdrawals}
          loading={loadingWithdrawals}
        />

        {/* --- 5. قسم استيراد المشتريات --- */}
        <ExportCard
          title="فواتير المشتريات"
          badgeLabel="فواتير موردين"
          badgeClass="badge bg-secondary text-light"
          buttonClass="btn btn-secondary text-white"
          buttonLabel="تصدير فواتير المشتريات (Excel)"
          guide={IMPORT_GUIDES.purchase}
          accent="secondary"
          filters={purchaseFilters}
          onFiltersChange={setPurchaseFilters}
          onExport={handleExportPurchaseItems}
          loading={loadingPurchase}
        />

      </div>
    </div>
  );
};

export default OdoExport;