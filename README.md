# YouTube Watch Party System

## Overview
A real-time YouTube watch party web application where multiple users can join synchronized viewing rooms. The platform coordinates video playback, room roles (Host, Moderator, Participant), and live in-memory chat across all connected participants.

## Features
- **Room Creation & Joining**: Create rooms with unique 6-character room codes or join via code.
- **Role-Based Access Control**: Host, Moderator, and Participant roles with differentiated permissions.
- **Playback Synchronization**: Synchronized play, pause, and timeline seeking across all room members.
- **YouTube IFrame Integration**: Embedded player using the official YouTube IFrame Player API.
- **Dynamic Video Changing**: Host and Moderators can change the current YouTube video by URL or ID.
- **Participant Roster**: Live tracking of participants in the room with online and offline status.
- **Role Moderation**: Host can assign the Moderator role to participants.
- **Host Transfer**: Host can transfer room ownership to another active participant.
- **Participant Removal**: Host can remove participants from the room and revoke access.
- **In-Memory Chat**: Real-time room chat stored in server memory (last 100 messages) without database persistence.

## Tech Stack
**Frontend:**  
React, TypeScript, Vite, Tailwind CSS

**Backend:**  
Node.js, Express.js, Socket.IO, Prisma

**Database:**  
PostgreSQL, Neon

## Architecture

```
┌───────────────────┐        WebSocket Events        ┌───────────────────┐
│                   │ ◄────────────────────────────► │  Node.js/Express  │
│  React Frontend   │                                │  Socket.IO Server │
│ (YouTube API, UI) │         REST API Calls         │   Prisma Client   │
│                   │ ─────────────────────────────► └─────────┬─────────┘
└───────────────────┘                                          │
                                                               │ Queries
                                                               ▼
                                                     ┌───────────────────┐
                                                     │ PostgreSQL (Neon) │
                                                     └───────────────────┘
```

- **REST API**: Handles room creation, joining, and initial room data retrieval.
- **Socket.IO**: Handles real-time playback synchronization, role events, participant presence, and chat.
- **Prisma / PostgreSQL**: Handles persistent storage for rooms, users, and participant memberships.

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm
- PostgreSQL database (e.g., Neon)

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL, PORT, and CLIENT_URL in .env
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Configure VITE_API_URL and VITE_SOCKET_URL in .env
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:5000`.

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## Roles & Permissions

| Action | Host | Moderator | Participant |
| :--- | :---: | :---: | :---: |
| Watch Synchronized Playback | ✅ | ✅ | ✅ |
| Send / Receive Chat Messages | ✅ | ✅ | ✅ |
| View Participant Roster | ✅ | ✅ | ✅ |
| Play & Pause Video | ✅ | ✅ | ❌ |
| Seek Video Timeline | ✅ | ✅ | ❌ |
| Change YouTube Video | ✅ | ✅ | ❌ |
| Promote to Moderator | ✅ | ❌ | ❌ |
| Transfer Host Role | ✅ | ❌ | ❌ |
| Remove Participant | ✅ | ❌ | ❌ |

## Deployment
- **Frontend**: Production bundle built with `npm run build` (`vite build`), outputting static assets to `dist/`.
- **Backend**: Node.js service started with `npm start` (`node src/server.js`) with persistent WebSocket connection support.
- **Database**: Cloud-hosted PostgreSQL on Neon, with schema synchronized via `npx prisma db push`.
