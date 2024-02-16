import React from "react";
import OfficesExpense from "../../components/OfficesExpense/OfficesExpense";
import { Expense, HomeData, Session } from "../../models";
import { CircularProgress } from "@mui/material";

import api from "../../api";
import InfoTable from "../../components/InfoTable/InfoTable";
import { defaultColumns, generateDataToListType } from "./generateData";
import Card from "../../components/Card/Card";
import { connect } from "react-redux";

type State = {
  HomeData: HomeData | null
  expenses: Expense[]
  isLoading: boolean
}

type Props = {
  session: Session
}

class EmployeeHomePage extends React.Component<Props, State> {

  state: State = {
    HomeData: null,
    expenses: [],
    isLoading: false
  }

  async componentDidMount() {
    try {
      this.setState({ isLoading: true });
      const homeResponse = await api.get(`employeeHome?office=${this.props.session?.account.city || 'tripoli'}`);

      const expensesResponse = await api.get('expenses?office=tripoli');
      this.setState({ HomeData: homeResponse.data, expenses: expensesResponse.data, isLoading: false });
    } catch (error) {
      console.log(error);
    }
  }

  render() {

    if (!this.state.isLoading && !this.state.HomeData) {
      return <CircularProgress />
    }

    const list = generateDataToListType(this.state.expenses);
    const columns = [...defaultColumns()];
      
    return (
      <div className="m-3">
        <div className="row">
          {(this.props.session.account?._id === "62bb47b22aabe070791f8278") &&
            <div className="col-md-6">
              <Card>
                <h5>Expenses</h5>
                <InfoTable
                  columns={columns}
                  data={list}
                />
              </Card>
            </div>
          }
          <div className="col-md-6">
            <OfficesExpense 
              offices={this.state.HomeData?.offices || []}
              debts={this.state.HomeData?.debts || []}
              credits={this.state.HomeData?.credits || []}
              account={this.props.session.account}
            />
          </div>
        </div>
      </div>
    ) 
  }
}

const mapStateToProps = (state: any) => {  
  return {
    session: state.session,
  };
}

export default connect(mapStateToProps)(EmployeeHomePage);
