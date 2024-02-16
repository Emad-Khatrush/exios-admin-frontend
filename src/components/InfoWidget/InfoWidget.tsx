import React, { Component } from 'react';
import Card from '../Card/Card';
import CustomIcon from '../CustomIcon/CustomIcon';

import './InfoWidget.scss';

type Props = {
  title: string
  value: any
  icon: any
};

type State = {};

class InfoWidget extends Component<Props, State> {

  render() {
    const { title, value, icon } = this.props;

    return( 
      <Card>
        <div className="d-flex justify-content-between align-items-center info-widget">
          <div className=''>
           <h5 style={{ color: '#74788d'}} className='mb-2'> {title} </h5>
           {typeof value === 'string' && <p className='fst-normal fs-5 mb-0'> {value} </p>}
           {value?.american && <p className='mb-0'> {value?.american?.total + ' ' + value?.american?.currency} </p>}
           {value?.libya && <p className='mb-0'> {value?.libya?.total + ' ' + value?.libya?.currency} </p>}
           {value?.turkish && <p className='mb-0'> {value?.turkish?.total + ' ' + value?.turkish?.currency} </p>}
          </div>
          <CustomIcon icon={icon} />
        </div>
      </Card>
    );
  }
}
export default InfoWidget;
