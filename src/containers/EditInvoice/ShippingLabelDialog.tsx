import { useState } from 'react';
import { Dialog } from '@mui/material';
import ShippingMarkDialog from '../UserDetails/ShippingMarkDialog';

type Props = { open: boolean; order: any; onClose: () => void; onError: (message: string) => void };

// Reuse the customer shipping mark while preserving this label's order QR destination.
export default function ShippingLabelDialog({ open, order, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const customer = order?.user && typeof order.user === 'object' ? order.user : {};
  const user = { ...customer, customerId: customer.customerId || order?.customerId };
  return <Dialog open={open} onClose={() => { if (!busy) onClose(); }} disableEscapeKeyDown={busy} fullWidth maxWidth="md"
    PaperProps={{ sx: { borderRadius: 2, maxHeight: 'calc(100% - 32px)', margin: { xs: '12px', sm: '32px' }, width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' } } }}>
    {open && <ShippingMarkDialog key={order?._id} user={user} qrTargetId={order?._id} initialMethod={order?.shipment?.method === 'sea' ? 'sea' : 'air'}
      allowSendGuide={false} onClose={onClose} onBusyChange={setBusy} />}
  </Dialog>;
}
