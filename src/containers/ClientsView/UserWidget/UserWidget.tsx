import { Alert, Snackbar } from '@mui/material';
import { useState } from 'react';
import moment from 'moment-timezone';

import './UserWidget.scss';
import ActionCard from '../../../components/ActionCard/ActionCard';
import Card from '../../../components/Card/Card';
import BoxText from '../../../components/BoxText/BoxText';
import { RiUserSearchFill } from 'react-icons/ri';
import { User } from '../../../models';
import { useSelector } from 'react-redux';

type Props = {
  client: User
  index: number
}

const UserWidget = (props: Props) => {
  const { client, index } = props;

  const { roles } = useSelector((state: any) => state.session.account);

  const [hasCopiedText, setHasCopiedText] = useState<boolean>(false);  

  return (
    <Card style={{ margin: '10px' }}>
      <div className="row order-widget">
        <div className="col-lg-2 m-auto">
          <div className="preview-image h-100">
            <ActionCard 
              text={`${index} View`}
              path={`/user/${client._id}`}
              icon={RiUserSearchFill}
            />
          </div>
        </div>
        <div className="col-lg-10">
          <div className='d-flex justify-content-between'>
            <div>
              <div className='d-flex flex-column'>
                <h5 style={{ marginRight: '8px' }} className='mb-1'> {`${client.firstName} ${client.lastName}`}</h5>
              </div>
              <p 
                className='description mb-2' 
                onClick={() => {
                  navigator.clipboard.writeText(client.customerId);
                  setHasCopiedText(true);
                }}
              > 
                Customer ID: {client.customerId} 
              </p>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center">
              <BoxText 
                firstText={moment(client.createdAt).format('DD-MM-YYYY')}
                secondText='Created Date'
                style={{ marginRight: '10px' }}
              />
              <BoxText 
                firstText={client.username}
                secondText='Username المسجل'
                style={{ marginRight: '10px' }}
              />
              {roles.isAdmin &&
                <BoxText 
                  firstText={`${client.phone}`}
                  secondText='Phone Number'
                  style={{ marginRight: '10px' }}
                />
              }
              <BoxText 
                firstText={client.city?.toLocaleUpperCase()}
                secondText='Registered City'
                style={{ marginRight: '10px' }}
              />
          </div>
        </div>
        <Snackbar 
          open={hasCopiedText} 
          autoHideDuration={1000}
          onClose={() => setHasCopiedText(false)}
        >
          <Alert 
            severity={'success'}
            onClose={() => setHasCopiedText(false)}
          >
            Copied!
          </Alert>
        </Snackbar>
      </div>
    </Card>
  )
}

export default UserWidget;
