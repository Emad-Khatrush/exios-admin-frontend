import { count, pct, usd, usdWhole } from './format';
import { Empty, Loading, Num, Panel, PeriodLine, SectionError, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { StaffData } from './types';

// موظفو المبيعات: the new customers each staff member brought (who opened their first order) and how good they turned out
const StaffSection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<StaffData>('staff', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={0} />;

  const rows = data.rows || [];
  const total = rows.reduce((s, r) => s + (r.newCustomers || 0), 0);

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra={<> · <Num>{count(total)}</Num> عميل جديد</>} />
      <InsightsPanel insights={data.insights} />
      <Panel
        title="العملاء الجدد حسب الموظف"
        en="New Customers by Rep"
        sub="العميل يُنسب إلى الموظف الذي فتح أول طلب له على الإطلاق. إذا فتحه العميل من التطبيق أو لم يُعرف من فتحه، يُنسب إلى «التطبيق / غير معروف». فقط من كان أول طلب له في الفترة."
      >
        {!rows.length ? <Empty>لا يوجد عملاء جدد في هذه الفترة.</Empty> : (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th>الموظف</th><th className="is-num">عملاء جدد</th><th className="is-num">رجعوا</th><th className="is-num">نسبة الرجوع</th>
                  <th className="is-num">قيمتهم في أول 90 يوماً</th><th className="is-num">متوسط العميل</th><th className="is-num">توقفوا</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staffId}>
                    <td className={r.staffId === 'app' ? 'ca-muted' : undefined}>{r.name || 'بدون اسم'}</td>
                    <td className="is-num"><Num>{count(r.newCustomers)}</Num></td>
                    <td className="is-num"><Num>{count(r.returned)}</Num></td>
                    <td className="is-num"><Num>{pct(r.returnRate)}</Num></td>
                    <td className="is-num"><Num>{usdWhole(r.value90Cents)}</Num></td>
                    <td className="is-num"><Num>{usd(r.avgValue90Cents)}</Num></td>
                    <td className="is-num"><Num>{count(r.lost)}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ca-note">
          «رجعوا»: طلبوا مرتين أو أكثر حتى الآن. «قيمتهم في أول 90 يوماً»: ما طلبوه في 90 يوماً من أول طلب.
          «توقفوا»: لم يطلبوا منذ 90 يوماً أو أكثر. العملاء الجدد في آخر الفترة لم يمض عليهم وقت كافٍ ليرجعوا.
        </p>
      </Panel>
    </div>
  );
};

export default StaffSection;
