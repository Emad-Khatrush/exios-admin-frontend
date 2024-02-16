import './BoxText.scss';

type Props = {
  firstText: string
  secondText: string
  style?: React.CSSProperties
}

const BoxText = (props: Props) => {
  return (
    <div style={props.style} className='dash-box d-flex flex-column'>
      <p className='first-text'> {props.firstText} </p>
      <p className='second-text'> {props.secondText} </p>
    </div>
  )
}

export default BoxText;