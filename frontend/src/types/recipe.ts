export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  original_text?: string;
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
  serves?: number; // Number of servings
  ingredients: Ingredient[];
  steps: Step[];
  nutrients: Nutrient[];
  date_added?: string; // ISO date string
  times_made?: number; // Number of times this recipe has been made
  favorite?: boolean;
  user_id?: number; // ID of the user who owns this recipe
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
  serves?: number;
  ingredients?: Ingredient[];
  steps?: Array<{ description: string }>;
  file?: File;
}

// Cart-related types
export interface CartItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
}

export interface CartRecipe {
  recipe_id: number;
  recipe_name: string;
  quantity: number;
}

export interface Cart {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  items: CartItem[];
  recipes: CartRecipe[];
}

export interface CartListResponse {
  carts: Cart[];
}

export interface CartResponse {
  cart_id: number;
}
