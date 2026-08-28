import React, { useState } from 'react';
import api from '../../api';
import * as XLSX from 'xlsx';

// --- Interfaces ---
interface DateFilter {
  startDate: string;
  endDate: string;
}

const processDescription = (description: string = '', defaultNote: string = '') => {
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
    productName = 'شراء من المواقع';
    orderLineName = defaultNote.trim();
  }
  // 3. حالة البداية بـ "دفع دين" (ديون سابقة)
  else if (cleanDesc.includes('دفع دين')) {
    productName = 'ديون سابقه';
    orderLineName = cleanDesc;
  }

  return { productName, orderLineName, trackingRef };
};

const exportToExcel = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert('No data available to export.');
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

// --- Mock / API Fetch & Mapping Functions ---

// 1. إيداعات المحفظة (التعامل مع عمليات الشحن والمبالغ المضافة)
const fetchShipmentsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'plus'}&limit=0`
  );
  const rawData = response?.data?.statements || [];

  // تحويل البيانات لتناسب أعمدة شيت "إيداعات المحفظة"
  return rawData.map((item: any) => ({
    'id': item._id || item.id || '',
    'partner_id/id': item.user?.customerId || item.user?._id || '',
    'validity_date': formatDate(item.createdAt),
    'order_line/product_id': item.currency === 'USD' ? 'شحن محفظة إلكترونية USD' : 'شحن محفظة إلكترونية LYD',
    'order_line/price_unit': item.amount || 0,
    'pricelist_id': item.currency || 'LYD',
    'order_line/product_uom_qty': 1,
    'client_order_ref': item._id || item.id || '',
  }));
};

// 2. فواتير الشراء والشحن (التعامل مع الخصومات والمبيعات)
const fetchPaymentsAPI = async (filters: DateFilter): Promise<any[]> => {
  const response = await api.get(
    `statements/latest?startDate=${filters.startDate}&endDate=${filters.endDate}&calculationType=${'minus'}&limit=0&includeOdoCode=true`
  );
  const rawData = response?.data?.statements || [];

  // تحويل البيانات لتناسب أعمدة شيت "فواتير الشراء والشحن"
  return rawData.map((item: any) => {
    // معالجة الوصف واستخراج اسم المنتج والوصف ورقم التتبع
    const { productName, orderLineName, trackingRef } = processDescription(item.description, item.note);

    // إذا تم استخراج رقم التتبع نضعه في client_order_ref، وإلا نعتمد المرجع الافتراضي
    const clientOrderRef = trackingRef || item._id || item.id || '';

    return {
      'id': item._id || item.id || '',
      'partner_id/id': item.user?.customerId || item.user?._id || '',
      'validity_date': formatDate(item.createdAt),
      'order_line/product_id': productName, // ديناميكي الآن (شحن بضاعة / شراء من المواقع / ديون سابقة)
      'order_line/name': orderLineName,
      'order_line/price_unit': item.amount || 0,
      'pricelist_id': item.currency || 'USD',
      'order_line/product_uom_qty': 1,
      'client_order_ref': clientOrderRef,
      'order_line/analytic_distribution/name': item.odoReferenceCode ? `{ "${item.odoReferenceCode}": 100 }` : ''
    };
  });
};

// --- Component ---
const OdoExport = (): JSX.Element => {
  const [shipmentFilters, setShipmentFilters] = useState<DateFilter>({ startDate: '', endDate: '' });
  const [paymentFilters, setPaymentFilters] = useState<DateFilter>({ startDate: '', endDate: '' });

  const [loadingShipment, setLoadingShipment] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const handleExportShipments = async () => {
    setLoadingShipment(true);
    try {
      const data = await fetchShipmentsAPI(shipmentFilters);
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
        <div className="col-12 col-md-6">
          <div className="card h-100 shadow-sm border-0 bg-light">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="card-title mb-0 fw-bold text-secondary">أرصدة تم إضافتها</h5>
              <span className="badge bg-success">إيداعات المحفظة</span>
            </div>
            <div className="card-body d-flex flex-column justify-content-between">
              <div className="mb-3">
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">من تاريخ</label>
                  <input
                    type="date"
                    className="form-control"
                    value={shipmentFilters.startDate}
                    onChange={(e) => setShipmentFilters({ ...shipmentFilters, startDate: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">إلى تاريخ</label>
                  <input
                    type="date"
                    className="form-control"
                    value={shipmentFilters.endDate}
                    onChange={(e) => setShipmentFilters({ ...shipmentFilters, endDate: e.target.value })}
                  />
                </div>
              </div>
              <button
                onClick={handleExportShipments}
                disabled={loadingShipment}
                className="btn btn-success w-100 mt-2"
              >
                {loadingShipment ? 'جاري التحضير...' : 'تصدير إيداعات المحفظة (Excel)'}
              </button>
            </div>
          </div>
        </div>

        {/* --- 2. قسم فواتير الشراء والشحن --- */}
        <div className="col-12 col-md-6">
          <div className="card h-100 shadow-sm border-0 bg-light">
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="card-title mb-0 fw-bold text-secondary">فواتير الشراء والشحن</h5>
              <span className="badge bg-info text-dark">فواتير خصم</span>
            </div>
            <div className="card-body d-flex flex-column justify-content-between">
              <div className="mb-3">
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">من تاريخ</label>
                  <input
                    type="date"
                    className="form-control"
                    value={paymentFilters.startDate}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, startDate: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">إلى تاريخ</label>
                  <input
                    type="date"
                    className="form-control"
                    value={paymentFilters.endDate}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, endDate: e.target.value })}
                  />
                </div>
              </div>
              <button
                onClick={handleExportPayments}
                disabled={loadingPayment}
                className="btn btn-info text-white w-100 mt-2"
              >
                {loadingPayment ? 'جاري التحضير...' : 'تصدير فواتير الشراء والشحن (Excel)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OdoExport;