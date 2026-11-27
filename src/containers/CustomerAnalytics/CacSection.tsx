import { Bar, Line } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, C2, lineStyle } from './charts';
import { formatUnit, Versus } from './compare';
import { count, monthName, monthShort, usd, usdWhole } from './format';
import { Empty, Loading, Num, Panel, PeriodLine, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { CacData } from './types';

const dollars = (cents?: number | null) => (cents == null ? null : cents / 100);

// تكلفة جلب العميل: what marketing and gift points cost for each new customer, against what a new customer orders in 90 days
const CacSection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<CacData>('cac', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading />;

  const t = data.totals || {} as CacData['totals'];
  const months = data.months || [];
  const labels = months.map((m) => monthShort(m.month));
  const anyCost = months.some((m) => m.marketingCents || m.giftsCents);

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine
        period={data.period}
        extra={<> · <Num>{count(t.newCustomers)}</Num> عميل جديد · تسويق <Num>{usdWhole(t.marketingCents)}</Num> · هدايا نقاط <Num>{usdWhole(t.giftsCents)}</Num></>}
      />
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles">
        <Tile label="تكلفة جلب العميل" en="CAC" value={usd(t.cacCents)} hint="(التسويق + هدايا النقاط) ÷ العملاء الجدد" foot={<Versus data={data} path="totals.cacCents" target="cacCents" />} />
        <Tile label="مع العمولات" en="Fully-loaded CAC" value={usd(t.cacWithCommissionsCents)} hint={<>العمولات <Num>{usdWhole(t.commissionsCents)}</Num> تُعرض منفصلة</>} foot={<Versus data={data} path="totals.cacWithCommissionsCents" unit="money" better="down" />} />
        <Tile label="قيمة العميل الجديد في أول 90 يوماً" en="90-day LTV" value={usd(t.avgValue90Cents)} hint="متوسط ما طلبه في 90 يوماً من أول طلب" foot={<Versus data={data} path="totals.avgValue90Cents" unit="money" better="up" />} />
        <Tile label="القيمة ÷ التكلفة" en="LTV:CAC" value={formatUnit('ratio', t.valueToCac)} hint="أكبر من 1: العميل الجديد طلب أكثر مما كلّف جلبه" foot={<Versus data={data} path="totals.valueToCac" target="valueToCac" />} />
      </div>
      <p className="ca-note">
        التكاليف من الحسابات المحاسبية «تسويق وإعلانات» ومن نقاط الهدايا التي أعطيناها (النقطة = سنت). العمولات تُعرض منفصلة لأنها ليست كلها لجلب عملاء جدد.
        الشحن المجاني يُعرض للعلم ولا يدخل في التكلفة. التكاليف للشركة كلها؛ المكتب يغيّر عدد العملاء الجدد فقط.
      </p>
      {data.note && <p className="ca-takeaway">{data.note}</p>}

      {!months.length ? <Empty>لا توجد بيانات في هذه الفترة.</Empty> : (
        <>
          <div className="ca-grid">
            <Panel title="التكاليف كل شهر" en="Acquisition Spend" sub="التسويق وهدايا النقاط (ما يدخل في تكلفة جلب العميل).">
              {!anyCost ? <Empty>لا توجد تكاليف مسجّلة في هذه الفترة.</Empty> : (
                <div className="ca-chart" dir="ltr">
                  <Bar
                    data={{
                      labels,
                      datasets: [
                        { label: 'تسويق وإعلانات', data: months.map((m) => dollars(m.marketingCents)), backgroundColor: C1, ...barStyle, borderRadius: 0 },
                        { label: 'هدايا النقاط', data: months.map((m) => dollars(m.giftsCents)), backgroundColor: C2, ...barStyle },
                      ],
                    }}
                    options={baseOptions({ stacked: true, money: true })}
                  />
                </div>
              )}
            </Panel>
            <Panel title="تكلفة جلب العميل كل شهر" en="Monthly CAC" sub="الأقل أفضل. الشهر بلا عملاء جدد لا يظهر.">
              <div className="ca-chart" dir="ltr">
                <Line
                  data={{ labels, datasets: [{ label: 'تكلفة جلب العميل', data: months.map((m) => dollars(m.cacCents)), ...lineStyle(C1) }] }}
                  options={baseOptions({ legend: false, money: true })}
                />
              </div>
            </Panel>
          </div>

          <Panel title="الأرقام كل شهر">
            <div className="ca-table-wrap">
              <table className="ca-table">
                <thead>
                  <tr>
                    <th>الشهر</th><th className="is-num">تسويق وإعلانات</th><th className="is-num">هدايا النقاط</th><th className="is-num">العمولات</th>
                    <th className="is-num">الشحن المجاني</th><th className="is-num">عملاء جدد</th><th className="is-num">تكلفة جلب العميل</th><th className="is-num">قيمة أول 90 يوماً</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}>
                      <td>{monthName(m.month)}</td>
                      <td className="is-num"><Num>{usdWhole(m.marketingCents)}</Num></td>
                      <td className="is-num"><Num>{usdWhole(m.giftsCents)}</Num></td>
                      <td className="is-num"><Num>{usdWhole(m.commissionsCents)}</Num></td>
                      <td className="is-num"><Num>{usdWhole(m.freeShippingCents)}</Num></td>
                      <td className="is-num"><Num>{count(m.newCustomers)}</Num></td>
                      <td className="is-num"><Num>{usd(m.cacCents)}</Num></td>
                      <td className="is-num"><Num>{usd(m.avgValue90Cents)}</Num></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ca-note">قيمة أول 90 يوماً للأشهر الأخيرة أقل عادةً: لم تمض 90 يوماً على عملائها بعد.</p>
          </Panel>
        </>
      )}
    </div>
  );
};

export default CacSection;
