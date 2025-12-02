import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { TextField, Box, Typography, IconButton, Paper, Select, MenuItem, FormControl } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const commonUnits = [
  '', 'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
  'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg',
  'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l', 'fluid ounce', 'fluid ounces', 'fl oz',
  'piece', 'pieces', 'pcs', 'clove', 'cloves', 'slice', 'slices', 'can', 'cans', 'package', 'packages',
  'pinch', 'dash', 'to taste', 'as needed'
];

interface SortableInstructionItemProps {
  id: string;
  index: number;
  instruction: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

const SortableInstructionItem = memo(({ id, index, instruction, onUpdate, onRemove }: SortableInstructionItemProps) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(instruction);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value with prop when it changes externally (e.g., drag reorder)
  useEffect(() => {
    setLocalValue(instruction);
  }, [instruction]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the parent update to prevent focus loss
    timeoutRef.current = setTimeout(() => {
      onUpdate(newValue);
    }, 0);
  }, [onUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          mt: 1,
          color: '#6b7280',
          '&:hover': {
            color: '#2e7d32',
          },
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Typography variant="body2" sx={{
        minWidth: '24px',
        textAlign: 'center',
        color: '#6b7280',
        fontWeight: 500,
        mt: 1
      }}>
        {index + 1}.
      </Typography>
      <Box
        sx={{ flex: 1 }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input') || target.closest('textarea')) {
            e.stopPropagation();
          }
        }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input') || target.closest('textarea')) {
            e.stopPropagation();
          }
        }}
      >
        <TextField
          inputRef={inputRef}
          value={localValue}
          onChange={handleChange}
          placeholder="Enter instruction step"
          variant="outlined"
          multiline
          minRows={2}
          fullWidth
          inputProps={{ maxLength: 1000 }}
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
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
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
  );
});

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
  // Track custom units for each ingredient (index -> custom unit value)
  const [customUnits, setCustomUnits] = useState<{ [key: number]: string }>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Initialize customUnits for ingredients that already have non-standard units
  useEffect(() => {
    const commonUnitsSet = new Set(commonUnits);
    const initialCustomUnits: { [key: number]: string } = {};
    ingredients.forEach((ingredient, index) => {
      if (ingredient.unit && !commonUnitsSet.has(ingredient.unit)) {
        initialCustomUnits[index] = ingredient.unit;
      }
    });
    if (Object.keys(initialCustomUnits).length > 0) {
      setCustomUnits(initialCustomUnits);
    }
  }, []); // Only run on mount

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
    if (value === '__CUSTOM__') {
      // Set unit to empty and show custom input
      updated[index] = { ...updated[index], unit: '' };
      setCustomUnits({ ...customUnits, [index]: '' });
    } else {
      updated[index] = { ...updated[index], unit: value };
      // Clear custom unit if switching away from custom
      const newCustomUnits = { ...customUnits };
      delete newCustomUnits[index];
      setCustomUnits(newCustomUnits);
    }
    onIngredientsChange(updated);
  };

  const updateCustomUnit = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], unit: value };
    setCustomUnits({ ...customUnits, [index]: value });
    onIngredientsChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = instructions.findIndex((_, i) => `instruction-${i}` === active.id);
      const newIndex = instructions.findIndex((_, i) => `instruction-${i}` === over.id);

      onInstructionsChange(arrayMove(instructions, oldIndex, newIndex));
    }
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    onInstructionsChange(updated);
  };

  const removeIngredient = (index: number) => {
    onIngredientsChange(ingredients.filter((_, i) => i !== index));
    // Clean up custom units for removed ingredient and reindex remaining ones
    const newCustomUnits: { [key: number]: string } = {};
    Object.keys(customUnits).forEach((key) => {
      const keyNum = parseInt(key, 10);
      if (keyNum < index) {
        newCustomUnits[keyNum] = customUnits[keyNum];
      } else if (keyNum > index) {
        newCustomUnits[keyNum - 1] = customUnits[keyNum];
      }
      // Skip keyNum === index (removed item)
    });
    setCustomUnits(newCustomUnits);
  };

  const removeInstruction = (index: number) => {
    onInstructionsChange(instructions.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Recipe Name Section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#000000' }}>
          Recipe Name
        </Typography>
        <TextField
          fullWidth
          value={recipeName}
          onChange={(e) => onRecipeNameChange(e.target.value)}
          placeholder="Enter recipe name"
          variant="outlined"
          inputProps={{ maxLength: 200 }}
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
            inputProps={{ min: 1, max: 1000 }}
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
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#000000' }}>
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
                    inputProps={{ maxLength: 100 }}
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
                      inputProps={{ min: 0, max: 10000, step: 0.01 }}
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

                    {customUnits[i] !== undefined ? (
                      <TextField
                        value={customUnits[i] || ''}
                        onChange={(e) => updateCustomUnit(i, e.target.value)}
                        placeholder="Enter custom unit"
                        variant="outlined"
                        size="small"
                        inputProps={{ maxLength: 50 }}
                        sx={{
                          minWidth: '120px',
                          flex: 1,
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
                    ) : (
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
                          <MenuItem value="__CUSTOM__">
                            <em>Custom...</em>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    )}
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
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#000000' }}>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => {
              // Prevent drag if user is interacting with an input field
              const activeElement = document.activeElement;
              if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                event.activatorEvent?.preventDefault();
              }
            }}
          >
            <SortableContext
              items={useMemo(() =>
                instructions.map((_, i) => `instruction-${i}`),
                [instructions.length]
              )}
              strategy={verticalListSortingStrategy}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {instructions.map((instruction, i) => (
                  <SortableInstructionItem
                    key={`instruction-${i}`}
                    id={`instruction-${i}`}
                    index={i}
                    instruction={instruction}
                    onUpdate={(value) => updateInstruction(i, value)}
                    onRemove={() => removeInstruction(i)}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>
        )}
      </Paper>
    </Box>
  );
};

export default EditableRecipeDetails;
