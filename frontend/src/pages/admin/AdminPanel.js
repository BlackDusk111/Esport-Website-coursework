import {
  AdminPanelSettings,
  Cancel,
  CheckCircle,
  Dashboard as DashboardIcon,
  Delete,
  Edit,
  EmojiEvents,
  Group,
  History,
  Lock,
  LockOpen,
  People,
  PersonAdd,
  Security,
  SportsMma,
  TrendingUp,
  Visibility,
  Warning,
} from "@mui/icons-material";
import {
  Alert,
  Badge,
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
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
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
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";

const AdminPanel = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // User Management State
  const [users, setUsers] = useState([]);
  const [userDialog, setUserDialog] = useState({
    open: false,
    user: null,
    mode: "view",
  });
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    role: "player",
    email_verified: false,
    account_locked: false,
  });

  // Match Verification State
  const [pendingMatches, setPendingMatches] = useState([]);
  const [verificationDialog, setVerificationDialog] = useState({
    open: false,
    match: null,
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState("all");

  // System Stats State
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    totalTournaments: 0,
    totalMatches: 0,
    activeUsers: 0,
    pendingVerifications: 0,
  });

  useEffect(() => {
    if (tabValue === 0) fetchSystemStats();
    if (tabValue === 1) fetchUsers();
    if (tabValue === 2) fetchPendingMatches();
    if (tabValue === 3) fetchAuditLogs();
  }, [tabValue]);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStats(data);
      }
    } catch (err) {
      setError("Failed to fetch system statistics");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/admin/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "http://localhost:5000/api/admin/matches/pending",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPendingMatches(data);
      }
    } catch (err) {
      setError("Failed to fetch pending matches");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/admin/audit-logs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (err) {
      setError("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError("");
    setSuccess("");
  };

  const handleUserAction = async (userId, action, data = {}) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/users/${userId}/${action}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        setSuccess(`User ${action} successful`);
        fetchUsers();
        setUserDialog({ open: false, user: null, mode: "view" });
      } else {
        const errorData = await response.json();
        setError(errorData.message || `Failed to ${action} user`);
      }
    } catch (err) {
      setError(`Failed to ${action} user`);
    }
  };

  const handleMatchVerification = async (matchId, action) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/matches/${matchId}/verify`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ action }),
        }
      );

      if (response.ok) {
        setSuccess(`Match ${action} successful`);
        fetchPendingMatches();
        setVerificationDialog({ open: false, match: null });
      } else {
        const errorData = await response.json();
        setError(errorData.message || `Failed to ${action} match`);
      }
    } catch (err) {
      setError(`Failed to ${action} match`);
    }
  };

  const openUserDialog = (user, mode) => {
    setUserDialog({ open: true, user, mode });
    if (user) {
      setUserForm({
        username: user.username || "",
        email: user.email || "",
        role: user.role || "player",
        email_verified: user.email_verified || false,
        account_locked: user.account_locked || false,
      });
    } else {
      setUserForm({
        username: "",
        email: "",
        role: "player",
        email_verified: false,
        account_locked: false,
      });
    }
  };

  const closeUserDialog = () => {
    setUserDialog({ open: false, user: null, mode: "view" });
    setError("");
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "error";
      case "captain":
        return "warning";
      case "player":
        return "primary";
      default:
        return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "disputed":
        return "error";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  // Dashboard Tab Content
  const renderDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <People color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{systemStats.totalUsers}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Users
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Group color="success" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{systemStats.totalTeams}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Teams
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <EmojiEvents color="warning" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">
                  {systemStats.totalTournaments}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Tournaments
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SportsMma color="info" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{systemStats.totalMatches}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Matches
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <TrendingUp color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Active Users"
                  secondary={`${systemStats.activeUsers} users online`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Warning
                    color={
                      systemStats.pendingVerifications > 0
                        ? "warning"
                        : "success"
                    }
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Pending Verifications"
                  secondary={`${systemStats.pendingVerifications} matches awaiting verification`}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={() => openUserDialog(null, "create")}
              >
                Create New User
              </Button>
              <Button
                variant="outlined"
                startIcon={<SportsMma />}
                onClick={() => setTabValue(2)}
                disabled={systemStats.pendingVerifications === 0}
              >
                Review Pending Matches ({systemStats.pendingVerifications})
              </Button>
              <Button
                variant="outlined"
                startIcon={<History />}
                onClick={() => setTabValue(3)}
              >
                View Audit Logs
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // User Management Tab Content
  const renderUserManagement = () => (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">User Management</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => openUserDialog(null, "create")}
        >
          Add User
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Failed Logins</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  <Chip
                    label={user.role.toUpperCase()}
                    color={getRoleColor(user.role)}
                    size="small"
                  />
                </TableCell>

                <TableCell>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                  >
                    <Chip
                      label={user.account_locked ? "Locked" : "Active"}
                      color={user.account_locked ? "error" : "success"}
                      size="small"
                    />
                    {!user.email_verified && (
                      <Chip label="Unverified" color="warning" size="small" />
                    )}
                  </Box>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : "Never"}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Badge
                    badgeContent={user.failed_login_count}
                    color={user.failed_login_count > 3 ? "error" : "default"}
                  >
                    <Typography variant="body2">
                      {user.failed_login_count || 0}
                    </Typography>
                  </Badge>
                </TableCell>

                <TableCell align="center">
                  <Box
                    sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                  >
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => openUserDialog(user, "view")}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit User">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openUserDialog(user, "edit")}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>

                    <Tooltip
                      title={
                        user.account_locked ? "Unlock Account" : "Lock Account"
                      }
                    >
                      <IconButton
                        size="small"
                        color={user.account_locked ? "success" : "warning"}
                        onClick={() =>
                          handleUserAction(
                            user.id,
                            user.account_locked ? "unlock" : "lock"
                          )
                        }
                      >
                        {user.account_locked ? <LockOpen /> : <Lock />}
                      </IconButton>
                    </Tooltip>

                    {user.id !== user.id && (
                      <Tooltip title="Delete User">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleUserAction(user.id, "delete")}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Match Verification Tab Content
  const renderMatchVerification = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pending Match Verifications
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tournament</TableCell>
              <TableCell>Teams</TableCell>
              <TableCell>Submitted Score</TableCell>
              <TableCell>Submitted By</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingMatches.map((match) => (
              <TableRow key={match.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {match.tournament_name}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {match.team1_name} vs {match.team2_name}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {match.score1} - {match.score2}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {match.submitted_by_username}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {new Date(match.updated_at).toLocaleDateString()}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Box
                    sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                  >
                    <Tooltip title="Approve Score">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() =>
                          handleMatchVerification(match.id, "approve")
                        }
                      >
                        <CheckCircle />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Dispute Score">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          handleMatchVerification(match.id, "dispute")
                        }
                      >
                        <Cancel />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setVerificationDialog({ open: true, match })
                        }
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Audit Logs Tab Content
  const renderAuditLogs = () => (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">Audit Logs</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Filter</InputLabel>
          <Select
            value={auditFilter}
            label="Filter"
            onChange={(e) => setAuditFilter(e.target.value)}
          >
            <MenuItem value="all">All Actions</MenuItem>
            <MenuItem value="login">Login</MenuItem>
            <MenuItem value="create">Create</MenuItem>
            <MenuItem value="update">Update</MenuItem>
            <MenuItem value="delete">Delete</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Table</TableCell>
              <TableCell>Record ID</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Timestamp</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditLogs
              .filter(
                (log) => auditFilter === "all" || log.action === auditFilter
              )
              .map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {log.username || "System"}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={log.action.toUpperCase()}
                      color={getStatusColor(log.action)}
                      size="small"
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{log.table_name}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{log.record_id}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{log.ip_address}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {new Date(log.created_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  if (loading && tabValue === 0) return <LoadingSpinner />;

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h3" component="h1" gutterBottom>
            <AdminPanelSettings
              sx={{ fontSize: "inherit", mr: 2, verticalAlign: "middle" }}
            />
            Admin Panel
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Administrative tools for managing the esports tournament platform
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
            <Tab icon={<DashboardIcon />} label="Dashboard" />
            <Tab icon={<People />} label="Users" />
            <Tab
              icon={
                <Badge
                  badgeContent={systemStats.pendingVerifications}
                  color="error"
                >
                  <SportsMma />
                </Badge>
              }
              label="Match Verification"
            />
            <Tab icon={<Security />} label="Audit Logs" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ mt: 3 }}>
          {tabValue === 0 && renderDashboard()}
          {tabValue === 1 && renderUserManagement()}
          {tabValue === 2 && renderMatchVerification()}
          {tabValue === 3 && renderAuditLogs()}
        </Box>

        {/* User Dialog */}
        <Dialog
          open={userDialog.open}
          onClose={closeUserDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {userDialog.mode === "create"
              ? "Create User"
              : userDialog.mode === "edit"
              ? "Edit User"
              : "User Details"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({ ...userForm, username: e.target.value })
                    }
                    disabled={userDialog.mode === "view"}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({ ...userForm, email: e.target.value })
                    }
                    disabled={userDialog.mode === "view"}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth disabled={userDialog.mode === "view"}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={userForm.role}
                      label="Role"
                      onChange={(e) =>
                        setUserForm({ ...userForm, role: e.target.value })
                      }
                    >
                      <MenuItem value="player">Player</MenuItem>
                      <MenuItem value="captain">Captain</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userForm.email_verified}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            email_verified: e.target.checked,
                          })
                        }
                        disabled={userDialog.mode === "view"}
                      />
                    }
                    label="Email Verified"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userForm.account_locked}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            account_locked: e.target.checked,
                          })
                        }
                        disabled={userDialog.mode === "view"}
                      />
                    }
                    label="Account Locked"
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeUserDialog}>
              {userDialog.mode === "view" ? "Close" : "Cancel"}
            </Button>
            {userDialog.mode !== "view" && (
              <Button
                variant="contained"
                onClick={() => {
                  if (userDialog.mode === "create") {
                    handleUserAction(null, "create", userForm);
                  } else {
                    handleUserAction(userDialog.user.id, "update", userForm);
                  }
                }}
              >
                {userDialog.mode === "create" ? "Create" : "Update"}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Match Verification Dialog */}
        <Dialog
          open={verificationDialog.open}
          onClose={() => setVerificationDialog({ open: false, match: null })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Match Verification Details</DialogTitle>
          <DialogContent>
            {verificationDialog.match && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6">
                      {verificationDialog.match.tournament_name}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {verificationDialog.match.team1_name} vs{" "}
                      {verificationDialog.match.team2_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Submitted Score:
                    </Typography>
                    <Typography variant="h5">
                      {verificationDialog.match.score1} -{" "}
                      {verificationDialog.match.score2}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Submitted By:
                    </Typography>
                    <Typography variant="body1">
                      {verificationDialog.match.submitted_by_username}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Match Time:
                    </Typography>
                    <Typography variant="body1">
                      {new Date(
                        verificationDialog.match.scheduled_time
                      ).toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setVerificationDialog({ open: false, match: null })
              }
            >
              Close
            </Button>
            <Button
              color="error"
              onClick={() =>
                handleMatchVerification(verificationDialog.match.id, "dispute")
              }
            >
              Dispute
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() =>
                handleMatchVerification(verificationDialog.match.id, "approve")
              }
            >
              Approve
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default AdminPanel;
