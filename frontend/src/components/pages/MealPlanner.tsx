import { Typography } from '@mui/material';
import styles from './MealPlanner.module.css';

const MealPlanner = () => {
  return (
    <>
      <h1 className={styles.pageTitle}>
        Meal Planner
      </h1>
      <Typography variant="body1" color="text.secondary">
        Plan your meals here
      </Typography>
    </>
  );
};

export default MealPlanner;