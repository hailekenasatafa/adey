# Adey — Store Launch Checklist (Google Play + App Store)

Status as of 2026-11-14. The backend and website are live; no store build exists yet because every remaining step needs an account, a credential, or a decision that belongs to the owner.

## Done
- Supabase project `adey` (`glxnvkqxedyxxhfhwuwr`): 15 migrations, seed categories, storage buckets, edge functions, scheduled jobs.
- Website on Netlify at the custom domain https://adeyconnect.com (HTTPS; `www` redirects to it; the old https://adey-app.netlify.app address still works), built with `NEXT_PUBLIC_SITE_URL=https://adeyconnect.com`.
- Supabase Authentication → URL Configuration: Site URL `https://adeyconnect.com`, redirect URLs `https://adeyconnect.com/**` and `https://adey-app.netlify.app/*`.
- Custom SMTP is enabled in Supabase, sending through a personal Gmail account (fine for testing; move to a transactional provider with an adeyconnect.com sender before public launch).
- The owner's website account has `platform_role = 'admin'`; the admin console at `/admin` was checked live on 2026-11-14.
- `apps/mobile/eas.json` carries the live Supabase URL, publishable key, and website URL (`https://adeyconnect.com`) for every build profile.
- Bundle id / package set to `com.adeyconnect.app`; app links point at `adeyconnect.com`.
- In-app account deletion request, report/block tools, privacy policy and terms pages, permission strings.

## Owner steps before any store build

| # | Step | Where | Blocks |
|---|---|---|---|
| 1 | Done 2026-11-14 (see above). Still to add if the app ever redirects straight into itself: `adey://**` | Supabase → Authentication → URL Configuration | Email confirmation and password reset links |
| 2 | Replace the personal Gmail SMTP with a transactional provider (Resend, Brevo, Postmark…) sending from an adeyconnect.com address | Supabase → Authentication → Emails → SMTP Settings | Deliverability and sending limits at public scale |
| 3 | Done 2026-11-14 | Website + SQL | Verification review, moderation, settings |
| 4 | Create an Expo account, run `eas init` in `apps/mobile`, put the project id / owner into `app.json` | expo.dev | All EAS builds |
| 5 | Google Maps "Maps SDK for Android" key → `app.json` `android.config.googleMaps.apiKey` | Google Cloud Console | Android map screens |
| 6 | Push credentials via `eas credentials`: FCM V1 service account (Android), APNs key (iOS) | Firebase + Apple | Push notifications |
| 7 | Confirm the bundle id / package (`com.adeyconnect.app` since 2026-11-14) — it cannot change after the first store upload | `app.json` | First upload |

## Google Play
1. Play Console developer account (US$25 once). A **personal** account created after 13 Nov 2023 must run a closed test with at least 12 testers opted in for 14 continuous days before it can apply for production. An **organization** account (needs a D-U-N-S number) is exempt.
2. Create the app, complete: store listing (texts in `MOBILE_DEPLOYMENT.md` §4), screenshots, feature graphic, content rating, target audience, Data safety form (`MOBILE_DEPLOYMENT.md` §6), privacy policy URL, account-deletion URL.
3. `eas build -p android --profile production` → `.aab`. With the app created in Play Console and a Google service-account key uploaded to Expo, `eas submit -p android` creates the first release on the **internal** track (Expo docs, checked 2026-11-14); uploading the first build by hand in Play Console also works.
4. Internal testing → closed testing (12 testers / 14 days if personal) → apply for production → review.

## App Store
1. Apple Developer Program (US$99/year). Enrolling as a company needs a D-U-N-S number.
2. App Store Connect: create the app with the bundle id, fill `eas.json → submit.production.ios` (Apple ID, ASC app id, team id).
3. `eas build -p ios --profile production` then `eas submit -p ios` → TestFlight.
4. Test on real devices through TestFlight. Complete App Privacy answers, screenshots (6.9" iPhone at minimum), age rating, review notes.
5. App Review needs a **demo account** with data in it, and the marketplace needs real published businesses — an empty catalog reads as an unfinished app.
6. Submit for review.

## Review risks to close first
- **Empty marketplace.** Onboard a handful of real businesses (and at least one screen listing) before submitting to either store.
- **Account deletion.** The app files a deletion request that staff complete within 30 days; someone must actually process the queue.
- **User-generated content.** Reports land in the admin area; reviewers expect them to be acted on, and a support contact that answers (`support@adey.app` needs a real mailbox).
- **Domain.** The owned domain is `adeyconnect.com` (registered at Spaceship, pointed at Netlify). The website footer, privacy page and `platform_settings.app.support_email` still say `support@adey.app`, which is not owned, and adeyconnect.com has no mailbox yet. Universal links also need `/.well-known/assetlinks.json` and `apple-app-site-association` on the website after the first builds.
- **Device testing.** Nothing has run on a physical phone yet: maps, camera/photo upload, push, and secure session storage have only been type-checked and unit-tested.

## Realistic order
Steps 1–7 above → Android APK (`preview` profile) on a real phone → fix what device testing finds → TestFlight + Play internal track → pilot businesses → closed test clock (if personal Play account) → submit to both stores.
