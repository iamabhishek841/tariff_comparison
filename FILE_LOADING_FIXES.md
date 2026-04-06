# File Loading Logic Fixes - Summary

## Overview
Fixed the file loading logic in the Next.js app to use relative paths from the project root instead of hardcoded absolute Windows paths. This makes the application cross-platform compatible and more maintainable.

## Changes Made

### 1. Created `lib/files.ts` - New File Path Helper Module
**Purpose:** Centralized file path resolution with consistent error handling

**Key Functions:**
- `getProjectFilePath(filename)` - Resolves file paths relative to `process.cwd()` with existence checks
- `tryGetProjectFilePath(filename)` - Safe version that returns null instead of throwing

**Features:**
- Uses `path.join()` and `process.cwd()` for cross-platform compatibility (Windows, macOS, Linux)
- Validates file existence with `fs.existsSync()` before returning paths
- Throws clear, user-friendly error messages mentioning only the filename, not full paths
- Properly handles Node.js runtime (uses `node:fs` and `node:path`)

```typescript
// Example usage
const filePath = getProjectFilePath("task2_load_profiles.xlsx");
// Returns: /absolute/path/to/project/task2_load_profiles.xlsx (or E:\... on Windows)
```

### 2. Updated `lib/server/analysis-runtime.ts` - Lazy Path Initialization
**Changes:**
- Removed hardcoded absolute path resolution that ran at module load time
- Replaced with lazy initialization via `ensurePathsInitialized()`
- Imported and now uses `getProjectFilePath()` from the new `lib/files.ts`

**Benefits:**
- Defers file path resolution until first API call (not at server startup)
- Allows proper error handling without crashing the app at boot time
- Caches initialization errors to avoid repeated failed lookups

**Code Flow:**
```typescript
// File paths are resolved on-demand when ensureDataset() is called
function ensurePathsInitialized(): void {
  // Only runs once, then caches the paths
  if (LOAD_PROFILE_PATH && TARIFF_PATH && MARKET_PATH) return
  if (initializationError) throw initializationError
  
  try {
    LOAD_PROFILE_PATH = getProjectFilePath("task2_load_profiles.xlsx")
    TARIFF_PATH = getProjectFilePath("Tarrifs_validated.csv")
    MARKET_PATH = getProjectFilePath("full_year_halfhour_profile.csv")
  } catch (error) {
    // Store error and rethrow for proper handling
    initializationError = error
    throw error
  }
}
```

### 3. Updated Error Messages in Parsing Functions
Made error messages user-friendly by removing full file paths:

- **`lib/loadProfiles.ts`**: `parseLoadProfiles()` 
  - Old: `Missing load profile file: E:\tariff_compare\task2_load_profiles.xlsx`
  - New: `Required data file not found: task2_load_profiles.xlsx`

- **`lib/tariffs.ts`**: `parseTariffPlans()`
  - Old: `Missing tariff file: E:\tariff_compare\Tarrifs_validated.csv`
  - New: `Required data file not found: Tarrifs_validated.csv`

- **`lib/marketSignals.ts`**: `parseMarketHalfHourRows()`
  - Old: `Missing market signal file: E:\tariff_compare\full_year_halfhour_profile.csv`
  - New: `Required data file not found: full_year_halfhour_profile.csv`

## Files Modified

1. ✅ `lib/files.ts` - **NEW FILE** - Reusable helper module
2. ✅ `lib/server/analysis-runtime.ts` - Lazy initialization + new helper
3. ✅ `lib/loadProfiles.ts` - Updated error message
4. ✅ `lib/tariffs.ts` - Updated error message
5. ✅ `lib/marketSignals.ts` - Updated error message

## Files Referenced (Error Handling Already in Place)

- ✅ `app/page.tsx` - Already has error display UI (`.error-box`)
- ✅ `app/api/analyze/route.ts` - Already has try-catch error handling
- ✅ `app/api/analysis-options/route.ts` - Already has try-catch error handling

## How It Works

### Initialization Flow
```
1. User loads app → page.tsx makes fetch to /api/analysis-options
2. API route calls getAnalysisOptions()
3. getAnalysisOptions() calls ensureDataset()
4. ensureDataset() calls ensurePathsInitialized()
5. ensurePathsInitialized() calls getProjectFilePath() for each file
6. getProjectFilePath() uses path.join(process.cwd(), filename)
7. If file exists: returns absolute path
8. If file missing: throws error with friendly message
9. Error bubbles to API route → caught → returned as JSON
10. Frontend displays error in UI
```

### Path Resolution on Different Platforms
- **Windows**: `E:\tariff_compare\task2_load_profiles.xlsx`
- **macOS/Linux**: `/home/user/project/tariff_compare/task2_load_profiles.xlsx`
- **Both**: Generated automatically by `path.join()` and `process.cwd()`

## Testing


✅ **Build Test**: `npm run build` completed successfully with no TypeScript errors

## Files Required in Project Root

Ensure these files exist in the project root directory:
```
E:\tariff_compare\
├── task2_load_profiles.xlsx
├── Tarrifs_validated.csv
├── full_year_halfhour_profile.csv
└── ... (other project files)
```

## Benefits

1. ✅ **Cross-Platform**: Works on Windows, macOS, and Linux
2. ✅ **No Hardcoded Paths**: All paths are dynamic and relative
3. ✅ **Clear Error Messages**: Users see only the filename, not full paths
4. ✅ **Better Error Handling**: Errors don't crash at server startup
5. ✅ **Reusable**: New `lib/files.ts` helper can be used anywhere in the app
6. ✅ **Lazy Loading**: Files are only resolved when needed (first API call)
7. ✅ **Proper Exports**: All file paths are server-side (Node.js runtime)

## Additional Notes

- The `analysis-runtime.ts` file still caches the parsed data (occupancy groups, dwelling groups, tariffs, market data) for performance
- Error messages are displayed in the UI at `.error-box` (already implemented)
- The app remains fully dynamic and server-side, no changes to client-side behavior

