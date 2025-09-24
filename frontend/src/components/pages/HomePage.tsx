import RecipeCard from '../common/RecipeCard';
import styles from './HomePage.module.css';

const HomePage = () => {
  // Query stuff here
  return (
    <>
      <h1 className={styles.pageTitle}>Popular Recipes</h1>
      {Array.from({ length: 5 }).map((_, index) => (
        <RecipeCard
          key={index}
          title={`Recipe ${index + 1}`}
          subtitle="Sample Recipe Description"
          image="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          calories={Math.floor(Math.random() * 1000)}
          servings={Math.floor(Math.random() * 10) + 1}
          onClick={() => console.log(`Clicked on Recipe ${index + 1}`)}
        />
      ))}
      <h1 className={styles.pageTitle}>Recent Recipes</h1>
      {Array.from({ length: 5 }).map((_, index) => (
        <RecipeCard
          key={index}
          title={`Recipe ${index + 1}`}
          subtitle="Sample Recipe Description"
          image="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          calories={Math.floor(Math.random() * 1000)}
          servings={Math.floor(Math.random() * 10) + 1}
          onClick={() => console.log(`Clicked on Recipe ${index + 1}`)}
        />
      ))}
    </>
  );
};

export default HomePage;
