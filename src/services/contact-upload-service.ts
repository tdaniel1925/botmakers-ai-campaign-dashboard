/**
 * Contact Upload Service
 *
 * Handles CSV/Excel file parsing, field mapping, timezone detection,
 * and deduplication for outbound campaign contacts.
 */

import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// US Area Code to Timezone mapping
// Based on NANPA (North American Numbering Plan Administration) data
const US_AREA_CODE_TIMEZONES: Record<string, string> = {
  // Eastern Time (ET) - UTC-5/UTC-4
  '201': 'America/New_York', '202': 'America/New_York', '203': 'America/New_York',
  '207': 'America/New_York', '212': 'America/New_York', '215': 'America/New_York',
  '216': 'America/New_York', '217': 'America/Chicago', '218': 'America/Chicago',
  '219': 'America/Chicago', '224': 'America/Chicago', '225': 'America/Chicago',
  '226': 'America/Toronto', '228': 'America/Chicago', '229': 'America/New_York',
  '231': 'America/New_York', '234': 'America/New_York', '239': 'America/New_York',
  '240': 'America/New_York', '248': 'America/New_York', '251': 'America/Chicago',
  '252': 'America/New_York', '253': 'America/Los_Angeles', '254': 'America/Chicago',
  '256': 'America/Chicago', '260': 'America/New_York', '262': 'America/Chicago',
  '267': 'America/New_York', '269': 'America/New_York', '270': 'America/Chicago',
  '272': 'America/New_York', '276': 'America/New_York', '278': 'America/New_York',
  '281': 'America/Chicago', '301': 'America/New_York', '302': 'America/New_York',
  '303': 'America/Denver', '304': 'America/New_York', '305': 'America/New_York',
  '307': 'America/Denver', '308': 'America/Chicago', '309': 'America/Chicago',
  '310': 'America/Los_Angeles', '312': 'America/Chicago', '313': 'America/New_York',
  '314': 'America/Chicago', '315': 'America/New_York', '316': 'America/Chicago',
  '317': 'America/New_York', '318': 'America/Chicago', '319': 'America/Chicago',
  '320': 'America/Chicago', '321': 'America/New_York', '323': 'America/Los_Angeles',
  '325': 'America/Chicago', '330': 'America/New_York', '331': 'America/Chicago',
  '334': 'America/Chicago', '336': 'America/New_York', '337': 'America/Chicago',
  '339': 'America/New_York', '340': 'America/Virgin', '346': 'America/Chicago',
  '347': 'America/New_York', '351': 'America/New_York', '352': 'America/New_York',
  '360': 'America/Los_Angeles', '361': 'America/Chicago', '364': 'America/New_York',
  '380': 'America/New_York', '385': 'America/Denver', '386': 'America/New_York',
  '401': 'America/New_York', '402': 'America/Chicago', '404': 'America/New_York',
  '405': 'America/Chicago', '406': 'America/Denver', '407': 'America/New_York',
  '408': 'America/Los_Angeles', '409': 'America/Chicago', '410': 'America/New_York',
  '412': 'America/New_York', '413': 'America/New_York', '414': 'America/Chicago',
  '415': 'America/Los_Angeles', '417': 'America/Chicago', '419': 'America/New_York',
  '423': 'America/New_York', '424': 'America/Los_Angeles', '425': 'America/Los_Angeles',
  '430': 'America/Chicago', '432': 'America/Chicago', '434': 'America/New_York',
  '435': 'America/Denver', '440': 'America/New_York', '442': 'America/Los_Angeles',
  '443': 'America/New_York', '445': 'America/New_York', '447': 'America/Chicago',
  '458': 'America/Los_Angeles', '463': 'America/New_York', '469': 'America/Chicago',
  '470': 'America/New_York', '475': 'America/New_York', '478': 'America/New_York',
  '479': 'America/Chicago', '480': 'America/Phoenix', '484': 'America/New_York',
  '501': 'America/Chicago', '502': 'America/New_York', '503': 'America/Los_Angeles',
  '504': 'America/Chicago', '505': 'America/Denver', '507': 'America/Chicago',
  '508': 'America/New_York', '509': 'America/Los_Angeles', '510': 'America/Los_Angeles',
  '512': 'America/Chicago', '513': 'America/New_York', '515': 'America/Chicago',
  '516': 'America/New_York', '517': 'America/New_York', '518': 'America/New_York',
  '520': 'America/Phoenix', '530': 'America/Los_Angeles', '531': 'America/Chicago',
  '534': 'America/Chicago', '539': 'America/Chicago', '540': 'America/New_York',
  '541': 'America/Los_Angeles', '551': 'America/New_York', '559': 'America/Los_Angeles',
  '561': 'America/New_York', '562': 'America/Los_Angeles', '563': 'America/Chicago',
  '564': 'America/Los_Angeles', '567': 'America/New_York', '570': 'America/New_York',
  '571': 'America/New_York', '573': 'America/Chicago', '574': 'America/New_York',
  '575': 'America/Denver', '580': 'America/Chicago', '585': 'America/New_York',
  '586': 'America/New_York', '601': 'America/Chicago', '602': 'America/Phoenix',
  '603': 'America/New_York', '605': 'America/Chicago', '606': 'America/New_York',
  '607': 'America/New_York', '608': 'America/Chicago', '609': 'America/New_York',
  '610': 'America/New_York', '612': 'America/Chicago', '614': 'America/New_York',
  '615': 'America/Chicago', '616': 'America/New_York', '617': 'America/New_York',
  '618': 'America/Chicago', '619': 'America/Los_Angeles', '620': 'America/Chicago',
  '623': 'America/Phoenix', '626': 'America/Los_Angeles', '627': 'America/Los_Angeles',
  '628': 'America/Los_Angeles', '629': 'America/Chicago', '630': 'America/Chicago',
  '631': 'America/New_York', '636': 'America/Chicago', '641': 'America/Chicago',
  '646': 'America/New_York', '650': 'America/Los_Angeles', '651': 'America/Chicago',
  '657': 'America/Los_Angeles', '659': 'America/Chicago', '660': 'America/Chicago',
  '661': 'America/Los_Angeles', '662': 'America/Chicago', '667': 'America/New_York',
  '669': 'America/Los_Angeles', '678': 'America/New_York', '680': 'America/New_York',
  '681': 'America/New_York', '682': 'America/Chicago', '689': 'America/New_York',
  '701': 'America/Chicago', '702': 'America/Los_Angeles', '703': 'America/New_York',
  '704': 'America/New_York', '706': 'America/New_York', '707': 'America/Los_Angeles',
  '708': 'America/Chicago', '712': 'America/Chicago', '713': 'America/Chicago',
  '714': 'America/Los_Angeles', '715': 'America/Chicago', '716': 'America/New_York',
  '717': 'America/New_York', '718': 'America/New_York', '719': 'America/Denver',
  '720': 'America/Denver', '724': 'America/New_York', '725': 'America/Los_Angeles',
  '726': 'America/Chicago', '727': 'America/New_York', '731': 'America/Chicago',
  '732': 'America/New_York', '734': 'America/New_York', '737': 'America/Chicago',
  '740': 'America/New_York', '743': 'America/New_York', '747': 'America/Los_Angeles',
  '754': 'America/New_York', '757': 'America/New_York', '760': 'America/Los_Angeles',
  '762': 'America/New_York', '763': 'America/Chicago', '764': 'America/Los_Angeles',
  '765': 'America/New_York', '769': 'America/Chicago', '770': 'America/New_York',
  '772': 'America/New_York', '773': 'America/Chicago', '774': 'America/New_York',
  '775': 'America/Los_Angeles', '779': 'America/Chicago', '781': 'America/New_York',
  '785': 'America/Chicago', '786': 'America/New_York', '801': 'America/Denver',
  '802': 'America/New_York', '803': 'America/New_York', '804': 'America/New_York',
  '805': 'America/Los_Angeles', '806': 'America/Chicago', '808': 'Pacific/Honolulu',
  '810': 'America/New_York', '812': 'America/New_York', '813': 'America/New_York',
  '814': 'America/New_York', '815': 'America/Chicago', '816': 'America/Chicago',
  '817': 'America/Chicago', '818': 'America/Los_Angeles', '820': 'America/Los_Angeles',
  '828': 'America/New_York', '830': 'America/Chicago', '831': 'America/Los_Angeles',
  '832': 'America/Chicago', '838': 'America/New_York', '843': 'America/New_York',
  '845': 'America/New_York', '847': 'America/Chicago', '848': 'America/New_York',
  '850': 'America/Chicago', '854': 'America/New_York', '856': 'America/New_York',
  '857': 'America/New_York', '858': 'America/Los_Angeles', '859': 'America/New_York',
  '860': 'America/New_York', '862': 'America/New_York', '863': 'America/New_York',
  '864': 'America/New_York', '865': 'America/New_York', '870': 'America/Chicago',
  '872': 'America/Chicago', '878': 'America/New_York', '901': 'America/Chicago',
  '903': 'America/Chicago', '904': 'America/New_York', '906': 'America/New_York',
  '907': 'America/Anchorage', '908': 'America/New_York', '909': 'America/Los_Angeles',
  '910': 'America/New_York', '912': 'America/New_York', '913': 'America/Chicago',
  '914': 'America/New_York', '915': 'America/Denver', '916': 'America/Los_Angeles',
  '917': 'America/New_York', '918': 'America/Chicago', '919': 'America/New_York',
  '920': 'America/Chicago', '925': 'America/Los_Angeles', '928': 'America/Phoenix',
  '929': 'America/New_York', '930': 'America/New_York', '931': 'America/Chicago',
  '934': 'America/New_York', '936': 'America/Chicago', '937': 'America/New_York',
  '938': 'America/Chicago', '940': 'America/Chicago', '941': 'America/New_York',
  '947': 'America/New_York', '949': 'America/Los_Angeles', '951': 'America/Los_Angeles',
  '952': 'America/Chicago', '954': 'America/New_York', '956': 'America/Chicago',
  '959': 'America/New_York', '970': 'America/Denver', '971': 'America/Los_Angeles',
  '972': 'America/Chicago', '973': 'America/New_York', '978': 'America/New_York',
  '979': 'America/Chicago', '980': 'America/New_York', '984': 'America/New_York',
  '985': 'America/Chicago', '986': 'America/Denver', '989': 'America/New_York',
};

export interface ParsedContact {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  email?: string;
  areaCode?: string;
  timezone?: string;
  customFields: Record<string, string>;
  rowNumber: number;
  isValid: boolean;
  validationErrors: string[];
}

export interface UploadResult {
  totalRows: number;
  validContacts: ParsedContact[];
  invalidContacts: ParsedContact[];
  duplicates: ParsedContact[];
  headers: string[];
}

export interface FieldMapping {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  email?: string;
  [key: string]: string | undefined;
}

/**
 * Extract area code from a phone number
 */
export function extractAreaCode(phoneNumber: string): string | undefined {
  // Try parsing with libphonenumber first
  const parsed = parsePhoneNumberFromString(phoneNumber, 'US' as CountryCode);

  if (parsed && parsed.country === 'US') {
    const national = parsed.nationalNumber;
    if (national.length >= 10) {
      return national.substring(0, 3);
    }
  }

  // Fallback: extract from cleaned number
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Handle +1 country code
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return cleaned.substring(1, 4);
  }

  // Handle 10-digit number
  if (cleaned.length === 10) {
    return cleaned.substring(0, 3);
  }

  return undefined;
}

/**
 * Detect timezone from US phone area code
 */
export function detectTimezoneFromAreaCode(areaCode: string): string | undefined {
  return US_AREA_CODE_TIMEZONES[areaCode];
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  const parsed = parsePhoneNumberFromString(phoneNumber, 'US' as CountryCode);

  if (parsed && parsed.isValid()) {
    return parsed.format('E.164');
  }

  // Fallback cleanup
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  return phoneNumber;
}

/**
 * Validate a phone number
 */
export function validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const parsed = parsePhoneNumberFromString(phoneNumber, 'US' as CountryCode);

  if (!parsed) {
    return { isValid: false, error: 'Invalid phone number format' };
  }

  if (!parsed.isValid()) {
    return { isValid: false, error: 'Phone number is not valid' };
  }

  if (parsed.country !== 'US') {
    return { isValid: false, error: 'Only US phone numbers are supported' };
  }

  return { isValid: true };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value?.trim() ?? '',
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data,
  };
}

/**
 * Parse Excel file
 */
export function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  // Convert to JSON with headers
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    raw: false,
    defval: '',
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  // Get headers from first row keys
  const headers = Object.keys(jsonData[0]);

  // Convert all values to strings
  const rows = jsonData.map((row) => {
    const stringRow: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      stringRow[key] = String(value ?? '').trim();
    }
    return stringRow;
  });

  return { headers, rows };
}

/**
 * Process uploaded contacts with field mapping
 */
export function processContacts(
  rows: Record<string, string>[],
  fieldMapping: FieldMapping,
  headers: string[]
): UploadResult {
  const validContacts: ParsedContact[] = [];
  const invalidContacts: ParsedContact[] = [];
  const duplicates: ParsedContact[] = [];
  const seenPhones = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is headers, and arrays are 0-indexed

    const rawPhone = row[fieldMapping.phoneNumber] || '';
    const firstName = row[fieldMapping.firstName] || '';

    const validationErrors: string[] = [];

    // Validate required fields
    if (!firstName.trim()) {
      validationErrors.push('First name is required');
    }

    const phoneValidation = validatePhoneNumber(rawPhone);
    if (!phoneValidation.isValid) {
      validationErrors.push(phoneValidation.error || 'Invalid phone');
    }

    // Normalize phone and extract area code
    const normalizedPhone = phoneValidation.isValid ? normalizePhoneNumber(rawPhone) : rawPhone;
    const areaCode = extractAreaCode(rawPhone);
    const timezone = areaCode ? detectTimezoneFromAreaCode(areaCode) : undefined;

    // Build custom fields (all fields not in standard mapping)
    const customFields: Record<string, string> = {};
    const standardFields = ['phoneNumber', 'firstName', 'lastName', 'email'];

    for (const header of headers) {
      const isStandardField = standardFields.some(
        (field) => fieldMapping[field] === header
      );

      if (!isStandardField && row[header]) {
        customFields[header] = row[header];
      }
    }

    const contact: ParsedContact = {
      phoneNumber: normalizedPhone,
      firstName: firstName.trim(),
      lastName: fieldMapping.lastName ? row[fieldMapping.lastName]?.trim() : undefined,
      email: fieldMapping.email ? row[fieldMapping.email]?.trim() : undefined,
      areaCode,
      timezone,
      customFields,
      rowNumber,
      isValid: validationErrors.length === 0,
      validationErrors,
    };

    if (!contact.isValid) {
      invalidContacts.push(contact);
      continue;
    }

    // Check for duplicates
    if (seenPhones.has(normalizedPhone)) {
      contact.validationErrors.push('Duplicate phone number');
      duplicates.push(contact);
      continue;
    }

    seenPhones.add(normalizedPhone);
    validContacts.push(contact);
  }

  return {
    totalRows: rows.length,
    validContacts,
    invalidContacts,
    duplicates,
    headers,
  };
}

/**
 * Suggest field mappings based on header names
 */
export function suggestFieldMappings(headers: string[]): Partial<FieldMapping> {
  const mapping: Partial<FieldMapping> = {};

  const phonePatterns = ['phone', 'mobile', 'cell', 'telephone', 'number', 'tel'];
  const firstNamePatterns = ['first', 'firstname', 'first_name', 'fname', 'given'];
  const lastNamePatterns = ['last', 'lastname', 'last_name', 'lname', 'surname', 'family'];
  const emailPatterns = ['email', 'e-mail', 'mail', 'emailaddress'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase().replace(/[\s_-]/g, '');

    if (!mapping.phoneNumber && phonePatterns.some((p) => lowerHeader.includes(p))) {
      mapping.phoneNumber = header;
    }

    if (!mapping.firstName && firstNamePatterns.some((p) => lowerHeader.includes(p))) {
      mapping.firstName = header;
    }

    if (!mapping.lastName && lastNamePatterns.some((p) => lowerHeader.includes(p))) {
      mapping.lastName = header;
    }

    if (!mapping.email && emailPatterns.some((p) => lowerHeader.includes(p))) {
      mapping.email = header;
    }
  }

  return mapping;
}

/**
 * Get timezone display name
 */
export function getTimezoneDisplayName(timezone: string): string {
  const names: Record<string, string> = {
    'America/New_York': 'Eastern Time (ET)',
    'America/Chicago': 'Central Time (CT)',
    'America/Denver': 'Mountain Time (MT)',
    'America/Los_Angeles': 'Pacific Time (PT)',
    'America/Phoenix': 'Arizona (MST)',
    'America/Anchorage': 'Alaska Time (AKT)',
    'Pacific/Honolulu': 'Hawaii Time (HST)',
    'America/Virgin': 'Atlantic Time (AT)',
    'America/Toronto': 'Eastern Time (ET)',
  };

  return names[timezone] || timezone;
}

/**
 * Get current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * Check if a time is within calling hours for a timezone
 */
export function isWithinCallingHours(
  timezone: string,
  startHour: number,
  endHour: number
): boolean {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    };

    const currentHour = parseInt(
      new Intl.DateTimeFormat('en-US', options).format(now),
      10
    );

    return currentHour >= startHour && currentHour < endHour;
  } catch {
    return false;
  }
}
