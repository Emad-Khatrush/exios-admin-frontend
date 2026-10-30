import { useState } from 'react';
import { useSelector } from 'react-redux';
import { ClipboardCheck, ListOrdered } from 'lucide-react';
import XTrackingPage from './XTrackingDashboard';
import OrdersControl from './OrdersControl/OrdersControl';

import './OrdersControl/OrdersControl.scss';

type HubTab = 'tracking' | 'control';

const STORAGE_KEY = 'xtracking.activeTab';

const readTab = (): HubTab => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'control' ? 'control' : 'tracking';
  } catch (error) {
    return 'tracking';
  }
};

// Order control is admin only; the tracking dashboard is available to employees too.
const XTrackingHub = () => {
  const isAdmin = useSelector((state: any) => !!state.session?.account?.roles?.isAdmin);
  const [tab, setTab] = useState<HubTab>(readTab);

  if (!isAdmin) return <XTrackingPage />;

  const select = (value: HubTab) => {
    setTab(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // Not important: the tab just won't be remembered
    }
  };

  return (
    <div>
      <div className="xt-hub-tabs" role="tablist" aria-label="X-Tracking">
        <button type="button" role="tab" aria-selected={tab === 'tracking'} onClick={() => select('tracking')}>
          <ListOrdered size={16} strokeWidth={2} />
          X-Tracking
        </button>
        <button type="button" role="tab" aria-selected={tab === 'control'} onClick={() => select('control')}>
          <ClipboardCheck size={16} strokeWidth={2} />
          مراقبة الطلبيات
        </button>
      </div>

      {tab === 'tracking' ? <XTrackingPage /> : <OrdersControl />}
    </div>
  );
};

export default XTrackingHub;
