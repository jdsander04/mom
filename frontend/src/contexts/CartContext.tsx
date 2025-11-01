import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiService } from '../services/api';
import type { Cart, CartRecipe, CartItem } from '../types/cart';

interface BulkItem extends CartItem {
  originalRecipeId: number;
}

interface UndoAction {
  type: 'recipe' | 'item' | 'bulk';
  data: CartRecipe | CartItem | BulkItem[];
  recipeId?: number;
}

interface CartContextType {
  cart: Cart;
  loading: boolean;
  undoAction: UndoAction | null;
  refreshCart: () => Promise<void>;
  removeRecipe: (recipeId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  removeBulkItems: (itemIds: number[]) => Promise<void>;
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

  const refreshCart = useCallback(async () => {
    try {
      const cartData = await apiService.getCart();
      setCart(cartData || { recipes: [] });
    } catch (error) {
      console.error('Failed to load cart:', error);
      setCart({ recipes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

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
    
    console.log('Undoing removal:', undoAction);
    
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
      } else if (undoAction.type === 'bulk') {
        // Restore multiple items via API
        const items = undoAction.data as BulkItem[];
        console.log('Restoring bulk items:', items);
        for (const item of items) {
          if (item.recipe_ingredient_id && item.originalRecipeId) {
            console.log('Restoring item:', item.name, 'to recipe:', item.originalRecipeId);
            await apiService.addItemToCart(item.originalRecipeId, item.recipe_ingredient_id, item.quantity);
          }
        }
      } else {
        // Restore single item via API
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

  const removeBulkItems = async (itemIds: number[]) => {
    const removedItems: BulkItem[] = [];
    
    // Collect all items to be removed with their recipe IDs
    for (const recipe of cart.recipes) {
      for (const item of recipe.ingredients) {
        if (itemIds.includes(item.id)) {
          console.log('Adding item to bulk removal:', item);
          removedItems.push({ ...item, originalRecipeId: recipe.recipe_id });
        }
      }
    }
    
    if (removedItems.length === 0) return;
    
    console.log('Setting bulk undo action with items:', removedItems);
    setUndoAction({ type: 'bulk', data: removedItems });
    
    // Optimistic update
    setCart(prev => ({
      recipes: prev.recipes.map(recipe => ({
        ...recipe,
        ingredients: recipe.ingredients.filter(item => !itemIds.includes(item.id))
      }))
    }));
    
    try {
      // Remove items from backend
      for (const itemId of itemIds) {
        await apiService.removeItemFromCart(itemId);
      }
    } catch (error) {
      console.error('Failed to remove items:', error);
      await refreshCart(); // Revert on error
      throw error;
    }
  };

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      undoAction,
      refreshCart,
      removeRecipe,
      removeItem,
      removeBulkItems,
      updateServingSize,
      updateItemQuantity,
      undoRemoval,
      clearUndo
    }}>
      {children}
    </CartContext.Provider>
  );
};
