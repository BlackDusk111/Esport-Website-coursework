import {
  Add,
  CalendarToday,
  Edit,
  EmojiEvents,
  Groups,
  MoreVert,
  PersonAdd,
  Search,
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
  Fab,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import axios from "axios";
import { useFormik } from "formik";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { toast } from "react-toastify";
import * as yup from "yup";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";

const validationSchema = yup.object({
  name: yup
    .string("Enter tournament name")
    .min(3, "Tournament name should be at least 3 characters")
    .max(200, "Tournament name should not exceed 200 characters")
    .required("Tournament name is required"),
  game: yup
    .string("Enter game name")
    .min(2, "Game name should be at least 2 characters")
    .max(100, "Game name should not exceed 100 characters")
    .required("Game is required"),
  start_date: yup
    .date("Enter valid start date")
    .min(new Date(), "Start date must be in the future")
    .required("Start date is required"),
  end_date: yup
    .date("Enter valid end date")
    .min(yup.ref("start_date"), "End date must be after start date")
    .nullable(),
  max_teams: yup
    .number("Enter maximum teams")
    .min(2, "Minimum 2 teams required")
    .max(256, "Maximum 256 teams allowed")
    .required("Maximum teams is required"),
});

const Tournaments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);

  // Fetch tournaments
  const {
    data: tournamentsData,
    isLoading,
    error,
  } = useQuery(
    ["tournaments", page, search, statusFilter, gameFilter],
    async () => {
      const response = await axios.get("http://localhost:5000/api/tournaments", {
        params: {
          page,
          limit: 12,
          q: search,
          status: statusFilter,
          game: gameFilter,
        },
      });
      return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  // Create tournament mutation
  const createTournamentMutation = useMutation(
    async (tournamentData) => {
      const response = await axios.post(
        "http://localhost:5000/api/tournaments",
        tournamentData
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["tournaments"]);
        toast.success("Tournament created successfully!");
        setCreateDialogOpen(false);
        formik.resetForm();
      },
      onError: (error) => {
        toast.error(
          error.response?.data?.error || "Failed to create tournament"
        );
      },
    }
  );

  // Register team mutation
  const registerTeamMutation = useMutation(
    async ({ tournamentId, teamId }) => {
      const response = await axios.post(
        `http://localhost:5000/api/tournaments/${tournamentId}/register`,
        { team_id: teamId }
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["tournaments"]);
        toast.success("Team registered successfully!");
        handleMenuClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || "Failed to register team");
      },
    }
  );

  // Fetch user's teams for registration
  const { data: userTeams } = useQuery(
    ["user-teams"],
    async () => {
      if (!user) return [];
      const response = await axios.get("http://localhost:5000/api/teams", {
        params: { captain: user.id },
      });
      return response.data.teams || [];
    },
    {
      enabled: !!user,
      staleTime: 60000,
    }
  );

  const formik = useFormik({
    initialValues: {
      name: "",
      game: "",
      start_date: null,
      end_date: null,
      max_teams: 16,
      status: "draft",
    },
    validationSchema: validationSchema,
    onSubmit: (values) => {
      const formattedValues = {
        ...values,
        start_date: values.start_date?.toISOString(),
        end_date: values.end_date?.toISOString(),
      };
      createTournamentMutation.mutate(formattedValues);
    },
  });

  const handleMenuOpen = (event, tournament) => {
    setAnchorEl(event.currentTarget);
    setSelectedTournament(tournament);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTournament(null);
  };

  const handleRegisterTeam = (teamId) => {
    if (selectedTournament) {
      registerTeamMutation.mutate({
        tournamentId: selectedTournament.id,
        teamId: teamId,
      });
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

  const canCreateTournament = user?.role === "admin";
  const canRegisterTeam =
    user && (user.role === "captain" || user.role === "admin");

  if (isLoading) return <LoadingSpinner message="Loading tournaments..." />;

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load tournaments. Please try again later.
        </Alert>
      </Container>
    );
  }

  const tournaments = tournamentsData?.tournaments || [];
  const pagination = tournamentsData?.pagination || {};

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h4" gutterBottom>
              Tournaments
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Compete in professional esports tournaments and climb the
              leaderboards.
            </Typography>
          </Box>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            mb: 4,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TextField
            placeholder="Search tournaments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Game</InputLabel>
            <Select
              value={gameFilter}
              label="Game"
              onChange={(e) => setGameFilter(e.target.value)}
            >
              <MenuItem value="">All Games</MenuItem>
              <MenuItem value="Valorant">Valorant</MenuItem>
              <MenuItem value="CS:GO">CS:GO</MenuItem>
              <MenuItem value="League of Legends">League of Legends</MenuItem>
              <MenuItem value="Dota 2">Dota 2</MenuItem>
              <MenuItem value="Overwatch">Overwatch</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Tournaments Grid */}
        {tournaments.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <EmojiEvents
              sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tournaments found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {search || statusFilter || gameFilter
                ? "Try adjusting your filters."
                : "Check back later for new tournaments!"}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {tournaments.map((tournament) => (
              <Grid item xs={12} sm={6} md={4} key={tournament.id}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 2,
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: "primary.main",
                          width: 48,
                          height: 48,
                        }}
                      >
                        <EmojiEvents />
                      </Avatar>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Chip
                          label={tournament.status}
                          color={getStatusColor(tournament.status)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, tournament)}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h6" gutterBottom noWrap>
                      {tournament.name}
                    </Typography>

                    <Typography variant="body2" color="primary" gutterBottom>
                      {tournament.game}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <CalendarToday sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        {new Date(tournament.start_date).toLocaleDateString()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Groups sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        {tournament.registered_teams || 0}/
                        {tournament.max_teams} teams
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      By: {tournament.created_by_username}
                    </Typography>
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      href={`/tournaments/${tournament.id}`}
                    >
                      View Details
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <Pagination
              count={pagination.totalPages}
              page={page}
              onChange={(event, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}

        {/* Tournament Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() =>
              (window.location.href = `/tournaments/${selectedTournament?.id}`)
            }
          >
            View Details
          </MenuItem>
          {canRegisterTeam &&
            selectedTournament?.status === "active" &&
            userTeams?.length > 0 &&
            userTeams.map((team) => (
              <MenuItem
                key={team.id}
                onClick={() => handleRegisterTeam(team.id)}
              >
                <PersonAdd sx={{ mr: 1 }} />
                Register {team.name}
              </MenuItem>
            ))}
          {user?.role === "admin" && (
            <MenuItem
              onClick={() =>
                (window.location.href = `/tournaments/${selectedTournament?.id}/edit`)
              }
            >
              <Edit sx={{ mr: 1 }} />
              Edit Tournament
            </MenuItem>
          )}
        </Menu>

        {/* Create Tournament FAB */}
        {canCreateTournament && (
          <Fab
            color="primary"
            aria-label="create tournament"
            sx={{ position: "fixed", bottom: 16, right: 16 }}
            onClick={() => setCreateDialogOpen(true)}
          >
            <Add />
          </Fab>
        )}

        {/* Create Tournament Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Create New Tournament</DialogTitle>
          <form onSubmit={formik.handleSubmit}>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="name"
                    label="Tournament Name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.name && Boolean(formik.errors.name)}
                    helperText={formik.touched.name && formik.errors.name}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Game</InputLabel>
                    <Select
                      name="game"
                      value={formik.values.game}
                      label="Game"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.game && Boolean(formik.errors.game)}
                    >
                      <MenuItem value="Valorant">Valorant</MenuItem>
                      <MenuItem value="CS:GO">CS:GO</MenuItem>
                      <MenuItem value="League of Legends">
                        League of Legends
                      </MenuItem>
                      <MenuItem value="Dota 2">Dota 2</MenuItem>
                      <MenuItem value="Overwatch">Overwatch</MenuItem>
                      <MenuItem value="Rocket League">Rocket League</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="max_teams"
                    label="Maximum Teams"
                    type="number"
                    value={formik.values.max_teams}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={
                      formik.touched.max_teams &&
                      Boolean(formik.errors.max_teams)
                    }
                    helperText={
                      formik.touched.max_teams && formik.errors.max_teams
                    }
                    inputProps={{ min: 2, max: 256 }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="start_date"
                    label="Start Date"
                    type="datetime-local"
                    value={
                      formik.values.start_date
                        ? new Date(formik.values.start_date)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      formik.setFieldValue("start_date", date);
                    }}
                    onBlur={formik.handleBlur}
                    error={
                      formik.touched.start_date &&
                      Boolean(formik.errors.start_date)
                    }
                    helperText={
                      formik.touched.start_date && formik.errors.start_date
                    }
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    name="end_date"
                    label="End Date (Optional)"
                    type="datetime-local"
                    value={
                      formik.values.end_date
                        ? new Date(formik.values.end_date)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : null;
                      formik.setFieldValue("end_date", date);
                    }}
                    onBlur={formik.handleBlur}
                    error={
                      formik.touched.end_date && Boolean(formik.errors.end_date)
                    }
                    helperText={
                      formik.touched.end_date && formik.errors.end_date
                    }
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createTournamentMutation.isLoading}
              >
                {createTournamentMutation.isLoading
                  ? "Creating..."
                  : "Create Tournament"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Tournaments;
