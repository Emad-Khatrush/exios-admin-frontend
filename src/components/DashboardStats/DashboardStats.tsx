import { Boxes, FileText, Package, PackageCheck, Scale, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { HomeData } from '../../models';

import './DashboardStats.scss';

type Props = {
  data: HomeData;
};

type Trend = { percent: number; positive: boolean } | null;

const trendOf = (current: number, previous: number): Trend => {
  if (!previous) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return { percent, positive: percent > 0 };
};

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

const TrendPill = ({ trend }: { trend: Trend }) => {
  if (!trend) return <span className="dash-tile-trend is-flat">vs last month</span>;
  const Icon = trend.positive ? TrendingUp : TrendingDown;
  return (
    <span className={`dash-tile-trend ${trend.positive ? 'is-up' : 'is-down'}`}>
      <Icon size={13} strokeWidth={2.5} />
      {Math.abs(trend.percent)}%
      <small>vs last month</small>
    </span>
  );
};

const DashboardStats = ({ data }: Props) => {
  const { shipmentStats } = data;

  const tiles = [
    {
      label: 'Active Orders',
      value: formatNumber(data.activeOrdersCount),
      icon: Package,
      trend: null as Trend,
    },
    {
      label: 'Invoiced This Month',
      value: `$${formatNumber(data.totalInvoices)}`,
      icon: FileText,
      trend: null as Trend,
    },
    {
      label: 'Client Users',
      value: formatNumber(data.clientUsersCount),
      icon: Users,
      trend: null as Trend,
    },
    {
      label: 'KG Shipped This Month',
      value: formatNumber(shipmentStats.totalKG),
      icon: Scale,
      trend: trendOf(shipmentStats.totalKG, shipmentStats.previousTotalKG),
    },
    {
      label: 'CBM Shipped This Month',
      value: formatNumber(shipmentStats.totalCBM),
      icon: Boxes,
      trend: trendOf(shipmentStats.totalCBM, shipmentStats.previousTotalCBM),
    },
    {
      label: 'Packages Delivered This Month',
      value: formatNumber(shipmentStats.packagesCount),
      icon: PackageCheck,
      trend: trendOf(shipmentStats.packagesCount, shipmentStats.previousPackagesCount),
    },
  ];

  return (
    <div className="dash-stats">
      {tiles.map(tile => (
        <div className="dash-tile" key={tile.label}>
          <div className="dash-tile-icon">
            <tile.icon size={19} strokeWidth={2} />
          </div>
          <div className="dash-tile-body">
            <span className="dash-tile-label">{tile.label}</span>
            <span className="dash-tile-value">{tile.value}</span>
            <TrendPill trend={tile.trend} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStats;
