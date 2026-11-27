import { Bar } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, FONT, INK } from './charts';
import { cityName, count, officeName, pct, usd, usdWhole } from './format';
import { Empty, Loading, Num, Panel, PeriodLine, SectionError, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { GeoData } from './types';

// The top cities as horizontal bars (value in whole dollars), biggest at the top, growing from the right
const cityChartOptions = () => {
  const o = baseOptions({ legend: false, money: true });
  o.indexAxis = 'y';
  o.interaction = { mode: 'nearest', axis: 'y', intersect: false };
  o.scales = {
    x: { ...o.scales.y, reverse: true, ticks: { ...o.scales.y.ticks } },
    y: { position: 'right', grid: { display: false }, ticks: { color: INK, font: { family: FONT, size: 12 }, autoSkip: false } },
  };
  o.plugins.tooltip.callbacks.label = (ctx: any) => `$${Math.round(ctx.parsed.x).toLocaleString('en-US')}`;
  return o;
};

// المدن والمكاتب: where the customers live and which office took the orders
const GeoSection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<GeoData>('geo', { from: filters.from, to: filters.to });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={0} />;

  const cities = data.cities || [];
  const offices = data.offices || [];
  const top = cities.slice(0, 10);

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra=" · كل المكاتب" />
      <InsightsPanel insights={data.insights} />
      {!cities.length && !offices.length ? <Empty>لا توجد طلبات في هذه الفترة.</Empty> : (
        <>
          <div className="ca-grid">
            <Panel title="أكبر 10 مدن حسب قيمة الطلبات" en="Top Cities" sub="المدينة من حساب العميل.">
              <div className="ca-chart ca-chart--tall" style={{ height: Math.max(180, top.length * 34 + 40) }}>
                <Bar
                  data={{ labels: top.map((c) => cityName(c.city)), datasets: [{ label: 'القيمة', data: top.map((c) => c.valueCents / 100), backgroundColor: C1, ...barStyle, maxBarThickness: 22 }] }}
                  options={cityChartOptions()}
                />
              </div>
            </Panel>
            <Panel title="المكاتب" en="Offices" sub="المكتب الذي سُجّل عليه الطلب.">
              {!offices.length ? <Empty>لا توجد طلبات.</Empty> : (
                <div className="ca-table-wrap">
                  <table className="ca-table">
                    <thead><tr><th>المكتب</th><th className="is-num">العملاء</th><th className="is-num">الطلبات</th><th className="is-num">القيمة</th><th className="is-num">الحصة</th></tr></thead>
                    <tbody>
                      {offices.map((o) => (
                        <tr key={o.office || 'none'}>
                          <td>{officeName(o.office)}</td>
                          <td className="is-num"><Num>{count(o.customers)}</Num></td>
                          <td className="is-num"><Num>{count(o.orders)}</Num></td>
                          <td className="is-num"><Num>{usdWhole(o.valueCents)}</Num></td>
                          <td className="is-num"><Num>{pct(o.share)}</Num></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <Panel title={<>كل المدن <Num>{count(cities.length)}</Num></>} sub="«عملاء جدد»: أول طلب لهم في هذه الفترة.">
            <div className="ca-table-wrap">
              <table className="ca-table">
                <thead>
                  <tr><th>المدينة</th><th className="is-num">العملاء</th><th className="is-num">عملاء جدد</th><th className="is-num">الطلبات</th><th className="is-num">القيمة</th><th className="is-num">الحصة</th></tr>
                </thead>
                <tbody>
                  {cities.map((c) => (
                    <tr key={c.city || 'none'}>
                      <td>{cityName(c.city)}</td>
                      <td className="is-num"><Num>{count(c.customers)}</Num></td>
                      <td className="is-num"><Num>{count(c.newCustomers)}</Num></td>
                      <td className="is-num"><Num>{count(c.orders)}</Num></td>
                      <td className="is-num"><Num>{usd(c.valueCents)}</Num></td>
                      <td className="is-num"><Num>{pct(c.share)}</Num></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};

export default GeoSection;
