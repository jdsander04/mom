import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PanelRight, PanelLeft } from 'lucide-react';
import styles from './SideBar.module.css';

interface NavItem {
  label: string;
  href: string;
}

interface SideBarProps {
  navItems: NavItem[];
  onToggle: (minimized: boolean) => void;
  isMinimized: boolean;
}

const SideBar = ({ navItems, onToggle, isMinimized }: SideBarProps) => {

  return (
    <aside className={`${styles.sidebar} ${isMinimized ? styles.minimized : ''}`}>
      <nav className={styles.nav}>
        {!isMinimized && (
          <ul className={styles.navList}>
            {navItems.map((item, index) => (
              <li key={index}>
                <Link to={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <button 
        className={styles.toggleButton}
        onClick={() => onToggle(!isMinimized)}
      >
        {isMinimized ? <PanelRight size={30} /> : <PanelLeft size={30} />}
      </button>
    </aside>
  );
};

export default SideBar;
