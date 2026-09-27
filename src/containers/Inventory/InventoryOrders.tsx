import { useEffect, useRef, useState } from 'react';
import TransferOrdersList from '../../components/TransferOrdersList/TransferOrdersList';
import { Inventory, Invoice } from '../../models';
import api, { base } from '../../api';

type Props = {
  inventory: Inventory
  getInventory?: () => void
}

// Wait until the user stops typing before searching
const SEARCH_DELAY_MS = 350;

const InventoryOrders = (props: Props) => {

  const [orders, setOrders] = useState<Invoice[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  // Only the latest search may write its results
  const requestId = useRef(0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    getOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getOrders = async () => {
    const res = await api.get(`inventory/orders?searchValue=`);
    setOrders(res?.data || []);
  }

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      try {
        base.cancelRequests();
        const res = await api.get(`inventory/orders?searchValue=${encodeURIComponent(searchValue)}`, { inventoryId: props.inventory?._id });
        if (id === requestId.current) setOrders(res?.data || []);
      } catch (error) {
        console.log(error);
      } finally {
        if (id === requestId.current) setIsSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  return (
    <div className='mb-5'>
      <TransferOrdersList
        takenOrders={props.inventory?.orders}
        orders={orders}
        inventory={props.inventory}
        isSearching={isSearching}
        fetchSelectedOrders={props.getInventory}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />
    </div>
  )
}

export default InventoryOrders;
