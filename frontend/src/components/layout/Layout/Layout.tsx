import SideBar from '../SideBar';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navItems = [
    { label: 'Home Page', href: '/' },
    { label: 'Recipe Library', href: '/recipes' },
    { label: 'Shopping', href: '/shopping' },
    { label: 'Meal Planner', href: '/planner' },
    { label: 'Health and budgeting', href: '/health' }
  ];

  return (
    <>
      <SideBar navItems={navItems} />
      <main className={styles.content}>
        {children}
      </main>
    </>
  );
};

export default Layout;