document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded. Initializing script v8 (Refined Speech & Styling Focus)...");

    const contentArea = document.getElementById('content-area');
    const mainNav = document.getElementById('main-navigation');
    const navToggleButton = document.getElementById('nav-toggle-button');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    const homeLink = document.getElementById('home-link');
    const allLevelDetails = document.querySelectorAll('.level-details');
    const welcomeMessagePlaceholderOriginalHTML = document.querySelector('.welcome-message-placeholder')?.innerHTML || "<div class='welcome-card'><p>أهلاً بك!</p></div>";

    let speechSynthesisInstance = null;
    let allAvailableVoices = [];
    let turkishVoices = [];
    let speechErrorDiv = document.getElementById('tts-error-feedback');

    function showUserMessage(message, type = 'error') {
        if (!speechErrorDiv) {
            speechErrorDiv = document.createElement('div');
            speechErrorDiv.id = 'tts-error-feedback';
            document.body.appendChild(speechErrorDiv);
        }
        speechErrorDiv.textContent = message;
        speechErrorDiv.className = `tts-feedback-msg tts-feedback-${type}`; // Use classes for styling
        speechErrorDiv.style.display = 'block';
        console.log(`User Message (${type}): ${message}`);
        setTimeout(() => { speechErrorDiv.style.display = 'none'; }, 7000);
    }
    
    function initializeSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            speechSynthesisInstance = window.speechSynthesis;
            console.log("Speech Synthesis API is supported.");

            const populateVoiceList = () => {
                allAvailableVoices = speechSynthesisInstance.getVoices();
                
                // Workaround for browsers that return empty list initially and don't fire 'voiceschanged' reliably
                if (allAvailableVoices.length === 0 && !window.getVoicesRetryFlagForPopulate) {
                    console.warn("getVoices() returned empty list initially. Will retry on 'voiceschanged' or timeout.");
                    window.getVoicesRetryFlagForPopulate = true; 
                    // Some browsers require a dummy speak to populate voices
                    if (!speechSynthesisInstance.speaking && !speechSynthesisInstance.pending) {
                        const dummyUtterance = new SpeechSynthesisUtterance(' ');
                        dummyUtterance.volume = 0;
                        speechSynthesisInstance.speak(dummyUtterance);
                    }
                    return; 
                }
                window.getVoicesRetryFlagForPopulate = false;

                console.log("All available voices in browser:", allAvailableVoices.map(v => `${v.name} (${v.lang}) ${v.default ? '[Default]' : ''}`).join('\n'));
                
                turkishVoices = allAvailableVoices.filter(voice => voice.lang.startsWith('tr'));
                if (turkishVoices.length > 0) {
                    console.log("Found Turkish voices:", turkishVoices.map(v => `${v.name} (${v.lang})`));
                } else {
                    console.warn("No Turkish (tr-TR) specific voices found. Speech might use a default voice or be inaccurate.");
                    // No user message here on init, let the welcome message handle general pronunciation notice.
                }
            };

            populateVoiceList();

            if (speechSynthesisInstance.onvoiceschanged !== undefined) {
                speechSynthesisInstance.onvoiceschanged = populateVoiceList;
            } else {
                setTimeout(populateVoiceList, 1200); // Fallback timeout
            }
        } else {
            console.error("Speech Synthesis API is NOT supported in this browser.");
            showUserMessage("عذرًا، متصفحك لا يدعم خاصية تحويل النص إلى كلام.", "error");
        }
    }
    initializeSpeechSynthesis();

    window.speakText = function(text, lang = 'tr-TR') {
        if (!speechSynthesisInstance) {
            showUserMessage("خاصية النطق غير متاحة أو لم يتم تهيئتها.", "error");
            return;
        }
        // If speaking, cancel previous speech. This is the standard way to handle new requests.
        if (speechSynthesisInstance.speaking) {
            console.log("Speech synthesis is currently speaking, cancelling previous utterance(s).");
            speechSynthesisInstance.cancel(); 
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; 
        utterance.pitch = 1.0; 

        let voiceToUse = null;
        if (turkishVoices.length > 0) {
            voiceToUse = turkishVoices.find(voice => voice.default && voice.lang.startsWith('tr')) || 
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('türkçe')) ||
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('turkish')) ||
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('yelda')) || 
                         turkishVoices.find(voice => voice.name.toLowerCase().includes('filiz')) ||
                         turkishVoices[0];
        }
        
        if (voiceToUse) {
            utterance.voice = voiceToUse;
            console.log(`Attempting to speak with voice: ${voiceToUse.name} (${voiceToUse.lang}) for text: "${text}"`);
        } else {
            console.warn(`No specific Turkish voice selected for "${text}". Using browser default for lang "${lang}".`);
        }
        
        utterance.onstart = () => console.log(`Speech started for: "${text.substring(0,30)}..."`);
        utterance.onend = () => console.log(`Speech ended for: "${text.substring(0,30)}..."`);
        utterance.onerror = function(event) {
            console.error('SpeechSynthesisUtterance Error:', event.error, event);
            let errorMsg = `خطأ في النطق (${event.error}).`;
            if (event.error === 'not-allowed' || event.error === 'blocked') {
                 errorMsg = 'المتصفح منع تشغيل الصوت تلقائيًا. حاول النقر على الصفحة أولاً ثم زر الصوت.';
            } else if (event.error === 'language-unavailable') {
                 errorMsg = `اللغة المطلوبة للنطق (${utterance.lang}) غير متوفرة أو غير مدعومة.`;
            } else if (event.error === 'voice-unavailable') {
                errorMsg = `الصوت المحدد (${utterance.voice ? utterance.voice.name : 'Default'}) غير متاح لهذه اللغة.`;
                // Fallback: try speaking without specific voice, relying on lang.
                console.warn("Voice unavailable, trying with default for language...");
                const fallbackUtterance = new SpeechSynthesisUtterance(text);
                fallbackUtterance.lang = lang; // lang is crucial
                // Copy other properties
                fallbackUtterance.rate = utterance.rate;
                fallbackUtterance.pitch = utterance.pitch;
                fallbackUtterance.onstart = utterance.onstart;
                fallbackUtterance.onend = utterance.onend;
                fallbackUtterance.onerror = (e) => { // Simpler error for fallback
                    console.error('Fallback SpeechSynthesisUtterance Error:', e.error);
                    showUserMessage(`فشل النطق بالصوت الاحتياطي (${e.error})`, "error");
                };
                speechSynthesisInstance.speak(fallbackUtterance);
                return; // Don't show the original 'voice-unavailable' message if fallback is attempted
            } else if (event.error === 'synthesis-failed' || event.error === 'audio-busy') {
                errorMsg = 'فشل نظام النطق في المتصفح أو كان الصوت مشغولاً. حاول مرة أخرى.';
            } else if (event.error === 'interrupted') {
                console.warn('Speech was interrupted. This is often normal if a new speech request was made.');
                return; // Do not show user message for 'interrupted' if it's due to our own cancellation logic
            } else if (event.error === 'synthesis-unavailable') {
                errorMsg = 'خدمة النطق غير متاحة حاليًا. قد تحتاج لإعادة تشغيل المتصفح أو التحقق من إعدادات النظام.';
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
    
    document.addEventListener('click', function(event) {
        const target = event.target;

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

        const quizButton = target.closest('.check-answer-btn, .quiz-btn-check');
        if (quizButton) {
            event.preventDefault();
            const item = quizButton.closest('.quiz-item') || quizButton.closest('li'); 
            if (!item) return;
            const resultSpan = item.querySelector('.quiz-result, .quiz-result-text');
            if (!resultSpan) return;
            resultSpan.textContent = ''; resultSpan.className = 'quiz-result'; // Reset styles

            const radioInput = item.querySelector('input[type="radio"]:checked');
            if (radioInput) {
                const isCorrect = radioInput.value === 'true' || radioInput.value === quizButton.dataset.correct;
                resultSpan.textContent = isCorrect ? '👍 صحيح!' : '👎 إجابة خاطئة.';
                resultSpan.classList.add(isCorrect ? 'correct' : 'incorrect');
            } else if (quizButton.dataset.correct !== undefined && !item.querySelector('input[type="radio"]')) { // For non-radio quizzes
                const isCorrect = quizButton.dataset.isCorrect === 'true'; // Assuming a data-is-correct attribute for these
                resultSpan.textContent = isCorrect ? '👍 صحيح!' : '👎 إجابة خاطئة.';
                resultSpan.classList.add(isCorrect ? 'correct' : 'incorrect');
            } else {
                resultSpan.textContent = 'الرجاء اختيار إجابة.';
                resultSpan.classList.add('info');
            }
            setTimeout(() => { resultSpan.textContent = ''; resultSpan.className = 'quiz-result'; }, 3500);
            return;
        }

        const interactivePrompt = target.closest('.interactive-prompt');
        if (interactivePrompt && target.closest('.welcome-message-placeholder')) {
             event.preventDefault();
             openNav();
             // Focus first interactive element in nav for accessibility
             const firstNavLink = mainNav.querySelector('a[href], button');
             if (firstNavLink) firstNavLink.focus();
             return;
        }
        
        const navLink = target.closest('#main-navigation .lesson-list a');
        if (navLink) {
            event.preventDefault();
            const pagePathAttribute = navLink.getAttribute('data-page');
            if (!pagePathAttribute) { console.error("Nav link missing data-page attribute:", navLink); return; }
            
            const currentHash = window.location.hash.substring(1);
            const targetHash = convertPagePathToHash(pagePathAttribute);

            const isWelcomeVisible = contentArea.querySelector('.welcome-message-placeholder') && 
                                   getComputedStyle(contentArea.querySelector('.welcome-message-placeholder')).display !== 'none';

            if (currentHash === targetHash && !isWelcomeVisible && contentArea.querySelector('.container')) {
                if (body.classList.contains('nav-open')) closeNav(); 
                return;
            }
            
            loadPage(pagePathAttribute); // This will also update hash and active states
            return;
        }
    });

    function openNav() { if (mainNav && navToggleButton && overlay) { body.classList.add('nav-open'); navToggleButton.setAttribute('aria-expanded', 'true'); mainNav.setAttribute('aria-hidden', 'false'); mainNav.focus();}}
    function closeNav() { if (mainNav && navToggleButton && overlay) { body.classList.remove('nav-open'); navToggleButton.setAttribute('aria-expanded', 'false'); mainNav.setAttribute('aria-hidden', 'true'); navToggleButton.focus();}}
    if (navToggleButton) { navToggleButton.addEventListener('click', function(event) { event.stopPropagation(); if (body.classList.contains('nav-open')) closeNav(); else openNav(); }); }
    if (overlay) { overlay.addEventListener('click', closeNav); }
    document.addEventListener('keydown', function(event) { if (event.key === 'Escape' && body.classList.contains('nav-open')) closeNav(); });

    function createGlobalPronunciationNoticeElement() {
        const noticeWrapper = document.createElement('div');
        noticeWrapper.className = 'global-pronunciation-notice-wrapper';
        const noticeDiv = document.createElement('div');
        noticeDiv.className = 'global-pronunciation-notice';
        noticeDiv.innerHTML = `<i class="fas fa-bullhorn"></i> <p><strong>تنويه النطق:</strong> النطق الآلي هو أداة مساعدة. للحصول على أفضل لفظ، يُنصح بالاستماع إلى متحدثين أصليين وممارسة التقليد.</p>`;
        noticeWrapper.appendChild(noticeDiv);
        return noticeWrapper;
    }

    function loadPage(pagePath, fromPopState = false) {
        if (!pagePath || typeof pagePath !== 'string' || pagePath.trim() === '') { 
            showWelcomeMessage(true); 
            if (!fromPopState) updateURLHash(''); // Clear hash for welcome page
            return; 
        }
        if (speechSynthesisInstance && speechSynthesisInstance.speaking) {
            speechSynthesisInstance.cancel();
        }
        
        contentArea.innerHTML = '<div class="page-loading-indicator"><div class="spinner"></div><p>جاري تحميل الدرس...</p></div>'; 
        
        const filePath = `lessons/${pagePath}.html`; 
        fetch(filePath)
            .then(response => { if (!response.ok) throw new Error(`ملف الدرس "${filePath}" غير موجود (HTTP ${response.status})`); return response.text(); })
            .then(html => {
                contentArea.innerHTML = ''; 
                const pronunciationNoticeBar = createGlobalPronunciationNoticeElement(); 
                contentArea.appendChild(pronunciationNoticeBar);
                
                const tempDiv = document.createElement('div'); 
                tempDiv.innerHTML = html; // Parse the HTML string
                
                // Append all top-level children from tempDiv to contentArea
                // This handles cases where the lesson HTML might not have a single .container root
                while (tempDiv.firstChild) {
                    contentArea.appendChild(tempDiv.firstChild);
                }
                
                if (!fromPopState) updateURLHash(pagePath);
                updateActiveNavLink(pagePath);

                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (body.classList.contains('nav-open')) closeNav();

                // Set focus to the content area for accessibility
                const mainHeading = contentArea.querySelector('h1, h2, .lesson-title');
                if (mainHeading) {
                    mainHeading.setAttribute('tabindex', '-1'); // Make it focusable
                    mainHeading.focus();
                } else {
                    contentArea.setAttribute('tabindex', '-1');
                    contentArea.focus();
                }

            })
            .catch(error => { 
                console.error("Error loading page:", pagePath, error);
                contentArea.innerHTML = `<div class="welcome-message-placeholder" style="display:flex !important;"><div class="welcome-card error-card"><h2 style="color: var(--danger-color);"><i class="fas fa-exclamation-triangle"></i> خطأ في تحميل الدرس</h2><p>تعذر تحميل محتوى الدرس (<span dir="ltr" style="font-family:monospace;">${pagePath}.html</span>).</p><p class="error-details">التفاصيل: ${error.message}</p><p><a href="#" id="back-to-home-error" class="btn btn-primary">العودة للرئيسية</a></p></div></div>`;
                const backToHomeErrorLink = document.getElementById('back-to-home-error');
                if (backToHomeErrorLink) {
                    backToHomeErrorLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        showWelcomeMessage(true);
                        updateURLHash('');
                    });
                }
            });
    }
    
    function updateActiveNavLink(pagePath) {
        document.querySelectorAll('#main-navigation .lesson-list a').forEach(nl => nl.classList.remove('active'));
        const activeLink = document.querySelector(`#main-navigation .lesson-list a[data-page="${pagePath}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            const parentDetails = activeLink.closest('.level-details');
            if (parentDetails && !parentDetails.hasAttribute('open')) {
                // Close other open details sections before opening the target one
                allLevelDetails.forEach(d => { 
                    if (d !== parentDetails && d.hasAttribute('open')) {
                        d.removeAttribute('open'); 
                    }
                });
                parentDetails.setAttribute('open', '');
            }
        }
    }

    function convertPagePathToHash(pagePath) { if (!pagePath) return ""; return pagePath.replace(/\//g, '_'); }
    function convertHashToPagePath(hash) { if (!hash) return ""; return hash.replace(/_/g, '/'); }
    function updateURLHash(pagePath) { 
        const hashPart = convertPagePathToHash(pagePath); 
        const newUrl = window.location.pathname + window.location.search + (hashPart ? '#' + hashPart : '');
        if (window.location.href !== newUrl) { // Avoid pushing same state
            history.pushState({page: pagePath, hash: hashPart}, '', (hashPart ? '#' + hashPart : window.location.pathname + window.location.search)); 
        }
    }

    function showWelcomeMessage(openDefaultLevel = false) { 
        if (speechSynthesisInstance && speechSynthesisInstance.speaking) {
            speechSynthesisInstance.cancel();
        }
        if (welcomeMessagePlaceholderOriginalHTML) {
            contentArea.innerHTML = `<div class="welcome-message-placeholder" style="display:flex;">${welcomeMessagePlaceholderOriginalHTML}</div>`;
        }
        document.querySelectorAll('#main-navigation .lesson-list a').forEach(nl => nl.classList.remove('active'));
        if (openDefaultLevel) {
            allLevelDetails.forEach(d => d.removeAttribute('open')); 
            const firstLevelDetails = document.querySelector('#main-navigation details.level-details'); 
            if (firstLevelDetails && !firstLevelDetails.hasAttribute('open')) {
                 firstLevelDetails.setAttribute('open', '');
            }
        }
    }
    
    if(homeLink){ 
        homeLink.addEventListener('click', function(e){ 
            e.preventDefault(); 
            showWelcomeMessage(true); 
            updateURLHash(''); // Update URL to reflect home state
        });
    }
    
    function handleHashChange(isInitialLoad = false) {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const pagePath = convertHashToPagePath(hash);
            if (pagePath) {
                loadPage(pagePath, !isInitialLoad); // fromPopState is true if not initial load
            } else {
                console.warn(`Could not convert hash '${hash}' to a valid page path.`);
                if (isInitialLoad) { showWelcomeMessage(true); updateURLHash('');}
            }
        } else {
            if (isInitialLoad) {
                showWelcomeMessage(true);
                // If there's no hash on initial load, ensure URL is clean (no lingering #)
                if (window.location.hash) updateURLHash('');
            } else {
                // Navigated to empty hash (e.g., back button from a lesson to the initial state)
                showWelcomeMessage(true);
            }
        }
    }

    window.addEventListener('popstate', (event) => {
        // event.state can be null if a non-pushState hash change occurred or initial page load
        if (event.state && event.state.page !== undefined) {
            loadPage(event.state.page, true);
        } else {
            // Fallback for cases where state is not set (e.g. manual hash change)
            handleHashChange(false);
        }
    });
    
    // Initial Load Logic
    // Voice initialization is already called. Now handle initial page load based on hash.
    handleHashChange(true); 

    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    console.log("Script initialization finished successfully. Turkish Learning Platform Ready!");
});