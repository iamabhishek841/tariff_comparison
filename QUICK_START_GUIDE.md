# Quick Start & Reference Guide

## Project Overview

**tariff_compare** is a Next.js application that provides:
- Household tariff comparison across 74+ electricity plans
- Flexibility analysis based on consumption patterns
- Market signal integration
- Urban/rural-aware pricing

**Tech Stack:**
- Frontend: Next.js 14 + React + TypeScript + Tailwind CSS
- Backend: Node.js API routes
- Data: XLSX profiles, CSV tariffs, CSV market data
- Language: TypeScript

---

## Running the Application

### Development Mode

```bash
# Terminal 1: Start dev server
cd E:\tariff_compare
npm run dev

# Output should show:
# ✓ Next.js 14.2.25
# - Local: http://localhost:3000
# ✓ Ready in 3.2s
```

Once running, **the first API request will load datasets** (takes ~2 seconds). Subsequent requests will use cached data (~11ms).

### Production Build

```bash
# Build
npm run build

# Start production server
npm start
```

---

## API Endpoints

### GET /api/analysis-options

Returns available occupancy groups, dwelling types, and meter types.

**Request:**
```bash
curl http://localhost:3000/api/analysis-options
```

**Response:**
```json
{
  "occupancyGroups": ["2_occ", "3_occ", "4_occ", "5_occ"],
  "dwellingGroups": ["apartment", "bungalow", "detached", "semi_detached", "terraced"],
  "meterTypes": ["All meter types", "24 Hour Meter", "24 Hour Standard Meter", ...]
}
```

**Performance:**
- First call: ~2158ms (includes dataset loading)
- Subsequent calls: ~11ms (cached)

---

### POST /api/analyze

Performs complete tariff and flexibility analysis.

**Request:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "occupancyGroup": "2_occ",
    "dwellingGroup": "apartment",
    "region": "urban",
    "annualKwh": 3500,
    "meterFilter": "All meter types"
  }'
```

**Required Fields:**
| Field | Type | Values | Notes |
|-------|------|--------|-------|
| occupancyGroup | string | 2_occ, 3_occ, 4_occ, 5_occ | Household size |
| dwellingGroup | string | apartment, bungalow, detached, semi_detached, terraced | Property type |
| region | string | urban, rural | Location type |
| annualKwh | number | >0 | Annual consumption in kWh |
| meterFilter | string | "All meter types" or specific type | Meter filtering |

**Response:**
```json
{
  "profile": {
    "occupancyGroup": "2_occ",
    "dwellingGroup": "apartment",
    "slots": [/* 48 half-hourly consumption percentages */]
  },
  "tariffResults": [
    {
      "name": "Plan Name",
      "provider": "Provider",
      "meterType": "24 Hour Meter",
      "unitRate": 0.45,
      "standingCharge": 0.50,
      "annualCost": 1850.25,
      "potentialSavings": 125.50,
      "region": "urban"
    },
    /* 73 more plans */
  ],
  "flexibilityResults": [
    {
      "slot": 1,
      "timeLabel": "00:00",
      "consumption": 0.0136,
      "flexibilityIndex": 0.85
    },
    /* 47 more slots */
  ],
  "marketSignals": {
    "hourly": [/* 24 hours of market prices */]
  },
  "recommendation": {
    "topPlan": { /* best tariff */ },
    "topFlexibility": { /* best flexibility slot */ },
    "savings": 125.50
  }
}
```

**Performance:**
- Time: ~426ms
- Includes: tariff comparison + flexibility analysis + market signals

---

## Data Structure

### Load Profiles
**File:** `data/task2_load_profiles.xlsx`
**Contains:** 4 occupancy groups × 5 dwelling types × 48 half-hour slots = 960 rows

**Usage:** Normalized consumption patterns for each household profile

### Tariffs
**File:** `data/Tarrifs_validated.csv`
**Contains:** 74 electricity tariff plans

**Fields:** Name, Provider, MeterType, UnitRate, StandingCharge, Region, etc.

### Market Signals
**File:** `data/full_year_halfhour_profile.csv`
**Contains:** 48 half-hourly market price signals

**Usage:** Identifies peak/off-peak pricing periods

---

## Console Logs

### During Dev Server Startup

**First API call (cache miss):**
```
[api/analysis-options] GET request received
[analysis-runtime] START - process.cwd(): E:\tariff_compare
[analysis-runtime] Checking file: task2_load_profiles.xlsx
[analysis-runtime] ✓ task2_load_profiles.xlsx found at ...
[analysis-runtime] Parsing task2_load_profiles.xlsx...
[analysis-runtime] ✓ Parsed profiles in 117ms - 4 groups
[analysis-runtime] Parsing Tarrifs_validated.csv...
[analysis-runtime] ✓ Parsed tariffs in 15ms - 74 plans
[analysis-runtime] Parsing full_year_halfhour_profile.csv...
[analysis-runtime] ✓ Parsed market in 2ms - 48 rows
[analysis-runtime] READY - All datasets loaded successfully
[api/analysis-options] Successfully loaded options
GET /api/analysis-options 200 in 2158ms
```

**Second API call (cache hit):**
```
[api/analysis-options] GET request received
[api/analysis-options] Successfully loaded options
GET /api/analysis-options 200 in 11ms
```

---

## File Structure

```
E:\tariff_compare/
├── app/
│   ├── api/
│   │   ├── analysis-options/route.ts      # GET options endpoint
│   │   └── analyze/route.ts               # POST analysis endpoint
│   ├── page.tsx                           # Home page
│   └── layout.tsx                         # App layout
├── lib/
│   ├── server/
│   │   └── analysis-runtime.ts            # Async dataset loading
│   ├── types.ts                           # TypeScript types
│   ├── calculations.ts                    # Analysis logic
│   ├── loadProfiles.ts                    # XLSX parsing
│   ├── tariffs.ts                         # CSV tariff parsing
│   ├── marketSignals.ts                   # Market data parsing
│   └── files.ts                           # File resolution
├── components/
│   ├── HouseholdForm.tsx                  # Input form
│   ├── TariffResults.tsx                  # Tariff table
│   ├── FlexibilityResults.tsx             # Flexibility chart
│   └── ...
├── data/
│   ├── task2_load_profiles.xlsx           # Profiles
│   ├── Tarrifs_validated.csv              # Tariffs
│   └── full_year_halfhour_profile.csv     # Market data
├── public/
│   └── data/
│       ├── plans.json
│       ├── profiles.json
│       └── market-signals.json
└── [config files: tsconfig.json, tailwind.config.ts, etc.]
```

---

## Troubleshooting

### Issue: API returns empty or no data

**Solution:**
1. Check dev server console for `[analysis-runtime]` logs
2. Verify `READY - All datasets loaded successfully` appears
3. Try second request (first may timeout if loading takes too long)

### Issue: Files not found

**Solution:**
1. Verify data files exist in `E:\tariff_compare\data\`
2. Check console for exact paths being searched
3. Files needed:
   - `task2_load_profiles.xlsx`
   - `Tarrifs_validated.csv`
   - `full_year_halfhour_profile.csv`

### Issue: Build fails

**Solution:**
```bash
# Clear cache and rebuild
Remove-Item ".\.next" -Recurse -Force -ErrorAction SilentlyContinue
npm run build
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Kill Node processes
taskkill /F /IM node.exe

# Or use different port
npm run dev -- -p 3001
```

---

## Development Tasks

### Add a new API endpoint

1. Create `app/api/[name]/route.ts`
2. Import data functions from `lib/`
3. Use `await getAnalysisOptionsAsync()` or `await runAnalysisAsync()`
4. Example:
```typescript
import { NextResponse } from "next/server"
import { getAnalysisOptionsAsync } from "@/lib/server/analysis-runtime"

export async function GET() {
  const options = await getAnalysisOptionsAsync()
  return NextResponse.json(options)
}
```

### Modify analysis logic

Edit `lib/calculations.ts` for tariff calculations or flexibility scoring.

### Add new component

1. Create in `components/[Name].tsx`
2. Import in `app/page.tsx`
3. Use with proper TypeScript types from `lib/types.ts`

### Update data files

1. Place new files in `data/` directory
2. Update file references in `lib/server/analysis-runtime.ts`
3. Update parsing functions in `lib/loadProfiles.ts`, etc.

---

## Performance Tips

**Cold Start (first request):**
- Expect ~2.1 seconds for first API call
- This includes dataset loading (~130ms) + processing
- Subsequent requests will be cached

**Optimization Ideas:**
- Pre-warm cache on server startup
- Implement cache TTL (refresh periodically)
- Add health check endpoint
- Monitor dataset loading times

**Current Metrics:**
- Build time: ~45 seconds
- Server startup: 3.2 seconds
- First API call: 2.1 seconds (includes load)
- Cached API call: 11 milliseconds
- Analysis computation: ~426 milliseconds

---

## Environment Variables

None required by default. Optional for customization:

```bash
# .env.local (create if needed)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NODE_ENV=development
```

---

## Testing with curl

```bash
# Test options endpoint
curl http://localhost:3000/api/analysis-options

# Test analysis endpoint
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"occupancyGroup":"2_occ","dwellingGroup":"apartment","region":"urban","annualKwh":3500,"meterFilter":"All meter types"}'

# Verbose output (see headers, timing, etc.)
curl -v http://localhost:3000/api/analysis-options

# Save response to file
curl http://localhost:3000/api/analysis-options > response.json
```

---

## Key Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Next.js | Web framework | 14.2.25 |
| React | UI library | 18+ |
| TypeScript | Type safety | 5+ |
| Tailwind CSS | Styling | 3+ |
| Node.js | Runtime | 18+ |

---

## Documentation Files

- **BUILD_AND_TEST_SUCCESS.md** - Recent build & test results
- **ASYNC_ARCHITECTURE.md** - Technical architecture details
- **README.md** - Original project documentation
- **DOCUMENTATION_INDEX.md** - Documentation index
- **UI_REDESIGN_COMPLETE.md** - UI redesign notes
- **FILE_LOADING_FIXES.md** - File loading improvements

---

## Support & Debugging

### Enable verbose logging

The application logs to console automatically with prefixes:
- `[analysis-runtime]` - Dataset loading
- `[api/analysis-options]` - Options endpoint
- `[api/analyze]` - Analysis endpoint
- `[files]` - File operations
- `[loadProfiles]` - Profile parsing
- `[tariffs]` - Tariff parsing
- `[marketSignals]` - Market data parsing

Watch the console during requests to see the full flow.

### Check API response format

```bash
# Pretty-print response
curl http://localhost:3000/api/analysis-options | jq .
```

### Monitor performance

```bash
# Time a request
time curl http://localhost:3000/api/analysis-options
```

---

## Next Steps

1. ✅ Application is running
2. ✅ APIs are working
3. ✅ Datasets are loading asynchronously
4. ✅ Results are being cached
5. 🚀 Ready for production or further development

See **BUILD_AND_TEST_SUCCESS.md** for detailed test results.

