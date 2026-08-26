import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@base/Toast";
import { useToast } from "@base/useToast";

/** How long a toast stays on screen before it dismisses itself. */
const TOAST_DURATION_MS = 2500;

/**
 * Renders the active toasts into the bottom-right viewport.
 *
 * Mounted once, near the app root, beside the upload overlay it shares the
 * corner with. The queue behind it is driven by {@link useToast}'s `toast`.
 */
export default function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider duration={TOAST_DURATION_MS} swipeDirection="right">
			{toasts.map(({ id, title, description, action, ...props }) => (
				<Toast key={id} {...props}>
					<div className="grid gap-1">
						{title && <ToastTitle>{title}</ToastTitle>}
						{description && <ToastDescription>{description}</ToastDescription>}
					</div>
					{action}
					<ToastClose />
				</Toast>
			))}
			<ToastViewport />
		</ToastProvider>
	);
}
