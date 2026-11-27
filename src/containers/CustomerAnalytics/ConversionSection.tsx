import { Bar, Line } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, C2, lineStyle } from './charts';
import { CampaignButton } from './Campaign';
import { Versus } from './compare';
import { cityName, count, date, days, monthName, monthShort, pct } from './format';
import { ExportButton } from './fullList';
import { ChartTable, Empty, Loading, Num, PAGE_SIZE, Pager, Panel, Person, PeriodLine, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { ConversionData } from './types';

type WaitingRow = ConversionData['waiting']['rows'][number]
const pickWaiting = (d: any) => d?.waiting?.rows;

// من التسجيل إلى الطلب: of the accounts opened in the period, how many placed an order and how fast
const ConversionSection = () => {
  const { filters, param, setParam } = useEnv();
  const page = Math.max(1, Number(param('page')) || 1);
  const query = { from: filters.from, to: filters.to };
  const { data, error, loading, retry } = useSection<ConversionData>('conversion', { ...query, page, limit: PAGE_SIZE });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={6} />;

  const months = data.months || [];
  const labels = months.map((m) => monthShort(m.month));
  const invited = data.bySource?.invited;
  const direct = data.bySource?.direct;
  const waiting = data.waiting || { total: 0, page: 1, limit: PAGE_SIZE, rows: [] };

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra=" (حسب تاريخ فتح الحساب)" />
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles ca-tiles--six">
        <Tile label="فتحوا حساباً" en="Signups" value={count(data.signups)} foot={<Versus data={data} path="signups" unit="count" />} />
        <Tile label="طلبوا مرة على الأقل" en="Converted" value={count(data.converted)} foot={<Versus data={data} path="converted" unit="count" />} />
        <Tile label="نسبة من طلب" en="Conversion Rate" value={pct(data.rate)} foot={<Versus data={data} path="rate" target="conversionRate" />} />
        <Tile label="المدة حتى أول طلب" en="Time to First Order" value={days(data.medianDays)} hint="الوسيط: نصفهم أسرع ونصفهم أبطأ" foot={<Versus data={data} path="medianDays" target="medianDaysToFirstOrder" />} />
        <Tile label="طلبوا خلال 7 أيام" en="D7" value={count(data.within7)} hint={data.signups ? <><Num>{pct(data.within7 / data.signups)}</Num> من المسجّلين</> : undefined} />
        <Tile label="طلبوا خلال 30 يوماً" en="D30" value={count(data.within30)} hint={data.signups ? <><Num>{pct(data.within30 / data.signups)}</Num> من المسجّلين</> : undefined} />
      </div>

      {!data.signups ? <Empty>لم يفتح أحد حساباً في هذه الفترة.</Empty> : (
        <>
          <Panel title="بدعوة من صديق أم مباشرة؟" en="Referral vs Direct" sub="هل من جاء بدعوة يطلب أكثر ممن سجّل وحده؟">
            <div className="ca-compare">
              {([['بدعوة صديق', invited], ['مباشرة', direct]] as const).map(([title, s]) => (
                <div key={title} className="ca-compare__col">
                  <h3>{title}</h3>
                  <dl>
                    <div><dt>فتحوا حساباً</dt><dd><Num>{count(s?.signups)}</Num></dd></div>
                    <div><dt>طلبوا</dt><dd><Num>{count(s?.converted)}</Num></dd></div>
                    <div><dt>النسبة</dt><dd><Num>{pct(s?.rate)}</Num></dd></div>
                    <div><dt>المدة حتى أول طلب</dt><dd>{days(s?.medianDays)}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          </Panel>

          {months.length > 0 && (
            <div className="ca-grid">
              <Panel title="التسجيلات كل شهر ومن طلب منهم" en="Signup Funnel">
                <div className="ca-chart" dir="ltr">
                  <Bar
                    data={{
                      labels,
                      datasets: [
                        { label: 'فتحوا حساباً', data: months.map((m) => m.signups), backgroundColor: C1, ...barStyle },
                        { label: 'طلبوا', data: months.map((m) => m.converted), backgroundColor: C2, ...barStyle },
                      ],
                    }}
                    options={baseOptions()}
                  />
                </div>
              </Panel>
              <Panel title="نسبة من طلب، حسب شهر التسجيل" en="Conversion by Cohort" sub="الأشهر الأخيرة أقل عادةً: لم يمض عليهم وقت كافٍ.">
                <div className="ca-chart ca-chart--short" dir="ltr">
                  <Line
                    data={{ labels, datasets: [{ label: 'نسبة من طلب', data: months.map((m) => (m.rate == null ? null : m.rate * 100)), ...lineStyle(C1) }] }}
                    options={baseOptions({ percent: true, legend: false })}
                  />
                </div>
              </Panel>
              <ChartTable
                head={['الشهر', 'فتحوا حساباً', 'طلبوا', 'النسبة']}
                rows={months.map((m) => [monthName(m.month), <Num>{count(m.signups)}</Num>, <Num>{count(m.converted)}</Num>, <Num>{pct(m.rate)}</Num>])}
              />
            </div>
          )}
        </>
      )}

      <Panel title={<>سجّلوا ولم يطلبوا بعد <Num>{count(waiting.total)}</Num></>} sub="الأحدث أولاً. رسالة ترحيب أو مكالمة قصيرة قد تكفي ليبدؤوا."
        actions={(
          <>
            <CampaignButton section="conversion" query={query} pick={pickWaiting} total={waiting.total} listName="سجّلوا ولم يطلبوا" />
            <ExportButton<WaitingRow>
              section="conversion" query={query} pick={pickWaiting} name="سجلوا-ولم-يطلبوا.csv" disabled={!waiting.total}
              header={['الاسم', 'كود العميل', 'الهاتف', 'المدينة', 'فتح الحساب', 'أيام منذ التسجيل']}
              row={(r) => [r.name, r.customerId, r.phone, cityName(r.city), date(r.createdAt), r.days]}
            />
          </>
        )}
      >
        {!waiting.rows.length ? <Empty>كل من سجّل في هذه الفترة طلب مرة على الأقل.</Empty> : (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead><tr><th>العميل</th><th>الكود</th><th>الهاتف</th><th>المدينة</th><th>فتح الحساب</th><th className="is-num">منذ</th></tr></thead>
              <tbody>
                {waiting.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Person who={r} /></td>
                    <td><Num>{r.customerId || '—'}</Num></td>
                    <td><Num>{r.phone || '—'}</Num></td>
                    <td>{cityName(r.city)}</td>
                    <td><Num>{date(r.createdAt)}</Num></td>
                    <td className="is-num">{days(r.days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={waiting.total} page={waiting.page} limit={waiting.limit || PAGE_SIZE} onPage={(p) => setParam({ page: p > 1 ? String(p) : null })} />
        {waiting.total > 0 && <p className="ca-note">التصدير والحملة يأخذان كل القائمة (<Num>{count(waiting.total)}</Num> عميل)، لا الصفحة المعروضة فقط.</p>}
      </Panel>
    </div>
  );
};

export default ConversionSection;
