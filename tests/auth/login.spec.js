import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';

const login = process.env.LOGIN;
const password = process.env.PASSWORD;

test.describe('Авторизация пользователя на b2b', () => {

  test('Авторизация пользователя на b2b', async ({ page }) => {
    test.skip(!login || !password, 'LOGIN и PASSWORD не заданы в .env');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(login, password);

    await expect(page).not.toHaveURL(/login/i);
  });

});
