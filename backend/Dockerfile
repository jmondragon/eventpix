# Stage 1: Build Admin UI
FROM node:20-alpine AS build-admin
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
ARG VITE_POCKETBASE_URL
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/web/package.json ./apps/web/
RUN pnpm install
COPY . .
RUN pnpm --filter admin build

# Stage 2: Final Image
FROM alpine:latest
RUN apk add --no-cache \
    unzip \
    ca-certificates \
    openssh

# Download and install PocketBase
# Using 0.36.1 as seen in the backend folder
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/
RUN rm /tmp/pb.zip

# Copy migrations and static UI
COPY --from=build-admin /app/backend/pb_public /pb/pb_public
COPY ./backend/pb_migrations /pb/pb_migrations

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
