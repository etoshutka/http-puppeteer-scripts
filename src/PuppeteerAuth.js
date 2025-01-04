import puppeteer from 'puppeteer';
import sharp from 'sharp';

export default class PuppeteerAuthBot {
    constructor(baseURL, rucaptchaKey) {
        this.baseURL = baseURL;
        this.rucaptchaKey = rucaptchaKey;
    }

    async solveCaptcha(page) {
        const captchaElement = await page.$('.captcha-image');
        const pngBuffer = await captchaElement.screenshot({
            type: 'png',
            encoding: 'binary'
        });

        const optimizedPng = await sharp(pngBuffer)
            .resize(200, 50, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toBuffer();

        const base64Data = optimizedPng.toString('base64');

        const createTaskResponse = await fetch('https://api.rucaptcha.com/createTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientKey: this.rucaptchaKey,
                task: {
                    type: "ImageToTextTask",
                    body: base64Data,
                    phrase: false,
                    case: true,
                    numeric: 4,
                    math: false,
                    minLength: 5,
                    maxLength: 6
                },
                languagePool: "rn"
            })
        });

        const { taskId } = await createTaskResponse.json();

        while (true) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            const getResultResponse = await fetch('https://api.rucaptcha.com/getTaskResult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientKey: this.rucaptchaKey,
                    taskId: taskId
                })
            });

            const result = await getResultResponse.json();

            if (result.status === 'ready') {
                return result.solution.text;
            }
        }
    }

    async login(email, password) {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        try {
            console.log('Переход на страницу авторизации...');
            await page.goto(`${this.baseURL}/login`, { waitUntil: 'networkidle2' });

            console.log('Ожидание поля email...');
            await page.waitForSelector('#email', { timeout: 10000 });
            console.log('Ввод email...');
            await page.type('#email', email);

            console.log('Ожидание поля пароля...');
            await page.waitForSelector('#password', { timeout: 10000 });
            console.log('Ввод пароля...');
            await page.type('#password', password);

            console.log('Ожидание капчи...');
            await page.waitForSelector('#captcha', { timeout: 10000 });
            const captchaSolution = await this.solveCaptcha(page);

            console.log('Ввод капчи...');
            await page.type('#captcha', captchaSolution);

            console.log('Отправка формы...');
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
            ]);

            console.log('Авторизация успешна.');
            await browser.close();
            return { success: true };
        } catch (error) {
            console.error('Ошибка авторизации:', error.message);
            await page.screenshot({ path: 'error.png', fullPage: true });
            await browser.close();
            throw error;
        }
    }
}