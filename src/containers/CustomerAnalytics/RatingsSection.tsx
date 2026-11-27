import { CampaignButton } from './Campaign';
import { Versus } from './compare';
import { cityName, count, date, decimal } from './format';
import { ExportButton } from './fullList';
import { Empty, Loading, Num, PAGE_SIZE, Pager, Panel, Person, SectionError, Tile, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { RatingRow, RatingsData, RatingStatus } from './types';

const STATUS: Record<RatingStatus, string> = { active: 'نشطون', atRisk: 'في خطر التوقف', lost: 'توقفوا' };
const rating = (v?: number | null) => (v == null ? '—' : `${decimal(v, 1)} / 5`);
const pickLow = (d: any) => d?.low?.rows;

// التقييمات: do customers who rate us badly stop ordering? And who rated us 3 or less
const RatingsSection = () => {
  const { filters, param, setParam } = useEnv();
  const page = Math.max(1, Number(param('page')) || 1);
  const query = { office: filters.office };
  const { data, error, loading, retry } = useSection<RatingsData>('ratings', { ...query, page, limit: PAGE_SIZE });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={4} />;

  const low = data.low || { total: 0, page: 1, limit: PAGE_SIZE, rows: [] };
  const byStatus = data.byStatus || [];

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <p className="ca-period">كل التقييمات حتى اليوم. «نشطون» و«في خطر» و«توقفوا» بنفس تعريف قسم العملاء الخاملين (90 يوماً، طلبان على الأقل).</p>
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles">
        <Tile label="متوسط التقييم" en="CSAT" value={rating(data.avgRating)} foot={<Versus data={data} path="avgRating" target="avgRating" />} />
        <Tile label="عملاء قيّموا" en="Responses" value={count(data.rated)} />
        {byStatus.map((s) => (
          <Tile key={s.status} label={`متوسط تقييم ${STATUS[s.status] || s.status}`} value={rating(s.avgRating)} hint={<><Num>{count(s.rated)}</Num> قيّموا من <Num>{count(s.customers)}</Num> عميل</>} />
        ))}
      </div>

      <Panel
        title={<>عملاء قيّمونا بـ 3 أو أقل <Num>{count(low.total)}</Num></>}
        sub="الأقل تقييماً أولاً. اتصل بهم واسأل عمّا حدث، خاصة من لم يتوقف بعد."
        actions={(
          <>
            <CampaignButton section="ratings" query={query} pick={pickLow} total={low.total} listName="تقييم منخفض" />
            <ExportButton<RatingRow>
              section="ratings" query={query} pick={pickLow} name="عملاء-تقييم-منخفض.csv" disabled={!low.total}
              header={['الاسم', 'كود العميل', 'الهاتف', 'المدينة', 'متوسط التقييم', 'عدد التقييمات', 'الحالة', 'آخر طلب']}
              row={(r) => [r.name, r.customerId, r.phone, cityName(r.city), decimal(r.rating, 2), r.count, STATUS[r.status] || r.status, date(r.lastOrderAt)]}
            />
          </>
        )}
      >
        {!low.rows.length ? <Empty>لا يوجد عملاء بتقييم منخفض.</Empty> : (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th>العميل</th><th>الكود</th><th>الهاتف</th><th>المدينة</th>
                  <th className="is-num">التقييم</th><th className="is-num">عدد التقييمات</th><th>الحالة</th><th>آخر طلب</th>
                </tr>
              </thead>
              <tbody>
                {low.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Person who={r} /></td>
                    <td><Num>{r.customerId || '—'}</Num></td>
                    <td><Num>{r.phone || '—'}</Num></td>
                    <td>{cityName(r.city)}</td>
                    <td className="is-num"><Num>{rating(r.rating)}</Num></td>
                    <td className="is-num"><Num>{count(r.count)}</Num></td>
                    <td><span className={`ca-status is-${r.status}`}>{STATUS[r.status] || r.status}</span></td>
                    <td><Num>{date(r.lastOrderAt)}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={low.total} page={low.page} limit={low.limit || PAGE_SIZE} onPage={(p) => setParam({ page: p > 1 ? String(p) : null })} />
        {low.total > 0 && <p className="ca-note">التصدير والحملة يأخذان كل القائمة (<Num>{count(low.total)}</Num> عميل)، لا الصفحة المعروضة فقط.</p>}
      </Panel>
    </div>
  );
};

export default RatingsSection;
