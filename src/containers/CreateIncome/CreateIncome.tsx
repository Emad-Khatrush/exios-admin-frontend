import React, { Component } from 'react'
import { Alert, Backdrop, Breadcrumbs, CircularProgress, Link, Snackbar, Typography } from '@mui/material'
import Card from '../../components/Card/Card';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import { arrayRemoveByValue } from '../../utils/methods';
import CustomButton from '../../components/CustomButton/CustomButton';
import api from '../../api';
import withRouter from '../../utils/WithRouter/WithRouter';
import { NavigateFunction } from 'react-router-dom';
import IncomeForm from '../../components/IncomeForm/IncomeForm';

type Props = {
  router: {
    navigate: NavigateFunction
  }
}

type State = {
  filesInput: any
  previewFiles: any
  formData: any
  showResponseMessage: boolean
  isLoading: boolean
  isSuccess: boolean
  errors: any
  message: string | null
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Link underline="hover" key="2" color="inherit" href="/incomes">
    Incomes
  </Link>,
  <Typography key="3" color='#28323C'>
    Create Income
  </Typography>,
];

class CreateIncome extends Component<Props, State> {
  state = {
    filesInput: [],
    previewFiles: [],
    formData: [],
    showResponseMessage: false,
    isLoading: false,
    isSuccess: false,
    errors: null,
    message: null
  }

  // componentDidUpdate() {
  //   if (this.props.expense.listStatus.isSuccess) {
  //     setTimeout(() => {
  //       this.props.router.navigate('/expenses');
  //     }, 1000)
  //   }
  // }

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

  submitForm = async (event: any) => {
    event.preventDefault();

    this.setState({ isLoading: true })
    const formData  = new FormData();
    
    for (const data in this.state.formData) {
      formData.append(data, this.state.formData[data]);      
    }
    
    if (this.state.filesInput) {
      this.state.filesInput.forEach((file: any) => {
        formData.append('files', file);
      });
    }    
    try {
      await api.fetchFormData('incomes', 'POST', formData);
      this.setState({ message: 'Income added successfully.', isSuccess: true });
    } catch (error: any) {
      this.setState({ errors: error, message: error.response.message })
    } finally {
      this.setState({ showResponseMessage: true, isLoading: false })
    }
  };

  render() {
    const { isSuccess, isLoading, message } = this.state;

    const inputFileRef = React.createRef();

    return (
      <div className="m-4">
        <div style={{ maxWidth: '1400px', margin: 'auto'}}>
          <div className="col-12 mb-3">
            <h4 className='mb-2'> Create Income</h4>
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
                  deleteImage={this.deleteImage}
                  files={this.state.filesInput}
                />
              </Card>
            </div>
            <div className="col-md-8">
              <Card>
                <IncomeForm
                  handleChange={this.handleChange}
                />
                
                <div className="col-md-12 mb-2 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                    disabled={isSuccess ? true : false}
                  >
                    Create Income
                  </CustomButton>
                </div>
              </Card>
            </div>
          </form>
        </div>

        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={isLoading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar 
          open={isLoading ? false : this.state.showResponseMessage} 
          autoHideDuration={6000}
          onClose={() => this.setState({ showResponseMessage: false })}
        >
          <Alert 
            severity={isSuccess ? 'success' : 'error'}
            sx={{ width: '100%' }}
            onClose={() => this.setState({ showResponseMessage: false })}
          >
            {message}
          </Alert>
        </Snackbar>
      </div>
    )
  }
}

export default withRouter(CreateIncome);
