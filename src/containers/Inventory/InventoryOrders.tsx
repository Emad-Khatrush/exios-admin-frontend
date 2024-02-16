import { useEffect, useState } from 'react';
import TransferOrdersList from '../../components/TransferOrdersList/TransferOrdersList';
import { Inventory, Invoice } from '../../models';
import api, { base } from '../../api';
import TextInput from '../../components/TextInput/TextInput';
import { AiOutlineSearch } from 'react-icons/ai';

type Props = {
  inventory: Inventory
}

const InventoryOrders = (props: Props) => {

  const [orders, setOrders] = useState<Invoice[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [cancelToken, setCancelToken] = useState();
  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState();
  
  useEffect(() => {
    getOrders();
  }, [])
  
  const getOrders = async () => {
    const res = await api.get(`inventory/orders?searchValue=${searchValue}`);
    setOrders(res?.data || []);
  }

  const filterList = (event: any) => {  
    clearTimeout(quickSearchDelayTimer);
    setQuickSearchDelayTimer((): any => {
      return setTimeout(async () => {
        const res = await api.get(`inventory/orders?searchValue=${event.target.value}`, { cancelToken, inventoryId: props.inventory?._id });
        setOrders(res?.data || []);
      }, 1)
    })
  }
  
  return (
    <div className='mb-5'>
      <TextInput
        name="searchValue"
        placeholder={'Search For Package'}
        icon={<AiOutlineSearch />}
        onChange={(event: any) => {
          const cancelTokenSource: any = base.cancelRequests(); // Call this before making a request
          setSearchValue(event.target.value);
          setCancelToken(cancelTokenSource);
          filterList(event);
        }}
      />
      
      <TransferOrdersList
        takenOrders={props.inventory?.orders}
        orders={orders}
        inventory={props.inventory}
      />
    </div>
  )
}

export default InventoryOrders;
