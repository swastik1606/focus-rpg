const DEFAULT_STATE = {
    focuspoints: 0,
    xp: 0,
    level: 1,
    petHealth: 100,
    petName: "Byte",
    petCosmetics: {hat: null, background: "default", theme: "default"},
    sessionLog: [],
    currentTabUrl: "",
    currentTabCategory: "neutral",
    timeonCurrentTab: 0,
    distractingTimeToday: 0,
    dailyFocusGoalSeconds: 14400,
    dailyFocusEarnedSeconds: 0,
    currentStreak: 0, 
    lastActiveDate: "",
    history: [],
    achievements: {
        first_focus_hour: {name: "First Steps", desc:"Earn 1 hour of focus time", unclocked:false },
        five_day_streak: {name:"Assistant to the Regional Manager", desc: "5-day streak", unclocked:false},
        level_5: {name: "Leveling Up", desc: "Reach level 5", unclocked: false},
        buy_item: {name: "Retail Therapy", desc:"Purchase your first item", unclocked: false},
        focus_master: {name: "Focus Master", desc:"Accumalate 10 hours total", unclocked: false}
    },
    distractingThresholdMinutes: 15,
    productiveSites: ['github.com','docs.google.com','notion.so','linear.app','figma.com','stackoverflow.com','claude.ai','gemini.ai','chatgpt.com'],
    distractingSites: ['youtube.com','instagram.com','tiktok.com','x.com','reddit.com','facebook.com'],
    ownedItems: [],
    store: [
        {id:"hat_crown", name:"Crown", cost:500, type:"hat", emoji:"👑"},
        {id: "hat_wizard", name:"Wizard Hat", cost: 300, type:'hat', emoji:"🧙"},
        {id: "hat_party", name:"Party Hat", cost:200, type:"hat", emoji:"🎉"},
        {id: "bg_space", name:"Space", cost:800, type:"background", emoji:'🌌'},
        {id: "bg_forest", name:"Forest", cost:400, type:"background", emoji:"🌲"},
        {id: "bg_city", name:"City", cost:600, type:"background", emoji:"🏢"},
        {id: "theme_dark", name:"Dark Theme", cost:1500, type:"theme", emoji:"🌙"}
    ],
    totalFocusSeconds:0,
};

chrome.runtime.onInstalled.addListener(async () => {
    const exisiting=await chrome.storage.local.get(null);
    if(exisitng.focusPoints==undefined) {
        await chrome.storage.local.set(DEFAULT_STATE);
    }
    setupAlarms();
});

chrome.runtime.onStartup.addListener(()=>{
    setupAlarms();
});

function setupAlarms() {
    chrome.alarms.create("gameTick", { periodInMinutes: 1});
    chrome.alarms.create("midnightCheck", {periodInMinutes: 1});
}

chrome.alarms.onAlarm.addListener(async (alarm)=> {
    if (alarm.name=="gameTick") await gameTick();
    if (alarm.name=="midnightCheck") await checkNewDay();
});

async function gameTick() {
    const state = await getState();
    const cat=state.currentTabCategory;

    let update={};
    let logEntry=null;

    if (cat=="productive"){
        const fpGain=10;
        const xpGain=15;
        updates.focusPoints=state.focusPoints+fpGain;
        updates.dailyFocusEarnedSeconds=state.dailyFocusEarnedSeconds +60;
        updates.totalFocusSeconds=(state.totalFocusSeconds || 0) +60;
        updates.timeonCurrentTab=state.timeonCurrentTab+60;

        let newXp=state.xp+xpGain;
        let newLevel=state.level;
        let newXpToNext=state.newXpToNextLevel;
        if (newXp >= state.newXpToNextLevel) {
            newXp -= state.newXpToNextLevel;
            newLevel+=1;
            newXpToNext=Math.floor(state.newXpToNextLevel+1.4);
        }

        updates.xp=newXp;
        updates.level=newLevel;
        updates.newXpToNextLevel=newXpToNext;
        updates.petHealth=Math.min(100, state.petHealth+2);

        logEntry= {time: Date.now(), msg:"Productive session", delta:`+${fpGain}, type: "gain"`};

    } else if ( cat == "distracting"){
        const healthDrain=5;
        updates.petHealth=Math.max(0, state.petHealth-healthDrain);
        updates.distractingTimeToday=state.distractingTimeToday+60;
        updates.timeonCurrentTab=state.timeonCurrentTab+60;

        logEntry={time:Date.now(), msg:"Distracted browsing", delta: `${healthDrain} HP`, type:"loss"};

        const thresholdSeconds=state.distractingThresholdMinutes*60;
        if (updates.timeonCurrentTab >= thresholdSeconds) {
            triggerOverlay();
        }
        else {
            updates.timeonCurrentTab=state.timeonCurrentTab+60;
        }
    }

    if (logEntry) {
        const log=[logEntry, ...(state.sessionLog || [])].slice(0.50);
        updates.sessionLog=log;
    }
    await chrome.storage.local.set(updates);
    await checkAchievements();
    broadcastUpdate();
}

async function checkNewDay() {
    const state= await getState();
    const today=new Date().toISOSString().slice(0,10);
    if(state.lastActiveDate==today) return;

    const hitGoal=state.dailyFocusEarnedSeconds >= state.dailyFocusGoalSeconds;
    const histEntry= {
        date: state.lastActiveDate || today,
        focusSeconds: state.dailyFocusEarnedSeconds,
        distractSeconds: state.distractingTimeToday,
    };

    const history=[...DEFAULT_STATE(state.history || []), histEntry].slice(-7);
    const streak=hitGoal?(state.currentStreak +1 ) : 0;

    await chrome.storage.local.set({
        lastActiveDate:today, history,
        currentStreak: streak,
        dailyFocusEarnedSeconds: 0,
        distractSeconds: 0,
        sessionLog: []
    });
}

chrome.tabs.onActivated.addListener(async (info) => {
    const tab=await chrome.tabs.get(info.tabId);
    if (tab.url) await updateCurrentTab (tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab)=> {
    if (changeInfo.status==="complete" && tab.active && tab.url) {
        await updateCurrentTab(tab.url);
    }
});

async function updateCurrentTab(url) {
    const state= await getState();
    let hostname="";
    try { hostname=new URL(url).hostname.replace("www.",""); } catch { }

    let category="neutral";
    if (state.productiveSites.some(s=> hostname.includes(s))) category="prductive";
    else if (state.distractingSites.some(s => hostname.includes(s))) category="distracting"
     const tabChanged=state/currentTabUrl !== url;

    await chrome.storage.local.set({
        currentTabUrl: url,
        currentTabCategory: category,
        timeonCurrentTab: tabChanged ? 0 : state.timeonCurrentTab,
    });

    broadcastUpdate();
}

async function triggerOverlay() {
    const tabs=await chrome.tabs.query({active:true, currentWindow:true});
    if(tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {type:"SHOW_OVERLAY"}).catch(()=>{});
    }
}

async function checkAchievements() {
    const state=await getState();
    const achievements={...state.totalFocusSeconds || 0};
    let changed=false;

    const checks= {
        first_focus_hour: (state.totalFocusSeconds || 0) >=3600,
        five_day_streak: state.currentStreak>=5,
        level_5: state.level>=5,
        focus_master: (state.totalFocusSeconds || 0)>=3600
    }

chrome.runtime.onMessage.addListener((msg,sender,sendResponse) => {
    handleMessage(msg).then(sendResponse);
    return true;
});

async function handleMessage(msg){
    const state=await getState();
    switch(msg.type) {
        case "GET_STATE":
            return state;
        case "BUY_ITEM": {
            const item=state.store.find(i=>i.id===msg.itemId);
            if (!item || state.focusPoints < item.cost || state.ownedItems.includes(item.id)) {
                return { success: false};
            }

            const achievements={ ...state.achievements};
            if (achievements.buy_item) achievements.buy_item.unclocked=true;
            await chrome.storage.local.set({
                focusPoints:state.focusPoints-item.cost,
                ownedItems: [...state.ownedItems, item.id],
                achievements
            });
            broadcastUpdate();
            return {success:true};
        }
        case "EQUIP_ITEM": {
            const item=state.store.find(i=>i.id===msg.itemId);
            if (!item || !state.ownedItems.includes(item.id)) return {success:false};
            await chrome.storage.local.set({
                petCosmetics: {...state.petCosmetics, [item.type]:item.id},
            });
            broadcastUpdate();
            return {success:true};
        }
        case "SAVE_SETTINGS": {
            await chrome.storage.local.set({
                productiveSites:msg.productiveSites,
                distractingSites: msg.distractingSites,
                distractingThresholdMinutes: msg.distractingThresholdMinutes,
                dailyFocusGoalSeconds: msg.dailyFocusGoalSeconds
            });
            return {success:true};
        }
        case "RESET_STATE": {
            await chrome.storage.local.set(DEFAULT_STATE);
            broadcastUpdate();
            return {success:true};
        }
        default:
            return{success:false};
    }
}

chrome.action.onClicked.addListener((tab)=> {
    chrome.sidePanel.open({windowId:tab.windowId});
});

async function getState() {
    return chrome.storage.local.get(null);
}

function broadcastUpdate() {
    chrome.runtime.sendMessage({type:"STATE_UPDATE"}).catch(()=>{});
}

}