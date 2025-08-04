import {
  AccessTime,
  CheckCircle,
  Edit,
  EmojiEvents,
  Groups,
  Schedule,
  SportsMma,
  Visibility,
  Warning,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";

const Matches = () => {
  const { user, isAuthenticated } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [scoreDialog, setScoreDialog] = useState({ open: false, match: null });
  const [scoreForm, setScoreForm] = useState({ score1: "", score2: "" });
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTournament, setFilterTournament] = useState("all");
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    fetchMatches();
    fetchTournaments();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/matches", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }

      const data = await response.json();
      // Handle the new API response format with pagination
      if (data.matches && Array.isArray(data.matches)) {
        setMatches(data.matches);
      } else if (Array.isArray(data)) {
        // Fallback for old API format
        setMatches(data);
      } else {
        setMatches([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/tournaments");
      if (response.ok) {
        const data = await response.json();
        // Handle the new API response format with pagination
        if (data.tournaments && Array.isArray(data.tournaments)) {
          setTournaments(data.tournaments);
        } else if (Array.isArray(data)) {
          // Fallback for old API format
          setTournaments(data);
        } else {
          setTournaments([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleScoreSubmit = async () => {
    if (!scoreForm.score1 || !scoreForm.score2) {
      setError("Please enter scores for both teams");
      return;
    }

    if (isNaN(scoreForm.score1) || isNaN(scoreForm.score2)) {
      setError("Scores must be valid numbers");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `http://localhost:5000/api/matches/${scoreDialog.match.id}/score`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            score1: parseInt(scoreForm.score1),
            score2: parseInt(scoreForm.score2),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit score");
      }

      setSuccess("Score submitted successfully! Awaiting admin verification.");
      setScoreDialog({ open: false, match: null });
      setScoreForm({ score1: "", score2: "" });
      fetchMatches(); // Refresh matches
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openScoreDialog = (match) => {
    setScoreDialog({ open: true, match });
    setScoreForm({
      score1: match.score1 || "",
      score2: match.score2 || "",
    });
  };

  const closeScoreDialog = () => {
    setScoreDialog({ open: false, match: null });
    setScoreForm({ score1: "", score2: "" });
    setError("");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "primary";
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
      case "disputed":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "scheduled":
        return <Schedule />;
      case "in_progress":
        return <AccessTime />;
      case "completed":
        return <CheckCircle />;
      case "disputed":
        return <Warning />;
      default:
        return <SportsMma />;
    }
  };

  const canSubmitScore = (match) => {
    if (!isAuthenticated || !user) return false;

    // Only team captains can submit scores
    if (user.role !== "captain") return false;

    // Can only submit for matches involving their team
    const isInvolved =
      match.team1_captain_id === user.id || match.team2_captain_id === user.id;

    // Can only submit for scheduled or in-progress matches
    const canSubmit = ["scheduled", "in_progress"].includes(match.status);

    return isInvolved && canSubmit;
  };

  const canViewScore = (match) => {
    return match.status === "completed" || match.status === "disputed";
  };

  const filteredMatches = (matches || []).filter((match) => {
    if (filterStatus !== "all" && match.status !== filterStatus) return false;
    if (
      filterTournament !== "all" &&
      match.tournament_id !== parseInt(filterTournament)
    )
      return false;

    if (tabValue === 1 && isAuthenticated && user) {
      // My Matches tab - show matches involving user's team
      return (
        match.team1_captain_id === user.id || match.team2_captain_id === user.id
      );
    }

    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h3" component="h1" gutterBottom>
            <SportsMma
              sx={{ fontSize: "inherit", mr: 2, verticalAlign: "middle" }}
            />
            Matches
          </Typography>
          <Typography variant="h6" color="text.secondary">
            View match schedules and submit scores
          </Typography>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            onClose={() => setSuccess("")}
          >
            {success}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="All Matches" />
            {isAuthenticated && <Tab label="My Matches" />}
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="disputed">Disputed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tournament</InputLabel>
            <Select
              value={filterTournament}
              label="Tournament"
              onChange={(e) => setFilterTournament(e.target.value)}
            >
              <MenuItem value="all">All Tournaments</MenuItem>
              {tournaments.map((tournament) => (
                <MenuItem key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Matches Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tournament</TableCell>
                <TableCell>Teams</TableCell>
                <TableCell>Scheduled Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Score</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No matches found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((match) => (
                  <TableRow key={match.id} hover>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <EmojiEvents color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                          {match.tournament_name}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Groups color="action" />
                        <Typography variant="body2">
                          {match.team1_name} vs {match.team2_name}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {new Date(match.scheduled_time).toLocaleString()}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        icon={getStatusIcon(match.status)}
                        label={match.status.replace("_", " ").toUpperCase()}
                        color={getStatusColor(match.status)}
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      {canViewScore(match) ? (
                        <Typography variant="body2" fontWeight="medium">
                          {match.score1} - {match.score2}
                        </Typography>
                      ) : match.score1 !== null && match.score2 !== null ? (
                        <Chip
                          label="Pending Verification"
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not played
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        {canSubmitScore(match) && (
                          <Tooltip title="Submit Score">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openScoreDialog(match)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => {
                              // Navigate to match details (could be implemented later)
                              console.log("View match details:", match.id);
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Score Submission Dialog */}
        <Dialog
          open={scoreDialog.open}
          onClose={closeScoreDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Submit Match Score</DialogTitle>
          <DialogContent>
            {scoreDialog.match && (
              <Box sx={{ pt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {scoreDialog.match.team1_name} vs{" "}
                  {scoreDialog.match.team2_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {scoreDialog.match.tournament_name}
                </Typography>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label={scoreDialog.match.team1_name + " Score"}
                      type="number"
                      value={scoreForm.score1}
                      onChange={(e) =>
                        setScoreForm({ ...scoreForm, score1: e.target.value })
                      }
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label={scoreDialog.match.team2_name + " Score"}
                      type="number"
                      value={scoreForm.score2}
                      onChange={(e) =>
                        setScoreForm({ ...scoreForm, score2: e.target.value })
                      }
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                </Grid>

                <Alert severity="info" sx={{ mt: 2 }}>
                  Submitted scores will be pending admin verification before
                  being finalized.
                </Alert>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeScoreDialog}>Cancel</Button>
            <Button
              onClick={handleScoreSubmit}
              variant="contained"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Score"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Matches;
