// functions/index.js

// Импортируем нужные модули
const {onRequest} = require("firebase-functions/v2/https"); // Функции v2
const logger = require("firebase-functions/logger");         // Логирование
const fetch = require("node-fetch");                       // Для HTTP запросов
const functions = require("firebase-functions");           // Для доступа к config (v1 стиль)

// --- Основная функция-прокси для Gemini ---
exports.getGeminiLesson = onRequest(
    // Настройки функции: включаем CORS (чтобы браузер мог делать запросы) и выбираем регион
    { cors: true, region: "europe-west1" }, // Можешь выбрать регион ближе к себе, например, "us-central1"
    async (req, res) => {
        // Логируем начало вызова функции
        logger.info("getGeminiLesson function triggered", {method: req.method, bodyKeys: Object.keys(req.body || {})});

        // 1. Проверка метода запроса (разрешаем только POST)
        if (req.method !== "POST") {
            logger.warn("Invalid request method:", req.method);
            // Отправляем ошибку 405 Method Not Allowed
            res.status(405).send("Method Not Allowed");
            return; // Завершаем выполнение
        }

        // 2. Получение и проверка промпта из тела запроса
        // Ожидаем, что фронтенд отправит JSON вида: { "prompt": "текст промпта" }
        const promptText = req.body?.prompt; // Безопасный доступ к свойству prompt
        if (!promptText || typeof promptText !== 'string' || promptText.trim() === '') {
            logger.warn("Invalid request body: missing, empty or invalid 'prompt'", {body: req.body});
            // Отправляем ошибку 400 Bad Request
            res.status(400).send("Bad Request: Missing, empty or invalid 'prompt' in body.");
            return; // Завершаем выполнение
        }
        // Логируем длину полученного промпта (для отладки)
        logger.info("Received prompt length:", promptText.length);

        // 3. Получение API ключа Gemini из конфигурации Firebase
        let apiKey = "";
        try {
            // Используем functions.config() для доступа к переменным, установленным через firebase functions:config:set
            apiKey = functions.config().gemini?.key; // Ожидаем, что ключ лежит в секции [gemini] под именем key

            if (!apiKey) {
                // Если ключ не найден в конфиге, выбрасываем ошибку
                throw new Error("Gemini API key not found in Firebase config (gemini.key). Run 'firebase functions:config:set gemini.key=YOUR_KEY'");
            }
            // Логировать сам ключ не стоит из соображений безопасности
            logger.info("Successfully retrieved Gemini API key from config.");

        } catch (error) {
            // Если произошла ошибка при доступе к конфигу
            logger.error("Failed to get API key from Firebase config:", error);
            // Отправляем ошибку 500 Internal Server Error
            res.status(500).send("Internal Server Error: API key configuration error.");
            return; // Завершаем выполнение
        }

        // 4. Формирование запроса к Gemini API
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: promptText }] }],
            // Настройки безопасности - блокируем опасный контент
            safetySettings: [
                 { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                 { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                 { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                 { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
            // Можно добавить параметры генерации, если нужно
            // generationConfig: {
            //     temperature: 0.7, // Пример
            // }
        };

        // 5. Выполнение запроса к Gemini API с помощью node-fetch
        try {
            logger.info("Sending request to Gemini API...");
            const geminiResponse = await fetch(GEMINI_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                timeout: 30000, // Таймаут запроса - 30 секунд
            });

            // 6. Обработка ответа от Gemini API
            if (!geminiResponse.ok) {
                // Если Gemini вернул ошибку (статус не 2xx)
                const errorBodyText = await geminiResponse.text(); // Читаем тело ошибки как текст
                logger.error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`, {errorBody: errorBodyText});
                // Отправляем клиенту общую ошибку шлюза, не раскрывая детали от Gemini
                res.status(502).send(`Bad Gateway: Gemini API request failed with status ${geminiResponse.status}.`);
                return; // Завершаем выполнение
            }

            // Если ответ успешный (статус 2xx)
            const data = await geminiResponse.json(); // Парсим JSON ответа
            logger.info("Received successful response from Gemini API.");

            // Извлекаем сгенерированный текст из сложной структуры ответа Gemini
            const candidate = data?.candidates?.[0];
            const generatedText = candidate?.content?.parts?.[0]?.text;

            // 7. Отправка результата клиенту (нашему сайту)
            if (generatedText) {
                // Если текст успешно извлечен
                logger.info("Successfully extracted text. Sending response to client.");
                // Отправляем JSON вида: { "generatedContent": "..." } со статусом 200 OK
                res.status(200).json({ generatedContent: generatedText });
            } else {
                // Если текст не найден, проверяем причину (например, блокировка)
                 if (candidate?.finishReason === 'SAFETY') {
                     const blockReason = candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'Safety settings';
                     logger.warn("Gemini content blocked by Safety settings:", blockReason);
                     res.status(400).send(`Bad Request: Content generation blocked due to safety settings (${candidate.finishReason}).`);
                 } else if (data?.promptFeedback?.blockReason) {
                     logger.warn("Gemini content blocked by Prompt Feedback:", data.promptFeedback.blockReason);
                     res.status(400).send(`Bad Request: Content generation blocked due to prompt feedback (${data.promptFeedback.blockReason}).`);
                 } else {
                    // Если причина неясна
                    logger.error("Failed to extract text from Gemini response structure", {responseData: JSON.stringify(data).substring(0, 500)}); // Логируем начало ответа для отладки
                    res.status(500).send("Internal Server Error: Could not process Gemini response structure.");
                 }
            }

        } catch (error) {
            // Обработка ошибок сети или таймаутов при вызове fetch
            logger.error("Error calling Gemini API or processing response:", error);
             if (error.type === 'AbortError' || (error.name === 'FetchError' && error.code === 'ETIMEDOUT')){
                 res.status(504).send("Gateway Timeout: Gemini API request timed out.");
             } else {
                res.status(500).send("Internal Server Error: Failed to communicate with Gemini API.");
             }
        }
    }
);

// Можно добавить другие функции здесь, если понадобятся
// exports.myOtherFunction = ...