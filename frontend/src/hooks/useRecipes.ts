import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { apiService } from '../services/api';

interface UseRecipesReturn {
  recipes: Recipe[];
  popularRecipes: Recipe[];
  recentRecipes: Recipe[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useRecipes = (): UseRecipesReturn => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all recipes first
      const response = await apiService.getRecipes();
      const allRecipePromises = response.recipes.map(recipe => apiService.getRecipe(recipe.id));
      const allRecipes = await Promise.all(allRecipePromises);
      
      // Remove duplicates based on recipe ID
      const uniqueRecipes = allRecipes.filter((recipe, index, self) => 
        index === self.findIndex(r => r.id === recipe.id)
      );
      
      // Sort by date_added (newest first) for main recipe list
      const sortedRecipes = uniqueRecipes.sort((a, b) => {
        const dateA = new Date(a.date_added || 0).getTime();
        const dateB = new Date(b.date_added || 0).getTime();
        return dateB - dateA;
      });
      
      // Set all recipes
      setRecipes(sortedRecipes);
      
      // Get properly sorted popular and recent recipes
      const [popular, recent] = await Promise.all([
        apiService.getPopularRecipes(),
        apiService.getRecentRecipes()
      ]);
      
      setPopularRecipes(popular);
      setRecentRecipes(recent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return {
    recipes,
    popularRecipes,
    recentRecipes,
    loading,
    error,
    refetch: fetchRecipes
  };
};
