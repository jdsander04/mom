import './App.css'
import SideBar from './components/layout/SideBar'

function App() {
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
    <div style={{ marginLeft: '250px', padding: '1rem' }}>
      {/* Your existing content */}      
    </div>
  </>
)

}

export default App
