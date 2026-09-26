import { useState } from 'react';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import Card from '../../components/Card/Card';
import InactiveCustomers from './InactiveCustomers';
import SendCampaign from './SendCampaign';
import Campaigns from './Campaigns';

import './Marketing.scss';

type Tab = 'inactiveCustomers' | 'sendCampaign' | 'campaigns';

const TABS = [
  { value: 'inactiveCustomers', label: 'Customers gone quiet' },
  { value: 'sendCampaign', label: 'Send campaign' },
  { value: 'campaigns', label: 'Campaigns' },
];

const Marketing = () => {
  const [tab, setTab] = useState<Tab>('inactiveCustomers');
  const [focusCampaignId, setFocusCampaignId] = useState<string | null>(null);

  return (
    <div className="m-4">
      <Breadcrumbs separator="›" aria-label="breadcrumb" className="mb-3">
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Typography color="#28323C">Marketing</Typography>
      </Breadcrumbs>

      <Card tabs={TABS} tabsOnChange={(value: string) => setTab(value as Tab)}>
        {tab === 'inactiveCustomers' && <InactiveCustomers />}
        {tab === 'sendCampaign' &&
          <SendCampaign
            onSent={(campaignId) => {
              setFocusCampaignId(campaignId);
              setTab('campaigns');
            }}
          />
        }
        {tab === 'campaigns' &&
          <Campaigns
            focusCampaignId={focusCampaignId}
            onFocused={() => setFocusCampaignId(null)}
          />
        }
      </Card>
    </div>
  );
};

export default Marketing;
