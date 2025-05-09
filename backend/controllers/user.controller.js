import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";

// models
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

export const getUserProfile = async (req, res) => {
	const { username } = req.params;

	try {
		const user = await User.findOne({ username }).select("-password");
		if (!user) return res.status(404).json({ message: "User not found" });

		res.status(200).json(user);
	} catch (error) {
		console.log("Error in getUserProfile: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const followUnfollowUser = async (req, res) => {
	try {
		const { id } = req.params;
		const userToModify = await User.findById(id);
		const currentUser = await User.findById(req.user._id);

		if (id === req.user._id.toString()) {
			return res.status(400).json({ error: "You can't follow/unfollow yourself" });
		}

		if (!userToModify || !currentUser) return res.status(400).json({ error: "User not found" });

		const isFollowing = currentUser.following.includes(id);

		if (isFollowing) {
			// Unfollow the user
			await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });

			res.status(200).json({ message: "User unfollowed successfully" });
		} else {
			// Follow the user
			await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
			// Send notification to the user
			const newNotification = new Notification({
				type: "follow",
				from: req.user._id,
				to: userToModify._id,
			});

			await newNotification.save();

			res.status(200).json({ message: "User followed successfully" });
		}
	} catch (error) {
		console.log("Error in followUnfollowUser: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const getSuggestedUsers = async (req, res) => {
	try {
		const userId = req.user._id;

		const usersFollowedByMe = await User.findById(userId).select("following");

		const users = await User.aggregate([
			{
				$match: {
					_id: { $ne: userId },
				},
			},
			{ $sample: { size: 10 } },
		]);

		// 1,2,3,4,5,6,
		const filteredUsers = users.filter((user) => !usersFollowedByMe.following.includes(user._id));
		const suggestedUsers = filteredUsers.slice(0, 4);

		suggestedUsers.forEach((user) => (user.password = null));

		res.status(200).json(suggestedUsers);
	} catch (error) {
		console.log("Error in getSuggestedUsers: ", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const updateUser = async (req, res) => {
	const { fullName, email, username, currentPassword, newPassword, bio, link } = req.body;
	let { profileImg, coverImg } = req.body;

	const userId = req.user._id;

	try {
		let user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if ((!newPassword && currentPassword) || (!currentPassword && newPassword)) {
			return res.status(400).json({ error: "Please provide both current password and new password" });
		}

		if (currentPassword && newPassword) {
			const isMatch = await bcrypt.compare(currentPassword, user.password);
			if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });
			if (newPassword.length < 6) {
				return res.status(400).json({ error: "Password must be at least 6 characters long" });
			}

			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
		}

		// Detect if Cloudinary is properly configured with valid credentials (not default values)
		const isCloudinaryConfigured = 
			process.env.CLOUDINARY_CLOUD_NAME && 
			process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name' &&
			process.env.CLOUDINARY_CLOUD_NAME !== 'default-cloud-name' &&
			process.env.CLOUDINARY_API_KEY && 
			process.env.CLOUDINARY_API_KEY !== 'your-api-key' &&
			process.env.CLOUDINARY_API_KEY !== 'default-api-key' &&
			process.env.CLOUDINARY_API_SECRET && 
			process.env.CLOUDINARY_API_SECRET !== 'your-api-secret' &&
			process.env.CLOUDINARY_API_SECRET !== 'default-api-secret';

		// Upload profile image if provided
		if (profileImg) {
			try {
				if (!isCloudinaryConfigured) {
					console.log("Cloudinary not configured with valid credentials. Using data URL as fallback.");
					// Just use the dataURL as is without uploading to Cloudinary
					// This isn't ideal for production but allows development without Cloudinary
				} else {
					// Cloudinary is configured properly, proceed with upload
					if (user.profileImg && !user.profileImg.startsWith('data:')) {
						try {
							const publicId = user.profileImg.split("/").pop().split(".")[0];
							await cloudinary.uploader.destroy(publicId);
						} catch (destroyError) {
							console.log("Error deleting old profile image:", destroyError);
							// Continue even if old image deletion fails
						}
					}

					const uploadedResponse = await cloudinary.uploader.upload(profileImg);
					profileImg = uploadedResponse.secure_url;
				}
			} catch (cloudinaryError) {
				console.log("Cloudinary upload error for profile image:", cloudinaryError);
				// In development mode, allow falling back to data URL
				if (process.env.NODE_ENV === 'development') {
					console.log("Using data URL as fallback for profile image in development mode");
				} else {
					return res.status(400).json({ 
						error: "Failed to upload profile image. Please check your Cloudinary configuration."
					});
				}
			}
		}

		// Upload cover image if provided
		if (coverImg) {
			try {
				if (!isCloudinaryConfigured) {
					console.log("Cloudinary not configured with valid credentials. Using data URL as fallback.");
					// Just use the dataURL as is without uploading to Cloudinary
					// This isn't ideal for production but allows development without Cloudinary
				} else {
					// Cloudinary is configured properly, proceed with upload
					if (user.coverImg && !user.coverImg.startsWith('data:')) {
						try {
							const publicId = user.coverImg.split("/").pop().split(".")[0];
							await cloudinary.uploader.destroy(publicId);
						} catch (destroyError) {
							console.log("Error deleting old cover image:", destroyError);
							// Continue even if old image deletion fails
						}
					}

					const uploadedResponse = await cloudinary.uploader.upload(coverImg);
					coverImg = uploadedResponse.secure_url;
				}
			} catch (cloudinaryError) {
				console.log("Cloudinary upload error for cover image:", cloudinaryError);
				// In development mode, allow falling back to data URL
				if (process.env.NODE_ENV === 'development') {
					console.log("Using data URL as fallback for cover image in development mode");
				} else {
					return res.status(400).json({ 
						error: "Failed to upload cover image. Please check your Cloudinary configuration."
					});
				}
			}
		}

		user.fullName = fullName || user.fullName;
		user.email = email || user.email;
		user.username = username || user.username;
		user.bio = bio || user.bio;
		user.link = link || user.link;
		user.profileImg = profileImg || user.profileImg;
		user.coverImg = coverImg || user.coverImg;

		user = await user.save();

		// password should be null in response
		user.password = null;

		res.status(200).json(user);
	} catch (error) {
		console.log("Error in updateUser controller: ", error.message);
		res.status(500).json({ error: error.message });
	}
};
