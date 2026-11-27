import { Bar, Line } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, C2, lineStyle } from './charts';
import { Versus } from './compare';
import { count, monthName, monthShort, pct } from './format';
import { ChartTable, Empty, Loading, Num, Panel, PeriodLine, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { RepeatData } from './types';

// رجوع العملاء: of the customers who ordered in the period, how many ordered again and how many were old customers
const RepeatSection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<RepeatData>('repeat', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading />;

  const months = data.months || [];
  const labels = months.map((m) => monthShort(m.month));

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} />
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles">
        <Tile label="عملاء طلبوا في الفترة" en="Active Customers" value={count(data.customers)} hint="طلب واحد على الأقل" foot={<Versus data={data} path="customers" unit="count" />} />
        <Tile label="نسبة من طلب أكثر من مرة" en="Repeat Rate" value={pct(data.repeatRate)} hint={<><Num>{count(data.repeat)}</Num> عميل طلب مرتين أو أكثر</>} foot={<Versus data={data} path="repeatRate" target="repeatRate" />} />
        <Tile label="نسبة العملاء القدامى" en="Returning Rate" value={pct(data.returningRate)} hint={<><Num>{count(data.returning)}</Num> عميل كان قد طلب قبل الفترة</>} foot={<Versus data={data} path="returningRate" target="returningRate" />} />
        <Tile label="عملاء جدد" en="New Customers" value={count(data.newCustomers)} hint="أول طلب لهم كان في هذه الفترة" foot={<Versus data={data} path="newCustomers" unit="count" />} />
      </div>

      {!data.customers || !months.length ? <Empty>لا توجد طلبات في هذه الفترة.</Empty> : (
        <div className="ca-grid">
          <Panel title="العملاء كل شهر: جدد وقدامى" en="New vs Returning" sub="القديم: طلب قبل ذلك الشهر. الجديد: أول طلب له على الإطلاق في ذلك الشهر.">
            <div className="ca-chart" dir="ltr">
              <Bar
                data={{
                  labels,
                  datasets: [
                    { label: 'قدامى', data: months.map((m) => m.returning), backgroundColor: C1, ...barStyle, borderRadius: 0 },
                    { label: 'جدد', data: months.map((m) => m.newCustomers), backgroundColor: C2, ...barStyle },
                  ],
                }}
                options={baseOptions({ stacked: true })}
              />
            </div>
          </Panel>
          <Panel title="نسبة القدامى من عملاء الشهر" en="Returning Rate" sub="كلما ارتفعت، كان اعتمادك أكبر على عملاء يعودون.">
            <div className="ca-chart ca-chart--short" dir="ltr">
              <Line
                data={{ labels, datasets: [{ label: 'نسبة القدامى', data: months.map((m) => (m.returningRate == null ? null : m.returningRate * 100)), ...lineStyle(C1) }] }}
                options={baseOptions({ percent: true, legend: false })}
              />
            </div>
          </Panel>
          <ChartTable
            head={['الشهر', 'العملاء', 'جدد', 'قدامى', 'نسبة القدامى']}
            rows={months.map((m) => [monthName(m.month), <Num>{count(m.customers)}</Num>, <Num>{count(m.newCustomers)}</Num>, <Num>{count(m.returning)}</Num>, <Num>{pct(m.returningRate)}</Num>])}
          />
        </div>
      )}
    </div>
  );
};

export default RepeatSection;
