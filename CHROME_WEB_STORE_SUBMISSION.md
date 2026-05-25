# Chrome Web Store Submission

Use this for the MyFantasyIQ Draft Sync Companion Chrome Web Store listing.

## Upload Package

Upload this ZIP in the Chrome Developer Dashboard:

```text
artifacts/chrome-web-store/myfantasyiq-draft-sync-companion-0.1.0.zip
```

The ZIP has `manifest.json` at the root and includes:

```text
manifest.json
dashboard.js
espn-draft.js
icons/icon16.png
icons/icon32.png
icons/icon48.png
icons/icon128.png
```

## Listing Assets

Use these assets:

```text
artifacts/chrome-web-store/screenshot-privacy-sync.png
artifacts/chrome-web-store/screenshot-live-value.png
artifacts/chrome-web-store/promo-small.png
public/draft-sync-companion/icons/icon128.png
```

Do not submit `screenshot-install-flow.png` because it references beta download and pending store status. Do not use `screenshot-draft-room.png` as a primary listing asset while it shows demo-mode site chrome. Use the polished screenshots above instead.

## Store Listing Copy

Name:

```text
MyFantasyIQ Draft Sync Companion
```

Short description:

```text
Sync ESPN fantasy football draft-room pick events into MyFantasyIQ during live drafts.
```

Detailed description:

```text
The MyFantasyIQ Draft Sync Companion helps your MyFantasyIQ Draft Room stay current during live ESPN fantasy football drafts when ESPN does not publish live pick events through the public league feed.

After installation, open your MyFantasyIQ Draft Room and launch ESPN from there. The companion runs locally in Chrome on MyFantasyIQ and ESPN fantasy draft-room pages. It reads draft-room pick events from the ESPN draft tab you are already logged into, then sends only the draft sync data needed to keep your recommendations, drafted-player filtering, roster tracker, and live draft board current. Draft sync payloads are sent only when pick or undo events occur.

The companion does not collect or store ESPN passwords. It does not send ESPN session cookies to MyFantasyIQ. It is limited to MyFantasyIQ pages, ESPN fantasy draft pages, and ESPN draft-related endpoints needed for live draft sync.

The companion may request an ESPN draft security token inside the user's Chrome browser to connect to the active ESPN draft room. That token is used locally in Chrome. It is not stored by the extension and is not sent to MyFantasyIQ.

MyFantasyIQ is not affiliated with, endorsed by, or sponsored by ESPN.
```

Category:

```text
Sports
```

Language:

```text
English
```

Website:

```text
https://myfantasyiq.com/
```

Support email:

```text
support@myfantasyiq.com
```

Privacy policy:

```text
https://myfantasyiq.com/privacy.html
```

## Permission Justifications

`storage`:

```text
Stores the current MyFantasyIQ draft sync configuration locally in the user's browser so the ESPN draft room can connect to the active MyFantasyIQ draft session.
```

`https://myfantasyiq.com/*`:

```text
Detects whether the companion is installed, receives draft sync configuration from the user's MyFantasyIQ Draft Room, and confirms connection status.
```

`https://fantasy.espn.com/*`:

```text
Runs on the ESPN fantasy draft room opened by the user so the companion can observe draft-room pick events.
```

`https://lm-api-reads.fantasy.espn.com/*`:

```text
Requests the ESPN draft security token using the user's existing ESPN browser session so the companion can connect to the active draft room.
The token is used locally in Chrome and is not stored or sent to MyFantasyIQ.
```

`https://fantasydraft.espn.com/*`:

```text
Connects to ESPN draft-room event endpoints used by the active ESPN draft room.
```

## Privacy Practices

Data collected or transmitted:

```text
ESPN league ID, season, ESPN team ID, ESPN member ID, draft pick event data, and a MyFantasyIQ draft bridge session key. This data is transmitted only for the user-facing live draft sync feature.
```

Data not collected:

```text
ESPN password, ESPN session cookies, payment details, browsing history outside MyFantasyIQ and ESPN draft-room pages, messages, emails, contacts, location, microphone, camera, or files.
The ESPN draft security token used to connect to the active draft room is not stored or transmitted to MyFantasyIQ.
```

Purpose:

```text
The data is used only to sync live ESPN draft-room events into the user's MyFantasyIQ Draft Room.
```

Sale or transfer:

```text
MyFantasyIQ does not sell companion extension data.
```

Chrome privacy form guidance:

```text
Be conservative and disclose the extension's live draft sync data instead of trying to classify it as no data collection.

Likely disclosures:
- Website content: ESPN draft-room pick events read from the ESPN draft page.
- User identifiers, if asked: ESPN league ID, team ID, and member ID used to connect the user's draft room.
- Authentication information: do not disclose ESPN passwords or ESPN session cookies as collected because they are not collected or transmitted. In reviewer notes, disclose that an ESPN draft security token is requested and used locally in Chrome only.

Not collected:
- Authentication information: no ESPN password, no ESPN session cookie, no payment credentials.
- Location, web history, messages, contacts, health information, financial/payment information, files, camera, microphone.

Purpose:
- App functionality.

Sale/transfer:
- Do not sell data.
- Do not use data for advertising or unrelated analytics.
```

## Submission Steps

1. Open the Chrome Developer Dashboard.
2. Register/pay the Chrome Web Store developer fee if the account is not already registered.
3. Create a new item.
4. Upload `artifacts/chrome-web-store/myfantasyiq-draft-sync-companion-0.1.0.zip`.
5. Complete the store listing fields using the copy above.
6. Complete privacy practices using the declarations above.
7. Set initial visibility to `Unlisted` unless you want it searchable on day one. Unlisted still allows anyone with the URL to install it after approval.
8. Submit for review.
9. After approval, replace the install page's pending Chrome Web Store link with the approved listing URL.

## Review Time Expectation

Google does not guarantee a review within a few hours.

Official guidance says most reviews complete within a few days, but review can take up to a few weeks. Signals that can slow review include new developers, new extensions, dangerous permission requests, significant code changes, broad host permissions, sensitive execution permissions, or hard-to-review code.

This extension is a new extension and requests specific host access for MyFantasyIQ and ESPN draft endpoints, so a same-day approval is possible but not something to rely on.

To reduce review friction:

- Keep the first submission narrow and single-purpose.
- Do not add extra permissions.
- Use the exact permission justifications above.
- Use `https://myfantasyiq.com/privacy.html` as the privacy policy.
- Make sure the privacy practices form matches this document and the public privacy policy.
- Add reviewer notes that the extension does not collect ESPN passwords or ESPN session cookies.
- Add `chromewebstore-noreply@google.com` to contacts so review emails are not missed.

Reviewer notes:

```text
This extension has one purpose: live ESPN draft-room sync for the user's MyFantasyIQ Draft Room.

To test:
1. Install the extension.
2. Open https://myfantasyiq.com/draft-sync-companion/install.html and confirm the page changes from Not installed to Installed.
3. Open https://myfantasyiq.com/draft-sync-companion/reviewer.html and confirm the review page changes from Not installed to Installed. This verifies the MyFantasyIQ content script path without requiring a live ESPN draft room.
4. Open https://myfantasyiq.com/FantasyIQ/#live and confirm the Draft Room shows Companion Installed.
5. In a real ESPN fantasy football draft room opened by the user, the extension reads ESPN draft-room pick events and sends only draft pick or undo event data to the user's MyFantasyIQ draft bridge endpoint.

The extension does not collect ESPN passwords. It does not send ESPN session cookies to MyFantasyIQ. It only transmits ESPN league ID, season, team ID, member ID, draft pick or undo events, and a MyFantasyIQ bridge session key for the live draft sync feature. It does not send timed heartbeat snapshots to MyFantasyIQ.

The extension may request an ESPN draft security token inside Chrome to connect to the user's active ESPN draft room. That token is used locally in Chrome only. It is not stored by the extension and is not sent to MyFantasyIQ.

MyFantasyIQ is not affiliated with, endorsed by, or sponsored by ESPN.
```

## Post-Approval Site Change

After Google approves the listing, update:

```text
public/draft-sync-companion/install.html
```

Replace the pending Chrome Web Store link with the real listing URL and change the button text to:

```text
Add to Chrome
```
