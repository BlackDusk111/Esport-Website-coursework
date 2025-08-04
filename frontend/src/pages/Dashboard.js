import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  EmojiEvents,
  Groups,
  SportsMma,
  TrendingUp,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Active Tournaments',
      value: '3',
      icon: <EmojiEvents />,
      color: 'primary',
    },
    {
      title: 'My Teams',
      value: user?.role === 'captain' ? '1' : '2',
      icon: <Groups />,
      color: 'secondary',
    },
    {
      title: 'Matches Played',
      value: '15',
      icon: <SportsMma />,
      color: 'success',
    },
    {
      title: 'Win Rate',
      value: '73%',
      icon: <TrendingUp />,
      color: 'info',
    },
  ];

  const recentMatches = [
    {
      id: 1,
      tournament: 'Valorant Champions Cup',
      opponent: 'Team Alpha',
      result: 'Win',
      score: '13-8',
      date: '2024-01-15',
    },
    {
      id: 2,
      tournament: 'CS:GO Major League',
      opponent: 'Team Beta',
      result: 'Loss',
      score: '14-16',
      date: '2024-01-12',
    },
    {
      id: 3,
      tournament: 'Valorant Champions Cup',
      opponent: 'Team Gamma',
      result: 'Win',
      score: '13-5',
      date: '2024-01-10',
    },
  ];

  const getResultColor = (result) => {
    switch (result) {
      case 'Win':
        return 'success';
      case 'Loss':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Welcome back, {user?.username}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your esports journey.
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {stats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: `${stat.color}.main`,
                        mr: 2,
                      }}
                    >
                      {stat.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h4" component="div">
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.title}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* Recent Matches */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Matches
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {recentMatches.map((match) => (
                    <Box
                      key={match.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1">
                          vs {match.opponent}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {match.tournament}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip
                          label={match.result}
                          color={getResultColor(match.result)}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {match.score}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2 }}
                  href="/matches"
                >
                  View All Matches
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<EmojiEvents />}
                    href="/tournaments"
                  >
                    Browse Tournaments
                  </Button>
                  
                  {user?.role === 'captain' && (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Groups />}
                      href="/teams/create"
                    >
                      Create Team
                    </Button>
                  )}
                  
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Groups />}
                    href="/teams"
                  >
                    Find Teams
                  </Button>
                  
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<SportsMma />}
                    href="/matches"
                  >
                    View Matches
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* User Info */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Profile Info
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Role:</strong> {user?.role}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {user?.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Verified:</strong>{' '}
                    <Chip
                      label={user?.email_verified ? 'Yes' : 'No'}
                      color={user?.email_verified ? 'success' : 'warning'}
                      size="small"
                    />
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2 }}
                  href="/profile"
                >
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard;