import React from 'react';

import { FaLongArrowAltUp, FaLongArrowAltDown } from "react-icons/fa";

type Props = {
  percent: number
  positive: boolean
};

const defaultProps = {
  positive: true
};

const ArrowPercent = (props: Props) => {
  const style = {
    display: 'flex',
    alignItems: 'center',
    color: 'rgb(52,195,143)',
  }
  const { percent, positive } = props;
  const ArrowIcon = positive ? FaLongArrowAltUp : FaLongArrowAltDown;
  style.color = positive ? 'rgb(52,195,143)' : 'rgb(226, 66, 66)';

  return(
    <p style={style}>
      {percent}% <ArrowIcon />
    </p>
  );
};

ArrowPercent.defaultProps = defaultProps;

export default ArrowPercent;
