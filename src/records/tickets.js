// Each traveller's ship ticket, his second paper. Kept with the records, not in
// src/travellers/, so the records terminal owns everything it checks against.
import { ticket as max } from './max.js';
import { ticket as colin } from './colin.js';

const TICKETS = { max, colin };

// A traveller added without records simply has no ticket.
export const ticketFor = (travellerId) => TICKETS[travellerId] ?? null;
