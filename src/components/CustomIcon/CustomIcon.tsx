import React from 'react';

import './CustomIcon.scss';

type Props = {
  icon: any
};

const CustomIcon = (props: Props) => {
  return(
    <div className='circle'>
      {props.icon}
    </div>
  );
};

export default CustomIcon;
