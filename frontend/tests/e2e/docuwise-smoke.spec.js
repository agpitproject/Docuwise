import { test, expect } from '@playwright/test';
import path from 'node:path';

test('main document analysis browser workflow', async ({ page, request }) => {
  const seriousNetworkErrors = [];
  const pageErrors = [];
  let authToken = '';

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || '';
    if (req.url().includes('/api/') || /cors/i.test(failure)) {
      seriousNetworkErrors.push(`${req.method()} ${req.url()} failed: ${failure}`);
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/') && [401, 403, 404, 500].includes(status)) {
      seriousNetworkErrors.push(`${status} ${url}`);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Understand any document, instantly' })).toBeVisible();

  await page.getByRole('button', { name: 'Start for free' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  const email = `playwright-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'Password123!';

  await page.getByPlaceholder('Alex').fill('Playwright');
  await page.getByPlaceholder('Johnson').fill('Smoke');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('********').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Dashboard')).toBeVisible();

  authToken = await page.evaluate(() => {
    const stored = localStorage.getItem('docuwise_auth');
    if (!stored) return '';
    const parsed = JSON.parse(stored);
    return parsed?.state?.token || parsed?.token || '';
  });
  expect(authToken).toBeTruthy();

  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page).toHaveURL(/\/analyse$/);
  await expect(page.getByRole('heading', { name: 'Analyse a document' })).toBeVisible();

  await page
    .getByLabel('Upload document')
    .setInputFiles(path.join(process.cwd(), 'package.json'));
  await expect(
    page.getByRole('alert').getByText('Unsupported file type. Please upload a TXT, PDF, or DOCX file.')
  ).toBeVisible();

  await page
    .getByLabel('Upload document')
    .setInputFiles(path.join(process.cwd(), 'tests', 'fixtures', 'docuwise-smoke.txt'));

  await expect(page.getByText('docuwise-smoke.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyse document' }).click();

  await expect(page.getByText('Analysis complete', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Document analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Document Explanation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask AI' })).toBeVisible();

  const previewButton = page.getByRole('button', { name: 'View Uploaded File' });
  await expect(previewButton).toBeVisible();
  await previewButton.click();
  const reviewPreviewDialog = page.getByRole('dialog');
  await expect(reviewPreviewDialog.getByRole('heading', { name: 'docuwise-smoke.txt' })).toBeVisible();
  await expect(reviewPreviewDialog.getByText('smoke test document.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close modal' }).click();
  await expect(reviewPreviewDialog).toBeHidden();

  const guideResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/analysis/') && response.url().includes('/ai-guide') && response.status() === 200
  );
  await page.getByRole('button', { name: 'Ask AI' }).click();
  await expect(page).toHaveURL(/\/analyse\/[^/]+\/ask$/);
  await expect(page.getByRole('heading', { name: 'Document Q&A workspace' })).toBeVisible();
  const guideResponse = await guideResponsePromise;
  const guidePayload = await guideResponse.json();
  const guideData = guidePayload?.data || {};
  expect(Array.isArray(guideData.suggestedQuestions)).toBe(true);
  await expect(page.getByText(guideData.suggestedQuestions[0] || 'What is this document mainly about?', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Study Guide' })).toBeVisible();
  if (guideData.keyTakeaways?.length > 0) {
    await expect(page.getByRole('heading', { name: 'Key Takeaways' })).toBeVisible();
  }
  if (guideData.glossary?.length > 0) {
    await expect(page.getByRole('heading', { name: 'Glossary' })).toBeVisible();
  }
  await expect(page.getByPlaceholder('Ask anything about this document...')).toBeVisible();

  const askPreviewButton = page.getByRole('button', { name: 'View Uploaded File' });
  await expect(askPreviewButton).toBeVisible();
  await askPreviewButton.click();
  const askPreviewDialog = page.getByRole('dialog');
  await expect(askPreviewDialog.getByRole('heading', { name: 'docuwise-smoke.txt' })).toBeVisible();
  await expect(askPreviewDialog.getByText('smoke test document.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close modal' }).click();
  await expect(askPreviewDialog).toBeHidden();

  await page.getByText('What is this document mainly about?', { exact: true }).click();
  await expect(page.getByPlaceholder('Ask anything about this document...')).toHaveValue('What is this document mainly about?');
  const qaResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/analysis/') && response.url().includes('/qa') && response.status() === 200
  );
  await page.getByRole('button', { name: 'Send question' }).click();
  const qaResponse = await qaResponsePromise;
  const qaPayload = await qaResponse.json();
  expect(String(qaPayload?.data?.answer || '').trim().length).toBeGreaterThan(0);
  expect(Array.isArray(qaPayload?.data?.sources)).toBe(true);
  expect(Array.isArray(qaPayload?.data?.followUpQuestions)).toBe(true);
  expect(['high', 'medium', 'low']).toContain(qaPayload?.data?.confidence);
  expect(['gemini', 'openai', 'fallback']).toContain(qaPayload?.data?.provider);
  const qaSection = page.getByRole('region', { name: 'Document Q&A' });
  await expect(qaSection.getByText('What is this document mainly about?')).toBeVisible();
  await expect(qaSection.getByText(qaPayload.data.answer.slice(0, 40), { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await expect(qaSection.getByText(`${qaPayload.data.confidence} confidence`, { exact: false })).toBeVisible();
  await expect(qaSection.getByText(new RegExp(qaPayload.data.provider, 'i')).first()).toBeVisible();
  await expect(qaSection.getByRole('button', { name: 'Copy answer' }).first()).toBeVisible();
  if (qaPayload.data.sources.length > 0) {
    await expect(qaSection.getByText('Evidence used')).toBeVisible();
    await expect(qaSection.getByText('Source snippet 1')).toBeVisible();
  }
  if (qaPayload.data.followUpQuestions.length > 0) {
    await expect(qaSection.getByText('Follow-up questions')).toBeVisible();
  }

  await page.getByRole('button', { name: 'Back to Review' }).click();
  await expect(page).toHaveURL(/\/analyse\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Document analysis' })).toBeVisible();

  await cleanupSmokeData(request, authToken);

  expect(pageErrors).toEqual([]);
  expect(seriousNetworkErrors).toEqual([]);
});

async function cleanupSmokeData(request, token) {
  if (!token) return;

  const docs = await request.get('https://docuwisebackend.onrender.com/api/documents', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!docs.ok()) return;

  const body = await docs.json();
  const documents = body?.data?.documents || [];
  const smokeDocs = documents.filter((document) => document.originalName === 'docuwise-smoke.txt');

  await Promise.all(
    smokeDocs.map((document) =>
      request.delete(`https://docuwisebackend.onrender.com/api/documents/${document._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
  );
}
