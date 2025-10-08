import styles from './RecipeLibrary.module.css';
import VerticalContainer from '../common/VerticalContainer/VerticalContainer';
import RecipeAccordion from '../common/RecipeAccordion/RecipeAccordion';

const RecipeLibrary = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>
        Recipe Library
      </h1>
      <VerticalContainer>
        <RecipeAccordion title="Pollo Guisado" calories={450} serves={4} added={true} ingredients={['1 lb chicken', '2 cups rice']} instructions={['Cook chicken', 'Prepare rice']} imageUrl="https://example.com/pollo.jpg">
          {/* Breakfast recipe items */}
        </RecipeAccordion>
        <RecipeAccordion title="Pineapple Upside-Down Cake" calories={300} serves={8} added={false} ingredients={['1 can pineapple', '1 box cake mix']} instructions={['Prepare cake mix', 'Add pineapple on top']} imageUrl="https://example.com/cake.jpg">
          {/* Lunch recipe items */}
        </RecipeAccordion>
      </VerticalContainer>
    </div>
  );
};

export default RecipeLibrary;
