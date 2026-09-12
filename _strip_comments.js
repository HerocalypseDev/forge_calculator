// Strips // and /* */ comments from JS/CSS while respecting string literals
// and JS regex literals. Run: node _strip_comments.js <file>
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node _strip_comments.js <file>'); process.exit(1); }

const src = fs.readFileSync(file, 'utf8');
const isCss = /\.css$/i.test(file);
const out = [];
const n = src.length;
let i = 0;

function isIdent(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}
function isRegexStart(prevSignificant) {
  if (prevSignificant === null) return true;
  if (isIdent(prevSignificant)) return false;       // division-ish: variable/regex? treat / as division
  if (prevSignificant === ')' || prevSignificant === ']' || prevSignificant === '}') return false;
  return true;
}

let prevSignificant = null;

while (i < n) {
  const ch = src[i];
  const next = src[i + 1];

  // line comment
  if (!isCss && ch === '/' && next === '/' && prevSignificant !== '"' && prevSignificant !== "'" && prevSignificant !== '`') {
    let j = i + 2;
    while (j < n && src[j] !== '\n') j++;
    i = j;
    continue;
  }
  // block comment
  if (ch === '/' && next === '*') {
    let j = i + 2;
    while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
    j = Math.min(n, j + 2);
    i = j;
    continue;
  }
  // string literals
  if (ch === '"' || ch === "'" || ch === '`') {
    const quote = ch;
    out.push(ch);
    i++;
    while (i < n) {
      const c = src[i];
      out.push(c);
      if (c === '\\') { out.push(src[i + 1] || ''); i += 2; continue; }
      if (c === quote) { i++; break; }
      i++;
    }
    prevSignificant = quote;
    continue;
  }
  // regex literal (JS only)
  if (!isCss && ch === '/' && (prevSignificant === null || !isIdent(prevSignificant)) &&
      prevSignificant !== ')' && prevSignificant !== ']' && prevSignificant !== '}') {
    out.push(ch);
    i++;
    let inClass = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { out.push(c); out.push(src[i + 1] || ''); i += 2; continue; }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { out.push(c); i++; break; }
      else { out.push(c); i++; }
    }
    // optional flags
    while (i < n && /[a-z]/i.test(src[i])) { out.push(src[i]); i++; }
    prevSignificant = '/';
    continue;
  }

  out.push(ch);
  if (!/\s/.test(ch)) prevSignificant = ch;
  i++;
}

fs.writeFileSync(file, out.join(''));
console.log('Stripped comments from', path.basename(file));
