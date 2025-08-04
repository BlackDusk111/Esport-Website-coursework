import {
  CalendarToday,
  Check,
  Close,
  Edit,
  Groups,
  Person,
  PersonAdd,
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
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import axios from "axios";
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";

const TeamDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
    member: null,
  });

  // Fetch team details
  const {
    data: team,
    isLoading,
    error,
  } = useQuery(
    ["team", id],
    async () => {
      const response = await axios.get(`http://localhost:5000/api/teams/${id}`);
      return response.data.team;
    },
    {
      staleTime: 30000,
    }
  );

  // Join team mutation
  const joinTeamMutation = useMutation(
    async () => {
      const response = await axios.post(
        `http://localhost:5000/api/teams/${id}/join`
      );
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["team", id]);
        toast.success("Join request sent successfully!");
      },
      onError: (error) => {
        toast.error(
          error.response?.data?.error || "Failed to send join request"
        );
      },
    }
  );

  // Manage member mutation (approve/reject)
  const manageMemberMutation = useMutation(
    async ({ userId, action }) => {
      const response = await axios.put(
        `http://localhost:5000/api/teams/${id}/members/${userId}`,
        { action }
      );
      return response.data;
    },
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(["team", id]);
        toast.success(`Member ${variables.action}d successfully!`);
        setConfirmDialog({ open: false, action: null, member: null });
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || "Failed to manage member");
      },
    }
  );

  const handleMemberAction = (member, action) => {
    setConfirmDialog({ open: true, action, member });
  };

  const confirmMemberAction = () => {
    if (confirmDialog.member && confirmDialog.action) {
      manageMemberMutation.mutate({
        userId: confirmDialog.member.id,
        action: confirmDialog.action,
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "removed":
        return "error";
      default:
        return "default";
    }
  };

  const isTeamCaptain = user && team && team.captain_id === user.id;
  const isAdmin = user?.role === "admin";
  const canManageTeam = isTeamCaptain || isAdmin;
  const isTeamMember =
    user &&
    team?.members?.some(
      (member) => member.id === user.id && member.status === "active"
    );
  const hasPendingRequest =
    user &&
    team?.members?.some(
      (member) => member.id === user.id && member.status === "pending"
    );

  if (isLoading) return <LoadingSpinner message="Loading team details..." />;

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load team details. Please try again later.
        </Alert>
      </Container>
    );
  }

  if (!team) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Team not found.
        </Alert>
      </Container>
    );
  }

  const activeMembers =
    team.members?.filter((member) => member.status === "active") || [];
  const pendingMembers =
    team.members?.filter((member) => member.status === "pending") || [];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Team Header */}
        <Paper
          sx={{
            p: 4,
            mb: 4,
            background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
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
              <Groups sx={{ fontSize: 40 }} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h3" gutterBottom>
                {team.name}
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
                  label={team.is_active ? "Active" : "Inactive"}
                  color={team.is_active ? "success" : "default"}
                  sx={{ bgcolor: team.is_active ? "success.main" : "grey.500" }}
                />
                <Typography variant="body1">
                  Captain: {team.captain_username}
                </Typography>
                <Typography variant="body1">
                  {activeMembers.length} member
                  {activeMembers.length !== 1 ? "s" : ""}
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
              {user &&
                !isTeamMember &&
                !hasPendingRequest &&
                !canManageTeam && (
                  <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={() => joinTeamMutation.mutate()}
                    disabled={joinTeamMutation.isLoading}
                    sx={{
                      bgcolor: "rgba(255,255,255,0.2)",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                    }}
                  >
                    {joinTeamMutation.isLoading
                      ? "Sending..."
                      : "Request to Join"}
                  </Button>
                )}
              {hasPendingRequest && (
                <Chip
                  label="Request Pending"
                  color="warning"
                  sx={{ bgcolor: "warning.main" }}
                />
              )}
              {canManageTeam && (
                <Button
                  variant="contained"
                  startIcon={<Edit />}
                  href={`/teams/${id}/edit`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  Edit Team
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={4}>
          {/* Team Members */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team Members ({activeMembers.length})
                </Typography>

                {activeMembers.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Person
                      sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                    />
                    <Typography variant="body1" color="text.secondary">
                      No active members yet
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {activeMembers.map((member, index) => (
                      <React.Fragment key={member.id}>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: "primary.main" }}>
                              {member.username.charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {member.username}
                                {member.id === team.captain_id && (
                                  <Chip
                                    label="Captain"
                                    size="small"
                                    color="primary"
                                  />
                                )}
                              </Box>
                            }
                            secondary={`Joined ${new Date(
                              member.joined_at
                            ).toLocaleDateString()}`}
                          />
                          <ListItemSecondaryAction>
                            <Chip
                              label={member.status}
                              color={getStatusColor(member.status)}
                              size="small"
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < activeMembers.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}

                {/* Pending Members (Captain/Admin only) */}
                {canManageTeam && pendingMembers.length > 0 && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="h6" gutterBottom>
                      Pending Requests ({pendingMembers.length})
                    </Typography>
                    <List>
                      {pendingMembers.map((member, index) => (
                        <React.Fragment key={member.id}>
                          <ListItem>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: "warning.main" }}>
                                {member.username.charAt(0).toUpperCase()}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={member.username}
                              secondary={`Requested ${new Date(
                                member.joined_at
                              ).toLocaleDateString()}`}
                            />
                            <ListItemSecondaryAction>
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <IconButton
                                  color="success"
                                  onClick={() =>
                                    handleMemberAction(member, "approve")
                                  }
                                  disabled={manageMemberMutation.isLoading}
                                >
                                  <Check />
                                </IconButton>
                                <IconButton
                                  color="error"
                                  onClick={() =>
                                    handleMemberAction(member, "reject")
                                  }
                                  disabled={manageMemberMutation.isLoading}
                                >
                                  <Close />
                                </IconButton>
                              </Box>
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < pendingMembers.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Team Stats & Info */}
          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team Statistics
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Total Members:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {activeMembers.length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Pending Requests:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {pendingMembers.length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Created:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {new Date(team.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <CalendarToday
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

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={() =>
            setConfirmDialog({ open: false, action: null, member: null })
          }
        >
          <DialogTitle>
            Confirm{" "}
            {confirmDialog.action === "approve" ? "Approval" : "Rejection"}
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to {confirmDialog.action}{" "}
              {confirmDialog.member?.username}'s request to join the team?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setConfirmDialog({ open: false, action: null, member: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMemberAction}
              color={confirmDialog.action === "approve" ? "success" : "error"}
              variant="contained"
              disabled={manageMemberMutation.isLoading}
            >
              {manageMemberMutation.isLoading
                ? "Processing..."
                : `${
                    confirmDialog.action === "approve" ? "Approve" : "Reject"
                  }`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default TeamDetail;
