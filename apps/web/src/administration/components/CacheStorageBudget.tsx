import {
	useSuspenseCacheUsage,
	useSuspenseSettings,
	useUpdateSettings,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";
import CacheUsageChart from "./CacheUsageChart";

const BYTES_PER_GIGABYTE = 1000 ** 3;

type CacheStorageBudgetFormValues = {
	budgetGigabytes: number;
};

/**
 * Set how much object storage the cache store may occupy.
 *
 * Eviction removes least recently used caches to meet this budget.
 * The field uses decimal gigabytes; the setting stores bytes.
 */
export default function CacheStorageBudget() {
	const { data } = useSuspenseSettings();
	const { data: cacheUsage } = useSuspenseCacheUsage();
	const mutation = useUpdateSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<CacheStorageBudgetFormValues>({
		values: {
			budgetGigabytes: data.cacheStorageBudget / BYTES_PER_GIGABYTE,
		},
	});

	function save({ budgetGigabytes }: CacheStorageBudgetFormValues) {
		mutation.mutate({
			cacheStorageBudget: Math.round(budgetGigabytes * BYTES_PER_GIGABYTE),
		});
	}

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Caching</h2>
			</SectionHeader>
			<section>
				<SectionHeader level={3}>
					<h3>Usage</h3>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						<CacheUsageChart
							budget={data.cacheStorageBudget}
							snapshots={cacheUsage}
						/>
					</BoxGroupSection>
				</BoxGroup>
			</section>
			<section>
				<SectionHeader level={3}>
					<h3>Storage Budget</h3>
					<p>
						Least recently used caches are removed to keep cache storage usage
						below this limit.
					</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						<form onSubmit={handleSubmit(save)}>
							<InputGroup>
								<InputLabel htmlFor="cacheStorageBudget">
									Budget (GB)
								</InputLabel>
								<Input
									id="cacheStorageBudget"
									aria-describedby="cacheStorageBudget-error"
									aria-invalid={Boolean(errors.budgetGigabytes) || undefined}
									min={1}
									step="any"
									type="number"
									{...register("budgetGigabytes", {
										valueAsNumber: true,
										required: "A budget is required.",
										min: {
											value: 1,
											message: "The budget must be at least 1 GB.",
										},
									})}
								/>
								<InputError id="cacheStorageBudget-error">
									{errors.budgetGigabytes?.message}
								</InputError>
							</InputGroup>
							<div className="flex justify-end">
								<SaveButton />
							</div>
						</form>
					</BoxGroupSection>
				</BoxGroup>
			</section>
		</section>
	);
}
