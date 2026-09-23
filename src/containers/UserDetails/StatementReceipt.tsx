import { useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useReactToPrint } from 'react-to-print';
import { Printer, ReceiptText } from 'lucide-react';
import moment from 'moment';
// @ts-ignore
import './StatementReceipt.scss';

type Props = {
  statement: any
}

const currencyNames: Record<string, string> = {
  USD: 'دولار أمريكي',
  LYD: 'دينار ليبي',
};

const actionTypeNames: Record<string, string> = {
  cash: 'نقدًا (كاش)',
  bank: 'إيداع بنكي',
  wallet: 'من رصيد المحفظة',
  refund: 'استرداد',
  compensation: 'تعويض',
  cancellation: 'إلغاء عملية',
  withdrawal: 'سحب نقدي',
};

const officeNames: Record<string, string> = {
  tripoli: 'مكتب طرابلس',
  benghazi: 'مكتب بنغازي',
  misurata: 'مكتب مصراتة',
  turkey: 'تركيا',
  china: 'الصين',
  almutahidaTrBank: 'حساب الشركة المتحدة تركيا',
};

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatementReceipt = ({ statement }: Props) => {
  const [open, setOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const isIncome = statement?.calculationType === '+';
  const title = isIncome ? 'إيصال قبض' : 'إيصال دفع';
  const user = statement?.user;
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const receiptNumber = String(statement?._id || '').slice(-6).toUpperCase();
  const currency = statement?.currency || 'USD';

  const customerRow = { label: isIncome ? 'استلمنا من السيد/ة' : 'دفعنا للسيد/ة', value: fullName || '-', code: user?.customerId };
  // Deposit receipts stay short; payment receipts show what was paid and how
  const rows = (isIncome
    ? [
      customerRow,
      { label: 'وذلك عن', value: 'شحن رصيد المحفظة' },
    ]
    : [
      customerRow,
      { label: 'وذلك عن', html: statement?.description || '-' },
      statement?.actionType && { label: 'طريقة الدفع', value: actionTypeNames[statement.actionType] || statement.actionType },
      statement?.office && { label: 'جهة الصرف', value: officeNames[statement.office] || statement.office },
    ]
  ).filter(Boolean) as { label: string, value?: string, html?: string, code?: string }[];

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `${title}-${fullName}-${receiptNumber}`,
    pageStyle: '@page { size: A5 portrait; margin: 0; } html, body { margin: 0; }',
  });

  return (
    <>
      <button
        type="button"
        className={`receipt-trigger ${isIncome ? 'is-in' : 'is-out'}`}
        onClick={() => setOpen(true)}
      >
        <ReceiptText size={14} strokeWidth={2} />
        {title}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', background: '#eceef1' } }}
      >
        <DialogContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          <div ref={receiptRef} className={`receipt ${isIncome ? 'receipt--in' : 'receipt--out'}`} dir="rtl">
            <header className="receipt__head">
              <div className="receipt__brand">
                <img src="/images/exios-logo.png" alt="شعار شركة إكسيوس للشحن" />
                <div>
                  <p className="receipt__company">شركة إكسيوس للشحن</p>
                  <p className="receipt__muted">طرابلس، باب بن غشير</p>
                  <p className="receipt__muted" dir="ltr">0912068211 - 0919734019</p>
                </div>
              </div>

              <div className="receipt__doc">
                <h2 className="receipt__title">{title}</h2>
                <dl className="receipt__meta">
                  <div>
                    <dt>رقم الإيصال</dt>
                    <dd className="receipt__mono">{receiptNumber}</dd>
                  </div>
                  <div>
                    <dt>التاريخ</dt>
                    <dd className="receipt__mono">{moment(statement?.createdAt).format('DD/MM/YYYY')}</dd>
                  </div>
                </dl>
              </div>
            </header>

            <section className="receipt__amount">
              <div>
                <p className="receipt__amount-label">{isIncome ? 'المبلغ المقبوض' : 'المبلغ المدفوع'}</p>
                <p className="receipt__amount-value">
                  <span dir="ltr">{formatNumber(statement?.amount)}</span>
                  <span className="receipt__amount-currency">{currencyNames[currency] || currency}</span>
                </p>
              </div>
            </section>

            <dl className="receipt__rows">
              {rows.map((row) => (
                <div key={row.label} className="receipt__row">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.html
                      ? <span dangerouslySetInnerHTML={{ __html: row.html }} />
                      : row.value}
                    {row.code && <span className="receipt__code">كود {row.code}</span>}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="receipt__signatures">
              {['توقيع العميل', 'توقيع الموظف', 'ختم الشركة'].map((label) => (
                <div key={label} className="receipt__signature">
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <footer className="receipt__foot">
              <span>شكرًا لتعاملكم معنا</span>
              <span dir="ltr">www.exioslibya.com</span>
            </footer>
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#4b5160', textTransform: 'none' }}>إغلاق</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => handlePrint?.()}
            startIcon={<Printer size={16} />}
            sx={{
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.5,
              gap: 1,
              background: isIncome ? '#0f7a4f' : '#b4432b',
              '&:hover': { background: isIncome ? '#0c6641' : '#96371f' },
            }}
          >
            طباعة / PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StatementReceipt;
