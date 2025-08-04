import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  Info,
  Warning,
  Error,
  CheckCircle,
  Circle,
  MarkEmailRead,
  Clear,
  Refresh,
  WifiOff,
  Wifi,
  SignalWifiStatusbar4Bar,
} from '@mui/icons-material';
import { useRealTime } from '../../contexts/RealTimeContext';

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    connectionStatus,
    lastUpdated,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useRealTime();

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      case 'info':
      default:
        return <Info color="info" />;
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi color="success" />;
      case 'disconnected':
        return <WifiOff color="error" />;
      case 'error':
        return <SignalWifiStatusbar4Bar color="warning" />;
      default:
        return <Wifi />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'error';
      case 'error':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
  };

  return (
    <>
      <Tooltip title={`${unreadCount} unread notifications`}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{ mr: 1 }}
        >
          <Badge badgeContent={unreadCount} color="error">
            {unreadCount > 0 ? <NotificationsActive /> : <Notifications />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Header */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">
              Notifications
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={`Connection: ${connectionStatus}`}>
                <Chip
                  icon={getConnectionIcon()}
                  label={connectionStatus}
                  size="small"
                  color={getConnectionColor()}
                  variant="outlined"
                />
              </Tooltip>
            </Box>
          </Box>
          
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<MarkEmailRead />}
              onClick={handleMarkAllAsRead}
              sx={{ mb: 1 }}
            >
              Mark all as read
            </Button>
          )}
          
          {lastUpdated.notifications && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatTimeAgo(lastUpdated.notifications)}
            </Typography>
          )}
        </Box>

        <Divider />

        {/* Connection Status Alert */}
        {connectionStatus !== 'connected' && (
          <Box sx={{ p: 2 }}>
            <Alert 
              severity={connectionStatus === 'disconnected' ? 'error' : 'warning'}
              size="small"
            >
              {connectionStatus === 'disconnected' 
                ? 'You are offline. Notifications may be delayed.'
                : 'Connection issues detected. Some data may be outdated.'
              }
            </Alert>
          </Box>
        )}

        {/* Notifications List */}
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.slice(0, 10).map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    button
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      bgcolor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={notification.read ? 'normal' : 'medium'}>
                            {notification.title}
                          </Typography>
                          {!notification.read && (
                            <Circle sx={{ fontSize: 8, color: 'primary.main' }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(notification.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {notifications.length > 10 && (
          <>
            <Divider />
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Showing 10 of {notifications.length} notifications
              </Typography>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

export default NotificationCenter;