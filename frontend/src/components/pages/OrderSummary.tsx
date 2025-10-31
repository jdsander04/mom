import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCartContext } from '../../contexts/CartContext';
import { apiService } from '../../services/api';
import type { CartRecipe, CartItem } from '../../types/cart';
import styles from './OrderSummary.module.css';

interface OrderSummaryProps {
  open: boolean;
  onClose: () => void;
  onConfirmOrder: () => void;
}

interface CombinedIngredient {
  name: string;
  quantity: number;
  unit: string;
  items: CartItem[];
}

export default function OrderSummary({ open, onClose, onConfirmOrder }: OrderSummaryProps) {
  const { cart, loading, refreshCart, removeItem } = useCartContext();
  const [instacartLoading, setInstacartLoading] = useState(false);

  useEffect(() => {
    if (open) {
      refreshCart();
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

  const sendToInstacart = async () => {
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
  };

  const combinedIngredients = combineIngredients();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Order Summary
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <div className={styles.recipesSection}>
              <h3>Recipes</h3>
              {cart.recipes.map((recipe: CartRecipe) => (
                <div key={recipe.recipe_id} className={styles.recipeItem}>
                  <span className={styles.recipeName}>{recipe.name}</span>
                  <span className={styles.servingSize}>Serving size: {recipe.serving_size}</span>
                </div>
              ))}
            </div>

            <div className={styles.ingredientsSection}>
              <h3>Combined Ingredients</h3>
              {combinedIngredients.map((ingredient) => (
                <div key={`${ingredient.name}-${ingredient.unit}`} className={styles.ingredientItem}>
                  <div className={styles.ingredientInfo}>
                    <span className={styles.ingredientName}>{ingredient.name}</span>
                    <span className={styles.ingredientQuantity}>
                      {ingredient.quantity.toFixed(1)} {ingredient.unit}
                    </span>
                  </div>
                  <IconButton 
                    size="small" 
                    onClick={() => removeIngredient(ingredient)}
                    className={styles.removeButton}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="outlined"
          onClick={sendToInstacart}
          disabled={loading || instacartLoading || cart.recipes.length === 0}
        >
          {instacartLoading ? 'Creating List...' : 'Send to Instacart'}
        </Button>
        <Button 
          variant="contained" 
          onClick={onConfirmOrder}
          disabled={loading || cart.recipes.length === 0}
          sx={{ backgroundColor: '#4caf50', '&:hover': { backgroundColor: '#45a049' } }}
        >
          Confirm Order
        </Button>
      </DialogActions>
    </Dialog>
  );
}