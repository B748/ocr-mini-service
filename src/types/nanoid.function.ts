import { customAlphabet } from 'nanoid';

/**
 * Custom nanoid function that generates 8-character alphanumeric IDs
 * Uses uppercase letters, lowercase letters, and digits
 */
export const nanoid = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  8
)