// =============================================================
// GHS ↔ NGN Rate Tool — v1 (CORRECTED for West African market)
//
// UNDERSTANDING THE RATES:
// - Send Rate = 8.5  (means ₵1 = ₦8.5 × 1000 = ₦8,500)
// - Receive Rate = 7.9 (means ₵1 = ₦7.9 × 1000 = ₦7,900)
//
// CONVERSION RULES:
// 1. GHS → NGN: (GHS ÷ send rate) × 1000 = NGN
//    Example: ₵200 ÷ 8.5 = 23.53 × 1000 = ₦23,530
//
// 2. NGN → GHS: (NGN ÷ 1000) × receive rate = GHS
//    Example: ₦200,000 ÷ 1000 = 200 × 7.9 = ₵1,580
//
// 3. Want GHS (pay NGN): (GHS wanted ÷ receive rate) × 1000 = NGN to pay
//    Example: Want ₵200 ÷ 7.9 = 25.32 × 1000 = ₦25,320
//
// 4. Want NGN (pay GHS): (NGN wanted ÷ 1000) × send rate = GHS to pay
//    Example: Want ₦200,000 ÷ 1000 = 200 × 8.5 = ₵1,700
// =============================================================


// ---- TRANSACTION CONFIG ----

const TX = {
    // Sending GHS to Nigeria
    GHS_SEND: {
        dir: "GHS_TO_NGN",
        label: "Sending GHS",
        formula: "GHS ÷ send rate × 1000 = NGN",
        primaryField: "ghs",
        resultFormat: (ghs, ngn) => `Give ₵${fmt(ghs)} → Receive ₦${fmt(ngn, 0)}`,
        rateType: "send"
    },
    // Sending NGN to Ghana
    NGN_SEND: {
        dir: "NGN_TO_GHS",
        label: "Sending NGN",
        formula: "NGN ÷ 1000 × receive rate = GHS",
        primaryField: "ngn",
        resultFormat: (ghs, ngn) => `Give ₦${fmt(ngn, 0)} → Receive ₵${fmt(ghs)}`,
        rateType: "receive"
    },
    // Want to receive GHS in Ghana
    GHS_RECV: {
        dir: "WANT_GHS",
        label: "Receiving GHS",
        formula: "GHS wanted ÷ receive rate × 1000 = NGN to pay",
        primaryField: "ghs",
        resultFormat: (ghs, ngn) => `Want ₵${fmt(ghs)} → Pay ₦${fmt(ngn, 0)}`,
        rateType: "receive"
    },
    // Want to receive NGN in Nigeria
    NGN_RECV: {
        dir: "WANT_NGN",
        label: "Receiving NGN",
        formula: "NGN wanted ÷ 1000 × send rate = GHS to pay",
        primaryField: "ngn",
        resultFormat: (ghs, ngn) => `Want ₦${fmt(ngn, 0)} → Pay ₵${fmt(ghs)}`,
        rateType: "send"
    }
};


// ---- STATE ----

const state = {
    sendRate: 8.5,
    receiveRate: 7.9,
    txKey: "GHS_SEND",
    lastEdited: "ghs",
    ghsAmount: 0,
    ngnAmount: 0
};

const recvState = {
    txKey: "GHS_RECV",
    lastEdited: "ghs",
    ghsAmount: 0,
    ngnAmount: 0
};

const appConfig = {
    apiBase: String(window.RATE_API_BASE || "").replace(/\/$/, ""),
    adminToken: String(window.RATE_ADMIN_TOKEN || ""),
    customerFacing: Boolean(window.CUSTOMER_FACING)
};

let saveRatesTimer = null;


// ---- DOM ELEMENTS ----

const sendRateInput = document.getElementById("sendRate");
const receiveRateInput = document.getElementById("receiveRate");
const spreadDisplay = document.getElementById("spreadDisplay");
const syncStatus = document.getElementById("syncStatus");

// Sending calculator
const ghsAmountInput = document.getElementById("ghsAmount");
const ngnAmountInput = document.getElementById("ngnAmount");
const resultCard = document.getElementById("resultCard");
const resultMain = document.getElementById("resultMain");
const resultSub = document.getElementById("resultSub");
const ghsSendLabel = document.getElementById("ghsSendLabel");
const ngnSendLabel = document.getElementById("ngnSendLabel");

// Receiving calculator
const recvGhsAmountInput = document.getElementById("recvGhsAmount");
const recvNgnAmountInput = document.getElementById("recvNgnAmount");
const recvResultCard = document.getElementById("recvResultCard");
const recvResultMain = document.getElementById("recvResultMain");
const recvResultSub = document.getElementById("recvResultSub");
const ghsRecvLabel = document.getElementById("ghsRecvLabel");
const ngnRecvLabel = document.getElementById("ngnRecvLabel");

// Help & tooltips
const helpToggle = document.getElementById("helpToggle");
const helpPanel = document.getElementById("helpPanel");
const helpIcon = document.getElementById("helpIcon");
const tooltip = document.getElementById("tooltip");

// Quote elements
const quoteGhsInput = document.getElementById("quoteGhs");
const quoteNgnInput = document.getElementById("quoteNgn");
const quoteWantGhsInput = document.getElementById("quoteWantGhs");
const quoteWantNgnInput = document.getElementById("quoteWantNgn");
const quoteGhsAmount = document.getElementById("quoteGhsAmount");
const quoteNgnAmount = document.getElementById("quoteNgnAmount");
const quoteWantGhsAmount = document.getElementById("quoteWantGhsAmount");
const quoteWantNgnAmount = document.getElementById("quoteWantNgnAmount");
const quoteGhsNote = document.getElementById("quoteGhsNote");
const quoteNgnNote = document.getElementById("quoteNgnNote");
const quoteWantGhsNote = document.getElementById("quoteWantGhsNote");
const quoteWantNgnNote = document.getElementById("quoteWantNgnNote");


// ---- UTILITIES ----

function fmt(n, dec = 2) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString("en-US", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
    });
}

function apiUrl(path) {
    return `${appConfig.apiBase}${path}`;
}

function setSyncStatus(message) {
    if (syncStatus) syncStatus.textContent = message || "";
}

function applyRates(sendRate, receiveRate) {
    state.sendRate = parseFloat(sendRate) || 8.5;
    state.receiveRate = parseFloat(receiveRate) || 7.9;
    sendRateInput.value = state.sendRate;
    receiveRateInput.value = state.receiveRate;
}

function loadLocalRates() {
    applyRates(
        localStorage.getItem("sendRate") || 8.5,
        localStorage.getItem("receiveRate") || 7.9
    );
}

async function loadRemoteRates({ silent = false } = {}) {
    if (!silent) setSyncStatus("Loading shared rates...");

    const response = await fetch(apiUrl("/api/rates"), {
        headers: { "Accept": "application/json" },
        cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Could not load shared rates");
    }

    applyRates(data.sendRate, data.receiveRate);
    saveRate("sendRate", state.sendRate);
    saveRate("receiveRate", state.receiveRate);
    updateSpread();
    renderSendingResult();
    renderReceivingResult();
    updateQuote();
    setSyncStatus(silent ? "" : "Shared rates loaded");
}

async function loadRates() {
    loadLocalRates();

    try {
        await loadRemoteRates();
    } catch (error) {
        setSyncStatus(`Using local rates. ${error.message}`);
    }
}

function saveRate(key, value) {
    localStorage.setItem(key, value);
}

async function saveRatesRemote() {
    const headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    };

    if (appConfig.adminToken) {
        headers.Authorization = `Bearer ${appConfig.adminToken}`;
    }

    const response = await fetch(apiUrl("/api/rates"), {
        method: "PUT",
        headers,
        body: JSON.stringify({
            sendRate: state.sendRate,
            receiveRate: state.receiveRate
        })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Could not save shared rates");
    }

    setSyncStatus("Shared rates saved");
}

function queueRateSave() {
    if (appConfig.customerFacing) return;

    clearTimeout(saveRatesTimer);
    setSyncStatus("Saving shared rates...");
    saveRatesTimer = setTimeout(() => {
        saveRatesRemote().catch(error => {
            setSyncStatus(`Local rates saved. ${error.message}`);
        });
    }, 350);
}

function setQuoteResult(amountEl, noteEl, amountText, noteText, hasValue) {
    amountEl.textContent = amountText;
    noteEl.textContent = noteText;
    amountEl.closest(".quote-result").classList.toggle("quote-has-value", hasValue);
}


// =====================================================================
// CALCULATION ENGINE — CORRECTED for West African market
// =====================================================================

function calculateSending(txKey, lastEdited, ghsVal, ngnVal) {
    const tx = TX[txKey];
    
    // SENDING GHS to Nigeria
    if (txKey === "GHS_SEND") {
        if (!state.sendRate || state.sendRate <= 0)
            return { error: "Set your send rate above" };
            
        if (lastEdited === "ghs") {
            if (!ghsVal || ghsVal <= 0) return { clear: true };
            // GHS → NGN: (GHS ÷ send rate) × 1000
            const ngn = (ghsVal / state.sendRate) * 1000;
            return { ghs: ghsVal, ngn, rate: state.sendRate };
        } else {
            if (!ngnVal || ngnVal <= 0) return { clear: true };
            // NGN → GHS reverse: (NGN ÷ 1000) × send rate
            const ghs = (ngnVal / 1000) * state.sendRate;
            return { ghs, ngn: ngnVal, rate: state.sendRate };
        }
    }
    
    // SENDING NGN to Ghana
    if (txKey === "NGN_SEND") {
        if (!state.receiveRate || state.receiveRate <= 0)
            return { error: "Set your receive rate above" };
            
        if (lastEdited === "ngn") {
            if (!ngnVal || ngnVal <= 0) return { clear: true };
            // NGN → GHS: (NGN ÷ 1000) × receive rate
            const ghs = (ngnVal / 1000) * state.receiveRate;
            return { ghs, ngn: ngnVal, rate: state.receiveRate };
        } else {
            if (!ghsVal || ghsVal <= 0) return { clear: true };
            // GHS → NGN reverse: (GHS × 1000) ÷ receive rate? No!
            // Actually: If they have GHS and want to know NGN equivalent when sending NGN,
            // it's the reverse of the above: NGN = (GHS × 1000) ÷ receive rate
            const ngn = (ghsVal * 1000) / state.receiveRate;
            return { ghs: ghsVal, ngn, rate: state.receiveRate };
        }
    }
    
    return { error: "Unknown transaction type" };
}

function calculateReceiving(txKey, lastEdited, ghsVal, ngnVal) {
    // WANT GHS (pay NGN)
    if (txKey === "GHS_RECV") {
        if (!state.receiveRate || state.receiveRate <= 0)
            return { error: "Set your receive rate above" };
            
        if (lastEdited === "ghs") {
            if (!ghsVal || ghsVal <= 0) return { clear: true };
            // Want GHS → Pay NGN: (GHS wanted ÷ receive rate) × 1000
            const ngn = (ghsVal / state.receiveRate) * 1000;
            return { ghs: ghsVal, ngn, rate: state.receiveRate };
        } else {
            if (!ngnVal || ngnVal <= 0) return { clear: true };
            // Pay NGN → Want GHS reverse: GHS = (NGN ÷ 1000) × receive rate
            const ghs = (ngnVal / 1000) * state.receiveRate;
            return { ghs, ngn: ngnVal, rate: state.receiveRate };
        }
    }
    
    // WANT NGN (pay GHS)
    if (txKey === "NGN_RECV") {
        if (!state.sendRate || state.sendRate <= 0)
            return { error: "Set your send rate above" };
            
        if (lastEdited === "ngn") {
            if (!ngnVal || ngnVal <= 0) return { clear: true };
            // Want NGN → Pay GHS: (NGN wanted ÷ 1000) × send rate
            const ghs = (ngnVal / 1000) * state.sendRate;
            return { ghs, ngn: ngnVal, rate: state.sendRate };
        } else {
            if (!ghsVal || ghsVal <= 0) return { clear: true };
            // Pay GHS → Want NGN reverse: NGN = (GHS × 1000) ÷ send rate
            const ngn = (ghsVal * 1000) / state.sendRate;
            return { ghs: ghsVal, ngn, rate: state.sendRate };
        }
    }
    
    return { error: "Unknown transaction type" };
}


// ---- RENDER FUNCTIONS ----

function renderSendingResult() {
    const result = calculateSending(
        state.txKey,
        state.lastEdited,
        state.ghsAmount,
        state.ngnAmount
    );
    
    if (result.error) {
        resultCard.className = "result-card result-warn";
        resultMain.textContent = result.error;
        resultSub.textContent = "";
        return;
    }
    
    if (result.clear) {
        resultCard.className = "result-card";
        resultMain.textContent = "Enter an amount above";
        resultSub.textContent = "";
        if (state.lastEdited === "ghs") {
            ngnAmountInput.value = "";
            state.ngnAmount = 0;
        } else {
            ghsAmountInput.value = "";
            state.ghsAmount = 0;
        }
        return;
    }
    
    // Update fields
    if (state.lastEdited === "ghs") {
        ngnAmountInput.value = Math.round(result.ngn);
        state.ngnAmount = result.ngn;
    } else {
        ghsAmountInput.value = result.ghs.toFixed(2);
        state.ghsAmount = result.ghs;
    }
    
    resultCard.className = "result-card result-active";
    resultMain.innerHTML = TX[state.txKey].resultFormat(result.ghs, result.ngn);
    
    const rateType = TX[state.txKey].rateType;
    resultSub.textContent = `${TX[state.txKey].formula}  ·  ${rateType} rate: ${fmt(result.rate, 2)}`;
}

function renderReceivingResult() {
    const result = calculateReceiving(
        recvState.txKey,
        recvState.lastEdited,
        recvState.ghsAmount,
        recvState.ngnAmount
    );
    
    if (result.error) {
        recvResultCard.className = "result-card result-warn";
        recvResultMain.textContent = result.error;
        recvResultSub.textContent = "";
        return;
    }
    
    if (result.clear) {
        recvResultCard.className = "result-card";
        recvResultMain.textContent = "Enter an amount above";
        recvResultSub.textContent = "";
        if (recvState.lastEdited === "ghs") {
            recvNgnAmountInput.value = "";
            recvState.ngnAmount = 0;
        } else {
            recvGhsAmountInput.value = "";
            recvState.ghsAmount = 0;
        }
        return;
    }
    
    // Update fields
    if (recvState.lastEdited === "ghs") {
        recvNgnAmountInput.value = Math.round(result.ngn);
        recvState.ngnAmount = result.ngn;
    } else {
        recvGhsAmountInput.value = result.ghs.toFixed(2);
        recvState.ghsAmount = result.ghs;
    }
    
    recvResultCard.className = "result-card result-active";
    recvResultMain.innerHTML = TX[recvState.txKey].resultFormat(result.ghs, result.ngn);
    
    const rateType = TX[recvState.txKey].rateType;
    recvResultSub.textContent = `${TX[recvState.txKey].formula}  ·  ${rateType} rate: ${fmt(result.rate, 2)}`;
}


// ---- SPREAD CALCULATION ----

function updateSpread() {
    const { sendRate, receiveRate } = state;
    
    if (sendRate > 0 && receiveRate > 0) {
        const spread = ((sendRate - receiveRate) / receiveRate) * 100;
        
        if (spread > 0) {
            spreadDisplay.className = "spread-bar spread-ok";
            spreadDisplay.textContent = `Profit margin: ${spread.toFixed(1)}% (Send: ${sendRate}, Receive: ${receiveRate})`;
        } else if (spread === 0) {
            spreadDisplay.className = "spread-bar spread-warn";
            spreadDisplay.textContent = "No profit margin - rates are equal";
        } else {
            spreadDisplay.className = "spread-bar spread-error";
            spreadDisplay.textContent = "Arbitrage risk: send rate is below receive rate.";
        }
    } else {
        spreadDisplay.className = "spread-bar";
        spreadDisplay.textContent = "Enter both rates to see your profit margin";
    }
}


// ---- QUOTE UPDATE ----

function updateQuote() {
    // Send GHS → Get NGN
    const ghsVal = parseFloat(quoteGhsInput.value) || 0;
    if (state.sendRate > 0 && ghsVal > 0) {
        const ngn = (ghsVal / state.sendRate) * 1000;
        setQuoteResult(quoteGhsAmount, quoteGhsNote, `₦${fmt(ngn, 0)}`, `Send rate: ${state.sendRate} (${ghsVal} ÷ ${state.sendRate} × 1000)`, true);
    } else {
        setQuoteResult(quoteGhsAmount, quoteGhsNote, "—", state.sendRate > 0 ? "Enter GHS amount" : "Set send rate first", false);
    }
    
    // Send NGN → Get GHS
    const ngnVal = parseFloat(quoteNgnInput.value) || 0;
    if (state.receiveRate > 0 && ngnVal > 0) {
        const ghs = (ngnVal / 1000) * state.receiveRate;
        setQuoteResult(quoteNgnAmount, quoteNgnNote, `₵${fmt(ghs)}`, `Receive rate: ${state.receiveRate} (${fmt(ngnVal, 0)} ÷ 1000 × ${state.receiveRate})`, true);
    } else {
        setQuoteResult(quoteNgnAmount, quoteNgnNote, "—", state.receiveRate > 0 ? "Enter NGN amount" : "Set receive rate first", false);
    }
    
    // Want GHS → Pay NGN
    const wantGhs = parseFloat(quoteWantGhsInput.value) || 0;
    if (state.receiveRate > 0 && wantGhs > 0) {
        const payNgn = (wantGhs / state.receiveRate) * 1000;
        setQuoteResult(quoteWantGhsAmount, quoteWantGhsNote, `₦${fmt(payNgn, 0)}`, `Receive rate: ${state.receiveRate} (${wantGhs} ÷ ${state.receiveRate} × 1000)`, true);
    } else {
        setQuoteResult(quoteWantGhsAmount, quoteWantGhsNote, "—", state.receiveRate > 0 ? "Enter GHS wanted" : "Set receive rate first", false);
    }
    
    // Want NGN → Pay GHS
    const wantNgn = parseFloat(quoteWantNgnInput.value) || 0;
    if (state.sendRate > 0 && wantNgn > 0) {
        const payGhs = (wantNgn / 1000) * state.sendRate;
        setQuoteResult(quoteWantNgnAmount, quoteWantNgnNote, `₵${fmt(payGhs)}`, `Send rate: ${state.sendRate} (${fmt(wantNgn, 0)} ÷ 1000 × ${state.sendRate})`, true);
    } else {
        setQuoteResult(quoteWantNgnAmount, quoteWantNgnNote, "—", state.sendRate > 0 ? "Enter NGN wanted" : "Set send rate first", false);
    }
}


// ---- EVENT HANDLERS ----

// Rate inputs
sendRateInput.addEventListener("input", (e) => {
    state.sendRate = parseFloat(e.target.value) || 0;
    saveRate("sendRate", state.sendRate);
    queueRateSave();
    updateSpread();
    renderSendingResult();
    renderReceivingResult();
    updateQuote();
});

receiveRateInput.addEventListener("input", (e) => {
    state.receiveRate = parseFloat(e.target.value) || 0;
    saveRate("receiveRate", state.receiveRate);
    queueRateSave();
    updateSpread();
    renderSendingResult();
    renderReceivingResult();
    updateQuote();
});

// Sending transaction type
document.getElementById("btn_GHS_SEND").addEventListener("click", () => {
    state.txKey = "GHS_SEND";
    state.lastEdited = "ghs";
    state.ghsAmount = 0;
    state.ngnAmount = 0;
    ghsAmountInput.value = "";
    ngnAmountInput.value = "";
    
    document.querySelectorAll("#btn_GHS_SEND, #btn_NGN_SEND").forEach(btn => {
        btn.classList.toggle("active", btn.id === "btn_GHS_SEND");
    });
    
    ghsSendLabel.textContent = "GHS Amount (what customer gives)";
    ngnSendLabel.textContent = "NGN Amount (what customer receives)";
    renderSendingResult();
});

document.getElementById("btn_NGN_SEND").addEventListener("click", () => {
    state.txKey = "NGN_SEND";
    state.lastEdited = "ngn";
    state.ghsAmount = 0;
    state.ngnAmount = 0;
    ghsAmountInput.value = "";
    ngnAmountInput.value = "";
    
    document.querySelectorAll("#btn_GHS_SEND, #btn_NGN_SEND").forEach(btn => {
        btn.classList.toggle("active", btn.id === "btn_NGN_SEND");
    });
    
    ghsSendLabel.textContent = "GHS Amount (what customer receives)";
    ngnSendLabel.textContent = "NGN Amount (what customer gives)";
    renderSendingResult();
});

// Receiving transaction type
document.getElementById("btn_GHS_RECV").addEventListener("click", () => {
    recvState.txKey = "GHS_RECV";
    recvState.lastEdited = "ghs";
    recvState.ghsAmount = 0;
    recvState.ngnAmount = 0;
    recvGhsAmountInput.value = "";
    recvNgnAmountInput.value = "";
    
    document.querySelectorAll("#btn_GHS_RECV, #btn_NGN_RECV").forEach(btn => {
        btn.classList.toggle("active", btn.id === "btn_GHS_RECV");
    });
    
    ghsRecvLabel.textContent = "GHS Amount (what customer wants)";
    ngnRecvLabel.textContent = "NGN Amount (what customer pays)";
    renderReceivingResult();
});

document.getElementById("btn_NGN_RECV").addEventListener("click", () => {
    recvState.txKey = "NGN_RECV";
    recvState.lastEdited = "ngn";
    recvState.ghsAmount = 0;
    recvState.ngnAmount = 0;
    recvGhsAmountInput.value = "";
    recvNgnAmountInput.value = "";
    
    document.querySelectorAll("#btn_GHS_RECV, #btn_NGN_RECV").forEach(btn => {
        btn.classList.toggle("active", btn.id === "btn_NGN_RECV");
    });
    
    ghsRecvLabel.textContent = "GHS Amount (what customer pays)";
    ngnRecvLabel.textContent = "NGN Amount (what customer wants)";
    renderReceivingResult();
});

// Sending amount inputs
ghsAmountInput.addEventListener("input", (e) => {
    state.lastEdited = "ghs";
    state.ghsAmount = parseFloat(e.target.value) || 0;
    renderSendingResult();
    updateQuote();
});

ngnAmountInput.addEventListener("input", (e) => {
    state.lastEdited = "ngn";
    state.ngnAmount = parseFloat(e.target.value) || 0;
    renderSendingResult();
    updateQuote();
});

// Receiving amount inputs
recvGhsAmountInput.addEventListener("input", (e) => {
    recvState.lastEdited = "ghs";
    recvState.ghsAmount = parseFloat(e.target.value) || 0;
    renderReceivingResult();
    updateQuote();
});

recvNgnAmountInput.addEventListener("input", (e) => {
    recvState.lastEdited = "ngn";
    recvState.ngnAmount = parseFloat(e.target.value) || 0;
    renderReceivingResult();
    updateQuote();
});

// Quote inputs
quoteGhsInput.addEventListener("input", updateQuote);
quoteNgnInput.addEventListener("input", updateQuote);
quoteWantGhsInput.addEventListener("input", updateQuote);
quoteWantNgnInput.addEventListener("input", updateQuote);

// Help panel
helpToggle.addEventListener("click", () => {
    const isOpen = helpPanel.classList.toggle("open");
    helpIcon.textContent = isOpen ? "✕" : "?";
    helpToggle.classList.toggle("active", isOpen);
    helpToggle.setAttribute("aria-label", isOpen ? "Close help guide" : "Open help guide");
});

// Tooltips
document.querySelectorAll(".info-icon").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tip = btn.dataset.tip;
        const rect = btn.getBoundingClientRect();
        tooltip.textContent = tip;
        tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
        tooltip.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 240)}px`;
        tooltip.classList.add("visible");
    });
});

document.addEventListener("click", () => tooltip.classList.remove("visible"));


// ---- INITIALIZATION ----

async function initialize() {
    if (appConfig.customerFacing) {
        document.body.classList.add("customer-facing");
    }

    await loadRates();
    updateSpread();
    renderSendingResult();
    renderReceivingResult();
    updateQuote();

    setInterval(() => {
        loadRemoteRates({ silent: true }).catch(() => {});
    }, 60000);
}

initialize();
