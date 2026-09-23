import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, Search, UserRound } from 'lucide-react';
import moment from 'moment';
import api from '../../api';
import { SpecialPrices, getCategories } from '../../utils/specialPrices';
import './SpecialPriceCustomers.scss';

type SpecialCustomer = {
  _id: string
  firstName: string
  lastName: string
  customerId: string
  phone?: string | number
  city?: string
  specialPrices: SpecialPrices
};

const formatPrice = (price?: number) => (price ? `$${price}` : '-');

const SpecialPriceCustomers = () => {
  const [customers, setCustomers] = useState<SpecialCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('specialPriceCustomers')
      .then((res: any) => setCustomers(res.data.results || []))
      .catch((err: any) => setError(err?.response?.data?.message || 'Could not load the customers'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(customer =>
      [customer.firstName, customer.lastName, customer.customerId, customer.phone]
        .some(value => String(value ?? '').toLowerCase().includes(term))
    );
  }, [customers, search]);

  return (
    <div className="special-customers m-4">
      <header className="spc-header">
        <div>
          <h1>Special price customers</h1>
          <p>Customers with their own Exios prices. Open a customer to change them.</p>
        </div>
        <label className="spc-search">
          <Search size={16} strokeWidth={2} />
          <input
            type="search"
            placeholder="Search name, code or phone"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
      </header>

      {isLoading ? (
        <div className="spc-list" aria-busy="true" aria-label="Loading customers">
          {[0, 1, 2].map(i => <div key={i} className="spc-skeleton" />)}
        </div>
      ) : error ? (
        <p className="spc-error" role="alert">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="spc-empty">
          <BadgePercent size={32} strokeWidth={1.5} />
          <h3>{customers.length === 0 ? 'No special price customers yet' : 'No customer matches your search'}</h3>
          <p>
            {customers.length === 0
              ? 'Open a customer, go to the Special Prices tab, and turn special prices on.'
              : 'Try another name, customer code or phone number.'}
          </p>
        </div>
      ) : (
        <div className="spc-list">
          <p className="spc-count">{filtered.length} customer{filtered.length === 1 ? '' : 's'}</p>
          {filtered.map(customer => (
            <Link key={customer._id} to={`/user/${customer._id}`} className="spc-card">
              <div className="spc-customer">
                <span className="spc-avatar"><UserRound size={18} strokeWidth={2} /></span>
                <div>
                  <strong>{customer.firstName} {customer.lastName}</strong>
                  <span>{[customer.customerId, customer.phone, customer.city].filter(Boolean).join(' / ')}</span>
                </div>
              </div>

              <table className="spc-prices">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Air / KG</th>
                    <th scope="col">Sea / CBM</th>
                  </tr>
                </thead>
                <tbody>
                  {getCategories(customer.specialPrices).map((category, index) => (
                    <tr key={`${category.name}-${index}`}>
                      <th scope="row">{category.name}</th>
                      <td>{formatPrice(category.air)}</td>
                      <td>{formatPrice(category.sea)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="spc-meta">
                {customer.specialPrices?.note && <p>{customer.specialPrices.note}</p>}
                <span>
                  {customer.specialPrices?.updatedAt ? `Updated ${moment(customer.specialPrices.updatedAt).format('DD/MM/YYYY')}` : ''}
                  {customer.specialPrices?.updatedBy?.firstName ? ` by ${customer.specialPrices.updatedBy.firstName}` : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpecialPriceCustomers;
