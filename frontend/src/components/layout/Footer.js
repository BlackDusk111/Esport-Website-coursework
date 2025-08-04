import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  IconButton,
  Divider,
} from '@mui/material';
import {
  GitHub,
  Twitter,
  Facebook,
  Email,
} from '@mui/icons-material';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        py: 4,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* About Section */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" color="primary" gutterBottom>
              Esports Tournament Platform
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The ultimate platform for organizing and participating in competitive esports tournaments. 
              Join teams, compete in tournaments, and climb the leaderboards.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                color="primary"
                aria-label="GitHub"
                component="a"
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHub />
              </IconButton>
              <IconButton
                color="primary"
                aria-label="Twitter"
                component="a"
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter />
              </IconButton>
              <IconButton
                color="primary"
                aria-label="Facebook"
                component="a"
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Facebook />
              </IconButton>
              <IconButton
                color="primary"
                aria-label="Email"
                component="a"
                href="mailto:support@esports-tournament.com"
              >
                <Email />
              </IconButton>
            </Box>
          </Grid>

          {/* Quick Links */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Quick Links
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/tournaments" color="text.secondary" underline="hover">
                Tournaments
              </Link>
              <Link href="/teams" color="text.secondary" underline="hover">
                Teams
              </Link>
              <Link href="/matches" color="text.secondary" underline="hover">
                Matches
              </Link>
              <Link href="/leaderboard" color="text.secondary" underline="hover">
                Leaderboard
              </Link>
            </Box>
          </Grid>

          {/* Support */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Support
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/help" color="text.secondary" underline="hover">
                Help Center
              </Link>
              <Link href="/rules" color="text.secondary" underline="hover">
                Tournament Rules
              </Link>
              <Link href="/contact" color="text.secondary" underline="hover">
                Contact Us
              </Link>
              <Link href="/faq" color="text.secondary" underline="hover">
                FAQ
              </Link>
            </Box>
          </Grid>

          {/* Legal */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Legal
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/privacy" color="text.secondary" underline="hover">
                Privacy Policy
              </Link>
              <Link href="/terms" color="text.secondary" underline="hover">
                Terms of Service
              </Link>
              <Link href="/cookies" color="text.secondary" underline="hover">
                Cookie Policy
              </Link>
              <Link href="/dmca" color="text.secondary" underline="hover">
                DMCA
              </Link>
            </Box>
          </Grid>

          {/* Games */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Popular Games
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/games/valorant" color="text.secondary" underline="hover">
                Valorant
              </Link>
              <Link href="/games/csgo" color="text.secondary" underline="hover">
                CS:GO
              </Link>
              <Link href="/games/lol" color="text.secondary" underline="hover">
                League of Legends
              </Link>
              <Link href="/games/dota2" color="text.secondary" underline="hover">
                Dota 2
              </Link>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {currentYear} Esports Tournament Platform. All rights reserved.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Version 1.0.0
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Built with ❤️ for the gaming community
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;