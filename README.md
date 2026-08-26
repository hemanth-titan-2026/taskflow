# TaskFlow

Multi-tenant SaaS project management application built with Node.js, TypeScript, and a modern infrastructure stack.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ / TypeScript |
| Framework | Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Cache / Pub-Sub | Redis 7 |
| Job Queues | BullMQ |
| Real-time | Socket.IO (WebSockets) |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Containerization | Docker / Docker Compose |
| Reverse Proxy | Nginx |
| CDN | Cloudflare |
| Deployment | AWS EC2 |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cloudflare │────▶│    Nginx    │────▶│  Express    │
│     CDN     │     │  (reverse   │     │  App Server │
└─────────────┘     │   proxy)    │     └──────┬──────┘
                    └─────────────┘            │
                                               ├──▶ PostgreSQL
                                               ├──▶ Redis (cache + pub/sub)
                                               └──▶ BullMQ Workers
                                                      ├── Email
                                                      ├── Webhooks
                                                      ├── Notifications
                                                      ├── Reminders
                                                      └── Analytics
```

## Features

- **Multi-tenancy**: Organization-based isolation with role-based access (Owner, Admin, Member, Viewer)
- **Projects**: Create, manage, and archive projects with unique keys
- **Tasks**: Full Kanban-style task management with subtasks, labels, sprints, assignments
- **Comments**: Threaded comments on tasks
- **Real-time**: Live updates via WebSockets (task changes, typing indicators, presence)
- **Webhooks**: Event-driven integrations with HMAC-signed payloads and delivery tracking
- **Notifications**: In-app notification system with real-time delivery
- **API Keys**: Programmatic access for integrations
- **Caching**: Redis-backed response caching with intelligent invalidation
- **Job Queues**: Async processing for emails, webhooks, reminders, analytics
- **Rate Limiting**: Per-endpoint rate limiting with sliding window

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Quick Start (Docker)

```bash
# Clone the repository
git clone <repo-url> taskflow
cd taskflow

# Copy environment variables
cp .env.example .env

# Start all services (PostgreSQL, Redis, App, Worker)
docker compose up -d

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Seed the database (optional)
docker compose exec app npx prisma db seed

# App is running at http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start PostgreSQL and Redis (Docker)
docker compose up postgres redis -d

# Run database migrations
npx prisma migrate dev

# Seed the database
npm run prisma:seed

# Start development server (hot-reload)
npm run dev

# In another terminal, start workers
npm run worker
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run worker` | Start BullMQ workers |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations (dev) |
| `npm run prisma:migrate:prod` | Run migrations (production) |
| `npm run prisma:seed` | Seed the database |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Authentication

All API requests (except auth endpoints) require a Bearer token:
```
Authorization: Bearer <access_token>
```

Multi-tenant context is provided via:
```
X-Organization-Id: <org-id-or-slug>
```

### Endpoints

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh tokens |
| GET | `/auth/me` | Get current user |

#### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | List user's orgs |
| POST | `/organizations` | Create org |
| GET | `/organizations/:orgId` | Get org details |
| PATCH | `/organizations/:orgId` | Update org |
| GET | `/organizations/:orgId/members` | List members |
| POST | `/organizations/:orgId/invite` | Invite member |
| DELETE | `/organizations/:orgId/members/:userId` | Remove member |

#### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |

#### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List tasks (filterable) |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task details |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| GET | `/tasks/:id/activities` | Task activity log |

#### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/comments?taskId=` | List comments |
| POST | `/comments` | Create comment |
| PATCH | `/comments/:id` | Update comment |
| DELETE | `/comments/:id` | Delete comment |

#### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | List webhooks |
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks/:id` | Get webhook + deliveries |
| PATCH | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| POST | `/webhooks/:id/rotate-secret` | Rotate secret |

#### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/:id/read` | Mark as read |
| POST | `/notifications/mark-all-read` | Mark all read |

### WebSocket Events

Connect with Socket.IO:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: '<access_token>' }
});

// Join rooms
socket.emit('join:organization', orgId);
socket.emit('join:project', projectId);

// Listen for events
socket.on('task.created', (data) => { /* ... */ });
socket.on('task.updated', (data) => { /* ... */ });
socket.on('notification', (data) => { /* ... */ });
socket.on('typing:start', (data) => { /* ... */ });
socket.on('presence:online', (data) => { /* ... */ });
```

## Deployment

### AWS EC2

1. Launch an Ubuntu 22.04 EC2 instance (t3.medium recommended)
2. Run the setup script:
   ```bash
   sudo bash deploy/scripts/setup-ec2.sh
   ```
3. Copy files to `/opt/taskflow/`
4. Create `.env.production` with production values
5. Deploy:
   ```bash
   bash deploy/scripts/deploy.sh production
   ```

### Cloudflare CDN

See [deploy/cloudflare/README.md](deploy/cloudflare/README.md) for:
- DNS configuration
- SSL/TLS settings
- Caching rules
- WAF and security
- Performance optimizations

## Project Structure

```
taskflow/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── src/
│   ├── config/                # App configuration
│   │   ├── env.ts             # Environment validation (Zod)
│   │   ├── database.ts        # Prisma client
│   │   └── redis.ts           # Redis connections
│   ├── middleware/            # Express middleware
│   │   ├── authenticate.ts    # JWT + API key auth
│   │   ├── tenancy.ts         # Multi-tenant resolution
│   │   ├── validate.ts        # Zod request validation
│   │   ├── cache.ts           # Response caching
│   │   └── errorHandler.ts    # Global error handler
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic
│   │   ├── auth.service.ts    # Authentication
│   │   ├── cache.service.ts   # Redis cache operations
│   │   ├── queue.service.ts   # BullMQ job dispatching
│   │   ├── webhook.service.ts # Event dispatching
│   │   └── websocket.ts       # Socket.IO server
│   ├── workers/               # BullMQ worker processes
│   ├── utils/                 # Shared utilities
│   ├── types/                 # TypeScript declarations
│   ├── app.ts                 # Express app setup
│   └── index.ts               # Server entry point
├── deploy/
│   ├── nginx/                 # Nginx configuration
│   ├── scripts/               # Deployment scripts
│   └── cloudflare/            # CDN documentation
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # Production services
├── docker-compose.dev.yml     # Development overrides
└── tsconfig.json              # TypeScript config
```

## Demo Credentials

After seeding, use these credentials:
- **Email**: admin@taskflow.dev
- **Password**: password123
- **Organization**: taskflow-demo

## License

MIT
