import { COMPANY } from "@/lib/company";

export function CompanyLogo({ size = 88 }: { size?: number }) {
  return (
    <img
      src={COMPANY.logoSrc}
      alt={COMPANY.name}
      width={size}
      height={size}
      className="rounded-full bg-black object-cover ring-1 ring-white/10"
    />
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.74.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.89-4.43 9.89-9.89C21.94 6.43 17.5 2 12.04 2Z"
      />
      <path
        fill="#fff"
        d="M17.47 14.38c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.39-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <defs>
        <radialGradient id="ig" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" />
    </svg>
  );
}

function ContactLink({
  href,
  label,
  detail,
  dark,
  children,
}: {
  href: string;
  label: string;
  detail: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  const surface = dark
    ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 no-underline transition ${surface}`}
    >
      {children}
      <span className="min-w-0 text-left">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className="block truncate text-sm font-semibold">{detail}</span>
      </span>
    </a>
  );
}

export function CompanyContacts({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-xs font-semibold tracking-wide ${dark ? "text-slate-300" : "text-slate-700"}`}>
        {COMPANY.name}
      </p>
      <ContactLink dark={dark} href={COMPANY.whatsappUrl} label="WhatsApp" detail={COMPANY.phoneDisplay}>
        <WhatsAppIcon />
      </ContactLink>
      <ContactLink dark={dark} href={COMPANY.instagramUrl} label="Instagram" detail={COMPANY.instagramHandle}>
        <InstagramIcon />
      </ContactLink>
    </div>
  );
}

export function AuthBrand({ dark = true }: { dark?: boolean }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-4 text-center">
      <CompanyLogo size={128} />
      <div className="w-full max-w-sm">
        <CompanyContacts dark={dark} />
      </div>
    </div>
  );
}
