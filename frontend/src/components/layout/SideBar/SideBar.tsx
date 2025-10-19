import { Link } from 'react-router-dom';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText, 
  ListItemIcon,
  IconButton,
  Box,
  Avatar,
  ButtonBase 
} from '@mui/material';
import { ChevronLeft, ChevronRight, Logout } from '@mui/icons-material';
import { useAuth } from 'src/contexts/AuthContext';
import * as React from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SideBarProps {
  navItems: NavItem[];
  onToggle: (minimized: boolean) => void;
  isMinimized: boolean;
}

const SIDEBAR_WIDTH = {
  expanded: 250,
  collapsed: 60
};

const COLORS = {
  background: '#f8f9fa',
  border: '#CDCDCD',
  text: '#333',
  hover: '#F8EFD0',
  hoverBorder: '#7B7565'
};

const SideBar = ({ navItems, onToggle, isMinimized }: SideBarProps) => {
  const { logout, user } = useAuth();
  const drawerStyles = {
    width: isMinimized ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: isMinimized ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
      boxSizing: 'border-box',
      transition: 'width 0.3s ease',
      backgroundColor: COLORS.background,
      borderRight: `1px solid ${COLORS.border}`,
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh'
    },
  };

  const listItemButtonStyles = {
    display: 'flex',
    padding: '0.5rem 0.7rem',
    textDecoration: 'none',
    color: COLORS.text,
    borderRadius: 0,
    transition: 'background-color 0.2s',
    textAlign: 'left',
    fontFamily: 'Lexend, sans-serif',
    justifyContent: isMinimized ? 'center' : 'flex-start',
    '&:hover': {
      backgroundColor: COLORS.hover,
      color: '#000000',
      borderRight: isMinimized ? 'none' : `3px solid ${COLORS.hoverBorder}`
    }
  };

  const iconStyles = {
    minWidth: isMinimized ? 'auto' : '0px',
    color: 'inherit',
    opacity: isMinimized ? 1 : 0,
    transition: 'opacity 0.3s ease',
    transitionDelay: isMinimized ? '0.2s' : '0s'
  };

  const textStyles = {
    marginLeft: '-16px',
    '& .MuiListItemText-primary': {
      fontFamily: 'Lexend, sans-serif',
      fontSize: 'inherit',
      whiteSpace: 'nowrap'
    }
  };

  const toggleButtonStyles = {
    position: 'absolute',
    bottom: '0.5rem',
    right: isMinimized ? 'auto' : '0.5rem',
    left: isMinimized ? '50%' : 'auto',
    transform: isMinimized ? 'translateX(-50%)' : 'none',
    backgroundColor: 'transparent',
    border: 'none',
    padding: '0.15rem',
    cursor: 'pointer',
    color: 'black',
    lineHeight: 1,
    '&:hover': {
      backgroundColor: COLORS.hover
    }
  };

  return (
    <Drawer variant="permanent" sx={drawerStyles}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0.5rem', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <ButtonBase
            component={Link}
            to="/profile"
            aria-label="User profile"
          >
            <Avatar
              sx={{ width: isMinimized ? 32 : 56, height: isMinimized ? 32 : 56 }}
            />
          </ButtonBase>
        </Box>
        <List sx={{ padding: 0, margin: 0, flex: 1 }}>
          {navItems.map((item, index) => (
            <ListItem key={index} sx={{ marginBottom: '0.5rem', padding: 0 }}>
              <ListItemButton component={Link} to={item.href} sx={listItemButtonStyles}>
                <ListItemIcon sx={iconStyles}>
                  {item.icon}
                </ListItemIcon>
                {!isMinimized && (
                  <ListItemText primary={item.label} sx={textStyles} />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ marginTop: 'auto', marginBottom: '3rem' }}>
          <ListItem sx={{ padding: 0 }}>
            <ListItemButton onClick={logout} sx={listItemButtonStyles}>
              <ListItemIcon sx={iconStyles}>
                <Logout />
              </ListItemIcon>
              {!isMinimized && (
                <ListItemText primary="Logout" sx={textStyles} />
              )}
            </ListItemButton>
          </ListItem>
        </Box>
      </Box>
      <IconButton onClick={() => onToggle(!isMinimized)} sx={toggleButtonStyles}>
        {isMinimized ? <ChevronRight /> : <ChevronLeft />}
      </IconButton>
    </Drawer>
  );
};

export default SideBar;