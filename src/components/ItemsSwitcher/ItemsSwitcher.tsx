import React, { useState } from 'react';
import { Switch, Box, Typography } from '@mui/material';

type Props = {
  leftLabel: string,
  rightLabel: string,
  handleChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  checked: boolean
}

const PaymentShipmentSwitcher: React.FC<Props> = (props) => {
  const [localChecked, setChecked] = useState(false);
  const { checked } = props;

  React.useEffect(() => {
    setChecked(checked);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
      {/* Left label (Shipment) */}
      <Typography
        variant="body1"
        sx={{ fontWeight: !localChecked ? 'bold' : 'normal', color: !localChecked ? 'primary.main' : 'text.secondary' }}
      >
        {props.leftLabel}
      </Typography>

      {/* Switch */}
      <Switch
        id='newSwitcher'
        name={localChecked ? 'isPayment' : 'isShipment'}
        checked={localChecked}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          props.handleChange && props.handleChange(event);
          handleChange(event);
        }}
        color="primary"
      />

      {/* Right label (Payment) */}
      <Typography
        variant="body1"
        sx={{ fontWeight: localChecked ? 'bold' : 'normal', color: localChecked ? 'primary.main' : 'text.secondary' }}
      >
        {props.rightLabel}
      </Typography>
    </Box>
  );
};

export default PaymentShipmentSwitcher;

