import { Button, TextField } from '@mui/material';
import { OrderItem } from '../../models';
import { useState } from 'react';
import CustomButton from '../CustomButton/CustomButton';
import { formatInvoiceFields } from '../../containers/XTrackingPage/utils';
import api from '../../api';

type Props = {
  items: any[]
  orderId: string
}

const EditInvoiceItems = (props: Props) => {
  const [items, setItems] = useState(props.items);
  
  const addNewItemForOrder = () => {
    const newLink = {
      index: Math.floor(Math.random() * 1000),
      description: '',
      quantity: 1,
      unitPrice: 0
    };
    setItems((prevState: any) => ([...prevState, newLink]))
  }

  const deteteItemRow = () => {
    // in v2, I will delete rows depending on his index
    if (items?.length > 1) {
      const deletedItems = [...items];
      deletedItems.pop();
      setItems(deletedItems);
    }
  }

  const handleChange = (event: any) => {
    const fieldName = formatInvoiceFields(event.target.name);
    const index = event.target.id;
    let copiedItems: any = [...items!];
    items[index][fieldName] = event.target.value;
    setItems(copiedItems);
  }

  const totalInvoice = calculateTotalInvoice(items);

  const onSubmit = async (event: any) => {
    event.preventDefault();

    try {
      await api.update(`orders/${props.orderId}/items`, { items });
      window.location.reload();
    } catch (error) {
      console.log(error);
    }
  }
  
  return (
    <form onSubmit={onSubmit} className='p-3'>
      {/* Order Items Section  */}
      <div className="col-md-12">
        <p className='title'> Order Items </p>
      </div>
      
      {(items || []).map((item: OrderItem, i: number) => (
        <div className='col-md-12 mb-2'>
          <div className="d-flex mb-3">
            <TextField
              id={String(i)}
              label={`Description (${i + 1})`}
              name="description"
              onChange={handleChange}
              style={{ direction: 'rtl' }}
              defaultValue={item.description}
            />
            <TextField
              id={String(i)}
              label={`Quantity`}
              name="itemQuantity"
              onChange={handleChange}
              type={'number'}
              inputProps={{ inputMode: 'numeric', step: .01 }}
              onWheel={(event: any) => event.target.blur()}
              defaultValue={item.quantity}
            />
            <TextField
              id={String(i)}
              label={`Unit Price $`}
              name="unitPrice"
              onChange={handleChange}
              type={'number'}
              inputProps={{ inputMode: 'numeric', step: .01 }}
              onWheel={(event: any) => event.target.blur()}
              defaultValue={item.unitPrice}
            />
          </div>
        </div>
      ))}
      <div className='mb-4'>
        <Button style={{ marginRight: '10px' }} variant="contained" onClick={addNewItemForOrder} type='button' size='small'>ADD</Button>
        <Button 
          color='error' 
          variant="contained" 
          type='button' 
          size='small'
          onDoubleClick={deteteItemRow} 
        >
          Remove
        </Button>
      </div>

      <div>
        <h6>Total Invoice: {totalInvoice} $</h6>
      </div>

      <div className="col-md-12 mb-2 text-end">
        <CustomButton 
          background='rgb(0, 171, 85)' 
          size="small"
          // disabled={(isUpdating || formData?.isCanceled) ? true : false}
        >
          Update Invoice
        </CustomButton>
      </div>
    </form>
  )
}

const calculateTotalInvoice = (items: any[]) => {
  let total = 0;
  items.forEach(item => {
    const amount = item.unitPrice * item.quantity;
    total += amount;
  })
  return total;
}

export default EditInvoiceItems;
