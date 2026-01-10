// IMPORTS
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import admin from "firebase-admin";


dotenv.config();

// FIREBASE SETUP
// Read Firebase service account JSON
import { Buffer } from "buffer";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8'))
        ),
    });
}



// EXPRESS SETUP
const app = express();
app.use(cors());
app.use(express.json());

// MONGODB SETUP
let cachedClient = null;
let cachedDb = null;

async function connectDB() {
    if (cachedDb) return cachedDb;

    if (!cachedClient) {
        cachedClient = new MongoClient(process.env.MONGO_URI);
        await cachedClient.connect();
        console.log("MongoDB connected");
    }

    cachedDb = cachedClient.db("BloodBridge");
    return cachedDb;
}

// Database middleware - ensures DB is connected and attaches to req
const dbMiddleware = async (req, res, next) => {
    try {
        req.db = await connectDB();
        next();
    } catch (err) {
        console.error("Database connection error:", err);
        res.status(500).json({ message: "Database connection failed" });
    }
};

// Apply database middleware to all routes
app.use(dbMiddleware);

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

// Role-based access middleware (single role)
const requireRole = (role) => {
    return async (req, res, next) => {
        try {
            const usersCollection = req.db.collection("users");
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

// Role-based access middleware (any of multiple roles)
const requireAnyRole = (roles = []) => {
    return async (req, res, next) => {
        try {
            const usersCollection = req.db.collection("users");
            const user = await usersCollection.findOne({ email: req.user.email });
            if (!user || !roles.includes(user.role)) {
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

// Helper function to check if user is admin
const isAdmin = async (email, db) => {
    try {
        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne({ email });
        return user && user.role === "admin";
    } catch (err) {
        return false;
    }
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

        const usersCollection = req.db.collection("users");
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

        const usersCollection = req.db.collection("users");
        const user = await usersCollection.findOne({ email }, { projection: { role: 1, _id: 0 } });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get logged-in user profile
app.get("/dashboard/profile", verifyFirebaseToken, async (req, res) => {
    try {
        const usersCollection = req.db.collection("users");

        const user = await usersCollection.findOne({ email: req.user.email });

        if (!user) return res.status(404).json({ message: "User not found" });

        const formattedUser = {
            ...user,
            _id: user._id.$oid || user._id.toString(),
            createdAt: user.createdAt.$date || user.createdAt.toISOString(),
        };

        res.status(200).json({ user: formattedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update User Profile
app.put("/dashboard/profile", verifyFirebaseToken, async (req, res) => {
    try {
        const { name, bloodGroup, district, upazila, avatar } = req.body;
        const usersCollection = req.db.collection("users");

        await usersCollection.updateOne(
            { email: req.user.email },
            { $set: { name, bloodGroup, district, upazila, avatar } }
        );

        res.status(200).json({ message: "Profile updated successfully" });
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

        const usersCollection = req.db.collection("users");
        const currentUser = await usersCollection.findOne({ email: req.user.email });

        if (!currentUser || currentUser.status === "blocked") {
            return res.status(403).json({ message: "Blocked user cannot create donation request" });
        }

        const donationRequestsCollection = req.db.collection("donationRequests");

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
        const donationRequestsCollection = req.db.collection("donationRequests");
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

// Get Single Donation Request (Public)
app.get("/donation-request/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const donationRequestsCollection = req.db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Request not found" });

        res.status(200).json({ request });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get Single Donation Request (Dashboard)
app.get("/dashboard/donation-request/:id", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const donationRequestsCollection = req.db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Request not found" });

        res.status(200).json({ request });
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

        const donationRequestsCollection = req.db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Donation request not found" });

        // Check if user is admin or the requester
        const userIsAdmin = await isAdmin(req.user.email, req.db);
        if (!userIsAdmin && request.requesterEmail !== req.user.email) {
            return res.status(403).json({ message: "Not allowed" });
        }

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
        const donationRequestsCollection = req.db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Donation request not found" });

        // Check if user is admin or the requester
        const userIsAdmin = await isAdmin(req.user.email, req.db);
        if (!userIsAdmin && request.requesterEmail !== req.user.email) {
            return res.status(403).json({ message: "Not allowed" });
        }

        await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });

        res.status(200).json({ message: "Donation request deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Donate to Request (Update status to inprogress with donor info)
app.put("/donation-request/:id/donate", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { donorName, donorEmail } = req.body;

        const donationRequestsCollection = req.db.collection("donationRequests");
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });

        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.status !== "pending") {
            return res.status(400).json({ message: "Request is not pending" });
        }

        await donationRequestsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: "inprogress",
                    donorName,
                    donorEmail
                }
            }
        );

        res.status(200).json({ message: "Donation confirmed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get total count of ALL users for Volunteer/Admin statistics
app.get("/dashboard/total-users-count", verifyFirebaseToken, requireAnyRole(["admin", "volunteer"]), async (req, res) => {
    try {
        const usersCollection = req.db.collection("users");

        const totalUsers = await usersCollection.countDocuments({});

        res.status(200).json({ totalUsers });
    } catch (err) {
        console.error("Error fetching total user count:", err);
        res.status(500).json({ message: "Server error while fetching user statistics" });
    }
});

// Get All Donation Requests (Admin & Volunteer)
app.get("/dashboard/all-blood-donation-request", verifyFirebaseToken, requireAnyRole(["admin", "volunteer"]), async (req, res) => {
    try {
        const donationRequestsCollection = req.db.collection("donationRequests");
        const { status, page = 1, limit = 10 } = req.query;

        const query = {};
        if (status) query.status = status;

        // Use countDocuments() instead of cursor.count()
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

// Update Donation Status (Admin & Volunteer)
app.put("/dashboard/donation-request/:id/status", verifyFirebaseToken, requireAnyRole(["admin", "volunteer"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const donationRequestsCollection = req.db.collection("donationRequests");
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

// Donor : Update own donation request status (inprogress -> done / canceled)
app.put(
    "/dashboard/my-donation-request/:id/status",
    verifyFirebaseToken,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!["done", "canceled"].includes(status)) {
                return res.status(400).json({ message: "Invalid status" });
            }

            const donationRequestsCollection = req.db.collection("donationRequests");

            const request = await donationRequestsCollection.findOne({
                _id: new ObjectId(id),
            });

            if (!request) {
                return res.status(404).json({ message: "Donation request not found" });
            }

            // Only requester can update
            if (request.requesterEmail !== req.user.email) {
                return res.status(403).json({ message: "Not allowed" });
            }

            // Only inprogress can be updated
            if (request.status !== "inprogress") {
                return res.status(400).json({
                    message: "Only inprogress requests can be updated",
                });
            }

            await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.status(200).json({ message: `Marked as ${status}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);


// Get Pending Donation Requests (Public - no auth required)
app.get("/donation-requests", async (req, res) => {
    try {
        const donationRequestsCollection = req.db.collection("donationRequests");
        const requests = await donationRequestsCollection
            .find({ status: "pending" })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({ requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ADMIN APIS

// Get All Users
app.get("/dashboard/all-users", verifyFirebaseToken, requireRole("admin"), async (req, res) => {
    try {
        const usersCollection = req.db.collection("users");
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

        const usersCollection = req.db.collection("users");
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
        const usersCollection = req.db.collection("users");

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

// Get Public Statistics (Public - no auth required)
app.get("/public-stats", async (req, res) => {
    try {
        const usersCollection = req.db.collection("users");
        const donationRequestsCollection = req.db.collection("donationRequests");

        // Count active users (status === "active")
        const totalActiveUsers = await usersCollection.countDocuments({ status: "active" });

        // Count all donation requests
        const totalDonationRequests = await donationRequestsCollection.countDocuments({});

        // Count successful donations (status === "done")
        const totalSuccessfulDonations = await donationRequestsCollection.countDocuments({ status: "done" });

        // Total fund raised (static)
        const totalFundRaised = 2.5;

        res.status(200).json({
            totalActiveUsers,
            totalDonationRequests,
            totalSuccessfulDonations,
            totalFundRaised
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


// START SERVER 
// For Vercel serverless
export default async function handler(req, res) {
    // Ensure database is connected
    await connectDB();
    // Handle the request through Express app
    return app(req, res);
}


// Local development server
if (process.env.NODE_ENV !== "production") {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
