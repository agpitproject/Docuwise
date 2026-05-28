# DocuWise E2E Smoke Tests

Run these tests against manually started local servers.

1. Start the backend from `backend`:
   `npm start`
2. Start the frontend from `frontend`:
   `npm run dev`
3. Run the browser smoke test from `frontend`:
   `npm run test:e2e`

The Playwright config uses `http://localhost:5173` as the frontend base URL and does not auto-start servers.
