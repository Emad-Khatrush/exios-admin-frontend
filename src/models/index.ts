export type Invoice = {
  user: User,
  _id: string,
  madeBy: User,
  orderId: string,
  activity: OrderActivity[],
  customerInfo: {
    fullName: string,
    phone: String,
    email: String
  },
  placedAt: string,
  totalInvoice: number,
  receivedUSD: number,
  receivedLYD: number,
  receivedShipmentLYD: number,
  receivedShipmentUSD: number,
  paymentExistNote: string,
  shipment: {
    fromWhere: string,
    toWhere: string,
    method: string,
    estimatedDelivery: Date,
    exiosShipmentPrice: number,
    originShipmentPrice: number,
    weight: number,
    packageCount: number,
    note: string,
  },
  productName: string,
  quantity: string,
  isShipment: boolean,
  isPayment: boolean,
  unsureOrder: boolean,
  hasRemainingPayment: boolean
  hasProblem: boolean
  orderStatus: number,
  isFinished: boolean,
  netIncome: {
    nameOfIncome: string,
    total: number,
  }[],
  orderNote: string,
  isCanceled: boolean,
  images: {
    filename: string,
    path: string,
    category: 'invoice' | 'receipts'
  }[],
  debt: {
    currency: string,
    total: number,
  },
  credit: {
    currency: string,
    total: number,
  },
  paymentList: Package[],
  createdAt: Date,
  updatedAt: Date,
  items: OrderItem[]
}

export type OrderItem = {
  description: string
  quantity: number
  unitPrice: number
} 

export type ShipmentPrice = {
  country: string
  createdAt: string
  currency: string
  _id: string
  shippingType: 'air' | 'sea'
}

export type ExchangeRate = {
  fromCurrency: 'usd' | 'lyd'
  toCurrency: 'usd' | 'lyd'
  rate: number
  createdAt: string
  _id: string
}

export type User = {
  createdAt: Date
  firstName: string
  lastName: string
  phone: number | string
  city: string
  isCanceled: boolean
  isAgreeToTermsOfCompany: boolean
  imgUrl: string
  customerId: string
  orders: any[]
  roles: {
    isAdmin: boolean
    isEmployee: boolean
    isClient: boolean
    accountant: boolean
  }
  updatedAt: Date
  username: string
  __v: number
  _id: string
}

export type Package = {
  _id: string
  deliveredPackages: {
    arrivedAt: Date
    exiosPrice: number
    originPrice: number
    receivedShipmentLYD: number
    receivedShipmentUSD: number
    trackingNumber: string
    weight: {
      total: number, 
      measureUnit: string
    }
  }
  link: string
  note: string
  status: {
    arrived: boolean
    paid: boolean
    arrivedLibya: boolean,
    received: boolean
  }
}

export type ActivityType = {
  createdAt: Date
  details: {
    path: string
    status: string
    type: string 
    actionId: string
  },
  changedFields: {
    label: String,
    value: String,
    changedFrom: String,
    changedTo: String
  }[]
  updatedAt: Date
  user: User
  __v: number
  _id: string
}

export type Office = {
  office: string
  libyanDinar: {
    value: number,
    currency: 'LYD'
  },
  usaDollar: {
    value: number,
    currency: 'USD'
  },
  turkishLira: {
    value: number,
    currency: 'TRY'
  }
}

export type Income = {
  cost: {
    currency: string, 
    total: number
  },
  createdAt: Date,
  description: string,
  images: any[],
  office: string,
  updatedAt: Date,
  user: User,
  __v: number,
  _id: string
}

export type HomeData = {
  activeOrdersCount: number
  betterThenPreviousMonth: boolean
  monthlyEarning: {
    total: number
    type: string
  }[]
  percentage: number
  totalInvoices: number
  totalMonthlyEarning: number
  offices: Office[],
  totalDebts: {
    totalDebts: number, 
    office: string, 
    currency: string
  }[],
  debts: Invoice[]
  credits: Invoice[]
  clientUsersCount: number
}

export type Expense = {
  cost: {
    currency: string, 
    total: number
  },
  createdAt: Date,
  description: string,
  images: any[],
  placedAt: string,
  updatedAt: Date,
  user: User,
  __v: number,
  _id: string
}

export type LocalTabs = {
  label: string,
  value: string,
  icon: React.ReactElement
}[]

export type OrderActivity = {
  createdAt?: Date,
  country?: string,
  description?: string
}

export type ApiErrorMessages = 'user-not-found' | 'user-subscription-canceled' | 'invalid-credentials' | 'authorize-invalid'
  | 'token-not-found' | 'invalid-token' | 'order-id-taken' | 'order-not-found' | 'expense-id-taken' | 'user-role-invalid'
  | 'expense-not-found' | 'image-not-found' | 'fields-empty' | 'server-error' | 'balance-currency-not-accepted' | 'balance-already-paid' 
  | 'inventory-not-found' | 'balance-rate-zero';

export type Session = {
  account: Account
  isError: boolean
  isLoading: boolean
  isLoggedIn: boolean
  token: string
}

export type Account = {
  _id: string
  username: string,
  firstName: string,
  lastName: string,
  imgUrl: string,
  phone: string,
  orders: any[],
  roles: {
    isAdmin: boolean,
    isEmployee: boolean,
    isClient: boolean,
    accountant: boolean
  },
  city: string
}

export type Debt = {
  _id: string
  order: Invoice,
  owner: User,
  createdBy: User,
  createdOffice: 'tripoli' | 'benghazi',
  balanceType: 'debt' | 'credit',
  amount: number,
  initialAmount: number,
  currency: 'LYD' | 'USD',
  status: 'open' | 'closed' | 'overdue' | 'lost' | 'waitingApproval'
  notes: string,
  paymentHistory: [
    {
      _id: string
      createdAt: Date,
      rate: number,
      amount: number,
      currency: 'LYD' | 'USD',
      companyBalance: {
        isExist: boolean,
        reference: string
      },
      attachments: [{
        filename: string,
        path: string,
        fileType: string,
        description: string
      }],
      notes: string
    }
  ],
  attachments: [{
    filename: string,
    path: string,
    fileType: string,
    description: string
  }],
  debtPriority: string
  createdAt: Date,
  updatedAt: Date
}

export type Credit = {
  _id: string
  order: Invoice,
  owner: Account,
  createdBy: Account,
  balanceType: 'debt' | 'credit',
  amount: number,
  initialAmount: number,
  currency: 'LYD' | 'USD',
  status: 'open' | 'closed' | 'overdue' | 'lost'
  notes: string,
  paymentHistory: [
    {
      _id: string
      createdAt: Date,
      rate: number,
      amount: number,
      currency: 'LYD' | 'USD',
      companyBalance: {
        isExist: boolean,
        reference: string
      },
      attachments: [{
        filename: string,
        path: string,
        fileType: string,
        description: string
      }],
      notes: string
    }
  ],
  attachments: [{
    filename: string,
    path: string,
    fileType: string,
    description: string
  }],
  debtPriority: string
  createdAt: Date,
  updatedAt: Date
}

export type Inventory = {
  _id: string
  createdBy: User,
  orders: Invoice[],
  attachments: {
    filename: string,
    path: string,
    folder: string,
    bytes: string,
    fileType: string,
    description: string
  }[],
  voyage: string,
  shippedCountry: 'CN' | 'UAE' | 'TR' | 'USA' | 'UK',
  inventoryPlace: 'tripoli' | 'benghazi',
  inventoryFinishedDate: Date,
  voyageAmount: number,
  voyageCurrency: 'USD' | 'LYD',
  inventoryType: 'inventoryGoods' | 'shippingVoyage',
  shippingType: 'air' | 'sea' | 'domestic'
  note: string
}
