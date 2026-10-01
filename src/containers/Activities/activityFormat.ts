import moment from 'moment';
import { ActivityKind, ActivityStatus, ActivityType } from '../../models';

export const TYPE_LABELS: Record<ActivityKind, { one: string, many: string }> = {
  order: { one: 'order', many: 'Orders' },
  expense: { one: 'expense', many: 'Expenses' },
  income: { one: 'income', many: 'Incomes' },
  inventory: { one: 'shipment', many: 'Inventory' },
  debt: { one: 'debt', many: 'Debts' },
  activity: { one: 'activity', many: 'Other' },
};

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  added: 'Added',
  updated: 'Updated',
  deleted: 'Deleted',
};

export const FILTER_TYPES: ActivityKind[] = ['order', 'expense', 'income', 'inventory', 'debt'];
export const FILTER_STATUSES: ActivityStatus[] = ['added', 'updated', 'deleted'];

const IMAGE_URL = /^https?:\/\/\S+$/i;

export const isImageActivity = (activity: ActivityType) => activity.details.actionName === 'image';

// "added a new order", "updated an expense", "deleted a photo from an order"...
export const describeActivity = (activity: ActivityType) => {
  const { status, type } = activity.details;
  const noun = TYPE_LABELS[type]?.one || type;
  const article = /^[aeiou]/.test(noun) ? 'an' : 'a';

  if (isImageActivity(activity)) {
    const count = activity.changedFields?.length || 1;
    const photos = count === 1 ? 'a photo' : `${count} photos`;
    return status === 'deleted' ? `deleted ${photos} from ${article} ${noun}` : `added ${photos} to ${article} ${noun}`;
  }
  if (status === 'added') return `added a new ${noun}`;
  if (status === 'deleted') return `deleted ${article} ${noun}`;
  return `updated ${article} ${noun}`;
};

// Where "Open" goes. Records that were deleted, or can't be found anymore, get no link.
export const getActivityLink = (activity: ActivityType): string | null => {
  const { type, actionId, path, status } = activity.details;
  if (!activity.recordExists || (status === 'deleted' && !isImageActivity(activity))) return null;
  switch (type) {
    case 'order': return `/invoice/${actionId}/edit`;
    // Old expense and income records have no page of their own any more
    case 'expense':
    case 'income': return null;
    case 'inventory': return `/inventory/${actionId}/edit`;
    default: return path ? `${path}?id=${actionId}` : null;
  }
};

const EMPTY_VALUES = ['', 'empty', 'undefined', 'null'];

// Old/new values are stored as plain strings: dates as JS date strings, booleans as "true"/"false".
export const formatValue = (value?: string | null): string => {
  const text = String(value ?? '').trim();
  if (EMPTY_VALUES.includes(text)) return '—';
  if (text === 'true') return 'Yes';
  if (text === 'false') return 'No';
  if (/GMT|^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const utc = moment.utc(new Date(text));
    if (utc.isValid()) {
      // Date-only fields are saved as UTC midnight; don't invent a time for them.
      if (!utc.hours() && !utc.minutes()) return utc.format('D MMM YYYY');
      return moment(new Date(text)).format('D MMM YYYY, HH:mm');
    }
  }
  return text;
};

export const isImageUrl = (value?: string | null) => !!value && IMAGE_URL.test(value);

// Field names come through when the backend had no label for them: "receivedUSD" -> "Received USD"
export const fieldLabel = (field: { label?: string, value?: string }) => {
  if (field.label) return field.label;
  if (!field.value) return 'Field';
  const spaced = field.value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const dayHeading = (date: string) => {
  const day = moment(date);
  if (day.isSame(moment(), 'day')) return 'Today';
  if (day.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  return day.format(day.isSame(moment(), 'year') ? 'dddd, D MMMM' : 'dddd, D MMMM YYYY');
};

export const initials = (firstName?: string, lastName?: string) =>
  `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
