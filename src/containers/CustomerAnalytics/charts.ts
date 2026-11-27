import {
  ArcElement, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';

Chart.register([ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip]);

// Categorical slots in a fixed order (validated: CVD ΔE ≥ 12.6, normal-vision ΔE ≥ 28.1). Orange sits
// below 3:1 on white, so every chart has its numbers beside it (tiles, a legend table or «الأرقام كجدول»).
export const C1 = '#257de0';
export const C2 = '#f47230';
export const NEUTRAL = '#b8c0ca';
export const INK = '#18212b';
export const AXIS = '#5b6673';
export const GRID = '#e3e7ec';
export const FONT = "'Segoe UI', Tahoma, 'Noto Sans Arabic', system-ui, sans-serif";

export const barStyle = { borderRadius: 4, borderSkipped: 'start' as const, maxBarThickness: 32, borderColor: '#ffffff', borderWidth: 0 };

// Tooltips, legend and axes shared by the time charts. Plots keep left-to-right time order (dir="ltr"
// on the wrapper); the legend and tooltips are written right to left.
export const baseOptions = ({ stacked = false, percent = false, legend = true, money = false } = {}): any => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: legend,
      position: 'top',
      align: 'end',
      rtl: true,
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', color: INK, font: { family: FONT, size: 12 } },
    },
    tooltip: {
      rtl: true,
      textDirection: 'rtl',
      backgroundColor: INK,
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      titleFont: { family: FONT, weight: '700' },
      bodyFont: { family: FONT },
      callbacks: {
        label: (ctx: any) => {
          const v = ctx.parsed && typeof ctx.parsed === 'object' ? ctx.parsed.y : ctx.parsed;
          if (v == null) return `${ctx.dataset.label}: —`;
          const text = percent ? `${(Math.round(v * 10) / 10).toLocaleString('en-US')}%`
            : money ? `$${Math.round(v).toLocaleString('en-US')}` : Number(v).toLocaleString('en-US');
          return ctx.dataset.label ? `${ctx.dataset.label}: ${text}` : text;
        },
      },
    },
  },
  scales: {
    x: { stacked, grid: { display: false }, ticks: { color: AXIS, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true } },
    y: {
      stacked,
      beginAtZero: true,
      ...(percent ? { max: 100 } : {}),
      grid: { color: GRID, drawBorder: false, drawTicks: false },
      ticks: {
        color: AXIS,
        font: { family: FONT, size: 11 },
        maxTicksLimit: 5,
        padding: 6,
        callback: (v: number) => (percent ? `${v}%` : money ? `$${Number(v).toLocaleString('en-US')}` : Number(v).toLocaleString('en-US')),
      },
    },
  },
});

// A thin line with ≥8px markers and a wide hover target
export const lineStyle = (color: string) => ({
  borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointHitRadius: 12,
  pointBorderColor: '#ffffff', pointBorderWidth: 2, tension: 0.25, spanGaps: false,
});
