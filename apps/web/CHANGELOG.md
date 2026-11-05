## 42.61.4 (2026-11-05)

### Fixes

#### Encrypt links in queued email ([#4183](https://github.com/virtool/virtool/pull/4183))

Recovery, verification, and invitation links are now encrypted while they wait
in the email queue. Virtool removes them from the database when a message is
sent or fails.

### Maintenance

- Prepare to remove the unused forced password reset column from the database ([#4184](https://github.com/virtool/virtool/pull/4184))

## 42.61.3 (2026-11-04)

### Fixes

- Build each image inside its Dockerfile, with no change to the image contents ([#4163](https://github.com/virtool/virtool/pull/4163))
- Bump `@hookform/resolvers` from ^6.0.0 to ^7.0.1 ([#4168](https://github.com/virtool/virtool/pull/4168))
- Bump `postgres` from ^3.4.9 to ^4.0.0 ([#4169](https://github.com/virtool/virtool/pull/4169))

#### Administrators send recovery links instead of setting passwords ([#4175](https://github.com/virtool/virtool/pull/4175))

Administrators can help users recover access with a one-time link. They can no
longer set a user's password or require a password reset.

**Action required:** Users who had a pending required password reset have
their password replaced during the upgrade and are signed out. Send each of
them a recovery link so they can set a new password. Users with a verified
email address get a password-changed notice.

#### Return to the correct page after you sign in ([#4161](https://github.com/virtool/virtool/pull/4161))

When you open a Virtool link before you sign in, Virtool now takes you to that
page after you sign in. It keeps the search terms, filters, and section in the
link. Before this change, a link with search terms or filters could open the
wrong page.

Virtool now ignores a sign-in link that points to a different website. A link
of this type can no longer send you away from Virtool after you sign in. This
also applies to the links in email address verification messages.

#### Update auth dependencies ([#4164](https://github.com/virtool/virtool/pull/4164))

- Bump `@better-auth/passkey` from 1.7.12 to 1.7.15.
- Bump `better-auth` from 1.7.12 to 1.7.15.

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

#### Return the same sign-in error for disabled accounts and wrong passwords ([#4174](https://github.com/virtool/virtool/pull/4174))

A disabled or not-yet-activated account now gets the same error code and
message as a wrong password. Before, only the status matched.

## 42.61.2 (2026-11-02)

### Fixes

- Bump `react-day-picker` from 10.0.1 to 10.0.2. ([#4132](https://github.com/virtool/virtool/pull/4132))
- Build and release each image separately. ([#4123](https://github.com/virtool/virtool/pull/4123))
- Remove source and build files from the images. ([#4140](https://github.com/virtool/virtool/pull/4140))
