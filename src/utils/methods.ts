import { Debt, Invoice } from "../models";
import { IInvoice } from "../reducers/invoices";

export function convertGoogleStorageUrl(url: string) {
  const oldBase = "https://storage.googleapis.com";
  const newBase = "https://storage.googleapis.com";

  if (typeof url == 'string' && url?.startsWith(oldBase)) {
    return url.replace(oldBase, newBase);
  }

  return url;
}

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
  
  // let minPrice = price;
  // // The min weight from China is half of price
  // if (shippedCountry !== 'CN' && measureUnit === 'KG') {
  //   minPrice = price / 2;
  //   if (total <= minPrice && measureUnit === 'KG') {
  //     return minPrice;
  //   }
  // }
  return Number(total).toFixed(2);
}

export const calculateTotalDebt = (debts: Debt[], currentOffice: string) => {
  let totalUsd = 0, totalLyd = 0;
  (debts || []).forEach(debt => {
    const isDebtArray = checkIfDataArray(debt);
    if (isDebtArray) {
      (debt as any || []).forEach((d: Debt) => {
        if (d.currency === 'USD' && d.createdOffice === currentOffice) totalUsd += d.amount
        else if (d.currency === 'LYD' && d.createdOffice === currentOffice) totalLyd += d.amount;
      })
    } else {
      if (debt.currency === 'USD' && debt.createdOffice === currentOffice) totalUsd += debt.amount
      else if (debt.currency === 'LYD' && debt.createdOffice === currentOffice) totalLyd += debt.amount;
    }
  })

  return { totalUsd, totalLyd }
}

export const calculateTotalWallet = (wallet: any) => {
  let totalUsd = 0, totalLyd = 0;
  (wallet || []).forEach((w: any) => {
    if (w.currency === 'USD') totalUsd += w.balance
    else if (w.currency === 'LYD') totalLyd += w.balance;
  })

  return { totalUsd, totalLyd }
}

// Statement totals are stored as a running balance at insert time, so a payment added
// with a past date leaves every later total wrong. Re-sort by date and rebuild the balance.
export const recalculateStatementTotals = (statements: any[] = []) => {
  if (!statements?.length) return [];

  const signedAmount = (statement: any) => (statement.calculationType === '-' ? -1 : 1) * Number(statement.amount || 0);
  const round = (value: number) => Math.round(value * 100) / 100;

  // Balance before the first ever inserted record (usually 0), taken from its stored total
  const firstInserted = [...statements].sort((a, b) => String(a._id).localeCompare(String(b._id)))[0];
  const openingBalance = Number(firstInserted.total || 0) - signedAmount(firstInserted);

  const sorted = [...statements].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return diff !== 0 ? diff : String(a._id).localeCompare(String(b._id));
  });

  let runningTotal = openingBalance;
  return sorted.map((statement) => {
    runningTotal = round(runningTotal + signedAmount(statement));
    return { ...statement, total: runningTotal };
  });
}
