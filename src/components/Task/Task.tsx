import { Avatar, AvatarGroup } from '@mui/material';
import moment from 'moment';
import Badge from '../Badge/Badge';
import Card from '../Card/Card';
import { HiOutlineBell } from 'react-icons/hi';

import './Task.scss';

const labels: any = {
  urgent: 'عاجل',
  normal: 'عادي',
  limitedTime: 'وقت محدد'
}

type Props = {
  title: string
  description: string
  labelOfStatus: string
  avatars?: any
  actions?: {
    icon: any
    count: number
  }[]
  scheduledTime?: string
  hasNotification?: boolean
  onTitleClick?: (event: React.MouseEvent) => void
}

const Task = (props: Props) => {
  const { title, description, actions, scheduledTime, labelOfStatus, avatars, hasNotification, onTitleClick } = props;

  return (
    <Card
      style={{
        direction: 'rtl'
      }}
    >
      <div className='d-flex justify-content-between'>
        <h4 onClick={onTitleClick} className='task-title'>{title}</h4>
        <Badge text={labels[labelOfStatus]} color={labelOfStatus === 'urgent' ? 'danger' : 'primary'} />
      </div>
      <p className='task-description mb-1'>{description}</p>
      <AvatarGroup max={4} className="mb-3" style={{ direction: 'ltr' }} >
        {avatars && avatars.map((avatar: any) => (
          <Avatar alt="" src={avatar?.imgUrl} />
        ))}
      </AvatarGroup>
      <div className='d-flex justify-content-between'>
        <div className='d-flex gap-3'>
          {actions && actions.map((action, i) => (
            <div key={i} className="d-flex align-items-center gap-2 task-action">
              <span>{action.count}</span>
              {action.icon}
            </div>
          ))}
          {hasNotification &&
            <Badge text={<HiOutlineBell color='#d83c3c' />} color='danger' />
          }
        </div>
        {scheduledTime && labelOfStatus === 'limitedTime' &&
          <Badge text={`تسليم قبل ${moment(scheduledTime).format('DD-MM-YYYY')}`} color='warning' />
        }
      </div>
    </Card>
  )
}

export default Task;
