import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  Paper,
  useTheme,
} from '@mui/material';
import {
  EmojiEvents,
  Groups,
  SportsMma,
  TrendingUp,
  Security,
  Speed,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <EmojiEvents />,
      title: 'Tournament Management',
      description: 'Create and manage professional esports tournaments with automated bracket generation and match scheduling.',
    },
    {
      icon: <Groups />,
      title: 'Team Formation',
      description: 'Build your dream team, invite players, and manage team rosters with comprehensive member management.',
    },
    {
      icon: <SportsMma />,
      title: 'Match Tracking',
      description: 'Real-time match results, score submission, and comprehensive match history tracking.',
    },
    {
      icon: <Security />,
      title: 'Secure Platform',
      description: 'Enterprise-grade security with audit logging, account protection, and data encryption.',
    },
    {
      icon: <Speed />,
      title: 'High Performance',
      description: 'Lightning-fast platform built for competitive gaming with minimal latency and maximum reliability.',
    },
    {
      icon: <TrendingUp />,
      title: 'Analytics & Stats',
      description: 'Detailed performance analytics, player statistics, and tournament insights.',
    },
  ];

  const upcomingTournaments = [
    {
      id: 1,
      name: 'Valorant Champions Cup',
      game: 'Valorant',
      startDate: '2024-02-15',
      teams: 16,
      prizePool: '$10,000',
      status: 'active',
    },
    {
      id: 2,
      name: 'CS:GO Major League',
      game: 'CS:GO',
      startDate: '2024-02-20',
      teams: 32,
      prizePool: '$25,000',
      status: 'active',
    },
    {
      id: 3,
      name: 'League of Legends World Cup',
      game: 'League of Legends',
      startDate: '2024-03-01',
      teams: 64,
      prizePool: '$50,000',
      status: 'draft',
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
          color: 'white',
          py: 8,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
                The Ultimate Esports Tournament Platform
              </Typography>
              <Typography variant="h5" paragraph color="rgba(255,255,255,0.9)">
                Organize, compete, and dominate in professional esports tournaments. 
                Join thousands of players in the most competitive gaming platform.
              </Typography>
              <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {!isAuthenticated ? (
                  <>
                    <Button
                      component={Link}
                      to="/register"
                      variant="contained"
                      size="large"
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.9)',
                        },
                      }}
                    >
                      Get Started
                    </Button>
                    <Button
                      component={Link}
                      to="/tournaments"
                      variant="outlined"
                      size="large"
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        '&:hover': {
                          borderColor: 'white',
                          bgcolor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      View Tournaments
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      component={Link}
                      to="/dashboard"
                      variant="contained"
                      size="large"
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.9)',
                        },
                      }}
                    >
                      Go to Dashboard
                    </Button>
                    <Button
                      component={Link}
                      to="/tournaments"
                      variant="outlined"
                      size="large"
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        '&:hover': {
                          borderColor: 'white',
                          bgcolor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      Browse Tournaments
                    </Button>
                  </>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 400,
                }}
              >
                <Paper
                  elevation={8}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <Typography variant="h4" align="center" gutterBottom>
                    🏆
                  </Typography>
                  <Typography variant="h6" align="center" color="white">
                    Join the Competition
                  </Typography>
                  <Typography variant="body2" align="center" color="rgba(255,255,255,0.8)">
                    Professional tournaments • Skilled players • Epic prizes
                  </Typography>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg">
        {/* Features Section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h3" align="center" gutterBottom>
            Why Choose Our Platform?
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph>
            Built by gamers, for gamers. Experience the most comprehensive esports tournament platform.
          </Typography>
          
          <Grid container spacing={4} sx={{ mt: 4 }}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        mb: 2,
                        width: 56,
                        height: 56,
                      }}
                    >
                      {feature.icon}
                    </Avatar>
                    <Typography variant="h6" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Upcoming Tournaments Section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h3" align="center" gutterBottom>
            Upcoming Tournaments
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph>
            Join the most exciting esports competitions and compete for amazing prizes.
          </Typography>
          
          <Grid container spacing={4} sx={{ mt: 4 }}>
            {upcomingTournaments.map((tournament) => (
              <Grid item xs={12} md={4} key={tournament.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Chip
                        label={tournament.status}
                        color={getStatusColor(tournament.status)}
                        size="small"
                      />
                      <Typography variant="body2" color="text.secondary">
                        {tournament.game}
                      </Typography>
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {tournament.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Start Date: {new Date(tournament.startDate).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Teams: {tournament.teams} • Prize Pool: {tournament.prizePool}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={Link}
                      to={`/tournaments/${tournament.id}`}
                      size="small"
                      color="primary"
                    >
                      View Details
                    </Button>
                    {tournament.status === 'active' && (
                      <Button size="small" color="secondary">
                        Register Team
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              component={Link}
              to="/tournaments"
              variant="outlined"
              size="large"
            >
              View All Tournaments
            </Button>
          </Box>
        </Box>

        {/* CTA Section */}
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'white',
            mb: 4,
          }}
        >
          <Typography variant="h4" gutterBottom>
            Ready to Compete?
          </Typography>
          <Typography variant="h6" paragraph>
            Join thousands of players in the most competitive esports platform.
          </Typography>
          {!isAuthenticated && (
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              Sign Up Now
            </Button>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Home;