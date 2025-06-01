import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import UserWidget from '../ClientsView/UserWidget/UserWidget';
import { CircularProgress, Dialog } from '@mui/material';
import InfoWidget from '../../components/InfoWidget/InfoWidget';
import { FaMoneyBillWave } from 'react-icons/fa';
import { Debt } from '../../models';
import { checkIfDataArray } from '../../utils/methods';
import CashflowUser from './CashflowUser';
import CustomButton from '../../components/CustomButton/CustomButton';
import AddBalanceToWallet from './AddBalanceToWallet';
import UseWalletBalance from './UseWalletBalance';
import ShippingMarkDialog from './ShippingMarkDialog';

type Props = {}

const UserDetails = (props: Props) => {
  const { id } = useParams();

  const [user, setUser] = useState<any>();
  const [debts, setDebts] = useState<any>();
  const [wallet, setWallet] = useState<any>();
  const [userStatement, setUserStatement] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [dialog, setDialog] = useState<any>();
  const [statementCurrency, setStatementCurrency] = useState('USD');

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchUserStatement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementCurrency])

  const loadData = async () => {
    try {
      await fetchUser();
      await fetchDebtsOfUser();
    } catch (error) {
      console.log(error);
    }
  }

  const fetchUserStatement = async () => {
    try {
      setIsStatementLoading(true);
      const statementResponse = await api.get(`user/${id}/statement?currency=${statementCurrency}`);
      setUserStatement(statementResponse.data.results);
      setIsStatementLoading(false);
    } catch (error) {
      console.log(error);
      setIsStatementLoading(false);
    }
  }

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`customer/${id}`);
      const walletResponse = await api.get(`wallet/${id}`);
      const statementResponse = await api.get(`user/${id}/statement?currency=${statementCurrency}`);
      setUser(response.data);
      setWallet(walletResponse.data.results);
      setUserStatement(statementResponse.data.results);
      setIsLoading(false);
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  }

  const fetchDebtsOfUser = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`debts/${id}`);
      setDebts(response.data);
    } catch (error) {
      console.log(error);
    }
    setIsLoading(false);
  }

  if (isLoading || !user) {
    return (
      <CircularProgress />
    )
  }
  const { totalUsd, totalLyd } = calculateTotal(debts);
  const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);
  const Tag = dialog?.component;
  
  return (
    <div className="m-2 row">
      <div className="col-md-12 mb-2">
        <CustomButton
          background='rgb(0, 171, 85)' 
          size="small"
          disabled={isLoading}
          onClick={() => setDialog({ component: AddBalanceToWallet })}
          style={{
            marginRight: '8px'
          }}
        >
          Add balance to wallet
        </CustomButton>

        <CustomButton 
          background='rgb(8, 29, 121)' 
          size="small"
          disabled={isLoading}
          onClick={() => setDialog({ component: UseWalletBalance })}
        >
          Use balance
        </CustomButton>
      </div>

      <div className="col-md-4">
        <InfoWidget title="Debts" value={`${totalUsd} $, ${totalLyd} LYD`} icon={<FaMoneyBillWave />} />
      </div>
      <div className="col-md-4">
        <InfoWidget title="Wallet" value={`${walletUsd} $, ${walletLyd} LYD`} icon={<FaMoneyBillWave />} />
      </div>

      <UserWidget
        client={user}
        index={1}
      />

      <div className="col-md-4 mb-2">
        <CustomButton
          background='rgb(0, 171, 85)' 
          size="small"
          disabled={isLoading}
          onClick={() => setDialog({ component: ShippingMarkDialog })}
          style={{
            marginRight: '8px'
          }}
        >
          Shipping mark & Address
        </CustomButton>
      </div>

      <CashflowUser 
        userStatement={userStatement}
        onChangeCurrency={(value: string) => setStatementCurrency(value)}
        isLoading={isStatementLoading}
      />

      <Dialog 
        open={dialog}
        onClose={() => setDialog(undefined)}
      >
        {dialog?.component &&
          <Tag 
            balances={{ walletLyd, walletUsd }}
            user={user}
          />
        }
      </Dialog>
    </div>
  )
}

const calculateTotal = (debts: Debt[]) => {
  let totalUsd = 0, totalLyd = 0;
  (debts || []).forEach(debt => {
    const isDebtArray = checkIfDataArray(debt);
    if (isDebtArray) {
      (debt as any || []).forEach((d: Debt) => {
        if (d.currency === 'USD') totalUsd += d.amount
        else if (d.currency === 'LYD') totalLyd += d.amount;
      })
    } else {
      if (debt.currency === 'USD') totalUsd += debt.amount
      else if (debt.currency === 'LYD') totalLyd += debt.amount;
    }
  })

  return { totalUsd, totalLyd }
}

const calculateTotalWallet = (wallet: any) => {
  let totalUsd = 0, totalLyd = 0;
  (wallet || []).forEach((w: any) => {
    if (w.currency === 'USD') totalUsd += w.balance
    else if (w.currency === 'LYD') totalLyd += w.balance;
  })

  return { totalUsd, totalLyd }
}


export default UserDetails;
