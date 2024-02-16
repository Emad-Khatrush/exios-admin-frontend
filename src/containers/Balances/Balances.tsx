import React from 'react'
import DebtsPage from '../../components/DebtsPage/DebtsPage';

type Props = {

}

const Balances = (props: Props) => {
  return (
    <div className="container mt-4">
      <div className="row">
        <DebtsPage />
      </div>
    </div>
  )
}

export default Balances;
