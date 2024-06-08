import './ActionCard.scss';

import { GoPackage } from "react-icons/go";

type Props = {
  text: string,
  path: string,
  icon?: any
}

const ActionCard = (props: Props) => {
  const Icon = props.icon || GoPackage;

  return (
    <div className='action-card'>
      <Icon size="40px" className='icon' />
      <a target="_blank" rel="noreferrer" className='text' href={props.path}> {props.text} </a>
    </div>
  )
}

export default ActionCard;