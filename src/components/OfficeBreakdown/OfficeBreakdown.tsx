import { Building2 } from 'lucide-react';

import './OfficeBreakdown.scss';

type OfficeStat = {
  office: string;
  activeOrders: number;
  totalKG: number;
  totalCBM: number;
  packagesCount: number;
};

type Props = {
  offices: OfficeStat[];
};

const OFFICE_LABELS: Record<string, string> = {
  tripoli: 'Tripoli',
  benghazi: 'Benghazi',
};

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

const OfficeBreakdown = ({ offices }: Props) => {
  const maxKG = Math.max(1, ...offices.map(o => o.totalKG));

  return (
    <div className="office-breakdown">
      <h3>By office, this month</h3>

      <div className="office-breakdown-list">
        {offices.map(office => (
          <div className="office-row" key={office.office}>
            <div className="office-row-head">
              <span className="office-row-name">
                <Building2 size={15} strokeWidth={2} />
                {OFFICE_LABELS[office.office] || office.office}
              </span>
              <span className="office-row-orders">{office.activeOrders} active order{office.activeOrders === 1 ? '' : 's'}</span>
            </div>

            <div className="office-row-bar-track">
              <div className="office-row-bar" style={{ width: `${(office.totalKG / maxKG) * 100}%` }} />
            </div>

            <dl className="office-row-figures">
              <div><dt>KG</dt><dd>{formatNumber(office.totalKG)}</dd></div>
              <div><dt>CBM</dt><dd>{formatNumber(office.totalCBM)}</dd></div>
              <div><dt>Packages</dt><dd>{office.packagesCount}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfficeBreakdown;
