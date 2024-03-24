import React, { useEffect, useState } from 'react'
import Card from '../Card/Card';
import { useSelector } from 'react-redux';
import { getTabsOfDebts } from './wrapper-util';
import { Account, Debt } from '../../models';
import DebtDetails from './DebtDetails';
import api, { base } from '../../api';
import { CircularProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { checkIfDataArray } from '../../utils/methods';

type Props = {
  setDialog: (state: any) => void
}

const DebtsTable = (props: Props) => {
  const account: Account = useSelector((state: any) => state.session?.account)

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState('open');
  const [currentOffice, setCurrentOffice] = useState('tripoli');
  const [debts, setDebts] = useState<Debt[]>();
  const [countList, setCountList] = useState({
    openedDebtsCount: 0,
    closedDebtsCount: 0,
    overdueDebtsCount: 0,
    lostDebtsCount: 0
  });
  const [cancelToken, setCancelToken] = useState();
  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState();

  useEffect(() => {
    // Default Fetching
    fetchBalanceOfUsers('open');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBalanceOfUsers = async (value?: string, office?: string) => {
    const generatedValue = !!value ? value : currentTab;
    const generatedOffice = !!office ? office : currentOffice;

    try {
      setIsLoading(true);
      const response = await api.get(`balances?tabType=${generatedValue}&&officeType=${generatedOffice}`);
      const { debts, countList } = response.data;
      setDebts(debts);
      setCountList(countList);
    } catch (error) {
      console.log(error);
    }
    setIsLoading(false);
  }

  const onTabChange = async (value: string) => {
    setCurrentTab(value);
    fetchBalanceOfUsers(value);
  }

  const searchForDebt = async (event: any) => {
    try {
      setIsLoading(true);
      const value = event.target.value;
      if (!value) {
        const response = await api.get(`balances?tabType=${currentTab}&&officeType=${currentOffice}`);
        const { debts, countList } = response.data;
        setDebts(debts);
        setCountList(countList);
        return;
      }
      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const response = await api.get(`debts/search?searchValue=${value}`, { cancelToken });
          setDebts(response.data);
        }, 1)
      })
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  const { openedDebtsCount, closedDebtsCount, overdueDebtsCount, lostDebtsCount } = countList;
  const debtTabs = getTabsOfDebts({ openedDebtsCount, closedDebtsCount, overdueDebtsCount, lostDebtsCount }, (account.roles.isAdmin || account.roles?.accountant))
  const { totalLyd, totalUsd } = calculateTotalDebt(debts as any, currentOffice);
  
  return (
    <div className='col-12'>
      
      <div className='d-flex align-items-center justify-content-between'>
        <ToggleButtonGroup
          color="success"
          value={currentOffice}
          exclusive
          onChange={(event: any, value: string) => {
            setCurrentOffice(value);
            fetchBalanceOfUsers(undefined, value);
          }}
          size="small"
          className='mb-3'
        >
          <ToggleButton value="tripoli">Tripoli</ToggleButton>
          <ToggleButton value="benghazi">Benghazi</ToggleButton>
        </ToggleButtonGroup>
        
        {(totalLyd > 0 || totalUsd > 0) &&
          <p style={{ color: '#ec4848' }}>
            Total Debt: {totalLyd} LYD, {totalUsd} USD
          </p>
        }
      </div>
      
      
      <Card
        leand
        tabs={debtTabs}
        style={{
          padding: '25px'
        }}
        bodyStyle={{
          height: '60vh',
          overflow: 'auto',
          marginTop: '25px'
        }}
        tabsOnChange={(value: string) => onTabChange(value)}
        searchInputOnChange={(event: any) => {
          const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
          setCancelToken(cancelTokenSource);
          searchForDebt(event);
        }}
        // onScroll={this.onScroll}
        showSearchInput={true}
        inputPlaceholder={'Search by Code...'}
      >
        {!isLoading ?
          <div className='row'>
            {(debts || []).length > 0 ? (debts || []).map((debt: Debt) => (
                <DebtDetails 
                  debt={debt}
                  setDialog={props.setDialog}
                  fetchData={fetchBalanceOfUsers}
                />
              ))
              :
              <p>Debts Not Found</p>
            }
          </div>
          :
          <CircularProgress />
        }
      </Card>
    </div>
  )
}

const calculateTotalDebt = (debts: Debt[], currentOffice: string) => {
  let totalUsd = 0, totalLyd = 0;
  (debts || []).forEach(debt => {
    const isDebtArray = checkIfDataArray(debt);
    if (isDebtArray) {
      (debt as any || []).forEach((d: Debt) => {
        if (d.currency === 'USD' && d.createdOffice === currentOffice) totalUsd += d.amount
        else if (d.currency === 'LYD' && d.createdOffice === currentOffice) totalLyd += d.amount;
      })
    } else {
      if (debt.currency === 'USD' && debt.createdOffice === currentOffice) totalUsd += debt.amount
      else if (debt.currency === 'LYD' && debt.createdOffice === currentOffice) totalLyd += debt.amount;
    }
  })

  return { totalUsd, totalLyd }
}

export default DebtsTable;
