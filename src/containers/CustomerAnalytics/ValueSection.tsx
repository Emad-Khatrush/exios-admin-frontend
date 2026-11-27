import { Bar } from 'react-chartjs-2';
import { baseOptions, barStyle, C1 } from './charts';
import { Versus } from './compare';
import { cityName, count, decimal, pct, usd, usdWhole } from './format';
import { ChartTable, Empty, Loading, Num, Panel, Person, PeriodLine, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { ValueData } from './types';

// The bucket names from the API are kept when given; else built from the limits
const bucketName = (b: ValueData['ltv']['buckets'][number]) => b.label
  || (b.maxCents == null ? `${usdWhole(b.minCents)} فأكثر` : `${usdWhole(b.minCents)} – ${usdWhole(b.maxCents)}`);

// قيمة العميل: what an order and a customer are worth, how lifetime value spreads, and who brings the most
const ValueSection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<ValueData>('value', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading />;

  const buckets = data.ltv?.buckets || [];
  const top = data.top || [];
  const conc = data.concentration || { top10Share: null, top20Share: null, top10PercentShare: null };

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra={<> · <Num>{count(data.orders)}</Num> طلب من <Num>{count(data.customers)}</Num> عميل بقيمة <Num>{usdWhole(data.valueCents)}</Num></>} />
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles">
        <Tile label="متوسط قيمة الطلب" en="AOV" value={usd(data.avgOrderCents)} foot={<Versus data={data} path="avgOrderCents" target="avgOrderCents" />} />
        <Tile label="طلبات لكل عميل" en="Purchase Frequency" value={decimal(data.ordersPerCustomer, 2)} hint="في الفترة المختارة" foot={<Versus data={data} path="ordersPerCustomer" target="ordersPerCustomer" />} />
        <Tile label="طلبات لكل عميل في السنة" en="Annual Frequency" value={decimal(data.perYear?.ordersPerCustomer, 2)} hint="محسوبة على 365 يوماً" foot={<Versus data={data} path="perYear.ordersPerCustomer" unit="decimal" />} />
        <Tile label="متوسط ما يطلبه العميل" en="Avg Customer Value" value={usd(data.avgCustomerCents)} hint="في الفترة المختارة" foot={<Versus data={data} path="avgCustomerCents" unit="money" />} />
      </div>

      {!data.orders ? <Empty>لا توجد طلبات في هذه الفترة.</Empty> : (
        <>
          <div className="ca-grid">
            <Panel
              title="كم طلب كل عميل منا منذ البداية" en="LTV Distribution"
              sub={<>عدد العملاء في كل شريحة. المتوسط <Num>{usd(data.ltv?.avgCents)}</Num> والوسيط <Num>{usd(data.ltv?.medianCents)}</Num> (نصف العملاء أقل منه).</>}
            >
              {!buckets.some((b) => b.customers) ? <Empty>لا توجد بيانات.</Empty> : (
                <div className="ca-chart" dir="ltr">
                  <Bar
                    data={{ labels: buckets.map(bucketName), datasets: [{ label: 'العملاء', data: buckets.map((b) => b.customers), backgroundColor: C1, ...barStyle, maxBarThickness: 56 }] }}
                    options={baseOptions({ legend: false })}
                  />
                </div>
              )}
              <ChartTable head={['الشريحة', 'العملاء']} rows={buckets.map((b) => [bucketName(b), <Num>{count(b.customers)}</Num>])} />
            </Panel>

            <Panel title="هل يعتمد عملك على عدد قليل من العملاء؟" en="Concentration" sub="حصة أكبر العملاء من قيمة طلبات الفترة. كلما ارتفعت، كان فقدان واحد منهم أكثر أثراً.">
              <div className="ca-tiles ca-tiles--three">
                <Tile label="أكبر 10 عملاء" en="Top-10 Share" value={pct(conc.top10Share)} />
                <Tile label="أكبر 20 عميلاً" en="Top-20 Share" value={pct(conc.top20Share)} />
                <Tile label="أكبر 10% من العملاء" en="Top-10% Share" value={pct(conc.top10PercentShare)} />
              </div>
            </Panel>
          </div>

          <Panel title="أكبر 20 عميلاً في الفترة" en="Top Customers" sub="مرتبون حسب قيمة طلباتهم في الفترة.">
            {!top.length ? <Empty>لا يوجد عملاء.</Empty> : (
              <div className="ca-table-wrap">
                <table className="ca-table">
                  <thead><tr><th className="is-num">#</th><th>العميل</th><th>الكود</th><th>المدينة</th><th className="is-num">الطلبات</th><th className="is-num">القيمة</th><th className="is-num">الحصة</th></tr></thead>
                  <tbody>
                    {top.map((r, i) => (
                      <tr key={r.id}>
                        <td className="is-num ca-muted"><Num>{i + 1}</Num></td>
                        <td><Person who={r} /></td>
                        <td><Num>{r.customerId || '—'}</Num></td>
                        <td>{cityName(r.city)}</td>
                        <td className="is-num"><Num>{count(r.orders)}</Num></td>
                        <td className="is-num"><Num>{usd(r.valueCents)}</Num></td>
                        <td className="is-num">
                          <span className="ca-share">
                            <span className="ca-share__bar" style={{ width: `${Math.min(100, (r.share || 0) * 100)}%` }} />
                            <Num>{pct(r.share)}</Num>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default ValueSection;
