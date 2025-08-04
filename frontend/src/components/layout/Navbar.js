import {
  AccountCircle,
  AdminPanelSettings,
  Dashboard,
  EmojiEvents,
  Groups,
  Login,
  Logout,
  Menu as MenuIcon,
  PersonAdd,
  SportsMma,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NotificationCenter from "../common/NotificationCenter";

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleProfileMenuClose();
    navigate("/");
  };

  const handleMobileDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const navigationItems = [
    { label: "Home", path: "/", icon: <Dashboard />, public: true },
    {
      label: "Tournaments",
      path: "/tournaments",
      icon: <EmojiEvents />,
      public: true,
    },
    { label: "Teams", path: "/teams", icon: <Groups />, public: true },
    { label: "Matches", path: "/matches", icon: <SportsMma />, public: true },
    // { label: 'Leaderboard', path: '/leaderboard', icon: <Leaderboard />, public: true },
  ];

  const authenticatedItems = [
    { label: "Dashboard", path: "/dashboard", icon: <Dashboard /> },
    { label: "Profile", path: "/profile", icon: <AccountCircle /> },
  ];

  const adminItems = [
    { label: "Admin Panel", path: "/admin", icon: <AdminPanelSettings /> },
  ];

  const isActiveRoute = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const NavButton = ({ item, mobile = false }) => {
    const active = isActiveRoute(item.path);

    if (mobile) {
      return (
        <ListItem
          button
          component={Link}
          to={item.path}
          selected={active}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <ListItemIcon sx={{ color: active ? "primary.main" : "inherit" }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItem>
      );
    }

    return (
      <Button
        component={Link}
        to={item.path}
        color={active ? "primary" : "inherit"}
        startIcon={item.icon}
        sx={{
          mx: 1,
          fontWeight: active ? 600 : 400,
          borderBottom: active ? 2 : 0,
          borderColor: "primary.main",
          borderRadius: 0,
        }}
      >
        {item.label}
      </Button>
    );
  };

  const renderDesktopNav = () => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {/* Public navigation */}
      {navigationItems.map((item) => (
        <NavButton key={item.path} item={item} />
      ))}

      {/* Authenticated navigation */}
      {isAuthenticated &&
        authenticatedItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

      {/* Admin navigation */}
      {isAuthenticated &&
        user?.role === "admin" &&
        adminItems.map((item) => <NavButton key={item.path} item={item} />)}

      {/* Auth buttons */}
      {isAuthenticated ? (
        <Box sx={{ ml: 2, display: "flex", alignItems: "center" }}>
          <NotificationCenter />
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ ml: 2, display: "flex", gap: 1 }}>
          <Button
            component={Link}
            to="/login"
            color="inherit"
            startIcon={<Login />}
          >
            Login
          </Button>
          <Button
            component={Link}
            to="/register"
            variant="outlined"
            color="primary"
            startIcon={<PersonAdd />}
          >
            Register
          </Button>
        </Box>
      )}
    </Box>
  );

  const renderMobileDrawer = () => (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={handleMobileDrawerToggle}
      sx={{
        "& .MuiDrawer-paper": {
          width: 250,
          bgcolor: "background.paper",
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" color="primary">
          Esports Platform
        </Typography>
      </Box>

      <List>
        {/* Public navigation */}
        {navigationItems.map((item) => (
          <NavButton key={item.path} item={item} mobile />
        ))}

        {/* Authenticated navigation */}
        {isAuthenticated &&
          authenticatedItems.map((item) => (
            <NavButton key={item.path} item={item} mobile />
          ))}

        {/* Admin navigation */}
        {isAuthenticated &&
          user?.role === "admin" &&
          adminItems.map((item) => (
            <NavButton key={item.path} item={item} mobile />
          ))}

        {/* Auth items */}
        {isAuthenticated ? (
          <ListItem button onClick={handleLogout}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItem>
        ) : (
          <>
            <ListItem
              button
              component={Link}
              to="/login"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <ListItemIcon>
                <Login />
              </ListItemIcon>
              <ListItemText primary="Login" />
            </ListItem>
            <ListItem
              button
              component={Link}
              to="/register"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <ListItemIcon>
                <PersonAdd />
              </ListItemIcon>
              <ListItemText primary="Register" />
            </ListItem>
          </>
        )}
      </List>
    </Drawer>
  );

  return (
    <>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleMobileDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              flexGrow: isMobile ? 1 : 0,
              textDecoration: "none",
              color: "inherit",
              fontWeight: 700,
              mr: 4,
            }}
          >
            Esports Platform
          </Typography>

          {/* Desktop navigation */}
          {!isMobile && <Box sx={{ flexGrow: 1 }}>{renderDesktopNav()}</Box>}
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      {isMobile && renderMobileDrawer()}

      {/* Profile menu */}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem
          onClick={handleProfileMenuClose}
          component={Link}
          to="/profile"
        >
          <AccountCircle sx={{ mr: 1 }} />
          Profile
        </MenuItem>
        <MenuItem
          onClick={handleProfileMenuClose}
          component={Link}
          to="/dashboard"
        >
          <Dashboard sx={{ mr: 1 }} />
          Dashboard
        </MenuItem>
        {user?.role === "admin" && (
          <MenuItem
            onClick={handleProfileMenuClose}
            component={Link}
            to="/admin"
          >
            <AdminPanelSettings sx={{ mr: 1 }} />
            Admin Panel
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </>
  );
};

export default Navbar;
