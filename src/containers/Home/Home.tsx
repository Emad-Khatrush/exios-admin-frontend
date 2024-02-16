import React from "react";
import { FaBoxOpen, FaMoneyBillWave } from "react-icons/fa";
import EarningWidget from "../../components/EarningWidget/EarningWidget";
import InfoWidget from "../../components/InfoWidget/InfoWidget";
import OfficesExpense from "../../components/OfficesExpense/OfficesExpense";
import { HomeData, Session } from "../../models";
import { CircularProgress } from "@mui/material";
import { connect } from "react-redux";

import api from "../../api";
import { AiOutlineUserAdd } from "react-icons/ai";

type State = {
  homeData: HomeData | null
}

type Props = {
  session: Session
}

class Home extends React.Component<Props, State> {

  state: State = {
    homeData: null
  }

  async componentDidMount() {
    const { data } = await api.get('home');
    this.setState({ homeData: data });
  }
  render() {

    if (!this.state.homeData) {
      return <CircularProgress />
    }    
      
    return (
      <div className="m-3">
        <div className="row">
            <div className="col-md-4">
              <InfoWidget title="Active Orders" value={`${this.state.homeData.activeOrdersCount}`} icon={<FaBoxOpen />} />
            </div>
            <div className="col-md-4">
              <InfoWidget title="Total Invoices" value={`$${this.state.homeData.totalInvoices}`} icon={<FaMoneyBillWave />} />
            </div>
            <div className="col-md-4">
              <InfoWidget title="Client Users" value={`${this.state.homeData.clientUsersCount}`} icon={<AiOutlineUserAdd />} />
            </div>
        </div>
          
        <div className="row">
          {['62af31fcaf74074f4a4a0f61', '62c1e22a2ffce24ae343cc23'].includes(this.props.session?.account._id) &&
            <div className="col-md-5">
              <EarningWidget 
                earingData={this.state.homeData}
              />
            </div>
          }
            <div className="col-md-7">
              <OfficesExpense 
                offices={this.state.homeData.offices}
                debts={this.state.homeData.debts}
                credits={this.state.homeData.credits}
                account={this.props.session?.account}
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

export default connect(mapStateToProps)(Home);
