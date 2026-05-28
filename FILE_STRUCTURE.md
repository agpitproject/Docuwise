# DocuWise File Structure

This is a high-level map of the project. See `README.md` and `SETUP_GUIDE.md` for setup, test, and verification steps.

```text
Docuwise-main/
|-- README.md
|-- SETUP_GUIDE.md
|-- FILE_STRUCTURE.md
|-- docs/
|   `-- docuwise.postman_collection.json
|-- backend/
|   |-- __tests__/
|   |   `-- core.integration.test.js
|   |-- src/
|   |   |-- config/
|   |   |   `-- db.js
|   |   |-- controllers/
|   |   |   |-- analysisController.js
|   |   |   |-- authController.js
|   |   |   |-- collabController.js
|   |   |   |-- commentController.js
|   |   |   |-- comparisonController.js
|   |   |   `-- documentController.js
|   |   |-- middleware/
|   |   |   |-- auth.js
|   |   |   |-- errorHandler.js
|   |   |   |-- rateLimit.js
|   |   |   `-- upload.js
|   |   |-- models/
|   |   |   |-- Analysis.js
|   |   |   |-- CollabEvent.js
|   |   |   |-- Comment.js
|   |   |   |-- Comparison.js
|   |   |   |-- Document.js
|   |   |   `-- User.js
|   |   |-- routes/
|   |   |   |-- analysis.js
|   |   |   |-- auth.js
|   |   |   |-- collab.js
|   |   |   |-- comments.js
|   |   |   |-- comparison.js
|   |   |   |-- documents.js
|   |   |   `-- index.js
|   |   |-- services/
|   |   |   |-- analysisOrchestrator.js
|   |   |   |-- fileService.js
|   |   |   |-- huggingfaceService.js
|   |   |   |-- mailService.js
|   |   |   `-- openaiService.js
|   |   `-- utils/
|   |       |-- apiResponse.js
|   |       `-- asyncHandler.js
|   |-- .env.example
|   |-- package.json
|   `-- server.js
`-- frontend/
    |-- public/
    |   |-- favicon.ico
    |   `-- favicon.svg
    |-- src/
    |   |-- components/
    |   |   |-- Analysis/
    |   |   |-- Auth/
    |   |   |-- Batch/
    |   |   |-- Collaboration/
    |   |   |-- Comparison/
    |   |   |-- Dashboard/
    |   |   |-- Layout/
    |   |   `-- UI/
    |   |-- pages/
    |   |-- services/
    |   |-- store/
    |   |-- styles/
    |   `-- utils/
    |-- .env.example
    |-- index.html
    |-- package.json
    `-- vite.config.js
```

## Notes

- Backend tests live in `backend/__tests__/core.integration.test.js`.
- Backend tests use `MONGODB_URI_TEST` when configured. It should point to a separate test database.
- Frontend production API targeting is controlled with `VITE_API_URL`.
- Favicon assets are served from `frontend/public/`.
- The `docs/` folder currently contains the API collection only.
