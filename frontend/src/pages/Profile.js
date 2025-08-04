import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Profile = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account settings and profile information.
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          This page will show user profile editing, password change, and account settings.
        </Typography>
      </Box>
    </Container>
  );
};

export default Profile;