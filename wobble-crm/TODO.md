# TODO - Production Readiness

## Plan steps
1. Audit build/lint outputs and fix ESLint warnings + build failures (keep UI and routing intact).
2. Audit React Hook dependency warnings and fix them without changing behavior.
3. Remove unused/duplicate imports, unused variables, and any BOM characters.
4. Make Firebase config production-safe for Vercel (use env vars only; remove hardcoded secrets defaults) and ensure Storage rules + client paths work.
5. Tighten Firestore security rules to the existing role-based access model used in app (without breaking reads/writes).
6. Fix any Firestore read/write usage issues found by running the app build + targeted runtime checks.
7. Ensure Vercel config (rewrites/homepage) supports client-side routing in production.
8. Re-run `npm run build` and ensure zero warnings/errors.
9. Produce summary of modified files.
10. Provide git commands to commit/push.

