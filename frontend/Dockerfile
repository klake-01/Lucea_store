# Frontend image: builds the SPA, prerenders every route, serves the result.
#
# Two things about this build are specific to this project:
#
#  1. `npm run build` runs `tsc -b`, then Vite, then `scripts/prerender.ts`.
#     The prerender step asks the API for published articles so it can bake
#     their real meta and JSON-LD into per-route shells. **The API must be
#     reachable during the build**, which is why BLOG_API_URL is a build arg.
#     If it is not reachable the build still succeeds, but article pages ship
#     the generic shell with no article schema — see scripts/blogRoutes.ts.
#
#  2. The output is not a single index.html. It is dist/index.html plus one
#     dist/<route>/index.html per prerendered route. nginx must prefer those
#     directory indexes over the SPA fallback or the prerendering is wasted.

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first so a source-only change does not reinstall them.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Empty means "same origin, under /api" — which is how nginx is configured.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Where the prerenderer reaches the API. Unset or empty allows the build to
# succeed with fallback shells when the backend is not running at build time.
ARG BLOG_API_URL=""
ENV BLOG_API_URL=$BLOG_API_URL

RUN npm run build

# ---------- serve ----------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
