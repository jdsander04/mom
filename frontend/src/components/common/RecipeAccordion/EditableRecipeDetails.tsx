import { TextField, Box, Typography, IconButton, Paper, Select, MenuItem, FormControl } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface Ingredient {
  name: string;
  quantity: number | '';
  unit: string;
}

interface Props {
  recipeName: string;
  serves?: number | '';
  ingredients: Ingredient[];
  instructions: string[];
  onRecipeNameChange: (name: string) => void;
  onServesChange?: (serves: number | '') => void;
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  onInstructionsChange: (instructions: string[]) => void;
}

const EditableRecipeDetails = ({ 
  recipeName,
  serves,
  ingredients, 
  instructions, 
  onRecipeNameChange,
  onServesChange,
  onIngredientsChange, 
  onInstructionsChange 
}: Props) => {
  const addIngredient = () => {
    onIngredientsChange([...ingredients, { name: '', quantity: '', unit: '' }]);
  };

  const addInstruction = () => {
    onInstructionsChange([...instructions, '']);
  };

  const updateIngredientName = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], name: value };
    onIngredientsChange(updated);
  };

  const updateIngredientQuantity = (index: number, value: number | '') => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], quantity: value };
    onIngredientsChange(updated);
  };

  const updateIngredientUnit = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], unit: value };
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

  const commonUnits = [
    '', 'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg',
    'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l', 'fluid ounce', 'fluid ounces', 'fl oz',
    'piece', 'pieces', 'pcs', 'clove', 'cloves', 'slice', 'slices', 'can', 'cans', 'package', 'packages',
    'pinch', 'dash', 'to taste', 'as needed'
  ];

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Recipe Name Section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#2e7d32' }}>
          Recipe Name
        </Typography>
        <TextField
          fullWidth
          value={recipeName}
          onChange={(e) => onRecipeNameChange(e.target.value)}
          placeholder="Enter recipe name"
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              backgroundColor: '#fafafa',
              '&:hover': {
                backgroundColor: '#f5f5f5'
              },
              '&.Mui-focused': {
                backgroundColor: '#fff'
              }
            }
          }}
        />
        {onServesChange && (
          <TextField
            fullWidth
            value={serves || ''}
            onChange={(e) => {
              const value = e.target.value;
              onServesChange(value === '' ? '' : (parseInt(value, 10) || ''));
            }}
            placeholder="Serves (optional)"
            label="Serves"
            type="number"
            variant="outlined"
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                backgroundColor: '#fafafa',
                '&:hover': {
                  backgroundColor: '#f5f5f5'
                },
                '&.Mui-focused': {
                  backgroundColor: '#fff'
                }
              }
            }}
          />
        )}
      </Paper>

      {/* Ingredients Section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2e7d32' }}>
            Ingredients
          </Typography>
          <IconButton 
            onClick={addIngredient}
            sx={{ 
              backgroundColor: '#e8f5e8',
              '&:hover': {
                backgroundColor: '#d4edda'
              }
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
        
        {ingredients.length === 0 ? (
          <Box sx={{ 
            textAlign: 'center', 
            py: 3, 
            color: '#6b7280',
            fontStyle: 'italic'
          }}>
            No ingredients added yet. Click the + button to add ingredients.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ingredients.map((ingredient, i) => (
              <Box key={i} sx={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 1.5,
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 1.5,
                backgroundColor: '#fafafa'
              }}>
                <Typography variant="body2" sx={{ 
                  minWidth: '24px', 
                  textAlign: 'center',
                  color: '#6b7280',
                  fontWeight: 500,
                  mt: 1
                }}>
                  {i + 1}.
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  {/* Ingredient Name */}
                  <TextField
                    value={ingredient.name}
                    onChange={(e) => updateIngredientName(i, e.target.value)}
                    placeholder="e.g., flour"
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        backgroundColor: '#fff',
                        '&:hover': {
                          backgroundColor: '#f9f9f9'
                        },
                        '&.Mui-focused': {
                          backgroundColor: '#fff'
                        }
                      }
                    }}
                  />
                  
                  {/* Quantity and Unit Row */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      value={ingredient.quantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateIngredientQuantity(i, value === '' ? '' : parseFloat(value) || '');
                      }}
                      placeholder="2"
                      variant="outlined"
                      size="small"
                      type="number"
                      sx={{ 
                        width: '100px',
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          backgroundColor: '#fff',
                          '&:hover': {
                            backgroundColor: '#f9f9f9'
                          },
                          '&.Mui-focused': {
                            backgroundColor: '#fff'
                          }
                        }
                      }}
                    />
                    
                    <FormControl size="small" sx={{ minWidth: '120px' }}>
                      <Select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredientUnit(i, e.target.value)}
                        displayEmpty
                        sx={{
                          borderRadius: 1,
                          backgroundColor: '#fff',
                          '&:hover': {
                            backgroundColor: '#f9f9f9'
                          },
                          '&.Mui-focused': {
                            backgroundColor: '#fff'
                          }
                        }}
                      >
                        <MenuItem value="">
                          <em>Unit (optional)</em>
                        </MenuItem>
                        {commonUnits.filter(unit => unit !== '').map((unit) => (
                          <MenuItem key={unit} value={unit}>
                            {unit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
                
                <IconButton 
                  size="small" 
                  onClick={() => removeIngredient(i)}
                  sx={{ 
                    color: '#dc3545',
                    mt: 1,
                    '&:hover': {
                      backgroundColor: '#f8d7da'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Instructions Section */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2e7d32' }}>
            Instructions
          </Typography>
          <IconButton 
            onClick={addInstruction}
            sx={{ 
              backgroundColor: '#e8f5e8',
              '&:hover': {
                backgroundColor: '#d4edda'
              }
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
        
        {instructions.length === 0 ? (
          <Box sx={{ 
            textAlign: 'center', 
            py: 3, 
            color: '#6b7280',
            fontStyle: 'italic'
          }}>
            No instructions added yet. Click the + button to add instruction steps.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {instructions.map((instruction, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="body2" sx={{ 
                  minWidth: '24px', 
                  textAlign: 'center',
                  color: '#6b7280',
                  fontWeight: 500,
                  mt: 1
                }}>
                  {i + 1}.
                </Typography>
                <TextField
                  value={instruction}
                  onChange={(e) => updateInstruction(i, e.target.value)}
                  placeholder="Enter instruction step"
                  variant="outlined"
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                      '&:hover': {
                        backgroundColor: '#f5f5f5'
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#fff'
                      }
                    }
                  }}
                />
                <IconButton 
                  size="small" 
                  onClick={() => removeInstruction(i)}
                  sx={{ 
                    color: '#dc3545',
                    mt: 1,
                    '&:hover': {
                      backgroundColor: '#f8d7da'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default EditableRecipeDetails;
