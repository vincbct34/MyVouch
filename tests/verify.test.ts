import { test } from "node:test";
import assert from "node:assert/strict";
import { employerOverlap, emailDomain } from "../lib/verify.ts";
import type { User } from "../lib/db.ts";

function owner(email: string, emailConfirmed: number): User {
  return {
    id: 1,
    name: "Owner",
    email,
    password_hash: "x:y",
    slug: "owner",
    headline: null,
    location: null,
    linkedin_url: null,
    open_to_work: 0,
    email_confirmed: emailConfirmed,
    email_confirm_token: null,
    email_confirm_sent_at: null,
    session_epoch: 0,
    created_at: "2026-01-01",
  };
}

test("emailDomain extracts the domain, lowercased", () => {
  assert.equal(emailDomain("A@Corp.COM"), "corp.com");
  assert.equal(emailDomain("nope"), null);
});

test("employerOverlap requires the owner's own email to be confirmed", () => {
  // Same real domain, but owner unverified → no credit (the trust gate).
  assert.equal(employerOverlap("rev@corp.com", owner("me@corp.com", 0)), false);
  // Owner confirmed → credited.
  assert.equal(employerOverlap("rev@corp.com", owner("me@corp.com", 1)), true);
});

test("employerOverlap never credits free-mail domains", () => {
  assert.equal(
    employerOverlap("rev@gmail.com", owner("me@gmail.com", 1)),
    false,
  );
});

test("employerOverlap is false when domains differ", () => {
  assert.equal(
    employerOverlap("rev@other.com", owner("me@corp.com", 1)),
    false,
  );
});
