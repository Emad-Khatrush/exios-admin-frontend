import { useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useReactToPrint } from 'react-to-print';
import { Download } from 'lucide-react';
import moment from 'moment';

type Props = {
  statement: any
}

const printColors: any = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };

const Field = ({ label, children, wide }: { label: string, children: any, wide?: boolean }) => (
  <div
    style={{
      ...printColors,
      gridColumn: wide ? '1 / -1' : undefined,
      background: '#f7f8fa',
      borderRadius: '14px',
      padding: '14px 18px',
    }}
  >
    <div style={{ color: '#8a8f98', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
    <div style={{ color: '#1c1e21', fontSize: '16px', fontWeight: 600 }}>{children}</div>
  </div>
);

const StatementReceipt = ({ statement }: Props) => {
  const [open, setOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const isIncome = statement?.calculationType === '+';
  const title = isIncome ? 'وصل قبض' : 'وصل صرف';
  const color = isIncome ? '#0a9f4f' : '#d9381e';
  const colorDark = isIncome ? '#067a3b' : '#a92a14';
  const lightColor = isIncome ? '#e8f7ee' : '#fdece8';
  const user = statement?.user;
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const receiptNumber = String(statement?._id || '').slice(-6).toUpperCase();
  const amount = Number(statement?.amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: statement?.currency || 'USD',
  });

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `${title}-${fullName}-${receiptNumber}`,
  });

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={() => setOpen(true)}
        startIcon={<Download size={16} />}
        sx={{
          color,
          borderColor: color,
          borderRadius: '20px',
          textTransform: 'none',
          fontWeight: 600,
          px: 2,
          '&:hover': { borderColor: color, backgroundColor: `${color}14` },
        }}
      >
        {title}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogContent style={{ background: '#eef0f3' }}>
          <div
            ref={receiptRef}
            dir="rtl"
            style={{
              ...printColors,
              background: '#fff',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
              fontFamily: 'inherit',
            }}
          >
            {/* Accent bar */}
            <div style={{ ...printColors, height: '10px', background: `linear-gradient(90deg, ${colorDark}, ${color})` }} />

            <div style={{ padding: '36px 44px 28px' }}>
              {/* Top: brand + title */}
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center" style={{ gap: '16px' }}>
                  <img src="/images/exios-logo.png" alt="Exios Company Logo" width={96} />
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 800, color: '#1c1e21' }}>شركة إكسيوس للشحن</h5>
                    <p style={{ margin: '2px 0 0', color: '#8a8f98', fontSize: '13px' }}>طرابلس باب بن غشير</p>
                    <p style={{ margin: 0, color: '#8a8f98', fontSize: '13px', direction: 'ltr', textAlign: 'right' }}>
                      0912068211 - 0919734019
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      ...printColors,
                      display: 'inline-block',
                      background: lightColor,
                      color,
                      fontWeight: 800,
                      fontSize: '26px',
                      padding: '6px 26px',
                      borderRadius: '999px',
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ color: '#8a8f98', fontSize: '13px', marginTop: '10px' }}>
                    <span style={{ fontFamily: 'monospace', color: '#1c1e21', fontWeight: 700 }}>#{receiptNumber}</span>
                    {' · '}
                    {moment(statement?.createdAt).format('DD/MM/YYYY')}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div
                style={{
                  ...printColors,
                  margin: '32px 0 24px',
                  borderRadius: '20px',
                  padding: '28px 20px',
                  textAlign: 'center',
                  color: '#fff',
                  background: `linear-gradient(135deg, ${colorDark}, ${color})`,
                }}
              >
                <div style={{ opacity: 0.85, fontSize: '14px', marginBottom: '6px', letterSpacing: '1px' }}>
                  {isIncome ? 'المبلغ المقبوض' : 'المبلغ المصروف'}
                </div>
                <div style={{ fontSize: '46px', fontWeight: 800, direction: 'ltr', lineHeight: 1.1 }}>{amount}</div>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label={isIncome ? 'استلمنا من السيد/ة' : 'صرفنا للسيد/ة'}>{fullName}</Field>
                <Field label="كود العميل">
                  <span style={{ fontFamily: 'monospace' }}>{user?.customerId}</span>
                </Field>
                <Field label="وذلك عن" wide>
                  <span dangerouslySetInnerHTML={{ __html: statement?.description || '' }} />
                </Field>
              </div>

              {/* Signatures */}
              <div className="d-flex justify-content-between" style={{ marginTop: '64px' }}>
                {[isIncome ? 'توقيع المُسلِّم' : 'توقيع المستلم', 'ختم الشركة'].map((label) => (
                  <div key={label} style={{ width: '38%', textAlign: 'center' }}>
                    <div
                      style={{
                        borderTop: '1.5px dashed #b5bac1',
                        paddingTop: '10px',
                        color: '#6b7078',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                ...printColors,
                background: '#f7f8fa',
                textAlign: 'center',
                color: '#8a8f98',
                fontSize: '13px',
                padding: '16px',
              }}
            >
              شكرًا لتعاملكم معنا · www.exioslibya.com
            </div>
          </div>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Back</Button>
          <Button variant="contained" color={isIncome ? 'success' : 'error'} onClick={() => handlePrint?.()}>
            <Download size={18} style={{ marginInlineEnd: 6 }} />
            طباعة / PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StatementReceipt;
