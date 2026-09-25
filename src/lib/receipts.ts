export function receiptNumber(year: number, sequence: number): string {
  return `RHR-${year}-${String(sequence).padStart(4, "0")}`;
}

export function visitNumber(sequence: number): string {
  return `RH-${String(sequence).padStart(4, "0")}`;
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

function underHundred(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const tens = TENS[Math.floor(n / 10)] ?? "";
  const ones = n % 10;
  return ones ? `${tens}-${ONES[ones]}` : tens;
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) parts.push(hundreds ? `and ${underHundred(rest)}` : underHundred(rest));
  return parts.join(" ");
}

export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zero";
  const parts: string[] = [];
  for (const [size, name] of SCALES) {
    if (n >= size) {
      parts.push(`${underThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(parts.length && n < 100 ? `and ${underThousand(n)}` : underThousand(n));
  return parts.join(" ");
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Seven hundred and fifty Ghana cedis only" */
export function amountInWords(amount: number): string {
  const cedis = Math.floor(amount);
  const pesewas = Math.round((amount - cedis) * 100);
  const cediWords = `${numberToWords(cedis)} Ghana ${cedis === 1 ? "cedi" : "cedis"}`;
  const pesewaWords = pesewas ? ` and ${numberToWords(pesewas)} ${pesewas === 1 ? "pesewa" : "pesewas"}` : "";
  return `${capitalise(cediWords + pesewaWords)} only`;
}

/** Short check code printed on receipts so the studio can match them to its records. */
export function verifyCode(receiptNo: string, amount: number): string {
  let hash = 2166136261;
  for (const ch of `${receiptNo}|${amount.toFixed(2)}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}
