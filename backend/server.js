const express = require("express");

const app = express();
const PORT = 5000;

app.get("/", (req, res) => {
  res.json({
    message: "Backend is working!"
  });
});

app.get("/api/users", (req, res) => {
  res.json({
    success: true,
    users: [
      {
        id: 1,
        name: "Mohit"
      },
      {
        id: 2,
        name: "Rahul"
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});