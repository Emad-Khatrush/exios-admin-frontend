import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { Printer } from 'lucide-react';
import { EVENT_LABELS, acc, errorText } from './accountingApi';
import { Ltr, Money, PageHeader } from './ui';

const TITLES: Record<string, { title: string; party: string; verb: string }> = {
  receipt: { title: 'سند قبض', party: 'استلمنا من', verb: 'قُبض في' },
  payment: { title: 'سند صرف', party: 'صرفنا إلى', verb: 'صُرف من' },
};

// A receipt or payment voucher for one entry that moved cash (spec 7). Printed from the browser
// (or saved as PDF); its number is fixed the first time it is opened.
const Voucher = () => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    acc.get(`vouchers/${entryId}`).then((res: any) => setData(res.data)).catch((err: any) => setError(errorText(err)));
  }, [entryId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <div className="acc-empty">جارٍ التحميل…</div>;
  const text = TITLES[data.kind];

  return (
    <>
      <div className="acc-noprint">
        <PageHeader
          title={<>{text.title} <Ltr>{data.number}</Ltr></>}
          subtitle="للطباعة أو الحفظ PDF. الرقم ثابت لهذا القيد ولا يتغير عند إعادة الطباعة."
          actions={<>
            <Button onClick={() => navigate(`/accounting/entries/${data.entryId}`)}>القيد</Button>
            <Button variant="contained" startIcon={<Printer size={16} />} onClick={() => window.print()}>طباعة</Button>
          </>}
        />
        {data.status === 'reversed' && <Alert severity="warning" className="mb-3">قيد هذا السند مُلغى. السند لا يُعتدّ به.</Alert>}
      </div>

      <div className={`acc-voucher${data.status === 'reversed' ? ' acc-voucher--void' : ''}`}>
        <div className="acc-voucher__head">
          <div>
            <div className="acc-voucher__company">Exios</div>
            <div className="acc-muted">إكسيوس للشراء والشحن</div>
          </div>
          <div className="acc-voucher__title">{text.title}</div>
          <div className="acc-voucher__meta">
            <div>رقم <Ltr>{data.number}</Ltr></div>
            <div>التاريخ <Ltr>{data.day}</Ltr></div>
          </div>
        </div>

        <table className="acc-voucher__body">
          <tbody>
            <tr><th>{text.party}</th><td>{data.party ? <>{data.party.name}{data.party.customerId && <> · <Ltr>{data.party.customerId}</Ltr></>}</> : <span className="acc-voucher__blank" />}</td></tr>
            {data.cash.map((box: any) => (
              <tr key={box.code}>
                <th>المبلغ</th>
                <td>
                  <span className="acc-voucher__amount"><Money value={box.amount} currency={box.currency} decimals={box.decimals} tone="plain" strong /></span>
                  {box.currency !== 'USD' && <span className="acc-muted"> · يعادل <Money value={box.usd} tone="plain" />{box.rate ? <> بسعر <Ltr>{box.rate}</Ltr></> : null}</span>}
                  <div className="acc-muted">{text.verb}: {box.name}{box.office ? ` · ${box.office}` : ''}</div>
                </td>
              </tr>
            ))}
            <tr><th>وذلك عن</th><td>{data.description}{data.against.filter((line: any) => line.label).length > 0 && <div className="acc-muted">{data.against.filter((line: any) => line.label).map((line: any) => line.label).join(' · ')}</div>}</td></tr>
            <tr><th>نوع العملية</th><td>{EVENT_LABELS[data.eventType] || data.eventType} · قيد <Ltr>{data.entryNumber}</Ltr></td></tr>
          </tbody>
        </table>

        <div className="acc-voucher__signatures">
          <div><span>المحاسب</span>{data.createdBy && <small>{data.createdBy}</small>}</div>
          <div><span>أمين الخزينة</span></div>
          <div><span>{data.kind === 'receipt' ? 'الدافع' : 'المستلم'}</span></div>
        </div>
      </div>
    </>
  );
};

export default Voucher;
