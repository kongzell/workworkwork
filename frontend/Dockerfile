# syntax=docker/dockerfile:1
#
# build context = root ของ repo (เพราะเป็น npm workspaces)
#   docker build -f frontend/Dockerfile -t 3work-web .
#
# หมายเหตุ: lockfile ที่ npm ci ใช้คือ package-lock.json ที่ root เท่านั้น

FROM node:24-alpine AS base
WORKDIR /app


# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
RUN --mount=type=cache,target=/root/.npm npm ci


# ---------- dev: vite dev server (ใช้กับ docker-compose.dev.yml) ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY frontend ./frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "frontend", "--", "--host", "0.0.0.0"]


# ---------- build: tsc -b && vite build -> frontend/dist ----------
FROM deps AS build
COPY frontend ./frontend
RUN npm run build -w frontend


# ---------- runner: nginx เสิร์ฟ static + proxy /api ไปที่ service api ----------
FROM nginx:alpine AS runner
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
