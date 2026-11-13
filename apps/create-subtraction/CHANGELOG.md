## 42.61.7 (2026-11-13)

### Maintenance

- Accept the username of the job's user from the jobs API, with or without the old handle field ([#4232](https://github.com/virtool/virtool/pull/4232))

## 42.61.6 (2026-11-09)

### Maintenance

#### Update development dependencies ([#4210](https://github.com/virtool/virtool/pull/4210))

The `virtool` release lists each bump.

## 42.61.5 (2026-11-06)

### Maintenance

- Move internal service developer documentation into code ([#4201](https://github.com/virtool/virtool/pull/4201))
- Move package and repository developer documentation into code ([#4201](https://github.com/virtool/virtool/pull/4201))
- Move web developer documentation into code and link the administration pages to the configuration manual ([#4201](https://github.com/virtool/virtool/pull/4201))
- Pass the resolved Sentry DSN to the shared Sentry options ([#4206](https://github.com/virtool/virtool/pull/4206))

## 42.61.4 (2026-11-06)

### Maintenance

- Return the subprocess result from the shared gzip helper ([#4193](https://github.com/virtool/virtool/pull/4193))

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

## 42.57.8 (2026-10-26)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `testcontainers` from 12.1.0 to 12.2.1 ([#4105](https://github.com/virtool/virtool/pull/4105))
- Bump `@aws-sdk/s3-request-presigner` from 3.1155.0 to 3.1156.0 ([#4100](https://github.com/virtool/virtool/pull/4100))

## 42.57.7 (2026-10-26)

### Maintenance

- Update tar-stream to 3.2.2 ([#4091](https://github.com/virtool/virtool/pull/4091))
- Bump `undici` from 8.10.2 to 8.12.3 ([#4092](https://github.com/virtool/virtool/pull/4092))

## 42.57.5 (2026-10-23)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `execa` from 10.0.1 to 10.2.0 ([#4090](https://github.com/virtool/virtool/pull/4090))
- Bump `@aws-sdk/lib-storage` from 3.1119.0 to 3.1156.0 ([#4089](https://github.com/virtool/virtool/pull/4089))

## 42.57.4 (2026-10-23)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `sentry` dependency group with 4 updates ([#4075](https://github.com/virtool/virtool/pull/4075))

## 42.57.2 (2026-10-23)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `@aws-sdk/s3-request-presigner` from 3.1110.0 to 3.1155.0 ([#4078](https://github.com/virtool/virtool/pull/4078))

## 42.57.1 (2026-10-21)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `@azure/identity` from 4.13.3 to 4.14.0 ([#4066](https://github.com/virtool/virtool/pull/4066))
- Bump `zod` from 4.5.4 to 4.6.7 ([#4065](https://github.com/virtool/virtool/pull/4065))
- Bump `@aws-sdk/client-s3` from 3.1144.0 to 3.1152.0 ([#4068](https://github.com/virtool/virtool/pull/4068))
- Bump `testing` dependency group with 4 updates ([#4070](https://github.com/virtool/virtool/pull/4070))

## 42.56.3 (2026-10-13)

### Fixes

#### Run the shipped images in production mode ([#4057](https://github.com/virtool/virtool/pull/4057))

Virtool images now set `NODE_ENV` to `production`. Before this change, error
reports had the `development` tag and logs used the `debug` level.

## 42.56.1 (2026-10-13)

### Fixes

#### Keep jobs running through short database restarts ([#4052](https://github.com/virtool/virtool/pull/4052))

When Postgres restarts for maintenance, the web app and the jobs API now answer
503. Workflows retry these responses for approximately four minutes, so running
jobs continue through a typical restart.

### Maintenance

- Bump `@azure/identity` from 4.13.2 to 4.13.3 ([#4048](https://github.com/virtool/virtool/pull/4048))
- Bump `sentry` dependency group with 4 updates ([#4043](https://github.com/virtool/virtool/pull/4043))

## 42.56.0 (2026-10-02)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `testing` dependency group with 2 updates ([#4030](https://github.com/virtool/virtool/pull/4030))

## 42.54.2 (2026-10-02)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `@aws-sdk/client-s3` from 3.1139.0 to 3.1144.0 ([#4038](https://github.com/virtool/virtool/pull/4038))
- Bump `sentry` dependency group with 4 updates ([#4029](https://github.com/virtool/virtool/pull/4029))

## 42.52.1 (2026-10-01)

### Maintenance

- Update dependencies that have open security alerts ([#4023](https://github.com/virtool/virtool/pull/4023))

## 42.49.6 (2026-09-29)

### Maintenance

- Report workflow failures to Sentry ([#4009](https://github.com/virtool/virtool/pull/4009))

## 42.48.1 (2026-09-28)

### Maintenance

- Share context and cache code across the workflow apps ([#3996](https://github.com/virtool/virtool/pull/3996))

## 42.47.4 (2026-09-25)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `tsdown` from 0.22.14 to 0.23.0 ([#3979](https://github.com/virtool/virtool/pull/3979))
- Bump `@aws-sdk/client-s3` from 3.1110.0 to 3.1139.0 ([#3978](https://github.com/virtool/virtool/pull/3978))
- Bump `sentry` dependency group with 4 updates ([#3972](https://github.com/virtool/virtool/pull/3972))

## 42.47.1 (2026-09-24)

### Fixes

#### Keep a job cancelled when you cancel it during a step change ([#3965](https://github.com/virtool/virtool/pull/3965))

A cancelled job could continue to its next step or end as failed. Now it stops
and stays cancelled.

## 42.43.3 (2026-09-18)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `testing` dependency group with 2 updates ([#3945](https://github.com/virtool/virtool/pull/3945))
- Bump `sentry` dependency group with 4 updates ([#3944](https://github.com/virtool/virtool/pull/3944))

## 42.42.1 (2026-09-18)

### Maintenance

- Update undici to 8.10.2 ([#3949](https://github.com/virtool/virtool/pull/3949))

## 42.38.1 (2026-09-16)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `sentry` dependency group with 4 updates ([#3922](https://github.com/virtool/virtool/pull/3922))

## 42.33.0 (2026-09-04)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `sentry` dependency group with 4 updates ([#3900](https://github.com/virtool/virtool/pull/3900))
- Bump `testing` dependency group with 4 updates ([#3910](https://github.com/virtool/virtool/pull/3910))

## 42.32.0 (2026-09-04)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `zod` from 4.4.3 to 4.5.4 ([#3905](https://github.com/virtool/virtool/pull/3905))

## 42.31.3 (2026-09-04)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `@types/node` from 26.4.0 to 26.4.1 ([#3907](https://github.com/virtool/virtool/pull/3907))

## 42.22.1 (2026-08-28)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `@aws-sdk/lib-storage` from 3.1094.0 to 3.1119.0 ([#3875](https://github.com/virtool/virtool/pull/3875))
- Bump `undici` from 7.29.0 to 8.10.0 ([#3872](https://github.com/virtool/virtool/pull/3872))
- Bump `@azure/identity` from 4.13.1 to 4.13.2 ([#3869](https://github.com/virtool/virtool/pull/3869))
- Bump `@types/node` from 26.2.0 to 26.4.0 ([#3871](https://github.com/virtool/virtool/pull/3871))
- Bump `sentry` dependency group with 4 updates ([#3867](https://github.com/virtool/virtool/pull/3867))

## 42.17.0 (2026-08-25)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `testing` dependency group with 3 updates ([#3828](https://github.com/virtool/virtool/pull/3828))

## 42.8.0 (2026-08-20)

### Features

- Compress workflow files on all allocated cores ([#3818](https://github.com/virtool/virtool/pull/3818))

## 42.7.2 (2026-08-20)

### Fixes

#### Stop workflows failing when the work path is a volume mount ([#3817](https://github.com/virtool/virtool/pull/3817))

Before, every workflow run failed during preparation when `VT_WORK_PATH` was a
volume mount. Workflows now empty the directory and keep the directory.

## 42.3.0 (2026-08-19)

### Fixes

#### Publish workflow images only under their bare names ([#3804](https://github.com/virtool/virtool/pull/3804))

**Action required:** Change your workflow deployments to use the bare image
names: `ghcr.io/virtool/create-sample`, `ghcr.io/virtool/create-subtraction`,
`ghcr.io/virtool/pathoscope`, and `ghcr.io/virtool/nuvs`. The `ts-` images stay
in the registry, but they no longer get updates.
