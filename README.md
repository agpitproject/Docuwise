# DocuWise

DocuWise is a full-stack document intelligence app. It lets users upload `.txt`, `.pdf`, or `.docx` files, extract text, run AI-assisted analysis, read an explanatory summary, and ask questions about the document from a React dashboard.

The current local build has a working backend, working frontend, upload and analysis flow, explanatory summary fallback, improved Q&A fallback, EventSource-compatible SSE authentication, favicon assets, cleaned UI text, environment examples, and backend integration tests.

## Core Features

- Account registration and login with JWT authentication.
- Document upload for `.txt`, `.pdf`, and `.docx` files.
- Text extraction and document metadata storage.
- Analysis modes for summary, sentiment, categorization, entities, keywords, readability, translation, and full analysis.
- NotebookLM-style explanatory summary fallback when external AI calls are unavailable.
- Document Q&A with a grounded fallback answer path.
- Dashboard activity feed with SSE updates.
- Query-token SSE support for browser `EventSource`.
- Document comparison and batch analysis surfaces.
- Collaboration UI and API surfaces for comments, events, and collaborators.
- Production frontend API targeting with `VITE_API_URL`.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, TailwindCSS |
| State | Zustand |
| HTTP | Axios |
| Routing | React Router |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| Uploads | Multer |
| File parsing | pdf-parse, mammoth, native text parsing |
| AI services | OpenAI SDK, HuggingFace Inference API |
| Tests | Jest, Supertest |

## Folder Structure

```text
Docuwise-main/
|-- backend/
|   |-- __tests__/              Backend integration tests
|   |-- src/
|   |   |-- config/             MongoDB connection
|   |   |-- controllers/        Route handlers
|   |   |-- middleware/         Auth, upload, rate limit, errors
|   |   |-- models/             Mongoose schemas
|   |   |-- routes/             Express routes
|   |   |-- services/           AI, file, and orchestration services
|   |   `-- utils/              Response and async helpers
|   |-- .env.example            Backend environment template
|   |-- package.json
|   `-- server.js
|-- frontend/
|   |-- public/                 Favicon assets
|   |-- src/
|   |   |-- components/         UI and feature components
|   |   |-- pages/              App pages
|   |   |-- services/           API client modules
|   |   |-- store/              Zustand stores
|   |   `-- utils/              Formatters and validators
|   |-- .env.example            Frontend environment template
|   |-- package.json
|   `-- vite.config.js
|-- docs/                       API collection
|-- FILE_STRUCTURE.md
|-- README.md
`-- SETUP_GUIDE.md
```

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` with your local values:

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
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=50
```

Start the backend:

```bash
npm run dev
```

Verify:

```bash
<<<<<<< HEAD
curl https://docuwisebackend.onrender.com/health
=======
curl http://localhost:5000/health
>>>>>>> 40ca2adf759077ac7759244ca7858e32f97310c1
```

Expected response includes `"status":"ok"`.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

For local development, the Vite proxy can route `/api` to the backend. For deployed frontend builds, set:

```env
VITE_API_URL=https://your-backend-domain.example.com/api
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

### Backend

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | No | Defaults to the backend port used locally. |
| `NODE_ENV` | No | Use `development`, `test`, or `production`. |
| `MONGODB_URI` | Yes | Main MongoDB connection string. |
| `MONGODB_URI_TEST` | Yes for tests | Use a separate database from `MONGODB_URI`. |
| `JWT_SECRET` | Yes | Use a long random value. Do not commit it. |
| `JWT_EXPIRES_IN` | No | Token lifetime, for example `7d`. |
| `OPENAI_API_KEY` | Optional | Enables higher-quality AI output when quota/network allow it. |
| `HUGGINGFACE_API_TOKEN` | Optional | Enables HuggingFace-backed categorization/entity support. |
| `FRONTEND_URL` | Yes | Used for CORS, for example `http://localhost:5173`. |
| `UPLOAD_DIR` | No | Local upload directory. |
| `MAX_FILE_SIZE_MB` | No | Upload limit. |

### Frontend

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_URL` | Required for production | Backend API base URL. In local dev, the Vite proxy can handle `/api`. |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Only needed if Google sign-in is configured. |

Do not put real secrets in documentation, commits, screenshots, or issue reports.

## Tests

Backend integration tests:

```bash
cd backend
npm test
```

The backend tests cover:

- `/health`
- auth registration/login/current-user flow
- `.txt` upload and extracted text storage
- analysis start and retrieval
- document Q&A fallback behavior

`MONGODB_URI_TEST` should point to a dedicated test database such as `docuwise_test`. Avoid pointing it at the same database used by local development or production.

Frontend production build:

```bash
cd frontend
npm run build
```

## Manual Test Checklist

1. Start MongoDB or confirm Atlas access.
2. Start the backend with `npm run dev`.
3. Confirm `GET https://docuwisebackend.onrender.com/health` returns `ok`.
4. Start the frontend with `npm run dev`.
5. Open `http://localhost:5173`.
6. Register a new user or log in.
7. Open the dashboard or analysis page.
8. Upload a fresh `.txt` document.
9. Run full analysis.
10. Confirm the summary appears in explanatory format.
11. Ask a document question and confirm the answer is useful.
12. Confirm the activity stream does not show a 401 SSE error.
13. Confirm `/favicon.ico` and `/favicon.svg` return 200.
14. Scan the UI for corrupted text or mojibake.

## Known Limitations

- Scanned PDFs and image-only documents need OCR before DocuWise can extract useful text. OCR is not currently provided by this app.
- PDF extraction depends on embedded/selectable text. Some PDFs may upload successfully but produce little or no extracted text.
- OpenAI and HuggingFace calls can fail because of quota, credentials, rate limits, or network issues. The app includes fallbacks, but fallback output is less capable than model-backed output.
- `MONGODB_URI_TEST` must be configured carefully. Use a separate test database to avoid mixing test data with development or production data.
- Browser visual testing is manual. The current backend tests do not automate full browser UI verification.
- Collaboration features have UI and API surfaces, but they should be manually verified before being treated as production-ready.
- Production deployment requires hosting, secure environment variables, CORS configuration, persistent file/storage decisions, and reverse proxy settings for SSE.

## API Collection

The `docs/` folder includes a Postman collection for API testing:

```text
docs/docuwise.postman_collection.json
```

## License

This project is proprietary. All rights reserved.
