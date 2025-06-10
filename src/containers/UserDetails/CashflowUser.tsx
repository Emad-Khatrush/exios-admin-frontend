import { CircularProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import Card from '../../components/Card/Card';
import PaymentDetails from './PaymentDetails';
import moment from 'moment';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import UserStatementDesign from './UserStatementDesign';

type Props = {
  userStatement: any
  onChangeCurrency: (value: string) => void
  isLoading: boolean
}

const CashflowUser = (props: Props) => {
  const [statementCurrency, setStatementCurrency] = useState('USD');
  const { userStatement, isLoading } = props;
  const isAdmin = useSelector((state: any) => state.session.account.roles.isAdmin);

  return (
    <Card
      bodyStyle={{
        height: '50vh',
        overflow: 'auto',
        marginTop: '20px'
      }}
    >
      {userStatement && <UserStatementDesign  userStatements={[...userStatement].reverse()} />}
      
      <div className='d-flex justify-content-between align-items-center'>
        <h5> Cashflow Statement </h5>
        <ToggleButtonGroup
          color="success"
          value={statementCurrency}
          exclusive
          onChange={(event: any, value: string) => {
            setStatementCurrency(value);
            props.onChangeCurrency(value);
          }}
          size="small"
        >
          <ToggleButton value="USD">USD Account</ToggleButton>
          <ToggleButton value="LYD">LYD Account</ToggleButton>
        </ToggleButtonGroup>

        {/* <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
          <InputLabel id="demo-select-small">Filter</InputLabel>
          <Select
            labelId="demo-select-small"
            id="demo-select-small"
            label="ALL"
            defaultValue={'all'}
            // onChange={(event) => this.setState({ selectorValue: event.target.value })}
          >
            <MenuItem value="all">
              <em>ALL</em>
            </MenuItem>
            <MenuItem value="debts">
              <em>Debts Only</em>
            </MenuItem>
            <MenuItem value="wallet">Wallet Only</MenuItem>
          </Select>
        </FormControl> */}
      </div>

      <hr style={{ color: '#b7b7b7' }} />

      {isLoading ?
        <CircularProgress />
      :
      <>
        {userStatement.map((statement: any) => {
          const allowViewHiddenFields = isAdmin && !statement?.review?.isAdminConfirmed;

          return (
            <PaymentDetails
              title={moment(statement.createdAt).format('DD/MM/YYYY')}
              description={statement.description}
              footer={`${statement.currency} ${statement.amount} ${statement.calculationType}`}
              total={`${statement.currency} ${statement.total}`}
              color={statement.calculationType === '-' ? 'danger' : 'success'}
              tootipInfo={statement?.note}
              showVerifyButton={allowViewHiddenFields}
              statement={statement}
            />
          )
        })}
      </>
      }
    </Card>
  )
}

export default CashflowUser;
