import { useState, useCallback } from "react";

// Known malicious or suspicious domain patterns
const SUSPICIOUS_PATTERNS = [
  /phishing/i,
  /malware/i,
  /scam/i,
  /hack/i,
  /crack/i,
  /warez/i,
  /torrent/i,
  /pirat/i,
];

// Known safe domains (whitelist)
const SAFE_DOMAINS = [
  "google.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "wikipedia.org",
  "github.com",
  "stackoverflow.com",
  "reddit.com",
  "linkedin.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "netflix.com",
  "spotify.com",
  "discord.com",
  "whatsapp.com",
  "telegram.org",
];

// High-risk TLDs
const RISKY_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click", ".link"];

export interface SafetyCheckResult {
  isSafe: boolean;
  riskLevel: "safe" | "low" | "medium" | "high";
  warnings: string[];
}

export const useSafeBrowsing = () => {
  const [checkedUrls, setCheckedUrls] = useState<Map<string, SafetyCheckResult>>(new Map());

  const checkUrl = useCallback((url: string): SafetyCheckResult => {
    // Return cached result if available
    if (checkedUrls.has(url)) {
      return checkedUrls.get(url)!;
    }

    const warnings: string[] = [];
    let riskLevel: "safe" | "low" | "medium" | "high" = "safe";

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const domain = hostname.replace(/^www\./, "");

      // Check if it's a known safe domain
      const isSafeDomain = SAFE_DOMAINS.some(
        (safe) => domain === safe || domain.endsWith(`.${safe}`)
      );

      if (isSafeDomain) {
        const result: SafetyCheckResult = { isSafe: true, riskLevel: "safe", warnings: [] };
        setCheckedUrls((prev) => new Map(prev).set(url, result));
        return result;
      }

      // Check for HTTP (not HTTPS)
      if (urlObj.protocol === "http:") {
        warnings.push("This site uses an insecure connection (HTTP)");
        riskLevel = "low";
      }

      // Check for suspicious patterns in URL
      const fullUrl = url.toLowerCase();
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(fullUrl)) {
          warnings.push("URL contains suspicious keywords");
          riskLevel = "high";
          break;
        }
      }

      // Check for risky TLDs
      const hasRiskyTld = RISKY_TLDS.some((tld) => hostname.endsWith(tld));
      if (hasRiskyTld) {
        warnings.push("This domain uses a high-risk top-level domain");
        riskLevel = riskLevel === "high" ? "high" : "medium";
      }

      // Check for IP address instead of domain
      const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      if (ipPattern.test(hostname)) {
        warnings.push("This site uses an IP address instead of a domain name");
        riskLevel = riskLevel === "high" ? "high" : "medium";
      }

      // Check for very long subdomains (often used in phishing)
      const subdomains = hostname.split(".");
      if (subdomains.length > 4) {
        warnings.push("This URL has an unusually complex subdomain structure");
        riskLevel = riskLevel === "high" ? "high" : "low";
      }

      // Check for lookalike domains
      const popularDomains = ["google", "facebook", "amazon", "paypal", "microsoft", "apple"];
      for (const popular of popularDomains) {
        if (hostname.includes(popular) && !hostname.includes(`${popular}.com`)) {
          // Possible lookalike
          if (!hostname.endsWith(`.${popular}.com`) && hostname !== `${popular}.com`) {
            warnings.push(`This domain may be impersonating ${popular}.com`);
            riskLevel = "high";
          }
        }
      }

      const result: SafetyCheckResult = {
        isSafe: warnings.length === 0,
        riskLevel,
        warnings,
      };

      setCheckedUrls((prev) => new Map(prev).set(url, result));
      return result;
    } catch {
      const result: SafetyCheckResult = {
        isSafe: false,
        riskLevel: "medium",
        warnings: ["Invalid or malformed URL"],
      };
      setCheckedUrls((prev) => new Map(prev).set(url, result));
      return result;
    }
  }, [checkedUrls]);

  return { checkUrl };
};
