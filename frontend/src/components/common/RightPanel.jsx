import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import toast from "react-hot-toast";

import useFollow from "../../hooks/useFollow";

import RightPanelSkeleton from "../skeletons/RightPanelSkeleton";
import LoadingSpinner from "./LoadingSpinner";

const RightPanel = () => {
	const { data: suggestedUsers, isLoading, error, refetch } = useQuery({
		queryKey: ["suggestedUsers"],
		queryFn: async () => {
			try {
				const res = await fetch("/api/users/suggested");
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong!");
				}
				return data;
			} catch (error) {
				console.error("Error fetching suggested users:", error);
				throw new Error(error.message || "Failed to load suggested users");
			}
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	useEffect(() => {
		if (error) {
			toast.error(error.message || "Failed to load suggested users");
			// Try to refetch after 5 seconds if there was an error
			setTimeout(() => refetch(), 5000);
		}
	}, [error, refetch]);

	const { follow, isPending } = useFollow();

	// If still loading or no users yet, show skeleton
	if (isLoading) {
		return (
			<div className='hidden lg:block my-4 mx-2'>
				<div className='bg-[#16181C] p-4 rounded-md sticky top-2'>
					<p className='font-bold'>Who to follow</p>
					<div className='flex flex-col gap-4'>
						<RightPanelSkeleton />
						<RightPanelSkeleton />
						<RightPanelSkeleton />
					</div>
				</div>
			</div>
		);
	}

	// If no suggested users, hide the panel
	if (!suggestedUsers || suggestedUsers.length === 0) {
		return <div className='md:w-64 w-0'></div>;
	}

	return (
		<div className='hidden lg:block my-4 mx-2'>
			<div className='bg-[#16181C] p-4 rounded-md sticky top-2'>
				<p className='font-bold'>Who to follow</p>
				<div className='flex flex-col gap-4'>
					{suggestedUsers?.map((user) => (
						<Link
							to={`/profile/${user.username}`}
							className='flex items-center justify-between gap-4'
							key={user._id}
						>
							<div className='flex gap-2 items-center'>
								<div className='avatar'>
									<div className='w-8 rounded-full'>
										<img src={user.profileImg || "/avatar-placeholder.png"} />
									</div>
								</div>
								<div className='flex flex-col'>
									<span className='font-semibold tracking-tight truncate w-28'>
										{user.fullName}
									</span>
									<span className='text-sm text-slate-500'>@{user.username}</span>
								</div>
							</div>
							<div>
								<button
									className='btn bg-white text-black hover:bg-white hover:opacity-90 rounded-full btn-sm'
									onClick={(e) => {
										e.preventDefault();
										follow(user._id);
									}}
								>
									{isPending ? <LoadingSpinner size='sm' /> : "Follow"}
								</button>
							</div>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
};
export default RightPanel;
