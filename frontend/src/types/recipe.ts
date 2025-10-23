export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Step {
  description: string;
  order: number;
}

export interface Nutrient {
  macro: string;
  mass: number;
}

export interface Recipe {
  id: number;
  name: string;
  description: string;
  image_url?: string;
  source_url?: string;
  ingredients: Ingredient[];
  steps: Step[];
  nutrients: Nutrient[];
  date_added?: string; // ISO date string
  times_made?: number; // Number of times this recipe has been made
}

export interface RecipeSummary {
  id: number;
  name: string;
}

export interface RecipeListResponse {
  recipes: RecipeSummary[];
}

export interface CreateRecipeRequest {
  recipe_source: 'url' | 'explicit' | 'file';
  url?: string;
  name?: string;
  description?: string;
  ingredients?: Ingredient[];
  steps?: Array<{ description: string }>;
  file?: File;
}
