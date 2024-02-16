import { Tab, Tabs } from '@mui/material';
import React from 'react';
import { LocalTabs } from '../../models';

import './TableTabs.scss';

type Props = {
  tabs: LocalTabs
  tabsOnChange: any
}

const TableTabs = (props: Props) => {
  const [value, setValue] = React.useState(props.tabs[0].value);

  return (
    <div className='tabs'>
      <Tabs
        value={value}
        onChange={(event: any, value: string) => {
          setValue(value);          
          props.tabsOnChange(value);
        }}
        scrollButtons="auto"
        textColor="inherit"
        indicatorColor="primary"
        aria-label="secondary tabs example"
      >
        {props.tabs.map((tab => (
          <Tab 
            value={tab.value}
            label={tab.label}
            icon={tab.icon}
            iconPosition="end"
            style={{ margin: '5px'}}
          />
        )))}
      </Tabs>
    </div>
  )
}

export default TableTabs;
