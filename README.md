# Electric Tariff Comparison - Dynamic Next.js App

A presentation-ready web app for comparing electricity plans using real project datasets.

## What is included
- Step-by-step wizard for home details, plan comparison, usage insights, and recommendation
- Server-side electricity plan calculation from `data/Tarrifs_validated.csv`
- Load-profile parsing from `data/task2_load_profiles.xlsx`
- Market trend analysis from `data/full_year_halfhour_profile.csv`
- Final recommendation generated only after clicking Compare Plans

## Key structure
- `app/page.tsx`
- `components/StepWizard.tsx`
- `components/HouseholdForm.tsx`
- `components/TariffResults.tsx`
- `components/FlexibilityResults.tsx`
- `components/RecommendationCard.tsx`
- `lib/loadProfiles.ts`
- `lib/tariffs.ts`
- `lib/marketSignals.ts`
- `lib/calculations.ts`
- `lib/server/analysis-runtime.ts`

## Runtime data sources
The app reads these files from the root `data/` folder at runtime:
- `data/task2_load_profiles.xlsx`
- `data/Tarrifs_validated.csv`
- `data/full_year_halfhour_profile.csv`

## Run locally
```powershell
npm install
npm run dev
```
Then open:
```powershell
http://localhost:3000
```

## Recommended deployment
Deploy on **Vercel** for the cleanest demo link.
After deployment, generate a QR code from the live URL so people in the presentation can scan and open it on their phone.

## Notes
- Analysis runs in `/api/analyze` when the user clicks **Analyze and run model**.
- Input changes do not recompute results until submission.
- Region and annual kWh both influence tariff ranking in the server calculation.
