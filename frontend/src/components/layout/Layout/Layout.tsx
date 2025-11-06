import { useState } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { 
  Home, 
  MenuBook, 
  ShoppingCart, 
  CalendarMonth, 
  HealthAndSafety 
} from '@mui/icons-material';
import SideBar from '../SideBar';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Home Page', href: '/', icon: <Home /> },
  { label: 'Recipe Library', href: '/recipes', icon: <MenuBook /> },
  { label: 'Cart', href: '/cart', icon: <ShoppingCart /> },
  { label: 'Meal Planner', href: '/planner', icon: <CalendarMonth /> },
  { label: 'Health and budgeting', href: '/health', icon: <HealthAndSafety /> }
];

const DEFAULT_CONTENT_STYLES = {
  margin: '0 auto',
  padding: '2rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  columnGap: '2rem',
  rowGap: '1rem',
  maxWidth: '1200px',
  width: '1200px',
  minWidth: '1200px'
};

const FULL_WIDTH_CONTENT_STYLES = {
  padding: 0,
  width: '100%',
  flex: 1
};

const PLANNER_CONTENT_STYLES = {
  margin: '0 auto',
  padding: '2rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  columnGap: '2rem',
  rowGap: '1rem',
  maxWidth: '100%',
  width: '100%',
  boxSizing: 'border-box'
};

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const location = useLocation();
  const isCartPage = location.pathname === '/cart';
  const isPlannerPage = location.pathname === '/planner';

  const getContentStyles = () => {
    if (isCartPage) return FULL_WIDTH_CONTENT_STYLES;
    if (isPlannerPage) return PLANNER_CONTENT_STYLES;
    return DEFAULT_CONTENT_STYLES;
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <SideBar 
        navItems={NAV_ITEMS} 
        onToggle={setIsSidebarMinimized}
        isMinimized={isSidebarMinimized}
      />
      <Box component="main" sx={getContentStyles()}>
        {children}
      </Box>
    </Box>
  );
};

export default Layout;