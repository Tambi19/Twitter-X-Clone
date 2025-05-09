import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = (userId, res) => {
	// Use a default JWT secret if the environment variable is not set
	const secret = process.env.JWT_SECRET || "twitter-clone-default-secret-key-for-development";
	
	const token = jwt.sign({ userId }, secret, {
		expiresIn: "15d",
	});

	res.cookie("jwt", token, {
		maxAge: 15 * 24 * 60 * 60 * 1000, //MS
		httpOnly: true, // prevent XSS attacks cross-site scripting attacks
		sameSite: "strict", // CSRF attacks cross-site request forgery attacks
		secure: process.env.NODE_ENV !== "development",
	});
};
