import { test, expect } from '@playwright/test';
import path from 'path';

test('End-to-End: Upload PDFs, rearrange, generate package, and download', async ({ page }) => {
  // 1. Navigate to application
  await page.goto('/submittal-binder/');
  await expect(page).toHaveTitle(/Binder — Submittal Package Builder/);

  // Verify dropzone and upload actions are present
  const uploadDropzone = page.locator('#upload-dropzone');
  await expect(uploadDropzone).toBeVisible();

  // 2. Upload test PDFs
  const file1Path = path.resolve('test_pdfs/Dummy PDF.pdf');
  const file2Path = path.resolve('test_pdfs/Sample PDF.pdf');

  const fileInput = page.locator('input[accept=".pdf"]');
  await fileInput.setInputFiles([file1Path, file2Path]);

  // 3. Verify components appear with derived numbers
  const comp1 = page.locator('#component-1, .component-card').first();
  await expect(comp1).toBeVisible();
  await expect(page.locator('.component-card')).toHaveCount(2);

  // Live stats bar should show 2 components and derived total pages
  await expect(page.locator('.stats-ribbon')).toBeVisible();

  // 4. Rearrange / rename component
  const titleDisplay = comp1.locator('.component-title-display');
  await titleDisplay.click();

  const titleInput = comp1.locator('.edit-title-input');
  await titleInput.fill('Equipment Spec Section A');
  await titleInput.press('Enter');

  // Verify renamed title persists
  await expect(comp1.locator('.component-name-text')).toHaveText('Equipment Spec Section A');

  // 5. Generate Submittal PDF
  const buildBtn = page.locator('#btn-generate-submittal');
  await expect(buildBtn).toBeEnabled();
  await buildBtn.click();

  // 6. Assert progress modal and await successful completion
  await expect(page.locator('.build-modal-card')).toBeVisible();
  await expect(page.locator('.modal-header')).toContainText(/Submittal Package Ready!/i, { timeout: 15000 });

  // 7. Verify download
  const downloadBtn = page.locator('#btn-download-pdf');
  await expect(downloadBtn).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await downloadBtn.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('Submittal_Package.pdf');
});
