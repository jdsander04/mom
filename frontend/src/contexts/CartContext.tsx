import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import type { Cart, CartRecipe, CartItem } from '../types/cart';

interface UndoAction {
  type: 'recipe' | 'item';
  data: CartRecipe | CartItem;
  recipeId?: number;
}

interface CartContextType {
  cart: Cart;
  loading: boolean;
  undoAction: UndoAction | null;
  refreshCart: () => Promise<void>;
  removeRecipe: (recipeId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  updateServingSize: (recipeId: number, servingSize: number) => Promise<void>;
  updateItemQuantity: (itemId: number, quantity: number) => Promise<void>;
  undoRemoval: () => Promise<void>;
  clearUndo: () => void;
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
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

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
    const removedRecipe = cart.recipes.find(recipe => recipe.recipe_id === recipeId);
    if (!removedRecipe) return;
    
    setUndoAction({ type: 'recipe', data: removedRecipe });
    
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
    let removedItem: CartItem | undefined;
    let recipeId: number | undefined;
    
    for (const recipe of cart.recipes) {
      const item = recipe.ingredients.find(item => item.id === itemId);
      if (item) {
        removedItem = item;
        recipeId = recipe.recipe_id;
        break;
      }
    }
    
    if (!removedItem || !recipeId) return;
    
    setUndoAction({ type: 'item', data: removedItem, recipeId });
    
    // Optimistic update
    setCart(prev => ({
      recipes: prev.recipes.map(recipe => ({
        ...recipe,
        ingredients: recipe.ingredients.filter(item => item.id !== itemId)
      }))
    }));
    
    try {
      await apiService.removeItemFromCart(itemId);
      // Don't refresh cart here - let undo handle it
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

  const undoRemoval = async () => {
    if (!undoAction) return;
    
    try {
      if (undoAction.type === 'recipe') {
        const recipe = undoAction.data as CartRecipe;
        // Restore locally first
        setCart(prev => ({
          recipes: [...prev.recipes, recipe]
        }));
        
        // Then sync with backend by adding recipe and individual ingredients
        await apiService.addRecipeToCart(recipe.recipe_id, recipe.serving_size);
        
        // Get the newly added recipe to find default ingredient IDs
        const updatedCart = await apiService.getCart();
        const addedRecipe = updatedCart.recipes.find(r => r.recipe_id === recipe.recipe_id);
        
        if (addedRecipe) {
          // Remove all default ingredients
          for (const item of addedRecipe.ingredients) {
            await apiService.removeItemFromCart(item.id);
          }
          
          // Add back only the original ingredients with their quantities
          for (const originalItem of recipe.ingredients) {
            if (originalItem.recipe_ingredient_id) {
              await apiService.addItemToCart(recipe.recipe_id, originalItem.recipe_ingredient_id, originalItem.quantity);
            }
          }
        }
      } else {
        // Restore item via API
        const item = undoAction.data as CartItem;
        if (item.recipe_ingredient_id && undoAction.recipeId) {
          await apiService.addItemToCart(undoAction.recipeId, item.recipe_ingredient_id, item.quantity);
        }
      }
      setUndoAction(null);
      await refreshCart();
    } catch (error) {
      console.error('Failed to undo removal:', error);
      await refreshCart(); // Revert local changes on error
    }
  };
  
  const clearUndo = () => {
    setUndoAction(null);
    // Refresh cart when undo is cleared to sync with backend
    refreshCart();
  };

  useEffect(() => {
    refreshCart();
  }, []);

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      undoAction,
      refreshCart,
      removeRecipe,
      removeItem,
      updateServingSize,
      updateItemQuantity,
      undoRemoval,
      clearUndo
    }}>
      {children}
    </CartContext.Provider>
  );
};