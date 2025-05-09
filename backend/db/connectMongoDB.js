import mongoose from "mongoose";

const connectMongoDB = async () => {
	try {
		// Use the environment variable if available, otherwise use a default local MongoDB connection string
		const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/twitter-clone";
		
		console.log("Attempting to connect to MongoDB with URI:", mongoURI);
		
		await mongoose.connect(mongoURI);
		console.log("Connected to MongoDB");
	} catch (error) {
		console.log("Error connection to mongoDB:", error.message);
		process.exit(1);
	}
};

export default connectMongoDB;
