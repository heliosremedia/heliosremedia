import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const reader = createInterface({ input: stdin, output: stdout });
const password = process.argv[2] || await reader.question("Admin password: ");
reader.close();
if (password.length < 12) throw new Error("Use an admin password with at least 12 characters.");
const salt = randomBytes(16).toString("hex");
const hash = await promisify(scryptCallback)(password, salt, 64);
console.log(`HELIOS_ADMIN_PASSWORD_HASH=scrypt:${salt}:${hash.toString("hex")}`);
