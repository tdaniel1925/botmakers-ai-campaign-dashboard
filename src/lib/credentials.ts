/**
 * Credential generation utilities for client accounts
 */

// Generate a username from name (e.g., "John Doe" -> "john.doe" or "jdoe123")
export function generateUsername(name: string, existingUsernames: string[] = []): string {
  // Clean the name
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

  const parts = cleanName.split(" ");

  // Try different username formats
  const candidates: string[] = [];

  // Format 1: firstname.lastname
  if (parts.length >= 2) {
    candidates.push(`${parts[0]}.${parts[parts.length - 1]}`);
  }

  // Format 2: firstnamelastname
  if (parts.length >= 2) {
    candidates.push(`${parts[0]}${parts[parts.length - 1]}`);
  }

  // Format 3: first initial + lastname
  if (parts.length >= 2) {
    candidates.push(`${parts[0][0]}${parts[parts.length - 1]}`);
  }

  // Format 4: firstname only
  candidates.push(parts[0]);

  // Find a unique username
  for (const candidate of candidates) {
    if (!existingUsernames.includes(candidate)) {
      return candidate;
    }

    // Try adding numbers
    for (let i = 1; i <= 999; i++) {
      const withNumber = `${candidate}${i}`;
      if (!existingUsernames.includes(withNumber)) {
        return withNumber;
      }
    }
  }

  // Fallback: random string
  return `user${Date.now().toString(36)}`;
}

// Character sets for password generation
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O to avoid confusion
const LOWERCASE = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o to avoid confusion
const NUMBERS = "23456789"; // Removed 0, 1 to avoid confusion
const SYMBOLS = "!@#$%&*";

/**
 * Generate a secure temporary password
 * Format: 3 chars + symbol + 3 chars + symbol + 3 chars (e.g., "Abc@123#Xyz")
 * This format is easy to read and type while being secure
 */
export function generateTempPassword(): string {
  const getRandomChar = (charset: string): string => {
    const randomIndex = Math.floor(Math.random() * charset.length);
    return charset[randomIndex];
  };

  const getRandomChars = (charset: string, count: number): string => {
    let result = "";
    for (let i = 0; i < count; i++) {
      result += getRandomChar(charset);
    }
    return result;
  };

  // Build password: Uppercase + lowercase + number pattern repeated with symbols
  const part1 = getRandomChar(UPPERCASE) + getRandomChars(LOWERCASE, 2);
  const symbol1 = getRandomChar(SYMBOLS);
  const part2 = getRandomChars(NUMBERS, 3);
  const symbol2 = getRandomChar(SYMBOLS);
  const part3 = getRandomChar(UPPERCASE) + getRandomChars(LOWERCASE, 2);

  return `${part1}${symbol1}${part2}${symbol2}${part3}`;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%&*]/.test(password)) {
    errors.push("Password must contain at least one symbol (!@#$%&*)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format credentials for display in email
 */
export function formatCredentialsForEmail(
  username: string,
  password: string
): string {
  return `
    <table style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; width: 100%;">
      <tr>
        <td style="padding: 8px 0;">
          <strong style="color: #374151;">Username:</strong>
        </td>
        <td style="padding: 8px 0;">
          <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${username}</code>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <strong style="color: #374151;">Temporary Password:</strong>
        </td>
        <td style="padding: 8px 0;">
          <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${password}</code>
        </td>
      </tr>
    </table>
  `;
}
