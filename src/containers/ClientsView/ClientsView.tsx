import React, { useEffect, useState } from 'react'
import UserWidget from './UserWidget/UserWidget'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import api, { base } from '../../api'
import { CircularProgress } from '@mui/material'

type Props = {}

export const ClientsView = (props: Props) => {

  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState('active');
  const [scrollReached, setScrollReached] = useState(false);
  const [meta, setMeta] = useState({
    limit: 10,
    skip: 0,
    counts: {
      openedWalletCounts: 0,
      verifyStatementCounts: 0,
      userCounts: 0
    }
    
  });

  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState();
  const [cancelToken, setCancelToken] = useState(null);

  useEffect(() => {
    fetchClients(); 
  }, [])

  const fetchClients = async (limit: number = 10, skip: number = 0, allowLoading: boolean = false) => {
    try {
      if (allowLoading) setIsLoading(true);

      const response = (await api.get(`clients`, { limit, skip }))?.data;
      setClients(response.results);
      setMeta(response.meta);

      if (allowLoading) setIsLoading(false);
    } catch (error) {
      if (allowLoading) setIsLoading(false);
    }
  }

  const searchUser = async (event: any) => {
    try {
      setIsLoading(true);
      const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
      setCancelToken(cancelTokenSource)

      clearTimeout(quickSearchDelayTimer);
      setQuickSearchDelayTimer((): any => {
        return setTimeout(async () => {
          const response = (await api.get(`clients?searchValue=${event.target.value}`, { cancelToken }))?.data;
          setClients(response.results);
          setIsLoading(false);
        }, 1)
      })
    } catch (error) {
      setIsLoading(false);
    }
  }

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const currentScrollReached = event.currentTarget.scrollHeight - event.currentTarget.scrollTop <= event.currentTarget.clientHeight + 25;
    const limit = Number(meta.limit);

    if (currentScrollReached !== scrollReached && limit < meta.counts.userCounts) {
      fetchClients(limit + 5, meta.skip, false);
      setScrollReached(currentScrollReached);
    }
  }

  const tabChange = async (tab: string) => {
    setTab(tab);

    if (tab === 'active') {
      fetchClients(10, 0, true);
      return;
    }

    try {
      const response = await api.get(`unverifiedUsersStatement?tab=${tab}`);
      setClients(response.data.results)
    } catch (error) {
      console.log(error);
    }
  }

  const tabs = [
    {
      label: 'Active',
      value: 'active',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.userCounts)} color="sky" />
    },
    {
      label: 'Verify Payments Client',
      value: 'verifyPayments',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.verifyStatementCounts)} color="warning" />
    },
    {
      label: 'Opened Wallets',
      value: 'openedWallet',
      icon: <Badge style={{ marginLeft: '8px'}} text={String(meta.counts.openedWalletCounts)} color="success" />
    },
  ]

  return (
    <div className="m-4">
      <Card
        tabs={tabs}
        showSearchInput={true}
        inputPlaceholder={'Search by User...'}
        bodyStyle={{
          height: '60vh',
          overflow: 'auto',
          marginTop: '20px'
        }}
        searchInputOnChange={searchUser}
        onScroll={tab === 'active' && onScroll}
        tabsOnChange={tabChange}
      >
        {isLoading ? 
          <CircularProgress />
          :
          <div>
            {clients.map((client, i) => (
              <UserWidget
                client={client}
                index={i + 1}
              />
            ))}
          </div>
        }
      </Card>
    </div>
  )
}
