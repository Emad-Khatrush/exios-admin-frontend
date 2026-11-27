import { count, decimal, pct, usd } from './format';
import { Empty, Loading, Num, Panel, SectionError, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { LoyaltyData, LoyaltyGroupKey } from './types';

const LABEL: Record<LoyaltyGroupKey, string> = { redeemed: 'استعملوا نقاطاً', earnedOnly: 'كسبوا ولم يستعملوا', none: 'بدون نقاط' };

// أثر النقاط: customers who spent points, who only earned them, and who have none, side by side
const LoyaltySection = () => {
  const { filters } = useEnv();
  const { data, error, loading, retry } = useSection<LoyaltyData>('loyalty', { office: filters.office });

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={3} />;

  const groups = data.groups || [];
  const redeemed = groups.find((g) => g.key === 'redeemed');
  const none = groups.find((g) => g.key === 'none');
  const both = redeemed?.repeatRate != null && none?.repeatRate != null && redeemed.customers > 0 && none.customers > 0;

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <p className="ca-period">كل من طلب منا ولو مرة، حتى اليوم، مقسّمون حسب النقاط.</p>
      <InsightsPanel insights={data.insights} />
      {!groups.some((g) => g.customers) ? <Empty>لا يوجد عملاء لديهم طلبات.</Empty> : (
        <Panel title="هل تجعل النقاط العميل يرجع؟" en="Loyalty Impact" sub="المقارنة تُظهر ارتباطاً لا سبباً: من يطلب كثيراً يكسب نقاطاً أكثر أصلاً.">
          {both && (
            <p className="ca-takeaway">
              من استعمل نقاطاً طلب أكثر من مرة بنسبة <Num>{pct(redeemed.repeatRate)}</Num>، مقابل <Num>{pct(none.repeatRate)}</Num> لمن ليس لديه نقاط.
            </p>
          )}
          <div className="ca-compare ca-compare--three">
            {groups.map((g) => (
              <div key={g.key} className="ca-compare__col">
                <h3>{g.label || LABEL[g.key]}</h3>
                <dl>
                  <div><dt>العملاء</dt><dd><Num>{count(g.customers)}</Num></dd></div>
                  <div><dt>طلبوا أكثر من مرة</dt><dd><Num>{pct(g.repeatRate)}</Num></dd></div>
                  <div><dt>طلبات لكل عميل</dt><dd><Num>{decimal(g.ordersPerCustomer, 2)}</Num></dd></div>
                  <div><dt>متوسط قيمة العميل</dt><dd><Num>{usd(g.avgValueCents)}</Num></dd></div>
                  <div><dt>توقفوا</dt><dd><Num>{pct(g.lostRate)}</Num></dd></div>
                </dl>
              </div>
            ))}
          </div>
          <p className="ca-note">النقطة = سنت واحد. «توقفوا»: نسبة من توقف عن الطلب من المجموعة.</p>
        </Panel>
      )}
    </div>
  );
};

export default LoyaltySection;
