import { cn } from "@app/cn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownProps = {
	className?: string;
	markdown?: string;
};

/**
 * Renders markdown as React elements, escaping any raw HTML it contains.
 *
 * Raw HTML is escaped rather than parsed — `rehype-raw` is deliberately not
 * installed — so this is safe for markdown from uncontrolled sources.
 */
export default function Markdown({ className, markdown = "" }: MarkdownProps) {
	return (
		<div className={cn(className)}>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
		</div>
	);
}
