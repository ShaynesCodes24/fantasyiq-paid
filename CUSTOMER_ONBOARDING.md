# Customer Onboarding Checklist

Use this for each $30/year FantasyIQ Season Pass customer.

## Payment

1. Confirm payment:

```text
Customer paid:
Payment provider:
Payment reference:
Renewal date:
```

2. Collect customer info:

Customer ID instructions:

```text
leagueId is in the ESPN browser URL after leagueId=.
teamId is in the ESPN team/roster page URL after teamId=.
If teamId is missing, use the customer's team name and verify it against the ESPN team list.
```

```text
Name:
Email:
Number of leagues included:
```

Repeat this block for each league:

```text
League label/key:
ESPN league ID:
ESPN team ID:
Season:
League name:
Scoring format:
Team count:
Starting lineup slots:
Bench spots:
IR spots:
Draft rounds:
Playoff teams:
Draft date/time:
Logo file or logo URL:
```

Use `CUSTOMER_INTAKE.md` as the customer-facing version of this form.

3. Confirm league access:

```text
Each ESPN league must be public for live draft sync.
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
FANTASY_IQ_LEAGUE_SETTINGS
FANTASY_IQ_CUSTOMERS_JSON
FANTASY_IQ_LEAGUES_JSON
```

6. Deploy to Vercel.

7. Test:

```text
/FantasyIQ/
/FantasyIQ/?customer=customer-slug&league=league-key
/api/live-draft
/api/live-draft?customer=customer-slug&league=league-key
```

8. Send customer:

```text
Dashboard link:
Access code:
Renewal date:
Support contact:
```

## Delivery Message

```text
Your FantasyIQ dashboard is live:

Dashboard:
Access code:
Renewal date:
Included leagues:

Live draft sync is connected to your public ESPN leagues. Before draft day,
please open the Draft Room tab, switch through each league, and confirm that
league names and teams load.
```
