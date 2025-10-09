import React, { useState, useEffect } from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Box,
  IconButton
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import styles from './MealPlanner.module.css';
/**THIS IS ONLY A PLACEHOLDER FRONTEND!! */
interface MealPlan {
  date: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snacks: string[];
}

const MealPlanner = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<keyof Omit<MealPlan, 'date'>>('breakfast');
  const [newMeal, setNewMeal] = useState('');
  const [weekDates, setWeekDates] = useState<string[]>([]);

  useEffect(() => {
    generateWeekDates();
    loadMealPlan(selectedDate);
  }, [selectedDate]);

  const generateWeekDates = () => {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    setWeekDates(dates);
  };

  const loadMealPlan = async (date: string) => {
    try {
      const response = await fetch(`/api/calendar/1/${date}/`);
      if (response.ok) {
        const data = await response.json();
        setMealPlan(data);
      } else {
        setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
      }
    } catch (error) {
      setMealPlan({ date, breakfast: [], lunch: [], dinner: [], snacks: [] });
    }
  };

  const saveMealPlan = async (updatedPlan: MealPlan) => {
    try {
      await fetch(`/api/calendar/1/${updatedPlan.date}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPlan)
      });
      setMealPlan(updatedPlan);
    } catch (error) {
      console.error('Failed to save meal plan:', error);
    }
  };

  const addMeal = () => {
    if (!mealPlan || !newMeal.trim()) return;
    
    const updatedPlan = {
      ...mealPlan,
      [currentMealType]: [...mealPlan[currentMealType], newMeal.trim()]
    };
    
    saveMealPlan(updatedPlan);
    setNewMeal('');
    setDialogOpen(false);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderMealSection = (title: string, mealType: keyof Omit<MealPlan, 'date'>, meals: string[]) => (
    <Card className={styles.mealCard}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={() => openAddDialog(mealType)} size="small">
            <Add />
          </IconButton>
        </Box>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {meals.map((meal, index) => (
            <Chip
              key={index}
              label={meal}
              onDelete={() => removeMeal(mealType, index)}
              deleteIcon={<Delete />}
              variant="outlined"
            />
          ))}
          {meals.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No {title.toLowerCase()} planned
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <>
      <h1 className={styles.pageTitle}>Meal Planner</h1>
      
      <Box mb={3}>
        <Typography variant="h6" mb={2}>Select Date</Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          {weekDates.map(date => (
            <Button
              key={date}
              variant={selectedDate === date ? 'contained' : 'outlined'}
              onClick={() => setSelectedDate(date)}
              size="small"
            >
              {formatDate(date)}
            </Button>
          ))}
        </Box>
      </Box>

      {mealPlan && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {renderMealSection('Breakfast', 'breakfast', mealPlan.breakfast)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderMealSection('Lunch', 'lunch', mealPlan.lunch)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderMealSection('Dinner', 'dinner', mealPlan.dinner)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderMealSection('Snacks', 'snacks', mealPlan.snacks)}
          </Grid>
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add {currentMealType}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Meal"
            fullWidth
            variant="outlined"
            value={newMeal}
            onChange={(e) => setNewMeal(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addMeal()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={addMeal} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MealPlanner;