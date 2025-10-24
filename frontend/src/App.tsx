import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import Layout from './components/layout/Layout'
import Login from './components/auth/Login'
import HomePage from './components/pages/HomePage'
import RecipeLibrary from './components/pages/RecipeLibrary'
import Cart from './components/pages/Cart'
import MealPlanner from './components/pages/MealPlanner'
import Health from './components/pages/Health'
import UserProfile from './components/pages/UserProfile'

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <CartProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes" element={<RecipeLibrary />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/planner" element={<MealPlanner />} />
          <Route path="/health" element={<Health />} />
          <Route path="/profile" element={<UserProfile />} />
        </Routes>
      </Layout>
    </CartProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App
