import { useDebounce } from "@app/hooks";
import { InputSearch } from "@base/Input";
import type { ReactNode } from "react";
import Toolbar from "./Toolbar";

type SearchToolbarProps = {
	/** Accessible name for the search input, announced by assistive technology. */
	"aria-label": string;

	/** Controls rendered after the search input, such as filters and create buttons. */
	children?: ReactNode;

	className?: string;

	/** Called with the term once it has been stable for the debounce delay. */
	onChange: (value: string) => void;

	placeholder?: string;

	/** The committed search term. */
	value: string;
};

/**
 * A toolbar whose search input debounces before committing the term to the URL,
 * a store, or a query.
 */
export default function SearchToolbar({
	"aria-label": ariaLabel,
	children,
	className,
	onChange,
	placeholder,
	value,
}: SearchToolbarProps) {
	const [draft, setDraft] = useDebounce(value, onChange);

	return (
		<Toolbar className={className}>
			<InputSearch
				aria-label={ariaLabel}
				onChange={(e) => setDraft(e.target.value)}
				placeholder={placeholder}
				value={draft}
			/>
			{children}
		</Toolbar>
	);
}
