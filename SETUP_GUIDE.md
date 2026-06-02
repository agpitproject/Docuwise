# DocuWise Setup Guide

This guide explains how to run DocuWise locally, configure environment variables, run backend tests, and manually verify the upload-analysis-Q&A flow.

Do not commit real `.env` files or real API keys.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 18 or newer |
| npm | Included with Node.js |
| MongoDB | Local MongoDB or MongoDB Atlas |
| Git | Any recent version |

OpenAI and HuggingFace credentials are optional for local development because fallback paths exist. Model-backed results are better when valid credentials, quota, and network access are available.

## 1. Install Backend Dependencies

```bash
cd backend
npm install
```

## 2. Create `backend/.env`

Copy the example file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in local values. Use placeholders like these, not real values from documentation:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/docuwise
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/docuwise_test
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-your-key
HUGGINGFACE_API_TOKEN=hf-your-token
FRONTEND_URL=http://localhost:5173
SMTP_CONNECTION_TIMEOUT_MS=5000
SMTP_GREETING_TIMEOUT_MS=5000
SMTP_SOCKET_TIMEOUT_MS=10000
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=50
```

## 3. Configure MongoDB

### Local MongoDB

Use a local connection string:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/docuwise
```

Make sure the MongoDB service is running before starting the backend.

### MongoDB Atlas

Use an Atlas connection string with your own user, password, host, and database name:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/docuwise
```

For development, confirm your current IP is allowed in Atlas Network Access.

## 4. Configure `MONGODB_URI_TEST` Separately

Backend tests use `MONGODB_URI_TEST` when it is present:

```env
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/docuwise_test
```

Use a separate database from `MONGODB_URI`. Do not point test runs at production or a shared development database. The tests create temporary users, documents, analyses, and uploaded files, then clean up the targeted records.

## 5. Start the Backend

```bash
cd backend
npm run dev
```

Verify the health endpoint:

```bash
curl https://docuwisebackend.onrender.com/health
```

Expected result:

```json
{
  "status": "ok"
}
```

The exact response may include timestamp and environment fields.

## 6. Install Frontend Dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

## 7. Create `frontend/.env` If Needed

Copy the example file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

For local development, the Vite proxy can route `/api` to `http://localhost:5000`.

For production frontend builds, set `VITE_API_URL` to the deployed backend API base URL:

```env
VITE_API_URL=https://docuwisebackend.onrender.com/api
```

Only set `VITE_GOOGLE_CLIENT_ID` if Google sign-in is configured.

## 8. Start the Frontend

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

## 9. Run Backend Tests

```bash
cd backend
npm test
```

The integration suite verifies:

- health endpoint
- user registration, login, and current-user lookup
- `.txt` upload and extracted text persistence
- analysis start and retrieval
- Q&A answer generation through the fallback-safe path

If tests fail before running assertions, check `MONGODB_URI_TEST`, MongoDB network access, and backend environment variables.

## 10. Test Upload, Analysis, and Q&A Flow

Manual UI checklist:

1. Start backend and frontend.
2. Open `http://localhost:5173`.
3. Register a new account or log in.
4. Open the dashboard or analysis page.
5. Upload a fresh `.txt` document.
6. Run full analysis.
7. Confirm analysis completes.
8. Confirm the summary appears in explanatory format.
9. Ask a question such as `What is this document mainly about?`.
10. Confirm the answer is relevant to the uploaded text.
11. Confirm there is no 401 error from `/api/analysis/activity/stream`.
12. Confirm `/favicon.ico` and `/favicon.svg` return 200.
13. Scan the UI for corrupted text characters.

API checklist:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/documents/upload
POST /api/analysis/run
GET  /api/analysis/:id
POST /api/analysis/:id/qa
GET  /api/analysis/activity/stream
```

For browser `EventSource`, the activity stream can authenticate with a query token because custom headers are not supported by native `EventSource`.

## Production Notes

- Frontend production builds should use `VITE_API_URL`.
- Backend production needs secure environment variables, a real `JWT_SECRET`, correct `FRONTEND_URL`, and a production MongoDB database.
- SSE endpoints may require reverse proxy settings that disable buffering and allow long-lived connections.
- This guide does not complete production deployment for you.

## Known Limitations And Risks

- OCR is not implemented. Scanned PDFs and image-only files need OCR before DocuWise can extract useful text.
- OpenAI and HuggingFace can fail because of quota, invalid credentials, rate limits, or network issues. Fallbacks keep the app usable but are not equivalent to model-backed analysis.
- `MONGODB_URI_TEST` should always use a separate database.
- Browser visual tests are manual, not automated.
- Collaboration features should be manually verified for the specific workflow before production use.
- Uploaded files are stored locally unless you configure another storage strategy.

## Troubleshooting

### Backend cannot connect to MongoDB

- Confirm MongoDB is running locally or Atlas is reachable.
- Confirm the database name in `MONGODB_URI`.
- For Atlas, confirm IP allowlist and database user credentials.

### Frontend cannot reach backend

- Confirm backend is running on port 5000.
- Confirm frontend is running on port 5173.
- In production, confirm `VITE_API_URL` points to the backend API base URL.
- Confirm backend `FRONTEND_URL` matches the frontend origin.

### Upload fails

- Use `.txt`, `.pdf`, or `.docx`.
- Confirm file size is below `MAX_FILE_SIZE_MB`.
- Confirm `UPLOAD_DIR` is writable.
- For PDFs, confirm the file has selectable text.

### Analysis or Q&A quality is low

- Confirm OpenAI and HuggingFace credentials are valid.
- Confirm API quota and network access.
- Check backend logs for fallback messages.

### SSE does not connect

- Confirm the user is logged in.
- Confirm the request includes auth. Native browser `EventSource` uses the query token path.
- Check proxy buffering and timeout settings in production.
