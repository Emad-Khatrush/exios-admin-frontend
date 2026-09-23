// src/components/InvoicePDFPreview.tsx

import { forwardRef } from 'react';
import moment from 'moment';
import { User } from '../../models';
// @ts-ignore
import './InvoicePDFPreview.scss';

type Invoice = {
  _id: string;
  total: number;
  currency: 'USD' | 'EURO' | 'LYD';
  category: 'invoice' | 'shipment';
  rate: number;
  list: any[];
  note?: string;
  createdAt: string;
  referenceId: number;
  amountUSD?: number;
  amountLYD?: number;
  customer: User
  isCanceled?: boolean;
};

type Props = {
  invoice: Invoice;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InvoicePDFPreview = forwardRef<HTMLDivElement, Props>(({ invoice }, ref) => {
  const list = invoice.list || [];
  const fullName = `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim();
  const boxesTotal = list.reduce((sum: number, item: any) => sum + (Number(item.boxesCount) || 0), 0);

  return (
    <div ref={ref} className={`invoice-doc ${invoice.isCanceled ? 'is-canceled' : ''}`}>
      {invoice.isCanceled && <div className="invoice-doc__stamp" aria-hidden>CANCELLED · ملغاة</div>}

      <header className="invoice-doc__head">
        <div className="invoice-doc__brand">
          <img src="/images/exios-logo.png" alt="Exios Company Logo" />
          <div>
            <p className="invoice-doc__company">Exios Shipping</p>
            <p className="invoice-doc__company-ar" dir="rtl">شركة إكسيوس للشحن</p>
            <p className="invoice-doc__muted">Tripoli, Bab Bin Ghashir</p>
            <p className="invoice-doc__muted">0912068211 - 0919734019</p>
          </div>
        </div>

        <div className="invoice-doc__title-block">
          <h1 className="invoice-doc__title">Freight Invoice</h1>
          <p className="invoice-doc__title-ar" dir="rtl">فاتورة شحن</p>
          <dl className="invoice-doc__meta">
            <div><dt>Invoice no.</dt><dd className="invoice-doc__mono">#0{invoice.referenceId}</dd></div>
            <div><dt>Date</dt><dd>{moment(invoice.createdAt).format('DD/MM/YYYY')}</dd></div>
          </dl>
        </div>
      </header>

      <section className="invoice-doc__parties">
        <div>
          <p className="invoice-doc__label">Billed to</p>
          <p className="invoice-doc__strong">{fullName || '-'}</p>
          <p className="invoice-doc__muted">Client code <span className="invoice-doc__mono">{invoice.customer?.customerId || '-'}</span></p>
        </div>
        <div>
          <p className="invoice-doc__label">Paid from wallet</p>
          <p className="invoice-doc__strong">
            {money(invoice.amountUSD || 0)} USD
            {(invoice.amountLYD || 0) > 0 && <span className="invoice-doc__plus"> + {money(invoice.amountLYD || 0)} LYD</span>}
          </p>
          {(invoice.amountLYD || 0) > 0 && <p className="invoice-doc__muted">Exchange rate {invoice.rate}</p>}
        </div>
      </section>

      {list.length > 0 ? (
        <table className="invoice-doc__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Order</th>
              <th>Tracking number</th>
              <th className="is-num">Weight / size</th>
              <th className="is-num">Boxes</th>
              <th className="is-num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item: any, index: number) => (
              <tr key={item.packageId || index}>
                <td className="invoice-doc__muted">{index + 1}</td>
                <td className="invoice-doc__mono">{item.orderId || '-'}</td>
                <td className="invoice-doc__mono">{item.trackingNumber || 'N/A'}</td>
                <td className="is-num">{item.weight?.total ?? '-'} {item.weight?.measureUnit || ''}</td>
                <td className="is-num">{item.boxesCount || '-'}</td>
                <td className="is-num invoice-doc__strong">{money(item.cost)} {invoice.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="invoice-doc__muted">No packages listed.</p>
      )}

      <section className="invoice-doc__summary">
        <div className="invoice-doc__notes">
          {invoice.note &&
            <>
              <p className="invoice-doc__label">Note</p>
              <p>{invoice.note}</p>
            </>
          }
        </div>
        <dl className="invoice-doc__totals">
          <div><dt>Packages</dt><dd>{list.length}</dd></div>
          {boxesTotal > 0 && <div><dt>Boxes</dt><dd>{boxesTotal}</dd></div>}
          <div className="is-total"><dt>Total</dt><dd>{money(invoice.total)} {invoice.currency}</dd></div>
        </dl>
      </section>

      <section className="invoice-doc__sign" dir="rtl">
        <p className="invoice-doc__terms">
          بتوقيعكم على هذه الفاتورة، فإنكم تقرّون بالاطلاع والموافقة على شروط وسياسات الشركة، وتؤكدون استلام البضائع بحالة سليمة وخالية من أي تلف، ولا يحق المطالبة بأي تعويض لاحق.
        </p>
        <div className="invoice-doc__signature">
          <span>اسم المستلم والتوقيع</span>
        </div>
      </section>

      <footer className="invoice-doc__foot">
        <span>Generated {moment().format('DD/MM/YYYY HH:mm')}</span>
        <span>www.exioslibya.com</span>
      </footer>
    </div>
  );
});

export default InvoicePDFPreview;
