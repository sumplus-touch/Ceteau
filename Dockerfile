# ─────────────────────────────────────────────────────────────────────
# Network-resilient npm install flags used across all stages:
#   --fetch-timeout=600000   wait up to 10 min per package request
#                            (default is 60s — too tight on slow links)
#   --fetch-retries=5        retry up to 5 times on any network error
#                            before giving up
#   --prefer-offline         use the local npm cache first; only hit the
#                            network when a package is missing
# These make the build survive flaky internet on whichever machine is
# doing the build — your machine, the CI runner, or your professor's
# laptop. Without them, a momentary timeout aborts the whole build.
# ─────────────────────────────────────────────────────────────────────

# Stage 1: Build client
FROM node:20-alpine AS builder

WORKDIR /app

# Install server deps
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 --prefer-offline

# Install client deps
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install --fetch-timeout=600000 --fetch-retries=5 --prefer-offline

# Copy source
COPY . .

# Build client
RUN cd client && npx vite build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install Python3 and required system libraries
RUN apk add --no-cache python3 py3-pip py3-numpy py3-pillow \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir \
       matplotlib pandas openpyxl python-docx scipy seaborn

ENV PATH="/opt/venv/bin:$PATH"

# Install clawhub globally
RUN npm i -g clawhub --fetch-timeout=600000 --fetch-retries=5

# Production install — tsx is now in dependencies (not devDependencies),
# so --omit=dev keeps it. One single network round-trip instead of two.
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts --omit=dev --fetch-timeout=600000 --fetch-retries=5 --prefer-offline

# Copy server source + built client + data defaults
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/vite.config.* ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/data ./data

# Create upload directory
RUN mkdir -p uploads

EXPOSE 3001

ENV NODE_ENV=production

CMD ["npx", "tsx", "server/index.ts"]
