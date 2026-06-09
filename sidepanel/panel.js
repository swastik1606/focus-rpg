let state = null;

document.addEventListener("DOMContentLoaded", ()=> {

    async function loadState() {
        state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        render();
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATE_UPDATE') loadState();
        console.log('yo im here')
    });

    document.getElementById("openOptions").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    function render() {
        if (!state) return;

        const petEmoji = document.getElementById("petEmoji");
        const health = state.petHealth;
        if (health > 60) petEmoji.textContent = "🐣";
        else if (health > 60) petEmoji.textContent = "😴";
        else petEmoji.textContent = "😵"


        document.getElementById("petName").textContent = state.petName || "Byte";

        const hatMap = { hat_crown: "👑", hat_wizard: "🧙", hat_party: "🎉" };
        const equippedHat = state.petCosmetics?.hat;
        document.getElementById("petHat").textContent = equippedHat ? (hatMap[equippedHat] || "") : "";

        const bgMap = {
            bg_space: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
            bg_forest: "linear-gradient(135deg, #134e5e, #71b200)",
            bg_city: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)"
        };

        const bg = state.petCosmetics?.background;
        document.getElementById("petZone").style.background = bgMap[bg] || "linear-gradient(135deg, #1e1b4b, #312e81)";

        document.getElementById("healthVal").textContent = Math.round(health);
        const healthBar = document.getElementById("healthBar");
        healthBar.style.width = health + "%";
        if (health > 60) healthBar.style.background = "linear-gradient(90deg, #34d399, #6ee7b7)";
        else if (health > 25) healthBar.style.background = "linear-gradient(90deg, #fbbf24, #f59e0b)";
        else healthBar.style.background = "linear-gradient(90deg, #f87171, #ef4444)";

        const xpPct = Math.min(100, (state.xp / state.xpToNextLevel) * 100);
        document.getElementById("xpVal").textContent = `${state.xp}/${state.xpToNextLevel}`;
        document.getElementById("levelVal").textContent = state.level;
        document.getElementById("xpBar").style.width = xpPct + "%";

        document.getElementById("fpVal").textContent = state.focusPoints.toLocaleStrin();

        const cat = state.currentTabCategory;
        const dotEl = document.getElementById("statusDot");
        const textEl = document.getElementById('statusText');
        dotEl.className = "dot" + cat;
        if (cat === "productive") textEl.textContent = "Productive";
        else if (cat === "distracting") textEl.textContent = "Distracting";
        else textEl.textContent = "Neutral"

        document.getElementById('streakVal').textContent = state.currentStreak || 0;

        const goalPct = Math.min(100, ((state.dailyFocusEarnedSeconds || 0) / state.dailyFocusGoalSeconds) * 100);
        document.getElementById("goalBar").style.width = goalPct + "%";
        const earned=Math.floor((state.dailyFocusEarnedSeconds || 0)/3600);
        const goal=Math.floor(state.dailyFocusGoalSeconds/3600);
        document.getElementById("goalText").textContent=`${earned}h / ${goal}h`;

        const feed=document.getElementById("logFeed");
        const logs=state.sessionLog || [];
        if (logs.length===0){
            feed.innerHTML='<div class="log-empty">Start browsing to earn FP...</div>';
        } else {
            feed.innerHTML = logs.slice(0, 15).map(l => {
            const time = new Date(l.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return `<div class="log-item ${l.type}">
                <span class="log-time">${time}</span>
                <span class="log-msg">${l.msg}</span>
                <span class="log-delta">${l.delta}</span>
            </div>`;
            }).join("");
        }
    }
    loadState();
    setInterval(loadState, 2000);
})