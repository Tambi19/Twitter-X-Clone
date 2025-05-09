import Post from "./Post";
import PostSkeleton from "../skeletons/PostSkeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import toast from "react-hot-toast";

const Posts = ({ feedType, username, userId }) => {
	const getPostEndpoint = () => {
		switch (feedType) {
			case "forYou":
				return "/api/posts/all";
			case "following":
				return "/api/posts/following";
			case "posts":
				return `/api/posts/user/${username}`;
			case "likes":
				return `/api/posts/likes/${userId}`;
			default:
				return "/api/posts/all";
		}
	};

	const POST_ENDPOINT = getPostEndpoint();

	const {
		data: posts,
		isLoading,
		refetch,
		isRefetching,
		error,
	} = useQuery({
		queryKey: ["posts", feedType, username, userId],
		queryFn: async () => {
			try {
				console.log(`Fetching posts from: ${POST_ENDPOINT}`);
				const res = await fetch(POST_ENDPOINT);
				
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
				console.log(`Fetched ${data.length} posts`);
				return data;
			} catch (error) {
				console.error("Error fetching posts:", error);
				if (error.message.includes("Unexpected token")) {
					throw new Error("Server error: The API is not responding correctly. Make sure the backend server is running.");
				}
				throw new Error(error.message || "Failed to fetch posts");
			}
		},
		staleTime: 1000 * 60, // 1 minute
		retry: 2, // Retry failed requests up to 2 times
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
	});

	useEffect(() => {
		if (error) {
			console.error("Posts fetch error:", error);
			toast.error(error.message || "Failed to load posts");
			// Try to refetch after 5 seconds on error
			const timer = setTimeout(() => refetch(), 5000);
			return () => clearTimeout(timer);
		}
	}, [error, refetch]);

	useEffect(() => {
		refetch();
	}, [feedType, refetch, username, userId]);

	return (
		<>
			{(isLoading || isRefetching) && (
				<div className='flex flex-col justify-center'>
					<PostSkeleton />
					<PostSkeleton />
					<PostSkeleton />
				</div>
			)}
			{!isLoading && !isRefetching && posts?.length === 0 && (
				<p className='text-center my-4 p-4'>No posts in this tab. {feedType === "following" ? "Follow some users to see their posts!" : "Be the first to post something!"}</p>
			)}
			{!isLoading && !isRefetching && posts && (
				<div>
					{posts.map((post) => (
						<Post key={post._id} post={post} />
					))}
				</div>
			)}
		</>
	);
};
export default Posts;
