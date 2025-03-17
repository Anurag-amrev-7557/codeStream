require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const detect = require("detect-port").default;

const app = express();
const DEFAULT_PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({ origin: "*" }));

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
