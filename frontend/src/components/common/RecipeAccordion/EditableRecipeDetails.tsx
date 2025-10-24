import React, { useState } from 'react';
import { TextField, Button, Box, Typography, IconButton } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import styles from './RecipeDetails.module.css';

interface Props {
  recipeName: string;
  ingredients: string[];
  instructions: string[];
  onRecipeNameChange: (name: string) => void;
  onIngredientsChange: (ingredients: string[]) => void;
  onInstructionsChange: (instructions: string[]) => void;
}

const EditableRecipeDetails = ({ 
  recipeName, 
  ingredients, 
  instructions, 
  onRecipeNameChange, 
  onIngredientsChange, 
  onInstructionsChange 
}: Props) => {
  const addIngredient = () => {
    onIngredientsChange([...ingredients, '']);
  };

  const addInstruction = () => {
    onInstructionsChange([...instructions, '']);
  };

  const updateIngredient = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = value;
    onIngredientsChange(updated);
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    onInstructionsChange(updated);
  };

  const removeIngredient = (index: number) => {
    onIngredientsChange(ingredients.filter((_, i) => i !== index));
  };

  const removeInstruction = (index: number) => {
    onInstructionsChange(instructions.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.details}>
      <div className={styles.left}>
        <div className={styles.placeholder}>No image</div>
      </div>

      <div className={styles.right}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Recipe Name</Typography>
          <TextField
            fullWidth
            value={recipeName}
            onChange={(e) => onRecipeNameChange(e.target.value)}
            placeholder="Enter recipe name"
          />
        </Box>

        <div className={styles.col}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <h4 className={styles.sectionTitle}>Ingredients</h4>
            <IconButton size="small" onClick={addIngredient}>
              <AddIcon />
            </IconButton>
          </Box>
          {ingredients.length === 0 ? (
            <div className={styles.empty}>No ingredients.</div>
          ) : (
            <ul>
              {ingredients.map((ingredient, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <TextField
                    value={ingredient}
                    onChange={(e) => updateIngredient(i, e.target.value)}
                    placeholder="e.g., 2 cups flour"
                    variant="standard"
                    sx={{ flex: 1, mr: 1 }}
                  />
                  <IconButton size="small" onClick={() => removeIngredient(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.col}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <h4 className={styles.sectionTitle}>Directions</h4>
            <IconButton size="small" onClick={addInstruction}>
              <AddIcon />
            </IconButton>
          </Box>
          {instructions.length === 0 ? (
            <div className={styles.empty}>No directions.</div>
          ) : (
            <ol>
              {instructions.map((instruction, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <TextField
                    value={instruction}
                    onChange={(e) => updateInstruction(i, e.target.value)}
                    placeholder="Enter instruction step"
                    variant="standard"
                    multiline
                    sx={{ flex: 1, mr: 1 }}
                  />
                  <IconButton size="small" onClick={() => removeInstruction(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditableRecipeDetails;