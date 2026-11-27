import { Bar, Line } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, lineStyle } from './charts';
import { Versus } from './compare';
import { count, days, decimal, monthName, monthShort, pct } from './format';
import { ChartTable, Empty, Loading, Num, Panel, PeriodLine, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { DeliveryData } from './types';

const METHODS: [keyof DeliveryData['byMethod'], string][] = [['air', 'جوي'], ['sea', 'بحري'], ['unknown', 'غير محدد']];
const MIN_GROUP = 5; // a delivery-time group needs this many customers before the takeaway quotes it

const bucketName = (label: string) => `${label} يوم`;

// One line comparing the fastest and the slowest group with enough customers
const takeaway = (effect: DeliveryData['effect']) => {
  const usable = effect.filter((e) => e.customers >= MIN_GROUP && e.returnRate != null);
  if (usable.length < 2) return 'لا توجد بيانات كافية بعد للمقارنة بين المدد.';
  const fast = usable[0];
  const slow = usable[usable.length - 1];
  const gap = ((fast.returnRate as number) - (slow.returnRate as number)) * 100;
  const verdict = Math.abs(gap) < 3 ? 'الفرق صغير: مدة التوصيل لا تبدو السبب الرئيسي في رجوع العملاء.'
    : gap > 0 ? 'التوصيل الأسرع يرتبط برجوع أكثر.' : 'اللافت أن من انتظر أطول رجع أكثر؛ أسباب أخرى أقوى من المدة.';
  return (
    <>
      من وصلته أول شحنة خلال <Num>{fast.label}</Num> يوم رجع منهم <Num>{pct(fast.returnRate)}</Num>،
      ومن انتظر <Num>{slow.label}</Num> يوم رجع منهم <Num>{pct(slow.returnRate)}</Num>. {verdict}
    </>
  );
};

// مدة التوصيل: days from arrival at our warehouse abroad to handing the package to the customer, and whether it changes who comes back
const DeliverySection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<DeliveryData>('delivery', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading />;

  const months = data.months || [];
  const buckets = data.buckets || [];
  const effect = data.effect || [];

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra={<> (حسب تاريخ التسليم) · <Num>{count(data.packages)}</Num> شحنة</>} />
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles">
        <Tile label="المدة المعتادة (الوسيط)" en="Median" value={days(data.medianDays)} hint="نصف الشحنات أسرع منها ونصفها أبطأ" foot={<Versus data={data} path="medianDays" target="medianDeliveryDays" />} />
        <Tile label="المتوسط" en="Mean" value={days(data.avgDays)} foot={<Versus data={data} path="avgDays" unit="days" better="down" />} />
        <Tile label="أبطأ 10%" en="P90" value={days(data.p90Days)} hint="90% من الشحنات وصلت خلال هذه المدة" foot={<Versus data={data} path="p90Days" unit="days" better="down" />} />
        <Tile label="شحنات سُلّمت" en="Delivered" value={count(data.packages)} foot={<Versus data={data} path="packages" unit="count" />} />
      </div>
      <p className="ca-note">المدة من تسجيل الشحنة في مخزننا بالخارج حتى تسليمها للعميل.</p>

      {!data.packages ? <Empty>لا توجد شحنات سُلّمت في هذه الفترة.</Empty> : (
        <>
          <Panel title="حسب طريقة الشحن" en="By Mode">
            <div className="ca-tiles ca-tiles--three">
              {METHODS.filter(([k]) => k !== 'unknown' || (data.byMethod?.unknown?.packages || 0) > 0).map(([k, label]) => (
                <Tile key={k} label={label} value={days(data.byMethod?.[k]?.medianDays)} hint={<><Num>{count(data.byMethod?.[k]?.packages)}</Num> شحنة · الوسيط</>} />
              ))}
            </div>
          </Panel>

          <div className="ca-grid">
            <Panel title="المدة المعتادة كل شهر" en="Monthly Median" sub="الوسيط بالأيام. كلما انخفض، كان أفضل.">
              <div className="ca-chart ca-chart--short" dir="ltr">
                <Line
                  data={{ labels: months.map((m) => monthShort(m.month)), datasets: [{ label: 'الوسيط (يوم)', data: months.map((m) => m.medianDays), ...lineStyle(C1) }] }}
                  options={baseOptions({ legend: false })}
                />
              </div>
            </Panel>
            <Panel title="كم شحنة في كل مدة" en="Distribution">
              <div className="ca-chart ca-chart--short" dir="ltr">
                <Bar
                  data={{ labels: buckets.map((b) => bucketName(b.label)), datasets: [{ label: 'الشحنات', data: buckets.map((b) => b.packages), backgroundColor: C1, ...barStyle, maxBarThickness: 56 }] }}
                  options={baseOptions({ legend: false })}
                />
              </div>
            </Panel>
            <ChartTable
              head={['الشهر', 'الشحنات', 'الوسيط']}
              rows={months.map((m) => [monthName(m.month), <Num>{count(m.packages)}</Num>, days(m.medianDays)])}
            />
          </div>
        </>
      )}

      <Panel
        title="هل يرجع العميل إذا تأخرت شحنته الأولى؟"
        sub="العملاء حسب مدة توصيل أول شحنة سُلّمت لهم، وهل طلبوا مرة أخرى بعدها."
      >
        {!effect.some((e) => e.customers) ? <Empty>لا توجد بيانات كافية.</Empty> : (
          <>
            <p className="ca-takeaway">{takeaway(effect)}</p>
            <div className="ca-table-wrap">
              <table className="ca-table">
                <thead><tr><th>مدة أول شحنة</th><th className="is-num">العملاء</th><th className="is-num">طلبوا مرة أخرى</th><th className="is-num">نسبة الرجوع</th></tr></thead>
                <tbody>
                  {effect.map((e) => (
                    <tr key={e.label}>
                      <td>{bucketName(e.label)}</td>
                      <td className="is-num"><Num>{count(e.customers)}</Num></td>
                      <td className="is-num"><Num>{count(e.returned)}</Num></td>
                      <td className="is-num">
                        <span className="ca-share">
                          <span className="ca-share__bar" style={{ width: `${Math.min(100, (e.returnRate || 0) * 100) * 0.6}px` }} />
                          <Num>{pct(e.returnRate)}</Num>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ca-note">ارتباط لا سبب مؤكد: العملاء الأحدث لم يمض عليهم وقت كافٍ ليطلبوا مرة أخرى. المجموعات بأقل من <Num>{decimal(MIN_GROUP, 0)}</Num> عملاء لا تدخل في الجملة أعلاه.</p>
          </>
        )}
      </Panel>
    </div>
  );
};

export default DeliverySection;
