import moment from 'moment';
// @ts-ignore
import './ApprovedPassportList.scss';

type Props = {
  customers: any[]
}

// Read-only: no approve/reject actions here, these customers are already verified.
// Admin only - see ClientsView.tsx (the "Approved" tab is only offered to admins).
const ApprovedPassportList = ({ customers }: Props) => {
  if (customers.length === 0) {
    return <p className="text-center p-5">No approved passports yet</p>;
  }

  return (
    <div className="approved-passport-list">
      {customers.map((customer) => {
        const passport = customer.passportVerification;
        return (
          <div key={customer._id} className="apl-card">
            {passport?.imageUrl ? (
              <a className="apl-image" href={passport.imageUrl} target="_blank" rel="noreferrer">
                <img src={passport.imageUrl} alt="Passport" />
              </a>
            ) : (
              <div className="apl-noimage">No image</div>
            )}

            <div className="apl-details">
              <h4>{customer.firstName} {customer.lastName}</h4>
              <p>Customer ID: {customer.customerId}</p>
              <p>Phone: {customer.phone}</p>
              <p>City: {customer.city?.toUpperCase()}</p>
              <p>Username: {customer.username}</p>
            </div>

            <div className="apl-meta">
              {passport?.reviewedAt && (
                <p>Approved: {moment(passport.reviewedAt).format('DD/MM/YYYY HH:mm')}</p>
              )}
              {passport?.reviewedBy && (
                <p>By: {passport.reviewedBy.firstName} {passport.reviewedBy.lastName}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovedPassportList;
