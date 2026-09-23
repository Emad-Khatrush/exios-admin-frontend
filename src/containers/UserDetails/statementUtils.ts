export const formatMoney = (value: number, currency: string) =>
  `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const statementOffices = [
  { value: 'tripoli', label: 'Tripoli' },
  { value: 'benghazi', label: 'Benghazi' },
  { value: 'misurata', label: 'Misurata' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'china', label: 'China' },
  { value: 'almutahidaTrBank', label: 'Almutahida TR Bank' },
];

export const getOfficeLabel = (office?: string) =>
  statementOffices.find((item) => item.value === office)?.label || office || '';
