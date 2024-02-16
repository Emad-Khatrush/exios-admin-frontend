import { Debt } from "../../models";
import Card from "../Card/Card";

import DebtHistory from "./DebtHistory";
import DebtorInfo from "./DebtorInfo";
import { checkIfDataArray } from "../../utils/methods";

import './DebtDetails.scss';

type Props = {
  debt: Debt | Debt[]
  setDialog: (state: any) => void
  fetchData: () => void
}

const DebtDetails = (props: Props) => {
  const { debt } = props;

  // Check if the Debt is array, if array that mean a user have more then one debt
  const debtIsArray = checkIfDataArray(debt);
  const userOwnDebt: Debt = getUserInfo(debt, debtIsArray);
  const { totalLyd, totalUsd } = getTotalDebtOfUser(debt as any || [])
  const { totalLyd: initialTotalLyd, totalUsd: initialTotalUsd } = getTotalInitialDebtOfUser(debt as any || [])

  return (
    <div className="debt-details-page col-md-6">
      <Card>
        <DebtorInfo
          username={`${userOwnDebt.owner.firstName} ${userOwnDebt.owner.lastName}`}
          phoneNumber={userOwnDebt.owner.phone}
          customerId={userOwnDebt.owner.customerId}
        />

        <hr className="break-line" />

        {userOwnDebt.status === 'open' ?
          <p className="title">
            Total Debt: {totalLyd > 0 && `${totalLyd} LYD, `} {totalUsd > 0 && `${totalUsd} USD, `}
          </p>
          :
          <p className="title paid-debt-amount">
            Total Paid Debt: {initialTotalLyd > 0 && `${initialTotalLyd} LYD, `} {initialTotalUsd > 0 && `${initialTotalUsd} USD, `}
          </p>
        }

        {debtIsArray ? (debt as Debt[] || []).map((currentDebt: Debt) => (
            <DebtHistory
              debt={currentDebt}
              setDialog={props.setDialog}
              fetchData={props.fetchData}
            />
          ))
          :
            <DebtHistory
              debt={debt as Debt}
              setDialog={props.setDialog}
              fetchData={props.fetchData}
            />
        }
      </Card>
    </div>
  )
}

const getUserInfo = (debt: any, isDebtArray: boolean) => {
  if (isDebtArray) {
    return debt[0];
  }
  return debt;
}

const getTotalDebtOfUser = (debt: any) => {
  let totalUsd = 0;
  let totalLyd = 0;

  if (checkIfDataArray(debt)) {
    (debt as any || []).forEach((data: Debt) => {
      if (data.currency === 'USD') {
        totalUsd += data.amount;
      } else if (data.currency === 'LYD') {
        totalLyd += data.amount;
      }
    })
  } else {
    // It is an object
    if (debt.currency === 'USD') {
      totalUsd += debt.amount;
    } else if (debt.currency === 'LYD') {
      totalLyd += debt.amount;
    }
  }
  return { totalLyd, totalUsd };
}

const getTotalInitialDebtOfUser = (debt: any) => {
  let totalUsd = 0;
  let totalLyd = 0;
  
  if (checkIfDataArray(debt)) {
    (debt as any || []).forEach((data: Debt) => {
      if (data.currency === 'USD') {
        totalUsd += data.initialAmount;
      } else if (data.currency === 'LYD') {
        totalLyd += data.initialAmount;
      }
    })
  } else {
    // It is an object
    if (debt.currency === 'USD') {
      totalUsd += debt.initialAmount;
    } else if (debt.currency === 'LYD') {
      totalLyd += debt.initialAmount;
    }
  }
  return { totalLyd, totalUsd };
}

export default DebtDetails;
