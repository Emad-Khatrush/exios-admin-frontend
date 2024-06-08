import { Textarea } from '@mui/joy';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Alert, Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import React, { useState } from 'react'
import api from '../../api';
import { useParams } from 'react-router-dom';

type Props = {}

const AddBalanceToWallet = (props: Props) => {
  const { id } = useParams();

  const [currency, setCurrency] = useState();
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<any>({
    createdAt: date
  });
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = async (event: any) => {
    event.preventDefault();
    setError('')

    if (!form) {
      return;
    }
    if (form?.amount <= 0) {
      setError('لا يمكن اضافة 0 رصيد الى محفظة يرجى التاكد من المعلومات التي تم كتابتها')
      return;
    }

    const description = `تم اضافة رصيد الى المحفظة بقيمة ${form?.amount + form?.currency}`;
    
    try {
      setIsLoading(true);
      await api.post(`wallet/${id}`, { ...form, description })
      window.location.reload();
    } catch (error: any) {
      setError(error.response.data.message);
      setIsLoading(false);
    }
  }
  
  return (
    <>
      <DialogTitle>Add balance to wallet</DialogTitle>
      <DialogContent>
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <form className="row" onSubmit={onSubmit}>
          <h6 className="mb-3">Wallet</h6>
          <div className='col-md-6 mb-3'>
            <LocalizationProvider required dateAdapter={AdapterDateFns}>
              <Stack spacing={3}>
                <DatePicker
                  value={date}
                  label="Received Payment Date"
                  inputFormat="dd/MM/yyyy"
                  renderInput={(params: any) => <TextField {...params} /> }                    
                  onChange={(value: any) => {
                    setDate(value);
                    onChangeHandler({ target: { value, name: 'createdAt' }});
                  }}
                />
              </Stack>
            </LocalizationProvider>
          </div>

          <div className="d-flex col-md-6 mb-2">
            <TextField
              className='connect-field-right'
              id={'outlined-helperText'}
              name="amount"
              type={'number'}
              inputProps={{ inputMode: 'numeric', step: .01 }}
              required={true}
              label={'Amount'}
              onChange={onChangeHandler}
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
                onChange={(event: any) => {
                  setCurrency(event.target.value);
                  return onChangeHandler(event);
                }}
              >
                <MenuItem value={'USD'}>
                  <em> USD </em>
                </MenuItem>
                <MenuItem value={'LYD'}>
                  <em> LYD </em>
                </MenuItem>
              </Select>
            </FormControl>
          </div>

          <Box
            sx={{
              py: 2,
              display: 'grid',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Textarea
              name='note'
              placeholder="قم بكتابة سبب اضافة الرصيد"
              color="neutral"
              minRows={3}
              variant="outlined"
              onChange={onChangeHandler}
              required
            />
          </Box>

          <DialogActions>
            <Button disabled={isLoading} type="submit" >Create Balance</Button>
            {isLoading &&
              <CircularProgress />
            }
          </DialogActions>

        </form>
      </DialogContent>
    </>
  )
}

export default AddBalanceToWallet;
