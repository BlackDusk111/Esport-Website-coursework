const express = require("express");
const app = express();

app.get("/test", (req, res) => {
  res.json({ message: "Test server is working!" });
});

app.get("/api/tournaments", (req, res) => {
  res.json({
    tournaments: [
      {
        id: 1,
        name: "Test Tournament",
        game: "Test Game",
        status: "active",
      },
    ],
  });
});

const PORT = 8080;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Test server running on port ${PORT}`);
  console.log("Server object:", server);
});

// Keep the process alive
process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
