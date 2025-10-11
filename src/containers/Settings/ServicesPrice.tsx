import { Alert, Backdrop, CircularProgress, FormControl, InputAdornment, InputLabel, OutlinedInput, Snackbar, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../../api';
import CustomButton from '../../components/CustomButton/CustomButton';
import { ExchangeRate, ShipmentPrice } from '../../models';
import './ServicesPrice.scss';

type Props = {}

const ServicesPrice = (props: Props) => {
  const [prices, setPrices] = useState<ShipmentPrice[] | any>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | any>();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: 'success'});
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    setIsLoading(true);
    getPrices();
    getExchangeRate();
    setIsLoading(false);
  }, [])

  const getPrices = async () => {
    const prices = await api.get('shipmentPrices');
    setPrices(prices.data);
  }

  const getExchangeRate = async () => {
    const res = await api.get('exchangeRate');
    setExchangeRate(res.data);
  }

  const updatePrices = async (event: MouseEvent) => {
    event.preventDefault();
    try {
      setIsUpdating(true);
      await api.update('shipmentPrices', form);  // now includes both sellingPrice + priceDescription
      await updateExchangeRate();
      setAlert({
        message: 'Prices and descriptions updated successfully',
        type: 'success'
      })
    } catch (error: any) {
      console.log(error);
      setAlert({
        message: error.data?.message || "Error updating",
        type: 'error'
      })
    } finally {
      setIsUpdating(false);
    }
  }

  const updateExchangeRate = async () => {
    try {      
      await api.update('exchangeRate', { exchangeRate });
    } catch (error: any) {
      console.log(error);
      setAlert({
        message: error.data?.message || "Error updating exchange rate",
        type: 'error'
      })
    }
  }

  const onPriceChange = ({ target }: any) => {
    setForm((prevState: any) => ({ 
      ...prevState, 
      [target.name]: { 
        ...prevState[target.name], 
        sellingPrice: Number(target.value) 
      }
    }));
  }

  const onDescriptionChange = ({ target }: any) => {
    setForm((prevState: any) => ({ 
      ...prevState, 
      [target.name]: { 
        ...prevState[target.name], 
        priceDescription: target.value 
      }
    }));
  }

  if (isLoading || !exchangeRate) {
    return <CircularProgress />
  }
  
  const getDefault = (country: string, type: string, field: "sellingPrice" | "priceDescription") =>
    prices.find((p: any) => p.country === country && p.shippingType === type)?.[field] || "";

  return (
    <div className="col-md-12 services-price">
      <div className="row">
        <p className='title'> USD To LYD Exchange Rate </p>
        <div className="col-md-12 mb-4">
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Rate</InputLabel>
            <OutlinedInput
              startAdornment={<InputAdornment position="start">LYD</InputAdornment>}
              defaultValue={exchangeRate.rate}
              onChange={({ target }) => setExchangeRate((prev: any) => ({ ...prev, rate: Number(target.value) }))}
            />
          </FormControl>
        </div>

        {/* China Air */}
        <div className="col-md-3 mb-4">
          <p className='title'>China Air</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='china-air'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("china", "air", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="china-air"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("china", "air", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        {/* China Sea */}
        <div className="col-md-3 mb-4">
          <p className='title'>China Sea</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='china-sea'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("china", "sea", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="china-sea"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("china", "sea", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        {/* UAE Air */}
        <div className="col-md-3 mb-4">
          <p className='title'>UAE Air</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='uae-air'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("uae", "air", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="uae-air"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("uae", "air", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        {/* USA Air */}
        <div className="col-md-3 mb-4">
          <p className='title'>USA Air</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='usa-air'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("usa", "air", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="usa-air"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("usa", "air", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        {/* UK Air */}
        <div className="col-md-3 mb-4">
          <p className='title'>UK Air</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='uk-air'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("uk", "air", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="uk-air"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("uk", "air", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        {/* Turkey Air */}
        <div className="col-md-3 mb-4">
          <p className='title'>Turkey Air</p>
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel>Price</InputLabel>
            <OutlinedInput
              name='turkey-air'
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              defaultValue={getDefault("turkey", "air", "sellingPrice")}
              onChange={onPriceChange}
            />
          </FormControl>
          <TextField
            name="turkey-air"
            label="Description"
            fullWidth
            multiline
            rows={3}
            defaultValue={getDefault("turkey", "air", "priceDescription")}
            onChange={onDescriptionChange}
          />
        </div>

        <div className="col-md-12 mb-2 text-end">
          <CustomButton 
            background='rgb(0, 171, 85)' 
            size="small"
            onClick={updatePrices}
          >
            Update Prices & Descriptions
          </CustomButton>
        </div>

        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={isUpdating}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar 
          open={!!alert.message} 
          autoHideDuration={5000}
          onClose={() => setAlert({ message: '', type: 'success' })}
        >
          <Alert 
            severity={alert.type as any}
            onClose={() => setAlert({ message: '', type: 'success' })}
          >
            {alert.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  )
}

export default ServicesPrice;
