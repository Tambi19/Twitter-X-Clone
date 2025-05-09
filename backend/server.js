import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import notificationRoutes from "./routes/notification.route.js";

import connectMongoDB from "./db/connectMongoDB.js";

// Try to load .env from multiple possible locations
const rootEnvPath = path.resolve(process.cwd(), '.env');
const backendEnvPath = path.resolve(process.cwd(), 'backend', '.env');

if (fs.existsSync(rootEnvPath)) {
	console.log('Loading .env from project root:', rootEnvPath);
	dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
	console.log('Loading .env from backend directory:', backendEnvPath);
	dotenv.config({ path: backendEnvPath });
} else {
	console.log('No .env file found. Using default environment variables.');
	dotenv.config();
}

// Configure Cloudinary with fallback values
try {
	cloudinary.config({
		cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "default-cloud-name",
		api_key: process.env.CLOUDINARY_API_KEY || "default-api-key",
		api_secret: process.env.CLOUDINARY_API_SECRET || "default-api-secret",
	});
	console.log("Cloudinary configured");
} catch (error) {
	console.log("Error configuring Cloudinary:", error.message);
}

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.json({ limit: "5mb" })); // to parse req.body
// limit shouldn't be too high to prevent DOS
app.use(express.urlencoded({ extended: true })); // to parse form data(urlencoded)

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));

	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
	});
}

// Print the current environment variables for debugging
console.log("Environment variables:");
console.log("PORT:", process.env.PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "[SET]" : "[NOT SET]");
console.log("MONGO_URI:", process.env.MONGO_URI ? "[SET]" : "[NOT SET]");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "[SET]" : "[NOT SET]");

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	connectMongoDB();
});
