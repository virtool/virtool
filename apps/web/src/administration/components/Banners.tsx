import {
	useClearActiveBanner,
	useCreateBanner,
	useDeleteBanner,
	useFetchBanners,
	useSetActiveBanner,
	useUpdateBanner,
} from "@banner/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
import SectionHeader from "@base/SectionHeader";
import { Megaphone } from "lucide-react";
import BannerItem from "./BannerItem";
import CreateBanner from "./CreateBanner";

/**
 * Display and manage the list of banners. Admins can create, edit, activate,
 * deactivate, and delete entries; the active row is shown to all users.
 */
export default function Banners() {
	const { data, isPending, isError } = useFetchBanners();
	const createMutation = useCreateBanner();
	const updateMutation = useUpdateBanner();
	const deleteMutation = useDeleteBanner();
	const setActiveMutation = useSetActiveBanner();
	const clearActiveMutation = useClearActiveBanner();

	if (isError && !data) {
		return <QueryError noun="banners" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const activeBanner = data.find((item) => item.active);
	const selectedValue = activeBanner?.id.toString() ?? "off";

	function handleChange(value: string) {
		if (value === "off") {
			clearActiveMutation.mutate();
			return;
		}
		setActiveMutation.mutate({ id: Number(value) });
	}

	return (
		<section>
			<SectionHeader>
				<h2>Banners</h2>
				<p>
					Manage the banner displayed to all users above the navigation bar.
				</p>
				<div className="mt-3 flex justify-end">
					<CreateBanner
						onSubmit={(values) => createMutation.mutateAsync(values)}
					/>
				</div>
			</SectionHeader>
			{data.length ? (
				<RadioGroup
					aria-label="Active banner"
					value={selectedValue}
					onValueChange={handleChange}
				>
					<BoxGroup>
						<BoxGroupSection className="flex items-center gap-3">
							<RadioGroupItem id="banner-off" value="off" />
							<label
								htmlFor="banner-off"
								className="grow cursor-pointer text-gray-600"
							>
								Off — no banner displayed
							</label>
						</BoxGroupSection>
						{data.map((item) => (
							<BannerItem
								key={item.id}
								color={item.color}
								id={item.id}
								message={item.message}
								onEdit={(id, values) =>
									updateMutation.mutateAsync({ id, ...values })
								}
								onRemove={(id) => deleteMutation.mutateAsync({ id })}
							/>
						))}
					</BoxGroup>
				</RadioGroup>
			) : (
				<BoxGroup>
					<BoxGroupSection>
						<Empty className="h-72">
							<EmptyMedia className="text-gray-400">
								<Megaphone size={40} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No banners found</EmptyTitle>
							<EmptyDescription>
								No banners have been created yet.
							</EmptyDescription>
						</Empty>
					</BoxGroupSection>
				</BoxGroup>
			)}
		</section>
	);
}
