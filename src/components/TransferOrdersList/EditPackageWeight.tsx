import { Alert, Backdrop, CircularProgress, DialogContent, FormControl, InputLabel, MenuItem, Select, Snackbar, TextField } from '@mui/material';
import React from 'react'
import CustomButton from '../CustomButton/CustomButton';
import api from '../../api';

type Props = {
  package: any
}

const EditPackageWeight = (props: Props) => {
  const [ isLoading, setLoading ] = React.useState(false);
  const [ deliveredPackages, setDeliveredPackages ] = React.useState(props.package.paymentList.deliveredPackages);
  const [ isSucceed, setIsSucceed ] = React.useState<boolean>(false);
  const [ showResponseMessage, setShowResponseMessage ] = React.useState<String | undefined>();

  const updatePackage = async (event: any) => {
    event.preventDefault();

    try {
      setLoading(true);
      await api.update(`order/${props.package._id}/package`, { ...props.package, paymentList: { ...props.package.paymentList, deliveredPackages } })
      setShowResponseMessage('Package data updated successfully');
      setIsSucceed(true);
    } catch (error: any) {
      console.log(error);
      setShowResponseMessage(error.response.data.message);
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div>
      <DialogContent>
        <form
          onSubmit={(event: any) => updatePackage(event)}
        >
          <h5 className='mb-3'> Update Weight </h5>
          <div className="row">
            <div className="col-md-6 mb-4 d-flex">
              <TextField
                id={deliveredPackages._id}
                label={'Tracking number'}
                name="trackingNumber"
                onChange={(event: any) => {
                  setDeliveredPackages({
                    ...deliveredPackages,
                    trackingNumber: event.target.value
                  })
                }}
                defaultValue={deliveredPackages?.trackingNumber}
                onWheel={(event: any) => event.target.blur()}
              />
            </div>

            <div className="d-flex col-md-6 mb-4">
              <TextField
                id={deliveredPackages._id}
                className='connect-field-right'
                name="packageWeight"
                type={'number'}
                inputProps={{ inputMode: 'numeric', step: .01 }}
                label={'Weight'}
                onChange={(event: any) => {
                  setDeliveredPackages({
                    ...deliveredPackages,
                    weight: {
                      ...deliveredPackages.weight,
                      total: Number(event.target.value)
                    }
                  })
                }}
                defaultValue={deliveredPackages?.weight?.total}
                onWheel={(event: any) => event.target.blur()}
              />
              <FormControl style={{ width: '100%' }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  className='connect-field-left'
                  defaultValue={deliveredPackages?.weight?.measureUnit}
                  label={'Unit'}
                  name="measureUnit"
                  onChange={(event: any) => {
                    setDeliveredPackages({
                      ...deliveredPackages,
                      weight: {
                        ...deliveredPackages.weight,
                        measureUnit: event.target.value
                      }
                    })
                  }}
                >
                  <MenuItem id={deliveredPackages._id} value={'KG'}>
                    <em> KG </em>
                  </MenuItem>
                  <MenuItem id={deliveredPackages._id} value={'CBM'}>
                    <em> CBM </em>
                  </MenuItem>
                </Select>
              </FormControl>
            </div>

            <div className="col-md-6 mb-4 d-flex">
              <TextField
                id={deliveredPackages._id}
                label={'Exios Price'}
                name="exiosPrice"
                type={'number'}
                inputProps={{ inputMode: 'numeric', step: .01 }}
                onChange={(event: any) => {
                  setDeliveredPackages({
                    ...deliveredPackages,
                    exiosPrice: Number(event.target.value)
                  })
                }}
                defaultValue={deliveredPackages?.exiosPrice}
                onWheel={(event: any) => event.target.blur()}
              />
            </div>

            <div className="col-md-6 mb-4 d-flex">
              <TextField
                id={deliveredPackages._id}
                label={'Original Price'}
                name="originPrice"
                type={'number'}
                inputProps={{ inputMode: 'numeric', step: .01 }}
                onChange={(event: any) => {
                  setDeliveredPackages({
                    ...deliveredPackages,
                    originPrice: Number(event.target.value)
                  })
                }}
                defaultValue={deliveredPackages?.originPrice}
                onWheel={(event: any) => event.target.blur()}
              />
            </div>

            <div className="col-md-6 mb-4 d-flex">
              <TextField
                id={deliveredPackages.id}
                label={'Placed At'}
                name="locationPlace"
                onChange={(event: any) => {
                  setDeliveredPackages({
                    ...deliveredPackages,
                    locationPlace: event.target.value
                  })
                }}                
                defaultValue={deliveredPackages?.locationPlace}
                onWheel={(event: any) => event.target.blur()}
              />
            </div>

            <div className="col-md-12 mb-4 text-end">
              <CustomButton 
                background='rgb(0, 171, 85)' 
                size="small"
                disabled={isLoading}
              >
                Update
              </CustomButton>
            </div>
          </div>
        </form>
      </DialogContent>

      <Snackbar 
        open={!!showResponseMessage}
        autoHideDuration={6000}
        onClose={() => setShowResponseMessage(undefined)}
      >
        <Alert 
          severity={isSucceed ? 'success' : 'error'}
          sx={{ width: '100%' }}
          onClose={() => setShowResponseMessage(undefined)}
        >
          {showResponseMessage}
        </Alert>
      </Snackbar>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
        open={isLoading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  )
}

export default EditPackageWeight;