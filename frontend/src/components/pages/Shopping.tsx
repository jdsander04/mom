import { Typography } from '@mui/material';
import styles from './Shopping.module.css';

const Shopping = () => {
  return (
    <>
      <h1 className={styles.pageTitle}>
        Shopping
      </h1>
      <Typography variant="body1" color="text.secondary">
        Your shopping list
      </Typography>
    </>
  );
};

export default Shopping;