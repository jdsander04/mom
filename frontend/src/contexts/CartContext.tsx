import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import type { Cart, CartRecipe, CartItem } from '../types/cart';

interface CartContextType {
  cart: Cart;
  loading: boolean;
  refreshCart: () => Promise<void>;
  removeRecipe: (recipeId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  updateServingSize: (recipeId: number, servingSize: number) => Promise<void>;
  updateItemQuantity: (itemId: number, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [cart, setCart] = useState<Cart>({ recipes: [] });
  const [loading, setLoading] = useState(true);

  const refreshCart = async () => {
    try {
      const cartData = await apiService.getCart();
      setCart(cartData || { recipes: [] });
    } catch (error) {
      console.error('Failed to load cart:', error);
      setCart({ recipes: [] });
    } finally {
      setLoading(false);
    }
  };

  const removeRecipe = async (recipeId: number) => {
    // Optimistic update
    setCart(prev => ({
      recipes: prev.recipes.filter(recipe => recipe.recipe_id !== recipeId)
    }));
    
    try {
      await apiService.removeRecipeFromCart(recipeId);
    } catch (error) {
      console.error('Failed to remove recipe:', error);
      await refreshCart(); // Revert on error
      throw error;
    }
  };

  const removeItem = async (itemId: number) => {
    // Optimistic update
    setCart(prev => ({
      recipes: prev.recipes.map(recipe => ({
        ...recipe,
        ingredients: recipe.ingredients.filter(item => item.id !== itemId)
      }))
    }));
    
    try {
      await apiService.removeItemFromCart(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
      await refreshCart(); // Revert on error
      throw error;
    }
  };

  const updateServingSize = async (recipeId: number, servingSize: number) => {
    try {
      await apiService.updateRecipeServingSize(recipeId, servingSize);
    } catch (error) {
      console.error('Failed to update serving size:', error);
      throw error;
    }
  };

  const updateItemQuantity = async (itemId: number, quantity: number) => {
    try {
      await apiService.updateItemQuantity(itemId, quantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      refreshCart,
      removeRecipe,
      removeItem,
      updateServingSize,
      updateItemQuantity
    }}>
      {children}
    </CartContext.Provider>
  );
};