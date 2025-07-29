// src/components/InvoicePDFPreview.tsx

import React, { forwardRef } from 'react';
import { Typography, Divider, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { User } from '../../models';

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
};

type Props = {
  invoice: Invoice;
};

const InvoicePDFPreview = forwardRef<HTMLDivElement, Props>(({ invoice }, ref) => {
  return (
    <div ref={ref} style={{ padding: '40px', width: '800px', fontFamily: 'Arial' }}>
      <div className='flex justify-between items-center mb-4'>
        <img
          src={'/images/exios-logo.png'}
          alt="Exios Company Logo"
          className="my-2"
          width={200}
          height={120}
        />
      </div>

      <Typography variant="h4">
        Invoice #0{invoice.referenceId}
      </Typography>

      <Typography>Date: {new Date(invoice.createdAt).toLocaleDateString()}</Typography>
      <Typography>Client Code: {invoice.customer.customerId}</Typography>
      <Typography>Full Name: {`${invoice.customer.firstName} ${invoice.customer.lastName}`}</Typography>

      {invoice.note && (
        <Typography sx={{ mt: 2 }}>
          <strong>Note:</strong> {invoice.note}
        </Typography>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>Packages</Typography>

      {invoice.list?.length > 0 ? (
        <Table size="small" sx={{ mb: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Order Id</TableCell>
              <TableCell>Tracking Number</TableCell>
              <TableCell align="right">Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.list.map((item: any, index: number) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.orderId || '—'}</TableCell>
                <TableCell>{item.trackingNumber || 'N/A'}</TableCell>
                <TableCell align="right">
                  {item.cost?.toFixed(2) || '0.00'} {invoice.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <Typography className='mt-2'>Total: {invoice.total.toFixed(2)} {invoice.currency}</Typography>
          <Typography className='mt-2'>Customer Paid: {invoice.amountUSD} $, {invoice.amountLYD} LYD</Typography>

        </Table>
      ) : (
        <Typography variant="body2">No packages listed.</Typography>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography fontSize={12}>Generated on {new Date().toLocaleString()}</Typography>
    </div>
  );
});

export default InvoicePDFPreview;
