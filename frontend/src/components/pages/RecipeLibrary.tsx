import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, IconButton, InputAdornment } from '@mui/material';
import { Close as CloseIcon, CloudUpload as UploadIcon, Add as AddIcon, FilterList as FilterIcon, Sort as SortIcon, Search as SearchIcon } from '@mui/icons-material';
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
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customRecipeDialogOpen, setCustomRecipeDialogOpen] = useState(false);
  const [newRecipeUrl, setNewRecipeUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'date_added' | 'times_made'>('date_added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [nonRecipeNotice, setNonRecipeNotice] = useState<string | null>(null);
  
  // Get recipeId from URL params
  const targetRecipeId = searchParams.get('recipeId') ? parseInt(searchParams.get('recipeId') || '0', 10) : null;

  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };
  
  // Custom recipe form state
  const [recipeName, setRecipeName] = useState('');
  const [recipeServes, setRecipeServes] = useState<number | ''>('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: '' }]);
  const [directions, setDirections] = useState(['']);

  const { token } = useAuth();
  const { recipes, loading, error, refetch } = useRecipes();

  // Search functionality
  const performSearch = async (query: string) => {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Require at least 3 characters for search
    if (trimmedQuery.length < 3) {
      // Don't clear search results - keep showing original recipes
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await apiService.searchRecipes(trimmedQuery);
      // Fetch complete recipe details for each search result
      const completeRecipes = await Promise.all(
        searchResults.map(recipe => apiService.getRecipe(recipe.id))
      );
      setSearchResults(completeRecipes);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reset form state when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setNewRecipeUrl('');
      setUploadedImage(null);
    }
  }, [dialogOpen]);

  const addRecipeFromUrl = async () => {
    if (!newRecipeUrl.trim() || submitting) return;
    if (!isValidHttpUrl(newRecipeUrl.trim())) {
      setNonRecipeNotice('Please enter a valid http(s) link.');
      setTimeout(() => setNonRecipeNotice(null), 5000);
      return;
    }
    
    setSubmitting(true);
    try {
      const created = await apiService.createRecipe({
        recipe_source: 'url',
        url: newRecipeUrl
      });
      
      setNewRecipeUrl('');
      setDialogOpen(false);
      refetch(); // Refresh the recipes list

      // If a placeholder recipe is created, poll it briefly to detect quick failure (non-recipe)
      if (created && created.id && created.name && created.name.toLowerCase().includes('processing')) {
        const placeholderId = created.id;
        const startTime = Date.now();
        const pollInterval = 2000; // 2s
        const maxDuration = 20000; // 20s
        const timer = setInterval(async () => {
          try {
            const r = await apiService.getRecipe(placeholderId);
            // If recipe has been updated to a real name, stop polling
            if (r && r.name && !r.name.toLowerCase().includes('processing')) {
              clearInterval(timer);
              return;
            }
          } catch (e) {
            // If fetch fails (likely 404 because placeholder was deleted), show notice
            clearInterval(timer);
            setNonRecipeNotice('That link does not seem to be a recipe.');
            // Auto-hide after 6 seconds
            setTimeout(() => setNonRecipeNotice(null), 6000);
            return;
          }
          if (Date.now() - startTime > maxDuration) {
            clearInterval(timer);
          }
        }, pollInterval);
      }
    } catch (error) {
      console.error('Failed to add recipe:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const addRecipeFromImage = async () => {
    if (!uploadedImage || submitting) return;
    
    setSubmitting(true);
    try {
      const created = await apiService.createRecipeFromImage(uploadedImage);
      
      setUploadedImage(null);
      setDialogOpen(false);
      refetch(); // Refresh the recipes list

      // If a placeholder recipe is created, poll it briefly to detect quick failure (non-recipe)
      if (created && created.id && created.name && created.name.toLowerCase().includes('processing')) {
        const placeholderId = created.id;
        const startTime = Date.now();
        const pollInterval = 2000; // 2s
        const maxDuration = 20000; // 20s
        const timer = setInterval(async () => {
          try {
            const r = await apiService.getRecipe(placeholderId);
            // If recipe has been updated to a real name, stop polling
            if (r && r.name && !r.name.toLowerCase().includes('processing')) {
              clearInterval(timer);
              return;
            }
          } catch (e) {
            // If fetch fails (likely 404 because placeholder was deleted), show notice
            clearInterval(timer);
            setNonRecipeNotice('That image does not seem to contain a recipe.');
            // Auto-hide after 6 seconds
            setTimeout(() => setNonRecipeNotice(null), 6000);
            return;
          }
          if (Date.now() - startTime > maxDuration) {
            clearInterval(timer);
          }
        }, pollInterval);
      }
    } catch (error) {
      console.error('Failed to add recipe from image:', error);
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
        serves: (typeof recipeServes === 'number' && recipeServes > 0) ? recipeServes : undefined,
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
      setRecipeServes('');
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

  // Determine which recipes to display and sort
  const recipesToDisplay = (searchQuery.trim() && searchQuery.trim().length >= 3) ? searchResults : recipes;
  
  const sortedRecipes = [...recipesToDisplay].sort((a, b) => {
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

  const favoriteRecipes = sortedRecipes.filter(r => r.favorite);



  const getCalories = (nutrients: Recipe['nutrients']) => {
    const calorieNutrient = nutrients?.find(n => n.macro === 'calories');
    return calorieNutrient ? Math.round(calorieNutrient.mass) : 0;
  };

  const getNutritionData = (nutrients: Recipe['nutrients']) => {
    const nutritionMap: { [key: string]: number } = {};
    
    nutrients?.forEach(nutrient => {
      const macro = nutrient.macro;
      const mass = nutrient.mass;
      
      // Map backend nutrient names to frontend nutrition interface
      switch (macro) {
        case 'calories':
          nutritionMap.calories = mass;
          break;
        case 'fatContent':
          nutritionMap.fat = mass;
          break;
        case 'saturatedFatContent':
          nutritionMap.saturatedFat = mass;
          break;
        case 'unsaturatedFatContent':
          nutritionMap.unsaturatedFat = mass;
          break;
        case 'cholesterolContent':
          nutritionMap.cholesterol = mass;
          break;
        case 'sodiumContent':
          nutritionMap.sodium = mass;
          break;
        case 'carbohydrateContent':
          nutritionMap.carbs = mass;
          break;
        case 'fiberContent':
          nutritionMap.fiber = mass;
          break;
        case 'sugarContent':
          nutritionMap.sugar = mass;
          break;
        case 'proteinContent':
          nutritionMap.protein = mass;
          break;
      }
    });
    
    return nutritionMap;
  };

  const formatIngredients = (ingredients: Recipe['ingredients']) => 
    ingredients?.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`.trim()) || [];

  const formatInstructions = (steps: Recipe['steps']) => 
    steps?.sort((a, b) => a.order - b.order).map(step => step.description) || [];

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
        
        <TextField
          placeholder="Search recipes (min 3 chars)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{
            minWidth: '250px',
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#fafafa',
              '&:hover': {
                backgroundColor: '#f5f5f5'
              },
              '&.Mui-focused': {
                backgroundColor: 'white'
              }
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#666' }} />
              </InputAdornment>
            ),
          }}
        />
        
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

      {favoriteRecipes.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 1, mb: 0.5, fontWeight: 400 }}>Favorites</Typography>
          <VerticalContainer>
            {favoriteRecipes.map(recipe => {
              const ingredients = formatIngredients(recipe.ingredients);
              const instructions = formatInstructions(recipe.steps);
              const calories = getCalories(recipe.nutrients);
              const nutritionData = getNutritionData(recipe.nutrients);

              return (
                <RecipeAccordion 
                  key={`fav-${recipe.id}`}
                  recipeId={recipe.id}
                  title={recipe.name}
                  calories={calories}
                  serves={recipe.serves || 1}
                  sourceUrl={recipe.source_url}
                  onRecipeDeleted={refetch}
                  onRecipeUpdated={refetch}
                  favorite={recipe.favorite}
                  initialOpen={targetRecipeId === recipe.id}
                >
                  <RecipeDetails
                    imageUrl={recipe.image_url || ''}
                    ingredients={ingredients}
                    instructions={instructions}
                    nutrition={nutritionData}
                  />
                </RecipeAccordion>
              );
            })}
          </VerticalContainer>
        </>
      )}

      <Typography variant="h6" sx={{ mt: 2, mb: 0.5, fontWeight: 400 }}>All recipes</Typography>
      <VerticalContainer>
        {sortedRecipes.map(recipe => {
          const ingredients = formatIngredients(recipe.ingredients);
          const instructions = formatInstructions(recipe.steps);
          const calories = getCalories(recipe.nutrients);
          const nutritionData = getNutritionData(recipe.nutrients);
          
          return (
            <RecipeAccordion 
              key={recipe.id}
              recipeId={recipe.id}
              title={recipe.name}
              calories={calories}
              serves={recipe.serves || 1}
              sourceUrl={recipe.source_url}
              onRecipeDeleted={refetch}
              onRecipeUpdated={refetch}
              favorite={recipe.favorite}
              initialOpen={targetRecipeId === recipe.id}
            >
              <RecipeDetails
                imageUrl={recipe.image_url || ''}
                ingredients={ingredients}
                instructions={instructions}
                nutrition={nutritionData}
              />
            </RecipeAccordion>
          );
        })}
        {sortedRecipes.length === 0 && !isSearching && (
          <Typography variant="body1" color="text.secondary">
            {searchQuery.trim() 
              ? searchQuery.trim().length < 3
                ? "Enter at least 3 characters to search recipes."
                : `No recipes found matching "${searchQuery}". Try a different search term.`
              : "No recipes found. Add some recipes to get started!"
            }
          </Typography>
        )}
        {isSearching && (
          <Typography variant="body1" color="text.secondary">
            Searching recipes...
          </Typography>
        )}
      </VerticalContainer>

      {/* Red corner notification for non-recipe URLs */}
      {nonRecipeNotice && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            backgroundColor: '#d32f2f',
            color: 'white',
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 1300,
            fontWeight: 600,
          }}
        >
          {nonRecipeNotice}
        </Box>
      )}

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
                From image
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="upload-image-input"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadedImage(file);
                  }
                }}
              />
              <label htmlFor="upload-image-input">
                <Box
                  sx={{
                    border: '2px dashed #ccc',
                    borderRadius: 1,
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: uploadedImage ? '#e8f5e9' : '#f9f9f9',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: uploadedImage ? '#c8e6c9' : '#f0f0f0'
                    }
                  }}
                >
                  <UploadIcon sx={{ fontSize: 40, color: uploadedImage ? '#4caf50' : '#666', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: uploadedImage ? '#4caf50' : '#666', fontWeight: uploadedImage ? 'bold' : 'normal' }}>
                    {uploadedImage ? uploadedImage.name : 'Upload Image'}
                  </Typography>
                  {uploadedImage && (
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
                      Click to change
                    </Typography>
                  )}
                </Box>
              </label>
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
              onClick={() => {
                if (uploadedImage) {
                  addRecipeFromImage();
                } else {
                  addRecipeFromUrl();
                }
              }}
              disabled={submitting || (!newRecipeUrl.trim() && !uploadedImage)}
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
            serves={recipeServes}
            ingredients={ingredients}
            instructions={directions}
            onRecipeNameChange={setRecipeName}
            onServesChange={setRecipeServes}
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
