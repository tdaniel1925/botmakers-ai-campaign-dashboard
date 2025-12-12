/**
 * US Area Code to Timezone Mapping
 * Maps phone number area codes to IANA timezone identifiers
 */

// Map of area codes to timezones
// Source: NANPA (North American Numbering Plan Administration)
const AREA_CODE_TO_TIMEZONE: Record<string, string> = {
  // Eastern Time (America/New_York)
  "201": "America/New_York", // NJ
  "202": "America/New_York", // DC
  "203": "America/New_York", // CT
  "207": "America/New_York", // ME
  "212": "America/New_York", // NY
  "215": "America/New_York", // PA
  "216": "America/New_York", // OH
  "217": "America/Chicago",  // IL (Central)
  "219": "America/Chicago",  // IN (Central part)
  "223": "America/New_York", // PA
  "224": "America/Chicago",  // IL
  "225": "America/Chicago",  // LA
  "227": "America/New_York", // MD
  "228": "America/Chicago",  // MS
  "229": "America/New_York", // GA
  "231": "America/New_York", // MI
  "234": "America/New_York", // OH
  "239": "America/New_York", // FL
  "240": "America/New_York", // MD
  "248": "America/New_York", // MI
  "251": "America/Chicago",  // AL
  "252": "America/New_York", // NC
  "253": "America/Los_Angeles", // WA
  "254": "America/Chicago",  // TX
  "256": "America/Chicago",  // AL
  "260": "America/New_York", // IN
  "262": "America/Chicago",  // WI
  "267": "America/New_York", // PA
  "269": "America/New_York", // MI
  "270": "America/Chicago",  // KY (Central)
  "272": "America/New_York", // PA
  "276": "America/New_York", // VA
  "278": "America/New_York", // MI
  "281": "America/Chicago",  // TX
  "301": "America/New_York", // MD
  "302": "America/New_York", // DE
  "303": "America/Denver",   // CO
  "304": "America/New_York", // WV
  "305": "America/New_York", // FL
  "307": "America/Denver",   // WY
  "308": "America/Chicago",  // NE
  "309": "America/Chicago",  // IL
  "310": "America/Los_Angeles", // CA
  "312": "America/Chicago",  // IL
  "313": "America/New_York", // MI
  "314": "America/Chicago",  // MO
  "315": "America/New_York", // NY
  "316": "America/Chicago",  // KS
  "317": "America/New_York", // IN
  "318": "America/Chicago",  // LA
  "319": "America/Chicago",  // IA
  "320": "America/Chicago",  // MN
  "321": "America/New_York", // FL
  "323": "America/Los_Angeles", // CA
  "325": "America/Chicago",  // TX
  "326": "America/New_York", // OH
  "330": "America/New_York", // OH
  "331": "America/Chicago",  // IL
  "332": "America/New_York", // NY
  "334": "America/Chicago",  // AL
  "336": "America/New_York", // NC
  "337": "America/Chicago",  // LA
  "339": "America/New_York", // MA
  "340": "America/Virgin",   // VI (Atlantic)
  "341": "America/Los_Angeles", // CA
  "346": "America/Chicago",  // TX
  "347": "America/New_York", // NY
  "351": "America/New_York", // MA
  "352": "America/New_York", // FL
  "360": "America/Los_Angeles", // WA
  "361": "America/Chicago",  // TX
  "364": "America/New_York", // KY
  "380": "America/New_York", // OH
  "385": "America/Denver",   // UT
  "386": "America/New_York", // FL
  "401": "America/New_York", // RI
  "402": "America/Chicago",  // NE
  "404": "America/New_York", // GA
  "405": "America/Chicago",  // OK
  "406": "America/Denver",   // MT
  "407": "America/New_York", // FL
  "408": "America/Los_Angeles", // CA
  "409": "America/Chicago",  // TX
  "410": "America/New_York", // MD
  "412": "America/New_York", // PA
  "413": "America/New_York", // MA
  "414": "America/Chicago",  // WI
  "415": "America/Los_Angeles", // CA
  "417": "America/Chicago",  // MO
  "419": "America/New_York", // OH
  "423": "America/New_York", // TN
  "424": "America/Los_Angeles", // CA
  "425": "America/Los_Angeles", // WA
  "430": "America/Chicago",  // TX
  "432": "America/Chicago",  // TX
  "434": "America/New_York", // VA
  "435": "America/Denver",   // UT
  "440": "America/New_York", // OH
  "442": "America/Los_Angeles", // CA
  "443": "America/New_York", // MD
  "445": "America/New_York", // PA
  "447": "America/Chicago",  // IL
  "448": "America/New_York", // FL
  "458": "America/Los_Angeles", // OR
  "463": "America/New_York", // IN
  "469": "America/Chicago",  // TX
  "470": "America/New_York", // GA
  "475": "America/New_York", // CT
  "478": "America/New_York", // GA
  "479": "America/Chicago",  // AR
  "480": "America/Phoenix",  // AZ
  "484": "America/New_York", // PA
  "501": "America/Chicago",  // AR
  "502": "America/New_York", // KY
  "503": "America/Los_Angeles", // OR
  "504": "America/Chicago",  // LA
  "505": "America/Denver",   // NM
  "507": "America/Chicago",  // MN
  "508": "America/New_York", // MA
  "509": "America/Los_Angeles", // WA
  "510": "America/Los_Angeles", // CA
  "512": "America/Chicago",  // TX
  "513": "America/New_York", // OH
  "515": "America/Chicago",  // IA
  "516": "America/New_York", // NY
  "517": "America/New_York", // MI
  "518": "America/New_York", // NY
  "520": "America/Phoenix",  // AZ
  "530": "America/Los_Angeles", // CA
  "531": "America/Chicago",  // NE
  "534": "America/Chicago",  // WI
  "539": "America/Chicago",  // OK
  "540": "America/New_York", // VA
  "541": "America/Los_Angeles", // OR
  "551": "America/New_York", // NJ
  "559": "America/Los_Angeles", // CA
  "561": "America/New_York", // FL
  "562": "America/Los_Angeles", // CA
  "563": "America/Chicago",  // IA
  "564": "America/Los_Angeles", // WA
  "567": "America/New_York", // OH
  "570": "America/New_York", // PA
  "571": "America/New_York", // VA
  "573": "America/Chicago",  // MO
  "574": "America/New_York", // IN
  "575": "America/Denver",   // NM
  "580": "America/Chicago",  // OK
  "585": "America/New_York", // NY
  "586": "America/New_York", // MI
  "601": "America/Chicago",  // MS
  "602": "America/Phoenix",  // AZ
  "603": "America/New_York", // NH
  "605": "America/Chicago",  // SD
  "606": "America/New_York", // KY
  "607": "America/New_York", // NY
  "608": "America/Chicago",  // WI
  "609": "America/New_York", // NJ
  "610": "America/New_York", // PA
  "612": "America/Chicago",  // MN
  "614": "America/New_York", // OH
  "615": "America/Chicago",  // TN
  "616": "America/New_York", // MI
  "617": "America/New_York", // MA
  "618": "America/Chicago",  // IL
  "619": "America/Los_Angeles", // CA
  "620": "America/Chicago",  // KS
  "623": "America/Phoenix",  // AZ
  "626": "America/Los_Angeles", // CA
  "628": "America/Los_Angeles", // CA
  "629": "America/Chicago",  // TN
  "630": "America/Chicago",  // IL
  "631": "America/New_York", // NY
  "636": "America/Chicago",  // MO
  "640": "America/New_York", // NJ
  "641": "America/Chicago",  // IA
  "646": "America/New_York", // NY
  "650": "America/Los_Angeles", // CA
  "651": "America/Chicago",  // MN
  "657": "America/Los_Angeles", // CA
  "659": "America/Chicago",  // AL
  "660": "America/Chicago",  // MO
  "661": "America/Los_Angeles", // CA
  "662": "America/Chicago",  // MS
  "667": "America/New_York", // MD
  "669": "America/Los_Angeles", // CA
  "678": "America/New_York", // GA
  "680": "America/New_York", // NY
  "681": "America/New_York", // WV
  "682": "America/Chicago",  // TX
  "689": "America/New_York", // FL
  "701": "America/Chicago",  // ND
  "702": "America/Los_Angeles", // NV
  "703": "America/New_York", // VA
  "704": "America/New_York", // NC
  "706": "America/New_York", // GA
  "707": "America/Los_Angeles", // CA
  "708": "America/Chicago",  // IL
  "712": "America/Chicago",  // IA
  "713": "America/Chicago",  // TX
  "714": "America/Los_Angeles", // CA
  "715": "America/Chicago",  // WI
  "716": "America/New_York", // NY
  "717": "America/New_York", // PA
  "718": "America/New_York", // NY
  "719": "America/Denver",   // CO
  "720": "America/Denver",   // CO
  "724": "America/New_York", // PA
  "725": "America/Los_Angeles", // NV
  "726": "America/Chicago",  // TX
  "727": "America/New_York", // FL
  "731": "America/Chicago",  // TN
  "732": "America/New_York", // NJ
  "734": "America/New_York", // MI
  "737": "America/Chicago",  // TX
  "740": "America/New_York", // OH
  "743": "America/New_York", // NC
  "747": "America/Los_Angeles", // CA
  "754": "America/New_York", // FL
  "757": "America/New_York", // VA
  "760": "America/Los_Angeles", // CA
  "762": "America/New_York", // GA
  "763": "America/Chicago",  // MN
  "765": "America/New_York", // IN
  "769": "America/Chicago",  // MS
  "770": "America/New_York", // GA
  "772": "America/New_York", // FL
  "773": "America/Chicago",  // IL
  "774": "America/New_York", // MA
  "775": "America/Los_Angeles", // NV
  "779": "America/Chicago",  // IL
  "781": "America/New_York", // MA
  "785": "America/Chicago",  // KS
  "786": "America/New_York", // FL
  "801": "America/Denver",   // UT
  "802": "America/New_York", // VT
  "803": "America/New_York", // SC
  "804": "America/New_York", // VA
  "805": "America/Los_Angeles", // CA
  "806": "America/Chicago",  // TX
  "808": "Pacific/Honolulu", // HI
  "810": "America/New_York", // MI
  "812": "America/New_York", // IN
  "813": "America/New_York", // FL
  "814": "America/New_York", // PA
  "815": "America/Chicago",  // IL
  "816": "America/Chicago",  // MO
  "817": "America/Chicago",  // TX
  "818": "America/Los_Angeles", // CA
  "820": "America/Los_Angeles", // CA
  "828": "America/New_York", // NC
  "830": "America/Chicago",  // TX
  "831": "America/Los_Angeles", // CA
  "832": "America/Chicago",  // TX
  "838": "America/New_York", // NY
  "839": "America/New_York", // SC
  "840": "America/Los_Angeles", // CA
  "843": "America/New_York", // SC
  "845": "America/New_York", // NY
  "847": "America/Chicago",  // IL
  "848": "America/New_York", // NJ
  "850": "America/Chicago",  // FL (Central part)
  "854": "America/New_York", // SC
  "856": "America/New_York", // NJ
  "857": "America/New_York", // MA
  "858": "America/Los_Angeles", // CA
  "859": "America/New_York", // KY
  "860": "America/New_York", // CT
  "862": "America/New_York", // NJ
  "863": "America/New_York", // FL
  "864": "America/New_York", // SC
  "865": "America/New_York", // TN
  "870": "America/Chicago",  // AR
  "872": "America/Chicago",  // IL
  "878": "America/New_York", // PA
  "901": "America/Chicago",  // TN
  "903": "America/Chicago",  // TX
  "904": "America/New_York", // FL
  "906": "America/New_York", // MI
  "907": "America/Anchorage", // AK
  "908": "America/New_York", // NJ
  "909": "America/Los_Angeles", // CA
  "910": "America/New_York", // NC
  "912": "America/New_York", // GA
  "913": "America/Chicago",  // KS
  "914": "America/New_York", // NY
  "915": "America/Denver",   // TX (El Paso - Mountain)
  "916": "America/Los_Angeles", // CA
  "917": "America/New_York", // NY
  "918": "America/Chicago",  // OK
  "919": "America/New_York", // NC
  "920": "America/Chicago",  // WI
  "925": "America/Los_Angeles", // CA
  "928": "America/Phoenix",  // AZ
  "929": "America/New_York", // NY
  "930": "America/New_York", // IN
  "931": "America/Chicago",  // TN
  "934": "America/New_York", // NY
  "936": "America/Chicago",  // TX
  "937": "America/New_York", // OH
  "938": "America/Chicago",  // AL
  "940": "America/Chicago",  // TX
  "941": "America/New_York", // FL
  "943": "America/New_York", // GA
  "945": "America/Chicago",  // TX
  "947": "America/New_York", // MI
  "948": "America/New_York", // VA
  "949": "America/Los_Angeles", // CA
  "951": "America/Los_Angeles", // CA
  "952": "America/Chicago",  // MN
  "954": "America/New_York", // FL
  "956": "America/Chicago",  // TX
  "959": "America/New_York", // CT
  "970": "America/Denver",   // CO
  "971": "America/Los_Angeles", // OR
  "972": "America/Chicago",  // TX
  "973": "America/New_York", // NJ
  "978": "America/New_York", // MA
  "979": "America/Chicago",  // TX
  "980": "America/New_York", // NC
  "984": "America/New_York", // NC
  "985": "America/Chicago",  // LA
  "986": "America/Los_Angeles", // ID
  "989": "America/New_York", // MI
};

/**
 * Get timezone for a US phone number based on area code
 * @param phoneNumber - Phone number in any format (will be normalized)
 * @returns IANA timezone string or null if not found
 */
export function getTimezoneFromAreaCode(phoneNumber: string): string | null {
  if (!phoneNumber) return null;

  // Remove all non-numeric characters
  const digits = phoneNumber.replace(/\D/g, "");

  // Extract area code (first 3 digits after country code)
  let areaCode: string;

  if (digits.length === 10) {
    // US number without country code
    areaCode = digits.substring(0, 3);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code
    areaCode = digits.substring(1, 4);
  } else {
    // Not a standard US number
    return null;
  }

  return AREA_CODE_TO_TIMEZONE[areaCode] || null;
}

/**
 * Get timezone for a phone number, with fallback
 * @param phoneNumber - Phone number
 * @param fallbackTimezone - Default timezone if area code lookup fails
 * @returns IANA timezone string
 */
export function getTimezoneWithFallback(
  phoneNumber: string,
  fallbackTimezone: string = "America/New_York"
): string {
  return getTimezoneFromAreaCode(phoneNumber) || fallbackTimezone;
}
