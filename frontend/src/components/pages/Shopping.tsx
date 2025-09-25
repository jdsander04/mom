import { Typography, Box } from '@mui/material';

const PAGE_CONTAINER_STYLES = {
  gridColumn: '1 / -1'
};

const PAGE_TITLE_STYLES = {
  mb: 2
};

const Shopping = () => {
  return (
    <Box sx={PAGE_CONTAINER_STYLES}>
      <Typography variant="h4" component="h1" sx={PAGE_TITLE_STYLES}>
        Shopping
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Your shopping list
      </Typography>
    </Box>
  );
};

export default Shopping;