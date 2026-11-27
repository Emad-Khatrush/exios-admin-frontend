// The answers of GET analytics/customers/:section (Exios-Api accounting/services/customerAnalytics/CONTRACT.md)

export type Rate = number | null
export type Period = { from: string, to: string }
export type Who = { id: string, name: string, customerId: string | null, phone: string | null, city: string | null }
export type Paged<T> = { total: number, page: number, limit: number, rows: T[] }
type Built = { builtAt?: string, targets?: Targets, previous?: Record<string, any> | null, insights?: Insights }

// Third round (CONTRACT.md «Third round: the analyst»): a rule engine's reading of the section's answer
export type InsightStatus = 'good' | 'warn' | 'bad' | 'info'
export type InsightPriority = 'high' | 'medium' | 'low'
export type Insights = {
  title: string, titleEn: string,
  headline: string,
  summary: string[],
  indicators: { key: string, label: string, labelEn: string, value: string, status: InsightStatus, benchmark: string | null, target: string | null }[]
  actions: { priority: InsightPriority, text: string }[]
  sources: { label: string, url: string }[]
  method: string
}

export type RepeatData = Built & {
  period: Period, customers: number, repeat: number, repeatRate: Rate, returning: number, newCustomers: number, returningRate: Rate,
  months: { month: string, customers: number, newCustomers: number, returning: number, returningRate: Rate }[]
}

export type CohortsData = Built & {
  cohorts: { month: string, size: number, retained: number[], rates: Rate[] }[]
  average: { offset: number, rate: Rate, cohorts: number }[]
}

export type ChurnKind = 'lost' | 'atRisk'
export type ChurnRow = Who & {
  orders: number, valueCents: number, firstOrderAt: string, lastOrderAt: string, daysSince: number, avgGapDays: number | null,
}
export type ChurnData = Built & Paged<ChurnRow> & {
  days: number, minOrders: number, kind: ChurnKind,
  lost: { customers: number, valueCents: number }, atRisk: { customers: number, valueCents: number },
}

type SourceStats = { signups: number, converted: number, rate: Rate, medianDays: number | null }
export type ConversionData = Built & {
  period: Period, signups: number, converted: number, rate: Rate, medianDays: number | null, within7: number, within30: number,
  bySource: { invited: SourceStats, direct: SourceStats },
  months: { month: string, signups: number, converted: number, rate: Rate }[]
  waiting: Paged<Who & { createdAt: string, days: number }>
}

export type ValueData = Built & {
  period: Period, orders: number, customers: number, valueCents: number,
  avgOrderCents: number | null, ordersPerCustomer: number | null, avgCustomerCents: number | null,
  perYear: { ordersPerCustomer: number | null },
  ltv: { avgCents: number | null, medianCents: number | null, buckets: { label: string, minCents: number, maxCents: number | null, customers: number }[] },
  top: (Who & { orders: number, valueCents: number, share: Rate })[]
  concentration: { top10Share: Rate, top20Share: Rate, top10PercentShare: Rate }
}

export type SegmentKey = 'champions' | 'loyal' | 'promising' | 'needAttention' | 'atRisk' | 'hibernating' | 'lost'
export type RfmData = Built & {
  segments: { key: SegmentKey, label: string, customers: number, share: Rate, valueCents: number, avgRecencyDays: number | null, avgOrders: number | null }[]
  segment: SegmentKey
  list: Paged<Who & { recencyDays: number, orders: number, valueCents: number, r: number, f: number, m: number, segment: SegmentKey }>
}

type Slice = { orders: number, customers: number, valueCents: number }
export type MixData = Built & {
  period: Period,
  byKind: { purchase: Slice, shipment: Slice },
  byMethod: { air: Slice, sea: Slice, unknown: Slice },
  bothKinds: number,
  months: { month: string, purchase: number, shipment: number, air: number, sea: number }[]
  transitions: { airFirst: number, airThenSea: number, seaFirst: number, seaThenAir: number }
}

export type GeoData = Built & {
  period: Period,
  cities: { city: string | null, customers: number, orders: number, valueCents: number, newCustomers: number, share: Rate }[]
  offices: { office: string | null, customers: number, orders: number, valueCents: number, share: Rate }[]
}

// Second round (CONTRACT.md «Second round»): every answer may carry the saved targets, and some the
// same numbers over the period just before (`previous`, top-level numbers and one nested level)
export type TargetKey = 'repeatRate' | 'returningRate' | 'month1Retention' | 'conversionRate' | 'medianDaysToFirstOrder'
  | 'lostCustomers' | 'atRiskCustomers' | 'avgOrderCents' | 'ordersPerCustomer' | 'cacCents' | 'valueToCac'
  | 'medianDeliveryDays' | 'avgRating'
export type Targets = Partial<Record<TargetKey, number | null>>


export type StaffRow = {
  staffId: string, name: string, newCustomers: number, returned: number, returnRate: Rate,
  value90Cents: number, avgValue90Cents: number | null, lost: number,
}
export type StaffData = Built & { period: Period, rows: StaffRow[] }

type DeliveryBucket = { label: string, minDays: number, maxDays: number | null, packages: number }
export type DeliveryData = Built & {
  period: Period, packages: number, medianDays: number | null, avgDays: number | null, p90Days: number | null,
  byMethod: Record<'air' | 'sea' | 'unknown', { packages: number, medianDays: number | null }>,
  months: { month: string, packages: number, medianDays: number | null }[]
  buckets: DeliveryBucket[]
  effect: { label: string, customers: number, returned: number, returnRate: Rate }[]
}

export type RatingStatus = 'active' | 'atRisk' | 'lost'
export type RatingRow = Who & { rating: number, count: number, status: RatingStatus, lastOrderAt: string | null }
export type RatingsData = Built & {
  rated: number, avgRating: number | null,
  byStatus: { status: RatingStatus, customers: number, rated: number, avgRating: number | null }[]
  low: Paged<RatingRow>
}

export type LoyaltyGroupKey = 'redeemed' | 'earnedOnly' | 'none'
export type LoyaltyData = Built & {
  groups: { key: LoyaltyGroupKey, label: string, customers: number, repeatRate: Rate, ordersPerCustomer: number | null, avgValueCents: number | null, lostRate: Rate }[]
}

export type CacData = Built & {
  period: Period,
  totals: {
    marketingCents: number, giftsCents: number, commissionsCents: number, newCustomers: number, cacCents: number | null,
    cacWithCommissionsCents: number | null, value90Cents: number, avgValue90Cents: number | null, valueToCac: number | null,
  }
  months: { month: string, marketingCents: number, giftsCents: number, commissionsCents: number, freeShippingCents: number, newCustomers: number, cacCents: number | null, avgValue90Cents: number | null }[]
  note?: string
}

export type Company = { id: string, name: string, customerId: string | null }
export type Settings = { targets: Targets, companies: Company[] }
export type CompanySuggestion = Who & { orders: number, valueCents: number }
