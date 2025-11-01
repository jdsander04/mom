import RecipeCard from '../common/RecipeCard';
import styles from './HomePage.module.css';
import { useRecipes } from '../../hooks/useRecipes';
import type { Recipe } from '../../types/recipe';

const HomePage = () => {
  const { popularRecipes, recentRecipes, loading, error, refetch } = useRecipes();

  const handleRecipeClick = (title: string) => {
    console.log(`Clicked on ${title}`);
  };

  // Helper function to extract calories from nutrients
  const getCalories = (recipe: Recipe): number => {
    const calorieNutrient = recipe.nutrients.find(n => 
      n.macro.toLowerCase().includes('calorie')
    );
    if (calorieNutrient) {
      return Math.round(calorieNutrient.mass);
    }
    // Return 0 if no calorie data found instead of random
    return 0;
  };

  // Helper function to get servings from recipe data
  const getServings = (recipe: Recipe): number => {
    // Use the serves field if available
    if (recipe.serves && recipe.serves > 0) {
      return recipe.serves;
    }
    // Default to 1 if no serving information found
    return 1;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <h1>Loading recipes...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h1>Error loading recipes</h1>
        <p>{error}</p>
        <button onClick={refetch}>Try Again</button>
      </div>
    );
  }

  const sections = [
    { title: "Popular Recipes", recipes: popularRecipes },
    { title: "Recent Recipes", recipes: recentRecipes }
  ];

  return (
    <>
      {sections.map((section) => [
        <h1 key={`${section.title}-title`} className={styles.pageTitle}>
          {section.title}
        </h1>,
        ...section.recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            title={recipe.name}
            subtitle={recipe.description}
            image={recipe.image_url || ''}
            calories={getCalories(recipe)}
            servings={getServings(recipe)}
            onClick={() => handleRecipeClick(recipe.name)}
            sourceUrl={recipe.source_url}
          />
        ))
      ])}
    </>
  );
};

export default HomePage;
