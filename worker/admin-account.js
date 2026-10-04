const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
export async function adminCredential(env) {
  if (env.ADMIN_CREDENTIALS_ENABLED !== "true" || !env.DB) return null;
  return env.DB.prepare("SELECT username, password_hash, password_salt, revision FROM admin_credentials WHERE id = 1").first();
}
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256));
}
export async function verifyAdminPassword(env, credential, password) {
  if (typeof password !== "string" || !password || password.length > 1000) return false;
  const actual = credential ? await passwordHash(password, credential.password_salt) : hex(await crypto.subtle.digest("SHA-256", encoder.encode(password)));
  const expected = credential?.password_hash || env.ADMIN_PASSWORD_SHA256?.toLowerCase() || "";
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return difference === 0;
}
