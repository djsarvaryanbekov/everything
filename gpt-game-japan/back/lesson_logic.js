// --- scripts/lesson_logic.js ---
// Логика загрузки, отображения и проверки уроков в Хабе

// --- Структура Уроков (Оставляем как есть) ---
const lessons = [
    { id: 1, lessonNumber: 1, step: 1, topic: "Приветствия (утро)" },
    { id: 2, lessonNumber: 1, step: 2, topic: "Приветствия (день)" },
    { id: 3, lessonNumber: 1, step: 3, topic: "Тест на приветствия (утро/день)" },
    { id: 4, lessonNumber: 1, step: 4, topic: "Приветствия (вечер)" },
    { id: 5, lessonNumber: 1, step: 5, topic: "Тест на приветствия (вечер)" },
    { id: 6, lessonNumber: 2, step: 1, topic: "Указательные местоимения これ、それ、あれ" },
    { id: 7, lessonNumber: 2, step: 2, topic: "Вопрос с か" },
    { id: 8, lessonNumber: 2, step: 3, topic: "Частица の (принадлежность)" },
    // ... добавь больше уроков ...
];

// --- Состояние Игры (Глобальное для этого модуля) ---
let currentLessonIndex = 0;
let currentOS = 0;
let currentLevel = 1;
const osPerLevel = 100; // Переименовали xpPerLevel
let currentLessonData = {}; // Данные текущего загруженного шага урока

// --- URL твоей Cloud Function ---
const CLOUD_FUNCTION_URL = "https://europe-west1-gpt-japan-chrome-firebase.cloudfunctions.net/getGeminiLesson";

// --- Загрузка/Сохранение Состояния Игры ---
function loadGameState() {
    // Загружаем индекс ПОСЛЕДНЕГО начатого урока (не обязательно завершенного)
    currentLessonIndex = parseInt(localStorage.getItem("currentLessonIndex")) || 0;
    // Проверка, чтобы индекс не выходил за рамки массива уроков
    if (currentLessonIndex < 0 || currentLessonIndex >= lessons.length) {
        currentLessonIndex = 0;
    }
    // Загружаем ОС и Уровень
    currentOS = parseInt(localStorage.getItem("currentOS")) || 0; // Используем currentOS
    currentLevel = parseInt(localStorage.getItem("currentLevel")) || 1;
    console.log(`Game state loaded: LessonIndex=${currentLessonIndex}, Level=${currentLevel}, OS=${currentOS}`);
    updateHubUI(); // Обновляем интерфейс Хаба (HUD)
}

function saveGameState() {
    localStorage.setItem("currentLessonIndex", currentLessonIndex);
    localStorage.setItem("currentOS", currentOS); // Сохраняем currentOS
    localStorage.setItem("currentLevel", currentLevel);
    // Массив completedSteps сохраняется в addOS
    // console.log("Game state saved.");
}

// --- Обновление Элементов Интерфейса Хаба (HUD) ---
function updateHubUI() {
    // Находим элементы HUD (они должны быть доступны глобально или передаваться)
    const levelDisplay = document.getElementById('player-level');
    const osDisplay = document.getElementById('player-sync-points'); // Используем новые ID
    const osToNextDisplay = document.getElementById('sync-points-to-next');

    if (levelDisplay) levelDisplay.textContent = currentLevel;
    if (osDisplay) osDisplay.textContent = currentOS;
    if (osToNextDisplay) osToNextDisplay.textContent = osPerLevel; // Показываем, сколько нужно для след. уровня

    // Обновление прогресс-бара в ГОЛОГРАММЕ (если она активна)
    // Важно: этот код должен вызываться, когда голограмма видима
    updateHologramProgress();

    // Можно также обновить прогресс-бар в HUD, если он там будет
    // const hudProgressBar = document.getElementById('hud-progress-bar');
    // if(hudProgressBar) { ... }
}

function updateHologramProgress() {
    const progressBarFill = document.querySelector('.info-hologram-simple .progress-bar-fill');
    if (progressBarFill) {
         const progressPercentage = osPerLevel > 0 ? (currentOS / osPerLevel) * 100 : 0;
         progressBarFill.style.width = Math.min(100, progressPercentage) + "%";
    }
     // Обновляем текст в голограмме
     const holoLevel = document.getElementById('holo-player-level');
     const holoSync = document.getElementById('holo-player-sync');
     const syncToNext = document.getElementById('sync-to-next');
     if(holoLevel) holoLevel.textContent = currentLevel;
     if(holoSync) holoSync.textContent = currentOS;
     if(syncToNext) syncToNext.textContent = osPerLevel;
}


// --- Вызов Cloud Function ---
async function callCloudFunction(promptText) {
    console.log("Calling Cloud Function...");
    // КЛЮЧА ЗДЕСЬ НЕТ!
    const FUNCTION_URL = CLOUD_FUNCTION_URL; // Используем URL из константы

    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText }) // Отправляем только промпт
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cloud Function Error ${response.status}: ${errorText}`);
            throw new Error(`Ошибка функции: ${response.status}. ${errorText.substring(0, 100)}`); // Добавляем часть текста ошибки
        }

        const data = await response.json();

        // Ожидаем ответ вида { generatedContent: "..." }
        const generatedText = data.generatedContent;

        if (generatedText) {
            console.log("Received content from Cloud Function.");
            return generatedText; // Возвращаем текст ответа Gemini
        } else {
            console.error("Cloud function returned empty or invalid content.", data);
            throw new Error("Ошибка: Функция не вернула ожидаемый контент.");
        }
    } catch (error) {
         console.error("Failed to fetch from Cloud Function:", error);
         // Можно показать сообщение об ошибке пользователю через UI Хаба
         const systemMessage = document.getElementById('system-message');
         if(systemMessage) systemMessage.textContent = `> Ошибка сети при вызове функции: ${error.message}`;
         throw error; // Пробрасываем ошибку дальше
    }
}

// --- Загрузка и Отображение Урока ---
// Эта функция будет вызываться из основного скрипта Хаба
async function startLesson(index) {
    console.log(`Starting lesson with index: ${index}`);
    if (index < 0 || index >= lessons.length) {
        console.error(`Invalid lesson index: ${index}`);
        // Можно показать сообщение в Хабе
        const systemMessage = document.getElementById('system-message');
        if(systemMessage) systemMessage.textContent = `> Ошибка: Неверный индекс урока.`;
        return;
    }

    currentLessonIndex = index; // Обновляем текущий индекс
    saveGameState(); // Сохраняем на случай перезагрузки

    const lessonInfo = lessons[currentLessonIndex];
    const stepId = `lesson_${lessonInfo.lessonNumber}_step_${lessonInfo.step || (index + 1)}`;

    // --- Находим ЭЛЕМЕНТЫ ВНУТРИ #lessons-content Хаба ---
    // Важно: Эти элементы должны СУЩЕСТВОВАТЬ в HTML внутри #lessons-content!
    const lessonContentContainer = document.getElementById('lessons-content');
    const titleEl = document.getElementById('lesson-topic-title');        // Ожидаемый ID: lesson-topic-title
    const explanationEl = document.getElementById('lesson-explanation');   // Ожидаемый ID: lesson-explanation
    const exerciseEl = document.getElementById('lesson-exercise');         // Ожидаемый ID: lesson-exercise
    const optionsEl = document.getElementById('lesson-options');           // Ожидаемый ID: lesson-options
    const feedbackEl = document.getElementById('lesson-feedback');         // Ожидаемый ID: lesson-feedback
    const wordsEl = document.getElementById('lesson-new-words');           // Ожидаемый ID: lesson-new-words
    // const loadingIndicator = document.getElementById('lesson-loading'); // Опционально: lesson-loading

    if (!titleEl || !explanationEl || !exerciseEl || !optionsEl || !feedbackEl || !wordsEl) {
         console.error("One or more lesson display elements not found inside #lessons-content!");
         if (lessonContentContainer) {
              lessonContentContainer.innerHTML = `<p style="color: red;">Ошибка: Не найдены все необходимые элементы для отображения урока.</p>`;
         }
         return;
    }

    // --- Показываем "Загрузка..." ---
    titleEl.textContent = `Урок ${lessonInfo.lessonNumber}, Шаг ${lessonInfo.step || (index + 1)}: ${lessonInfo.topic}`;
    explanationEl.textContent = "Загрузка объяснения...";
    exerciseEl.innerHTML = "<p>Загрузка задания...</p>";
    wordsEl.innerHTML = "<li>Загрузка слов...</li>";
    optionsEl.innerHTML = '';
    optionsEl.style.display = 'none';
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback'; // Сброс класса
    // if (loadingIndicator) loadingIndicator.style.display = 'flex';

    // --- Формируем Промпт (остается почти таким же) ---
    const prompt = `Ты AI-ассистент... (ВЕСЬ ТЕКСТ ПРОМПТА КАК И РАНЬШЕ) ...
Структура JSON:
{
  "explanation": "...",
  "exercise": { "type": "multipleChoice/fillInBlank", "question": "...", "options": [...], "correctAnswer": "..." },
  "newWords": [ ... ],
  "xp": 10-20
}`; // Не забудь вставить сюда полный промпт

    // --- Получаем данные через Cloud Function ---
    try {
        const aiResponseText = await callCloudFunction(prompt); // <<<< ВЫЗЫВАЕМ ФУНКЦИЮ
        // Убираем Markdown, если он есть (на всякий случай)
        const cleanedResponseText = aiResponseText.replace(/^```json\s*/, '').replace(/```\s*$/, '');

        // --- Парсим JSON ---
        try {
            currentLessonData = JSON.parse(cleanedResponseText);
            currentLessonData.stepId = stepId; // Добавляем ID шага для отслеживания прогресса ОС

            // --- Обновляем HTML элементы ВНУТРИ #lessons-content ---
            explanationEl.textContent = currentLessonData.explanation || "Нет объяснения.";
            exerciseEl.innerHTML = `<p>${currentLessonData.exercise?.question || "Нет задания."}</p>`;
            optionsEl.innerHTML = ''; // Очищаем опции
            optionsEl.style.display = 'none'; // Скрываем контейнер опций по умолчанию

            const exercise = currentLessonData.exercise;

            // --- Рендеринг Упражнений (логика почти та же) ---
            if (exercise && exercise.options && Array.isArray(exercise.options) && exercise.options.length > 0) {
                optionsEl.style.display = 'block'; // Показываем контейнер опций
                if (exercise.type === 'multipleChoice') {
                    // Проверка формата опций
                     if (typeof exercise.options[0] !== 'object' || exercise.options[0] === null || typeof exercise.options[0].isCorrect === 'undefined') {
                        throw new Error("Неверный формат options для multipleChoice.");
                    }
                    exercise.options.forEach((option, idx) => {
                        const button = document.createElement('button');
                        button.textContent = option.text;
                        button.classList.add('lesson-option-btn'); // Используем новый класс?
                        button.disabled = false;
                        button.dataset.correct = option.isCorrect;
                        // Передаем индекс или текст ответа в checkAnswer
                        button.onclick = () => checkLessonAnswer(null, button);
                        optionsEl.appendChild(button);
                    });

                } else if (exercise.type === 'fillInBlank') {
                    // Проверка формата опций и ответа
                     if (typeof exercise.options[0] !== 'string') {
                        throw new Error("Неверный формат options для fillInBlank.");
                    }
                    if (!exercise.correctAnswer || typeof exercise.correctAnswer !== 'string') {
                        throw new Error("Отсутствует correctAnswer для fillInBlank.");
                    }
                    exercise.options.forEach(optionText => {
                        const button = document.createElement('button');
                        button.textContent = optionText;
                        button.classList.add('lesson-option-btn'); // Новый класс
                        button.disabled = false;
                        button.onclick = () => checkLessonAnswer(optionText, button);
                        optionsEl.appendChild(button);
                    });
                } else {
                     console.warn("Неизвестный тип упражнения:", exercise.type);
                     exerciseEl.innerHTML += "<p>(Неизвестный тип упражнения)</p>";
                     optionsEl.style.display = 'none';
                }
            } else {
                 console.log("Нет опций для отображения.");
                 optionsEl.style.display = 'none';
            }

            // Обновляем Новые Слова
            wordsEl.innerHTML = ''; // Очищаем
            if (currentLessonData.newWords && Array.isArray(currentLessonData.newWords) && currentLessonData.newWords.length > 0) {
                currentLessonData.newWords.forEach(word => {
                    const li = document.createElement('li');
                    li.textContent = word;
                    // TODO: Добавить обработчик для добавления слова в SRS?
                    wordsEl.appendChild(li);
                });
            } else {
                wordsEl.innerHTML = "<li>Нет новых слов.</li>";
            }

        } catch (parseError) {
            console.error("Ошибка парсинга JSON или рендеринга:", parseError);
            console.error("Полученный текст от функции:", cleanedResponseText);
            explanationEl.textContent = "Ошибка обработки данных урока.";
            exerciseEl.innerHTML = `<p>Не удалось разобрать ответ от AI. ${parseError.message}</p>`;
            optionsEl.style.display = 'none';
            wordsEl.innerHTML = "<li>Ошибка.</li>";
            currentLessonData = {}; // Сбрасываем данные
        }

    } catch (apiError) {
        // Ошибка уже залогирована в callCloudFunction
        explanationEl.textContent = "Ошибка загрузки урока.";
        exerciseEl.innerHTML = `<p>Не удалось получить данные от сервера: ${apiError.message}</p>`;
        optionsEl.style.display = 'none';
        wordsEl.innerHTML = "<li>Ошибка.</li>";
        currentLessonData = {};
    } finally {
        // if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
    // Обновление кнопок навигации урока (если они будут)
    // updateLessonNavButtons(index);
}


// --- Проверка Ответа Урока ---
// Вызывается при клике на кнопку опции
function checkLessonAnswer(selectedAnswerText, clickedButton) {
     // Находим элементы ВНУТРИ #lessons-content
     const optionsEl = document.getElementById('lesson-options');
     const feedbackEl = document.getElementById('lesson-feedback');

     if (!currentLessonData?.exercise || !optionsEl || !feedbackEl) {
        console.error("Невозможно проверить ответ: нет данных урока или элементов DOM.");
        return;
    }

    const exercise = currentLessonData.exercise;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback'; // Сброс класса

    let isCorrect = false;

    // Блокируем все кнопки опций
    optionsEl.querySelectorAll('.lesson-option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.cursor = 'default';
        // Убираем ховер эффекты, если нужно
    });

    // --- Логика Проверки (та же, что и раньше) ---
    try {
        if (exercise.type === 'multipleChoice') {
            if (!clickedButton || typeof clickedButton.dataset.correct === 'undefined') throw new Error("Неверные данные кнопки MC.");
            isCorrect = clickedButton.dataset.correct === 'true';
            if (!isCorrect) { // Подсвечиваем правильный
                optionsEl.querySelectorAll('.lesson-option-btn[data-correct="true"]').forEach(btn => btn.classList.add('correct'));
            }
        } else if (exercise.type === 'fillInBlank') {
             if (selectedAnswerText === null || typeof selectedAnswerText === 'undefined' || !exercise.correctAnswer) throw new Error("Неверные данные FIB.");
            isCorrect = (selectedAnswerText === exercise.correctAnswer);
             if (!isCorrect) { // Подсвечиваем правильный
                 optionsEl.querySelectorAll('.lesson-option-btn').forEach(btn => {
                    if (btn.textContent === exercise.correctAnswer) btn.classList.add('correct');
                });
            }
        } else { throw new Error(`Неизвестный тип упражнения: ${exercise.type}`); }
    } catch (error) { /* ... обработка ошибки проверки ... */ return; }

    // --- Отображение Результата ---
    if (isCorrect) {
        console.log("Answer Correct!");
        if (clickedButton) clickedButton.classList.add('correct');
        feedbackEl.textContent = "Правильно! 👍"; // << Менее кричаще
        feedbackEl.classList.add('correct');
        // Начисляем ОС (бывший XP)
        addOS(currentLessonData.xp || 10, currentLessonData.stepId);
    } else {
        console.log("Answer Incorrect.");
        if (clickedButton) clickedButton.classList.add('incorrect');
        // Ищем текст правильного ответа
        let correctAnswerText = "...";
        try {
             if (exercise.type === 'multipleChoice') {
                const correctBtn = optionsEl.querySelector('.lesson-option-btn.correct');
                if(correctBtn) correctAnswerText = correctBtn.textContent;
            } else if (exercise.type === 'fillInBlank') {
                correctAnswerText = exercise.correctAnswer;
            }
        } catch(e) { console.error("Error getting correct answer text", e); }

        feedbackEl.textContent = `Неправильно. Верный ответ: ${correctAnswerText}`;
        feedbackEl.classList.add('incorrect');
    }

    // TODO: Добавить кнопку "Продолжить" или автопереход?
    // Пока просто оставляем так, следующий шаг будет по навигации Хаба.
}

// --- Начисление Очков Синхронизации (ОС) ---
function addOS(amount, stepId) {
    if (!amount || amount <= 0 || !stepId) {
        console.warn("Попытка добавить ОС без amount или stepId.", {amount, stepId});
        return;
    }

    // Проверяем, пройден ли уже этот шаг
    let completedSteps = [];
    try {
        completedSteps = JSON.parse(localStorage.getItem("completedSteps")) || [];
        if (!Array.isArray(completedSteps)) completedSteps = [];
    } catch (e) { completedSteps = []; }

    if (completedSteps.includes(stepId)) {
        console.log(`ОС за шаг ${stepId} уже были начислены.`);
        return; // Не начисляем повторно
    }

    console.log(`Начисляем ${amount} ОС за новый шаг ${stepId}.`);
    currentOS += amount; // Увеличиваем ОС
    completedSteps.push(stepId); // Добавляем шаг в пройденные
    localStorage.setItem("completedSteps", JSON.stringify(completedSteps)); // Сохраняем пройденные

    // Проверка на новый уровень
    while (currentOS >= osPerLevel) {
        currentOS -= osPerLevel;
        currentLevel++;
        console.log(`🎉 Новый уровень: ${currentLevel}! 🎉`);
        // TODO: Добавить визуальный эффект левел-апа в Хабе
    }

    saveGameState(); // Сохраняем новое состояние (индекс, ОС, уровень)
    updateHubUI();   // Обновляем отображение в Хабе
}

// --- Навигация по Урокам ---
// Эти функции могут вызываться, например, из обработчика в основном скрипте Хаба
function goToNextLesson() {
    if (currentLessonIndex < lessons.length - 1) {
        console.log("Переход к следующему уроку...");
        startLesson(currentLessonIndex + 1); // Запускаем следующий по индексу
    } else {
        console.log("Достигнут конец списка уроков.");
        // Можно отобразить сообщение в секции урока
         const exerciseEl = document.getElementById('lesson-exercise');
         if(exerciseEl) exerciseEl.innerHTML = '<p style="text-align: center; font-weight: bold;">Поздравляем! Все доступные темы пройдены!</p>';
         const optionsEl = document.getElementById('lesson-options');
         if(optionsEl) optionsEl.innerHTML = '';
    }
}

function goToPrevLesson() {
    if (currentLessonIndex > 0) {
        console.log("Переход к предыдущему уроку...");
        startLesson(currentLessonIndex - 1); // Запускаем предыдущий
    } else {
        console.log("Это первый урок.");
    }
}


// --- Инициализация Состояния ---
// Вызывать один раз при загрузке основного скрипта Хаба
function initializeLessonLogic() {
     console.log("Initializing lesson logic state...");
     loadGameState(); // Загружаем прогресс ОС/уровня и последний индекс
     // Можно сразу загрузить последний урок, если нужно
     // startLesson(currentLessonIndex);
 }

// --- КОНЕЦ ФАЙЛА scripts/lesson_logic.js ---