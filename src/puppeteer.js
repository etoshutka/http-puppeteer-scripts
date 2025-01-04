import 'dotenv/config';
import PuppeteerAuthBot from './PuppeteerAuth.js';

async function main() {
    if (!process.env.BASE_URL || !process.env.RUCAPTCHA_KEY) {
        console.error('Ошибка: Не указаны BASE_URL или RUCAPTCHA_KEY в .env файле');
        process.exit(1);
    }

    const bot = new PuppeteerAuthBot(
        process.env.BASE_URL,
        process.env.RUCAPTCHA_KEY
    );

    try {
        console.log('Начинаем вход через браузер...');
        const loginResult = await bot.login('test123123@mail.ru', 'Asd@123123');
        console.log('Результат входа:', loginResult);

    } catch (error) {
        console.error('Произошла ошибка:', error.message);
        process.exit(1);
    }
}

main();