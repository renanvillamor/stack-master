// Excludes 0/O and 1/I so a code is unambiguous when read aloud or handwritten.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** RFC 4122 v4-format UUID — required by the `create_session`/`update_session_state`/`end_session` RPCs, whose `p_host_key` column is typed `uuid` in Postgres and rejects any other string shape. */
export function generateHostKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
