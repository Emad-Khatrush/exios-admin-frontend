import Textarea from "@mui/joy/Textarea";
import DatePicker from "@mui/lab/DatePicker";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import { Avatar, Box, Chip, FormControl, InputLabel, MenuItem, OutlinedInput, Select, TextField } from "@mui/material";
import { useState } from "react";
import { User } from "../../models";
import AdapterDateFns from '@mui/lab/AdapterDateFns';

type Props = {
  onChange: (event: any) => void
  employees: User[]
  task?: any
}

const TaskForm = (props: Props) => {
  const { onChange, task } = props;
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(new Date());
  const [reviewers, setReviewers] = useState(task?.reviewers)
  
  return (
    <div className="row">
      <h6>Info</h6>
        <div className='col-md-3'>
          <TextField
            className='mb-3'
            id={'outlined-helperText'}
            name="orderId"
            required={true}
            label={'Order Id'}
            onChange={onChange}
            defaultValue={task?.order?.orderId}
          />
        </div>

        <div className='col-md-3 mb-3'>
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Label</InputLabel>
            <Select
              labelId={'label'}
              id={'label'}
              defaultValue={task?.label}
              label={'Label'}
              name="label"
              onChange={(event: any) => {
                onChange(event);
                setLabel(event.target.value);
              }}
              // disabled={invoice?.isCanceled}
            >
              <MenuItem value={'urgent'}>
                <em> مستعجلة </em>
              </MenuItem>
              <MenuItem value={'limitedTime'}>
                <em> وقت معين </em>
              </MenuItem>
              <MenuItem value={'normal'}>
                <em> عادي</em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className='col-md-6'>
          <FormControl sx={{ width: '100%' }}>
            <InputLabel id="demo-multiple-chip-label">Task to</InputLabel>
            <Select
              labelId="demo-multiple-chip-label"
              id="demo-multiple-chip"
              name='reviewers'
              multiple
              required
              defaultValue={reviewers?.map((data: any) => data._id) || []}
              onChange={(event: any) => {
                onChange(event);
                // setReviewers(removeDuplicates(event.target.value))
                setReviewers(event.target.value)
              }}
              input={<OutlinedInput id="select-multiple-chip" label="Chip" />}
              renderValue={(employeeIds: any) => {
                return ( 
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(employeeIds || []).map((empId: any) => {
                      const employee = props.employees.find((emp: any) => emp._id === empId);
                      if (!employee) return;
                      
                      return(
                        <Chip 
                          key={employee._id} 
                          label={
                            <MenuItem value={employee._id}>
                              <Avatar sx={{ width: 30, height: 30, marginRight: '10px' }} alt={`${employee.firstName} ${employee.lastName}`} src={employee.imgUrl} />
                              <em className='ml-2'> {`${employee.firstName} ${employee.lastName}`} </em>
                            </MenuItem>
                          } 
                        />
                    )})}
                  </Box>
                )
              }}
            >
              {props.employees && (props.employees || []).map((employee: any) => (
                <MenuItem value={employee._id}>
                  <Avatar sx={{ width: 30, height: 30, marginRight: '10px' }} alt={`${employee.firstName} ${employee.lastName}`} src={employee.imgUrl} />
                  <em className='ml-2'> {`${employee.firstName} ${employee.lastName}`} </em>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        
        {(label === 'limitedTime' || task?.label === 'limitedTime') &&
          <div className="col-md-12 mb-3">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Limited Time"
                value={task?.limitedTime || date}
                onChange={(value: any) => {
                  if (value) {
                    setDate(value);
                    onChange({ target: { value, name: 'limitedTime' } });
                  }
                }}
                renderInput={(params) => <TextField {...params} />}
              />
            </LocalizationProvider>
          </div>
        }

        <div className="col-md-12">
          <h6>Content</h6>
          <TextField
            fullWidth
            id={'outlined-helperText'}
            name="title"
            required={true}
            label={'Title'}
            onChange={onChange}
            defaultValue={task?.title}
          />
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
              name='description'
              placeholder='Description'
              color="neutral"
              minRows={3}
              variant="outlined"
              onChange={onChange}
              defaultValue={task?.description}
            />
          </Box>
        </div>
    </div>
  )
}

const removeDuplicates = (data: any[]) => {
  return data.filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i)

}

export default TaskForm;
