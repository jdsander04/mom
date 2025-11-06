import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import RecipeDetails from '../common/RecipeAccordion/RecipeDetails';
import CustomCalendar from '../common/CustomCalendar';
import styles from './MealPlanner.module.css';
interface MealPlan {
  date: string;
  breakfast: { id: number; name: string }[];
  lunch: { id: number; name: string }[];
  dinner: { id: number; name: string }[];
  snacks: { id: number; name: string }[];
}

interface Recipe {
  id: number;
  name: string;
}

interface RecipeDetail {
  id: number;
  name: string;
  description: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: { description: string; order: number }[];
}

const MealPlanner = () => {
  const { token, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<keyof Omit<MealPlan, 'date'>>('breakfast');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeDetailOpen, setRecipeDetailOpen] = useState(false);
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<RecipeDetail | null>(null);

  useEffect(() => {
    loadMealPlan(selectedDate.format('YYYY-MM-DD'));
    loadRecipes();
  }, [selectedDate, token, user]);



  const loadMealPlan = async (date: string) => {
    if (!token) {
      setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
      return;
    }
    
    try {
      const response = await fetch(`/api/calendar/1/${date}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Convert string arrays to recipe objects if needed
        const convertedData = {
          ...data,
          breakfast: Array.isArray(data.breakfast) ? data.breakfast.map((item: any) => 
            typeof item === 'string' ? { id: 0, name: item } : item
          ) : [],
          lunch: Array.isArray(data.lunch) ? data.lunch.map((item: any) => 
            typeof item === 'string' ? { id: 0, name: item } : item
          ) : [],
          dinner: Array.isArray(data.dinner) ? data.dinner.map((item: any) => 
            typeof item === 'string' ? { id: 0, name: item } : item
          ) : [],
          snacks: Array.isArray(data.snacks) ? data.snacks.map((item: any) => 
            typeof item === 'string' ? { id: 0, name: item } : item
          ) : []
        };
        setMealPlan(convertedData);
      } else if (response.status === 404) {
        setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
      } else {
        console.error('Failed to load meal plan:', response.status);
        setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
      setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
    }
  };

  const saveMealPlan = async (updatedPlan: MealPlan) => {
    if (!token) return;
    
    try {
      const { date, ...mealData } = updatedPlan;
      
      const response = await fetch(`/api/calendar/1/${date}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mealData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setMealPlan(data);
      } else {
        console.error('Failed to save meal plan:', response.status);
      }
    } catch (error) {
      console.error('Error saving meal plan:', error);
    }
  };

  const loadRecipes = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/recipes/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecipes(data.recipes || []);
      } else {
        console.error('Failed to load recipes:', response.status);
        setRecipes([]);
      }
    } catch (error) {
      console.error('Error loading recipes:', error);
      setRecipes([]);
    }
  };

  const addRecipe = (recipe: Recipe) => {
    if (!mealPlan) return;
    
    const updatedPlan = {
      ...mealPlan,
      [currentMealType]: [...mealPlan[currentMealType], { id: recipe.id, name: recipe.name }]
    };
    
    saveMealPlan(updatedPlan);
    setDialogOpen(false);
  };

  const viewRecipeDetail = async (recipeId: number, recipeName: string) => {
    console.log('Clicked recipe:', { recipeId, recipeName });
    
    if (!token) return;
    
    if (recipeId === 0) {
      // For legacy string-based entries, find the recipe by name
      const recipe = recipes.find(r => r.name === recipeName);
      if (!recipe) {
        console.log('Recipe not found in library:', recipeName);
        return;
      }
      recipeId = recipe.id;
    }
    
    try {
      const response = await fetch(`/api/recipes/${recipeId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedRecipeDetail(data);
        setRecipeDetailOpen(true);
      } else {
        console.error('Failed to load recipe detail:', response.status);
      }
    } catch (error) {
      console.error('Error loading recipe detail:', error);
    }
  };

  const removeMeal = (mealType: keyof Omit<MealPlan, 'date'>, index: number) => {
    if (!mealPlan) return;
    
    const updatedMeals = [...mealPlan[mealType]];
    updatedMeals.splice(index, 1);
    
    const updatedPlan = {
      ...mealPlan,
      [mealType]: updatedMeals
    };
    
    saveMealPlan(updatedPlan);
  };

  const openAddDialog = (mealType: keyof Omit<MealPlan, 'date'>) => {
    setCurrentMealType(mealType);
    setDialogOpen(true);
  };



  const renderMealSection = (title: string, mealType: keyof Omit<MealPlan, 'date'>, meals: { id: number; name: string }[]) => (
    <div className={styles.mealCard}>
      <div className={styles.mealHeader}>
        <h3>{title}</h3>
        <button 
          onClick={() => openAddDialog(mealType)} 
          className={styles.addButton}
        >
          +
        </button>
      </div>
      <div className={styles.mealContent}>
        {meals.map((meal, index) => (
          <div key={index} className={styles.mealItem}>
            <span 
              onClick={() => viewRecipeDetail(meal.id, meal.name)}
              className={styles.mealName}
            >
              {meal.name}
            </span>
            <button 
              onClick={() => removeMeal(mealType, index)}
              className={styles.removeButton}
            >
              ×
            </button>
          </div>
        ))}
        {meals.length === 0 && (
          <div className={styles.emptyMeal}>
            No {title.toLowerCase()} planned
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Meal Planner</h1>
      
      <div className={styles.mainLayout}>
        <div className={styles.calendarSection}>
          <h3>Select Date</h3>
          <div className={styles.calendarContainer}>
            <CustomCalendar 
              value={selectedDate}
              onChange={setSelectedDate}
            />
          </div>
          <div className={styles.selectedDate}>
            Selected: {selectedDate.format('dddd, MMMM D, YYYY')}
          </div>
        </div>

        <div className={styles.mealsSection}>
          {mealPlan && (
            <div className={styles.mealsGrid}>
              {renderMealSection('Breakfast', 'breakfast', mealPlan.breakfast)}
              {renderMealSection('Lunch', 'lunch', mealPlan.lunch)}
              {renderMealSection('Dinner', 'dinner', mealPlan.dinner)}
              {renderMealSection('Snacks', 'snacks', mealPlan.snacks)}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Recipe to {currentMealType}</DialogTitle>
        <DialogContent>
          <List>
            {recipes.map((recipe) => (
              <ListItem key={recipe.id} disablePadding>
                <ListItemButton onClick={() => addRecipe(recipe)}>
                  <ListItemText primary={recipe.name} />
                </ListItemButton>
              </ListItem>
            ))}
            {recipes.length === 0 && (
              <div style={{ padding: '16px', color: '#666' }}>
                No recipes found. Add recipes to your library first.
              </div>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recipeDetailOpen} onClose={() => setRecipeDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecipeDetail?.name}</DialogTitle>
        <DialogContent>
          {selectedRecipeDetail && (
            <RecipeDetails
              imageUrl={selectedRecipeDetail.image_url}
              ingredients={selectedRecipeDetail.ingredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`)}
              instructions={selectedRecipeDetail.steps.map(step => step.description)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecipeDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default MealPlanner;
