import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WAYS_PHONE_DISPLAY, WAYS_PHONE_RAW } from "@/lib/constants";

export interface BusinessSettings {
  legal_name: string;
  site_name: string;
  phone: string;
  phone_tel: string;
  website: string;
  footer_address: string;
  support_email: string;
  whatsapp_number: string;
  tagline: string;
  copyright_year: string;
}

const DEFAULTS: BusinessSettings = {
  legal_name: "WAYS® Materials LLC",
  site_name: "River Sand",
  phone: WAYS_PHONE_DISPLAY,
  phone_tel: `+${WAYS_PHONE_RAW}`,
  website: "riversand.net",
  footer_address: "",
  support_email: "orders@riversand.net",
  whatsapp_number: "",
  tagline: "Real Sand. Real People.",
  copyright_year: "2026",
};

const SETTINGS_KEYS = [
  "legal_name", "site_name", "phone", "website",
  "footer_address", "support_email", "whatsapp_number",
  "tagline", "copyright_year",
];

// Module-level cache so we don't refetch on every mount
let cachedSettings: BusinessSettings | null = null;
let fetchPromise: Promise<BusinessSettings> | null = null;

function phoneToTel(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `+1${digits.slice(-10)}` : `+${digits}`;
}

async function loadSettings(): Promise<BusinessSettings> {
  const { data } = await supabase
    .from("global_settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS);

  const map: Record<string, string> = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });

  return {
    legal_name: map.legal_name || DEFAULTS.legal_name,
    site_name: map.site_name || DEFAULTS.site_name,
    phone: map.phone || DEFAULTS.phone,
    phone_tel: map.phone ? phoneToTel(map.phone) : DEFAULTS.phone_tel,
    website: map.website?.replace(/^https?:\/\//, "") || DEFAULTS.website,
    footer_address: map.footer_address || DEFAULTS.footer_address,
    support_email: map.support_email || DEFAULTS.support_email,
    whatsapp_number: map.whatsapp_number || DEFAULTS.whatsapp_number,
    tagline: map.tagline || DEFAULTS.tagline,
    copyright_year: map.copyright_year || DEFAULTS.copyright_year,
  };
}

export function useBusinessSettings(): BusinessSettings {
  const [settings, setSettings] = useState<BusinessSettings>(cachedSettings || DEFAULTS);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = loadSettings().then((s) => {
        cachedSettings = s;
        return s;
      });
    }
    fetchPromise.then(setSettings);
  }, []);

  return settings;
}
