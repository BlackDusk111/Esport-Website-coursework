import {
  CalendarToday,
  Edit,
  EmojiEvents,
  Groups,
  Person,
  PersonAdd,
  Schedule,
  SportsMma,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";

const TournamentDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");

  // Fetch tournament details
  const {
    data: tournament,
    isLoading,
    error,
  } = useQuery(
    ["tournament", id],
    async () => {
      const response = await axios.get(
        `http://localhost:5000/api/tournaments/${id}`
      );
      return response.data.tournament;
    },
    {
      staleTime: 30000,
    }
  );

  // Fetch user's teams for registration
  const { data: userTeams } = useQuery(
    ["user-teams"],
    async () => {
      if (!user || user.role !== "captain") return [];
      const response = await axios.get("http://localhost:5000/api/teams", {
        params: { captain: user.id },
      });
      return response.data.teams || [];
    },
    {
      enabled: !!user && user.role === "captain",
      staleTime: 60000,
    }
  );

  // Register team mutation
  const registerTeamMutation = useMutation(
    async (teamId) => {
      const response = await axios.post(
        `http://localhost:5000/api/tournaments/${id}/register`,
        { team_id: teamId }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["tournament", id]);
        toast.success("Team registered successfully!");
        setRegisterDialogOpen(false);
        setSelectedTeam("");
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || "Failed to register team");
      },
    }
  );

  const handleRegisterTeam = () => {
    if (selectedTeam) {
      registerTeamMutation.mutate(selectedTeam);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "warning";
      case "completed":
        return "info";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getMatchStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "warning";
      case "scheduled":
        return "info";
      case "disputed":
        return "error";
      default:
        return "default";
    }
  };

  const canRegister =
    user?.role === "captain" &&
    tournament?.status === "active" &&
    userTeams?.length > 0;
  const isAdmin = user?.role === "admin";
  const isCreator = user && tournament && tournament.created_by_id === user.id;

  if (isLoading)
    return <LoadingSpinner message="Loading tournament details..." />;

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load tournament details. Please try again later.
        </Alert>
      </Container>
    );
  }

  if (!tournament) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Tournament not found.
        </Alert>
      </Container>
    );
  }

  const matches = tournament.matches || [];
  const registeredTeams = tournament.registered_teams || [];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Tournament Header */}
        <Paper
          sx={{
            p: 4,
            mb: 4,
            background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
            color: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <Avatar
              sx={{
                bgcolor: "rgba(255,255,255,0.2)",
                width: 80,
                height: 80,
                mr: 3,
              }}
            >
              <EmojiEvents sx={{ fontSize: 40 }} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h3" gutterBottom>
                {tournament.name}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label={tournament.status}
                  color={getStatusColor(tournament.status)}
                  sx={{
                    bgcolor:
                      getStatusColor(tournament.status) === "success"
                        ? "success.main"
                        : getStatusColor(tournament.status) === "warning"
                        ? "warning.main"
                        : getStatusColor(tournament.status) === "info"
                        ? "info.main"
                        : "error.main",
                  }}
                />
                <Typography variant="h6">{tournament.game}</Typography>
                <Typography variant="body1">
                  {registeredTeams.length}/{tournament.max_teams} teams
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              {canRegister && (
                <Button
                  variant="contained"
                  startIcon={<PersonAdd />}
                  onClick={() => setRegisterDialogOpen(true)}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  Register Team
                </Button>
              )}
              {(isAdmin || isCreator) && (
                <Button
                  variant="contained"
                  startIcon={<Edit />}
                  href={`/tournaments/${id}/edit`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  Edit Tournament
                </Button>
              )}
            </Box>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center" }}>
                <CalendarToday sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Start Date
                </Typography>
                <Typography variant="h6">
                  {new Date(tournament.start_date).toLocaleDateString()}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center" }}>
                <Groups sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Teams
                </Typography>
                <Typography variant="h6">
                  {registeredTeams.length}/{tournament.max_teams}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center" }}>
                <SportsMma sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Matches
                </Typography>
                <Typography variant="h6">{matches.length}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center" }}>
                <Person sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Organizer
                </Typography>
                <Typography variant="h6">
                  {tournament.created_by_username}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
          >
            <Tab label="Overview" />
            <Tab label="Teams" />
            <Tab label="Matches" />
            <Tab label="Bracket" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {activeTab === 0 && (
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tournament Information
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Game:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {tournament.game}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Status:
                      </Typography>
                      <Chip
                        label={tournament.status}
                        color={getStatusColor(tournament.status)}
                        size="small"
                      />
                    </Box>
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Start Date:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {new Date(tournament.start_date).toLocaleString()}
                      </Typography>
                    </Box>
                    {tournament.end_date && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          End Date:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {new Date(tournament.end_date).toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Maximum Teams:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {tournament.max_teams}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Registered Teams:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {registeredTeams.length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Activity
                  </Typography>
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Schedule
                      sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      No recent activity
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Registered Teams ({registeredTeams.length})
              </Typography>

              {registeredTeams.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Groups
                    sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                  />
                  <Typography variant="body1" color="text.secondary">
                    No teams registered yet
                  </Typography>
                </Box>
              ) : (
                <List>
                  {registeredTeams.map((team, index) => (
                    <ListItem
                      key={team.id}
                      divider={index < registeredTeams.length - 1}
                    >
                      <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                        <Groups />
                      </Avatar>
                      <ListItemText
                        primary={team.name}
                        secondary={`Registered ${new Date(
                          team.created_at
                        ).toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Matches ({matches.length})
              </Typography>

              {matches.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <SportsMma
                    sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                  />
                  <Typography variant="body1" color="text.secondary">
                    No matches scheduled yet
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Team 1</TableCell>
                        <TableCell>Team 2</TableCell>
                        <TableCell>Scheduled Time</TableCell>
                        <TableCell>Score</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell>{match.team1_name}</TableCell>
                          <TableCell>{match.team2_name}</TableCell>
                          <TableCell>
                            {new Date(match.scheduled_time).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {match.status === "completed"
                              ? `${match.score1} - ${match.score2}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={match.status}
                              color={getMatchStatusColor(match.status)}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tournament Bracket
              </Typography>
              <Box sx={{ textAlign: "center", py: 8 }}>
                <EmojiEvents
                  sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
                />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Bracket Coming Soon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tournament bracket will be generated once all teams are
                  registered.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Register Team Dialog */}
        <Dialog
          open={registerDialogOpen}
          onClose={() => setRegisterDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Register Team for Tournament</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Select Team</InputLabel>
              <Select
                value={selectedTeam}
                label="Select Team"
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                {userTeams?.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegisterDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRegisterTeam}
              variant="contained"
              disabled={!selectedTeam || registerTeamMutation.isLoading}
            >
              {registerTeamMutation.isLoading
                ? "Registering..."
                : "Register Team"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default TournamentDetail;
