const { parseSchedule } = require('../node_modules/.cache/parser-test.cjs')
const { ref, cases } = require('./parser.cases.cjs')

let pass = 0
const fails = []
for (const [input, title, sd, ed, st, et, recur] of cases) {
  const r = parseSchedule(input, ref)
  const expEnd = ed ?? sd
  const got = r ? {
    t: r.title, s: r.startDate, e: r.endDate, st: r.startTime, et: r.endTime,
    rc: r.recur ? (r.recur.freq + (r.recur.byDay ? ':' + r.recur.byDay : '')) : '',
  } : null
  const expRc = recur
  let rcOk
  if (expRc === '') rcOk = got ? got.rc === '' : false
  else if (expRc === 'weekday')
    rcOk = !!(r && r.recur && r.recur.freq === 'weekly' && Array.isArray(r.recur.byDay) && r.recur.byDay.length === 5)
  else if (expRc === 'every2')
    rcOk = !!(r && r.recur && r.recur.freq === 'interval' && Number(r.recur.byDay) === 2)
  else rcOk = got ? got.rc === expRc : false
  const ok = got &&
    got.t === title && got.s === sd && got.e === expEnd &&
    got.st === st && got.et === et && rcOk
  if (ok) pass++
  else fails.push({ input, exp: { t: title, s: sd, e: expEnd, st, et, rc: expRc }, got })
}
console.log(`PASS ${pass}/${cases.length}`)
for (const f of fails) {
  console.log('\n✗', f.input)
  console.log('  期望:', JSON.stringify(f.exp))
  console.log('  实际:', JSON.stringify(f.got))
}
