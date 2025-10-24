export interface CartItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface CartRecipe {
  recipe_id: number;
  name: string;
  serving_size: number;
  ingredients: CartItem[];
}

export interface Cart {
  recipes: CartRecipe[];
}