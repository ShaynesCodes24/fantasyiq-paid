# Customer Onboarding Checklist

Use this for each $25/year Fantasy IQ concierge setup customer.

## Payment

1. Confirm payment:

```text
Customer paid:
Payment provider:
Payment reference:
Renewal date:
```

2. Collect customer info:

```text
Name:
Email:
ESPN league ID:
Season:
League name:
Scoring format:
Roster settings:
Draft date/time:
Logo file or logo URL:
```

Use `CUSTOMER_INTAKE.md` as the customer-facing version of this form.

3. Confirm league access:

```text
The ESPN league must be public for live draft sync.
```

4. Configure branding:

```text
public/FantasyIQ/config.js
public/FantasyIQ/assets/league-logo.jpeg
```

5. Configure Vercel env vars:

```text
FANTASY_IQ_LEAGUE_ID
FANTASY_IQ_SEASON
```

6. Deploy to Vercel.

7. Test:

```text
/FantasyIQ/
/api/live-draft
```

8. Send customer:

```text
Dashboard link:
Renewal date:
Support contact:
```

## Delivery Message

```text
Your Fantasy IQ dashboard is live:

Dashboard:
Renewal date:

Live draft sync is connected to your public ESPN league. Before draft day,
please open the Draft Room tab and confirm that your league name and teams load.
```
