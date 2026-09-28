export type Invoice = {
  user: User,
  _id: string,
  madeBy: User,
  orderId: string,
  invoiceConfirmed: boolean,
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

export type PopupAd = {
  _id: string
  description: string
  imageUrl?: string | null
  icon?: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'active' | 'expired'
  viewCount: number
  createdAt: string
}

export type CompanyNoteFile = {
  _id: string
  path: string
  name: string
  fileType?: string
  size?: number
  uploadedAt: string
}

export type CompanyNote = {
  _id: string
  title: string
  content: string
  isPinned: boolean
  files: CompanyNoteFile[]
  createdBy?: { _id: string, firstName: string, lastName: string } | null
  createdAt: string
  updatedAt: string
}

export type PopupAdViewer = {
  user: {
    _id: string
    firstName: string
    lastName: string
    phone?: number
    customerId?: string
  } | null
  viewedAt: string
}

export type SiteVisit = {
  _id: string
  path: string
  referrer?: string
  device: 'mobile' | 'tablet' | 'desktop'
  browser: string
  ip?: string
  user: {
    _id: string
    firstName: string
    lastName: string
    phone?: number
    customerId?: string
  } | null
  createdAt: string
}

export type AnalyticsSummary = {
  totalVisits: number
  totalVisitors: number
  todayVisits: number
  todayVisitors: number
  last7DaysVisits: number
  last30DaysVisits: number
  topPages: { path: string, count: number }[]
  deviceBreakdown: { device: string, count: number }[]
  dailySeries: { date: string, count: number, uniqueVisitors: number }[]
  loggedInVisits: number
  guestVisits: number
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
  passportVerification?: PassportVerification
  roles: {
    isAdmin: boolean
    isEmployee: boolean
    isClient: boolean
    accountant: boolean
    isAccountant?: boolean
  }
  updatedAt: Date
  username: string
  __v: number
  _id: string
}

export type PassportVerification = {
  status: 'pending' | 'verified' | 'rejected'
  imageUrl?: string
  rejectionReason?: string
  wasRejected?: boolean
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
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
    locationPlace: string
    boxesCount: string
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
  images: []
}

export type ActivityStatus = 'added' | 'updated' | 'deleted'
export type ActivityKind = 'order' | 'expense' | 'income' | 'inventory' | 'debt' | 'activity'

export type ActivityType = {
  createdAt: string
  details: {
    path: string
    status: ActivityStatus
    type: ActivityKind
    actionName?: 'image'
    actionId: string
  },
  changedFields: {
    label?: string
    value?: string
    changedFrom?: string
    changedTo?: string
  }[]
  // Readable name of the record, e.g. "#EX1234 · Ahmed Ali" (null when it can't be found)
  subject: string | null
  recordExists: boolean
  updatedAt: string
  user: { _id: string, firstName: string, lastName: string, imgUrl?: string } | null
  _id: string
}

export type ActivityUser = {
  _id: string
  firstName: string
  lastName: string
  imgUrl?: string
  count: number
}

export type ActivitiesResponse = {
  activities: ActivityType[]
  limit: number
  skip: number
  total: number
  counts: {
    byType: Partial<Record<ActivityKind, number>>
    byStatus: Partial<Record<ActivityStatus, number>>
  }
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
  range: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    granularity: 'day' | 'week' | 'month'
  }
  activeOrdersCount: number
  previousTotalInvoices: number
  previousTotalEarning: number
  newClientsCount: number
  previousNewClientsCount: number
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
  shipmentStats: {
    totalKG: number
    totalCBM: number
    packagesCount: number
    previousTotalKG: number
    previousTotalCBM: number
    previousPackagesCount: number
  }
  shipmentTrend: {
    label: string
    title: string
    totalKG: number
    totalCBM: number
    packagesCount: number
  }[]
  officeBreakdown: {
    office: string
    activeOrders: number
    totalKG: number
    totalCBM: number
    packagesCount: number
  }[]
  recentActivity: {
    type: 'order' | 'payment'
    id: string
    title: string
    subtitle: string
    amount: number
    currency: string
    isPositive: boolean
    office: string | null
    createdAt: string
  }[]
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
  icon?: React.ReactElement
}[]

export type OrderActivity = {
  createdAt?: Date,
  country?: string,
  description?: string
}

export type ApiErrorMessages = 'user-not-found' | 'user-subscription-canceled' | 'invalid-credentials' | 'authorize-invalid'
  | 'token-not-found' | 'invalid-token' | 'order-id-taken' | 'order-not-found' | 'expense-id-taken' | 'user-role-invalid'
  | 'expense-not-found' | 'image-not-found' | 'fields-empty' | 'server-error' | 'balance-currency-not-accepted' | 'balance-already-paid' 
  | 'inventory-not-found' | 'balance-rate-zero' | 'balance-not-found' | 'balance-not-closable' | 'balance-has-payments' | 'balance-order-customer-mismatch';

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
    isAccountant?: boolean
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
  // Present when an admin/accountant closed the debt by hand; the remainder went to a 'lost' debt
  manualClosure?: {
    note: string
    writtenOffAmount: number
    closedAt: Date
    closedBy?: { _id: string, firstName: string, lastName: string } | string
    lostBalance?: string
  }
  // On a 'lost' debt created by a manual closure: the debt it was written off from
  sourceBalance?: string
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
  shippedCountry: 'CN' | 'UAE' | 'TR' | 'USA' | 'UK' | 'LY',
  inventoryPlace: 'tripoli' | 'benghazi',
  inventoryFinishedDate: Date,
  voyageAmount: number,
  voyageCurrency: 'USD' | 'LYD',
  inventoryType: 'inventoryGoods' | 'shippingVoyage',
  shippingType: 'air' | 'sea' | 'domestic'
  note: string
  costPrice: number
}
