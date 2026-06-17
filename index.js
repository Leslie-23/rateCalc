const DEFAULT_RATES = {
    sendRate: 8.5,
    receiveRate: 7.9
};

const MODES = {
    GHS_SEND: {
        inputCurrency: "GHS",
        resultCurrency: "NGN",
        amountLabel: "Amount in GHS",
        resultLabel: "Customer receives",
        rateName: "send rate",
        calculate: (amount, rates) => (amount / rates.sendRate) * 1000
    },
    NGN_SEND: {
        inputCurrency: "NGN",
        resultCurrency: "GHS",
        amountLabel: "Amount in NGN",
        resultLabel: "Customer receives",
        rateName: "receive rate",
        calculate: (amount, rates) => (amount / 1000) * rates.receiveRate
    },
    GHS_RECV: {
        inputCurrency: "GHS",
        resultCurrency: "NGN",
        amountLabel: "GHS wanted",
        resultLabel: "Customer pays",
        rateName: "receive rate",
        calculate: (amount, rates) => (amount / rates.receiveRate) * 1000
    },
    NGN_RECV: {
        inputCurrency: "NGN",
        resultCurrency: "GHS",
        amountLabel: "NGN wanted",
        resultLabel: "Customer pays",
        rateName: "send rate",
        calculate: (amount, rates) => (amount / 1000) * rates.sendRate
    }
};

const appConfig = {
    apiBase: String(window.RATE_API_BASE || "").replace(/\/$/, "")
};

const state = {
    mode: "GHS_SEND",
    rates: { ...DEFAULT_RATES }
};

const sendRateView = document.getElementById("sendRateView");
const receiveRateView = document.getElementById("receiveRateView");
const amountInput = document.getElementById("amountInput");
const amountLabel = document.getElementById("amountLabel");
const amountCurrency = document.getElementById("amountCurrency");
const resultLabel = document.getElementById("resultLabel");
const resultAmount = document.getElementById("resultAmount");
const resultNote = document.getElementById("resultNote");
const syncStatus = document.getElementById("syncStatus");
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const quickButtons = Array.from(document.querySelectorAll("[data-quick]"));

function apiUrl(path) {
    return `${appConfig.apiBase}${path}`;
}

function formatNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return "--";
    return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatMoney(value, currency) {
    const decimals = currency === "NGN" ? 0 : 2;
    return `${currency} ${formatNumber(value, decimals)}`;
}

function setStatus(message, isWarning = false) {
    syncStatus.textContent = message;
    syncStatus.classList.toggle("warn", isWarning);
}

function saveRatesLocally(rates) {
    localStorage.setItem("sendRate", rates.sendRate);
    localStorage.setItem("receiveRate", rates.receiveRate);
}

function loadLocalRates() {
    const sendRate = Number(localStorage.getItem("sendRate"));
    const receiveRate = Number(localStorage.getItem("receiveRate"));

    if (sendRate > 0 && receiveRate > 0) {
        state.rates = { sendRate, receiveRate };
    }
}

function renderRates() {
    sendRateView.textContent = formatNumber(state.rates.sendRate, 2);
    receiveRateView.textContent = formatNumber(state.rates.receiveRate, 2);
}

function renderMode() {
    const mode = MODES[state.mode];

    modeButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.mode === state.mode);
    });

    amountLabel.textContent = mode.amountLabel;
    amountCurrency.textContent = mode.inputCurrency;
    amountInput.step = mode.inputCurrency === "NGN" ? "1" : "0.01";
    amountInput.placeholder = mode.inputCurrency === "NGN" ? "0" : "0.00";
    resultLabel.textContent = mode.resultLabel;

    renderResult();
}

function renderResult() {
    const mode = MODES[state.mode];
    const amount = Number(amountInput.value);

    if (!amount || amount <= 0) {
        resultAmount.textContent = "Enter amount";
        resultNote.textContent = "Rates update automatically from the desk.";
        return;
    }

    const result = mode.calculate(amount, state.rates);
    resultAmount.textContent = formatMoney(result, mode.resultCurrency);
    resultNote.textContent = `Using ${mode.rateName}: ${formatNumber(
        mode.rateName === "send rate" ? state.rates.sendRate : state.rates.receiveRate,
        2
    )}`;
}

async function fetchRates({ silent = false } = {}) {
    if (!silent) setStatus("Loading latest rates...");

    const response = await fetch(apiUrl("/api/rates"), {
        headers: { "Accept": "application/json" },
        cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Could not load rates");
    }

    const sendRate = Number(data.sendRate);
    const receiveRate = Number(data.receiveRate);

    if (!(sendRate > 0) || !(receiveRate > 0)) {
        throw new Error("Rates are not available");
    }

    state.rates = { sendRate, receiveRate };
    saveRatesLocally(state.rates);
    renderRates();
    renderResult();
    setStatus("Latest rates loaded");
}

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        amountInput.value = "";
        renderMode();
    });
});

quickButtons.forEach(button => {
    button.addEventListener("click", () => {
        amountInput.value = button.dataset.quick;
        amountInput.focus();
        renderResult();
    });
});

amountInput.addEventListener("input", renderResult);

async function initialize() {
    document.body.classList.add("customer-facing");
    loadLocalRates();
    renderRates();
    renderMode();

    try {
        await fetchRates();
    } catch (error) {
        setStatus("Using saved rates. Live rates unavailable.", true);
    }

    setInterval(() => {
        fetchRates({ silent: true }).catch(() => {});
    }, 60000);
}

initialize();
