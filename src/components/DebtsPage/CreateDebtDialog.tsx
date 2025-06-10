import { Textarea } from "@mui/joy";
import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useState } from "react";
import api from "../../api";
import { getErrorMessage } from "../../utils/errorHandler";

type Props = {
  setDialog: (state: any) => void
  orderId?: string
  customerId?: string
  debtType?: string
}

const CreateDebtDialog = (props: Props) => {
  const [currency, setCurrency] = useState();
  const [office] = useState();
  const [debtType, setDebtType] = useState(props.debtType);
  const [form, setForm] = useState<any>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onChangeHandler = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = async (event: any) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      await api.post('balances', { ...form, balanceType: 'debt', orderId: props.orderId || form.orderId, customerId: props.customerId || form.customerId });
      window.location.reload();
    } catch (error: any) {
      setError(error.response.data.message)
      setIsLoading(false);
    }
  }
  
  return (
    <>
      <DialogTitle>Create New Debt</DialogTitle>
        <DialogContent>
          {error &&
            <p style={{ color: '#fa2d2d' }}>{getErrorMessage(error as any)}</p>
          }
          <form className="row" onSubmit={onSubmit}>
            <h6>Info</h6>
            <div className='col-md-6'>
              <TextField
                className='mb-3'
                id={'outlined-helperText'}
                name="orderId"
                label={'Order Id'}
                onChange={onChangeHandler}
                value={props.orderId}
                disabled={!!props.orderId}
              />
            </div>

            <div className='col-md-6'>
              <TextField
                className='mb-3'
                id={'outlined-helperText'}
                name="customerId"
                label={'Customer Id'}
                required
                onChange={onChangeHandler}
                value={props.customerId}
                disabled={!!props.customerId}
              />
            </div>

            <div className="d-flex col-md-6 mb-4">
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

            <div className="d-flex col-md-6 mb-4">
              <FormControl style={{ width: '100%' }} required>
                <InputLabel id="demo-select-small">Select Office</InputLabel>
                <Select
                  labelId={'Select Office'}
                  id={'Select Office'}
                  defaultValue={office}
                  label={'Select Office'}
                  name="createdOffice"
                  onChange={(event: any) => {
                    setCurrency(event.target.value);
                    return onChangeHandler(event);
                  }}
                >
                  <MenuItem value={'tripoli'}>
                    <em> Tripoli Office </em>
                  </MenuItem>
                  <MenuItem value={'benghazi'}>
                    <em> Benghazi Office </em>
                  </MenuItem>
                </Select>
              </FormControl>
            </div>

            <div className="d-flex col-md-12 mb-4">
              <FormControl style={{ width: '100%' }} required>
                <InputLabel id="demo-select-small">اختار نوع الدين</InputLabel>
                <Select
                  labelId={'debtType'}
                  id={'debtType'}
                  defaultValue={debtType}
                  label={'Debt Type'}
                  name="debtType"
                  onChange={(event: any) => {
                    setDebtType(event.target.value);
                    return onChangeHandler(event);
                  }}
                >
                  <MenuItem value={'invoice'}>
                    <em> دين لاجل تسديد فاتورة شراء </em>
                  </MenuItem>
                  <MenuItem value={'receivedGoods'}>
                    <em> دين لاجل تسديد شحن </em>
                  </MenuItem>
                  <MenuItem value={'general'}>
                    <em> دين عام لا يتعلق بطلبية </em>
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
                name='notes'
                placeholder='Notes'
                color="neutral"
                minRows={3}
                variant="outlined"
                required
                onChange={onChangeHandler}
              />
            </Box>

            <DialogActions>
              <Button disabled={isLoading} color="error" onClick={() => props.setDialog({ customComponentTag: undefined, isOpen: false })} >Close</Button>
              <Button disabled={isLoading} type="submit" >Create Debt</Button>
              {isLoading &&
                <CircularProgress />
              }
            </DialogActions>
          </form>
        </DialogContent>
    </>
  )
}

export default CreateDebtDialog;
