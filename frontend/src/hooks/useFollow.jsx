import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const useFollow = () => {
	const queryClient = useQueryClient();

	const { mutate: follow, isPending } = useMutation({
		mutationFn: async (userId) => {
			try {
				const res = await fetch(`/api/users/follow/${userId}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					}
				});

				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong!");
				}
				return data;
			} catch (error) {
				throw new Error(error.message || "Failed to follow user");
			}
		},
		onSuccess: () => {
			toast.success("User followed successfully");
			queryClient.invalidateQueries({ queryKey: ["suggestedUsers"] });
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["userProfile"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to follow user");
		},
	});

	return { follow, isPending };
};

export default useFollow;
