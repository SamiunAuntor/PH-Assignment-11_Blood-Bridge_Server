// IMPORTS
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

dotenv.config();

// FIREBASE SETUP
// Read Firebase service account JSON
const serviceAccountPath = path.resolve("./bloodbridge-firebase-adminsdk.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// EXPRESS SETUP
const app = express();
app.use(cors());
app.use(express.json());

// MONGODB SETUP
const client = new MongoClient(process.env.MONGO_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("BloodBridge");
        console.log("MongoDB connected");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// MIDDLEWARES

// Firebase Auth Middleware
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
};

// Role-based access middleware
const requireRole = (role) => {
    return async (req, res, next) => {
        try {
            const usersCollection = db.collection("users");
            const user = await usersCollection.findOne({ email: req.user.email });
            if (!user || user.role !== role) {
                return res.status(403).json({ message: "Forbidden: Access denied" });
            }
            req.dbUser = user;
            next();
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    };
};

// APIs

// Root API
app.get("/", (req, res) => {
    res.send("Blood Bridge is donating blood");
});

// USER APIS

// Register User
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
            createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);

        res.status(201).json({ message: "User registered successfully", user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get User Role
app.get("/get-user-role", async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne({ email }, { projection: { role: 1, _id: 0 } });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});



// START SERVER 
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at: \x1b[34mhttp://localhost:${PORT}\x1b[0m`);
    });
});
