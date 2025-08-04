import {
  Add,
  Edit,
  Groups,
  MoreVert,
  Person,
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
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Pagination,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useFormik } from "formik";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { toast } from "react-toastify";
import * as yup from "yup";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";

const validationSchema = yup.object({
  name: yup
    .string("Enter team name")
    .min(2, "Team name should be at least 2 characters")
    .max(100, "Team name should not exceed 100 characters")
    .matches(
      /^[a-zA-Z0-9\s_-]+$/,
      "Team name can only contain letters, numbers, spaces, underscores, and hyphens"
    )
    .required("Team name is required"),
});

const Teams = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTeam, setMenuTeam] = useState(null);

  // Fetch teams
  const {
    data: teamsData,
    isLoading,
    error,
  } = useQuery(
    ["teams", page, search],
    async () => {
      const response = await axios.get("http://localhost:5000/api/teams", {
        params: { page, limit: 12, q: search },
      });
      return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  // Create team mutation
  const createTeamMutation = useMutation(
    async (teamData) => {
      const response = await axios.post(
        "http://localhost:5000/api/teams",
        teamData
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["teams"]);
        toast.success("Team created successfully!");
        setCreateDialogOpen(false);
        createFormik.resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || "Failed to create team");
      },
    }
  );

  // Update team mutation
  const updateTeamMutation = useMutation(
    async ({ id, ...teamData }) => {
      const response = await axios.put(
        `http://localhost:5000/api/teams/${id}`,
        teamData
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["teams"]);
        toast.success("Team updated successfully!");
        setEditDialogOpen(false);
        editFormik.resetForm();
        setSelectedTeam(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || "Failed to update team");
      },
    }
  );

  // Join team mutation
  const joinTeamMutation = useMutation(
    async (teamId) => {
      const response = await axios.post(
        `http://localhost:5000/api/teams/${teamId}/join`
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["teams"]);
        toast.success("Join request sent successfully!");
      },
      onError: (error) => {
        toast.error(
          error.response?.data?.error || "Failed to send join request"
        );
      },
    }
  );

  // Create team form
  const createFormik = useFormik({
    initialValues: {
      name: "",
    },
    validationSchema: validationSchema,
    onSubmit: (values) => {
      createTeamMutation.mutate(values);
    },
  });

  // Edit team form
  const editFormik = useFormik({
    initialValues: {
      name: selectedTeam?.name || "",
    },
    validationSchema: validationSchema,
    enableReinitialize: true,
    onSubmit: (values) => {
      updateTeamMutation.mutate({ id: selectedTeam.id, ...values });
    },
  });

  const handleMenuOpen = (event, team) => {
    setAnchorEl(event.currentTarget);
    setMenuTeam(team);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTeam(null);
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleJoinTeam = (teamId) => {
    joinTeamMutation.mutate(teamId);
    handleMenuClose();
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const canCreateTeam = user?.role === "captain" || user?.role === "admin";
  const canEditTeam = (team) => {
    return (
      user?.role === "admin" ||
      (user?.role === "captain" && team.captain_id === user.id)
    );
  };

  if (isLoading) return <LoadingSpinner message="Loading teams..." />;

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load teams. Please try again later.
        </Alert>
      </Container>
    );
  }

  const teams = teamsData?.teams || [];
  const pagination = teamsData?.pagination || {};

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
              Teams
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Browse and join esports teams or create your own.
            </Typography>
          </Box>
          {canCreateTeam && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Team
            </Button>
          )}
        </Box>

        {/* Search */}
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Search teams..."
            value={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 400 }}
          />
        </Box>

        {/* Teams Grid */}
        {teams.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Groups sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No teams found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {search
                ? "Try adjusting your search terms."
                : "Be the first to create a team!"}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {teams.map((team) => (
              <Grid item xs={12} sm={6} md={4} key={team.id}>
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
                        <Groups />
                      </Avatar>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, team)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>

                    <Typography variant="h6" gutterBottom noWrap>
                      {team.name}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Person sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        Captain: {team.captain_username}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Groups sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        {team.member_count} member
                        {team.member_count !== 1 ? "s" : ""}
                      </Typography>
                    </Box>

                    <Chip
                      label={team.is_active ? "Active" : "Inactive"}
                      color={team.is_active ? "success" : "default"}
                      size="small"
                    />
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      href={`/teams/${team.id}`}
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

        {/* Team Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => (window.location.href = `/teams/${menuTeam?.id}`)}
          >
            View Details
          </MenuItem>
          {user && menuTeam && !canEditTeam(menuTeam) && (
            <MenuItem onClick={() => handleJoinTeam(menuTeam.id)}>
              <PersonAdd sx={{ mr: 1 }} />
              Request to Join
            </MenuItem>
          )}
          {menuTeam && canEditTeam(menuTeam) && (
            <MenuItem onClick={() => handleEditTeam(menuTeam)}>
              <Edit sx={{ mr: 1 }} />
              Edit Team
            </MenuItem>
          )}
        </Menu>

        {/* Create Team Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Team</DialogTitle>
          <form onSubmit={createFormik.handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                name="name"
                label="Team Name"
                type="text"
                fullWidth
                variant="outlined"
                value={createFormik.values.name}
                onChange={createFormik.handleChange}
                onBlur={createFormik.handleBlur}
                error={
                  createFormik.touched.name && Boolean(createFormik.errors.name)
                }
                helperText={
                  createFormik.touched.name && createFormik.errors.name
                }
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createTeamMutation.isLoading}
              >
                {createTeamMutation.isLoading ? "Creating..." : "Create Team"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Edit Team Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit Team</DialogTitle>
          <form onSubmit={editFormik.handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                name="name"
                label="Team Name"
                type="text"
                fullWidth
                variant="outlined"
                value={editFormik.values.name}
                onChange={editFormik.handleChange}
                onBlur={editFormik.handleBlur}
                error={
                  editFormik.touched.name && Boolean(editFormik.errors.name)
                }
                helperText={editFormik.touched.name && editFormik.errors.name}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={updateTeamMutation.isLoading}
              >
                {updateTeamMutation.isLoading ? "Updating..." : "Update Team"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Teams;
