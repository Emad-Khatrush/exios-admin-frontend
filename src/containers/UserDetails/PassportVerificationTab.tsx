import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Snackbar, TextField } from '@mui/material';
import moment from 'moment';
import api from '../../api';
import Badge from '../../components/Badge/Badge';
import { PassportVerification } from '../../models';
import './PassportVerificationTab.scss';

type Props = {
  user: any
  onSaved?: (fields: { passportVerification: PassportVerification, firstName: string, lastName: string }) => void
}

const PassportVerificationTab = ({ user, onSaved }: Props) => {
  const canManage = useSelector((state: any) => {
    const roles = state.session?.account?.roles;
    return !!(roles?.isAdmin || roles?.isAccountant);
  });
  const passport: PassportVerification | undefined = user?.passportVerification;

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string }>();

  const badge = passport?.status === 'verified'
    ? { text: 'Verified', color: 'success' as const }
    : passport?.status === 'rejected'
    ? { text: 'Rejected', color: 'danger' as const }
    : { text: 'Pending', color: 'warning' as const };

  const updateStatus = async (status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason' });
      return;
    }
    try {
      setIsSaving(true);
      const res = await api.update(`customer/${user._id}/passportVerification`, {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason.trim() : undefined,
        firstName: status === 'verified' ? firstName.trim() : undefined,
        lastName: status === 'verified' ? lastName.trim() : undefined,
      });
      onSaved?.({
        passportVerification: res.data.passportVerification,
        firstName: res.data.firstName,
        lastName: res.data.lastName,
      });
      setShowRejectForm(false);
      setRejectionReason('');
      setMessage({ type: 'success', text: status === 'verified' ? 'Passport verified' : 'Passport rejected' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Could not update passport verification' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="passport-verification-tab">
      <div className="pvt-header">
        <h3>Passport Verification</h3>
        <Badge text={badge.text} color={badge.color} />
      </div>

      {passport?.imageUrl ? (
        <a className="pvt-image" href={passport.imageUrl} target="_blank" rel="noreferrer">
          <img src={passport.imageUrl} alt="Passport" />
        </a>
      ) : (
        <p className="pvt-meta">No passport image uploaded.</p>
      )}

      {passport?.status === 'rejected' && passport?.rejectionReason && (
        <p className="pvt-reason"><strong>Rejection reason:</strong> {passport.rejectionReason}</p>
      )}

      {passport?.submittedAt && (
        <p className="pvt-meta">Submitted: {moment(passport.submittedAt).format('DD/MM/YYYY HH:mm')}</p>
      )}
      {passport?.reviewedAt && (
        <p className="pvt-meta">Reviewed: {moment(passport.reviewedAt).format('DD/MM/YYYY HH:mm')}</p>
      )}

      {!canManage && <p className="pvt-readonly">Only admins and accountants can approve or reject passport verification.</p>}

      {canManage && passport?.status !== 'verified' && (
        <div className="pvt-name-fields">
          <p className="pvt-meta">Correct the spelling to match the passport before approving, if needed.</p>
          <div className="pvt-name-row">
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
        </div>
      )}

      {canManage && !showRejectForm && (
        <div className="pvt-actions">
          {passport?.status !== 'verified' && (
            <button type="button" className="pvt-approve" disabled={isSaving} onClick={() => updateStatus('verified')}>
              Approve
            </button>
          )}
          {passport?.status !== 'rejected' && (
            <button type="button" className="pvt-reject" disabled={isSaving} onClick={() => setShowRejectForm(true)}>
              Reject
            </button>
          )}
        </div>
      )}

      {canManage && showRejectForm && (
        <div className="pvt-reject-form">
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Rejection reason"
            placeholder="Why is this passport being rejected? The customer will see this."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            disabled={isSaving}
          />
          <div className="pvt-actions">
            <button type="button" className="pvt-reject" disabled={isSaving} onClick={() => updateStatus('rejected')}>
              Confirm rejection
            </button>
            <button type="button" className="pvt-cancel" disabled={isSaving} onClick={() => setShowRejectForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage(undefined)}>
        <Alert severity={message?.type} onClose={() => setMessage(undefined)} sx={{ width: '100%' }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PassportVerificationTab;
