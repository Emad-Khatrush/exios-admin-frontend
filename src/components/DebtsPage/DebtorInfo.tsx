import React from 'react'
import RoundedIcon from '../RoundedIcon/RoundedIcon';
import { BiUser } from 'react-icons/bi';
import Badge from '../Badge/Badge';

type Props = {
  username: string
  phoneNumber: string | number
  customerId: string
}

const DebtorInfo = (props: Props) => {
  const { username, phoneNumber, customerId } = props;

  return (
    <div>
      <div className="d-flex">
        <RoundedIcon
          icon={BiUser}
          // borderColor={invoice.borderColor}
          // color={invoice.color}
        />

        <div className="d-flex justify-content-between" style={{ width: '100%' }}>
          <div>
            <p className="username">{username}</p>
            <p className="phone-number">{phoneNumber}</p>
          </div>

          <Badge 
            text={customerId}
          />
        </div>
      </div>
    </div>
  )
}

export default DebtorInfo;
