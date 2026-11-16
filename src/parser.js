// ---- Natural-language parser for Mangalore listings & searches ----
const MANGALORE_LOCALITIES = ["Attavar","Bajpe","Ballalbagh","Bejai","Bendoor","Bendoorwell","Bikarnakatte","Bijai","Bolar","Bondel","Car Street","Chilimbi","Deralakatte","Derebail","Falnir","Gorigudda","Hampankatta","Jeppu","Jeppinamogaru","Kadri","Kadri Hills","Kankanady","Kapikad","Karangalpady","Kavoor","Kodialbail","Kodialguthu","Kodical","Konchady","Kottara","Kottara Chowki","Kulai","Kulshekar","Kuloor","Lady Hill","Lalbagh","Mallikatte","Mannagudda","Marnamikatte","Maryhill","Morgans Gate","Mulki","Nanthoor","Neermarga","Padil","Pandeshwar","Panambur","Pumpwell","Shakthinagar","Shivbagh","Surathkal","Thokottu","Ullal","Urwa","Urwa Store","Valencia","Vamanjoor","Yeyyadi","Kottara Cross","Baikampady","Kunjathbail","Ashok Nagar","Dongerkery","Hat Hill","Kadri Kambla","Kankanady Bypass","Bunts Hostel","Sasihithlu","Kuntikana","Kapikad","Pachanady","Alape","Kannur","Adyar","Farangipete","Thumbe","Bantwal","Moodbidri","Mulky"];

const NUM_WORDS = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,fifteen:15,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,single:1,double:2};

function normalizeText(s) {
  let t = " " + String(s || "").toLowerCase().replace(/[₹]/g, " rs ").replace(/\s+/g, " ") + " ";
  t = t.replace(/(\d),(?=\d)/g, "$1");                 // 1,200 -> 1200
  t = t.replace(/\b(\d+)\s*(?:and a half|\.5)\b/g, "$1.5");
  // "fifty five" -> 55, "two" -> 2
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, (m, a, b) => String(NUM_WORDS[a] + NUM_WORDS[b]));
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|single|double)\b(?!\s*(?:storey|story))/g, m => String(NUM_WORDS[m]));
  t = t.replace(/\b(\d+)\s+point\s+(\d+)\b/g, "$1.$2");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s*(?:crores?|cr)\s*(?:and\s*)?(\d{1,2})\s*(?:lakhs?|lacs?|lakh|lac|l)\b/g, (m, c, l) => (parseFloat(c) + parseInt(l) / 100) + " crore");
  t = t.replace(/\b(\d)\s*b\s*h\s*k\b/g, "$1bhk").replace(/\b(\d)\s*(?:bhk|bed ?rooms?|beds?|bedroom flat)\b/g, "$1 bhk");
  return t;
}

const UNIT_RE = "(crores?|cr|lakhs?|lacs?|lakh|lac|l|k|thousands?|rs|rupees)?";
function toRupees(n, unit, deal) {
  n = parseFloat(n); if (isNaN(n)) return null;
  unit = (unit || "").trim();
  if (/^cr/.test(unit)) return Math.round(n * 1e7);
  if (/^(lakh|lac|l)/.test(unit)) return Math.round(n * 1e5);
  if (/^(k|thousand)/.test(unit)) return Math.round(n * 1e3);
  if (n >= 10000) return Math.round(n);
  if (deal === "rent") return Math.round(n * 1000);   // "rent 25" -> 25,000
  return Math.round(n * 1e5);                          // "asking 55" -> 55 lakh
}

function fuzzyNorm(s) { return String(s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/ck/g, "k").replace(/c(?=[aou]|$)/g, "k").replace(/sh/g, "s").replace(/th/g, "t").replace(/dh/g, "d").replace(/gh/g, "g").replace(/q/g, "k").replace(/ph/g, "f").replace(/v/g, "b").replace(/w/g, "b").replace(/(.)\1+/g, "$1").replace(/[aeiouy]+/g, "a"); }
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// Returns the best known locality for a phrase, or null.
function snapLocality(phrase, known) {
  const p = fuzzyNorm(phrase); if (p.length < 3) return null;
  let best = null, bestScore = 99;
  for (const k of known) {
    const q = fuzzyNorm(k);
    if (q === p) return k;
    if (q[0] !== p[0]) continue;
    const d = lev(p, q);
    const tol = q.length <= 5 ? 1 : q.length <= 8 ? 2 : 3;
    if (d <= tol && d < bestScore) { best = k; bestScore = d; }
  }
  return best;
}
function findLocalityInTextUnused(t, known) {
  const words = t.replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  // try 2-word then 1-word windows
  let found = null;
  for (const size of [3, 2, 1]) {
    for (let i = 0; i + size <= words.length; i++) {
      const w = words.slice(i, i + size).join(" ");
      if (w.length < 4) continue;
      if (STOP.has(words[i]) || STOP.has(words[i + size - 1])) continue;
      const hit = snapLocality(w, known);
      if (hit) { found = hit; return found; }
    }
  }
  return found;
}
const STOP = new Set("a an the in at for sale rent bhk flat apartment asking price close will is of and to size square feet sqft sq ft with near on up floor facing owner name number phone lakh lakhs crore cr budget under below above me find show any need want looking client house villa plot land shop office commercial furnished semi unfurnished available sold also it its this that per month deposit between from or around about above below over within upto than more less rate good nice new old ready move".split(" "));

function titleCase(s) { return String(s).replace(/\b[a-z]/g, c => c.toUpperCase()).trim(); }

function detectDeal(t) { return /\b(rent|rental|lease|to let|tenant|per month|monthly)\b/.test(t) ? "rent" : (/\b(sale|sell|selling|buy|resale|purchase)\b/.test(t) ? "sale" : null); }
function detectType(t) {
  if (/\bplots?\b|\bsite\b|\bcents?\b|\bsq(?:uare)? ?yards?\b/.test(t)) return "plot";
  if (/\bland\b|\bacres?\b|\bagri/.test(t)) return "land";
  if (/\bshops?\b|\bshowroom\b/.test(t)) return "shop";
  if (/\boffice\b/.test(t)) return "office";
  if (/\bcommercial\b|\bwarehouse\b|\bgodown\b/.test(t)) return "commercial";
  if (/\bvilla\b|\brow house\b/.test(t)) return "villa";
  if (/\bindependent house\b|\bbungalow\b|\bindividual house\b|\bhouse\b/.test(t) && !/\bflat\b|\bapartment\b/.test(t)) return "independent_house";
  if (/\bflat\b|\bapartment\b|\bbhk\b|\brk\b/.test(t)) return "apartment";
  return null;
}
function detectBhk(t) {
  let m = t.match(/\b(\d(?:\.5)?) bhk\b/); if (m) return parseFloat(m[1]);
  if (/\b1 ?rk\b/.test(t)) return 1;
  return null;
}
function detectSize(t) {
  let m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:sq\.? ?ft|sqft|sft|square (?:feet|foot|fit)|sq feet|feet|ft)\b/);
  if (m) return Math.round(parseFloat(m[1]));
  m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:sq\.? ?yards?|square yards?|gaj)\b/); if (m) return Math.round(parseFloat(m[1]) * 9);
  m = t.match(/\b(\d+(?:\.\d+)?)\s*cents?\b/); if (m) return Math.round(parseFloat(m[1]) * 435.6);
  m = t.match(/\b(\d+(?:\.\d+)?)\s*acres?\b/); if (m) return Math.round(parseFloat(m[1]) * 43560);
  m = t.match(/\b(?:size|area|carpet|built ?up|super built ?up)\s*(?:is|of|area)?\s*(\d{3,5})\b/); if (m) return parseInt(m[1]);
  return null;
}
function detectFloor(t) {
  if (/\bground floor\b/.test(t)) return "Ground";
  const m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/); if (m) return m[1];
  if (/\btop floor\b/.test(t)) return "Top";
  return null;
}
function detectFacing(t) {
  const m = t.match(/\b(north|south|east|west)(?:[\s-]?(east|west))?\s*facing\b/);
  return m ? titleCase(m[1] + (m[2] ? "-" + m[2] : "")) : null;
}
function detectFurnishing(t) {
  if (/\bsemi[\s-]?furnished\b/.test(t)) return "semi-furnished";
  if (/\bun[\s-]?furnished\b|\bnot furnished\b/.test(t)) return "unfurnished";
  if (/\b(fully )?furnished\b/.test(t)) return "furnished";
  return null;
}
function detectPhone(raw) {
  const digits = String(raw || "").replace(/(\d)[\s-]+(?=\d)/g, "$1");
  const m = digits.match(/(?:\+?91)?([6-9]\d{9})\b/);
  return m ? m[1] : null;
}
function detectOwner(t) {
  const m = t.match(/\b(?:owner|landlord|seller|contact)(?:'s| is| name is| name|:)*\s+(?:mr\.? |mrs\.? |ms\.? )?([a-z]+(?: [a-z]+)?)/);
  if (!m) return null;
  const words = m[1].split(" ").filter(w => !STOP.has(w) && !/^\d/.test(w) && w !== "number" && w !== "phone");
  return words.length ? titleCase(words.join(" ")) : null;
}
function detectStatus(t) {
  if (/\b(already )?(sold out|sold)\b/.test(t)) return "sold";
  if (/\b(already rented|rented out)\b/.test(t)) return "rented";
  if (/\bnegotiat|\btoken\b|\badvance paid\b/.test(t)) return "negotiating";
  if (/\bon hold\b/.test(t)) return "on_hold";
  return null;
}
function detectBuilding(t) {
  const m = t.match(/\b(?:building|society|project|complex) (?:name )?(?:is |called )?([a-z][a-z0-9 ]{1,30}?)(?= in | at | near |,|\.| asking| price| for | size| \d| owner|  |$)/);
  if (m && !STOP.has(m[1].trim())) return titleCase(m[1]);
  const m2 = t.match(/\b([a-z]+(?: [a-z]+)?) (residency|enclave|heights|towers|apartments|arcade|palms|gardens|court|nest|homes|castle|plaza)\b/);
  if (m2 && !STOP.has(m2[1].split(" ")[0])) return titleCase(m2[1] + " " + m2[2]);
  return null;
}


// ---- Extra listing details ----
const AMENITIES = { lift: "Lift", parking: "Car parking", power_backup: "Power backup", security: "Security", cctv: "CCTV", gym: "Gym", pool: "Swimming pool", garden: "Garden", clubhouse: "Clubhouse", play_area: "Kids play area", intercom: "Intercom", water: "24h water", gas: "Piped gas", sea_view: "Sea view" };
const APPROVALS = { rera: "RERA", a_khata: "A Khata", b_khata: "B Khata", e_khata: "E Khata", oc: "OC", cc: "CC", dc: "DC converted", nine_eleven: "9/11" };
function detectAmenities(t) {
  const out = []; const add = k => { if (!out.includes(k)) out.push(k); };
  if (/\blifts?\b|\belevators?\b/.test(t)) add("lift");
  if (/\bparking\b|\bcar park\b|\bgarage\b/.test(t)) add("parking");
  if (/\bpower ?back ?up\b|\bgenerator\b|\bdg ?back ?up\b|\binverter\b/.test(t)) add("power_backup");
  if (/\bsecurity\b|\bwatchman\b|\bgated\b/.test(t)) add("security");
  if (/\bcctv\b|\bcamera\b/.test(t)) add("cctv");
  if (/\bgym\b|\bfitness\b/.test(t)) add("gym");
  if (/\b(swimming )?pool\b/.test(t)) add("pool");
  if (/\bgarden\b|\blawn\b/.test(t)) add("garden");
  if (/\bclub ?house\b/.test(t)) add("clubhouse");
  if (/\bplay ?(area|ground)\b|\bkids\b/.test(t)) add("play_area");
  if (/\bintercom\b/.test(t)) add("intercom");
  if (/\b24 ?(hours?|hrs?|x ?7)? ?water\b|\bwater supply\b|\bborewell\b/.test(t)) add("water");
  if (/\bpiped gas\b|\bgas pipeline\b|\bgas line\b/.test(t)) add("gas");
  if (/\bsea ?(view|facing)\b|\bbeach view\b/.test(t)) add("sea_view");
  return out;
}
function detectApprovals(t) {
  const out = []; const add = k => { if (!out.includes(k)) out.push(k); };
  if (/\brera\b/.test(t)) add("rera");
  if (/\ba ?khata\b/.test(t)) add("a_khata");
  if (/\bb ?khata\b/.test(t)) add("b_khata");
  if (/\be ?khata\b/.test(t)) add("e_khata");
  if (/\bo ?c\b|\boccupancy certificate\b/.test(t)) add("oc");
  if (/\bc ?c\b|\bcompletion certificate\b/.test(t)) add("cc");
  if (/\bdc ?(converted|conversion)\b|\bconverted land\b|\bconverted plot\b/.test(t)) add("dc");
  if (/\b9 ?\/ ?11\b|\bnine eleven\b/.test(t)) add("nine_eleven");
  return out;
}
function detectAge(t) {
  let m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:old|age)\b/) || t.match(/\b(?:age|built)\s*(?:is|of|around)?\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/);
  if (m) return parseFloat(m[1]);
  if (/\bbrand new\b|\bnew construction\b|\bfresh\b/.test(t)) return 0;
  return null;
}
function detectPossession(t) {
  if (/\bunder ?construction\b|\bunder ?development\b|\bpossession (in|by)\b/.test(t)) return "under_construction";
  if (/\bready ?(to)? ?move\b|\bready possession\b|\bimmediate possession\b|\bready\b/.test(t)) return "ready";
  return null;
}
function detectMaintenance(t) {
  const m = t.match(/\bmaintenance\s*(?:is|of|charges?|cost|:)*\s*(?:rs\s*)?(\d+(?:\.\d+)?)\s*(k|thousand)?\b/);
  if (!m) return null;
  let n = parseFloat(m[1]); if (m[2] || n < 100) n *= 1000; return Math.round(n);
}
function detectNegotiable(t) {
  if (/\b(non|not)[\s-]?negotiable\b|\bfixed price\b|\bno negotiation\b|\bfinal price\b(?! (?:is|at|of)? ?\d)/.test(t)) return false;
  return true;
}

function parseListing(raw, known = MANGALORE_LOCALITIES) {
  const t = normalizeText(raw);
  const deal = detectDeal(t) || "sale";
  const out = {
    deal_type: deal,
    property_type: detectType(t) || "apartment",
    bhk: detectBhk(t),
    locality: null, building: detectBuilding(t), floor: detectFloor(t), facing: detectFacing(t),
    furnishing: detectFurnishing(t), size_sqft: detectSize(t),
    asking_price: null, closing_price: null, deposit: null,
    owner_name: detectOwner(t), owner_phone: detectPhone(raw), status: detectStatus(t) || "available",
    amenities: detectAmenities(t), approvals: detectApprovals(t), age_years: detectAge(t), possession: detectPossession(t),
    maintenance: detectMaintenance(t), negotiable: detectNegotiable(t),
  };
  if (["plot", "land", "shop", "office", "commercial"].includes(out.property_type) && !/bhk/.test(t)) out.bhk = null;
  // prices
  const P = "(\\d+(?:\\.\\d+)?)\\s*" + UNIT_RE + "\\b(?!\\s*(?:bhk|rk|sq|square|sft|ft|feet|cents?|acres?|floor|years?|yrs))";
  const ask = t.match(new RegExp("\\b(?:asking|ask|quoted?|quoting|expect(?:ed|ing)?|demand(?:ing)?|price|rent|selling for|for sale at|listed at|cost)\\s*(?:price|rent|amount)?\\s*(?:is|of|at|around|about|rs|:)*\\s*(?:rs\\s*)?" + P));
  const close = t.match(new RegExp("\\b(?:close|closing|closes|final|finali[sz]e|settle|bottom|lowest|last price|negotiable (?:to|till|up ?to)|deal at|can do|will do|go down to)\\s*(?:at|on|for|price|is|around|about|rs|:)*\\s*(?:rs\\s*)?" + P));
  const dep = t.match(new RegExp("\\b(?:deposit|advance)\\s*(?:is|of|:)*\\s*(?:rs\\s*)?" + P));
  if (ask && !/\d\s*(?:sq|square|feet|ft|bhk|floor)/.test(ask[0])) out.asking_price = toRupees(ask[1], ask[2], deal);
  if (close) out.closing_price = toRupees(close[1], close[2], deal);
  if (dep) out.deposit = toRupees(dep[1], dep[2], "rent") ;
  if (dep && !dep[2] && parseFloat(dep[1]) < 100) out.deposit = toRupees(dep[1], "lakh");
  if (!out.asking_price) {
    const any = t.match(new RegExp("\\b(\\d+(?:\\.\\d+)?)\\s*(crores?|cr|lakhs?|lacs?|lakh|lac|k|thousand)\\b"));
    if (any) out.asking_price = toRupees(any[1], any[2], deal);
  }
  if (!out.asking_price) {
    const pm = t.match(/\b(\d{4,7}|\d+(?:\.\d+)?\s*k)\s*(?:rs|rupees)?\s*(?:per month|a month|monthly|\/month|pm)\b/);
    if (pm) out.asking_price = toRupees(pm[1].replace(/\s*k/, ""), /k/.test(pm[1]) ? "k" : "", deal);
  }
  // locality: "in X" first, then anywhere in text
  const inM = t.match(/\b(?:in|at|near|area|location|locality|located)\s+(?:is\s+)?([a-z][a-z ]{2,30}?)(?=,|\.| asking| price| for | size| \d| it | the | with | and | owner| which|  |$)/);
  let loc = null;
  if (inM) loc = snapLocality(inM[1], known) || snapLocality(inM[1].split(" ")[0], known);
  if (!loc) loc = parseSearchLocalities(t, known)[0] || null;
  if (!loc && inM && !STOP.has(inM[1].split(" ")[0])) loc = titleCase(inM[1]);
  out.locality = loc;
  return out;
}

function parseSearchLocalities(t, known) {
  const res = [];
  const words = t.replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  const used = new Set();
  const cands = [];
  for (const size of [3, 2, 1]) for (let i = 0; i + size <= words.length; i++) {
    const w = words.slice(i, i + size).join(" ");
    if (w.length < 4 || STOP.has(words[i]) || STOP.has(words[i + size - 1])) continue;
    const hit = snapLocality(w, known);
    if (hit) cands.push({ hit, i, size, d: lev(fuzzyNorm(w), fuzzyNorm(hit)) });
  }
  cands.sort((a, b) => a.d - b.d || b.size - a.size || a.i - b.i);
  for (const c of cands) {
    if ([...Array(c.size).keys()].some(k => used.has(c.i + k)) || res.includes(c.hit)) continue;
    res.push(c.hit); for (let k = 0; k < c.size; k++) used.add(c.i + k);
  }
  return res;
}

function parseSearch(raw, known = MANGALORE_LOCALITIES, skipWords = []) {
  let t = normalizeText(raw);
  for (const w of skipWords) if (w) t = t.replace(new RegExp("\\b" + w.toLowerCase().replace(/[^a-z ]/g, "") + "\\b", "g"), " ");
  const deal = detectDeal(t);
  const q = { deal_type: deal, property_type: detectType(t), bhk: detectBhk(t), localities: [], min_price: null, max_price: null, min_size: null, max_size: null, furnishing: detectFurnishing(t), keywords: [] };
  if (q.property_type === "apartment" && !/\b(flat|apartment)\b/.test(t)) q.property_type = null; // "2 bhk" alone shouldn't exclude villas/houses
  const P = "(\\d+(?:\\.\\d+)?)\\s*" + UNIT_RE + "\\b(?!\\s*(?:bhk|rk|sq|square|sft|ft|feet|cents?|acres?|floor))";
  const between = t.match(new RegExp("\\b(?:between|from)\\s*" + P + "\\s*(?:and|to|-)\\s*" + P));
  const under = t.match(new RegExp("\\b(?:under|below|upto|up to|within|max(?:imum)?|less than|budget(?: is| of)?|around|about)\\s*(?:rs\\s*)?" + P));
  const over = t.match(new RegExp("\\b(?:above|over|more than|min(?:imum)?|at least|starting)\\s*(?:rs\\s*)?" + P));
  const isSize = m => m && /^\s*(sq|square|feet|ft|sft)/.test(t.slice(t.indexOf(m[0]) + m[0].length));
  if (between && !isSize(between)) {
    const u = between[2] || between[4];
    q.min_price = toRupees(between[1], u, deal); q.max_price = toRupees(between[3], between[4] || u, deal);
  } else {
    if (under && !isSize(under)) { q.max_price = toRupees(under[1], under[2], deal); if (/around|about/.test(under[0])) { q.min_price = Math.round(q.max_price * 0.85); q.max_price = Math.round(q.max_price * 1.15); } }
    if (over && !isSize(over)) q.min_price = toRupees(over[1], over[2], deal);
  }
  const sz = t.match(/\b(?:above|over|at least|min(?:imum)?|more than)\s*(\d{3,5})\s*(?:sq|square|sft|ft)/); if (sz) q.min_size = +sz[1];
  const sz2 = t.match(/\b(?:under|below|upto|up to|max(?:imum)?|less than)\s*(\d{3,5})\s*(?:sq|square|sft|ft)/); if (sz2) q.max_size = +sz2[1];
  // localities: all that appear
  q.localities = parseSearchLocalities(t, known);
  const fac = detectFacing(t); if (fac) q.keywords.push(fac.toLowerCase());
  return q;
}

if (typeof module !== "undefined") module.exports = { parseListing, parseSearch, snapLocality, toRupees, MANGALORE_LOCALITIES };

// ---- Leads (buyer / tenant requirements) ----
function detectLeadName(t) {
  const m = t.match(/\b(?:client|customer|lead|buyer|tenant|enquiry from|inquiry from|name is|named|mr\.?|mrs\.?|ms\.?)\s+(?:is\s+|name is\s+|named\s+)?([a-z]+(?: [a-z]+)?)/);
  if (!m) {
    const s0 = t.trim().match(/^([a-z]+(?: [a-z]+)?) (?:is )?(?:looking|wants|needs|requires|searching|interested)\b/);
    if (s0 && !s0[1].split(" ").some(w => STOP.has(w) || ["new","client","customer","lead","someone","buyer","tenant","family"].includes(w))) return titleCase(s0[1]);
    return null;
  }
  const NOT = new Set(["looking","wants","want","needs","need","is","from","a","an","the","for","with","requirement","requires","searching","interested","budget","phone","number"]);
  const w = m[1].split(" "); const keep = [];
  for (const x of w) { if (NOT.has(x) || STOP.has(x) || /\d/.test(x)) break; keep.push(x); }
  return keep.length ? titleCase(keep.join(" ")) : null;
}
function detectTypes(t) {
  const out = [];
  const add = x => { if (!out.includes(x)) out.push(x); };
  if (/\bflats?\b|\bapartments?\b/.test(t)) add("apartment");
  if (/\bvillas?\b|\brow house/.test(t)) add("villa");
  if (/\bindependent house\b|\bbungalow\b|\bindividual house\b|\bhouses?\b/.test(t)) add("independent_house");
  if (/\bplots?\b|\bsites?\b/.test(t)) add("plot");
  if (/\bland\b|\bacres?\b/.test(t)) add("land");
  if (/\bshops?\b|\bshowroom\b|\bretail\b/.test(t)) add("shop");
  if (/\boffices?\b|\bworkspace\b/.test(t)) add("office");
  if (/\bcommercial\b|\bwarehouse\b|\bgodown\b/.test(t)) { add("commercial"); if (!out.includes("shop")) add("shop"); if (!out.includes("office")) add("office"); }
  if (!out.length && /\bbhk\b|\bhome\b|\bresidential\b/.test(t)) add("apartment"), add("independent_house"), add("villa");
  return out;
}
function parseLead(raw, known = MANGALORE_LOCALITIES) {
  const t = normalizeText(raw);
  const nm = detectLeadName(t);
  const q = parseSearch(raw, known, nm ? nm.split(" ") : []);
  const lead = {
    name: nm, phone: detectPhone(raw), deal_type: q.deal_type || "sale",
    property_types: detectTypes(t), bhk_min: null, bhk_max: null, localities: q.localities,
    budget_min: q.min_price, budget_max: q.max_price, size_min: q.min_size, size_max: q.max_size,
    furnishing: q.furnishing, status: "new",
  };
  const r = t.match(/\b(\d)\s*(?:or|to|\/|-)\s*(\d)\s*bhk\b/);
  if (r) { lead.bhk_min = +r[1]; lead.bhk_max = +r[2]; } else if (q.bhk) { lead.bhk_min = lead.bhk_max = q.bhk; }
  // "50 to 60 lakh", "60-70 lakhs"
  const deal = lead.deal_type;
  const rng = t.match(/\b(\d+(?:\.\d+)?)\s*(?:to|-|or)\s*(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lakh|lac|k|thousand)\b/);
  if (rng && !/bhk/.test(rng[0])) { lead.budget_min = toRupees(rng[1], rng[3], deal); lead.budget_max = toRupees(rng[2], rng[3], deal); }
  if (!lead.budget_max) {
    const b = t.match(/\b(?:budget|afford|spend|pay|paying|rent)\s*(?:is|of|around|about|up ?to|max|:)*\s*(?:rs\s*)?(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lakh|lac|k|thousand)?\b/);
    if (b) lead.budget_max = toRupees(b[1], b[2], deal);
  }
  if (!lead.budget_max) {
    const any = t.match(/\b(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lakh|lac|k|thousand)\b/);
    if (any) lead.budget_max = toRupees(any[1], any[2], deal);
  }
  if (lead.budget_min && lead.budget_max && lead.budget_min > lead.budget_max) [lead.budget_min, lead.budget_max] = [lead.budget_max, lead.budget_min];
  return lead;
}

// Score how well a listing fits a lead. Returns null if it clearly doesn't fit.
function matchLead(lead, l, { team = true } = {}) {
  if (!["available", "negotiating", "on_hold"].includes(l.status)) return null;
  if (lead.deal_type && l.deal_type !== lead.deal_type) return null;
  const types = lead.property_types || [];
  if (types.length && !types.includes(l.property_type) && !(types.includes("plot") && l.property_type === "land") && !(types.includes("land") && l.property_type === "plot")) return null;
  let score = 0; const why = [];
  // budget (35)
  const ask = +l.asking_price || null, close = team ? (+l.closing_price || ask) : ask;
  if (lead.budget_max) {
    if (!close) { score += 10; }
    else if (ask && ask <= lead.budget_max) { score += 35; why.push("Within budget"); }
    else if (close <= lead.budget_max) { score += 30; why.push("Closes within budget"); }
    else if (close <= lead.budget_max * 1.1) { score += 12; why.push("Slightly above budget"); }
    else return null;
    if (lead.budget_min && ask && ask < lead.budget_min * 0.7) score -= 10;
  } else score += 20;
  // area (30)
  const locs = lead.localities || [];
  if (locs.length) {
    if (l.locality && locs.some(x => fuzzyNorm(x) === fuzzyNorm(l.locality) || snapLocality(l.locality, [x]))) { score += 30; why.push(l.locality); }
    else why.push("Other area");
  } else score += 15;
  // BHK (20)
  if (lead.bhk_min || lead.bhk_max) {
    const lo = lead.bhk_min || lead.bhk_max, hi = lead.bhk_max || lead.bhk_min, b = +l.bhk;
    if (!b) score += 5;
    else if (b >= lo && b <= hi) { score += 20; why.push(b + " BHK"); }
    else if (b >= lo - 1 && b <= hi + 1) { score += 6; why.push(b + " BHK (close)"); }
    else return null;
  } else score += 10;
  // size (10)
  if (lead.size_min || lead.size_max) {
    const s = +l.size_sqft;
    if (!s) score += 3;
    else if ((!lead.size_min || s >= lead.size_min * 0.95) && (!lead.size_max || s <= lead.size_max * 1.05)) { score += 10; why.push(Math.round(s) + " sq ft"); }
  } else score += 5;
  if (lead.furnishing && l.furnishing === lead.furnishing) { score += 5; why.push(l.furnishing); }
  return { score: Math.max(0, Math.min(100, score)), why };
}

if (typeof module !== "undefined") Object.assign(module.exports, { parseLead, matchLead, AMENITIES, APPROVALS });
