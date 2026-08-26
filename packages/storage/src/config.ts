/**
 * Object storage backend configuration.
 *
 * The package owns the shape; resolving it from the environment is the host
 * application's job. `apps/web`'s zod schema parses `VT_STORAGE_*` into a value
 * assignable to this type, so the package never reads `process.env` itself and
 * a second consumer — the jobs API, a workflow port — can supply the same shape
 * from wherever it keeps configuration.
 */
export type StorageConfig =
	| {
			kind: "s3";
			bucket: string;
			region?: string;
			endpoint?: string;
			accessKeyId?: string;
			secretAccessKey?: string;
	  }
	| {
			kind: "azure";
			account: string;
			container: string;
			accessKey?: string;
			endpoint?: string;
			/**
			 * Public origin that replaces the blob endpoint origin in presigned
			 * download URLs. Unset preserves the blob endpoint origin.
			 */
			downloadUrl?: string;
			/**
			 * Public origin that replaces the blob endpoint origin in presigned
			 * upload URLs — the Front Door route to the private storage account.
			 * Unset falls back to {@link downloadUrl}, then the blob endpoint origin.
			 */
			uploadUrl?: string;
	  };
