const { test, expect } = require('@playwright/test');

const future = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10); };

async function reset(request) { await request.post('/api/test/reset'); }

 test.describe('QueueCare UI', () => {
  test.beforeEach(async ({ request }) => reset(request));

  test('valid login opens the patient dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).first().fill('staff@queuecare.test');
    await page.getByLabel('Password', { exact: true }).first().fill('Staff123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Welcome, QueueCare Staff')).toBeVisible();
  });

  test('invalid login displays an error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).first().fill('staff@queuecare.test');
    await page.getByLabel('Password', { exact: true }).first().fill('wrong');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('#loginMsg')).toContainText('Invalid email or password');
  });

  test('empty login is blocked by browser validation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('#loginEmail')).toHaveAttribute('required', '');
  });

  test('patient can register, create an appointment and see the booking', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name').fill('Alice Patient');
    await page.getByLabel('Email').nth(1).fill('alice-ui@test.local');
    await page.getByLabel('Password').nth(1).fill('Pass123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Welcome, Alice Patient')).toBeVisible();
    await page.getByLabel('Date').fill(future(1));
    await page.getByLabel('Doctor').fill('Dr. Uwase');
    await page.getByLabel('Reason').fill('Routine checkup');
    await page.getByRole('button', { name: 'Save appointment' }).click();
    await expect(page.locator('#appointments')).toContainText('Routine checkup');
    await expect(page.locator('#appointments')).toContainText('Queue #1');
  });

  test('form validation prevents incomplete appointments', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).first().fill('staff@queuecare.test');
    await page.getByLabel('Password', { exact: true }).first().fill('Staff123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Welcome, QueueCare Staff')).toBeVisible();
    await page.getByRole('button', { name: 'Save appointment' }).click();
    await expect(page.locator('#date')).toHaveAttribute('required', '');
  });

  test('patient can update then cancel an appointment', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Name').fill('Bob Patient');
    await page.getByLabel('Email').nth(1).fill('bob-ui@test.local');
    await page.getByLabel('Password').nth(1).fill('Pass123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByLabel('Date').fill(future(2));
    await page.getByLabel('Doctor').fill('Dr. Uwase');
    await page.getByLabel('Reason').fill('Original reason');
    await page.getByRole('button', { name: 'Save appointment' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Reason').fill('Updated reason');
    await page.getByRole('button', { name: 'Save appointment' }).click();
    await expect(page.locator('#appointments')).toContainText('Updated reason');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#appointments')).toContainText('cancelled');
  });
});
