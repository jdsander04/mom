import { Typography } from '@mui/material';
import styles from './Health.module.css';

const Health = () => {
  return (
    <>
      <h1 className={styles.pageTitle}>
        Health and Budgeting
      </h1>
      <Typography variant="body1" color="text.secondary">
        Track your health and budget
      </Typography>
    </>
  );
};

export default Health;