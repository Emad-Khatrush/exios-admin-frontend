import React from 'react'
import Card from './Card/Card';
import { Link } from 'react-router-dom';

type Props = {
  wallets: any[]
}

const WalletsWidget = (props: Props) => {
  const { wallets } = props;
  const { filteredWallets, total } = filterWallets(wallets);

  return (
    <Card>
      <h6> Wallets </h6>
      <hr />
      {(Object.keys(filteredWallets)).map((customerId: any) => (
        <div className='d-flex justify-content-between mb-2 debts'>
          <div className='d-flex gap-4'>
            <Link style={{ textDecoration: 'none' }} to={`/user/${filteredWallets[customerId][0].user._id}`}>{customerId}</Link>
            <p>{`${filteredWallets[customerId][0].user.firstName} ${filteredWallets[customerId][0].user.lastName}`}</p>
          </div>
          {filteredWallets[customerId].map((wallet: any) => (
            <>
              <p style={{ color: '#17d310' }}>{wallet.balance} {wallet.currency}</p>
            </>
          ))}
        </div>
      ))}
      <hr style={{ height: '1px' }} />

      <br />
      <div className='mb-2'>
        <div>
          <p style={{ color: '#17d310' }}>Total USD: {total.USD}</p>
          <p style={{ color: '#17d310' }}>Total LYD: {total.LYD}</p>
        </div>
      </div>
    </Card>
  )
}

const filterWallets = (wallets: any[]) => {
  const filteredWallets: any = {};
  const total: any = {
    USD: 0,
    LYD: 0
  }

  wallets.forEach((wallet: any) => {
    total[wallet.currency] += wallet.balance;

    if(!filteredWallets[wallet.user.customerId]) {
      filteredWallets[wallet.user.customerId] = [];
    }
    filteredWallets[wallet.user.customerId].push(wallet);
  })
  
  return { filteredWallets, total };
}

export default WalletsWidget;
