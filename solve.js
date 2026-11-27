// Faster drop-in for makefun-diff 1.0.0 (prototype).
// Intern lines to integer ids; run the reference's exact Myers greedy search
// on one flat typed-array V buffer (snapshot d at offset d*d); backtrack the
// same path with the same tie-break; format the patch exactly like the ref.

function tokenize(text) {
  const lines = [];
  let start = 0;
  const len = text.length;
  while (start < len) {
    const nl = text.indexOf('\n', start);
    if (nl === -1) { lines.push(text.slice(start)); break; }
    lines.push(text.slice(start, nl + 1));
    start = nl + 1;
  }
  return lines;
}

function intern(lines, map, ids) {
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    let id = map.get(s);
    if (id === undefined) { id = map.size; map.set(s, id); }
    ids[i] = id;
  }
}

/** Edit runs [{kind,count}] of the trimmed middle, exactly the reference's path.
 * V snapshots: Vs[d] is Int32Array length 2d+1, cell k stores post-snake x+1
 * (0 = undefined, so a fresh zero-filled array needs no -1 fill pass). */
function editRuns(a, b) {
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return [];
  // V cells store post-snake x+1 (0 = undefined); x+1 fits in 16 bits while
  // the texts stay under 65000 lines, else fall back to 32 bits.
  const Arr = (n <= 65000 && m <= 65000) ? Uint16Array : Int32Array;
  const Vs = [];
  const v0 = new Arr(1);
  let x = 0;
  while (x < n && x < m && a[x] === b[x]) x++;
  v0[0] = x + 1;
  Vs.push(v0);
  if (x >= n && x >= m) return [{ kind: '=', count: x }];
  const maxEdit = n + m;
  let D = -1, kEnd = 0;
  outer:
  for (let d = 1; d <= maxEdit; d++) {
    const v = new Arr(2 * d + 1);
    const prev = Vs[d - 1];
    // k = -d: only the insertion predecessor (diagonal -d+1 at d-1) exists.
    {
      const k = -d;
      const sIns = prev[0];
      if (sIns !== 0 && (sIns - 1) - (k + 1) < m) {
        let xx = sIns - 1, yy = xx - k;
        while (xx < n && yy < m && a[xx] === b[yy]) { xx++; yy++; }
        v[0] = xx + 1;
        if (xx >= n && yy >= m) { D = d; kEnd = k; Vs.push(v); break outer; }
      }
    }
    // interior k: both predecessor cells exist (0 = undefined).
    for (let k = -d + 2, pi = 0, vi = 2; k <= d - 2; k += 2, pi += 2, vi += 2) {
      const sDel = prev[pi];
      const sIns = prev[pi + 2];
      const canRemove = sDel !== 0 && sDel - 1 < n;
      const canAdd = sIns !== 0 && (sIns - 1) - (k + 1) < m;
      if (!canRemove && !canAdd) continue;
      let xx, yy;
      if (canRemove && (!canAdd || sDel >= sIns - 1)) { xx = sDel; yy = xx - k; }
      else { xx = sIns - 1; yy = xx - k; }
      while (xx < n && yy < m && a[xx] === b[yy]) { xx++; yy++; }
      v[vi] = xx + 1;
      if (xx >= n && yy >= m) { D = d; kEnd = k; Vs.push(v); break outer; }
    }
    // k = +d: only the deletion predecessor (diagonal d-1 at d-1) exists.
    {
      const k = d;
      const sDel = prev[2 * d - 2];
      if (sDel !== 0 && sDel - 1 < n) {
        let xx = sDel, yy = xx - k;
        while (xx < n && yy < m && a[xx] === b[yy]) { xx++; yy++; }
        v[2 * d] = xx + 1;
        if (xx >= n && yy >= m) { D = d; kEnd = k; Vs.push(v); break outer; }
      }
    }
    Vs.push(v);
  }
  if (D === -1) throw new Error('search ended without reaching both ends');
  // Backtrack from (D, kEnd). The pre-snake point of step d is fixed by the
  // predecessor chosen at d (same tie-break as forward), never by walking
  // back over equal lines: a step can land where the previous lines happen
  // to be equal without the snake having consumed them.
  const rev = [];
  let k = kEnd;
  let xx = Vs[D][k + D] - 1;
  const pushN = (kind, cnt) => {
    if (cnt <= 0) return;
    const last = rev[rev.length - 1];
    if (last !== undefined && last[0] === kind) last[1] += cnt;
    else rev.push([kind, cnt]);
  };
  for (let d = D; d >= 1; d--) {
    const prev = Vs[d - 1];
    const sDel = (k - 1 >= -(d - 1)) ? prev[(k - 1) + (d - 1)] : 0;
    const sIns = (k + 1 <= d - 1) ? prev[(k + 1) + (d - 1)] : 0;
    const canRemove = sDel !== 0 && sDel - 1 < n;
    const canAdd = sIns !== 0 && (sIns - 1) - (k + 1) < m;
    if (canRemove && (!canAdd || sDel >= sIns - 1)) {
      pushN('=', xx - sDel);
      pushN('-', 1);
      xx = sDel - 1;
      k = k - 1;
    } else {
      pushN('=', xx - (sIns - 1));
      pushN('+', 1);
      xx = sIns - 1;
      k = k + 1;
    }
  }
  pushN('=', xx);
  rev.reverse();
  return rev.map(([kind, count]) => ({ kind, count }));
}

const KEEP = '=', DELETE = '-', INSERT = '+';

function written(op, line) {
  return line.endsWith('\n') ? `${op}${line}` : `${op}${line}\n%\n`;
}

export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const aLines = tokenize(input.old);
  const bLines = tokenize(input.new);
  const n = aLines.length, m = bLines.length;
  const map = new Map();
  const a = new Int32Array(n), b = new Int32Array(m);
  intern(aLines, map, a);
  intern(bLines, map, b);
  let prefix = 0;
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix]) suffix++;
  const runs = [];
  if (prefix > 0) runs.push({ kind: KEEP, count: prefix });
  runs.push(...editRuns(a.subarray(prefix, n - suffix), b.subarray(prefix, m - suffix)));
  if (suffix > 0) runs.push({ kind: KEEP, count: suffix });

  const changes = [];
  let o = 0, p = 0, deleted = 0, inserted = 0;
  for (const r of runs) {
    if (r.kind === KEEP) { o += r.count; p += r.count; continue; }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (r.kind === DELETE) { c.dels += r.count; o += r.count; deleted += r.count; }
    else { c.ins += r.count; p += r.count; inserted += r.count; }
  }
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 2 * 3) h.push(c);
    else hunks.push([c]);
  }
  const out = [`makefun-diff/1 old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - 3);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(3, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(written(KEEP, aLines[at]));
      for (let i = 0; i < c.dels; i++) out.push(written(DELETE, aLines[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(written(INSERT, bLines[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(written(KEEP, aLines[at]));
  }
  return out.join('');
}
