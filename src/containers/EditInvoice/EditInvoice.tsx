import { connect } from 'react-redux'
import React, { Component } from 'react'
import { Alert, Autocomplete, Avatar, AvatarGroup, Backdrop, Breadcrumbs, Button, ButtonGroup, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, Snackbar, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import Card from '../../components/Card/Card'
import ImageUploader from '../../components/ImageUploader/ImageUploader'
import InvoiceForm from '../../components/InvoiceForm/InvoiceForm'
import CustomButton from '../../components/CustomButton/CustomButton'
import api from '../../api'
import { Account, Debt, Invoice, OrderActivity, OrderItem, User } from '../../models'
import withRouter from '../../utils/WithRouter/WithRouter'
import { RouteMatch } from 'react-router-dom'
import { calculateTotalWallet, getOrderSteps } from '../../utils/methods'
import QRCode from 'qrcode.react'
import { formatInvoiceFields } from '../XTrackingPage/utils'
import { isMobile } from 'react-device-detect';
import * as htmlToImage from 'html-to-image';

import './EditInvoice.scss';
import moment from 'moment'
import { FaCopy } from 'react-icons/fa'
import { MdOutlineLibraryAddCheck } from 'react-icons/md'
import { InvoiceTemplate } from '../../components/InvoiceTemplate/InvoiceTemplate'
import UseWalletBalance from '../UserDetails/UseWalletBalance'
import CreateDebtDialog from '../../components/DebtsPage/CreateDebtDialog'
import PayCashDialog from '../../components/PayCash/PayCashDialog'
import SwipeableTextMobileStepper from '../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper'
import PackagesList from '../../components/PackagesList/PackagesList'
import EditInvoiceItems from '../../components/EditInvoiceItems/EditInvoiceItems'
import Badge from '../../components/Badge/Badge'

type Props = {
  router: RouteMatch
  isEmployee: boolean
  account: Account
}

type State = {
  formData: Invoice | any
  employees: User[]
  changedFields: Invoice | any
  isInvoicePending: boolean
  paymentList: any[]
  items: any[]
  activity: OrderActivity,
  isError: boolean
  isUpdating: boolean
  isFinished: boolean
  resMessage: string | null
  whatsupMessage: string
  qrCode: null
  shouldVerifyQrCode: boolean
  isCancelOrderDialogOpen: boolean
  cancelationReason: string
  shippingLabelDialogOpen: boolean
  shippingMethodForLabel: 'air' | 'sea'
  inspectionCheckbox: boolean
  userDebts: Debt[]
  codeRef: any
  showPreviewInvoice: boolean
  walletDialog: boolean
  wallet: any
  debtDialog: boolean
  payCashDialog: boolean
  paymentHistory: any[]
  previewImages: any
  category: any
  selectedPackages: any[]
  openEditInvoiceDialog: boolean
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Link underline="hover" key="2" color="inherit" href="/invoices">
    Invoices
  </Link>,
  <Typography key="3" color='#28323C'>
    Edit Invoice
  </Typography>,
];

export const countries = ['الصين', 'امريكا', 'بريطانيا', 'تركيا', 'الامارات', 'طرابلس', 'بنغازي'];
export const orderActions = [
  'تم شراء المنتجات، الان في مرحلة انتظار البضائع للوصول الى مخزننا',
  'وصلت البضائع الى المخزن، الان في مرحلة التجهيز والشحن الى ليبيا',
  '...وصل طرد ينتهي رقم التتبع الصيني ب',
  'وصلت البضائع الى مخازن طرابلس، يرجى تواصل مع الشركة للاستلام',
  'وصلت البضاعة الى طرابلس، والان متجهه الى بنغازي',
  'وصلت البضائع الى مخازن بنغازي، يرجى تواصل مع الشركة للاستلام',
  'تم استلام البضائع من طرف السيد ... شكرا لتعاملكم معنا'
];

export class EditInvoice extends Component<Props, State> {

  state: State = {
    formData: null,
    employees: [],
    changedFields: [],
    isInvoicePending: true,
    paymentList: [],
    items: [],
    activity: {
      country: '',
      description: ''
    },
    isError: false,
    isUpdating: false,
    isFinished: false,
    resMessage: null,
    whatsupMessage: '',
    qrCode: null,
    shouldVerifyQrCode: false,
    isCancelOrderDialogOpen: false,
    cancelationReason: '',
    shippingLabelDialogOpen: false,
    shippingMethodForLabel: 'air',
    inspectionCheckbox: false,
    userDebts: [],
    codeRef: React.createRef(),
    showPreviewInvoice: false,
    walletDialog: false,
    wallet: null,
    debtDialog: false,
    payCashDialog: false,
    paymentHistory: [],
    previewImages: undefined,
    category: undefined,
    selectedPackages: [],
    openEditInvoiceDialog: false
  }

  async componentDidMount() {
    try {
      const order = (await api.get(`order/${this.props.router.params.id}`)).data;
      const employees = (await api.get(`employees`)).data?.results;
      const userDebts = (await api.get(`debts/user/${order?.user?.customerId}`)).data || [];
      const walletResponse = (await api.get(`wallet/${order?.user?._id}`)).data;
      const paymentHistoryResponse = (await api.get(`order/${order?._id}/payments`)).data;

      this.setState({ paymentHistory: paymentHistoryResponse.results, wallet: walletResponse.results, userDebts, formData: order, paymentList: order?.paymentList, items: order?.items, employees, isInvoicePending: false, shippingMethodForLabel: order.shipment.method })
    } catch (error) {
      console.log(error);
    }
  }

  addNewItemForOrder = () => {
    const newLink = {
      index: Math.floor(Math.random() * 1000),
      description: '',
      quantity: 1,
      unitPrice: 0
    };
    
    this.setState((prevState: any) => ({
      formData: {
        ...prevState.formData,
        items: [...prevState.formData.items, newLink]
      },
      changedFields: {
        ...this.state.changedFields,
        items: [...prevState.formData.items, newLink]
      },
      items: [...prevState.formData.items, newLink]
    }));
  }

  addNewPaymentField = () => {
    const newLink = {
      index: Math.floor(Math.random() * 1000),
      link: '',
      status: {
        paid: false,
        arrived: false,
        arrivedLibya: false,
        received: false,
      },
      note: '',
      settings: {
        visableForClient: true
      },
      deliveredPackages: {
        trackingNumber: '',
        arrivedAt: new Date(),
        weight: {
          total: null,
          measureUnit: null
        },
        containerInfo: {
          billOfLading: ''
        }
      }
    };
    
    this.setState((prevState: any) => ({
      formData: {
        ...prevState.formData,
        paymentList: [...prevState.formData.paymentList, newLink]
      },
      changedFields: {
        ...this.state.changedFields,
        paymentList: [...prevState.formData.paymentList, newLink]
      },
      paymentList: [...prevState.paymentList, newLink]
    }));
  }

  deteteItemRow = () => {
    const { items } = this.state;
    // delete last row of the list
    // in v2, I will delete rows depending on his index
    if (items?.length > 1) {
      items.pop();
      this.setState({
        items,
        formData: {
          ...this.state.formData,
          items
        },
        changedFields: {
          ...this.state.changedFields,
          items
        }
      });
    }
  }

  deteteRow = () => {
    const { paymentList } = this.state;
    // delete last row of the list
    // in v2, I will delete rows depending on his index
    if (paymentList?.length > 1) {
      paymentList.pop();
      this.setState({
        paymentList,
        formData: {
          ...this.state.formData,
          paymentList
        },
        changedFields: {
          ...this.state.changedFields,
          paymentList
        }
      });
    }
  }

  setFormState = (value: any, name: string, id: number, child?: any) => {    
    if (name === 'fullName' || name === 'email' || name === 'phone') {
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          customerInfo: {
            ...oldValues.changedFields?.customerInfo,
            [name]: value
          }
        }
      }))
    } else if (
        name === 'fromWhere' || 
        name === 'toWhere' || 
        name === 'packageCount' || 
        name === 'exiosShipmentPrice' || 
        name === 'method' || 
        name === 'originShipmentPrice' || 
        name === 'weight') 
      {
        this.setState((oldValues) => ({
          changedFields: {
            ...oldValues.changedFields,
            shipment: {
              ...oldValues.changedFields?.shipment,
              [name]: value
            }
          }
        }))
    } else if (name === 'debt' || name === 'currency') {
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          debt: {
            ...oldValues.changedFields?.debt,
            [name === 'debt' ? 'total' : name]: value
          }
        }
      }))
    } else if (name === 'credit' || name === 'creditCurrency') {
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          credit: {
            ...oldValues.changedFields?.credit,
            [name === 'credit' ? 'total' : name]: value
          }
        }
      }))
    } else if (name === 'netIncome') {
      const netIncome = [...this.state.formData.netIncome];
      // modify the payment income of the invoice
      // the first element of the income is the net invoice
      netIncome[0] = {
        nameOfIncome: 'payment',
        total: value
      };
      
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          netIncome
        }
      }))
    } else if (['trackingNumber', 'packageWeight', 'measureUnit', 'originPrice', 'exiosPrice', 'receiptNo', 'locationPlace', 'containerNumber', 'receivedShipmentLYDPackage', 'receivedShipmentUSDPackage', 'arrivedAt', 'visableForClient', 'shipmentMethod'].includes(name)) {      
      const fieldName = formatInvoiceFields(name);
      const fieldId = child ? Number(child.props.id) : id;      
      let paymentList: any = [...this.state.paymentList!];
      
      if (fieldName === 'weight') {
        paymentList[fieldId]['deliveredPackages']['weight'].total = value;
      } else if (fieldName === 'measureUnit') {        
        paymentList[fieldId]['deliveredPackages']['weight'].measureUnit = value;
      } else if (fieldName === 'visableForClient') {
        paymentList[fieldId]['settings'].visableForClient = value;        
      } else if (fieldName === 'containerInfo') {
        paymentList[fieldId]['deliveredPackages']['containerInfo'].billOfLading = value || '';   
      } else {
        paymentList[fieldId]['deliveredPackages'][fieldName] = value;
      }
      
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          paymentList
        }
      }))
    } else if (['description', 'itemQuantity', 'unitPrice'].includes(name)) {
      const fieldName = formatInvoiceFields(name);
      const index = id;
      let items: any = [...this.state.items!];
      items[index][fieldName] = value;
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          items
        }
      }))

    } else {            
      this.setState((oldValues) => ({
        changedFields: {
          ...oldValues.changedFields,
          [name]: value
        }
      }))
    }
  }

  handleChange = (event: any, checked?: any, child?: any, customFieldName?: string) => {
    const fieldName = customFieldName ? customFieldName : event.target.name;
    
    if (['paid', 'arrived', 'arrivedLibya', 'received', 'paymentLink', 'note'].includes(fieldName)) {      
      let paymentList: any = [...this.state.paymentList!];
      let inputValue;
      if (['paid', 'arrived', 'arrivedLibya', 'received'].includes(fieldName)) {
        inputValue = paymentList[event.target.id].status[fieldName];
        paymentList[event.target.id].status[fieldName] = !inputValue;
      } else if (fieldName === 'paymentLink') {
        inputValue = paymentList[event.target.id]['link'];
        paymentList[event.target.id]['link'] = event.target.value;
      } else {
        inputValue = paymentList[event.target.id][fieldName];
        paymentList[event.target.id][fieldName] = event.target.value;
      }
      this.setState({ paymentList, changedFields: { ...this.state.changedFields, paymentList } });
    } else {
      let value = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;
      // if checked has a value
      if (checked === false || checked === true) {
        value = checked;
      }      

      this.setFormState(value, fieldName, event.target.id, child)
    }
  };

  deleteImage = (file: any) => {
    this.setState({ isUpdating: true });
    const foundImage = this.state.formData.images.find(((img: any) => file._id === img._id));
    
    api.delete('order/deleteFiles', { image: foundImage, id: String(this.props.router.params.id) })
      .then(res => {
        this.setState({
          formData: res.data,
          isFinished: true,
          isUpdating: false,
          resMessage: 'Image has been deleted successfully'
        })
      })
      .catch((err) => {
        this.setState({
          isError: true,
          isUpdating: false,
          resMessage: err.message
        })
      })
  }

  deleteFileOfLink = async (file: any, paymentListId: string) => {
    this.setState({ isUpdating: true });  
    try {
      const res = await api.delete('order/upload/fileLink', { filename: file.filename, id: String(this.props.router.params.id), paymentListId });
      
      this.setState({
        formData: res.data,
        paymentList: res.data.paymentList,
        isFinished: true,
        isUpdating: false,
        resMessage: 'Image has been deleted successfully'
      })

      return res.data.paymentList.find(((link: any) => link?._id === paymentListId))?.images;
    } catch (error: any) {
      this.setState({
        isError: true,
        isUpdating: false,
        resMessage: error.message
      })
      return this.state.paymentList.find(((link: any) => link?._id === paymentListId))?.images;
    }
  }

  fileUploaderHandler = async (event: any, type: string) => {
    const files = event.target.files;

    const newFiles: any = [];
    
    for (const file of files) {
      newFiles.unshift(file)
    }

    // upload it in the cloudinary
    const data = new FormData()
    if (newFiles) {
      newFiles.forEach((file: any) => {
        data.append('files', file);
      });
    }
    data.append('id', String(this.props.router.params.id));
    data.append('type', type);
    this.setState({ isUpdating: true });
    try {
      await api.fetchFormData('order/uploadFiles', 'POST', data);
      const res = await api.get('order/' + String(this.props.router.params.id));
      this.setState({
        formData: res.data,
        isFinished: true,
        isUpdating: false,
        resMessage: 'Images has been updated successfully.'
      })
    } catch (error: any) {
      this.setState({
        isFinished: true,
        isUpdating: false,
        isError: true,
        resMessage: error.data.message
      })
    }
  }

  submit = (event: MouseEvent) => {
    event.preventDefault();    
    this.setState({ isUpdating: true })
    const totalInvoice = calculateTotalItems(this.state.formData?.items);

    const order = {
      isPayment: this.state.formData.isPayment,
      orderStatus: this.state.formData.orderStatus,
      ...this.state.changedFields
    };
    if (this.state.formData.totalInvoice !== totalInvoice) {
      order.totalInvoice = totalInvoice;
    }
    const steps = getOrderSteps(order);
    const isOrderFinished = steps?.length - 1 === order.orderStatus;
    order.isFinished = isOrderFinished;

    if (order?.paymentList?.length > 0) {
      order.paymentList = order?.paymentList.map((data: any) => {
        delete data?.flight;
        return data;
      }) 
    }
    
    api.update(`order/${this.props.router.params.id}`, order)
      .then((res) => {
        this.setState({
          formData: { ...res.data, customerId: res.data?.user?.customerId },
          changedFields: [],
          isUpdating: false,
          isFinished: true,
          resMessage: 'Invoice has been updated successfully.'
        })
      })
      .catch((err) => {
        this.setState({
          isUpdating: false,
          isFinished: true,
          isError: true,
          resMessage: err.data?.message
        })
      })
  }
  
  submitNewActivity = (event: React.MouseEvent) => {
    event.preventDefault();    
    const { description, country } = this.state.activity;
    
    if (!description || !country) {
      return;
    }
    this.setState({ isUpdating: true })    

    api.post(`order/${this.props.router.params.id}/addActivity`, this.state.activity)
      .then(() => {
        this.setState({
          isUpdating: false,
          isFinished: true,
          resMessage: 'New activity has been added successfully',
          activity: {
            country: '',
            description: ''
          }
        })
      })
      .catch((err) => {
        this.setState({
          isUpdating: false,
          isFinished: true,
          isError: true,
          resMessage: err.data.message,
          activity: {
            country: '',
            description: ''
          }
        })
      })
  }

  cancelOrder = async () => {
    const { cancelationReason } = this.state;
    if (!cancelationReason) return;
    this.setState({ isUpdating: true });

    try {
      const order = (await api.post(`order/${this.props.router.params.id}/cancel`, { cancelationReason }))?.data;
      this.setState({
        formData: order,
        changedFields: [],
        isUpdating: false,
        isFinished: true,
        resMessage: 'Invoice canceled successfully.',
        isCancelOrderDialogOpen: false
      })
    } catch (error) {
      console.log(error);
    }
  }

  getQrCode = async () => {
    const response = await api.get('get-qr-code');
    this.setState({ qrCode: response.data.qrCode });
  }

  sendWhatsupMessage = async () => {
    const { formData, whatsupMessage } = this.state;

    if (!whatsupMessage) {
      return;
    }

    this.setState({ isUpdating: true })    

    api.post(`sendWhatsupMessage`, { phoneNumber: `${formData.customerInfo.phone}@c.us`, message: whatsupMessage })
      .then((res) => {
        this.setState({
          isUpdating: false,
          isFinished: true,
          qrCode: res.data,
          resMessage: 'Whatsup message has been send successfully',
          activity: {
            country: '',
            description: ''
          }
        })
      })
      .catch((err) => {
        console.log(err);
        this.setState({
          isUpdating: false,
          isFinished: true,
          isError: true,
          resMessage: err.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : err.response.data.message
        })
      })
  }

  uploadFilesToLinks = async (event: any) => {
    const files = event.target.files;

    const newFiles: any = [];
    
    for (const file of files) {
      newFiles.unshift(file)
    }

    // upload it in the google could
    const data = new FormData()
    if (newFiles) {
      newFiles.forEach((file: any) => {
        data.append('files', file);
      });
    }
    data.append('id', String(this.props.router.params.id));
    data.append('paymentListId', event.target.id);
    this.setState({ isUpdating: true });

    try {
      await api.fetchFormData('order/upload/fileLink', 'POST', data);
      const res = await api.get('order/' + String(this.props.router.params.id));
      this.setState({
        formData: res.data,
        paymentList: res.data.paymentList,
        isFinished: true,
        isUpdating: false,
        resMessage: 'Images has been updated successfully.'
      })
      
      return res.data.paymentList.find(((link: any) => link._id === event.target.id)).images;
    } catch (error: any) {
      this.setState({
        isFinished: true,
        isUpdating: false,
        isError: true,
        resMessage: error.data.message
      })
      return [];
    }
  }

  displayAlert = (alert: { type: 'error' | 'success', message: string }) => {
    this.setState({
      isFinished: true,
      isError: alert.type === 'error',
      resMessage: alert.message
    })
  }

  submitInvoiceChanges = async (status: string) => {
    try {
      await api.update(`orders/${this.state.formData._id}/confirmItemsChanges`, { status, requestedEditDetails: this.state.formData?.requestedEditDetails });
      window.location.reload();
    } catch (error) {
      console.log(error);
    }
  }

  render() {
    const { formData, isInvoicePending, previewImages, showPreviewInvoice, paymentHistory, isUpdating, isError, isFinished, resMessage, whatsupMessage, employees, isCancelOrderDialogOpen, shippingLabelDialogOpen } = this.state;    
    const { account } = this.props;

    const invoiceFileRef = React.createRef();
    const receiptsFileRef = React.createRef();

    if (isInvoicePending) {
      return <CircularProgress color="inherit" />
    }

    const supplierDefaultMessage = `
    Hello, we placed the order, please print and put this label on the packages, it is our shipping mark.
also before shipping do not forget to send us photos. 

    Hello, we placed the order, please write this on the package, 
      Exios39 - by ${formData?.shipment?.method}(${formData?.orderId}) 
      it is our shipping mark 
                        
      also before shipping do not forget 
      to send us photos. 
      thanks 
    `;

    const warehouseDefaultMessage = `
اهلا بك عميلنا ${formData.customerInfo.fullName}
لقد حدثنا طلبيتك رقم ${formData.orderId} على ان تم وصوله الى مخازننا الخارجية
يرجى زيارة موقعنا الاكتروني لكي تتابع شحنتك بالتفصيل
https://www.exioslibya.com/login
شركة اكسيوس للشراء والشحن
شكرا لكم
    `;

    const arrivedLibyaDefaultMessage = `
اهلا بك عميلنا ${formData.customerInfo.fullName}
رقم الطلبية ${formData.orderId} الخاص بك قد وصل الى مخزننا في ليبيا
يرجى التواصل مع اقرب مندوب لك او زيارة مقر الشركة للاستلام
شركة اكسيوس للشراء والشحن
تحياتي لكم
    `;

    const invoicePaidMessage = `
مرحباً ${formData.customerInfo.fullName}،

نود إبلاغكم بأن عملية الشراء تمت بنجاح، ورقم الطلبية هو ${formData.orderId}. تم إضافة صور الدفع إلى الطلبية، ويمكنكم تسجيل الدخول إلى موقعنا الإلكتروني للاطلاع على تفاصيل الطلب عبر الرابط التالي:
https://www.exioslibya.com/login

يرجى ملاحظة أن عملية تتبع الطلبية والتواصل مع البائع بشأن الشحن والتوصيل هي مسؤوليتكم الشخصية، وليست مسؤولية الشركة. يُنصح بنسخ عنوان الشحن الخاص بالطلبية مع علامة الشحن وإرساله إلى البائع لتسهيل عملية التوصيل.
لأي استفسارات أو مزيد من المعلومات، يمكنكم التواصل معنا عبر الرقم التالي: 0915643265.
شكراً لاختياركم شركة إكسيوس للشحن، ونتطلع لخدمتكم مجدداً.

مع تحياتنا،  
شركة إكسيوس للشحن
    `

    const activities = (formData.activity || []).sort((a: any, b: any) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any))
    const { totalLyd, totalUsd } = getTotalDebtOfUser(this.state.userDebts)
    const totalInvoice = calculateTotalItems(formData?.items);
    const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(this.state.wallet);
    const { totalUsd: paidUsd, totalLyd: paidLyd, totalEuro: paidEuro } = calculateTotalPaid(this.state.paymentHistory);
    const { totalUsd: paidReceivedUsd, totalLyd: paidReceivedLyd, totalEuro: paidReceivedEuro } = calculateTotalPaid(this.state.paymentHistory, 'receivedGoods');
    
    return (
      <div className="m-4 edit-invoice">
        <div style={{ maxWidth: '1400px', margin: 'auto'}}>
          <div className="col-12 mb-3">
            {(totalLyd > 0 || totalUsd > 0) &&
              <Alert className='mb-2' color='error'>
                Debts found with this customer code ({this.state.formData.user.customerId}) the total debts is {totalLyd} LYD, {totalUsd} USD 🚨
              </Alert>
            }
            <div className={`d-flex justify-content-between ${isMobile ? 'flex-column my-2' : ''}`}>
              <h4 className='mb-2'> Edit Invoice</h4>
              <div>
                {(!formData?.isCanceled && (['62bb47b22aabe070791f8278', '632aeb399aefb9b93b7a7527'].includes(account?._id) || account?.roles.isAdmin)) &&
                  <Button 
                    style={{ marginRight: '8px' }} 
                    variant="outlined" 
                    color="error" 
                    size='small'
                    onClick={() => this.setState({ isCancelOrderDialogOpen: true })}
                  >
                    Cancel
                  </Button>
                }
                <Button 
                  style={{ marginRight: '8px' }} 
                  variant="outlined" 
                  color="success" 
                  size='small'
                  onClick={() => this.setState({ showPreviewInvoice: true })}
                >
                  Download Invoice
                </Button>
              </div>
            </div>
            <div className='d-flex justify-content-between align-items-center'>
              <Breadcrumbs separator="›" aria-label="breadcrumb">
                {breadcrumbs}
              </Breadcrumbs>
              <h6 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText(formData.orderId);
                  this.setState({ isFinished: true, isError: false, resMessage: 'Copied' })
                }} 
              >
                <span 
                  className='mx-2' 
                  
                > 
                  {isFinished ?
                    <MdOutlineLibraryAddCheck style={{ color: 'darkgreen', cursor: 'pointer' }} />
                    :
                    <FaCopy style={{ color: 'grey', cursor: 'pointer' }} />
                  }
                </span>
                {formData.orderId} : رقم الطلبية
              </h6>
            </div>

            <div className='d-flex justify-content-end align-items-center'>
              <Button 
                style={{ marginRight: '8px' }} 
                variant="outlined" 
                color="success" 
                size='small'
                onClick={() => this.setState({ walletDialog: true })}
                disabled={true}
              >
                Use Wallet ({`${walletUsd} $, ${walletLyd} LYD`})
              </Button>
              <Button 
                variant="outlined" 
                color="secondary"
                size='small'
                onClick={() => this.setState({ debtDialog: true })}
              >
                Add Debt
              </Button>
            </div>
          </div>

          <div
            className="row"
          >
            <div className="col-md-4">
              <Card>
                <h5> Admin Images </h5>
                <ImageUploader
                  id={'invoice'}
                  inputFileRef={invoiceFileRef}
                  fileUploaderHandler={(event: MouseEvent) => this.fileUploaderHandler(event, 'invoice')}
                  previewFiles={this.state.formData.images?.filter(((img: any) => img.category === 'invoice'))}
                  deleteImage={this.deleteImage}
                />
              </Card>

              <Card>
                <h5> Client Images </h5>
                <ImageUploader
                  id={'receipts'}
                  inputFileRef={receiptsFileRef}
                  fileUploaderHandler={(event: any) => this.fileUploaderHandler(event, 'receipts')}
                  previewFiles={this.state.formData.images?.filter(((img: any) => img.category === 'receipts'))}
                  deleteImage={this.deleteImage}
                />
              </Card>

              <form
                onSubmit={(event: any) => this.submitNewActivity(event)}
              >
                <Card>
                  <h5 className='mb-3'> Add Activity </h5>
                  <div className="row">
                    <div className="col-md-12 mb-4">
                      <Autocomplete
                        disablePortal
                        id="free-solo-demo"
                        freeSolo
                        options={countries}
                        onChange={(event: any) => (
                          this.setState({
                          activity: {
                            ...this.state.activity,
                            country: event.target.innerText
                          }
                        }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            id={'outlined-helperText'}
                            name="country"
                            required={true}
                            label={'Country'}
                            defaultValue={this.state.activity.country}
                            onChange={(event: any) => (
                              this.setState({
                              activity: {
                                ...this.state.activity,
                                country: event.target.value
                              }
                            }))}
                            style={{ direction: 'rtl' }}
                          />
                        )}
                      />
                    </div>

                    <div className="col-md-12 mb-4">
                      <Autocomplete
                        disablePortal
                        id="free-solo-demo"
                        freeSolo
                        options={orderActions}
                        onChange={(event: any) => this.setState({
                          activity: {
                            ...this.state.activity,
                            description: event.target.innerText
                          }
                        })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            id={'outlined-helperText'}
                            name="description"
                            required={true}
                            label={'Description'}
                            defaultValue={this.state.activity.description}
                            onChange={(event: any) => ( 
                              this.setState({
                              activity: {
                                ...this.state.activity,
                                description: event.target.value
                              }
                            }))}
                            style={{ direction: 'rtl' }}
                          />
                        )}
                      />
                    </div>
                    <div className="col-md-12 mb-4 text-end">
                      <CustomButton 
                        background='rgb(0, 171, 85)' 
                        size="small"
                        disabled={(isUpdating || formData?.isCanceled) ? true : false}
                      >
                        Add Activity
                      </CustomButton>
                    </div>
                  </div>
                </Card>
              </form>

              <Card>
                <h5 className='mb-3'> Send Whatsup Message </h5>
                <textarea 
                  style={{ height: '200px', direction: 'rtl' }} 
                  placeholder='Message' 
                  className='form-control mb-2' 
                  defaultValue={whatsupMessage}
                  onChange={(e) => this.setState({ whatsupMessage: e.target.value })}
                >
                </textarea>

                <div className="col-md-12 mb-4 text-end">
                  <ButtonGroup variant="outlined" aria-label="outlined button group">
                    <Button onClick={() => this.setState({ whatsupMessage: warehouseDefaultMessage })}>وصلت مخزن</Button>
                    <Button onClick={() => this.setState({ whatsupMessage: arrivedLibyaDefaultMessage })}>وصلت ليبيا</Button>
                    <Button onClick={() => this.setState({ whatsupMessage: invoicePaidMessage })}>الفاتورة دفعت</Button>
                    <Button onClick={() => this.setState({ whatsupMessage: '' })}>حقل فارغ</Button>
                  </ButtonGroup>
                </div>
                <Switch value={this.state.shouldVerifyQrCode} onChange={(e) => this.setState({ shouldVerifyQrCode: e.target.checked })} />
                
                {this.state.shouldVerifyQrCode && <QRCode value={this.state.qrCode || ''} />}
                
                <div className="col-md-12 mb-4 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                    disabled={(isUpdating || formData?.isCanceled) ? true : false}
                    onClick={this.sendWhatsupMessage}
                  >
                    Send Message
                  </CustomButton>
                </div>

                <div className="col-md-12 mb-4 text-end">
                  <CustomButton 
                    background='rgb(0, 74, 171)' 
                    size="small"
                    disabled={(isUpdating || formData?.isCanceled) ? true : false}
                    onClick={this.getQrCode}
                  >
                    Get QR
                  </CustomButton>
                </div>

              </Card>

              <div className="col-md-12 mb-4">
                <CustomButton 
                  className='my-2'
                  background='rgb(0, 171, 85)' 
                  size="small"
                  disabled={(isUpdating || formData?.isCanceled) ? true : false}
                  onClick={() => this.setState({ shippingLabelDialogOpen: true })}
                >
                  Download Shipping Label
                </CustomButton>

                <textarea 
                  style={{ height: '300px' }} 
                  placeholder='Message' 
                  className='form-control' 
                  defaultValue={supplierDefaultMessage}
                >
                </textarea>
              </div>

              <Card>
                <h5 className='mb-3'> Activities </h5>
                
                {activities.length > 0 ? activities.map((data: OrderActivity) => (
                  <>
                    <div className="d-flex gap-3 overflow-auto" style={{ direction: 'rtl' }}>
                      <p>{moment(data.createdAt).format('DD/MM/YYYY')}</p>
                      <p>{data.country}</p>
                      <p>{data.description}</p>
                    </div>
                    <hr style={{ color: '#a1a1a1', height: '1px' }} />
                  </>
                ))
                :
                <p>No activity found</p>
                }
              </Card>

              <h6 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText(formData.orderId);
                  this.setState({ isFinished: true, isError: false, resMessage: 'Copied' })
                }} 
              >
                <span 
                  className='mx-2' 
                  
                > 
                  {isFinished ?
                    <MdOutlineLibraryAddCheck style={{ color: 'darkgreen', cursor: 'pointer' }} />
                    :
                    <FaCopy style={{ color: 'grey', cursor: 'pointer' }} />
                  }
                </span>
                {formData.orderId} : رقم الطلبية
              </h6>
            </div>

            <div className="col-md-8">
              {formData?.isCanceled &&
                <Card>
                  <h5 className='mb-3' style={{ color: '#d32f2f' }}> Order Canceled </h5>
                  <p className='mb-1'> <strong>Cancelation Date:</strong> {moment(formData.cancelation.date).format('DD-MM-YYYY / HH:mm')} time </p>
                  <p className='mb-1'> <strong>Reason:</strong> {formData.cancelation.reason} </p>
                </Card>
              }
              <form
                onSubmit={(event: any ) => this.submit(event)}
              >
                <Card>
                  <InvoiceForm 
                    handleChange={this.handleChange}
                    paymentList={this.state.paymentList}
                    addNewPaymentField={this.addNewPaymentField}
                    fileUploaderHandler={this.uploadFilesToLinks}
                    items={this.state.items}
                    addNewItemForOrder={this.addNewItemForOrder}
                    deteteItemRow={this.deteteItemRow}
                    displayAlert={this.displayAlert}
                    deleteFileOfLink={this.deleteFileOfLink}
                    deteteRow={this.deteteRow}
                    invoice={formData || null}
                    isEmployee={this.props.isEmployee}
                    employees={employees}
                    totalInvoice={totalInvoice}
                  />
                  <div className="col-md-12 mb-2 text-end">
                    <CustomButton 
                      background='rgb(0, 171, 85)' 
                      size="small"
                      disabled={(isUpdating || formData?.isCanceled) ? true : false}
                    >
                      Update Invoice
                    </CustomButton>
                  </div>
                </Card>
              </form>     
            </div>
          </div>
          
          {((formData?.requestedEditDetails && Object.keys(formData?.requestedEditDetails)?.length > 0) || formData?.editedAmounts?.length > 0) &&
            <div className="col-12 mb-2">
              <Card>
                <h6>Invoice Changes</h6>

                {(formData?.requestedEditDetails && Object.keys(formData?.requestedEditDetails)?.length > 0) &&
                  <div>
                    <Badge color="primary" text="Waiting For Approval From Admins" />
                    <div style={{ fontSize: 'small' }} className='d-flex gap-3'>
                      <p className='my-1'>{moment(formData?.requestedEditDetails?.createdAt).format('DD/MM/YYYY hh:mm A')}</p>
                      <p className='my-1'>New Total Invoice: {formData?.requestedEditDetails?.amount} $</p>
                    </div>
                    {(formData?.requestedEditDetails?.items || []).map((item: any) => (
                      <p className='my-1'>{item.quantity} Quantity - {item.unitPrice} $ - {item.description}</p>
                    ))}

                  {account.roles.isAdmin &&
                    <div className='d-flex gap-2'>
                      <CustomButton
                        className='mr-2'
                        background='rgb(0, 171, 85)' 
                        size="small"
                        onDoubleClick={() => this.submitInvoiceChanges('accepted')}
                      >
                        Accept New Invoice
                      </CustomButton>
                      <CustomButton 
                        background='rgb(226, 39, 39)' 
                        size="small"
                        onDoubleClick={() => this.submitInvoiceChanges('rejected')}
                      >
                        Reject Invoice
                      </CustomButton>
                    </div>
                  }
                    <hr />
                  </div>
                }
                
                {formData?.editedAmounts?.length > 0 && formData?.editedAmounts.sort((a: any, b: any) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any)).map((oldItems: any) => (
                  <div>
                    <Badge color={oldItems.status === 'accepted' ? 'success' : 'danger'} text={getStatusTextOfInvoiceItems(oldItems.status)} />
                    <div style={{ fontSize: 'small' }} className='d-flex gap-3'>
                      <p className='my-1'>{moment(oldItems?.createdAt).format('DD/MM/YYYY hh:mm A')}</p>
                      <p className='my-1' style={{ textDecoration: 'line-through' }}>Old Total Invoice: {oldItems.oldAmount} $</p>
                      <p className='my-1'>New Total Invoice: {oldItems.newAmount} $</p>
                    </div>
                    {(oldItems?.items || []).map((item: any) => (
                      <p className='my-1'>{item.quantity} Quantity - {item.unitPrice} $ - {item.description}</p>
                    ))}
                    <hr />
                  </div>
                ))
                }
              </Card>
            </div>
          }

          <div className="col-12 mb-2">
            <Card>
              <h6>Invoice Cashflow</h6>
              <div className='d-flex gap-2 mb-2'>
                <p className='mb-1'>Total Confirmed Invoice: {formData.totalInvoice} $</p>
                {account.roles.isAdmin &&
                  <Button 
                    variant="outlined" 
                    color={formData?.invoiceConfirmed || formData?.requestedEditDetails ? 'primary' : 'success'} 
                    size='small'
                    onDoubleClick={async () => {
                      if (formData?.invoiceConfirmed || formData?.requestedEditDetails) {
                        return this.setState({ openEditInvoiceDialog: true });
                      }
                      await api.post(`orders/${formData._id}/confirmInvoice`, {});
                      window.location.reload();
                    }}
                  >
                    {formData?.invoiceConfirmed || formData?.requestedEditDetails ? 'Request Edit Invoice' : 'Confirm Invoice'}
                  </Button>
                }
              </div>

              <div className='d-flex gap-2'>
                <Button 
                  variant="outlined" 
                  color="success" 
                  size='small'
                  onClick={() => this.setState({ walletDialog: true, category: 'invoice' })}
                >
                  Use Wallet ({`${walletUsd} $, ${walletLyd} LYD`})
                </Button>

                {/* <Button 
                  variant="outlined" 
                  color="success" 
                  size='small'
                  onClick={() => this.setState({ payCashDialog: true, category: 'invoice' })}
                >
                  Pay Cash
                </Button> */}
              </div>
              
              <p className='m-0 mt-2 mb-2'>
                Paid Amounts: 
                <span style={{ color: 'rgb(46, 125, 50)' }}>
                  {paidUsd ? `(${paidUsd} $)` : ''}
                  {paidLyd ? `(${paidLyd} LYD)` : ''}
                  {paidEuro ? `(${paidEuro} EURO)` : ''}
                </span>
              </p>
              {paymentHistory.length > 0 ? paymentHistory.filter(payment => payment.category === 'invoice').map(payment => (
                <div>
                  <p className='m-0 d-flex gap-3' style={{ color: 'rgb(46, 125, 50)' }}>
                    {moment(payment?.createdAt).format('DD/MM/YYYY hh:mm A')} - {payment?.receivedAmount} {payment?.currency} {payment?.paymentType === 'wallet' ? 'Wallet' : 'Cash'} paid / Rate: {payment?.rate || 0}
                    <AvatarGroup max={3}>
                      {payment.attachments.map((img: any) => (
                        <Avatar
                          style={{ cursor: 'pointer' }}
                          key={img.filename}
                          alt={img.filename} 
                          src={img.path}
                          onClick={(event: React.MouseEvent) => this.setState({ previewImages: payment.attachments })}
                        />
                      ))}
                    </AvatarGroup>
                    {payment?.note && <span>{payment.note}</span>}
                  </p>
                  <p>Created By: {`${payment?.createdBy.firstName} ${payment?.createdBy.lastName}` }</p>
                  {account.roles.isAdmin &&
                    <Button 
                      variant="contained" 
                      color="error" 
                      size='small'
                      onDoubleClick={() => {
                        this.setState({ isUpdating: true });
                        api.delete(`wallet/${payment.customer._id}`, { payment })
                          .then(() => {
                            this.setState({ isUpdating: false, resMessage: 'Payment deleted successfully', isFinished: true });
                            window.location.reload();
                          })
                          .catch((err) => {
                            this.setState({ isUpdating: false, resMessage: err.data.message });
                          })
                      }}
                    >
                      Delete
                    </Button>
                  }
                  <hr />
                </div>
                )) 
                :
                <p>No Payments Found</p>
              }
            </Card>

            
            <Card>
              <h6>Received Packages Cashflow</h6>
              <div className='d-flex gap-2'>
                <Button 
                  variant="outlined" 
                  color="success" 
                  size='small'
                  onClick={() => this.setState({ walletDialog: true, category: 'receivedGoods' })}
                  disabled={this.state.selectedPackages.length === 0 || !account.roles.isAdmin}
                >
                  Use Wallet ({`${walletUsd} $, ${walletLyd} LYD`})
                </Button>

                {/* <Button 
                  variant="outlined" 
                  color="success" 
                  size='small'
                  onClick={() => this.setState({ payCashDialog: true, category: 'receivedGoods' })}
                  disabled={this.state.selectedPackages.length === 0}
                >
                  Pay Cash
                </Button> */}
              </div>

              <p className='m-0 mt-2 mb-2'>
                Paid Amounts: 
                <span style={{ color: 'rgb(46, 125, 50)' }}>
                  {paidReceivedUsd ? `(${paidReceivedUsd} $)` : ''}
                  {paidReceivedLyd ? `(${paidReceivedLyd} LYD)` : ''}
                  {paidReceivedEuro ? `(${paidReceivedEuro} EURO)` : ''}
                </span>
              </p>
              {paymentHistory.length > 0 ? paymentHistory.filter(payment => payment.category === 'receivedGoods').map(payment => (
                <div>
                  <p className='m-0 d-flex gap-3' style={{ color: 'rgb(46, 125, 50)' }}>
                    {moment(payment?.createdAt).format('DD/MM/YYYY hh:mm A')} - {payment?.receivedAmount} {payment?.currency} {payment?.paymentType === 'wallet' ? 'Wallet' : 'Cash'} paid / Rate: {payment?.rate || 0}
                    <AvatarGroup max={3}>
                      {payment.attachments.map((img: any) => (
                        <Avatar
                          style={{ cursor: 'pointer' }}
                          key={img.filename}
                          alt={img.filename} 
                          src={img.path}
                          onClick={(event: React.MouseEvent) => this.setState({ previewImages: payment.attachments })}
                        />
                      ))}
                    </AvatarGroup>
                    {payment?.note && <span>{payment.note}</span>}
                  </p>
                  <p>Created By: {`${payment?.createdBy.firstName} ${payment?.createdBy.lastName}` }</p>
                  {account.roles.isAdmin &&
                    <Button 
                      variant="contained" 
                      color="error" 
                      size='small'
                      onDoubleClick={() => {
                        this.setState({ isUpdating: true });
                        api.delete(`wallet/${payment.customer._id}`, { payment })
                          .then(() => {
                            this.setState({ isUpdating: false, resMessage: 'Payment deleted successfully', isFinished: true });
                            window.location.reload();
                          })
                          .catch((err) => {
                            this.setState({ isUpdating: false, resMessage: err.data.message });
                          })
                      }}
                    >
                      Delete
                    </Button>
                  }
                  {payment.list.length > 0 && payment.list.map((orderPackage: any, i: number) => (
                    <p>
                      {i + 1}. {orderPackage.deliveredPackages?.trackingNumber} / {orderPackage.deliveredPackages?.weight?.total} {orderPackage.deliveredPackages?.weight?.measureUnit}
                    </p>
                  ))}
                  <hr />
                </div>
                )) 
                :
                <p>No Payments Found</p>
              }
              
              <PackagesList 
                order={formData}
                onListChange={(list) => {
                  list.forEach((data: any) => {
                    if (data?.flight) {
                      delete data.flight;
                    }
                  });
                  this.setState({ selectedPackages: list });
                }}
              />
            </Card>
          </div>
        </div>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1000 }}
          open={isUpdating}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar 
          open={isFinished} 
          autoHideDuration={6000}
          onClose={() => this.setState({ isFinished: false, isError: false })}
        >
          <Alert 
            severity={isError ? 'error' : 'success'}
            sx={{ width: '100%' }}
            onClose={() => this.setState({ isFinished: false, isError: false })}
          >
            {resMessage}
          </Alert>
        </Snackbar>

        <Dialog open={isCancelOrderDialogOpen} onClose={() => this.setState({ isCancelOrderDialogOpen: false })}>
          <DialogTitle>Are you sure to cancel this order?</DialogTitle>
          <DialogContent>
            <p>يرجى كتابة سبب الالغاء بالتفصيل</p>
            <textarea 
              name="cancelationReason"
              onChange={(e) => this.setState({ cancelationReason: e.target.value })}
              rows={10}
              style={{ width: '100%' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ isCancelOrderDialogOpen: false })} >الرجوع</Button>
            <Button 
              onClick={() => this.cancelOrder()}
              color="error"
            >
              الغاء الفاتورة
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={shippingLabelDialogOpen} onClose={() => this.setState({ shippingLabelDialogOpen: false })}>
          <DialogContent>
            <div>
              <ToggleButtonGroup
                color="success"
                value={this.state.shippingMethodForLabel}
                exclusive
                onChange={(event: any, value: 'air' | 'sea') => this.setState({ shippingMethodForLabel: value }) }
                size="small"
              >
                <ToggleButton value="air">Air</ToggleButton>
                <ToggleButton value="sea">Sea</ToggleButton>
              </ToggleButtonGroup>

              <FormControlLabel 
                style={{ marginLeft: '5px' }} 
                label="Inspection Required" 
                control={
                  <Checkbox 
                    defaultChecked={this.state.inspectionCheckbox}
                    onChange={(e: any) => this.setState({ inspectionCheckbox: e.target.checked })}
                  />
                } 
              />

              <p>
                广东省佛山市南海区里水镇科顺路6号 威微物流（Exios仓) {this.state.shippingMethodForLabel}({formData?.user?.customerId}) 邓为军 13873096321
              </p>

              <div style={{ background: 'white', textAlign: 'center', border: '2px solid black', width: '400px', height: '460px' }} id='test222'>
                <div style={{ border: '2px solid black' }} className="p-3">
                  <img src="/images/exios-logo.png" alt="Exios" width={160} height={90} />
                </div>
                <div style={{ border: '2px solid black' }} className="p-3">
                  <QRCode value={`http://exios-admin-frontend.web.app/shouldAllowToAccessApp?id=${formData?._id}`} />
                </div>
                <div style={{ border: '2px solid black' }} className="p-3">
                  <p> <strong>Customer ID:</strong> {formData?.user?.customerId} </p>
                  <p className={this.state.inspectionCheckbox ? 'mb-1' : ''}> <strong>Shipment Method:</strong> {this.state.shippingMethodForLabel} </p>
                  {this.state.inspectionCheckbox && 
                    <p className='mt-0' style={{ color: 'red' }}>Inspection Required</p>
                  }
                </div>
              </div>  
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ shippingLabelDialogOpen: false })} >Back</Button>
            <Button 
              onClick={() => {
                const node = document.getElementById('test222');
                htmlToImage.toJpeg(node as any)
                  .then(function (dataUrl) {
                    require("downloadjs")(dataUrl, 'shipping Label.jpeg');
                  })
                  .catch(function (error) {
                    console.error('oops, something went wrong!', error);
                  });
              }}
              color='success'
            >
              Download Label
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog fullScreen open={showPreviewInvoice} onClose={() => this.setState({ showPreviewInvoice: false })}>
          <DialogContent>
            <InvoiceTemplate 
              invoice={formData}
              changedFields={this.state.changedFields}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ showPreviewInvoice: false })} >Back</Button>
          </DialogActions>
        </Dialog>

        <Dialog 
          open={this.state.walletDialog}
          onClose={() => this.setState({ walletDialog: false, category: undefined })}
        >
          <UseWalletBalance 
            balances={{ walletLyd, walletUsd}}
            orderId={this.state.formData.orderId}
            walletId={this.state.formData.user._id}
            category={this.state.category}
            selectedPackages={this.state.selectedPackages}
            hideUploader
          />
        </Dialog>

        <Dialog 
          open={this.state.debtDialog}
          onClose={() => this.setState({ debtDialog: false })}
        >
          <CreateDebtDialog
            setDialog={() => this.setState({ debtDialog: false  })}
            orderId={this.state.formData.orderId}
            customerId={this.state.formData.user.customerId}
          />
        </Dialog>

        <Dialog 
          open={this.state.openEditInvoiceDialog}
          onClose={() => this.setState({ openEditInvoiceDialog: false })}
        >
          <EditInvoiceItems
            items={this.state.items}
            orderId={formData._id}
          />
        </Dialog>

        <Dialog 
          open={this.state.payCashDialog}
          onClose={() => this.setState({ payCashDialog: false })}
        >
          <PayCashDialog
            setDialog={() => this.setState({ payCashDialog: false  })}
            orderId={this.state.formData._id}
            customerId={this.state.formData.user._id}
            category={this.state.category}
            selectedPackages={this.state.selectedPackages}
          />
        </Dialog>

        <Dialog 
          open={previewImages}
          onClose={() => this.setState({ previewImages: undefined })}
        >
          <DialogContent>
            <SwipeableTextMobileStepper data={previewImages} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ previewImages: undefined })} >Close</Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }
}

const getTotalDebtOfUser = (debts: Debt[]) => {
  let totalUsd = 0;
  let totalLyd = 0;

  (debts as any || []).forEach((debt: Debt) => {
    if (debt.currency === 'USD') {
      totalUsd += debt.amount;
    } else if (debt.currency === 'LYD') {
      totalLyd += debt.amount;
    }
  })

  return { totalLyd, totalUsd };
}

const calculateTotalItems = (items: OrderItem[]) => {
  let total = 0;
  (items || []).forEach((item: OrderItem) => {
    total += item.unitPrice * item.quantity;
  })
  return total;
}

const calculateTotalPaid = (paymentHistroy: any, category = 'invoice') => {
  let totalUsd = 0, totalLyd = 0, totalEuro = 0;
  (paymentHistroy || []).filter((p: any) => p.category === category).forEach((p: any) => {
    if (p.currency === 'USD') totalUsd += p.receivedAmount
    else if (p.currency === 'LYD') totalLyd += p.receivedAmount;
    else if (p.currency === 'EURO') totalLyd += p.receivedAmount;
  })

  return { totalUsd, totalLyd, totalEuro }
}

const getStatusTextOfInvoiceItems = (status: 'accepted' | 'rejected') => {
  let label = 'Accepted';
  if (status === 'rejected') {
    label = 'Rejected';
  }
  return label;
}

const mapStateToProps = (state: any) => {
	return {
    isEmployee: state.session.account?.roles.isEmployee,
    account: state.session.account
	};
}

const mapDispatchToProps = {}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(EditInvoice))