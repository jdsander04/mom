import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import RecipeCard from '../common/RecipeCard';
import styles from './HomePage.module.css';
import { useRecipes } from '../../hooks/useRecipes';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import type { Recipe } from '../../types/recipe';

const HomePage = () => {
  const navigate = useNavigate();
  const { popularRecipes, recentRecipes, loading, error, refetch } = useRecipes();
  const { user } = useAuth();
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [copying, setCopying] = useState(false);

  const handleRecipeClick = async (recipe: Recipe) => {
    // Check if recipe belongs to current user
    const isOwnRecipe = recipe.user_id && user && recipe.user_id === user.id;
    
    if (isOwnRecipe) {
      // Navigate to recipe detail page if it's the user's own recipe
      navigate(`/recipes?recipeId=${recipe.id}`);
    } else {
      // Show copy dialog if it's someone else's recipe
      setSelectedRecipe(recipe);
      setCopyDialogOpen(true);
    }
  };

  const handleCopyRecipe = async () => {
    if (!selectedRecipe) return;
    
    setCopying(true);
    try {
      const result = await apiService.copyRecipe(selectedRecipe.id);
      setCopyDialogOpen(false);
      // Navigate to the copied recipe
      navigate(`/recipes?recipeId=${result.id}`);
      // Refresh recipes to show the new copy
      refetch();
    } catch (error) {
      console.error('Failed to copy recipe:', error);
      alert('Failed to add recipe to your library. Please try again.');
    } finally {
      setCopying(false);
      setSelectedRecipe(null);
    }
  };

  const handleCancelCopy = () => {
    setCopyDialogOpen(false);
    setSelectedRecipe(null);
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
            onClick={() => handleRecipeClick(recipe)}
            sourceUrl={recipe.source_url}
          />
        ))
      ])}
      
      <Dialog open={copyDialogOpen} onClose={handleCancelCopy}>
        <DialogTitle>Add Recipe to Your Library?</DialogTitle>
        <DialogContent>
          {selectedRecipe && (
            <Typography>
              Add <strong>{selectedRecipe.name}</strong> to your recipe library?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelCopy} disabled={copying}>
            Cancel
          </Button>
          <Button 
            onClick={handleCopyRecipe} 
            variant="contained" 
            disabled={copying}
            sx={{
              backgroundColor: '#2e7d32',
              '&:hover': {
                backgroundColor: '#1b5e20'
              }
            }}
          >
            {copying ? 'Adding...' : 'Add to Library'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default HomePage;
