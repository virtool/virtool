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
			 * Base URL a presigned download URL is built against, in place of the
			 * blob endpoint — the public host that fronts the account, such as
			 * `https://files.virtool.ca`. A user-delegation SAS signs the resource
			 * path, not the host, so serving it through a different host still
			 * validates. Unset means the blob endpoint is used as-is.
			 */
			downloadUrl?: string;
	  };
