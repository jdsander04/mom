import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { apiService } from '../services/api';

interface UseRecipesReturn {
  recipes: Recipe[];
  popularRecipes: Recipe[];
  trendingRecipes: Recipe[];
  recentRecipes: Recipe[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useRecipes = (): UseRecipesReturn => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [trendingRecipes, setTrendingRecipes] = useState<Recipe[]>([]);
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
      
      // Get trending and recent recipes
      const [trending, recent] = await Promise.all([
        apiService.getTrendingRecipes(),
        apiService.getRecentRecipes()
      ]);
      
      setTrendingRecipes(trending);
      setRecentRecipes(recent);
      
      // Keep popular recipes for backward compatibility (can be removed later)
      const popular = await apiService.getPopularRecipes(6);
      setPopularRecipes(popular);
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
    trendingRecipes,
    recentRecipes,
    loading,
    error,
    refetch: fetchRecipes
  };
};
