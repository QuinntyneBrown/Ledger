FROM node:22-alpine AS build
WORKDIR /src
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
COPY design-system /design-system
RUN sed -i 's#../design-system#/design-system#g' angular.json && npm run build
FROM nginx:1.27-alpine AS app
COPY --from=build /src/dist/ledger-app/browser /usr/share/nginx/html
COPY frontend/docker/app.nginx.conf /etc/nginx/conf.d/default.conf
FROM nginx:1.27-alpine AS marketing
COPY --from=build /src/dist/ledger-marketing/browser /usr/share/nginx/html
COPY frontend/docker/marketing.nginx.conf /etc/nginx/conf.d/default.conf
