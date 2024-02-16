import React from 'react'

import { CircularProgress } from '@mui/material';
import Card from '../Card/Card';
import './StatusDataWidget.scss';
import RoundedIcon from '../RoundedIcon/RoundedIcon';

type Props = {
  invoicesDetails: any[]
  isLoading: boolean
}

const StatusDataWidget = (props: Props) => {

  if (props.isLoading) {
    return(
      <Card style={{ textAlign: 'center' }}>
        <CircularProgress />
      </Card>
    )
  }
  
  return (
    <Card style={{overflow: 'auto'}}>
      <div className='d-flex align-items-center justify-content-between'>
        {props.invoicesDetails.map((invoice: any) =>{ 
          const Icon = invoice.icon;
          return (
            <div className='status-wrapper'>
              <RoundedIcon
                icon={Icon}
                borderColor={invoice.borderColor}
                color={invoice.color}
              />

              <div className='info'>
                <h6> {invoice.title} </h6>
                <p> {invoice.countInvoices} <span> invoice </span> </p>
                <p className='total' style={{color: invoice.color}}> ${invoice.total} </p>
              </div>
            </div>
        )})}
      </div>
    </Card>
  )
}

export default StatusDataWidget;
