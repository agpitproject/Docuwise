# DocuWise Frontend Smoke Test Checklist

Use this checklist for a manual browser smoke pass after backend and frontend changes.

## 1. Start Services

- Start the backend:
  - `cd backend`
  - `npm run dev`
- Verify backend health:
  - Open `https://docuwisebackend.onrender.com/health`
  - Confirm the response reports `status: ok`
- Start the frontend:
  - `cd frontend`
  - `npm run dev`
- Open the app:
  - `http://localhost:5173`

## 2. Auth Flow

- Open the login/register UI.
- Register a fresh test user or log in with an existing test user.
- Confirm the dashboard/protected area opens after authentication.
- Open browser DevTools Network tab.
- Confirm authenticated API requests use bearer auth and do not show unexpected `401` responses.

## 3. Upload Flow

- Upload a TXT file with selectable text.
- Upload a text-based PDF with selectable text.
- Upload a DOCX file with normal document text.
- Confirm each successful upload appears in the dashboard or analysis workflow.
- Try an invalid file type, such as CSV.
- Confirm the app shows a clean rejection and does not proceed as a valid upload.
- Try an empty or no-text file.
- Confirm the app shows a clear no selectable text/OCR-not-supported style message.

## 4. Analysis Flow

- Select a valid uploaded document.
- Run analysis.
- Confirm the analysis completes without a page crash.
- Confirm Network has no unexpected `401`, `500`, or CORS errors.
- Confirm the analysis result area renders after completion.

## 5. Summary Result UI

- Confirm the summary is the main focus after analysis.
- Verify these explanation-style sections render when present:
  - Document Explanation
  - Main Idea
  - Key Takeaways
  - Why This Matters
  - Simple Explanation
  - Important Concepts
- Confirm fallback plain-text summaries remain readable if section headings are not present.

## 6. Uploaded File Preview

- Confirm the uploaded document preview is hidden by default after analysis.
- Confirm the `View Uploaded File` or `View Document Preview` button is visible.
- Click the preview button.
- Confirm a modal, drawer, or panel opens.
- Confirm it shows the document name.
- Confirm it shows file type when available.
- Confirm extracted text appears when available.
- Confirm long text uses a scrollable area.
- Close the preview.
- Confirm the page returns to the analysis result without losing state.

## 7. Q&A

- Ask a question about the analyzed document.
- Confirm the answer is non-empty and relevant to the uploaded text.
- Confirm Q&A history or displayed answer remains visible.
- Confirm Network has no unexpected `401`, `500`, or CORS errors during Q&A.

## 8. SSE and Favicon

- Keep DevTools Network tab open during analysis.
- Confirm the activity stream does not show a `401` EventSource/SSE error.
- Confirm the favicon request succeeds and there is no favicon `404`.

## 9. Visual Checks

- Confirm no corrupted UI text is visible.
- Confirm summary cards and buttons do not overlap at desktop width.
- Resize browser to a mobile width around 390px.
- Confirm upload controls, summary cards, preview modal, and Q&A remain usable.
- Confirm no important text is clipped or overlapping on mobile width.

## 10. Final Smoke Result

- Auth works: yes/no
- TXT upload works: yes/no
- PDF upload works: yes/no
- DOCX upload works: yes/no
- Invalid upload rejected cleanly: yes/no
- Empty/no-text upload rejected cleanly: yes/no
- Analysis completes: yes/no
- Summary cards render: yes/no
- Uploaded file preview modal works: yes/no
- Q&A works: yes/no
- No unexpected Network `401`, `500`, or CORS errors: yes/no
- Favicon loads: yes/no
- Mobile width usable: yes/no
