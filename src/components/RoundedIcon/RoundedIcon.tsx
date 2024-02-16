
import './RoundedIcon.scss';

type Props = {
  icon: any,
  borderColor?: string
  color?: string
}

const RoundedIcon = (props: Props) => {
  const Icon = props.icon;
  const { borderColor, color } = props;

  return (
    <div className='icon-design ml-0' style={{ borderColor: borderColor || '#9DCDF9' }}>
      <Icon className='custom-icon' style={{ color: color || '#2596FF' }} />
    </div>
  )
}

export default RoundedIcon;
