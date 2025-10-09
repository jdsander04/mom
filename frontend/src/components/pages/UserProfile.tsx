import React from 'react';
import {
  Box,
  Typography
} from '@mui/material';

const UserProfile = () => {
  return (
    <Box sx={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>
    </Box>
  );
};

export default UserProfile;