import * as React from 'react';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import { MdStarRate } from 'react-icons/md';

type Props = {
  name?: string
  disbaled?: boolean
  onChange?: (value: number | null, event: any) => void
  value?: number
}

const labels: { [index: string]: string } = {
  0.5: 'سئ',
  1: 'سئ+',
  1.5: 'ضعيف',
  2: 'ضعيف+',
  2.5: 'متوسط',
  3: 'متوسط+',
  3.5: 'جيد',
  4: 'جيد+',
  4.5: 'ممتاز',
  5: 'ممتاز+',
};

function getLabelText(value: number) {
  return `${value} Star${value !== 1 ? 's' : ''}, ${labels[value]}`;
}

const RatingStars = (props: Props) => {
  const [value, setValue] = React.useState<number | null>(props.value || 0);
  const [hover, setHover] = React.useState(-1);

  return (
    <Box
      sx={{
        width: 200,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Rating
        name={props.name}
        value={value}
        precision={0.5}
        getLabelText={getLabelText}
        onChange={(e, newValue) => {
          setValue(newValue);
          props.onChange && props.onChange(newValue, e)
        }}
        onChangeActive={(_, newHover) => {
          setHover(newHover);
        }}
        emptyIcon={<MdStarRate style={{ opacity: 0.55 }} fontSize="inherit" />}
        disabled={props.disbaled}
      />
      {value !== null && (
        <Box sx={{ ml: 2 }}>{labels[hover !== -1 ? hover : value]}</Box>
      )}
    </Box>
  );
}

export default RatingStars;
