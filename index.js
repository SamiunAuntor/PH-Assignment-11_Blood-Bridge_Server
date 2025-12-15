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

// DONATION REQUEST APIS

// Create Donation Request
app.post("/dashboard/create-donation-request", verifyFirebaseToken, async (req, res) => {
    try {
        const { recipientName, recipientDistrict, recipientUpazila, hospitalName, address, bloodGroup, donationDate, donationTime, message } = req.body;

        const usersCollection = db.collection("users");
        const currentUser = await usersCollection.findOne({ email: req.user.email });

        if (!currentUser || currentUser.status === "blocked") {
            return res.status(403).json({ message: "Blocked user cannot create donation request" });
        }

        const donationRequestsCollection = db.collection("donationRequests");

        const newRequest = {
            requesterName: currentUser.name,
            requesterEmail: currentUser.email,
            recipientName,
            recipientDistrict,
            recipientUpazila,
            hospitalName,
            address,
            bloodGroup,
            donationDate,
            donationTime,
            message,
            status: "pending",
            createdAt: new Date(),
        };

        await donationRequestsCollection.insertOne(newRequest);

        res.status(201).json({ message: "Donation request created", donationRequest: newRequest });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get My Donation Requests
app.get("/dashboard/my-donation-requests", verifyFirebaseToken, async (req, res) => {
    try {
        const donationRequestsCollection = db.collection("donationRequests");
        const { status, page = 1, limit = 10 } = req.query;

        const query = { requesterEmail: req.user.email };
        if (status) query.status = status;

        const total = await donationRequestsCollection.countDocuments(query);
        const requests = await donationRequestsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .toArray();

        res.status(200).json({ total, page: parseInt(page), limit: parseInt(limit), requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update Donation Request
app.put("/dashboard/donation-request/:id", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const donationRequestsCollection = db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Donation request not found" });
        if (request.requesterEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

        await donationRequestsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updates });

        res.status(200).json({ message: "Donation request updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Delete Donation Request
app.delete("/dashboard/donation-request/:id", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const donationRequestsCollection = db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Donation request not found" });
        if (request.requesterEmail !== req.user.email) return res.status(403).json({ message: "Not allowed" });

        await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });

        res.status(200).json({ message: "Donation request deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get All Donation Requests (Admin & Volunteer)
app.get("/dashboard/all-blood-donation-request", verifyFirebaseToken, async (req, res) => {
    try {
        const donationRequestsCollection = db.collection("donationRequests");
        const usersCollection = db.collection("users");

        const currentUser = await usersCollection.findOne({ email: req.user.email });
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const { status, page = 1, limit = 10 } = req.query;

        const query = {};
        if (status) query.status = status;

        const cursor = donationRequestsCollection.find(query).sort({ createdAt: -1 });
        const total = await cursor.count();
        const requests = await cursor.skip((page - 1) * limit).limit(parseInt(limit)).toArray();

        res.status(200).json({ total, page: parseInt(page), limit: parseInt(limit), requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update Donation Status (Admin & Volunteer)
app.put("/dashboard/donation-request/:id/status", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const donationRequestsCollection = db.collection("donationRequests");
        const usersCollection = db.collection("users");

        const currentUser = await usersCollection.findOne({ email: req.user.email });
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        if (!["pending", "inprogress", "done", "canceled"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
        if (!request) return res.status(404).json({ message: "Donation request not found" });

        await donationRequestsCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });

        res.status(200).json({ message: "Donation status updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ADMIN APIS

// Get All Users
app.get("/dashboard/all-users", verifyFirebaseToken, requireRole("admin"), async (req, res) => {
    try {
        const usersCollection = db.collection("users");
        const { status, page = 1, limit = 10 } = req.query;

        const query = {};
        if (status) query.status = status;

        const total = await usersCollection.countDocuments(query);
        const users = await usersCollection.find(query).skip((page - 1) * limit).limit(parseInt(limit)).toArray();

        res.status(200).json({ total, page: parseInt(page), limit: parseInt(limit), users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update User Role
app.put("/dashboard/user/:id", verifyFirebaseToken, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const usersCollection = db.collection("users");
        await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: updates });

        res.status(200).json({ message: "User updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// PUBLIC API
// Search Donors
app.get("/search-donors", async (req, res) => {
    try {
        const { bloodGroup, district, upazila } = req.query;
        const usersCollection = db.collection("users");

        const query = { role: "donor", status: "active" };
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const donors = await usersCollection.find(query).toArray();

        res.status(200).json({ total: donors.length, donors });
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
