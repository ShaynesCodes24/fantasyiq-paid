# FantasyIQ UDK+ Integration

This integration is for private Fantasy Footballers UDK+ CSV exports that you purchased. It should improve FantasyIQ as a second-opinion signal without copying a premium product into a public dashboard.

## Guardrails

- Do not scrape logged-in UDK+ pages.
- Do not commit raw UDK+ CSV exports.
- Do not commit generated UDK signal JSON files.
- Do not publish raw UDK rankings, projections, notes, videos, player profiles, or premium tables to customer dashboards unless you have explicit redistribution rights.
- Use UDK+ as an expert-alignment signal beside FantasyIQ's ESPN/Sleeper/league-specific model.

Official support says CSV export is available from the web UDK positional rankings pages. The UDK is described as a draft-prep product, not a live draft tracker.

Reference links:
- CSV export help: `https://help.thefantasyfootballers.com/en/articles/3157953`
- UDK purpose and live-draft limits: `https://help.thefantasyfootballers.com/en/articles/3158273`
- UDK+ feature menu: `https://www.thefantasyfootballers.com/2026-ultimate-draft-kit/faq/`
- Terms of use: `https://www.thefantasyfootballers.com/terms-of-use/`

## Local Import

Put exported CSV files in:

```text
private/udk/
```

Suggested names:

```text
private/udk/qb.csv
private/udk/rb.csv
private/udk/wr.csv
private/udk/te.csv
private/udk/dst.csv
private/udk/k.csv
```

Run:

```powershell
python scripts\import_udk_csv.py --strict
```

This writes:

```text
private/udk/udk_signals.local.json
```

Then set:

```powershell
$env:FANTASYIQ_UDK_SIGNALS_FILE="private/udk/udk_signals.local.json"
```

Run the dashboard or readiness checks normally.

## What FantasyIQ Uses

The importer keeps only compact structured signals:

- Player name
- Position
- Team when present
- UDK rank
- UDK positional rank
- UDK tier
- Risk/upside/projection/ADP when present in the export

FantasyIQ does not need raw UDK notes or premium profile copy.

## Product Behavior

When a private UDK signal file is configured:

- Player rows get UDK rank, tier, delta, and alignment fields.
- Draft Room recommendation cards show expert alignment.
- Player drawers and Big Board analysis show the UDK second-opinion read.
- Mock Simulator managers can react to expert alignment as another market signal.
- Big Board unlocks a UDK View tab for consensus targets, UDK-higher players, and FantasyIQ-higher caution spots.

When no private signal file is configured, FantasyIQ behaves exactly as before.
