import { useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import CustomButton from '../CustomButton/CustomButton';
import Card from '../Card/Card';
import { Account, Invoice, Office } from '../../models';
import { Link } from 'react-router-dom';

import './OfficesExpense.scss';

type Props = {
  offices: Office[]
  debts: Invoice[]
  credits: Invoice[]
  account?: Account
}

const OfficesExpense = (props: Props) => {
  const [ currentOffice, setCurrentOffice ] = useState(props.account?.city || 'tripoli');

  const office = props.offices.find((data: Office) => data.office === currentOffice);

  let totalUsd = 0;
  let totalLyd = 0;
  const debts = props.debts.filter((invoice: Invoice) => {
    if (invoice.debt.currency === 'USD' && invoice.placedAt === currentOffice) {
      totalUsd += invoice.debt.total;
    } else if (invoice.debt.currency === 'LYD' && invoice.placedAt === currentOffice) {
      totalLyd += invoice.debt.total;
    }
    return invoice.placedAt === currentOffice;
  });

  let totalCreditUsd = 0;
  let totalCreditLyd = 0;
  const credits = props.credits.filter((invoice: Invoice) => {
    if (invoice.credit.currency === 'USD' && invoice.placedAt === currentOffice) {
      totalCreditUsd += invoice.credit.total;
    } else if (invoice.credit.currency === 'LYD' && invoice.placedAt === currentOffice) {
      totalCreditLyd += invoice.credit.total;
    }
    return invoice.placedAt === currentOffice;
  });

  const hasTotalDebtToDisplay = totalUsd > 0 || totalLyd > 0;
  const hasDebts = debts.length > 0;
  const totalDebts = [
    {
      currency: 'USD',
      total: totalUsd
    },
    {
      currency: 'LYD',
      total: totalLyd
    }
  ]

  const hasTotalCreditsToDisplay = totalCreditUsd > 0 || totalCreditLyd > 0;
  const hasCredits = credits.length > 0;
  const totalCredits = [
    {
      currency: 'USD',
      total: totalCreditUsd
    },
    {
      currency: 'LYD',
      total: totalCreditLyd
    }
  ]  
  
  return (
    <Card>
      <div className='offices-expense'>
        {(props.account?._id === "62bb47b22aabe070791f8278" || props.account?.roles.isAdmin) &&
          <>
            <div className='d-flex justify-content-between align-items-center'>
              <h6> {currentOffice} Office Current Balance </h6>
              <ToggleButtonGroup
                color="success"
                value={currentOffice}
                exclusive
                onChange={(event: any, value: string) => setCurrentOffice(value) }
                size="small"
              >
                <ToggleButton value="tripoli">Tripoli</ToggleButton>
                {!props.account?.roles?.isEmployee && <ToggleButton value="benghazi">Benghazi</ToggleButton>}
              </ToggleButtonGroup>
            </div>
            <h3> ${office?.usaDollar.value} </h3>
            <div className='d-flex justify-content-between'>
              <p>US Dollar Current Balance</p>
              <p> ${office?.usaDollar.value} </p>
            </div>
            <div className='d-flex justify-content-between'>
              <p>Libyan Dinar Current Balance</p>
              <p>{office?.libyanDinar.value} LYD</p>
            </div>
          </>
        }

        {hasDebts &&
          <div>
            <hr />
            <h6> Debts </h6>
            {debts.map((invoice: Invoice) => (
              <div className='d-flex justify-content-between mb-2 debts'>
                <div className='d-flex gap-4'>
                  <p>{invoice.user?.customerId}</p>
                  <Link style={{ textDecoration: 'none' }} to={`/invoice/${invoice._id}/edit`}>{invoice.orderId}</Link>
                  <p></p>
                  <p>{invoice.customerInfo.fullName}</p>
                </div>
                <p style={{ color: '#f53d3d' }}>{invoice.debt.total} {invoice.debt.currency}</p>
              </div>
            ))}
            <br />
            {hasTotalDebtToDisplay && 
              <div className='mb-2'>
                {totalDebts.map(debt => {
                  // eslint-disable-next-line array-callback-return
                  if (debt.total <= 0) return;
                  return (
                    <div className='d-flex justify-content-between'>
                      <p>Total Debts of {debt.currency}</p>
                      <p style={{ color: '#f53d3d' }}>{debt.total} {debt.currency}</p>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        }

        {hasCredits &&
          <div>
            <hr />
            <h6> Credits </h6>
            {credits.map((invoice: Invoice) => (
              <div className='d-flex justify-content-between mb-2 debts'>
                <div className='d-flex gap-4'>
                  <p>{invoice.user?.customerId}</p>
                  <Link style={{ textDecoration: 'none' }} to={`/invoice/${invoice._id}/edit`}>{invoice.orderId}</Link>
                  <p></p>
                  <p>{invoice.customerInfo.fullName}</p>
                </div>
                <p style={{ color: '#17d310' }}>{invoice.credit.total} {invoice.credit.currency}</p>
              </div>
            ))}
            <br />
            {hasTotalCreditsToDisplay && 
              <div className='mb-2'>
                {totalCredits.map(credit => {
                  // eslint-disable-next-line array-callback-return
                  if (credit.total <= 0) return;
                  return (
                    <div className='d-flex justify-content-between'>
                      <p>Total Credits of {credit.currency}</p>
                      <p style={{ color: '#17d310' }}>{credit.total} {credit.currency}</p>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        }

        {props.account?.roles.isAdmin &&
          <CustomButton href='/expenses' background='rgb(0, 171, 85)' size='small'>
            Check All Expenses
          </CustomButton>
        }
      </div>
    </Card>
  )
}

export default OfficesExpense;
