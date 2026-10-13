"use client";

import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company-brand";
import { WELCOME_COOKIE } from "@/lib/company";

export function WelcomeMotion() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasCookie = document.cookie.split("; ").some((part) => part === `${WELCOME_COOKIE}=1`);
    if (!hasCookie) {
      return;
    }
    document.cookie = `${WELCOME_COOKIE}=; Max-Age=0; path=/`;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 1700);
    return () => window.clearTimeout(hide);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="welcome-overlay" role="status">
      <div className="welcome-mark">
        <CompanyLogo size={128} />
        <p>Energon</p>
      </div>
    </div>
  );
}
