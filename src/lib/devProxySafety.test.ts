import { describe, expect, it } from "vitest";
import { validateDevelopmentProxyTarget } from "./devProxySafety";

describe("development proxy rejects credential exposure", () => {
  it.each([
    ["http://localhost:3000","http://localhost:3000"],
    ["http://127.0.0.1:3000/","http://127.0.0.1:3000"],
    ["http://[::1]:3000","http://[::1]:3000"],
    ["https://localhost:3443","https://localhost:3443"],
  ])("permits local-only target %s", (target, expected) => {
    expect(validateDevelopmentProxyTarget(target)).toBe(expected);
  });

  it.each([
    "http://0.0.0.0:3000",
    "http://192.168.0.12:3000",
    "https://central.example.com",
    "http://localhost.example.com:3000",
    "http://[::2]:3000",
    "http://user:password@localhost:3000",
    "http://localhost:3000/other",
    "http://localhost:3000/?token=exposed",
    "http://localhost:3000/#fragment",
    "ftp://localhost:3000",
    "localhost:3000",
    "",
    "http://127.0.0.1:3000@attacker.example",
  ])("refuses unsafe or malformed proxy %s", target => {
    expect(() => validateDevelopmentProxyTarget(target)).toThrow(/Proxy/);
  });
});
