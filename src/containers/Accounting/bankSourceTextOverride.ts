export const bankSourceTextOverride = (item: any, fallback: string) => item.source === 'yuan'
  ? 'طرف متعدد العمليات — اختر نوع الحركة'
  : fallback;
