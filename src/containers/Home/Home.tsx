import React from "react";
import Card from "../../components/Card/Card";
import EarningWidget from "../../components/EarningWidget/EarningWidget";
import DashboardStats from "../../components/DashboardStats/DashboardStats";
import ShipmentTrendChart from "../../components/ShipmentTrendChart/ShipmentTrendChart";
import OfficeBreakdown from "../../components/OfficeBreakdown/OfficeBreakdown";
import RecentActivity from "../../components/RecentActivity/RecentActivity";
import OfficesExpense from "../../components/OfficesExpense/OfficesExpense";
import { HomeData, Session } from "../../models";
import { CircularProgress } from "@mui/material";
import { connect } from "react-redux";

import api from "../../api";
import WalletsWidget from "../../components/WalletsWidget";

import "./Home.scss";

const EARNING_WIDGET_ACCOUNT_IDS = ['62af31fcaf74074f4a4a0f61', '62c1e22a2ffce24ae343cc23'];

type State = {
  homeData: HomeData | null
  wallets: any
}

type Props = {
  session: Session
}

class Home extends React.Component<Props, State> {

  state: State = {
    homeData: null,
    wallets: []
  }

  async componentDidMount() {
    const wallets = (await api.get('wallets')).data?.results;
    const { data } = await api.get('home');
    this.setState({ homeData: data, wallets });
  }

  render() {

    if (!this.state.homeData) {
      return (
        <div className="dash-loading">
          <CircularProgress />
        </div>
      );
    }

    const { homeData } = this.state;
    const canSeeEarning = EARNING_WIDGET_ACCOUNT_IDS.includes(this.props.session?.account._id);
    const firstName = this.props.session?.account?.firstName;

    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>{firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'} Here's how things are moving this month.</p>
        </div>

        <DashboardStats data={homeData} />

        <div className="dashboard-grid">
          <div className="dashboard-grid-item is-span-2">
            <Card>
              <ShipmentTrendChart trend={homeData.shipmentTrend} />
            </Card>
          </div>

          <div className="dashboard-grid-item">
            <Card>
              <OfficeBreakdown offices={homeData.officeBreakdown} />
            </Card>
          </div>

          {canSeeEarning &&
            <div className="dashboard-grid-item">
              <EarningWidget
                earingData={homeData}
              />
            </div>
          }

          <div className="dashboard-grid-item">
            <Card>
              <RecentActivity items={homeData.recentActivity} />
            </Card>
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
