import { Boxes, FileText, Package, PackageCheck, Scale, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import { HomeData } from '../../models';

import './DashboardStats.scss';

type Props = {
  data: HomeData;
  compareLabel: string;
};

type Trend = { percent: number; positive: boolean } | null;

const trendOf = (current: number, previous: number): Trend => {
  if (!previous) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return { percent, positive: percent > 0 };
};

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

const TrendPill = ({ trend, compareLabel, note }: { trend: Trend, compareLabel: string, note?: string }) => {
  if (note) return <span className="dash-tile-trend is-flat">{note}</span>;
  if (!trend) return <span className="dash-tile-trend is-flat">vs {compareLabel}</span>;
  const Icon = trend.positive ? TrendingUp : TrendingDown;
  return (
    <span className={`dash-tile-trend ${trend.positive ? 'is-up' : 'is-down'}`}>
      <Icon size={13} strokeWidth={2.5} />
      {Math.abs(trend.percent)}%
      <small>vs {compareLabel}</small>
    </span>
  );
};

const DashboardStats = ({ data, compareLabel }: Props) => {
  const { shipmentStats } = data;

  // Active orders is a live count, so it has no comparison; everything else follows the selected period.
  const tiles: { label: string, value: string, icon: typeof Package, trend: Trend, note?: string }[] = [
    {
      label: 'Active Orders',
      value: formatNumber(data.activeOrdersCount),
      icon: Package,
      trend: null,
      note: 'right now',
    },
    {
      label: 'Total Clients',
      value: formatNumber(data.clientUsersCount),
      icon: Users,
      trend: null,
      note: 'all time',
    },
    {
      label: 'Invoiced',
      value: `$${formatNumber(data.totalInvoices)}`,
      icon: FileText,
      trend: trendOf(data.totalInvoices, data.previousTotalInvoices),
    },
    {
      label: 'New Clients',
      value: formatNumber(data.newClientsCount),
      icon: UserPlus,
      trend: trendOf(data.newClientsCount, data.previousNewClientsCount),
    },
    {
      label: 'KG Shipped',
      value: formatNumber(shipmentStats.totalKG),
      icon: Scale,
      trend: trendOf(shipmentStats.totalKG, shipmentStats.previousTotalKG),
    },
    {
      label: 'CBM Shipped',
      value: formatNumber(shipmentStats.totalCBM),
      icon: Boxes,
      trend: trendOf(shipmentStats.totalCBM, shipmentStats.previousTotalCBM),
    },
    {
      label: 'Packages Delivered',
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
            <TrendPill trend={tile.trend} compareLabel={compareLabel} note={tile.note} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStats;
