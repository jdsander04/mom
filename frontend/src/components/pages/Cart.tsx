import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Cart, CartRecipe, CartItem } from '../../types/cart';
import styles from './Cart.module.css';

export default function Cart() {
  const [cart, setCart] = useState<Cart>({ recipes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
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

  const updateServingSize = async (recipeId: number, servingSize: number) => {
    try {
      await apiService.updateRecipeServingSize(recipeId, servingSize);
      await loadCart();
    } catch (error) {
      console.error('Failed to update serving size:', error);
    }
  };

  const removeRecipe = async (recipeId: number) => {
    try {
      await apiService.removeRecipeFromCart(recipeId);
      await loadCart();
    } catch (error) {
      console.error('Failed to remove recipe:', error);
    }
  };

  const updateItemQuantity = async (itemId: number, quantity: number) => {
    try {
      await apiService.updateItemQuantity(itemId, quantity);
      await loadCart();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await apiService.removeItemFromCart(itemId);
      await loadCart();
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  if (loading) return <div className={styles.loading}>Loading cart...</div>;

  return (
    <div className={styles.container}>
      <h1>My Cart</h1>
      
      {!cart || !cart.recipes || cart.recipes.length === 0 ? (
        <div className={styles.empty}>Your cart is empty. Add recipes from the Recipe Library to get started!</div>
      ) : (
        <div className={styles.recipesSection}>
          {cart.recipes.map((recipe: CartRecipe) => (
            <div key={recipe.recipe_id} className={styles.recipeCard}>
              <div className={styles.recipeHeader}>
                <h3>{recipe.name}</h3>
                <div className={styles.servingControls}>
                  <label>Serving Size:</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={recipe.serving_size}
                    onChange={(e) => updateServingSize(recipe.recipe_id, parseFloat(e.target.value))}
                  />
                </div>
                <button 
                  onClick={() => removeRecipe(recipe.recipe_id)}
                  className={styles.removeRecipeBtn}
                >
                  Remove Recipe
                </button>
              </div>
              
              <div className={styles.ingredientsSection}>
                <h4>Ingredients:</h4>
                {recipe.ingredients.map((item: CartItem) => (
                  <div key={item.id} className={styles.ingredientItem}>
                    <span className={styles.itemName}>{item.name}</span>
                    <div className={styles.itemControls}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value))}
                      />
                      <span>{item.unit}</span>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className={styles.removeBtn}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}