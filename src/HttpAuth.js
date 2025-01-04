import sharp from 'sharp';
import { JSDOM } from 'jsdom';

export default class HttpAuthBot {
    constructor(baseURL, rucaptchaKey) {
        this.baseURL = baseURL;
        this.rucaptchaKey = rucaptchaKey;
    }

    async svgToPng(svgString) {
        const dom = new JSDOM();
        const parser = new dom.window.DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = svgDoc.documentElement;

        const width = parseInt(svg.getAttribute('width') || '200');
        const height = parseInt(svg.getAttribute('height') || '50');

        const pngBuffer = await sharp(Buffer.from(svgString))
            .resize(Math.min(width, 600), Math.min(height, 600), {
                fit: 'inside',
                withoutEnlargement: true
            })
            .png()
            .toBuffer();

        return pngBuffer;
    }

    async solveCaptcha(svgData) {
        try {
            const pngBuffer = await this.svgToPng(svgData);
            const base64Data = pngBuffer.toString('base64');

            const createTaskResponse = await fetch('https://api.rucaptcha.com/createTask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientKey: this.rucaptchaKey,
                    task: {
                        type: "ImageToTextTask",
                        body: base64Data,
                        phrase: false,
                        case: true,
                        numeric: 4, // требуются и цифры, и буквы
                        math: false,
                        minLength: 5,
                        maxLength: 6,
                        comment: "Введите символы с изображения. Содержит буквы и цифры.",
                    },
                    languagePool: "rn"
                })
            });

            const createTaskResult = await createTaskResponse.json();

            if (createTaskResult.errorId !== 0) {
                throw new Error(`Ошибка создания задачи: ${createTaskResult.errorDescription}`);
            }

            const taskId = createTaskResult.taskId;

            while (true) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                const getResultResponse = await fetch('https://api.rucaptcha.com/getTaskResult', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        clientKey: this.rucaptchaKey,
                        taskId: taskId
                    })
                });

                const result = await getResultResponse.json();

                if (result.status === 'ready') {
                    return result.solution.text;
                }

                if (result.errorId !== 0) {
                    throw new Error(`Ошибка получения результата: ${result.errorDescription}`);
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке капчи:', error);
            throw error;
        }
    }

    async login(email, password) {
        const captchaResponse = await fetch(`${this.baseURL}/api/captcha/generate`);
        const captchaData = await captchaResponse.json();

        const captchaSolution = await this.solveCaptcha(captchaData.svg);

        const loginResponse = await fetch(`${this.baseURL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                captcha: captchaSolution,
                captchaId: captchaData.id
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Ошибка входа: ${loginResponse.statusText}`);
        }

        return loginResponse.json();
    }
}