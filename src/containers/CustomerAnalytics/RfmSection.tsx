import { CampaignButton } from './Campaign';
import { cityName, count, days, decimal, pct, usd, usdWhole } from './format';
import { ExportButton } from './fullList';
import { Empty, Loading, Num, PAGE_SIZE, Pager, Panel, Person, SectionError, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { RfmData, SegmentKey } from './types';

type RfmRow = RfmData['list']['rows'][number]
const pickList = (d: any) => d?.list?.rows;

const SEGMENTS: SegmentKey[] = ['champions', 'loyal', 'promising', 'needAttention', 'atRisk', 'hibernating', 'lost'];
const LABEL: Record<SegmentKey, string> = {
  champions: 'الأبطال', loyal: 'الأوفياء', promising: 'جدد واعدون', needAttention: 'يحتاجون اهتماماً',
  atRisk: 'في خطر الفقدان', hibernating: 'نائمون', lost: 'مفقودون',
};
const WHO: Record<SegmentKey, string> = {
  champions: 'طلبوا مؤخراً وكثيراً.',
  loyal: 'يطلبون كثيراً على مدى الوقت.',
  promising: 'طلبوا مؤخراً، مرة أو مرتين.',
  needAttention: 'مرّ وقت متوسط على آخر طلب.',
  atRisk: 'طلبوا كثيراً، لكن منذ مدة طويلة.',
  hibernating: 'مرّ وقت طويل وطلباتهم قليلة.',
  lost: 'أطول مدة دون طلب.',
};
const ACTION: Record<SegmentKey, string> = {
  champions: 'كافئهم بعرض خاص واطلب منهم دعوة أصدقائهم.',
  loyal: 'اشكرهم وعرّفهم بخدمات لم يجربوها.',
  promising: 'تابع معهم بعد التسليم ليطلبوا مرة ثانية.',
  needAttention: 'أرسل لهم تذكيراً أو عرضاً محدود المدة.',
  atRisk: 'اتصل بهم واسأل: هل حدثت مشكلة؟',
  hibernating: 'رسالة بعرض مناسب قد تعيدهم.',
  lost: 'لا تصرف عليهم كثيراً؛ رسالة عامة تكفي.',
};

// شرائح العملاء: every customer who ever ordered, grouped by how recently, how often and how much
const RfmSection = () => {
  const { filters, param, setParam } = useEnv();
  const segment: SegmentKey = (SEGMENTS as string[]).includes(param('segment')) ? param('segment') as SegmentKey : 'champions';
  const page = Math.max(1, Number(param('page')) || 1);
  const query = { office: filters.office, segment };
  const { data, error, loading, retry } = useSection<RfmData>('rfm', { ...query, page, limit: PAGE_SIZE });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={7} />;

  const segments = data.segments || [];
  const list = data.list || { total: 0, page: 1, limit: PAGE_SIZE, rows: [] };
  const total = segments.reduce((s, x) => s + (x.customers || 0), 0);
  const segmentName = segments.find((s) => s.key === segment)?.label || LABEL[segment];

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <p className="ca-period">كل من طلب منا ولو مرة، مقسّمون حسب: متى آخر طلب، وكم مرة طلب، وكم قيمة ما طلب. اضغط على شريحة لترى أسماءها.</p>
      <InsightsPanel insights={data.insights} />
      {!total ? <Empty>لا يوجد عملاء لديهم طلبات.</Empty> : (
        <>
          <div className="ca-segments" role="group" aria-label="الشرائح">
            {segments.map((s) => (
              <button
                key={s.key} type="button" aria-pressed={segment === s.key}
                className={`ca-seg ca-seg--${s.key}${segment === s.key ? ' is-active' : ''}`}
                onClick={() => setParam({ segment: s.key === 'champions' ? null : s.key, page: null })}
              >
                <span className="ca-seg__head">
                  <strong>{s.label || LABEL[s.key]}</strong>
                  <span className="ca-seg__share"><Num>{pct(s.share)}</Num></span>
                </span>
                <span className="ca-seg__count"><Num>{count(s.customers)}</Num> عميل · <Num>{usdWhole(s.valueCents)}</Num></span>
                <span className="ca-seg__facts">آخر طلب قبل <Num>{decimal(s.avgRecencyDays, 0)}</Num> يوماً في المتوسط · <Num>{decimal(s.avgOrders, 1)}</Num> طلب</span>
                <span className="ca-seg__who">{WHO[s.key]}</span>
                <span className="ca-seg__action">{ACTION[s.key]}</span>
              </button>
            ))}
          </div>

          <Panel
            title={<>{segmentName} <Num>{count(list.total)}</Num></>}
            sub={<>{ACTION[segment]} الدرجات من 1 إلى 5 (5 الأفضل): R حداثة آخر طلب، F عدد الطلبات، M القيمة.</>}
            actions={(
              <>
                <CampaignButton section="rfm" query={query} pick={pickList} total={list.total} listName={segmentName} />
                <ExportButton<RfmRow>
                  section="rfm" query={query} pick={pickList} name={`شريحة-${segmentName.replace(/\s+/g, '-')}.csv`} disabled={!list.total}
                  header={['الاسم', 'كود العميل', 'الهاتف', 'المدينة', 'أيام منذ آخر طلب', 'عدد الطلبات', 'القيمة ($)', 'R', 'F', 'M']}
                  row={(r) => [r.name, r.customerId, r.phone, cityName(r.city), r.recencyDays, r.orders, (r.valueCents / 100).toFixed(2), r.r, r.f, r.m]}
                />
              </>
            )}
          >
            {!list.rows.length ? <Empty>لا يوجد عملاء في هذه الشريحة.</Empty> : (
              <div className="ca-table-wrap">
                <table className="ca-table">
                  <thead>
                    <tr>
                      <th>العميل</th><th>الكود</th><th>الهاتف</th><th>المدينة</th>
                      <th className="is-num">آخر طلب منذ</th><th className="is-num">الطلبات</th><th className="is-num">القيمة</th>
                      <th className="is-num" title="حداثة آخر طلب">R</th><th className="is-num" title="عدد الطلبات">F</th><th className="is-num" title="القيمة">M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.rows.map((r) => (
                      <tr key={r.id}>
                        <td><Person who={r} /></td>
                        <td><Num>{r.customerId || '—'}</Num></td>
                        <td><Num>{r.phone || '—'}</Num></td>
                        <td>{cityName(r.city)}</td>
                        <td className="is-num">{days(r.recencyDays)}</td>
                        <td className="is-num"><Num>{count(r.orders)}</Num></td>
                        <td className="is-num"><Num>{usd(r.valueCents)}</Num></td>
                        {[r.r, r.f, r.m].map((score, i) => <td key={i} className="is-num"><span className={`ca-score is-${score}`}><Num>{score}</Num></span></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager total={list.total} page={list.page} limit={list.limit || PAGE_SIZE} onPage={(p) => setParam({ page: p > 1 ? String(p) : null })} />
            {list.total > 0 && <p className="ca-note">التصدير والحملة يأخذان كل الشريحة (<Num>{count(list.total)}</Num> عميل)، لا الصفحة المعروضة فقط.</p>}
          </Panel>
        </>
      )}
    </div>
  );
};

export default RfmSection;
