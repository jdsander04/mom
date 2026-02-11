import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Cart } from '../types/cart';
import type { Recipe } from '../types/recipe';

export const useCart = () => {
  const [cart, setCart] = useState<Cart | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCart = async () => {
    try {
      setLoading(true);
      setError(null);

      const cartData = await apiService.getCart();
      setCart(cartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
      console.error('Failed to get cart:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRecipeToCart = async (recipe: Recipe, quantity: number = 1) => {
    try {
      // apiService.addRecipeToCart takes (recipeId, servingSize)
      // It does NOT take cartId
      await apiService.addRecipeToCart(recipe.id, quantity);
      await getCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe to cart');
      console.error('Failed to add recipe to cart:', err);
    }
  };

  const updateRecipeQuantity = async (recipeId: number, quantity: number) => {
    try {
      // apiService.updateRecipeServingSize takes (recipeId, servingSize)
      await apiService.updateRecipeServingSize(recipeId, quantity);
      await getCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe quantity');
      console.error('Failed to update recipe quantity:', err);
    }
  };

  const removeRecipeFromCart = async (recipeId: number) => {
    try {
      await apiService.removeRecipeFromCart(recipeId);
      await getCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recipe from cart');
      console.error('Failed to remove recipe from cart:', err);
    }
  };

  // There is no explicit "clear cart" in generic API service provided, 
  // but we might iterate and remove items or implement it if API supported it.
  // For now, removing it or implementing via item removal if strictly needed.
  // Assuming strict adherence to API service capabilities found.

  useEffect(() => {
    getCart();
  }, []);

  return {
    cart,
    cartRecipes: cart?.recipes || [], // Mapping cart recipes
    loading,
    error,
    addRecipeToCart,
    updateRecipeQuantity,
    removeRecipeFromCart,
    refreshCartRecipes: getCart,
    refetch: getCart
  };
};
