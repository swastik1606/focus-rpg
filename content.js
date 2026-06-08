chrome.runtime.onMessage.addListener((msg)=>{
    if(msg.type==="SHOW_OVERLAY") showOverlay();
});

function showOverlay() {
    if(document.getElementById("focus-rpg-overlay")) return;
}

const overlay=document.createElement("div");
overlay.id="focus-rpg-overlay";
overlay.innerHTML=`
    <div class="frpg-modal">
        <div class="frpg-pet-anim">😵</div>
        <h1 class="frpg-title>Byte needs you!</h1>
        <p class="frpg-sub">You've been distracted for too long.<br>Your pet is suffering. Get back to work</p>
        <div class="frpg-health-bar">
            <div class="frpg-health-inner" style="width: 15%"></div>
        </div>
        <p class="frpg-health-labeel">Pet Health: Critical</p>
        <button class="frpg-btn" id="frpg-leave-btn">Leave this site</button>
        <p class="frpg-dismiss">or<span id="frpg-dismiss">stay and accept consequences</span></p>
    </div> 
`;
document.body.appendChild(overlay);

document.getElementById("frpg-leave-btn").addEventListener("click", ()=> {
    window.history.back();
});

document.getElementById("frpg-dismiss").addEventListener("click", ()=>{
    overlay.remove()
});