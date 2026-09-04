import { useFetchSettings, useUpdateSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";

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
	const { data, isPending, isError } = useFetchSettings();
	const mutation = useUpdateSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<CacheStorageBudgetFormValues>({
		values: {
			budgetGigabytes: data ? data.cacheStorageBudget / BYTES_PER_GIGABYTE : 0,
		},
	});

	if (isError && !data) {
		return <QueryError noun="settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	function save({ budgetGigabytes }: CacheStorageBudgetFormValues) {
		mutation.mutate({
			cacheStorageBudget: Math.round(budgetGigabytes * BYTES_PER_GIGABYTE),
		});
	}

	return (
		<section>
			<SectionHeader>
				<h2>Cache Storage Budget</h2>
				<p>
					The eviction task removes least-recently-used caches until the cache
					store is back under this budget.
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form onSubmit={handleSubmit(save)}>
						<InputGroup>
							<InputLabel htmlFor="cacheStorageBudget">Budget (GB)</InputLabel>
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
	);
}
