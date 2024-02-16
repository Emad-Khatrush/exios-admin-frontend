import React from 'react'

import './TextInput.scss';

type Props = {
  id?: string
  placeholder: string
  className?: string
  type?: 'text' | 'password'
  onChange?: any
  icon: any
  name?: string
  defaultValue?: string
  value?: string
}

const SearchInput = ({ placeholder, icon, className, type, onChange, id, name, defaultValue, value }: Props) => {
  return (
    <div className={`d-flex`}>
      <div className={`search-icon`}>
        {icon}
      </div>
      <input
        name={name}
        id={id} 
        onChange={onChange} 
        className={`search-input ${className}`} 
        placeholder={placeholder} 
        type={type}
        defaultValue={defaultValue}
        value={value}
      />
    </div>
  )
}
export default SearchInput;
