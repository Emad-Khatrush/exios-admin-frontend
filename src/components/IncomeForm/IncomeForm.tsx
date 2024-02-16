import { useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';

import './IncomeForm.scss';

type Props = {
  handleChange?: any
  isEmployee?: boolean
}

const IncomeForm = (props: Props) => {
  const [ office, setOffice ] = useState('');
  const [ currency, setCurrency ] = useState('');

  const offices = [
    {
      label: 'Tripoli',
      value: 'tripoli'
    }
  ]

  if (!props.isEmployee) {
    offices.push(...[
      {
        label: 'Benghazi',
        value: 'benghazi'
      },
      {
        label: 'Turkey',
        value: 'turkey'
      }
    ])
  }

  return (
    <div className='row income-page'>
      <div className="col-md-12 mb-3">
        <h4> Income Details </h4>
      </div>

        {/* Income Info */}
        <div className="col-md-12">
          <p className='title'> Income Info </p>
        </div>

        <div className="col-md-8 mb-4">
          <TextField
            id={'outlined-helperText'}
            name="description"
            required={true}
            label={'Description'}
            onChange={props.handleChange}
          />
        </div>

        <div className="d-flex col-md-4 mb-4">
          <TextField
            className='connect-field-right'
            id={'outlined-helperText'}
            name="cost"
            type={'number'}
            inputProps={{ inputMode: 'numeric' }}
            required={true}
            label={'Cost'}
            onChange={props.handleChange}
          />
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Currency</InputLabel>
            <Select
              className='connect-field-left'
              labelId={'currency'}
              id={'currency'}
              value={currency}
              label={'Currency'}
              name="currency"
              onChange={(event) => {
                setCurrency(event.target.value);
                return props.handleChange(event);
              }}
            >
              <MenuItem value={'USD'}>
                <em> USD </em>
              </MenuItem>
              <MenuItem value={'LYD'}>
                <em> LYD </em>
              </MenuItem>
              <MenuItem value={'TRY'}>
                <em> TRY </em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="col-md-12 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Select Office</InputLabel>
            <Select
              labelId={'Select Office'}
              id={'Select Office'}
              value={office}
              label={'Select Office'}
              name="office"
              onChange={(event) => {
                setOffice(event.target.value);
                return props.handleChange(event);
              }}
            >
              {offices.map(office => (
                <MenuItem key={office.value} value={office.value}>
                  <em> {office.label} Office </em>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>  
    </div>
  )
}

export default IncomeForm;
