## 42.65.0 (2026-11-10)

### Features

#### Choose relative or absolute times ([#4220](https://github.com/virtool/virtool/pull/4220))

You can now show times as a date and time, such as "Today at 11:12" or "Sep 26 at 14:03," instead of a relative time, such as "3 days ago." Times from an earlier year show the date only, such as "Sep 26, 2023." Go to **Account** > **Settings** and set **Time format**. Hover over a time or click it to see the exact date and time, or how long ago it was.

### Fixes

#### Prevent a second delete from a confirmation dialog ([#4223](https://github.com/virtool/virtool/pull/4223))

When you click **Confirm** in a delete or remove dialog, Virtool now disables the dialog until the action is complete. A double click no longer sends the action two times. When the dialog closes, focus goes back to the button that opened it, if that button is still on the page.

#### Report interrupted migrations as needing only a rerun ([#4219](https://github.com/virtool/virtool/pull/4219))

When SIGTERM or SIGINT stopped `migrate`, it told the operator to inspect findings and remediate data, or it failed with `failed to apply migrations`. It now logs that the run was interrupted and that the operator must rerun `migrate`, and it exits non-zero. An interrupted data migration is recorded as `errored`, with the error `interrupted before the data migration finished`. It isn't reported to Sentry.

#### Show one version in the About dialog ([#4221](https://github.com/virtool/virtool/pull/4221))

Virtool is released as one version. The About dialog now shows that version and links to its changelog. It no longer lists separate server and web app versions.

#### Show readable messages on the email delivery page ([#4222](https://github.com/virtool/virtool/pull/4222))

When **Administration** > **Email** refuses a change, it now tells you what to do. For example, if you enable sending before you save an API key and a sender address, the page tells you to save them first.

#### Show the current job state when you return to a page ([#4217](https://github.com/virtool/virtool/pull/4217))

If a job finished while you were on a different page, Virtool sometimes showed the job as still running when you went back. On the analyses table, this kept the delete button hidden until you reloaded the page. Virtool now gets the current job state when you go back to the page.

## 42.64.0 (2026-11-09)

### Features

#### Let administrators revoke all of a user's access ([#4207](https://github.com/virtool/virtool/pull/4207))

A **Revoke** action in the Danger Zone of the user page signs a compromised user
out everywhere and removes their password, API keys, passkeys, two-factor
authentication, and outstanding links. It also marks their email address as not
verified, so the user can't recover the account by themselves and Virtool doesn't
email them. To restore access, issue a recovery link and give it to the user
through a channel you trust. Revoking an administrator requires the full
administrator role.

#### Let a passkey satisfy the required two-factor authentication policy ([#4214](https://github.com/virtool/virtool/pull/4214))

When an instance requires two-factor authentication, a user who has a passkey can now use Virtool without an authenticator app. An administrator who has a passkey can now turn on the requirement. A user who has no authenticator app and removes their last passkey must set up an authenticator app before they can use Virtool again. The account security page warns before this happens.

### Fixes

#### Ask for confirmation before deleting an analysis ([#4212](https://github.com/virtool/virtool/pull/4212))

A confirmation dialog now appears when you choose to delete an analysis. Before this change, the analysis was deleted immediately.

#### Disable the two-factor authentication policy checkbox while the change saves ([#4214](https://github.com/virtool/virtool/pull/4214))

On the security administration page, the "Require two-factor authentication"
checkbox is now disabled and dimmed until Virtool saves the change. Before,
the checkbox did not change and ignored clicks, with no sign that Virtool was
saving.

#### Explain that API key permissions do not limit reads ([#4214](https://github.com/virtool/virtool/pull/4214))

The forms that create and edit API keys now tell you that permissions limit
only what a key can change. A key can read all the data that your account can
read.

#### Fix small problems in the Nuvs analysis view ([#4212](https://github.com/virtool/virtool/pull/4212))

The link to a running BLAST search now has the correct address. Sequences show
1 ORF in place of 1 ORFs, and sequences with no HMM hits no longer show an
empty E-value. Exported Nuvs files now have an underscore in place of every
space in the sample name. The HMM alert now uses the name Nuvs.

#### Fix the Virtool API link on the API Keys page ([#4212](https://github.com/virtool/virtool/pull/4212))

The link now opens the current Virtool API documentation. Before this change, the link pointed to a page that no longer exists.

#### Do not show the HMM alert in the analyze dialog boxes when HMM data is installed ([#4212](https://github.com/virtool/virtool/pull/4212))

The alert no longer appears when HMM data is installed. Before this change, the alert could appear even when the data was present.

#### Configure authentication only from Virtool's own variables ([#4211](https://github.com/virtool/virtool/pull/4211))

The web server does not start when `BETTER_AUTH_SECRETS` or
`BETTER_AUTH_TRUSTED_ORIGINS` is set, because Better Auth would use them in
place of, or in addition to, `VT_AUTH_SECRET` and `VT_PUBLIC_ORIGIN`. Unset them
before you upgrade. The setup and login device cookies are now `Secure` when
`VT_PUBLIC_ORIGIN` uses `https`, the same as the session cookies.

#### Require recent authentication to change the account handle ([#4215](https://github.com/virtool/virtool/pull/4215))

The handle is the name that you sign in with. If you have not signed in or
confirmed your identity in the last 15 minutes, Virtool now asks you to confirm
your identity before it changes your handle.

#### Show small read shares correctly in the Pathoscope mapping overview ([#4212](https://github.com/virtool/virtool/pull/4212))

The **Subtracted** row no longer shows `−0.00%` when no reads were subtracted.
A share that is more than zero but less than 0.01% now shows as `<0.01%`.

#### Show a weight of zero as 0 ([#4212](https://github.com/virtool/virtool/pull/4212))

A weight of zero now appears as 0. Before this change, it appeared in scientific notation as 0E0.

#### Show the analysis delete button to users with write access to the sample ([#4212](https://github.com/virtool/virtool/pull/4212))

Sample owners and other users with write access can now delete analyses from
the **Analyses** tab. Administrators without write access no longer see a button
that the server refuses.

#### Show when an analysis failed or was cancelled ([#4212](https://github.com/virtool/virtool/pull/4212))

The analysis page now shows **Analysis failed** or **Analysis cancelled** when
the job stops before the analysis is complete. The page also shows a link to the
job. Before this change, the page showed **Analysis in progress** forever.

#### Show when an analysis job succeeded but the analysis did not finish ([#4213](https://github.com/virtool/virtool/pull/4213))

The analysis page now shows **Analysis did not finish** and a link to the job
when the job succeeded but the analysis is not ready. Before this change, the
page showed **Analysis in progress** forever.

### Maintenance

- Remove the fallback for email links queued in plaintext ([#4203](https://github.com/virtool/virtool/pull/4203))

#### Update auth dependencies ([#4209](https://github.com/virtool/virtool/pull/4209))

- Bump `@better-auth/passkey` from 1.7.15 to 1.7.18.
- Bump `better-auth` from 1.7.15 to 1.7.18.
- Move `@simplewebauthn/server` and `@simplewebauthn/browser` to the passkey plugin's 13.x range and remove their overrides.

#### Update development dependencies ([#4210](https://github.com/virtool/virtool/pull/4210))

- Bump `@babel/core` from ^8.0.10 to ^8.1.0.
- Bump `@tailwindcss/vite` from ^4.3.3 to ^4.3.5.
- Bump `tailwindcss` from ^4.3.3 to ^4.3.5.
- Bump `tsdown` from ^0.23.4 to ^0.23.7.
- Bump `vite` from ^8.3.5 to ^8.3.6.

## 42.63.1 (2026-11-06)

### Fixes

#### Fix the documentation link in the About dialog ([#4201](https://github.com/virtool/virtool/pull/4201))

The documentation link in the About dialog opened a page that does not exist. It
now opens the manual.

#### Lock identity checks after repeated failures and refuse reused authenticator codes ([#4205](https://github.com/virtool/virtool/pull/4205))

Ten failed password or authenticator code attempts at an identity check now
block those two methods for 15 minutes. A correct password or code resets the
count, and a passkey still works during the block. An authenticator code that an
identity check already accepted is now refused.

#### Send web logs and browser errors to Sentry when the DSN comes from a file ([#4206](https://github.com/virtool/virtool/pull/4206))

When you set only `VT_SENTRY_DSN_FILE`, the web server did not forward logs to Sentry and the browser did not report errors. Both now use the value from the file.

### Maintenance

- Remove avoidable warnings from web test runs ([#4204](https://github.com/virtool/virtool/pull/4204))
- Remove the unused forced password reset column from the database ([#4199](https://github.com/virtool/virtool/pull/4199))
- Move internal service developer documentation into code ([#4201](https://github.com/virtool/virtool/pull/4201))
- Move package and repository developer documentation into code ([#4201](https://github.com/virtool/virtool/pull/4201))
- Move web developer documentation into code and link the administration pages to the configuration manual ([#4201](https://github.com/virtool/virtool/pull/4201))

## 42.63.0 (2026-11-06)

### Features

#### Add a changelog link to the About dialog ([#4191](https://github.com/virtool/virtool/pull/4191))

The About dialog now has a **Changelog** link. It opens the changelog page for
the version of Virtool that you use.

### Fixes

#### Fix live updates, downloads, avatars, and uploads behind a reverse proxy that uses HTTP Basic authentication ([#4197](https://github.com/virtool/virtool/pull/4197))

A reverse proxy that uses HTTP Basic authentication sends its credentials with
each browser request. Virtool treated these credentials as an API key and
refused the request, so live updates, downloads, avatars, and uploads failed.

Virtool now uses your session when the credentials are not a valid API key. A
valid API key still takes priority.

#### Stop a security check from signing users out when their authenticator setup is incomplete ([#4198](https://github.com/virtool/virtool/pull/4198))

If your authenticator setup was not complete, a correct code at a security
check completed the setup and signed you out. Virtool now refuses the code at
the security check until the setup is complete.

#### Stop password recovery requests from locking out or invalidating another user's recovery link ([#4195](https://github.com/virtool/virtool/pull/4195))

Another person could send repeated recovery requests for your account. These
requests could block your own requests or make your recovery link stop
working.

Refused requests no longer extend the limit, and a blocked address can't use
up the limit of your account. A public request now leaves a recovery link that
is less than one hour old in place and sends no email, unless the email for
that link failed. Links from administrators are not affected.

### Maintenance

- Store the newest changelog entry date each user has seen ([#4196](https://github.com/virtool/virtool/pull/4196))

## 42.62.0 (2026-11-06)

### Features

#### Support bzip2 compressed FASTQ uploads ([#4193](https://github.com/virtool/virtool/pull/4193))

Upload `.fastq.bz2` and `.fq.bz2` files to create samples. Virtool converts the files to gzip during sample creation. Sample jobs now show a **Normalize reads** step.

**Action required:** Deploy the new Create Sample image before or with the web image. An older image can't read bzip2 uploads.

### Fixes

#### Fix sign-in interruptions ([#4192](https://github.com/virtool/virtool/pull/4192))

- A malformed browser cookie no longer causes a server error when the user is
  signed out.
- When an administrator requires MFA during a session, Virtool now sends the
  user to MFA enrollment. Email remediation works the same way.
- Confirming your identity no longer signs you out when another request is in
  progress.

### Maintenance

- Report user handles with server errors in Sentry ([#4189](https://github.com/virtool/virtool/pull/4189))
- Stop reporting session refresh network failures to Sentry ([#4189](https://github.com/virtool/virtool/pull/4189))

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

### Maintenance

- Build each image inside its Dockerfile, with no change to the image contents ([#4163](https://github.com/virtool/virtool/pull/4163))

## 42.61.2 (2026-11-02)

### Fixes

- Bump `react-day-picker` from 10.0.1 to 10.0.2. ([#4132](https://github.com/virtool/virtool/pull/4132))

### Maintenance

- Build and release each image separately. ([#4123](https://github.com/virtool/virtool/pull/4123))
- Remove source and build files from the images. ([#4140](https://github.com/virtool/virtool/pull/4140))

## 42.61.1 (2026-10-27)

### Fixes

#### Explain two-factor and identity check failures ([#4125](https://github.com/virtool/virtool/pull/4125))

Two-factor sign-in now tells you if the authenticator code or the recovery code
is wrong, and it clears the field. If Virtool ends the challenge after five
wrong codes or locks the account, the sign-in form shows a notice that says why.
The identity check names the wrong password or code. It stays open on a rate
limit and tells you to wait.

## 42.61.0 (2026-10-27)

### Fixes

#### Name new passkeys after their provider or browser ([#4121](https://github.com/virtool/virtool/pull/4121))

All of a user's passkeys had the same name. Virtool now uses the provider name,
such as iCloud Keychain, or the browser and operating system, such as Firefox on
Linux. If it knows neither, it uses Passkey. Existing passkeys keep their names.

### Maintenance

#### Remove the legacy sessions table ([#4122](https://github.com/virtool/virtool/pull/4122))

After this upgrade, you cannot roll back to a release from before 42.59.0.

## 42.60.0 (2026-10-27)

### Maintenance

#### Hash passwords with Argon2id and upgrade bcrypt hashes at sign-in ([#4120](https://github.com/virtool/virtool/pull/4120))

No user has to reset a password. Virtool replaces an old hash after the next
successful password sign-in.

## 42.59.1 (2026-10-27)

### Fixes

#### Offer a retry instead of the sign-in page when your account does not load ([#4119](https://github.com/virtool/virtool/pull/4119))

A temporary failure, such as a lost network or a 502 during a deployment, sent a
signed-in user to the sign-in page. Signing in again made an extra session.
Virtool now shows Try again.

## 42.59.0 (2026-10-27)

### Features

#### Complete the move to the new authentication system ([#4118](https://github.com/virtool/virtool/pull/4118))

Virtool no longer creates or reads legacy sessions. A user who has not finished
email setup signs in with their password and then finishes email setup.
Administrator recovery links now work for these users.

The auth-remediation report now gives information only. It exits with an error
only when it cannot read the database.

**Action required:** Tell your users that they may need to sign in again.
Virtool ends any legacy session on the first visit after this upgrade. A user
who has not finished email setup and forgets their password needs a recovery
link from an administrator.

## 42.58.0 (2026-10-26)

### Features

#### Export OTU and isolate data from the browser ([#4116](https://github.com/virtool/virtool/pull/4116))

The isolate list and the isolate sequence list now have an export menu. It
copies or downloads accessions, FASTA, a sequence table, and, for an OTU, an
isolate table. It uses the selected rows, or the rows the search shows when you
select none. Account settings hold the default FASTA header and table download
format.

The server links that downloaded OTU, isolate, and sequence FASTA files are
removed. Links and scripts that use them stop working.

### Fixes

#### Keep two-factor users signed in after a forced password reset ([#4117](https://github.com/virtool/virtool/pull/4117))

A user with two-factor authentication went back to the sign-in page after a
forced password reset. The user now stays signed in. Sessions made after an
identity check also record the current IP address and browser.

## 42.57.14 (2026-10-26)

### Fixes

#### Keep passkey autofill working on the sign-in page ([#4115](https://github.com/virtool/virtool/pull/4115))

Passkey autofill ran one time for each page load. It now starts again before its
challenge expires and after a refused or unfinished passkey sign-in. Autofill
failures that occur before you pick a passkey no longer show an error. The
passkey button no longer conflicts with autofill.

## 42.57.13 (2026-10-26)

### Fixes

#### Check the origin of requests that use a session cookie ([#4114](https://github.com/virtool/virtool/pull/4114))

Upload routes accepted requests from a session cookie with no cross-site check.
Virtool now refuses a request that changes data with a session cookie unless it
comes from the same origin. Requests with an API key do not change.

## 42.57.12 (2026-10-26)

### Fixes

#### Require a recent identity check to turn off two-factor authentication ([#4113](https://github.com/virtool/virtool/pull/4113))

Turning off two-factor authentication and making new recovery codes now need a
recent identity check and your password. The account security page opens the
identity check when your session is stale. The HTTP endpoints for these actions
are removed.

## 42.57.11 (2026-10-26)

### Fixes

#### Keep the edit isolate dialog open until the save succeeds ([#4112](https://github.com/virtool/virtool/pull/4112))

The dialog closed before the save finished, so a failed save lost your edit and
showed no error. The dialog now stays open, keeps your values, and shows the
error.

## 42.57.10 (2026-10-26)

### Fixes

#### Stop passkey registration from running again after an identity check ([#4110](https://github.com/virtool/virtool/pull/4110))

Registration could run a second time on its own after you confirmed your
identity. This could fail in Safari or leave an unused passkey on your
authenticator. Virtool now asks for the identity check first if your session is
close to stale. After any identity check, select Add again to start
registration.

### Maintenance

- Remove sign-in rate limit records one hour after their last request ([#4111](https://github.com/virtool/virtool/pull/4111))

## 42.57.9 (2026-10-26)

### Fixes

#### Stop trusted devices from skipping two-factor sign-in ([#4109](https://github.com/virtool/virtool/pull/4109))

A request could ask to trust a device, which let a browser skip the
authenticator code at later sign-ins. Virtool now refuses these requests and
ignores trusted device cookies that it issued before. The web app never asked
for this.

## 42.57.8 (2026-10-26)

### Fixes

#### Name subtraction and read downloads to match their link text ([#4108](https://github.com/virtool/virtool/pull/4108))

Subtraction FASTA and sample read downloads saved under their stored names, such
as reads_1.fq.gz, not the names in the links. Bowtie2 files keep their stored
names.

### Maintenance

- Bump `testcontainers` from 12.1.0 to 12.2.1 ([#4105](https://github.com/virtool/virtool/pull/4105))
- Bump `@aws-sdk/s3-request-presigner` from 3.1155.0 to 3.1156.0 ([#4100](https://github.com/virtool/virtool/pull/4100))

## 42.57.7 (2026-10-26)

### Maintenance

- Update tar-stream to 3.2.2 ([#4091](https://github.com/virtool/virtool/pull/4091))
- Stop reporting a server error when a deleted analysis records a view ([#4107](https://github.com/virtool/virtool/pull/4107))
- Bump `tanstack` dependency group with 3 updates ([#4087](https://github.com/virtool/virtool/pull/4087))
- Bump `auth` dependency group with 3 updates ([#4096](https://github.com/virtool/virtool/pull/4096))
- Bump `lucide-react` from 1.43.0 to 1.61.0 ([#4102](https://github.com/virtool/virtool/pull/4102))
- Bump `@hono/node-server` from 2.1.1 to 2.1.5 ([#4103](https://github.com/virtool/virtool/pull/4103))
- Bump `react-dropzone` from 20.1.1 to 20.1.4 ([#4104](https://github.com/virtool/virtool/pull/4104))
- Bump `tailwind-merge` from 3.6.0 to 3.7.0 ([#4097](https://github.com/virtool/virtool/pull/4097))

## 42.57.6 (2026-10-23)

### Fixes

#### Stop failed server calls from changing the status of rendered pages ([#4095](https://github.com/virtool/virtool/pull/4095))

A signed-out load of the sign-in page returned 401, so traces and metrics
recorded 401s for normal page loads. Pages now return their own status.

A failed server function call now answers 200, with the error in its body. In
metrics, the status label no longer separates failed server function calls from
successful ones.

## 42.57.5 (2026-10-23)

### Fixes

#### Limit password sign-in attempts ([#4085](https://github.com/virtool/virtool/pull/4085))

Password sign-in had no attempt limit. Virtool now allows three attempts in 10
seconds from each IP address, and 10 failed attempts in 15 minutes for each
account. A browser that signed in to the account in the last 30 days has its own
limit of five attempts in 15 minutes, so failures from other browsers do not
lock out the owner. After a limit, Virtool shows "Too many sign-in attempts".

### Maintenance

- Bump `drizzle-kit` from 0.31.10 to 0.31.11 ([#4094](https://github.com/virtool/virtool/pull/4094))
- Bump `@aws-sdk/lib-storage` from 3.1119.0 to 3.1156.0 ([#4089](https://github.com/virtool/virtool/pull/4089))

## 42.57.4 (2026-10-23)

### Fixes

#### Redirect signed-out page loads to the sign-in page ([#4084](https://github.com/virtool/virtool/pull/4084))

A signed-out page load showed an empty "HTTP ERROR 401" page in the browser.
Virtool now redirects to the sign-in page.

### Maintenance

- Bump `vite` from 8.3.4 to 8.3.5 ([#4076](https://github.com/virtool/virtool/pull/4076))
- Bump `sentry` dependency group with 4 updates ([#4075](https://github.com/virtool/virtool/pull/4075))
- Bump `tanstack` dependency group with 5 updates ([#4074](https://github.com/virtool/virtool/pull/4074))

## 42.57.3 (2026-10-23)

### Fixes

#### Show a temporarily unavailable state during database outages ([#4083](https://github.com/virtool/virtool/pull/4083))

Pages now show an unavailable state and retry on their own until the service is
back. Failed actions show a notice. Virtool no longer treats an outage as a
signed-out user.

## 42.57.2 (2026-10-23)

### Fixes

#### Fix legacy email claims and email-change links opened while signed out ([#4073](https://github.com/virtool/virtool/pull/4073))

Legacy accounts that share an address, or a deactivated legacy account, no
longer block a user who proves control of that address. A claim with no
verification still cannot take an address that another account records. Email
setup now shows "Another account uses this email address." in place of a generic
error.

If you open an email-change link while signed out, Virtool completes the change
after you sign in.

### Maintenance

- Bump `radix-ui` from 1.6.7 to 1.8.1 ([#4081](https://github.com/virtool/virtool/pull/4081))
- Bump `fast-xml-parser` from 5.11.1 to 5.11.2 ([#4079](https://github.com/virtool/virtool/pull/4079))
- Bump `@aws-sdk/s3-request-presigner` from 3.1110.0 to 3.1155.0 ([#4078](https://github.com/virtool/virtool/pull/4078))
- Bump `@hookform/resolvers` from 5.9.1 to 6.0.0 ([#4077](https://github.com/virtool/virtool/pull/4077))

## 42.57.1 (2026-10-21)

### Maintenance

- Stop sending Prometheus scrapes to Sentry traces ([#4071](https://github.com/virtool/virtool/pull/4071))
- Bump `@azure/identity` from 4.13.3 to 4.14.0 ([#4066](https://github.com/virtool/virtool/pull/4066))
- Bump `zod` from 4.5.4 to 4.6.7 ([#4065](https://github.com/virtool/virtool/pull/4065))
- Bump `axe-core` from 4.12.1 to 4.14.0 ([#4067](https://github.com/virtool/virtool/pull/4067))
- Bump `@aws-sdk/client-s3` from 3.1144.0 to 3.1152.0 ([#4068](https://github.com/virtool/virtool/pull/4068))
- Bump `react-hook-form` from 7.89.0 to 7.90.0 ([#4064](https://github.com/virtool/virtool/pull/4064))
- Bump `tanstack` dependency group with 5 updates ([#4061](https://github.com/virtool/virtool/pull/4061))
- Bump `react` dependency group with 2 updates ([#4063](https://github.com/virtool/virtool/pull/4063))
- Bump `testing` dependency group with 4 updates ([#4070](https://github.com/virtool/virtool/pull/4070))

## 42.57.0 (2026-10-15)

### Features

#### Email account owners after password and email changes ([#4060](https://github.com/virtool/virtool/pull/4060))

Virtool now sends a notice to the account's address when its password changes,
including a forced reset, a password set by an administrator, and a completed
recovery. When an email address changes, Virtool sends a notice to the old
address. Only verified addresses get a notice.

## 42.56.5 (2026-10-13)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.56.4 (2026-10-13)

### Fixes

#### Stop reading client IP addresses from the CF-Connecting-IP header ([#4058](https://github.com/virtool/virtool/pull/4058))

**Action required:** If your deployment is behind Cloudflare, make sure that it
sends the X-Forwarded-For header. Virtool now ignores CF-Connecting-IP. Without
X-Forwarded-For, Virtool records 127.0.0.1 as the client IP address.

## 42.56.3 (2026-10-13)

### Fixes

#### Prevent failed requests when you sign out sessions during a password change ([#4056](https://github.com/virtool/virtool/pull/4056))

Signing out sessions at the same time as a password change, or from two browsers
at the same time, could fail with a server error.

#### Run the shipped images in production mode ([#4057](https://github.com/virtool/virtool/pull/4057))

Virtool images now set `NODE_ENV` to `production`. Before this change, error
reports had the `development` tag and logs used the `debug` level.

## 42.56.2 (2026-10-13)

### Fixes

#### Serve only the authentication endpoints that Virtool uses ([#4055](https://github.com/virtool/virtool/pull/4055))

All other authentication endpoints now answer 404. This includes the get-session
and sign-out endpoints, which the browser does not call.

### Maintenance

- Name jobs API requests after the route that answers them ([#4054](https://github.com/virtool/virtool/pull/4054))

## 42.56.1 (2026-10-13)

### Fixes

#### Keep jobs running through short database restarts ([#4052](https://github.com/virtool/virtool/pull/4052))

When Postgres restarts for maintenance, the web app and the jobs API now answer
503. Workflows retry these responses for approximately four minutes, so running
jobs continue through a typical restart.

### Maintenance

- Bump `jsdom` from 30.1.1 to 30.1.2 ([#4044](https://github.com/virtool/virtool/pull/4044))
- Bump `@tanstack/react-query` from 5.104.0 to 5.104.1 ([#4042](https://github.com/virtool/virtool/pull/4042))
- Bump `@simplewebauthn/browser` from 13.3.0 to 14.0.0 ([#4049](https://github.com/virtool/virtool/pull/4049))
- Bump `@azure/identity` from 4.13.2 to 4.13.3 ([#4048](https://github.com/virtool/virtool/pull/4048))
- Bump `sentry` dependency group with 4 updates ([#4043](https://github.com/virtool/virtool/pull/4043))
- Bump `vite` dependency group with 2 updates ([#4045](https://github.com/virtool/virtool/pull/4045))

## 42.56.0 (2026-10-02)

### Features

#### Rebuild the sign-in, recovery, and setup pages and add passkey identity checks ([#4041](https://github.com/virtool/virtool/pull/4041))

Virtool has new login, invitation, recovery, setup, and two-factor enrollment
pages. Two-factor codes now use a segmented input.

The "Confirm your identity" step now shows one method at a time. It starts with
your password and has a link to use an authenticator code. If your account has a
passkey, you can use it to confirm your identity. A hidden code field no longer
blocks password submission.

### Maintenance

- Bump `testing` dependency group with 2 updates ([#4030](https://github.com/virtool/virtool/pull/4030))
- Bump `@rolldown/plugin-babel` from 0.2.3 to 0.2.4 ([#3948](https://github.com/virtool/virtool/pull/3948))

## 42.55.0 (2026-10-02)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `tanstack` dependency group with 4 updates ([#4028](https://github.com/virtool/virtool/pull/4028))
- Bump `@testcontainers/postgresql` from 12.1.0 to 12.2.0 ([#4036](https://github.com/virtool/virtool/pull/4036))

## 42.54.2 (2026-10-02)

### Fixes

#### Keep account and administration pages inside the viewport ([#4040](https://github.com/virtool/virtool/pull/4040))

Long handles and wide forms no longer push these pages past the edge of the
window.

### Maintenance

- Bump `@aws-sdk/client-s3` from 3.1139.0 to 3.1144.0 ([#4038](https://github.com/virtool/virtool/pull/4038))
- Bump `vite` from 8.3.0 to 8.3.2 ([#4031](https://github.com/virtool/virtool/pull/4031))
- Bump `sentry` dependency group with 4 updates ([#4029](https://github.com/virtool/virtool/pull/4029))
- Bump `react-hook-form` from 7.88.0 to 7.89.0 ([#4032](https://github.com/virtool/virtool/pull/4032))

## 42.54.1 (2026-10-02)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.54.0 (2026-10-02)

### Features

#### Add an account Security page ([#4027](https://github.com/virtool/virtool/pull/4027))

Manage your email, password, two-factor authentication, passkeys, and browser
sessions in one place. Groups now show on the Profile page with your
administrator role, and users who opt in can show a Gravatar avatar.

A password change no longer leaves users with two-factor authentication at a
challenge with no session.

## 42.53.1 (2026-10-01)

### Fixes

#### Stop the main content area from showing a stray focus outline ([#4024](https://github.com/virtool/virtool/pull/4024))

A click on blank space in the main content area no longer draws an outline
around the area. The skip link still moves focus to the main content.

## 42.53.0 (2026-10-01)

### Features

#### Make group selection compact in the create user dialog ([#4026](https://github.com/virtool/virtool/pull/4026))

The dialog and the user detail page now use a searchable box to add groups. Each
group row has a Primary button and a remove button, and the list scrolls when it
has many rows. In the dialog, the group field now comes after the email field.

## 42.52.1 (2026-10-01)

### Maintenance

- Update dependencies that have open security alerts ([#4023](https://github.com/virtool/virtool/pull/4023))

## 42.52.0 (2026-10-01)

### Features

#### Make form labels, hints, and errors work with screen readers ([#4019](https://github.com/virtool/virtool/pull/4019))

Every form now connects its labels, descriptions, and errors to its controls, so
screen readers announce errors with their controls. You can now click anywhere
on a setting row or choice card.

#### Add passkey sign-in and management ([#4018](https://github.com/virtool/virtool/pull/4018))

Register, rename, and remove passkeys on the account page, and sign in with a
passkey on the login page. Password sign-in stays available. A passkey sign-in
does not ask for a two-factor code.

## 42.51.0 (2026-09-29)

### Features

#### Let users choose and order Pathoscope export columns ([#4020](https://github.com/virtool/virtool/pull/4020))

In account settings, drag columns into order and hide the columns that you do
not want. At least one column must stay shown. Virtool uses this choice for
copied tables and for CSV and Excel downloads.

### Maintenance

- Share the metrics scrape handler between internal services ([#4017](https://github.com/virtool/virtool/pull/4017))

## 42.50.3 (2026-09-29)

### Maintenance

- Report migration failures to Sentry ([#4013](https://github.com/virtool/virtool/pull/4013))
- Shorten write locks during the legacy identity migration ([#4016](https://github.com/virtool/virtool/pull/4016))

## 42.50.2 (2026-09-29)

### Fixes

#### Return clear errors for duplicate reference members and unknown groups ([#4014](https://github.com/virtool/virtool/pull/4014))

Two requests that add the same reference member at the same time no longer fail
with a server error. The same is true for a user change or invitation that names
an unknown group.

#### Stop showing an error when a removed upload's file cannot be deleted ([#4015](https://github.com/virtool/virtool/pull/4015))

Virtool now logs the failure. Before, it removed the upload and then returned an
error.

## 42.50.1 (2026-09-29)

### Fixes

#### Recreate missing HMM annotations so Nuvs analyses do not fail ([#4012](https://github.com/virtool/virtool/pull/4012))

Virtool now checks every minute and writes the annotations file again when it is
missing and HMMs are installed. Nuvs analyses stop failing within a minute.

## 42.50.0 (2026-09-29)

### Features

#### Let full administrators reset a user's two-factor authentication ([#4006](https://github.com/virtool/virtool/pull/4006))

Use the Reset control on the user detail page when a user has lost their
authenticator and recovery codes. It removes both and signs the user out
everywhere.

Virtool also adds an instance policy that can require two-factor authentication.
The policy stays optional because no page can change it yet.

## 42.49.6 (2026-09-29)

### Fixes

#### Keep NCBI lookups working while NCBI is busy ([#4011](https://github.com/virtool/virtool/pull/4011))

Virtool now releases the connection when NCBI sends a rate-limit or server
error. Before, an NCBI outage could use all of the connections.

## 42.49.5 (2026-09-29)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.49.4 (2026-09-29)

### Fixes

#### Show a clear error when an upload is too large or unavailable ([#4005](https://github.com/virtool/virtool/pull/4005))

A file above the size limit now gets a readable message and a 413 response. On a
deployment without direct uploads, an upload now gets a 503 response, not a 500.

## 42.49.3 (2026-09-29)

### Fixes

#### Refresh lists and related pages after updates and deletes ([#4004](https://github.com/virtool/virtool/pull/4004))

Lists, detail pages, and pages that show the changed record now update after a
change. For example, samples update after a label change. Virtool also sends
live updates for OTU, isolate, and sequence changes, subtraction renames and
deletes, and index creation.

## 42.49.2 (2026-09-28)

### Fixes

#### Call the OTU short name an acronym instead of an abbreviation ([#4003](https://github.com/virtool/virtool/pull/4003))

All text in the web app now says "acronym". This includes OTU pages, OTU search,
Pathoscope results and exports, account settings, new history descriptions, and
conflict errors.

Analysis download links now use the `preferAcronym` query parameter in place of
`preferAbbreviation`.

## 42.49.1 (2026-09-28)

### Fixes

#### Stop failing queued email when a shutdown interrupts delivery ([#3999](https://github.com/virtool/virtool/pull/3999))

A shutdown during a send no longer uses a delivery attempt. Before, it scheduled
a retry delay, and on the last attempt the email failed.

## 42.49.0 (2026-09-28)

### Features

#### Invite users by email instead of setting their passwords ([#4001](https://github.com/virtool/virtool/pull/4001))

Administrators now invite new users and do not set a first password. The invited
user opens a one-time setup link, which Virtool can email or the administrator
can copy, and chooses a handle and password. Administrators can reissue an
invitation or delete a pending user.

The first-instance setup now asks for a handle, email, and password, and it
works without email delivery. The users list is now a table that you can sort
and filter. The administration pages now ask you to confirm your identity if you
did not authenticate recently.

## 42.48.1 (2026-09-28)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.48.0 (2026-09-28)

### Features

#### Let Pathoscope exports prefer OTU acronyms ([#3997](https://github.com/virtool/virtool/pull/3997))

Turn on the option in the Pathoscope export menu or on the new account Settings
page. Virtool then names OTUs by their acronym when they have one. The option
applies to copied tables and to CSV and Excel downloads.

The account pages now use a side menu.

### Fixes

#### Show Pending as the workflow version of unfinished analyses ([#3998](https://github.com/virtool/virtool/pull/3998))

Before, analyses that were not finished showed "not recorded". That text now
shows only for ready analyses that finished before Virtool recorded versions.

## 42.47.13 (2026-09-25)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.47.12 (2026-09-25)

### Fixes

#### Keep concurrent group permission changes from overwriting each other ([#3992](https://github.com/virtool/virtool/pull/3992))

When two people changed the permissions of one group at the same time, one
change could undo the other. Virtool now saves both changes.

## 42.47.11 (2026-09-25)

### Fixes

#### Match % and _ literally in user, group, and label search ([#3991](https://github.com/virtool/virtool/pull/3991))

The jobs list now has a stable order, so jobs created at the same time do not
repeat or go missing across pages.

#### Correct the swapped sample group policy descriptions ([#3993](https://github.com/virtool/virtool/pull/3993))

The "Force choice" and "User's primary group" descriptions now match what
Virtool does.

### Maintenance

- Share URL token capture across the recovery and verification pages ([#3994](https://github.com/virtool/virtool/pull/3994))

## 42.47.10 (2026-09-25)

### Fixes

#### Allow deleting labels and groups that are still in use ([#3990](https://github.com/virtool/virtool/pull/3990))

Deleting a label now removes it from its samples, and the delete dialog shows
how many samples lose the label. Deleting a group clears it from its samples and
removes its reference rights. These deletes no longer fail with a server error.

Group delete now opens a confirmation dialog, and a failed delete shows its
error.

## 42.47.9 (2026-09-25)

### Fixes

#### Accept lowercase and multi-line sequences ([#3987](https://github.com/virtool/virtool/pull/3987))

The create and edit sequence forms now remove whitespace and make sequences
uppercase. The API does the same.

### Maintenance

- Stop recording pings from jobs that have ended ([#3989](https://github.com/virtool/virtool/pull/3989))

## 42.47.8 (2026-09-25)

### Fixes

#### Hide references, OTUs, and indexes from users who cannot see them ([#3988](https://github.com/virtool/virtool/pull/3988))

Virtool now checks that you can see a reference before it serves that reference,
its OTUs, or its indexes. A hidden item behaves like a missing one and returns a
404 response. Lists of ready indexes show only indexes that you can see. API
clients get the same results.

## 42.47.7 (2026-09-25)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.47.6 (2026-09-25)

### Fixes

#### Show all Pathoscope hits by default ([#3984](https://github.com/virtool/virtool/pull/3984))

Pathoscope analyses now open with all hits and isolates shown. The coverage
filters stay off until you turn them on.

#### Fix a startup failure in the internal service image ([#3983](https://github.com/virtool/virtool/pull/3983))

After an update to Sentry 11, the jobs API, task runner, and migrations stopped
at launch. This affected versions 42.47.4 to 42.47.5.

## 42.47.5 (2026-09-25)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.47.4 (2026-09-25)

### Fixes

#### Keep new characters when a search box updates ([#3968](https://github.com/virtool/virtool/pull/3968))

When you typed in a search box, a delayed update could remove the characters
that you had just typed. Virtool now keeps them.

#### Return to the first page of samples when you change a search or filter ([#3969](https://github.com/virtool/virtool/pull/3969))

You no longer stay on a later page of the samples list when you clear search
terms or a filter.

### Maintenance

- Bump `tsdown` from 0.22.14 to 0.23.0 ([#3979](https://github.com/virtool/virtool/pull/3979))
- Bump `@aws-sdk/client-s3` from 3.1110.0 to 3.1139.0 ([#3978](https://github.com/virtool/virtool/pull/3978))
- Bump `hono` from 4.13.5 to 4.13.9 ([#3976](https://github.com/virtool/virtool/pull/3976))
- Bump `resend` from 6.27.0 to 6.28.1 ([#3975](https://github.com/virtool/virtool/pull/3975))
- Bump `fast-xml-parser` from 5.10.1 to 5.11.1 ([#3974](https://github.com/virtool/virtool/pull/3974))
- Bump `jsdom` from 30.0.1 to 30.1.1 ([#3973](https://github.com/virtool/virtool/pull/3973))
- Bump `tanstack` dependency group with 3 updates ([#3971](https://github.com/virtool/virtool/pull/3971))
- Bump `sentry` dependency group with 4 updates ([#3972](https://github.com/virtool/virtool/pull/3972))

## 42.47.3 (2026-09-24)

### Fixes

#### Ignore spaces before and after search terms ([#3970](https://github.com/virtool/virtool/pull/3970))

A search term with spaces before or after it now gives the same results as the
term without them. Spaces inside a term do not change. This includes analysis,
sequence, and read file searches.

## 42.47.2 (2026-09-24)

### Fixes

#### Keep NCBI requests within the rate limit ([#3967](https://github.com/virtool/virtool/pull/3967))

All NCBI requests now share one queue, so a deployment stays under the NCBI rate
limit. A cancelled request no longer delays other requests. Time in the queue no
longer counts toward the 30-second request timeout.

## 42.47.1 (2026-09-24)

### Fixes

#### Prevent duplicate sample names when samples are saved at the same time ([#3966](https://github.com/virtool/virtool/pull/3966))

**Action required:** The upgrade stops if two or more samples have the same
name. If this occurs, run `data-migrations export sample_name_uniqueness` from
the internal image to see the names. Rename the samples, then run `migrate`
again.

## 42.47.0 (2026-09-22)

### Features

#### Add password recovery and confirm new email addresses ([#3963](https://github.com/virtool/virtool/pull/3963))

The sign-in page now has a "Forgot your password?" link. Virtool sends a
recovery link only to an eligible account with a verified email address.
Administrators can also issue a one-time recovery link from the user page, and
can copy it when email delivery is off. A recovery link changes the password and
ends the sessions of that user.

A change to your email address now takes effect only after you open the link
that Virtool sends to the new address.

## 42.46.0 (2026-09-22)

### Maintenance

- Prepare to let users view and end their active browser sessions ([#3961](https://github.com/virtool/virtool/pull/3961))

## 42.45.0 (2026-09-22)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.44.0 (2026-09-22)

### Features

#### Ask users to confirm their identity before security changes ([#3960](https://github.com/virtool/virtool/pull/3960))

If you signed in more than 15 minutes ago, Virtool asks for your password or
authenticator code before some changes. These include changes to your password,
email address, and API keys.

API keys and legacy sessions cannot make these changes. These requests return a
403 response with the code `SESSION_NOT_FRESH`.

## 42.43.3 (2026-09-18)

### Fixes

#### Make email confirmation links work in any browser ([#3959](https://github.com/virtool/virtool/pull/3959))

You can now open the link in a different browser from the one where you started.
The link confirms the address but does not sign you in. A new link replaces the
older links. Virtool also removes the token in the link from the browser
history.

### Maintenance

- Bump `testing` dependency group with 2 updates ([#3945](https://github.com/virtool/virtool/pull/3945))
- Bump `sentry` dependency group with 4 updates ([#3944](https://github.com/virtool/virtool/pull/3944))

## 42.43.2 (2026-09-18)

### Fixes

#### Keep browser sessions active for seven days after use ([#3958](https://github.com/virtool/virtool/pull/3958))

Sessions now last seven days. Virtool extends a session when you open Virtool or
return to its window. Background activity in an unattended tab does not extend a
session. This replaces the one-hour and 24-hour limits.

Virtool no longer reads `VT_AUTH_SESSION_IDLE_LIFETIME_SECONDS`,
`VT_AUTH_SESSION_ABSOLUTE_LIFETIME_SECONDS`, or
`VT_AUTH_SESSION_MINIMUM_REFRESH_INTERVAL_SECONDS`. You can remove them from
your configuration.

### Maintenance

- Bump `vite` from 8.2.2 to 8.3.0 ([#3946](https://github.com/virtool/virtool/pull/3946))

## 42.43.1 (2026-09-18)

### Fixes

#### Fix a database upgrade failure caused by a mismatched migration name ([#3957](https://github.com/virtool/virtool/pull/3957))

The upgrade stopped with an error that a paired migration was missing from the
journal. This affected versions 42.42.1 and 42.43.0.

### Maintenance

- Bump `react-hook-form` dependency group with 1 updates ([#3947](https://github.com/virtool/virtool/pull/3947))
- Bump `tanstack` dependency group with 6 updates ([#3943](https://github.com/virtool/virtool/pull/3943))

## 42.43.0 (2026-09-18)

### Features

#### End browser sessions after a period of inactivity ([#3956](https://github.com/virtool/virtool/pull/3956))

A browser session now ends after one hour with no activity, and always ends
after 24 hours. Administrators can change these times with
`VT_AUTH_SESSION_IDLE_LIFETIME_SECONDS`,
`VT_AUTH_SESSION_ABSOLUTE_LIFETIME_SECONDS`, and
`VT_AUTH_SESSION_MINIMUM_REFRESH_INTERVAL_SECONDS`. All three are optional.

**Action required:** This upgrade ends all sessions in the new sign-in system.
Tell users that they must sign in again.

## 42.42.1 (2026-09-18)

### Fixes

#### Stop stuck periodic tasks from restarting the task runner in a loop ([#3941](https://github.com/virtool/virtool/pull/3941))

A stuck periodic task now fails when it reaches its time limit. The task runner
can then continue to the replacement task. Virtool logs the IDs of these tasks.

#### Allow only one primary group for each user ([#3953](https://github.com/virtool/virtool/pull/3953))

**Action required:** The upgrade stops if a user has more than one primary
group. If this occurs, run `data-migrations export primary_group_uniqueness`
from the internal image to see the affected users. Give each user one primary
group, then run `migrate` again.

### Maintenance

- Reduce log noise from routine sign-in and permission errors ([#3954](https://github.com/virtool/virtool/pull/3954))
- Bump `astro` from 7.3.2 to 7.3.3 ([#3950](https://github.com/virtool/virtool/pull/3950))

## 42.42.0 (2026-09-18)

### Features

#### Ask users with an unusable email address to set a new one ([#3942](https://github.com/virtool/virtool/pull/3942))

Users with a blank, malformed, or duplicate email address must now enter a
unique address when they sign in. If email delivery is on, they confirm the
address with a link in an email. If it is off, setup finishes at once and the
address stays unverified.

At the end of setup, Virtool ends the older sessions of that user and starts one
new session. Administrators can run `auth-remediation report` from the internal
image to count the users who must still do this.

## 42.41.0 (2026-09-17)

### Maintenance

- Prepare the new sign-in system for use alongside legacy sessions ([#3938](https://github.com/virtool/virtool/pull/3938))

## 42.40.0 (2026-09-17)

### Fixes

#### Spell the workflow name as Nuvs in the web app ([#3939](https://github.com/virtool/virtool/pull/3939))

The workflow name now has the same spelling everywhere in the web app.

## 42.39.2 (2026-09-17)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.39.1 (2026-09-16)

### Fixes

#### Let the database upgrade continue when users have incomplete accounts ([#3936](https://github.com/virtool/virtool/pull/3936))

The upgrade stopped if a user had a blank, malformed, or duplicate email
address. Now Virtool counts these users and continues. It moves all eligible
users to the new sign-in system.

**Action required:** The upgrade still stops if a user has an invalid handle, an
invalid password hash, or a conflicting sign-in record. If this occurs, run
`data-migrations export legacy_identities` from the internal image to see the
affected users. Correct the data, then run `migrate` again.

## 42.39.0 (2026-09-16)

### Maintenance

- Prepare legacy user accounts for the new sign-in system ([#3897](https://github.com/virtool/virtool/pull/3897))

## 42.38.1 (2026-09-16)

### Maintenance

- Update dependencies, with no other change to the images
- Bump `sentry` dependency group with 4 updates ([#3922](https://github.com/virtool/virtool/pull/3922))

## 42.38.0 (2026-09-16)

### Features

#### Show workflow cache usage over time ([#3933](https://github.com/virtool/virtool/pull/3933))

The caching administration page now shows a chart of cache usage against the
storage budget. Virtool records usage each hour and keeps 30 days of history.

## 42.37.1 (2026-09-16)

### Fixes

#### Show only relevant users in the analysis user filter ([#3932](https://github.com/virtool/virtool/pull/3932))

The filter now lists only active users who have analyses in the samples and
workflows that you can see.

## 42.37.0 (2026-09-11)

### Maintenance

- Prepare to check data before schema migrations run ([#3915](https://github.com/virtool/virtool/pull/3915))

## 42.36.1 (2026-09-11)

### Fixes

#### Make the administration pages consistent ([#3931](https://github.com/virtool/virtool/pull/3931))

Administration pages now use the same headers, empty states, and settings
layout. The caching and uploads titles now agree with their names in the
navigation.

### Maintenance

- Bump `resend` from 6.25.0 to 6.27.0 ([#3928](https://github.com/virtool/virtool/pull/3928))
- Bump `lucide-react` from 1.34.0 to 1.43.0 ([#3925](https://github.com/virtool/virtool/pull/3925))
- Bump `react` dependency group with 4 updates ([#3923](https://github.com/virtool/virtool/pull/3923))

## 42.36.0 (2026-09-11)

### Features

#### Create samples in bulk from uploaded reads ([#3920](https://github.com/virtool/virtool/pull/3920))

Select read files on the sample files page to create many samples at one time.
Virtool finds read pairs and applies the same settings to all new samples.

You can edit each generated name, or use a wildcard or regular expression to
replace text in all names. Virtool shows duplicate names before it creates the
samples. If only some samples fail, Virtool keeps the failed rows so that you
can try them again.

### Maintenance

- Bump `@hono/node-server` from 2.1.0 to 2.1.1 ([#3929](https://github.com/virtool/virtool/pull/3929))
- Bump `tanstack` dependency group with 4 updates ([#3921](https://github.com/virtool/virtool/pull/3921))

## 42.35.1 (2026-09-10)

### Fixes

#### Redirect the old home page link to the dashboard ([#3918](https://github.com/virtool/virtool/pull/3918))

When you are signed in, links and bookmarks to `/home` now open the dashboard.

### Maintenance

- Align database constraint names with the PostgreSQL defaults ([#3919](https://github.com/virtool/virtool/pull/3919))

## 42.35.0 (2026-09-09)

### Features

#### Set the maximum upload size in the administration settings ([#3913](https://github.com/virtool/virtool/pull/3913))

Set the limit at `/administration/uploads`, up to 120 GB. Virtool rejects
larger files in the file manager, the reference import form, and the upload
API.

**Action required:** The maximum upload size is 5 GB on all instances after the
upgrade. If your users upload larger files, raise the limit in the
administration settings.

### Fixes

#### Keep searches and batch reads out of request URLs ([#3916](https://github.com/virtool/virtool/pull/3916))

Long searches no longer reach URL length limits, and search input no longer
appears in URL logs. A search term can have at most 1000 characters.

**Action required:** Replace all old web server replicas together, and tell
users to reload open tabs. A tab from the older version gets a 405 error on
search and batch requests. Before the upgrade, send maximum-size searches
through any gateway or web application firewall to confirm that it accepts them.

## 42.34.2 (2026-09-08)

### Fixes

#### Show the not found page for items that do not exist ([#3914](https://github.com/virtool/virtool/pull/3914))

When you open a link to an item that does not exist, Virtool now shows the not
found page. Before this change, Virtool could lose the reason for the error.

## 42.34.1 (2026-09-08)

### Fixes

#### Reduce layout shifts in the quick analyze dialog ([#3912](https://github.com/virtool/virtool/pull/3912))

The quick analyze dialog now requests its HMM and analysis options at the same
time and keeps space for them while they load, so the dialog moves less.

## 42.34.0 (2026-09-04)

### Fixes

#### Show the cache storage budget in GB ([#3911](https://github.com/virtool/virtool/pull/3911))

The field now uses decimal gigabytes, the same as other sizes in Virtool. A
budget of exactly 100 GiB changes to 100 GB. Other budgets keep their value in
bytes.

## 42.33.0 (2026-09-04)

### Features

#### Encrypt the stored NCBI API key ([#3898](https://github.com/virtool/virtool/pull/3898))

If Virtool cannot decrypt the key, the NCBI settings show an error. GenBank
lookups then continue at the rate limit that NCBI applies without a key.

**Action required:** The upgrade deletes the stored NCBI API key. Set
`VT_ENCRYPTION_KEY` if it is not set, then enter the key again in the NCBI
administration settings. Until then, GenBank lookups use the rate limit that
NCBI applies without a key.

### Maintenance

- Bump `sentry` dependency group with 4 updates ([#3900](https://github.com/virtool/virtool/pull/3900))
- Bump `testing` dependency group with 4 updates ([#3910](https://github.com/virtool/virtool/pull/3910))

## 42.32.0 (2026-09-04)

### Maintenance

- Prepare the server for pending accounts and account setup ([#3896](https://github.com/virtool/virtool/pull/3896))
- Bump `@tanstack/react-query` from 5.102.6 to 5.102.8 ([#3899](https://github.com/virtool/virtool/pull/3899))
- Bump `zod` from 4.4.3 to 4.5.4 ([#3905](https://github.com/virtool/virtool/pull/3905))

## 42.31.3 (2026-09-04)

### Features

#### Upload all files directly to storage and add upload API routes ([#3909](https://github.com/virtool/virtool/pull/3909))

API clients can now upload very large files with new routes under
`/api/v1/uploads`. The Virtool manual has a guide. File bytes no longer pass
through the web server, and the `POST /uploads` route is removed.

**Action required:** Set `VT_UPLOADS_CHUNKED` on the web app and use Azure Blob
Storage. Without this, every upload fails with a 503 error, because Virtool has
no proxied upload route now. S3 storage cannot issue upload links. Change API
clients that use `POST /uploads` to the new `/api/v1/uploads` routes.

### Maintenance

- Bump `es-toolkit` from 1.51.0 to 1.52.0 ([#3908](https://github.com/virtool/virtool/pull/3908))
- Bump `react-hook-form` from 7.86.0 to 7.87.0 ([#3903](https://github.com/virtool/virtool/pull/3903))
- Bump `@vitejs/plugin-react` from 6.1.0 to 6.1.1 ([#3902](https://github.com/virtool/virtool/pull/3902))
- Bump `@types/node` from 26.4.0 to 26.4.1 ([#3907](https://github.com/virtool/virtool/pull/3907))

## 42.31.2 (2026-09-03)

### Fixes

#### Make the tooltip background opaque ([#3895](https://github.com/virtool/virtool/pull/3895))

Tooltips now have an opaque dark grey background, so the content behind a
tooltip no longer shows through.

## 42.31.1 (2026-09-03)

### Maintenance

- Update Browserslist to a patched version ([#3894](https://github.com/virtool/virtool/pull/3894))

## 42.31.0 (2026-09-03)

### Fixes

#### Stop the web server at startup when its configuration is not valid ([#3891](https://github.com/virtool/virtool/pull/3891))

Before, the server started and then failed every request, including health
probes. Now it logs each invalid key with the reason, then exits with an
error.

## 42.30.1 (2026-09-03)

### Maintenance

- Discard email that Virtool queues while delivery is off ([#3892](https://github.com/virtool/virtool/pull/3892))

## 42.30.0 (2026-09-03)

### Features

#### Prepare for a new sign-in system and limit the format of user handles ([#3888](https://github.com/virtool/virtool/pull/3888))

New and changed user handles must have 3 to 30 characters. They can use only
letters, numbers, underscores, and periods. Sign-in does not change yet.

**Action required:** Set `VT_PUBLIC_ORIGIN` and `VT_AUTH_SECRET` on the web app
before you upgrade. `VT_PUBLIC_ORIGIN` is the one public origin of the instance,
for example `https://virtool.example`. It must use HTTPS, except on `localhost`.
`VT_AUTH_SECRET` must have at least 32 characters. Generate it with `openssl
rand -base64 32`. The web server cannot serve requests without these values.

## 42.29.1 (2026-09-02)

### Fixes

#### Fix the user handle form in administration ([#3893](https://github.com/virtool/virtool/pull/3893))

The handle field on the user administration page now stays up to date with the
saved handle.

## 42.29.0 (2026-09-02)

### Features

#### Configure email delivery in the administration settings ([#3889](https://github.com/virtool/virtool/pull/3889))

Full administrators can set the sender, store a Resend API key, turn sending
on or off, and send a test email. Administration now has separate pages for
banners, caching, NCBI, and email.

To use email, set `VT_ENCRYPTION_KEY` on the web app and the task runner.

## 42.28.0 (2026-09-02)

### Maintenance

- Prepare Virtool to send email through Resend ([#3884](https://github.com/virtool/virtool/pull/3884))

## 42.27.0 (2026-09-01)

### Features

#### Move section headers out of their boxes across the app ([#3885](https://github.com/virtool/virtool/pull/3885))

Section headers now sit above their boxes, not inside them. Badges and buttons
moved with the headers. The source type views no longer repeat the section
header.

## 42.26.0 (2026-09-01)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.25.1 (2026-08-28)

### Maintenance

- Reduce repeated data requests from the web app ([#3880](https://github.com/virtool/virtool/pull/3880))

## 42.25.0 (2026-08-28)

### Features

#### Show the workflow version on older analyses ([#3863](https://github.com/virtool/virtool/pull/3863))

The upgrade copies the version from the job of each finished analysis. An
analysis stays without a version if its job has no recorded version.

## 42.24.0 (2026-08-28)

### Features

#### Show your recently viewed samples and analyses on the dashboard ([#3879](https://github.com/virtool/virtool/pull/3879))

The Recent Samples and Recent Analyses cards have Viewed and Created toggles.
The recent analyses table and the analysis list of a sample now have a Version
column.

## 42.23.0 (2026-08-28)

### Features

#### Filter samples by group ([#3878](https://github.com/virtool/virtool/pull/3878))

The filter shows only groups that own at least one sample. The filters now
follow the order of the table columns, and the Date filter is now Created.

## 42.22.2 (2026-08-28)

### Fixes

#### Keep the installed HMM record when a later install fails ([#3876](https://github.com/virtool/virtool/pull/3876))

A failed HMM install no longer removes the record of the last good install.
The installed HMM data does not change, and you can start another install.

## 42.22.1 (2026-08-28)

### Fixes

#### Keep the cache store within budget and rebuild evicted caches ([#3877](https://github.com/virtool/virtool/pull/3877))

Recently used caches were safe from eviction, so a store could stay over its
budget. Virtool can now evict any cache, and it evicts the least recently used
caches first. A workflow that cannot find a cache file now builds it again.

### Maintenance

- Bump `@aws-sdk/lib-storage` from 3.1094.0 to 3.1119.0 ([#3875](https://github.com/virtool/virtool/pull/3875))
- Bump `hono` from 4.13.0 to 4.13.5 ([#3873](https://github.com/virtool/virtool/pull/3873))
- Bump `es-toolkit` from 1.50.0 to 1.51.0 ([#3870](https://github.com/virtool/virtool/pull/3870))
- Bump `@azure/identity` from 4.13.1 to 4.13.2 ([#3869](https://github.com/virtool/virtool/pull/3869))
- Bump `tanstack` dependency group with 2 updates ([#3866](https://github.com/virtool/virtool/pull/3866))
- Bump `@types/react-dom` from 19.2.4 to 19.2.5 ([#3868](https://github.com/virtool/virtool/pull/3868))
- Bump `@types/node` from 26.2.0 to 26.4.0 ([#3871](https://github.com/virtool/virtool/pull/3871))
- Bump `sentry` dependency group with 4 updates ([#3867](https://github.com/virtool/virtool/pull/3867))

## 42.22.0 (2026-08-26)

### Features

#### Set how many blocks a chunked upload sends at one time ([#3864](https://github.com/virtool/virtool/pull/3864))

Set `VT_UPLOADS_CHUNKED_CONCURRENCY` to change the number. The default is 8.
The smallest block size is now 16 MiB, so large files use fewer requests.

## 42.21.1 (2026-08-26)

### Fixes

#### Allow chunked uploads to reach the storage server ([#3860](https://github.com/virtool/virtool/pull/3860))

The content security policy blocked browser requests to storage, so every
chunked upload failed.

## 42.21.0 (2026-08-26)

### Features

#### Show the workflow version on the analysis detail page ([#3857](https://github.com/virtool/virtool/pull/3857))

Click the version or the start time in the header to copy it.

## 42.20.0 (2026-08-26)

### Features

#### Upload large files directly to Azure Blob Storage in blocks ([#3859](https://github.com/virtool/virtool/pull/3859))

Set `VT_UPLOADS_CHUNKED` to turn this on. It is off by default. Virtool then
sends a large file to storage in many short requests, which prevents idle
timeouts during long uploads.

Set `VT_STORAGE_AZURE_UPLOAD_URL` to use a public host for these requests.

### Maintenance

- Start periodic tasks again when an earlier task stops responding ([#3853](https://github.com/virtool/virtool/pull/3853))

## 42.19.1 (2026-08-26)

### Fixes

#### Align the samples list with the sidebar ([#3858](https://github.com/virtool/virtool/pull/3858))

The samples list now sits against the sidebar, like the other lists. It is no
longer centered with a gap.

## 42.19.0 (2026-08-26)

### Features

#### Redirect file downloads to short-lived storage links ([#3848](https://github.com/virtool/virtool/pull/3848))

Administrators can set `VT_STORAGE_DOWNLOAD_MODE` to `redirect`. Virtool then
sends sample, index, subtraction, and upload downloads directly from storage.
The default is `stream`, which does not change how downloads work.

Set `VT_STORAGE_AZURE_DOWNLOAD_URL` to use a public host for Azure links.

#### Sort the samples list by creation date, name, or owner ([#3854](https://github.com/virtool/virtool/pull/3854))

The samples list is now a table with aligned columns and selection controls.

### Maintenance

- Record the workflow version when an analysis finishes ([#3856](https://github.com/virtool/virtool/pull/3856))

## 42.18.0 (2026-08-25)

### Features

#### Track uploads in a persistent panel ([#3852](https://github.com/virtool/virtool/pull/3852))

Upload progress now appears in a card that you open from the navigation bar.
Each row shows progress as a background fill, and finished uploads clear after a
short time. A cancelled upload no longer records a truncated file.

## 42.17.0 (2026-08-25)

### Features

#### Run the jobs API, tasks, and migrations from one internal image ([#3850](https://github.com/virtool/virtool/pull/3850))

**Action required:** Deploy the jobs API, the task runner, and the migration Job
from `ghcr.io/virtool/internal`. Pass `serve` to the jobs API, `run` to the task
runner, and `migrate` to the migration Job as the container argument. Remove the
`node dist/migrate.mjs` command from the migration Job. The image runs `serve`
if you do not give an argument. Virtool no longer publishes new
`ghcr.io/virtool/jobs-api` and `ghcr.io/virtool/tasks` images. Ports and
environment variables do not change.

#### Set the cache storage budget without a deployment ([#3851](https://github.com/virtool/virtool/pull/3851))

Administrators can now set the cache storage budget in the server settings. The
value is in GiB. The default is 100 GiB and the minimum is 1 GiB.

### Maintenance

- Bump `@testcontainers/postgresql` from 12.0.4 to 12.1.0 ([#3835](https://github.com/virtool/virtool/pull/3835))
- Bump `tanstack` dependency group with 5 updates ([#3838](https://github.com/virtool/virtool/pull/3838))
- Bump `react-dropzone` from 20.1.0 to 20.1.1 ([#3832](https://github.com/virtool/virtool/pull/3832))
- Bump `testing` dependency group with 3 updates ([#3828](https://github.com/virtool/virtool/pull/3828))
- Bump `lucide-react` from 1.28.0 to 1.33.0 ([#3831](https://github.com/virtool/virtool/pull/3831))
- Bump `vite` dependency group with 2 updates ([#3829](https://github.com/virtool/virtool/pull/3829))
- Bump `react-hook-form` dependency group with 2 updates ([#3837](https://github.com/virtool/virtool/pull/3837))

## 42.16.2 (2026-08-24)

### Fixes

#### Keep user filters usable on instances with many users ([#3847](https://github.com/virtool/virtool/pull/3847))

Your own user now stays above the user list, and the list scrolls vertically.

## 42.16.1 (2026-08-24)

### Maintenance

- Restore job records for legacy index builds that lost them ([#3846](https://github.com/virtool/virtool/pull/3846))

## 42.16.0 (2026-08-24)

### Maintenance

#### Remove the unused sample column from analyses ([#3844](https://github.com/virtool/virtool/pull/3844))

The worksheet title in Pathoscope Excel exports now always uses the numeric
sample ID.

## 42.15.1 (2026-08-24)

### Fixes

#### Stop the layout shifting when a selector menu opens ([#3843](https://github.com/virtool/virtool/pull/3843))

Selector menus, such as the subtraction selector, no longer add a scroll bar or
shift a dialog when they open. The menu now also stays in the viewport.

## 42.15.0 (2026-08-24)

### Fixes

#### Use Delete for all actions that destroy an object ([#3841](https://github.com/virtool/virtool/pull/3841))

Virtool now uses Delete when an action destroys an object, such as a sample or a
label. It uses Remove only when the object stays, such as a reference member or
an administrator role.

### Maintenance

- Rename instance messages to banners in the database and server ([#3842](https://github.com/virtool/virtool/pull/3842))
- Reorganize the shared web components ([#3840](https://github.com/virtool/virtool/pull/3840))

## 42.14.0 (2026-08-24)

### Fixes

#### Stop reporting unreadable GenBank records as missing ([#3826](https://github.com/virtool/virtool/pull/3826))

When NCBI sends a record that Virtool cannot read, the sequence form now gets an
error that says so. Before, Virtool reported that the record did not exist.

## 42.13.0 (2026-08-24)

### Maintenance

- Use identity columns for integer primary keys ([#3825](https://github.com/virtool/virtool/pull/3825))

## 42.12.0 (2026-08-20)

### Features

#### Filter samples by creation date ([#3824](https://github.com/virtool/virtool/pull/3824))

The sample filter bar now has month, year, and calendar range controls. The link
to the page keeps the selected dates.

## 42.11.0 (2026-08-20)

### Maintenance

- Remove six unused database columns ([#3823](https://github.com/virtool/virtool/pull/3823))

## 42.10.0 (2026-08-20)

### Features

#### Sort and filter a sample's analyses ([#3822](https://github.com/virtool/virtool/pull/3822))

A sample's analyses now appear in a table with Workflow, Reference,
Subtractions, User, and Created columns. You can sort by workflow, user, or
creation time, and filter by workflow or user.

### Maintenance

- Remove the unused lease sweep and runner ID filter from tasks ([#3820](https://github.com/virtool/virtool/pull/3820))

## 42.9.0 (2026-08-20)

### Maintenance

- Remove four unused tables and two enum types from the database ([#3819](https://github.com/virtool/virtool/pull/3819))

## 42.8.0 (2026-08-20)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.7.2 (2026-08-20)

### Maintenance

- Change only the local development tools, with no change to the images

## 42.7.1 (2026-08-20)

### Fixes

#### Stop asking users to reload after each deployment ([#3815](https://github.com/virtool/virtool/pull/3815))

Virtool no longer shows the new version prompt. An open tab now reloads only
when a deployment removes a file that the tab needs for the next page.

### Maintenance

- Use one shared timestamp format in internal APIs ([#3816](https://github.com/virtool/virtool/pull/3816))

## 42.7.0 (2026-08-20)

### Maintenance

- Remove the unused Alembic and legacy migration tables ([#3814](https://github.com/virtool/virtool/pull/3814))

## 42.6.0 (2026-08-19)

### Features

#### Sort uploaded files by name, user, creation time, and size ([#3813](https://github.com/virtool/virtool/pull/3813))

The sample and subtraction file pages now show uploaded files in a table. The
link to the page keeps the sort order.

## 42.5.1 (2026-08-19)

### Fixes

#### Count only readable samples in the sample list total ([#3809](https://github.com/virtool/virtool/pull/3809))

API clients that list samples now get a `totalCount` that includes only the
samples they can read. Before, it counted every sample on the instance, so users
who are not administrators could see how many samples they could not read.
Administrators see no change.

## 42.5.0 (2026-08-19)

### Features

#### Set an NCBI API key to raise the GenBank rate limit ([#3811](https://github.com/virtool/virtool/pull/3811))

Administrators can now set an NCBI API key in the server settings. Virtool sends
the key with GenBank requests, which raises the NCBI limit from three requests a
second to ten. Virtool does not show the stored key. It shows only if a key is
set, and you can replace or clear the key.

### Fixes

#### Align progress circles in analysis and reference lists ([#3810](https://github.com/virtool/virtool/pull/3810))

Progress circles in analysis lists now align with the end icons in job lists.
Progress circles in reference lists now use the same centered position.

### Maintenance

- Remove unused handling for unknown live update events ([#3812](https://github.com/virtool/virtool/pull/3812))

## 42.4.2 (2026-08-19)

### Fixes

#### Show the created count beside the Create button ([#3802](https://github.com/virtool/virtool/pull/3802))

The Analyze, Quick Analyze, and Create Sample dialogs now show a count that
fades beside the Create button. Before, a toast covered the button when you
created more than one item.

## 42.4.1 (2026-08-19)

### Fixes

#### Stop a database migration from failing on a legacy trigger ([#3808](https://github.com/virtool/virtool/pull/3808))

A migration changed the `instance_messages.user` column while a legacy trigger
still depended on it, and this could stop an upgrade. Virtool no longer makes
this unnecessary change, so the next migration can remove the trigger and the
column.

#### Show a BLAST result error at once instead of a timeout ([#3806](https://github.com/virtool/virtool/pull/3806))

When NCBI sends a BLAST result in a changed format, Virtool now records the
error and stops asking. The error names the missing key. Before, Virtool fetched
the result again for thirty minutes and then reported a timeout.

## 42.4.0 (2026-08-19)

### Maintenance

- Remove the duplicate reference columns from analyses ([#3807](https://github.com/virtool/virtool/pull/3807))

## 42.3.0 (2026-08-19)

### Maintenance

- Remove the unused user column from instance messages ([#3803](https://github.com/virtool/virtool/pull/3803))

## 42.2.0 (2026-08-19)

### Maintenance

- Remove leftover Python service wording from internal messages ([#3798](https://github.com/virtool/virtool/pull/3798))
- Convert unbounded varchar database columns to text ([#3801](https://github.com/virtool/virtool/pull/3801))

## 42.1.0 (2026-08-18)

### Maintenance

- Add a database index for job queue reads ([#3797](https://github.com/virtool/virtool/pull/3797))

## 42.0.0 (2026-08-18)

### Maintenance

- Move the web app source code into the `virtool/virtool` repository
