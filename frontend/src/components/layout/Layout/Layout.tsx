import { useState } from 'react';
import SideBar from '../SideBar';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  
  const navItems = [
    { label: 'Home Page', href: '/' },
    { label: 'Recipe Library', href: '/recipes' },
    { label: 'Shopping', href: '/shopping' },
    { label: 'Meal Planner', href: '/planner' },
    { label: 'Health and budgeting', href: '/health' }
  ];

  return (
    <>
      <SideBar 
        navItems={navItems} 
        onToggle={setIsSidebarMinimized}
        isMinimized={isSidebarMinimized}
      />
      <main className={`${styles.content} ${isSidebarMinimized ? styles.contentMinimized : ''}`}>
        {children}
      </main>
    </>
  );
};

export default Layout;