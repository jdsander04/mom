import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useCartContext } from '../../contexts/CartContext';
import { apiService } from '../../services/api';
import type { CartRecipe, CartItem } from '../../types/cart';
import UndoPopup from '../UndoPopup';
import {
  ShoppingCartIcon,
  ClipboardIcon,
  UtensilsIcon,
  CarrotIcon,
  TrashIcon,
  PackageIcon,
  HourglassIcon,
} from '../Icons';
import styles from './OrderSummary.module.css';

interface OrderSummaryProps {
  open: boolean;
  onClose: () => void;
  onConfirmOrder: () => void;
  selectedProvider: string;
  undoAction?: any;
  undoRemoval: () => void;
  clearUndo: () => void;
}

interface CombinedIngredient {
  name: string;
  quantity: number;
  unit: string;
  items: CartItem[];
}

export default function OrderSummary({ open, onClose, onConfirmOrder, selectedProvider, undoAction, undoRemoval, clearUndo }: OrderSummaryProps) {
  const { cart, loading, refreshCart, removeItem } = useCartContext();
  const [instacartLoading, setInstacartLoading] = useState(false);
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (open && !hasRefreshedRef.current) {
      refreshCart();
      hasRefreshedRef.current = true;
    } else if (!open) {
      hasRefreshedRef.current = false;
    }
  }, [open, refreshCart]);

  const combineIngredients = (): CombinedIngredient[] => {
    const combined: { [key: string]: CombinedIngredient } = {};
    
    cart.recipes.forEach((recipe: CartRecipe) => {
      recipe.ingredients.forEach((item: CartItem) => {
        const key = `${item.name}-${item.unit}`;
        if (combined[key]) {
          combined[key].quantity += item.quantity;
          combined[key].items.push(item);
        } else {
          combined[key] = {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            items: [item]
          };
        }
      });
    });

    return Object.values(combined);
  };

  const removeIngredient = async (ingredient: CombinedIngredient) => {
    try {
      await Promise.all(ingredient.items.map(item => removeItem(item.id)));
      await refreshCart();
    } catch (error) {
      console.log('Some items may have already been removed');
    }
  };

  const handleConfirmOrder = async () => {
    if (selectedProvider === 'instacart') {
      setInstacartLoading(true);
      try {
        const response = await apiService.post('/cart/instacart/');
        if (response.data.success && response.data.redirect_url) {
          window.open(response.data.redirect_url, '_blank');
        }
      } catch (error) {
        console.error('Failed to create Instacart shopping list:', error);
      } finally {
        setInstacartLoading(false);
      }
    }
    onConfirmOrder();
  };

  const combinedIngredients = combineIngredients();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth className={styles.dialog}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>
            <ShoppingCartIcon size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
            Order Summary
          </h2>
          <p className={styles.subtitle}>Review your final shopping list</p>
        </div>
        <IconButton onClick={onClose} className={styles.closeButton}>
          <CloseIcon />
        </IconButton>
      </div>
      
      <DialogContent className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <div className={styles.recipesSection}>
              <h3 className={styles.sectionTitle}>
                <ClipboardIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Recipes ({cart.recipes.length})
              </h3>
              <div className={styles.recipesList}>
                {cart.recipes.map((recipe: CartRecipe) => (
                  <div key={recipe.recipe_id} className={styles.recipeItem}>
                    <div className={styles.recipeIcon}>
                      <UtensilsIcon size={24} />
                    </div>
                    <div className={styles.recipeInfo}>
                      <span className={styles.recipeName}>{recipe.name}</span>
                      <span className={styles.servingSize}>{recipe.serving_size} servings • {recipe.ingredients.length} ingredients</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.ingredientsSection}>
              <h3 className={styles.sectionTitle}>
                <CarrotIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Shopping List ({combinedIngredients.length} items)
              </h3>
              <div className={styles.ingredientsList}>
                {combinedIngredients.map((ingredient) => (
                  <div key={`${ingredient.name}-${ingredient.unit}`} className={styles.ingredientItem}>
                    <div className={styles.ingredientInfo}>
                      <span className={styles.ingredientName}>{ingredient.name}</span>
                      <span className={styles.ingredientQuantity}>
                        {ingredient.quantity.toFixed(1)} {ingredient.unit}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeIngredient(ingredient)}
                      className={styles.removeButton}
                      title="Remove ingredient"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>

      <div className={styles.actions}>
        <Button onClick={onClose} className={styles.cancelButton}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleConfirmOrder}
          disabled={loading || instacartLoading || cart.recipes.length === 0}
          className={styles.orderButton}
        >
          {instacartLoading ? (
            <>
              <HourglassIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              Creating List...
            </>
          ) : (
            <>
              <PackageIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
              Order with {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
            </>
          )}
        </Button>
      </div>
      
      {undoAction && (
        <UndoPopup
          type={undoAction.type}
          data={undoAction.data}
          onUndo={undoRemoval}
          onDismiss={clearUndo}
        />
      )}
    </Dialog>
  );
}
