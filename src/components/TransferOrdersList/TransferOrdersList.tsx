import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import Badge from '../Badge/Badge';
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

type PanelColor = 'success' | 'error' | 'info' | 'warning' | 'primary' | 'secondary';

type ActionButtonProps = {
  icon: React.ReactNode
  label: string
  tooltip: string
  color: PanelColor
  onClick: () => void
  disabled?: boolean
}

const ActionButton = ({ icon, label, tooltip, color, onClick, disabled }: ActionButtonProps) => (
  <Tooltip title={tooltip} arrow placement="top">
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <IconButton
        color={color}
        onClick={onClick}
        disabled={disabled}
        size="small"
        aria-label={tooltip}
        sx={{
          border: '1px solid',
          borderColor: disabled ? 'divider' : `${color}.main`,
          borderRadius: 2,
          width: 46,
          height: 46,
        }}
      >
        {icon}
      </IconButton>
      <Typography
        variant="caption"
        sx={{ mt: 0.25, fontSize: 10, lineHeight: 1.2, color: disabled ? 'text.disabled' : 'text.secondary' }}
      >
        {label}
      </Typography>
    </span>
  </Tooltip>
);

const EmptyState = ({ text }: { text: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 340, color: 'text.disabled' }}>
    <AiOutlineInbox size={40} />
    <Typography variant="body2" sx={{ mt: 1 }}>{text}</Typography>
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
      const inventoryId = office === 'tripoli' ? '65df50f59f69b8fcc658762b' : '65df51099f69b8fcc6587636';
      await api.update(`inventory/orders?id=${inventoryId}`, ids);
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
    const confirmed = window.confirm(`هل أنت متأكد من إضافة ${rightChecked.length} عنصر إلى مخزن ${officeLabel}؟`);
    if (confirmed) addInventoryToWarehouse(office);
  };

  const handleCheckedRight = async () => {
    try {
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
    const confirmed = window.confirm(`هل أنت متأكد من حذف ${rightChecked.length} عنصر من قائمة الجرد؟`);
    if (confirmed) handleCheckedLeft();
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
    const confirmed = window.confirm(`هل أنت متأكد من تحديث حالة ${rightChecked.length} عنصر إلى "وصلت ليبيا"؟ سيتم إعادة تحميل الصفحة.`);
    if (confirmed) updateSelectedOrdersStatus();
  };

  const customList = (title: string, items: readonly number[]) => {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          width: { xs: '100%', sm: 400 },
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 12px rgba(20, 30, 60, 0.06)',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            background: (theme) => `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Checkbox
              onClick={handleToggleAll(items)}
              checked={numberOfChecked(items) === items.length && items.length !== 0}
              indeterminate={
                numberOfChecked(items) !== items.length && numberOfChecked(items) !== 0
              }
              disabled={items.length === 0}
              inputProps={{
                'aria-label': 'تحديد كل نتائج البحث',
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {numberOfChecked(items)} / {items.length} محدد
              </Typography>
            </Box>
            {props.isSearching && <CircularProgress size={18} />}
          </Stack>
        </Box>

        <List
          sx={{
            width: '100%',
            height: 420,
            bgcolor: 'background.paper',
            overflow: 'auto',
            p: 0,
          }}
          dense
          component="div"
          role="list"
        >
          {props.isSearching ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : items.length === 0 ? (
            <EmptyState text="لا توجد نتائج بحث" />
          ) : (
            items.map((value: any) => {
              const labelId = `transfer-list-all-item-${value?._id}-label`;
              const isItemChecked = checked.indexOf(value) !== -1;

              return (
                <ListItemButton
                  key={value?._id}
                  role="listitem"
                  selected={isItemChecked}
                  onClick={handleToggle(value)}
                  sx={{ alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 1.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    <Checkbox
                      edge="start"
                      checked={isItemChecked}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{
                        'aria-labelledby': labelId,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={
                      <Stack spacing={0.5}>
                        <p className='m-0'>
                          <a
                            style={{ textDecoration: 'none' }}
                            className='m-0'
                            href={`/invoice/${value?._id}/edit`}
                            target='__blank'
                            onClick={(e) => e.stopPropagation()}
                          >
                            {value.orderId}
                          </a>
                        </p>
                        <p className='m-0'>{`${value?.customerInfo?.fullName}`}</p>
                        <Badge text={`Tracking Number: ${value?.paymentList?.deliveredPackages?.trackingNumber} `} />
                        <br />
                        {value?.paymentList?.deliveredPackages?.receiptNo && <Badge text={`Receipt number: ${value?.paymentList?.deliveredPackages?.receiptNo} `} /> }
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })
          )}
        </List>
      </Paper>
    )
  }

  const customListForChosen = (title: string, items: readonly number[]) => {
    const filteredItems = sortOrders(
      items
        .filter((order: any) => matchesCustomerSearch(order, rightSearch))
        .filter((order: any) => officeFilter.length === 0 || officeFilter.includes((order as any)?.shipment?.toWhere))
    );
    const weight = calculateWeightsOfPackages(rightChecked);
    const isFiltered = !!rightSearch || officeFilter.length > 0;

    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          width: { xs: '100%', sm: 400 },
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 12px rgba(20, 30, 60, 0.06)',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            background: (theme) => `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.07)} 0%, ${alpha(theme.palette.success.main, 0.01)} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Checkbox
              onClick={handleToggleAll(filteredItems)}
              checked={numberOfChecked(filteredItems) === filteredItems.length && filteredItems.length !== 0}
              indeterminate={
                numberOfChecked(filteredItems) !== filteredItems.length && numberOfChecked(filteredItems) !== 0
              }
              disabled={filteredItems.length === 0}
              inputProps={{
                'aria-label': 'تحديد كل عناصر قائمة الجرد',
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {numberOfChecked(filteredItems)} / {filteredItems.length}{isFiltered ? ` (من أصل ${items.length})` : ''} محدد
              </Typography>
            </Box>
            <Tooltip title="تصدير قائمة الجرد إلى Excel" arrow>
              <span>
                <IconButton size="small" color="success" onClick={handleDownload} aria-label="تصدير Excel">
                  <FaFileExcel />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {weight.length > 2 && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }} color="text.secondary">
              الوزن الإجمالي للمحدد: {weight}
            </Typography>
          )}

          <TextField
            size="small"
            fullWidth
            placeholder="بحث بالاسم، رمز العميل، أو رقم التتبع"
            value={rightSearch}
            onChange={(e) => setRightSearch(e.target.value)}
            sx={{ mt: 1.9, bgcolor: 'background.paper', borderRadius: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
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
            <FormControl size="small" sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', borderRadius: 1.5 }}>
              <Select
                displayEmpty
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'none' | 'name' | 'customerId')}
                renderValue={(value) => (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    {sortDir === 'asc' ? <FaSortAlphaDown size={12} /> : <FaSortAlphaUp size={12} />}
                    <Typography variant="caption" noWrap>
                      {value === 'name' ? 'ترتيب: الاسم' : value === 'customerId' ? 'ترتيب: رمز العميل' : 'بدون ترتيب'}
                    </Typography>
                  </Stack>
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
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                >
                  {sortDir === 'asc' ? <FaSortAlphaDown size={14} /> : <FaSortAlphaUp size={14} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {availableOffices.length > 0 && (
            <FormControl size="small" fullWidth sx={{ mt: 1, bgcolor: 'background.paper', borderRadius: 1.5 }}>
              <Select
                multiple
                displayEmpty
                value={officeFilter}
                onChange={(e) => setOfficeFilter(
                  typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[])
                )}
                renderValue={(selected: any) => (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <FaBuilding size={12} />
                    <Typography variant="caption" noWrap>
                      {selected.length === 0 ? 'كل المكاتب / الوجهات' : `${selected.length} مكتب محدد`}
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

          {(rightSearch || officeFilter.length > 0 || sortBy !== 'none') && (
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 1, rowGap: 0.5 }}>
              {rightSearch && (
                <Chip size="small" label={`بحث: ${rightSearch}`} onDelete={() => setRightSearch('')} />
              )}
              {officeFilter.map((office) => (
                <Chip
                  key={office}
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={office}
                  onDelete={() => setOfficeFilter(officeFilter.filter((o) => o !== office))}
                />
              ))}
              {sortBy !== 'none' && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={sortBy === 'name' ? 'ترتيب بالاسم' : 'ترتيب برمز العميل'}
                  onDelete={() => setSortBy('none')}
                />
              )}
            </Stack>
          )}
        </Box>

        <List
          sx={{
            width: '100%',
            height: 420,
            bgcolor: 'background.paper',
            overflow: 'auto',
            p: 0,
          }}
          dense
          component="div"
          role="list"
        >
          {filteredItems.length === 0 ? (
            <EmptyState text={isFiltered ? 'لا توجد نتائج مطابقة لبحثك أو تصفيتك' : 'لا توجد طلبيات في قائمة الجرد'} />
          ) : (
            filteredItems.map((order: any) => {
              const labelId = `transfer-list-chosen-item-${order?._id}-label`;
              const isItemChecked = checked.indexOf(order) !== -1;

              return (
                <ListItemButton
                  key={order?._id}
                  role="listitem"
                  selected={isItemChecked}
                  onClick={handleToggle(order)}
                  sx={{ alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 1.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    <Checkbox
                      edge="start"
                      checked={isItemChecked}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{
                        'aria-labelledby': labelId,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={
                      <Stack spacing={0.5}>
                        <p className='m-0 d-flex gap-2'>
                          <a
                            style={{ textDecoration: 'none' }}
                            className='m-0'
                            href={`/invoice/${order?._id}/edit`}
                            target='__blank'
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order?.orderId}
                          </a>
                          <Badge text={`${order?.paymentList?.status?.arrivedLibya ? 'وصلت ليبيا' : 'لم تصل ليبيا'} `} />
                          {order?.paymentList?.status?.received && <Badge text={'تم تسليم'} color="success" />}
                        </p>
                        <p className='m-0'>{`${order?.customerInfo?.fullName}`}</p>
                        <Badge text={`Tracking Number: ${order?.paymentList?.deliveredPackages?.trackingNumber} `} />
                        <br />
                        {order?.paymentList?.deliveredPackages?.receiptNo && <Badge text={`Receipt number: ${order?.paymentList?.deliveredPackages?.receiptNo} `} /> }
                        <div className='d-flex gap-3 mt-2 align-items-center'>
                          {!!order?.paymentList?.deliveredPackages?.weight?.total && <Badge text={`${order.paymentList.deliveredPackages?.weight.total} ${order.paymentList?.deliveredPackages?.weight?.measureUnit}`} />}
                          {order?.shipment?.fromWhere && <div><Badge text={`${order?.shipment?.toWhere}`} /></div>}
                          {order?.paymentList?.deliveredPackages?.locationPlace && <Badge text={`${order?.paymentList?.deliveredPackages?.locationPlace}`} />}
                        </div>
                        <div className='mt-2'>{order?.paymentList?.deliveredPackages?.boxesCount && <Badge text={`Boxes Count: ${order?.paymentList?.deliveredPackages?.boxesCount}`} />}</div>
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })
          )}
        </List>
      </Paper>
    )
  }

  const Tag = component === 'ActivityDialog' ? ActivityDialog : EditPackageWeight;

  const totalWeight = calculateWeightsOfPackages(right);

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: { xs: 1.75, sm: 2.25 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                color: 'primary.main',
                boxShadow: '0 2px 8px rgba(20, 30, 60, 0.08)',
                flexShrink: 0,
              }}
            >
              <FaWarehouse size={18} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {props.inventory?.voyage || 'قائمة الجرد'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[props.inventory?.shippedCountry, props.inventory?.inventoryFinishedDate ? moment(props.inventory.inventoryFinishedDate).format('DD/MM/YYYY') : ''].filter(Boolean).join(' • ')}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
            <Chip size="small" color="primary" variant="outlined" sx={{ bgcolor: 'background.paper' }} label={`${right.length} عنصر بالجرد`} />
            {totalWeight.length > 2 && (
              <Chip size="small" variant="outlined" sx={{ bgcolor: 'background.paper' }} label={`الوزن الكلي: ${totalWeight}`} />
            )}
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="center" alignItems="flex-start" flexWrap="wrap">
        <Box>{customList('نتائج البحث', left)}</Box>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            p: 1.25,
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            minWidth: { md: 88 },
            alignSelf: { xs: 'stretch', md: 'center' },
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 2px 12px rgba(20, 30, 60, 0.06)',
          }}
        >
          <ActionButton
            icon={<FaArrowRight />}
            label="إضافة"
            tooltip="إضافة العناصر المحددة إلى قائمة الجرد"
            color="success"
            onClick={handleCheckedRight}
            disabled={leftChecked.length === 0}
          />
          <ActionButton
            icon={<FaArrowLeft />}
            label="إزالة"
            tooltip="إزالة العناصر المحددة من قائمة الجرد"
            color="error"
            onClick={handleCheckedLeftWithConfirm}
            disabled={rightChecked.length === 0}
          />

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'block', md: 'none' } }} />
          <Divider flexItem sx={{ display: { xs: 'none', md: 'block' }, my: 0.25 }} />

          <ActionButton
            icon={<FaWarehouse />}
            label="وصلت"
            tooltip="تحديد حالة العناصر المحددة: وصلت ليبيا"
            color="info"
            onClick={updateSelectedOrdersStatusWithConfirm}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<FaWhatsapp />}
            label="واتساب"
            tooltip="إرسال رسالة واتساب / إضافة نشاط للعناصر المحددة"
            color="success"
            onClick={() => {
              setComponent('ActivityDialog');
              setShowDialog(true);
            }}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<FaWeight />}
            label="الوزن"
            tooltip="تعديل الوزن (عنصر واحد فقط)"
            color="warning"
            onClick={() => {
              setComponent('EditPackageWeight');
              setShowDialog(true);
            }}
            disabled={rightChecked.length !== 1}
          />

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'block', md: 'none' } }} />
          <Divider flexItem sx={{ display: { xs: 'none', md: 'block' }, my: 0.25 }} />

          <ActionButton
            icon={<IoIosListBox />}
            label="طرابلس"
            tooltip="إضافة العناصر المحددة إلى مخزن طرابلس"
            color="primary"
            onClick={() => addInventoryToWarehouseWithConfirm('tripoli')}
            disabled={rightChecked.length === 0}
          />
          <ActionButton
            icon={<IoIosListBox />}
            label="بنغازي"
            tooltip="إضافة العناصر المحددة إلى مخزن بنغازي"
            color="secondary"
            onClick={() => addInventoryToWarehouseWithConfirm('benghazi')}
            disabled={rightChecked.length === 0}
          />
        </Paper>

        <Box>{customListForChosen('قائمة الجرد', right)}</Box>
      </Stack>

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

const calculateWeightsOfPackages = (orders: any) => {
  let weight = 0;
  let unit = '';
  orders.forEach((order: any) => {
    if (!unit) {
      unit = order?.paymentList?.deliveredPackages?.weight?.measureUnit || '';
    }
    weight += order?.paymentList?.deliveredPackages?.weight?.total || 0;
  })
  return `${weight} ${unit}`;
}

export default TransferOrdersList;
