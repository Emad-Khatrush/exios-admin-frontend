import { Alert, Button, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../../api';
import { Invoice } from '../../models';
import { ToggleChip } from './parts';
import './ShippingBlockControl.scss';

const ShippingBlockControl = ({ order, disabled, onSaved }: { order: Invoice; disabled?: boolean; onSaved: () => Promise<void> }) => {
  const [blocked, setBlocked] = useState(!!order.shippingBlocked);
  const [reason, setReason] = useState(order.shippingBlockReason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setBlocked(!!order.shippingBlocked); setReason(order.shippingBlockReason || '');
  }, [order._id, order.shippingBlocked, order.shippingBlockReason]);
  const dirty = blocked !== !!order.shippingBlocked || (blocked ? reason.trim() : '') !== (order.shippingBlockReason || '');
  const save = async () => {
    if (disabled || saving || !dirty || (blocked && !reason.trim())) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.update(`order/${order._id}/shipping-block`, { blocked, reason: blocked ? reason.trim() : '' });
      await onSaved(); setSaved(true);
    } catch (err: any) { setError(err?.response?.data?.message || 'Unable to save the shipping restriction. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="shipping-block-control" aria-label="Order problem: shipping restriction">
    <div className="shipping-block-control__row">
      <ToggleChip label="ممنوعة من الشحن" name="shippingBlocked" checked={blocked} tone="danger" disabled={disabled || saving} onChange={(_, checked) => { setBlocked(checked); setSaved(false); setError(''); }} />
      {(dirty || saving) && <Button variant="outlined" size="small" type="button" disabled={disabled || saving || !dirty || (blocked && !reason.trim())} onClick={() => { void save(); }} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}>{saving ? 'Saving…' : 'Save'}</Button>}
    </div>
    {blocked && <TextField label="Reason for shipping restriction" value={reason} fullWidth multiline minRows={2} maxRows={5} required disabled={disabled || saving} inputProps={{ maxLength: 500, dir: 'auto' }} onChange={event => { setReason(event.target.value); setSaved(false); setError(''); }} helperText="Enter the reason, then save. This order cannot be added to a trip while blocked." />}
    {disabled && !order.isCanceled && <p>Save or discard your invoice changes before updating this restriction.</p>}
    {saved && <Alert severity="success" role="status">Shipping restriction saved.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
  </div>;
};
export default ShippingBlockControl;
