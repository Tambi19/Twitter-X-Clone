import { CiImageOn } from "react-icons/ci";
import { BsEmojiSmileFill } from "react-icons/bs";
import { useRef, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

const CreatePost = () => {
	const [text, setText] = useState("");
	const [img, setImg] = useState(null);
	const imgRef = useRef(null);

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	const {
		mutate: createPost,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async ({ text, img }) => {
			if (!text.trim() && !img) {
				throw new Error("Post cannot be empty");
			}
			
			try {
				console.log("Creating post with:", { text, hasImage: !!img });
				
				const res = await fetch("/api/posts/create", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ text, img }),
				});
				
				if (!res.ok) {
					const contentType = res.headers.get("content-type");
					if (contentType && contentType.includes("application/json")) {
						const data = await res.json();
						throw new Error(data.error || `Server error (${res.status}): ${data.message || "Unknown error"}`);
					} else {
						const text = await res.text();
						console.error("Server returned non-JSON response:", text);
						throw new Error(`Server error (${res.status}): The API returned an invalid response.`);
					}
				}
				
				const data = await res.json();
				console.log("Post created successfully:", data);
				return data;
			} catch (error) {
				console.error("Post creation error:", error);
				if (error.message.includes("Unexpected token")) {
					throw new Error("Server error: The API is not responding correctly. Make sure the backend server is running.");
				}
				if (error.message.includes("413") || error.message.includes("request entity too large")) {
					throw new Error("Image is too large. Please use a smaller image (max 5MB).");
				}
				throw new Error(error.message || "Failed to create post");
			}
		},

		onSuccess: () => {
			setText("");
			setImg(null);
			if (imgRef.current) imgRef.current.value = null;
			toast.success("Post created successfully");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create post");
		}
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		if (isPending) return;
		if (!text.trim() && !img) {
			toast.error("Post cannot be empty");
			return;
		}
		createPost({ text, img });
	};

	const handleImgChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = () => {
				setImg(reader.result);
			};
			reader.readAsDataURL(file);
		}
	};

	return (
		<div className='flex p-4 items-start gap-4 border-b border-gray-700'>
			<div className='avatar'>
				<div className='w-8 rounded-full'>
					<img src={authUser.profileImg || "/avatar-placeholder.png"} />
				</div>
			</div>
			<form className='flex flex-col gap-2 w-full' onSubmit={handleSubmit}>
				<textarea
					className='textarea w-full p-0 text-lg resize-none border-none focus:outline-none border-gray-800 text-white bg-transparent'
					placeholder='What is happening?!'
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				{img && (
					<div className='relative w-72 mx-auto'>
						<IoCloseSharp
							className='absolute top-0 right-0 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer'
							onClick={() => {
								setImg(null);
								imgRef.current.value = null;
							}}
						/>
						<img src={img} className='w-full mx-auto h-72 object-contain rounded' />
					</div>
				)}

				<div className='flex justify-between border-t py-2 border-t-gray-700'>
					<div className='flex gap-1 items-center'>
						<CiImageOn
							className='fill-primary w-6 h-6 cursor-pointer'
							onClick={() => imgRef.current.click()}
						/>
						<BsEmojiSmileFill className='fill-primary w-5 h-5 cursor-pointer' />
					</div>
					<input type='file' accept='image/*' hidden ref={imgRef} onChange={handleImgChange} />
					<button className='btn btn-primary rounded-full btn-sm text-white px-4'>
						{isPending ? "Posting..." : "Post"}
					</button>
				</div>
				{isError && <div className='text-red-500'>{error.message}</div>}
			</form>
		</div>
	);
};
export default CreatePost;
