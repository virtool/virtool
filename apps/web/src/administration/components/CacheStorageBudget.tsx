import { useFetchSettings, useUpdateSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";

/** The budget field is entered and shown in gibibytes; the setting is stored in bytes. */
const BYTES_PER_GIBIBYTE = 1024 ** 3;

type CacheStorageBudgetFormValues = {
	budgetGibibytes: number;
};

/**
 * Set how much object storage the cache store may occupy.
 *
 * The eviction task evicts least-recently-used caches until the store is back
 * under this budget. The setting is stored in bytes; the field is in gibibytes,
 * which is the unit the budget is reasoned about in.
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
			budgetGibibytes: data ? data.cacheStorageBudget / BYTES_PER_GIBIBYTE : 0,
		},
	});

	if (isError && !data) {
		return <QueryError noun="settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	function save({ budgetGibibytes }: CacheStorageBudgetFormValues) {
		mutation.mutate({
			cacheStorageBudget: Math.round(budgetGibibytes * BYTES_PER_GIBIBYTE),
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
							<InputLabel htmlFor="cacheStorageBudget">Budget (GiB)</InputLabel>
							<Input
								id="cacheStorageBudget"
								aria-describedby="cacheStorageBudget-error"
								aria-invalid={Boolean(errors.budgetGibibytes) || undefined}
								min={1}
								step={1}
								type="number"
								{...register("budgetGibibytes", {
									valueAsNumber: true,
									required: "A budget is required.",
									min: {
										value: 1,
										message: "The budget must be at least 1 GiB.",
									},
								})}
							/>
							<InputError id="cacheStorageBudget-error">
								{errors.budgetGibibytes?.message}
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
