import { ReactNode } from 'react';
import moment from 'moment';

// The papers of a staff member's custody or loan (owner's request 2026-10-04), printed and signed
// by the accountant and the employee: a receipt when the money is handed over, and a settlement
// listing what was spent from it, what came back and what is left, when it is closed.
export type PaperKind = 'custody' | 'loan';
export type Movement = {
  entryId: string; number: string; day: string; createdAt?: string; currency: string; amount: number; usd: number; description: string;
  kind: string; canceled?: boolean; detail?: string; reference?: string; receipts?: number; cash?: { currency: string; amount: number; name: string } | null;
};

const KIND_NAME: Record<PaperKind, string> = { custody: 'عهدة', loan: 'سلفة' };
const MOVE_NAME: Record<string, string> = { given: 'تسليم', spent: 'مصروف', returned: 'إرجاع', deducted: 'خصم من الراتب', other: 'أخرى' };
const money = (value: number, currency: string) => `${Math.abs(Number(value || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

// The movements of the current round in one currency, oldest first: from the last time the
// balance was back to zero (the previous round closed) up to now. Cancelled operations and their
// reversals are left out, they changed nothing.
export const currentRound = (movements: Movement[], currency: string) => {
  const rows = movements.filter((m) => m.currency === currency && !m.canceled && m.kind !== 'canceled').slice().reverse();
  let start = 0;
  let running = 0;
  rows.forEach((row, index) => {
    running += row.amount;
    if (Math.abs(running) < 0.005 && index < rows.length - 1) start = index + 1;
  });
  return rows.slice(start);
};

const sheet: Record<string, any> = {
  page: { width: '210mm', minHeight: '287mm', padding: '16mm 14mm', boxSizing: 'border-box', fontFamily: 'Tahoma, Arial, sans-serif', color: '#101828', fontSize: 13, direction: 'rtl', background: '#fff' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #101828', paddingBottom: 10, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  muted: { color: '#667085', margin: '2px 0' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', margin: '12px 0 16px' },
  table: { width: '100%', borderCollapse: 'collapse', margin: '8px 0 16px' },
  th: { border: '1px solid #d0d5dd', background: '#f2f4f7', padding: '6px 8px', textAlign: 'right', fontWeight: 600 },
  td: { border: '1px solid #d0d5dd', padding: '6px 8px', verticalAlign: 'top' },
  num: { textAlign: 'left', direction: 'ltr', whiteSpace: 'nowrap' },
  total: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #d0d5dd' },
  signs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 48 },
  sign: { borderTop: '1px solid #101828', paddingTop: 6, textAlign: 'center' },
  box: { border: '1px solid #d0d5dd', borderRadius: 8, padding: 12, margin: '12px 0' },
};

const Header = ({ title, number, day }: { title: string; number?: string; day?: string }) => (
  <div style={sheet.head}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <img src="/images/exios-logo.png" alt="Exios" style={{ height: 48 }} />
      <div>
        <p style={{ margin: 0, fontWeight: 700 }}>شركة إكسيوس للشحن</p>
        <p style={sheet.muted}>Exios Shipping</p>
      </div>
    </div>
    <div style={{ textAlign: 'left' }}>
      <p style={sheet.title}>{title}</p>
      {number && <p style={sheet.muted}><bdi>{number}</bdi></p>}
      {day && <p style={sheet.muted}><bdi>{moment(day).format('DD/MM/YYYY')}</bdi></p>}
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><span style={sheet.muted}>{label}: </span><b>{children}</b></div>
);

const Signatures = ({ employee }: { employee: string }) => (
  <div style={sheet.signs}>
    <div><div style={{ height: 40 }} /><div style={sheet.sign}>المحاسب: الاسم والتوقيع</div></div>
    <div><div style={{ height: 40 }} /><div style={sheet.sign}>الموظف ({employee}): التوقيع</div></div>
  </div>
);

// Handed over: what, how much, from which box
export const HandoverReceipt = ({ kind, employee, movement }: { kind: PaperKind; employee: string; movement: Movement }) => (
  <div style={sheet.page}>
    <Header title={`إيصال تسليم ${KIND_NAME[kind]}`} number={movement.reference || movement.number} day={movement.day} />
    <div style={sheet.grid}>
      <Field label="الموظف">{employee}</Field>
      <Field label="النوع">{KIND_NAME[kind]}</Field>
      <Field label="المبلغ"><bdi>{money(movement.amount, movement.currency)}</bdi></Field>
      <Field label="من">{movement.cash?.name || '-'}</Field>
      {movement.detail && <Field label="البيان">{movement.detail}</Field>}
      <Field label="رقم القيد"><bdi>{movement.number}</bdi></Field>
    </div>
    <div style={sheet.box}>
      {kind === 'custody'
        ? <>أقرّ أنا الموظف المذكور أعلاه باستلام مبلغ <b><bdi>{money(movement.amount, movement.currency)}</bdi></b> عهدةً لصرفها على مصاريف الشركة، وأتعهد بتقديم إيصالات ما أصرفه منها وإرجاع ما يتبقى، وتُسوّى العهدة بنفس العملة.</>
        : <>أقرّ أنا الموظف المذكور أعلاه باستلام مبلغ <b><bdi>{money(movement.amount, movement.currency)}</bdi></b> سلفةً شخصية، تُسترد بالخصم من راتبي أو بإرجاعها بنفس العملة.</>}
    </div>
    <Signatures employee={employee} />
  </div>
);

// Closing (or the state so far): given, every expense with its receipt, returned, what is left
export const SettlementStatement = ({ kind, employee, currency, rows }: { kind: PaperKind; employee: string; currency: string; rows: Movement[] }) => {
  const sum = (filter: (m: Movement) => boolean) => rows.filter(filter).reduce((total, m) => total + m.amount, 0);
  const given = sum((m) => m.amount > 0);
  const spent = -sum((m) => m.kind === 'spent');
  const back = -sum((m) => m.amount < 0 && m.kind !== 'spent');
  const left = given - spent - back;
  const closed = Math.abs(left) < 0.005;
  const from = rows[0]?.day;
  const to = rows[rows.length - 1]?.day;
  return (
    <div style={sheet.page}>
      <Header title={`${closed ? 'تسوية وإقفال' : 'كشف'} ${KIND_NAME[kind]}`} day={to} />
      <div style={sheet.grid}>
        <Field label="الموظف">{employee}</Field>
        <Field label="العملة">{currency}</Field>
        <Field label="الفترة"><bdi>{from ? moment(from).format('DD/MM/YYYY') : '-'} – {to ? moment(to).format('DD/MM/YYYY') : '-'}</bdi></Field>
        <Field label="الحالة">{closed ? 'مقفلة: الرصيد صفر' : 'مفتوحة'}</Field>
      </div>
      <table style={sheet.table}>
        <thead>
          <tr>
            <th style={sheet.th}>#</th><th style={sheet.th}>التاريخ</th><th style={sheet.th}>النوع</th><th style={sheet.th}>البيان</th>
            <th style={sheet.th}>المرجع</th><th style={{ ...sheet.th, ...sheet.num }}>له</th><th style={{ ...sheet.th, ...sheet.num }}>عليه</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={`${m.entryId}-${i}`}>
              <td style={sheet.td}>{i + 1}</td>
              <td style={sheet.td}><bdi>{moment(m.day).format('DD/MM/YYYY')}</bdi></td>
              <td style={sheet.td}>{MOVE_NAME[m.kind] || m.kind}</td>
              <td style={sheet.td}>{m.detail || m.description}{m.receipts ? ` (${m.receipts} إيصال)` : ''}</td>
              <td style={sheet.td}><bdi>{m.reference || m.number}</bdi></td>
              <td style={{ ...sheet.td, ...sheet.num }}>{m.amount > 0 ? money(m.amount, currency) : ''}</td>
              <td style={{ ...sheet.td, ...sheet.num }}>{m.amount < 0 ? money(m.amount, currency) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ width: '60%', marginInlineStart: 'auto' }}>
        <div style={sheet.total}><span>المسلَّم</span><b><bdi>{money(given, currency)}</bdi></b></div>
        {kind === 'custody' && <div style={sheet.total}><span>المصروف بإيصالات</span><b><bdi>{money(spent, currency)}</bdi></b></div>}
        <div style={sheet.total}><span>{kind === 'custody' ? 'المُرجَع للخزينة' : 'المُرجَع والمخصوم من الراتب'}</span><b><bdi>{money(back, currency)}</bdi></b></div>
        <div style={{ ...sheet.total, borderBottom: '2px solid #101828' }}><span>الرصيد المتبقي</span><b><bdi>{money(left, currency)}</bdi></b></div>
      </div>
      <div style={sheet.box}>
        {closed
          ? <>تمت تسوية {KIND_NAME[kind]} الموظف المذكور أعلاه بالكامل، ولا يوجد عليه أي رصيد منها بعملة {currency}.</>
          : <>يبقى على الموظف المذكور أعلاه <b><bdi>{money(left, currency)}</bdi></b> من {KIND_NAME[kind]}، تُسوّى بإيصالات المصروف أو بإرجاعها بنفس العملة.</>}
      </div>
      <Signatures employee={employee} />
    </div>
  );
};
