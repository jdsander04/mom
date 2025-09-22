import { useState } from 'react';
import { PanelRight, PanelLeft } from 'lucide-react';
import styles from './SideBar.module.css';

interface NavItem {
  label: string;
  href: string;
}

interface SideBarProps {
  navItems: NavItem[];
}

const SideBar = ({ navItems }: SideBarProps) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${isMinimized ? styles.minimized : ''}`}>
      <nav className={styles.nav}>
        {!isMinimized && (
          <ul className={styles.navList}>
            {navItems.map((item, index) => (
              <li key={index}>
                <a href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <button 
        className={styles.toggleButton}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        {isMinimized ? <PanelRight size={30} /> : <PanelLeft size={30} />}
      </button>
    </aside>
  );
};

export default SideBar;
