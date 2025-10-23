import { useState, useEffect } from 'react';
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import styles from './RecipeLibrary.module.css';
import VerticalContainer from '../common/VerticalContainer/VerticalContainer';
import RecipeAccordion from '../common/RecipeAccordion/RecipeAccordion';
import RecipeDetails from '../common/RecipeAccordion/RecipeDetails';
import { useAuth } from '../../contexts/AuthContext';

interface Recipe {
  id: number;
  name: string;
  description: string;
  image_url: string;
  source_url?: string;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  steps: Array<{ description: string; order: number }>;
  nutrients: Array<{ macro: string; mass: number }>;
}

const RecipeLibrary = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRecipeUrl, setNewRecipeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cartId, setCartId] = useState<number | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    fetchRecipes();
    getOrCreateCart();
  }, []);



  const getOrCreateCart = async () => {
    try {
      const response = await fetch('/api/carts/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.carts.length > 0) {
          setCartId(data.carts[0].id);
        } else {
          const createResponse = await fetch('/api/carts/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (createResponse.ok) {
            const createData = await createResponse.json();
            setCartId(createData.cart_id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get/create cart:', error);
    }
  };



  const fetchRecipes = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/recipes/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const detailedRecipes = await Promise.all(
          data.recipes.map(async (recipe: { id: number }) => {
            const detailResponse = await fetch(`/api/recipes/${recipe.id}/`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return detailResponse.ok ? await detailResponse.json() : null;
          })
        );
        setRecipes(detailedRecipes.filter(Boolean));
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRecipeFromUrl = async () => {
    if (!newRecipeUrl.trim() || !token || submitting) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/recipes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipe_source: 'url',
          url: newRecipeUrl
        })
      });
      
      if (response.ok) {
        const newRecipe = await response.json();
        setRecipes(prev => [...prev, newRecipe]);
        setNewRecipeUrl('');
        setDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to add recipe:', error);
    } finally {
      setSubmitting(false);
    }
  };



  const getCalories = (nutrients: Recipe['nutrients']) => {
    const calorieNutrient = nutrients.find(n => n.macro === 'calories');
    return calorieNutrient ? Math.round(calorieNutrient.mass) : 0;
  };

  const formatIngredients = (ingredients: Recipe['ingredients']) => 
    ingredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`.trim());

  const formatInstructions = (steps: Recipe['steps']) => 
    steps.sort((a, b) => a.order - b.order).map(step => step.description);

  if (loading) return <div>Loading recipes...</div>;
  if (!token) return <div>Please log in to view recipes.</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Recipe Library</h1>
      
      <Button 
        variant="contained" 
        onClick={() => setDialogOpen(true)}
        style={{ marginBottom: '20px' }}
      >
        Add Recipe from URL
      </Button>

      <VerticalContainer>
        {recipes.map(recipe => {
          const ingredients = formatIngredients(recipe.ingredients);
          const instructions = formatInstructions(recipe.steps);
          const calories = getCalories(recipe.nutrients);
          
          return (
            <RecipeAccordion 
              key={recipe.id}
              recipeId={recipe.id}
              title={recipe.name}
              calories={calories}
              serves={1}
              cartId={cartId || undefined}
              sourceUrl={recipe.source_url}
              onRecipeDeleted={fetchRecipes}
            >
              <RecipeDetails
                imageUrl={recipe.image_url || ''}
                ingredients={ingredients}
                instructions={instructions}
                nutrition={{ calories }}
              />
            </RecipeAccordion>
          );
        })}
        {recipes.length === 0 && (
          <Typography variant="body1" color="text.secondary">
            No recipes found. Add some recipes to get started!
          </Typography>
        )}
      </VerticalContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Recipe from URL</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Recipe URL"
            fullWidth
            variant="outlined"
            value={newRecipeUrl}
            onChange={(e) => setNewRecipeUrl(e.target.value)}
            placeholder="https://example.com/recipe"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={addRecipeFromUrl} variant="contained" disabled={submitting}>
            {submitting ? 'Processing...' : 'Add Recipe'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RecipeLibrary;
