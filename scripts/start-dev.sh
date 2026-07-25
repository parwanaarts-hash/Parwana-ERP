#!/bin/bash
# Kill any existing process on port 8080 and give it time to release
fuser -k 8080/tcp 2>/dev/null
sleep 1
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev
