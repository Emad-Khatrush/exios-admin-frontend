import { connect } from 'react-redux'
import React, { Component } from 'react'
import Card from '../../components/Card/Card'
import { Alert, Backdrop, CircularProgress, Snackbar } from '@mui/material'
import api from '../../api';
import ImageUploader from '../../components/ImageUploader/ImageUploader';
import CustomButton from '../../components/CustomButton/CustomButton';
import { arrayRemoveByValue } from '../../utils/methods';
import TaskForm from '../TaskForm/TaskForm';
import { Account, Session, User } from '../../models';

type Props = {
  session?: Session
}

type State = {
  employees: any
  files: any
  previewFiles: any
  form: any
  isLoading: boolean
  responseMessage: string
  isSuccess: boolean
}

const labels: any = {
  urgent: 'عاجل',
  normal: 'عادي',
  limitedTime: 'وقت محدد'
}

export class CreateTask extends Component<Props, State> {
  state = {
    employees: [],
    files: [],
    previewFiles: [],
    form: {
      title: '',
      reviewers: [],
      description: '',
      label: '',
      limitedTime: new Date()
    },
    isLoading: false,
    responseMessage: '',
    isSuccess: false
  }

  async componentDidMount() {
    this.setState({ isLoading: true });
    api.get(`employees`)
      .then((res) => this.setState({ employees: res.data.results }))
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        this.setState({ isLoading: false });
      })
  }

  fileUploaderHandler = async (event: any) => {
    const files = event.target.files;
    
    const newFiles: any =[];
    
    for (const file of files) {
      file.category = event.target.id;
      newFiles.unshift(file)
    }
    
    this.previewFile([ ...this.state.files, ...newFiles ], event.target.id);
    this.setState<any>((prevState => (
      { files:  [ ...prevState.files, ...newFiles ] }
    )));
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

  previewFile = async (files: any, category: string) => {
    const results = await Promise.all(files.map(async (file: any) => {
      const fileContents = await this.handleFileChosen(file);
      return fileContents;
    }));

    this.setState<any>({ previewFiles: results });
  };

  deleteImage = (file: never) => {    
    const fileIndex = this.state.previewFiles.indexOf(file);

    const filesInput = arrayRemoveByValue(this.state.files, this.state.files[fileIndex]);        
    const previewFiles = arrayRemoveByValue(this.state.previewFiles, file);    
    this.setState<any>({ previewFiles: previewFiles, files: filesInput });
  }

  onChange = (event: any) => {
    const name = event.target.name;
    const value = event.target.value;
    this.setState((prevState => ({
      form: {
        ...prevState.form,
        [name]: value
      }
    })))
  }

  sendWhatsupMessage = (user: User) => {
    const { session } = this.props;
    const message = `
      قد تم انشاء تاسك خاص بك من طرف ${session?.account.firstName} ${session?.account.lastName}
      بعنوان '${this.state.form.title}'
      والحالة: ${labels[this.state.form.label]}
      يرجى الدخول الى قسم المهام للبدا في التاسك الخاص بك
      شكرا لكم
    `;

    const phoneNumber = (user.phone as any) === "5535728209" ? '5535728209@c.us' : `${user.phone}@c.us`

    api.post(`sendWhatsupMessage`, { phoneNumber, message })
      .then((res) => {
        this.setState({
          responseMessage: 'Whatsup message has been send successfully',
        })
      })
      .catch((err) => {
        console.log(err);
        this.setState({
          responseMessage: err.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : err.response.data.message
        })
      })
  }

  onSubmit = async (event: any) => {
    event.preventDefault();

    if (!this.state.form) {
      return;
    }

    
    const form: any = this.state.form;
    const formData  = new FormData();
    for (const data in form) {
      formData.append(data, form[data]);
    }
    
    if (this.state.files) {
      this.state.files.forEach((file: any) => {
        formData.append('files', file);
      });
    }
    
    if (this.state.form.reviewers) {
      formData.append('reviewers', JSON.stringify(this.state.form.reviewers));     
    }
    
    this.setState({ isLoading: true });
    api.fetchFormData('create/task', 'POST', formData)
      .then((res: any) => {
        if (!(res?.success !== undefined && !res?.success)) {
          this.state.form.reviewers.forEach(async (userId) => {
            const foundUser = this.state.employees.find((emp: Account) => emp._id === userId)
            await this.sendWhatsupMessage(foundUser as any);
          })
          this.setState({ isLoading: false, responseMessage: 'تم انشاء المهمه بنجاح', isSuccess: true });

          // window.location.replace('/mytasks');
        } else {
          this.setState({ isLoading: false, responseMessage: res.data.message, isSuccess: false });     
        }
      })
      .catch(() => {
        this.setState({ isLoading: false, responseMessage: 'حدث خطا عند انشاء هذه المهمه', isSuccess: false });     
      })
  }

  render() {
    const { employees, files, previewFiles, isLoading, responseMessage, isSuccess } = this.state;

    const filesRef = React.createRef();

    return (
      <div className="container mt-4">
        <div className="row">
          <div className="col-md-12">
            <h4 className='mb-4'>Create New Task</h4>
            <Card>
              <form className="row" onSubmit={this.onSubmit}>
                <TaskForm 
                  onChange={this.onChange}
                  employees={employees}
                />

                <div className='col-md-3 mt-3'>
                  <h6>Upload Files</h6>
                  <ImageUploader
                    id={'invoice'}
                    inputFileRef={filesRef}
                    fileUploaderHandler={this.fileUploaderHandler}
                    previewFiles={previewFiles}
                    files={files}
                    deleteImage={this.deleteImage}
                  />
                </div>

                <div className="col-md-12 mb-2 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                  >
                    Create Task
                  </CustomButton>
                </div>
              </form>
            </Card>

            <Backdrop
              sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
              open={isLoading}
            >
              <CircularProgress color="inherit" />
            </Backdrop>

            <Snackbar 
              open={!!this.state.responseMessage} 
              autoHideDuration={6000}
              onClose={() => this.setState({ responseMessage: '' })}
            >
              <Alert 
                severity={isSuccess ? 'success' : 'error'}
                sx={{ width: '100%' }}
                onClose={() => this.setState({ responseMessage: '' })}
              >
                {responseMessage}
              </Alert>
            </Snackbar>
          </div>
        </div>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => {  
  return {
    session: state.session,
  };
}

const mapDispatchToProps = {}

export default connect(mapStateToProps, mapDispatchToProps)(CreateTask);
