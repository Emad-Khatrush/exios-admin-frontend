import { Alert, InputAdornment, OutlinedInput, Snackbar } from '@mui/material';
import { ArrowLeft, DollarSign, Loader2, Plane, Ship } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { ExchangeRate, ShipmentPrice } from '../../models';
import './SettingsCommon.scss';
import './ServicesPrice.scss';

type Props = {}

// Each route maps to a shipmentPrices entry; `name` is the key sent to the API.
const routes = [
  { name: 'china-air', country: 'china', type: 'air', label: 'China' },
  { name: 'china-sea', country: 'china', type: 'sea', label: 'China' },
  { name: 'uae-air', country: 'uae', type: 'air', label: 'UAE' },
  { name: 'usa-air', country: 'usa', type: 'air', label: 'USA' },
  { name: 'uk-air', country: 'uk', type: 'air', label: 'UK' },
  { name: 'turkey-air', country: 'turkey', type: 'air', label: 'Turkey' },
];

const ServicesPrice = (props: Props) => {
  const [prices, setPrices] = useState<ShipmentPrice[] | any>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | any>();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: 'success'});
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    Promise.all([getPrices(), getExchangeRate()])
      .catch((error) => console.log(error))
      .finally(() => setIsLoading(false));
  }, [])

  const getPrices = async () => {
    const prices = await api.get('shipmentPrices');
    setPrices(prices.data);
  }

  const getExchangeRate = async () => {
    const res = await api.get('exchangeRate');
    setExchangeRate(res.data);
  }

  const updatePrices = async () => {
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

  const getDefault = (country: string, type: string, field: "sellingPrice" | "priceDescription") =>
    prices.find((p: any) => p.country === country && p.shippingType === type)?.[field] || "";

  const pageHeader = (
    <>
      <Link to="/settings" className="settings-page__back"><ArrowLeft size={15} /> Back to Settings</Link>
      <div className="settings-page__header">
        <div className="settings-page__title">
          <span className="settings-page__icon"><DollarSign size={20} strokeWidth={2} /></span>
          <div>
            <h1>Pricing</h1>
            <p>Exchange rate and the selling price for each shipping route.</p>
          </div>
        </div>
      </div>
    </>
  );

  if (isLoading || !exchangeRate) {
    return (
      <div className="settings-page services-price" aria-busy="true">
        {pageHeader}
        <section className="settings-panel">
          <div className="settings-panel__body">
            <div className="settings-skeleton sp-skeleton-rate" />
            <div className="sp-routes">
              {routes.map((route) => <div key={route.name} className="settings-skeleton sp-skeleton-route" />)}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-page services-price">
      {pageHeader}

      <section className="settings-panel">
      <div className="settings-panel__body">
        <div className="sp-rate">
          <div>
            <p className="sp-rate__label">USD to LYD exchange rate</p>
            <p className="sp-rate__hint">Used to convert USD prices for customers paying in dinar.</p>
          </div>
          <div className="settings-field sp-rate__field">
            <label htmlFor="exchange-rate">Rate</label>
            <OutlinedInput
              id="exchange-rate"
              type="number"
              size="small"
              inputProps={{ step: '0.01', min: 0 }}
              startAdornment={<InputAdornment position="start">1 USD =</InputAdornment>}
              endAdornment={<InputAdornment position="end">LYD</InputAdornment>}
              defaultValue={exchangeRate.rate}
              onChange={({ target }) => setExchangeRate((prev: any) => ({ ...prev, rate: Number(target.value) }))}
            />
          </div>
        </div>

        <div className="sp-routes">
          {routes.map((route) => {
            const Icon = route.type === 'sea' ? Ship : Plane;
            return (
              <div key={route.name} className="sp-route">
                <div className="sp-route__head">
                  <span className="sp-route__icon"><Icon size={16} strokeWidth={2} /></span>
                  <span className="sp-route__name">{route.label}</span>
                  <span className="sp-route__type">{route.type === 'sea' ? 'Sea' : 'Air'}</span>
                </div>

                <div className="settings-field">
                  <label htmlFor={`${route.name}-price`}>Selling price</label>
                  <OutlinedInput
                    id={`${route.name}-price`}
                    name={route.name}
                    type="number"
                    size="small"
                    inputProps={{ step: '0.01', min: 0 }}
                    startAdornment={<InputAdornment position="start">$</InputAdornment>}
                    defaultValue={getDefault(route.country, route.type, "sellingPrice")}
                    onChange={onPriceChange}
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor={`${route.name}-description`}>Description</label>
                  <OutlinedInput
                    id={`${route.name}-description`}
                    name={route.name}
                    multiline
                    minRows={3}
                    placeholder="Shown to customers next to the price"
                    defaultValue={getDefault(route.country, route.type, "priceDescription")}
                    onChange={onDescriptionChange}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="settings-panel__foot">
        <p className="settings-panel__hint">Saving updates the exchange rate and every route at once.</p>
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          disabled={isUpdating}
          onClick={updatePrices}
        >
          {isUpdating && <Loader2 size={15} className="settings-spin" />}
          {isUpdating ? 'Saving' : 'Save pricing'}
        </button>
      </div>
      </section>

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
  )
}

export default ServicesPrice;
