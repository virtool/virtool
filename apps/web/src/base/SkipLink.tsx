import type { MouseEvent } from "react";

const MAIN_CONTENT_ID = "main-content";

/**
 * Make the main content focusable only while the skip link sends focus there,
 * so clicks on blank content space cannot focus it.
 */
function focusMainContent(event: MouseEvent<HTMLAnchorElement>) {
	const target = document.getElementById(MAIN_CONTENT_ID);

	if (!target) {
		return;
	}

	event.preventDefault();

	target.setAttribute("tabindex", "-1");
	target.addEventListener("blur", () => target.removeAttribute("tabindex"), {
		once: true,
	});
	target.focus();
}

/**
 * A link, visible only while focused, that lets keyboard users jump straight to
 * the main content and past the navigation landmarks.
 */
export default function SkipLink() {
	return (
		<a
			href={`#${MAIN_CONTENT_ID}`}
			onClick={focusMainContent}
			className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-skip-link focus:rounded-sm focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-blue-700 focus:shadow-lg"
		>
			Skip to main content
		</a>
	);
}
