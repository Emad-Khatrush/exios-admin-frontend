import { BadgePercent } from 'lucide-react';
import { MODE_UNIT, ShippingMode, SpecialPrices, getCategories, hasSpecialPrices } from '../../utils/specialPrices';
import './SpecialPricePicker.scss';

type Props = {
  prices?: SpecialPrices
  // When unknown, both air and sea prices are offered
  mode?: ShippingMode
  selected?: number | string
  onPick: (price: number) => void
  disabled?: boolean
}

// Quick-pick buttons that fill the Exios price with one of the customer's special prices
const SpecialPricePicker = ({ prices, mode, selected, onPick, disabled }: Props) => {
  if (!hasSpecialPrices(prices)) return null;

  const modes: ShippingMode[] = mode ? [mode] : ['air', 'sea'];
  const options = getCategories(prices).flatMap((category, index) =>
    modes
      .map(m => ({ key: `${index}-${m}`, label: category.name, mode: m, price: category[m] }))
      .filter(option => !!option.price)
  );

  return (
    <div className="special-price-picker">
      <span className="spp-title">
        <BadgePercent size={14} strokeWidth={2} /> Special prices{mode ? ` (${mode}, per ${MODE_UNIT[mode]})` : ''}
      </span>
      {options.length === 0 ? (
        <span className="spp-empty">No special {mode} price for this customer</span>
      ) : (
        <div className="spp-options">
          {options.map(option => (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              className={Number(selected) === option.price ? 'is-selected' : ''}
              onClick={() => onPick(option.price as number)}
            >
              {option.label}
              <strong>${option.price}{mode ? '' : ` / ${MODE_UNIT[option.mode]}`}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpecialPricePicker;
