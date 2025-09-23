import { ExternalLink } from 'lucide-react';
import styles from './RecipeCard.module.css';

interface RecipeCardProps {
  title: string;
  subtitle?: string;
  image: string;
  calories: number;
  servings: number;
  onClick: () => void;
}

const RecipeCard = ({ title, subtitle, image, calories, servings, onClick }: RecipeCardProps) => {
  return (
    <div className={styles.recipeCard}>
      <img src={"https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ffamiliakitchen.com%2Fwp-content%2Fuploads%2F2023%2F03%2FPollo-guisado-Dominican-Belqui-1536x1028.jpg&f=1&nofb=1&ipt=217a0c1b5af0e1b1c94c847690ca19e040431c291a55d51c20f62bbf7f012271"} alt={title} className={styles.recipeImage} />
      <div className={styles.recipeContent}>
        <div className={styles.titleSection}>
          <span className={styles.title}>{title}</span>
          {subtitle && <span className={styles.subtitle}>({subtitle})</span>}
        </div>
        <div className={styles.metadata}>
          <span>{calories} kcal</span>
          <span>Serves {servings}</span>
        </div>
      </div>
      <button className={styles.actionIcon} onClick={onClick}>
        <ExternalLink size={16} />
      </button>
    </div>
  );
};

export default RecipeCard;
