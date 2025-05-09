import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

export const createPost = async (req, res) => {
	try {
		const { text } = req.body;
		let { img } = req.body;
		const userId = req.user._id.toString();

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (!text && !img) {
			return res.status(400).json({ error: "Post must have text or image" });
		}

		// Check if Cloudinary credentials are properly configured
		if (img) {
			try {
				// Check if Cloudinary is properly configured
				if (
					!process.env.CLOUDINARY_CLOUD_NAME ||
					process.env.CLOUDINARY_CLOUD_NAME === "your-cloud-name" ||
					!process.env.CLOUDINARY_API_KEY ||
					!process.env.CLOUDINARY_API_SECRET ||
					process.env.CLOUDINARY_API_SECRET === "your-api-secret"
				) {
					console.log("Cloudinary not configured. Using image as data URL.");
					// Skip image upload to Cloudinary if not configured
				} else {
					const uploadedResponse = await cloudinary.uploader.upload(img);
					img = uploadedResponse.secure_url;
				}
			} catch (cloudinaryError) {
				console.log("Cloudinary upload error:", cloudinaryError);
				// Continue with the original image (as data URL) if upload fails
			}
		}

		const newPost = new Post({
			user: userId,
			text,
			img,
		});

		await newPost.save();
		res.status(201).json(newPost);
	} catch (error) {
		console.log("Error in createPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const deletePost = async (req, res) => {
	try {
		console.log(`Delete post request for post ID: ${req.params.id} from user ${req.user._id}`);
		
		const post = await Post.findById(req.params.id);
		if (!post) {
			console.log(`Post not found: ${req.params.id}`);
			return res.status(404).json({ error: "Post not found" });
		}

		if (post.user.toString() !== req.user._id.toString()) {
			console.log(`Unauthorized delete attempt: User ${req.user._id} trying to delete post ${req.params.id} owned by ${post.user}`);
			return res.status(401).json({ error: "You are not authorized to delete this post" });
		}

		// Handle image deletion safely
		if (post.img) {
			try {
				// Check if Cloudinary is properly configured
				if (
					!process.env.CLOUDINARY_CLOUD_NAME ||
					process.env.CLOUDINARY_CLOUD_NAME === "your-cloud-name" ||
					!process.env.CLOUDINARY_API_KEY ||
					!process.env.CLOUDINARY_API_SECRET
				) {
					console.log("Cloudinary not configured. Skipping image deletion.");
				} else {
					// Extract the public ID from the Cloudinary URL
					const imgId = post.img.split("/").pop().split(".")[0];
					console.log(`Attempting to delete image from Cloudinary: ${imgId}`);
					await cloudinary.uploader.destroy(imgId);
					console.log(`Successfully deleted image from Cloudinary: ${imgId}`);
				}
			} catch (cloudinaryError) {
				console.log("Error deleting image from Cloudinary:", cloudinaryError);
				// Continue with post deletion even if image deletion fails
			}
		}

		console.log(`Deleting post ${req.params.id} from database`);
		await Post.findByIdAndDelete(req.params.id);

		console.log(`Post ${req.params.id} successfully deleted`);
		res.status(200).json({ message: "Post deleted successfully" });
	} catch (error) {
		console.log("Error in deletePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const commentOnPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;

		if (!text) {
			return res.status(400).json({ error: "Text field is required" });
		}
		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const comment = { user: userId, text };

		post.comments.push(comment);
		await post.save();

		res.status(200).json(post);
	} catch (error) {
		console.log("Error in commentOnPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const likeUnlikePost = async (req, res) => {
	try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		console.log(`Like/unlike request from user ${userId} for post ${postId}`);
		
		// Find the post to like/unlike
		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Check if user already liked this post
		const userLikedPost = post.likes.some(id => id.toString() === userId.toString());
		console.log(`User ${userId} has ${userLikedPost ? 'liked' : 'not liked'} post ${postId}`);
		console.log(`Current likes count: ${post.likes.length}`);

		if (userLikedPost) {
			// Unlike post - user already liked it
			console.log(`User ${userId} is unliking post ${postId}`);
			post.likes = post.likes.filter(id => id.toString() !== userId.toString());
			await post.save();
			await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });
			console.log(`Post ${postId} unliked. New likes count: ${post.likes.length}`);
		} else {
			// Like post - user hasn't liked it yet
			console.log(`User ${userId} is liking post ${postId}`);
			post.likes.push(userId);
			await post.save();
			await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
			console.log(`Post ${postId} liked. New likes count: ${post.likes.length}`);

			try {
				const notification = new Notification({
					from: userId,
					to: post.user,
					type: "like",
				});
				await notification.save();
				console.log(`Notification created for like on post ${postId}`);
			} catch (notificationError) {
				console.log("Error creating notification:", notificationError);
				// Continue even if notification fails
			}
		}

		// Return the full updated post with populated fields
		const updatedPost = await Post.findById(postId)
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});
		
		console.log(`Returning updated post with likes count: ${updatedPost.likes.length}`);
		res.status(200).json(updatedPost);
	} catch (error) {
		console.log("Error in likeUnlikePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getAllPosts = async (req, res) => {
	try {
		const posts = await Post.find()
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		if (posts.length === 0) {
			return res.status(200).json([]);
		}

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getAllPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getLikedPosts = async (req, res) => {
	const userId = req.params.id;

	try {
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const likedPosts = await Post.find({ _id: { $in: user.likedPosts } })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(likedPosts);
	} catch (error) {
		console.log("Error in getLikedPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getFollowingPosts = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const following = user.following;

		const feedPosts = await Post.find({ user: { $in: following } })
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(feedPosts);
	} catch (error) {
		console.log("Error in getFollowingPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getUserPosts = async (req, res) => {
	try {
		const { username } = req.params;

		const user = await User.findOne({ username });
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find({ user: user._id })
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(posts);
	} catch (error) {
		console.log("Error in getUserPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
