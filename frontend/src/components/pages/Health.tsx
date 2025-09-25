import { Typography, Box } from '@mui/material';

const PAGE_CONTAINER_STYLES = {
  gridColumn: '1 / -1'
};

const PAGE_TITLE_STYLES = {
  mb: 2
};

const Health = () => {
  return (
    <Box sx={PAGE_CONTAINER_STYLES}>
      <Typography variant="h4" component="h1" sx={PAGE_TITLE_STYLES}>
        Health and Budgeting
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Track your health and budget
      </Typography>
    </Box>
  );
};

export default Health;