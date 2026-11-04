## 42.61.3 (2026-11-04)

### Fixes

- Build each image inside its Dockerfile, with no change to the image contents ([#4163](https://github.com/virtool/virtool/pull/4163))

#### Update development dependencies ([#4165](https://github.com/virtool/virtool/pull/4165))

- Bump `@babel/core` from ^8.0.1 to ^8.0.10.
- Bump `@rolldown/plugin-babel` from ^0.2.4 to ^0.3.0.
- Bump `@vitejs/plugin-react` from ^6.1.2 to ^6.2.1.
- Bump `tsdown` from ^0.23.0 to ^0.23.4.

#### Update production dependencies ([#4166](https://github.com/virtool/virtool/pull/4166))

- Bump `@aws-sdk/client-s3` from ^3.1152.0 to ^3.1161.0.
- Bump `@aws-sdk/lib-storage` from ^3.1156.0 to ^3.1161.0.
- Bump `@aws-sdk/s3-request-presigner` from ^3.1156.0 to ^3.1161.0.
- Bump `@azure/identity` from ^4.14.0 to ^4.14.1.
- Bump `@azure/storage-blob` from ^12.33.0 to ^12.34.0.
- Bump `@hono/node-server` from ^2.1.5 to ^2.1.6.
- Bump `@sentry/node` from ^11.8.0 to ^11.10.0.
- Bump `@sentry/profiling-node` from 11.8.0 to 11.10.0.
- Bump `@sentry/replay` from 11.8.0 to 11.10.0.
- Bump `@sentry/tanstackstart-react` from ^11.8.0 to ^11.10.0.
- Bump `@tanstack/react-query` from ^5.104.5 to ^5.105.1.
- Bump `@tanstack/react-virtual` from ^3.14.22 to ^3.14.25.
- Bump `drizzle-orm` from ^0.45.2 to ^0.45.4.
- Bump `es-toolkit` from ^1.52.0 to ^1.53.1.
- Bump `execa` from ^10.2.0 to ^10.2.1.
- Bump `lucide-react` from ^1.61.0 to ^1.66.0.
- Bump `pino` from ^10.1.0 to ^10.4.0.
- Bump `react-hook-form` from ^7.90.0 to ^7.91.0.
- Bump `resend` from ^6.28.1 to ^6.37.0.
- Bump `zustand` from ^5.0.14 to ^5.0.16.

## 42.61.2 (2026-11-02)

### Fixes

- Build and release each image separately. ([#4123](https://github.com/virtool/virtool/pull/4123))
- Remove source and build files from the images. ([#4140](https://github.com/virtool/virtool/pull/4140))
