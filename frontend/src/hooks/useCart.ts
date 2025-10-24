import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Cart, CartRecipe, Recipe } from '../types/recipe';

export const useCart = () => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartRecipes, setCartRecipes] = useState<CartRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getOrCreateCart = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get existing carts
      const cartsResponse = await apiService.getCarts();
      
      if (cartsResponse.carts.length > 0) {
        // Use the first cart
        const existingCart = cartsResponse.carts[0];
        setCart(existingCart);
        
        // Get recipes for this cart
        const recipesResponse = await apiService.getCartRecipes(existingCart.id);
        setCartRecipes(recipesResponse.recipes);
      } else {
        // Create a new cart
        const newCartResponse = await apiService.createCart();
        const newCart = await apiService.getCart(newCartResponse.cart_id);
        setCart(newCart);
        setCartRecipes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
      console.error('Failed to get/create cart:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRecipeToCart = async (recipe: Recipe, quantity: number = 1) => {
    if (!cart) return;
    
    try {
      await apiService.addRecipeToCart(cart.id, recipe.id, quantity);
      await refreshCartRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe to cart');
      console.error('Failed to add recipe to cart:', err);
    }
  };

  const updateRecipeQuantity = async (recipeId: number, quantity: number) => {
    if (!cart) return;
    
    try {
      await apiService.updateRecipeQuantity(cart.id, recipeId, quantity);
      await refreshCartRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe quantity');
      console.error('Failed to update recipe quantity:', err);
    }
  };

  const removeRecipeFromCart = async (recipeId: number) => {
    if (!cart) return;
    
    try {
      await apiService.removeRecipeFromCart(cart.id, recipeId);
      await refreshCartRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recipe from cart');
      console.error('Failed to remove recipe from cart:', err);
    }
  };

  const refreshCartRecipes = async () => {
    if (!cart) return;
    
    try {
      const recipesResponse = await apiService.getCartRecipes(cart.id);
      setCartRecipes(recipesResponse.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cart recipes');
      console.error('Failed to refresh cart recipes:', err);
    }
  };

  const clearCart = async () => {
    if (!cart) return;
    
    try {
      await apiService.deleteCart(cart.id);
      setCart(null);
      setCartRecipes([]);
      await getOrCreateCart(); // Create a new empty cart
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
      console.error('Failed to clear cart:', err);
    }
  };

  useEffect(() => {
    getOrCreateCart();
  }, []);

  return {
    cart,
    cartRecipes,
    loading,
    error,
    addRecipeToCart,
    updateRecipeQuantity,
    removeRecipeFromCart,
    refreshCartRecipes,
    clearCart,
    refetch: getOrCreateCart
  };
};
