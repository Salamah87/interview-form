# Interview Live Server

This is a small backend server for the interview evaluation form.

## Run locally

1. Install Node.js 18 or newer.
2. Open this folder in a terminal.
3. Run:

```powershell
npm start
```

4. Open:

```text
http://localhost:3000
```

## What it does

- Managers fill the online interview evaluation form.
- Submissions are saved in `data/submissions.jsonl`.
- Recent submissions appear at the bottom of the page.
- All results can be downloaded from:

```text
http://localhost:3000/export.csv
```

## Deploy later

For public or company access, host this folder on a service that supports Node.js, such as Render, Railway, Fly.io, or an internal company server.

Before real company use, add login protection for managers and HR/admin users.
