import express from 'express';
import { getParticipants } from '../controllers/participantController.js';

const router = express.Router();

router.get('/:code/participants', getParticipants);

export default router;
