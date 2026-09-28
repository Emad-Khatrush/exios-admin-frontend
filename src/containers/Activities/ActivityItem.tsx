import { ArrowRight, Boxes, ExternalLink, FileText, HandCoins, Pencil, Plus, Receipt, Trash2, Wallet, Zap } from 'lucide-react';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { ActivityKind, ActivityStatus, ActivityType } from '../../models';
import { describeActivity, fieldLabel, formatValue, getActivityLink, initials, isImageActivity, isImageUrl, TYPE_LABELS } from './activityFormat';

type Props = {
  activity: ActivityType
  onPreviewImage: (url: string) => void
};

export const TYPE_ICONS: Record<ActivityKind, typeof FileText> = {
  order: FileText,
  expense: Receipt,
  income: Wallet,
  inventory: Boxes,
  debt: HandCoins,
  activity: Zap,
};

const STATUS_ICONS: Record<ActivityStatus, typeof Plus> = {
  added: Plus,
  updated: Pencil,
  deleted: Trash2,
};

const ActivityItem = ({ activity, onPreviewImage }: Props) => {
  const { status, type } = activity.details;
  const user = activity.user;
  const TypeIcon = TYPE_ICONS[type] || Zap;
  const StatusIcon = STATUS_ICONS[status] || Pencil;
  const link = getActivityLink(activity);
  const createdAt = moment(activity.createdAt);
  const fields = activity.changedFields || [];

  const images = isImageActivity(activity)
    ? fields.map((field) => (status === 'deleted' ? field.changedFrom : field.changedTo)).filter(isImageUrl) as string[]
    : [];
  const changes = !isImageActivity(activity) && status === 'updated' ? fields : [];
  const facts = !isImageActivity(activity) && status !== 'updated' ? fields.filter((field) => field.value) : [];

  return (
    <li className={`act-item act-item--${status}`}>
      <div className="act-avatar">
        {user?.imgUrl
          ? <img src={user.imgUrl} alt="" />
          : <span className="act-avatar__initials">{initials(user?.firstName, user?.lastName)}</span>}
        <span className={`act-avatar__status act-avatar__status--${status}`} aria-hidden="true">
          <StatusIcon size={10} strokeWidth={3} />
        </span>
      </div>

      <div className="act-body">
        <div className="act-line">
          <p className="act-sentence">
            <strong>{user ? `${user.firstName} ${user.lastName}` : 'Someone'}</strong>{' '}
            {describeActivity(activity)}
            {activity.subject && <> · <span className="act-subject">{activity.subject}</span></>}
          </p>
          <time className="act-time" dateTime={activity.createdAt} title={createdAt.format('dddd, D MMMM YYYY, HH:mm')}>
            {createdAt.format('HH:mm')}
          </time>
        </div>

        <div className="act-meta">
          <span className={`act-tag act-tag--${type}`}>
            <TypeIcon size={12} strokeWidth={2.2} />
            {TYPE_LABELS[type]?.one || type}
          </span>
          <span className={`act-status act-status--${status}`}>{status}</span>
          {link && (
            <Link className="act-open" to={link}>
              Open <ExternalLink size={12} />
            </Link>
          )}
        </div>

        {changes.length > 0 && (
          <ul className="act-changes">
            {changes.map((field, i) => (
              <li key={i} className="act-change">
                <span className="act-change__label">{fieldLabel(field)}</span>
                <span className="act-change__values">
                  <span className="act-change__from" title={formatValue(field.changedFrom)}>{formatValue(field.changedFrom)}</span>
                  <ArrowRight size={13} className="act-change__arrow" aria-label="changed to" />
                  <span className="act-change__to" title={formatValue(field.changedTo)}>{formatValue(field.changedTo)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {facts.length > 0 && (
          <dl className="act-facts">
            {facts.map((field, i) => (
              <div key={i} className="act-fact">
                <dt>{fieldLabel({ label: field.label })}</dt>
                <dd>{formatValue(field.value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {images.length > 0 && (
          <div className="act-images">
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                className={`act-image ${status === 'deleted' ? 'act-image--deleted' : ''}`}
                onClick={() => onPreviewImage(url)}
                aria-label="View photo"
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

export default ActivityItem;
