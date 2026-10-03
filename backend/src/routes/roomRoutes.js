import express from 'express';
import { createRoom, joinRoom } from '../controllers/roomController.js';

const router = express.Router();

router.post('/', createRoom);
router.post('/:code/join', joinRoom);

export default router;
