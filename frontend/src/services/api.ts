import type { Recipe, RecipeListResponse, CreateRecipeRequest } from '../types/recipe';
import type { Cart } from '../types/cart';

const API_BASE_URL = '/api';

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorInfo = {
        code: 'UNKNOWN_ERROR',
        message: `Request failed with status ${response.status}`,
        details: response.statusText || 'Unknown error occurred',
        fieldErrors: {} as Record<string, string[]>
      };
      
      try {
        const errorData = await response.json();
        
        // Handle new structured error format
        if (errorData.error) {
          errorInfo.code = errorData.error;
          errorInfo.message = errorData.message || errorInfo.message;
          errorInfo.details = errorData.details || errorInfo.details;
          errorInfo.fieldErrors = errorData.field_errors || {};
        } else {
          // Fallback for legacy error format
          errorInfo.message = errorData.message || errorData.error || errorInfo.message;
          errorInfo.details = errorData.details || errorInfo.details;
        }
      } catch {
        // If response is not JSON, use the status text
        errorInfo.details = response.statusText || errorInfo.details;
      }
      
      // Create enhanced error with structured information
      const error = new Error(errorInfo.message) as any;
      error.code = errorInfo.code;
      error.details = errorInfo.details;
      error.fieldErrors = errorInfo.fieldErrors;
      error.status = response.status;
      
      throw error;
    }
    
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  // Recipe endpoints
  async getRecipes(): Promise<RecipeListResponse> {
    const response = await fetch(`${API_BASE_URL}/recipes/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<RecipeListResponse>(response);
  }

  async getRecipe(id: number): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<Recipe>(response);
  }

  async createRecipe(recipeData: CreateRecipeRequest): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(recipeData)
    });
    return this.handleResponse<Recipe>(response);
  }

  async createRecipeFromImage(file: File): Promise<Recipe> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('recipe_source', 'file');
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Intentionally do not set Content-Type so the browser sets proper multipart boundary

    const response = await fetch(`${API_BASE_URL}/recipes/`, {
      method: 'POST',
      headers,
      body: formData
    });
    return this.handleResponse<Recipe>(response);
  }

  async updateRecipe(id: number, recipeData: Partial<Recipe>): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(recipeData)
    });
    return this.handleResponse<{ message: string }>(response);
  }

  async deleteRecipe(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse(response);
  }

  async copyRecipe(id: number): Promise<{ id: number; name: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/copy/`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<{ id: number; name: string; message: string }>(response);
  }

  async searchRecipes(query: string, limit: number = 50, fuzziness: number = 2): Promise<Recipe[]> {
    const response = await fetch(`${API_BASE_URL}/recipes/search/?q=${encodeURIComponent(query)}&limit=${limit}&fuzziness=${fuzziness}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    const searchResult = await this.handleResponse<{ results: Recipe[] }>(response);
    return searchResult.results;
  }

  // Get globally popular recipes from the server
  async getPopularRecipes(limit: number = 6): Promise<Recipe[]> {
    const response = await fetch(`${API_BASE_URL}/recipes/popular/?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ results: Recipe[], total: number }>(response);
    
    // Fetch full recipe details (including nutrients, ingredients, steps) for each recipe
    const fullRecipes = await Promise.all(
      result.results.map(recipe => this.getRecipe(recipe.id))
    );
    
    return fullRecipes;
  }

  // Helper method to get recent recipes (sorted by date_added)
  async getRecentRecipes(): Promise<Recipe[]> {
    const response = await this.getRecipes();
    const recipePromises = response.recipes.map(recipe => this.getRecipe(recipe.id));
    const allRecipes = await Promise.all(recipePromises);
    
    // Sort by date_added (descending - newest first)
    const sortedRecipes = allRecipes.sort((a, b) => {
      const dateA = new Date(a.date_added || 0).getTime();
      const dateB = new Date(b.date_added || 0).getTime();
      return dateB - dateA;
    });
    
    return sortedRecipes.slice(0, 5);
  }

  // Cart endpoints
  async getCart(): Promise<Cart> {
    const response = await fetch(`${API_BASE_URL}/cart/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<Cart>(response);
  }

  async addRecipeToCart(recipeId: number, servingSize: number = 1): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/recipes/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ recipe_id: recipeId, serving_size: servingSize })
    });
    await this.handleResponse(response);
  }

  async updateRecipeServingSize(recipeId: number, servingSize: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/recipes/`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ recipe_id: recipeId, serving_size: servingSize })
    });
    await this.handleResponse(response);
  }

  async removeRecipeFromCart(recipeId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/recipes/`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ recipe_id: recipeId })
    });
    await this.handleResponse(response);
  }

  async updateItemQuantity(itemId: number, quantity: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/items/`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ item_id: itemId, quantity })
    });
    await this.handleResponse(response);
  }

  async removeItemFromCart(itemId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/items/`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ item_id: itemId })
    });
    await this.handleResponse(response);
  }

  async addItemToCart(recipeId: number, ingredientId: number, quantity: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cart/items/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ recipe_id: recipeId, ingredient_id: ingredientId, quantity })
    });
    await this.handleResponse(response);
  }

  async get(url: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return { data: await this.handleResponse(response) };
  }

  async post(url: string, data?: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });
    return { data: await this.handleResponse(response) };
  }

  async getOrderHistory(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/cart/order-history/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<any[]>(response);
  }

  // User profile image endpoints
  async getProfileImageUrl(): Promise<{ url: string | null }>{
    const response = await fetch(`${API_BASE_URL}/users/me/profile-image/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<{ url: string | null }>(response);
  }

  async uploadProfileImage(file: File): Promise<{ url: string }>{
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Intentionally do not set Content-Type so the browser sets proper multipart boundary

    const response = await fetch(`${API_BASE_URL}/users/me/profile-image/`, {
      method: 'PUT',
      headers,
      body: formData
    });
    return this.handleResponse<{ url: string }>(response);
  }

  // Media upload endpoint - upload image only, no recipe creation
  async uploadImage(file: File): Promise<{ image_url: string }> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Intentionally do not set Content-Type so the browser sets proper multipart boundary

    const response = await fetch(`${API_BASE_URL}/media/upload/`, {
      method: 'POST',
      headers,
      body: formData
    });
    return this.handleResponse<{ image_url: string }>(response);
  }
}

export const apiService = new ApiService();
