const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.RATES_DB_NAME || "rateTool";
const COLLECTION_NAME = process.env.RATES_COLLECTION || "rates";
const DOC_ID = process.env.RATES_DOC_ID || "ghs-ngn";
const WRITE_TOKEN = process.env.RATE_WRITE_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
const WRITE_ORIGINS = (process.env.WRITE_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

const DEFAULT_RATES = {
    sendRate: 8.5,
    receiveRate: 7.9
};

let clientPromise;

function getClient() {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured");
    }

    if (!clientPromise) {
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        clientPromise = client.connect();
    }

    return clientPromise;
}

async function getRatesCollection() {
    const client = await getClient();
    return client.db(DB_NAME).collection(COLLECTION_NAME);
}

function isAllowedOrigin(origin) {
    return !origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
}

function parseRate(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function canWrite(req) {
    if (WRITE_TOKEN) {
        const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        return token === WRITE_TOKEN;
    }

    const origin = req.headers.origin || "";
    return WRITE_ORIGINS.length > 0 && WRITE_ORIGINS.includes(origin);
}

const app = express();

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin)) {
        if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(isAllowedOrigin(origin) ? 204 : 403);
    }

    next();
});

app.use(express.json({ limit: "16kb" }));

app.get("/api/rates", async (req, res) => {
    try {
        const collection = await getRatesCollection();
        const saved = await collection.findOne({ _id: DOC_ID });

        res.json({
            ...DEFAULT_RATES,
            ...(saved || {}),
            _id: undefined
        });
    } catch (error) {
        res.status(503).json({
            error: error.message,
            ...DEFAULT_RATES
        });
    }
});

app.put("/api/rates", async (req, res) => {
    if (!canWrite(req)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const sendRate = parseRate(req.body && req.body.sendRate);
    const receiveRate = parseRate(req.body && req.body.receiveRate);

    if (!sendRate || !receiveRate) {
        return res.status(400).json({ error: "sendRate and receiveRate must be positive numbers" });
    }

    try {
        const collection = await getRatesCollection();
        const savedAt = new Date();

        await collection.updateOne(
            { _id: DOC_ID },
            {
                $set: {
                    sendRate,
                    receiveRate,
                    savedAt
                },
                $setOnInsert: {
                    createdAt: savedAt
                }
            },
            { upsert: true }
        );

        res.json({ sendRate, receiveRate, savedAt });
    } catch (error) {
        res.status(503).json({ error: error.message });
    }
});

app.use(express.static(__dirname));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Rate tool listening on port ${PORT}`);
});
