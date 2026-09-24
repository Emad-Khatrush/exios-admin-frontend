import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

import './ShipmentTrendChart.scss';

Chart.register([BarElement, CategoryScale, LinearScale, Tooltip]);

type TrendPoint = {
  label: string;
  totalKG: number;
  totalCBM: number;
  packagesCount: number;
};

type Props = {
  trend: TrendPoint[];
};

const ACCENT = '#1d4ed8';
const GRIDLINE = '#e3e7ec';
const AXIS_INK = '#5b6673';

const ShipmentTrendChart = ({ trend }: Props) => {
  const totalKG = trend.reduce((sum, point) => sum + point.totalKG, 0);

  const data: any = {
    labels: trend.map(point => point.label),
    datasets: [{
      data: trend.map(point => point.totalKG),
      backgroundColor: ACCENT,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: false,
      maxBarThickness: 28,
      hoverBackgroundColor: '#1a44bf',
    }],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    // A single series needs no legend box - the chart's title already says what's plotted.
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18212b',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { weight: '700' },
        callbacks: {
          label: (context: any) => {
            const point = trend[context.dataIndex];
            const lines = [`${point.totalKG.toLocaleString('en-US')} KG`];
            if (point.totalCBM > 0) lines.push(`${point.totalCBM.toLocaleString('en-US')} CBM`);
            lines.push(`${point.packagesCount} package${point.packagesCount === 1 ? '' : 's'}`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: AXIS_INK, font: { size: 12, weight: '600' } },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRIDLINE, drawTicks: false },
        border: { display: false },
        ticks: {
          color: AXIS_INK,
          font: { size: 11 },
          maxTicksLimit: 5,
          callback: (value: number) => value.toLocaleString('en-US'),
        },
      },
    },
  };

  return (
    <div className="shipment-trend">
      <div className="shipment-trend-head">
        <div>
          <h3>Shipments trend</h3>
          <p>KG shipped, last 6 months</p>
        </div>
        <div className="shipment-trend-total">
          <span>{totalKG.toLocaleString('en-US')}</span>
          <small>total KG</small>
        </div>
      </div>
      <div className="shipment-trend-canvas">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default ShipmentTrendChart;
