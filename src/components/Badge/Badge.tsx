import './Badge.scss';

type Props = {
  text: any,
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'sky'
  style?: React.CSSProperties
}

const colors = {
  primary: {
    color: '#2255c4',
    backgroundColor: '#cfd6f7'
  },
  success: {
    color: '#01a74c',
    backgroundColor: '#d5f8e5'
  },
  warning: {
    color: '#947900',
    backgroundColor: '#f2f39b'
  },
  sky: {
    color: '#216d67',
    backgroundColor: '#aee7eb'
  },
  danger: {
    color: '#ce3232',
    backgroundColor: '#fad2d2'
  }
}

const Badge = (props: Props) => {
  return (
    <span
      {...props}
      className='custom-badge'
      style={{...props.style, ...colors[props.color || 'primary']}}
    >
      {props.text}
    </span>
  )
}

export default Badge;
