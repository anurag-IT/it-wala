// Create or replace the admin login.  npm run admin:set-password
// Stores only a scrypt hash in .env.admin (git-ignored). Nothing secret is printed.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { hashPassword } from '../lib/auth.mjs'
import { loadConfig } from '../lib/config.mjs'

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s) }
    }
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a) })
  })
}

const cfg = loadConfig()
const username = (process.env.ADMIN_SET_USERNAME || await ask('Admin username: ')).trim()
if (!/^[A-Za-z0-9._@-]{3,60}$/.test(username)) {
  console.error('Username: 3-60 characters (letters, numbers, . _ @ -).')
  process.exit(1)
}
const password = process.env.ADMIN_SET_PASSWORD || await ask('Password (min 10 characters): ', true)
const again = process.env.ADMIN_SET_PASSWORD || await ask('Repeat password: ', true)
if (password !== again) {
  console.error('Passwords do not match.')
  process.exit(1)
}
let hash
try {
  hash = hashPassword(password)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

const file = cfg.envFile
const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : ['# IT Wala Dai admin settings (keep this file private; it is git-ignored)']
const set = (k, v) => {
  const i = lines.findIndex((l) => l.startsWith(k + '='))
  if (i === -1) lines.push(k + '=' + v)
  else lines[i] = k + '=' + v
}
set('ADMIN_USERNAME', username)
set('ADMIN_PASSWORD_HASH', hash)
fs.writeFileSync(file, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n', { mode: 0o600 })
console.log('Saved admin login for "' + username + '" in ' + path.basename(file) + '. Restart the admin server if it is running.')
