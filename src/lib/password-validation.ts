/**
 * Password Strength Validation
 * OWASP-compliant password validation utilities
 */

export interface PasswordStrength {
  score: number; // 0-4 (weak to very strong)
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong";
  feedback: string[];
  isValid: boolean;
  color: string;
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
};

// Common passwords to block (abbreviated list - in production, use a larger list)
const COMMON_PASSWORDS = [
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "shadow",
  "123123",
  "654321",
  "superman",
  "qazwsx",
  "michael",
  "football",
  "password1",
  "password123",
  "welcome",
  "welcome1",
  "admin",
  "login",
  "passw0rd",
  "hello",
  "charlie",
  "donald",
  "loveme",
  "beer",
  "access",
  "thunder",
  "whatever",
  "pepper",
  "jordan",
  "hockey",
  "killer",
  "george",
  "computer",
  "internet",
];

/**
 * Validate password against requirements
 */
export function validatePassword(
  password: string,
  requirements: Partial<PasswordRequirements> = {},
  userInfo?: { email?: string; name?: string }
): PasswordStrength {
  const config = { ...DEFAULT_REQUIREMENTS, ...requirements };
  const feedback: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < config.minLength) {
    feedback.push(`Must be at least ${config.minLength} characters`);
  } else {
    score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 0.5;
  }

  // Check maximum length
  if (password.length > config.maxLength) {
    feedback.push(`Must be no more than ${config.maxLength} characters`);
  }

  // Check uppercase
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push("Include at least one uppercase letter");
  } else if (/[A-Z]/.test(password)) {
    score += 0.5;
  }

  // Check lowercase
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    feedback.push("Include at least one lowercase letter");
  } else if (/[a-z]/.test(password)) {
    score += 0.5;
  }

  // Check numbers
  if (config.requireNumbers && !/\d/.test(password)) {
    feedback.push("Include at least one number");
  } else if (/\d/.test(password)) {
    score += 0.5;
  }

  // Check special characters
  if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    feedback.push("Include at least one special character (!@#$%^&*...)");
  } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    score += 0.5;
  }

  // Check for common passwords
  if (config.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.some((common) => lowerPassword.includes(common))) {
      feedback.push("Avoid common passwords");
      score = Math.max(0, score - 1);
    }
  }

  // Check for user info in password
  if (config.preventUserInfoInPassword && userInfo) {
    const lowerPassword = password.toLowerCase();

    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split("@")[0].split(/[._-]/);
      for (const part of emailParts) {
        if (part.length >= 3 && lowerPassword.includes(part)) {
          feedback.push("Avoid using parts of your email");
          score = Math.max(0, score - 0.5);
          break;
        }
      }
    }

    if (userInfo.name) {
      const nameParts = userInfo.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length >= 3 && lowerPassword.includes(part)) {
          feedback.push("Avoid using your name");
          score = Math.max(0, score - 0.5);
          break;
        }
      }
    }
  }

  // Check for sequential characters
  if (hasSequentialChars(password)) {
    feedback.push("Avoid sequential characters (abc, 123)");
    score = Math.max(0, score - 0.5);
  }

  // Check for repeated characters
  if (hasRepeatedChars(password)) {
    feedback.push("Avoid repeated characters (aaa, 111)");
    score = Math.max(0, score - 0.5);
  }

  // Bonus for mixed character types
  const charTypes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((regex) =>
    regex.test(password)
  ).length;
  if (charTypes >= 4) score += 0.5;

  // Normalize score to 0-4
  const normalizedScore = Math.min(4, Math.max(0, Math.round(score)));

  const labels: PasswordStrength["label"][] = [
    "Very Weak",
    "Weak",
    "Fair",
    "Strong",
    "Very Strong",
  ];

  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
  ];

  const isValid =
    feedback.length === 0 ||
    (password.length >= config.minLength &&
      (!config.requireUppercase || /[A-Z]/.test(password)) &&
      (!config.requireLowercase || /[a-z]/.test(password)) &&
      (!config.requireNumbers || /\d/.test(password)) &&
      (!config.requireSpecialChars ||
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)));

  // If valid but has suggestions, keep them as tips
  if (isValid && feedback.length > 0) {
    // These are just tips, not blocking issues
  }

  return {
    score: normalizedScore,
    label: labels[normalizedScore],
    feedback: feedback.slice(0, 3), // Limit to 3 feedback items
    isValid:
      password.length >= config.minLength &&
      password.length <= config.maxLength &&
      (!config.requireUppercase || /[A-Z]/.test(password)) &&
      (!config.requireLowercase || /[a-z]/.test(password)) &&
      (!config.requireNumbers || /\d/.test(password)) &&
      (!config.requireSpecialChars ||
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)),
    color: colors[normalizedScore],
  };
}

/**
 * Check for sequential characters (abc, 123, etc.)
 */
function hasSequentialChars(password: string): boolean {
  const sequences = [
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];

  const lower = password.toLowerCase();

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 3; i++) {
      const forward = seq.substring(i, i + 3);
      const backward = forward.split("").reverse().join("");
      if (lower.includes(forward) || lower.includes(backward)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for repeated characters (aaa, 111, etc.)
 */
function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

/**
 * Generate a strong password suggestion
 */
export function generateStrongPassword(length: number = 16): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";

  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each type
  let password =
    uppercase[Math.floor(Math.random() * uppercase.length)] +
    lowercase[Math.floor(Math.random() * lowercase.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
