import { describe, expect, it } from "vitest";
import { fullName, isEmail, passwordProblem, safeNext, splitName, validateLogin, validateReset, validateSignUp, type SignUpInput } from "./auth";

const good: SignUpInput = {
  firstName: "Ama",
  lastName: "Mensah",
  email: "ama.mensah@gmail.com",
  phone: "024 851 5773",
  password: "Kente2026",
  confirm: "Kente2026",
  terms: true,
};

describe("emails and passwords", () => {
  it("accepts ordinary emails and rejects broken ones", () => {
    expect(isEmail("ama.mensah@gmail.com")).toBe(true);
    expect(isEmail("  kofi@studio.com.gh ")).toBe(true);
    expect(isEmail("ama@gmail")).toBe(false);
    expect(isEmail("ama gmail.com")).toBe(false);
    expect(isEmail("@gmail.com")).toBe(false);
  });

  it("wants 8+ characters with letters and a number", () => {
    expect(passwordProblem("short1")).toMatch(/8 characters/);
    expect(passwordProblem("onlyletters")).toMatch(/number/);
    expect(passwordProblem("12345678")).toMatch(/number/);
    expect(passwordProblem("Kente2026")).toBeNull();
  });
});

describe("log in form", () => {
  it("asks for both fields", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({ email: "Enter your email address.", password: "Enter your password." });
    expect(validateLogin({ email: "ama@", password: "x" }).email).toMatch(/valid email/);
    expect(validateLogin({ email: "ama@gmail.com", password: "anything" })).toEqual({});
  });
});

describe("sign up form", () => {
  it("passes a complete, matching form", () => {
    expect(validateSignUp(good)).toEqual({});
  });

  it("flags each problem on its own field", () => {
    const errors = validateSignUp({ ...good, firstName: " ", phone: "12345", confirm: "Kente2025", terms: false });
    expect(Object.keys(errors).sort()).toEqual(["confirm", "firstName", "phone", "terms"]);
    expect(errors.confirm).toBe("The passwords don't match.");
  });

  it("checks the new password on reset too", () => {
    expect(validateReset({ password: "Kente2026", confirm: "Kente2026" })).toEqual({});
    expect(validateReset({ password: "abc", confirm: "" })).toEqual({ password: "Use at least 8 characters.", confirm: "Type your new password again." });
  });
});

describe("names", () => {
  it("joins and splits first and last names", () => {
    expect(fullName(" Kwame ", "Asante ")).toBe("Kwame Asante");
    expect(fullName("Kwame", "")).toBe("Kwame");
    expect(splitName("Kwame Osei Asante")).toEqual({ firstName: "Kwame", lastName: "Osei Asante" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("return link after signing in", () => {
  it("keeps paths inside the app", () => {
    expect(safeNext("/orders")).toBe("/orders");
    expect(safeNext("/orders/o-1041?tab=receipts")).toBe("/orders/o-1041?tab=receipts");
    expect(safeNext(null)).toBe("/profile");
  });

  it("refuses anything that could leave the app or loop back", () => {
    expect(safeNext("https://evil.example")).toBe("/profile");
    expect(safeNext("//evil.example/path")).toBe("/profile");
    expect(safeNext("/\\evil.example")).toBe("/profile");
    expect(safeNext("/javascript:alert(1)")).toBe("/profile");
    expect(safeNext("/login?next=/orders")).toBe("/profile");
    expect(safeNext("/signup")).toBe("/profile");
  });
});
