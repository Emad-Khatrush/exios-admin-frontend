import * as XLSX from 'xlsx';
import moment from 'moment';
import { calculateMinTotalPrice, toExcelSheetName, toFileName } from '../../utils/methods';

const number = (value: unknown): number | null => {
  if (value === '' || value == null || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const text = (value: unknown) => value == null ? '' : String(value);
const date = (value: any) => value && moment(value).isValid() ? moment(value).format('DD/MM/YYYY') : '';
const offices: Record<string, string> = { tripoli: 'طرابلس', benghazi: 'بنغازي', misrata: 'مصراتة', sabha: 'سبها', china: 'الصين', turkey: 'تركيا', CN: 'الصين', TR: 'تركيا', USA: 'أمريكا', UK: 'بريطانيا', UAE: 'الإمارات', LY: 'ليبيا' };
const label = (value: any) => offices[text(value)] || text(value);
const headers = ['تسلسل', 'اسم العميل', 'كود العميل', 'رقم الطلبية', 'رقم التتبع', 'الوجهة', 'عدد الصناديق', 'وزن / حجم الفوترة', 'وحدة القياس', 'وزن حجمي', 'سعر الشحن للوحدة USD', 'قيمة الشحن USD', 'رسوم النقل', 'عملة النقل', 'مكان التخزين', 'تاريخ الوصول لمخزن المنشأ', 'وصلت ليبيا', 'تم التسليم', 'تاريخ التسليم', 'ملاحظة الطرد', 'ملاحظات على البيانات'];

// Export one detail sheet. Identifiers remain text, and financial values remain numbers.
export function buildInventoryWorkbook(rows: readonly any[], inventory: any) {
  const detailRows = rows.map((order, index) => {
    const row = order?.paymentList || {}, pkg = row.deliveredPackages || {};
    const notes: string[] = [];
    const objectWeight = pkg.weight && typeof pkg.weight === 'object';
    const weight = number(objectWeight ? pkg.weight.total : pkg.weight);
    const unit = text(objectWeight ? pkg.weight.measureUnit : pkg.measureUnit).toUpperCase();
    const price = number(pkg.exiosPrice), boxes = number(pkg.boxesCount);
    const shipping = weight !== null && price !== null ? Number(calculateMinTotalPrice(price, weight, inventory?.shippedCountry || '', unit)) : null;
    const fee = pkg.domesticFee;
    const transportAmount = fee?.amount == null || fee.amount === '' ? 0 : number(fee.amount);
    const transportCurrency = fee?.amount == null || fee.amount === '' ? '' : text(fee.currency || 'LYD');
    if (transportAmount === null || (transportCurrency && !['USD', 'LYD'].includes(transportCurrency))) notes.push('بيانات رسوم النقل غير صالحة');
    if (!order?.user?.customerId) notes.push('كود العميل غير متاح');
    if (!pkg.trackingNumber) notes.push('رقم التتبع غير متاح');
    if (weight === null || weight === 0) notes.push('الوزن / الحجم ناقص أو صفري');
    if (!['KG', 'CBM'].includes(unit)) notes.push('وحدة القياس غير معروفة');
    if (price === null) notes.push('سعر الشحن غير متاح؛ قيمة الشحن غير مكتملة');
    if (boxes === null || !Number.isInteger(boxes)) notes.push('عدد الصناديق ناقص أو غير صحيح');
    return [index + 1, text(order?.customerInfo?.fullName || [order?.user?.firstName, order?.user?.lastName].filter(Boolean).join(' ')), text(order?.user?.customerId), text(order?.orderId), text(pkg.trackingNumber), label(order?.shipment?.toWhere), boxes !== null && Number.isInteger(boxes) ? boxes : text(pkg.boxesCount), weight, unit, pkg.volumetric?.enabled ? 'نعم' : 'لا', price, shipping, transportAmount, transportCurrency, text(pkg.locationPlace), date(pkg.arrivedAt), row.status?.arrivedLibya ? 'نعم' : 'لا', row.status?.received ? 'نعم' : 'لا', date(pkg.deliveredInfo?.deliveredDate), text(row.note), notes.join('؛ ')];
  });
  const metadata = [`الرحلة: ${text(inventory?.voyage)}`, `بلد الشحن: ${label(inventory?.shippedCountry)} · المكتب: ${label(inventory?.inventoryPlace)}`, `تاريخ الجاهزية: ${date(inventory?.inventoryFinishedDate) || 'غير محدد'}`];
  const detail = XLSX.utils.aoa_to_sheet([[metadata[0]], [metadata[1]], [metadata[2]], [], headers, ...detailRows]);
  detail['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: 4 + detailRows.length, c: headers.length - 1 } }) };
  detail['!cols'] = headers.map((_, i) => ({ wch: i === 1 ? 28 : [4, 19, 20].includes(i) ? 38 : 22 }));
  for (let r = 5; r < 5 + detailRows.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cell = detail[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === 'n') cell.z = [0, 6].includes(c) ? '0' : [7, 10].includes(c) ? '0.####' : '#,##0.00';
      else if (cell?.t === 's') cell.z = '@';
    }
  }
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, detail, toExcelSheetName('تفاصيل الطرود'));
  return workbook;
}

export function downloadInventoryExcel(rows: readonly any[], inventory: any) {
  XLSX.writeFile(buildInventoryWorkbook(rows, inventory), `${toFileName(inventory?.voyage, 'inventory')}.xlsx`, { compression: true });
}
