import { useState, useEffect, useRef } from 'react';
import { useCartContext } from '../../contexts/CartContext';
import type { CartRecipe, CartItem } from '../../types/cart';
import OrderSummary from './OrderSummary';
import UndoPopup from '../UndoPopup';
import styles from './Cart.module.css';

export default function Cart() {
  const { cart, loading, undoAction, updateServingSize, removeRecipe, updateItemQuantity, removeItem, refreshCart, undoRemoval, clearUndo } = useCartContext();
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('instacart');
  const refreshCartRef = useRef(refreshCart);
  refreshCartRef.current = refreshCart;

  useEffect(() => {
    refreshCartRef.current();
  }, []);



  const handleRemoveItem = async (itemId: number) => {
    await removeItem(itemId);
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    await removeRecipe(recipeId);
  };

  const handleUpdateServingSize = async (recipeId: number, servingSize: number) => {
    await updateServingSize(recipeId, servingSize);
    await refreshCart();
  };

  const handleUpdateItemQuantity = async (itemId: number, quantity: number) => {
    await updateItemQuantity(itemId, quantity);
    await refreshCart();
  };

  const handleConfirmOrder = () => {
    setOrderSummaryOpen(false);
  };

  if (loading) return <div className={styles.loading}>Loading cart...</div>;

  return (
    <div className={styles.container}>
      <h1>My Cart</h1>
      
      {!cart || !cart.recipes || cart.recipes.length === 0 ? (
        <div className={styles.empty}>Your cart is empty. Add recipes from the Recipe Library to get started!</div>
      ) : (
        <>
          <div className={styles.orderButtonContainer}>
            <select 
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className={styles.providerSelect}
            >
              <option value="instacart">Instacart</option>
            </select>
            <button 
              onClick={() => setOrderSummaryOpen(true)}
              className={styles.orderButton}
            >
              Order
            </button>
          </div>
          <div className={styles.recipesSection}>
          {cart.recipes.map((recipe: CartRecipe) => (
            <div key={recipe.recipe_id} className={styles.recipeCard}>
              <div className={styles.recipeHeader}>
                <h3 className={styles.recipeTitle}>{recipe.name}</h3>
                <div className={styles.servingControls}>
                  <label>Serving Size:</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={recipe.serving_size}
                    onChange={(e) => handleUpdateServingSize(recipe.recipe_id, parseFloat(e.target.value))}
                    className={styles.servingInput}
                  />
                </div>
                <button 
                  onClick={() => handleRemoveRecipe(recipe.recipe_id)}
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
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemQuantity(item.id, parseFloat(e.target.value))}
                      className={styles.quantityInput}
                    />
                    <span className={styles.itemUnit}>{item.unit}</span>
                    <button 
                      onClick={() => handleRemoveItem(item.id)}
                      className={styles.removeBtn}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </>
      )}
      
      <OrderSummary 
        open={orderSummaryOpen}
        onClose={() => setOrderSummaryOpen(false)}
        onConfirmOrder={handleConfirmOrder}
        selectedProvider={selectedProvider}
      />
      
      {undoAction && (
        <UndoPopup
          type={undoAction.type}
          data={undoAction.data}
          onUndo={undoRemoval}
          onDismiss={clearUndo}
        />
      )}
    </div>
  );
}
