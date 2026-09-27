import React, { useState } from 'react'
import { Check, Copy, Phone } from 'lucide-react';
import { getInitials } from './wrapper-util';

type Props = {
  firstName?: string
  lastName?: string
  phoneNumber: string | number
  customerId: string
}

const DebtorInfo = (props: Props) => {
  const { firstName, lastName, phoneNumber, customerId } = props;
  const [copied, setCopied] = useState(false);

  const copyCustomerId = async () => {
    try {
      await navigator.clipboard.writeText(customerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div className="debtor-head">
      <div className="debtor-avatar" aria-hidden="true">{getInitials(firstName, lastName)}</div>

      <div className="debtor-name">
        <strong>{`${firstName || ''} ${lastName || ''}`.trim() || 'Unknown customer'}</strong>
        {phoneNumber &&
          <a href={`tel:${phoneNumber}`}>
            <Phone size={12} strokeWidth={2} />
            {phoneNumber}
          </a>
        }
      </div>

      {customerId &&
        <button
          type="button"
          className="debtor-code"
          onClick={copyCustomerId}
          title="Copy customer code"
        >
          {customerId}
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
        </button>
      }
    </div>
  )
}

export default DebtorInfo;
