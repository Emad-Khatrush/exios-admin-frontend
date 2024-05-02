import { Invoice } from "../models";
import { IInvoice } from "../reducers/invoices";

// General Methods
export const arrayRemoveByValue = (arr: any[], value: string) => { 
    
  return arr.filter(function(ele){ 
      return ele !== value; 
  });
}

export const arrayRemoveByIndex = (arr: any[], index: number) => {    
  return arr.splice(index, 1);
}

export const replaceWords = (text: string, replacements: any) => {
  // Regular expression to match |word|
  const regex = /\|(\w+)\|/g;
  
  // Replace each match with corresponding value from replacements object
  const replacedText = text.replace(regex, (match, word) => {
      // Check if replacements object has the key
      if (replacements.hasOwnProperty(word)) {
          return replacements[word];
      } else {
          // If replacement not found, return original match
          return match;
      }
  });
  
  return replacedText;
}


// order methods

export const getOrderSteps = (order: Invoice | null | undefined) => {
  const steps = [
    {
      label: 'تجهيز طلبية',
      value: 'prepareOrder',
    },
    {
      label: 'وصلت الى المخزن',
      value: 'arrived',
    },
    {
      label: 'شحنت الى ليبيا',
      value: 'shippedToLibya',
    },
    {
      label: 'وصلت البضائع',
      value: 'goodsArrived',
    },
    {
      label: 'تم الاستلام',
      value: 'signed',
    }
  ]
  if (order?.isPayment) {
    steps.splice(1, 0, {
      label: 'تم الشراء',
      value: 'paid',
    });
  }
  return steps;
}

export const getTabOrdersCount = (tabType: string, data: IInvoice) => {

    switch (tabType) {
      case 'active':
        return data.activeOrdersCount;
      
      case 'shipment':
      return data.shipmentOrdersCount;

      case 'arriving':
      return data.arrivingOrdersCount;

      case 'unpaid':
      return data.unpaidOrdersCount;

      case 'finished':
      return data.finishedOrdersCount;

      case 'unsure':
      return data.unsureOrdersCount;
    
      default:
        // default
        return data.activeOrdersCount;
    }

}

export const checkIfDataArray = (data: any) => {
  if (Array.isArray(data)) {
    // It's an array
    return true;
  }
  return false;
}

export const calculateMinTotalPrice = (price: number, weight: number, shippedCountry: string, measureUnit: string) => {
  const total = price * weight;
  let minPrice = price;

  // The min weight from China is half of price
  if (shippedCountry === 'CN' && measureUnit === 'KG') {
    minPrice = price / 2;
    if (total <= minPrice && measureUnit === 'KG') {
      return minPrice;
    }
  }
  return Math.ceil(total);
}
