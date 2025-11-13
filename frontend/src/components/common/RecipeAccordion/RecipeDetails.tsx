import React from 'react';
import styles from './RecipeDetails.module.css';

export interface Nutrition {
  calories?: number;
  fat?: number;
  cholesterol?: number;
  sodium?: number;
  carbs?: number;
  protein?: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
}

interface Props {
  imageUrl?: string;
  nutrition?: Nutrition;
  ingredients?: Array<{ name: string; quantity: number; unit: string; original_text?: string }> | string[];
  instructions?: string[];
}

const RecipeDetails = ({ imageUrl, nutrition, ingredients = [], instructions = [] }: Props) => {
  return (
    <div className={styles.details}>
      <div className={styles.left}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="recipe" className={styles.image} />
        ) : (
          <div className={styles.placeholder}>No image</div>
        )}

        {nutrition && (
          <div className={styles.nutrition}>
            <div className={styles.nutritionTitle}>1 serving:</div>
            {nutrition.calories !== undefined && <div>{Math.round(nutrition.calories)} calories</div>}
            {nutrition.fat !== undefined && <div>{Math.round(nutrition.fat)}g fat</div>}
            {nutrition.saturatedFat !== undefined && <div>{Math.round(nutrition.saturatedFat)}g saturated fat</div>}
            {nutrition.unsaturatedFat !== undefined && nutrition.unsaturatedFat > 0 && <div>{Math.round(nutrition.unsaturatedFat)}g unsaturated fat</div>}
            {nutrition.cholesterol !== undefined && <div>{Math.round(nutrition.cholesterol)}mg cholesterol</div>}
            {nutrition.sodium !== undefined && <div>{Math.round(nutrition.sodium)}mg sodium</div>}
            {nutrition.carbs !== undefined && <div>{Math.round(nutrition.carbs)}g carbohydrate</div>}
            {nutrition.fiber !== undefined && <div>{Math.round(nutrition.fiber)}g fiber</div>}
            {nutrition.sugar !== undefined && <div>{Math.round(nutrition.sugar)}g sugar</div>}
            {nutrition.protein !== undefined && <div>{Math.round(nutrition.protein)}g protein</div>}
          </div>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.col}>
          <h4 className={styles.sectionTitle}>Ingredients</h4>
          {ingredients.length === 0 ? (
            <div className={styles.empty}>No ingredients.</div>
          ) : (
            <ul>
              {ingredients.map((ing, i) => (
                <li key={i}>
                  {typeof ing === 'string' ? ing : (ing.original_text || `${ing.quantity} ${ing.unit} ${ing.name}`)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.col}>
          <h4 className={styles.sectionTitle}>Directions</h4>
          {instructions.length === 0 ? (
            <div className={styles.empty}>No directions.</div>
          ) : (
            <ol>
              {instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeDetails;
