import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import RelativeTime from "@base/RelativeTime";
import SectionHeader from "@base/SectionHeader";
import type { ActiveBrowserSession } from "@virtool/contracts";
import {
	useFetchActiveBrowserSessions,
	useRevokeBrowserSession,
	useRevokeOtherBrowserSessions,
} from "../sessions";

function getSessionName({ browser, operatingSystem }: ActiveBrowserSession) {
	return `${browser} on ${operatingSystem}`;
}

type SessionItemProps = {
	session: ActiveBrowserSession;
};

function SessionItem({ session }: SessionItemProps) {
	const mutation = useRevokeBrowserSession();
	const name = getSessionName(session);

	return (
		<BoxGroupSection className="flex items-center justify-between gap-4">
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-base">{name}</span>
					{session.isCurrent && <Label>This browser</Label>}
				</div>
				<span className="text-gray-600 text-sm">
					{session.ipAddress ?? "IP address unknown"} · Signed in{" "}
					<RelativeTime time={session.createdAt} /> · Last active{" "}
					<RelativeTime time={session.lastActivityAt} />
				</span>
			</div>
			{!session.isCurrent && (
				<DeleteDialog
					name={name}
					noun="session"
					title="Sign out session"
					confirmLabel="Sign out"
					message={
						<>
							Sign out <strong>{name}</strong>? That browser must sign in again
							to use Virtool.
						</>
					}
					onConfirm={() =>
						mutation.mutateAsync({ managementId: session.managementId })
					}
					trigger={
						<Button aria-label={`Sign out ${name}`} color="red" size="small">
							Sign out
						</Button>
					}
				/>
			)}
		</BoxGroupSection>
	);
}

type SessionListProps = {
	sessions: ActiveBrowserSession[];
};

function SessionList({ sessions }: SessionListProps) {
	const hasOthers = sessions.some((session) => !session.isCurrent);

	return (
		<BoxGroup>
			{sessions.map((session) => (
				<SessionItem key={session.managementId} session={session} />
			))}
			{!hasOthers && (
				<BoxGroupSection className="text-gray-600">
					You are not signed in on other browsers.
				</BoxGroupSection>
			)}
		</BoxGroup>
	);
}

function SignOutOthers() {
	const mutation = useRevokeOtherBrowserSessions();

	return (
		<DeleteDialog
			name="other sessions"
			noun="sessions"
			title="Sign out other sessions"
			confirmLabel="Sign out all"
			message="Sign out every browser except this one? Those browsers must sign in again to use Virtool."
			onConfirm={() => mutation.mutateAsync()}
			trigger={<Button color="red">Sign out other sessions</Button>}
		/>
	);
}

/**
 * Lists the browsers that are signed in to the account, with controls to sign
 * out the others.
 *
 * The current browser ends its session only through sign out.
 */
export default function AccountSessions() {
	const { data, isPending, isError } = useFetchActiveBrowserSessions();

	const hasOthers = data?.some((session) => !session.isCurrent) ?? false;

	return (
		<section aria-labelledby="account-sessions">
			<SectionHeader level={3}>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 id="account-sessions">Sessions</h3>
						<p className="mb-0">
							The browsers that are signed in to your account.
						</p>
					</div>
					{hasOthers && <SignOutOthers />}
				</div>
			</SectionHeader>
			{isError && !data ? (
				<QueryError noun="your sessions" />
			) : isPending ? (
				<LoadingPlaceholder />
			) : (
				<SessionList sessions={data} />
			)}
		</section>
	);
}
