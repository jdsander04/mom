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
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        // If response is not JSON, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return response.json();
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

  async updateRecipe(id: number, recipeData: Partial<CreateRecipeRequest>): Promise<{ message: string }> {
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
    if (!response.ok) {
      throw new Error(`Failed to delete recipe: ${response.statusText}`);
    }
  }

  async searchRecipes(query: string, limit: number = 50, fuzziness: number = 2): Promise<Recipe[]> {
    const response = await fetch(`${API_BASE_URL}/recipes/search/?q=${encodeURIComponent(query)}&limit=${limit}&fuzziness=${fuzziness}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    const searchResult = await this.handleResponse<{ results: Recipe[] }>(response);
    return searchResult.results;
  }

  // Helper method to get popular recipes (sorted by times_made)
  async getPopularRecipes(): Promise<Recipe[]> {
    const response = await this.getRecipes();
    const recipePromises = response.recipes.map(recipe => this.getRecipe(recipe.id));
    const allRecipes = await Promise.all(recipePromises);
    
    // Sort by times_made (descending), then by date_added (descending) as tiebreaker
    const sortedRecipes = allRecipes.sort((a, b) => {
      const timesA = a.times_made || 0;
      const timesB = b.times_made || 0;
      
      if (timesA !== timesB) {
        return timesB - timesA; // Higher times_made first
      }
      
      // Tiebreaker: newer recipes first
      const dateA = new Date(a.date_added || 0).getTime();
      const dateB = new Date(b.date_added || 0).getTime();
      return dateB - dateA;
    });
    
    return sortedRecipes.slice(0, 5);
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
}

export const apiService = new ApiService();
