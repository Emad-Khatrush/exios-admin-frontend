
import { Avatar } from '@mui/material';
import moment from 'moment';
import React from 'react';
import { User } from '../../models';
import './CommentsSection.scss';

type Props = {
  account: User
  comments: any[]
  onTextChange?: (event: React.ChangeEvent) => void
  onAddCommentClick?: (event: React.MouseEvent) => void
  commentValue: string
  isPending: boolean
}

const CommentsSection = (props: Props) => {
  const { comments, account, isPending, onTextChange, onAddCommentClick, commentValue } = props;

  return (
    <div className='mt-2'>
        <div className="d-flex justify-content-center row">
          <div className="d-flex flex-column col-md-12">
              <div className="coment-bottom bg-white">
                <div className="d-flex flex-row add-comment-section mb-2 gap-2">
                <Avatar sx={{ width: 56, height: 56 }} className='img-fluid img-responsive rounded-circle mr-2' alt="Emad Khatrush" src={account?.imgUrl} />
                  <textarea
                    className="comment-input"
                    placeholder="Write your comment here"
                    style={{ width: '100%' }} 
                    name="comment" 
                    cols={30} 
                    rows={2}
                    onChange={onTextChange}
                    value={commentValue}
                  />
                </div>

                <div className='text-start'>
                  <button disabled={isPending} onClick={onAddCommentClick} className="btn btn-sm btn-primary" type="button">Comment</button>
                </div>

          {comments && comments.length > 0 && comments.map(comment => (
            <div className="commented-section mt-2">
              <div className={`d-flex flex-row ${comment.createdBy?._id !== account._id ? 'justify-content-end' : ''} align-items-center commented-user`}>
                <span className="mb-1 ml-2 comment-text-sm" style={{ direction: 'ltr' }}>{moment(comment.createdAt).fromNow()}</span>
                <span className="dot mb-1 mx-2"></span>
                <h5 className="mr-2 comment-text-md mb-1">{`${comment.createdBy.firstName} ${comment.createdBy.lastName}`}</h5>
              </div>
              <div className={`${comment.createdBy?._id !== account._id ? 'text-start' : ''}`}>
                <span className={`comment-text-sm`} dangerouslySetInnerHTML={{ __html: comment.message.replace(/\n/g, '<br />')}} />
              </div>
              <hr />
            </div>
          ))}
    </div>
    </div>
    </div>
    </div>
  )
}

export default CommentsSection;
