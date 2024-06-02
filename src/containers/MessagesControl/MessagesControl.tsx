import { Alert, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import React, { useState } from 'react'
import CustomButton from '../../components/CustomButton/CustomButton';
import api from '../../api';

type Props = {}

const MessagesControl = (props: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const [alert, setAlert] = useState<any>({
    message: '',
    type: 'success'
  });

  const handleChange = (event: any) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  const onSubmit = async (event: any, testMode: boolean = false) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      await api.post(`sendMessagesToClients`, { imgUrl: form?.imgUrl, content: form?.content, target: form?.target, testMode });
      setAlert({
        message: 'تم ارسال الرسائل بنجاح',
        type: 'success'
      })
    } catch (error: any) {
      setAlert({
        message: error.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : error.response.data.message,
        type: 'error'
      })
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="m-4 edit-invoice">
      <div style={{ maxWidth: '1400px', margin: 'auto'}}>
        {alert?.message &&
          <Alert color={alert.type}>
            {alert.message}
          </Alert>
        }
        <div className="col-12 mb-3">
          <h4 className='mb-3'>Send Whatsup Messages To Clients</h4>
          <form onSubmit={onSubmit}>
            <TextField
              id={'outlined-helperText'}
              label={'Image Url'}
              name="imgUrl"
              onChange={handleChange}
              disabled={isLoading}
            />

            <textarea
              rows={5}
              placeholder='Content' 
              className='form-control my-3' 
              name={'content'} 
              onChange={handleChange}
              disabled={isLoading}
              style={{
                direction: 'rtl'
              }}
            />

            <FormControl className='mb-3' style={{ width: '100%' }} required>
              <InputLabel id="demo-select-small">Target</InputLabel>
              <Select
                labelId={'Target'}
                id={'Target'}
                label={'Target'}
                name="target"
                onChange={(event) => {
                  return handleChange(event);
                }}
                disabled={isLoading}
              >
                <MenuItem value={'allUsers'}>
                  <em> ارسال الى جميع زبائن المسجلين </em>
                </MenuItem>
                <MenuItem value={'onlyNewClients'}>
                  <em> الى الزبائن الجدد فقط الذين </em>
                </MenuItem>
              </Select>
            </FormControl>

            <CustomButton 
              background='rgb(0, 171, 85)' 
              size="small"
              disabled={isLoading}
            >
              Send Messages
            </CustomButton>
          </form>

          <CustomButton
            className='mt-3'
            background='rgb(0, 88, 171)' 
            size="small"
            disabled={isLoading}
            onClick={(event: any) => onSubmit(event, true)}
          >
            Send Test Message
          </CustomButton>
        </div>
      </div>
    </div>
  )
}

export default MessagesControl;
