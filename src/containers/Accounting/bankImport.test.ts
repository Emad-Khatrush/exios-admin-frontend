import { alipayRows, detect, readSheet } from './bankImport';
import { TextDecoder } from 'util';

Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true });

const headers = ['交易时间', '交易分类', '交易对方', '对方账号', '商品说明', '收/支', '金额', '收/付款方式', '交易状态', '交易订单号', '商家订单号', '备注'];
const id = '2026100100000000000000000001_00000000000000000000000000001';
const row = (changes: Record<string, string> = {}) => headers.map(key => ({ '交易时间': '2026-10-06 01:01:43', '交易分类': '退款', '交易对方': '1688平台商家', '商品说明': '退款-商品', '收/支': '不计收支', '金额': '29.00', '收/付款方式': '账户余额', '交易状态': '退款成功', '交易订单号': id, '商家订单号': 'T50060NP3317080944050011288', ...changes } as Record<string, string>)[key] || '');

test('Alipay refund outside income/expense totals is a positive wallet movement with complete identity', () => {
  const parsed = alipayRows([headers, row()], 0)!;
  expect(parsed.rows[0]).toMatchObject({ amount: 29, movementKind: 'purchase_refund', sourceTransactionId: id, originalCurrency: 'CNY', walletImpact: 'balance' });
  expect(parsed.rows[0].description).toContain('1688平台商家');
  expect(parsed.rows[0].settlementUsd).toBeUndefined();
});
test('expense is negative; direct bank-card spending and unsuccessful transactions are excluded', () => {
  const purchase = { '交易分类': '服饰装扮', '商品说明': '全款交易：商品', '收/支': '支出', '交易状态': '支付成功' };
  const parsed = alipayRows([headers, row(purchase), row({ ...purchase, '收/付款方式': '招商银行信用卡(1234)' }), row({ ...purchase, '交易状态': '交易关闭' })], 0)!;
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0].amount).toBe(-29);
  expect(parsed.excluded).toHaveLength(2);
});
test('refund without a receiving method requires wallet confirmation', () => {
  const parsed = alipayRows([headers, row({ '收/支': '收入', '收/付款方式': '', '交易状态': '交易成功' })], 0)!;
  expect(parsed.rows[0]).toMatchObject({ amount: 29, movementKind: 'purchase_refund', walletImpact: 'unknown' });
});
test('receiving yuan is not automatically purchase refund or revenue', () => {
  const parsed = alipayRows([headers, row({ '交易分类': '转账红包', '商品说明': '收款', '收/支': '收入', '交易状态': '交易成功' })], 0)!;
  expect(parsed.rows[0].amount).toBe(29);
  expect(parsed.rows[0].movementKind).toBeUndefined();
});
test('CSV reader preserves long numeric transaction and merchant IDs without scientific notation', async () => {
  const numeric = '20261006000000000000000000000001';
  const csv = [headers.join(','), row({ '交易订单号': numeric + '\t', '商家订单号': '40000000000000000000001\t' }).join(',')].join('\r\n');
  const bytes = Buffer.from(csv, 'utf8');
  const cells = await readSheet({ name: 'alipay.csv', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as File);
  const { headerRow } = detect(cells);
  const parsed = alipayRows(cells, headerRow)!;
  expect(parsed.rows[0].reference).toBe(numeric);
  expect(parsed.rows[0].merchantOrderId).toBe('40000000000000000000001');
});
test('unknown non-income movement is excluded rather than invented as an inflow', () => {
  const parsed = alipayRows([headers, row({ '交易分类': '其他', '商品说明': '其他操作', '交易状态': '交易成功' })], 0)!;
  expect(parsed.rows).toHaveLength(0);
  expect(parsed.excluded).toHaveLength(1);
});
