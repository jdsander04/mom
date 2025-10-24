import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  CircularProgress,
  Alert,
  Avatar
} from '@mui/material';
import { 
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import { useCart } from '../../hooks/useCart';
import { apiService } from '../../services/api';
import type { Recipe } from '../../types/recipe';
import styles from './Shopping.module.css';

const Shopping = () => {
  const { cartRecipes, loading, error, updateRecipeQuantity, removeRecipeFromCart, clearCart } = useCart();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  useEffect(() => {
    const fetchRecipes = async () => {
      if (cartRecipes.length === 0) return;
      
      setRecipesLoading(true);
      try {
        const recipePromises = cartRecipes.map(cartRecipe => 
          apiService.getRecipe(cartRecipe.recipe_id)
        );
        const fetchedRecipes = await Promise.all(recipePromises);
        setRecipes(fetchedRecipes);
      } catch (err) {
        console.error('Failed to fetch recipes:', err);
      } finally {
        setRecipesLoading(false);
      }
    };

    fetchRecipes();
  }, [cartRecipes]);

  const handleQuantityChange = async (recipeId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeRecipeFromCart(recipeId);
    } else {
      await updateRecipeQuantity(recipeId, newQuantity);
    }
  };

  const calculateTotalCalories = (recipe: Recipe, quantity: number) => {
    const totalCalories = recipe.nutrients.reduce((sum, nutrient) => {
      if (nutrient.macro.toLowerCase().includes('calorie')) {
        return sum + nutrient.mass;
      }
      return sum;
    }, 0);
    return Math.round(totalCalories * quantity);
  };

  const getServings = (recipe: Recipe) => {
    // Try to extract servings from description or use a default
    const match = recipe.description.match(/(\d+)\s*(serves?|servings?)/i);
    return match ? parseInt(match[1]) : 4; // Default to 4 servings
  };

  if (loading || recipesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Box className={styles.header}>
        <Typography variant="h4" component="h1" className={styles.pageTitle}>
          Added Recipes
        </Typography>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <ShoppingCartIcon />
        </Avatar>
      </Box>

      {/* Recipe Cards */}
      <Box className={styles.recipesContainer}>
        {recipes.length === 0 ? (
          <Box className={styles.emptyState}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes added to cart
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add recipes from the Recipe Library to see them here
            </Typography>
          </Box>
        ) : (
          recipes.map((recipe) => {
            const cartRecipe = cartRecipes.find(cr => cr.recipe_id === recipe.id);
            const quantity = cartRecipe?.quantity || 1;
            const totalCalories = calculateTotalCalories(recipe, quantity);
            const servings = getServings(recipe);

            return (
              <div key={recipe.id} className={styles.recipeCard}>
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.headerContent}>
                    {/* Quantity Controls */}
                    <div className={styles.quantitySelector}>
                      <button 
                        className={styles.quantityButton}
                        onClick={() => handleQuantityChange(recipe.id, quantity - 1)}
                        disabled={quantity <= 1}
                      >
                        -
                      </button>
                      <span className={styles.quantity}>{quantity}</span>
                      <button 
                        className={styles.quantityButton}
                        onClick={() => handleQuantityChange(recipe.id, quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    {/* Recipe Name */}
                    <span className={styles.title}>{recipe.name}</span>

                    {/* Calories */}
                    <span className={styles.calories}>{totalCalories} kcal</span>

                    {/* Servings */}
                    <span className={styles.serves}>Serves {servings}</span>

                    {/* Action Buttons */}
                    <button className={styles.actionButton}>
                      <OpenInNewIcon />
                    </button>
                    <button 
                      className={styles.removeButton}
                      onClick={() => removeRecipeFromCart(recipe.id)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className={styles.cardContent}>
                  <ul className={styles.ingredientsList}>
                    {recipe.ingredients.map((ingredient, index) => (
                      <li key={index} className={styles.ingredientItem}>
                        {ingredient.quantity} {ingredient.unit} {ingredient.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })
        )}
      </Box>

      {/* Send to Cart Button */}
      {recipes.length > 0 && (
        <Box className={styles.sendToCartContainer}>
          <Button
            variant="contained"
            size="large"
            className={styles.sendToCartButton}
            onClick={clearCart}
            startIcon={<ShoppingCartIcon />}
          >
            Send to Cart
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Shopping;
