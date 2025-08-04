import {
  EmojiEvents,
  Gamepad,
  Groups,
  Person,
  SportsMma,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
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
import { useQuery } from "react-query";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [gameFilter, setGameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Fetch leaderboard stats
  const { data: stats, isLoading: statsLoading } = useQuery(
    ["leaderboard-stats"],
    async () => {
      const response = await axios.get(
        "http://localhost:5000/api/leaderboard/stats"
      );
      return response.data;
    },
    {
      staleTime: 60000,
    }
  );

  // Fetch team leaderboard
  const { data: teamData, isLoading: teamsLoading } = useQuery(
    ["team-leaderboard", page, gameFilter],
    async () => {
      const response = await axios.get(
        "http://localhost:5000/api/leaderboard/teams",
        {
          params: { page, limit: 20, game: gameFilter },
        }
      );
      return response.data;
    },
    {
      enabled: activeTab === 0,
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  // Fetch player leaderboard
  const { data: playerData, isLoading: playersLoading } = useQuery(
    ["player-leaderboard", page, gameFilter],
    async () => {
      const response = await axios.get(
        "http://localhost:5000/api/leaderboard/players",
        {
          params: { page, limit: 20, game: gameFilter },
        }
      );
      return response.data;
    },
    {
      enabled: activeTab === 1,
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  // Fetch tournament leaderboard
  const { data: tournamentData, isLoading: tournamentsLoading } = useQuery(
    ["tournament-leaderboard", page, statusFilter],
    async () => {
      const response = await axios.get(
        "http://localhost:5000/api/leaderboard/tournaments",
        {
          params: { page, limit: 20, status: statusFilter },
        }
      );
      return response.data;
    },
    {
      enabled: activeTab === 2,
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(1);
  };

  const getRankColor = (rank) => {
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "#CD7F32"; // bronze
    return "text.primary";
  };

  const getRankIcon = (rank) => {
    if (rank <= 3) {
      return <EmojiEvents sx={{ color: getRankColor(rank), mr: 1 }} />;
    }
    return null;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "completed":
        return "info";
      case "draft":
        return "warning";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  if (statsLoading) return <LoadingSpinner message="Loading leaderboard..." />;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h3" gutterBottom>
            Leaderboard
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Top performers in the esports community
          </Typography>
        </Box>

        {/* Statistics Cards */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <Avatar sx={{ bgcolor: "primary.main", mx: "auto", mb: 2 }}>
                    <Person />
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {stats.stats.total_players}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Players
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <Avatar sx={{ bgcolor: "secondary.main", mx: "auto", mb: 2 }}>
                    <Groups />
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {stats.stats.total_teams}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Teams
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <Avatar sx={{ bgcolor: "success.main", mx: "auto", mb: 2 }}>
                    <EmojiEvents />
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {stats.stats.total_tournaments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tournaments
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <Avatar sx={{ bgcolor: "warning.main", mx: "auto", mb: 2 }}>
                    <SportsMma />
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {stats.stats.total_matches}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Matches Played
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <Avatar sx={{ bgcolor: "info.main", mx: "auto", mb: 2 }}>
                    <Gamepad />
                  </Avatar>
                  <Typography variant="h4" gutterBottom>
                    {stats.stats.total_games}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Games
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Top Games */}
        {stats?.top_games && stats.top_games.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Popular Games
              </Typography>
              <Grid container spacing={2}>
                {stats.top_games.map((game, index) => (
                  <Grid item xs={12} sm={6} md={4} key={game.game}>
                    <Paper sx={{ p: 2, textAlign: "center" }}>
                      <Typography variant="h6" gutterBottom>
                        {game.game}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.tournament_count} tournaments • {game.total_teams}{" "}
                        teams
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Teams" />
            <Tab label="Players" />
            <Tab label="Tournaments" />
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
          {(activeTab === 0 || activeTab === 1) && (
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Game</InputLabel>
              <Select
                value={gameFilter}
                label="Game"
                onChange={(e) => {
                  setGameFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">All Games</MenuItem>
                <MenuItem value="Valorant">Valorant</MenuItem>
                <MenuItem value="CS:GO">CS:GO</MenuItem>
                <MenuItem value="League of Legends">League of Legends</MenuItem>
                <MenuItem value="Dota 2">Dota 2</MenuItem>
                <MenuItem value="Overwatch">Overwatch</MenuItem>
              </Select>
            </FormControl>
          )}

          {activeTab === 2 && (
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Team Leaderboard */}
        {activeTab === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Team Rankings
              </Typography>

              {teamsLoading ? (
                <Box sx={{ py: 4 }}>
                  <LinearProgress />
                </Box>
              ) : teamData?.teams?.length === 0 ? (
                <Alert severity="info">No teams found.</Alert>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Team</TableCell>
                          <TableCell>Captain</TableCell>
                          <TableCell align="center">Members</TableCell>
                          <TableCell align="center">Matches</TableCell>
                          <TableCell align="center">W/L/D</TableCell>
                          <TableCell align="center">Win %</TableCell>
                          <TableCell align="center">Score Diff</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teamData?.teams?.map((team) => (
                          <TableRow key={team.id} hover>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                {getRankIcon(team.rank)}
                                <Typography
                                  variant="h6"
                                  sx={{ color: getRankColor(team.rank) }}
                                >
                                  #{team.rank}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                                  <Groups />
                                </Avatar>
                                <Typography variant="subtitle1">
                                  {team.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{team.captain_username}</TableCell>
                            <TableCell align="center">
                              {team.member_count}
                            </TableCell>
                            <TableCell align="center">
                              {team.total_matches}
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {team.wins}/{team.losses}/{team.draws}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    team.win_percentage >= 70
                                      ? "success.main"
                                      : team.win_percentage >= 50
                                      ? "warning.main"
                                      : "error.main",
                                }}
                              >
                                {team.win_percentage}%
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    team.score_difference > 0
                                      ? "success.main"
                                      : team.score_difference < 0
                                      ? "error.main"
                                      : "text.primary",
                                }}
                              >
                                {team.score_difference > 0 ? "+" : ""}
                                {team.score_difference}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {teamData?.pagination?.totalPages > 1 && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", mt: 3 }}
                    >
                      <Pagination
                        count={teamData.pagination.totalPages}
                        page={page}
                        onChange={(event, value) => setPage(value)}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Player Leaderboard */}
        {activeTab === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Player Rankings
              </Typography>

              {playersLoading ? (
                <Box sx={{ py: 4 }}>
                  <LinearProgress />
                </Box>
              ) : playerData?.players?.length === 0 ? (
                <Alert severity="info">No players found.</Alert>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Player</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell align="center">Teams</TableCell>
                          <TableCell align="center">Matches</TableCell>
                          <TableCell align="center">W/L</TableCell>
                          <TableCell align="center">Win %</TableCell>
                          <TableCell align="center">Captained</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {playerData?.players?.map((player) => (
                          <TableRow key={player.id} hover>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                {getRankIcon(player.rank)}
                                <Typography
                                  variant="h6"
                                  sx={{ color: getRankColor(player.rank) }}
                                >
                                  #{player.rank}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                <Avatar
                                  sx={{ bgcolor: "secondary.main", mr: 2 }}
                                >
                                  {player.username.charAt(0).toUpperCase()}
                                </Avatar>
                                <Typography variant="subtitle1">
                                  {player.username}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={player.role}
                                size="small"
                                color={
                                  player.role === "admin"
                                    ? "error"
                                    : player.role === "captain"
                                    ? "primary"
                                    : "default"
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              {player.teams_count}
                            </TableCell>
                            <TableCell align="center">
                              {player.total_matches}
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {player.wins}/{player.losses}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    player.win_percentage >= 70
                                      ? "success.main"
                                      : player.win_percentage >= 50
                                      ? "warning.main"
                                      : "error.main",
                                }}
                              >
                                {player.win_percentage}%
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              {player.teams_captained}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {playerData?.pagination?.totalPages > 1 && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", mt: 3 }}
                    >
                      <Pagination
                        count={playerData.pagination.totalPages}
                        page={page}
                        onChange={(event, value) => setPage(value)}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tournament Leaderboard */}
        {activeTab === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tournament Rankings
              </Typography>

              {tournamentsLoading ? (
                <Box sx={{ py: 4 }}>
                  <LinearProgress />
                </Box>
              ) : tournamentData?.tournaments?.length === 0 ? (
                <Alert severity="info">No tournaments found.</Alert>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Tournament</TableCell>
                          <TableCell>Game</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Teams</TableCell>
                          <TableCell align="center">Matches</TableCell>
                          <TableCell align="center">Completion</TableCell>
                          <TableCell>Organizer</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tournamentData?.tournaments?.map((tournament) => (
                          <TableRow key={tournament.id} hover>
                            <TableCell>
                              <Typography variant="h6">
                                #{tournament.rank}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                <Avatar sx={{ bgcolor: "warning.main", mr: 2 }}>
                                  <EmojiEvents />
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle1">
                                    {tournament.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {new Date(
                                      tournament.start_date
                                    ).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>{tournament.game}</TableCell>
                            <TableCell>
                              <Chip
                                label={tournament.status}
                                color={getStatusColor(tournament.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              {tournament.registered_teams}/
                              {tournament.max_teams}
                            </TableCell>
                            <TableCell align="center">
                              {tournament.completed_matches}/
                              {tournament.total_matches}
                            </TableCell>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    tournament.completion_percentage === 100
                                      ? "success.main"
                                      : tournament.completion_percentage >= 50
                                      ? "warning.main"
                                      : "error.main",
                                }}
                              >
                                {tournament.completion_percentage}%
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {tournament.created_by_username}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {tournamentData?.pagination?.totalPages > 1 && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", mt: 3 }}
                    >
                      <Pagination
                        count={tournamentData.pagination.totalPages}
                        page={page}
                        onChange={(event, value) => setPage(value)}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default Leaderboard;
