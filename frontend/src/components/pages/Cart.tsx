import { useState, useEffect, useRef } from 'react';
import { useCartContext } from '../../contexts/CartContext';
import type { CartRecipe, CartItem } from '../../types/cart';
import OrderSummary from './OrderSummary';
import UndoPopup from '../UndoPopup';
import styles from './Cart.module.css';

export default function Cart() {
  const { cart, loading, undoAction, updateServingSize, removeRecipe, updateItemQuantity, removeItem, removeBulkItems, refreshCart, undoRemoval, clearUndo } = useCartContext();
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('instacart');
  const [collapsedRecipes, setCollapsedRecipes] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const refreshCartRef = useRef(refreshCart);
  refreshCartRef.current = refreshCart;

  useEffect(() => {
    refreshCartRef.current();
  }, []);



  const handleRemoveItem = async (itemId: number) => {
    setLoadingItems(prev => new Set(prev).add(itemId));
    try {
      await removeItem(itemId);
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    await removeRecipe(recipeId);
  };

  const handleUpdateServingSize = async (recipeId: number, servingSize: number) => {
    await updateServingSize(recipeId, servingSize);
    await refreshCart();
  };

  const handleUpdateItemQuantity = async (itemId: number, quantity: number) => {
    setLoadingItems(prev => new Set(prev).add(itemId));
    try {
      await updateItemQuantity(itemId, quantity);
      await refreshCart();
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const toggleRecipeCollapse = (recipeId: number) => {
    setCollapsedRecipes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleBulkRemove = async () => {
    const itemIds = Array.from(selectedItems);
    await removeBulkItems(itemIds);
    setSelectedItems(new Set());
  };

  const filteredIngredients = (ingredients: CartItem[]) => {
    if (!searchTerm) return ingredients;
    return ingredients.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleConfirmOrder = () => {
    setOrderSummaryOpen(false);
  };

  if (loading) return <div className={styles.loading}>Loading cart...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🛒 My Shopping Cart</h1>
        <p className={styles.subtitle}>Review your recipes and ingredients before ordering</p>
      </div>
      
      {!cart || !cart.recipes || cart.recipes.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🛒</div>
          <h2>Your cart is empty</h2>
          <p>Add recipes from the Recipe Library to get started!</p>
          <button className={styles.emptyButton} onClick={() => window.location.href = '/recipes'}>
            Browse Recipes
          </button>
        </div>
      ) : (
        <>
          <div className={styles.stickyHeader}>
            <div className={styles.cartSummary}>
              <div className={styles.cartStats}>
                <span className={styles.cartCount}>📋 {cart.recipes.length} recipes</span>
                <span className={styles.itemCount}>🥕 {cart.recipes.reduce((total, recipe) => total + recipe.ingredients.length, 0)} ingredients</span>
              </div>
              {selectedItems.size > 0 && (
                <div className={styles.bulkActions}>
                  <span className={styles.selectedCount}>{selectedItems.size} selected</span>
                  <button onClick={handleBulkRemove} className={styles.bulkRemoveBtn}>
                    🗑️ Remove Selected
                  </button>
                </div>
              )}
            </div>
            <div className={styles.orderButtonContainer}>
              <select 
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className={styles.providerSelect}
              >
                <option value="instacart">📦 Instacart</option>
              </select>
              <button 
                onClick={() => setOrderSummaryOpen(true)}
                className={styles.orderButton}
              >
                🛒 Order Now
              </button>
            </div>
          </div>
          
          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.searchIcon}>🔍</span>
            </div>
          </div>
          <div className={styles.recipesSection}>
            {cart.recipes.map((recipe: CartRecipe) => {
              const isCollapsed = collapsedRecipes.has(recipe.recipe_id);
              const filteredItems = filteredIngredients(recipe.ingredients);
              return (
                <div key={recipe.recipe_id} className={styles.recipeCard}>
                  <div className={styles.recipeHeader}>
                    <div className={styles.recipeInfo}>
                      <div className={styles.recipeImage}>🍽️</div>
                      <div className={styles.recipeTitleSection}>
                        <h3 className={styles.recipeTitle}>{recipe.name}</h3>
                        <div className={styles.recipeSummary}>
                          📋 {recipe.ingredients.length} ingredients • 🍽️ {recipe.serving_size} servings
                        </div>
                      </div>
                    </div>
                    <div className={styles.recipeControls}>
                      <div className={styles.servingControls}>
                        <label>Servings:</label>
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
                        onClick={() => toggleRecipeCollapse(recipe.recipe_id)}
                        className={styles.collapseBtn}
                        title={isCollapsed ? 'Show ingredients' : 'Hide ingredients'}
                      >
                        {isCollapsed ? '▼' : '▲'}
                      </button>
                      <button 
                        onClick={() => handleRemoveRecipe(recipe.recipe_id)}
                        className={styles.removeRecipeBtn}
                        title="Remove recipe"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div className={styles.ingredientsSection}>
                      <div className={styles.ingredientsList}>
                        {filteredItems.map((item: CartItem) => (
                          <div key={item.id} className={`${styles.ingredientItem} ${loadingItems.has(item.id) ? styles.loading : ''}`}>
                            <div className={styles.ingredientHeader}>
                              <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                className={styles.itemCheckbox}
                              />
                              <span className={styles.itemName}>{item.name}</span>
                              <button 
                                onClick={() => handleRemoveItem(item.id)}
                                className={styles.removeBtn}
                                disabled={loadingItems.has(item.id)}
                                title="Remove item"
                              >
                                {loadingItems.has(item.id) ? '⏳' : '🗑️'}
                              </button>
                            </div>
                            <div className={styles.quantityControls}>
                              <button 
                                onClick={() => handleUpdateItemQuantity(item.id, Math.max(0, item.quantity - 0.1))}
                                className={styles.quantityBtn}
                                disabled={loadingItems.has(item.id)}
                                title="Decrease quantity"
                              >
                                −
                              </button>
                              <span className={styles.quantityDisplay}>
                                {item.quantity} {item.unit}
                              </span>
                              <button 
                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 0.1)}
                                className={styles.quantityBtn}
                                disabled={loadingItems.has(item.id)}
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            <div className={styles.quickActions}>
                              <button 
                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity * 0.5)}
                                className={styles.quickBtn}
                                title="Half quantity"
                              >
                                ½×
                              </button>
                              <button 
                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity * 2)}
                                className={styles.quickBtn}
                                title="Double quantity"
                              >
                                2×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      
      <OrderSummary 
        open={orderSummaryOpen}
        onClose={() => setOrderSummaryOpen(false)}
        onConfirmOrder={handleConfirmOrder}
        selectedProvider={selectedProvider}
        undoAction={undoAction}
        undoRemoval={undoRemoval}
        clearUndo={clearUndo}
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
