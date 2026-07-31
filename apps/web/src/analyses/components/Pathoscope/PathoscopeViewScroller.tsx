import { getContentScrollElement, getScrollBehavior } from "@app/scroll";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** Button that scrolls the user to the top of the page */
export function PathoscopeViewerScroller() {
	const [show, setShow] = useState(false);

	useEffect(() => {
		const scroller = getContentScrollElement();
		if (!scroller) {
			return;
		}
		const handleScroll = () => setShow(scroller.scrollTop > 0);
		scroller.addEventListener("scroll", handleScroll);
		return () => scroller.removeEventListener("scroll", handleScroll);
	}, []);

	if (show) {
		return (
			<button
				type="button"
				aria-label="Scroll to top"
				className="flex items-center justify-center fixed bottom-8 left-8 size-10 border border-gray-300 rounded-lg text-gray-500 cursor-pointer z-1 hover:bg-gray-100 hover:text-gray-700"
				onClick={() =>
					getContentScrollElement()?.scrollTo({
						top: 0,
						behavior: getScrollBehavior(),
					})
				}
			>
				<ArrowUp />
			</button>
		);
	}

	return null;
}
