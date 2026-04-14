import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import UserWidget from '../ClientsView/UserWidget/UserWidget';
import { CircularProgress, Dialog, Tab, Tabs } from '@mui/material';
import InfoWidget from '../../components/InfoWidget/InfoWidget';
import TextInput from '../../components/TextInput/TextInput';
import { FaMoneyBillWave } from 'react-icons/fa';
import { AiOutlineSearch } from 'react-icons/ai';
import { Debt } from '../../models';
import { checkIfDataArray } from '../../utils/methods';
import CashflowUser from './CashflowUser';
import CustomButton from '../../components/CustomButton/CustomButton';
import AddBalanceToWallet from './AddBalanceToWallet';
import UseWalletBalance from './UseWalletBalance';
import ShippingMarkDialog from './ShippingMarkDialog';
import UserOrders from './UserOrders';
import UserInvoices from './UserInvoices';

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
  const [activeTap, setActiveTap] = useState<'profile' | 'orders' | 'invoices' | 'settings'>('profile');
  const [statementCurrency, setStatementCurrency] = useState('USD');
  const [customerId, setCustomerId] = useState();

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
      setCustomerId(response.data.customerId);
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

  const changeCustomerId = async () => {
    try {
      setIsLoading(true);
      await api.update(`customerId/${id}/update`, { customerId });
      alert('Customer ID updated successfully');
      setIsLoading(false);
    } catch (error: any) {
      console.log(error);
      alert(error.response?.data?.message || 'Error updating customer ID');
      setIsLoading(false);
    }
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
      <Tabs
        className='mb-4'
        value={activeTap}
        onChange={(_, value) => setActiveTap(value as any)}
        variant="scrollable"
        scrollButtons={false}
        aria-label="scrollable prevent tabs example"
      >
        <Tab label="Profile" value="profile" />
        <Tab label="Orders" value="orders" />
        <Tab label="Created Invoices" value="invoices" />
        <Tab label="Settings" value="settings" />
      </Tabs>

      {activeTap === 'profile' ? (
        <div className="row">
          <div className="col-md-12 mb-2">
            <CustomButton
              background='rgb(0, 171, 85)'
              size="small"
              disabled={isLoading}
              onClick={() => setDialog({ component: AddBalanceToWallet })}
              style={{ marginRight: '8px' }}
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

          <UserWidget client={user} index={1} />

          <div className="col-md-4 mb-2">
            <CustomButton
              background='rgb(0, 171, 85)'
              size="small"
              disabled={isLoading}
              onClick={() => setDialog({ component: ShippingMarkDialog })}
              style={{ marginRight: '8px' }}
            >
              Shipping mark & Address
            </CustomButton>
          </div>

          <CashflowUser
            userStatement={userStatement}
            onChangeCurrency={(value: string) => setStatementCurrency(value)}
            isLoading={isStatementLoading}
          />
        </div>
      ) : activeTap === 'orders' ? (
        <div className="col-md-12">
          <UserOrders
            customerId={user._id}
            balances={{ walletLyd, walletUsd }}
          />
        </div>
      ) : activeTap === 'settings' ? (
        <div className="col-md-12">
          <h3 className='mb-3'>Change Customer Code</h3>
          <TextInput
            name="customerId"
            placeholder="Customer ID"
            icon={<AiOutlineSearch />}
            value={customerId}
            onChange={(event: any) => setCustomerId(event.target.value)}
            maxLength={4}
          />

          <CustomButton
            className='mt-3'
            background='rgb(0, 171, 85)'
            size="small"
            disabled={isLoading}
            onClick={() => changeCustomerId() }
          >
            Change Code
          </CustomButton>
            
        </div>
      ) : activeTap === 'invoices' && (
        <div className="col-md-12">
          <UserInvoices customerId={user._id} />
        </div>
      )}

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
