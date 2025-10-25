import { useState } from 'react';
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, IconButton } from '@mui/material';
import { Close as CloseIcon, CloudUpload as UploadIcon, Add as AddIcon, FilterList as FilterIcon, Sort as SortIcon } from '@mui/icons-material';
import styles from './RecipeLibrary.module.css';
import VerticalContainer from '../common/VerticalContainer/VerticalContainer';
import RecipeAccordion from '../common/RecipeAccordion/RecipeAccordion';
import RecipeDetails from '../common/RecipeAccordion/RecipeDetails';
import EditableRecipeDetails from '../common/RecipeAccordion/EditableRecipeDetails';
import { useAuth } from '../../contexts/AuthContext';
import { useRecipes } from '../../hooks/useRecipes';
import { apiService } from '../../services/api';
import type { Recipe } from '../../types/recipe';

interface Ingredient {
  name: string;
  quantity: number | '';
  unit: string;
}

const RecipeLibrary = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customRecipeDialogOpen, setCustomRecipeDialogOpen] = useState(false);
  const [newRecipeUrl, setNewRecipeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'date_added' | 'times_made'>('date_added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Custom recipe form state
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: '' }]);
  const [directions, setDirections] = useState(['']);

  const { token } = useAuth();
  const { recipes, loading, error, refetch } = useRecipes();



  const addRecipeFromUrl = async () => {
    if (!newRecipeUrl.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      await apiService.createRecipe({
        recipe_source: 'url',
        url: newRecipeUrl
      });
      
      setNewRecipeUrl('');
      setDialogOpen(false);
      refetch(); // Refresh the recipes list
    } catch (error) {
      console.error('Failed to add recipe:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const saveCustomRecipe = async () => {
    if (!recipeName.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      await apiService.createRecipe({
        recipe_source: 'explicit',
        name: recipeName,
        ingredients: ingredients.filter(i => i.name.trim()).map((ingredient) => ({
          name: ingredient.name.trim(),
          quantity: ingredient.quantity === '' ? 0 : Number(ingredient.quantity),
          unit: ingredient.unit.trim()
        })),
        steps: directions.filter(d => d.trim()).map((direction) => ({
          description: direction
        }))
      });
      
      setRecipeName('');
      setIngredients([{ name: '', quantity: '', unit: '' }]);
      setDirections(['']);
      setCustomRecipeDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Failed to save custom recipe:', error);
    } finally {
      setSubmitting(false);
    }
  };



  const sortRecipes = (sortType: 'date_added' | 'times_made') => {
    if (sortBy === sortType) {
      // Toggle order if same sort type is clicked
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Change sort type and reset to desc order
      setSortBy(sortType);
      setSortOrder('desc');
    }
  };

  const sortedRecipes = [...recipes].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'date_added') {
      const dateA = new Date(a.date_added || 0).getTime();
      const dateB = new Date(b.date_added || 0).getTime();
      comparison = dateB - dateA; // Default: newest first
    } else {
      const timesA = a.times_made || 0;
      const timesB = b.times_made || 0;
      comparison = timesB - timesA; // Default: most made first
    }
    
    // Apply sort order
    return sortOrder === 'asc' ? -comparison : comparison;
  });



  const getCalories = (nutrients: Recipe['nutrients']) => {
    const calorieNutrient = nutrients.find(n => n.macro === 'calories');
    return calorieNutrient ? Math.round(calorieNutrient.mass) : 0;
  };

  const formatIngredients = (ingredients: Recipe['ingredients']) => 
    ingredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`.trim());

  const formatInstructions = (steps: Recipe['steps']) => 
    steps.sort((a, b) => a.order - b.order).map(step => step.description);

  if (loading) return <div>Loading recipes...</div>;
  if (error) return <div>Error loading recipes: {error}</div>;
  if (!token) return <div>Please log in to view recipes.</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Recipe Library</h1>
      
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        marginBottom: '8px',
        alignItems: 'center'
      }}>
        <Button 
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ 
            backgroundColor: '#2e7d32',
            '&:hover': {
              backgroundColor: '#1b5e20'
            },
            borderRadius: 2,
            padding: '8px 16px',
            textTransform: 'none',
            fontWeight: 'bold'
          }}
        >
          Add recipe
        </Button>
        
        <Button 
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => sortRecipes('times_made')}
          sx={{ 
            borderColor: sortBy === 'times_made' ? '#2e7d32' : '#e0e0e0',
            color: sortBy === 'times_made' ? '#2e7d32' : '#666',
            backgroundColor: sortBy === 'times_made' ? '#f1f8e9' : 'transparent',
            '&:hover': {
              borderColor: sortBy === 'times_made' ? '#1b5e20' : '#bdbdbd',
              backgroundColor: sortBy === 'times_made' ? '#e8f5e8' : '#f5f5f5'
            },
            borderRadius: 2,
            padding: '8px 16px',
            textTransform: 'none'
          }}
        >
          Popular {sortBy === 'times_made' && (sortOrder === 'desc' ? '↓' : '↑')}
        </Button>
        
        <Button 
          variant="outlined"
          startIcon={<SortIcon />}
          onClick={() => sortRecipes('date_added')}
          sx={{ 
            borderColor: sortBy === 'date_added' ? '#2e7d32' : '#e0e0e0',
            color: sortBy === 'date_added' ? '#2e7d32' : '#666',
            backgroundColor: sortBy === 'date_added' ? '#f1f8e9' : 'transparent',
            '&:hover': {
              borderColor: sortBy === 'date_added' ? '#1b5e20' : '#bdbdbd',
              backgroundColor: sortBy === 'date_added' ? '#e8f5e8' : '#f5f5f5'
            },
            borderRadius: 2,
            padding: '8px 16px',
            textTransform: 'none'
          }}
        >
          Date added {sortBy === 'date_added' && (sortOrder === 'desc' ? '↓' : '↑')}
        </Button>
      </Box>

      <VerticalContainer>
        {sortedRecipes.map(recipe => {
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
              sourceUrl={recipe.source_url}
              onRecipeDeleted={refetch}
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
        {sortedRecipes.length === 0 && (
          <Typography variant="body1" color="text.secondary">
            No recipes found. Add some recipes to get started!
          </Typography>
        )}
      </VerticalContainer>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            padding: 0
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <DialogTitle sx={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            padding: '24px 24px 0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            Add recipe
            <IconButton 
              onClick={() => setDialogOpen(false)}
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ padding: '24px' }}>
            {/* From online section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                From online
              </Typography>
              <TextField
                fullWidth
                placeholder="Recipe link"
                value={newRecipeUrl}
                onChange={(e) => setNewRecipeUrl(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1
                  }
                }}
              />
            </Box>

            {/* From media section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                From media
              </Typography>
              <Box
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 1,
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: '#f9f9f9',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#f0f0f0'
                  }
                }}
              >
                <UploadIcon sx={{ fontSize: 40, color: '#666', mb: 1 }} />
                <Typography variant="body1" sx={{ color: '#666' }}>
                  Upload Media
                </Typography>
              </Box>
            </Box>

            {/* Custom recipe section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                Custom recipe
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setDialogOpen(false);
                  setCustomRecipeDialogOpen(true);
                }}
                sx={{
                  borderColor: '#2e7d32',
                  color: '#2e7d32',
                  '&:hover': {
                    borderColor: '#1b5e20',
                    backgroundColor: '#f1f8e9'
                  },
                  borderRadius: 1,
                  padding: '8px 16px',
                  textTransform: 'none'
                }}
              >
                Add custom recipe
              </Button>
            </Box>
          </DialogContent>

          <DialogActions sx={{ padding: '0 24px 24px 24px', justifyContent: 'flex-end' }}>
            <Button 
              variant="contained"
              onClick={addRecipeFromUrl}
              disabled={submitting}
              sx={{
                backgroundColor: '#4caf50',
                '&:hover': {
                  backgroundColor: '#45a049'
                },
                borderRadius: 1,
                padding: '8px 24px'
              }}
            >
              Add recipe
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Custom Recipe Dialog */}
      <Dialog 
        open={customRecipeDialogOpen} 
        onClose={() => setCustomRecipeDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            minHeight: '80vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          padding: '24px 24px 0 24px',
          color: '#2e7d32'
        }}>
          Create Custom Recipe
          <IconButton 
            onClick={() => setCustomRecipeDialogOpen(false)}
            sx={{ 
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ 
          padding: '24px',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#c1c1c1',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#a8a8a8',
            },
          },
        }}>
          <EditableRecipeDetails
            recipeName={recipeName}
            ingredients={ingredients}
            instructions={directions}
            onRecipeNameChange={setRecipeName}
            onIngredientsChange={setIngredients}
            onInstructionsChange={setDirections}
          />
        </DialogContent>
        <DialogActions sx={{ 
          padding: '16px 24px 24px 24px',
          justifyContent: 'space-between',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fafafa'
        }}>
          <Button 
            onClick={() => setCustomRecipeDialogOpen(false)}
            sx={{
              color: '#666',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: '#f0f0f0'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={saveCustomRecipe}
            disabled={!recipeName.trim() || submitting}
            sx={{
              backgroundColor: '#2e7d32',
              '&:hover': {
                backgroundColor: '#1b5e20'
              },
              '&:disabled': {
                backgroundColor: '#e0e0e0',
                color: '#9e9e9e'
              },
              borderRadius: 2,
              padding: '8px 24px',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            {submitting ? 'Saving...' : 'Save Recipe'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RecipeLibrary;
