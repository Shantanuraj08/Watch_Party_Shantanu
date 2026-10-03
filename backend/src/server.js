import http from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';
import { PORT } from './config/env.js';

const server = http.createServer(app);

const io = initSocket(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { server, io };
