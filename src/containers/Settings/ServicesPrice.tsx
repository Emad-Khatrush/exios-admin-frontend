import { Alert, Backdrop, CircularProgress, FormControl, InputAdornment, InputLabel, OutlinedInput, Snackbar } from '@mui/material';
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
  const [form, setForm] = useState({});

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
      await api.update('shipmentPrices', form);
      await updateExchangeRate();
      setAlert({
        message: 'Prices has been changed',
        type: 'success'
      })
    } catch (error: any) {
      console.log(error);
      setAlert({
        message: error.data.message,
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
        message: error.data.message,
        type: 'error'
      })
    }
  }

  const onPriceChange = ({ target }: any) => {
    setForm(prevState => ({ ...prevState, [target.name]: Number(target.value) }));
  }

  if (isLoading || !exchangeRate) {
    return (
      <CircularProgress />
    )
  }
  
  return (
    <div className="col-md-12 services-price">
      <div className="row">
      <p className='title'> USD To LYD Exchange Rate </p>
        <div className="col-md-12 mb-4">
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel htmlFor="outlined-adornment-amount">Rate</InputLabel>
            <OutlinedInput
              name='china-air'
              id="outlined-adornment-amount"
              startAdornment={<InputAdornment position="start">LYD</InputAdornment>}
              label="Amount"
              defaultValue={exchangeRate.rate}
              onChange={({ target }) => setExchangeRate((prevState: any) => ({ ...prevState, rate: Number(target.value) }))}
            />
          </FormControl>
        </div>

        <p className='title'> China Shipping Prices </p>
        <div className="col-md-3 mb-4">
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel htmlFor="outlined-adornment-amount">China Air Price</InputLabel>
            <OutlinedInput
              name='china-air'
              id="outlined-adornment-amount"
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              label="Amount"
              defaultValue={prices.find((price: any) => price.country === 'china' && price.shippingType === 'air')?.sellingPrice}
              onChange={onPriceChange}
            />
          </FormControl>
        </div>

        <div className="col-md-3 mb-4">
          <FormControl fullWidth sx={{ m: 1 }}>
            <InputLabel htmlFor="outlined-adornment-amount">China Sea Price</InputLabel>
            <OutlinedInput
              name='china-sea'
              id="outlined-adornment-amount"
              startAdornment={<InputAdornment position="start">$</InputAdornment>}
              label="Amount"
              defaultValue={prices.find((price: any) => price.country === 'china' && price.shippingType === 'sea')?.sellingPrice}
              onChange={onPriceChange}
            />
          </FormControl>
        </div>

        <div className="row">
          <div className="col-md-3 mb-4">
            <p className='title'> UAE Shipping Prices </p>
            <FormControl fullWidth sx={{ m: 1 }}>
              <InputLabel htmlFor="outlined-adornment-amount">UAE Air Price</InputLabel>
              <OutlinedInput
                name='uae-air'
                id="outlined-adornment-amount"
                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                label="Amount"
                defaultValue={prices.find((price: any) => price.country === 'uae' && price.shippingType === 'air')?.sellingPrice}
                onChange={onPriceChange}
              />
            </FormControl>
          </div>

          <div className="col-md-3 mb-4">
            <p className='title'> USA Shipping Prices </p>
            <FormControl fullWidth sx={{ m: 1 }}>
              <InputLabel htmlFor="outlined-adornment-amount">USA Air Price</InputLabel>
              <OutlinedInput
                name='usa-air'
                id="outlined-adornment-amount"
                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                label="Amount"
                defaultValue={prices.find((price: any) => price.country === 'usa' && price.shippingType === 'air')?.sellingPrice}
                onChange={onPriceChange}
              />
            </FormControl>
          </div>
          
          <div className="col-md-3 mb-4">
            <p className='title'> UK Shipping Prices </p>
            <FormControl fullWidth sx={{ m: 1 }}>
              <InputLabel htmlFor="outlined-adornment-amount">UK Air Price</InputLabel>
              <OutlinedInput
                name='uk-air'
                id="outlined-adornment-amount"
                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                label="Amount"
                defaultValue={prices.find((price: any) => price.country === 'uk' && price.shippingType === 'air')?.sellingPrice}
                onChange={onPriceChange}
              />
            </FormControl>
          </div>

          <div className="col-md-3 mb-4">
            <p className='title'> Turkey Shipping Prices </p>
            <FormControl fullWidth sx={{ m: 1 }}>
              <InputLabel htmlFor="outlined-adornment-amount">Turkey Air Price</InputLabel>
              <OutlinedInput
                name='turkey-air'
                id="outlined-adornment-amount"
                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                label="Amount"
                defaultValue={prices.find((price: any) => price.country === 'turkey' && price.shippingType === 'air')?.sellingPrice}
                onChange={onPriceChange}
              />
            </FormControl>
          </div>
        </div>

        <div className="col-md-12 mb-2 text-end">
          <CustomButton 
            background='rgb(0, 171, 85)' 
            size="small"
            onClick={updatePrices}
          >
            Update Prices
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

export default ServicesPrice
