/**
 * Safe calculator for amount fields (no eval): + − × ÷ ( ) with Indonesian shorthands.
 * "25rb+15rb*2" → 55000, "1,5jt" → 1500000, "25.000 x 3" → 75000. Invalid → null.
 */
type Token = number | string;

const SUFFIX: Record<string, number> = { k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6 };
const OP: Record<string, string> = { "+": "+", "-": "-", "−": "-", "*": "*", x: "*", "×": "*", "/": "/", ":": "/", "÷": "/", "(": "(", ")": ")" };

function num(raw: string, suffix?: string): number {
  let s = raw;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // 1.250,5 → 1250.5
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // 25.000 → 25000
  return Number(s) * (suffix ? SUFFIX[suffix.toLowerCase()] : 1);
}

function tokenize(input: string): Token[] | null {
  const re = /\s*(?:(\d[\d.,]*)\s*(ribu|rb|k|juta|jt)?|([+\-−*x×/:÷()]))/giy;
  const out: Token[] = [];
  let m: RegExpExecArray | null;
  while (re.lastIndex < input.length && (m = re.exec(input))) {
    if (m[1]) out.push(num(m[1], m[2]));
    else if (m[3]) out.push(OP[m[3].toLowerCase()]);
  }
  return input.slice(re.lastIndex).trim() === "" && out.length ? out : null;
}

export function evaluate(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens) return null;
  let i = 0;
  const peek = () => tokens[i];
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") v = tokens[i++] === "+" ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") v = tokens[i++] === "*" ? v * factor() : v / factor();
    return v;
  };
  const factor = (): number => {
    const t = tokens[i++];
    if (t === "-") return -factor();
    if (t === "(") {
      const v = expr();
      if (tokens[i++] !== ")") throw new Error("paren");
      return v;
    }
    if (typeof t === "number" && !Number.isNaN(t)) return t;
    throw new Error("token");
  };
  try {
    const v = expr();
    return i === tokens.length && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}

/** True when the text is a calculation, not just a number. */
export const isExpression = (s: string) => /\d\s*(rb|ribu|k|jt|juta)?\s*[+\-−*x×/:÷]|[()]/i.test(s);
