import './App.css'
import Layout from './components/layout/Layout'
import RecipeCard from './components/common/RecipeCard'

function App() {
  return (
    <Layout>
      {
        Array.from({ length: 10 }).map((_, index) => (
          <RecipeCard
            key={index}
            title={`Recipe ${index + 1}`}
            subtitle="Sample Recipe Description"
            image="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            calories={Math.floor(Math.random() * 1000)}
            servings={Math.floor(Math.random() * 10) + 1}
            onClick={() => console.log(`Clicked on Recipe ${index + 1}`)}
          />
        ))
      }      
    </Layout>
  )

}

export default App
