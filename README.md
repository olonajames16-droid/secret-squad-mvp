# SECRET SQUAD MVP

A lightweight multiplayer social-deception prototype implemented as a TypeScript monorepo.

## Stack

- Client: React + Vite + TypeScript + React Three Fiber
- Server: Node.js + Express + Socket.IO
- Game logic: authoritative server-side state machine and validation
- Tests: Vitest

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm run dev --workspace server
   ```

3. Start the client:
   ```bash
   npm run dev --workspace client
   ```

4. Open the client in a browser at:
   ```text
   http://localhost:5173
   ```

## Environment

Create a `.env` file in the `server` package using the example:

```bash
cp server/.env.example server/.env
```

Example:
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MATCH_TIME_SECONDS=300
DISCUSSION_TIME_SECONDS=60
VOTING_TIME_SECONDS=30
```

## Production build

```bash
npm run build
```

## Test run

```bash
npm test
```

## Included features

- Main menu and lobby flow
- Room creation and join-by-code
- Ready-up and host controls
- Match lifecycle state machine
- Role assignment and objective tracking
- Evidence collection and trading
- One sabotage mechanic
- Discussion and voting flow
- Results reveal and rematch support
- Basic automated server rules testing

## Known limitations

- This is an MVP, not a large-scale production online service.
- In-memory room state resets when the server restarts.
- No persistent account system or matchmaking queue.
- Placeholder art and sound assets are generated in code.

## Security notes

- Do not commit private credentials.
- Store secrets only in environment variables.
- Treat all clients as untrusted and validate server-side actions.
