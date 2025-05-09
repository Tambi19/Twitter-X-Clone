import { FaRegComment } from "react-icons/fa";
import { BiRepost } from "react-icons/bi";
import { FaRegHeart, FaHeart } from "react-icons/fa";
import { FaRegBookmark } from "react-icons/fa6";
import { FaTrash } from "react-icons/fa";
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "./LoadingSpinner";
import { formatPostDate } from "../../utils/date";

const Post = ({ post }) => {
	const [comment, setComment] = useState("");
	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();
	const postOwner = post.user;
	
	// Fix isLiked check to properly handle different data types
	const isLiked = useMemo(() => {
		if (!authUser || !post.likes) return false;
		
		return post.likes.some(likeId => {
			// Convert both IDs to string to ensure consistent comparison
			const likeIdStr = typeof likeId === 'object' ? likeId._id?.toString() : likeId?.toString();
			const authUserIdStr = authUser._id?.toString();
			return likeIdStr === authUserIdStr;
		});
	}, [post.likes, authUser]);

	// Add debugging log
	useEffect(() => {
		console.log(`Post ${post._id} like status:`, {
			liked: isLiked,
			likesCount: post.likes?.length || 0,
			likes: post.likes
		});
	}, [post.likes, isLiked, post._id]);

	console.log("Post likes:", post.likes, "Auth user ID:", authUser._id, "Is liked:", isLiked);

	const isMyPost = authUser._id === post.user._id;

	const formattedDate = formatPostDate(post.createdAt);

	const { mutate: deletePost, isPending: isDeleting } = useMutation({
		mutationFn: async () => {
			try {
				console.log("Attempting to delete post:", post._id);
				
				const res = await fetch(`/api/posts/${post._id}`, {
					method: "DELETE",
					headers: {
						"Content-Type": "application/json"
					}
				});

				// Check if response is ok before trying to parse JSON
				if (!res.ok) {
					const contentType = res.headers.get("content-type");
					if (contentType && contentType.includes("application/json")) {
						const data = await res.json();
						throw new Error(data.error || `Server error (${res.status}): ${data.message || "Unknown error"}`);
					} else {
						// Handle non-JSON response (like HTML)
						const text = await res.text();
						console.error("Server returned non-JSON response:", text);
						throw new Error(`Server error (${res.status}): The API returned an invalid response.`);
					}
				}
				
				// Parse JSON response
				const data = await res.json();
				console.log("Post deleted successfully:", data);
				return data;
			} catch (error) {
				console.error("Delete post error:", error);
				if (error.message.includes("Unexpected token")) {
					throw new Error("Server error: The API is not responding correctly. Make sure the backend server is running.");
				}
				throw new Error(error.message || "Failed to delete post");
			}
		},
		onSuccess: () => {
			toast.success("Post deleted successfully");
			
			// Optimistically remove the post from the cache
			queryClient.setQueryData(["posts"], (oldData) => {
				if (!oldData) return oldData;
				return oldData.filter(p => p._id !== post._id);
			});
			
			// Then invalidate the query to ensure data is consistent
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete post");
			// On error, refetch posts to ensure UI is in sync with server
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		}
	});

	const { mutate: likePost, isPending: isLiking } = useMutation({
		mutationFn: async () => {
			try {
				console.log("Sending like/unlike request for post:", post._id);
				
				const res = await fetch(`/api/posts/like/${post._id}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					}
				});
				
				// Check if response is ok before trying to parse JSON
				if (!res.ok) {
					const contentType = res.headers.get("content-type");
					if (contentType && contentType.includes("application/json")) {
						const data = await res.json();
						throw new Error(data.error || `Server error (${res.status}): ${data.message || "Unknown error"}`);
					} else {
						// Handle non-JSON response (like HTML)
						const text = await res.text();
						console.error("Server returned non-JSON response:", text);
						throw new Error(`Server error (${res.status}): The API returned an invalid response.`);
					}
				}
				
				// Parse JSON response
				const data = await res.json();
				console.log("Like action server response:", data);
				return data;
			} catch (error) {
				console.error("Like post error:", error);
				if (error.message.includes("Unexpected token")) {
					throw new Error("Server error: The API is not responding correctly. Make sure the backend server is running.");
				}
				throw new Error(error.message || "Failed to like post");
			}
		},
		onSuccess: (updatedPost) => {
			// Get the current like status before update
			const wasLiked = isLiked;
			
			console.log("Server response for like action:", {
				postId: updatedPost._id, 
				wasLiked, 
				newLikesCount: updatedPost.likes?.length || 0
			});
			
			// Show success message based on previous action
			if (wasLiked) {
				toast.success("Post unliked");
			} else {
				toast.success("Post liked");
			}
			
			// Ensure all posts in the cache are updated with the correct server response
			queryClient.setQueryData(["posts"], (oldData) => {
				if (!oldData) return oldData;
				return oldData.map((p) => {
					if (p._id === updatedPost._id) {
						// Make sure we're using the complete updated post from server
						return {
							...updatedPost,
							likes: updatedPost.likes || [] // Ensure likes is an array even if null/undefined
						};
					}
					return p;
				});
			});
			
			// Also invalidate the queries to ensure data is consistent
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to like/unlike post");
			// On error, refetch posts to ensure UI is in sync with server
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const { mutate: commentPost, isPending: isCommenting } = useMutation({
		mutationFn: async () => {
			if (!comment.trim()) {
				throw new Error("Comment cannot be empty");
			}
			
			try {
				console.log("Attempting to comment on post:", post._id);
				
				const res = await fetch(`/api/posts/comment/${post._id}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ text: comment }),
				});

				// Check if response is ok before trying to parse JSON
				if (!res.ok) {
					const contentType = res.headers.get("content-type");
					if (contentType && contentType.includes("application/json")) {
						const data = await res.json();
						throw new Error(data.error || `Server error (${res.status}): ${data.message || "Unknown error"}`);
					} else {
						// Handle non-JSON response (like HTML)
						const text = await res.text();
						console.error("Server returned non-JSON response:", text);
						throw new Error(`Server error (${res.status}): The API returned an invalid response.`);
					}
				}
				
				// Parse JSON response
				const data = await res.json();
				console.log("Comment added successfully:", data);
				return data;
			} catch (error) {
				console.error("Comment post error:", error);
				if (error.message.includes("Unexpected token")) {
					throw new Error("Server error: The API is not responding correctly. Make sure the backend server is running.");
				}
				throw new Error(error.message || "Failed to post comment");
			}
		},
		onSuccess: (updatedPost) => {
			toast.success("Comment posted successfully");
			setComment("");
			
			// Update the post in the cache to include the new comment
			queryClient.setQueryData(["posts"], (oldData) => {
				if (!oldData) return oldData;
				return oldData.map((p) => {
					if (p._id === post._id) {
						return updatedPost;
					}
					return p;
				});
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to post comment");
		},
	});

	const handleDeletePost = () => {
		// Add confirmation for delete action
		if (window.confirm("Are you sure you want to delete this post?")) {
			deletePost();
		}
	};

	const handlePostComment = (e) => {
		e.preventDefault();
		if (isCommenting || !comment.trim()) return;
		commentPost();
	};

	const handleLikePost = () => {
		if (isLiking) return;
		
		// Create a local optimistic update to immediately reflect change in UI
		const optimisticPost = { ...post };
		
		if (isLiked) {
			// Optimistically remove user from likes
			optimisticPost.likes = optimisticPost.likes.filter(
				id => (typeof id === 'object' ? id._id?.toString() : id?.toString()) !== authUser._id?.toString()
			);
			console.log("Optimistically unliking post", post._id, "new count:", optimisticPost.likes.length);
		} else {
			// Optimistically add user to likes
			optimisticPost.likes = [...(optimisticPost.likes || []), authUser._id];
			console.log("Optimistically liking post", post._id, "new count:", optimisticPost.likes.length);
		}
		
		// Immediately update UI with optimistic change
		queryClient.setQueryData(["posts"], (oldData) => {
			if (!oldData) return oldData;
			return oldData.map((p) => {
				if (p._id === post._id) {
					return optimisticPost;
				}
				return p;
			});
		});
		
		// Then perform the actual API call
		likePost();
	};

	return (
		<>
			<div className='flex gap-2 items-start p-4 border-b border-gray-700'>
				<div className='avatar'>
					<Link to={`/profile/${postOwner.username}`} className='w-8 rounded-full overflow-hidden'>
						<img src={postOwner.profileImg || "/avatar-placeholder.png"} />
					</Link>
				</div>
				<div className='flex flex-col flex-1'>
					<div className='flex gap-2 items-center'>
						<Link to={`/profile/${postOwner.username}`} className='font-bold'>
							{postOwner.fullName}
						</Link>
						<span className='text-gray-700 flex gap-1 text-sm'>
							<Link to={`/profile/${postOwner.username}`}>@{postOwner.username}</Link>
							<span>·</span>
							<span>{formattedDate}</span>
						</span>
						{isMyPost && (
							<span className='flex justify-end flex-1'>
								{!isDeleting && (
									<FaTrash className='cursor-pointer hover:text-red-500' onClick={handleDeletePost} />
								)}

								{isDeleting && <LoadingSpinner size='sm' />}
							</span>
						)}
					</div>
					<div className='flex flex-col gap-3 overflow-hidden'>
						<span>{post.text}</span>
						{post.img && (
							<img
								src={post.img}
								className='h-80 object-contain rounded-lg border border-gray-700'
								alt=''
							/>
						)}
					</div>
					<div className='flex justify-between mt-3'>
						<div className='flex gap-4 items-center w-2/3 justify-between'>
							<div
								className='flex gap-1 items-center cursor-pointer group'
								onClick={() => {
									try {
										const modal = document.getElementById(`comments_modal${post._id}`);
										if (modal) {
											modal.showModal();
										} else {
											console.error(`Modal with ID comments_modal${post._id} not found`);
										}
									} catch (error) {
										console.error("Error showing comments modal:", error);
									}
								}}
							>
								<FaRegComment className='w-4 h-4  text-slate-500 group-hover:text-sky-400' />
								<span className='text-sm text-slate-500 group-hover:text-sky-400'>
									{post.comments.length}
								</span>
							</div>

							{/* We're using Modal Component from DaisyUI */}
							<dialog id={`comments_modal${post._id}`} className='modal border-none outline-none'>
								<div className='modal-box rounded border border-gray-600'>
									<h3 className='font-bold text-lg mb-4'>COMMENTS</h3>
									<div className='flex flex-col gap-3 max-h-60 overflow-auto'>
										{post.comments.length === 0 && (
											<p className='text-sm text-slate-500'>
												No comments yet 🤔 Be the first one 😉
											</p>
										)}
										{post.comments.map((comment) => (
											<div key={comment._id} className='flex gap-2 items-start'>
												<div className='avatar'>
													<div className='w-8 rounded-full'>
														<img
															src={comment.user.profileImg || "/avatar-placeholder.png"}
														/>
													</div>
												</div>
												<div className='flex flex-col'>
													<div className='flex items-center gap-1'>
														<span className='font-bold'>{comment.user.fullName}</span>
														<span className='text-gray-700 text-sm'>
															@{comment.user.username}
														</span>
													</div>
													<div className='text-sm'>{comment.text}</div>
												</div>
											</div>
										))}
									</div>
									<form
										className='flex gap-2 items-center mt-4 border-t border-gray-600 pt-2'
										onSubmit={handlePostComment}
									>
										<textarea
											className='textarea w-full p-1 rounded text-md resize-none border focus:outline-none border-gray-800 text-white bg-transparent'
											placeholder='Add a comment...'
											value={comment}
											onChange={(e) => setComment(e.target.value)}
										/>
										<button className='btn btn-primary rounded-full btn-sm text-white px-4'>
											{isCommenting ? <LoadingSpinner size='md' /> : "Post"}
										</button>
									</form>
								</div>
								<form method='dialog' className='modal-backdrop'>
									<button className='outline-none'>close</button>
								</form>
							</dialog>
							<div className='flex gap-1 items-center group cursor-pointer'>
								<BiRepost className='w-6 h-6  text-slate-500 group-hover:text-green-500' />
								<span className='text-sm text-slate-500 group-hover:text-green-500'>0</span>
							</div>
							<div className='flex gap-1 items-center group cursor-pointer' onClick={handleLikePost}>
								{isLiking && <LoadingSpinner size='sm' />}
								{!isLiked && !isLiking && (
									<FaRegHeart className='w-4 h-4 cursor-pointer text-slate-500 group-hover:text-pink-500' />
								)}
								{isLiked && !isLiking && (
									<FaHeart className='w-4 h-4 cursor-pointer text-pink-500' />
								)}

								<span
									className={`text-sm group-hover:text-pink-500 ${
										isLiked ? "text-pink-500" : "text-slate-500"
									}`}
								>
									{post.likes ? post.likes.length : 0}
								</span>
							</div>
						</div>
						<div className='flex w-1/3 justify-end gap-2 items-center'>
							<FaRegBookmark className='w-4 h-4 text-slate-500 cursor-pointer' />
						</div>
					</div>
				</div>
			</div>
		</>
	);
};
export default Post;
