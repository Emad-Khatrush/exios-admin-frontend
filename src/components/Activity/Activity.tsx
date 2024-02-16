import React from 'react'

import { Avatar } from '@mui/material';

import './Activity.scss';
import moment from 'moment-timezone';
import { Link } from 'react-router-dom';
import { ActivityType } from '../../models';
import { generateActivityText } from './utils';

type Props = {
  activity: ActivityType
  index: number
  totalList: number
}

const Activity = (props: Props) => {
  const { activity, index, totalList } = props;

  const showBreakLine = totalList - 1 > index;
  const text = generateActivityText(props);

  const path = activity.details.path;

  return (
    <div>
      <div className='d-flex activity'>
        <Avatar sx={{ width: 56, height: 56 }} className='logo' alt="Emad Khatrush" src={activity.user?.imgUrl} />
        <p className='details'> 
          <span className='full-name'> {activity.user?.firstName + ' ' + activity.user?.lastName} </span> 
          <span dangerouslySetInnerHTML={{__html: text}} />
          <Link className='activity-link' to={`${path}?id=${activity.details.actionId}`}> check here </Link>
        </p>
        <p className='time'> {moment(activity.createdAt).fromNow()}</p>
      </div>
      {showBreakLine &&
        <hr style={{ color: '#b7b7b7' }} />
      }
    </div>
  )
}

export default Activity;
