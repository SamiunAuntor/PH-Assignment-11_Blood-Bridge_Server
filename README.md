# Blood Bridge - Blood Donation Management System

**Server Side Repository**: [Blood Bridge Server](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Server)  
**Client Side Repository**: [Blood Bridge Client](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Client)

A secure RESTful API backend for managing blood donation requests and connecting donors with recipients. Built with Node.js, Express.js, MongoDB, and Firebase Admin SDK. Provides role-based access control for Admin, Volunteer, and Donor roles.

---

## 📋 Table of Contents

* [Project Overview](#-project-overview)
* [Features](#-features)
* [Tech Stack](#-tech-stack)
* [Prerequisites](#-prerequisites)
* [Installation](#-installation)
* [Environment Variables](#-environment-variables)
* [Running the Project](#-running-the-project)
* [API Endpoints](#-api-endpoints)
* [Authentication](#-authentication)
* [Database Schema](#-database-schema)
* [Role-Based Access Control](#-role-based-access-control)
* [Deployment](#-deployment)
* [Project Structure](#-project-structure)
* [Contributing](#-contributing)

---

## 🎯 Project Overview

Blood Bridge Server is the backend API for a comprehensive blood donation management platform. It facilitates secure user authentication, donation request management, donor search functionality, and administrative controls. The server uses Firebase Admin SDK for token verification and MongoDB for data persistence.

---

## ✨ Features

### Authentication & Authorization
* Firebase Admin SDK integration for secure token verification
* Role-based access control (Admin, Donor, Volunteer)
* Protected routes with middleware authentication
* User status management (active/blocked)

### User Management
* User registration with profile creation
* User profile retrieval and updates
* Role and status management (Admin only)
* User blocking/unblocking functionality

### Donation Request Management
* Create, read, update, and delete donation requests
* Status tracking (pending → inprogress → done/canceled)
* Pagination support for large datasets
* Status-based filtering
* Donor assignment to requests
* Role-specific access controls

### Search Functionality
* Public donor search by blood group and location
* Filter by district and upazila
* Returns active donors only

### Admin Features
* View all users with pagination
* Update user roles (donor → volunteer → admin)
* Block/unblock users
* Manage all donation requests
* View statistics (total users, requests)

### Volunteer Features
* View all donation requests
* Update donation request status
* View statistics

---

## 🛠 Tech Stack

* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB
* **Authentication**: Firebase Admin SDK
* **Security**: CORS, JWT (via Firebase)
* **Environment Management**: dotenv

### NPM Packages

* `express` - Web framework for Node.js
* `mongodb` - MongoDB driver for Node.js
* `firebase-admin` - Firebase Admin SDK for server-side operations
* `cors` - Cross-Origin Resource Sharing middleware
* `dotenv` - Environment variable management
* `bcryptjs` - Password hashing (if needed)
* `jsonwebtoken` - JWT token handling (if needed)

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

* Node.js (v14 or higher)
* MongoDB (local or MongoDB Atlas account)
* Firebase project with Admin SDK credentials
* Git

---

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Server.git
   cd blood-bridge-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_connection_string
   PORT=5000
   ```

4. **Set up Firebase Admin SDK**
   * Download your Firebase service account JSON file
   * Place it in the root directory as `bloodbridge-firebase-adminsdk.json`
   * ⚠️ **Important**: This file is in `.gitignore` and should never be committed to version control

---

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Connection String
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/BloodBridge

# Server Port (optional, defaults to 5000)
PORT=5000
```

### Firebase Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key
3. Download the JSON file
4. Rename it to `bloodbridge-firebase-adminsdk.json`
5. Place it in the root directory

---

## 🏃 Running the Project

### Development Mode

```bash
node index.js
```

Or with nodemon (auto-restart on changes):

```bash
npx nodemon index.js
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

### Production Mode

```bash
NODE_ENV=production node index.js
```

---

## 📡 API Endpoints

### Root
* `GET /` - Server health check

### User APIs

#### Public Endpoints
* `POST /register-user` - Register a new user
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "bloodGroup": "O+",
    "district": "Dhaka",
    "upazila": "Dhanmondi",
    "avatar": "https://image-url.com/avatar.jpg"
  }
  ```

* `GET /get-user-role?email=user@example.com` - Get user role by email

* `GET /search-donors?bloodGroup=O+&district=Dhaka&upazila=Dhanmondi` - Search donors (public)

#### Protected Endpoints (Requires Firebase Token)
* `GET /dashboard/profile` - Get logged-in user profile
* `PUT /dashboard/profile` - Update user profile
  ```json
  {
    "name": "John Doe",
    "bloodGroup": "O+",
    "district": "Dhaka",
    "upazila": "Dhanmondi",
    "avatar": "https://image-url.com/avatar.jpg"
  }
  ```

### Donation Request APIs

#### Public Endpoints
* `GET /donation-requests` - Get all pending donation requests

#### Protected Endpoints (Requires Firebase Token)
* `POST /dashboard/create-donation-request` - Create a donation request
  ```json
  {
    "recipientName": "Jane Doe",
    "recipientDistrict": "Dhaka",
    "recipientUpazila": "Dhanmondi",
    "hospitalName": "Dhaka Medical College Hospital",
    "address": "Zahir Raihan Rd, Dhaka",
    "bloodGroup": "O+",
    "donationDate": "2024-01-15",
    "donationTime": "10:00 AM",
    "message": "Urgent blood donation needed"
  }
  ```

* `GET /dashboard/my-donation-requests?status=pending&page=1&limit=10` - Get user's donation requests (with pagination and filtering)

* `GET /dashboard/all-blood-donation-request?status=pending&page=1&limit=10` - Get all donation requests (Admin/Volunteer only)

* `GET /donation-request/:id` - Get single donation request (public route, requires auth)

* `GET /dashboard/donation-request/:id` - Get single donation request (dashboard)

* `PUT /dashboard/donation-request/:id` - Update donation request (Admin or Requester only)

* `DELETE /dashboard/donation-request/:id` - Delete donation request (Admin or Requester only)

* `PUT /donation-request/:id/donate` - Donate to a request (changes status to inprogress)
  ```json
  {
    "donorName": "John Doe",
    "donorEmail": "john@example.com"
  }
  ```

* `PUT /dashboard/donation-request/:id/status` - Update donation status (Admin/Volunteer only)
  ```json
  {
    "status": "done"
  }
  ```

* `PUT /dashboard/my-donation-request/:id/status` - Update own request status (Donor only, inprogress → done/canceled)
  ```json
  {
    "status": "done"
  }
  ```

### Admin APIs (Requires Admin Role)

* `GET /dashboard/all-users?status=active&page=1&limit=10` - Get all users (with pagination and filtering)

* `PUT /dashboard/user/:id` - Update user (role, status, etc.)
  ```json
  {
    "role": "volunteer",
    "status": "active"
  }
  ```

* `GET /dashboard/total-users-count` - Get total user count (Admin/Volunteer)

---

## 🔒 Authentication

The API uses Firebase Admin SDK for authentication. All protected routes require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

### Authentication Flow

1. Client authenticates with Firebase (client-side)
2. Client receives Firebase ID token
3. Client includes token in `Authorization: Bearer <token>` header
4. Server verifies token using Firebase Admin SDK
5. Server extracts user email from token
6. Server checks user role and permissions from MongoDB

### Middleware

* `verifyFirebaseToken` - Verifies Firebase ID token
* `requireRole(role)` - Ensures user has specific role
* `requireAnyRole([roles])` - Ensures user has one of the specified roles

---

## 🗄 Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  bloodGroup: String, // A+, A-, B+, B-, AB+, AB-, O+, O-
  district: String,
  upazila: String,
  avatar: String (URL),
  role: String, // "donor" | "volunteer" | "admin"
  status: String, // "active" | "blocked"
  createdAt: Date
}
```

### Donation Requests Collection

```javascript
{
  _id: ObjectId,
  requesterName: String,
  requesterEmail: String,
  recipientName: String,
  recipientDistrict: String,
  recipientUpazila: String,
  hospitalName: String,
  address: String,
  bloodGroup: String, // A+, A-, B+, B-, AB+, AB-, O+, O-
  donationDate: String,
  donationTime: String,
  message: String,
  status: String, // "pending" | "inprogress" | "done" | "canceled"
  donorName: String (optional),
  donorEmail: String (optional),
  createdAt: Date
}
```

---

## 👥 Role-Based Access Control

### 🌐 Admin
* Full access to all endpoints
* Can manage users (view, block/unblock, change roles)
* Can manage all donation requests (CRUD operations)
* Can view statistics

### 🩸 Donor
* Can create, view, edit, and delete own donation requests
* Can view own profile and update it
* Can search for donors
* Can donate to requests (change status from pending to inprogress)
* Can update own request status (inprogress → done/canceled)
* Cannot access admin endpoints

### 🤝 Volunteer
* Can view all donation requests
* Can update donation request status only
* Can view statistics
* Cannot edit or delete requests
* Cannot manage users

---

## 🚀 Deployment

### Recommended Platforms

* **Vercel** - Serverless functions
* **Render** - Full-stack hosting
* **Railway** - Container-based deployment
* **Heroku** - Platform as a service

### Deployment Steps

1. **Set up MongoDB Atlas**
   * Create a cluster
   * Get connection string
   * Add your IP to whitelist

2. **Set up Firebase**
   * Create Firebase project
   * Generate service account key
   * Download JSON file

3. **Configure Environment Variables**
   * Add `MONGO_URI` to deployment platform
   * Add `PORT` (if required)
   * Upload Firebase service account JSON securely

4. **Deploy**
   * Connect your repository
   * Configure build settings
   * Deploy

### Important Deployment Notes

* ✅ Ensure CORS is configured to allow client domain
* ✅ Add client domain to Firebase authorized domains
* ✅ Verify MongoDB connection string is correct
* ✅ Ensure Firebase service account JSON is accessible
* ✅ Test all endpoints after deployment
* ✅ Monitor server logs for errors

---

## 📁 Project Structure

```
blood-bridge-server/
├── index.js                          # Main server file
├── package.json                      # Dependencies and scripts
├── package-lock.json                 # Locked dependencies
├── .env                              # Environment variables (not in repo)
├── .gitignore                        # Git ignore rules
├── bloodbridge-firebase-adminsdk.json # Firebase Admin SDK credentials (not in repo)
└── README.md                         # Project documentation
```

### Code Organization

* **Imports & Setup** - Express, MongoDB, Firebase Admin SDK initialization
* **Middlewares** - Authentication and authorization middlewares
* **User APIs** - User registration, profile management
* **Donation Request APIs** - CRUD operations for donation requests
* **Admin APIs** - User management, statistics
* **Public APIs** - Search donors, get pending requests
* **Server Start** - Database connection and server listening

---

## 🔧 API Response Format

### Success Response

```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response

```json
{
  "message": "Error message"
}
```

### Paginated Response

```json
{
  "total": 100,
  "page": 1,
  "limit": 10,
  "requests": [ ... ]
}
```

---

## 🧪 Testing Endpoints

You can test the API using:

* **Postman** - Import collection and test endpoints
* **cURL** - Command-line tool
* **Thunder Client** - VS Code extension
* **REST Client** - VS Code extension

### Example cURL Request

```bash
# Register User
curl -X POST http://localhost:5000/register-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "bloodGroup": "O+",
    "district": "Dhaka",
    "upazila": "Dhanmondi",
    "avatar": "https://example.com/avatar.jpg"
  }'

# Get Profile (with Firebase token)
curl -X GET http://localhost:5000/dashboard/profile \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add YourFeature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

---

## 📝 Notes

* All sensitive files (`.env`, Firebase credentials) are in `.gitignore`
* Server uses Firebase Admin SDK for token verification (not custom JWT)
* MongoDB connection is established at server startup
* All protected routes require Firebase authentication token
* Role-based access is enforced through middleware
* Pagination is implemented for large datasets
* Status filtering is available for requests and users

---

## 🔗 Related Links

* **Server Repository**: [Blood Bridge Server](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Server)
* **Client Repository**: [Blood Bridge Client](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Client)
* **MongoDB Atlas**: [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
* **Firebase Console**: [https://console.firebase.google.com](https://console.firebase.google.com)
* **Express.js Documentation**: [https://expressjs.com](https://expressjs.com)

---

## 📄 License

This project is private and not licensed for public use.

---

## 👤 Author

**Samiun Auntor**

* GitHub: @SamiunAuntor
* Server Repository: [Blood Bridge Server](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Server)
* Client Repository: [Blood Bridge Client](https://github.com/SamiunAuntor/PH-Assignment-11_Blood-Bridge_Client)

---

**Built with ❤️ using Node.js, Express.js, MongoDB, and Firebase Admin SDK**

---

## ⚠️ Important Reminders

* Ensure all environment variables are properly configured
* Never commit `.env` or Firebase credentials to version control
* Test all endpoints after deployment
* Monitor server logs for errors
* Keep Firebase service account JSON secure
* Verify CORS configuration matches client domain
* Ensure MongoDB connection string is correct
* Test authentication flow end-to-end

