require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const session = require("express-session");
const axios = require("axios");
const cors = require("cors");
const detect = require("detect-port").default;

const app = express();
const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";
const DEFAULT_PORT = process.env.PORT || 5000;

app.use(express.json());
const allowedOrigins = [
    "http://localhost:5173", // Local frontend
    "https://code-stream-96syog8wp-anurag-amrev-7557s-projects.vercel.app", // Vercel frontend
  ];
  
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true, // Allow cookies and authentication headers
    })
  );

const mongoose = require("mongoose");

app.use(session({ secret: "yourSecret", resave: false, saveUninitialized: true }));

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/authDB")
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error);
  });

app.post("/generate", async (req, res) => {
    try {
        const userProblem = req.body.problem;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API key is missing. Check your .env file." });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const prompt = `
            ### Problem Statement:
            ${userProblem}

            ---

            ### Instructions:
            - If the problem is **directly related to loop operations** (like \`for\`, \`while\`, or \`do-while\` loops), respond in the following queue data structure format:
                - Each element should include:
                    1. The loop condition (e.g., 'i < n').
                    2. The update operation (e.g., 'i++').
                    3. The updated value after each iteration.

            - If the problem is **directly related to sorting algorithms** (like bubble sort, selection sort, insertion sort, etc.), respond in the following format:
                - The type of sorting algorithm.
                - The key steps of the sorting process (such as comparisons and swaps).
                - remember to not give texts in explanation rather just divide them like and  divide(7654)->(76),(54) then while mearge just write meareg and (7),(6)->76 and on the same line (5),(4)->(54) strictly follow these sequence
                - An example of how the array looks after each significant step (for instance, after each pass).


            `;

        const response = await axios.post(endpoint, {
            contents: [{ parts: [{ text: prompt }] }]
        }, {
            headers: { "Content-Type": "application/json" }
        });

        const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            return res.status(500).json({ error: "Received an empty response from Gemini API." });
        }

        // Identify response type based on content keywords
        let responseType = "loop";
        if (responseText.toLowerCase().includes("sort") || responseText.toLowerCase().includes("sorting")) {
            responseType = "sorting";
        }

        const structuredResponse = {
            type: responseType,
            content: responseText.trim()
        };

        res.json(structuredResponse);

    } catch (error) {
        console.error("Error fetching from Gemini API:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to generate response from Gemini API." });
    }
});

app.post("/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Hash password before saving (if using bcrypt)
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Save to database (assuming Mongoose)
      const newUser = new User({ email, password: hashedPassword });
      await newUser.save();
  
      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      console.error("Signup Error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

// Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

//Protected Route Example
app.get("/profile", (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ message: `Welcome, ${decoded.email}` });
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});

// Automatically select an available port and start the server
(async () => {
    try {
        const availablePort = await detect(DEFAULT_PORT);
        app.listen(availablePort, () => {
            console.log(`🚀 Server running on http://localhost:${availablePort}`);
        });
    } catch (error) {
        console.error("Error finding an available port:", error);
    }
})();
