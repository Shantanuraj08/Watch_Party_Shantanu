import express from 'express';
import cors from 'cors';
import { CLIENT_URL } from './config/env.js';
import roomRoutes from './routes/roomRoutes.js';
import participantRoutes from './routes/participantRoutes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', participantRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
