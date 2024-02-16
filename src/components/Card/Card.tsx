import { MenuItem, Select } from '@mui/material';
import React from 'react';
import { AiOutlineSearch } from 'react-icons/ai';
import TableTabs from '../TableTabs/TableTabs';
import TextInput from '../TextInput/TextInput';

import './Card.scss';

const Card = (props: any) => {
  return (
    <div>
      {props.tabs &&
        <TableTabs
          tabs={props.tabs}
          tabsOnChange={(value: string) => props.tabsOnChange(value)}
        />
      }
      <div 
        {...props} 
        style={{...props.style, overflow: 'auto', boxShadow: '0 0.3rem 0.9rem rgba(0, 0, 0, 0.075)'}} 
        className={`mb-3 bg-body rounded ${props.leand ? '' : 'p-3'}`}
      >
        <div>
          {props.showSearchInput &&
            <div className='d-flex'>
              <TextInput
                name="searchValue"
                className={props.selectValues && 'connect-field-right'}
                placeholder={props.inputPlaceholder}
                icon={<AiOutlineSearch />}
                onChange={(event: React.MouseEvent) => props.searchInputOnChange(event)}
              />
              {props.selectValues &&
                <Select
                  name='selectorValue'
                  onChange={(event: any) => props.selectorInputOnChange(event)}
                  label="Type"
                  defaultValue={props.selectValues[0].value}
                  className="connect-field-left"
                >
                  {props.selectValues.map((selector: { label: string, value: string }) => (
                    <MenuItem value={selector.value}>
                      {selector.label}
                    </MenuItem>
                  ))}
                </Select>
              }
            </div>
          }
        </div>
        <div 
          className='custom-card-body' 
          style={props.bodyStyle}
          onScroll={props.onScroll}
        >
          {props.children}
        </div>
      </div>
    </div>
  )
};

export default Card;
