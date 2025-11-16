I need you to perform a comprehensive production-readiness audit of my Next.js project located in this workspace. Conduct a systematic review across all critical dimensions of a production-grade application.

**Scope of Review:**

1. **Performance Optimization**
   - Analyze bundle size and identify opportunities for code splitting
   - Detect unnecessary re-renders and missing React memoization (useMemo, useCallback, React.memo)
   - Verify proper use of dynamic imports and lazy loading
   - Review Next.js Image component usage and image optimization strategy
   - Evaluate caching strategy (ISR, SSG, SSR, client-side caching)
   - Assess server vs client component distribution and boundaries
   - Analyze API call patterns for efficiency (deduplication, batching, parallel fetching)
   - Identify potential Lighthouse performance issues

2. **Security**
   - Audit environment variable handling (proper use of NEXT_PUBLIC_ prefix, no secrets in client code)
   - Review Server Actions and API route protection (authentication, authorization)
   - Check for input validation and sanitization
   - Evaluate authentication and session management implementation
   - Recommend security headers configuration (CSP, HSTS, X-Frame-Options, etc.)
   - Review cookie and token storage practices
   - Identify potential data leakage across server/client boundaries
   - Check for exposed sensitive data in client-side code or network responses

3. **Scalability & Architecture**
   - Evaluate project folder structure and organization
   - Assess component reusability and composition patterns
   - Review separation of concerns (business logic, UI, data fetching)
   - Analyze Server Actions vs API Routes usage patterns
   - Evaluate state management approach (Context, Zustand, Redux, etc.)
   - Assess suitability for serverless/edge deployment environments
   - Check for potential bottlenecks or architectural limitations

4. **SEO & Accessibility**
   - Review metadata configuration (generateMetadata, opengraph, twitter cards)
   - Check semantic HTML usage throughout components
   - Verify image alt text coverage
   - Identify accessibility issues (ARIA labels, keyboard navigation, color contrast, focus management)
   - Evaluate Core Web Vitals optimization (LCP, FID, CLS)
   - Check robots.txt and sitemap configuration

5. **Maintainability & Code Quality**
   - Identify code smells and anti-patterns
   - Review naming conventions consistency
   - Evaluate folder and file structure organization
   - Assess TypeScript usage quality (proper typing, avoiding 'any', type safety)
   - Check ESLint and Prettier configuration and adherence
   - Review code duplication and opportunities for abstraction
   - Evaluate error handling patterns

6. **Production Readiness**
   - Review next.config.js/ts build configuration
   - Check environment-specific configuration management
   - Evaluate logging strategy and implementation
   - Review error handling, error boundaries, and monitoring setup
   - Assess deployment platform compatibility (Vercel, AWS, Docker, etc.)
   - Check for development-only code or console.logs in production builds
   - Review dependency versions and security vulnerabilities

**Deliverable:**

Provide a detailed report with:
- Findings organized by category with severity levels (Critical, High, Medium, Low)
- Specific file paths and code references for each issue
- Clear explanations of why each issue matters
- Actionable recommendations with code examples where applicable
- A prioritized checklist of issues to address before production launch
- Quick wins vs long-term improvements clearly distinguished

Begin the audit now by examining the codebase structure, configuration files, and key application files. Use codebase-retrieval to gather comprehensive information about the project before providing your analysis.