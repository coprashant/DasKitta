/* BS month lengths per year, index 0 = Baisakh, 11 = Chaitra */
const BS_DATA = {
  2078: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 29],
  2083: [32, 31, 32, 31, 31, 30, 30, 30, 29, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 29],
  2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2089: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2090: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 29],
};

/* AD date corresponding to BS 2078 Baisakh 1 */
const EPOCH_BS  = { year: 2078, month: 1, day: 1 };
const EPOCH_AD  = { year: 2021, month: 4, day: 14 };

const totalBsDays = (bsYear, bsMonth, bsDay) => {
  const months = BS_DATA[bsYear];
  if (!months) {
    throw new Error(`BS year ${bsYear} is outside the supported range (2078 to 2090)`);
  }
  let days = 0;
  for (let y = EPOCH_BS.year; y < bsYear; y++) {
    const ym = BS_DATA[y];
    if (!ym) throw new Error(`BS year ${y} is outside the supported range`);
    for (let m = 0; m < 12; m++) days += ym[m];
  }
  for (let m = 0; m < bsMonth - 1; m++) days += months[m];
  days += bsDay - 1;
  return days;
};

export const bsToAd = (bsDateStr) => {
  const parts = bsDateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid BS date format "${bsDateStr}", expected YYYY-MM-DD`);
  }
  const [bsYear, bsMonth, bsDay] = parts;
  const offsetDays = totalBsDays(bsYear, bsMonth, bsDay);
  const epochAd = new Date(EPOCH_AD.year, EPOCH_AD.month - 1, EPOCH_AD.day);
  epochAd.setDate(epochAd.getDate() + offsetDays);
  return epochAd;
};

/* Nepal is UTC+5:45, offset in minutes */
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export const nowNepal = () => {
  const utcMs = Date.now() + new Date().getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + NEPAL_OFFSET_MS);
};