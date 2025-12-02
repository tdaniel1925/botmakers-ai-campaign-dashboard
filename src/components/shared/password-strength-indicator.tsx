"use client";

import { useState, useEffect } from "react";
import { validatePassword, type PasswordStrength } from "@/lib/password-validation";
import { Check, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { generateStrongPassword } from "@/lib/password-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrengthIndicator?: boolean;
  showRequirements?: boolean;
  showGenerator?: boolean;
  userEmail?: string;
  userName?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Enter password",
  showStrengthIndicator = true,
  showRequirements = true,
  showGenerator = false,
  userEmail,
  userName,
  className,
  id,
  name,
  disabled,
  required,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState<PasswordStrength | null>(null);

  useEffect(() => {
    if (value) {
      setStrength(
        validatePassword(value, {}, { email: userEmail, name: userName })
      );
    } else {
      setStrength(null);
    }
  }, [value, userEmail, userName]);

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword(16);
    onChange(newPassword);
    setShowPassword(true);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("pr-10", className)}
          id={id}
          name={name}
          disabled={disabled}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      {showGenerator && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGeneratePassword}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Generate Strong Password
        </Button>
      )}

      {showStrengthIndicator && value && strength && (
        <div className="space-y-2">
          {/* Strength bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  strength.color
                )}
                style={{ width: `${(strength.score + 1) * 20}%` }}
              />
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                strength.score <= 1
                  ? "text-red-500"
                  : strength.score === 2
                  ? "text-yellow-500"
                  : "text-green-500"
              )}
            >
              {strength.label}
            </span>
          </div>

          {/* Feedback */}
          {showRequirements && strength.feedback.length > 0 && (
            <ul className="text-xs space-y-1">
              {strength.feedback.map((item, index) => (
                <li key={index} className="flex items-center gap-1.5 text-muted-foreground">
                  <X className="h-3 w-3 text-red-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showRequirements && value && strength?.isValid && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <Check className="h-3 w-3" />
          Password meets all requirements
        </div>
      )}
    </div>
  );
}

interface PasswordRequirementsListProps {
  password: string;
  className?: string;
}

export function PasswordRequirementsList({
  password,
  className,
}: PasswordRequirementsListProps) {
  const requirements = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number", test: (p: string) => /\d/.test(p) },
    {
      label: "One special character",
      test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p),
    },
  ];

  return (
    <ul className={cn("text-xs space-y-1", className)}>
      {requirements.map((req, index) => {
        const met = password ? req.test(password) : false;
        return (
          <li
            key={index}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {met ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-current flex-shrink-0" />
            )}
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}
