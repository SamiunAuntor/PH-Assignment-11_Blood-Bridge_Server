import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

// Express Setup
const app = express();
app.use(cors());
app.use(express.json());


// MongoDB Connection
const client = new MongoClient(process.env.MONGO_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("BloodBridge"); // Database name
        console.log("MongoDB connected");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}


// All API's

// Root API
app.get("/", (req, res) => {
    res.send("Blood Bridge is donating blood");
});

// User Registration API
app.post("/register-user", async (req, res) => {
    try {
        const { name, email, bloodGroup, district, upazila, avatar } = req.body;

        if (!name || !email || !bloodGroup || !district || !upazila) {
            return res.status(400).json({ message: "All fields are required" });
        }


        const usersCollection = db.collection("users");
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const newUser = {
            name,
            email,
            bloodGroup,
            district,
            upazila,
            avatar,
            role: "donor",
            status: "active",
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);

        res.status(201).json({ message: "User registered successfully", user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get user role API
app.get("/get-user-role", async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne(
            { email },
            { projection: { role: 1, _id: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


// Start Server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at: \x1b[34mhttp://localhost:${PORT}\x1b[0m`);
    });
});
