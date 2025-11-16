


## 4. Performance & Rendering Check ⚠️

### 4.1 Server vs Client Components
**Status:** ⚠️ **OPTIMIZATION OPPORTUNITIES**

**Current State:**
- 61 client components identified
- Some components could potentially be server components

**Recommendations:**
- Consider converting data-fetching components to server components where possible
- Use server components for initial data load, client components for interactivity



### 4.5 Bundle Size
**Status:** ⚠️ **REVIEW NEEDED**

- Framer Motion included in all pages
- No bundle analysis performed
- Consider using `@next/bundle-analyzer` to identify optimization opportunities

---

## 7. Issues Summary

### 🔴 Critical Issues (0)
None found.

### 🟠 High Priority Issues (3)


#### Issue #5: Framer Motion Not Code-Split
**Impact:** Larger bundle size, slower initial load.

**Fix:** Use dynamic imports for Framer Motion (see section 4.2).



#### Issue #8: Console.log Statements in Production
**Files:** Multiple files contain console.log statements.

**Impact:** Performance overhead, potential information leakage.

**Fix:** Replace with proper logging library or remove in production.

#### Issue #9: Some `any` Types
**Impact:** Reduced type safety.

**Fix:** Gradually replace `any` types with proper TypeScript types.

---

## 8. Fix Instructions

### Fix #1: Remove Blocking Call from Layout

**File:** `app/layout.tsx`

**Change:**
```typescript
// BEFORE
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await testSupabaseConnection() // ❌ Remove this
  return (
    // ...
  )
}

// AFTER
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Connection test moved to health check endpoint
  return (
    // ...
  )
}
```

**Create:** `app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { testSupabaseConnection } from '@/lib/testSupabaseConnection';

export async function GET() {
  try {
    await testSupabaseConnection();
    return NextResponse.json({ status: 'healthy', database: 'connected' });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database connection failed' },
      { status: 503 }
    );
  }
}
```

### Fix #2: Add Authentication to API Routes

**File:** `app/api/stories/route.ts`

**Add at the beginning of GET handler:**
```typescript
import { requireServerAuth } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  try {
    // Add authentication check
    const { user } = await requireServerAuth();
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }
    // ... rest of code
  }
}
```

**Repeat for:**
- `app/api/announcements/route.ts`
- `app/api/menus/route.ts`

### Fix #3: Create ESLint Configuration

**Create:** `.eslintrc.json`
```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { "allow": ["error", "warn"] }]
  }
}
```

### Fix #4: Add Caching to API Routes

**Status:** ✅ **COMPLETED**

**Implementation:**
- Created `lib/cacheConfig.ts` with standardized cache header functions
- Added cache headers to all API route GET handlers:
  - Stable data routes: `getStableDataCacheHeaders()` (5 min cache)
  - User-specific routes: `getUserDataCacheHeaders()` (1 min cache)
  - Real-time routes: `getRealtimeDataCacheHeaders()` (30 sec cache)
  - Sensitive routes: `getNoCacheHeaders()` (no cache)

**Example implementation:**
```typescript
import { getStableDataCacheHeaders } from '@/lib/cacheConfig';

return NextResponse.json(
  { stories: data || [] },
  {
    headers: getStableDataCacheHeaders()
  }
);
```

**Files Updated:**
- All API route files listed in section 4.4

### Fix #5: Code-Split Framer Motion

**Example usage:**
```typescript
import dynamic from 'next/dynamic';

const motion = dynamic(
  () => import('framer-motion').then((mod) => ({ default: mod.motion })),
  { ssr: false }
);
```

---
