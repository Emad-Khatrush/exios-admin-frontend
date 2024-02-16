import './ActionCard.scss';

import { GoPackage } from "react-icons/go";

type Props = {
  text: string,
  path: string
}

const ActionCard = (props: Props) => {
  
  return (
    <div className='action-card'>
      <GoPackage size="40px" className='icon' />
      <a target="_blank" rel="noreferrer" className='text' href={props.path}> {props.text} </a>
    </div>
  )
}

export default ActionCard;