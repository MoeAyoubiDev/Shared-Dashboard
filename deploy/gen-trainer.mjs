import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const pw = crypto
  .randomBytes(12)
  .toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 14);

console.log('PASSWORD=' + pw);
console.log('HASH=' + bcrypt.hashSync(pw, 12));
