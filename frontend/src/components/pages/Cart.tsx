import { useState, useEffect, useRef } from 'react';
import { useCartContext } from '../../contexts/CartContext';
import type { CartRecipe, CartItem } from '../../types/cart';
import { getShortErrorMessage, type APIError } from '../../utils/errorHandler';
import OrderSummary from './OrderSummary';
import InstacartPricePopup from './InstacartPricePopup';
import UndoPopup from '../UndoPopup';
import styles from './Cart.module.css';
import {
  ShoppingCartIcon,
  ClipboardIcon,
  CarrotIcon,
  TrashIcon,
  PackageIcon,
  SearchIcon,
  UtensilsIcon,
  HourglassIcon,
  ChartIcon,
  ZapIcon,
  PlusIcon,
  EyeIcon,
} from '../Icons';

export default function Cart() {
  const { cart, loading, undoAction, updateServingSize, removeRecipe, updateItemQuantity, removeItem, removeBulkItems, refreshCart, undoRemoval, clearUndo } = useCartContext();
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [selectedProvider] = useState('instacart');
  const [collapsedRecipes, setCollapsedRecipes] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const refreshCartRef = useRef(refreshCart);
  refreshCartRef.current = refreshCart;

  useEffect(() => {
    refreshCartRef.current();
  }, []);



  const handleRemoveItem = async (itemId: number) => {
    setLoadingItems(prev => new Set(prev).add(itemId));
    setErrorMessage('');
    try {
      await removeItem(itemId);
    } catch (error) {
      const errorMsg = getShortErrorMessage(error as APIError);
      setErrorMessage(errorMsg);
      console.error('Failed to remove item:', error);
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    setErrorMessage('');
    try {
      await removeRecipe(recipeId);
    } catch (error) {
      const errorMsg = getShortErrorMessage(error as APIError);
      setErrorMessage(errorMsg);
      console.error('Failed to remove recipe:', error);
    }
  };

  const handleUpdateMultiples = async (recipeId: number, multiples: number) => {
    setErrorMessage('');
    try {
      // Convert multiples (whole numbers) to serving_size for backend
      await updateServingSize(recipeId, multiples);
      await refreshCart();
    } catch (error) {
      const errorMsg = getShortErrorMessage(error as APIError);
      setErrorMessage(errorMsg);
      console.error('Failed to update serving size:', error);
    }
  };

  const handleUpdateItemQuantity = async (itemId: number, quantity: number) => {
    setLoadingItems(prev => new Set(prev).add(itemId));
    setErrorMessage('');
    try {
      await updateItemQuantity(itemId, quantity);
      await refreshCart();
    } catch (error) {
      const errorMsg = getShortErrorMessage(error as APIError);
      setErrorMessage(errorMsg);
      console.error('Failed to update item quantity:', error);
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
    setErrorMessage('');
    try {
      const itemIds = Array.from(selectedItems);
      await removeBulkItems(itemIds);
      setSelectedItems(new Set());
    } catch (error) {
      const errorMsg = getShortErrorMessage(error as APIError);
      setErrorMessage(errorMsg);
      console.error('Failed to remove items:', error);
    }
  };

  const filteredIngredients = (ingredients: CartItem[]) => {
    // Sort ingredients alphabetically by name
    const sorted = [...ingredients].sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    // Filter by search term if provided
    if (!searchTerm) return sorted;
    return sorted.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  

  // Open the Instacart price popup after an order is confirmed
  const [instacartPriceOpen, setInstacartPriceOpen] = useState(false);

  const handleOrderConfirmed = () => {
    // close the order summary and open the price popup
    setOrderSummaryOpen(false);
    setInstacartPriceOpen(true);
  };

  const handlePriceSaved = async (amount: number) => {
    // Optionally refresh cart or other user info after saving
    try {
      await refreshCartRef.current();
    } catch (e) {
      // ignore refresh errors here
    }
  };

  if (loading) return <div className={styles.loading}>Loading cart...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <ShoppingCartIcon size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
          Shopping Cart
        </h1>
        <p className={styles.subtitle}>Review your recipes and ingredients before ordering</p>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>
      
      {!cart || !cart.recipes || cart.recipes.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <ShoppingCartIcon size={48} />
          </div>
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
                <span className={styles.cartCount}>
                  <ClipboardIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  {cart.recipes.length} recipes
                </span>
                <span className={styles.itemCount}>
                  <CarrotIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  {cart.recipes.reduce((total, recipe) => total + recipe.ingredients.length, 0)} ingredients
                </span>
              </div>
              {selectedItems.size > 0 && (
                <div className={styles.bulkActions}>
                  <span className={styles.selectedCount}>{selectedItems.size} selected</span>
                  <button onClick={handleBulkRemove} className={styles.bulkRemoveBtn}>
                    <TrashIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    Remove Selected
                  </button>
                </div>
              )}
            </div>
            <div className={styles.orderButtonContainer}>
              <div className={styles.providerSelect}>
                <PackageIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Instacart
              </div>
              <button 
                onClick={() => setOrderSummaryOpen(true)}
                className={styles.orderButton}
              >
                <ShoppingCartIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Order Now
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
              <span className={styles.searchIcon}>
                <SearchIcon size={20} />
              </span>
            </div>
          </div>
          
          <div className={styles.mainContent}>
            <div className={styles.recipesSection}>
            {cart.recipes.map((recipe: CartRecipe) => {
              const isCollapsed = collapsedRecipes.has(recipe.recipe_id);
              const filteredItems = filteredIngredients(recipe.ingredients);
              return (
                <div key={recipe.recipe_id} className={styles.recipeCard}>
                  <div className={styles.recipeHeader}>
                    <div className={styles.recipeInfo}>
                      <div className={styles.recipeImage}>
                        <UtensilsIcon size={32} />
                      </div>
                      <div className={styles.recipeTitleSection}>
                        <h3 className={styles.recipeTitle}>{recipe.name}</h3>
                        <div className={styles.recipeSummary}>
                          <ClipboardIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                          {recipe.ingredients.length} ingredients • 
                          <UtensilsIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '4px', marginRight: '4px' }} />
                          {Math.round(recipe.serving_size)}x recipe
                        </div>
                      </div>
                    </div>
                    <div className={styles.recipeControls}>
                      <div className={styles.servingControls}>
                        <label>Multiples:</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={Math.round(recipe.serving_size)}
                          onChange={(e) => handleUpdateMultiples(recipe.recipe_id, parseInt(e.target.value) || 1)}
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
                        <TrashIcon size={18} />
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
                                {loadingItems.has(item.id) ? (
                                  <HourglassIcon size={18} />
                                ) : (
                                  <TrashIcon size={18} />
                                )}
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
            
            <div className={styles.sidebar}>
              <div className={styles.cartSummaryCard}>
                <h3 className={styles.cardTitle}>
                  <ChartIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Cart Summary
                </h3>
                <div className={styles.summaryStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total Recipes</span>
                    <span className={styles.statValue}>{cart.recipes.length}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total Ingredients</span>
                    <span className={styles.statValue}>{cart.recipes.reduce((total, recipe) => total + recipe.ingredients.length, 0)}</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.quickActionsCard}>
                <h3 className={styles.cardTitle}>
                  <ZapIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Quick Actions
                </h3>
                <div className={styles.actionButtons}>
                  <button className={styles.actionBtn} onClick={() => window.location.href = '/recipes'}>
                    <PlusIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    Add More Recipes
                  </button>
                  <button className={styles.actionBtn} onClick={() => setOrderSummaryOpen(true)}>
                    <EyeIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    Preview Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      <OrderSummary 
        open={orderSummaryOpen}
        onClose={() => setOrderSummaryOpen(false)}
        onConfirmOrder={handleOrderConfirmed}
        selectedProvider={selectedProvider}
        undoAction={undoAction}
        undoRemoval={undoRemoval}
        clearUndo={clearUndo}
      />

      <InstacartPricePopup
        open={instacartPriceOpen}
        onClose={() => setInstacartPriceOpen(false)}
        onSaved={handlePriceSaved}
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
