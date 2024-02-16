import React from 'react'
import { Avatar, Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material';

type Props = {
  open?: boolean | undefined
  onOpen?: any
  onClose?: any
  alt?: string
  src: string
}

const defaultProps = {
  open: false
};

const settings: any = [
  {
    title: 'Settings',
    onClick: () => {
      
    }
  },
  {
  title: 'Logout',
  onClick: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      window.location.replace('/login');
    }
  },
];

const Logo = (props: Props) => {

  const { open, onOpen, onClose } = props;
    
  return (
    <Box sx={{ flexGrow: 0 }}>
      <Tooltip title="Open settings">
      <IconButton onClick={() => onOpen()} sx={{ p: 0 }}>
        <Avatar className='logo' alt={props.alt} src={props.src} />
      </IconButton>
      </Tooltip>
      <Menu
        style={{
          top: 25
        }}
        sx={{ mt: '45px' }}
        id="menu-appbar"
        anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
        }}
        open={open || false}
        onClose={() => onClose()}
      >
      {settings.map((setting: any) => (
          <MenuItem key={setting.title}>
              <Typography onClick={setting.onClick} textAlign="center">{setting.title}</Typography>
          </MenuItem>
      ))}
      </Menu>
  </Box>
  )
}
Logo.defaultProps = defaultProps;

export default Logo;