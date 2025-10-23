import type { Recipe, RecipeListResponse, CreateRecipeRequest } from '../types/recipe';

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
}

export const apiService = new ApiService();
