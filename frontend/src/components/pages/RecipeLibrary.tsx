import { Typography } from '@mui/material';

const PAGE_TITLE_STYLES = {
  gridColumn: '1 / -1',
  mb: 2
};

const RecipeLibrary = () => {
  return (
    <Typography 
      variant="h4" 
      component="h1" 
      sx={PAGE_TITLE_STYLES}
    >
      Recipe Library
    </Typography>
  );
};

export default RecipeLibrary;