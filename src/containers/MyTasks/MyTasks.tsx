import { connect } from 'react-redux'
import React, { Component } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { ImAttachment } from "react-icons/im";
import Task from '../../components/Task/Task'
import { FaRegComment } from 'react-icons/fa';
import { Alert, Avatar, AvatarGroup, Backdrop, Box, CircularProgress, Dialog, Snackbar } from '@mui/material';
import CustomButton from '../../components/CustomButton/CustomButton';
import { AiFillAlert, AiOutlineEdit, AiOutlinePlus } from 'react-icons/ai';
import api from '../../api';
import ModalClose from '@mui/joy/ModalClose';
import Typography from '@mui/joy/Typography';
import moment from 'moment';
import FilesPreviewers from '../../components/FilesPreviewers/FilesPreviewers';
import { Link } from 'react-router-dom';
import CommentsSection from '../../components/CommentsSection/CommentsSection';
import { User } from '../../models';
import withRouter from '../../utils/WithRouter/WithRouter';


type MyProps = {
  account: User
  router?: any
}

const labels: any = {
  urgent: 'عاجل',
  normal: 'عادي',
  limitedTime: 'وقت محدد'
}

const statusLabels: any = {
  processing: 'في قيد تجهيز ',
  finished: 'اكتملت',
  needsApproval: 'تحتاج للموافقة'
}

type State = {
  isDialogOpen: boolean
  tasks: any[]
  searchValue: string
  countList: {
    notificationsCount: number
    myTasksCount: number
    urgentCount: number
    finishedCount: number
    waitingApproval: number
  }
  clickedTask: any
  isLoading: boolean
  isCommentsFetching: boolean
  commentInput: string
  comments: any
  responseMessage: string
  isSuccess: boolean
}

export class MyTasks extends Component<MyProps, State> {
  state = {
    isDialogOpen: false,
    tasks: [{
      title: '',
      description: ''
    }],
    searchValue: 'notifications',
    countList: {
      notificationsCount: 0,
      myTasksCount: 0,
      urgentCount: 0,
      finishedCount: 0,
      requestedTasksCount: 0,
      needsApproval: 0,
      waitingApproval: 0
    },
    clickedTask: null,
    isLoading: false,
    isCommentsFetching: false,
    commentInput: '',
    comments: [],
    responseMessage: '',
    isSuccess: false
  }

  async componentDidMount() {
    const taskId = new URLSearchParams(this.props.router.location?.search).get('id') || '';
    
    this.setState({ isLoading: true })
    try {
      const res = await api.get(`mytasks?taskType=notifications`);
      const tasks = res.data.results;
      const countList = res.data.countList;
      let clickedTask, comments;

      if (taskId) {
        try {
          clickedTask = (await api.get(`task/${taskId}`))?.data;
          comments = (await api.get(`task/${clickedTask._id}/comments`))?.data;
        } catch (error) {
          clickedTask = undefined;
        }
      }
      const isDialogOpen = !!clickedTask;

      this.setState({ tasks, countList, clickedTask, isDialogOpen, comments });
    } catch (error) {
      console.log(error);
    } finally {
      this.setState({ isLoading: false })
    }
  }

  getTask = async (task: any) => {
    this.setState({ isDialogOpen: true, clickedTask: task, isCommentsFetching: true });
    try {
      const comments = (await api.get(`task/${task._id}/comments`))?.data;

      if (task.hasNotification) {
        await api.post(`task/${task._id}/readed`, {});
        const res = await api.get(`mytasks?taskType=${this.state.searchValue}`);
        const tasks = res.data.results;
        const countList = res.data.countList;
        return this.setState({ tasks, countList, clickedTask: task, comments });
      }
      
      this.setState({ clickedTask: task, comments });
    } catch (error) {
      console.log(error);
    } finally {
      this.setState({ isCommentsFetching: false })
    }
  }

  onTabChange = async (value: string) => {
    this.setState({ isLoading: true })
    try {
      const res = await api.get(`mytasks?taskType=${value}`);
      const tasks = res.data.results;
      const countList = res.data.countList;

      this.setState({ tasks, countList, searchValue: value });
    } catch (error) {
      console.log(error);
    } finally {
      this.setState({ isLoading: false })
    }
  }

  addNewComment = async (event: any) => {
    const { clickedTask, commentInput }: any = this.state;
    if (!commentInput) return;

    try {
      this.setState({ isLoading: true });
      await api.post(`task/${clickedTask._id}/comments`, { message: commentInput });
      const comments = (await api.get(`task/${clickedTask._id}/comments`))?.data;
      
      const { account } = this.props;
      const task: any = this.state.clickedTask;

      const message = `
        ارسل لك ${account.firstName} ${account.lastName} 
        تعليق جديد بالتاسك التالي:
        عنوان التاسك '${task.title}'
        والحالة: ${labels[task.label]}
        التعليق الجديد: '${commentInput}'
        يرجى دخول على التاسك لعرض التعليق واكتمال التاسك في اسرع وقت
        https://exios-admin-frontend.web.app/mytasks?id=${task._id}
        شكرا لكم
      `
      await this.sendWhatsupMessage(message, 'add-comment');
      this.setState({ comments, commentInput: '' });
    } catch (error) {
      console.log(error);
    }
  }

  sendWhatsupMessage = (customMessage?: string, action?: any) => {
    const { account } = this.props;
    const task: any = this.state.clickedTask;

    const message = customMessage || `
      ارسل لك ${account.firstName} ${account.lastName} 
      تذكير خاص بالتاسك لكي تقوم بالحل المشكلة او تحديث التاسك على ان تم انتهاء التاسك او الرد على التعليقات الخاصه بالتاسك، حيث معلوماته التاسك كالاتي
      عنوان التاسك '${task.title}'
      والحالة: ${labels[task.label]}
      يرجى دخول للتاسك وبدا في حل المشكلة
      https://exios-admin-frontend.web.app/mytasks?id=${task._id}
      شكرا لكم
    `;

    this.setState({ isLoading: true });

    if (action === 'add-comment' && account._id !== task.createdBy._id) {
      task.reviewers.push(task.createdBy)
    }

    (task.reviewers || []).forEach((user: User) => {
      const phoneNumber = (user.phone as any) === "5535728209" ? '5535728209@c.us' : `${user.phone}@c.us`
      if (user._id !== account._id) {
        api.post(`sendWhatsupMessage`, { phoneNumber, message })
          .then((res) => {
            this.setState({
              responseMessage: 'Whatsup message has been send successfully',
              isSuccess: true,
              isLoading: false
            })
          })
          .catch((err) => {
            console.log(err);
            this.setState({
              responseMessage: err.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : err.response.data.message,
              isSuccess: false,
              isLoading: false
            })
        })
      }
    })
  }

  render() {
    const { tasks, isDialogOpen, countList, isLoading, clickedTask, comments }: any = this.state;

    const tabs = [
      {
        label: 'Notifications',
        value: 'notifications',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.notificationsCount)} color="warning" />
      },
      {
        label: 'My Tasks',
        value: 'myTasks',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.myTasksCount)} color="sky" />
      },
      {
        label: 'Urgent Tasks',
        value: 'urgent',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.urgentCount)} color="danger" />
      },
      {
        label: 'Requested Tasks',
        value: 'requestedTasks',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.requestedTasksCount)} color="primary" />
      },
      {
        label: 'Needs Approval',
        value: 'needsApproval',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.needsApproval)} color="primary" />
      },
      {
        label: 'Waiting Approval',
        value: 'waitingApproval',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.waitingApproval)} color="primary" />
      },
      {
        label: 'Finished Tasks',
        value: 'finished',
        icon: <Badge style={{ marginLeft: '8px'}} text={String(countList.finishedCount)} color="success" />
      }
    ]

    const hasTasks = tasks.length > 0;

    return (
      <div className="container mt-4">
        <div className="row">
          <div className="col-12 mb-4 text-end">
            <CustomButton
              background='rgb(0, 171, 85)' 
              size="small" 
              icon={<AiOutlinePlus />}
              href={'/task/add'}
            >
              Add New Task
            </CustomButton>
          </div>
          <div className="col-12">
            <Card
              leand
              tabs={tabs}
              style={{
                height: '0',
              }}
              bodyStyle={{
                marginTop: '20px',
              }}
              searchInputOnChange={(event: any) => {
                this.setState({ searchValue: event.target.value });
              }}
              tabsOnChange={(value: string) => this.onTabChange(value)}
              // onScroll={this.onScroll}
            />

            {!hasTasks &&
              <p className='m-1'>Tasks Not Found</p>
            }

            {!isLoading ? hasTasks && tasks.map((task: any) => (
              <Task
                key={task._id}
                title={task.title}
                description={task.description}
                labelOfStatus={task.label}
                avatars={task.reviewers}
                actions={[
                  { icon: <ImAttachment size={18} />, count: task.files?.length },
                  { icon: <FaRegComment size={18} />, count: task.comments?.length },
                ]}
                scheduledTime={task.limitedTime}
                onTitleClick={() => this.getTask(task)}
                hasNotification={task.hasNotification}
              />
             ))
             :
             <div> 
              <CircularProgress />
             </div>
            }
          </div>
        </div>
        
        {clickedTask && 
          <Dialog
            open={isDialogOpen}
            onClose={() => this.setState({ isDialogOpen: false })}
            scroll="body"
          >
            <Box
              sx={{
                maxWidth: 600,
                width: 600,
                borderRadius: 'md',
                p: 3,
                boxShadow: 'lg',
                border: '1px solid #e6e6e6',
                bgcolor: '#fff',
              }}
            >
              <ModalClose
                variant="outlined"
                sx={{
                  boxShadow: '0 2px 12px 0 rgba(0 0 0 / 0.2)',
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  border: '1px solid #e6e6e6',
                }}
                onClick={() => this.setState({ isDialogOpen: false })}
              />

              <CustomButton 
                background='rgb(0, 171, 85)' 
                size="small"
                onClick={() => this.sendWhatsupMessage()}
                icon={<AiFillAlert />}
              >
                Alert Reviewrs
              </CustomButton>
              
              <div className='d-flex justify-content-between align-items-center mb-5 mt-4'>
                <div>
                  <Link to={`/task/${clickedTask._id}/edit`}>
                    <AiOutlineEdit size="25" style={{ cursor: 'pointer' }} />
                  </Link>

                </div>

                <Typography
                  component="h2"
                  id="modal-title"
                  level="h4"
                  textColor="inherit"
                  fontWeight="lg"
                  mb={1}
                >
                  {clickedTask.title as any}
                </Typography>
              </div>
              <Typography id="modal-desc" textColor="text.tertiary">
                <div className='d-flex align-items-center'>
                  <p style={{ width: '150px', color: '#707070' }}> Status </p>
                  <p> {statusLabels[clickedTask.status]} </p>
                </div>

                <div className='d-flex align-items-center'>
                  <p style={{ width: '150px', color: '#707070' }}> Created By </p>
                  <p className='d-flex align-items-center gap-2'> <Avatar sx={{ width: '35px', height: '35px' }} src={clickedTask.createdBy?.imgUrl} /> {clickedTask.createdBy.firstName} {clickedTask.createdBy.lastName} </p>
                </div>

                <div className='d-flex align-items-center'>
                  <p style={{ width: '150px', color: '#707070' }}> Reviewers </p>
                  <div className='d-flex align-items-center gap-2'>
                    <AvatarGroup max={4} className="mb-3" style={{ direction: 'ltr' }} >
                      {clickedTask.reviewers && clickedTask.reviewers.map((reviewer: any) => (
                        <Avatar sx={{ width: '35px', height: '35px' }} alt="" src={reviewer?.imgUrl} />
                      ))}
                    </AvatarGroup>
                  </div>
                </div>

                <div className='d-flex'>
                  <p style={{ width: '150px', color: '#707070' }}> Problem In </p>
                  <a style={{ textDecoration: 'none' }} href={`/invoice/${clickedTask.order._id}/edit`} target="_blank" rel="noreferrer"> {clickedTask.order.orderId} طلبية </a>
                </div>

                <div className='d-flex'>
                  <p style={{ width: '150px', color: '#707070' }}> Created Date </p>
                  <p> {moment(clickedTask.createdAt).format('DD-MM-YYYY')} </p>
                </div>

                <div className='d-flex'>
                  <p style={{ width: '150px', color: '#707070' }}> Label </p>
                  <Badge text={labels[clickedTask.label]} color={clickedTask.label === 'urgent' ? 'danger' : 'primary'} />
                </div>
                {clickedTask.label === 'limitedTime' &&
                  <div className='d-flex'>
                    <p style={{ width: '150px', color: '#707070' }}> Last Date </p>
                    <p> {moment(clickedTask.limitedTime).format('DD-MM-YYYY')} </p>
                  </div>
                }
              </Typography>

              <hr style={{ color: '#a1a1a1' }} />

              <Typography id="modal-desc" textColor="text.tertiary" style={{ direction: 'rtl', textAlign: 'start' }}>
                <h6> شرح العمل </h6>
                <p style={{ color: '#686868', fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: clickedTask.description.replace(/\n/g, '<br />')}} />
              </Typography>

              
              {clickedTask.files.length > 0 &&
                <Typography id="modal-desc" textColor="text.tertiary" style={{ direction: 'rtl', textAlign: 'start' }}>
                  <hr style={{ color: '#a1a1a1' }} />
                  <h6> ملفات المرفقة</h6>

                  <FilesPreviewers 
                    previewFiles={clickedTask.files}
                    files={clickedTask.files}
                  />
                </Typography>
              }
              <Typography id="modal-desc" textColor="text.tertiary" style={{ direction: 'rtl', textAlign: 'start' }}>
                  <hr style={{ color: '#a1a1a1' }} />
                  <h6>الانشطة</h6>

                  {this.state.isCommentsFetching ? 
                    <CircularProgress />
                    :
                    <CommentsSection 
                      comments={comments}
                      account={this.props.account}
                      onTextChange={(event: any) => this.setState({ commentInput: event.target.value })}
                      onAddCommentClick={this.addNewComment}
                      commentValue={this.state.commentInput}
                      isPending={this.state.isLoading}
                    />
                  }
                </Typography>
            </Box>
          </Dialog>
        }
        
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 2000 }}
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
            severity={this.state.isSuccess ? 'success' : 'error'}
            sx={{ width: '100%' }}
            onClose={() => this.setState({ responseMessage: '' })}
          >
            {this.state.responseMessage}
          </Alert>
        </Snackbar>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => ({
  account: state.session.account
})

const mapDispatchToProps = {}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(MyTasks))