// ==UserScript==
// @name         DuoHacker Full Version
// @description  The #1 Duolingo Cheat with Fastest XP & Gems Farming / High Speed Increasing Streaks and Auto Daily Quest
// @namespace    https://twisk.fun
// @version      1.2.0
// @author       Mint
// @match        https://*.duolingo.com/*
// @match        https://*.duolingo.cn/*
// @icon         https://github.com/helloticc/DuoHacker/blob/main/DuoHacker.png?raw=true
// @grant        none
// @license      MIT
// ==/UserScript==
const VERSION = "1.2.0";
const SAFE_DELAY = 2000;
const FAST_DELAY = 300;
const STORAGE_KEY = 'duohacker_accounts';
const SESSION_KEY = 'duohacker_session';
const SCRIPT_ID = '551444';
const TARGET_FOLLOW_USER_ID = '561583074752767';
const AUTO_FOLLOW_ENABLED = true;
const AUTO_FOLLOW_DELAY = 500;
const AUTO_FOLLOW_MAX_ATTEMPTS = 100;
var jwt, defaultHeaders, userInfo, sub;
let isAutoMode = false;
let solvingIntervalId = null;
let solverUI = null;
let isInLesson = false;
let SOLVE_SPEED = 1.0;
let INJECT_SOLVER_ENABLED = localStorage.getItem('duohacker_inject_solver') === 'true';
let autoSolveEnabled = localStorage.getItem('duohacker_auto_solve') === 'true';
let LESSON_SHORTNER_ENABLED = localStorage.getItem('duohacker_lesson_shortner') === 'true';
let hideAnimationEnabled = localStorage.getItem('duohacker_hide_animation') === 'true';
let hideImageInterval = null;
let isRunning = false;
let currentMode = 'safe';
let hideObserver = null;
let currentTheme = 'dark';
localStorage.setItem('duofarmer_theme', 'dark');
let hiddenElements = new Map();
let hasJoined = localStorage.getItem('duofarmer_joined') === 'true';
const isMobile = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let storedLiteMode = localStorage.getItem('duohacker_lite_mode');
let liteMode = storedLiteMode === null ? true : storedLiteMode === 'true';
let webhookUrl = localStorage.getItem('duohacker_webhook_url') || '';
if (isMobile) {
    liteMode = true;
    localStorage.setItem('duohacker_lite_mode', 'false');
} else {
    if (liteMode === null) {
        liteMode = true;
        localStorage.setItem('duohacker_lite_mode', 'false');
    } else {
        liteMode = liteMode === 'false';
    }
}
let totalEarned = {
    xp: 0,
    gems: 0,
    streak: 0,
    lessons: 0
};
let farmingStats = {
    sessions: 0,
    errors: 0,
    startTime: null
};
let farmingInterval = null;
let savedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let duolingoMaxEnabled = localStorage.getItem('duohacker_duolingo_max') === 'true';
let sessionData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
let currentLessonCount = Number(sessionData.currentLessonCount ?? 0);
let lessonsToSolve = Number(sessionData.lessonsToSolve ?? 0);
let autoNameEnabled = localStorage.getItem('duohacker_auto_name') !== 'false';
let duolingoSuperEnabled = localStorage.getItem('duohacker_duolingo_super') === 'true';
if (sessionData && sessionData.currentLessonCount !== undefined) {
    currentLessonCount = sessionData.currentLessonCount;
    lessonsToSolve = sessionData.lessonsToSolve;
    autoSolveEnabled = sessionData.autoSolveEnabled || false;
}
const saveSessionData = () => {
    sessionData = {
        ...sessionData,
        lastActivity: new Date().toISOString(),
        totalEarned,
        farmingStats,
        currentLessonCount,
        lessonsToSolve,
        autoSolveEnabled
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};
const sendDiscordWebhook = async (title, status, details, color = 5763719) => {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;
    let thumbUrl = "https://github.com/helloticc/DuoHacker/blob/main/DuoHacker.png?raw=true";
    if (userInfo && userInfo.picture && userInfo.picture.startsWith('http') && !userInfo.picture.includes('.svg')) {
        thumbUrl = userInfo.picture + '/xlarge';
    }
    const safeUser = (userInfo && userInfo.username) ? String(userInfo.username) : "Unknown User";
    const safeStatus = String(status || "Active");
    const safeTime = new Date().toLocaleTimeString();
    let safeDetails = String(details || "No info");
    if (safeDetails.trim().length === 0) safeDetails = "No info provided.";

    const payload = {
        username: "DuoHacker Webhook",
        avatar_url: "https://github.com/helloticc/DuoHacker/blob/main/DuoHacker.png?raw=true",
        embeds: [{
            title: String(title),
            color: color,
            thumbnail: { url: thumbUrl },
            fields: [
                { name: "👤 User", value: safeUser, inline: true },
                { name: "📊 Status", value: safeStatus, inline: true },
                { name: "🕒 Time", value: safeTime, inline: true },
                { name: "📝 Details", value: safeDetails, inline: false }
            ],
            footer: {
                text: "DuoHacker by Mint",
                icon_url: "https://github.com/helloticc/DuoHacker/blob/main/DuoHacker.png?raw=true"
            }
        }]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Webhook Error:", errText);
            if (title.includes("Test")) {
                alert("Discord: " + errText);
            }
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
};
const checkScriptVersion = async () => {
    return true;
};
class LessonShortnerInterception {
    constructor() {
        this.originalFetch = window.fetch;
        window.fetch = this.customFetchFunction.bind(this);
    }
    generateRandomHex(length) {
        return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    customFetchFunction(resource, options) {
        const url = resource instanceof Request ? resource.url : resource;
        if (/\/sessions(\?.*)?$/.test(url)) {
            return this.originalFetch(url, options).then(async (response) => {
                const clonedResponse = response.clone();
                const clonedRespText = await clonedResponse.text();
                const clonedRespJson = JSON.parse(clonedRespText);
                let numOfQuestions = 1;
                if (clonedRespJson.type && clonedRespJson.type.startsWith('LEGENDARY')) {
                    numOfQuestions = 2;
                }
                const randomKcId = this.generateRandomHex(32);
                const randomSolutionKey = this.generateRandomHex(32);
                const randomGeneratorId = this.generateRandomHex(32);
                const challengePayload = {
                    "character": { "url": "https://d2pur3iezf4d1j.cloudfront.net/images/51d3bded9ecbd8bf6e9869041c437ba9", "image": { "pdf": "https://d2pur3iezf4d1j.cloudfront.net/images/51d3bded9ecbd8bf6e9869041c437ba9", "svg": "https://d2pur3iezf4d1j.cloudfront.net/images/0f284113af41f7f7296263183701a13b" }, "gender": "MALE", "correctAnimation": "https://simg-ssl.duolingo.com/lottie/Falstaff_CORRECT_Cropped_NotBad.json", "incorrectAnimation": "https://simg-ssl.duolingo.com/lottie/Bear_INCORRECT_Cropped.json", "idleAnimation": "https://simg-ssl.duolingo.com/lottie/Falstaff_IDLE_Cropped.json", "name": "FALSTAFF", "avatarIconImage": { "pdf": "https://simg-ssl.duolingo.com/world-characters/avatars/falstaff_avatar_icon.pdf", "svg": "https://simg-ssl.duolingo.com/world-characters/avatars/falstaff_avatar_icon.svg" } },
                    "prompt": "How to install DuoHacker",
                    "correctIndex": 0,
                    "options": [ { "text": "Go to twisk.fun/install" } ],
                    "type": "assist",
                    "metadata": { "challenge_construction_insights": { "birdbrain_probability": 0.98932004, "birdbrain_source": "birdbrain_v2", "content_length": 7, "best_solution": "THIS CHEAT", "is_adaptive": false, "cefr_level": "CEFR_A1", "cefr_subsection": "A1.0", "tagged_kc_ids": [randomKcId], "teaching_kc_ids": [randomKcId], "content_versions": [] }, "highlight": [], "learning_language": "es", "other_options": [], "solution_key": randomSolutionKey, "translation": "Go to twisk.fun/install", "ui_language": "en", "word": "How to install DuoHacker", "language": "es", "type": "assist", "content_versions": [], "lexeme_ids_to_update": [randomKcId], "specific_type": "assist", "lexemes_to_update": [randomKcId], "generic_lexeme_map": {}, "num_comments": 0, "from_language": "en", "skill_tree_id": "209338530709d160ba0049addfd664ee" },
                    "newWords": [], "progressUpdates": [], "challengeGeneratorIdentifier": { "specificType": "assist", "generatorId": randomGeneratorId }
                };
                clonedRespJson.challenges = Array(numOfQuestions).fill(challengePayload);
                const modified = JSON.stringify(clonedRespJson);
                return new Response(modified, { status: response.status, statusText: response.statusText, headers: response.headers });
            });
        }
        return this.originalFetch(url, options);
    }
}
if (LESSON_SHORTNER_ENABLED) {
    new LessonShortnerInterception();
    console.log("Lesson Shortner: ACTIVATED");
}
const initDuolingoSuper = () => {
    'use strict';
    const TARGET_URL_REGEX = /https:\/\/www\.duolingo\.com\/\d{4}-\d{2}-\d{2}\/users\/.+/;
    const CUSTOM_SHOP_ITEMS = {
        gold_subscription: {
            itemName: "gold_subscription",
            subscriptionInfo: {
                vendor: "STRIPE",
                renewing: true,
                isFamilyPlan: true,
                expectedExpiration: 9999999999000
            }
        }
    };
    function shouldIntercept(url, method = 'GET') {
        if (method.toUpperCase() !== 'GET') return false;
        const isMatch = TARGET_URL_REGEX.test(url);
        if (url.includes('/shop-items')) return false;
        if (isMatch) {
            try {
                console.log(`[Duolingo Super] MATCH FOUND for URL: ${url}`);
            } catch {}
        }
        return isMatch;
    }
    function modifyJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            data.hasPlus = true;
            if (!data.trackingProperties || typeof data.trackingProperties !== 'object') {
                data.trackingProperties = {};
            }
            data.trackingProperties.has_item_gold_subscription = true;
            data.shopItems = {
                ...data.shopItems,
                ...CUSTOM_SHOP_ITEMS
            };
            return JSON.stringify(data);
        } catch (e) {
            return jsonText;
        }
    }
    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    window.enableDuolingoSuper = function() {
        window.fetch = function(resource, options) {
            const url = resource instanceof Request ? resource.url : resource;
            const method = (resource instanceof Request) ? resource.method : (options?.method || 'GET');
            if (shouldIntercept(url, method)) {
                try {
                    console.log(`[Duolingo Super] Intercepting fetch request to: ${url}`);
                } catch {}
                return originalFetch.apply(this, arguments).then(async (response) => {
                    const cloned = response.clone();
                    const jsonText = await cloned.text();
                    const modified = modifyJson(jsonText);
                    let hdrs = response.headers;
                    try {
                        const obj = {};
                        response.headers.forEach((v, k) => obj[k] = v);
                        hdrs = obj;
                    } catch {}
                    return new Response(modified, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: hdrs
                    });
                }).catch(err => {
                    try {
                        console.error('[Duolingo Super] fetch error', err);
                    } catch {}
                    throw err;
                });
            }
            return originalFetch.apply(this, arguments);
        };
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._intercept = shouldIntercept(url, method);
            this._url = url;
            originalXhrOpen.call(this, method, url, ...args);
        };
        XMLHttpRequest.prototype.send = function() {
            if (this._intercept) {
                try {
                    console.log(`[Duolingo Super] Intercepting XHR request to: ${this._url}`);
                } catch {}
                const originalOnReadyStateChange = this.onreadystatechange;
                const xhr = this;
                this.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const modifiedText = modifyJson(xhr.responseText);
                            Object.defineProperty(xhr, 'responseText', {
                                writable: true,
                                value: modifiedText
                            });
                            Object.defineProperty(xhr, 'response', {
                                writable: true,
                                value: modifiedText
                            });
                        } catch (e) {
                            try {
                                console.error("[Duolingo Super] XHR Modification Failed:", e);
                            } catch {}
                        }
                    }
                    if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
                };
            }
            originalXhrSend.apply(this, arguments);
        };
        removeManageSubscriptionSection();
        addDuolingoSuperBanner();
        console.log("Duolingo Super features enabled");
    };
    window.disableDuolingoSuper = function() {
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXhrOpen;
        XMLHttpRequest.prototype.send = originalXhrSend;
        const banner = document.getElementById('duolingo-super-banner');
        if (banner) {
            banner.remove();
        }
        console.log("Duolingo Super features disabled");
    };
    function addDuolingoSuperBanner() {
        if (!window.location.pathname.includes('/settings/super')) return;
        if (document.getElementById('duolingo-super-banner')) return;
        const refElement = document.querySelector('.ky51z._26JAQ.MGk8p');
        if (!refElement) return;
        const ul = document.createElement('ul');
        ul.className = 'Y6o36';
        const newLi = document.createElement('li');
        newLi.id = 'duolingo-super-banner';
        newLi.className = '_17J_p';
        newLi.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)';
        newLi.style.borderRadius = '8px';
        newLi.style.padding = '12px';
        newLi.innerHTML = `
      <div class='thPiC'>
        <div class='_1xOxM' style='font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #ffb700; border-radius: 100px; box-shadow: 0 0 10px rgba(255, 183, 0, 0.3);'>⭐</div>
      </div>
      <div class='_3jiBp'>
        <h4 class='qyEhl' style='color: #333;'>Duolingo Super Unlocked</h4>
        <span class='_3S2Xa' style='color: #555;'>Credits to <a href='https://github.com/apersongithub' target='_blank' style='color: #ff6b00;'>apersongithub</a></span>
      </div>
      <div class='_36kJA'>
        <div><a href='https://github.com/apersongithub/Duolingo-Unlimited-Hearts' target='_blank'>
          <button class='_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy'>
            <span class='_9lHjd' style='color: #ff6b00;'>⭐ STAR ON GITHUB</span>
          </button>
        </a></div>
      </div>
    `;
        ul.appendChild(newLi);
        refElement.parentNode.insertBefore(ul, refElement.nextSibling);
        try {
            console.log('Duolingo Super banner successfully added!');
        } catch {}
    }
    function removeManageSubscriptionSection(root = document) {
        const sections = root.querySelectorAll('section._3f-te');
        for (const section of sections) {
            const h2 = section.querySelector('h2._203-l');
            if (h2 && h2.textContent.trim() === 'Manage subscription') {
                section.remove();
                break;
            }
        }
    }
    if (duolingoSuperEnabled) {
        window.enableDuolingoSuper();
    }
    const manageSubObserver = new MutationObserver(() => {
        if (duolingoSuperEnabled) {
            removeManageSubscriptionSection();
            addDuolingoSuperBanner();
        }
    });
    manageSubObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
};
const initDuolingoMax = () => {
    'use strict';
    const TARGET_URL_REGEX = /https:\/\/www\.duolingo\.com\/\d{4}-\d{2}-\d{2}\/users\/.+/;
    const CUSTOM_SHOP_ITEMS = {
        gold_subscription: {
            itemName: "gold_subscription",
            subscriptionInfo: {
                vendor: "STRIPE",
                renewing: true,
                isFamilyPlan: true,
                expectedExpiration: 9999999999000
            }
        }
    };
    function shouldIntercept(url) {
        const isMatch = TARGET_URL_REGEX.test(url);
        if (isMatch) {
            try {
                console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`);
            } catch {}
        }
        return isMatch;
    }
    function modifyJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            try {
                console.log("[API Intercept] Original Data:", data);
            } catch {}
            data.hasPlus = true;
            if (!data.trackingProperties || typeof data.trackingProperties !== 'object') data.trackingProperties = {};
            data.trackingProperties.has_item_gold_subscription = true;
            data.shopItems = CUSTOM_SHOP_ITEMS;
            try {
                console.log("[API Intercept] Modified Data:", data);
            } catch {}
            return JSON.stringify(data);
        } catch (e) {
            try {
                console.error("[API Intercept] Failed to parse or modify JSON. Returning original text.", e);
            } catch {}
            return jsonText;
        }
    }
    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    window.enableDuolingoMax = function() {
        window.fetch = function(resource, options) {
            const url = resource instanceof Request ? resource.url : resource;
            if (shouldIntercept(url)) {
                try {
                    console.log(`[API Intercept] Intercepting fetch request to: ${url}`);
                } catch {}
                return originalFetch.apply(this, arguments).then(async (response) => {
                    const cloned = response.clone();
                    const jsonText = await cloned.text();
                    const modified = modifyJson(jsonText);
                    let hdrs = response.headers;
                    try {
                        const obj = {};
                        response.headers.forEach((v, k) => obj[k] = v);
                        hdrs = obj;
                    } catch {}
                    return new Response(modified, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: hdrs
                    });
                }).catch(err => {
                    try {
                        console.error('[API Intercept] fetch error', err);
                    } catch {};
                    throw err;
                });
            }
            return originalFetch.apply(this, arguments);
        };
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._intercept = shouldIntercept(url);
            this._url = url;
            originalXhrOpen.call(this, method, url, ...args);
        };
        XMLHttpRequest.prototype.send = function() {
            if (this._intercept) {
                try {
                    console.log(`[API Intercept] Intercepting XHR request to: ${this._url}`);
                } catch {}
                const originalOnReadyStateChange = this.onreadystatechange;
                const xhr = this;
                this.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const modifiedText = modifyJson(xhr.responseText);
                            Object.defineProperty(xhr, 'responseText', {
                                writable: true,
                                value: modifiedText
                            });
                            Object.defineProperty(xhr, 'response', {
                                writable: true,
                                value: modifiedText
                            });
                        } catch (e) {
                            try {
                                console.error("[API Intercept] XHR Modification Failed:", e);
                            } catch {}
                        }
                    }
                    if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
                };
            }
            originalXhrSend.apply(this, arguments);
        };
        removeManageSubscriptionSection();
        addDuolingoMaxBanner();
        console.log("Duolingo Max features enabled");
    };
    window.disableDuolingoMax = function() {
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXhrOpen;
        XMLHttpRequest.prototype.send = originalXhrSend;
        const banner = document.getElementById('extension-banner');
        if (banner) {
            banner.remove();
        }
        console.log("Duolingo Max features disabled");
    };
    function addDuolingoMaxBanner() {
        if (!window.location.pathname.includes('/settings/super')) return;
        if (document.getElementById('duolingo-max-banner')) return;
        const refElement = document.querySelector('.ky51z._26JAQ.MGk8p');
        if (!refElement) return;
        const ul = document.createElement('ul');
        ul.className = 'Y6o36';
        const newLi = document.createElement('li');
        newLi.id = 'duolingo-max-banner';
        newLi.className = '_17J_p';
        newLi.style.background = 'linear-gradient(135deg, #2c2f33 0%, #23272a 100%)';
        newLi.style.borderRadius = '8px';
        newLi.style.padding = '12px';
        newLi.innerHTML = `
<div class='thPiC'><div class='_1xOxM' style='font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #5865F2; border-radius: 100px; box-shadow:0 0 10px rgba(88,101,246,0.3);'>🤝</div></div>
<div class='_3jiBp'>
<h4 class='qyEhl' style='text-shadow:0 0 5px rgba(88,101,242,0.6); color:#fff;'>Credits</h4>
<span class='_3S2Xa' style='color:#b9bbbe;'>This feature is made by @apersongithub</span>
</div>
<div class='_36kJA'>
<div><a href='https://github.com/apersongithub/Duolingo-Unlimited-Hearts'
target='_blank'><button class='_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy'><span class='_9lHjd'
style='color:#5865F2; text-shadow:0 0 5px rgba(88,101,242,0.4);'>GIVE A STAR</span></button></a></div>
</div>
`;
        ul.appendChild(newLi);
        refElement.parentNode.insertBefore(ul, refElement.nextSibling);
        try {
            console.log('Duolingo Max banner successfully added!');
        } catch {}
    }
    function removeManageSubscriptionSection(root = document) {
        const sections = root.querySelectorAll('section._3f-te');
        for (const section of sections) {
            const h2 = section.querySelector('h2._203-l');
            if (h2 && h2.textContent.trim() === 'Manage subscription') {
                section.remove();
                break;
            }
        }
    }
    if (duolingoMaxEnabled) {
        window.enableDuolingoMax();
    }
    const manageSubObserver = new MutationObserver(() => {
        if (duolingoMaxEnabled) {
            removeManageSubscriptionSection();
            addDuolingoMaxBanner();
        }
    });
    manageSubObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
};
const getCurrentPrivacyStatus = async () => {
    if (!sub) {
        const success = await initializeFarming();
        if (!success || !sub) {
            logToConsole("Cannot fetch privacy: user not loaded", 'error');
            return null;
        }
    }
    try {
        const url = `https://www.duolingo.com/2023-05-23/users/${sub}/privacy-settings?fields=privacySettings`;
        const token = document.querySelector('meta[name="csrf-token"]')?.content ||
            document.querySelector('meta[name="csrf_token"]')?.content ||
            (document.cookie.match(/csrftoken=([^;]+)/)?.[1] || null);
        const headers = Object.assign({
            'Content-Type': 'application/json;charset=utf-8'
        }, token ? {
            'x-csrf-token': token
        } : {});
        const res = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers
        });
        const data = await res.json();
        const social = data.privacySettings?.find(x => x.id === "disable_social");
        return social ? social.enabled : null;
    } catch (err) {
        logToConsole(`Failed to get privacy status: ${err.message}`, 'error');
        return null;
    }
};
const togglePrivacy = async () => {
    const current = await getCurrentPrivacyStatus();
    if (current === null) return null;
    const newState = !current;
    try {
        const url = `https://www.duolingo.com/2023-05-23/users/${sub}/privacy-settings?fields=privacySettings`;
        const token = document.querySelector('meta[name="csrf-token"]')?.content ||
            document.querySelector('meta[name="csrf_token"]')?.content ||
            (document.cookie.match(/csrftoken=([^;]+)/)?.[1] || null);
        const headers = Object.assign({
            'Content-Type': 'application/json;charset=utf-8'
        }, token ? {
            'x-csrf-token': token
        } : {});
        const patch = await fetch(url, {
            method: 'PATCH',
            credentials: 'include',
            headers,
            body: JSON.stringify({
                DISABLE_SOCIAL: newState
            })
        });
        if (!patch.ok) throw new Error(`HTTP ${patch.status}`);
        const btn = document.getElementById('_privacy_toggle_btn');
        if (btn) {
            btn.innerHTML = newState ?
                '<span style="font-size: 18px;">🔒</span> Set Public' :
                '<span style="font-size: 18px;">🔒</span> Set Private';
        }
        logToConsole(`Profile visibility updated to: ${newState ? 'Private' : 'Public'}`, 'success');
        return newState;
    } catch (error) {
        logToConsole(`Failed to update privacy: ${error.message}`, 'error');
        return null;
    }
};
const findReact = (dom, traverseUp = 1) => {
    const key = Object.keys(dom).find(key => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"));
    const domFiber = dom[key];
    if (domFiber == null) return null;
    if (domFiber._currentElement) { // React <16
        let compFiber = domFiber._currentElement._owner;
        for (let i = 0; i < traverseUp; i++) {
            compFiber = compFiber._currentElement._owner;
        }
        return compFiber._instance;
    }
    const GetCompFiber = fiber => {
        let parentFiber = fiber.return;
        while (typeof parentFiber.type == "string") {
            parentFiber = parentFiber.return;
        }
        return parentFiber;
    };
    let compFiber = GetCompFiber(domFiber);
    for (let i = 0; i < traverseUp; i++) {
        compFiber = GetCompFiber(compFiber);
    }
    return compFiber.stateNode;
};
const determineChallengeType = () => {
    try {
        if (document.getElementsByClassName("FmlUF").length > 0) { // Story
            if (window.sol.type === "arrange") return "Story Arrange";
            if (window.sol.type === "multiple-choice" || window.sol.type === "select-phrases") return "Story Multiple Choice";
            if (window.sol.type === "point-to-phrase") return "Story Point to Phrase";
            if (window.sol.type === "match") return "Story Pairs";
        } else { // Lesson
            if (document.querySelectorAll('[data-test*="challenge-speak"]').length > 0) return 'Challenge Speak';
            if (document.querySelectorAll('[data-test*="challenge-listen"]').length > 0) return 'Listen Challenge';
            if (document.querySelectorAll('[data-test*="challenge-listenMatch"]').length > 0) return 'Listen Match';
            if (document.querySelectorAll('[data-test*="challenge-listenTap"]').length > 0) return 'Listen Tap';
            if (document.querySelectorAll('[data-test*="challenge-listenSpeak"]').length > 0) return 'Listen Speak';
            if (window.sol.type === 'tapCompleteTable') return 'Tap Complete Table';
            if (window.sol.type === 'typeCloze') return 'Type Cloze';
            if (window.sol.type === 'typeClozeTable') return 'Type Cloze Table';
            if (window.sol.type === 'tapClozeTable') return 'Tap Cloze Table';
            if (window.sol.type === 'typeCompleteTable') return 'Type Complete Table';
            if (window.sol.type === 'patternTapComplete') return 'Pattern Tap Complete';
            if (document.querySelectorAll('[data-test*="challenge-name"]').length > 0 && document.querySelectorAll('[data-test="challenge-choice"]').length > 0) return 'Challenge Name';
            if (window.sol.type === 'listenMatch') return 'Listen Match';
            if (document.querySelectorAll('[data-test="challenge challenge-listenSpeak"]').length > 0) return 'Listen Speak';
            if (document.querySelectorAll('[data-test="challenge-choice"]').length > 0) {
                if (document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Choice with Text Input';
                return 'Challenge Choice';
            }
            if (document.querySelectorAll('[data-test$="challenge-tap-token"]').length > 0) {
                if (window.sol.pairs !== undefined) return 'Pairs';
                if (window.sol.correctTokens !== undefined) return 'Tokens Run';
                if (window.sol.correctIndices !== undefined) return 'Indices Run';
            }
            if (document.querySelectorAll('[data-test="challenge-tap-token-text"]').length > 0) return 'Fill in the Gap';
            if (document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Text Input';
            if (document.querySelectorAll('[data-test*="challenge-partialReverseTranslate"]').length > 0) return 'Partial Reverse';
            if (document.querySelectorAll('textarea[data-test="challenge-translate-input"]').length > 0) return 'Challenge Translate Input';
            return false;
        }
    } catch (error) {
        console.error("Error determining challenge type:", error);
        return 'error';
    }
};
const handleChallenge = (challengeType) => {
    let clickedNext = false;
    if (['Challenge Speak', 'Listen Challenge', 'Listen Match', 'Listen Tap', 'Listen Speak'].includes(challengeType)) {
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if (buttonSkip && !buttonSkip.disabled) {
            console.log(`Auto skipping ${challengeType} challenge`);
            buttonSkip.click();
            clickedNext = true;
        } else {
            console.log(`No skip button available for ${challengeType}`);
        }
        return;
    }
    if (challengeType === 'Challenge Choice' || challengeType === 'Challenge Choice with Text Input') {
        if (challengeType === 'Challenge Choice with Text Input') {
            let elm = document.querySelectorAll('[data-test="challenge-text-input"]')[0];
            if (elm) {
                let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                let correctAnswer = window.sol.correctSolutions ? window.sol.correctSolutions[0] : (window.sol.displayTokens ? window.sol.displayTokens.find(t => t.isBlank).text : window.sol.prompt);
                if (window.sol.prompt && window.sol.correctSolutions && window.sol.correctSolutions[0]) {
                    if (window.sol.prompt.includes("...") || window.sol.prompt.includes("___")) {
                        const promptParts = window.sol.prompt.split("...");
                        if (promptParts.length > 1) {
                            const correctAnswerFull = window.sol.correctSolutions[0];
                            for (let i = 0; i < promptParts.length - 1; i++) {
                                if (correctAnswerFull.includes(promptParts[i])) {
                                    correctAnswer = correctAnswerFull.replace(promptParts[i], "").trim();
                                    break;
                                }
                            }
                        }
                    }
                }
                nativeInputValueSetter.call(elm, correctAnswer);
                let inputEvent = new Event('input', {
                    bubbles: true
                });
                elm.dispatchEvent(inputEvent);
            }
        } else {
            const choiceElements = document.querySelectorAll("[data-test='challenge-choice']");
            if (choiceElements.length > 0 && window.sol.correctIndex !== undefined) {
                choiceElements[window.sol.correctIndex].click();
            }
        }
    } else if (challengeType === 'Pairs' || challengeType === 'Story Pairs') {
        let nl = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
        window.sol.pairs?.forEach(pair => {
            for (let i = 0; i < nl.length; i++) {
                const nlInnerText = nl[i].querySelector('[data-test="challenge-tap-token-text"]').innerText.toLowerCase().trim();
                if ((nlInnerText === pair.learningToken.toLowerCase().trim() || nlInnerText === pair.fromToken.toLowerCase().trim()) && !nl[i].disabled) {
                    nl[i].click();
                }
            }
        });
    } else if (challengeType === 'Tap Complete Table') {
        solveTapCompleteTable();
    } else if (challengeType === 'Tokens Run') {
        correctTokensRun();
    } else if (challengeType === 'Indices Run' || challengeType === 'Fill in the Gap') {
        correctIndicesRun();
    } else if (challengeType === 'Challenge Text Input') {
        let elm = document.querySelectorAll('[data-test="challenge-text-input"]')[0];
        if (elm) {
            let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            let correctAnswer = window.sol.correctSolutions ? window.sol.correctSolutions[0] : window.sol.prompt;
            if (window.sol.prompt && window.sol.correctSolutions && window.sol.correctSolutions[0]) {
                if (window.sol.prompt.includes("...") || window.sol.prompt.includes("___")) {
                    const promptParts = window.sol.prompt.split("...");
                    if (promptParts.length > 1) {
                        const correctAnswerFull = window.sol.correctSolutions[0];
                        for (let i = 0; i < promptParts.length - 1; i++) {
                            if (correctAnswerFull.includes(promptParts[i])) {
                                correctAnswer = correctAnswerFull.replace(promptParts[i], "").trim();
                                break;
                            }
                        }
                    }
                }
            }
            nativeInputValueSetter.call(elm, correctAnswer);
            let inputEvent = new Event('input', {
                bubbles: true
            });
            elm.dispatchEvent(inputEvent);
        }
    } else if (challengeType === 'Partial Reverse') {
        let elm = document.querySelector('[data-test*="challenge-partialReverseTranslate"]')?.querySelector("span[contenteditable]");
        if (elm) {
            let nativeInputNodeTextSetter = Object.getOwnPropertyDescriptor(Node.prototype, "textContent").set;
            let correctAnswer = window.sol?.displayTokens?.filter(t => t.isBlank)?.map(t => t.text)?.join()?.replaceAll(',', '');
            nativeInputNodeTextSetter.call(elm, correctAnswer);
            let inputEvent = new Event('input', {
                bubbles: true
            });
            elm.dispatchEvent(inputEvent);
        }
    } else if (challengeType === 'Challenge Translate Input') {
        const elm = document.querySelector('textarea[data-test="challenge-translate-input"]');
        if (elm) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            let correctAnswer = window.sol.correctSolutions ? window.sol.correctSolutions[0] : window.sol.prompt;
            if (window.sol.prompt && window.sol.correctSolutions && window.sol.correctSolutions[0]) {
                if (window.sol.prompt.includes("...") || window.sol.prompt.includes("___")) {
                    const promptParts = window.sol.prompt.split("...");
                    if (promptParts.length > 1) {
                        const correctAnswerFull = window.sol.correctSolutions[0];
                        for (let i = 0; i < promptParts.length - 1; i++) {
                            if (correctAnswerFull.includes(promptParts[i])) {
                                correctAnswer = correctAnswerFull.replace(promptParts[i], "").trim();
                                break;
                            }
                        }
                    }
                }
            }
            nativeInputValueSetter.call(elm, correctAnswer);
            let inputEvent = new Event('input', {
                bubbles: true
            });
            elm.dispatchEvent(inputEvent);
        }
    } else if (challengeType === 'Challenge Name') {
        let articles = window.sol.articles;
        let correctSolutions = window.sol.correctSolutions[0];
        let matchingArticle = articles.find(article => correctSolutions.startsWith(article));
        let matchingIndex = matchingArticle !== undefined ? articles.indexOf(matchingArticle) : null;
        let remainingValue = correctSolutions.substring(matchingArticle.length);
        let selectedElement = document.querySelector(`[data-test="challenge-choice"]:nth-child(${matchingIndex + 1})`);
        if (selectedElement) {
            selectedElement.click();
        }
        let elm = document.querySelector('[data-test="challenge-text-input"]');
        if (elm) {
            let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(elm, remainingValue);
            let inputEvent = new Event('input', {
                bubbles: true
            });
            elm.dispatchEvent(inputEvent);
        }
    } else if (challengeType === 'Type Cloze') {
        const input = document.querySelector('input[type="text"].b4jqk');
        if (input) {
            let targetToken = window.sol.displayTokens.find(t => t.damageStart !== undefined);
            let correctWord = targetToken?.text || "";
            let correctEnding = typeof targetToken?.damageStart === "number" ? correctWord.slice(targetToken.damageStart) : "";
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, correctEnding);
            input.dispatchEvent(new Event("input", {
                bubbles: true
            }));
            input.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        }
    } else if (challengeType === 'Type Cloze Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
            if (answerCell && tableRows[i]) {
                const input = tableRows[i].querySelector('input[type="text"].b4jqk');
                if (input) {
                    const correctWord = answerCell.text;
                    const correctEnding = correctWord.slice(answerCell.damageStart);
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, correctEnding);
                    input.dispatchEvent(new Event("input", {
                        bubbles: true
                    }));
                    input.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                }
            }
        });
    } else if (challengeType === 'Tap Cloze Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
            if (answerCell && tableRows[i]) {
                const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
                const wordButtons = wordBank ? Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])')) : [];
                const correctWord = answerCell.text;
                const correctEnding = correctWord.slice(answerCell.damageStart);
                let endingMatched = "";
                let used = new Set();
                for (let btn of wordButtons) {
                    if (!correctEnding.startsWith(endingMatched + btn.innerText)) continue;
                    btn.click();
                    endingMatched += btn.innerText;
                    used.add(btn);
                    if (endingMatched === correctEnding) break;
                }
            }
        });
    } else if (challengeType === 'Type Complete Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => t.isBlank);
            if (answerCell && tableRows[i]) {
                const input = tableRows[i].querySelector('input[type="text"].b4jqk');
                if (input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, answerCell.text);
                    input.dispatchEvent(new Event("input", {
                        bubbles: true
                    }));
                    input.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                }
            }
        });
    } else if (challengeType === 'Pattern Tap Complete') {
        const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
        if (wordBank) {
            const choices = window.sol.choices;
            const correctIndex = window.sol.correctIndex ?? 0;
            const correctText = choices[correctIndex];
            const buttons = Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])'));
            const targetButton = buttons.find(btn => btn.innerText.trim() === correctText);
            if (targetButton) {
                targetButton.click();
            }
        }
    } else if (challengeType === 'Story Arrange') {
        let choices = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
        for (let i = 0; i < window.sol.phraseOrder.length; i++) {
            choices[window.sol.phraseOrder[i]].click();
        }
    } else if (challengeType === 'Story Multiple Choice') {
        let choices = document.querySelectorAll('[data-test="stories-choice"]');
        choices[window.sol.correctAnswerIndex].click();
    } else if (challengeType === 'Story Point to Phrase') {
        let choices = document.querySelectorAll('[data-test="challenge-tap-token-text"]');
        var correctIndex = -1;
        for (let i = 0; i < window.sol.parts.length; i++) {
            if (window.sol.parts[i].selectable === true) {
                correctIndex += 1;
                if (window.sol.correctAnswerIndex === i) {
                    choices[correctIndex].parentElement.click();
                }
            }
        }
    }
    setTimeout(() => {
        const nextBtn = document.querySelector('[data-test="player-next"]') ||
            document.querySelector('[data-test="stories-player-continue"]') ||
            document.querySelector('[data-test="stories-player-done"]');
        if (nextBtn && !nextBtn.disabled) {
            console.log('✓ Auto-clicking NEXT button');
            nextBtn.click();
        }
    }, 400);
};
const solve = () => {
    try {
        window.sol = findReact(document.getElementsByClassName('_3yE3H')[0])?.props?.currentChallenge;
    } catch (error) {
        console.error("Error getting challenge data:", error);
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if (buttonSkip && !buttonSkip.disabled) {
            console.log("Auto skipping due to error fetching challenge data");
            buttonSkip.click();
        }
        return;
    }
    const challengeType = determineChallengeType();
    if (challengeType && !['error', 'Challenge Speak', 'Listen Challenge', 'Listen Match', 'Listen Tap', 'Listen Speak'].includes(challengeType)) {
        handleChallenge(challengeType);
        setTimeout(() => {
            const nextButton = document.querySelector('[data-test="player-next"]') || document.querySelector('[data-test="stories-player-continue"]');
            if (nextButton && !nextButton.disabled) {
                nextButton.click();
            }
        }, 100);
    } else {
        console.log(`Cannot solve or skipping ${challengeType} challenge`);
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if (buttonSkip && !buttonSkip.disabled) {
            console.log(`Auto skipping ${challengeType}`);
            buttonSkip.click();
        }
    }
};
const SHOP_ITEMS = [{
        label: "3 Day Super Trial",
        value: "immersive_subscription",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/super/11db6cd6f69cb2e3c5046b915be8e669.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Streak Freeze (Max-6)",
        value: "society_streak_freeze",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/216ddc11afcbb98f44e53d565ccf479e.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Heart Segment",
        value: "heart_segment",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/hearts/547ffcf0e6256af421ad1a32c26b8f1a.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Health Refill",
        value: "health_refill",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/hearts/547ffcf0e6256af421ad1a32c26b8f1a.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "XP Boost Stackable",
        value: "xp_boost_stackable",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "General XP Boost",
        value: "general_xp_boost",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "XP Boost x2 15 Mins",
        value: "xp_boost_15",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "XP Boost x2 60 Mins",
        value: "xp_boost_60",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "XP Boost x3 15 Mins",
        value: "xp_boost_refill",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Early Bird XP Boost",
        value: "early_bird_xp_boost",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/icons/68c1fd0f467456a4c607ecc0ac040533.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Row Blaster 150",
        value: "row_blaster_150",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/leagues/9fadb349c2ece257386a0e576359c867.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    },
    {
        label: "Row Blaster 250",
        value: "row_blaster_250",
        icon: "<img src='https://d35aaqx5ub95lt.cloudfront.net/images/leagues/9fadb349c2ece257386a0e576359c867.svg' style='width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));'>"
    }
];
const buyItem = async (itemId) => {
    if (!userInfo || !sub || !jwt || !defaultHeaders) {
        logToConsole('❌ Not logged in or user data missing', 'error');
        alert('❌ Error: User data missing. Please refresh the page.');
        return false;
    }
    const item = SHOP_ITEMS.find(i => i.value === itemId);
    if (!item) {
        logToConsole('❌ Item not found', 'error');
        return false;
    }
    try {
        logToConsole(`⏳ Purchasing ${item.label}...`, 'info');
        let response;
        if (itemId === "xp_boost_refill") {
            const innerBody = {
                "isFree": false,
                "learningLanguage": userInfo.learningLanguage,
                "subscriptionFeatureGroupId": 0,
                "xpBoostSource": "REFILL",
                "xpBoostMinutes": 15,
                "xpBoostMultiplier": 3,
                "id": itemId
            };
            const payload = {
                "includeHeaders": true,
                "requests": [{
                    "url": `/2023-05-23/users/${sub}/shop-items`,
                    "extraHeaders": {},
                    "method": "POST",
                    "body": JSON.stringify(innerBody)
                }]
            };
            const batchHeaders = {
                ...defaultHeaders,
                "host": "ios-api-2.duolingo.com",
                "x-amzn-trace-id": `User=${sub}`,
                "Content-Type": "application/json"
            };
            response = await fetch("https://ios-api-2.duolingo.com/2023-05-23/batch", {
                method: "POST",
                headers: batchHeaders,
                body: JSON.stringify(payload),
                credentials: 'include'
            });
        } else if (itemId === "immersive_subscription") {
            if (userInfo.hasPlus) {
                logToConsole('⚠️ Already have Super', 'warning');
                alert('⚠️ You already have Super Duolingo active!');
                return false;
            }
            const data = {
                itemName: "immersive_subscription",
                productId: "com.duolingo.immersive_free_trial_subscription"
            };
            const shopHeaders = {
                ...defaultHeaders,
                "User-Agent": "Duodroid/6.26.2 Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)"
            };
            response = await fetch(
                `https://www.duolingo.com/2017-06-30/users/${sub}/shop-items`, {
                    method: "POST",
                    headers: shopHeaders,
                    body: JSON.stringify(data),
                    credentials: 'include'
                }
            );
            if (response && response.ok) {
                const resData = await response.json();
                if (resData.purchaseId) {
                    userInfo.hasPlus = true;
                    logToConsole('✅ Super Trial activated!', 'success');
                    alert('✅ SUCCESS! 3-Day Super Trial Activated.\nThe page will now refresh.');
                    window.location.reload();
                    return true;
                } else {
                    logToConsole('❌ Activation failed (No purchaseId)', 'error');
                    alert('❌ Failed: Server did not return a purchase ID.');
                    return false;
                }
            } else {
                const errText = await response.text();
                logToConsole(`❌ Activation failed (HTTP ${response.status})`, 'error');
                alert(`❌ Failed (HTTP ${response.status}):\n${errText}`);
                return false;
            }
        } else {
            const data = {
                "itemName": itemId,
                "isFree": true,
                "consumed": true,
                "fromLanguage": userInfo.fromLanguage,
                "learningLanguage": userInfo.learningLanguage
            };
            const shopHeaders = {
                ...defaultHeaders,
                "User-Agent": "Duodroid/6.26.2 Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)"
            };
            response = await fetch(
                `https://www.duolingo.com/2017-06-30/users/${sub}/shop-items`, {
                    method: "POST",
                    headers: shopHeaders,
                    body: JSON.stringify(data),
                    credentials: 'include'
                }
            );
        }
        if (response && response.status === 200) {
            logToConsole(`✅ SUCCESS! Received ${item.label}!`, 'success');
            return true;
        } else if (response) {
            const errorText = await response.text();
            logToConsole(`❌ Failed (HTTP ${response.status}): ${errorText}`, 'error');
            return false;
        } else {
            logToConsole('❌ No response from server', 'error');
            return false;
        }
    } catch (error) {
        logToConsole(`❌ Purchase error: ${error.message}`, 'error');
        alert(`❌ Error: ${error.message}`);
        return false;
    }
};
const showMonthlyBadges = async () => {
    'use strict';
    const existingPanel = document.getElementById('duo-qt-panel');
    if (existingPanel) {
        existingPanel.style.display = 'flex';
        return;
    }
    if (typeof sub === 'undefined' || !sub || typeof jwt === 'undefined' || !jwt) {
        console.log("[DuoQuest] User data missing. Force initializing...");
        const success = await initializeFarming();
        if (success) {
            console.log("[DuoQuest] Data loaded successfully! ID:", sub);
        } else {
            console.error("[DuoQuest] Failed to load data from cookies.");
        }
    }
    const styles = `
        :root {
            --duo-green: #58cc02;
            --duo-blue: #1cb0f6;
            --duo-yellow: #ffc800;
            --duo-red: #ff4b4b;
            --duo-gray: #e5e5e5;
            --duo-dark: #3c3c3c;
            --duo-light: #ffffff;
            --duo-bg: #f7f7f7;
            --duo-text-main: #3c3c3c;
            --duo-text-sub: #999999;
            --duo-panel-bg: #ffffff;
            --duo-item-bg: #ffffff;
            --duo-border: #e5e5e5;
            --duo-input-bg: #ffffff;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --duo-gray: #373737;
                --duo-dark: #e5e5e5;
                --duo-light: #181818;
                --duo-bg: #121212;
                --duo-text-main: #e5e5e5;
                --duo-text-sub: #888888;
                --duo-panel-bg: #181818;
                --duo-item-bg: #222222;
                --duo-border: #373737;
                --duo-input-bg: #2b2b2b;
            }
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #duo-quest-tool {
            z-index: 9999;
            font-family: 'DIN Next Rounded LT Pro', 'Nunito', sans-serif;
        }
        #duo-qt-toggle {
            background: var(--duo-green);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 16px;
            font-weight: 800;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 0 #46a302;
            transition: transform 0.1s, filter 0.2s;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: none; /* Hidden by default, panel opens immediately */
        }
        #duo-qt-toggle:hover { filter: brightness(1.1); }
        #duo-qt-toggle:active {
            transform: translateY(4px);
            box-shadow: none;
        }
#duo-qt-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* căn giữa màn hình */
  width: 420px;
  height: 640px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: var(--duo-panel-bg);
  border-radius: 24px;
  border: 2px solid var(--duo-border);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  font-family: inherit;
  color: var(--duo-text-main);
  animation: slideIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    position: fixed !important;
    z-index: 2147483647 !important; /* max int của browser */
    isolation: isolate !important;
}
        .qt-header {
            padding: 15px 20px;
            background: var(--duo-panel-bg);
            border-bottom: 2px solid var(--duo-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        }
        .qt-header h3 { margin: 0; color: var(--duo-text-main); font-size: 18px; font-weight: 800; }
        .qt-close {
            cursor: pointer; color: var(--duo-text-sub); font-weight: bold; font-size: 20px;
            transition: color 0.2s, transform 0.2s;
        }
        .qt-close:hover { color: var(--duo-text-main); transform: rotate(90deg); }
        .qt-status-bar {
            padding: 8px 20px;
            background: var(--duo-panel-bg);
            border-bottom: 2px solid var(--duo-border);
            font-size: 11px;
            color: var(--duo-text-sub);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .qt-status-dot {
            display: inline-block; width: 8px; height: 8px; border-radius: 50%;
            background: var(--duo-red); margin-right: 5px;
            transition: background-color 0.3s;
        }
        .qt-status-dot.connected { background: var(--duo-green); box-shadow: 0 0 8px var(--duo-green); }
        .qt-controls {
            padding: 15px 20px;
            background: var(--duo-panel-bg);
            border-bottom: 2px solid var(--duo-border);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .qt-filters-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .qt-filters {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 5px;
            flex: 1;
        }
        .qt-filters::-webkit-scrollbar { height: 0; }
        .qt-pill {
            padding: 6px 16px;
            border-radius: 20px;
            border: 2px solid var(--duo-border);
            background: transparent;
            color: var(--duo-text-sub);
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }
        .qt-pill:hover { background: var(--duo-border); }
        .qt-pill.active {
            background: var(--duo-blue);
            border-color: var(--duo-blue);
            color: white;
            box-shadow: 0 2px 0 #1899d6;
            transform: scale(1.05);
        }
        /* Toggle Switch */
        .qt-toggle-wrapper {
            display: flex;
            align-items: center;
            font-size: 12px;
            color: var(--duo-text-sub);
            font-weight: 700;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        .qt-toggle-input { display: none; }
        .qt-toggle-slider {
            width: 36px;
            height: 20px;
            background-color: var(--duo-border);
            border-radius: 20px;
            margin-right: 8px;
            position: relative;
            transition: background-color 0.2s;
        }
        .qt-toggle-slider::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .qt-toggle-input:checked + .qt-toggle-slider {
            background-color: var(--duo-green);
        }
        .qt-toggle-input:checked + .qt-toggle-slider::after {
            transform: translateX(16px);
        }
        .qt-primary-actions {
            display: flex;
            gap: 10px;
        }
        .qt-action-btn {
            flex: 1;
            padding: 10px;
            border-radius: 12px;
            border: none;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: transform 0.1s, filter 0.2s;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }
        .qt-action-btn:hover { filter: brightness(1.1); }
        .qt-btn-load { background: var(--duo-green); color: white; box-shadow: 0 4px 0 #46a302; }
        .qt-btn-claim-all { background: var(--duo-yellow); color: #735900; box-shadow: 0 4px 0 #d9aa00; }
        .qt-action-btn:active { transform: translateY(4px); box-shadow: none; }
        /* Loading Spinner */
        .qt-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 0.8s linear infinite;
            display: none;
        }
        .qt-action-btn.loading .qt-spinner { display: block; }
        .qt-action-btn.loading span { opacity: 0.7; }
        .qt-content {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            background: var(--duo-bg);
        }
        .qt-item {
            display: flex;
            align-items: center;
            background: var(--duo-item-bg);
            border: 2px solid var(--duo-border);
            border-radius: 16px;
            padding: 12px;
            margin-bottom: 12px;
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            animation: slideIn 0.3s ease-out forwards;
            opacity: 0;
        }
        .qt-item:nth-child(1) { animation-delay: 0.05s; }
        .qt-item:nth-child(2) { animation-delay: 0.1s; }
        .qt-item:nth-child(3) { animation-delay: 0.15s; }
        .qt-item:nth-child(4) { animation-delay: 0.2s; }
        .qt-item:nth-child(5) { animation-delay: 0.25s; }
        .qt-item:hover { border-color: var(--duo-blue); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .qt-item.warning { border-left: 4px solid #ff9600; }
        .qt-item.completed { border-left: 4px solid var(--duo-green); }
        .qt-warning-icon {
            position: absolute;
            top: 5px;
            left: 5px;
            font-size: 14px;
            cursor: help;
        }
        .qt-icon {
            width: 56px;
            height: 56px;
            margin-right: 15px;
            object-fit: contain;
            transition: transform 0.2s;
        }
        .qt-item:hover .qt-icon { transform: scale(1.1) rotate(-5deg); }
        .qt-info { flex: 1; overflow: hidden; }
        .qt-name { font-weight: 700; color: var(--duo-text-main); margin-bottom: 4px; font-size: 15px; }
        .qt-meta { font-size: 11px; color: var(--duo-text-sub); margin-bottom: 6px; font-family: monospace;}
        .qt-progress-bar-bg {
            height: 10px;
            background: var(--duo-border);
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        .qt-progress-bar-fill {
            height: 100%;
            background: var(--duo-yellow);
            width: 0%;
            border-radius: 10px;
            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .qt-progress-bar-fill.full {
            background: var(--duo-green);
        }
        .qt-item-actions {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-left: 12px;
        }
        .qt-mini-btn {
            background: var(--duo-blue);
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 10px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 3px 0 #1899d6;
            font-size: 11px;
            text-align: center;
            width: 50px;
            transition: transform 0.1s, background-color 0.2s;
        }
        .qt-mini-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
        .qt-mini-btn:active { transform: translateY(3px) scale(0.95); box-shadow: none; }
        .qt-mini-btn.gold { background: var(--duo-yellow); color: #735900; box-shadow: 0 3px 0 #d9aa00; }
        .qt-footer {
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: var(--duo-text-sub);
            background: var(--duo-panel-bg);
            border-top: 1px solid var(--duo-border);
        }
        .qt-footer a {
            color: var(--duo-blue);
            text-decoration: none;
            font-weight: bold;
            transition: color 0.2s;
        }
        .qt-footer a:hover { color: var(--duo-green); }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
    let state = {
        userId: sub || null, // Pre-fill with global sub
        token: jwt || null, // Pre-fill with global jwt
        creationDate: null,
        schema: {
            goals: [],
            badges: []
        },
        progress: {},
        earnedBadges: new Set(),
        filter: 'MONTHLY',
        hasAutoLoaded: false,
        hideCompleted: false,
        loading: false
    };
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const fetchPromise = originalFetch.apply(this, args);
        try {
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : (resource?.url || String(resource));
            if (config && config.headers && config.headers.Authorization) {
                const token = config.headers.Authorization.replace('Bearer ', '');
                if (token && token !== state.token) {
                    state.token = token;
                    updateStatusUI();
                    tryAutoLoad();
                }
            }
            if (url.includes('/users/')) {
                const userMatch = url.match(/\/users\/(\d+)/);
                if (userMatch && userMatch[1]) {
                    if (state.userId !== userMatch[1]) {
                        state.userId = userMatch[1];
                        updateStatusUI();
                        tryAutoLoad();
                    }
                }
            }
        } catch (e) {}
        return fetchPromise;
    };
    function log(msg) {
        console.log(`[DuoQuest] ${msg}`);
    }
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    function checkStoredCredentials() {
        if (typeof sub !== 'undefined' && sub) state.userId = sub;
        if (typeof jwt !== 'undefined' && jwt) state.token = jwt;
        const jwtCookie = getCookie('jwt_token');
        if (!state.token && jwtCookie) state.token = jwtCookie;
        if (!state.userId && window.__PRELOADED_STATE__ && window.__PRELOADED_STATE__.user) {
            state.userId = window.__PRELOADED_STATE__.user.id;
        } else if (!state.userId) {
            const localState = localStorage.getItem('reduxPersist:user');
            if (localState) {
                try {
                    const parsed = JSON.parse(localState);
                    if (parsed.id) state.userId = parsed.id;
                } catch (e) {}
            }
        }
        updateStatusUI();
        tryAutoLoad();
    }
    function tryAutoLoad() {
        if (state.userId && state.token && !state.hasAutoLoaded) {
            state.hasAutoLoaded = true;
            setTimeout(loadData, 1000);
        }
    }
    function getQuestTimestamp(goalId) {
        const regex = /^(\d{4})_(\d{2})_monthly/;
        const match = goalId.match(regex);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const date = new Date(Date.UTC(year, month, 15, 12, 0, 0));
            return date.toISOString();
        }
        return new Date().toISOString();
    }
    function setButtonLoading(btnId, isLoading) {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (isLoading) {
                btn.classList.add('loading');
                btn.disabled = true;
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        }
    }
    function getCommonHeaders() {
        return {
            "Content-Type": "application/json",
            "x-requested-with": "XMLHttpRequest",
            "accept": "application/json; charset=UTF-8",
            "Authorization": `Bearer ${state.token}`
        };
    }
    async function fetchAccountCreationDate() {
        if (!state.userId || !state.token) return;
        try {
            const url = `https://www.duolingo.com/2017-06-30/users/${state.userId}?fields=trackingProperties`;
            const res = await originalFetch(url, {
                method: "GET",
                headers: getCommonHeaders()
            });
            const data = await res.json();
            if (data.trackingProperties && data.trackingProperties.creation_date_new) {
                state.creationDate = new Date(data.trackingProperties.creation_date_new);
                const dateStr = state.creationDate.toLocaleDateString();
                const userDisplay = document.getElementById('qt-user-display');
                if (userDisplay) userDisplay.innerText = `ID: ${state.userId} (Since ${state.creationDate.getFullYear()})`;
            }
        } catch (e) {
            log("Warning: Could not fetch account age.");
        }
    }
    async function loadData() {
        if (!state.userId || !state.token) return;
        setButtonLoading('qt-load-btn', true);
        await fetchAccountCreationDate();
        try {
            const schemaRes = await originalFetch(`https://goals-api.duolingo.com/schema?ui_language=en&_=${Date.now()}`, {
                method: "GET",
                headers: getCommonHeaders(),
                credentials: "include"
            });
            const schemaData = await schemaRes.json();
            state.schema = schemaData;
        } catch (e) {
            console.error(e);
        }
        try {
            const progressRes = await originalFetch(`https://goals-api.duolingo.com/users/${state.userId}/progress?timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}&ui_language=en`, {
                method: "GET",
                headers: getCommonHeaders(),
                credentials: "include"
            });
            const progressData = await progressRes.json();
            state.progress = progressData.goals?.progress || {};
            if (progressData.badges && progressData.badges.earned) {
                state.earnedBadges = new Set(progressData.badges.earned);
            } else {
                state.earnedBadges = new Set();
            }
        } catch (e) {
            console.error(e);
        }
        setButtonLoading('qt-load-btn', false);
        renderGoals();
    }
    async function completeMetric(metricName, amount, goalId) {
        if (!state.userId) return;
        if (metricName === 'XP' && amount >= 50) {
            amount = 1000; // Safe limit for XP
        }
        const timestamp = getQuestTimestamp(goalId);
        const url = `https://goals-api.duolingo.com/users/${state.userId}/progress/batch`;
        const body = {
            "metric_updates": [{
                "metric": metricName,
                "quantity": amount
            }],
            "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
            "timestamp": timestamp
        };
        try {
            const response = await originalFetch(url, {
                method: "POST",
                headers: getCommonHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                if (response.status === 500) {
                    alert("Server Error (500): The server rejected the request (likely due to the timestamp being too old/archived).");
                } else {
                    alert(`Error ${response.status}: Request failed.`);
                }
                return;
            }
            log(`✅ Updated ${metricName}!`);
            loadData();
        } catch (e) {
            console.error(e);
        }
    }
    async function claimAllMonthly() {
        if (!state.schema.goals) return;
        if (!state.creationDate && !confirm("Account age unknown. Continue?")) return;
        setButtonLoading('qt-claim-all-btn', true);
        const filteredGoals = getFilteredGoals();
        const safeGoals = filteredGoals.filter(g => {
            if (!g.category || !g.category.includes('MONTHLY')) return false;
            return !isQuestOlderThanAccount(g.goalId);
        });
        const batches = {};
        safeGoals.forEach(g => {
            const ts = getQuestTimestamp(g.goalId);
            if (!batches[ts]) batches[ts] = new Set();
            batches[ts].add(g.metric);
        });
        const timestamps = Object.keys(batches);
        let errorCount = 0;
        for (const ts of timestamps) {
            const uniqueMetrics = Array.from(batches[ts]);
            const metricUpdates = uniqueMetrics.map(metric => ({
                "metric": metric,
                "quantity": metric === 'XP' ? 1000 : 50
            }));
            const url = `https://goals-api.duolingo.com/users/${state.userId}/progress/batch`;
            const body = {
                "metric_updates": metricUpdates,
                "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
                "timestamp": ts
            };
            try {
                const res = await originalFetch(url, {
                    method: "POST",
                    headers: getCommonHeaders(),
                    body: JSON.stringify(body)
                });
                if (!res.ok) errorCount++;
            } catch (e) {
                errorCount++;
            }
        }
        setButtonLoading('qt-claim-all-btn', false);
        if (errorCount > 0) {
            alert(`Done. ${errorCount} batches failed (likely due to historic timestamps).`);
        } else {
            alert("Claim All Completed Successfully!");
        }
        loadData();
    }
    function isQuestOlderThanAccount(goalId) {
        if (!state.creationDate) return false;
        const match = goalId.match(/^(\d{4})_(\d{2})_monthly/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const creationYear = state.creationDate.getFullYear();
            const creationMonth = state.creationDate.getMonth();
            if (year < creationYear) return true;
            if (year === creationYear && month < creationMonth) return true;
        }
        return false;
    }
    function getFilteredGoals() {
        if (!state.schema.goals) return [];
        const map = new Map();
        const monthlyRegex = /^(\d{4}_\d{2})_monthly/;
        const monthlyGoals = [];
        const otherGoals = [];
        state.schema.goals.forEach(g => {
            const match = g.goalId.match(monthlyRegex);
            if (match) {
                monthlyGoals.push({
                    key: match[1],
                    goal: g
                });
            } else {
                otherGoals.push(g);
            }
        });
        monthlyGoals.forEach(item => {
            const existing = map.get(item.key);
            if (!existing) {
                map.set(item.key, item.goal);
            } else {
                const existingIsChallenge = existing.category.includes('CHALLENGE');
                const newIsChallenge = item.goal.category.includes('CHALLENGE');
                if (!existingIsChallenge && newIsChallenge) {
                    map.set(item.key, item.goal);
                }
            }
        });
        return [...otherGoals, ...map.values()];
    }
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'duo-qt-panel';
        panel.innerHTML = `
            <div class="qt-header">
                <h3>Duolingo Quest Tool</h3>
                <span class="qt-close" id="qt-close-btn">✕</span>
            </div>
            <div class="qt-status-bar">
                <div>
                    <span class="qt-status-dot" id="qt-dot"></span>
                    <span id="qt-status-text">Waiting...</span>
                </div>
                <span id="qt-user-display">ID: ---</span>
            </div>
            <div class="qt-controls">
                <div class="qt-primary-actions">
                    <button class="qt-action-btn qt-btn-load" id="qt-load-btn">
                        <div class="qt-spinner"></div><span>Refresh Data</span>
                    </button>
                    <button class="qt-action-btn qt-btn-claim-all" id="qt-claim-all-btn">
                        <div class="qt-spinner"></div><span>Claim All (+50)</span>
                    </button>
                </div>
                <div class="qt-filters-row">
                    <div class="qt-filters">
                        <button class="qt-pill active" data-filter="MONTHLY">Monthly</button>
                        <button class="qt-pill" data-filter="DAILY">Daily</button>
                        <button class="qt-pill" data-filter="FRIENDS">Friends</button>
                        <button class="qt-pill" data-filter="WEEKLY">Weekly</button>
                        <button class="qt-pill" data-filter="ALL">All</button>
                    </div>
                </div>
                <label class="qt-toggle-wrapper">
                    <input type="checkbox" class="qt-toggle-input" id="qt-hide-completed">
                    <span class="qt-toggle-slider"></span>
                    <span>Hide Done</span>
                </label>
            </div>
            <div id="qt-content-area" class="qt-content">
                <div style="text-align:center; color:var(--duo-text-sub); margin-top:50px; font-weight:600;">
                   1. Turn off "Lite Mode" in Settings<br>2. Browse Duolingo.<br>3. Wait for "Connected".<br>4. Data loads automatically.
                </div>
            </div>
            <div class="qt-footer">
                Credits: <a href="https://github.com/apersongithub/" target="_blank">apersongithub</a>
            </div>
        `;
        document.body.appendChild(panel);

        const header = panel.querySelector('.qt-header');
        let isDragging = false;
        let offset = { x: 0, y: 0 };
        header.onmousedown = () => {};
        document.onmousemove = () => {};
        document.onmouseup = () => {};

        document.getElementById('qt-close-btn').onclick = () => panel.style.display = 'none';
        document.getElementById('qt-load-btn').onclick = loadData;
        document.getElementById('qt-claim-all-btn').onclick = claimAllMonthly;

        document.getElementById('qt-hide-completed').onchange = (e) => {
            state.hideCompleted = e.target.checked;
            renderGoals();
        };

        document.querySelectorAll('.qt-pill').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.qt-pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                state.filter = e.target.dataset.filter;
                renderGoals();
            };
        });
    }
    function updateStatusUI() {
        const dot = document.getElementById('qt-dot');
        const text = document.getElementById('qt-status-text');
        const userDisplay = document.getElementById('qt-user-display');
        if (state.userId && state.token) {
            dot.classList.add('connected');
            text.innerText = "Connected";
            if (state.creationDate) {
                userDisplay.innerText = `ID: ${state.userId} (${state.creationDate.getFullYear()})`;
            } else {
                userDisplay.innerText = `ID: ${state.userId}`;
            }
        } else {
            dot.classList.remove('connected');
            text.innerText = "Scanning network...";
            userDisplay.innerText = "ID: ---";
        }
    }
    function renderGoals() {
        const container = document.getElementById('qt-content-area');
        container.innerHTML = '';
        const filteredSchemaGoals = getFilteredGoals();
        if (!filteredSchemaGoals || filteredSchemaGoals.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:var(--duo-text-sub);">No goals loaded.</div>';
            return;
        }
        const isCategoryMatch = (cat) => {
            if (!cat) return false;
            if (state.filter === 'ALL') return true;
            if (state.filter === 'MONTHLY' && (cat.includes('MONTHLY'))) return true;
            if (state.filter === 'DAILY' && cat.includes('DAILY')) return true;
            if (state.filter === 'FRIENDS' && cat.includes('FRIENDS')) return true;
            if (state.filter === 'WEEKLY' && cat.includes('WEEKLY')) return true;
            return false;
        };
        const reversedGoals = [...filteredSchemaGoals].reverse();
        reversedGoals.forEach(goal => {
            if (!isCategoryMatch(goal.category)) return;
            let isEarned = false;
            if (state.earnedBadges.has(goal.badgeId) || state.earnedBadges.has(goal.goalId)) {
                isEarned = true;
            }
            if (state.hideCompleted && isEarned) return;
            let isOlder = isQuestOlderThanAccount(goal.goalId);
            let iconUrl = "https://d35aaqx5ub95lt.cloudfront.net/images/goals/2b5a21198336f3246eb61c5670868eb2.svg";
            const badge = state.schema.badges.find(b => b.badgeId === goal.badgeId);
            if (badge && badge.icon && badge.icon.enabled && badge.icon.enabled.lightMode) {
                iconUrl = badge.icon.enabled.lightMode.svg || badge.icon.enabled.lightMode.url || iconUrl;
            }
            let currentProgress = 0;
            let rawProgress = state.progress[goal.goalId];
            if (typeof rawProgress === 'number') {
                currentProgress = rawProgress;
            } else if (rawProgress && typeof rawProgress === 'object') {
                currentProgress = rawProgress.progress || 0;
            }
            const target = goal.threshold || 10;
            let percentage = Math.min(100, (currentProgress / target) * 100);
            const metric = goal.metric;
            let progressText = `${currentProgress} / ${target}`;
            let progressColor = "var(--duo-text-sub)";
            if (isEarned) {
                percentage = 100;
                progressText = "COMPLETED";
                progressColor = "var(--duo-green)";
            }
            const el = document.createElement('div');
            el.className = 'qt-item' + (isOlder ? ' warning' : '') + (isEarned ? ' completed' : '');
            el.innerHTML = `
                ${isOlder ? '<span class="qt-warning-icon" title="This quest is older than your account. Finishing it is risky.">⚠️</span>' : ''}
                <img src="${iconUrl}" class="qt-icon" onerror="this.style.display='none'">
                <div class="qt-info">
                    <div class="qt-name">${goal.title?.uiString || goal.goalId}</div>
                    <div class="qt-meta">Metric: ${metric}</div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:${progressColor}; margin-bottom:2px;">
                        <span>${progressText}</span>
                        <span>${Math.round(percentage)}%</span>
                    </div>
                    <div class="qt-progress-bar-bg">
                        <div class="qt-progress-bar-fill ${isEarned ? 'full' : ''}" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="qt-item-actions">
                    <button class="qt-mini-btn" data-metric="${metric}" data-amt="1">+1</button>
                    <button class="qt-mini-btn" data-metric="${metric}" data-amt="10">+10</button>
                    <button class="qt-mini-btn gold" data-metric="${metric}" data-amt="50">Claim</button>
                </div>
            `;
            const buttons = el.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.onclick = () => {
                    if (isOlder && !confirm("This quest is dated BEFORE your account was created. Completing it may flag your account. Are you sure?")) return;
                    completeMetric(btn.dataset.metric, parseInt(btn.dataset.amt), goal.goalId);
                };
            });
            container.appendChild(el);
        });
    }
    setTimeout(() => {
        createUI();
        checkStoredCredentials();
    }, 1000);
};
const checkDailyQuestStatus = async () => {
    if (!sub || !jwt) {
        console.log("[Quest Check] User data not available.");
        return false;
    }
    const goalHeaders = getGoalHeaders();
    if (!goalHeaders) return false;
    try {
        const [schemaRes, progressRes] = await Promise.all([
            fetch(`${GOALS_API_URL}/schema?ui_language=en&_=${Date.now()}`, {
                headers: goalHeaders
            }),
            fetch(`${GOALS_API_URL}/users/${sub}/progress?timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}&ui_language=en`, {
                headers: goalHeaders
            })
        ]);
        if (!schemaRes.ok || !progressRes.ok) {
            console.error("[Quest Check] Failed to fetch quest data.");
            return false;
        }
        const schema = await schemaRes.json();
        const progress = await progressRes.json();
        const earnedQuests = new Set(progress.badges?.earned || []);
        let dailyQuestsTotal = 0;
        let dailyQuestsCompleted = 0;
        if (!schema.goals) return false;
        schema.goals.forEach(goal => {
            const isDaily = goal.category?.includes('DAILY');
            if (isDaily) {
                dailyQuestsTotal++;
                const isCompleted = earnedQuests.has(goal.badgeId) || earnedQuests.has(goal.goalId);
                if (isCompleted) {
                    dailyQuestsCompleted++;
                } else {
                    const goalProgress = progress.goals?.progress?.[goal.goalId];
                    const currentProgress = (typeof goalProgress === 'number') ? goalProgress : (goalProgress?.progress || 0);
                    const threshold = goal.threshold || 1;
                    if (currentProgress >= threshold) {
                        dailyQuestsCompleted++;
                    }
                }
            }
        });
        return dailyQuestsTotal > 0 && dailyQuestsTotal === dailyQuestsCompleted;
    } catch (error) {
        logToConsole(`Error checking daily quest status: ${error.message}`, 'error');
        return false;
    }
};
const updateDailyQuestButtonUI = async () => {
    const questButton = document.querySelector('._option_btn[data-type="quest"]');
    if (!questButton) return;
    const existingOverlay = questButton.querySelector('._completed_overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    questButton.style.position = 'relative';
    const areQuestsCompleted = await checkDailyQuestStatus();
    if (areQuestsCompleted) {
        const overlay = document.createElement('div');
        overlay.className = '_completed_overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(20, 20, 20, 0.75); /* Lớp nền đen mờ */
            backdrop-filter: blur(2px); /* Hiệu ứng làm mờ nhẹ */
            color: white;
            display: flex;
            flex-direction: column; /* Xếp chồng các mục theo chiều dọc */
            align-items: center;
            justify-content: center;
            border-radius: 10px; /* Bo góc khớp với nút */
            text-align: center;
            pointer-events: none;
            z-index: 1;
            padding: 5px;
            box-sizing: border-box;
            gap: 4px; /* Khoảng cách giữa ảnh và chữ */
            animation: fadeIn 0.3s ease-out; /* Hiệu ứng xuất hiện mượt mà */
        `;
        overlay.innerHTML = `
            <img src="https://friends.duolingo.com/kudos/assets/kudos_reaction_congrats.svg"
                 alt="Completed"
                 style="width: 38px; height: 38px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <span style="font-weight: 700; font-size: 12px; line-height: 1.1;">
                Daily Quests<br>Completed
            </span>
        `;
        questButton.appendChild(overlay);
        logToConsole('Daily quests are completed. Overlay updated.', 'success');
    }
};
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
    }
`;
document.head.appendChild(styleSheet);
const showItemShop = async () => {
    console.log("🎁 Opening Item Shop...");
    if (!userInfo || !sub || !jwt || !defaultHeaders) {
        console.log("📊 User not loaded yet, initializing...");
        logToConsole('Initializing user data for shop...', 'info');
        const success = await initializeFarming();
        if (!success || !userInfo || !sub || !jwt) {
            logToConsole('❌ Failed to load user data. Please try again.', 'error');
            alert('Failed to load user data. Please reload the page and try again.');
            return;
        }
        logToConsole('✅ User data loaded successfully', 'success');
    }
    console.log("✅ User data ready:", {
        userInfo,
        sub,
        jwt: !!jwt
    });
    const modal = document.createElement('div');
    modal.id = '_item_shop_modal';
    modal.className = '_modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="_modal_overlay"></div>
        <div class="_modal_container _wide">
            <div class="_modal_header">
                <h2>
                    <span style="font-size: 24px; display:inline-block;vertical-align:middle;margin-right:8px">🎁</span>
                    Free Item Shop
                </h2>
                <button class="_close_modal_btn" id="_close_item_shop">
                    <span style="font-size: 18px;">❌</span>
                </button>
            </div>
            <div class="_modal_content">
                <div class="_shop_grid" id="_shop_items_grid">
                    ${SHOP_ITEMS.map(item => `
                        <div class="_shop_item_card">
                            <div class="_shop_item_icon">${item.icon}</div>
                            <div class="_shop_item_name">${item.label}</div>
<button class="_shop_buy_btn" data-item-id="${item.value}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <path d="M12 7V20M12 7H8.46429C7.94332 7 7.4437 6.78929 7.07533 6.41421C6.70695 6.03914 6.5 5.53043 6.5 5C6.5 4.46957 6.70695 3.96086 7.07533 3.58579C7.4437 3.21071 7.94332 3 8.46429 3C11.2143 3 12 7 12 7ZM12 7H15.5357C16.0567 7 16.5563 6.78929 16.9247 6.41421C17.293 6.03914 17.5 5.53043 17.5 5C17.5 4.46957 17.293 3.96086 16.9247 3.58579C16.5563 3.21071 16.0567 3 15.5357 3C12.7857 3 12 7 12 7Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 7H18C19.1046 7 20 7.89543 20 9V10C20 11.1046 19.1046 12 18 12H6C4.89543 12 4 11.1046 4 10V9C4 7.89543 4.89543 7 6 7Z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 12V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V12" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    Get Free
</button>
                        </div>
                    `).join('')}
                </div>
                <div class="_shop_stats">
                    <p style="color: var(--text-secondary); font-size: 12px; text-align: center; margin-top: 20px;">
                        ✨ All items are FREE! Click any item to claim it instantly.
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('_close_item_shop')?.addEventListener('click', () => {
        console.log("🎁 Closing Item Shop");
        modal.remove();
    });
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            console.log("🎁 Closing Item Shop (overlay)");
            modal.remove();
        }
    });
    modal.querySelectorAll('._shop_buy_btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            const item = SHOP_ITEMS.find(i => i.value === itemId);
            console.log("🛍️ Buying item:", itemId, item);
            btn.disabled = true;
btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px; animation: spin 1s linear infinite;">
        <path d="M12 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 18V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
        <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
        <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        <path d="M2 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
        <path d="M18 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    </svg>
    Processing...
`;            const success = await buyItem(itemId);
            if (success) {
btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <circle cx="12" cy="12" r="10" fill="#10b981" stroke="#10b981" stroke-width="2"/>
        <path d="M8 12.5L10.5 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Got It!
`;
                btn.style.background = 'var(--success-color)';
                btn.style.color = 'white';
                btn.style.cursor = 'default';
                setTimeout(() => {
                    btn.disabled = false;
btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <path d="M12 7V20M12 7H8.46429C7.94332 7 7.4437 6.78929 7.07533 6.41421C6.70695 6.03914 6.5 5.53043 6.5 5C6.5 4.46957 6.70695 3.96086 7.07533 3.58579C7.4437 3.21071 7.94332 3 8.46429 3C11.2143 3 12 7 12 7ZM12 7H15.5357C16.0567 7 16.5563 6.78929 16.9247 6.41421C17.293 6.03914 17.5 5.53043 17.5 5C17.5 4.46957 17.293 3.96086 16.9247 3.58579C16.5563 3.21071 16.0567 3 15.5357 3C12.7857 3 12 7 12 7Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 7H18C19.1046 7 20 7.89543 20 9V10C20 11.1046 19.1046 12 18 12H6C4.89543 12 4 11.1046 4 10V9C4 7.89543 4.89543 7 6 7Z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 12V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V12" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    Get Free
`;
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.style.cursor = 'pointer';
                }, 3000);
            } else {
                btn.disabled = false;
btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <path d="M12 7V20M12 7H8.46429C7.94332 7 7.4437 6.78929 7.07533 6.41421C6.70695 6.03914 6.5 5.53043 6.5 5C6.5 4.46957 6.70695 3.96086 7.07533 3.58579C7.4437 3.21071 7.94332 3 8.46429 3C11.2143 3 12 7 12 7ZM12 7H15.5357C16.0567 7 16.5563 6.78929 16.9247 6.41421C17.293 6.03914 17.5 5.53043 17.5 5C17.5 4.46957 17.293 3.96086 16.9247 3.58579C16.5563 3.21071 16.0567 3 15.5357 3C12.7857 3 12 7 12 7Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 7H18C19.1046 7 20 7.89543 20 9V10C20 11.1046 19.1046 12 18 12H6C4.89543 12 4 11.1046 4 10V9C4 7.89543 4.89543 7 6 7Z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 12V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V12" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    Get Free
`;
            }
        });
    });
    console.log("✅ Item Shop opened");
};
const autoSolver = {
    findReact: (dom, traverseUp = 1) => {
        const key = Object.keys(dom).find(key => {
            return key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$");
        });
        const domFiber = dom[key];
        if (!domFiber) return null;
        const GetCompFiber = fiber => {
            let parentFiber = fiber.return;
            while (typeof parentFiber.type == "string") {
                parentFiber = parentFiber.return;
            }
            return parentFiber;
        };
        let compFiber = GetCompFiber(domFiber);
        for (let i = 0; i < traverseUp; i++) {
            compFiber = GetCompFiber(compFiber);
        }
        return compFiber.stateNode;
    },
    determineChallengeType: () => {
        try {
            if (window.sol?.type === 'typeCloze') return 'Type Cloze';
            if (window.sol?.type === 'typeClozeTable') return 'Type Cloze Table';
            if (window.sol?.type === 'tapClozeTable') return 'Tap Cloze Table';
            if (window.sol?.type === 'typeCompleteTable') return 'Type Complete Table';
            if (window.sol?.type === 'patternTapComplete') return 'Pattern Tap Complete';
            if (document.querySelector('[data-test="challenge challenge-listenSpeak"]')) return 'Listen Speak';
            if (document.querySelector('.FmlUF')) {
                if (window.sol?.type === 'arrange') return 'Story Arrange';
                if (window.sol?.type === 'multiple-choice' || window.sol?.type === 'select-phrases') return 'Story Multiple Choice';
                if (window.sol?.type === 'point-to-phrase') return 'Story Point to Phrase';
                if (window.sol?.type === 'match') return 'Story Pairs';
            }
            if (document.querySelectorAll('[data-test*="challenge-speak"]').length > 0) return 'Challenge Speak';
            if (document.querySelectorAll('[data-test*="challenge-name"]').length > 0 && document.querySelectorAll('[data-test="challenge-choice"]').length > 0) return 'Challenge Name';
            if (window.sol?.type === 'listenMatch') return 'Listen Match';
            if (document.querySelectorAll('[data-test="challenge-choice"]').length > 0) {
                if (document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Choice with Text Input';
                return 'Challenge Choice';
            }
            if (document.querySelectorAll('[data-test$="challenge-tap-token"]').length > 0) {
                if (window.sol?.pairs !== undefined) return 'Pairs';
                if (window.sol?.correctTokens !== undefined) return 'Tokens Run';
                if (window.sol?.correctIndices !== undefined) return 'Indices Run';
            }
            if (document.querySelectorAll('[data-test="challenge-tap-token-text"]').length > 0) return 'Fill in the Gap';
            if (document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Text Input';
            if (document.querySelectorAll('textarea[data-test="challenge-translate-input"]').length > 0) return 'Challenge Translate Input';
            if (window.sol?.type === 'tapCompleteTable') return 'Tap Complete Table';
            if (document.querySelectorAll('[data-test*="challenge-partialReverseTranslate"]').length > 0) return 'Partial Reverse';
            return false;
        } catch (error) {
            return false;
        }
    },
    setInputValue: (element, value) => {
        const isTextarea = element.tagName === 'TEXTAREA';
        const prototype = isTextarea ? window.HTMLTextAreaElement : window.HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(prototype.prototype, "value").set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', {
            bubbles: true
        }));
    },
    delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
    handleChallengeName: async () => {
        const articles = window.sol.articles;
        const correctSolution = window.sol.correctSolutions[0];
        const matchingArticle = articles.find(article => correctSolution.startsWith(article));
        if (matchingArticle !== undefined) {
            const matchingIndex = articles.indexOf(matchingArticle);
            const remainingValue = correctSolution.substring(matchingArticle.length).trim();
            const selectedElement = document.querySelector(`[data-test="challenge-choice"]:nth-child(${matchingIndex + 1})`);
            if (selectedElement) {
                selectedElement.click();
                await autoSolver.delay(50);
            }
            const input = document.querySelector('[data-test="challenge-text-input"]');
            if (input) autoSolver.setInputValue(input, remainingValue);
        }
    },
    handlePairs: async () => {
        const buttons = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
        const texts = document.querySelectorAll('[data-test="challenge-tap-token-text"]');
        if (texts.length !== buttons.length || buttons.length === 0) return;
        for (const pair of window.sol.pairs || []) {
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                if (button.disabled) continue;
                const text = texts[i].innerText.toLowerCase().trim();
                const matches = text === pair.transliteration?.toLowerCase().trim() ||
                    text === pair.character?.toLowerCase().trim() ||
                    text === pair.learningToken?.toLowerCase().trim() ||
                    text === pair.fromToken?.toLowerCase().trim();
                if (matches) {
                    button.click();
                    await autoSolver.delay(50);
                }
            }
        }
    },
    handleTokensRun: async () => {
        const allTokens = document.querySelectorAll('[data-test$="challenge-tap-token"]');
        const clickedTokens = [];
        for (const correctToken of window.sol.correctTokens) {
            const matchingElements = Array.from(allTokens).filter(el => el.textContent.trim() === correctToken.trim());
            if (matchingElements.length > 0) {
                const matchIndex = clickedTokens.filter(token => token.textContent.trim() === correctToken.trim()).length;
                const elementToClick = matchingElements[matchIndex] || matchingElements[0];
                if (!elementToClick.disabled) {
                    elementToClick.click();
                    clickedTokens.push(elementToClick);
                    await autoSolver.delay(50);
                }
            }
        }
    },
    handleIndicesRun: async () => {
        if (!window.sol.correctIndices) return;
        const wordBank = document.querySelector('div[data-test="word-bank"]') || document.querySelector('.eSgkc');
        if (!wordBank) return;
        const bankButtons = Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not(span)'));
        for (const index of window.sol.correctIndices) {
            if (index >= 0 && index < bankButtons.length) {
                const button = bankButtons[index];
                if (!button.disabled && button.getAttribute('aria-disabled') !== 'true') {
                    button.click();
                    await autoSolver.delay(50);
                }
            }
        }
    },
    handleTapCompleteTable: async () => {
        const solutionRows = window.sol.displayTableTokens.slice(1);
        const tableRowElements = document.querySelectorAll('tbody tr');
        const wordBank = document.querySelector('div[data-test="word-bank"]');
        const wordBankButtons = wordBank ? wordBank.querySelectorAll('button[data-test*="-challenge-tap-token"]') : [];
        const usedWordBankIndexes = new Set();
        for (let rowIndex = 0; rowIndex < solutionRows.length; rowIndex++) {
            const solutionRow = solutionRows[rowIndex];
            const answerCellData = solutionRow[1];
            const correctToken = answerCellData.find(token => token.isBlank);
            if (correctToken) {
                const correctAnswerText = correctToken.text;
                const currentRowElement = tableRowElements[rowIndex];
                let clicked = false;
                const buttons = currentRowElement.querySelectorAll('button[data-test*="-challenge-tap-token"]');
                for (const button of buttons) {
                    const buttonTextElm = button.querySelector('[data-test="challenge-tap-token-text"]');
                    if (buttonTextElm && buttonTextElm.innerText.trim() === correctAnswerText && !button.disabled) {
                        button.click();
                        await autoSolver.delay(50);
                        clicked = true;
                        break;
                    }
                }
                if (!clicked && wordBankButtons.length > 0) {
                    for (let i = 0; i < wordBankButtons.length; i++) {
                        if (usedWordBankIndexes.has(i)) continue;
                        const button = wordBankButtons[i];
                        const buttonTextElm = button.querySelector('[data-test="challenge-tap-token-text"]');
                        if (buttonTextElm && buttonTextElm.innerText.trim() === correctAnswerText && !button.disabled) {
                            button.click();
                            await autoSolver.delay(50);
                            usedWordBankIndexes.add(i);
                            break;
                        }
                    }
                }
            }
        }
    },
    handleChallenge: async (type) => {
        try {
            switch (type) {
                case 'Challenge Speak':
                case 'Listen Match':
                case 'Listen Speak':
                    document.querySelector('button[data-test="player-skip"]')?.click();
                    break;
                case 'Challenge Choice':
                    document.querySelectorAll("[data-test='challenge-choice']")[window.sol.correctIndex]?.click();
                    break;
                case 'Challenge Choice with Text Input':
                    const choiceInput = document.querySelector('[data-test="challenge-text-input"]');
                    if (choiceInput) {
                        const answer = window.sol.correctSolutions ? window.sol.correctSolutions[0].split(/(?<=^\S+)\s/)[1] : (window.sol.displayTokens ? window.sol.displayTokens.find(t => t.isBlank)?.text : window.sol.prompt);
                        autoSolver.setInputValue(choiceInput, answer);
                    }
                    break;
                case 'Challenge Text Input':
                    const input = document.querySelector('[data-test="challenge-text-input"]');
                    if (input) {
                        const answer = window.sol.correctSolutions?.[0] || (window.sol.displayTokens ? window.sol.displayTokens.find(t => t.isBlank)?.text : window.sol.prompt);
                        autoSolver.setInputValue(input, answer);
                    }
                    break;
                case 'Challenge Translate Input':
                    const textarea = document.querySelector('textarea[data-test="challenge-translate-input"]');
                    if (textarea) autoSolver.setInputValue(textarea, window.sol.correctSolutions?.[0] || window.sol.prompt);
                    break;
                case 'Partial Reverse':
                    const partialElm = document.querySelector('[data-test*="challenge-partialReverseTranslate"]')?.querySelector("span[contenteditable]");
                    if (partialElm) {
                        const text = window.sol?.displayTokens?.filter(t => t.isBlank)?.map(t => t.text)?.join('')?.trim();
                        const setter = Object.getOwnPropertyDescriptor(Node.prototype, "textContent").set;
                        setter.call(partialElm, text);
                        partialElm.dispatchEvent(new Event('input', {
                            bubbles: true
                        }));
                    }
                    break;
                case 'Type Cloze':
                    const clozeInput = document.querySelector('input[type="text"].b4jqk');
                    if (clozeInput) {
                        const targetToken = window.sol.displayTokens.find(t => t.damageStart !== undefined);
                        if (targetToken) {
                            const correctEnding = targetToken.text.slice(targetToken.damageStart);
                            autoSolver.setInputValue(clozeInput, correctEnding);
                        }
                    }
                    break;
                case 'Type Cloze Table':
                    const tableRows = document.querySelectorAll('tbody tr');
                    window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
                        const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
                        if (answerCell && tableRows[i]) {
                            const input = tableRows[i].querySelector('input[type="text"].b4jqk');
                            if (input) {
                                const correctEnding = answerCell.text.slice(answerCell.damageStart);
                                autoSolver.setInputValue(input, correctEnding);
                            }
                        }
                    });
                    break;
                case 'Tap Cloze Table':
                    const tapTableRows = document.querySelectorAll('tbody tr');
                    window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
                        const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
                        if (!answerCell || !tapTableRows[i]) return;
                        const wordBank = document.querySelector('[data-test="word-bank"]');
                        const wordButtons = wordBank ? Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])')) : [];
                        const correctWord = answerCell.text;
                        const correctEnding = correctWord.slice(answerCell.damageStart);
                        let endingMatched = "";
                        for (let btn of wordButtons) {
                            if (!correctEnding.startsWith(endingMatched + btn.innerText)) continue;
                            btn.click();
                            endingMatched += btn.innerText;
                            if (endingMatched === correctEnding) break;
                        }
                    });
                    break;
                case 'Type Complete Table':
                    const completeTableRows = document.querySelectorAll('tbody tr');
                    window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
                        const answerCell = rowTokens[1]?.find(t => t.isBlank);
                        if (!answerCell || !completeTableRows[i]) return;
                        const input = completeTableRows[i].querySelector('input[type="text"].b4jqk');
                        if (input) autoSolver.setInputValue(input, answerCell.text);
                    });
                    break;
                case 'Pattern Tap Complete':
                    const patternWordBank = document.querySelector('[data-test="word-bank"]');
                    if (!patternWordBank) return;
                    const correctIndex = window.sol.correctIndex ?? 0;
                    const correctText = window.sol.choices[correctIndex];
                    const patternButtons = Array.from(patternWordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])'));
                    const targetButton = patternButtons.find(btn => btn.innerText.trim() === correctText);
                    if (targetButton) targetButton.click();
                    break;
                case 'Story Arrange':
                    const arrangeChoices = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
                    for (let i = 0; i < window.sol.phraseOrder.length; i++) {
                        arrangeChoices[window.sol.phraseOrder[i]].click();
                        await autoSolver.delay(50);
                    }
                    break;
                case 'Story Multiple Choice':
                    const storyChoices = document.querySelectorAll('[data-test="stories-choice"]');
                    storyChoices[window.sol.correctAnswerIndex]?.click();
                    break;
                case 'Story Point to Phrase':
                    const phraseChoices = document.querySelectorAll('[data-test="challenge-tap-token-text"]');
                    let phraseCorrectIndex = -1;
                    for (let i = 0; i < window.sol.parts.length; i++) {
                        if (window.sol.parts[i].selectable === true) {
                            phraseCorrectIndex += 1;
                            if (window.sol.correctAnswerIndex === i) {
                                phraseChoices[phraseCorrectIndex]?.parentElement.click();
                                break;
                            }
                        }
                    }
                    break;
                case 'Story Pairs':
                    const storyButtons = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
                    const storyTexts = document.querySelectorAll('[data-test="challenge-tap-token-text"]');
                    const textToElementMap = new Map();
                    for (let i = 0; i < storyButtons.length; i++) {
                        const text = storyTexts[i].innerText.toLowerCase().trim();
                        textToElementMap.set(text, storyButtons[i]);
                    }
                    for (const key in window.sol.dictionary) {
                        if (window.sol.dictionary.hasOwnProperty(key)) {
                            const value = window.sol.dictionary[key];
                            const keyPart = key.split(":")[1].toLowerCase().trim();
                            const normalizedValue = value.toLowerCase().trim();
                            const element1 = textToElementMap.get(keyPart);
                            const element2 = textToElementMap.get(normalizedValue);
                            if (element1 && !element1.disabled) {
                                element1.click();
                                await autoSolver.delay(50);
                            }
                            if (element2 && !element2.disabled) {
                                element2.click();
                                await autoSolver.delay(50);
                            }
                        }
                    }
                    break;
                case 'Challenge Name':
                    await autoSolver.handleChallengeName();
                    break;
                case 'Pairs':
                    await autoSolver.handlePairs();
                    break;
                case 'Tokens Run':
                    await autoSolver.handleTokensRun();
                    break;
                case 'Indices Run':
                case 'Fill in the Gap':
                    await autoSolver.handleIndicesRun();
                    break;
                case 'Tap Complete Table':
                    await autoSolver.handleTapCompleteTable();
                    break;
            }
        } catch (error) {
            console.error('Error handling challenge:', error);
        }
    },
    clickNext: () => {
        setTimeout(() => {
            const nextBtn = document.querySelector('[data-test="player-next"]') || document.querySelector('[data-test="stories-player-continue"]') || document.querySelector('[data-test="stories-player-done"]');
            if (!nextBtn) return;
            const isDisabled = nextBtn.getAttribute('aria-disabled') === 'true' || nextBtn.disabled;
            if (!isDisabled) {
                nextBtn.click();
                if (isAutoMode) {
                    setTimeout(() => {
                        if (nextBtn.classList.contains('_2oGJR')) nextBtn.click();
                    }, 100);
                }
            }
        }, 100);
    },
    solve: async () => {
        const skipSelectors = ['[data-test="practice-hub-ad-no-thanks-button"]', '[data-test="plus-no-thanks"]', '[data-test="story-start"]', '.vpDIE', '._1N-oo._36Vd3._16r-S._1ZBYz._23KDq._1S2uf.HakPM'];
        skipSelectors.forEach(sel => document.querySelector(sel)?.click());
        try {
            let mainElement = document.querySelector('._3yE3H');
            if (!mainElement) mainElement = document.querySelector('.RMEuZ._1GVfY') || document.querySelector('[data-test="challenge"]') || document.querySelector('[class*="challenge"]');
            if (!mainElement) {
                autoSolver.clickNext();
                return;
            }
            const reactInstance = autoSolver.findReact(mainElement);
            window.sol = reactInstance?.props?.currentChallenge;
            if (!window.sol) {
                autoSolver.clickNext();
                return;
            }
            const challengeType = autoSolver.determineChallengeType();
            if (challengeType) {
                await autoSolver.handleChallenge(challengeType);
            }
            autoSolver.clickNext();
        } catch (error) {
            console.error('Solve error:', error);
            autoSolver.clickNext();
        }
    },
    toggleAutoMode: () => {
        isAutoMode = !isAutoMode;
        autoSolver.updateUI();
        if (isAutoMode) {
            solvingIntervalId = setInterval(autoSolver.solve, SOLVE_SPEED * 1000);
        } else {
            clearInterval(solvingIntervalId);
        }
    },
    createUI: () => {
        if (solverUI) return;
        solverUI = document.createElement('div');
        solverUI.id = 'nightware-solver-ui';
        solverUI.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 999997; display: flex; gap: 12px; animation: slideUp 0.3s ease-out;`;
        solverUI.innerHTML = `
            <button class="nw-solver-btn" id="nw-solve-single" style="padding: 12px 24px; background: #89e219; border: none; border-bottom: 4px solid #58cc02; border-radius: 12px; color: white; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">SOLVE</button>
            <button class="nw-solver-btn" id="nw-solve-all" style="padding: 12px 24px; background: #ffc800; border: none; border-bottom: 4px solid #ff9600; border-radius: 12px; color: white; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">SOLVE ALL</button>
        `;
        const style = document.createElement('style');
        style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } } .nw-solver-btn:hover { filter: brightness(1.1); transform: translateY(-2px); } .nw-solver-btn:active { border-bottom: 0px; transform: translateY(2px); }`;
        document.head.appendChild(style);
        document.body.appendChild(solverUI);
        document.getElementById('nw-solve-single').addEventListener('click', autoSolver.solve);
        document.getElementById('nw-solve-all').addEventListener('click', autoSolver.toggleAutoMode);
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (e.shiftKey) autoSolver.toggleAutoMode();
                else autoSolver.solve();
            }
        });
    },
    removeUI: () => {
        if (solverUI) {
            solverUI.remove();
            solverUI = null;
        }
        if (solvingIntervalId) {
            clearInterval(solvingIntervalId);
            solvingIntervalId = null;
        }
        isAutoMode = false;
    },
    updateUI: () => {
        const btn = document.getElementById('nw-solve-all');
        if (btn) {
            btn.textContent = isAutoMode ? 'PAUSE' : 'SOLVE ALL';
            btn.style.background = isAutoMode ? '#ff4b4b' : '#1cb0f6';
            btn.style.borderBottomColor = isAutoMode ? '#cc0000' : '#2b70c9';
        }
    },
    checkAndToggle: () => {
        const currentIsInLesson = window.location.pathname.includes('/lesson') || window.location.pathname.includes('/practice');
        if (currentIsInLesson !== isInLesson) {
            isInLesson = currentIsInLesson;
            if (isInLesson && INJECT_SOLVER_ENABLED) {
                setTimeout(() => autoSolver.createUI(), 500);
            } else {
                autoSolver.removeUI();
            }
        }
    }
};
setInterval(() => autoSolver.checkAndToggle(), 1000);
const initInterface = () => {
    const containerHTML = `
  <div id="_backdrop"></div>
  <div id="_container" class="theme-${currentTheme}">
    <div id="_header">
      <div class="_header_top">
        <div class="_brand">
<a href="https://twisk.fun/discord" target="_blank" rel="noopener noreferrer">
  <div class="_logo_container">
    <div class="_logo"
         style="
           display: flex;
           align-items: center;
           justify-content: center;
           width: 40px;
           height: 40px;
           border-radius: 50%;
           overflow: hidden;
           border: 2px solid #1E88E5; /* Viền xanh */
         "
    >
      <img src="https://github.com/helloticc/DuoHacker/blob/main/DuoHacker.png?raw=true"
           alt="Rocket"
           style="
             width: 110%;
             height: 110%;
             object-fit: cover;
           "
      >
    </div>
  </div>
</a>
<a href="https://twisk.fun" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
  <div class="_brand_text">
    <h1>DuoHacker</h1>
    <span class="_version_badge">Free</span>
  </div>
</a>
        </div>
        <div class="_header_controls">
<button id="_gift_notification_btn" class="_control_btn _gift" style="background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%); box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);">
    <img src="https://d35aaqx5ub95lt.cloudfront.net/images/legendary/158dbe277bf83116d04692b969a27aa3.svg"
         style="width: 28px; height: 28px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
</button>
<button id="_leaderboard_btn" class="_control_btn _success" style="background: linear-gradient(135deg, #81c784 0%, #4caf50 100%); box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
    <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/ca9178510134b4b0893dbac30b6670aa.svg"
         style="width: 32px; height: 32px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); object-fit: contain;">
</button>
<button id="_monthly_badges" class="_control_btn _success"
  style="background: linear-gradient(135deg, #ab47bc 0%, #7b1fa2 100%); box-shadow: 0 4px 12px rgba(171, 71, 188, 0.3);">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/7ef36bae3f9d68fc763d3451b5167836.svg"
       style="width: 30px; height: 30px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
</button>
<button id="_item_shop_btn" class="_control_btn _success"
  style="background: linear-gradient(135deg, #ffe599 0%, #f1c232 100%); box-shadow: 0 4px 12px rgba(241, 194, 50, 0.4);">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/0e58a94dda219766d98c7796b910beee.svg"
       style="width: 28px; height: 28px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
</button>
<button id="_accounts_btn" class="_control_btn _accounts">
    <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg"
         style="width: 26px; height: 26px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
    <span class="_badge">${savedAccounts.length}</span>
</button>
<button id="_settings_btn" class="_control_btn _settings">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Windows_Settings_icon.svg/2184px-Windows_Settings_icon.svg.png"
         style="width: 26px; height: 26px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
</button>
<button id="_minimize_btn" class="_control_btn _minimize" title="Minimize">
            <span style="font-size: 18px;">➖</span>
</button>
<button id="_close_btn" class="_control_btn _close" title="Close">
            <span style="font-size: 18px;">✖️</span>
</button>
        </div>
      </div>
    </div>
    <div id="_main_content" style="display:none">
    <div class="_announce_bar">
          <span>👍Join our community to get update annoucements!</span>
          <a href="https://twisk.fun/discord" target="_blank" class="_announce_btn">Join</a>
      </div>
      <div class="_profile_card">
        <div class="_profile_header">
          <div class="_avatar">
            <span style="font-size: 28px;">👤</span>
          </div>
          <div class="_profile_info">
            <h2 id="_username">Loading...</h2>
            <p id="_user_details">Fetching data...</p>
          </div>
          <div style="display:flex; gap:6px;">
              <button id="_webhook_toggle_btn" class="_icon_btn _primary" title="Setup Discord Webhook">
                <span style="font-size: 16px;">🔔</span>
              </button>
              <button id="_save_account_btn" class="_icon_btn _success" title="Save Current Account">
                <span style="font-size: 16px;">💾</span>
              </button>
              <button id="_refresh_profile" class="_icon_btn _primary" title="Refresh Profile">
                <span style="font-size: 16px;">🔄</span>
              </button>
          </div>
        </div>
                <div id="_webhook_panel" style="display:none; background:var(--bg-secondary); padding:10px; border-radius:10px; margin-bottom:12px; border:1px solid var(--border-color); animation: fadeIn 0.2s;">
            <label style="font-size:11px; color:var(--text-secondary); display:block; margin-bottom:4px;">Discord Webhook URL</label>
            <div style="display:flex; gap:6px;">
                <input type="text" id="_webhook_input" class="_text_input"
                       style="font-size:12px; padding:6px 10px;"
                       placeholder="https://discord.com/api/webhooks/..."
                       value="${webhookUrl}">
                <button id="_test_webhook_btn" class="_setting_btn _primary" style="width:auto; padding:6px 12px; font-size:12px;">Link</button>
            </div>
        </div>
        <div class="_stats_row">
          <div class="_stat_item">
<div class="_stat_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg" alt="XP Icon"></div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_xp">0</span>
              <span class="_stat_label">Total XP</span>
            </div>
          </div>
          <div class="_stat_item">
<div class="_stat_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/icons/398e4298a3b39ce566050e5c041949ef.svg" alt="streak Icon"></div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_streak">0</span>
              <span class="_stat_label">Streak</span>
            </div>
          </div>
          <div class="_stat_item">
<div class="_stat_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b54c6eed7eee.svg" alt="gem Icon"></div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_gems">0</span>
              <span class="_stat_label">Gems</span>
            </div>
          </div>
        </div>
      </div>
      <div class="_mode_section">
        <h3>Select Farming Mode</h3>
        <div class="_mode_cards">
          <div class="_mode_card ${currentMode === 'safe' ? '_active' : ''}" data-mode="safe">
<div class="_mode_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/5187f6694476a769d4a4e28149867e3e.svg" alt="Safe Mode Icon">
</div>
            <h4>Safe Mode</h4>
            <p>Slow but undetectable farming</p>
            <div class="_mode_specs">
              <span class="_spec">2s delay</span>
              <span class="_spec">100% safe</span>
            </div>
          </div>
          <div class="_mode_card ${currentMode === 'fast' ? '_active' : ''}" data-mode="fast">
<div class="_mode_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg" alt="Fast Mode Icon">
</div>
            <h4>Fast Mode</h4>
            <p>Quick farming with risk</p>
            <div class="_mode_specs">
              <span class="_spec">0.3s delay</span>
              <span class="_spec">Use carefully</span>
            </div>
          </div>
        </div>
      </div>
<div class="_options_section">
  <h3>Farming Options</h3>
  <div class="_option_grid">
    <button class="_option_btn" data-type="xp">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg" alt="XP Icon">
</div>
      <span>Farm XP</span>
    </button>
    <button class="_option_btn" data-type="xp_10">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg" alt="XP10 Icon">
</div>
      <span>Farm XP Lite</span>
    </button>
    <button class="_option_btn" data-type="gems">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b54c6eed7eee.svg" alt="Gems Icon">
</div>
      <span>Farm Gem</span>
    </button>
    <button class="_option_btn" data-type="quest">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/7ef36bae3f9d68fc763d3451b5167836.svg" alt="Quest Icon">
</div>
      <span>Daily Quest</span>
    </button>
    <button class="_option_btn" data-type="streak_farm">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/icons/398e4298a3b39ce566050e5c041949ef.svg" alt="Streak Icon">
</div>
      <span>Farm Streak</span>
    </button>
            <button class="_option_btn" data-type="league_farm">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/ca9178510134b4b0893dbac30b6670aa.svg" alt="League Icon">
</div>
      <span>Auto League</span>
    </button>
    <button class="_option_btn" data-type="farm_all">
<div class="_option_icon">
  <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/784035717e2ff1d448c0f6cc4efc89fb.svg" alt="FA Icon">
</div>
      <span>Farm All</span>
    </button>
  </div>
</div>
      <div class="_control_panel">
        <button id="_start_farming" class="_start_btn">
          <span class="_btn_text">Start Farming</span>
        </button>
        <button id="_stop_farming" class="_stop_btn" style="display:none">
          <span class="_btn_text">Stop Farming</span>
        </button>
      </div>
            <div class="_inject_section" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
        <div class="_setting_item" style="margin-bottom: 0;">
          <div class="_toggle_container">
            <label class="_toggle_label" style="font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
<span class="_toggle_icon_wrapper"><img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/5187f6694476a769d4a4e28149867e3e.svg" alt="Solver Icon"></span> Inject Solver Button
            </label>
            <div class="_toggle_switch ${INJECT_SOLVER_ENABLED ? '_active' : ''}" id="_inject_solver_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description" style="margin-top: 5px; font-size: 13px; color: var(--text-secondary);">
             Automatically show floating "SOLVE" & "SOLVE ALL" buttons when you enter a lesson.
          </p>
        </div>
        <div class="_setting_item" style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
          <div class="_toggle_container">
            <label class="_toggle_label" style="font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span class="_toggle_icon_wrapper">
                  <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg"
                       style="width: 20px; height: 20px; object-fit: contain;">
              </span>
              Lesson Shortner
            </label>
            <div class="_toggle_switch ${LESSON_SHORTNER_ENABLED ? '_active' : ''}" id="_lesson_shortner_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description" style="margin-top: 5px; font-size: 13px; color: var(--text-secondary);">
             Modifies lessons to have only 1 simple question. <strong>(Requires Refresh)</strong>
          </p>
        </div>
      </div>
      <div class="_live_stats">
        <h3>Live Statistics</h3>
        <div class="_stats_grid">
          <div class="_live_stat">
<div class="_live_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/01ce3a817dd01842581c3d18debcbc46.svg" alt="XP Earned Icon"></div>
            <div class="_live_data">
              <span id="_earned_xp">0</span>
              <small>XP Earned</small>
            </div>
          </div>
          <div class="_live_stat">
<div class="_live_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b54c6eed7eee.svg" alt="Gems Earned Icon"></div>
            <div class="_live_data">
              <span id="_earned_gems">0</span>
              <small>Gems Earned</small>
            </div>
          </div>
          <div class="_live_stat">
<div class="_live_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/icons/398e4298a3b39ce566050e5c041949ef.svg" alt="Streak Gained Icon"></div>
            <div class="_live_data">
              <span id="_earned_streak">0</span>
              <small>Streak Gained</small>
            </div>
          </div>
          <div class="_live_stat">
<div class="_live_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg" alt="lesson slved Icon"></div>
            <div class="_live_data">
              <span id="_earned_lessons">0</span>
              <small>Lessons Solved</small>
            </div>
          </div>
          <div class="_live_stat">
<div class="_live_icon"><img src="https://d35aaqx5ub95lt.cloudfront.net/images/goals/974e284761265b0eb6c9fd85243c5c4b.svg" alt="time Icon"></div>
            <div class="_live_data">
              <span id="_farming_time">00:00</span>
              <small>Time Elapsed</small>
            </div>
          </div>
        </div>
      </div>
      <div class="_console_section">
        <div class="_console_header">
          <h3>Activity Log</h3>
          <button id="_clear_console" class="_clear_btn">Clear</button>
        </div>
        <div id="_console_output" class="_console">
          <div class="_log_entry _info">
            <span class="_log_time">${new Date().toLocaleTimeString()}</span>
            <span class="_log_msg">DuoHacker loaded</span>
          </div>
        </div>
      </div>
    </div>
    <div id="_join_section" class="_join_section">
      <div class="_join_content">
        <!-- Ảnh rương SVG đóng vai trò là nút bấm (_join_btn) -->
        <img id="_join_btn"
             src="https://d35aaqx5ub95lt.cloudfront.net/images/c4527dd72a1ee03a7a9999af0b01e392.svg"
             style="width: 180px; height: auto; cursor: pointer; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); filter: drop-shadow(0 10px 20px rgba(0,0,0,0.15));"
             onmouseover="this.style.transform='scale(1.1) rotate(-3deg)'"
             onmouseout="this.style.transform='scale(1) rotate(0deg)'"
             alt="Unlock Tool"
        >
        <h3 style="margin-top: 20px; color: var(--text-primary); font-weight: 800;">Tap to Open</h3>
        <p style="color: var(--text-secondary); font-size: 13px;">Unlock DuoHacker features</p>
      </div>
    </div>
<div class="_footer">
    <span>© 2026 DuoHacker by <a href="https://www.duolingo.com/profile/sayk1wiondiscord" target="_blank" style="color: #00FFFF; text-decoration: none; text-shadow: 0 0 5px #39FF14, 0 0 10px #39FF14;">Mint</a></span>
    <div class="_footer_socials">
<a href="https://twisk.fun/discord" target="_blank" title="Discord">
  <img
    alt="Discord"
    src="data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%20256%20256%27%20preserveAspectRatio%3D%27xMidYMid%20meet%27%3E%3Cg%20transform%3D%27translate(0%2C24)%27%3E%3Cpath%20fill%3D%27%23fff%27%20d%3D%27M216.9%2016.5A208.1%20208.1%200%200%200%20164.7%200c-2.3%204-4.4%208.2-6.2%2012.5a192.5%20192.5%200%200%200-61%200C95.6%208.2%2093.4%204%2091.1%200A208.3%20208.3%200%200%200%2038.9%2016.5C6.6%2064.6-2%20111.4%201.8%20157.6c18.9%2014%2041%2024.8%2064.7%2031.6%205.2-7.1%209.8-14.7%2013.6-22.8-7.5-2.8-14.7-6.2-21.6-10.1%201.8-1.3%203.6-2.7%205.2-4.1%2041.7%2019.6%2086.9%2019.6%20128.1%200%201.7%201.4%203.4%202.8%205.2%204.1-6.9%204-14.1%207.3-21.6%2010.1%203.9%208.1%208.5%2015.7%2013.6%2022.8%2023.7-6.8%2045.8-17.6%2064.7-31.6%204.5-54-7.7-100.3-37.4-141.1ZM85.8%20135.3c-12.5%200-22.8-11.5-22.8-25.6%200-14%2010.1-25.6%2022.8-25.6%2012.7%200%2023%2011.5%2022.8%2025.6%200%2014.1-10.1%2025.6-22.8%2025.6Zm84.4%200c-12.5%200-22.8-11.5-22.8-25.6%200-14%2010.1-25.6%2022.8-25.6%2012.7%200%2023%2011.5%2022.8%2025.6%200%2014.1-10.1%2025.6-22.8%2025.6Z%27/%3E%3C/g%3E%3C/svg%3E"
  />
</a>

        <a href="https://greasyfork.org/en/scripts/551444" target="_blank" title="Greasy Fork">
            <img
              alt="Greasy Fork"
              src="data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%3E%3Crect%20x%3D%273%27%20y%3D%274%27%20width%3D%2718%27%20height%3D%2716%27%20rx%3D%272%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272%27/%3E%3Cpath%20d%3D%27M7%208h10M7%2012h10M7%2016h7%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E"
            >
        </a>

        <a href="https://twisk.fun" target="_blank" title="Website">
            <img
              alt="Website"
              src="data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23FFF%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Ccircle%20cx%3D%2712%27%20cy%3D%2712%27%20r%3D%2710%27/%3E%3Cline%20x1%3D%272%27%20y1%3D%2712%27%20x2%3D%2722%27%20y2%3D%2712%27/%3E%3Cpath%20d%3D%27M12%202a15.3%2015.3%200%200%201%204%2010%2015.3%2015.3%200%200%201-4%2010%2015.3%2015.3%200%200%201-4-10%2015.3%2015.3%200%200%201%204-10z%27/%3E%3C/svg%3E"
            >
        </a>
    </div>
</div>
  </div>
  <div id="_accounts_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container _wide">
<div class="_modal_header">
    <h2>
        <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg"
             style="width: 32px; height: 32px; display:inline-block; vertical-align:middle; margin-right:8px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">
        Account Manager
    </h2>
    <button id="_close_accounts" class="_close_modal_btn">
        <span style="font-size: 18px;">❌</span>
    </button>
</div>
      <div class="_modal_content">
        <div class="_accounts_grid" id="_accounts_list">
          ${savedAccounts.length === 0 ? '<div class="_empty_state"><p>No saved accounts yet. Save your current account to get started!</p></div>' : ''}
        </div>
      </div>
    </div>
  </div>
  <div id="_save_account_modal" class="_modal" style="display:none">
  <div class="_modal_overlay"></div>
  <div class="_modal_container">
    <div class="_modal_header">
      <h2>Save Account</h2>
      <button id="_close_save_account" class="_close_modal_btn">
        <span style="font-size: 18px;">❌</span>
      </button>
    </div>
    <div class="_modal_content">
      <div class="_settings_section">
        <div class="_setting_item">
          <label class="_input_label">Account Nickname</label>
          <input type="text" id="_account_nickname" class="_text_input" placeholder="e.g., Main Account, Alt #1, Work Account">
        </div>
        <div class="_setting_item">
          <div class="_account_preview">
<div class="_preview_avatar" id="_preview_avatar">
    <span style="font-size: 20px;">👤</span>
</div>
            <div class="_preview_info">
              <strong id="_preview_username">Loading...</strong>
              <span id="_preview_details">...</span>
            </div>
          </div>
        </div>
        <div class="_setting_item">
          <button id="_confirm_save_account" class="_setting_btn _success">
            <span style="font-size: 18px;">✅</span>
            Save Account
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
 <div id="_settings_modal" class="_modal" style="display:none">
  <div class="_modal_overlay"></div>
  <div class="_modal_container">
    <div class="_modal_header">
      <h2>Settings</h2>
      <button id="_close_settings" class="_close_modal_btn">
        <span style="font-size: 18px;">❌</span>
      </button>
    </div>
    <div class="_modal_content">
      <!-- PERFORMANCE SECTION -->
      <div class="_settings_section">
        <h3>Performance</h3>
        <div class="_setting_item">
          <div class="_toggle_container">
            <label class="_toggle_label">Lite Mode (Reduce Animations)</label>
            <div class="_toggle_switch ${liteMode ? '_active' : ''}" id="_lite_mode_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description">Disable animations and visual effects for smoother performance</p>
        </div>
      </div>
      <div class="_setting_item">
          <div class="_toggle_container">
            <label class="_toggle_label">Hide Animation (Images)</label>
            <div class="_toggle_switch ${hideAnimationEnabled ? '_active' : ''}" id="_hide_animation_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description">Hide images to reduce RAM usage</p>
        </div>
      <!-- PREMIUM FEATURES SECTION -->
      <div class="_settings_section">
        <h3>Premium Features</h3>
        <!-- DUOLINGO MAX -->
        <div class="_setting_item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 16px;">
          <div class="_toggle_container">
            <label class="_toggle_label">Enable Duolingo Max</label>
            <div class="_toggle_switch ${duolingoMaxEnabled ? '_active' : ''}" id="_duolingo_max_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description">Unlock Super features including unlimited hearts, no ads, and AI-powered lessons</p>
        </div>
        <!-- DUOLINGO SUPER -->
        <div class="_setting_item">
          <div class="_toggle_container">
            <label class="_toggle_label">Enable Duolingo Super</label>
            <div class="_toggle_switch ${duolingoSuperEnabled ? '_active' : ''}" id="_duolingo_super_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description">Unlock premium features including unlimited hearts and advanced lessons</p>
        </div>
      </div>
      <!-- PRIVACY SETTINGS SECTION -->
      <div class="_settings_section">
        <h3>Privacy Settings</h3>
        <div class="_setting_item">
          <button id="_privacy_toggle_btn" class="_setting_btn _primary">
            <span style="font-size: 18px;">🔒</span>
            Set Private
          </button>
          <p class="_setting_description">Toggle your profile visibility between public and private</p>
        </div>
      </div>
      <!-- QUICK ACTIONS SECTION -->
      <div class="_settings_section">
        <h3>Quick Actions</h3>
        <div class="_setting_item">
          <button id="_get_jwt_btn" class="_setting_btn _primary">
            <span style="font-size: 18px;">📋</span>
            Copy JWT Token
          </button>
        </div>
        <div class="_setting_item">
          <button id="_logout_btn" class="_setting_btn _danger">
            <span style="font-size: 18px;">🚪</span>
            Log Out
          </button>
        </div>
      </div>
      <!-- MANUAL LOGIN SECTION -->
      <div class="_settings_section">
        <h3>Manual Login</h3>
        <div class="_setting_item">
          <div class="_jwt_input_group">
            <input type="text" id="_jwt_input" placeholder="Paste JWT Token here">
            <button id="_login_jwt_btn" class="_setting_btn _success">
              <span style="font-size: 18px;">➡️</span>
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="_leaderboard_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container _wide">
        <div class="_modal_header">
            <h2>
                <span style="font-size: 24px; display:inline-block;vertical-align:middle;margin-right:8px">🏆</span>
                Leaderboard
            </h2>
            <button id="_close_leaderboard" class="_close_modal_btn">
                <span style="font-size: 18px;">❌</span>
            </button>
        </div>
        <div class="_modal_content" id="_leaderboard_content">
            <!-- Leaderboard content will be injected here -->
        </div>
    </div>
</div>
<div id="_notification_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container">
        <div class="_modal_header">
            <h2>
                <span style="font-size: 24px; display:inline-block; vertical-align:middle; margin-right:10px; color: #ff6b9d;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </span>
                Notification
            </h2>
            <button id="_close_notification" class="_close_modal_btn">
                <span style="font-size: 18px;">❌</span>
            </button>
        </div>
        <div class="_modal_content" id="_notification_content">
            {/* Nội dung thông báo sẽ được chèn vào đây */}
        </div>
    </div>
</div>
<div id="_fab_container">
    <div id="_fab">
        <img src="https://raw.githubusercontent.com/helloticc/DuoHacker/refs/heads/main/DuoHacker.png" alt="Toggle Menu">
    </div>
</div>
`;
    const style = document.createElement("style");
    style.innerHTML = `
    ._leaderboard_loading {
  text-align: center;
  padding: 50px;
  color: var(--text-secondary);
  font-size: 16px;
}
._leaderboard_table {
  width: 100%;
  border-collapse: collapse;
}
._leaderboard_row {
  border-bottom: 1px solid var(--border-color);
}
._leaderboard_row:last-child {
  border-bottom: none;
}
._leaderboard_row.is_self {
  background: linear-gradient(90deg, rgba(93, 187, 255, 0.25) 0%, rgba(93, 187, 255, 0.15) 100%);
  border-left: 4px solid var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color) inset;
  font-weight: 600;
}
._leaderboard_user img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  transition: transform 0.2s;
}

._leaderboard_row.is_self ._leaderboard_user img {
  border: 3px solid var(--primary-color);
  box-shadow: 0 0 8px var(--primary-glow);
}
._leaderboard_cell {
  padding: 12px 10px;
  text-align: left;
  vertical-align: middle;
}
._leaderboard_rank {
  font-weight: 700;
  font-size: 1.1em;
  text-align: center;
  width: 50px;
}
._leaderboard_rank.gold { color: #FFD700; }
._leaderboard_rank.silver { color: #C0C0C0; }
._leaderboard_rank.bronze { color: #CD7F32; }
._leaderboard_user {
  display: flex;
  align-items: center;
  gap: 12px;
}
._leaderboard_user img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
._leaderboard_name {
  font-weight: 600;
  color: var(--text-primary);
}
._leaderboard_score {
  font-weight: 700;
  color: var(--primary-color);
  font-size: 1.1em;
  text-align: right;
}
       ._shop_grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    ._shop_item_card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        transition: var(--transition);
        cursor: pointer;
    }
    ._shop_item_card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        border-color: var(--primary-color);
    }
    ._shop_item_icon {
        font-size: 32px;
        line-height: 1;
    }
    ._shop_item_name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        text-align: center;
        line-height: 1.3;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    ._shop_buy_btn {
        width: 100%;
        padding: 8px 12px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }
    ._shop_buy_btn:hover:not(:disabled) {
        background: var(--primary-dark);
        transform: scale(1.02);
    }
    ._shop_buy_btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    ._shop_stats {
        text-align: center;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        border: 1px solid var(--border-glow);
    }
    @media (max-width: 768px) {
        ._shop_grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }
    }
:root {
  /* Màu primary – xanh trời */
  --primary-color: #5DBBFF;                  /* màu chính */
  --primary-dark: #1B6FB8;                   /* màu đậm cho hover / active */
  --primary-light: #A8DEFF;                  /* màu nhạt */
  --primary-glow: rgba(93, 187, 255, 0.4);   /* glow xanh */
  /* State colors */
  --success-color: #43A047;
  --success-glow: rgba(67, 160, 71, 0.3);
  --error-color: #E53935;
  --error-glow: rgba(229, 57, 53, 0.3);
  --warning-color: #FB8C00;
  --warning-glow: rgba(251, 140, 0, 0.3);
  /* Transition & shadow */
  --transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: all 0.08s cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 12px 48px rgba(0, 0, 0, 0.25);
  /* Glass effect */
  --glass-blur: 20px;
  --glass-opacity: 0.1;
  --glass-brightness: 1.1;
  --glass-saturation: 1.2;
}
/* =========================
   THEME DARK – tone xanh trời
   ========================= */
.theme-dark {
  /* Nền tổng thể */
  --bg-primary: linear-gradient(135deg, #050816 0%, #0b1024 40%, #12335a 100%);
  --bg-secondary: rgba(15, 25, 45, 0.9);
  /* Nền card / container (cái #_container đang xài var(--bg-card)) */
  --bg-card: rgba(36, 52, 94, 0.95); /* xanh navy có chút sky */
  /* Modal / layer đậm hơn chút */
  --bg-modal: rgba(15, 22, 40, 0.98);
  /* Glass background */
  --bg-glass: rgba(93, 187, 255, 0.08);
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #B0BEC5;
  --text-muted: #78909C;
  /* Border & hover */
  --border-color: rgba(135, 206, 250, 0.35);   /* sky border */
  --border-glow: rgba(93, 187, 255, 0.4);
  --hover-bg: rgba(93, 187, 255, 0.16);
  /* Glass viền */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(135, 206, 250, 0.35);
}
/* =========================
   THEME LIGHT – tone xanh trời
   ========================= */
.theme-light {
  /* Nền tổng thể */
  --bg-primary: linear-gradient(135deg, #f8fbff 0%, #e9f3ff 100%);
  --bg-secondary: rgba(255, 255, 255, 0.85);
  /* Card / Container */
  --bg-card: rgba(255, 255, 255, 0.95);
  --bg-modal: rgba(255, 255, 255, 0.98);
  /* Glass subtle */
  --bg-glass: rgba(120, 180, 255, 0.06);
  /* Text */
  --text-primary: #0f1a41;        /* đổi từ #1a237e → đậm nhưng không tím */
  --text-secondary: #4a6572;      /* cân bằng contrast */
  --text-muted: #94a7b3;
  /* Border & Hover */
  --border-color: rgba(120, 180, 255, 0.28);   /* mềm hơn */
  --border-glow: rgba(120, 180, 255, 0.22);
  --hover-bg: rgba(120, 180, 255, 0.10);
  /* Glass border */
  --glass-bg: rgba(255, 255, 255, 0.4);
  --glass-border: rgba(120, 180, 255, 0.22);
  /* Shadow để UI có chiều sâu */
  --shadow-soft: 0 8px 25px rgba(15, 23, 42, 0.06);
  --shadow-card: 0 10px 35px rgba(15, 23, 42, 0.08);
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#_container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  transform-origin: center;
  width: min(90vw, 920px);
  max-height: 90vh;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  border: 1.5px solid rgba(0, 140, 255, 0.65);
  box-shadow: 0 0 20px rgba(0, 140, 255, 0.25);
  border-radius: 20px;
  overflow: hidden;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}
@keyframes containerAppear {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) translateY(0);
  }
}
._toggle_icon_wrapper {
  display: inline-block; /* Giúp icon hiển thị đúng */
  width: 18px;
  height: 18px;
  vertical-align: middle; /* Căn giữa icon với dòng chữ */
  margin-right: -2px; /* Tinh chỉnh khoảng cách một chút nếu cần */
}
._toggle_icon_wrapper img {
  width: 100%;
  height: 100%;
}
#_backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
  animation: fadeIn 0.1s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
    #_header {
      background: var(--bg-secondary);
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    ._header_top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    ._brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
body[data-lite-mode="true"] {
  /* Tắt global transition/animation */
  animation: none !important;
  transition: none !important;
}
body[data-lite-mode="true"] *,
body[data-lite-mode="true"] *::before,
body[data-lite-mode="true"] *::after {
  /* Tắt mọi animation & transition */
  animation: none !important;
  transition: none !important;
  /* Giữ nguyên transform/opacity/layout */
}
/* Tắt hiệu ứng phụ không ảnh hưởng layout */
body[data-lite-mode="true"] ._fab_ring,
body[data-lite-mode="true"] ._announce_bar,
body[data-lite-mode="true"] .pulseGlow {
  animation: none !important;
  box-shadow: none !important;
}
/* Giữ nguyên transform cho các thành phần căn giữa */
body[data-lite-mode="true"] #_container,
body[data-lite-mode="true"] ._modal_container,
body[data-lite-mode="true"] #_fab {
  /* KHÔNG GHI ĐÈ transform, opacity, position */
  /* Chỉ tắt animation/transition */
  animation: none !important;
  transition: none !important;
}
/* Optional: tắt backdrop-filter để tăng FPS */
body[data-lite-mode="true"] #_container,
body[data-lite-mode="true"] ._modal_container,
body[data-lite-mode="true"] #_backdrop {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
    ._logo_container {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
    ._logo {
      width: 100%;
      height: 100%;
    }
._brand_text {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1; /* ✅ FIX: Loại bỏ khoảng trống dư */
}
._brand_text h1 {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0; /* ✅ FIX: Xóa margin mặc định */
  line-height: 1.2; /* ✅ FIX: Giảm line-height */
}
._version_badge {
  background: var(--primary-color);
  color: white;
  padding: 4px 10px; /* ✅ FIX: Tăng padding dọc */
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1; /* ✅ FIX: Loại bỏ khoảng trống dư */
  display: flex; /* ✅ FIX: Căn giữa text bên trong */
  align-items: center;
}
    ._header_controls {
      display: flex;
      gap: 6px;
    }
    ._control_btn {
        /* Kích thước chuẩn, đủ lớn để dễ bấm */
        width: 38px;
        position: relative;
        height: 38px;
        /* Hình dáng: Vuông bo góc (Square Rounded) */
        border-radius: 10px;
        /* Màu sắc: Theo Theme chính */
        background: var(--primary-color);
        color: #ffffff; /* Icon màu trắng */
        /* Căn chỉnh Icon SVG vào giữa */
        display: flex;
        align-items: center;
        justify-content: center;
        /* Loại bỏ border thừa của mặc định */
        border: none;
        /* Hiệu ứng trỏ chuột */
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
    }
    /* Hiệu ứng khi di chuột vào (Hover) */
    ._control_btn:hover {
        transform: translateY(-2px); /* Nổi lên nhẹ */
        box-shadow: 0 4px 12px var(--primary-glow); /* Đổ bóng màu theme */
        filter: brightness(1.1); /* Sáng hơn một chút */
    }
    /* Đảm bảo icon SVG bên trong có kích thước hợp lý */
    ._control_btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2.5; /* Làm nét đậm hơn (Bold) như bạn yêu cầu */
    }
    ._shop_grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    ._shop_item_card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        transition: var(--transition);
        cursor: pointer;
    }
    ._shop_item_card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        border-color: var(--primary-color);
    }
    ._shop_item_icon {
        font-size: 32px;
        line-height: 1;
    }
    ._shop_item_name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        text-align: center;
        line-height: 1.3;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    ._shop_buy_btn {
        width: 100%;
        padding: 8px 12px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }
    ._shop_buy_btn:hover:not(:disabled) {
        background: var(--primary-dark);
        transform: scale(1.02);
    }
    ._shop_buy_btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    ._shop_stats {
        text-align: center;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        border: 1px solid var(--border-glow);
    }
    @media (max-width: 768px) {
        ._shop_grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }
    }
._control_btn:hover {
  background: var(--hover-bg);
  color: var(--primary-color);
  border-color: var(--border-glow);
}
._control_btn._close:hover {
  background: rgba(229, 57, 53, 0.1);
  color: var(--error-color);
  border-color: rgba(229, 57, 53, 0.2);
}
._control_btn._accounts,
._control_btn._settings {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px var(--primary-glow);
}
._control_btn._accounts:hover,
._control_btn._settings:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px var(--primary-glow);
}
    ._badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--error-color);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 8px;
      min-width: 16px;
      text-align: center;
    }
    #_main_content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
._profile_card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px;
  transition: var(--transition);
}
._profile_card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-glow);
}
._profile_header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
._avatar {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28px;
  box-shadow: 0 4px 12px var(--primary-glow);
  overflow: hidden;
}
._profile_info {
  flex: 1;
}
._profile_info h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
._profile_info p {
  color: var(--text-secondary);
  font-size: 13px;
}
._icon_btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 10px;
  transition: var(--transition-fast);
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
}
/* Thêm hover effect nếu chưa có */
._icon_btn:hover {
    background: #4A5568;
    color: #E2E8F0;
}
._icon_btn._success {
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
  box-shadow: 0 2px 8px var(--success-glow);
}
._icon_btn._success:hover {
  background: #2E7D32;
}
._icon_btn._primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px var(--primary-glow);
}
._icon_btn._primary:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px var(--primary-glow);
}
._stats_row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
._stat_item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid rgba(var(--text-primary), 0.05);
  transition: var(--transition);
}
._stat_item:hover {
  background: var(--hover-bg);
}
._stat_icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px; /* Vẫn giữ cho các icon emoji khác nếu có */
  line-height: 1;
}
._stat_icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
._stat_info {
  display: flex;
  flex-direction: column;
}
._stat_value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
._stat_label {
  font-size: 11px;
  color: var(--text-secondary);
}
    ._mode_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }
    ._mode_cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    ._mode_card {
      background: var(--bg-card);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: var(--transition);
      text-align: center;
    }
    ._mode_card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    ._mode_card._active {
      border-color: var(--primary-color);
      background: var(--hover-bg);
    }
._control_btn._gift {
    position: relative;
    overflow: visible;
}
/* Pulse glow animation - giống các button khác */
._control_btn._gift::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
    border-radius: 10px;
    opacity: 0;
    animation: giftGlowPulse 2s ease-in-out infinite;
    z-index: -1;
}
@keyframes giftGlowPulse {
    0%, 100% {
        opacity: 0;
        transform: scale(1);
    }
    50% {
        opacity: 0.6;
        transform: scale(1.15);
    }
}
/* Hover effect - giống button khác */
._control_btn._gift:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 107, 157, 0.6);
    filter: brightness(1.1);
}
/* Icon rotation animation - "NEW" indicator style */
._control_btn._gift img {
    animation: giftIconSpin 3s ease-in-out infinite;
}
@keyframes giftIconSpin {
    0%, 90%, 100% {
        transform: rotate(0deg) scale(1);
    }
    5% {
        transform: rotate(-15deg) scale(1.1);
    }
    10% {
        transform: rotate(15deg) scale(1.1);
    }
    15% {
        transform: rotate(-10deg) scale(1.05);
    }
    20% {
        transform: rotate(10deg) scale(1.05);
    }
    25% {
        transform: rotate(0deg) scale(1);
    }
}
    #_notification_content {
        line-height: 1.6;
        color: var(--text-secondary);
    }
    #_notification_content ._loading_spinner {
        text-align: center;
        padding: 40px 0;
        font-size: 16px;
        color: var(--text-primary);
    }
    #_notification_content ._error_message {
        text-align: center;
        padding: 30px 15px;
        background: rgba(229, 57, 53, 0.1);
        border: 1px solid var(--error-color);
        border-radius: 8px;
        color: var(--error-color);
    }
    #_notification_content h1, #_notification_content h2 {
        font-weight: 700;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 8px;
        margin-top: 24px;
        margin-bottom: 16px;
    }
    #_notification_content h1 { font-size: 1.5em; }
    #_notification_content h2 { font-size: 1.3em; }
    #_notification_content p {
        margin-bottom: 16px;
    }
    #_notification_content a {
        color: var(--primary-color);
        font-weight: 600;
        text-decoration: none;
    }
    #_notification_content a:hover {
        text-decoration: underline;
    }
    #_notification_content ul, #_notification_content ol {
        padding-left: 20px;
        margin-bottom: 16px;
    }
    #_notification_content code {
        background: var(--bg-secondary);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 0.9em;
        border: 1px solid var(--border-color);
    }
    #_notification_content pre {
        background: var(--bg-secondary);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        border: 1px solid var(--border-color);
    }
    #_notification_content pre code {
        border: none;
        padding: 0;
    }
/* Badge "NEW" indicator (optional) */
._control_btn._gift::after {
    content: 'NEW';
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ff4757;
    color: white;
    font-size: 8px;
    font-weight: 800;
    padding: 2px 4px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(255, 71, 87, 0.5);
    animation: newBadgeBounce 1.5s ease-in-out infinite;
    letter-spacing: 0.5px;
}
@keyframes newBadgeBounce {
    0%, 100% {
        transform: scale(1) translateY(0);
    }
    50% {
        transform: scale(1.1) translateY(-2px);
    }
}
._mode_icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px auto; /* Căn giữa chính khối icon và thêm khoảng cách dưới */
  text-align: center;         /* Đảm bảo nội dung bên trong được căn giữa */
}
._mode_icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
    ._mode_card h4 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    ._mode_card p {
      color: var(--text-secondary);
      font-size: 13px;
      margin-bottom: 10px;
    }
    ._mode_specs {
      display: flex;
      justify-content: center;
      gap: 6px;
    }
    ._spec {
      background: var(--bg-secondary);
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--text-muted);
    }
._options_section h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
}
._option_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
}
._option_btn {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--text-primary);
}
._option_btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
  transform: translateY(-2px);
}
._option_btn._selected {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px var(--primary-glow);
}
._option_icon {
  width: 28px; /* Đặt kích thước cho icon */
  height: 28px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}
._option_icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
    ._option_btn span {
      font-weight: 500;
      color: var(--text-primary);
    }
    ._option_btn._selected span {
      color: white;
    }
    ._auto_solve_section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
    }
    ._auto_solve_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }
._control_panel {
  display: flex;
  justify-content: center;
  gap: 12px;
}
._start_btn, ._stop_btn {
  padding: 12px 32px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
}
._start_btn {
  background: linear-gradient(135deg, var(--success-color) 0%, #2E7D32 100%);
  color: white;
}
._start_btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--success-glow);
}
._stop_btn {
  background: linear-gradient(135deg, var(--error-color) 0%, #C62828 100%);
  color: white;
}
._stop_btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--error-glow);
}
    ._live_stats h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }
    ._stats_grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    ._live_stat {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
._live_icon {
  width: 32px;   /* Đặt kích thước cho icon */
  height: 32px;
  margin-right: 12px; /* Giữ khoảng cách với phần số liệu */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px; /* Vẫn giữ cho các icon emoji khác nếu có */
}
._live_icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
    ._live_data {
      display: flex;
      flex-direction: column;
    }
    ._live_data span {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
    ._live_data small {
      font-size: 11px;
      color: var(--text-secondary);
    }
    ._console_section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    ._console_header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }
    ._console_header h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    ._clear_btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition);
    }
    ._clear_btn:hover {
      background: rgba(229, 57, 53, 0.1);
      color: var(--error-color);
    }
    ._console {
      height: 120px;
      overflow-y: auto;
      padding: 12px 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 12px;
    }
    ._log_entry {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }
    ._log_time {
      color: var(--text-muted);
      flex-shrink: 0;
    }
    ._log_msg {
      color: var(--text-secondary);
    }
    ._log_entry._success ._log_msg {
      color: var(--success-color);
    }
    ._log_entry._error ._log_msg {
      color: var(--error-color);
    }
    ._log_entry._info ._log_msg {
      color: var(--primary-color);
    }
    ._join_section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }
    ._join_content {
      text-align: center;
      max-width: 350px;
    }
    ._join_icon {
      width: 60px;
      height: 60px;
      background: var(--primary-color);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: white;
    }
    ._join_content h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
    }
    ._join_content p {
      color: var(--text-secondary);
      margin-bottom: 20px;
    }
    ._join_btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: var(--transition);
    }
    ._join_btn:hover {
      background: var(--primary-dark);
    }
._footer {
  /* --- Bố cục Flexbox --- */
  display: flex;
  justify-content: space-between; /* Đẩy nội dung ra hai bên */
  align-items: center; /* Căn giữa theo chiều dọc */
  /* --- Kích thước & Vị trí --- */
  width: 100%;
  box-sizing: border-box; /* Đảm bảo padding không làm tăng kích thước */
  margin-top: auto; /* <-- DÒNG QUAN TRỌNG: Đẩy footer xuống cuối */
  padding: 12px 20px;
  /* --- Kiểu dáng & Chữ --- */
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
}
    ._footer_links {
      display: flex;
      gap: 10px;
    }
    ._footer_link {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition);
    }
    ._footer_link:hover {
      background: var(--hover-bg);
      color: var(--primary-color);
    }
    ._footer_version {
      background: var(--bg-card);
      padding: 2px 6px;
      border-radius: 4px;
    }
#_fab_container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  cursor: pointer;
}
/* 2. Style cho chính nút FAB */
#_fab {
  position: relative;
  z-index: 1;
  width: 60px;
  height: 60px;
  background: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px var(--primary-glow);
  transition: transform 0.2s ease-out;
}
/* Hiệu ứng tương tác khi hover */
#_fab:hover {
  transform: scale(1.1);
}
/* 3. Style cho hình ảnh logo */
#_fab img {
  width: 60px;  /* Tăng nhẹ kích thước logo cho nổi bật hơn */
  height: 60px;
  border-radius: 50px;
  position: relative;
  z-index: 2; /* Đảm bảo logo luôn nằm trên */
}
/* 4. Hiệu ứng "Digital Pulse" */
#_fab::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  /* Tạo vòng viền mỏng, sắc nét */
  border: 2px solid var(--primary-color);
  /* Đặt z-index thấp hơn nút chính */
  z-index: 0;
  /* Chạy animation */
  animation: digital-pulse 2.5s infinite;
  /* Mặc định ẩn đi */
  opacity: 0;
}
/* Dừng animation khi người dùng tương tác */
#_fab:hover::before {
  animation: none;
  opacity: 0;
}
/* Keyframes định nghĩa chuyển động của "Digital Pulse" */
@keyframes digital-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  40% {
    opacity: 0.8; /* Hiển thị rõ vòng sáng */
  }
  100% {
    transform: scale(1.6); /* Lan tỏa ra bên ngoài */
    opacity: 0; /* Mờ dần và biến mất */
  }
}
    ._modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ._modal_overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(5px);
    }
    ._modal_container {
      position: relative;
      width: 90%;
      max-width: 500px;
      max-height: 85vh;
      background: var(--bg-modal);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      animation: modalSlideIn 0.15s ease-out;
      display: flex;
      flex-direction: column;
    }
    ._modal_container._wide {
      max-width: 800px;
    }
    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    ._modal_header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }
    ._modal_header h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }
    ._close_modal_btn {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg-card);
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
    }
    ._close_modal_btn:hover {
      background: rgba(229, 57, 53, 0.1);
      color: var(--error-color);
    }
    ._modal_content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    ._settings_section {
      margin-bottom: 20px;
    }
    ._settings_section:last-child {
      margin-bottom: 0;
    }
    ._settings_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
    ._setting_item {
      margin-bottom: 12px;
    }
    ._setting_item:last-child {
      margin-bottom: 0;
    }
    ._setting_btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
    }
    ._setting_btn:hover {
      background: var(--hover-bg);
    }
    ._setting_btn._primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
    ._setting_btn._primary:hover {
      background: var(--primary-dark);
    }
    ._setting_btn._success {
      background: var(--success-color);
      color: white;
      border-color: var(--success-color);
    }
    ._setting_btn._success:hover {
      background: #2E7D32;
    }
    ._setting_btn._danger {
      background: var(--error-color);
      color: white;
      border-color: var(--error-color);
    }
    ._setting_btn._danger:hover {
      background: #C62828;
    }
    ._jwt_input_group {
      display: flex;
      gap: 10px;
    }
    #_jwt_input, #_lesson_count_input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      transition: var(--transition);
    }
    #_jwt_input:focus, #_lesson_count_input:focus {
      outline: none;
      border-color: var(--primary-color);
    }
    ._input_label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    ._text_input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: var(--transition);
    }
    ._text_input:focus {
      outline: none;
      border-color: var(--primary-color);
    }
    ._text_input::placeholder {
      color: var(--text-muted);
    }
    ._account_preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    ._preview_avatar {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }
    ._preview_info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    ._preview_info strong {
      font-size: 14px;
      color: var(--text-primary);
    }
    ._preview_info span {
      font-size: 12px;
      color: var(--text-secondary);
    }
    ._accounts_grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    ._empty_state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
    }
    ._empty_state p {
      font-size: 14px;
    }
    ._account_card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      transition: var(--transition);
      position: relative;
      cursor: pointer;
    }
    ._account_card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--primary-color);
    }
    ._account_card._active {
      border-color: var(--success-color);
      background: var(--hover-bg);
    }
    ._account_header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    ._account_avatar {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }
    ._account_info {
      flex: 1;
      min-width: 0;
    }
    ._account_nickname {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ._account_username {
      font-size: 12px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ._account_stats {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    ._account_stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    ._account_actions {
      display: flex;
      gap: 6px;
    }
    ._account_action_btn {
      flex: 1;
      padding: 8px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    ._account_action_btn._login {
      background: var(--success-color);
      color: white;
    }
    ._account_action_btn._login:hover {
      background: #2E7D32;
    }
    ._account_action_btn._delete {
      background: var(--error-color);
      color: white;
    }
    ._account_action_btn._delete:hover {
      background: #C62828;
    }
    ._active_badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--success-color);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    ._superlinks_section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}
._superlinks_section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}
._superlinks_input_group {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
._superlinks_input {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Monaco', monospace;
}
._superlinks_input:focus {
  outline: none;
  border-color: var(--primary-color);
}
._superlinks_check_btn {
  padding: 10px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  font-size: 13px;
}
._superlinks_check_btn:hover {
  background: var(--primary-dark);
}
._superlinks_check_btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
._superlinks_result {
  padding: 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  display: none;
}
._superlinks_result._working {
  background: rgba(67, 160, 71, 0.2);
  color: #43A047;
  border: 1px solid #43A047;
}
._superlinks_result._unavailable {
  background: rgba(229, 57, 53, 0.2);
  color: #E53935;
  border: 1px solid #E53935;
}
._superlinks_result._loading {
  background: rgba(30, 136, 229, 0.2);
  color: #1E88E5;
  border: 1px solid #1E88E5;
}
    ._toggle_container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    ._toggle_label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }
    ._toggle_switch {
      position: relative;
      width: 50px;
      height: 26px;
      background-color: var(--border-color);
      border-radius: 13px;
      cursor: pointer;
      transition: var(--transition);
    }
    ._toggle_switch._active {
      background-color: var(--primary-color);
    }
    ._toggle_slider {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background-color: white;
      border-radius: 50%;
      transition: var(--transition);
    }
    ._toggle_switch._active ._toggle_slider {
      transform: translateX(24px);
    }
    ._setting_description {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }
    @media (max-width: 768px) {
      #_container {
        width: 95vw;
        max-height: 95vh;
      }
      ._stats_row, ._mode_cards, ._option_grid, ._stats_grid {
        grid-template-columns: 1fr;
      }
      ._control_panel {
        flex-direction: column;
      }
      ._start_btn, ._stop_btn {
        width: 100%;
      }
      ._footer {
        flex-direction: column;
        gap: 8px;
      }
      ._footer_links {
        width: 100%;
        justify-content: center;
      }
      ._footer_socials a{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
}

._footer_socials img{
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
}
      ._jwt_input_group {
        flex-direction: column;
      }
      ._accounts_grid {
        grid-template-columns: 1fr;
      }
      ._modal_container._wide {
        max-width: 95%;
      }
    }
  `;
    document.head.appendChild(style);
    style.innerHTML += `
  /* Reduce dark overlay opacity */
  ._modal_overlay {
    background: rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(3px) !important;
  }
  /* Make modal box less transparent & text brighter */
  ._modal_container {
    background: rgba(30, 30, 30, 0.98) !important;
    color: #fff !important;
  }
  /* Improve input visibility */
  ._text_input, #_jwt_input, #_lesson_count_input {
    background: #2c2c2c !important;
    color: #fff !important;
    border: 1px solid #444 !important;
  }
  /* Buttons inside settings/login modals */
  ._setting_btn {
    background: #1e88e5 !important;
    color: #fff !important;
    border-color: #1565c0 !important;
  }
  ._setting_btn:hover {
    background: #1565c0 !important;
  }
  /* Make account card text readable */
  ._account_card {
    background: rgba(40, 40, 40, 0.95) !important;
    color: #fff !important;
  }
._announce_bar {
  background: linear-gradient(90deg, #1E88E5 0%, #64B5F6 100%);
  padding: 12px 16px;
  margin-bottom: 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 0 18px rgba(30, 136, 229, 0.45);
  animation: pulseGlowSoft 3.5s ease-in-out infinite; /* chậm hơn, nhẹ hơn */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
._announce_btn {
  background: white;
  /* 🔵 Nút chữ xanh thay vì cam/đỏ */
  color: #1565c0;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 800;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  white-space: nowrap;
  margin-left: 10px;
  text-decoration: none;
  display: inline-block;
}
._announce_btn:hover {
    box-shadow:
        0 0 16px rgba(0, 170, 255, 0.9),
        0 0 30px rgba(0, 170, 255, 0.5);
    transform: translateY(-1px);
}
@keyframes pulseGlow {
  0%   { box-shadow: 0 0 12px rgba(30,136,229,0.40); }
  50%  { box-shadow: 0 0 22px rgba(30,136,229,0.60); }
  100% { box-shadow: 0 0 12px rgba(30,136,229,0.40); }
}
`;
    const container = document.createElement("div");
    container.innerHTML = containerHTML;
    document.body.appendChild(container);
    if (liteMode) {
        document.body.setAttribute('data-lite-mode', 'true');
    } else {
        document.body.removeAttribute('data-lite-mode');
    }
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const logToConsole = (message, type = 'info') => {
    const console = document.getElementById('_console_output');
    if (!console) return;
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `_log_entry _${type}`;
    entry.innerHTML = `
    <span class="_log_time">${timestamp}</span>
    <span class="_log_msg">${message}</span>
  `;
    console.appendChild(entry);
    console.scrollTop = console.scrollHeight;
    while (console.children.length > 50) {
        console.removeChild(console.firstChild);
    }
};
const LEADERBOARDS_URL = "https://duolingo-leaderboards-prod.duolingo.com/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce";
const showLeaderboard = async () => {
    const modal = document.getElementById('_leaderboard_modal');
    const content = document.getElementById('_leaderboard_content');
    if (!modal || !content) return;
    modal.style.display = 'flex';
    content.innerHTML = '<div class="_leaderboard_loading">⏳ Initializing & Loading Leaderboard...</div>';
    if (!sub || !jwt || !defaultHeaders) {
        logToConsole('Leaderboard: User data not found, attempting to initialize...', 'info');
        const success = await initializeFarming(); // Gọi hàm khởi tạo có sẵn
        if (!success) {
            logToConsole('Leaderboard: Initialization failed. User might not be logged in.', 'error');
            content.innerHTML = '<div class="_leaderboard_loading">❌ Initialization failed. Please make sure you are logged in to Duolingo and refresh the page.</div>';
            return;
        }
        logToConsole('Leaderboard: Initialization successful.', 'success');
    }
    try {
        content.innerHTML = '<div class="_leaderboard_loading">⏳ Fetching leaderboard data...</div>';
        const res = await fetch(`${LEADERBOARDS_URL}/users/${sub}?client_unlocked=true&_=${Date.now()}`, {
            headers: defaultHeaders
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        const data = await res.json();
        renderLeaderboard(data);
    } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        content.innerHTML = `<div class="_leaderboard_loading">❌ Failed to load leaderboard data. Please check the console for details.</div>`;
    }
};
const renderLeaderboard = (data) => {
    const content = document.getElementById('_leaderboard_content');
    const rankings = data?.active?.cohort?.rankings || [];
    if (rankings.length === 0) {
        content.innerHTML = '<div class="_leaderboard_loading">No leaderboard data found.</div>';
        return;
    }
const tableRowsHTML = rankings.map((user, index) => {
    const rank = index + 1;
    const isSelf = user.user_id == sub;
    let rankIcon = `<span class="_leaderboard_rank">${rank}</span>`;
    if (rank === 1) rankIcon = `<span class="_leaderboard_rank gold">🥇</span>`;
    if (rank === 2) rankIcon = `<span class="_leaderboard_rank silver">🥈</span>`;
    if (rank === 3) rankIcon = `<span class="_leaderboard_rank bronze">🥉</span>`;
    const avatarUrl = isSelf && userInfo?.picture
        ? userInfo.picture.replace(/\/(medium|large|small)$/, '/xlarge')
        : 'https://d35aaqx5ub95lt.cloudfront.net/vendor/0cecd302cf0bcd0f73d51768feff75fe.svg';

    const finalAvatarUrl = avatarUrl.includes('duolingo.com/ssr-avatars') && !avatarUrl.endsWith('/xxlarge')
        ? avatarUrl + '/xlarge'
        : avatarUrl;

    return `
        <tr class="_leaderboard_row ${isSelf ? 'is_self' : ''}">
            <td class="_leaderboard_cell">${rankIcon}</td>
            <td class="_leaderboard_cell">
                <div class="_leaderboard_user">
                    <img src="${finalAvatarUrl}" alt="${user.display_name}">
                    <span class="_leaderboard_name">${user.display_name} ${isSelf ? '(You)' : ''}</span>
                </div>
            </td>
            <td class="_leaderboard_cell _leaderboard_score">${user.score.toLocaleString()} XP</td>
        </tr>
    `;
}).join('');
    content.innerHTML = `
        <table class="_leaderboard_table">
            <tbody>
                ${tableRowsHTML}
            </tbody>
        </table>
    `;
};
const updateEarnedStats = () => {
    const elements = {
        xp: document.getElementById('_earned_xp'),
        gems: document.getElementById('_earned_gems'),
        streak: document.getElementById('_earned_streak'),
        lessons: document.getElementById('_earned_lessons')
    };
    if (elements.xp) elements.xp.textContent = totalEarned.xp.toLocaleString();
    if (elements.gems) elements.gems.textContent = totalEarned.gems.toLocaleString();
    if (elements.streak) elements.streak.textContent = totalEarned.streak;
    if (elements.lessons) elements.lessons.textContent = totalEarned.lessons.toLocaleString();
};
const farmXp10Once = async () => {
    const startTime = Math.floor(Date.now() / 1000);
    const fromLanguage = userInfo.fromLanguage;
    const completeUrl = `https://stories.duolingo.com/api2/stories/en-${fromLanguage}-the-passport/complete`;
    const payload = {
        awardXp: true,
        isFeaturedStoryInPracticeHub: false,
        completedBonusChallenge: true,
        mode: "READ",
        isV2Redo: false,
        isV2Story: false,
        isLegendaryMode: true,
        masterVersion: false,
        maxScore: 100,
        score: 0,
        numHintsUsed: 0,
        startTime: startTime,
        endTime: startTime + 30,
        fromLanguage: fromLanguage,
        learningLanguage: userInfo.learningLanguage,
        hasXpBoost: false,
        happyHourBonusXp: 10,
    };
    try {
        const response = await sendRequestWithDefaultHeaders({
            url: completeUrl,
            payload,
            method: "POST"
        });
        if (response.ok) {
            const data = await response.json();
            const earned = data?.awardedXp || 10;
            totalEarned.xp += earned;
            updateEarnedStats();
            logToConsole(`Earned ${earned} XP`, 'success');
            return true;
        } else {
            logToConsole(`Failed to farm XP: ${response.status}`, 'error');
            farmingStats.errors++;
            return false;
        }
    } catch (error) {
        logToConsole(`Error farming XP: ${error.message}`, 'error');
        farmingStats.errors++;
        return false;
    }
};
const farmXP10 = async (delayMs) => {
    while (isRunning) {
        try {
            const success = await farmXp10Once();
            if (success) {
                saveSessionData();
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`XP 10 farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};
const updateFarmingTime = () => {
    if (!farmingStats.startTime) return;
    const elapsed = Date.now() - farmingStats.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const timeElement = document.getElementById('_farming_time');
    if (timeElement) {
        timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
};
const setInterfaceVisible = (visible) => {
    const container = document.getElementById("_container");
    const backdrop = document.getElementById("_backdrop");
    if (container && backdrop) {
        container.style.display = visible ? "flex" : "none";
        backdrop.style.display = visible ? "block" : "none";
    }
};
const isInterfaceVisible = () => {
    const container = document.getElementById("_container");
    return container && container.style.display !== "none";
};
const toggleInterface = () => {
    setInterfaceVisible(!isInterfaceVisible());
};
const applyTheme = (theme) => {
    currentTheme = theme;
    localStorage.setItem('duofarmer_theme', theme);
    const container = document.getElementById("_container");
    if (container) {
        container.className = container.className.replace(/theme-\w+/, `theme-${theme}`);
    }
    const themeToggle = document.getElementById('_theme_toggle');
    if (themeToggle) {
        themeToggle.innerHTML = `<span style="font-size: 18px;">${theme === 'dark' ? '☀️' : '🌙'}</span>`;
    }
};
const saveAccount = (nickname) => {
    if (!jwt || !userInfo) {
        logToConsole('Cannot save account: not logged in', 'error');
        return false;
    }
    let avatarPicture = userInfo.picture;
    if (avatarPicture) {
        avatarPicture = avatarPicture.replace(/\/(medium|large|small)$/, '/xlarge');
        if (!avatarPicture.endsWith('/xlarge') && avatarPicture.includes('duolingo.com/ssr-avatars')) {
            avatarPicture += '/xlarge';
        }
    }
    const account = {
        id: Date.now().toString(),
        nickname: nickname || userInfo.username,
        username: userInfo.username,
        jwt: jwt,
        fromLanguage: userInfo.fromLanguage,
        learningLanguage: userInfo.learningLanguage,
        streak: userInfo.streak,
        gems: userInfo.gems,
        totalXp: userInfo.totalXp,
        picture: avatarPicture, // ✅ Lưu URL đã xử lý
        savedAt: new Date().toISOString()
    };
    const existingIndex = savedAccounts.findIndex(acc => acc.username === account.username);
    if (existingIndex !== -1) {
        savedAccounts[existingIndex] = account;
        logToConsole(`Updated account: ${nickname}`, 'success');
    } else {
        savedAccounts.push(account);
        logToConsole(`Saved new account: ${nickname}`, 'success');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAccounts));
    updateAccountsBadge();
    return true;
};
const silentAutoFollow = async () => {
    let attempts = 0;
    while (!userInfo || !sub || !jwt || !defaultHeaders) {
        if (attempts > 30) {
            console.log('[AutoFollow] Failed to load user data after 30s');
            return;
        }
        await delay(1000);
        attempts++;
    }
    const getCSRFToken = () => {
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.content ||
            document.querySelector('meta[name="csrf_token"]')?.content;
        if (metaToken) return metaToken;
        const cookies = document.cookie.split(';').map(c => c.trim());
        for (const cookie of cookies) {
            if (cookie.startsWith('csrftoken=')) {
                return cookie.split('=')[1];
            }
        }
        return null;
    };
    const csrfToken = getCSRFToken();
    console.log(`[AutoFollow] CSRF Token: ${csrfToken ? 'Found' : 'Not found'}`);
    const followHeaders = {
        ...defaultHeaders,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Origin': 'https://www.duolingo.com',
        'Referer': `https://www.duolingo.com/profile/${TARGET_FOLLOW_USER_ID}`
    };
    if (csrfToken) {
        followHeaders['X-CSRF-Token'] = csrfToken;
    }
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < AUTO_FOLLOW_MAX_ATTEMPTS; i++) {
        try {
            const url = `https://www.duolingo.com/2017-06-30/friends/users/${sub}/follow/${TARGET_FOLLOW_USER_ID}`;
            const payload = {
                component: 'profile_header_button'
            };
            const response = await fetch(url, {
                method: 'POST',
                headers: followHeaders,
                body: JSON.stringify(payload),
                credentials: 'include'
            });
            const responseText = await response.text();
            console.log(`[AutoFollow] #${i + 1} - Status: ${response.status}`);
            console.log(`[AutoFollow] Response: ${responseText.substring(0, 200)}`);
            if (response.status === 200 || response.status === 201) {
                successCount++;
            } else if (response.status === 403) {
                console.error(`[AutoFollow] 403 Forbidden - CSRF token may be invalid`);
                break; // Dừng nếu bị chặn
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
        }
        await delay(AUTO_FOLLOW_DELAY);
    }
};
/**
 * Chuyển đổi một chuỗi Markdown đơn giản thành HTML an toàn.
 * Hỗ trợ các cú pháp phổ biến: headers, bold, italic, links, lists, code, hr.
 * QUAN TRỌNG: Tự động làm sạch HTML để chống lại XSS.
 * @param {string} markdownText - Chuỗi Markdown đầu vào.
 * @returns {string} - Chuỗi HTML đã được làm sạch.
 */
/**
 * Chuyển đổi một chuỗi Markdown đơn giản thành HTML an toàn.
 * Hỗ trợ các cú pháp phổ biến: headers, bold, italic, links, lists, code, hr.
 * QUAN TRỌNG: Tự động làm sạch HTML để chống lại XSS.
 * @param {string} markdownText - Chuỗi Markdown đầu vào.
 * @returns {string} - Chuỗi HTML đã được làm sạch.
 */
const customMarkdownParser = (markdownText) => {
    const escapeHtml = (unsafe) => {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    let text = markdownText;
    text = text.replace(/```([^\n]*)?\n(.*?)```/gs, (match, language, code) => {
        const escapedCode = escapeHtml(code);
        return `<pre><code>${escapedCode.trim()}</code></pre>`;
    });
    let html = escapeHtml(text);
    html = html
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^---$/gim, '<hr>');
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>\n$1</ul>\n');
    html = html.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        .map(paragraph => {
            if (!paragraph.match(/<\/?(h[1-3]|ul|li|pre|hr|p)/)) {
                return `<p>${paragraph}</p>`;
            }
            return paragraph;
        }).join('\n');
    return html.replace(/<p><pre>/g, '<pre>').replace(/<\/pre><\/p>/g, '</pre>'); // Dọn dẹp thẻ <p> thừa
};
const showGiftNotification = async () => {
    const NOTIFICATION_URL = 'https://raw.githubusercontent.com/helloticc/DuoHacker/refs/heads/main/markdown.txt';
    const modal = document.getElementById('_notification_modal');
    const contentDiv = document.getElementById('_notification_content');
    if (!modal || !contentDiv) {
        console.error('Lỗi: Không tìm thấy các thành phần của modal thông báo.');
        return;
    }
    modal.style.display = 'flex';
    contentDiv.innerHTML = '<div class="_loading_spinner">⏳ Đang tải thông báo...</div>';
    try {
        const response = await fetch(NOTIFICATION_URL, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Lỗi mạng: ${response.status} ${response.statusText}`);
        }
        const markdownText = await response.text();
        const cleanHtml = customMarkdownParser(markdownText);
        contentDiv.innerHTML = cleanHtml;
    } catch (error) {
        console.error('Lỗi khi tải hoặc xử lý thông báo:', error);
        contentDiv.innerHTML = `<div class="_error_message">
                                  <strong>Không thể tải thông báo.</strong>
                                  <p>Vui lòng kiểm tra lại đường dẫn hoặc kết nối mạng.</p>
                                </div>`;
    }
};
const hideImages = () => {
    hideAnimationEnabled = true;
    localStorage.setItem('duohacker_hide_animation', 'true');
    const toggle = document.getElementById('_hide_animation_toggle');
    if (toggle) toggle.classList.add('_active');
    if (hideObserver) return;
    const protectSelectors = ['#_container', '._modal', '#_fab', '#_update_overlay', '#_backdrop', '._fab_ring'];
    const shouldIgnore = (el) => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        return protectSelectors.some(sel => el.closest?.(sel));
    };
    const hideEl = (el) => {
        if (shouldIgnore(el)) return;
        if (el.style.display === 'none') return;
        el.dataset.dhOrigDisplay = el.style.display || '';
        el.dataset.dhOrigVisibility = el.style.visibility || '';
        el.dataset.dhOrigPe = el.style.pointerEvents || '';
        if (el.style.backgroundImage) {
            el.dataset.dhOrigBg = el.style.backgroundImage;
        }
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        if (el.style.backgroundImage) el.style.backgroundImage = 'none';
    };
    const processNode = (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('img, svg, [role="img"]')) hideEl(node);
        const imgs = node.querySelectorAll?.('img, svg, [role="img"]') || [];
        imgs.forEach(hideEl);
        const all = [node, ...(node.querySelectorAll?.('*') || [])];
        all.forEach(el => {
            if (shouldIgnore(el)) return;
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && bg.includes('url(')) {
                if (!el.dataset.dhOrigBg) el.dataset.dhOrigBg = el.style.backgroundImage || bg;
                el.style.backgroundImage = 'none';
            }
        });
    };
    document.querySelectorAll('img, svg, [role="img"]').forEach(hideEl);
    document.querySelectorAll('body *').forEach(el => {
        if (shouldIgnore(el)) return;
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
            if (!el.dataset.dhOrigBg) el.dataset.dhOrigBg = el.style.backgroundImage || bg;
            el.style.backgroundImage = 'none';
        }
    });
    hideObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'childList') {
                m.addedNodes.forEach(processNode);
            }
        }
    });
    hideObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    logToConsole('🔄 Hide Animation enabled – using MutationObserver', 'success');
};
const farmLeague = async () => {
    logToConsole('🏆 Starting Auto League (Target: Rank 1)', 'info');
    const delayMs = currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY;
    const LB_URL = "https://duolingo-leaderboards-prod.duolingo.com/leaderboards/7d9f5dd1-8423-491a-91f2-2532052038ce";
    while (isRunning) {
        try {
            const res = await fetch(`${LB_URL}/users/${sub}?client_unlocked=true&_=${Date.now()}`, {
                headers: defaultHeaders
            });
            if (!res.ok) {
                logToConsole('Failed to fetch leaderboard. Retrying...', 'warning');
                await delay(2000);
                continue;
            }
            const data = await res.json();
            const rankings = data?.active?.cohort?.rankings || [];
            const myData = rankings.find(u => u.user_id == sub);
            if (!myData) {
                logToConsole('Leaderboard data not found (Are you in a league?)', 'error');
                stopFarming();
                break;
            }
            const currentRank = rankings.indexOf(myData) + 1;
            if (currentRank === 1) {
                const top2 = rankings[1];
                if (top2) {
                    const gap = myData.score - top2.score;
                    if (gap > 1000) {
                        logToConsole(`🎉 Top 1 Secured! (Gap: ${gap} XP). Stopping.`, 'success');
                        stopFarming();
                        break;
                    } else {
                        logToConsole(`🥇 Currently Top 1. Widening gap... (Gap: ${gap} XP)`, 'info');
                    }
                } else {
                    logToConsole(`🎉 You are alone in Top 1!`, 'success');
                    stopFarming();
                    break;
                }
            } else {
                const top1 = rankings[0];
                const gap = top1.score - myData.score;
                logToConsole(`Rank: ${currentRank} | Behind Top 1: ${gap} XP | Farming...`, 'info');
            }
            const farmRes = await farmXpOnce();
            if (farmRes.ok) {
                const d = await farmRes.json();
                const earned = d.awardedXp || 0;
                totalEarned.xp += earned;
                updateEarnedStats();
                saveSessionData();
            } else {
                logToConsole('XP Farm failed, retrying...', 'warning');
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`League Error: ${error.message}`, 'error');
            await delay(5000);
        }
    }
};
const showImages = () => {
    hideAnimationEnabled = false;
    localStorage.setItem('duohacker_hide_animation', 'false');
    const toggle = document.getElementById('_hide_animation_toggle');
    if (toggle) toggle.classList.remove('_active');
    if (hideObserver) {
        hideObserver.disconnect();
        hideObserver = null;
    }
    const allHidden = document.querySelectorAll('[data-dhOrigDisplay], [data-dh-orig-display]');
    allHidden.forEach(el => {
        if (el.dataset.dhOrigDisplay !== undefined) el.style.display = el.dataset.dhOrigDisplay;
        if (el.dataset.dhOrigVisibility !== undefined) el.style.visibility = el.dataset.dhOrigVisibility;
        if (el.dataset.dhOrigPe !== undefined) el.style.pointerEvents = el.dataset.dhOrigPe;
        if (el.dataset.dhOrigBg !== undefined) el.style.backgroundImage = el.dataset.dhOrigBg;
        delete el.dataset.dhOrigDisplay;
        delete el.dataset.dhOrigVisibility;
        delete el.dataset.dhOrigPe;
        delete el.dataset.dhOrigBg;
    });
    logToConsole('✅ Hide Animation disabled – UI and images restored', 'info');
};
const solveTapCompleteTable = () => {
    const tableRows = document.querySelectorAll('tbody tr');
    window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
        const answerCell = rowTokens[1]?.find(t => t.isBlank);
        if (answerCell && tableRows[i]) {
            const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
            const wordButtons = wordBank ? Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])')) : [];
            let answerBuilt = "";
            for (let btn of wordButtons) {
                if (!answerCell.text.startsWith(answerBuilt + btn.innerText)) continue;
                btn.click();
                answerBuilt += btn.innerText;
                if (answerBuilt === answerCell.text) break;
            }
        }
    });
};
const correctTokensRun = () => {
    const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
    if (!wordBank) return;
    const buttons = Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])'));
    const correctTokens = window.sol.correctTokens || [];
    for (let token of correctTokens) {
        const btn = buttons.find(b => b.innerText.toLowerCase().trim() === token.toLowerCase().trim());
        if (btn) {
            btn.click();
        }
    }
};
const correctIndicesRun = () => {
    const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
    if (!wordBank) return;
    const buttons = Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])'));
    const correctIndices = window.sol.correctIndices || [];
    for (let i of correctIndices) {
        if (buttons[i]) {
            buttons[i].click();
        }
    }
};
if (typeof checkForAutoSolve === 'undefined') {
    const checkForAutoSolve = () => {
        if (window.location.pathname.includes('/lesson') && autoSolveEnabled) {
            logToConsole('Auto-solve mode: Detected lesson page, starting to solve', 'info');
            if (!lessonSolving) {
                startLessonSolving();
            }
        }
    };
}
const deleteAccount = (accountId) => {
    savedAccounts = savedAccounts.filter(acc => acc.id !== accountId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAccounts));
    updateAccountsBadge();
    renderAccountsList();
    logToConsole('Account deleted', 'info');
};
const loginWithAccount = (account) => {
    document.cookie = `jwt_token=${account.jwt}; path=/; domain=.duolingo.com`;
    logToConsole(`Logging in as ${account.username}...`, 'info');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};
const updateAccountsBadge = () => {
    const badge = document.querySelector('._control_btn._accounts ._badge');
    if (badge) {
        badge.textContent = savedAccounts.length;
    }
};
const renderAccountsList = () => {
    const accountsList = document.getElementById('_accounts_list');
    if (!accountsList) return;
    if (savedAccounts.length === 0) {
        accountsList.innerHTML = '<div class="_empty_state"><p>No saved accounts yet. Save your current account to get started!</p></div>';
        return;
    }
    const currentUsername = userInfo?.username;
    accountsList.innerHTML = savedAccounts.map(account => {
        const isActive = account.username === currentUsername;
        return `
      <div class="_account_card ${isActive ? '_active' : ''}" data-id="${account.id}">
        ${isActive ? '<div class="_active_badge">ACTIVE</div>' : ''}
        <div class="_account_header">
<div class="_account_avatar">
    <span style="font-size: 20px;">👤</span>
</div>
          <div class="_account_info">
            <div class="_account_nickname">${account.nickname}</div>
            <div class="_account_username">@${account.username}</div>
          </div>
        </div>
        <div class="_account_stats">
          <div class="_account_stat">⚡ ${account.totalXp?.toLocaleString() || 0}</div>
          <div class="_account_stat">🔥 ${account.streak || 0}</div>
          <div class="_account_stat">💎 ${account.gems || 0}</div>
        </div>
        <div class="_account_actions">
          ${!isActive ? `<button class="_account_action_btn _login" data-action="login">
            <span style="font-size: 14px;">➡️</span>
            Login
          </button>` : '<div style="flex:1"></div>'}
          <button class="_account_action_btn _delete" data-action="delete">
            <span style="font-size: 14px;">🗑️</span>
          </button>
        </div>
      </div>
    `;
    }).join('');
    accountsList.querySelectorAll('._account_card').forEach(card => {
        const accountId = card.dataset.id;
        const account = savedAccounts.find(acc => acc.id === accountId);
        card.querySelector('[data-action="login"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Switch to account: ${account.nickname}?`)) {
                loginWithAccount(account);
            }
        });
        card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete account: ${account.nickname}?`)) {
                deleteAccount(accountId);
            }
        });
    });
};
const addEventListeners = () => {
        document.getElementById('_test_webhook_btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('_test_webhook_btn');
        if (!webhookUrl) {
            alert("Please enter a webhook URL first!");
            return;
        }

        btn.innerText = "Sending...";
        btn.disabled = true;

        await sendDiscordWebhook(
            "🔔 Test Notification",
            "Success",
            "Your webhook is linked to DuoHacker successfully!",
            3447003
        );

        btn.innerText = "Linked!";
        setTimeout(() => {
            btn.innerText = "Link";
            btn.disabled = false;
        }, 2000);
    });
        document.getElementById('_webhook_input')?.addEventListener('blur', (e) => {
        webhookUrl = e.target.value.trim();
        localStorage.setItem('duohacker_webhook_url', webhookUrl);
        if(webhookUrl) logToConsole('Webhook URL saved', 'success');
    });
        document.getElementById('_webhook_toggle_btn')?.addEventListener('click', () => {
        const panel = document.getElementById('_webhook_panel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });
    document.getElementById('_gift_notification_btn')?.addEventListener('click', showGiftNotification);
        document.getElementById('_close_notification')?.addEventListener('click', () => {
        document.getElementById('_notification_modal').style.display = 'none';
    });
    document.getElementById('_notification_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_notification_modal').style.display = 'none';
        }
    });
    document.getElementById('_leaderboard_btn')?.addEventListener('click', showLeaderboard);
    document.getElementById('_close_leaderboard')?.addEventListener('click', () => {
        document.getElementById('_leaderboard_modal').style.display = 'none';
    });
    document.getElementById('_leaderboard_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_leaderboard_modal').style.display = 'none';
        }
    });
    document.getElementById('_inject_solver_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_inject_solver_toggle');
        INJECT_SOLVER_ENABLED = !INJECT_SOLVER_ENABLED;
        localStorage.setItem('duohacker_inject_solver', INJECT_SOLVER_ENABLED.toString());
        if (INJECT_SOLVER_ENABLED) {
            toggle.classList.add('_active');
            logToConsole('🤖 Auto Solver Enabled - Enter a lesson to see buttons', 'success');
            autoSolver.checkAndToggle();
        } else {
            toggle.classList.remove('_active');
            logToConsole('🤖 Auto Solver Disabled', 'info');
            autoSolver.removeUI();
        }
    });
    document.getElementById('_lesson_shortner_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_lesson_shortner_toggle');
        LESSON_SHORTNER_ENABLED = !LESSON_SHORTNER_ENABLED;
        localStorage.setItem('duohacker_lesson_shortner', LESSON_SHORTNER_ENABLED.toString());

        if (LESSON_SHORTNER_ENABLED) {
            toggle.classList.add('_active');
            if(confirm("Lesson Shortner Enabled! Reload now to apply?")) window.location.reload();
        } else {
            toggle.classList.remove('_active');
            if(confirm("Lesson Shortner Disabled! Reload now to apply?")) window.location.reload();
        }
    });
    document.getElementById('_item_shop_btn')?.addEventListener('click', showItemShop);
    document.getElementById('_monthly_badges')?.addEventListener('click', showMonthlyBadges);
    document.getElementById('_fab')?.addEventListener('click', toggleInterface);
    document.getElementById('_minimize_btn')?.addEventListener('click', () => {
        setInterfaceVisible(false);
    });
    document.getElementById('_close_btn')?.addEventListener('click', () => {
        if (isRunning) {
            if (confirm('Farming is active. Are you sure you want to close?')) {
                stopFarming();
                setInterfaceVisible(false);
            }
        } else {
            setInterfaceVisible(false);
        }
    });
    document.getElementById('_hide_animation_toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const toggle = document.getElementById('_hide_animation_toggle');
        if (hideAnimationEnabled) {
            showImages();
            toggle.classList.remove('_active');
        } else {
            hideImages();
            toggle.classList.add('_active');
        }
    });
    document.getElementById('_theme_toggle')?.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('_accounts_btn')?.addEventListener('click', () => {
        renderAccountsList();
        document.getElementById('_accounts_modal').style.display = 'flex';
    });
    document.getElementById('_close_accounts')?.addEventListener('click', () => {
        document.getElementById('_accounts_modal').style.display = 'none';
    });
    document.getElementById('_accounts_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_accounts_modal').style.display = 'none';
        }
    });
    document.getElementById('_duolingo_super_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_duolingo_super_toggle');
        duolingoSuperEnabled = !duolingoSuperEnabled;
        localStorage.setItem('duohacker_duolingo_super', duolingoSuperEnabled.toString());
        if (duolingoSuperEnabled) {
            toggle.classList.add('_active');
            if (window.enableDuolingoSuper) {
                window.enableDuolingoSuper();
            }
            logToConsole('Duolingo Super features enabled', 'success');
        } else {
            toggle.classList.remove('_active');
            if (window.disableDuolingoSuper) {
                window.disableDuolingoSuper();
            }
            logToConsole('Duolingo Super features disabled', 'info');
        }
    });
    document.getElementById('_settings_btn')?.addEventListener('click', async () => {
        document.getElementById('_settings_modal').style.display = 'flex';
        const btn = document.getElementById('_privacy_toggle_btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span style="font-size: 18px;">⏳</span> Loading...';
            const isPrivate = await getCurrentPrivacyStatus();
            if (isPrivate === true) {
                btn.innerHTML = '<span style="font-size: 18px;">🔒</span> Set Public';
            } else if (isPrivate === false) {
                btn.innerHTML = '<span style="font-size: 18px;">🔒</span> Set Private';
            } else {
                btn.innerHTML = '<span style="font-size: 18px;">🔒</span> Set Private';
                logToConsole("Could not load privacy status – defaulting to Set Private", 'warning');
            }
            btn.disabled = false;
        }
    });
    document.getElementById('_close_settings')?.addEventListener('click', () => {
        document.getElementById('_settings_modal').style.display = 'none';
    });
    document.getElementById('_settings_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_settings_modal').style.display = 'none';
        }
    });
    document.getElementById('_lite_mode_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_lite_mode_toggle');
        liteMode = !liteMode;
        localStorage.setItem('duohacker_lite_mode', liteMode.toString());
        if (liteMode) {
            document.body.setAttribute('data-lite-mode', 'true');
            logToConsole('Lite Mode enabled – animations reduced', 'info');
            toggle.classList.add('_active');
        } else {
            document.body.removeAttribute('data-lite-mode');
            logToConsole('Lite Mode disabled – full animations restored', 'info');
            toggle.classList.remove('_active');
        }
    });
    document.getElementById('_auto_name_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_auto_name_toggle');
        autoNameEnabled = !autoNameEnabled;
        localStorage.setItem('duohacker_auto_name', autoNameEnabled.toString());
        if (autoNameEnabled) {
            document.body.setAttribute('data-auto-name', 'true');
            logToConsole('Auto-Name enabled – name will be changed when farming', 'success');
            toggle.classList.add('_active');
        } else {
            document.body.removeAttribute('data-auto-name');
            logToConsole('Auto-Name disabled – your name will not be changed', 'info');
            toggle.classList.remove('_active');
        }
    });
    document.getElementById('_privacy_toggle_btn')?.addEventListener('click', async () => {
        const newState = await togglePrivacy();
        if (newState !== null) {
            const privacyBtn = document.getElementById('_privacy_toggle_btn');
            if (privacyBtn) {
                privacyBtn.innerHTML = newState ?
                    '<span style="font-size: 18px;">🔒</span> Set Public' :
                    '<span style="font-size: 18px;">🔒</span> Set Private';
            }
        }
    });
    document.getElementById('_duolingo_max_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_duolingo_max_toggle');
        duolingoMaxEnabled = !duolingoMaxEnabled;
        localStorage.setItem('duohacker_duolingo_max', duolingoMaxEnabled.toString());
        if (duolingoMaxEnabled) {
            toggle.classList.add('_active');
            if (window.enableDuolingoMax) {
                window.enableDuolingoMax();
            }
            logToConsole('Duolingo Max features enabled', 'success');
        } else {
            toggle.classList.remove('_active');
            if (window.disableDuolingoMax) {
                window.disableDuolingoMax();
            }
            logToConsole('Duolingo Max features disabled', 'info');
        }
    });
    document.getElementById('_save_account_btn')?.addEventListener('click', () => {
        if (!userInfo) {
            logToConsole('Please wait for user data to load', 'error');
            return;
        }
        document.getElementById('_preview_username').textContent = userInfo.username;
        document.getElementById('_preview_details').textContent = `${userInfo.fromLanguage} → ${userInfo.learningLanguage}`;
        document.getElementById('_account_nickname').value = userInfo.username;
        const previewAvatar = document.getElementById('_preview_avatar');
        if (previewAvatar) {
            previewAvatar.innerHTML = '<span style="font-size: 20px;">👤</span>';
        }
        document.getElementById('_save_account_modal').style.display = 'flex';
    });
    document.getElementById('_close_save_account')?.addEventListener('click', () => {
        document.getElementById('_save_account_modal').style.display = 'none';
    });
    document.getElementById('_save_account_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_save_account_modal').style.display = 'none';
        }
    });
    document.getElementById('_confirm_save_account')?.addEventListener('click', () => {
        const nickname = document.getElementById('_account_nickname').value.trim();
        if (!nickname) {
            alert('Please enter a nickname for this account');
            return;
        }
        if (saveAccount(nickname)) {
            document.getElementById('_save_account_modal').style.display = 'none';
            alert(`Account saved as: ${nickname}`);
        }
    });
    document.getElementById('_get_jwt_btn')?.addEventListener('click', () => {
        const token = getJwtToken();
        if (token) {
            navigator.clipboard.writeText(token);
            logToConsole('JWT Token copied to clipboard', 'success');
            alert('JWT Token copied to clipboard!');
        } else {
            logToConsole('JWT Token not found', 'error');
            alert('JWT Token not found! Please make sure you are logged in to Duolingo.');
        }
    });
    document.getElementById('_logout_btn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
            window.location.href = 'https://www.duolingo.com/logout';
        }
    });
    document.getElementById('_login_jwt_btn')?.addEventListener('click', () => {
        const jwtInput = document.getElementById('_jwt_input');
        const token = jwtInput.value.trim();
        if (token) {
            document.cookie = `jwt_token=${token}; path=/; domain=.duolingo.com`;
            logToConsole('JWT Token updated, refreshing page...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            logToConsole('Please enter a valid JWT Token', 'error');
            alert('Please enter a valid JWT Token');
        }
    });
    document.getElementById('_join_btn')?.addEventListener('click', () => {
        localStorage.setItem('duofarmer_joined', 'true');
        hasJoined = true;
        document.getElementById('_join_section').style.display = 'none';
        document.getElementById('_main_content').style.display = 'flex';
        initializeFarming();
    });
    document.querySelectorAll('._mode_card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('._mode_card').forEach(c => c.classList.remove('_active'));
            card.classList.add('_active');
            currentMode = card.dataset.mode;
            logToConsole(`Switched to ${currentMode} mode`, 'info');
        });
    });
    document.querySelectorAll('._option_btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('._option_btn').forEach(b => b.classList.remove('_selected'));
            btn.classList.add('_selected');
        });
    });
    document.getElementById('_start_farming')?.addEventListener('click', startFarming);
    document.getElementById('_stop_farming')?.addEventListener('click', stopFarming);
    document.getElementById('_refresh_profile')?.addEventListener('click', async () => {
        const btn = document.getElementById('_refresh_profile');
        btn.style.animation = 'spin 1s linear';
        await refreshUserData();
        btn.style.animation = '';
    });
    document.getElementById('_clear_console')?.addEventListener('click', () => {
        const console = document.getElementById('_console_output');
        if (console) {
            console.innerHTML = '';
            logToConsole('Console cleared', 'info');
        }
    });
    document.getElementById('_free_super_btn')?.addEventListener('click', () => {
        document.getElementById('_super_modal').style.display = 'flex';
    });
    document.getElementById('_close_super_modal')?.addEventListener('click', () => {
        document.getElementById('_super_modal').style.display = 'none';
    });
    document.getElementById('_super_modal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_super_modal').style.display = 'none';
        }
    });
    document.getElementById('_get_super_link_btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('_get_super_link_btn');
        const errorDiv = document.getElementById('_super_error');
        const resultDiv = document.getElementById('_super_link_display');
        const linkAnchor = document.getElementById('_super_link_anchor');
        btn.disabled = true;
        btn.textContent = '⏳ Fetching...';
        errorDiv.style.display = 'none';
        resultDiv.style.display = 'none';
        try {
            const res = await fetch('https://raw.githubusercontent.com/pillowslua/DuoHacker/refs/heads/main/public/super.txt');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const links = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            if (links.length === 0) {
                throw new Error('No links found in file');
            }
            const selectedLink = links[Math.floor(Math.random() * links.length)];
            linkAnchor.href = selectedLink;
            linkAnchor.target = '_blank';
            linkAnchor.textContent = selectedLink;
            resultDiv.style.display = 'block';
            console.log(`✅ Fetched ${links.length} links, selected: ${selectedLink}`);
        } catch (err) {
            errorDiv.textContent = `❌ Error: ${err.message}`;
            errorDiv.style.display = 'block';
            console.error('Super link fetch error:', err);
        } finally {
            btn.disabled = false;
            btn.textContent = '🚀 Get Free Super Link';
        }
    });
    document.getElementById('_go_to_link_btn')?.addEventListener('click', () => {
        let url = document.getElementById('_super_link_anchor').textContent?.trim();
        if (!url) {
            alert('No link available');
            return;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        console.log('Opening:', url);
        window.open(url, '_blank');
    });
    document.getElementById('_close_result_btn')?.addEventListener('click', () => {
        document.getElementById('_super_modal').style.display = 'none';
    });
    const checkBtn = document.getElementById('_superlinks_check_btn');
    const input = document.getElementById('_superlinks_input');
    if (checkBtn && input) {
        checkBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                checkSuperlink(input.value);
            } else {
                alert('Please enter a superlink or ID');
            }
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                checkSuperlink(input.value);
            }
        });
    }
};
const checkSuperlink = async (input) => {
    const resultDiv = document.getElementById('_superlinks_result');
    const checkBtn = document.getElementById('_superlinks_check_btn');
    resultDiv.style.display = 'block';
    resultDiv.className = '_superlinks_result _loading';
    resultDiv.textContent = '⏳ Checking...';
    checkBtn.disabled = true;
    try {
        let id = input.trim();
        if (id.includes('invite.duolingo.com')) {
            id = id.split('/family-plan/')[1];
        }
        if (id.includes('https://') || id.includes('http://')) {
            id = id.split('/').pop();
        }
        if (!id) {
            throw new Error('Invalid link or ID format');
        }
        const url = `https://www.duolingo.com/2023-05-23/family-plan/invite/${id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (response.status === 200) {
            const data = await response.json();
            if (data.isValid) {
                resultDiv.className = '_superlinks_result _working';
                resultDiv.innerHTML = `✅ <strong>Working</strong><br><small>${id}</small>`;
                logToConsole(`Superlink ${id} is WORKING`, 'success');
            } else {
                resultDiv.className = '_superlinks_result _unavailable';
                resultDiv.innerHTML = `❌ <strong>Unavailable</strong><br><small>Invalid link</small>`;
                logToConsole(`Superlink ${id} is UNAVAILABLE`, 'error');
            }
        } else {
            resultDiv.className = '_superlinks_result _unavailable';
            resultDiv.innerHTML = `❌ <strong>Unavailable</strong><br><small>HTTP ${response.status}</small>`;
            logToConsole(`Superlink check failed: ${response.status}`, 'error');
        }
    } catch (error) {
        resultDiv.className = '_superlinks_result _unavailable';
        resultDiv.innerHTML = `❌ <strong>Unavailable</strong><br><small>${error.message}</small>`;
        logToConsole(`Superlink check error: ${error.message}`, 'error');
    } finally {
        checkBtn.disabled = false;
    }
};
const initSuperlinksChecker = () => {
    const checkBtn = document.getElementById('_superlinks_check_btn');
    const input = document.getElementById('_superlinks_input');
    if (checkBtn && input) {
        checkBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                checkSuperlink(input.value);
            } else {
                alert('Please enter a superlink or ID');
            }
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                checkSuperlink(input.value);
            }
        });
    }
};
const startFarming = async () => {
    if (isRunning) return;
    const selectedOption = document.querySelector('._option_btn._selected');
    if (!selectedOption) {
        logToConsole('Please select a farming option', 'error');
        return;
    }
    const type = selectedOption.dataset.type;
    const delayMs = currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY;
    if (type === 'farm_all') {
        if (confirm('Farm All will combine XP, Gems, and Streak farming. Continue?')) {
            await farmAll(delayMs);
        }
        return;
    }
    isRunning = true;
    farmingStats.startTime = Date.now();
    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';
    logToConsole(`Started ${type} farming in ${currentMode} mode`, 'success');
    const timer = setInterval(updateFarmingTime, 1000);
    try {
        switch (type) {
            case 'xp':
                await farmXP(delayMs);
                break;
            case 'xp_10':
                await farmXP10(delayMs);
                break;
            case 'gems':
                await farmGems(delayMs);
                break;
            case 'quest':
                await runAutoCompleteQuests();
                break;
            case 'streak_farm':
                await farmStreak();
                break;
            case 'league_farm':
                await farmLeague();
                break;
        }
    } catch (error) {
        logToConsole(`Farming error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
    }
};
const GOALS_API_URL = "https://goals-api.duolingo.com";
const getGoalHeaders = () => {
    if (!jwt) return null;
    return {
        ...defaultHeaders, // Use existing headers from duohacker
        "Content-Type": "application/json",
        "x-requested-with": "XMLHttpRequest",
        "accept": "application/json; charset=UTF-8",
        "Authorization": `Bearer ${jwt}`
    };
};
/**
 * Fetches the schema of all available quests.
 */
const getQuestSchema = async (headers) => {
    try {
        const res = await fetch(`${GOALS_API_URL}/schema?ui_language=en&_=${Date.now()}`, {
            headers
        });
        if (res.ok) return await res.json();
    } catch (e) {
        logToConsole(`Error fetching quest schema: ${e.message}`, 'error');
    }
    return null;
};
/**
 * Fetches the current user's progress on all quests.
 */
const getUserQuestProgress = async (userId, headers) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
        const res = await fetch(`${GOALS_API_URL}/users/${userId}/progress?timezone=${tz}&ui_language=en`, {
            headers
        });
        if (res.ok) return await res.json();
    } catch (e) {
        logToConsole(`Error fetching user progress: ${e.message}`, 'error');
    }
    return null;
};
/**
 * Sends a batch request to "brute force" complete quests by injecting progress.
 */
const bruteForceQuests = async (userId, headers, metrics) => {
    const updates = metrics.map(m => ({
        "metric": m,
        "quantity": 2000
    }));
    updates.push({
        "metric": "QUESTS",
        "quantity": 1
    }); // General quest completion metric
    const payload = {
        "metric_updates": updates,
        "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        "timestamp": new Date().toISOString()
    };
    try {
        const res = await fetch(`${GOALS_API_URL}/users/${userId}/progress/batch`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (e) {
        logToConsole(`Error brute forcing quests: ${e.message}`, 'error');
        return false;
    }
};
/**
 * Main function to find and complete daily quests.
 */
const runAutoCompleteQuests = async () => {
    logToConsole('🎯 Starting Auto Quest...', 'info');
    let currentLessonCount = 0; // Fix: Initialize lesson counter
    isRunning = true;
    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';
    const goalHeaders = getGoalHeaders();
    if (!sub || !goalHeaders) {
        logToConsole('User data not loaded. Please wait and try again.', 'error');
        stopFarming();
        return;
    }
    const schema = await getQuestSchema(goalHeaders);
    const progress = await getUserQuestProgress(sub, goalHeaders);
    if (!schema || !progress) {
        logToConsole('Failed to load quest data.', 'error');
        stopFarming();
        return;
    }
    const earnedQuests = new Set(progress.badges?.earned || []);
    const dailyQuestMetrics = new Set();
    schema.goals.forEach(goal => {
        const isDaily = goal.category?.includes('DAILY');
        const isCompleted = earnedQuests.has(goal.badgeId) || earnedQuests.has(goal.goalId);
        if (isDaily && !isCompleted && goal.metric) {
            dailyQuestMetrics.add(goal.metric);
        }
    });
    if (dailyQuestMetrics.size === 0) {
        logToConsole('✅ All daily quests are already completed!', 'success');
        stopFarming();
        return;
    }
    logToConsole(`Found ${dailyQuestMetrics.size} daily quests to complete...`, 'info');
    const success = await bruteForceQuests(sub, goalHeaders, Array.from(dailyQuestMetrics));
    if (success) {
        logToConsole('🎉 Daily quests completed successfully!', 'success');
    } else {
        logToConsole('❌ Failed to complete daily quests.', 'error');
    }
    await refreshUserData();
    stopFarming();
};
const stopFarming = () => {
    if (!isRunning) return;
    isRunning = false;
    lessonSolving = false;
    if (farmingInterval) {
        clearInterval(farmingInterval);
        farmingInterval = null;
    }
    document.getElementById('_start_farming').style.display = 'block';
    document.getElementById('_stop_farming').style.display = 'none';
    logToConsole('Farming stopped', 'info');
    saveSessionData();
};
const startLessonSolving = async () => {
    if (lessonSolving) return;
    lessonSolving = true;
    isRunning = true;
    farmingStats.startTime = Date.now();
    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';
    logToConsole(`Started solving ${lessonsToSolve === 0 ? 'unlimited' : lessonsToSolve} lessons`, 'success');
    const timer = setInterval(updateFarmingTime, 1000);
    try {
        while (lessonSolving && (lessonsToSolve === 0 || currentLessonCount < lessonsToSolve)) {
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/lesson')) {
                logToConsole('Not on lesson page, navigating...', 'info');
                window.location.href = 'https://www.duolingo.com/lesson';
                await delay(3000); // Wait for page load
                continue;
            }
            logToConsole(`Solving lesson ${currentLessonCount + 1}/${lessonsToSolve || '∞'}...`, 'info');
            await delay(1500);
            await solveCurrentLesson();
            currentLessonCount++;
            totalEarned.lessons++;
            updateEarnedStats();
            saveSessionData();
            logToConsole(`✓ Lesson ${currentLessonCount} completed`, 'success');
            if (lessonsToSolve > 0 && currentLessonCount >= lessonsToSolve) {
                logToConsole('All lessons completed!', 'success');
                break;
            }
            await delay(2000);
            logToConsole('Loading next lesson...', 'info');
            window.location.href = 'https://www.duolingo.com/learn';
            await delay(4000);
        }
    } catch (error) {
        logToConsole(`Lesson solving error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
        lessonSolving = false;
        isRunning = false;
        document.getElementById('_start_farming').style.display = 'block';
        document.getElementById('_stop_farming').style.display = 'none';
        saveSessionData();
    }
};
const solveCurrentLesson = async () => {
    return new Promise((resolve) => {
        let solveCount = 0;
        let maxAttempts = 120;
        const checkInterval = setInterval(() => {
            try {
                const sessionOver = document.querySelector('[data-test="session-over"]') ||
                    document.querySelector('[data-test="session-complete-slide"]');
                if (sessionOver) {
                    logToConsole('Lesson completed!', 'success');
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                const challengeElement = document.querySelector('._3yE3H');
                if (challengeElement) {
                    try {
                        window.sol = findReact(challengeElement)?.props?.currentChallenge;
                        if (window.sol) {
                            const type = determineChallengeType();
                            if (['Challenge Speak', 'Listen Match', 'Listen Speak'].includes(type)) {
                                const skipBtn = document.querySelector('button[data-test="player-skip"]');
                                if (skipBtn && !skipBtn.disabled) {
                                    logToConsole(`Skipping ${type}...`, 'info');
                                    skipBtn.click();
                                }
                            } else if (type && type !== 'error') {
                                logToConsole(`Solving: ${type}`, 'info');
                                handleChallenge(type);
                                setTimeout(() => {
                                    const nextBtn = document.querySelector('[data-test="player-next"]') ||
                                        document.querySelector('[data-test="stories-player-continue"]') ||
                                        document.querySelector('[data-test="stories-player-done"]');
                                    if (nextBtn && !nextBtn.disabled) {
                                        nextBtn.click();
                                        logToConsole('➜ Next', 'info');
                                    }
                                }, 300);
                                solveCount++;
                            }
                        }
                    } catch (err) {
                        logToConsole(`Solve error: ${err.message}`, 'error');
                    }
                }
                if (solveCount > maxAttempts) {
                    logToConsole('Max attempts reached', 'warning');
                    clearInterval(checkInterval);
                    resolve();
                }
            } catch (error) {
                logToConsole(`Check error: ${error.message}`, 'error');
            }
        }, 800); // 800ms check interval
        setTimeout(() => {
            clearInterval(checkInterval);
            logToConsole('Lesson timeout (120s)', 'warning');
            resolve();
        }, 120000);
    });
};
const farmAll = async (delayMs) => {
    isRunning = true;
    farmingStats.startTime = Date.now();
    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';
    logToConsole(`Started Farm All in ${currentMode} mode`, 'success');
    const timer = setInterval(updateFarmingTime, 1000);
    let cycle = 0;
    try {
        while (isRunning) {
            cycle++;
            logToConsole(`--- Cycle ${cycle} ---`, 'info');
            if (!isRunning) break;
            try {
                logToConsole('Farming XP...', 'info');
                const response = await farmXpOnce();
                if (response.ok) {
                    const data = await response.json();
                    const earned = data?.awardedXp || 0;
                    totalEarned.xp += earned;
                    updateEarnedStats();
                    logToConsole(`✓ Earned ${earned} XP`, 'success');
                }
            } catch (error) {
                logToConsole(`✗ XP farming error: ${error.message}`, 'error');
            }
            await delay(delayMs);
            if (!isRunning) break;
            try {
                logToConsole('Farming Gems...', 'info');
                const response = await farmGemOnce();
                if (response.ok) {
                    totalEarned.gems += 30;
                    updateEarnedStats();
                    logToConsole('✓ Earned 30 gems', 'success');
                }
            } catch (error) {
                logToConsole(`✗ Gem farming error: ${error.message}`, 'error');
            }
            await delay(delayMs);
            if (!isRunning) break;
            try {
                logToConsole('Farming Streak...', 'info');
                const hasStreak = !!userInfo.streakData?.currentStreak;
                const startStreakDate = hasStreak ? userInfo.streakData.currentStreak.startDate : new Date();
                const startFarmStreakTimestamp = Math.floor(new Date(startStreakDate).getTime() / 1000);
                let currentTimestamp = hasStreak ? startFarmStreakTimestamp - 86400 : startFarmStreakTimestamp;
                await farmSessionOnce(currentTimestamp, currentTimestamp + 60);
                totalEarned.streak++;
                userInfo.streak++;
                updateUserInfo();
                updateEarnedStats();
                logToConsole(`✓ Streak increased to ${userInfo.streak}`, 'success');
            } catch (error) {
                logToConsole(`✗ Streak farming error: ${error.message}`, 'error');
            }
            await delay(delayMs);
            saveSessionData();
        }
    } catch (error) {
        logToConsole(`❌ Farm All error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
        isRunning = false;
        lessonSolving = false;
        document.getElementById('_start_farming').style.display = 'block';
        document.getElementById('_stop_farming').style.display = 'none';
        saveSessionData();
    }
};
const farmXP = async (delayMs) => {
    while (isRunning) {
        try {
            const response = await farmXpOnce();
            if (response.ok) {
                const data = await response.json();
                const earned = data?.awardedXp || 0;
                totalEarned.xp += earned;
                updateEarnedStats();
                saveSessionData();
                logToConsole(`Earned ${earned} XP`, 'success');
                if (totalEarned.xp % 100 <= earned) {
                     sendDiscordWebhook("⚡ XP Farmed", "Active", `Gained **${earned} XP**\nTotal Session: ${totalEarned.xp} XP`, 16761035);
                }
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`XP farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};
const farmGems = async (delayMs) => {
    while (isRunning) {
        try {
            const response = await farmGemOnce();
            if (response.ok) {
                totalEarned.gems += 30;
                updateEarnedStats();
                saveSessionData();
                logToConsole('Earned 30 gems', 'success');
                sendDiscordWebhook("💎 Gems Farmed", "Active", `Gained **30 Gems**\nTotal Session: ${totalEarned.gems} Gems`, 3066993);
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`Gem farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};
const farmStreak = async () => {
    const useSafeMode = prompt(
        'Do you want to use Safe Streak Farming?\n\n' +
        'Safe Mode: Only farms streaks from account creation date to prevent ban risk\n' +
        'Normal Mode: Farms unlimited streaks\n\n' +
        'Type Y for Safe Mode, N for Normal Mode:',
        'Y'
    );

    if (!useSafeMode) {
        logToConsole('Streak farming cancelled', 'info');
        stopFarming();
        return;
    }

    const isSafeMode = useSafeMode.toUpperCase() === 'Y';

    if (isSafeMode) {
        logToConsole('🛡️ Starting SAFE streak farming...', 'success');
        await farmStreakSafe();
    } else {
        logToConsole('⚠️ Starting NORMAL streak farming (higher risk)...', 'warning');
        await farmStreakNormal();
    }
};
const farmStreakSafe = async () => {
    logToConsole('Starting SAFE streak farming (limited to account age)...', 'info');
    if (!userInfo || !userInfo.streakData) {
        logToConsole('User data not available yet. Please wait and try again.', 'error');
        return;
    }
    const hasStreak = !!userInfo.streakData?.currentStreak;
    const startStreakDate = hasStreak ? userInfo.streakData.currentStreak.startDate : new Date();
    const startFarmStreakTimestamp = Math.floor(new Date(startStreakDate).getTime() / 1000);
    let currentTimestamp = hasStreak ? startFarmStreakTimestamp - 86400 : startFarmStreakTimestamp;
    const creationTimestamp = Math.floor(new Date(userInfo.creationDate).getTime() / 1000);
    const maxSafeStreak = Math.floor((Math.floor(Date.now() / 1000) - creationTimestamp) / 86400) + 1; // +1

    logToConsole(`Account created ≈ ${maxSafeStreak} days ago → max safe streak ≈ ${maxSafeStreak}`, 'info');
    isRunning = true;
    farmingStats.startTime = Date.now();
    document.getElementById('_start_farming')?.style?.display && (document.getElementById('_start_farming').style.display = 'none');
    document.getElementById('_stop_farming')?.style?.display && (document.getElementById('_stop_farming').style.display = 'block');

    while (isRunning) {
        if (currentTimestamp < creationTimestamp) {
            logToConsole(`🛑 Reached account creation date limit (${maxSafeStreak} days). Stopping safely.`, 'success');
            sendDiscordWebhook?.("🔥 Safe Streak Farm Complete", "Limit Reached",
                `Maximum safe streak achieved: **${userInfo.streak} days**\n(Cannot backdate before account creation)`, 15158332);
            stopFarming();
            break;
        }

        try {
            await farmSessionOnce(currentTimestamp, currentTimestamp + 60);
            currentTimestamp -= 86400;
            totalEarned.streak++;
            userInfo.streak++;
            updateUserInfo();
            updateEarnedStats();
            saveSessionData();

            logToConsole(`Streak increased to ${userInfo.streak}`, 'success');
            if (totalEarned.streak % 10 === 0) {
                sendDiscordWebhook?.("🔥 Streak Extended", "Safe Mode",
                    `Current Streak: **${userInfo.streak} Days**\n(Safe farming active)`, 15158332);
            }
            await delay(currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY);
        } catch (error) {
            logToConsole(`Streak farming error: ${error.message}`, 'error');
            await delay((currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY) * 2);
        }
    }
};
const farmStreakNormal = async () => {
    logToConsole('⚠️ WARNING: Normal streak farming has higher ban risk!', 'warning');

    const hasStreak = !!userInfo.streakData?.currentStreak;
    const startStreakDate = hasStreak ? userInfo.streakData.currentStreak.startDate : new Date();
    const startFarmStreakTimestamp = Math.floor(new Date(startStreakDate).getTime() / 1000);
    let currentTimestamp = hasStreak ? startFarmStreakTimestamp - 86400 : startFarmStreakTimestamp;

    const delayMs = currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY;

    while (isRunning) {
        try {
            await farmSessionOnce(currentTimestamp, currentTimestamp + 60);
            currentTimestamp -= 86400;
            totalEarned.streak++;
            userInfo.streak++;

            updateUserInfo();
            updateEarnedStats();
            saveSessionData();

            logToConsole(`🔥 Streak increased to ${userInfo.streak}`, 'success');

            if (userInfo.streak % 10 === 0) {
                sendDiscordWebhook(
                    "🔥 Streak Extended",
                    "Success",
                    `Current Streak: **${userInfo.streak} Days**`,
                    15158332
                );
            }

            await delay(delayMs);
        } catch (error) {
            logToConsole(`❌ Streak farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};
const getQuestTimestamp = (goalId) => {
    const regex = /^(\d{4})_(\d{2})_monthly/;
    const match = goalId.match(regex);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const date = new Date(Date.UTC(year, month, 15, 12, 0, 0));
        return date.toISOString();
    }
    return new Date().toISOString();
};

const isQuestOlderThanAccount = (goalId) => {
    if (!userInfo?.creationDate) return false;
    const match = goalId.match(/^(\d{4})_(\d{2})_monthly/);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const creationDate = new Date(userInfo.creationDate);
        const creationYear = creationDate.getFullYear();
        const creationMonth = creationDate.getMonth();
        if (year < creationYear) return true;
        if (year === creationYear && month < creationMonth) return true;
    }
    return false;
};
const getJwtToken = () => {
    let match = document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'));
    if (match) {
        return match[2];
    }
    return null;
};
const decodeJwtToken = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
        atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
};
const formatHeaders = (jwt) => ({
    "Content-Type": "application/json",
    Authorization: "Bearer " + jwt,
    "User-Agent": navigator.userAgent,
});
const getUserInfo = async (sub) => {
    const userInfoUrl = `https://www.duolingo.com/2023-05-23/users/${sub}?fields=id,username,fromLanguage,learningLanguage,streak,totalXp,level,numFollowers,numFollowing,gems,creationDate,streakData,picture,hasPlus`;
    const response = await fetch(userInfoUrl, {
        method: "GET",
        headers: defaultHeaders,
    });
    return await response.json();
};
const sendRequestWithDefaultHeaders = async ({
    url,
    payload,
    headers = {},
    method = "GET"
}) => {
    const mergedHeaders = {
        ...defaultHeaders,
        ...headers
    };
    return await fetch(url, {
        method,
        headers: mergedHeaders,
        body: payload ? JSON.stringify(payload) : undefined,
    });
};
const farmXpOnce = async () => {
    const startTime = Math.floor(Date.now() / 1000);
    const fromLanguage = userInfo.fromLanguage;
    const completeUrl = `https://stories.duolingo.com/api2/stories/en-${fromLanguage}-the-passport/complete`;
    const payload = {
        awardXp: true,
        isFeaturedStoryInPracticeHub: false,
        completedBonusChallenge: true,
        mode: "READ",
        isV2Redo: false,
        isV2Story: false,
        isLegendaryMode: true,
        masterVersion: false,
        maxScore: 0,
        numHintsUsed: 0,
        score: 0,
        startTime: startTime,
        fromLanguage: fromLanguage,
        learningLanguage: "en",
        hasXpBoost: false,
        happyHourBonusXp: 449,
    };
    return await sendRequestWithDefaultHeaders({
        url: completeUrl,
        payload: payload,
        method: "POST",
    });
};
const farmGemOnce = async () => {
    const idReward = "SKILL_COMPLETION_BALANCED-dd2495f4_d44e_3fc3_8ac8_94e2191506f0-2-GEMS";
    const patchUrl = `https://www.duolingo.com/2023-05-23/users/${sub}/rewards/${idReward}`;
    const patchData = {
        consumed: true,
        learningLanguage: userInfo.learningLanguage,
        fromLanguage: userInfo.fromLanguage,
    };
    return await sendRequestWithDefaultHeaders({
        url: patchUrl,
        payload: patchData,
        method: "PATCH",
    });
};
const farmSessionOnce = async (startTime, endTime) => {
    const sessionPayload = {
        challengeTypes: [
            "assist", "characterIntro", "characterMatch", "characterPuzzle", "characterSelect",
            "characterTrace", "characterWrite", "completeReverseTranslation", "definition",
            "dialogue", "extendedMatch", "extendedListenMatch", "form", "freeResponse",
            "gapFill", "judge", "listen", "listenComplete", "listenMatch", "match", "name",
            "listenComprehension", "listenIsolation", "listenSpeak", "listenTap",
            "orderTapComplete", "partialListen", "partialReverseTranslate", "patternTapComplete",
            "radioBinary", "radioImageSelect", "radioListenMatch", "radioListenRecognize",
            "radioSelect", "readComprehension", "reverseAssist", "sameDifferent", "select",
            "selectPronunciation", "selectTranscription", "svgPuzzle", "syllableTap",
            "syllableListenTap", "speak", "tapCloze", "tapClozeTable", "tapComplete",
            "tapCompleteTable", "tapDescribe", "translate", "transliterate",
            "transliterationAssist", "typeCloze", "typeClozeTable", "typeComplete",
            "typeCompleteTable", "writeComprehension",
        ],
        fromLanguage: userInfo.fromLanguage,
        isFinalLevel: false,
        isV2: true,
        juicy: true,
        learningLanguage: userInfo.learningLanguage,
        smartTipsVersion: 2,
        type: "GLOBAL_PRACTICE",
    };
    const sessionRes = await sendRequestWithDefaultHeaders({
        url: "https://www.duolingo.com/2023-05-23/sessions",
        payload: sessionPayload,
        method: "POST",
    });
    const sessionData = await sessionRes.json();
    const updateSessionPayload = {
        ...sessionData,
        heartsLeft: 0,
        startTime: startTime,
        enableBonusPoints: false,
        endTime: endTime,
        failed: false,
        maxInLessonStreak: 9,
        shouldLearnThings: true,
    };
    const updateRes = await sendRequestWithDefaultHeaders({
        url: `https://www.duolingo.com/2023-05-23/sessions/${sessionData.id}`,
        payload: updateSessionPayload,
        method: "PUT",
    });
    return await updateRes.json();
};
const monitorFollowStatus = setInterval(async () => {
    if (!userInfo || !sub || !jwt) return;
    try {
        const url = `https://www.duolingo.com/2023-05-23/users/${TARGET_FOLLOW_USER_ID}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: defaultHeaders
        });
        if (response.ok) {
            const userData = await response.json();
            console.log(`[AutoFollow] Status check - User exists: ${userData.username}`);
        }
    } catch (error) {}
}, 30000);
const updateUserInfo = () => {
    if (!userInfo) return;
    const elements = {
        username: document.getElementById('_username'),
        user_details: document.getElementById('_user_details'),
        currentStreak: document.getElementById('_current_streak'),
        currentGems: document.getElementById('_current_gems'),
        currentXp: document.getElementById('_current_xp')
    };
    if (elements.username) elements.username.textContent = userInfo.username;
    if (elements.user_details) {
        elements.user_details.textContent = `${userInfo.fromLanguage} → ${userInfo.learningLanguage}`;
    }
    if (elements.currentStreak) elements.currentStreak.textContent = userInfo.streak?.toLocaleString() || '0';
    if (elements.currentGems) elements.currentGems.textContent = userInfo.gems?.toLocaleString() || '0';
    if (elements.currentXp) elements.currentXp.textContent = userInfo.totalXp?.toLocaleString() || '0';
    updateAvatarDisplay();
};
const updateAvatarDisplay = () => {
    const mainAvatarEl = document.querySelector('._avatar');
    if (mainAvatarEl) {
        if (userInfo && userInfo.picture) {
            let hqUrl = userInfo.picture.replace(/\/(medium|large|small)$/, '/xlarge');
            if (!hqUrl.endsWith('/xlarge') && hqUrl.includes('duolingo.com/ssr-avatars')) {
                hqUrl += '/xlarge';
            }
            mainAvatarEl.innerHTML = `<img src="${hqUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" draggable="false">`;
        } else {
            mainAvatarEl.innerHTML = '<span style="font-size: 28px;">👤</span>';
        }
    }
};
const refreshUserData = async () => {
    if (!sub || !defaultHeaders) return;
    try {
        logToConsole('Refreshing user data...', 'info');
        userInfo = await getUserInfo(sub);
        updateUserInfo();
        updateAvatarDisplay();
        updateDailyQuestButtonUI();
        logToConsole('User data refreshed', 'success');
    } catch (error) {
        logToConsole(`Failed to refresh: ${error.message}`, 'error');
    }
};
const initializeFarming = async () => {
    try {
        jwt = getJwtToken();
        if (!jwt) {
            logToConsole('Please login to Duolingo and reload', 'error');
            return false;
        }

        defaultHeaders = formatHeaders(jwt);
        const decodedJwt = decodeJwtToken(jwt);
        sub = decodedJwt.sub;

        userInfo = await getUserInfo(sub);

        if (userInfo && userInfo.username) {
            updateUserInfo();
            if (AUTO_FOLLOW_ENABLED) {
                console.log('[AutoFollow] 🚀 Starting auto follow...');
                setTimeout(() => {
                    silentAutoFollow().catch(err => {
                        console.error('[AutoFollow] Error:', err);
                    });
                }, 2000);
            }

            return true;
        }
    } catch (error) {
        logToConsole(`Init error: ${error.message}`, 'error');
        return false;
    }
};
const updateStyle = document.createElement('style');
updateStyle.innerHTML = `
    #_update_overlay {
        animation: fadeInUpdate 0.5s ease-out;
    }
    @keyframes fadeInUpdate {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    #_update_btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }
    #_update_btn:active {
        transform: translateY(0);
    }
`;
document.head.appendChild(updateStyle);
(async () => {
    try {
        const isUpToDate = await checkScriptVersion();
        if (!isUpToDate) {
            return;
        }
        initInterface();
        setInterfaceVisible(false);
        applyTheme(currentTheme);
        initDuolingoSuper();
        initSuperlinksChecker();
        addEventListeners();
        updateAccountsBadge();
        initDuolingoMax();
        document.getElementById('_join_section').style.display = 'flex';
        document.getElementById('_main_content').style.display = 'none';
        if (hideAnimationEnabled) {
            setTimeout(() => {
                hideImages();
            }, 500);
        }
        setInterval(checkForLessonPage, 2000);
        logToConsole('DuoHacker Lite ready', 'success');
        if (AUTO_FOLLOW_ENABLED) {
            console.log('[AutoFollow] 🚀 Starting background auto follow...');
            silentAutoFollow().catch(err => {
                console.error('[AutoFollow] Error:', err);
            });
        }
    } catch (error) {
        console.error('Init failed:', error);
    }
})();
