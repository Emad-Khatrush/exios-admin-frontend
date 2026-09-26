import { useState } from 'react';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Megaphone, Send, UserRoundX } from 'lucide-react';
import Card from '../../components/Card/Card';
import InactiveCustomers from './InactiveCustomers';
import SendCampaign from './SendCampaign';
import Campaigns from './Campaigns';

import './Marketing.scss';

type Tab = 'inactiveCustomers' | 'sendCampaign' | 'campaigns';

const TABS: { value: Tab; label: string; icon: typeof Send }[] = [
  { value: 'inactiveCustomers', label: 'Customers gone quiet', icon: UserRoundX },
  { value: 'sendCampaign', label: 'New campaign', icon: Send },
  { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
];

const Marketing = () => {
  const [tab, setTab] = useState<Tab>('inactiveCustomers');
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  const goToTab = (next: Tab) => {
    setOpenCampaignId(null);
    setTab(next);
  };

  return (
    <div className="m-4">
      <Breadcrumbs separator="›" aria-label="breadcrumb" className="mb-3">
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Typography color="#28323C">Marketing</Typography>
      </Breadcrumbs>

      <nav className="marketing-tabs" role="tablist" aria-label="Marketing sections">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? 'is-active' : ''}
            onClick={() => goToTab(item.value)}
          >
            <item.icon size={15} strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </nav>

      <Card>
        {tab === 'inactiveCustomers' && <InactiveCustomers />}
        {tab === 'sendCampaign' &&
          <SendCampaign
            onSent={(campaignId) => {
              setOpenCampaignId(campaignId);
              setTab('campaigns');
            }}
          />
        }
        {tab === 'campaigns' &&
          <Campaigns
            openCampaignId={openCampaignId}
            onOpenCampaign={setOpenCampaignId}
            onNewCampaign={() => goToTab('sendCampaign')}
          />
        }
      </Card>
    </div>
  );
};

export default Marketing;
