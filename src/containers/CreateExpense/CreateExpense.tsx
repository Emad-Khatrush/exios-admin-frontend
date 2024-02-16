import React, { Component } from 'react'
import { Alert, Backdrop, Breadcrumbs, CircularProgress, Link, Snackbar, Typography } from '@mui/material'
import Card from '../../components/Card/Card';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import ExpenseForm from '../../components/ExpenseForm/ExpenseForm';
import { arrayRemoveByValue } from '../../utils/methods';
import { connect } from 'react-redux';
import CustomButton from '../../components/CustomButton/CustomButton';
import { IExpense } from '../../reducers/expenses';
import { createExpense, resetExpense } from '../../actions/expenses';
import withRouter from '../../utils/WithRouter/WithRouter';
import { NavigateFunction } from 'react-router-dom';

type Props = {
  createExpense: any
  expense: IExpense
  resetExpense: any
  isEmployee: boolean
  router: {
    navigate: NavigateFunction
  }
}

type State = {
  filesInput: any
  previewFiles: any
  formData: any
  paymentList: any
  showResponseMessage: boolean
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Link underline="hover" key="2" color="inherit" href="/expenses">
    Expenses
  </Link>,
  <Typography key="3" color='#28323C'>
    Create Expense
  </Typography>,
];

class CreateExpense extends Component<Props, State> {
  state = {
    filesInput: [],
    previewFiles: [],
    formData: [],
    paymentList: [{
      index: Math.floor(Math.random() * 1000),
      paymentLink: '',
      paid: false,
      arrived: false,
      note: '',
    }],
    showResponseMessage: false,
  }

  async componentDidMount() {    
    this.props.resetExpense()
  }

  componentDidUpdate() {
    if (this.props.expense.listStatus.isSuccess) {
      setTimeout(() => {
        this.props.router.navigate('/expenses');
      }, 1000)
    }
  }

  fileUploaderHandler = async (event: any) => {
    const files = event.target.files;
    
    let allFiles: any = [];
    const newFiles: any =[];
    
    for (const file of files) {
      newFiles.unshift(file)
    }
    allFiles = [
      ...this.state.filesInput,
      ...newFiles
    ]
    
    this.previewFile(allFiles);
    this.setState({ filesInput: allFiles });
  }

  handleFileChosen = async (file: any) => {
    return new Promise((resolve, reject) => {
      let fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result);
      };
    });
  }

  previewFile = async (files: any) => {

    const results = await Promise.all(files.map(async (file: any) => {
      const fileContents = await this.handleFileChosen(file);
      return fileContents;
    }));

    this.setState({ previewFiles: results });
  };

  deleteImage = (file: never) => {
    const fileIndex = this.state.previewFiles.indexOf(file);    
    const filesInput = arrayRemoveByValue(this.state.filesInput, this.state.filesInput[fileIndex]);    
    const previewFiles = arrayRemoveByValue(this.state.previewFiles, file);    
    this.setState({ previewFiles, filesInput });
  }

  handleChange = (event: any, checked?: any) => {
    const value = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;
    this.setState((oldValues) => ({
      formData: {
        ...oldValues.formData,
        [event.target.name]: value === 'on' ? checked : value
      }
    }))
  };

  deteteRow = () => {
    const { paymentList } = this.state;
    // delete last row of the list
    // the v2, I will delete rows depending on his index
    if (paymentList.length > 1) {
      paymentList.pop()    
      this.setState({
        paymentList
      });
    }
  }

  addNewPaymentField = () => {
    this.setState((prevState) => ({
      paymentList: [...prevState.paymentList, {
        index: Math.floor(Math.random() * 1000),
        paymentLink: '',
        paid: false,
        arrived: false,
        note: '',
      }],
  }));
  }

  submitForm = (event: any) => {
    event.preventDefault();
    const formData  = new FormData();
    
    for (const data in this.state.formData) {
      formData.append(data, this.state.formData[data]);      
    }
    
    if (this.state.filesInput) {
      this.state.filesInput.forEach((file: any) => {
        formData.append('files', file);
      });
    }    
    this.props.createExpense(formData);
    this.setState({ showResponseMessage: true })
  };

  render() {
    const { expense } = this.props;
    const inputFileRef = React.createRef();

    return (
      <div className="m-4">
        <div style={{ maxWidth: '1400px', margin: 'auto'}}>
          <div className="col-12 mb-3">
            <h4 className='mb-2'> Create Expense</h4>
              <Breadcrumbs separator="›" aria-label="breadcrumb">
                {breadcrumbs}
              </Breadcrumbs>
          </div>
          <form
            className="row"
            onSubmit={(e) => this.submitForm(e)}
          >
            <div className="col-md-4">
              <Card>
                <ImageUploader
                  inputFileRef={inputFileRef}
                  fileUploaderHandler={this.fileUploaderHandler}
                  previewFiles={this.state.previewFiles}
                  files={this.state.filesInput}
                  deleteImage={this.deleteImage}
                />
              </Card>
            </div>
            <div className="col-md-8">
              <Card>
                <ExpenseForm 
                  handleChange={this.handleChange}
                  isEmployee={this.props.isEmployee}
                />
                
                <div className="col-md-12 mb-2 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                    disabled={expense.listStatus.isSuccess ? true : false}
                  >
                    Create Expense
                  </CustomButton>
                </div>
              </Card>
            </div>
          </form>
        </div>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={expense.listStatus.isLoading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar 
          open={expense.listStatus.isLoading ? false : this.state.showResponseMessage} 
          autoHideDuration={6000}
          onClose={() => this.setState({ showResponseMessage: false })}
        >
          <Alert 
            severity={expense.listStatus.isSuccess ? 'success' : 'error'}
            sx={{ width: '100%' }}
            onClose={() => this.setState({ showResponseMessage: false })}
          >
            {expense.listStatus.message}
          </Alert>
        </Snackbar>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => {
	return {
		expense: state.expense,
    isEmployee: state.session.account.roles.isEmployee
	};
}

const mapDispatchToProps = {
    createExpense,
    resetExpense
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(CreateExpense));
