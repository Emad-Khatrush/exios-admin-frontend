import { useState } from 'react';
import { Alert, Snackbar, TextField } from '@mui/material';
import moment from 'moment';
import api from '../../api';
// @ts-ignore
import './PassportReviewList.scss';

type Props = {
  customers: any[]
  onReviewed: (customerId: string) => void
}

const PassportReviewList = ({ customers, onReviewed }: Props) => {
  if (customers.length === 0) {
    return <p className="text-center p-5">No passports awaiting review</p>;
  }

  return (
    <div className="passport-review-list">
      {customers.map((customer) => (
        <PassportReviewCard key={customer._id} customer={customer} onReviewed={onReviewed} />
      ))}
    </div>
  );
};

const PassportReviewCard = ({ customer, onReviewed }: { customer: any, onReviewed: Props['onReviewed'] }) => {
  const passport = customer.passportVerification;

  const [firstName, setFirstName] = useState(customer.firstName || '');
  const [lastName, setLastName] = useState(customer.lastName || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string }>();

  const updateStatus = async (status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason' });
      return;
    }
    try {
      setIsSaving(true);
      await api.update(`customer/${customer._id}/passportVerification`, {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason.trim() : undefined,
        firstName: status === 'verified' ? firstName.trim() : undefined,
        lastName: status === 'verified' ? lastName.trim() : undefined,
      });
      onReviewed(customer._id);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Could not update passport verification' });
      setIsSaving(false);
    }
  };

  return (
    <div className="passport-review-card">
      {passport?.imageUrl ? (
        <a className="prc-image" href={passport.imageUrl} target="_blank" rel="noreferrer">
          <img src={passport.imageUrl} alt="Passport" />
        </a>
      ) : (
        <div className="prc-noimage">No image</div>
      )}

      <div className="prc-details">
        <div className="prc-name-row">
          <TextField
            size="small"
            label="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={isSaving}
          />
          <TextField
            size="small"
            label="Last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={isSaving}
          />
        </div>
        <p>Customer ID: {customer.customerId}</p>
        <p>Phone: {customer.phone}</p>
        <p>City: {customer.city?.toUpperCase()}</p>
        <p>Username: {customer.username}</p>
        {passport?.submittedAt && (
          <p className="prc-meta">Submitted: {moment(passport.submittedAt).format('DD/MM/YYYY HH:mm')}</p>
        )}
      </div>

      {!showRejectForm ? (
        <div className="prc-actions">
          <button type="button" className="prc-approve" disabled={isSaving} onClick={() => updateStatus('verified')}>
            Approve
          </button>
          <button type="button" className="prc-reject" disabled={isSaving} onClick={() => setShowRejectForm(true)}>
            Reject
          </button>
        </div>
      ) : (
        <div className="prc-reject-form">
          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label="Rejection reason"
            placeholder="Why is this passport being rejected? The customer will see this."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            disabled={isSaving}
          />
          <div className="prc-actions">
            <button type="button" className="prc-reject" disabled={isSaving} onClick={() => updateStatus('rejected')}>
              Confirm rejection
            </button>
            <button type="button" className="prc-cancel" disabled={isSaving} onClick={() => setShowRejectForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage(undefined)}>
        <Alert severity={message?.type} onClose={() => setMessage(undefined)} sx={{ width: '100%' }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PassportReviewList;
