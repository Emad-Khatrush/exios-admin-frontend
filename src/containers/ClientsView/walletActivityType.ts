type Activity = {
  calculationType?: string; actionType?: string; paymentType?: string;
  description?: string; note?: string; paymentCategories?: string[];
};

// Explicit actions and linked payments take priority over legacy free-text descriptions.
export const walletActivityType = (item: Activity): string => {
  if (item.actionType === 'withdrawal' || item.paymentType === 'withdrawal') return 'سحب كاش';
  if (item.actionType === 'refund') return 'استرداد';
  if (item.actionType === 'cancellation') return 'استرداد إلغاء';
  if (item.actionType === 'compensation') return 'تعويض';
  if (item.actionType === 'exchange') return 'صرافة داخل المحفظة';
  if (item.calculationType === '-') {
    const categories = item.paymentCategories || [];
    if (categories.includes('invoice') && categories.includes('receivedGoods')) return 'دفع شراء وشحن';
    if (categories.includes('invoice')) return 'دفع فاتورة شراء';
    if (categories.includes('receivedGoods')) return 'دفع شحن';
    const text = `${item.description || ''} ${item.note || ''}`;
    if (/تم دفع قيمة الشحن|دفع قيمة الشحن|بضاعة مستلمة|Payment for receivedGoods debt/i.test(text)) return 'دفع شحن';
    if (/فاتورة الشراء|فاتورة شراء|لسداد قيمة\s*\(فاتورة\)|Payment for invoice debt/i.test(text)) return 'دفع فاتورة شراء';
    if (/رسوم النقل الداخلي|رسوم التخليص الجمركي/.test(text)) return 'دفع رسوم الشحن';
    if (/\border(?:\s+(?:id|number|no\.?))?[\s:#(]*\d[\d-]*\b/i.test(item.note || '')) return 'دفع فاتورة شراء';
    if (/دفع دين|Payment for general debt/i.test(text)) return 'سداد دين';
    return 'دفع من المحفظة';
  }
  if (item.actionType === 'wallet') return 'إضافة رصيد';
  return item.actionType === 'bank' || item.paymentType === 'bank' ? 'إيداع بنكي' : 'إيداع';
};
