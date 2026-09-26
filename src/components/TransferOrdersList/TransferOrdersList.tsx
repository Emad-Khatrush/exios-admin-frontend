import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { alpha } from '@mui/material/styles';
import api from '../../api';
import { Inventory } from '../../models';
import { Alert, Backdrop, CircularProgress, Dialog, Snackbar } from '@mui/material';
import { FaArrowLeft, FaArrowRight, FaBuilding, FaFileExcel, FaSortAlphaDown, FaSortAlphaUp, FaWarehouse, FaWhatsapp, FaWeight } from "react-icons/fa";
import * as XLSX from 'xlsx';
import moment from 'moment';
import { IoIosCloseCircle, IoIosListBox } from 'react-icons/io';
import { AiOutlineInbox, AiOutlineSearch } from 'react-icons/ai';
import ActivityDialog from './ActivityDialog';
import EditPackageWeight from './EditPackageWeight';
import { calculateMinTotalPrice } from '../../utils/methods';

function not(a: readonly number[], b: readonly number[]) {
  return a.filter((value) => b.indexOf(value) === -1);
}

function intersection(a: readonly number[], b: readonly number[]) {
  return a.filter((value) => b.indexOf(value) !== -1);
}

function union(a: readonly number[], b: readonly number[]) {
  return [...a, ...not(b, a)];
}

// يبحث عن الطلبية باسم الزبون، رمز العميل (customerId)، رقم تتبع الصين، أو رقم تتبع المصدر
const matchesCustomerSearch = (order: any, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (order?.customerInfo?.fullName || '').toLowerCase();
  const customerId = String(order?.user?.customerId ?? '').toLowerCase();
  const trackingNumber = String(order?.paymentList?.deliveredPackages?.trackingNumber ?? '').toLowerCase();
  const receiptNo = String(order?.paymentList?.deliveredPackages?.receiptNo ?? '').toLowerCase();
  return name.includes(q) || customerId.includes(q) || trackingNumber.includes(q) || receiptNo.includes(q);
};

type Props = {
  takenOrders: any
  orders: any
  inventory: Inventory
  isSearching: boolean
  fetchSelectedOrders?: () => void
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

type ActionTone = 'primary' | 'danger' | 'neutral';

type ActionButtonProps = {
  icon: React.ReactNode
  label: string
  tooltip: string
  tone?: ActionTone
  count?: number
  onClick: () => void
  disabled?: boolean
}

const ActionButton = ({ icon, label, tooltip, tone = 'neutral', count, onClick, disabled }: ActionButtonProps) => (
  <Tooltip title={tooltip} arrow placement="left">
    <span style={{ display: 'block', width: '100%' }}>
      <ButtonBase
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        sx={(theme) => {
          const main = tone === 'primary' ? theme.palette.primary.main : tone === 'danger' ? theme.palette.error.main : theme.palette.text.primary;
          return {
            width: '100%',
            justifyContent: 'flex-start',
            gap: 1.25,
            px: 1.25,
            py: 1,
            borderRadius: 1.5,
            fontSize: 13,
            fontWeight: 500,
            color: tone === 'primary' ? theme.palette.primary.contrastText : main,
            bgcolor: tone === 'primary' ? main : 'transparent',
            transition: `background-color 200ms ${EASE}, transform 120ms ${EASE}, opacity 200ms ${EASE}`,
            '&:hover': {
              bgcolor: tone === 'primary' ? theme.palette.primary.dark : alpha(main, 0.07),
            },
            '&:active': { transform: 'scale(0.98)' },
            '&.Mui-focusVisible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`, outlineOffset: 2 },
            '&.Mui-disabled': {
              opacity: 0.38,
              bgcolor: tone === 'primary' ? alpha(main, 0.5) : 'transparent',
            },
          };
        }}
      >
        <Box component="span" sx={{ display: 'flex', fontSize: 14, flexShrink: 0 }}>{icon}</Box>
        <Box component="span" sx={{ flex: 1, textAlign: 'start', whiteSpace: 'nowrap' }}>{label}</Box>
        {!!count && (
          <Box component="span" sx={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>{count}</Box>
        )}
      </ButtonBase>
    </span>
  </Tooltip>
);

const RailLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', px: 1.25, pt: 1, pb: 0.25 }}>
    {children}
  </Typography>
);

const EmptyState = ({ title, hint }: { title: string, hint?: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, px: 4, textAlign: 'center' }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', color: 'text.secondary', mb: 1.5 }}>
      <AiOutlineInbox size={24} />
    </Box>
    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
    {hint && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, maxWidth: 280, textWrap: 'pretty' }}>{hint}</Typography>}
  </Box>
);

const RowSkeleton = () => (
  <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Skeleton variant="rectangular" width={18} height={18} sx={{ mt: 0.25, borderRadius: 0.75 }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton width="35%" height={18} />
      <Skeleton width="55%" height={16} />
      <Skeleton width="80%" height={14} />
    </Box>
  </Box>
);

type StatusTone = 'positive' | 'neutral' | 'accent';

const StatusTag = ({ label, tone }: { label: string, tone: StatusTone }) => (
  <Box
    component="span"
    sx={(theme) => {
      const color = tone === 'positive' ? theme.palette.success.main : tone === 'accent' ? theme.palette.primary.main : theme.palette.text.secondary;
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.125,
        borderRadius: 1,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        color,
        bgcolor: alpha(color, 0.09),
        '&::before': { content: '""', width: 5, height: 5, borderRadius: '50%', bgcolor: color },
      };
    }}
  >
    {label}
  </Box>
);

const IdField = ({ label, value }: { label: string, value?: string }) => {
  if (!value) return null;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>{label}</Box>
      <Box component="span" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Box>
    </Box>
  );
};

type OrderRowProps = {
  order: any
  checked: boolean
  onToggle: () => void
  labelId: string
  detailed?: boolean
}

const OrderRow = ({ order, checked, onToggle, labelId, detailed }: OrderRowProps) => {
  const pkg = order?.paymentList?.deliveredPackages;
  const status = order?.paymentList?.status;
  const meta = detailed ? [
    pkg?.weight?.total ? `${pkg.weight.total} ${pkg.weight.measureUnit || ''}`.trim() : '',
    order?.shipment?.fromWhere ? order?.shipment?.toWhere : '',
    pkg?.locationPlace,
    pkg?.boxesCount ? `${pkg.boxesCount} صناديق` : '',
  ].filter(Boolean) : [];

  return (
    <ListItemButton
      role="listitem"
      selected={checked}
      onClick={onToggle}
      sx={(theme) => ({
        alignItems: 'flex-start',
        gap: 1.25,
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: checked ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        transition: `background-color 150ms ${EASE}, box-shadow 150ms ${EASE}`,
        '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
        '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
      })}
    >
      <Checkbox
        edge="start"
        size="small"
        checked={checked}
        tabIndex={-1}
        disableRipple
        sx={{ p: 0, mt: 0.25, ml: 0 }}
        inputProps={{ 'aria-labelledby': labelId }}
      />
      <Box id={labelId} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.5 }}>
          <Box
            component="a"
            href={`/invoice/${order?._id}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 600,
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline', textUnderlineOffset: 3 },
            }}
          >
            {order?.orderId}
          </Box>
          {detailed && (
            <StatusTag label={status?.arrivedLibya ? 'وصلت ليبيا' : 'لم تصل ليبيا'} tone={status?.arrivedLibya ? 'positive' : 'neutral'} />
          )}
          {detailed && status?.received && <StatusTag label="تم التسليم" tone="accent" />}
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.25, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
            {order?.customerInfo?.fullName}
          </Typography>
          {order?.user?.customerId && (
            <Typography sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
              {order.user.customerId}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5, rowGap: 0.25 }}>
          <IdField label="تتبع الصين" value={pkg?.trackingNumber} />
          <IdField label="رقم المصدر" value={pkg?.receiptNo} />
        </Stack>

        {meta.length > 0 && (
          <Typography sx={{ mt: 0.5, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {meta.join('  ·  ')}
          </Typography>
        )}
      </Box>
    </ListItemButton>
  );
};

const panelSx = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  height: { xs: 560, md: 720 },
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
} as const;

const panelHeaderSx = {
  px: 2,
  py: 1.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const;

const listSx = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  p: 0,
} as const;

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13, bgcolor: 'background.paper' },
} as const;

type ConfirmState = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
} | null;

const Stat = ({ label, value, muted }: { label: string, value: React.ReactNode, muted?: boolean }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.25 }}>{label}</Typography>
    <Typography sx={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: muted ? 'text.disabled' : 'text.primary' }}>
      {value}
    </Typography>
  </Box>
);

const TransferOrdersList = (props: Props) => {
  const [checked, setChecked] = React.useState<readonly number[]>([]);
  const [left, setLeft] = React.useState<readonly number[]>([]);
  const [right, setRight] = React.useState<readonly number[]>([]);

  const [ rightSearch, setRightSearch ] = React.useState('');
  const [ officeFilter, setOfficeFilter ] = React.useState<string[]>([]);
  const [ sortBy, setSortBy ] = React.useState<'none' | 'name' | 'customerId'>('none');
  const [ sortDir, setSortDir ] = React.useState<'asc' | 'desc'>('asc');

  const [ showResponseMessage, setShowResponseMessage ] = React.useState<String | undefined>();
  const [ isSucceed, setIsSucceed ] = React.useState<boolean>(false);
  const [ isLoading, setLoading ] = React.useState(false);
  const [ component, setComponent ] = React.useState<any>();
  const [ showDialog, setShowDialog ] = React.useState(false);
  const [ confirm, setConfirm ] = React.useState<ConfirmState>(null);

  React.useEffect(() => {
    const searchedOrders = props.orders.filter((order: any) => {
      const orderFound = right.find((data: any) => data?.paymentList?._id === order.paymentList?._id);
      if (orderFound) {
        return false;
      }
      return  true;
    })

    setLeft(searchedOrders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.orders])

  React.useEffect(() => {
    setRight(props.takenOrders);
  }, [props.takenOrders])

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  // المكاتب/الوجهات المتوفرة فعلياً داخل قائمة الجرد الحالية (shipment.toWhere)
  const availableOffices = React.useMemo(() => {
    const offices = new Set<string>();
    right.forEach((order: any) => {
      const office = order?.shipment?.toWhere;
      if (office) offices.add(office);
    });
    return Array.from(offices).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [right]);

  const sortOrders = (items: any[]) => {
    if (sortBy === 'none') return items;
    const sorted = [...items].sort((a: any, b: any) => {
      const aValue = sortBy === 'name'
        ? (a?.customerInfo?.fullName || '')
        : String(a?.user?.customerId ?? '');
      const bValue = sortBy === 'name'
        ? (b?.customerInfo?.fullName || '')
        : String(b?.user?.customerId ?? '');
      return aValue.localeCompare(bValue, 'ar', { numeric: true });
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  };

  const handleDownload = () => {
    const data: any = [[moment(props.inventory.inventoryFinishedDate).format('DD/MM/YYYY'), '', '', props.inventory.shippedCountry, '', '', props.inventory.voyage, '', '', `${props.inventory.voyageAmount} ${props.inventory.voyageCurrency} تكلفة الرحلة:`], [], ['العدد', 'اسم الزبون', 'رمز العميل', 'كود تتبع Exios', 'رقم تتبع الصين', 'رقم تتبع المصدر', 'وزن/حجم', 'نوع القياس', '$ السعر المحسوب', '$ سعر التكلفة', '$ تكلفة اكسيوس', '$ اجمالي التكلفة', 'موقعها', 'ملاحظات']];
    right.forEach((orderPackage: any, i) => {
      data.push([
        i + 1,
        orderPackage.customerInfo.fullName,
        orderPackage.user.customerId,
        orderPackage.orderId,
        orderPackage.paymentList.deliveredPackages.trackingNumber,
        orderPackage.paymentList.deliveredPackages.receiptNo,
        orderPackage.paymentList.deliveredPackages.weight.total,
        orderPackage.paymentList.deliveredPackages.weight.measureUnit,
        orderPackage.paymentList.deliveredPackages.exiosPrice,
        props.inventory.costPrice,
        calculateMinTotalPrice(orderPackage.paymentList.deliveredPackages.exiosPrice, orderPackage.paymentList.deliveredPackages.weight.total, props.inventory.shippedCountry, orderPackage.paymentList.deliveredPackages.weight.measureUnit),
        orderPackage.paymentList.deliveredPackages.weight.total * props.inventory.costPrice,
        orderPackage.paymentList.deliveredPackages.locationPlace,
        orderPackage.shipment.toWhere
      ])
    })
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    // Merge cells A1 and B1
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, props.inventory.voyage);
    XLSX.writeFile(workbook, `${props.inventory.voyage}.xlsx`);
  };

  const handleToggle = (value: number) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const numberOfChecked = (items: readonly number[]) => intersection(checked, items).length;

  const handleToggleAll = (items: readonly number[]) => () => {
    if (numberOfChecked(items) === items.length) {
      setChecked(not(checked, items));
    } else {
      setChecked(union(checked, items));
    }
  };

  const addInventoryToWarehouse = async (office: string) => {
    try {
      setLoading(true);
      const ids: any = [];
      rightChecked.forEach((order: any) => {
        ids.push({
          paymentList: {
            _id: order?.paymentList?._id
          }
        });
      })
      await api.update(`inventory/orders?office=${office}`, ids);
      setShowResponseMessage('تم اضافة طلبيات الى قائمة الجرد بنجاح');
      setIsSucceed(true);
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل في تحميل طلبيات الى قائمة الجرد يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const addInventoryToWarehouseWithConfirm = (office: string) => {
    if (rightChecked.length === 0) return;
    const officeLabel = office === 'tripoli' ? 'طرابلس' : 'بنغازي';
    setConfirm({
      title: `إضافة إلى مخزن ${officeLabel}`,
      message: `سيتم إضافة ${rightChecked.length} عنصر إلى مخزن ${officeLabel}.`,
      confirmLabel: 'إضافة',
      onConfirm: () => addInventoryToWarehouse(office),
    });
  };

  const handleCheckedRight = async () => {
    try {
      setLoading(true);
      const res = await api.update(`inventory/orders?id=${props.inventory?._id}`, leftChecked);
      const inventory = res.data;
      setLeft(not(left, leftChecked));
      setChecked([])
      setRight(inventory.orders);
      setShowResponseMessage('تم اضافة طلبيات الى قائمة الجرد بنجاح');
      setIsSucceed(true);
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل في تحميل طلبيات الى قائمة الجرد يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckedLeft = async () => {
    try {
      setLoading(true);
      const ids: any = [];
      rightChecked.forEach((order: any) => {
        ids.push(order.paymentList._id);
      })
      await api.delete(`inventory/orders?id=${props.inventory?._id}`, ids);
      setRight(not(right, rightChecked));
      setChecked(not(checked, rightChecked));
      setLeft(left);
      setShowResponseMessage('تم حذف طلبيات من قائمة الجرد بنجاح');
      setIsSucceed(true);
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل في حذف طلبيات من قائمة الجرد يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckedLeftWithConfirm = () => {
    if (rightChecked.length === 0) return;
    setConfirm({
      title: 'إزالة من قائمة الجرد',
      message: `سيتم حذف ${rightChecked.length} عنصر من قائمة الجرد.`,
      confirmLabel: 'إزالة',
      danger: true,
      onConfirm: handleCheckedLeft,
    });
  };

  const updateSelectedOrdersStatus = async () => {
    try {
      setLoading(true);
      const ids: any = [];
      rightChecked.forEach((order: any) => {
        ids.push({
          paymentListId: order?.paymentList?._id,
          orderId: order.orderId,
          trackingNumber: order?.paymentList?.deliveredPackages?.trackingNumber
        });
      })
      await api.update(`orders/status`, { data: ids, statusType: 'arrivedLibya', value: true, inventoryId: props.inventory?._id });
      setShowResponseMessage('تم تحديث طلبيات بنجاح');
      setIsSucceed(true);
      setChecked([])
      window.location.reload();
    } catch (error) {
      console.log(error);
      setShowResponseMessage('فشل الطلب، يرجى تحديث الصفحه ومحاولة مره اخرى');
      setIsSucceed(false);
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedOrdersStatusWithConfirm = () => {
    if (rightChecked.length === 0) return;
    setConfirm({
      title: 'تحديث الحالة إلى "وصلت ليبيا"',
      message: `سيتم تحديث حالة ${rightChecked.length} عنصر، ثم إعادة تحميل الصفحة.`,
      confirmLabel: 'تحديث',
      onConfirm: updateSelectedOrdersStatus,
    });
  };

  const panelHeader = (title: string, items: readonly number[], ariaLabel: string, trailing?: React.ReactNode, subtitle?: React.ReactNode) => (
    <Stack direction="row" alignItems="center" spacing={1.25}>
      <Checkbox
        size="small"
        sx={{ p: 0.5, ml: -0.5 }}
        onClick={handleToggleAll(items)}
        checked={numberOfChecked(items) === items.length && items.length !== 0}
        indeterminate={numberOfChecked(items) !== items.length && numberOfChecked(items) !== 0}
        disabled={items.length === 0}
        inputProps={{ 'aria-label': ariaLabel }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {subtitle}
        </Typography>
      </Box>
      {trailing}
    </Stack>
  );

  const customList = (title: string, items: readonly number[]) => {
    const selectedCount = numberOfChecked(items);

    return (
      <Box component="section" aria-label={title} sx={panelSx}>
        <Box sx={panelHeaderSx}>
          {panelHeader(
            title,
            items,
            'تحديد كل نتائج البحث',
            props.isSearching ? <CircularProgress size={16} thickness={5} /> : undefined,
            selectedCount > 0 ? `${selectedCount} محدد من ${items.length}` : `${items.length} طلبية`,
          )}
        </Box>

        <List sx={listSx} dense component="div" role="list">
          {props.isSearching ? (
            Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
          ) : items.length === 0 ? (
            <EmptyState title="لا توجد نتائج" hint="جرّب البحث باسم زبون آخر أو رقم تتبع مختلف." />
          ) : (
            items.map((value: any) => (
              <OrderRow
                key={value?._id}
                order={value}
                checked={checked.indexOf(value) !== -1}
                onToggle={handleToggle(value)}
                labelId={`transfer-list-all-item-${value?._id}-label`}
              />
            ))
          )}
        </List>
      </Box>
    )
  }

  const customListForChosen = (title: string, items: readonly number[]) => {
    const filteredItems = sortOrders(
      items
        .filter((order: any) => matchesCustomerSearch(order, rightSearch))
        .filter((order: any) => officeFilter.length === 0 || officeFilter.includes((order as any)?.shipment?.toWhere))
    );
    const isFiltered = !!rightSearch || officeFilter.length > 0;
    const selectedCount = numberOfChecked(filteredItems);
    const hasActiveChips = !!rightSearch || officeFilter.length > 0 || sortBy !== 'none';

    return (
      <Box component="section" aria-label={title} sx={panelSx}>
        <Box sx={{ ...panelHeaderSx, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.015) }}>
          {panelHeader(
            title,
            filteredItems,
            'تحديد كل عناصر قائمة الجرد',
            undefined,
            <>
              {selectedCount > 0 ? `${selectedCount} محدد من ${filteredItems.length}` : `${filteredItems.length} طلبية`}
              {isFiltered ? ` · من أصل ${items.length}` : ''}
            </>,
          )}

          <TextField
            size="small"
            fullWidth
            placeholder="بحث بالاسم، رمز العميل، أو رقم التتبع"
            value={rightSearch}
            onChange={(e) => setRightSearch(e.target.value)}
            sx={{ ...fieldSx, mt: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
                  <AiOutlineSearch />
                </InputAdornment>
              ),
              endAdornment: rightSearch ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRightSearch('')} aria-label="مسح البحث">
                    <IoIosCloseCircle />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <FormControl size="small" sx={{ ...fieldSx, flex: 1, minWidth: 0 }}>
              <Select
                displayEmpty
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'none' | 'name' | 'customerId')}
                renderValue={(value) => (
                  <Typography sx={{ fontSize: 13 }} noWrap>
                    {value === 'name' ? 'ترتيب: الاسم' : value === 'customerId' ? 'ترتيب: رمز العميل' : 'بدون ترتيب'}
                  </Typography>
                )}
              >
                <MenuItem value="none">بدون ترتيب</MenuItem>
                <MenuItem value="name">الاسم (أ-ي)</MenuItem>
                <MenuItem value="customerId">رمز العميل</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={sortDir === 'asc' ? 'تصاعدي — اضغط للعكس' : 'تنازلي — اضغط للعكس'} arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                  disabled={sortBy === 'none'}
                  aria-label="عكس اتجاه الترتيب"
                  sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                >
                  {sortDir === 'asc' ? <FaSortAlphaDown size={14} /> : <FaSortAlphaUp size={14} />}
                </IconButton>
              </span>
            </Tooltip>

            {availableOffices.length > 0 && (
              <FormControl size="small" sx={{ ...fieldSx, flex: 1, minWidth: 0 }}>
                <Select
                  multiple
                  displayEmpty
                  value={officeFilter}
                  onChange={(e) => setOfficeFilter(
                    typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[])
                  )}
                  renderValue={(selected: any) => (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <FaBuilding size={11} />
                      <Typography sx={{ fontSize: 13 }} noWrap>
                        {selected.length === 0 ? 'كل المكاتب' : `${selected.length} مكتب`}
                      </Typography>
                    </Stack>
                  )}
                >
                  {availableOffices.map((office) => (
                    <MenuItem key={office} value={office}>
                      <Checkbox size="small" checked={officeFilter.indexOf(office) > -1} />
                      {office}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {hasActiveChips && (
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 1, rowGap: 0.5 }}>
              {rightSearch && (
                <Chip size="small" sx={{ borderRadius: 1 }} label={`بحث: ${rightSearch}`} onDelete={() => setRightSearch('')} />
              )}
              {officeFilter.map((office) => (
                <Chip
                  key={office}
                  size="small"
                  sx={{ borderRadius: 1 }}
                  label={office}
                  onDelete={() => setOfficeFilter(officeFilter.filter((o) => o !== office))}
                />
              ))}
              {sortBy !== 'none' && (
                <Chip
                  size="small"
                  sx={{ borderRadius: 1 }}
                  label={sortBy === 'name' ? 'ترتيب بالاسم' : 'ترتيب برمز العميل'}
                  onDelete={() => setSortBy('none')}
                />
              )}
              <Button
                size="small"
                onClick={() => { setRightSearch(''); setOfficeFilter([]); setSortBy('none'); }}
                sx={{ minWidth: 0, px: 0.75, fontSize: 12, color: 'text.secondary' }}
              >
                مسح الكل
              </Button>
            </Stack>
          )}
        </Box>

        <List sx={listSx} dense component="div" role="list">
          {filteredItems.length === 0 ? (
            isFiltered
              ? <EmptyState title="لا توجد نتائج مطابقة" hint="غيّر كلمة البحث أو أزل تصفية المكاتب." />
              : <EmptyState title="قائمة الجرد فارغة" hint="حدّد طلبيات من نتائج البحث ثم اضغط «إضافة» لنقلها هنا." />
          ) : (
            filteredItems.map((order: any) => (
              <OrderRow
                key={order?._id}
                order={order}
                checked={checked.indexOf(order) !== -1}
                onToggle={handleToggle(order)}
                labelId={`transfer-list-chosen-item-${order?._id}-label`}
                detailed
              />
            ))
          )}
        </List>
      </Box>
    )
  }

  const Tag = component === 'ActivityDialog' ? ActivityDialog : EditPackageWeight;

  const totalWeight = sumWeights(right);
  const selectedWeight = sumWeights(rightChecked);
  const selectedCount = leftChecked.length + rightChecked.length;

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
      <Box
        component="header"
        sx={{
          mb: 2,
          p: { xs: 2, sm: 2.5 },
          pb: { xs: 2.25, sm: 2.75 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <FaWarehouse size={17} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" noWrap sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {props.inventory?.voyage || 'قائمة الجرد'}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {[props.inventory?.shippedCountry, props.inventory?.inventoryFinishedDate ? moment(props.inventory.inventoryFinishedDate).format('DD/MM/YYYY') : ''].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Stack>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FaFileExcel size={13} />}
            onClick={handleDownload}
            sx={{
              flexShrink: 0,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 500,
              color: 'text.primary',
              borderColor: 'divider',
              '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
            }}
          >
            تصدير Excel
          </Button>
        </Stack>

        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, minmax(0, 180px))' },
            gap: 2,
          }}
        >
          <Stat label="عناصر بالجرد" value={right.length} />
          <Stat label="الوزن الكلي" value={formatWeight(totalWeight)} muted={!totalWeight.total} />
          <Stat label="المحدد" value={selectedCount} muted={!selectedCount} />
          <Stat label="وزن المحدد" value={formatWeight(selectedWeight)} muted={!selectedWeight.total} />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 176px minmax(0, 1.2fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {customList('نتائج البحث', left)}

        <Box
          component="nav"
          aria-label="إجراءات الطلبيات المحددة"
          sx={{
            position: { md: 'sticky' },
            top: { md: 16 },
            alignSelf: { md: 'center' },
            p: 0.75,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', md: '1fr' },
            gap: 0.25,
          }}
        >
          <Box sx={{ gridColumn: '1 / -1' }}><RailLabel>نقل</RailLabel></Box>
          <ActionButton
            icon={<FaArrowRight />}
            label="إضافة"
            tooltip="إضافة العناصر المحددة إلى قائمة الجرد"
            tone="primary"
            count={leftChecked.length}
            onClick={handleCheckedRight}
            disabled={leftChecked.length === 0}
          />
          <ActionButton
            icon={<FaArrowLeft />}
            label="إزالة"
            tooltip="إزالة العناصر المحددة من قائمة الجرد"
            tone="danger"
            count={rightChecked.length}
            onClick={handleCheckedLeftWithConfirm}
            disabled={rightChecked.length === 0}
          />

          <Divider sx={{ gridColumn: '1 / -1', my: 0.75 }} />
          <Box sx={{ gridColumn: '1 / -1' }}><RailLabel>الطلبيات المحددة</RailLabel></Box>
          <ActionButton
            icon={<FaWarehouse />}
            label="وصلت ليبيا"
            tooltip="تحديد حالة العناصر المحددة: وصلت ليبيا"
            onClick={updateSelectedOrdersStatusWithConfirm}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<FaWhatsapp />}
            label="واتساب"
            tooltip="إرسال رسالة واتساب / إضافة نشاط للعناصر المحددة"
            onClick={() => {
              setComponent('ActivityDialog');
              setShowDialog(true);
            }}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<FaWeight />}
            label="تعديل الوزن"
            tooltip="تعديل الوزن (عنصر واحد فقط)"
            onClick={() => {
              setComponent('EditPackageWeight');
              setShowDialog(true);
            }}
            disabled={rightChecked.length !== 1}
          />

          <Divider sx={{ gridColumn: '1 / -1', my: 0.75 }} />
          <Box sx={{ gridColumn: '1 / -1' }}><RailLabel>نقل إلى مخزن</RailLabel></Box>
          <ActionButton
            icon={<IoIosListBox />}
            label="طرابلس"
            tooltip="إضافة العناصر المحددة إلى مخزن طرابلس"
            onClick={() => addInventoryToWarehouseWithConfirm('tripoli')}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<IoIosListBox />}
            label="بنغازي"
            tooltip="إضافة العناصر المحددة إلى مخزن بنغازي"
            onClick={() => addInventoryToWarehouseWithConfirm('benghazi')}
            disabled={rightChecked.length === 0}
          />
        </Box>

        {customListForChosen('قائمة الجرد', right)}
      </Box>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className='p-5' fullWidth>
        <Tag
          checked={checked}
          setShowDialog={setShowDialog}
          package={rightChecked[0]}
          inventory={props.inventory}
          fetchSelectedOrders={props.fetchSelectedOrders}
          setChecked={() => setChecked([])}
        />
      </Dialog>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontSize: 17, fontWeight: 600, pb: 0.5 }}>{confirm?.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{confirm?.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} sx={{ color: 'text.secondary' }}>إلغاء</Button>
          <Button
            variant="contained"
            color={confirm?.danger ? 'error' : 'primary'}
            disableElevation
            autoFocus
            sx={{ borderRadius: 1.5 }}
            onClick={() => {
              const action = confirm?.onConfirm;
              setConfirm(null);
              action?.();
            }}
          >
            {confirm?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!showResponseMessage}
        autoHideDuration={6000}
        onClose={() => setShowResponseMessage(undefined)}
      >
        <Alert
          severity={isSucceed ? 'success' : 'error'}
          sx={{ width: '100%' }}
          onClose={() => setShowResponseMessage(undefined)}
        >
          {showResponseMessage}
        </Alert>
      </Snackbar>

      <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={isLoading}
        >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
}

const sumWeights = (orders: any) => {
  let total = 0;
  let unit = '';
  orders.forEach((order: any) => {
    if (!unit) {
      unit = order?.paymentList?.deliveredPackages?.weight?.measureUnit || '';
    }
    total += order?.paymentList?.deliveredPackages?.weight?.total || 0;
  })
  return { total: Math.round(total * 100) / 100, unit };
}

const formatWeight = ({ total, unit }: { total: number, unit: string }) => (
  <>
    {total.toLocaleString('en-US')}
    {unit && <Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>{unit}</Box>}
  </>
);

export default TransferOrdersList;
