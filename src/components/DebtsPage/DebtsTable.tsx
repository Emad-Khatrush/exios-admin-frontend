import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux';
import { getTabsOfDebts, formatAmount } from './wrapper-util';
import { Account, Debt } from '../../models';
import DebtDetails from './DebtDetails';
import api, { base } from '../../api';
import { calculateTotalDebt, checkIfDataArray } from '../../utils/methods';
import * as XLSX from 'xlsx';
import moment from 'moment';
import { Clock, Download, Plus, Search, Users, Wallet, X, FolderOpen, RotateCw } from 'lucide-react';

type Props = {
  setDialog: (state: any) => void
  onCreateDebt: () => void
}

const OFFICES = [
  { value: 'tripoli', label: 'Tripoli' },
  { value: 'benghazi', label: 'Benghazi' },
]

const SEARCH_DELAY_MS = 350;

const DebtsTable = (props: Props) => {
  const account: Account = useSelector((state: any) => state.session?.account)

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState('open');
  const [currentOffice, setCurrentOffice] = useState('tripoli');
  const [searchValue, setSearchValue] = useState('');
  const [debts, setDebts] = useState<Debt[]>();
  const [countList, setCountList] = useState({
    openedDebtsCount: 0,
    closedDebtsCount: 0,
    waitingApprovalDebtsCount: 0,
    overdueDebtsCount: 0,
    lostDebtsCount: 0
  });

  // Only the latest request is allowed to write to state, so a slow response
  // for an old tab / search term never overwrites a newer one
  const requestId = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Default Fetching
    fetchBalanceOfUsers('open');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "/" jumps to the search box from anywhere on the page
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [])

  // silent: refresh the data in place (after a payment, close, delete...) without the loading
  // skeleton, so the list, scroll position and opened payment lists stay where they are
  const fetchBalanceOfUsers = async (value?: string, office?: string, silent = false) => {
    const generatedValue = !!value ? value : currentTab;
    const generatedOffice = !!office ? office : currentOffice;
    const id = ++requestId.current;

    try {
      if (!silent) setIsLoading(true);
      setLoadError(false);
      const response = await api.get(`balances?tabType=${generatedValue}&&officeType=${generatedOffice}`);
      if (id !== requestId.current) return;
      const { debts, countList } = response.data;
      setDebts(debts);
      setCountList(countList);
    } catch (error) {
      console.log(error);
      if (id === requestId.current) setLoadError(true);
    }
    if (id === requestId.current) setIsLoading(false);
  }

  const searchForDebt = async (value: string, silent = false) => {
    const id = ++requestId.current;
    try {
      if (!silent) setIsLoading(true);
      setLoadError(false);
      base.cancelRequests();
      const response = await api.get(`debts/search?searchValue=${encodeURIComponent(value)}`);
      if (id !== requestId.current) return;
      setDebts(response.data);
    } catch (error) {
      console.log(error);
      if (id === requestId.current) setLoadError(true);
    }
    if (id === requestId.current) setIsLoading(false);
  }

  // Debounced search: wait until the user stops typing
  useEffect(() => {
    const value = searchValue.trim();
    if (!value) return;
    const timer = setTimeout(() => searchForDebt(value), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  const onSearchChange = (value: string) => {
    setSearchValue(value);
    if (!value.trim()) {
      fetchBalanceOfUsers();
    }
  }

  const clearSearch = () => {
    onSearchChange('');
    searchInputRef.current?.focus();
  }

  const onTabChange = (value: string) => {
    setCurrentTab(value);
    setSearchValue('');
    fetchBalanceOfUsers(value);
  }

  const onOfficeChange = (value: string) => {
    if (value === currentOffice) return;
    setCurrentOffice(value);
    setSearchValue('');
    fetchBalanceOfUsers(undefined, value);
  }

  const handleDownload = async () => {
    const data: any = [[`All Debts ${moment().format('MM/YYYY')}`], []];
    data.push(["Created Date", "Customer Id", "Customer Full Name", "Office", "Total Debt / الدين الاصلي", "Remaining Amount / الدين المتبقي منه", 'Note'])
    const pushRow = (currentDebt: Debt) => {
      data.push([
        moment(currentDebt.createdAt).format('DD/MM/YYYY hh:mm A'),
        currentDebt.owner?.customerId,
        `${currentDebt.owner?.firstName} ${currentDebt.owner?.lastName}`,
        currentDebt.createdOffice,
        `${currentDebt.initialAmount} ${currentDebt.currency}`,
        `${currentDebt.amount} ${currentDebt.currency}`,
        currentDebt.notes,
      ])
    }
    for (const debt of (debts || [])) {
      if (checkIfDataArray(debt)) {
        (debt as any as Debt[]).forEach(pushRow);
      } else {
        pushRow(debt);
      }
    }
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Merge cells A1 and B1
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Debts');

    XLSX.writeFile(workbook, `Debts List.xlsx`);
  }

  const debtTabs = getTabsOfDebts(countList, (account.roles.isAdmin || !!account.roles?.isAccountant))
  const { totalLyd, totalUsd } = calculateTotalDebt(debts as any, currentOffice);
  const isSearching = !!searchValue.trim();
  const refreshInPlace = () => (isSearching ? searchForDebt(searchValue.trim(), true) : fetchBalanceOfUsers(undefined, undefined, true));
  const debtorsCount = (debts || []).length;
  const officeLabel = OFFICES.find(office => office.value === currentOffice)?.label;
  const currentTabLabel = debtTabs.find(tab => tab.value === currentTab)?.label || '';

  return (
    <>
      <header className='debts-head'>
        <div>
          <h1>Debts</h1>
          <p>Track what customers owe, record payments and confirm new debts.</p>
        </div>
        <div className='debts-head-actions'>
          <button className='debts-btn is-ghost' onClick={handleDownload} disabled={!debtorsCount}>
            <Download size={16} strokeWidth={2} />
            Export Excel
          </button>
          <button className='debts-btn is-primary' onClick={props.onCreateDebt}>
            <Plus size={16} strokeWidth={2} />
            New debt
          </button>
        </div>
      </header>

      <section className='debts-summary' aria-label='Summary'>
        <div className='debts-tile'>
          <div className='debts-tile-icon is-danger'><Wallet size={18} strokeWidth={2} /></div>
          <div className='debts-tile-body'>
            <span className='debts-tile-label'>Outstanding in {officeLabel}, LYD</span>
            <span className='debts-tile-value'>{formatAmount(totalLyd)}<small>LYD</small></span>
          </div>
        </div>
        <div className='debts-tile'>
          <div className='debts-tile-icon is-danger'><Wallet size={18} strokeWidth={2} /></div>
          <div className='debts-tile-body'>
            <span className='debts-tile-label'>Outstanding in {officeLabel}, USD</span>
            <span className='debts-tile-value'>{formatAmount(totalUsd)}<small>USD</small></span>
          </div>
        </div>
        <div className='debts-tile'>
          <div className='debts-tile-icon'><Users size={18} strokeWidth={2} /></div>
          <div className='debts-tile-body'>
            <span className='debts-tile-label'>Customers in this list</span>
            <span className='debts-tile-value'>{isLoading ? '-' : debtorsCount}</span>
          </div>
        </div>
        <button
          type='button'
          className='debts-tile is-action'
          onClick={() => onTabChange('waitingApproval')}
          title='Show debts waiting for approval'
        >
          <div className='debts-tile-icon is-warn'><Clock size={18} strokeWidth={2} /></div>
          <div className='debts-tile-body'>
            <span className='debts-tile-label'>Waiting approval</span>
            <span className='debts-tile-value'>{countList.waitingApprovalDebtsCount}</span>
          </div>
        </button>
      </section>

      <div className='debts-toolbar'>
        <div className='debts-segment' role='group' aria-label='Office'>
          {OFFICES.map(office => (
            <button
              key={office.value}
              type='button'
              aria-pressed={currentOffice === office.value}
              onClick={() => onOfficeChange(office.value)}
            >
              {office.label}
            </button>
          ))}
        </div>

        <label className='debts-search'>
          <Search size={16} strokeWidth={2} />
          <input
            ref={searchInputRef}
            type='search'
            value={searchValue}
            placeholder='Search by customer code'
            aria-label='Search by customer code'
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') clearSearch() }}
          />
          <span className='debts-search-end'>
            {searchValue
              ? <button type='button' aria-label='Clear search' onClick={clearSearch}><X size={14} strokeWidth={2} /></button>
              : <kbd>/</kbd>
            }
          </span>
        </label>
      </div>

      <nav className='debts-tabs' role='tablist' aria-label='Debt status'>
        {debtTabs.map(tab => (
          <button
            key={tab.value}
            type='button'
            role='tab'
            className='debts-tab'
            aria-selected={!isSearching && currentTab === tab.value}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
            <span className='debts-tab-count'>{tab.count}</span>
          </button>
        ))}
      </nav>

      {isSearching &&
        <div className='debts-notice'>
          <span>Results for "{searchValue.trim()}" across all statuses and offices</span>
          <button className='debts-btn is-link is-small' onClick={clearSearch}>Back to {currentTabLabel.toLowerCase()} debts</button>
        </div>
      }

      {loadError && !isLoading &&
        <div className='debts-notice is-error' role='alert'>
          <span>Could not load debts. Check your connection and try again.</span>
          <button
            className='debts-btn is-ghost is-small'
            onClick={() => (isSearching ? searchForDebt(searchValue.trim()) : fetchBalanceOfUsers())}
          >
            <RotateCw size={14} strokeWidth={2} />
            Retry
          </button>
        </div>
      }

      {isLoading ?
        <div className='debts-grid' aria-busy='true' aria-label='Loading debts'>
          {[0, 1, 2, 3].map(i => (
            <div className='debts-skeleton' key={i}>
              <div className='debts-skeleton-head'>
                <i className='is-circle' />
                <div><i style={{ width: '55%' }} /><i style={{ width: '35%' }} /></div>
              </div>
              <i className='is-block' />
              <i style={{ width: '80%' }} />
              <i style={{ width: '60%' }} />
            </div>
          ))}
        </div>
        : debtorsCount > 0 ?
          <div className='debts-grid'>
            {(debts || []).map((debt: Debt | Debt[], index: number) => {
              const key = checkIfDataArray(debt) ? (debt as Debt[])[0]?._id : (debt as Debt)._id;
              return (
                <DebtDetails
                  key={key || index}
                  debt={debt}
                  setDialog={props.setDialog}
                  fetchData={refreshInPlace}
                />
              )
            })}
          </div>
          : !loadError &&
          <div className='debts-empty'>
            <FolderOpen size={32} strokeWidth={1.5} />
            {isSearching ?
              <>
                <strong>No debts match "{searchValue.trim()}"</strong>
                <p>Check the customer code, or clear the search to go back to the list.</p>
                <button className='debts-btn is-ghost' onClick={clearSearch}>Clear search</button>
              </>
              :
              <>
                <strong>No {currentTabLabel.toLowerCase()} debts in {officeLabel}</strong>
                <p>Switch office or status above, or add a new debt for a customer.</p>
                <button className='debts-btn is-primary' onClick={props.onCreateDebt}>
                  <Plus size={16} strokeWidth={2} />
                  New debt
                </button>
              </>
            }
          </div>
      }
    </>
  )
}

export default DebtsTable;
