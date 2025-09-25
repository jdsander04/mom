import RecipeCard from '../common/RecipeCard';
import styles from './HomePage.module.css';

const MOCK_RECIPES = {
  popular: Array.from({ length: 5 }, (_, index) => ({
    id: index,
    title: `Popular Recipe ${index + 1}`,
    subtitle: "Trending Recipe Description",
    image: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ffamiliakitchen.com%2Fwp-content%2Fuploads%2F2023%2F03%2FPollo-guisado-Dominican-Belqui-1536x1028.jpg&f=1&nofb=1&ipt=217a0c1b5af0e1b1c94c847690ca19e040431c291a55d51c20f62bbf7f012271",
    calories: Math.floor(Math.random() * 500) + 200,
    servings: Math.floor(Math.random() * 6) + 2
  })),
  recent: Array.from({ length: 5 }, (_, index) => ({
    id: index + 5,
    title: `Recent Recipe ${index + 1}`,
    subtitle: "Recently Added Recipe",
    image: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ffamiliakitchen.com%2Fwp-content%2Fuploads%2F2023%2F03%2FPollo-guisado-Dominican-Belqui-1536x1028.jpg&f=1&nofb=1&ipt=217a0c1b5af0e1b1c94c847690ca19e040431c291a55d51c20f62bbf7f012271",
    calories: Math.floor(Math.random() * 500) + 200,
    servings: Math.floor(Math.random() * 6) + 2
  }))
};

const SECTIONS = [
  { title: "Popular Recipes", recipes: MOCK_RECIPES.popular },
  { title: "Recent Recipes", recipes: MOCK_RECIPES.recent }
];

const HomePage = () => {
  const handleRecipeClick = (title: string) => {
    console.log(`Clicked on ${title}`);
  };

  return (
    <>
      {SECTIONS.map((section, sectionIndex) => [
        <h1 key={`${section.title}-title`} className={styles.pageTitle}>
          {section.title}
        </h1>,
        ...section.recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            title={recipe.title}
            subtitle={recipe.subtitle}
            image={recipe.image}
            calories={recipe.calories}
            servings={recipe.servings}
            onClick={() => handleRecipeClick(recipe.title)}
          />
        ))
      ])}
    </>
  );
};

export default HomePage;
