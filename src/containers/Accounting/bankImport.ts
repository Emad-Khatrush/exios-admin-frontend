import * as XLSX from 'xlsx';

// Reading a bank statement file into rows: { day, description, reference, amount (+ in / - out), balanceAfter }.
// Banks put titles above the table and name their columns differently (Arabic, English, Turkish,
// Chinese), so the header row and the columns are found automatically and can be corrected on
// screen. Numbers may be written 1,234.56 or (Turkish) 1.234,56; dates 30/09/2026, 30.09.2026,
// 2026-09-30 or 2026年9月30日.

export type StatementRow = { day: string, description: string, reference: string, amount: number, balanceAfter: number | null,
  statementCurrency?: string,
  sourceProvider?: 'alipay', sourceCurrency?: 'CNY', sourceTransactionId?: string, merchantOrderId?: string,
  counterparty?: string, paymentMethod?: string, transactionStatus?: string, sourceTime?: string,
  walletImpact?: 'balance' | 'unknown' | 'confirmed', sourceReviewReason?: string,
  movementKind?: 'purchase' | 'purchase_refund' | 'card_payment',
  originalAmount?: number, originalCurrency?: string, settlementUsd?: number, exchangeRate?: number, counterAmount?: number, counterCurrency?: string };
export type ColumnRole = 'date' | 'description' | 'reference' | 'amount' | 'in' | 'out' | 'direction' | 'balance';
export type Mapping = Partial<Record<ColumnRole, number>>;

export const ROLES: { key: ColumnRole, label: string }[] = [
  { key: 'date', label: 'التاريخ' },
  { key: 'description', label: 'البيان' },
  { key: 'reference', label: 'المرجع' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'in', label: 'وارد (دائن)' },
  { key: 'out', label: 'صادر (مدين)' },
  { key: 'direction', label: 'نوع الحركة (وارد/صادر)' },
  { key: 'balance', label: 'الرصيد' },
];

const NAMES: Record<ColumnRole, string[]> = {
  date: [
    'date', 'day', 'value date', 'transaction date', 'posting date', 'التاريخ', 'تاريخ', 'تاريخ الحركة', 'تاريخ القيمة',
    'tarih', 'islem tarihi', 'valor', 'valor tarihi',
    '日期', '交易日期', '交易时间', '记账日期', '入账时间', '交易创建时间', '付款时间', '时间',
  ],
  description: [
    'description', 'details', 'narrative', 'particulars', 'remarks', 'البيان', 'الوصف', 'التفاصيل', 'بيان',
    'aciklama', 'islem aciklamasi', 'detay',
    '摘要', '交易说明', '说明', '备注', '商品名称', '商品说明', '交易对方', '用途', '附言', '交易类型',
  ],
  reference: [
    'reference', 'ref', 'ref no', 'reference no', 'cheque', 'المرجع', 'رقم المرجع', 'رقم العملية',
    'dekont no', 'dekont', 'referans', 'referans no', 'islem no', 'fis no',
    '交易号', '交易订单号', '流水号', '订单号', '商户订单号', '凭证号',
  ],
  amount: ['amount', 'المبلغ', 'القيمة', 'tutar', 'islem tutari', '金额', '交易金额', '金额（元）', '金额(元)'],
  in: ['in', 'credit', 'deposit', 'deposits', 'credit amount', 'وارد', 'دائن', 'إيداع', 'ايداع', 'alacak', 'yatan', '收入', '收入金额', '贷方发生额', '贷方金额'],
  out: ['out', 'debit', 'withdrawal', 'withdrawals', 'debit amount', 'صادر', 'مدين', 'سحب', 'borc', 'cekilen', '支出', '支出金额', '借方发生额', '借方金额'],
  direction: ['type', 'dr/cr', 'نوع الحركة', 'b/a', 'borc/alacak', '收/支', '收支', '收/付', '资金流向', '借贷标志'],
  balance: ['balance', 'running balance', 'الرصيد', 'رصيد', 'bakiye', '余额', '账户余额', '账户余额(元)'],
};

// Lower case without accents, so TARİH / Tarih / tarih and AÇIKLAMA / Açıklama all read the same
const clean = (value: any) => String(value ?? '').trim().toLocaleLowerCase('tr')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/\s+/g, ' ');
const hasCjk = (text: string) => /[㐀-鿿]/.test(text);

// 1,234.56 / 1.234,56 / 12,50 / -12.5 / 12.50- / (12.50) / ¥1,200.00 / 1.200,00 TL
export const toNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  const negative = /^\(.*\)$/.test(text) || /-\s*$/.test(text) || /^[^\d]*-/.test(text);
  let digits = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(digits)) return null;
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both appear: the last one is the decimal point
    digits = lastComma > lastDot ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Only commas: 12,50 is a decimal comma, 1,234 is thousands
    digits = /,\d{1,2}$/.test(digits) && (digits.match(/,/g) || []).length === 1 ? digits.replace(',', '.') : digits.replace(/,/g, '');
  } else if ((digits.match(/\./g) || []).length > 1) {
    // 1.234.567 (dots as thousands)
    digits = digits.replace(/\./g, '');
  }
  const number = Number(digits);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
};

// Whether a "direction" cell says money went out
const OUT_WORDS = ['支出', '支', '付', '借', 'out', 'debit', 'dr', 'd', 'b', 'borc', 'صادر', 'مدين', 'سحب'];
const IN_WORDS = ['收入', '收', '贷', 'in', 'credit', 'cr', 'c', 'a', 'alacak', 'وارد', 'دائن', 'إيداع'];
const directionOf = (value: any): -1 | 1 | 0 => {
  const text = clean(value);
  if (!text) return 0;
  if (OUT_WORDS.includes(text) || text.includes('支出')) return -1;
  if (IN_WORDS.includes(text) || text.includes('收入')) return 1;
  return 0;
};

export const toDay = (value: any): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
};

// The sheet as rows of cells, and where its table starts. CSV files from Chinese banks are often
// in GBK; a CSV that does not read as UTF-8 is read as GBK.
export const readSheet = async (file: File) => {
  const buffer = await file.arrayBuffer();
  let workbook;
  if (/\.csv$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('�')) {
      try { text = new TextDecoder('gbk').decode(buffer); } catch { /* the browser has no GBK decoder */ }
    }
    // Transaction IDs can exceed 30 digits. Never let CSV type inference round them.
    workbook = XLSX.read(text, { type: 'string', raw: true, cellDates: false });
  } else {
    workbook = XLSX.read(buffer, { cellDates: true });
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const cells: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  return cells.filter((row) => row.some((cell) => String(cell).trim() !== ''));
};

// The first row naming a date column and an amount (or in/out) column is the header
export const detect = (cells: any[][]): { headerRow: number, mapping: Mapping } => {
  const known = Object.fromEntries((Object.keys(NAMES) as ColumnRole[]).map((role) => [role, NAMES[role].map(clean)])) as Record<ColumnRole, string[]>;
  for (let index = 0; index < Math.min(cells.length, 40); index++) {
    const names = cells[index].map(clean);
    const used = new Set<number>();
    const find = (role: ColumnRole) => {
      let at = names.findIndex((name, i) => !used.has(i) && known[role].includes(name));
      if (at < 0) at = names.findIndex((name, i) => !used.has(i) && known[role].some((n) => (n.length > 3 || (hasCjk(n) && n.length >= 2)) && name.includes(n)));
      return at;
    };
    const mapping: Mapping = {};
    // In and out before "amount", so a "debit amount" column is not taken for the amount
    (['date', 'in', 'out', 'balance', 'amount', 'direction', 'reference', 'description'] as ColumnRole[]).forEach((role) => {
      const at = find(role);
      if (at >= 0) { mapping[role] = at; used.add(at); }
    });
    if (mapping.date !== undefined && (mapping.amount !== undefined || mapping.in !== undefined || mapping.out !== undefined)) {
      return { headerRow: index, mapping };
    }
  }
  return { headerRow: 0, mapping: {} };
};

export type AlipayExcludedRow = { day: string, reference: string, description: string, reason: string };

// Kuveyt Türk card "Toplu Ekstre" (Excel): every amount is written positive ("25000.00 TL"), payments
// and refunds included. The kind of line tells the direction, as on the card account (purchase out,
// payment in): "Kredi Kartı Borç Ödeme" is a payment; a merchant refund has negative miles in
// "Mil/ Altın Puan" (-424 for a 13.473,77 TL refund); "fazla bakiye iadesi" (credit sent back to the
// current account) and "Ödeme İptali" (a payment undone) raise the debt again. Checked on the
// owner's 2026 file: October gives the bank's 30-10 debt (229,32 TL) to the kuruş.
export const kuveytCardRows = (cells: any[][]): { rows: StatementRow[], cardNumber: string } | null => {
  const top = cells.slice(0, 8).map(row => (row || []).map(value => String(value).trim()));
  const cardNumber = top.find(row => /^Kart Numaras/i.test(row[0]))?.[1] || '';
  const headerRow = cells.findIndex((row, index) => index < 15 && (row || []).some(v => /^İşlem Tarihi$/i.test(String(v).trim())) && (row || []).some(v => /Mil\s*\/?\s*Altın Puan/i.test(String(v))));
  if (!cardNumber || headerRow < 0) return null;
  const headers = cells[headerRow].map((value: any) => String(value).trim());
  const col = (pattern: RegExp) => headers.findIndex((h: string) => pattern.test(h));
  const [date, description, amount, miles] = [col(/^İşlem Tarihi$/i), col(/^Açıklama$/i), col(/^Tutar$/i), col(/Mil\s*\/?\s*Altın Puan/i)];
  if ([date, description, amount, miles].some(i => i < 0)) return null;
  const rows: StatementRow[] = [];
  for (const row of cells.slice(headerRow + 1)) {
    const day = toDay(row?.[date]);
    const value = Math.abs(toNumber(row?.[amount]) || 0);
    if (!day || !value) continue;
    const text = String(row[description] ?? '').replace(/\s+/g, ' ').trim();
    const refund = /^-/.test(String(row[miles] ?? '').trim());
    const payment = /Borç Ödeme/i.test(text);
    const debtBack = /fazla bakiye iadesi|Ödeme İptali/i.test(text);
    // A bank discount ("Miles&Smiles İGA Otopark İndirimi", 125 TL with 0 miles) lowers the debt like
    // a refund but undoes no purchase: money in, no purchase-refund review (owner's file, 16-06-2026)
    const discount = !debtBack && /İndirim/i.test(text);
    const inward = payment || discount || (refund && !debtBack);
    rows.push({ day, description: text, reference: '', amount: inward ? value : -value, balanceAfter: null,
      movementKind: payment ? 'card_payment' : discount ? undefined : inward ? 'purchase_refund' : 'purchase' });
  }
  return { rows, cardNumber };
};

// The import preview classifies its rows again whenever one of them changes (a sign flipped, an
// Alipay arrival confirmed). The new suggestions must not wipe what the person already decided on
// the other rows (ignored, confirmed, matched to a purchase): before, every row not chosen by hand
// lost its choices, so flipping one line undid the whole review (owner's report 2026-11-13).
// `changed`: the rows whose content differs from the previous classification; they start over.
export const mergeClassifiedChoices = (choices: Record<number, any>, results: any[], changed: Set<number>) => {
  const next: Record<number, any> = { ...choices };
  const decided = ['ignore', 'notDuplicate', 'settlementReviewed', 'confirmNewBill', 'billAccepted', 'purchaseMatch', 'purchaseSelection'];
  results.forEach((item: any, index: number) => {
    const before = choices[index] || {};
    const fresh = !before || changed.has(index);
    if (before.byHand) {
      next[index] = fresh ? { ...before, billAccepted: false, purchaseMatch: undefined, purchaseSelection: undefined } : before;
      return;
    }
    const suggestion = item.status === 'new' && item.account
      ? { accountId: item.account._id, office: item.office || undefined, link: item.link || undefined, vendorName: item.vendorName || undefined, billId: item.billId || undefined }
      : {};
    if (fresh) { next[index] = suggestion; return; }
    const kept = Object.fromEntries(decided.filter((key) => before[key] !== undefined).map((key) => [key, before[key]]));
    next[index] = { ...suggestion, ...kept };
  });
  return next;
};

// Alipay exports transactions, not a running wallet balance. In particular a refund may be
// labelled 不计收支, and a bank-card purchase must not also reduce the Alipay wallet.
export const alipayRows = (cells: any[][], headerRow: number): { rows: StatementRow[], excluded: AlipayExcludedRow[] } | null => {
  const headers = (cells[headerRow] || []).map(value => String(value).trim());
  if (!['交易时间', '交易对方', '收/支', '收/付款方式', '交易状态', '交易订单号'].every(name => headers.includes(name))) return null;
  const rows: StatementRow[] = [];
  const excluded: AlipayExcludedRow[] = [];
  for (const cellsRow of cells.slice(headerRow + 1)) {
    const get = (name: string) => String(cellsRow[headers.indexOf(name)] ?? '').trim();
    const sourceTime = get('交易时间');
    const day = toDay(sourceTime);
    if (!day) continue;
    const reference = get('交易订单号');
    const counterparty = get('交易对方');
    const product = get('商品说明');
    const category = get('交易分类');
    const paymentMethod = get('收/付款方式');
    const transactionStatus = get('交易状态');
    const description = [counterparty, product, category, get('备注')].filter(Boolean).join(' · ');
    const exclude = (reason: string) => excluded.push({ day, reference, description, reason });
    if (!['交易成功', '支付成功', '退款成功'].includes(transactionStatus)) { exclude(`عملية غير مكتملة: ${transactionStatus || 'الحالة غير مذكورة'}`); continue; }
    if (!reference || /[eE][+-]?\d+$/.test(reference)) throw new Error(`رقم عملية Alipay غير صالح بتاريخ ${day}؛ ارفع ملف CSV الأصلي`);
    const amountText = get('金额').replace(/[,¥￥\s]/g, '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) throw new Error(`مبلغ Alipay غير صالح للعملية ${reference}`);
    // A 0.00 line (a ride fully paid by a coupon, Hellobike 02-01-2026 in the owner's file) moves no
    // money; it used to stop the whole file from loading
    if (!(Number(amountText) > 0)) { exclude('مبلغ صفر؛ لا حركة مال'); continue; }
    const refund = transactionStatus === '退款成功' || category === '退款' || /退款/.test(product);
    const direction = get('收/支');
    // A reversal explicitly marked as expense is ambiguous; never silently turn it into income.
    if (refund && direction === '支出') { exclude('استرداد بإشارة صادر؛ راجع المستند قبل إدخاله'); continue; }
    if (!refund && !['收入', '支出'].includes(direction)) { exclude('حركة لا تُحتسب واردًا أو صادرًا؛ اتجاه حركة الرصيد يحتاج مراجعة'); continue; }
    const balance = /^账户余额(?:[（(].*[）)])?$/.test(paymentMethod);
    if (paymentMethod && !balance) { exclude(`الدفع عبر ${paymentMethod} وليس رصيد Alipay؛ طابقها على حساب الدفع الفعلي`); continue; }
    rows.push({ day, description, reference, amount: Number(amountText) * (refund || direction === '收入' ? 1 : -1), balanceAfter: null,
      sourceProvider: 'alipay', sourceCurrency: 'CNY', sourceTransactionId: reference, merchantOrderId: get('商家订单号') || get('商户订单号'),
      counterparty, paymentMethod, transactionStatus, sourceTime, walletImpact: balance ? 'balance' : 'unknown',
      ...(balance ? {} : { sourceReviewReason: 'طريقة الاستلام غير مذكورة؛ تأكد أن المبلغ دخل رصيد Alipay قبل المطابقة أو الترحيل' }),
      ...(refund ? { movementKind: 'purchase_refund' as const, originalAmount: Number(amountText), originalCurrency: 'CNY' } : {}),
    });
  }
  return { rows, excluded };
};

export const rowsFrom = (cells: any[][], headerRow: number, mapping: Mapping): StatementRow[] => cells.slice(headerRow + 1).map((row) => {
  const cell = (role: ColumnRole) => (mapping[role] === undefined ? undefined : row[mapping[role]!]);
  let amount: number | null;
  if (mapping.amount !== undefined) {
    amount = toNumber(cell('amount'));
    // An amount written without a sign, next to a column saying in or out (Alipay 收/支, B/A)
    const direction = directionOf(cell('direction'));
    if (amount !== null && direction) amount = Math.abs(amount) * direction;
  } else {
    amount = (Math.abs(toNumber(cell('in')) || 0) - Math.abs(toNumber(cell('out')) || 0)) || null;
  }
  const description = String(cell('description') ?? '').trim();
  const sourceCurrency = String(cells[headerRow]?.[mapping.amount ?? mapping.in ?? mapping.out ?? -1] || '').match(/\b(TRY|USD|EUR)\b/i)?.[1].toUpperCase();
  const sale = description.match(/([\d.,]+)\s*TRY\s*Kar[sş]ılığı\s*([\d.,]+)\s*(USD|EUR)\s*Sat[iı][sş],?\s*Kur:\s*([\d.,]+)/i);
  const exchange: Partial<StatementRow> = {};
  if (sale && amount) {
    const lira = toNumber(sale[1]), foreign = toNumber(sale[2]), rate = toNumber(sale[4]);
    if (lira && foreign && rate && Math.abs(lira - foreign * rate) <= 1) {
      if (sourceCurrency === 'TRY' && amount > 0 && Math.abs(amount - lira) < 0.005) Object.assign(exchange, { counterAmount: foreign, counterCurrency: sale[3].toUpperCase(), exchangeRate: rate });
      if (sourceCurrency === sale[3].toUpperCase() && amount < 0 && Math.abs(-amount - foreign) < 0.005) Object.assign(exchange, { counterAmount: lira, counterCurrency: 'TRY', exchangeRate: rate });
    }
  }
  return {
    day: toDay(cell('date')),
    description,
    reference: String(cell('reference') ?? '').trim(),
    amount: amount || 0,
    balanceAfter: toNumber(cell('balance')),
    ...(sourceCurrency && { statementCurrency: sourceCurrency }),
    ...exchange,
  };
}).filter((row) => row.day && row.amount);
