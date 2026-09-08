/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare const __DEV_INSTANCE__: {
	name: string;
	branch: string;
	worktree: string;
	url: string;
} | null;
