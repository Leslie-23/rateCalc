# GHS / NGN Rate Tool

Internal rate calculator with MongoDB-backed shared rates.

## Run locally

```powershell
npm install
$env:MONGODB_URI="mongodb+srv://..."
$env:RATE_WRITE_TOKEN="choose-a-private-token"
npm start
```

Open `http://localhost:3000`.

## Configuration

Server environment variables:

- `MONGODB_URI` - MongoDB connection string used to persist rates.
- `RATE_WRITE_TOKEN` - optional token required for rate updates.
- `ALLOWED_ORIGINS` - optional comma-separated list of allowed browser origins for separate deployments.
- `WRITE_ORIGINS` - optional comma-separated list of browser origins allowed to update rates when `RATE_WRITE_TOKEN` is not set.
- `RATES_DB_NAME`, `RATES_COLLECTION`, `RATES_DOC_ID` - optional MongoDB storage names.

Browser configuration lives in `config.js`:

- `window.RATE_API_BASE` - API base URL. Leave empty when the app and API share the same host.
- `window.RATE_ADMIN_TOKEN` - write token for the internal tool.
- `window.CUSTOMER_FACING` - set to `true` on the customer-facing branch to hide internal rate controls.
