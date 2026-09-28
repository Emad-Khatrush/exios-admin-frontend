import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Alert, CircularProgress } from "@mui/material";
import Card from "../../components/Card/Card";
import EarningWidget from "../../components/EarningWidget/EarningWidget";
import DashboardStats from "../../components/DashboardStats/DashboardStats";
import DashboardPeriodPicker from "../../components/DashboardPeriodPicker/DashboardPeriodPicker";
import ShipmentTrendChart from "../../components/ShipmentTrendChart/ShipmentTrendChart";
import OfficeBreakdown from "../../components/OfficeBreakdown/OfficeBreakdown";
import RecentActivity from "../../components/RecentActivity/RecentActivity";
import { HomeData, Session } from "../../models";
import { DashboardPeriod, getPeriodRange, PeriodRange, periodFromSearch, periodToSearch } from "./period";

import api from "../../api";

import "./Home.scss";

const EARNING_WIDGET_ACCOUNT_IDS = ['62af31fcaf74074f4a4a0f61', '62c1e22a2ffce24ae343cc23'];

const CURRENT_PHRASES = { day: 'today', week: 'this week', month: 'this month', custom: '' };

// "this week", "in August 2026", "on Mon, 21 Sep 2026"... for sentences like "Shipped ___".
const periodPhrase = (period: DashboardPeriod, range: PeriodRange) => {
  if (range.isCurrent) return CURRENT_PHRASES[period.mode];
  if (range.label === 'Yesterday') return 'yesterday';
  return period.mode === 'day' ? `on ${range.label}` : `in ${range.label}`;
};

const Home = () => {
  const session: Session = useSelector((state: any) => state.session);
  const [searchParams, setSearchParams] = useSearchParams();
  const period = periodFromSearch(searchParams);
  const range = getPeriodRange(period);

  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const { from, to, prevFrom, prevTo } = range;

  useEffect(() => {
    // Ignore responses that arrive after the user already picked another period.
    const id = ++requestId.current;
    setIsLoading(true);
    setError('');

    const params: Record<string, string> = { from, to };
    if (prevFrom && prevTo) {
      params.prevFrom = prevFrom;
      params.prevTo = prevTo;
    }

    api.get('home', params)
      .then(({ data }) => {
        if (id === requestId.current) setHomeData(data);
      })
      .catch(() => {
        if (id === requestId.current) setError('Could not load the dashboard for this period. Try again.');
      })
      .finally(() => {
        if (id === requestId.current) setIsLoading(false);
      });
  }, [from, to, prevFrom, prevTo]);

  const changePeriod = (next: DashboardPeriod) => setSearchParams(periodToSearch(next), { replace: true });

  if (!homeData) {
    return (
      <div className="dash-loading">
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}
      </div>
    );
  }

  const canSeeEarning = EARNING_WIDGET_ACCOUNT_IDS.includes(session?.account._id);
  const firstName = session?.account?.firstName;
  const phrase = periodPhrase(period, range);
  const granularity = homeData.range?.granularity || 'day';

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>{firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'} Here's how things moved {phrase}.</p>
      </div>

      <DashboardPeriodPicker period={period} onChange={changePeriod} isLoading={isLoading} />

      {error && <Alert severity="error" className="dashboard-error">{error}</Alert>}

      <div className={`dashboard-content ${isLoading ? 'is-refreshing' : ''}`}>
        <DashboardStats data={homeData} compareLabel={range.compareLabel} />

        <div className="dashboard-grid">
          <div className="dashboard-grid-item is-span-2">
            <Card>
              <ShipmentTrendChart
                trend={homeData.shipmentTrend}
                subtitle={`KG shipped per ${granularity}, ${range.label.replace(/^This (week|month) · /, '')}`}
              />
            </Card>
          </div>

          <div className="dashboard-grid-item">
            <Card>
              <OfficeBreakdown offices={homeData.officeBreakdown} periodLabel={phrase} />
            </Card>
          </div>

          {canSeeEarning &&
            <div className="dashboard-grid-item">
              <EarningWidget earingData={homeData} periodLabel={range.label} />
            </div>
          }

          <div className="dashboard-grid-item">
            <Card>
              <RecentActivity items={homeData.recentActivity} title={`Activity ${phrase}`} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
