export class LoginPage {
  constructor(page) {
    this.page = page;
    this.openLoginButton = page.locator('a.login-action');
    this.usernameInput = page.locator('#login');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('#loginForm .button');
  }

  async goto() {
    await this.page.goto('https://b2b.fstravel.com/', { waitUntil: 'load', timeout: 30000 });
  }

  async login(login, password) {
    await this.openLoginButton.click();
    await this.usernameInput.fill(login);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
