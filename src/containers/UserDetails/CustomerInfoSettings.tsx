import { CircularProgress, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Pencil } from 'lucide-react';
import api from '../../api';
import { getErrorMessage } from '../../utils/errorHandler';

import './CustomerInfoSettings.scss';

type Props = {
  user: any
  onSaved: (user: any) => void
}

type InfoForm = {
  firstName: string
  lastName: string
  username: string
  phone: string
  city: string
}

const toForm = (user: any): InfoForm => ({
  firstName: user?.firstName || '',
  lastName: user?.lastName || '',
  username: user?.username || '',
  phone: user?.phone !== undefined && user?.phone !== null ? String(user.phone) : '',
  city: user?.city || '',
});

// API error codes for this screen, in words staff understand
const describeError = (message?: string) => {
  if (message === 'user-exist') return 'This username is already used by another account.';
  if (message === 'phone-exist') return 'This phone number is already used by another account.';
  if (message === 'fields-empty') return 'First name, last name, username and phone are required.';
  if (message === 'authorize-invalid') return 'Only admins can edit customer info.';
  if (message && message.includes(' ')) return message;
  return getErrorMessage(message as any);
}

const Value = ({ children }: { children: React.ReactNode }) => (
  <dd>{children || <span className="is-empty">Not set</span>}</dd>
);

// Customer > Settings: the customer's own info. Everyone can see it; only admins can edit it.
export const CustomerInfoCard = ({ user, onSaved }: Props) => {
  const isAdmin = useSelector((state: any) => !!state.session?.account?.roles?.isAdmin);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<InfoForm>(toForm(user));
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean, text: string }>();

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setResult(undefined);
  }

  const startEditing = () => {
    setForm(toForm(user));
    setResult(undefined);
    setIsEditing(true);
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setResult(undefined);
      const response = await api.update(`customer/${user._id}/info`, form);
      onSaved(response.data);
      setIsEditing(false);
      setResult({ ok: true, text: 'Customer info saved.' });
    } catch (error: any) {
      setResult({ ok: false, text: describeError(error?.response?.data?.message) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="ci-card" aria-labelledby="ci-info-title">
      <div className="ci-card-head">
        <div>
          <h2 id="ci-info-title">Customer info</h2>
          <p>{isAdmin ? 'Name, login and contact details of this customer.' : 'Only admins can edit this information.'}</p>
        </div>
        {isAdmin && !isEditing && (
          <button type="button" className="ci-btn is-ghost" onClick={startEditing}>
            <Pencil size={15} strokeWidth={2} />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSubmit}>
          <div className="ci-grid">
            <div className="ci-field">
              <label className="ci-label" htmlFor="ci-firstName">First name<em aria-hidden="true">*</em></label>
              <TextField id="ci-firstName" name="firstName" size="small" fullWidth required value={form.firstName} onChange={onChange} inputProps={{ dir: 'auto' }} />
            </div>
            <div className="ci-field">
              <label className="ci-label" htmlFor="ci-lastName">Last name<em aria-hidden="true">*</em></label>
              <TextField id="ci-lastName" name="lastName" size="small" fullWidth required value={form.lastName} onChange={onChange} inputProps={{ dir: 'auto' }} />
            </div>
            <div className="ci-field">
              <label className="ci-label" htmlFor="ci-username">Username<em aria-hidden="true">*</em></label>
              <TextField id="ci-username" name="username" size="small" fullWidth required value={form.username} onChange={onChange} autoComplete="off" />
              <span className="ci-hint">The customer uses it to log in.</span>
            </div>
            <div className="ci-field">
              <label className="ci-label" htmlFor="ci-phone">Phone<em aria-hidden="true">*</em></label>
              <TextField
                id="ci-phone"
                name="phone"
                size="small"
                fullWidth
                required
                value={form.phone}
                onChange={onChange}
                inputProps={{ inputMode: 'tel', dir: 'ltr' }}
              />
              <span className="ci-hint">Also used to log in and for WhatsApp messages. Saved without +218 or the leading 0.</span>
            </div>
            <div className="ci-field">
              <label className="ci-label" htmlFor="ci-city">City<small>Optional</small></label>
              <TextField id="ci-city" name="city" size="small" fullWidth value={form.city} onChange={onChange} inputProps={{ dir: 'auto' }} />
            </div>
          </div>

          {result && !result.ok && <div className="ci-note is-error" role="alert">{result.text}</div>}

          <div className="ci-actions">
            <button type="button" className="ci-btn is-ghost" onClick={() => { setIsEditing(false); setResult(undefined); }} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="ci-btn is-primary" disabled={isSaving}>
              {isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="ci-details">
            <div><dt>First name</dt><Value>{user?.firstName}</Value></div>
            <div><dt>Last name</dt><Value>{user?.lastName}</Value></div>
            <div><dt>Username</dt><Value>{user?.username}</Value></div>
            <div><dt>Phone</dt><Value>{user?.phone ? <bdi>{user.phone}</bdi> : ''}</Value></div>
            <div><dt>City</dt><Value>{user?.city}</Value></div>
            <div><dt>Customer code</dt><Value>{user?.customerId}</Value></div>
          </dl>
          {result?.ok && <div className="ci-note is-ok" role="status">{result.text}</div>}
        </>
      )}
    </section>
  );
}

// Customer > Settings: change the customer code (same access as before: admins and employees)
export const CustomerCodeCard = ({ user, onSaved }: Props) => {
  const [code, setCode] = useState<string>(user?.customerId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean, text: string }>();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const customerId = code.trim().toUpperCase();
    if (!customerId || customerId === user?.customerId) return;
    try {
      setIsSaving(true);
      setResult(undefined);
      const response = await api.update(`customerId/${user._id}/update`, { customerId });
      onSaved(response.data);
      setCode(customerId);
      setResult({ ok: true, text: `Customer code changed to ${customerId}.` });
    } catch (error: any) {
      setResult({ ok: false, text: describeError(error?.response?.data?.message) || 'Could not change the customer code.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="ci-card" aria-labelledby="ci-code-title">
      <div className="ci-card-head">
        <div>
          <h2 id="ci-code-title">Customer code</h2>
          <p>A letter followed by three digits, for example A123. It must not be used by another customer.</p>
        </div>
      </div>

      <form className="ci-code-row" onSubmit={onSubmit}>
        <div className="ci-field">
          <label className="ci-label" htmlFor="ci-code">New code</label>
          <TextField
            id="ci-code"
            size="small"
            value={code}
            onChange={(event) => { setCode(event.target.value); setResult(undefined); }}
            inputProps={{ maxLength: 4, style: { textTransform: 'uppercase' } }}
          />
        </div>
        <button
          type="submit"
          className="ci-btn is-primary"
          disabled={isSaving || !code.trim() || code.trim().toUpperCase() === user?.customerId}
        >
          {isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Change code'}
        </button>
      </form>

      {result && <div className={`ci-note ${result.ok ? 'is-ok' : 'is-error'}`} role="status">{result.text}</div>}
    </section>
  );
}
