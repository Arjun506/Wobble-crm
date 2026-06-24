# TODO - Vercel Build Fixes (Wobble CRM)

## Step 1: Gather build blockers
- [x] Read Vercel build log errors (unused imports/unused vars)
- [x] Inspect candidate files: SalesDashboard, SearchCase, ServiceCaseDetail, WarrantyRequest, App.js

## Step 2: Produce edit plan
- [ ] Confirm complete plan for removing only unused imports/vars (no logic changes)

## Step 3: Apply code fixes
- [ ] Update SalesDashboard.js (remove unused FiMail, FiMessageCircle, FiEye; remove unused `user` variable or actually use it)
- [ ] Update SearchCase.js (remove unused FiEye import or use it; remove unused `role` variable if exists)
- [ ] Update ServiceCaseDetail.js (remove unused FiUpload, FiSend, FiX, FiTruck; remove unused `role` variable if exists; ensure no behavior change)
- [ ] Update WarrantyRequest.js (remove unused navigate)

## Step 4: Validate routes & imports
- [ ] Verify all App.js routes point to existing pages
- [ ] Verify Firebase imports usage

## Step 5: Ensure build
- [ ] Run `npm install`
- [ ] Run `npm run build`

## Step 6: Deploy readiness
- [ ] Confirm Vercel build passes (Compiled successfully)

## Step 7: Deliverables
- [ ] Provide: list of changed files, full corrected code for each modified file, build status, and deployment status

