// =============================================================
// GHS ↔ NGN Rate Tool — v1
//
// v2 Migration Notes:
//   - Replace loadRates() body with an API call to your central DB
//   - saveRate() becomes a no-op (rates will be read-only from DB)
//   - The calculation engine and UI logic stay exactly the same
// =============================================================


// ---- STATE ----

const state = {
    sendRate: 0,
    receiveRate: 0,
    conversionType: "GHS_TO_NGN", // "GHS_TO_NGN" | "NGN_TO_GHS"
    lastEdited: "ghs",            // "ghs" | "ngn" — whichever field the user typed in last
    ghsAmount: 0,
    ngnAmount: 0
};


// ---- DOM ----

const sendRateInput    = document.getElementById("sendRate");
const receiveRateInput = document.getElementById("receiveRate");
const btnGHS           = document.getElementById("btnGHS");
const btnNGN           = document.getElementById("btnNGN");
const ghsAmountInput   = document.getElementById("ghsAmount");
const ngnAmountInput   = document.getElementById("ngnAmount");
const spreadDisplay    = document.getElementById("spreadDisplay");
const resultCard       = document.getElementById("resultCard");
const resultMain       = document.getElementById("resultMain");
const resultSub        = document.getElementById("resultSub");
const sendRateChip     = document.getElementById("sendRateChip");
const receiveRateChip  = document.getElementById("receiveRateChip");
const activeRateHint   = document.getElementById("activeRateHint");
const ghsHint          = document.getElementById("ghsHint");
const ngnHint          = document.getElementById("ngnHint");
const helpToggle       = document.getElementById("helpToggle");
const helpPanel        = document.getElementById("helpPanel");
const helpIcon         = document.getElementById("helpIcon");
const tooltip          = document.getElementById("tooltip");


// ---- v2 RATE HOOKS ----

/**
 * Loads exchange rates into state and populates the inputs.
 *
 * v1:  Reads from localStorage (manual entry, persisted locally).
 * v2:  Replace this body with:
 *        const rates = await fetch("/api/rates").then(r => r.json());
 *        state.sendRate    = rates.sendRate;
 *        state.receiveRate = rates.receiveRate;
 *        sendRateInput.value    = rates.sendRate;
 *        receiveRateInput.value = rates.receiveRate;
 *        sendRateInput.disabled    = true;  // read-only in v2
 *        receiveRateInput.disabled = true;
 */
function loadRates() {
    state.sendRate    = parseFloat(localStorage.getItem("sendRate"))    || 0;
    state.receiveRate = parseFloat(localStorage.getItem("receiveRate")) || 0;
    if (state.sendRate)    sendRateInput.value    = state.sendRate;
    if (state.receiveRate) receiveRateInput.value = state.receiveRate;
}

/**
 * Persists a rate after manual edit.
 *
 * v1:  Saves to localStorage.
 * v2:  Remove this call entirely — rates come from the DB, not edited locally.
 */
function saveRate(key, value) {
    localStorage.setItem(key, value);
}


// ---- UTILS ----

function fmt(n, dec = 2) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString("en-US", {
        minimumFractionDigits:  dec,
        maximumFractionDigits:  dec
    });
}


// ---- CORE CALCULATION ENGINE ----
//
// Covers all 4 transaction flows:
//
//  GHS_TO_NGN + lastEdited=ghs  →  Customer gives GHS, gets NGN
//                                   NGN = GHS × sendRate
//
//  GHS_TO_NGN + lastEdited=ngn  →  Customer wants X NGN, how much GHS to give?
//                                   GHS = NGN ÷ sendRate
//
//  NGN_TO_GHS + lastEdited=ngn  →  Customer gives NGN, gets GHS
//                                   GHS = NGN ÷ receiveRate
//
//  NGN_TO_GHS + lastEdited=ghs  →  Customer wants X GHS, how much NGN to give?
//                                   NGN = GHS × receiveRate

function calculate({ conversionType, sendRate, receiveRate, lastEdited, ghsAmount, ngnAmount }) {
    const isSendingGHS = conversionType === "GHS_TO_NGN";
    const rate         = isSendingGHS ? sendRate : receiveRate;
    const rateName     = isSendingGHS ? "send" : "receive";

    if (!rate || rate <= 0) {
        return { error: `Set your ${rateName} rate above to continue` };
    }

    if (lastEdited === "ghs") {
        if (!ghsAmount || ghsAmount <= 0) return { clear: true };
        return { ghsAmount, ngnAmount: ghsAmount * rate, rate, rateName };
    }

    // lastEdited === "ngn"
    if (!ngnAmount || ngnAmount <= 0) return { clear: true };
    return { ghsAmount: ngnAmount / rate, ngnAmount, rate, rateName };
}


// ---- SPREAD ----

function updateSpread() {
    const { sendRate, receiveRate } = state;

    sendRateChip.textContent    = sendRate    > 0 ? fmt(sendRate,    2) : "—";
    receiveRateChip.textContent = receiveRate > 0 ? fmt(receiveRate, 2) : "—";

    if (sendRate > 0 && receiveRate > 0) {
        const spread = sendRate - receiveRate;
        const pct    = ((spread / receiveRate) * 100).toFixed(1);

        if (spread > 0) {
            spreadDisplay.className  = "spread-bar spread-ok";
            spreadDisplay.innerHTML  =
                `<span class="spread-dot">&#9679;</span> Margin: <strong>${fmt(spread, 2)} NGN per GHS</strong> &nbsp;&middot;&nbsp; ${pct}% spread`;
        } else if (spread === 0) {
            spreadDisplay.className  = "spread-bar spread-warn";
            spreadDisplay.innerHTML  =
                `<span class="spread-dot">&#9679;</span> No margin — send and receive rates are equal`;
        } else {
            spreadDisplay.className  = "spread-bar spread-error";
            spreadDisplay.innerHTML  =
                `<span class="spread-dot">&#9679;</span> Warning: send rate is lower than receive rate — check your rates`;
        }
    } else {
        spreadDisplay.className = "spread-bar";
        spreadDisplay.innerHTML = "";
    }
}


// ---- DIRECTION LABELS ----

function updateLabels() {
    const isSendingGHS = state.conversionType === "GHS_TO_NGN";

    if (isSendingGHS) {
        ghsHint.textContent = "Customer gives ↑";
        ngnHint.textContent = "Customer receives ↓";
        activeRateHint.textContent = state.sendRate > 0
            ? `Send rate: ${fmt(state.sendRate, 2)} NGN/GHS`
            : "Set send rate above";
    } else {
        ngnHint.textContent = "Customer gives ↑";
        ghsHint.textContent = "Customer receives ↓";
        activeRateHint.textContent = state.receiveRate > 0
            ? `Receive rate: ${fmt(state.receiveRate, 2)} NGN/GHS`
            : "Set receive rate above";
    }
}


// ---- RENDER RESULT ----

function renderResult() {
    const result = calculate(state);

    if (result.error) {
        resultCard.className    = "result-card result-warn";
        resultMain.textContent  = result.error;
        resultSub.textContent   = "";
        return;
    }

    if (result.clear) {
        resultCard.className    = "result-card";
        resultMain.textContent  = "Enter an amount above";
        resultSub.textContent   = "";
        // Clear the other field
        if (state.lastEdited === "ghs") { ngnAmountInput.value = ""; state.ngnAmount = 0; }
        else                            { ghsAmountInput.value  = ""; state.ghsAmount = 0; }
        return;
    }

    // Update the non-edited field (without triggering its input event)
    if (state.lastEdited === "ghs") {
        ngnAmountInput.value = result.ngnAmount.toFixed(2);
        state.ngnAmount      = result.ngnAmount;
    } else {
        ghsAmountInput.value = result.ghsAmount.toFixed(2);
        state.ghsAmount      = result.ghsAmount;
    }

    resultCard.className   = "result-card result-active";
    resultMain.innerHTML   = `&#8373;${fmt(result.ghsAmount)} &nbsp;&rarr;&nbsp; &#8358;${fmt(result.ngnAmount)}`;
    resultSub.textContent  = `${fmt(result.rate, 2)} NGN per GHS (${result.rateName} rate)`;
}


// ---- FULL REFRESH ----

function refresh() {
    updateSpread();
    updateLabels();
    renderResult();
}


// ---- EVENTS: RATES ----

sendRateInput.addEventListener("input", (e) => {
    state.sendRate = parseFloat(e.target.value) || 0;
    saveRate("sendRate", state.sendRate);
    refresh();
});

receiveRateInput.addEventListener("input", (e) => {
    state.receiveRate = parseFloat(e.target.value) || 0;
    saveRate("receiveRate", state.receiveRate);
    refresh();
});


// ---- EVENTS: TRANSACTION TYPE ----

function setTxType(type) {
    state.conversionType = type;
    btnGHS.classList.toggle("active", type === "GHS_TO_NGN");
    btnNGN.classList.toggle("active", type === "NGN_TO_GHS");
    refresh();
}

btnGHS.addEventListener("click", () => setTxType("GHS_TO_NGN"));
btnNGN.addEventListener("click", () => setTxType("NGN_TO_GHS"));


// ---- EVENTS: AMOUNTS ----

ghsAmountInput.addEventListener("input", (e) => {
    state.lastEdited = "ghs";
    state.ghsAmount  = parseFloat(e.target.value) || 0;
    renderResult();
});

ngnAmountInput.addEventListener("input", (e) => {
    state.lastEdited = "ngn";
    state.ngnAmount  = parseFloat(e.target.value) || 0;
    renderResult();
});


// ---- HELP PANEL ----

helpToggle.addEventListener("click", () => {
    const isOpen = helpPanel.classList.toggle("open");
    helpIcon.textContent = isOpen ? "✕" : "?";
    helpToggle.classList.toggle("active", isOpen);
});


// ---- TOOLTIPS ----

document.querySelectorAll(".info-icon").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tip  = btn.dataset.tip;
        const rect = btn.getBoundingClientRect();

        tooltip.textContent = tip;
        tooltip.style.top   = `${rect.bottom + window.scrollY + 8}px`;
        tooltip.style.left  = `${Math.min(rect.left + window.scrollX, window.innerWidth - 240)}px`;
        tooltip.classList.add("visible");
    });
});

document.addEventListener("click", () => tooltip.classList.remove("visible"));


// ---- INIT ----

loadRates();
refresh();
