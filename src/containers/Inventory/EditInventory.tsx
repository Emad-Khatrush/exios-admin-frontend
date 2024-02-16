import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api";
import { Alert, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import ImageUploader from "../../components/ImageUploader/ImageUploader";
import React from "react";
import { Inventory } from "../../models";
import InventoryOrders from "./InventoryOrders";

const EditInventory = () => {
  const { id } = useParams();

  const [inventory, setInventory] = useState<Inventory | any>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  
  const filesRef = React.createRef();

  useEffect(() => {
    getInventory();
  }, [])

  const getInventory = async () => {
    setIsLoading(true);
    const res = await api.get(`inventory/${id}`);
    setInventory(res.data);
    setIsLoading(false);
  }

  const onChangeHandler = (event: any) => {
    setInventory({ ...inventory, [event.target.name]: event.target.value });
  }
  
  if (isLoading && !inventory) {
    return (
      <CircularProgress />
    )
  }
    
  return (
    <div className="container mt-4">
      <form className="row">
        {error &&
          <Alert className="mb-2" color="error">
            {error}
          </Alert>
        }
        <div className="col-md-12 mb-3 mt-3">
          <h4> Inventory ({inventory?.voyage}) </h4>
        </div>

        <div className="col-md-3 mb-4">
          <TextField
            id={'outlined-helperText'}
            name="voyage"
            required={true}
            label={'Voyage Number'}
            onChange={onChangeHandler}
            defaultValue={inventory?.voyage}
            disabled
          />
        </div>

        <div className="d-flex col-md-3 mb-4">
          <TextField
            className='connect-field-right'
            id={'outlined-helperText'}
            name="voyageAmount"
            type={'number'}
            inputProps={{ inputMode: 'numeric' }}
            label={'Voyage Amount'}
            required
            onChange={onChangeHandler}
            onWheel={(event: any) => event.target.blur()}
            defaultValue={inventory?.voyageAmount}
            disabled
          />
          <FormControl 
            required
            style={{ width: '100%' }}
          >
            <InputLabel id="demo-select-small">Currency</InputLabel>
            <Select
              className='connect-field-left'
              labelId={'currency'}
              id={'voyageCurrency'}
              defaultValue={inventory?.voyageCurrency}
              label={'Currency'}
              name="voyageCurrency"
              onChange={onChangeHandler}
              disabled
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

        <div className="col-md-3 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Shipped Country</InputLabel>
            <Select
              labelId={'Shipped Country'}
              id={'shippedCountry'}
              defaultValue={inventory?.shippedCountry}
              label={'Shipped Country'}
              name="shippedCountry"
              onChange={onChangeHandler}
              disabled
            >
              <MenuItem value={'CN'}>
                <em> China </em>
              </MenuItem>
              <MenuItem value={'UAE'}>
                <em> UAE </em>
              </MenuItem>
              <MenuItem value={'TR'}>
                <em> Turkey </em>
              </MenuItem>
              <MenuItem value={'USA'}>
                <em> USA </em>
              </MenuItem>
              <MenuItem value={'UK'}>
                <em> UK </em>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        <div className="col-md-4 mb-4">
          <FormControl style={{ width: '100%' }} required>
            <InputLabel id="demo-select-small">Inventory Place</InputLabel>
            <Select
              labelId={'Inventory Place'}
              id={'inventoryPlace'}
              defaultValue={inventory?.inventoryPlace}
              label={'Inventory Place'}
              name="inventoryPlace"
              onChange={onChangeHandler}
              disabled
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

        <div className="col-md-6 mb-4 d-flex">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={3}>
              <DatePicker
                label="Inventory Finished Date"
                inputFormat="dd/MM/yyyy"
                value={inventory?.inventoryFinishedDate}
                renderInput={(params: any) => <TextField {...params} />} 
                onChange={(value) => onChangeHandler({ target: { name: 'inventoryFinishedDate', value } })}
                disabled
              />
            </Stack>
          </LocalizationProvider>
        </div>

        <div className='col-md-4 mt-3'>
          <h6>Upload Files</h6>
          <ImageUploader
            id={'attachments'}
            inputFileRef={filesRef}
            previewFiles={inventory?.attachments || []}
            // fileUploaderHandler={fileUploaderHandler}
            // files={files}
            // deleteImage={deleteImage}
          />
        </div>
      </form>

      <hr />

      <InventoryOrders
        inventory={inventory}
      />
    </div>
  )
}

export default EditInventory;
