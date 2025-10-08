import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './components/pages/HomePage'
import RecipeLibrary from './components/pages/RecipeLibrary'
import Shopping from './components/pages/Shopping'
import MealPlanner from './components/pages/MealPlanner'
import Health from './components/pages/Health'
import UserProfile from './components/pages/UserProfile'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes" element={<RecipeLibrary />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/planner" element={<MealPlanner />} />
          <Route path="/health" element={<Health />} />
          <Route path="/profile" element={<UserProfile />} />
        </Routes>
      </Layout>
    </Router>
  )

}

export default App
