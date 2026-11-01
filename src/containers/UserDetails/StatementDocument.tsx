import { useMemo, useRef, useState } from 'react';
import { Dialog, IconButton, useMediaQuery } from '@mui/material';
import { Download, FileSpreadsheet, Printer, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { toFileName } from '../../utils/methods';
import moment from 'moment';
import { statementDate, statementPeriod, statementSnapshot, statementText } from './statementReport';
import './StatementDocument.scss';

type Props = { userStatements: any[]; user?: any; currency?: string; opening?: number; from?: string; to?: string; disabled?: boolean };
const number = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatementDocument(props: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('period');
  const [dateFrom, setDateFrom] = useState(props.from || '');
  const [dateTo, setDateTo] = useState(props.to || '');
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery('(max-width:700px)');
  const customer = props.user || props.userStatements[0]?.user || {};
  const currency = props.currency || props.userStatements[0]?.currency || 'USD';
  const rows = useMemo(() => props.userStatements.filter(row => row.currency === currency), [props.userStatements, currency]);
  const period = useMemo(() => statementPeriod(rows, dateFrom, dateTo), [rows, dateFrom, dateTo]);
  const snapshot = useMemo(() => statementSnapshot(scope === 'last15' ? period.rows.slice(-15) : period.rows, period.opening), [period, scope]);
  const invalidDates = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const exportDisabled = exporting || printing || invalidDates || !snapshot.rows.length;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'العميل';
  const filename = toFileName('كشف حساب-' + (customer.customerId || name) + '-' + currency + '-' + scope);
  const from = scope === 'last15' ? snapshot.rows[0]?.createdAt : dateFrom || snapshot.rows[0]?.createdAt;
  const to = scope === 'last15' ? snapshot.rows[snapshot.rows.length - 1]?.createdAt : dateTo || snapshot.rows[snapshot.rows.length - 1]?.createdAt;
  const quickPeriod = (value: string) => {
    setScope('period');
    setDateFrom(value === 'today' ? moment().format('YYYY-MM-DD') : value === 'month' ? moment().startOf('month').format('YYYY-MM-DD') : value === 'year' ? moment().startOf('year').format('YYYY-MM-DD') : value === '30' ? moment().subtract(29, 'days').format('YYYY-MM-DD') : '');
    setDateTo(value ? moment().format('YYYY-MM-DD') : '');
  };
  const print = useReactToPrint({ contentRef: ref, documentTitle: filename,
    pageStyle: '@page { size: A4 portrait; margin: 12mm; } html, body { margin: 0 !important; padding: 0 !important; background: white !important; }',
    onBeforePrint: () => { setPrinting(true); setError(''); return Promise.resolve(); },
    onAfterPrint: () => setPrinting(false),
    onPrintError: () => { setPrinting(false); setError('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة أو جرّب متصفحًا آخر.'); },
  });
  const excel = async () => {
    if (exportDisabled) return;
    setExporting(true); setError('');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.aoa_to_sheet([
        ['شركة إكسيوس للشحن — كشف حساب العميل'], ['العميل', name, 'كود العميل', customer.customerId || ''],
        ['العملة', currency, 'من', statementDate(from), 'إلى', statementDate(to)],
        ['الرصيد', snapshot.closing], [],
        ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
        ['', 'الرصيد قبل أول حركة في هذا الكشف', 0, 0, snapshot.opening],
        ...snapshot.rows.map(row => [statementDate(row.createdAt), statementText(row.description),
          row.calculationType === '-' ? Number(row.amount) : 0, row.calculationType === '-' ? 0 : Number(row.amount), Number(row.total)]),
      ]);
      sheet['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
      const book = XLSX.utils.book_new();
      book.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(book, sheet, 'كشف الحساب');
      XLSX.writeFile(book, filename + '.xlsx');
    } catch { setError('تعذر تحميل ملف Excel. أعد المحاولة.'); }
    finally { setExporting(false); }
  };
  return <>
    <button type="button" className="cashflow__print-trigger" disabled={props.disabled} onClick={() => { setScope('period'); setError(''); setOpen(true); }}><Download size={16} aria-hidden="true" />تحميل كشف الحساب</button>
    <Dialog open={open} fullScreen={mobile} fullWidth maxWidth="lg" onClose={() => { if (!exporting && !printing) setOpen(false); }}
      className="statement-preview" aria-labelledby="statement-preview-title" PaperProps={{ dir: 'rtl' }}>
      <header className="statement-preview__toolbar"><div><h2 id="statement-preview-title">معاينة كشف الحساب</h2><p>راجِع الكشف قبل طباعته أو تحميله.</p></div><IconButton aria-label="إغلاق معاينة الكشف" disabled={exporting || printing} onClick={() => setOpen(false)}><X size={20} /></IconButton></header>
      <div className="statement-preview__options">
        <label>من تاريخ<input type="date" value={dateFrom} max={dateTo || undefined} disabled={exporting || printing} onChange={e => setDateFrom(e.target.value)} /></label>
        <label>إلى تاريخ<input type="date" value={dateTo} min={dateFrom || undefined} disabled={exporting || printing} onChange={e => setDateTo(e.target.value)} /></label>
        <label>نطاق التقرير<select value={scope} disabled={exporting || printing} onChange={e => setScope(e.target.value)}><option value="period">جميع حركات الفترة ({period.rows.length})</option><option value="last15">آخر 15 حركة من الفترة</option></select></label>
        <div className="statement-preview__quick">{[['', 'كل الفترة'], ['today', 'اليوم'], ['month', 'هذا الشهر'], ['year', 'هذه السنة'], ['30', 'آخر 30 يومًا']].map(([value, label]) => <button key={value} type="button" disabled={exporting || printing} onClick={() => quickPeriod(value)}>{label}</button>)}</div>
        <p>اختر الفترة، ثم اطبع الكشف أو حمّله. رصيد البداية يشمل الحركات السابقة للفترة.</p>
      </div>
      {invalidDates && <p className="statement-preview__error" role="alert">تاريخ البداية يجب أن يسبق تاريخ النهاية.</p>}
      {!invalidDates && !snapshot.rows.length && <p className="statement-preview__error" role="status">لا توجد حركات خلال الفترة المحددة. اختر فترة أخرى.</p>}
      {error && <p className="statement-preview__error" role="alert">{error}</p>}
      <div className="statement-preview__canvas"><div className="statement-paper" ref={ref} dir="rtl">
        <header className="statement-paper__brand"><div><img src="/images/exios-logo.png" alt="Exios" /><p>شركة إكسيوس للشحن</p></div><div><h1>كشف حساب عميل</h1><span>{currency === 'LYD' ? 'دينار ليبي' : 'دولار أمريكي'} · <bdi>{currency}</bdi></span><small>تاريخ الإصدار: <bdi>{statementDate(new Date())}</bdi></small></div></header>
        <section className="statement-paper__identity"><div><span>اسم العميل</span><strong dir="auto">{name}</strong><small>كود العميل: <bdi>{customer.customerId || '—'}</bdi></small></div><div><span>فترة الكشف</span><strong><bdi>{statementDate(from)}</bdi> — <bdi>{statementDate(to)}</bdi></strong><small>{snapshot.rows.length} حركة · {scope === 'last15' ? 'آخر 15 حركة' : 'جميع حركات الفترة'}</small></div></section>
        <div className="statement-paper__balance"><span>الرصيد · {currency}</span><strong><bdi>{number(snapshot.closing)}</bdi></strong></div>
        <div className="statement-paper__table-wrap"><table><caption>تفاصيل حركات المحفظة — جميع المبالغ بعملة {currency}</caption>
          <colgroup><col style={{ width: '16%' }} /><col style={{ width: '42%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
          <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
          <tr className="statement-paper__opening"><td colSpan={4}>الرصيد قبل أول حركة في هذا الكشف</td><td><bdi>{number(snapshot.opening)}</bdi></td></tr>
          {snapshot.rows.map(row => <tr key={row._id}><td><bdi>{statementDate(row.createdAt)}</bdi></td><td className="statement-paper__description"><p dir="auto">{statementText(row.description)}</p></td><td><bdi>{row.calculationType === '-' ? number(row.amount) : '—'}</bdi></td><td><bdi>{row.calculationType === '-' ? '—' : number(row.amount)}</bdi></td><td><bdi>{number(row.total)}</bdi></td></tr>)}
        </tbody><tfoot><tr><th colSpan={2}>الإجمالي / رصيد نهاية الكشف</th><td><bdi>{number(snapshot.outgoing)}</bdi></td><td><bdi>{number(snapshot.incoming)}</bdi></td><td><bdi>{number(snapshot.closing)}</bdi></td></tr></tfoot></table></div>
        <footer className="statement-paper__footer"><p>يوضح هذا الكشف حركة محفظة العميل خلال الفترة المحددة.</p><span>إكسيوس · شكرًا لتعاملكم معنا</span></footer>
      </div></div>
      <footer className="statement-preview__actions"><p>لحفظ PDF، اختر «حفظ بتنسيق PDF» من نافذة الطباعة.</p><div><button type="button" className="cashflow__button" disabled={exportDisabled} onClick={() => void excel()}><FileSpreadsheet size={16} />{exporting ? 'جارٍ التحميل…' : 'تحميل Excel'}</button><button type="button" className="cashflow__print-trigger" disabled={exportDisabled} onClick={() => print()}><Printer size={16} />طباعة / حفظ PDF</button></div></footer>
    </Dialog>
  </>;
}
