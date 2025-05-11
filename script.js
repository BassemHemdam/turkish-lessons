document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded. Initializing script v7 (Focus on Speech Synthesis)...");

    const contentArea = document.getElementById('content-area');
    // (بقية الـ selectors كما هي)
    const mainNav = document.getElementById('main-navigation');
    const navToggleButton = document.getElementById('nav-toggle-button');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    const homeLink = document.getElementById('home-link');
    const allLevelDetails = document.querySelectorAll('.level-details');
    const welcomeMessagePlaceholderOriginalHTML = document.querySelector('.welcome-message-placeholder')?.innerHTML || "<p>Welcome!</p>";


    let speechSynthesisInstance = null;
    let allAvailableVoices = []; // سنخزن جميع الأصوات هنا
    let turkishVoices = [];
    let speechErrorDiv = document.getElementById('tts-error-feedback'); // يجب أن يكون هذا موجودًا في HTML

    // دالة لإظهار رسالة للمستخدم عبر speechErrorDiv
    function showUserMessage(message, type = 'error') {
        if (!speechErrorDiv) {
            // إنشاء العنصر إذا لم يكن موجودًا (كحل احتياطي)
            speechErrorDiv = document.createElement('div');
            speechErrorDiv.id = 'tts-error-feedback';
            // (أضف التنسيقات الأساسية هنا إذا لزم الأمر، لكن الأفضل أن تكون في CSS)
            document.body.appendChild(speechErrorDiv);
        }
        speechErrorDiv.textContent = message;
        speechErrorDiv.style.backgroundColor = (type === 'error') ? 'var(--danger-color)' : ((type === 'warning') ? 'var(--warning-color)' : 'var(--info-color)');
        speechErrorDiv.style.color = (type === 'warning') ? 'var(--dark-text)' : 'white';
        speechErrorDiv.style.display = 'block';
        console.log(`User Message (${type}): ${message}`);
        setTimeout(() => { speechErrorDiv.style.display = 'none'; }, 7000);
    }
    
    function initializeSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            speechSynthesisInstance = window.speechSynthesis;
            console.log("Speech Synthesis API is supported.");

            // دالة لجلب وتحديث قائمة الأصوات
            const populateVoiceList = () => {
                allAvailableVoices = speechSynthesisInstance.getVoices();
                if (allAvailableVoices.length === 0 && !window.getVoicesRetryFlagForPopulate) {
                    console.warn("getVoices() returned empty list initially. Will retry on 'voiceschanged' or timeout.");
                    window.getVoicesRetryFlagForPopulate = true; // منع إعادة المحاولة اللانهائية
                    return; // انتظر الحدث أو المهلة
                }
                window.getVoicesRetryFlagForPopulate = false;

                console.log("All available voices in browser:", allAvailableVoices.map(v => `${v.name} (${v.lang}) ${v.default ? '[Default]' : ''}`).join('\n'));
                
                turkishVoices = allAvailableVoices.filter(voice => voice.lang.startsWith('tr'));
                if (turkishVoices.length > 0) {
                    console.log("Found Turkish voices:", turkishVoices.map(v => `${v.name} (${v.lang})`));
                } else {
                    console.warn("No Turkish (tr-TR) specific voices found in the browser's list.");
                    showUserMessage("تنبيه: لم يتم العثور على أصوات تركية مخصصة في متصفحك. قد يكون النطق غير دقيق أو يستخدم صوتًا افتراضيًا.", "warning");
                }
            };

            // استدعاء لجلب الأصوات المتاحة. قد تكون القائمة فارغة في البداية.
            populateVoiceList();

            // `onvoiceschanged` هو الحدث الأكثر موثوقية لمعرفة متى تصبح الأصوات متاحة.
            if (speechSynthesisInstance.onvoiceschanged !== undefined) {
                speechSynthesisInstance.onvoiceschanged = populateVoiceList;
            } else {
                // كحل احتياطي للمتصفحات التي قد لا تدعم onvoiceschanged بشكل جيد
                setTimeout(populateVoiceList, 1000); 
            }
        } else {
            console.error("Speech Synthesis API is NOT supported in this browser.");
            showUserMessage("عذرًا، متصفحك لا يدعم خاصية تحويل النص إلى كلام.", "error");
        }
    }
    initializeSpeechSynthesis(); // استدعاء تهيئة النطق عند تحميل الصفحة

    window.speakText = function(text, lang = 'tr-TR') {
        if (!speechSynthesisInstance) {
            showUserMessage("خاصية النطق غير متاحة أو لم يتم تهيئتها.", "error");
            return;
        }
        if (speechSynthesisInstance.speaking) {
            console.log("Speech synthesis is currently speaking, cancelling previous.");
            speechSynthesisInstance.cancel(); // إلغاء أي نطق سابق قبل بدء نطق جديد
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.85; // يمكنك تعديل السرعة
        utterance.pitch = 1.0; // يمكنك تعديل حدة الصوت

        // محاولة اختيار صوت تركي إن وجد
        let voiceToUse = null;
        if (turkishVoices.length > 0) {
            voiceToUse = turkishVoices.find(voice => voice.default && voice.lang.startsWith('tr')) || 
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('türkçe')) ||
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('turkish')) ||
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('yelda')) || 
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('filiz')) ||
                         turkishVoices[0]; // كحل أخير، استخدم أول صوت تركي متاح
        }
        
        if (voiceToUse) {
            utterance.voice = voiceToUse;
            console.log("Attempting to speak with voice:", voiceToUse.name, `(${voiceToUse.lang})`);
        } else {
            console.warn(`No specific Turkish voice selected for "${text}". Using browser default for lang "${lang}".`);
            // إذا لم نجد صوتًا تركيًا، على الأقل نتأكد من أن المتصفح سيحاول استخدام اللغة الصحيحة
            // هذا قد يؤدي إلى أن كروم ينطقها بالإنجليزية إذا لم يكن لديه محرك تركي جيد
        }
        
        utterance.onstart = () => console.log(`Speech started for: "${text}" with lang ${utterance.lang}`);
        utterance.onend = () => console.log(`Speech ended for: "${text}"`);
        utterance.onerror = function(event) {
            console.error('SpeechSynthesisUtterance Error:', event.error, event);
            let errorMsg = `خطأ في النطق (${event.error}).`;
            if (event.error === 'not-allowed' || event.error === 'blocked') {
                 errorMsg = 'المتصفح منع تشغيل الصوت تلقائيًا. حاول النقر على الصفحة أولاً ثم زر الصوت.';
            } else if (event.error === 'language-unavailable') {
                 errorMsg = `اللغة المطلوبة للنطق (${utterance.lang}) غير متوفرة أو غير مدعومة في هذا الصوت.`;
            } else if (event.error === 'voice-unavailable') {
                errorMsg = `الصوت المحدد (${utterance.voice ? utterance.voice.name : 'Default'}) غير متاح لهذه اللغة.`;
                 // محاولة إعادة النطق بدون تحديد صوت معين كحل أخير
                console.warn("Voice unavailable, trying with default for language...");
                const fallbackUtterance = new SpeechSynthesisUtterance(text);
                fallbackUtterance.lang = lang;
                speechSynthesisInstance.speak(fallbackUtterance);
                return; // لا تعرض رسالة خطأ إذا نجح ال fallback
            } else if (event.error === 'synthesis-failed' || event.error === 'audio-busy') {
                errorMsg = 'فشل نظام النطق في المتصفح أو كان مشغولاً. حاول مرة أخرى.';
            }
            showUserMessage(errorMsg, "error");
        };
        
        try {
            speechSynthesisInstance.speak(utterance);
        } catch (e) {
            console.error("Critical error calling speechSynthesis.speak:", e);
            showUserMessage("خطأ فادح عند محاولة النطق: " + e.message, "error");
        }
    };
    
    // --- Navigation and Page Loading (مع تبسيط لربط مستمعي الأحداث) ---
    // Event delegation for common interactive elements that might be in loaded content
    document.addEventListener('click', function(event) {
        const target = event.target;

        // Audio Buttons
        const audioButton = target.closest('.audio-button');
        if (audioButton) {
            event.preventDefault();
            const textToSpeak = audioButton.dataset.textToSpeak;
            if (textToSpeak) {
                window.speakText(textToSpeak.trim(), 'tr-TR');
            } else {
                console.warn("Audio button clicked, but 'data-text-to-speak' is missing.");
            }
            return; 
        }

        // Quiz Check Buttons
        const quizButton = target.closest('.check-answer-btn, .quiz-btn-check');
        if (quizButton) {
            event.preventDefault();
            // ... (منطق الكويز كما هو من الرد السابق، تأكد أنه يعمل ضمن هذا المستمع)
            const item = quizButton.closest('.quiz-item') || quizButton.closest('li'); 
            if (!item) return;
            const radioGroupName = item.querySelector('input[type="radio"]') ? item.querySelector('input[type="radio"]').name : null;
            const resultSpan = item.querySelector('.quiz-result-text, .quiz-result');
            const selectedAnswerRadio = radioGroupName ? item.querySelector(`input[name="${radioGroupName}"]:checked`) : null;
            if (!resultSpan) return; resultSpan.textContent = ''; 
            if (selectedAnswerRadio) { const isCorrect = selectedAnswerRadio.value === quizButton.dataset.correct; resultSpan.textContent = isCorrect ? ' 👍 صحيح!' : ' 👎 إجابة خاطئة.'; resultSpan.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)'; }
            else if (quizButton.classList.contains('quiz-btn-check') && quizButton.dataset.correct !== undefined) { const isCorrect = quizButton.dataset.correct === 'true'; resultSpan.textContent = isCorrect ? ' 👍 صحيح!' : ' 👎 إجابة خاطئة.'; resultSpan.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';}
            else { resultSpan.textContent = 'الرجاء اختيار إجابة.'; resultSpan.style.color = 'var(--medium-text)'; }
            setTimeout(() => { resultSpan.textContent = ''; }, 3500);
            return;
        }

        // Interactive Prompts in Welcome Message to open nav
        const interactivePrompt = target.closest('.interactive-prompt');
        // التأكد من أن النص التفاعلي موجود داخل منطقة رسالة الترحيب وليس في أي مكان آخر بالصفحة
        if (interactivePrompt && target.closest('.welcome-message-placeholder')) {
             event.preventDefault();
             console.log("Interactive welcome prompt clicked!"); // **DEBUG**
             openNav();
             return;
        }
        
        // Lesson Links in Main Navigation
        const navLink = target.closest('#main-navigation .lesson-list a');
        if (navLink) {
            event.preventDefault();
            const pagePathAttribute = navLink.getAttribute('data-page');
            if (!pagePathAttribute) { console.error("Nav link missing data-page attribute:", navLink); return; }
            
            let targetHash = convertPagePathToHash(pagePathAttribute);
            const isWelcomeVisible = contentArea.querySelector('.welcome-message-placeholder') && 
                                   getComputedStyle(contentArea.querySelector('.welcome-message-placeholder')).display !== 'none';

            if (window.location.hash === '#' + targetHash && !isWelcomeVisible && contentArea.querySelector('.container')) {
                if (body.classList.contains('nav-open')) closeNav(); return;
            }

            document.querySelectorAll('#main-navigation .lesson-list a').forEach(nl => nl.classList.remove('active'));
            navLink.classList.add('active');
            
            const parentDetails = navLink.closest('.level-details');
            allLevelDetails.forEach(d => { if (d !== parentDetails && d.hasAttribute('open')) d.removeAttribute('open'); });
            if (parentDetails && !parentDetails.hasAttribute('open')) parentDetails.setAttribute('open', '');
            
            loadPage(pagePathAttribute);
            return;
        }
    });

    // ... (بقية الدوال: openNav, closeNav, createGlobalPronunciationNoticeElement, loadPage, updateURLHash, convertPagePathToHash, convertHashToPagePath, showWelcomeMessage, homeLink listener, popstate listener, initialLoadLogic, yearSpan كما هي في الردود السابقة مع التأكد من سلامتها)
    // سنقوم بنسخها هنا للتأكيد

    function openNav() { if (mainNav && navToggleButton && overlay) { body.classList.add('nav-open'); navToggleButton.setAttribute('aria-expanded', 'true'); mainNav.setAttribute('aria-hidden', 'false');}}
    function closeNav() { if (mainNav && navToggleButton && overlay) { body.classList.remove('nav-open'); navToggleButton.setAttribute('aria-expanded', 'false'); mainNav.setAttribute('aria-hidden', 'true');}}
    if (navToggleButton) { navToggleButton.addEventListener('click', function(event) { event.stopPropagation(); if (body.classList.contains('nav-open')) closeNav(); else openNav(); }); }
    if (overlay) { overlay.addEventListener('click', closeNav); }
    document.addEventListener('keydown', function(event) { if (event.key === 'Escape' && body.classList.contains('nav-open')) closeNav(); });


    function createGlobalPronunciationNoticeElement() {
        const noticeDiv = document.createElement('div');
        noticeDiv.className = 'global-pronunciation-notice';
        noticeDiv.innerHTML = `<i class="fas fa-bullhorn"></i> <p><strong>تنويه النطق:</strong> للحصول على أفضل لفظ، يُنصح بالاستماع إلى متحدثين أصليين.</p>`;
        return noticeDiv;
    }

    function loadPage(pagePath, fromPopState = false) {
        if (!pagePath || typeof pagePath !== 'string' || pagePath.trim() === '') { showWelcomeMessage(true); return; }
        if (speechSynthesisInstance) speechSynthesisInstance.cancel();
        
        const currentWelcome = contentArea.querySelector('.welcome-message-placeholder');
        if (currentWelcome) currentWelcome.style.display = 'none';
        contentArea.innerHTML = '<p class="page-loading-indicator">جاري تحميل الدرس...</p>'; 
        
        const filePath = `lessons/${pagePath}.html`; 
        fetch(filePath)
            .then(response => { if (!response.ok) throw new Error(`ملف الدرس "${filePath}" غير موجود (HTTP ${response.status})`); return response.text(); })
            .then(html => {
                contentArea.innerHTML = ''; 
                const pronunciationNoticeBar = createGlobalPronunciationNoticeElement(); contentArea.appendChild(pronunciationNoticeBar);
                const tempDiv = document.createElement('div'); tempDiv.innerHTML = html;
                const lessonContentContainer = tempDiv.querySelector('.container'); 
                if (lessonContentContainer) { contentArea.appendChild(lessonContentContainer); } 
                else { const fragment = document.createRange().createContextualFragment(html); contentArea.appendChild(fragment); }
                // Event delegation handles most, but scripts inside loaded HTML might need re-execution
                const scriptsInLoadedHTML = Array.from(contentArea.querySelectorAll("script"));
                scriptsInLoadedHTML.forEach((oldScript) => { /* ... (script re-execution logic) ... */ });
                if (!fromPopState) updateURLHash(pagePath);
                window.scrollTo(0,0);
                if (body.classList.contains('nav-open')) closeNav();
            })
            .catch(error => { 
                contentArea.innerHTML = `<div class="welcome-message-placeholder" style="display:flex !important;"><div class="welcome-card" style="border-top-color:var(--danger-color);"><h2 style="color: var(--danger-color);"><i class="fas fa-exclamation-triangle"></i> خطأ</h2><p>لم يتم تحميل الدرس (<span dir="ltr">${pagePath}.html</span>). التفاصيل: ${error.message}</p></div></div>`;
            });
    }

    function convertPagePathToHash(pagePath) { if (!pagePath) return ""; return pagePath.replace('level_1/', 'u1_').replace('level_2/', 'u2_').replace('level_3/', 'u3_').replace('level_4/', 'u4_').replace('level_5/', 'u5_').replace(/\//g, '_'); }
    function convertHashToPagePath(hash) { if (!hash) return ""; let path = hash; if (hash.startsWith('u1_')) path = hash.replace('u1_', 'level_1/'); else if (hash.startsWith('u2_')) path = hash.replace('u2_', 'level_2/'); else if (hash.startsWith('u3_')) path = hash.replace('u3_', 'level_3/'); else if (hash.startsWith('u4_')) path = hash.replace('u4_', 'level_4/'); else if (hash.startsWith('u5_')) path = hash.replace('u5_', 'level_5/'); else return null; return path; }
    function updateURLHash(pagePath) { const hashPart = convertPagePathToHash(pagePath); if (pagePath && window.location.hash !== '#' + hashPart) history.pushState({page: pagePath, hash: hashPart}, '', '#' + hashPart); }

    function showWelcomeMessage(openDefaultLevel = false) { 
        if (welcomeMessagePlaceholderOriginalHTML) {
            const welcomeInDOM = contentArea.querySelector('.welcome-message-placeholder');
            // Only re-render if not already showing or if it's an empty content area
            if (!welcomeInDOM || getComputedStyle(welcomeInDOM).display === 'none' || contentArea.innerHTML.trim() === '') {
                 contentArea.innerHTML = `<div class="welcome-message-placeholder" style="display:flex;">${welcomeMessagePlaceholderOriginalHTML}</div>`;
            }
        }
        document.querySelectorAll('#main-navigation .lesson-list a').forEach(nl => nl.classList.remove('active'));
        if (openDefaultLevel) {
            allLevelDetails.forEach(d => d.removeAttribute('open')); 
            const firstLevelDetails = document.querySelector('#main-navigation details.level-details'); 
            if (firstLevelDetails && !firstLevelDetails.hasAttribute('open')) firstLevelDetails.setAttribute('open', '');
        }
    }
    
    if(homeLink){ homeLink.addEventListener('click', function(e){ e.preventDefault(); showWelcomeMessage(true); if(history.pushState){history.pushState(null, '', window.location.pathname + window.location.search);}else{window.location.hash='';} });}
    
    window.addEventListener('popstate', () => handleHashChange(false));
    
    const initialLoadLogic = () => { getAndLogVoices(); handleHashChange(true); };
    if (speechSynthesisInstance) {
        let voices = speechSynthesisInstance.getVoices();
        if (voices.length) { initialLoadLogic(); } 
        else if (typeof speechSynthesisInstance.onvoiceschanged === 'function') {
             let voiceLoadTimeout = setTimeout(() => { if (!window.voicesProcessedByEventFlagInit) {console.warn("Timeout: voiceschanged not fired for initial load."); initialLoadLogic(); window.voicesProcessedByEventFlagInit = true;} }, 2000);
            speechSynthesisInstance.onvoiceschanged = () => { 
                if (!window.voicesProcessedByEventFlagInit) { clearTimeout(voiceLoadTimeout); window.voicesProcessedByEventFlagInit = true; initialLoadLogic(); }
                speechSynthesisInstance.onvoiceschanged = null; 
            };
            if (!speechSynthesisInstance.speaking && !speechSynthesisInstance.pending && !voices.length) { const s = new SpeechSynthesisUtterance(' '); s.volume=0; speechSynthesisInstance.speak(s); }
        } else { setTimeout(initialLoadLogic, 500); }
    } else { setTimeout(initialLoadLogic, 100); }

    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    console.log("Script initialization finished successfully.");
});
// --- END OF script.js ---