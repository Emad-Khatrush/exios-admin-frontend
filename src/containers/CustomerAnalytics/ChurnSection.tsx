import { MenuItem, TextField } from '@mui/material';
import { CampaignButton } from './Campaign';
import { TargetMark } from './compare';
import { cityName, count, date, days as daysText, decimal, usd, usdWhole } from './format';
import { ExportButton } from './fullList';
import { En, Empty, Loading, Num, PAGE_SIZE, Pager, Panel, Person, SectionError, Segment, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { ChurnData, ChurnKind, ChurnRow } from './types';

const DAY_OPTIONS = ['60', '90', '180'];
const MIN_ORDERS = ['1', '2', '3', '5'];
const pickRows = (d: any) => d?.rows;
const SORTS: [string, string][] = [['value', 'الأعلى قيمة'], ['recent', 'الأحدث انقطاعاً'], ['orders', 'الأكثر طلبات']];

// العملاء الخاملون: customers with minOrders+ orders (2 by default) who stopped ordering (lost) or are late compared to their own habit (atRisk)
const ChurnSection = () => {
  const { filters, param, setParam } = useEnv();
  const kind: ChurnKind = param('kind') === 'atRisk' ? 'atRisk' : 'lost';
  const daysValue = DAY_OPTIONS.includes(param('days')) ? param('days') : '90';
  const minOrders = MIN_ORDERS.includes(param('minOrders')) ? param('minOrders') : '2';
  const sort = SORTS.some(([k]) => k === param('sort')) ? param('sort') : 'value';
  const page = Math.max(1, Number(param('page')) || 1);
  const query = { kind, days: daysValue, minOrders, sort, office: filters.office };
  const { data, error, loading, retry } = useSection<ChurnData>('churn', { ...query, page, limit: PAGE_SIZE });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={0} />;

  const listName = kind === 'lost' ? 'عملاء توقفوا عن الطلب' : 'عملاء في خطر التوقف';

  const kindOptions: [ChurnKind, JSX.Element][] = [
    ['lost', <>توقفوا <Num>{count(data.lost?.customers)}</Num></>],
    ['atRisk', <>في خطر <Num>{count(data.atRisk?.customers)}</Num></>],
  ];

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <InsightsPanel insights={data.insights} />
      <div className="ca-tiles ca-tiles--two">
        <button type="button" className={`ca-tile is-button${kind === 'lost' ? ' is-active' : ''}`} onClick={() => setParam({ kind: null, page: null })}>
          <span className="ca-tile__label">توقفوا عن الطلب <En>Churned</En></span>
          <strong className="ca-tile__value"><Num>{count(data.lost?.customers)}</Num> <small>عميل</small></strong>
          <small className="ca-tile__hint">آخر طلب قبل أكثر من <Num>{data.days}</Num> يوماً · اشتروا منا بـ <Num>{usdWhole(data.lost?.valueCents)}</Num></small>
          <TargetMark now={data.lost?.customers ?? null} target={data.targets?.lostCustomers} unit="count" better="down" />
        </button>
        <button type="button" className={`ca-tile is-button${kind === 'atRisk' ? ' is-active' : ''}`} onClick={() => setParam({ kind: 'atRisk', page: null })}>
          <span className="ca-tile__label">في خطر التوقف <En>At Risk</En></span>
          <strong className="ca-tile__value"><Num>{count(data.atRisk?.customers)}</Num> <small>عميل</small></strong>
          <small className="ca-tile__hint">تأخروا أكثر من ضعف عادتهم بين الطلبات (30 يوماً على الأقل) · اشتروا منا بـ <Num>{usdWhole(data.atRisk?.valueCents)}</Num></small>
          <TargetMark now={data.atRisk?.customers ?? null} target={data.targets?.atRiskCustomers} unit="count" better="down" />
        </button>
      </div>

      <Panel
        title={listName}
        sub={<>فقط من طلب {Number(data.minOrders) === 1 ? 'مرة واحدة' : <><Num>{data.minOrders}</Num> مرات</>} أو أكثر. القيمة = كل ما طلبوه منا منذ البداية. اتصل بهم أو أرسل لهم عرضاً.</>}
        actions={(
          <>
            <Segment label="النوع" value={kind} options={kindOptions} onChange={(k) => setParam({ kind: k === 'lost' ? null : k, page: null })} />
            <TextField select size="small" label="مدة الانقطاع" value={daysValue} onChange={(e) => setParam({ days: e.target.value === '90' ? null : e.target.value, page: null })} sx={{ minWidth: 120 }}>
              {DAY_OPTIONS.map((d) => <MenuItem key={d} value={d}>{d} يوماً</MenuItem>)}
            </TextField>
            <TextField select size="small" label="أقل عدد طلبات" value={minOrders} onChange={(e) => setParam({ minOrders: e.target.value === '2' ? null : e.target.value, page: null })} sx={{ minWidth: 130 }}>
              {MIN_ORDERS.map((n) => <MenuItem key={n} value={n}>{n === '1' ? 'طلب واحد فأكثر' : `${n} طلبات فأكثر`}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="الترتيب" value={sort} onChange={(e) => setParam({ sort: e.target.value === 'value' ? null : e.target.value, page: null })} sx={{ minWidth: 150 }}>
              {SORTS.map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}
            </TextField>
            <CampaignButton section="churn" query={query} pick={pickRows} total={data.total} listName={listName} />
            <ExportButton<ChurnRow>
              section="churn" query={query} pick={pickRows} disabled={!data.total}
              name={`${kind === 'lost' ? 'عملاء-توقفوا' : 'عملاء-في-خطر'}-${daysValue}-يوم.csv`}
              header={['الاسم', 'كود العميل', 'الهاتف', 'المدينة', 'عدد الطلبات', 'القيمة ($)', 'أول طلب', 'آخر طلب', 'أيام منذ آخر طلب', 'متوسط الأيام بين الطلبات']}
              row={(r) => [r.name, r.customerId, r.phone, cityName(r.city), r.orders, (r.valueCents / 100).toFixed(2),
                date(r.firstOrderAt), date(r.lastOrderAt), r.daysSince, r.avgGapDays == null ? '' : Math.round(r.avgGapDays)]}
            />
          </>
        )}
      >
        {!data.rows.length ? <Empty>لا يوجد عملاء هنا. جيد!</Empty> : (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th>العميل</th><th>الكود</th><th>الهاتف</th><th>المدينة</th>
                  <th className="is-num">الطلبات</th><th className="is-num">القيمة</th><th>آخر طلب</th>
                  <th className="is-num">منذ</th><th className="is-num">عادته بين الطلبات</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Person who={r} /></td>
                    <td><Num>{r.customerId || '—'}</Num></td>
                    <td><Num>{r.phone || '—'}</Num></td>
                    <td>{cityName(r.city)}</td>
                    <td className="is-num"><Num>{count(r.orders)}</Num></td>
                    <td className="is-num"><Num>{usd(r.valueCents)}</Num></td>
                    <td><Num>{date(r.lastOrderAt)}</Num></td>
                    <td className="is-num">{daysText(r.daysSince)}</td>
                    <td className="is-num">{r.avgGapDays == null ? '—' : <>كل <Num>{decimal(r.avgGapDays, 0)}</Num> يوم</>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={data.total} page={data.page} limit={data.limit || PAGE_SIZE} onPage={(p) => setParam({ page: p > 1 ? String(p) : null })} />
        {data.total > 0 && <p className="ca-note">التصدير والحملة يأخذان كل القائمة (<Num>{count(data.total)}</Num> عميل)، لا الصفحة المعروضة فقط.</p>}
      </Panel>
    </div>
  );
};

export default ChurnSection;
