import React from 'react';
import styles from './RecipeDetails.module.css';

export interface Nutrition {
  calories?: number;
  fat?: string;
  cholesterol?: string;
  sodium?: string;
  carbs?: string;
  protein?: string;
}

interface Props {
  imageUrl?: string;
  nutrition?: Nutrition;
  ingredients?: string[];
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
            {nutrition.calories !== undefined && <div>{nutrition.calories} calories</div>}
            {nutrition.fat && <div>{nutrition.fat} fat</div>}
            {nutrition.cholesterol && <div>{nutrition.cholesterol} cholesterol</div>}
            {nutrition.sodium && <div>{nutrition.sodium} sodium</div>}
            {nutrition.carbs && <div>{nutrition.carbs} carbohydrate</div>}
            {nutrition.protein && <div>{nutrition.protein} protein</div>}
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
                <li key={i}>{ing}</li>
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
