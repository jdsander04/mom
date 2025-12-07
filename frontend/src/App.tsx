import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import Layout from './components/layout/Layout'
import Login from './components/auth/Login'
import LandingPage from './components/pages/LandingPage'
import HomePage from './components/pages/HomePage'
import RecipeLibrary from './components/pages/RecipeLibrary'
import Cart from './components/pages/Cart'
import MealPlanner from './components/pages/MealPlanner'
import Health from './components/pages/Health'
import UserProfile from './components/pages/UserProfile'
import OrderHistory from './components/pages/OrderHistory'

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
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
          <Route path="/order-history" element={<OrderHistory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
