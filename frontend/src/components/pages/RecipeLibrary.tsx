import styles from './RecipeLibrary.module.css';
import VerticalContainer from '../common/VerticalContainer/VerticalContainer';
import RecipeAccordion from '../common/RecipeAccordion/RecipeAccordion';
import RecipeDetails from '../common/RecipeAccordion/RecipeDetails';

const RecipeLibrary = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>
        Recipe Library
      </h1>
      <VerticalContainer>
        <RecipeAccordion title="Pollo Guisado" calories={450} serves={4} added={true} quantity={1} ingredients={['1 lb chicken', '2 cups rice']} instructions={['Cook chicken', 'Prepare rice']} imageUrl="https://example.com/pollo.jpg">
          <RecipeDetails
            imageUrl="https://example.com/pollo.jpg"
            ingredients={['1 lb chicken', '2 cups rice']}
            instructions={['Cook chicken', 'Prepare rice']}
            nutrition={{ calories: 331 }}
          />
        </RecipeAccordion>
        <RecipeAccordion title="Pineapple Upside-Down Cake" calories={300} serves={8} added={false} quantity={1} ingredients={['1 can pineapple', '1 box cake mix']} instructions={['Prepare cake mix', 'Add pineapple on top']} imageUrl="https://www.recipetineats.com/tachyon/2021/03/Pineapple-Upside-Down-Cake-2_8.jpg?resize=900%2C1260&zoom=1">
          <RecipeDetails
            imageUrl="https://www.recipetineats.com/tachyon/2021/03/Pineapple-Upside-Down-Cake-2_8.jpg?resize=900%2C1260&zoom=1"
            ingredients={['1 can pineapple', '1 box cake mix']}
            instructions={['Prepare cake mix', 'Add pineapple on top']}
            nutrition={{ calories: 361, fat: '13g', cholesterol: '88mg', sodium: '193mg', carbs: '58g', protein: '4g' }}
          />
        </RecipeAccordion>
      </VerticalContainer>
    </div>
  );
};

export default RecipeLibrary;
