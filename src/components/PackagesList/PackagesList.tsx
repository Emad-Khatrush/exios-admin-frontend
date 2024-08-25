import React, { useState } from 'react'
import { Invoice, Package } from '../../models'
import CustomButton from '../CustomButton/CustomButton'
import Badge from '../Badge/Badge'

type Props = {
  order: Invoice
  onListChange?: (list: any) => void
}

const PackagesList = (props: Props) => {
  const [selectedPackages, setSelectedPackages] = useState<any>([]);

  const { order } = props;

  return (
    <div className="col-md-12 mb-4">

      <hr />

      {selectedPackages.length > 0 &&
        <div className='row'>
          <p className='mb-1'>Selected Items</p>
          {selectedPackages.map((packageDetails: Package) => (
            <div className="col-md-4">
              <p className="p-1 d-flex justify-content-between align-items-center" style={{ border: '1px black solid', borderRadius: '5px', fontSize: '12px' }}>
                {packageDetails.deliveredPackages.trackingNumber} - {packageDetails.deliveredPackages.weight.total} {packageDetails.deliveredPackages.weight.measureUnit}
                <CustomButton
                  size="small"
                  onClick={(event: MouseEvent) => {
                    event.preventDefault();
                      const newData = selectedPackages.filter((data: Package) => data._id !== packageDetails._id);
                      setSelectedPackages(newData);
                      props.onListChange && props.onListChange(newData);
                  }}
                  color={'error'}
                >
                  Remove
                </CustomButton>
              </p>
            </div>
          ))}
        </div>
      }

      <h6>Packages (Payment Links)</h6>
      {order?.paymentList.length > 0 ? order?.paymentList.map((packageDetails: Package, i: number) => {
        const alreadySelectedPackage = !!selectedPackages.find((data: Package) => data._id === packageDetails._id)
        return (
          <div>
            <p className="p-2" style={{ border: '1px black solid', borderRadius: '5px'}}>
              {i + 1}.
              <Badge text={packageDetails.deliveredPackages.trackingNumber || 'Tracking Number Not Found'} color="warning" />
              <span className="mx-1">-</span>
              <Badge 
                text={`${packageDetails.deliveredPackages.weight.total || 'KG or CBM data not found'}
                ${packageDetails.deliveredPackages.weight.measureUnit || ''}`} 
                color="primary"
              />
              <CustomButton
                size="small"
                onClick={(event: MouseEvent) => {
                  event.preventDefault();
                  if (alreadySelectedPackage) {
                    const newData = selectedPackages.filter((data: Package) => data._id !== packageDetails._id);
                    setSelectedPackages(newData);
                    props.onListChange && props.onListChange(newData);
                    return;
                  }
                  const newData = [ ...selectedPackages, packageDetails ];
                  setSelectedPackages(newData);
                  props.onListChange && props.onListChange(newData);
                }}
                color={alreadySelectedPackage ? 'error' : 'primary'}
              >
                {alreadySelectedPackage ? 'Remove' : 'Select'}
              </CustomButton>
            </p>
          </div>
          )
      })
        :
        <p>No Packages inside {order?.orderId}</p>
      }
    </div>
  )
}

export default PackagesList;