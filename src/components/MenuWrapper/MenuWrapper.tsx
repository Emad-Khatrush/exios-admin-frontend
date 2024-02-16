import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

const ITEM_HEIGHT = 48;

const MenuWrapper = (props: any) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div>
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        {props.children}
      </IconButton>
      <Menu
        id="long-menu"
        MenuListProps={{
          'aria-labelledby': 'long-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
          }
        }}
      >
        {props.options.map(({ Icon, title, path, target = '_self' }: any) => (
          <MenuItem 
            disableRipple 
            key={title} 
            style={{ display: 'flex', color: '#4d4d4d' }}
            onClick={() => {
              window.open(
                path,
                target
              );
            }}
          >
            <Icon style={{ marginRight: '8px' }} />
            {title}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export default MenuWrapper;
