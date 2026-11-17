/**
 * Object storage backend configuration.
 *
 * The package owns the shape and never reads `process.env`. Each service
 * resolves `VT_STORAGE_*` into this type from its own configuration.
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
