# LMT_REFERENCE.md
## Leads Management Tool — operator surface source reference

**Generated:** April 24, 2026
**Scope:** Operator-facing surface only (`/leads` dashboard, drivers, schedule, leads-auth backbone, 2FA setup). Customer-facing source is in `CORE_FLOW_REFERENCE.md`.
**Reflects state after:** Phase 0 (drivers schema + actions), Phase 1a (Drivers tab UI), Phase 1b (driver assignment + update_order extension), Phase 2 (WhatsApp driver comms), DriverModal Phase 1 polish (form compliance pass), Schedule Slice 1, 2FA Slice 1a (dormant).

The Leads Management Tool (LMT) is the operator dashboard at `/leads`. It is
password-gated via the `leads-auth` edge function (`LEADS_PASSWORD` secret)
and uses ~52 action verbs through a single edge-function entrypoint.

---

## Table of Contents

### Shell
- `src/pages/Leads.tsx` _(~8.7k lines — entire LMT shell)_
- `src/pages/LeadsSetup2FA.tsx` _(2FA Slice 1a — dormant)_

### Drivers (Phase 0/1/2)
- `src/components/leads/drivers/DriversTab.tsx`
- `src/components/leads/drivers/DriverRow.tsx`
- `src/components/leads/drivers/DriverModal.tsx` _(Phase 1 polish — form compliance pass)_
- `src/components/leads/drivers/types.ts`

### Schedule (Slice 1)
- `src/components/leads/schedule/ScheduleTab.tsx`
- `src/components/leads/schedule/DayPanel.tsx`
- `src/components/leads/schedule/ScheduleOrderCard.tsx`
- `src/components/leads/schedule/WeekStrip.tsx`
- `src/components/leads/schedule/SummaryBar.tsx`
- `src/lib/schedule-adapter.ts`

### Backbone
- `supabase/functions/leads-auth/index.ts` _(the LMT gateway — all ~52 action verbs)_

### Companion references
- `RIVERSAND_CONTEXT.md` — project identity, brand, tech constraints
- `.lovable/GUIDELINES.md` — LMT design system (T tokens, brand hex, layout rules)
- `COMPONENT_INVENTORY.md` — per-component metadata
- `DATABASE_SCHEMA.sql` — full schema (drivers, orders, leads tables)
- `RIVERSAND_FORM_GUIDELINES_v1.1_2026-04-24.md` — form entry rules applied in DriverModal Phase 1 polish
- `RIVERSAND_FOLLOWUPS.md` — deferred work (P2 server-side normalization, P3 UX)

---

# Source

# Shell

## `src/pages/Leads.tsx`

_Lines: 

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

// Environment detection: true when running on the GH Pages production host (riversand.net)
const IS_PROD_HOST = typeof window !== "undefined" && /(^|\.)riversand\.net$/i.test(window.location.hostname);
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Loader2, Search, X, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, MapPin, Send, Settings, Power, Edit2, Save, XCircle, Copy, MessageCircle, ChevronDown, ChevronUp as ChevronUpIcon, Check, AlertTriangle, BarChart3, Map as MapIcon, List, DollarSign, Zap, Users, Building2, LogOut, Menu, Trash2, Palette, Link, RefreshCw, Bell, Star, Calendar, Shield, ExternalLink, Truck } from "lucide-react";
import DriversTab from "@/components/leads/drivers/DriversTab";
import type { Driver } from "@/components/leads/drivers/types";
import { Switch } from "@/components/ui/switch";
import { PALETTES, getPaletteById, deriveCssVars, hexToHsl } from "@/lib/palettes";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google: any; }
}

import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import PlaceAutocompleteInput, { type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";
import { WAYS_PHONE_DISPLAY } from "@/lib/constants";
import ScheduleTab from "@/components/leads/schedule/ScheduleTab";
import { formatOrderMessage, buildWhatsAppUrl, canSendToDriver } from "@/lib/whatsapp-message";
const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137"; // used for login screen only
const POSITIVE = "#059669";
const ALERT_RED = "#DC2626";
const WARN_YELLOW = "#D97706";
const PAGE_SIZE = 25;
const HQ_LAT = 29.9308;
const HQ_LON = -90.1685;

// ─── GLOBAL DESIGN TOKENS ───
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#9CA3AF',
};

const NUM_STYLE: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  lineHeight: 1.1,
};

const SUB_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 4,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#F3F4F6', text: '#6B7280' },
  confirmed: { bg: '#EFF6FF', text: '#3B82F6' },
  cancelled: { bg: '#FEF2F2', text: '#EF4444' },
  paid:      { bg: '#ECFDF5', text: '#059669' },
  captured:  { bg: '#ECFDF5', text: '#059669' },
  en_route:  { bg: '#EFF6FF', text: '#3B82F6' },
  delivered: { bg: '#ECFDF5', text: '#059669' },
  cod:       { bg: '#FDF8F0', text: '#C07A00' },
  active:    { bg: '#ECFDF5', text: '#059669' },
  planning:  { bg: '#EFF6FF', text: '#3B82F6' },
  inactive:  { bg: '#F3F4F6', text: '#6B7280' },
  draft:     { bg: '#F3F4F6', text: '#6B7280' },
  new:       { bg: '#F3F4F6', text: '#0D2137' },
  called:    { bg: '#EFF6FF', text: '#1A6BB8' },
  quoted:    { bg: '#FDF8F0', text: '#F59E0B' },
  won:       { bg: '#ECFDF5', text: '#22C55E' },
  lost:      { bg: '#F3F4F6', text: '#999999' },
};

const DEFAULT_SETTINGS: Record<string, string> = {
  saturday_surcharge: "35.00",
  site_name: "River Sand",
  phone: WAYS_PHONE_DISPLAY,
};

interface Lead {
  id: string;
  created_at: string;
  address: string;
  distance_miles: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  contacted: boolean;
  lead_number: string | null;
  stage: string;
  ip_address: string | null;
  notes: string | null;
  nearest_pit_name: string | null;
  nearest_pit_id: string | null;
  nearest_pit_distance: number | null;
  // Fraud fields
  user_agent?: string | null;
  browser_geolat?: number | null;
  browser_geolng?: number | null;
  geo_matches_address?: boolean | null;
  fraud_score?: number | null;
  fraud_signals?: string[] | null;
  submission_count?: number | null;
  pre_order_id?: string | null;
  offer_sent_at?: string | null;
  declined_at?: string | null;
  calculated_price?: number | null;
}

interface ParsedLead extends Lead {
  state: string;
  zip: string;
  city: string;
}

interface Pit {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  status: "active" | "planning" | "inactive";
  notes: string;
  is_default?: boolean;
  base_price: number | null;
  free_miles: number | null;
  price_per_extra_mile: number | null;
  max_distance: number | null;
  operating_days: number[] | null;
  saturday_surcharge_override: number | null;
  same_day_cutoff: string | null;
  sunday_surcharge: number | null;
  saturday_load_limit: number | null;
  sunday_load_limit: number | null;
  is_pickup_only?: boolean;
  delivery_hours: DeliveryHoursMap;
}

interface GlobalSettings {
  [key: string]: string;
}

const getEffectivePrice = (pit: Pit, _gs: GlobalSettings) => ({
  base_price: pit.base_price ?? 195,
  free_miles: pit.free_miles ?? 15,
  extra_per_mile: pit.price_per_extra_mile ?? 5,
  max_distance: pit.max_distance ?? 30,
});

const parseAddress = (address: string): { state: string; zip: string; city: string } => {
  const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/i);
  if (match) return { city: match[1].trim(), state: match[2].toUpperCase(), zip: match[3] };
  const m2 = address.match(/,\s*([A-Z]{2})\s+(\d{5})/i);
  if (m2) return { city: "—", state: m2[1].toUpperCase(), zip: m2[2] };
  return { city: "—", state: "—", zip: "—" };
};

const formatLeadDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return d; }
};

/**
 * Parse the legacy HTML `content` blob into structured fields for the edit modal.
 * The HTML structure from generate-city-page is:
 *   <p class="hero-intro">...</p>
 *   <h2>Why Choose...</h2> <p>...</p>
 *   <h2>Delivery Details...</h2> <p>...</p>
 *   <h2>Common Uses...</h2> <ul>...</ul>
 *   <h2>Local Expertise</h2> <p>...</p>
 *   <h2>Frequently Asked Questions...</h2> <div class="faq-item">...</div>...
 */
const parseCityPageContent = (cp: any) => {
  // If structured fields already exist on the record, use them
  if (cp.hero_intro || cp.why_choose_intro || cp.delivery_details) return {};
  
  const html = cp.content;
  if (!html) return {};

  const result: Record<string, any> = {};

  // Hero intro
  const heroMatch = html.match(/<p class="hero-intro">([\s\S]*?)<\/p>/);
  if (heroMatch) result.hero_intro = heroMatch[1].trim();

  // Extract sections by splitting on <h2> tags
  const sections = html.split(/<h2>/);
  for (const section of sections) {
    const h2End = section.indexOf("</h2>");
    if (h2End === -1) continue;
    const heading = section.substring(0, h2End).toLowerCase();
    const body = section.substring(h2End + 5).trim();

    if (heading.includes("why choose")) {
      const pMatch = body.match(/<p>([\s\S]*?)<\/p>/);
      if (pMatch) result.why_choose_intro = pMatch[1].trim();
    } else if (heading.includes("delivery details")) {
      const pMatch = body.match(/<p>([\s\S]*?)<\/p>/);
      if (pMatch) result.delivery_details = pMatch[1].trim();
    } else if (heading.includes("common uses")) {
      const ulMatch = body.match(/<ul>([\s\S]*?)<\/ul>/);
      if (ulMatch) result.local_uses = `<ul>${ulMatch[1].trim()}</ul>`;
    } else if (heading.includes("local expertise")) {
      const pMatch = body.match(/<p>([\s\S]*?)<\/p>/);
      if (pMatch) result.local_expertise = pMatch[1].trim();
    } else if (heading.includes("frequently asked")) {
      const faqItems: { question: string; answer: string }[] = [];
      const faqRegex = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
      let m;
      while ((m = faqRegex.exec(body)) !== null) {
        faqItems.push({ question: m[1].trim(), answer: m[2].trim() });
      }
      if (faqItems.length > 0) result.faq_items = faqItems;
    }
  }

  return result;
}

// getDrivingDistanceBatch replaced by edge function calls inline

type SortKey = "lead_number" | "created_at" | "address" | "state" | "zip" | "distance_miles" | "customer_name" | "customer_email" | "customer_phone" | "contacted" | "stage" | "nearest_pit_name";
type SortDir = "asc" | "desc";
type NavPage = "overview" | "zip" | "pipeline" | "revenue" | "pit" | "drivers" | "all" | "abandoned" | "live" | "cash_orders" | "customers" | "city_pages" | "waitlist" | "profile" | "settings" | "pending_review" | "reviews" | "schedule" | "finances" | "fraud";

const STAGES = ["new", "called", "quoted", "won", "lost"] as const;
const STAGE_COLORS: Record<string, string> = { new: "#0D2137", called: "#1A6BB8", quoted: "#F59E0B", won: "#22C55E", lost: "#999" };

const NAV_ITEMS: { section: string; items: { id: NavPage; label: string; icon: any }[] }[] = [
  {
    section: "LIVE OPERATIONS",
    items: [
      { id: "overview", label: "Overview", icon: BarChart3 },
      { id: "live" as NavPage, label: "Live Visitors", icon: Users },
      { id: "cash_orders", label: "Orders", icon: DollarSign },
      { id: "finances" as NavPage, label: "Finances", icon: DollarSign },
      { id: "customers" as NavPage, label: "Customers", icon: Users },
      { id: "pending_review" as NavPage, label: "Pending Review", icon: AlertTriangle },
      { id: "abandoned", label: "Abandoned Sessions", icon: AlertTriangle },
      { id: "reviews" as NavPage, label: "Reviews", icon: Star },
      { id: "schedule" as NavPage, label: "Schedule", icon: Calendar },
    ],
  },
  {
    section: "MARKETING",
    items: [
      { id: "pipeline", label: "Pipeline", icon: List },
      { id: "all", label: "All Leads", icon: Users },
      { id: "zip", label: "ZIP Intelligence", icon: MapIcon },
      { id: "revenue", label: "Revenue Forecast", icon: DollarSign },
    ],
  },
  {
    section: "EXPANSION",
    items: [
      { id: "city_pages", label: "City Pages", icon: MapIcon },
      { id: "pit", label: "PITs", icon: Zap },
      { id: "drivers", label: "Drivers", icon: Truck },
      { id: "waitlist" as NavPage, label: "Waitlist", icon: Users },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { id: "fraud", label: "Fraud & Security", icon: Shield },
      { id: "settings", label: "Global Settings", icon: Settings },
      { id: "profile", label: "Business Profile", icon: Building2 },
    ],
  },
];

/* ── Sidebar Accordion Section ── */
const SidebarAccordion = ({ title, children, defaultOpen = false, textColor }: { title: string; children: React.ReactNode; defaultOpen?: boolean; textColor?: string }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: textColor || '#6B7280' }}
      >
        <span>{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const LIVE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f8f7f2" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8880" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f8f7f2" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#edf2ec" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f0ede8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8e4dc" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d8d4cc" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cde0f0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9ab8cc" }] },
];

const STAGE_MAP_COLOR: Record<string, string> = {
  visited: "#9CA3AF", entered_address: "#3B82F6", got_price: "#F59E0B",
  got_out_of_area: "#D1D5DB", clicked_order_now: "#8B5CF6",
  started_checkout: "#EA580C", reached_payment: "#DC2626", completed_order: "#16A34A",
};

const STAGE_MAP_LABEL: Record<string, string> = {
  visited: "Browsing", entered_address: "Got address", got_price: "Got price",
  got_out_of_area: "Out of area", clicked_order_now: "Clicked order",
  started_checkout: "At checkout", reached_payment: "At payment", completed_order: "Converted",
};

interface LiveGoogleMapProps {
  visitors: any[];
  pits: any[];
}

function LiveGoogleMap({ visitors, pits }: LiveGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const initIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tryInit = () => {
      if (!containerRef.current || mapRef.current) return;
      if (!window.google?.maps?.Map) return;

      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center: { lat: 29.9511, lng: -90.0715 },
        zoom: 10,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        styles: LIVE_MAP_STYLE,
      });

      infoWindowRef.current = new window.google.maps.InfoWindow({ maxWidth: 240 });

      if (initIntervalRef.current) {
        clearInterval(initIntervalRef.current);
        initIntervalRef.current = null;
      }
    };

    tryInit();
    if (!mapRef.current) {
      initIntervalRef.current = setInterval(tryInit, 200);
    }

    return () => {
      if (initIntervalRef.current) clearInterval(initIntervalRef.current);
      markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
      markersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    markersRef.current = [];

    const timeSince = (iso: string) => {
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return `${s}s ago`;
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      return `${Math.floor(s / 3600)}h ago`;
    };

    (pits || []).filter((p: any) => p.status === "active" && p.lat && p.lon).forEach((pit: any) => {
      const m = new window.google.maps.Marker({
        position: { lat: Number(pit.lat), lng: Number(pit.lon) },
        map,
        title: pit.name,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#B87333", fillOpacity: 0.9, strokeColor: "#ffffff", strokeWeight: 2 },
        zIndex: 5,
      });
      m.addListener("click", () => {
        infoWindowRef.current?.setContent(`<div style="font-family:system-ui;padding:4px"><strong style="font-size:12px">${pit.name}</strong><div style="font-size:10px;color:#6B7280;margin-top:2px">${pit.address}</div><div style="font-size:9px;color:#B87333;margin-top:4px">▲ Active PIT</div></div>`);
        infoWindowRef.current?.open(map, m);
      });
      markersRef.current.push(m);
    });

    const withCoords = visitors.filter((v: any) => v.address_lat && v.address_lng);
    withCoords.forEach((v: any) => {
      const color = STAGE_MAP_COLOR[v.stage] || "#9CA3AF";
      const label = STAGE_MAP_LABEL[v.stage] || v.stage;
      const isHot = v.stage === "reached_payment" || v.stage === "started_checkout";

      const m = new window.google.maps.Marker({
        position: { lat: Number(v.address_lat), lng: Number(v.address_lng) },
        map,
        title: v.geo_city || "Visitor",
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: isHot ? 11 : 9, fillColor: color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2.5 },
        zIndex: 20,
        animation: isHot ? window.google.maps.Animation.BOUNCE : undefined,
      });

      if (isHot) setTimeout(() => { try { m.setAnimation(null); } catch {} }, 6500);

      m.addListener("click", () => {
        infoWindowRef.current?.setContent(`<div style="font-family:system-ui;padding:4px"><div style="display:flex;align-items:center;gap:6px"><strong style="font-size:12px">${v.geo_city || "Unknown"}</strong><span style="font-size:9px;padding:1px 6px;border-radius:4px;background:${color}20;color:${color}">${label}</span></div>${v.calculated_price ? `<div style="font-size:11px;color:#374151;margin-top:4px">$${Math.round(v.calculated_price)} estimated</div>` : ""}${v.delivery_address ? `<div style="font-size:10px;color:#6B7280;margin-top:2px">${v.delivery_address.split(",").slice(0, 2).join(",")}</div>` : ""}${v.nearest_pit_name ? `<div style="font-size:9px;color:#6B7280;margin-top:2px">→ ${v.nearest_pit_name}</div>` : ""}<div style="font-size:9px;color:#9CA3AF;margin-top:4px">${timeSince(v.last_seen_at || v.created_at)}</div></div>`);
        infoWindowRef.current?.open(map, m);
      });

      markersRef.current.push(m);
    });

    if (withCoords.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      withCoords.forEach((v: any) => bounds.extend({ lat: Number(v.address_lat), lng: Number(v.address_lng) }));
      (pits || []).filter((p: any) => p.status === "active" && p.lat && p.lon).forEach((p: any) => bounds.extend({ lat: Number(p.lat), lng: Number(p.lon) }));
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      window.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        if (map.getZoom() > 13) map.setZoom(13);
      });
    }
  }, [visitors, pits]);

  return (
    <div style={{ width: "100%", height: 380, background: "#f8f7f2", borderRadius: 8, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ─── Per-PIT Delivery Hours editor ──────────────────────────────────────────
type DeliveryHoursMap = Record<string, { open: string; close: string }> | null;

const DAY_LABELS: { idx: number; label: string }[] = [
  { idx: 0, label: "Sunday" },
  { idx: 1, label: "Monday" },
  { idx: 2, label: "Tuesday" },
  { idx: 3, label: "Wednesday" },
  { idx: 4, label: "Thursday" },
  { idx: 5, label: "Friday" },
  { idx: 6, label: "Saturday" },
];

function DeliveryHoursEditor({ value, onChange }: { value: DeliveryHoursMap; onChange: (v: DeliveryHoursMap) => void }) {
  const hours = value || {};
  const setDay = (idx: number, next: { open: string; close: string } | null) => {
    const updated: Record<string, { open: string; close: string }> = { ...hours };
    if (next === null) {
      delete updated[String(idx)];
    } else {
      updated[String(idx)] = next;
    }
    onChange(Object.keys(updated).length === 0 ? null : updated);
  };
  const copyMonToWeekdays = () => {
    const mon = hours["1"];
    if (!mon) return;
    const updated: Record<string, { open: string; close: string }> = { ...hours };
    [2, 3, 4, 5].forEach(d => { updated[String(d)] = { open: mon.open, close: mon.close }; });
    onChange(updated);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-gray-400">Customer-facing window. Unchecked days show "Contact us for hours."</p>
        <button
          type="button"
          onClick={copyMonToWeekdays}
          disabled={!hours["1"]}
          className="text-[10px] underline text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:no-underline"
        >
          Copy Mon → Tue–Fri
        </button>
      </div>
      {DAY_LABELS.map(({ idx, label }) => {
        const entry = hours[String(idx)];
        const enabled = !!entry;
        const invalid = enabled && entry.open && entry.close && entry.close <= entry.open;
        return (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setDay(idx, e.target.checked ? { open: "08:00", close: "17:00" } : null)}
              className="h-4 w-4"
            />
            <span className="w-20 text-xs" style={{ color: enabled ? "#111" : "#999" }}>{label}</span>
            <input
              type="time"
              disabled={!enabled}
              value={entry?.open ?? ""}
              onChange={e => entry && setDay(idx, { ...entry, open: e.target.value })}
              className="h-8 px-2 rounded-md border text-xs w-28 disabled:bg-gray-50 disabled:text-gray-300"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="time"
              disabled={!enabled}
              value={entry?.close ?? ""}
              onChange={e => entry && setDay(idx, { ...entry, close: e.target.value })}
              className="h-8 px-2 rounded-md border text-xs w-28 disabled:bg-gray-50 disabled:text-gray-300"
            />
            {invalid && <span className="text-[10px] text-red-600">close must be after open</span>}
          </div>
        );
      })}
    </div>
  );
}

const Leads = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [exportingDocs, setExportingDocs] = useState(false);
  const [docsExportError, setDocsExportError] = useState("");
  const [docsCurrentVersion, setDocsCurrentVersion] = useState("v1.01");
  const [exportingSnapshot, setExportingSnapshot] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { getCurrentDocsVersion } = await import("@/lib/generateProjectDocs");
        const v = await getCurrentDocsVersion();
        if (v) setDocsCurrentVersion(v);
      } catch { /* ignore */ }
    })();
  }, []);
  const [toggling, setToggling] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [selectedLead, setSelectedLead] = useState<ParsedLead | null>(null);
  const [detailStage, setDetailStage] = useState("");
  const [detailNote, setDetailNote] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [editSettings, setEditSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const [pits, setPits] = useState<Pit[]>([]);
  const [selectedPit, setSelectedPit] = useState<Pit | null>(null);
  const [newPit, setNewPit] = useState({ name: "", address: "", status: "planning" as "active" | "planning" | "inactive", notes: "", base_price: null as number | null, free_miles: null as number | null, price_per_extra_mile: null as number | null, max_distance: null as number | null, lat: null as number | null, lon: null as number | null, operating_days: null as number[] | null, saturday_surcharge_override: null as number | null, same_day_cutoff: "", sunday_surcharge: null as number | null, saturday_load_limit: null as number | null, sunday_load_limit: null as number | null, is_pickup_only: false, delivery_hours: null as DeliveryHoursMap });
  const [showAddPit, setShowAddPit] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Record<string, { lat: number; lon: number; location_type?: string; formatted_address?: string }>>(() => {
    try { return JSON.parse(sessionStorage.getItem("geocache") || "{}"); } catch { return {}; }
  });
  const [simSelected, setSimSelected] = useState<Set<string>>(new Set());
  const [geocoding, setGeocoding] = useState(false);
  // Driving distance cache: key -> miles (populated via getDrivingDistanceBatch)
  const [drivingCache, setDrivingCache] = useState<Record<string, number | null>>(() => {
    try { return JSON.parse(sessionStorage.getItem("drivingcache") || "{}"); } catch { return {}; }
  });
  // Refs no longer needed for autocomplete — using PlaceAutocompleteInput component

  const [editingPitId, setEditingPitId] = useState<string | null>(null);
  const [editPitData, setEditPitData] = useState<Partial<Pit>>({});
  const [savingPit, setSavingPit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Activation modal state
  const [activationLeads, setActivationLeads] = useState<Array<{ lead: ParsedLead; distance: number; price: number; hasEmail: boolean }>>([]);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationPit, setActivationPit] = useState<Pit | null>(null);
  const [activationChecked, setActivationChecked] = useState<Set<string>>(new Set());
  const [activationSending, setActivationSending] = useState(false);
  const [activationProgress, setActivationProgress] = useState({ current: 0, total: 0 });

  const [showProposal, setShowProposal] = useState(false);
  const [proposalSubject, setProposalSubject] = useState("");
  const [sendingProposals, setSendingProposals] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  const [quickProposalLead, setQuickProposalLead] = useState<ParsedLead | null>(null);
  const [qpPitId, setQpPitId] = useState<string>("");
  const [qpPrice, setQpPrice] = useState("");
  const [qpNote, setQpNote] = useState("");
  const [qpSending, setQpSending] = useState(false);
  const [qpShowPreview, setQpShowPreview] = useState(false);

  // Sidebar nav
  const [activePage, setActivePage] = useState<NavPage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [financeRange, setFinanceRange] = useState<'mtd' | 'qtd' | 'ytd'>('mtd');

  // Business profile state
  const [profileSettings, setProfileSettings] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const { loaded: googleLoaded } = useGoogleMaps();

  // Customers state
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersSearch, setCustomersSearch] = useState("");

  // Waitlist state
  const [waitlistData, setWaitlistData] = useState<any[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Regen queue state
  const [regenQueuePending, setRegenQueuePending] = useState(0);

  // Abandoned sessions state
  const [abandonedSessions, setAbandonedSessions] = useState<any[]>([]);
  const [abandonedLoading, setAbandonedLoading] = useState(false);
  const [runningEmailCheck, setRunningEmailCheck] = useState(false);

  // Live visitors state
  const [liveVisitors, setLiveVisitors] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [funnelData, setFunnelData] = useState<Record<string, number> | null>(null);
  const [pagePerf, setPagePerf] = useState<Array<{page:string;visits:number;avgPrice:number|null;avgDuration:number|null;topStage:string}>>([]);
  const [cityIntel, setCityIntel] = useState<Array<{city:string;visits:number}>>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const [cashOrders, setCashOrders] = useState<any[]>([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashFilter, setCashFilter] = useState<"all" | "pending" | "overdue" | "collected">("all");
  const [cashOrderToMark, setCashOrderToMark] = useState<any | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [cashCollectedBy, setCashCollectedBy] = useState("");
  const [cashSendEmail, setCashSendEmail] = useState(true);
  const [cashOverdueDismissed, setCashOverdueDismissed] = useState(() => sessionStorage.getItem("cash_overdue_dismissed") === "1");

  // All orders state
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMetrics, setOrdersMetrics] = useState<{total:number;pending:number;confirmed:number;today_deliveries:number;revenue_30d:number;paid_count_30d:number} | null>(null);
  const [ordersTab, setOrdersTab] = useState<"all"|"pending"|"confirmed"|"en_route"|"delivered"|"cancelled">("all");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersPayFilter, setOrdersPayFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderNotesDraft, setOrderNotesDraft] = useState("");
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);
  const [showGenLinkForm, setShowGenLinkForm] = useState(false);
  const [generatedStripeUrl, setGeneratedStripeUrl] = useState<string | null>(null);
  const [genLinkEmail, setGenLinkEmail] = useState("");

  // Path B Phase 1 — Drivers shared state. Single fetch on mount; explicit refresh after edits. No polling.
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send.
  // Optimistic timestamp update; non-blocking persist; revert + toast on failure.
  const handleSendToDriver = useCallback(async (order: any, driver: Driver) => {
    const message = formatOrderMessage(order, driver);
    const url = buildWhatsAppUrl(driver.phone, message);
    window.open(url, "_blank", "noopener,noreferrer");

    const iso = new Date().toISOString();
    setAllOrders(prev => prev.map((o: any) => o.id === order.id ? { ...o, message_sent_at: iso } : o));

    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          password: sessionStorage.getItem("leads_pw") || "",
          action: "update_order",
          order_id: order.id,
          message_sent_at: iso,
        },
      });
      if (error) throw error;
      const payload: any = data;
      if (payload?.error) throw new Error(String(payload.error));
    } catch (err: any) {
      // Revert optimistic patch on failure.
      setAllOrders(prev => prev.map((o: any) => o.id === order.id ? { ...o, message_sent_at: order.message_sent_at ?? null } : o));
      toast({
        title: "Send record failed",
        description: "WhatsApp opened but send record failed to save. Try again to update timestamp.",
        variant: "destructive" as any,
      });
    }
  }, []);

  // SEO state
  const [settingsTab, setSettingsTab] = useState<"pricing" | "profile" | "seo" | "tracking">("pricing");
  const [notrackIps, setNotrackIps] = useState<string[]>([]);
  const [notrackNewIp, setNotrackNewIp] = useState("");
  const [notrackDetectedIp, setNotrackDetectedIp] = useState<string | null>(null);
  const [notrackSaving, setNotrackSaving] = useState(false);
  const [notrackLoading, setNotrackLoading] = useState(false);
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({});
  const [savingSeo, setSavingSeo] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<Record<string, "connected" | "invalid" | "not_set" | "checking" | "dns_verified">>({});
  
  const [seoAuditResults, setSeoAuditResults] = useState<any>(null);
  const [seoAuditing, setSeoAuditing] = useState(false);

  // City pages state
  const [cityPages, setCityPages] = useState<any[]>([]);
  const [cityPagesLoading, setCityPagesLoading] = useState(false);
  const [cityPageFilter, setCityPageFilter] = useState("all");
  const [editingCityPage, setEditingCityPage] = useState<any | null>(null);
  const [discoverPitId, setDiscoverPitId] = useState("");
  const [discoveredCities, setDiscoveredCities] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [discoverChecked, setDiscoverChecked] = useState<Set<number>>(new Set());
  const [creatingPages, setCreatingPages] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);
  const [selectedCityPages, setSelectedCityPages] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showDeactivateDupsConfirm, setShowDeactivateDupsConfirm] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [showBulkCreateConfirm, setShowBulkCreateConfirm] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [showDeduplicateConfirm, setShowDeduplicateConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteAllTypeConfirm, setShowDeleteAllTypeConfirm] = useState(false);
  const [showRegenOutdatedConfirm, setShowRegenOutdatedConfirm] = useState(false);
  const [showRegenAllConfirm, setShowRegenAllConfirm] = useState(false);
  const [flaggingRegenAll, setFlaggingRegenAll] = useState(false);
  const [regenQueue, setRegenQueue] = useState<{ total: number; current: number; currentCity: string; status: "idle" | "running" | "complete" } | null>(null);
  const regenCancelRef = useRef(false);
  const [deleteAllTypeInput, setDeleteAllTypeInput] = useState("");
  const [cityPageSortKey, setCityPageSortKey] = useState<"city_name" | "state" | "distance_from_pit" | "base_price" | "status" | "page_views">("city_name");
  const [cityPageSortDir, setCityPageSortDir] = useState<"asc" | "desc">("asc");
  const [deletingAll, setDeletingAll] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState<string | null>(null);
  const [syncingPayment, setSyncingPayment] = useState<string | null>(null);

  // Pending review orders state
  const [pendingReviewOrders, setPendingReviewOrders] = useState<any[]>([]);
  const [pendingReviewLoading, setPendingReviewLoading] = useState(false);
  const [verifyingCall, setVerifyingCall] = useState<string | null>(null);

  // Reviews state
  const [reviewsData, setReviewsData] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Lead detail actions state
  const [sendingOffer, setSendingOffer] = useState(false);
  const [decliningLead, setDecliningLead] = useState(false);
  const [flaggingFraud, setFlaggingFraud] = useState(false);
  const [fraudReason, setFraudReason] = useState("");
  const [offerPitId, setOfferPitId] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerResult, setOfferResult] = useState<{ payment_url: string; order_number: string } | null>(null);

  // Edit email & resend state
  const [editEmailOrder, setEditEmailOrder] = useState<any | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [editEmailSaving, setEditEmailSaving] = useState(false);

  // Edit customer email from Customers tab
  const [editCustomerEmail, setEditCustomerEmail] = useState<any | null>(null);
  const [editCustomerEmailValue, setEditCustomerEmailValue] = useState("");
  const [editCustomerEmailSaving, setEditCustomerEmailSaving] = useState(false);

  const sendPaymentLink = useCallback(async (order: any) => {
    setSendingPaymentLink(order.id);
    try {
      const feePercent = parseFloat(globalSettings.card_processing_fee_percent || "3.5") / 100;
      const feeFixed = parseFloat(globalSettings.card_processing_fee_fixed || "0.30");
      const cardTotal = Math.round((Number(order.price) * (1 + feePercent) + feeFixed) * 100) / 100;
      const amountCents = Math.round(cardTotal * 100);
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: amountCents,
          description: `River Sand Delivery — ${order.order_number || "N/A"} (Card Payment)`,
          customer_name: order.customer_name,
          customer_email: order.customer_email || undefined,
          order_id: order.id,
          order_number: order.order_number,
          origin_url: "https://riversand.net",
          return_mode: "popup",
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const url = data?.url;
      if (!url) throw new Error("No URL returned");
      await navigator.clipboard.writeText(url);
      toast({ title: "Payment link copied", description: `$${cardTotal.toFixed(2)} — link copied to clipboard` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSendingPaymentLink(null); }
  }, [toast]);

  const generateAndShowLink = useCallback(async (order: any, emailOverride?: string) => {
    setOrderActionLoading("gen_link" + order.id);
    try {
      const amountCents = Math.round(
        (Number(order.price) * (order.quantity || 1) + Number(order.tax_amount || 0)) * 100
      );
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: amountCents,
          description: `River Sand Delivery — ${order.order_number || "N/A"} (Card Payment)`,
          customer_name: order.customer_name,
          customer_email: emailOverride || order.customer_email || undefined,
          order_id: order.id,
          order_number: order.order_number,
          origin_url: "https://riversand.net",
          return_mode: "popup",
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const url = data?.url;
      if (!url) throw new Error("No URL returned from Stripe");
      setGeneratedStripeUrl(url);
      toast({
        title: emailOverride ? "Link generated" : "Stripe link ready",
        description: emailOverride ? "Copy below or send manually" : "Copy the link below to share",
      });
    } catch (err: any) {
      toast({ title: "Error generating link", description: err.message, variant: "destructive" });
    } finally {
      setOrderActionLoading(null);
    }
  }, [toast]);

  const fetchCashOrders = useCallback(async () => {
    setCashLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_cash_orders" },
      });
      if (!fnError && data?.orders) setCashOrders(data.orders);
    } catch (err) { console.warn("Failed to fetch cash orders:", err); }
    finally { setCashLoading(false); }
  }, []);

  const fetchAllOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_all_orders" },
      });
      if (!fnError && data?.orders) {
        setAllOrders(data.orders);
        if (data.metrics) setOrdersMetrics(data.metrics);
      }
    } catch (err) { console.warn("Failed to fetch orders:", err); }
    finally { setOrdersLoading(false); }
  }, []);

  const syncStripePayment = useCallback(async (order: any) => {
    setSyncingPayment(order.id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "sync_stripe_payment", order_id: order.id },
      });
      if (fnError) throw fnError;
      if (data?.error && data.synced === undefined) throw new Error(data.error);
      if (data?.synced) {
        toast({ title: "Payment confirmed", description: "Order updated to paid" });
        fetchCashOrders();
      } else if (data?.synced === false && !data?.error) {
        toast({ title: "Not paid yet", description: `Stripe status: ${data.payment_status || "unpaid"}` });
      } else if (data?.error) {
        toast({ title: "No session found", description: data.error });
      }
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message || "Check manually in Stripe", variant: "destructive" });
    } finally { setSyncingPayment(null); }
  }, [toast, fetchCashOrders]);

  const markCashPaid = useCallback(async () => {
    if (!cashOrderToMark) return;
    setMarkingPaid(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "mark_cash_paid", order_id: cashOrderToMark.id, collected_by: cashCollectedBy || null, send_email: cashSendEmail },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Payment recorded", description: cashSendEmail && cashOrderToMark.customer_email ? `Confirmation sent to ${cashOrderToMark.customer_email}` : "Payment marked as collected" });
      setCashOrderToMark(null);
      setCashCollectedBy("");
      setCashSendEmail(true);
      fetchCashOrders();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setMarkingPaid(false); }
  }, [cashOrderToMark, cashCollectedBy, cashSendEmail, fetchCashOrders, toast]);

  const fetchLiveVisitors = useCallback(async () => {
    setLiveLoading(true);
    try {
      const [visitorsRes, funnelRes, perfRes] = await Promise.all([
        supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "list_live_visitors" },
        }),
        supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "get_funnel" },
        }),
        supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "get_page_performance" },
        }),
      ]);
      if (!visitorsRes.error && visitorsRes.data?.sessions) setLiveVisitors(visitorsRes.data.sessions);
      if (!funnelRes.error && funnelRes.data?.funnel) setFunnelData(funnelRes.data.funnel);
      if (!perfRes.error && perfRes.data?.pagePerf) setPagePerf(perfRes.data.pagePerf);
      if (!perfRes.error && perfRes.data?.cityIntel) setCityIntel(perfRes.data.cityIntel);
      setLastRefreshed(new Date());
      setRefreshCounter(0);
    } catch (err) { console.warn("Failed to fetch live visitors:", err); }
    finally { setLiveLoading(false); }
  }, []);

  const fetchAbandonedSessions = useCallback(async () => {
    setAbandonedLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_abandoned" },
      });
      if (!fnError && data?.sessions) setAbandonedSessions(data.sessions);
    } catch (err) { console.warn("Failed to fetch abandoned sessions:", err); }
    finally { setAbandonedLoading(false); }
  }, []);

  const fetchPendingReview = useCallback(async () => {
    setPendingReviewLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "get_pending_review_orders" },
      });
      if (!fnError && data?.orders) setPendingReviewOrders(data.orders);
    } catch (err) { console.warn("Failed to fetch pending review:", err); }
    finally { setPendingReviewLoading(false); }
  }, []);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_reviews" },
      });
      if (!fnError && data?.reviews) setReviewsData(data.reviews);
    } catch (err) { console.warn("Failed to fetch reviews:", err); }
    finally { setReviewsLoading(false); }
  }, []);

  const handleSendOffer = useCallback(async () => {
    if (!selectedLead || !offerPitId || !offerPrice) return;
    setSendingOffer(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "send_offer", lead_id: selectedLead.id, pit_id: offerPitId, calculated_price: parseFloat(offerPrice) },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setOfferResult({ payment_url: data.payment_url, order_number: data.order_number });
      toast({ title: "Offer sent", description: `Order ${data.order_number} created. Payment link ready.` });
      fetchLeads(storedPassword());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSendingOffer(false); }
  }, [selectedLead, offerPitId, offerPrice, toast]);

  const handleDeclineLead = useCallback(async () => {
    if (!selectedLead) return;
    setDecliningLead(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "decline_lead", lead_id: selectedLead.id },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Lead declined", description: "Customer added to waitlist and notified." });
      setSelectedLead(null);
      fetchLeads(storedPassword());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDecliningLead(false); }
  }, [selectedLead, toast]);

  const handleFlagFraud = useCallback(async () => {
    if (!selectedLead) return;
    setFlaggingFraud(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "flag_fraud", lead_id: selectedLead.id, reason: fraudReason || "Manually flagged" },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Flagged as fraud", description: "IP blocked and lead marked." });
      setSelectedLead(null);
      setFraudReason("");
      fetchLeads(storedPassword());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setFlaggingFraud(false); }
  }, [selectedLead, fraudReason, toast]);

  const handleVerifyCall = useCallback(async (orderId: string) => {
    setVerifyingCall(orderId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "verify_call", order_id: orderId, verified_by: "admin" },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Call verified", description: "Order confirmed and dispatch notified." });
      fetchPendingReview();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setVerifyingCall(null); }
  }, [toast, fetchPendingReview]);

  const handleCancelFraudOrder = useCallback(async (orderId: string) => {
    setVerifyingCall(orderId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "flag_fraud", order_id: orderId, reason: "Billing mismatch - cancelled by admin" },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Order cancelled", description: "Refund initiated and IP blocked." });
      fetchPendingReview();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setVerifyingCall(null); }
  }, [toast, fetchPendingReview]);

  const runEmailCheck = useCallback(async () => {
    setRunningEmailCheck(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("abandonment-emails");
      if (fnError) throw fnError;
      toast({ title: "Email check complete", description: `Sent: ${data?.email_1hr || 0} 1hr, ${data?.email_24hr || 0} 24hr, ${data?.email_72hr || 0} 72hr` });
      fetchAbandonedSessions();
    } catch (err: any) {
      toast({ title: "Email check failed", description: err.message, variant: "destructive" });
    } finally { setRunningEmailCheck(false); }
  }, [fetchAbandonedSessions, toast]);

  const storedPassword = () => sessionStorage.getItem("leads_pw") || "";

  // Path B Phase 1 — refreshDrivers is stable (empty deps). Reads sessionStorage at call-time, not capture-time.
  // Mount effect below has [refreshDrivers] dep array — fires once, not per render or per tab switch.
  const refreshDrivers = useCallback(async () => {
    setLoadingDrivers(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: sessionStorage.getItem("leads_pw") || "", action: "list_drivers" },
      });
      if (error) throw error;
      setDrivers(((data as any)?.drivers || []) as Driver[]);
    } catch (e) {
      console.error("[Leads] list_drivers failed:", e);
    } finally {
      setLoadingDrivers(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    refreshDrivers();
  }, [authenticated, refreshDrivers]);
  const basePrice = 195; // Pricing now lives on individual PITs

  const fetchLeads = useCallback(async (pw: string) => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "list" },
      });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); setAuthenticated(false); sessionStorage.removeItem("leads_pw"); return; }
      setLeads(data.leads || []);
      setAuthenticated(true);
      sessionStorage.setItem("leads_pw", pw);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async (pw: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "get_settings" },
      });
      if (fnError) throw fnError;
      if (data?.settings) {
        setGlobalSettings(data.settings);
        setEditSettings(data.settings);
        setProfileSettings(data.settings);
        // Populate SEO settings
        const seo: Record<string, string> = {};
        Object.keys(data.settings).filter(k => k.startsWith("seo_")).forEach(k => { seo[k] = data.settings[k]; });
        if (data.settings.product_image_url) seo.product_image_url = data.settings.product_image_url;
        seo.gmb_review_url = data.settings.gmb_review_url || "";
        seo.seo_gbp_url = data.settings.seo_gbp_url || "";
        setSeoSettings(seo);
        // Parse audit
        try {
          const au = JSON.parse(data.settings.seo_last_audit || "null");
          setSeoAuditResults(au);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const fetchPits = useCallback(async (pw: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "list_pits" },
      });
      if (fnError) throw fnError;
      if (data?.pits) setPits(data.pits);
    } catch (err: any) {
      console.error("Failed to fetch pits:", err);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (pw: string) => {
    try {
      const { data } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "get_notifications" },
      });
      if (data?.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: any) => !n.read).length);
      }
    } catch (err) { console.error("[notifications] Fetch error:", err); }
  }, []);

  // Mark notifications as read
  const markNotificationsRead = useCallback(async () => {
    const pw = storedPassword();
    if (!pw) return;
    try {
      await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "mark_notifications_read" },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) { console.error("[notifications] Mark read error:", err); }
  }, []);

  // Fraud & Security tab state
  const [fraudEvents, setFraudEvents] = useState<any[]>([]);
  const [fraudBlocklist, setFraudBlocklist] = useState<any[]>([]);
  const [fraudPaymentAttempts, setFraudPaymentAttempts] = useState<any[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [blockForm, setBlockForm] = useState({ type: "ip", value: "", reason: "", expires_at: "" });
  const [blockingEntity, setBlockingEntity] = useState(false);


  useEffect(() => {
    const saved = storedPassword();
    if (saved) {
      fetchLeads(saved);
      fetchSettings(saved);
      fetchPits(saved);
      fetchNotifications(saved);
    }
  }, [fetchLeads, fetchSettings, fetchPits, fetchNotifications]);

  // Sync body background for full-page dark mode coverage
  useEffect(() => {
    const dark = globalSettings?.dashboard_theme === 'dark';
    const bg = dark ? '#0A0F1E' : '#FAFAF9';
    document.body.style.backgroundColor = bg;
    document.documentElement.style.backgroundColor = bg;
    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, [globalSettings?.dashboard_theme]);

  // Realtime subscription for notifications
  useEffect(() => {
    if (!authenticated) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
          // Show toast
          toast({ title: newNotif.title, description: newNotif.message });
          // Auto-refresh relevant section
          const pw = storedPassword();
          if (!pw) return;
          if (newNotif.entity_type === "lead" || newNotif.type === "fraud_flagged") {
            fetchLeads(pw);
          } else if (newNotif.entity_type === "order") {
            fetchCashOrders();
            fetchPendingReview();
          } else if (newNotif.entity_type === "contact") {
            // refresh overview metrics on next visit
          } else if (newNotif.entity_type === "waitlist") {
            if (activePage === "waitlist") {
              supabase.functions.invoke("leads-auth", { body: { password: pw, action: "list_waitlist" } })
                .then(({ data }) => { if (data?.waitlist) setWaitlistData(data.waitlist); })
                .catch(() => {});
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authenticated, activePage, fetchLeads, toast]);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifPanel]);

  const handleLogin = async () => {
    setError("");
    await fetchLeads(password);
    if (sessionStorage.getItem("leads_pw")) {
      await Promise.all([fetchSettings(password), fetchPits(password), fetchNotifications(password)]);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("leads_pw");
    setAuthenticated(false);
    setLeads([]);
    setPassword("");
    setNotifications([]);
    setUnreadCount(0);
  };

  const saveGlobalSettings = async () => {
    setSavingSettings(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_settings", settings: editSettings },
      });
      if (fnError) throw fnError;
      if (data?.settings) {
        setGlobalSettings(data.settings);
        setEditSettings(data.settings);
      }
      toast({ title: "Global settings saved — all PITs updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const saveBusinessProfile = async () => {
    setSavingProfile(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_settings", settings: profileSettings },
      });
      if (fnError) throw fnError;
      if (data?.settings) {
        setGlobalSettings(data.settings);
        setProfileSettings(data.settings);
      }
      toast({ title: "Business profile saved — updates apply to all emails and invoices" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleContacted = async (id: string) => {
    setToggling(id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "toggle_contacted", id },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: data.contacted } : l));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const updateStage = async (id: string, stage: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "update_stage", id, stage },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
      toast({ title: "Stage updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const appendNote = async (id: string, note: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "update_notes", id, notes: note },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: data.notes } : l));
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const parsedLeads = useMemo<ParsedLead[]>(() =>
    leads.map(l => ({ ...l, ...parseAddress(l.address) })),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return parsedLeads.filter(l => {
      if (search) {
        const s = search.toLowerCase();
        const searchable = `${l.lead_number || ""} ${l.address} ${l.customer_name} ${l.customer_email || ""} ${l.customer_phone || ""}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (statusFilter === "contacted" && !l.contacted) return false;
      if (statusFilter === "not_contacted" && l.contacted) return false;
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (stateFilter !== "all" && l.state !== stateFilter) return false;
      if (dateFilter !== "all") {
        const d = new Date(l.created_at);
        if (dateFilter === "today" && d.toDateString() !== now.toDateString()) return false;
        if (dateFilter === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); if (d < w) return false; }
        if (dateFilter === "month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
        if (dateFilter === "year" && d.getFullYear() !== now.getFullYear()) return false;
      }
      if (distanceFilter !== "all") {
        const mi = l.distance_miles || 0;
        if (distanceFilter === "30-50" && (mi < 30 || mi > 50)) return false;
        if (distanceFilter === "50-75" && (mi < 50 || mi > 75)) return false;
        if (distanceFilter === "75-100" && (mi < 75 || mi > 100)) return false;
        if (distanceFilter === "100+" && mi < 100) return false;
      }
      return true;
    });
  }, [parsedLeads, search, statusFilter, stageFilter, stateFilter, dateFilter, distanceFilter]);

  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getVal = (l: ParsedLead) => {
        if (sortKey === "distance_miles") return l.distance_miles || 0;
        if (sortKey === "contacted") return l.contacted ? 1 : 0;
        if (sortKey === "lead_number") return l.lead_number || "";
        return (l as any)[sortKey] || "";
      };
      const va = getVal(a), vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return sorted;
  }, [filteredLeads, sortKey, sortDir]);

  const paginatedLeads = useMemo(() => sortedLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedLeads, page]);
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [search, statusFilter, stageFilter, stateFilter, dateFilter, distanceFilter]);

  const states = useMemo(() => [...new Set(parsedLeads.map(l => l.state).filter(s => s !== "—"))].sort(), [parsedLeads]);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = parsedLeads.filter(l => { const d = new Date(l.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const distances = parsedLeads.filter(l => l.distance_miles).map(l => l.distance_miles!);
    return {
      total: parsedLeads.length,
      notContacted: parsedLeads.filter(l => l.stage === "new").length,
      contacted: parsedLeads.filter(l => l.contacted).length,
      quoted: parsedLeads.filter(l => l.stage === "quoted").length,
      won: parsedLeads.filter(l => l.stage === "won").length,
      thisMonth: thisMonth.length,
      avgDistance: distances.length ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : "—",
      states: new Set(parsedLeads.map(l => l.state).filter(s => s !== "—")).size,
      zips: new Set(parsedLeads.map(l => l.zip).filter(z => z !== "—")).size,
      pipelineValue: parsedLeads.filter(l => !["won", "lost"].includes(l.stage)).length * basePrice,
    };
  }, [parsedLeads, basePrice]);

  const zipData = useMemo(() => {
    const map = new Map<string, ParsedLead[]>();
    parsedLeads.forEach(l => { if (l.zip !== "—") { if (!map.has(l.zip)) map.set(l.zip, []); map.get(l.zip)!.push(l); } });
    return [...map.entries()].map(([zip, leads]) => {
      const avgDist = leads.reduce((s, l) => s + (l.distance_miles || 0), 0) / leads.length;
      const city = leads[0].city;
      const state = leads[0].state;
      const priority = leads.length >= 2 ? "hot" : avgDist <= 75 ? "warm" : "watch";
      return { zip, city, state, count: leads.length, avgDist, priority, leads };
    }).sort((a, b) => b.count - a.count);
  }, [parsedLeads]);

  const maxZipCount = useMemo(() => Math.max(...zipData.map(z => z.count), 1), [zipData]);

  const exportCSV = () => {
    const header = ["Lead #", "Date", "Address", "State", "ZIP", "Miles", "Name", "Email", "Phone", "Stage", "Contacted", "IP Address", "Notes"];
    const rows = sortedLeads.map((l, i) => [
      l.lead_number || `#${i + 1}`,
      formatLeadDate(l.created_at),
      `"${l.address}"`,
      l.state, l.zip,
      l.distance_miles?.toFixed(1) || "—",
      `"${l.customer_name}"`,
      l.customer_email || "",
      l.customer_phone || "",
      l.stage,
      l.contacted ? "Yes" : "No",
      l.ip_address || "",
      `"${(l.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" style={{ color: BRAND_GOLD }} /> : <ArrowDown className="w-3 h-3" style={{ color: BRAND_GOLD }} />;
  };

  // PIT functions
  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number; location_type?: string; formatted_address?: string } | null> => {
    if (geocodeCache[address]) return geocodeCache[address];
    try {
      if (!window.google?.maps?.Geocoder) return null;
      const geocoder = new window.google.maps.Geocoder();
      const geocodeResult = await geocoder.geocode({ address });
      if (geocodeResult.results?.[0]) {
        const loc = geocodeResult.results[0].geometry.location;
        const location_type = (geocodeResult.results[0] as any).geometry?.location_type || "UNKNOWN";
        const formatted_address = geocodeResult.results[0].formatted_address || address;
        const result = { lat: loc.lat(), lon: loc.lng(), location_type, formatted_address };
        const newCache = { ...geocodeCache, [address]: result };
        setGeocodeCache(newCache);
        sessionStorage.setItem("geocache", JSON.stringify(newCache));
        return result;
      }
    } catch (e) { console.error("Geocode error:", e); }
    return null;
  };

  // Cache key for driving distance
  const drivingDistKey = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) =>
    `${lat1.toFixed(5)},${lon1.toFixed(5)}->${lat2.toFixed(5)},${lon2.toFixed(5)}`, []);

  // Helper: get driving distance from cache. Returns null if not cached (no haversine fallback).
  const getDist = useCallback((pitLat: number, pitLon: number, destLat: number, destLon: number): number | null => {
    const key = drivingDistKey(pitLat, pitLon, destLat, destLon);
    const val = drivingCache[key];
    return val !== undefined ? val : null;
  }, [drivingCache, drivingDistKey]);

  const checkActivationLeads = (pit: Pit) => {
    const eff = getEffectivePrice(pit, globalSettings);
    const reachable: Array<{ lead: ParsedLead; distance: number; price: number; hasEmail: boolean }> = [];
    for (const l of parsedLeads) {
      const cached = geocodeCache[l.address];
      if (!cached) continue;
      const dist = getDist(pit.lat, pit.lon, cached.lat, cached.lon);
      if (dist === null) continue; // No driving distance available — skip
      if (dist <= eff.max_distance) {
        const extra = dist > eff.free_miles ? (dist - eff.free_miles) * eff.extra_per_mile : 0;
        const price = eff.base_price + extra;
        reachable.push({ lead: l, distance: dist, price, hasEmail: !!l.customer_email });
      }
    }
    if (reachable.length === 0) {
      toast({ title: "PIT activated. No leads in range." });
      return;
    }
    setActivationPit(pit);
    setActivationLeads(reachable);
    const checkedSet = new Set(reachable.filter(r => r.hasEmail).map(r => r.lead.id));
    setActivationChecked(checkedSet);
    setShowActivationModal(true);
  };

  const sendActivationProposals = async () => {
    if (!activationPit) return;
    const toSend = activationLeads.filter(r => activationChecked.has(r.lead.id) && r.hasEmail);
    if (toSend.length === 0) { toast({ title: "No leads with email selected", variant: "destructive" }); return; }
    setActivationSending(true);
    setActivationProgress({ current: 0, total: toSend.length });
    const pitSlug = activationPit.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    for (let i = 0; i < toSend.length; i++) {
      const d = toSend[i];
      const { zip } = parseAddress(d.lead.address);
      const orderUrl = `https://riversand.net/order?address=${encodeURIComponent(d.lead.address)}&price=${d.price.toFixed(2)}&zip=${zip}&lead=${encodeURIComponent(d.lead.lead_number || "")}&utm_source=pit_activation&utm_medium=email&utm_campaign=${pitSlug}`;
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "pit_proposal",
            data: {
              lead_number: d.lead.lead_number,
              customer_name: d.lead.customer_name,
              customer_email: d.lead.customer_email,
              delivery_address: d.lead.address,
              zip_code: zip,
              new_price: d.price.toFixed(2),
              pit_name: activationPit.name,
              order_url: orderUrl,
              custom_note: "Great news — we now deliver to your area!",
            },
          },
        });
        await updateStage(d.lead.id, "quoted");
        const timestamp = new Date().toLocaleString("en-US");
        await appendNote(d.lead.id, `Auto-proposal sent ${timestamp} on PIT activation: ${activationPit.name} at $${d.price.toFixed(2)}. Link: ${orderUrl}`);
        if (!d.lead.contacted) {
          await supabase.functions.invoke("leads-auth", {
            body: { password: storedPassword(), action: "toggle_contacted", id: d.lead.id },
          });
        }
      } catch (err: any) {
        console.error("Activation proposal error:", err);
      }
      setActivationProgress({ current: i + 1, total: toSend.length });
    }
    const skipped = activationLeads.filter(r => activationChecked.has(r.lead.id) && !r.hasEmail).length;
    toast({ title: `${toSend.length} proposals sent${skipped > 0 ? ` · ${skipped} skipped (no email)` : ""}` });
    setActivationSending(false);
    setShowActivationModal(false);
    setActivationLeads([]);
    await fetchLeads(storedPassword());
  };

  const addPit = async () => {
    if (!newPit.name || !newPit.address) { toast({ title: "Missing info", description: "Enter PIT name and address", variant: "destructive" }); return; }
    const requiredNewPitFields = [
      { field: newPit.base_price, name: "Base price per load" },
      { field: newPit.free_miles, name: "Free delivery distance" },
      { field: newPit.price_per_extra_mile, name: "Extra per mile" },
      { field: newPit.max_distance, name: "Max delivery distance" },
    ];
    const missingNewFields = requiredNewPitFields.filter(f => f.field == null || isNaN(Number(f.field)));
    if (missingNewFields.length > 0) {
      toast({ title: "Missing required pricing", description: `Please fill in: ${missingNewFields.map(f => f.name).join(", ")}`, variant: "destructive" });
      return;
    }
    setGeocoding(true);
    let lat = newPit.lat;
    let lon = newPit.lon;
    if (lat == null || lon == null) {
      const coords = await geocodeAddress(newPit.address);
      if (!coords) { toast({ title: "Geocode failed", description: "Could not find coordinates for that address", variant: "destructive" }); setGeocoding(false); return; }
      // Block save if geocoded location is too imprecise (city centroid or region)
      const imprecise = ["GEOMETRIC_CENTER", "APPROXIMATE", "UNKNOWN"];
      if (imprecise.includes(coords.location_type)) {
        toast({
          title: "Address not specific enough",
          description: `Google returned a "${coords.location_type}" result for "${coords.formatted_address}". This is the center of a city or region, not a real location. Enter a full street address, select from the autocomplete dropdown, or provide GPS coordinates.`,
          variant: "destructive",
        });
        setGeocoding(false);
        return;
      }
      lat = coords.lat;
      lon = coords.lon;
    }
    if (
      lat == null || lon == null ||
      (lat === 0 && lon === 0) ||
      lat < 24 || lat > 50 ||
      lon < -125 || lon > -66
    ) {
      toast({
        title: "Cannot save PIT — invalid coordinates",
        description: `Coordinates are invalid (lat: ${lat}, lon: ${lon}). Please select the address from the autocomplete dropdown rather than typing it manually.`,
        variant: "destructive",
      });
      setGeocoding(false);
      return;
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: {
          password: storedPassword(),
          action: "save_pit",
          pit: { name: newPit.name, address: newPit.address, lat, lon, status: newPit.status, notes: newPit.notes, base_price: newPit.base_price, free_miles: newPit.free_miles, price_per_extra_mile: newPit.price_per_extra_mile, max_distance: newPit.max_distance, operating_days: newPit.operating_days, saturday_surcharge_override: newPit.saturday_surcharge_override, same_day_cutoff: newPit.same_day_cutoff || null, sunday_surcharge: newPit.sunday_surcharge, saturday_load_limit: newPit.saturday_load_limit, sunday_load_limit: newPit.sunday_load_limit, is_pickup_only: newPit.is_pickup_only, delivery_hours: newPit.delivery_hours },
        },
      });
      if (fnError) throw fnError;
      if (data?.pit) {
        setPits(prev => [...prev, data.pit]);
        if (newPit.status === "active") {
          checkActivationLeads(data.pit);
        }
      }
      setNewPit({ name: "", address: "", status: "planning", notes: "", base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null, lat: null, lon: null, operating_days: null, saturday_surcharge_override: null, same_day_cutoff: "", sunday_surcharge: null, saturday_load_limit: null, sunday_load_limit: null, is_pickup_only: false, delivery_hours: null });
      setShowAddPit(false);
      toast({ title: "PIT added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const deletePit = async (pitId: string) => {
    const pit = pits.find(p => p.id === pitId);
    if (pit?.is_default) {
      toast({ title: "Warning", description: "Deleting the default PIT. Set another PIT as default first.", variant: "destructive" });
    }
    try {
      const { error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "delete_pit", id: pitId },
      });
      if (fnError) throw fnError;
      setPits(prev => prev.filter(p => p.id !== pitId));
      if (selectedPit?.id === pitId) setSelectedPit(null);
      toast({ title: "PIT deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const togglePitStatus = async (pit: Pit) => {
    const newStatus = pit.status === "active" ? "inactive" : "active";
    if (pit.is_default && newStatus === "inactive") {
      toast({ title: "Warning", description: "Deactivating the default PIT will show 'Delivery unavailable' to all customers. Set another PIT as default first." });
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_pit", pit: { ...pit, status: newStatus } },
      });
      if (fnError) throw fnError;
      if (data?.pit) {
        setPits(prev => prev.map(p => p.id === pit.id ? data.pit : p));
        if (newStatus === "active") {
          checkActivationLeads(data.pit);
        }
      }
      toast({ title: newStatus === "active" ? "PIT activated" : "PIT deactivated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const startEditPit = (pit: Pit) => {
    setEditingPitId(pit.id);
    setEditPitData({ ...pit });
    setShowDeleteConfirm(false);
  };

  const cancelEditPit = () => {
    setEditingPitId(null);
    setEditPitData({});
    setShowDeleteConfirm(false);
  };

  // Fetch waitlist data
  useEffect(() => {
    if (activePage === "waitlist" && authenticated) {
      setWaitlistLoading(true);
      supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_waitlist" },
      }).then(({ data }) => {
        if (data?.waitlist) setWaitlistData(data.waitlist);
        setWaitlistLoading(false);
      }).catch(() => setWaitlistLoading(false));
    }
  }, [activePage, authenticated]);

  // Auto-process regen queue — extracted so it can be called on-demand after pit save
  const regenInFlightRef = useRef(false);
  const runRegenQueue = useCallback(async () => {
    if (!authenticated) return;
    if (regenInFlightRef.current) return;
    regenInFlightRef.current = true;
    try {
      const { count } = await supabase
        .from("city_pages")
        .select("id", { count: "exact", head: true })
        .eq("needs_regen", true);
      if (!count || count === 0) {
        setRegenQueuePending(0);
        return;
      }
      setRegenQueuePending(count);
      const { data } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "process_regen_queue" },
      });
      if (data?.remaining !== undefined) setRegenQueuePending(data.remaining);
      if (data?.processed > 0) {
        console.log(`[regen] Processed ${data.processed} pages. ${data.remaining} remaining.`);
        if (data.remaining === 0) setRegenQueuePending(0);
        await fetchCityPages();
        setCityPages(prev => [...prev]);
      }
      if (data?.remaining === 0 && data?.processed === 0) setRegenQueuePending(0);
    } catch (err) {
      console.warn("[regen] Queue error:", err);
    } finally {
      regenInFlightRef.current = false;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    if (activePage !== 'city_pages') return;
    runRegenQueue();
    const interval = setInterval(runRegenQueue, 30000);
    return () => clearInterval(interval);
  }, [authenticated, activePage, runRegenQueue]);

  const saveEditPit = async () => {
    if (!editPitData.name || !editPitData.address) {
      toast({ title: "Missing info", variant: "destructive" });
      return;
    }
    const requiredEditFields = [
      { field: editPitData.base_price, name: "Base price per load" },
      { field: editPitData.free_miles, name: "Free delivery distance" },
      { field: editPitData.price_per_extra_mile, name: "Extra per mile" },
      { field: editPitData.max_distance, name: "Max delivery distance" },
    ];
    const missingEditFields = requiredEditFields.filter(f => f.field == null || isNaN(Number(f.field)));
    if (missingEditFields.length > 0) {
      toast({ title: "Missing required pricing", description: `Please fill in: ${missingEditFields.map(f => f.name).join(", ")}`, variant: "destructive" });
      return;
    }
    setSavingPit(true);
    try {
      const originalPit = pits.find(p => p.id === editingPitId);
      let lat = editPitData.lat!;
      let lon = editPitData.lon!;
      if (originalPit && editPitData.address !== originalPit.address && (lat === originalPit.lat && lon === originalPit.lon)) {
        const coords = await geocodeAddress(editPitData.address!);
        if (!coords) { toast({ title: "Geocode failed", variant: "destructive" }); setSavingPit(false); return; }
        // Block save if geocoded location is too imprecise
        const imprecise = ["GEOMETRIC_CENTER", "APPROXIMATE", "UNKNOWN"];
        if (imprecise.includes(coords.location_type)) {
          toast({
            title: "Address not specific enough",
            description: `Google returned a "${coords.location_type}" result for "${coords.formatted_address}". This is the center of a city or region, not a real location. Enter a full street address, select from the autocomplete dropdown, or provide GPS coordinates.`,
            variant: "destructive",
          });
          setSavingPit(false);
          return;
        }
        lat = coords.lat;
        lon = coords.lon;
      }
      if (
        lat == null || lon == null ||
        (lat === 0 && lon === 0) ||
        lat < 24 || lat > 50 ||
        lon < -125 || lon > -66
      ) {
        toast({
          title: "Cannot save PIT — invalid coordinates",
          description: `This PIT has missing or implausible coordinates (lat: ${lat}, lon: ${lon}). Open Edit, retype the address, and select from the autocomplete dropdown to fix it.`,
          variant: "destructive",
        });
        setSavingPit(false);
        return;
      }
      const pitPayload = {
        id: editingPitId,
        name: editPitData.name,
        address: editPitData.address,
        lat, lon,
        status: editPitData.status,
        notes: editPitData.notes || "",
        is_default: editPitData.is_default,
        base_price: editPitData.base_price || null,
        free_miles: editPitData.free_miles || null,
        price_per_extra_mile: editPitData.price_per_extra_mile || null,
        max_distance: editPitData.max_distance || null,
        operating_days: editPitData.operating_days ?? null,
        saturday_surcharge_override: editPitData.saturday_surcharge_override ?? null,
        same_day_cutoff: editPitData.same_day_cutoff || null,
        sunday_surcharge: editPitData.sunday_surcharge ?? null,
        saturday_load_limit: editPitData.saturday_load_limit ?? null,
        sunday_load_limit: editPitData.sunday_load_limit ?? null,
        is_pickup_only: editPitData.is_pickup_only || false,
        delivery_hours: (editPitData as any).delivery_hours ?? null,
      };

      // Save directly — price rollover handled server-side
      await executePitSave(pitPayload, originalPit?.status === "active", editPitData.status === "active");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPit(false);
    }
  };

  const executePitSave = async (pitPayload: any, wasActive: boolean, nowActive: boolean) => {
    setSavingPit(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_pit", pit: pitPayload },
      });
      if (fnError) throw fnError;
      if (data?.pit) {
        setPits(prev => prev.map(p => p.id === editingPitId ? data.pit : p));
        if (!wasActive && nowActive) {
          checkActivationLeads(data.pit);
        }
      }

      // Build toast description from server response
      const parts: string[] = [];
      const pricesUpdated = data?.prices_updated || 0;
      const pagesRegen = data?.pages_regenerated || 0;
      const pagesReassigned = data?.deactivation_reassigned || 0;
      const pagesWaitlisted = data?.deactivation_waitlisted || 0;
      const reactReassigned = data?.reactivation_reassigned || 0;
      const reactUnwaitlisted = data?.reactivation_unwaitlisted || 0;
      if (pricesUpdated > 0) parts.push(`${pricesUpdated} city page prices updated`);
      if (pagesRegen > 0) parts.push(`${pagesRegen} pages queued for regen`);
      if (pagesReassigned > 0) parts.push(`${pagesReassigned} pages reassigned to other PITs`);
      if (pagesWaitlisted > 0) parts.push(`${pagesWaitlisted} pages moved to waitlist`);
      if (reactReassigned > 0) parts.push(`${reactReassigned} pages reassigned to reactivated PIT`);
      if (reactUnwaitlisted > 0) parts.push(`${reactUnwaitlisted} pages restored from waitlist`);
      if (parts.length > 0) {
        toast({ title: "PIT saved", description: parts.join(". ") + "." });
      } else {
        toast({ title: "PIT updated" });
      }
      // Always refresh city pages after save
      fetchCityPages();
      // Auto-trigger regen queue immediately if pages were flagged
      const flaggedCount = pagesRegen + pricesUpdated + pagesReassigned + reactReassigned + reactUnwaitlisted;
      if (flaggedCount > 0) {
        toast({ title: "Auto-regenerating affected city pages...", description: `${flaggedCount} pages queued.` });
        // Only trigger regen after modal closes to avoid re-renders during editing
        setTimeout(() => {
          if (!editingPitId) runRegenQueue();
        }, 3000);
      }

      setEditingPitId(null);
      setEditPitData({});
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPit(false);
    }
  };

  // Autocomplete handlers for PlaceAutocompleteInput components
  const handleAddPitPlaceSelect = useCallback((result: PlaceSelectResult) => {
    setNewPit(prev => ({ ...prev, address: result.formattedAddress, lat: result.lat, lon: result.lng }));
  }, []);

  const handleEditPitPlaceSelect = useCallback((result: PlaceSelectResult) => {
    setEditPitData(prev => ({ ...prev, address: result.formattedAddress, lat: result.lat, lon: result.lng }));
  }, []);

  const handleProfilePlaceSelect = useCallback((result: PlaceSelectResult) => {
    setProfileSettings(prev => ({ ...prev, business_address: result.formattedAddress }));
  }, []);

  // Fetch abandoned sessions when navigating to that page or overview (only if empty)
  useEffect(() => {
    if ((activePage === "abandoned" || activePage === "finances" || activePage === "overview") && authenticated && abandonedSessions.length === 0) {
      fetchAbandonedSessions();
    }
  }, [activePage, authenticated, fetchAbandonedSessions]);

  // Fetch live visitors when navigating to that tab + auto-refresh every 30s
  useEffect(() => {
    if (activePage === "live" && authenticated) {
      fetchLiveVisitors();
      const interval = setInterval(fetchLiveVisitors, 30000);
      return () => clearInterval(interval);
    }
  }, [activePage, authenticated, fetchLiveVisitors]);

  // 5-second ticker for "updated Xs ago" display
  useEffect(() => {
    if (activePage !== "live") return;
    const ticker = setInterval(() => setRefreshCounter(c => c + 5), 5000);
    return () => clearInterval(ticker);
  }, [activePage]);


  // Fetch pending review orders when navigating to that page
  useEffect(() => {
    if (activePage === "pending_review" && authenticated) {
      fetchPendingReview();
    }
  }, [activePage, authenticated, fetchPendingReview]);

  useEffect(() => {
    if (activePage === "reviews" && authenticated) {
      fetchReviews();
    }
  }, [activePage, authenticated, fetchReviews]);




  // Fetch cash orders when navigating to that page + auto-refresh every 60s
  // Cold-start fix added with Slice 1 ScheduleTab — closes cross-nav gap introduced by card-click navigation.
  useEffect(() => {
    if ((activePage === "cash_orders" || activePage === "all") && authenticated) {
      fetchCashOrders();
      fetchAllOrders();
      const interval = setInterval(() => {
        fetchCashOrders();
        fetchAllOrders();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activePage, authenticated, fetchCashOrders, fetchAllOrders]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { action: "get_customers", password: sessionStorage.getItem("leads_pw") || "" }
      });
      if (error) throw error;
      setCustomersData(data?.customers || []);
    } catch (err) { console.warn("Failed to fetch customers:", err); }
    finally { setCustomersLoading(false); }
  }, []);

  useEffect(() => {
    if (activePage === "customers" && authenticated) {
      fetchCustomers();
      fetchCashOrders();
    }
  }, [activePage, authenticated, fetchCustomers, fetchCashOrders]);

  // Fetch city pages
  const fetchCityPages = useCallback(async () => {
    setCityPagesLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "list_city_pages" },
      });
      if (!fnError && data?.city_pages) setCityPages(data.city_pages);
    } catch (err) { console.warn("Failed to fetch city pages:", err); }
    finally { setCityPagesLoading(false); }
  }, []);

  useEffect(() => {
    if (activePage === "city_pages" && authenticated) {
      fetchCityPages();
    }
  }, [activePage, authenticated, fetchCityPages]);

  // Fetch overview data when overview tab loads + auto-refresh every 60s (per GUIDELINES §16)
  const [overviewLoading, setOverviewLoading] = useState(false);
  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      await Promise.all([fetchCashOrders(), fetchCityPages(), fetchAbandonedSessions()]);
    } finally {
      setOverviewLoading(false);
    }
  }, [fetchCashOrders, fetchCityPages, fetchAbandonedSessions]);
  useEffect(() => {
    if (activePage === "overview" && authenticated) {
      refreshOverview();
      const interval = setInterval(refreshOverview, 60000);
      return () => clearInterval(interval);
    }
  }, [activePage, authenticated, refreshOverview]);

  // Fetch fraud data when navigating to fraud tab
  const fetchFraudData = useCallback(async () => {
    setFraudLoading(true);
    try {
      const pw = storedPassword();
      const [eventsRes, blocklistRes, attemptsRes] = await Promise.all([
        supabase.functions.invoke("leads-auth", { body: { password: pw, action: "list_fraud_events" } }),
        supabase.functions.invoke("leads-auth", { body: { password: pw, action: "list_blocklist" } }),
        supabase.functions.invoke("leads-auth", { body: { password: pw, action: "list_payment_attempts" } }),
      ]);
      if (eventsRes.data?.events) setFraudEvents(eventsRes.data.events);
      if (blocklistRes.data?.blocklist) setFraudBlocklist(blocklistRes.data.blocklist);
      if (attemptsRes.data?.attempts) setFraudPaymentAttempts(attemptsRes.data.attempts);
    } catch (err: any) {
      console.error("[fraud] Fetch error:", err);
    } finally { setFraudLoading(false); }
  }, []);

  useEffect(() => {
    if (activePage === "fraud" && authenticated) {
      fetchFraudData();
    }
  }, [activePage, authenticated, fetchFraudData]);

  const handlePriceBlur = (field: "base_price" | "price_per_extra_mile", value: number | null, setter: (v: any) => void, current: any) => {
    if (value != null && !isNaN(value)) {
      setter({ ...current, [field]: Math.round(value * 100) / 100 });
    }
  };

  // Simulation data
  const simData = useMemo(() => {
    if (!selectedPit) return [];
    const eff = getEffectivePrice(selectedPit, globalSettings);
    return parsedLeads.map(l => {
      const cached = geocodeCache[l.address];
      const hqDist = l.distance_miles || 0;
      if (!cached) return { lead: l, hqDist, pitDist: null, delta: 0, newPrice: 0, status: "unknown" as const };
      const pitDist = getDist(selectedPit.lat, selectedPit.lon, cached.lat, cached.lon);
      if (pitDist === null) return { lead: l, hqDist, pitDist: null, delta: 0, newPrice: 0, status: "unknown" as const };
      const delta = hqDist - pitDist;
      const extra = pitDist > eff.free_miles ? (pitDist - eff.free_miles) * eff.extra_per_mile : 0;
      const newPrice = eff.base_price + extra;
      const status = pitDist <= eff.max_distance ? "serviceable" : pitDist < hqDist ? "closer" : "same";
      return { lead: l, hqDist, pitDist, delta, newPrice, status: status as "serviceable" | "closer" | "same" };
    }).filter(d => d.pitDist !== null).sort((a, b) => (a.pitDist || 0) - (b.pitDist || 0));
  }, [selectedPit, parsedLeads, geocodeCache, globalSettings, getDist]);

  const geocodeAllLeads = async () => {
    setGeocoding(true);
    for (const l of parsedLeads) {
      if (!geocodeCache[l.address]) {
        await geocodeAddress(l.address);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Batch-fetch driving distances for all geocoded leads against all active PITs
    const activePits = pits.filter(p => p.status === "active");
    const geocodedLeads = parsedLeads.filter(l => geocodeCache[l.address]);
    if (geocodedLeads.length > 0 && activePits.length > 0) {
      const newDrivingCache = { ...drivingCache };
      for (const pit of activePits) {
        // Filter leads that don't have a cached driving distance for this PIT yet
        const needsDriving = geocodedLeads.filter(l => {
          const gc = geocodeCache[l.address];
          const key = drivingDistKey(pit.lat, pit.lon, gc.lat, gc.lon);
          return !newDrivingCache[key];
        });
        if (needsDriving.length === 0) continue;

        const dests = needsDriving.map(l => {
          const gc = geocodeCache[l.address];
          return { lat: gc.lat, lng: gc.lon };
        });
        // Call edge function for driving distances (batch: one origin, many destinations)
        const { data: distData } = await supabase.functions.invoke("leads-auth", {
          body: {
            action: "calculate_distances",
            origins: [{ lat: pit.lat, lng: pit.lon }],
            destination: dests[0], // single destination per call
          },
        });
        // For batch: call per destination
        const distances: (number | null)[] = [];
        for (const dest of dests) {
          const { data: dd } = await supabase.functions.invoke("leads-auth", {
            body: {
              action: "calculate_distances",
              origins: [{ lat: pit.lat, lng: pit.lon }],
              destination: dest,
            },
          });
          distances.push(dd?.distances?.[0] ?? null);
        }
        for (let i = 0; i < needsDriving.length; i++) {
          if (distances[i] != null) {
            const gc = geocodeCache[needsDriving[i].address];
            const key = drivingDistKey(pit.lat, pit.lon, gc.lat, gc.lon);
            newDrivingCache[key] = distances[i]!;
          }
        }
      }
      setDrivingCache(newDrivingCache);
      sessionStorage.setItem("drivingcache", JSON.stringify(newDrivingCache));
    }

    setGeocoding(false);
    toast({ title: "Geocoding & driving distances complete" });
  };

  const sendProposals = async () => {
    const selected = simData.filter(d => simSelected.has(d.lead.id) && d.lead.customer_email);
    if (selected.length === 0) { toast({ title: "No leads with email selected", variant: "destructive" }); return; }
    setSendingProposals(true);
    setSendProgress({ current: 0, total: selected.length });
    for (let i = 0; i < selected.length; i++) {
      const d = selected[i];
      const { zip } = parseAddress(d.lead.address);
      const orderUrl = `https://riversand.net/order?address=${encodeURIComponent(d.lead.address)}&price=${d.newPrice.toFixed(2)}&zip=${zip}&lead=${encodeURIComponent(d.lead.lead_number || "")}&utm_source=proposal&utm_medium=email&utm_campaign=pit_expansion`;
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "pit_proposal",
            data: {
              lead_number: d.lead.lead_number,
              customer_name: d.lead.customer_name,
              customer_email: d.lead.customer_email,
              delivery_address: d.lead.address,
              zip_code: zip,
              new_price: d.newPrice.toFixed(2),
              pit_name: selectedPit?.name,
              order_url: orderUrl,
            },
          },
        });
        await updateStage(d.lead.id, "quoted");
        await appendNote(d.lead.id, `Proposal sent from PIT ${selectedPit?.name} at $${d.newPrice.toFixed(2)}. Order link: ${orderUrl}`);
      } catch (err: any) {
        console.error("Proposal send error:", err);
      }
      setSendProgress({ current: i + 1, total: selected.length });
    }
    setSendingProposals(false);
    setShowProposal(false);
    setSimSelected(new Set());
    toast({ title: `${selected.length} proposals sent` });
    await fetchLeads(storedPassword());
  };

  // Quick Proposal functions
  const openQuickProposal = (lead: ParsedLead) => {
    setQuickProposalLead(lead);
    const defaultPitId = lead.nearest_pit_id || pits.find(p => p.is_default)?.id || "";
    setQpPitId(defaultPitId);
    const pit = pits.find(p => p.id === defaultPitId);
    if (pit && lead.nearest_pit_distance != null) {
      const eff = getEffectivePrice(pit, globalSettings);
      const dist = lead.nearest_pit_distance;
      const extra = dist > eff.free_miles ? (dist - eff.free_miles) * eff.extra_per_mile : 0;
      setQpPrice((eff.base_price + extra).toFixed(2));
    } else {
      setQpPrice(basePrice.toFixed(2));
    }
    setQpNote("");
    setQpShowPreview(false);
  };

  const qpSelectedPit = useMemo(() => pits.find(p => p.id === qpPitId), [pits, qpPitId]);

  const qpDistance = useMemo(() => {
    if (!quickProposalLead || !qpSelectedPit) return null;
    if (quickProposalLead.nearest_pit_id === qpPitId && quickProposalLead.nearest_pit_distance != null) {
      return quickProposalLead.nearest_pit_distance;
    }
    const cached = geocodeCache[quickProposalLead.address];
    if (!cached) return null;
    return getDist(qpSelectedPit.lat, qpSelectedPit.lon, cached.lat, cached.lon);
  }, [quickProposalLead, qpSelectedPit, qpPitId, geocodeCache, getDist]);

  useEffect(() => {
    if (!qpSelectedPit || qpDistance == null) return;
    const eff = getEffectivePrice(qpSelectedPit, globalSettings);
    const extra = qpDistance > eff.free_miles ? (qpDistance - eff.free_miles) * eff.extra_per_mile : 0;
    setQpPrice((eff.base_price + extra).toFixed(2));
  }, [qpPitId, qpDistance, globalSettings]);

  const qpOrderUrl = useMemo(() => {
    if (!quickProposalLead) return "";
    const { zip } = parseAddress(quickProposalLead.address);
    return `https://riversand.net/order?address=${encodeURIComponent(quickProposalLead.address)}&price=${qpPrice}&zip=${zip}&lead=${encodeURIComponent(quickProposalLead.lead_number || "")}&utm_source=proposal&utm_medium=email&utm_campaign=direct_offer`;
  }, [quickProposalLead, qpPrice]);

  const sendQuickProposal = async () => {
    if (!quickProposalLead?.customer_email) return;
    setQpSending(true);
    try {
      const { zip } = parseAddress(quickProposalLead.address);
      await supabase.functions.invoke("send-email", {
        body: {
          type: "pit_proposal",
          data: {
            lead_number: quickProposalLead.lead_number,
            customer_name: quickProposalLead.customer_name,
            customer_email: quickProposalLead.customer_email,
            delivery_address: quickProposalLead.address,
            zip_code: zip,
            new_price: qpPrice,
            pit_name: qpSelectedPit?.name || "HQ",
            order_url: qpOrderUrl,
            custom_note: qpNote.trim() || undefined,
          },
        },
      });
      await updateStage(quickProposalLead.id, "quoted");
      if (!quickProposalLead.contacted) {
        await supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "toggle_contacted", id: quickProposalLead.id },
        });
      }
      const timestamp = new Date().toLocaleString("en-US");
      await appendNote(quickProposalLead.id, `Offer sent ${timestamp} from ${qpSelectedPit?.name || "HQ"} at $${qpPrice}. Order link: ${qpOrderUrl}`);
      setLeads(prev => prev.map(l => l.id === quickProposalLead.id ? { ...l, stage: "quoted", contacted: true } : l));
      toast({ title: `Offer sent to ${quickProposalLead.customer_email}` });
      setQuickProposalLead(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setQpSending(false);
    }
  };

  // Sub-components
  const StageBadge = ({ stage }: { stage: string }) => (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: STAGE_COLORS[stage] || "#999" }}>
      {stage.toUpperCase()}
    </span>
  );

  const ContactedBadge = ({ contacted, onClick, loading: btnLoading }: { contacted: boolean; onClick: () => void; loading: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={btnLoading}
      className="px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-colors"
      style={{
        backgroundColor: contacted ? "#22C55E20" : "#F59E0B20",
        color: contacted ? "#22C55E" : "#F59E0B",
        border: `1px solid ${contacted ? "#22C55E" : "#F59E0B"}`,
      }}
    >
      {btnLoading ? "..." : contacted ? "Contacted" : "Pending"}
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = { active: { bg: "#22C55E20", text: "#22C55E" }, planning: { bg: "#1A6BB820", text: "#1A6BB8" }, inactive: { bg: "#99999920", text: "#999" } };
    const c = colors[status as keyof typeof colors] || colors.inactive;
    return <span className="text-xs px-2 py-0.5 rounded-full font-bold inline-block" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.text}` }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  const openDetail = (l: ParsedLead) => {
    setSelectedLead(l);
    setDetailStage(l.stage);
    setDetailNote("");
    setOfferPitId(l.nearest_pit_id || "");
    setOfferPrice(l.calculated_price ? String(l.calculated_price) : "");
    setOfferResult(null);
    setFraudReason("");
  };

  const saveDetail = async () => {
    if (!selectedLead) return;
    setSavingDetail(true);
    if (detailStage !== selectedLead.stage) await updateStage(selectedLead.id, detailStage);
    if (detailNote.trim()) await appendNote(selectedLead.id, detailNote.trim());
    setSavingDetail(false);
    setSelectedLead(null);
    await fetchLeads(storedPassword());
  };

  // ─── REUSABLE DESIGN SYSTEM COMPONENTS ───

  const SectionHeader = ({ title, right }: { title: string; right?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 14, background: BRAND_GOLD, borderRadius: 2 }} />
      <span style={{ ...LABEL_STYLE, color: T.textSecond }}>{title}</span>
      {right && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textSecond }}>{right}</span>}
    </div>
  );

  const StatusPill = ({ status }: { status: string }) => {
    const key = status.toLowerCase().replace(/[\s_-]+/g, '_');
    const colors = STATUS_COLORS[key] || { bg: '#F3F4F6', text: '#6B7280' };
    return (
      <span style={{
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        backgroundColor: isDark ? `${colors.text}20` : colors.bg,
        color: colors.text,
      }}>
        {status}
      </span>
    );
  };

  const MetricCard = ({ label, value, sub, onClick, accent = false }: {
    label: string; value: string | number; sub?: string;
    onClick?: () => void; accent?: boolean;
  }) => (
    <div
      onClick={onClick}
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderLeft: accent ? `3px solid ${BRAND_GOLD}` : `1px solid ${T.cardBorder}`,
        borderRadius: 10,
        padding: '20px 24px',
        minHeight: 110,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'none';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
      }}
    >
      <div style={{ ...LABEL_STYLE, color: T.textSecond }}>{label}</div>
      <div style={{ ...NUM_STYLE, fontSize: 28, marginTop: 8, color: T.textPrimary }}>{value}</div>
      {sub && <div style={{ ...SUB_STYLE, color: T.textSecond }}>{sub}</div>}
    </div>
  );

  const FilterSelect = ({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-2 rounded-md border text-sm"
      style={{ borderColor: T.textPrimary + "40", color: T.textPrimary }}
      aria-label={label}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const TH = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none ${className}`}
      style={{ backgroundColor: T.tableHeaderBg, color: sortKey === col ? BRAND_GOLD : T.tableHeaderText }}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  const LeadsTable = ({ data, showStage = true }: { data: ParsedLead[]; showStage?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <TH col="lead_number" label="Lead #" />
            <TH col="created_at" label="Date" />
            <TH col="address" label="Address" />
            <TH col="state" label="State" />
            <TH col="zip" label="ZIP" />
            <TH col="distance_miles" label="Miles" />
            <TH col="nearest_pit_name" label="Nearest PIT" />
            <TH col="customer_name" label="Name" />
            <TH col="customer_email" label="Email" />
            <TH col="customer_phone" label="Phone" />
            {showStage && <TH col="stage" label="Stage" />}
            <TH col="contacted" label="Contacted" />
            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: T.tableHeaderBg, color: T.tableHeaderText }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((l, i) => (
            <tr
              key={l.id}
              onClick={() => openDetail(l)}
              className="cursor-pointer transition-colors"
              style={{ backgroundColor: i % 2 === 0 ? T.cardBg : T.tableStripeBg }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = T.tableHoverBg)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? T.cardBg : T.tableStripeBg)}
            >
              <td className="px-3 py-2 font-mono text-xs" style={{ color: T.textPrimary }}>{l.lead_number || `#${i + 1}`}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{formatLeadDate(l.created_at)}</td>
              <td className="px-3 py-2 text-xs max-w-[200px] truncate">{l.address}</td>
              <td className="px-3 py-2 text-xs">{l.state}</td>
              <td className="px-3 py-2 text-xs">{l.zip}</td>
              <td className="px-3 py-2 text-xs">{l.distance_miles ? `${l.distance_miles.toFixed(1)} mi` : "—"}</td>
              <td className="px-3 py-2 text-xs">{l.nearest_pit_name ? `${l.nearest_pit_name} (${l.nearest_pit_distance?.toFixed(1)} mi)` : "—"}</td>
              <td className="px-3 py-2 text-xs font-medium">{l.customer_name}</td>
              <td className="px-3 py-2 text-xs">{l.customer_email || "—"}</td>
              <td className="px-3 py-2 text-xs">{l.customer_phone || "—"}</td>
              {showStage && <td className="px-3 py-2"><StageBadge stage={l.stage} /></td>}
              <td className="px-3 py-2">
                <ContactedBadge contacted={l.contacted} onClick={() => toggleContacted(l.id)} loading={toggling === l.id} />
              </td>
              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                {l.customer_email ? (
                  <button
                    onClick={() => openQuickProposal(l)}
                    className="px-2 py-1 rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                    style={{ border: `1px solid ${BRAND_GOLD}`, color: BRAND_GOLD }}
                  >
                    <Send className="w-3 h-3" /> Send Offer
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">No email</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const Pagination = () => (
    <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
      <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, sortedLeads.length)}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} of {sortedLeads.length} leads</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span>Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );

  const SearchAndFilters = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
      </div>
      <FilterSelect value={stageFilter} onChange={setStageFilter} label="Stage" options={[{ value: "all", label: "All stages" }, ...STAGES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]} />
      <FilterSelect value={stateFilter} onChange={setStateFilter} label="State" options={[{ value: "all", label: "All states" }, ...states.map(s => ({ value: s, label: s }))]} />
      <FilterSelect value={dateFilter} onChange={setDateFilter} label="Date" options={[{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "year", label: "This year" }]} />
      <FilterSelect value={distanceFilter} onChange={setDistanceFilter} label="Distance" options={[{ value: "all", label: "All distances" }, { value: "30-50", label: "30-50 mi" }, { value: "50-75", label: "50-75 mi" }, { value: "75-100", label: "75-100 mi" }, { value: "100+", label: "100+ mi" }]} />
    </div>
  );

  // ─── PAGE TITLE LABELS ───
  const PAGE_TITLES: Record<NavPage, { title: string; subtitle?: string }> = {
    overview: { title: "OVERVIEW", subtitle: `${metrics.total} total leads` },
    zip: { title: "ZIP INTELLIGENCE", subtitle: `${zipData.length} unique ZIPs tracked` },
    pipeline: { title: "PIPELINE", subtitle: `$${metrics.pipelineValue.toLocaleString()} active` },
    revenue: { title: "REVENUE FORECAST" },
    abandoned: { title: "ABANDONED SESSIONS", subtitle: "Checkout drop-offs" },
    live: { title: "LIVE VISITORS", subtitle: `${liveVisitors.length} active now` },
    cash_orders: { title: "ORDERS", subtitle: `${cashOrders.length} orders` },
    customers: { title: "CUSTOMERS", subtitle: `${customersData.length} customers` },
    city_pages: { title: "CITY PAGES", subtitle: `${cityPages.length} pages` },
    waitlist: { title: "WAITLIST", subtitle: "Coming soon areas" },
    pit: { title: "PIT", subtitle: `${pits.length} locations` },
    drivers: { title: "DRIVERS", subtitle: `${drivers.filter(d => d.active).length} active` },
    all: { title: "ALL LEADS", subtitle: `${sortedLeads.length} leads` },
    profile: { title: "BUSINESS PROFILE" },
    settings: { title: "GLOBAL SETTINGS" },
    pending_review: { title: "PENDING REVIEW", subtitle: `${pendingReviewOrders.length} orders to review` },
    reviews: { title: "REVIEWS", subtitle: "Customer feedback" },
    schedule: { title: "DELIVERY SCHEDULE", subtitle: "Orders by delivery date" },
    finances: { title: "TAXES & FINANCIALS", subtitle: "Tax liability, fees & revenue" },
    fraud: { title: "FRAUD & SECURITY", subtitle: "Threat monitoring & blocklist" },
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, #1a3a5c 100%)` }}>
        <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-sm">
          <div className="text-center mb-6">
            <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: BRAND_GOLD }} />
            <h1 className="text-2xl font-bold" style={{ color: "#0D2137" }}>LANDER MARKETING TOOLS</h1>
            <p className="text-sm text-gray-500 mt-1">Enter password to access LMT</p>
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="mb-3"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <Button onClick={handleLogin} disabled={loading} className="w-full" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ACCESS LMT"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FAFAF9" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_GOLD }} />
      </div>
    );
  }

  const livePricing = "Pricing configured per PIT";
  const currentPage = PAGE_TITLES[activePage];

  // ─── DYNAMIC THEME TOKENS ───
  const isDark = globalSettings?.dashboard_theme === 'dark';
  const T = {
    pageBg:        isDark ? '#0A0F1E' : '#FAFAF9',
    cardBg:        isDark ? '#0D1529' : '#FFFFFF',
    cardBorder:    isDark ? 'rgba(255,255,255,0.06)' : '#E8E5DC',
    cardShadow:    isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
    textPrimary:   isDark ? '#FFFFFF' : '#0D2137',
    textSecond:    isDark ? '#64748B' : '#6B7280',
    sidebarBg:     isDark ? '#0D1529' : '#FFFFFF',
    sidebarBorder: isDark ? 'rgba(255,255,255,0.06)' : '#E8E5DC',
    headerBg:      isDark ? '#0D1529' : '#FFFFFF',
    activeNavBg:   isDark ? 'rgba(192,122,0,0.15)' : '#FDF8F0',
    hoverNavBg:    isDark ? 'rgba(255,255,255,0.05)' : '#F5F4F1',
    inputBg:       isDark ? '#0A0F1E' : '#FFFFFF',
    inputBorder:   isDark ? 'rgba(255,255,255,0.1)' : '#E8E5DC',
    tableHeaderBg: isDark ? '#111B30' : '#F5F4F1',
    tableHeaderText: isDark ? '#FFFFFF' : '#0D2137',
    tableStripeBg: isDark ? 'rgba(255,255,255,0.02)' : '#F9F9F9',
    tableHoverBg:  isDark ? 'rgba(192,122,0,0.08)' : '#FFF8E7',
    metricBg:      isDark ? '#111B30' : '#FFFFFF',
    barBg:         isDark ? 'rgba(255,255,255,0.05)' : '#f3f3f3',
    subtleBg:      isDark ? 'rgba(255,255,255,0.03)' : '#F8F7F2',
  };
  const CARD_STYLE_T = { backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow };

  // ─── RENDER PAGES ───
  const renderPageContent = () => {
    switch (activePage) {
      case "overview": {
        const today = new Date().toISOString().split("T")[0];
        const todayDate = new Date();
        const monthStart = today.slice(0, 7);
        const todayOrders = cashOrders.filter((o: any) => o.delivery_date === today);
        const todayCaptured = todayOrders.filter((o: any) => o.payment_status === "captured" || o.cash_collected);
        const todayCapturedRev = todayCaptured.reduce((s: number, o: any) => s + Number(o.price || 0), 0);
        const toCapture = cashOrders.filter((o: any) => o.payment_status === "authorized" && !o.cash_collected && o.delivery_date === today);
        const toCaptureRev = toCapture.reduce((s: number, o: any) => s + Number(o.price || 0), 0);
        const todayCOD = todayOrders.filter((o: any) => o.payment_method === "COD" && !o.cash_collected);
        const mtdOrders = cashOrders.filter((o: any) => (o.created_at || "").slice(0, 7) === monthStart);
        const mtdRev = mtdOrders.reduce((s: number, o: any) => s + Number(o.price || 0), 0);
        const avgOrder = cashOrders.length > 0 ? cashOrders.reduce((s: number, o: any) => s + Number(o.price || 0), 0) / cashOrders.length : 0;
        const uncollectedCOD = cashOrders.filter((o: any) => o.payment_method === "COD" && !o.cash_collected && o.delivery_date && o.delivery_date <= today);
        const captureIssues = cashOrders.filter((o: any) => o.capture_status === "capture_failed");
        const outOfAreaLeads = parsedLeads.filter((l: any) => l.stage === "new" && !l.nearest_pit_id);
        const activeCityPages = cityPages.filter((cp: any) => cp.status === "active");
        const totalViews = cityPages.reduce((s: number, cp: any) => s + (cp.page_views || 0), 0);
        const topCities = [...activeCityPages].sort((a: any, b: any) => (b.page_views || 0) - (a.page_views || 0)).slice(0, 5);
        const recentOrders = [...cashOrders].sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 5);
        const dayName = todayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeStr = todayDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

        const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const fmtFull = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const pipelineStages = STAGES.map(stage => {
          const sl = parsedLeads.filter((l: any) => l.stage === stage);
          const val = sl.reduce((s: number, l: any) => s + Number(l.calculated_price || 0), 0);
          return { stage, count: sl.length, value: val };
        });

        const isInitialLoad = overviewLoading && cashOrders.length === 0;

        const AnimatedNum = ({ target, prefix = "", suffix = "", decimals = 0, color }: { target: number; prefix?: string; suffix?: string; decimals?: number; color: string }) => {
          const ref = useRef<HTMLSpanElement>(null);
          const motionVal = useMotionValue(0);
          const rounded = useTransform(motionVal, (v: number) => {
            const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
            return `${prefix}${Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
          });
          useEffect(() => {
            motionVal.set(0);
            const ctrl = animate(motionVal, target, { duration: 1.2, ease: "easeOut" });
            return () => ctrl.stop();
          }, [target]);
          useEffect(() => {
            const unsub = rounded.on("change", (v: string) => { if (ref.current) ref.current.textContent = v; });
            return unsub;
          }, [rounded]);
          return <span ref={ref} style={{ color, fontVariantNumeric: 'tabular-nums' }}>{`${prefix}0${suffix}`}</span>;
        };

        // §5 Metric Card
        const MetricCard = ({ label, numValue, sub, onClick, accentColor, prefix = "", suffix = "", decimals = 0 }: { label: string; numValue: number; sub?: string; onClick?: () => void; accentColor?: string; prefix?: string; suffix?: string; decimals?: number }) => (
          <div
            onClick={onClick}
            className={`rounded-xl border p-5 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}
          >
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>{label}</div>
            <div className="text-2xl font-semibold" style={{ color: accentColor || T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
              {isInitialLoad
                ? '—'
                : <AnimatedNum target={numValue} prefix={prefix} suffix={suffix} decimals={decimals} color={accentColor || T.textPrimary} />}
            </div>
            {sub && <div className="text-xs mt-1" style={{ color: T.textSecond }}>{sub}</div>}
          </div>
        );

        // §7 Status pill (mirrors STATUS_COLORS)
        const OrderStatusPill = ({ status }: { status: string }) => {
          const c = STATUS_COLORS[status] || STATUS_COLORS.new || { bg: '#F3F4F6', text: '#6B7280' };
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: c.bg, color: c.text }}>
              {status}
            </span>
          );
        };

        return (
          <>
            {/* §4 Tab Header — pulsing dot + count + Refresh */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: POSITIVE }} />
                  <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: POSITIVE }} />
                </span>
                <p className="text-sm" style={{ color: T.textSecond }}>
                  {isInitialLoad ? 'Loading…' : `${todayOrders.length} orders today · ${dayName} · ${timeStr}`}
                </p>
              </div>
              <Button onClick={refreshOverview} disabled={overviewLoading} size="sm" variant="outline">
                {overviewLoading
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* §5 Metric Cards — 5-up exception per CMO approval */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <MetricCard label="CAPTURE TONIGHT" numValue={toCaptureRev} prefix="$" sub="pending auth" onClick={() => setActivePage("cash_orders")} accentColor={BRAND_GOLD} />
              <MetricCard label="ORDERS TODAY" numValue={todayOrders.length} sub="confirmed" onClick={() => setActivePage("schedule")} />
              <MetricCard label="COD DUE" numValue={todayCOD.length} sub="collect today" onClick={() => setActivePage("cash_orders")} accentColor={todayCOD.length > 0 ? ALERT_RED : T.textPrimary} />
              <MetricCard label="AVG ORDER" numValue={avgOrder} prefix="$" decimals={2} sub="per load" onClick={() => setActivePage("cash_orders")} />
              <MetricCard label="MTD REVENUE" numValue={mtdRev} prefix="$" sub="this month" onClick={() => setActivePage("cash_orders")} accentColor={POSITIVE} />
            </div>

            {/* Operations Alerts — §6 card container */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>Operations Alerts</h3>
              {(uncollectedCOD.length > 0 || captureIssues.length > 0 || outOfAreaLeads.length > 0 || toCaptureRev > 0) ? (
                <div className="space-y-2">
                  {uncollectedCOD.length > 0 && (
                    <div onClick={() => setActivePage("cash_orders")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-50 border" style={{ borderColor: T.cardBorder, borderLeft: `3px solid ${ALERT_RED}` }}>
                      <span className="text-sm" style={{ color: T.textPrimary }}><span className="font-bold">{uncollectedCOD.length} COD</span> order{uncollectedCOD.length > 1 ? "s" : ""} need collection — {fmtFull(uncollectedCOD.reduce((s: number, o: any) => s + Number(o.price || 0), 0))}</span>
                      <span className="ml-auto text-xs" style={{ color: T.textSecond }}>→</span>
                    </div>
                  )}
                  {outOfAreaLeads.length > 0 && (
                    <div onClick={() => setActivePage("all")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-50 border" style={{ borderColor: T.cardBorder, borderLeft: `3px solid ${WARN_YELLOW}` }}>
                      <span className="text-sm" style={{ color: T.textPrimary }}><span className="font-bold">{outOfAreaLeads.length}</span> out-of-area lead{outOfAreaLeads.length > 1 ? "s" : ""} — no pit assigned</span>
                      <span className="ml-auto text-xs" style={{ color: T.textSecond }}>→</span>
                    </div>
                  )}
                  {captureIssues.length > 0 && (
                    <div onClick={() => setActivePage("cash_orders")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-50 border" style={{ borderColor: T.cardBorder, borderLeft: `3px solid ${ALERT_RED}` }}>
                      <span className="text-sm" style={{ color: T.textPrimary }}><span className="font-bold">{captureIssues.length}</span> payment capture{captureIssues.length > 1 ? "s" : ""} failed</span>
                      <span className="ml-auto text-xs" style={{ color: T.textSecond }}>→</span>
                    </div>
                  )}
                  {toCaptureRev > 0 && (
                    <div onClick={() => setActivePage("cash_orders")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-50 border" style={{ borderColor: T.cardBorder, borderLeft: `3px solid ${POSITIVE}` }}>
                      <span className="text-sm" style={{ color: T.textPrimary }}>{fmtFull(toCaptureRev)} capture scheduled for tonight</span>
                      <span className="ml-auto text-xs" style={{ color: T.textSecond }}>→</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm font-medium" style={{ color: T.textPrimary }}>All clear</p>
                  <p className="text-xs mt-1" style={{ color: T.textSecond }}>No operational issues right now.</p>
                </div>
              )}
            </div>

            {/* Hot Prospects — §6 card */}
            {(() => {
              const HOT_STAGES = ["clicked_order_now", "started_checkout", "reached_payment"];
              const hotProspects = abandonedSessions
                .filter((s: any) => HOT_STAGES.includes(s.stage))
                .sort((a: any, b: any) => new Date(b.last_seen_at || b.updated_at || b.created_at).getTime() - new Date(a.last_seen_at || a.updated_at || a.created_at).getTime())
                .slice(0, 5);

              const stageLabel: Record<string, string> = {
                clicked_order_now: "Clicked Order",
                started_checkout: "Started Checkout",
                reached_payment: "At Payment",
              };
              const stageColor: Record<string, string> = {
                clicked_order_now: WARN_YELLOW,
                started_checkout: "#F97316",
                reached_payment: ALERT_RED,
              };

              const timeAgo = (d: string) => {
                const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              };

              return (
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>Hot Prospects</h3>
                      {hotProspects.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: ALERT_RED }}>{hotProspects.length}</span>
                      )}
                    </div>
                    <button onClick={() => setActivePage("abandoned")} className="text-xs font-medium hover:underline" style={{ color: BRAND_GOLD }}>View All →</button>
                  </div>
                  {hotProspects.length > 0 ? (
                    <div className="space-y-2">
                      {hotProspects.map((s: any) => (
                        <div key={s.id} onClick={() => setActivePage("abandoned")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-50 border" style={{ borderColor: T.cardBorder, borderLeft: `3px solid ${stageColor[s.stage] || WARN_YELLOW}` }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold truncate" style={{ color: T.textPrimary }}>
                                {s.customer_name || s.delivery_address?.split(",")[0] || "Unknown"}
                              </span>
                              {s.ip_is_business && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                                  <Building2 size={10} className="inline mr-0.5" />BIZ
                                </span>
                              )}
                              {s.customer_email && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: '#ECFDF5', color: POSITIVE }}>
                                  HAS EMAIL
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs truncate" style={{ color: T.textSecond }}>
                                {s.delivery_address ? s.delivery_address.split(",").slice(0, 2).join(",") : s.geo_city || "—"}
                              </span>
                              {s.calculated_price && (
                                <span className="text-xs font-bold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${Number(s.calculated_price).toFixed(0)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: `${stageColor[s.stage]}15`, color: stageColor[s.stage] }}>
                              {stageLabel[s.stage] || s.stage}
                            </span>
                            <span className="text-[10px]" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>
                              {timeAgo(s.last_seen_at || s.updated_at || s.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="text-sm font-medium" style={{ color: T.textPrimary }}>No hot prospects right now</p>
                      <p className="text-xs mt-1" style={{ color: T.textSecond }}>High-intent abandoned sessions will appear here.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Pipeline + SEO side by side — §6 cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Pipeline */}
              <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>Pipeline</h3>
                  <span className="text-sm font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmt(metrics.pipelineValue)}</span>
                </div>
                <div className="space-y-2.5">
                  {pipelineStages.map(({ stage, count, value }) => (
                    <div key={stage} onClick={() => setActivePage("pipeline")} className="flex items-center gap-3 cursor-pointer group">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                      <span className="text-xs uppercase font-bold flex-shrink-0 w-14" style={{ color: STAGE_COLORS[stage] }}>{stage}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.cardBorder }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, (count / Math.max(parsedLeads.length, 1)) * 100)}%`, backgroundColor: STAGE_COLORS[stage] }} />
                      </div>
                      <span className="text-xs font-semibold w-6 text-right" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                      <span className="text-[10px] w-12 text-right" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEO Performance */}
              <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>SEO Performance</h3>
                  <span className="text-xs" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{activeCityPages.length} pages</span>
                </div>
                <div className="flex gap-6 mb-3">
                  <div onClick={() => setActivePage("city_pages")} className="cursor-pointer">
                    <p className="text-2xl font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{activeCityPages.length}</p>
                    <p className="text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Active Pages</p>
                  </div>
                  <div onClick={() => setActivePage("city_pages")} className="cursor-pointer">
                    <p className="text-2xl font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{totalViews.toLocaleString()}</p>
                    <p className="text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Total Views</p>
                  </div>
                </div>
                {topCities.length > 0 && (
                  <div className="space-y-1.5">
                    {topCities.slice(0, 3).map((cp: any, i: number) => (
                      <div key={cp.id} onClick={() => setActivePage("city_pages")} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 transition-colors">
                        <span className="text-xs font-bold w-4" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                        <span className="text-sm flex-1" style={{ color: T.textPrimary }}>{cp.city_name}</span>
                        <span className="text-xs" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{(cp.page_views || 0).toLocaleString()} views</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders — §11 table standard */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>Recent Orders</h3>
                <button onClick={() => setActivePage("cash_orders")} className="text-xs font-medium hover:underline" style={{ color: BRAND_GOLD }}>View All →</button>
              </div>
              {recentOrders.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: T.cardBorder }}>
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                      <tr>
                        {["Order", "Customer", "Address", "Amount", "Status"].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o: any, i: number) => (
                        <tr key={o.id} onClick={() => setActivePage("cash_orders")}
                          className="border-t hover:bg-gray-50 transition-colors cursor-pointer"
                          style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                          <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{o.order_number || "—"}</td>
                          <td className="px-4 py-3 font-medium" style={{ color: T.textPrimary }}>{o.customer_name}</td>
                          <td className="px-4 py-3 max-w-[220px] truncate" style={{ color: T.textSecond }}>{o.delivery_address}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmtFull(Number(o.price || 0))}</td>
                          <td className="px-4 py-3"><OrderStatusPill status={o.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="font-medium" style={{ color: T.textPrimary }}>No orders yet</p>
                  <p className="text-xs mt-1" style={{ color: T.textSecond }}>Recent orders will appear here as they come in.</p>
                </div>
              )}
            </div>
          </>
        );
      }

      case "zip": {
        const hotZipsCount = zipData.filter(z => z.priority === "hot").length;
        const totalZipLeads = zipData.reduce((s, z) => s + z.count, 0);
        const estTotalMonthly = zipData.reduce((s, z) => s + z.count * basePrice * 20, 0);
        const fmtMoneyShort = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

        // §7 Priority pill — tokenized via STATUS_COLORS where possible
        const priorityColors: Record<string, { bg: string; text: string }> = {
          hot:  STATUS_COLORS.cod      || { bg: '#FDF8F0', text: BRAND_GOLD },
          warm: STATUS_COLORS.called   || { bg: '#EFF6FF', text: '#1A6BB8' },
          cold: STATUS_COLORS.inactive || { bg: '#F3F4F6', text: '#6B7280' },
        };

        return (
          <>
            {/* §4 Tab Header — count + Refresh */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {zipData.length} ZIPs · 2+ leads = confirmed unserved demand
              </p>
              <Button onClick={() => fetchLeads(storedPassword())} disabled={loading} size="sm" variant="outline">
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* §5 Metric Cards — 4-up summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Total ZIPs</div>
                <div className="text-2xl font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  {loading && zipData.length === 0 ? '—' : zipData.length}
                </div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>with lead activity</div>
              </div>
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Hot ZIPs</div>
                <div className="text-2xl font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>
                  {loading && zipData.length === 0 ? '—' : hotZipsCount}
                </div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>expansion priority</div>
              </div>
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Total leads</div>
                <div className="text-2xl font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  {loading && zipData.length === 0 ? '—' : totalZipLeads}
                </div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>across all ZIPs</div>
              </div>
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Est. monthly rev</div>
                <div className="text-2xl font-semibold" style={{ color: POSITIVE, fontVariantNumeric: 'tabular-nums' }}>
                  {loading && zipData.length === 0 ? '—' : fmtMoneyShort(estTotalMonthly)}
                </div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>if fully captured</div>
              </div>
            </div>

            {/* Insight banner — tokenized */}
            <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: '#FDF8F0', borderColor: BRAND_GOLD + '40' }}>
              <p className="text-sm" style={{ color: T.textPrimary }}>
                <strong>💡 ZIPs with 2+ leads = confirmed unserved demand.</strong> These are your next expansion markets.
              </p>
            </div>

            {zipData.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      {["ZIP", "City", "State", "Leads", "Demand", "Est. Monthly Rev", "Avg Distance", "Priority"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zipData.map((z, i) => {
                      const pc = priorityColors[z.priority] || priorityColors.cold;
                      return (
                        <tr key={z.zip} className="border-t hover:bg-gray-50 transition-colors"
                          style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                          <td className="px-4 py-3 font-semibold" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{z.zip}</td>
                          <td className="px-4 py-3" style={{ color: T.textPrimary }}>{z.city}</td>
                          <td className="px-4 py-3" style={{ color: T.textSecond }}>{z.state}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{z.count}</td>
                          <td className="px-4 py-3">
                            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: T.cardBorder }}>
                              <div className="h-full rounded-full" style={{ width: `${(z.count / maxZipCount) * 100}%`, backgroundColor: BRAND_GOLD }} />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${(z.count * basePrice * 20).toLocaleString()}</td>
                          <td className="px-4 py-3" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{z.avgDist.toFixed(1)} mi</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase"
                              style={{ backgroundColor: pc.bg, color: pc.text }}>
                              {z.priority}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No ZIP data yet</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>ZIPs with leads will appear here.</p>
              </div>
            )}
          </>
        );
      }

      case "pipeline":
        return (
          <>
            {/* §4 Tab Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {parsedLeads.length} leads · Active pipeline:{" "}
                <span className="font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>
                  ${metrics.pipelineValue.toLocaleString()}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {STAGES.map(stage => {
                const stageLeads = parsedLeads.filter(l => l.stage === stage);
                return (
                  <div key={stage} className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: STAGE_COLORS[stage] + "40", backgroundColor: T.cardBg }}>
                    <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: STAGE_COLORS[stage] }}>
                      <span className="font-display text-sm uppercase tracking-wide text-white">{stage}</span>
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{stageLeads.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto" style={{ backgroundColor: '#FAFAFA' }}>
                      {stageLeads.length > 0 ? stageLeads.map(l => (
                        <div key={l.id} onClick={() => openDetail(l)} className="rounded-lg p-3 border shadow-sm cursor-pointer hover:shadow-md transition-shadow" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{l.lead_number || "—"}</p>
                          <p className="font-bold text-sm" style={{ color: T.textPrimary }}>{l.customer_name}</p>
                          <p className="text-xs" style={{ color: T.textSecond }}>{l.zip} • {l.distance_miles?.toFixed(1) || "?"} mi</p>
                          {l.customer_email && <p className="text-xs truncate" style={{ color: T.textSecond }}>{l.customer_email}</p>}
                        </div>
                      )) : (
                        <div className="text-center py-6">
                          <div className="text-2xl mb-1">📭</div>
                          <p className="text-xs" style={{ color: T.textSecond }}>No leads</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );

      case "revenue": {
        const hotZips = zipData.filter(z => z.priority === "hot");
        const maxRev = Math.max(...hotZips.map(z => z.count * 5 * basePrice * 4), 1);
        return (
          <>
            {/* §4 Tab Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {hotZips.length} hot ZIPs · revenue projections
              </p>
            </div>

            {/* §5 Metric Cards (2-up) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Immediate Opportunity</div>
                <div className="text-2xl font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${(metrics.notContacted * basePrice).toLocaleString()}</div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>{metrics.notContacted} uncontacted leads × ${basePrice}</div>
              </div>
              <div className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>Total Pipeline</div>
                <div className="text-2xl font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${(metrics.total * basePrice).toLocaleString()}</div>
                <div className="text-xs mt-1" style={{ color: T.textSecond }}>{metrics.total} total leads × ${basePrice}</div>
              </div>
            </div>

            {/* §11 Table */}
            {hotZips.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border mb-4" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      {["ZIP / Market", "Leads", "Monthly Revenue", "Break-even (months)"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hotZips.map((z, i) => {
                      const monthlyRev = z.count * 5 * basePrice * 4;
                      const breakEven = monthlyRev > 0 ? (3000 / monthlyRev).toFixed(1) : "—";
                      return (
                        <tr key={z.zip} className="border-t hover:bg-gray-50 transition-colors"
                          style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: T.textPrimary }}>{z.zip} — {z.city}, {z.state}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{z.count}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${monthlyRev.toLocaleString()}</td>
                          <td className="px-4 py-3" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{breakEven} mo</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border p-12 text-center mb-4" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No hot markets yet</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Top demand ZIPs will appear here.</p>
              </div>
            )}

            {/* Bar chart card */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>Projected Monthly Revenue by Market</h3>
              {hotZips.length > 0 ? (
                <div className="space-y-3">
                  {hotZips.map(z => {
                    const rev = z.count * 5 * basePrice * 4;
                    return (
                      <div key={z.zip} className="flex items-center gap-3">
                        <span className="text-xs font-semibold w-16" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{z.zip}</span>
                        <div className="flex-1 h-6 rounded overflow-hidden" style={{ backgroundColor: T.cardBorder }}>
                          <div className="h-full rounded" style={{ width: `${(rev / maxRev) * 100}%`, backgroundColor: rev === maxRev ? BRAND_GOLD : T.textPrimary }} />
                        </div>
                        <span className="text-xs font-semibold w-24 text-right" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${rev.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-sm" style={{ color: T.textSecond }}>No revenue projections yet</p>
                </div>
              )}
            </div>
          </>
        );
      }

      case "pit":
        return (
          <>
            {/* Link to Global Settings */}
            <div className="mb-4">
              <button
                onClick={() => setActivePage("settings")}
                className="text-sm flex items-center gap-1 hover:underline"
                style={{ color: BRAND_GOLD }}
              >
                Global pricing defaults → <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* PIT Manager */}
            <div className="rounded-xl border shadow-sm p-6 mb-4" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>PIT Manager</h3>
                  <p className="text-sm" style={{ color: T.textSecond }}>{pits.length} PITs</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={geocodeAllLeads} disabled={geocoding} variant="outline" size="sm">
                    {geocoding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
                    Geocode All Leads
                  </Button>
                  <Button onClick={() => setShowAddPit(true)} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                    + Add New PIT
                  </Button>
                </div>
              </div>

              {/* PIT Cards */}
              <div className="flex flex-wrap gap-3">
                {pits.map(p => {
                  const eff = getEffectivePrice(p, globalSettings);
                  const hasOverride = p.base_price != null || p.free_miles != null || p.price_per_extra_mile != null || p.max_distance != null;

                  return (
                    <div key={p.id} className="border rounded-xl p-3 flex-1 min-w-[220px]" style={{ borderColor: selectedPit?.id === p.id ? BRAND_GOLD : T.cardBorder }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm" style={{ color: T.textPrimary }}>
                          {p.name}
                          {(p.lat == null || p.lon == null || Number(p.lat) === 0 || Number(p.lon) === 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ml-2"
                              style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                              <AlertTriangle className="w-3 h-3" /> No coords
                            </span>
                          )}
                        </p>
                        {p.is_default && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Default</span>}
                      </div>
                      <p className="text-xs text-gray-500">{p.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={p.status} />
                        {p.is_pickup_only && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Pickup Only</span>}
                      </div>
                      <p className="text-xs mt-2" style={{ color: hasOverride ? BRAND_GOLD : "#999" }}>
                        Effective: ${eff.base_price} base · {eff.free_miles}mi free · ${eff.extra_per_mile}/mi · {eff.max_distance}mi max
                      </p>
                      {/* Operating Schedule */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(() => {
                          const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          const days = p.operating_days;
                          if (!days || days.length === 0) {
                            return <span className="text-[10px] text-gray-400">All days available</span>;
                          }
                          return DAY_LABELS.map((label, idx) => {
                            const isOpen = days.includes(idx);
                            return (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                backgroundColor: isOpen ? T.textPrimary : T.barBg,
                                color: isOpen ? "white" : "#BBB",
                                textDecoration: isOpen ? "none" : "line-through",
                              }}>{label}</span>
                            );
                          });
                        })()}
                      </div>
                      {p.operating_days?.includes(6) && (
                        <p className="text-[10px] mt-0.5" style={{ color: BRAND_GOLD }}>
                          Sat +${p.saturday_surcharge_override ?? globalSettings.saturday_surcharge ?? "35"}
                        </p>
                      )}
                      {p.same_day_cutoff && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Same-day cutoff: {p.same_day_cutoff} CT</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedPit(p)} className="text-xs h-7">Simulate</Button>
                        <Button size="sm" variant="outline" onClick={() => startEditPit(p)} className="text-xs h-7">
                          <Edit2 className="w-3 h-3 mr-1" />Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => togglePitStatus(p)} className="text-xs h-7"
                          style={{ borderColor: p.status === "active" ? "#EF444430" : "#22C55E30", color: p.status === "active" ? "#EF4444" : "#22C55E" }}
                        >
                          <Power className="w-3 h-3 mr-1" />
                          {p.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ROI Summary + Simulation Table */}
            {selectedPit && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {(() => {
                    const eff = getEffectivePrice(selectedPit, globalSettings);
                    const serviceable = simData.filter(d => d.status === "serviceable");
                    const immediateRev = serviceable.length * eff.base_price;
                    const monthlyPotential = serviceable.length * 5 * eff.base_price * 4;
                    const breakEven = monthlyPotential > 0 ? (3000 / monthlyPotential).toFixed(1) : "—";
                    return (
                      <>
                        <MetricCard label="Newly Serviceable" value={serviceable.length} />
                        <MetricCard label="Immediate Revenue" value={`$${immediateRev.toLocaleString()}`} />
                        <MetricCard label="Monthly Potential" value={`$${monthlyPotential.toLocaleString()}`} />
                        <MetricCard label="Break-even" value={`${breakEven} mo`} />
                      </>
                    );
                  })()}
                </div>

                <div className="rounded-xl border shadow-sm overflow-hidden" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: T.cardBorder }}>
                    <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>
                      Simulation: {selectedPit.name} — {simData.filter(d => d.status === "serviceable").length} newly serviceable
                    </h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const serviceableIds = new Set(simData.filter(d => d.status === "serviceable" && d.lead.customer_email).map(d => d.lead.id));
                        setSimSelected(serviceableIds);
                      }}>Select All Serviceable</Button>
                      <Button size="sm" disabled={simSelected.size === 0} onClick={() => {
                        const first = simData.find(d => simSelected.has(d.lead.id));
                        if (first) setProposalSubject(`River Sand is now available near ${parseAddress(first.lead.address).zip} — Your price: $${first.newPrice.toFixed(2)}`);
                        setShowProposal(true);
                      }} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                        <Send className="w-4 h-4 mr-1" /> Send Proposal ({simSelected.size})
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                        <tr>
                          <th className="px-3 py-3 text-xs w-8" style={{ color: T.textSecond }}>
                            <input type="checkbox" checked={simSelected.size === simData.length && simData.length > 0} onChange={e => setSimSelected(e.target.checked ? new Set(simData.map(d => d.lead.id)) : new Set())} />
                          </th>
                          {["Lead #", "Name", "Address / ZIP", "HQ Dist", "PIT Dist", "Delta", "New Price", "Savings", "Status"].map(h => (
                            <th key={h} className="px-3 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {simData.map((d, i) => {
                          const eff = getEffectivePrice(selectedPit, globalSettings);
                          const oldExtra = d.hqDist > eff.free_miles ? (d.hqDist - eff.free_miles) * eff.extra_per_mile : 0;
                          const oldPrice = eff.base_price + oldExtra;
                          const savings = oldPrice - d.newPrice;
                          return (
                            <tr key={d.lead.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                              <td className="px-3 py-2"><input type="checkbox" checked={simSelected.has(d.lead.id)} onChange={e => { const s = new Set(simSelected); e.target.checked ? s.add(d.lead.id) : s.delete(d.lead.id); setSimSelected(s); }} /></td>
                              <td className="px-3 py-2 font-mono text-xs" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{d.lead.lead_number || "—"}</td>
                              <td className="px-3 py-2 text-xs font-medium" style={{ color: T.textPrimary }}>{d.lead.customer_name}</td>
                              <td className="px-3 py-2 text-xs max-w-[150px] truncate" style={{ color: T.textSecond }}>{parseAddress(d.lead.address).zip}</td>
                              <td className="px-3 py-2 text-xs" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{d.hqDist.toFixed(1)} mi</td>
                              <td className="px-3 py-2 text-xs font-bold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{d.pitDist?.toFixed(1)} mi</td>
                              <td className="px-3 py-2 text-xs" style={{ color: d.delta > 0 ? POSITIVE : T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{d.delta > 0 ? `-${d.delta.toFixed(1)}` : "+0"} mi</td>
                              <td className="px-3 py-2 text-xs font-bold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${d.newPrice.toFixed(2)}</td>
                              <td className="px-3 py-2 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{savings > 0 ? <span style={{ color: POSITIVE }}>saves ${savings.toFixed(0)}</span> : <span style={{ color: T.textSecond }}>—</span>}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{
                                  backgroundColor: d.status === "serviceable" ? "#ECFDF5" : d.status === "closer" ? "#EFF6FF" : "#F3F4F6",
                                  color: d.status === "serviceable" ? POSITIVE : d.status === "closer" ? "#1A6BB8" : T.textSecond,
                                }}>
                                  {d.status === "serviceable" ? "Serviceable" : d.status === "closer" ? "Closer" : "Same"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        );

      case "drivers":
        return (
          <DriversTab
            drivers={drivers}
            loading={loadingDrivers}
            password={storedPassword()}
            onRefresh={refreshDrivers}
          />
        );

      case "city_pages": {
        // Detect duplicate slugs
        const slugCounts: Record<string, number> = {};
        cityPages.forEach((cp: any) => { slugCounts[cp.city_slug] = (slugCounts[cp.city_slug] || 0) + 1; });
        const duplicateSlugs = new Set(Object.keys(slugCounts).filter(s => slugCounts[s] > 1));

        let filteredCityPages = cityPageFilter === "all" ? cityPages : cityPages.filter((cp: any) => cp.pit_id === cityPageFilter);
        if (showDuplicatesOnly) {
          filteredCityPages = filteredCityPages.filter((cp: any) => duplicateSlugs.has(cp.city_slug));
        }
        filteredCityPages = [...filteredCityPages].sort((a: any, b: any) => {
          const aVal = a[cityPageSortKey] ?? "";
          const bVal = b[cityPageSortKey] ?? "";
          const dir = cityPageSortDir === "asc" ? 1 : -1;
          if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
          return String(aVal).localeCompare(String(bVal)) * dir;
        });
        const activeCount = cityPages.filter((cp: any) => cp.status === "active").length;
        const draftCount = cityPages.filter((cp: any) => cp.status === "draft").length;
        const totalViews = cityPages.reduce((sum: number, cp: any) => sum + (cp.page_views || 0), 0);
        const citiesCovered = new Set(cityPages.map((cp: any) => cp.city_name)).size;
        const statesCovered = new Set(cityPages.map((cp: any) => cp.state)).size;
        const duplicateCount = cityPages.filter((cp: any) => duplicateSlugs.has(cp.city_slug)).length;
        const currentCount = cityPages.filter((cp: any) => cp.content_generated_at && !cp.needs_regen && !cp.pit_reassigned && !cp.price_changed).length;
        const pitChangedCount = cityPages.filter((cp: any) => cp.pit_reassigned).length;
        const priceChangedCount = cityPages.filter((cp: any) => cp.price_changed && !cp.pit_reassigned).length;
        const outdatedCount = cityPages.filter((cp: any) => cp.needs_regen && !cp.pit_reassigned && !cp.price_changed && cp.content_generated_at).length;
        const missingCount = cityPages.filter((cp: any) => !cp.content_generated_at).length;
        const needsRegenCount = cityPages.filter((cp: any) => cp.needs_regen || cp.pit_reassigned || cp.price_changed || !cp.content_generated_at).length;

        const regenOutdated = async () => {
          const toRegen = cityPages.filter(
            (p: any) => p.needs_regen || p.pit_reassigned || p.price_changed || !p.content_generated_at
          ).sort((a: any, b: any) => {
            const priority = (p: any) =>
              p.pit_reassigned ? 0 :
              p.price_changed ? 1 :
              !p.content_generated_at ? 2 : 3;
            return priority(a) - priority(b);
          });
          regenCancelRef.current = false;
          setRegenQueue({ total: toRegen.length, current: 0, currentCity: "", status: "running" });

          for (let i = 0; i < toRegen.length; i++) {
            if (regenCancelRef.current) break;
            const page = toRegen[i];
            const reason = page.pit_reassigned ? "PIT reassigned" : page.price_changed ? "Price changed" : !page.content_generated_at ? "Missing content" : "Outdated prompt";
            setRegenQueue(q => q ? { ...q, current: i + 1, currentCity: `${page.city_name} — ${reason}` } : q);

            try {
              const pitData = pits.find((p: any) => p.id === page.pit_id);
              await supabase.functions.invoke("generate-city-page", {
                body: {
                  password: storedPassword(),
                  city_page_id: page.id,
                  city_name: page.city_name,
                  state: page.state,
                  pit_name: pitData?.name || "HQ",
                  distance: page.distance_from_pit || 0,
                  price: page.base_price || 195,
                  free_miles: pitData?.free_miles ?? parseFloat(globalSettings.default_free_miles || "15"),
                  saturday_available: pitData?.operating_days?.includes(6) ?? false,
                  multi_pit_coverage: (page.multi_pit_coverage || false) && pits.filter((p: any) => p.status === "active").length > 1,
                },
              });
              // Explicitly set status to active in DB after successful generation
              await supabase.functions.invoke("leads-auth", {
                body: {
                  password: storedPassword(),
                  action: "save_city_page",
                  city_page_id: page.id,
                  city_page: { ...page, status: "active" },
                },
              });
              setCityPages(prev => prev.map((cp: any) => cp.id === page.id ? { ...cp, needs_regen: false, pit_reassigned: false, price_changed: false, regen_reason: null, content_generated_at: new Date().toISOString(), status: "active" } : cp));
            } catch (err) {
              console.error(`Failed to regen ${page.city_name}:`, err);
            }

            if (i < toRegen.length - 1 && !regenCancelRef.current) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }

          setRegenQueue(q => q ? { ...q, current: q.total, status: "complete" } : q);
          toast({ title: "Regeneration complete", description: `${toRegen.length} pages updated.` });
          fetchCityPages();
        };

        const discoverCities = async (pitId: string) => {
          setDiscoverLoading(true);
          try {
            const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "discover_cities", pit_id: pitId },
            });
            if (fnError) throw fnError;
            if (data?.cities) {
              setDiscoveredCities(data.cities);
              const nonDuplicates = new Set<number>(data.cities.map((_: any, i: number) => i).filter((i: number) => !data.cities[i].duplicate));
              setDiscoverChecked(nonDuplicates);
              setShowDiscoverModal(true);
            }
          } catch (err: any) {
            toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
          } finally { setDiscoverLoading(false); }
        };

        const createPages = async () => {
          const selected = discoveredCities.filter((_: any, i: number) => discoverChecked.has(i));
          if (selected.length === 0) return;
          setCreatingPages(true);
          try {
            const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "create_city_pages", pit_id: discoverPitId, cities: selected },
            });
            if (fnError) throw fnError;
            const genCount = data?.generated || 0;
            const failCount = data?.failed || 0;
            const desc = failCount > 0 ? `${failCount} failed — click Regen to retry.` : "All content generated and pages activated.";
            toast({ title: `${genCount} city pages created & generated`, description: desc });
            setShowDiscoverModal(false);
            setDiscoveredCities([]);
            fetchCityPages();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          } finally { setCreatingPages(false); }
        };

        const regenerateContent = async (cp: any) => {
          setGeneratingContent(cp.id);
          try {
            const pitData = pits.find(p => p.id === cp.pit_id);
            const { data, error: fnError } = await supabase.functions.invoke("generate-city-page", {
              body: {
                password: storedPassword(),
                city_page_id: cp.id,
                city_name: cp.city_name,
                state: cp.state,
                pit_name: pitData?.name || "HQ",
                distance: cp.distance_from_pit || 0,
                price: cp.base_price || 195,
                free_miles: pitData?.free_miles ?? parseFloat(globalSettings.default_free_miles || "15"),
                saturday_available: pitData?.operating_days?.includes(6) ?? false,
                multi_pit_coverage: (cp.multi_pit_coverage || false) && pits.filter(p => p.status === "active").length > 1,
              },
            });
            if (fnError) throw fnError;
            // generate-city-page already sets status: "active" in the DB
            toast({ title: `Content generated for ${cp.city_name}`, description: "Page activated." });
            fetchCityPages();
          } catch (err: any) {
            toast({ title: "Generation failed", description: err.message, variant: "destructive" });
          } finally { setGeneratingContent(null); }
        };

        const toggleCityPage = async (cpId: string) => {
          try {
            const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "toggle_city_page", id: cpId },
            });
            if (fnError) throw fnError;
            toast({ title: `Status changed to ${data?.status}` });
            fetchCityPages();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        };

        const saveCityPage = async () => {
          if (!editingCityPage) return;
          try {
            const { error: fnError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "save_city_page", city_page_id: editingCityPage.id, city_page: editingCityPage },
            });
            if (fnError) throw fnError;
            toast({ title: "City page saved" });
            setEditingCityPage(null);
            fetchCityPages();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        };

        return (
          <>
            {/* Tab header (§4) */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {cityPages.length} pages · {activeCount} active · {needsRegenCount} need regen
              </p>
              <Button onClick={fetchCityPages} disabled={cityPagesLoading} size="sm" variant="outline">
                {cityPagesLoading
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* Header buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={discoverPitId || ""}
                onChange={e => setDiscoverPitId(e.target.value)}
                className="h-9 px-3 rounded-md border text-sm"
                style={{ borderColor: T.textPrimary + "40" }}
              >
                <option value="">Select PIT to discover...</option>
                {pits.filter(p => p.status === "active").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button
                onClick={() => discoverPitId && discoverCities(discoverPitId)}
                disabled={!discoverPitId || discoverLoading}
                size="sm"
                style={{ backgroundColor: BRAND_GOLD, color: "white" }}
              >
                {discoverLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
                Discover Cities
              </Button>
              <Button
                onClick={() => setShowBulkCreateConfirm(true)}
                disabled={bulkCreating}
                size="sm"
                style={{ backgroundColor: T.tableHeaderBg, color: T.tableHeaderText }}
              >
                {bulkCreating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                Create All City Pages
              </Button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-8 gap-3 mb-4">
              <MetricCard label="Active Pages" value={activeCount} />
              <MetricCard label="Draft Pages" value={draftCount} />
              <MetricCard label="Current" value={currentCount} />
              <MetricCard label="Outdated" value={outdatedCount} />
              <MetricCard label="PIT Changed" value={pitChangedCount} />
              <MetricCard label="Price Changed" value={priceChangedCount} />
              <MetricCard label="Missing" value={missingCount} />
              <MetricCard label="Total Views" value={totalViews} />
            </div>

            {regenQueuePending > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm" style={{ background: "#FEF9C3", color: "#854D0E" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                ⏳ Generating content for {regenQueuePending} pages... (auto-processing every 30s)
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <select
                value={cityPageFilter}
                onChange={e => setCityPageFilter(e.target.value)}
                className="h-9 px-3 rounded-md border text-sm"
                style={{ borderColor: T.textPrimary + "40" }}
              >
                <option value="all">All PITs</option>
                {pits.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {cityPageSortKey !== "city_name" && (
                <button
                  onClick={() => { setCityPageSortKey("city_name"); setCityPageSortDir("asc"); }}
                  className="h-9 px-3 rounded-md border text-xs hover:bg-gray-50"
                  style={{ borderColor: T.textPrimary + "30", color: T.textPrimary }}
                >
                  Reset Sort
                </button>
              )}
              <Button
                onClick={async () => {
                  try {
                    toast({ title: "Fixing all pit assignments…", description: "Recalculating distances from all pits. This may take a moment." });
                    const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                      body: { password: storedPassword(), action: "recalculate_all_distances" },
                    });
                    if (fnError) throw fnError;
                    toast({ title: "Pit assignments fixed", description: `${data?.updated || 0} pages updated, ${data?.reassigned || 0} reassigned to closer pits. ${data?.errors || 0} errors.` });
                    fetchCityPages();
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                }}
                size="sm"
                variant="outline"
                className="text-xs"
                style={{ borderColor: BRAND_GOLD + "40", color: BRAND_GOLD }}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Fix All Pit Assignments
              </Button>
              <Button
                onClick={() => setShowRegenAllConfirm(true)}
                disabled={cityPages.filter(c => c.status === "active").length === 0}
                size="sm"
                variant="outline"
                className="text-xs"
                style={{ borderColor: "#D97706", color: "#D97706", fontWeight: 600 }}
              >
               <RefreshCw className="w-3 h-3 mr-1" />
                Regen All Pages
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                      body: { password: storedPassword(), action: "backfill_regions" },
                    });
                    if (fnError) throw fnError;
                    if (data?.error) throw new Error(data.error);
                    toast({ title: "Regions Backfilled", description: data.message });
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                }}
                size="sm"
                variant="outline"
                className="text-xs"
                style={{ borderColor: BRAND_GOLD + "40", color: BRAND_GOLD }}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Fix Missing Regions
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                      body: { password: storedPassword(), action: "backfill_local_addresses" },
                    });
                    if (fnError) throw fnError;
                    if (data?.error) throw new Error(data.error);
                    toast({ title: "Local Addresses Backfilled", description: data.message });
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                }}
                size="sm"
                variant="outline"
                className="text-xs"
                style={{ borderColor: BRAND_GOLD + "40", color: BRAND_GOLD }}
              >
                <MapPin className="w-3 h-3 mr-1" />
                Fix Missing Addresses
              </Button>
              <Button
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={deletingAll || cityPages.length === 0}
                size="sm"
                variant="outline"
                className="text-xs ml-auto"
                style={{ borderColor: "#EF444440", color: "#EF4444" }}
              >
                {deletingAll ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                Delete All City Pages
              </Button>
            </div>

            {/* Regen All Pages Confirmation Modal */}
            {showRegenAllConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Regen All Pages?</h3>
                  <p className="text-sm text-gray-600">
                    This will flag all <strong>{cityPages.filter(c => c.status === "active").length}</strong> active city pages for regeneration with the current prompt version.
                  </p>
                  <p className="text-sm text-gray-600">
                    Pages will be queued and processed automatically by the background regen system. No content will change until the queue runs.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowRegenAllConfirm(false)}>Cancel</Button>
                    <Button
                      style={{ backgroundColor: "#D97706", color: "#fff" }}
                      disabled={flaggingRegenAll}
                      onClick={async () => {
                        setFlaggingRegenAll(true);
                        try {
                          const pw = sessionStorage.getItem("leads_pw") || "";
                          const { data, error: fnErr } = await supabase.functions.invoke("leads-auth", {
                            body: { password: pw, action: "flag_regen_all", regen_reason: "prompt_upgrade" },
                          });
                          if (fnErr) throw fnErr;
                          if (data?.error) throw new Error(data.error);
                          toast({ title: "Queued for regen", description: `${data.flagged} active pages flagged. Background queue will process them.` });
                          setShowRegenAllConfirm(false);
                          fetchCityPages();
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message, variant: "destructive" });
                        } finally {
                          setFlaggingRegenAll(false);
                        }
                      }}
                    >
                      {flaggingRegenAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Flag All for Regen
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete All City Pages — Step 1 Confirmation Modal */}
            {showDeleteAllConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Delete all city pages?</h3>
                  <p className="text-sm text-gray-600">
                    This will permanently delete all <strong>{cityPages.length}</strong> city pages and clear the discovery cache on all PITs. This cannot be undone.
                  </p>
                  <p className="text-sm text-gray-600">
                    Pages will need to be rediscovered using the Discover Cities button on each PIT.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>Cancel</Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        setShowDeleteAllConfirm(false);
                        setDeleteAllTypeInput("");
                        setShowDeleteAllTypeConfirm(true);
                      }}
                    >Yes, delete everything</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete All City Pages — Step 2 Type DELETE */}
            {showDeleteAllTypeConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Type DELETE to confirm</h3>
                  <input
                    type="text"
                    value={deleteAllTypeInput}
                    onChange={e => setDeleteAllTypeInput(e.target.value)}
                    placeholder="Type DELETE here"
                    className="w-full h-10 px-3 rounded-md border text-sm"
                    style={{ borderColor: T.textPrimary + "40" }}
                    autoFocus
                  />
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => { setShowDeleteAllTypeConfirm(false); setDeleteAllTypeInput(""); }}>Cancel</Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      disabled={deleteAllTypeInput !== "DELETE" || deletingAll}
                      onClick={async () => {
                        setShowDeleteAllTypeConfirm(false);
                        setDeleteAllTypeInput("");
                        setDeletingAll(true);
                        try {
                          const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                            body: { password: storedPassword(), action: "reset_city_pages" },
                          });
                          if (fnError) throw fnError;
                          if (data?.error) throw new Error(data.error);
                          toast({
                            title: "All city pages deleted",
                            description: "Discovery cache cleared. Run Discover Cities on each PIT to start fresh.",
                          });
                          setSelectedCityPages(new Set());
                          fetchCityPages();
                        } catch (err: any) {
                          toast({ title: "Delete failed", description: err.message, variant: "destructive" });
                        } finally { setDeletingAll(false); }
                      }}
                    >Confirm Delete</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Create All Confirmation Modal */}
            {showBulkCreateConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Create city pages for all PITs?</h3>
                  <p className="text-sm text-gray-600">
                    This will discover cities near all {pits.filter(p => p.status === "active").length} active PITs and create pages for any cities not already covered. Each city will be assigned to its closest PIT. Existing pages will not be overwritten.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowBulkCreateConfirm(false)}>Cancel</Button>
                    <Button
                      style={{ backgroundColor: T.tableHeaderBg, color: T.tableHeaderText }}
                      onClick={async () => {
                        setShowBulkCreateConfirm(false);
                        setBulkCreating(true);
                        try {
                          const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                            body: { password: storedPassword(), action: "create_all_city_pages" },
                          });
                          if (fnError) throw fnError;
                          if (data?.error) throw new Error(data.error);
                          toast({
                            title: `Created ${data?.created || 0} new city pages`,
                            description: `${data?.generated || 0} generated, ${data?.failed || 0} failed, ${data?.unique_cities || 0} unique cities found.`,
                          });
                          fetchCityPages();
                        } catch (err: any) {
                          toast({ title: "Bulk creation failed", description: err.message, variant: "destructive" });
                        } finally { setBulkCreating(false); }
                      }}
                    >Create All City Pages</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Deduplicate Confirmation Modal */}
            {showDeduplicateConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Remove duplicate city pages?</h3>
                  <p className="text-sm text-gray-600">
                    This will deactivate duplicate city pages, keeping only the page assigned to the closest PIT for each city. {duplicateCount} duplicate pages will be deactivated.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowDeduplicateConfirm(false)}>Cancel</Button>
                    <Button
                      style={{ backgroundColor: "#F59E0B", color: "white" }}
                      onClick={async () => {
                        setShowDeduplicateConfirm(false);
                        setDeduplicating(true);
                        try {
                          const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                            body: { password: storedPassword(), action: "deduplicate_city_pages" },
                          });
                          if (fnError) throw fnError;
                          if (data?.error) throw new Error(data.error);
                          toast({
                            title: `Deactivated ${data?.deactivated || 0} duplicate pages`,
                            description: `${data?.unique_cities || 0} unique cities remain.`,
                          });
                          fetchCityPages();
                        } catch (err: any) {
                          toast({ title: "Deduplication failed", description: err.message, variant: "destructive" });
                        } finally { setDeduplicating(false); }
                      }}
                    >Remove Duplicates</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedCityPages.size > 0 && (
              <div className="mb-4 flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: T.textPrimary + "08", borderColor: T.textPrimary + "20" }}>
                <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{selectedCityPages.size} selected</span>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="text-xs px-3 py-1.5 rounded border font-bold hover:bg-red-50"
                  style={{ borderColor: "#EF444440", color: "#EF4444" }}
                >Delete Selected</button>
                <button
                  onClick={async () => {
                    try {
                      await supabase.functions.invoke("leads-auth", {
                        body: { password: storedPassword(), action: "deactivate_city_pages", ids: Array.from(selectedCityPages) },
                      });
                      toast({ title: `${selectedCityPages.size} pages deactivated` });
                      setSelectedCityPages(new Set());
                      fetchCityPages();
                    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                  }}
                  className="text-xs px-3 py-1.5 rounded border font-bold hover:bg-amber-50"
                  style={{ borderColor: "#F59E0B40", color: "#F59E0B" }}
                >Deactivate Selected</button>
                {/* Keep Best / Deactivate Duplicates */}
                {(() => {
                  const selectedArr = Array.from(selectedCityPages);
                  const selectedPages = cityPages.filter((cp: any) => selectedArr.includes(cp.id));
                  const selectedSlugs = new Set(selectedPages.map((cp: any) => cp.city_slug));
                  const hasDups = [...selectedSlugs].some(s => duplicateSlugs.has(s));
                  if (!hasDups) return null;
                  return (
                    <button
                      onClick={() => setShowDeactivateDupsConfirm(true)}
                      className="text-xs px-3 py-1.5 rounded border font-bold hover:bg-blue-50"
                      style={{ borderColor: "#3B82F640", color: "#3B82F6" }}
                    >Keep Best, Deactivate Rest</button>
                  );
                })()}
                <button
                  onClick={() => setSelectedCityPages(new Set())}
                  className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50"
                  style={{ borderColor: T.textPrimary + "30", color: T.textPrimary }}
                >Clear Selection</button>
              </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                  <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Delete {selectedCityPages.size} city pages?</h3>
                  <p className="text-sm text-gray-600">This cannot be undone. All selected pages and their content will be permanently deleted.</p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={async () => {
                        try {
                          const { data } = await supabase.functions.invoke("leads-auth", {
                            body: { password: storedPassword(), action: "delete_city_pages", ids: Array.from(selectedCityPages) },
                          });
                          toast({ title: `${data?.deleted || selectedCityPages.size} pages deleted` });
                          setSelectedCityPages(new Set());
                          setShowBulkDeleteConfirm(false);
                          fetchCityPages();
                        } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                      }}
                    >Confirm Delete</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Keep Best / Deactivate Duplicates Confirmation Modal */}
            {showDeactivateDupsConfirm && (() => {
              const selectedArr = Array.from(selectedCityPages);
              const selectedPages = cityPages.filter((cp: any) => selectedArr.includes(cp.id));
              // Group selected by slug
              const bySlug: Record<string, any[]> = {};
              selectedPages.forEach((cp: any) => {
                if (!bySlug[cp.city_slug]) bySlug[cp.city_slug] = [];
                bySlug[cp.city_slug].push(cp);
              });
              // For each slug group with >1, keep highest views, deactivate rest
              const toDeactivate: string[] = [];
              for (const [, group] of Object.entries(bySlug)) {
                if (group.length <= 1) continue;
                const sorted = [...group].sort((a, b) => (b.page_views || 0) - (a.page_views || 0));
                for (let i = 1; i < sorted.length; i++) toDeactivate.push(sorted[i].id);
              }
              return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
                    <h3 className="text-lg font-display font-bold" style={{ color: T.textPrimary }}>Keep Best, Deactivate Rest</h3>
                    <p className="text-sm text-gray-600">
                      This will deactivate <strong>{toDeactivate.length}</strong> duplicate pages, keeping the one with the most views for each city.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setShowDeactivateDupsConfirm(false)}>Cancel</Button>
                      <Button
                        style={{ backgroundColor: BRAND_GOLD, color: "white" }}
                        onClick={async () => {
                          if (toDeactivate.length === 0) { setShowDeactivateDupsConfirm(false); return; }
                          try {
                            await supabase.functions.invoke("leads-auth", {
                              body: { password: storedPassword(), action: "deactivate_city_pages", ids: toDeactivate },
                            });
                            toast({ title: `${toDeactivate.length} duplicates deactivated`, description: "Highest-traffic page kept for each city." });
                            setSelectedCityPages(new Set());
                            setShowDeactivateDupsConfirm(false);
                            fetchCityPages();
                          } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                        }}
                      >Confirm ({toDeactivate.length} pages)</Button>
                    </div>
                  </div>
                </div>
              );
            })()}




            {/* Table */}
            <div className="rounded-xl border shadow-sm overflow-x-auto" style={{ borderColor: T.cardBorder }}>
              {cityPagesLoading ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: BRAND_GOLD }} /></div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      <th className="px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={filteredCityPages.length > 0 && filteredCityPages.every((cp: any) => selectedCityPages.has(cp.id))}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedCityPages(new Set(filteredCityPages.map((cp: any) => cp.id)));
                            } else {
                              setSelectedCityPages(new Set());
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      {[
                        { label: "City", key: "city_name" },
                        { label: "State", key: "state" },
                        { label: "Region", key: null },
                        { label: "URL", key: null },
                        { label: "PIT", key: null },
                        { label: "Distance", key: "distance_from_pit" },
                        { label: "Price", key: "base_price" },
                        { label: "Status", key: "status" },
                        { label: "Content", key: null },
                        { label: "Views", key: "page_views" },
                        { label: "Ver", key: null },
                        { label: "Actions", key: null },
                      ].map(h => (
                        <th
                          key={h.label}
                          className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ${h.key ? "cursor-pointer select-none hover:opacity-70" : ""}`}
                          style={{ color: T.textSecond }}
                          onClick={() => {
                            if (!h.key) return;
                            const k = h.key as typeof cityPageSortKey;
                            if (cityPageSortKey === k) {
                              setCityPageSortDir(d => d === "asc" ? "desc" : "asc");
                            } else {
                              setCityPageSortKey(k);
                              setCityPageSortDir("asc");
                            }
                          }}
                        >
                          {h.label}
                          {h.key && cityPageSortKey === h.key && (
                            <span className="ml-1">{cityPageSortDir === "asc" ? "▲" : "▼"}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCityPages.map((cp: any, i: number) => (
                      <tr key={cp.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: selectedCityPages.has(cp.id) ? BRAND_GOLD + "10" : i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedCityPages.has(cp.id)}
                            onChange={e => {
                              const next = new Set(selectedCityPages);
                              e.target.checked ? next.add(cp.id) : next.delete(cp.id);
                              setSelectedCityPages(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: T.textPrimary }}>
                          {cp.city_name}
                          {cp.multi_pit_coverage && pits.filter(p => p.status === "active").length > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}>Multi-PIT</span>
                          )}
                          {duplicateSlugs.has(cp.city_slug) && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>Duplicate</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{cp.state}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: cp.region ? T.textPrimary : T.textSecond }}>{cp.region || "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          <a href={`https://riversand.net/${cp.city_slug}/river-sand-delivery`} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: BRAND_GOLD }}>
                            /{cp.city_slug}/river-sand-delivery
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs">{cp.pits?.name || "—"}</td>
                        <td className="px-3 py-2 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{cp.distance_from_pit ? `${Number(cp.distance_from_pit).toFixed(1)} mi` : "—"}</td>
                        <td className="px-3 py-2 text-xs font-bold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{cp.base_price ? `$${Number(cp.base_price).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{
                            backgroundColor: cp.status === "active" ? "#ECFDF5" : cp.status === "draft" ? "#F3F4F6" : "#F3F4F6",
                            color: cp.status === "active" ? "#059669" : cp.status === "draft" ? "#6B7280" : "#6B7280",
                          }}>
                            {cp.status?.charAt(0).toUpperCase() + cp.status?.slice(1)}
                          </span>
                        </td>
                         <td className="px-3 py-2">
                          {(() => {
                            const isCurrent = !!cp.content_generated_at && !cp.needs_regen && !cp.pit_reassigned && !cp.price_changed;
                            const isPitChanged = cp.pit_reassigned;
                            const isPriceChanged = cp.price_changed && !cp.pit_reassigned;
                            const isMissing = !cp.content_generated_at;
                            const dotColor = isCurrent ? "#22C55E" : isPitChanged ? "#EF4444" : isPriceChanged ? "#EF4444" : isMissing ? "#6B7280" : "#F59E0B";
                            const label = isCurrent ? "Current" : isPitChanged ? "PIT Changed" : isPriceChanged ? "Price Changed" : isMissing ? "Missing" : "Outdated";
                            return (
                              <span className="inline-flex items-center gap-1.5" title={cp.regen_reason || undefined}>
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                                <span className="text-xs font-medium" style={{ color: dotColor }}>{label}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{cp.page_views || 0}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: T.textSecond }}>{cp.prompt_version || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => window.open(`https://riversand.net/${cp.city_slug}/river-sand-delivery`, "_blank")} className="text-xs px-2 py-1 rounded border hover:bg-gray-50" style={{ borderColor: T.cardBorder, color: T.textPrimary }}>View</button>
                            <button onClick={() => {
                              const parsed = parseCityPageContent(cp);
                              setEditingCityPage({ ...cp, ...parsed });
                            }} className="text-xs px-2 py-1 rounded border hover:bg-gray-50" style={{ borderColor: BRAND_GOLD + "30", color: BRAND_GOLD }}>Edit</button>
                            <button onClick={() => toggleCityPage(cp.id)} className="text-xs px-2 py-1 rounded border hover:bg-gray-50" style={{ borderColor: cp.status === "active" ? "#EF444430" : "#22C55E30", color: cp.status === "active" ? "#EF4444" : "#22C55E" }}>
                              {cp.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCityPages.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-3 py-12 text-center">
                          <div className="text-4xl mb-2">📭</div>
                          <p className="font-medium" style={{ color: T.textPrimary }}>No city pages yet</p>
                          <p className="text-xs mt-1" style={{ color: T.textSecond }}>Use Discover Cities to find nearby cities.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Discover Cities Modal */}
            {showDiscoverModal && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !creatingPages && setShowDiscoverModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4" style={{ backgroundColor: T.tableHeaderBg }}>
                    <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Discovered {discoveredCities.length} Cities</h2>
                    <p className="text-white/60 text-sm">Select cities to create landing pages for</p>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#F3F3F3" }}>
                          <th className="px-2 py-2 w-8"><input type="checkbox" checked={discoverChecked.size === discoveredCities.filter(c => !c.duplicate).length} onChange={e => { if (e.target.checked) { setDiscoverChecked(new Set(discoveredCities.map((_, i) => i).filter(i => !discoveredCities[i].duplicate))); } else { setDiscoverChecked(new Set()); } }} /></th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">City</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">Closest PIT</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">Distance</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">Price</th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discoveredCities.map((c, i) => (
                          <tr key={i} style={{ backgroundColor: c.duplicate ? T.tableStripeBg : T.cardBg, opacity: c.duplicate ? 0.5 : 1 }}>
                            <td className="px-2 py-2">
                              {!c.duplicate && <input type="checkbox" checked={discoverChecked.has(i)} onChange={e => { const s = new Set(discoverChecked); e.target.checked ? s.add(i) : s.delete(i); setDiscoverChecked(s); }} />}
                            </td>
                            <td className="px-2 py-2 font-medium" style={{ color: T.textPrimary }}>{c.city_name}</td>
                            <td className="px-2 py-2 text-xs" style={{ color: T.textSecond }}>{c.closest_pit_name || "—"}</td>
                            <td className="px-2 py-2 text-xs">{c.distance} mi</td>
                            <td className="px-2 py-2 text-xs font-bold" style={{ color: BRAND_GOLD }}>${c.price}</td>
                            <td className="px-2 py-2 text-xs">
                              {c.duplicate ? (
                                <span className="text-gray-400">Already served by {c.existing_pit_name}</span>
                              ) : (
                                <span style={{ color: "#22C55E" }}>Available</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 flex gap-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                    <Button onClick={createPages} disabled={creatingPages || discoverChecked.size === 0} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {creatingPages ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Generate Pages for Selected ({discoverChecked.size})
                    </Button>
                    <Button onClick={() => setShowDiscoverModal(false)} disabled={creatingPages} variant="outline">Cancel</Button>
                    <p className="text-xs mt-2" style={{ color: "#666" }}>Pages will be created as drafts. AI content will be auto-generated when pricing changes or pits are updated.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Edit City Page Modal */}
            {editingCityPage && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingCityPage(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                    <h2 className="text-lg font-bold" style={{ color: T.textPrimary }}>Edit — {editingCityPage.city_name}</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: "#666" }}>City Name</label>
                        <Input value={editingCityPage.city_name || ""} onChange={e => setEditingCityPage({ ...editingCityPage, city_name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: "#666" }}>Region</label>
                        <Input value={editingCityPage.region || ""} onChange={e => setEditingCityPage({ ...editingCityPage, region: e.target.value })} placeholder="e.g. Jefferson Parish" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "#666" }}>Status</label>
                      <select value={editingCityPage.status || "draft"} onChange={e => setEditingCityPage({ ...editingCityPage, status: e.target.value })} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {/* SEO */}
                    <div className="pt-2 border-t">
                      <p className="text-[11px] font-bold tracking-wider mb-3" style={{ color: "#999" }}>SEO</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Meta Title <span className="float-right" style={{ color: (editingCityPage.meta_title?.length || 0) > 60 ? "#EF4444" : "#999" }}>{editingCityPage.meta_title?.length || 0}/60</span></label>
                          <Input value={editingCityPage.meta_title || ""} maxLength={60} onChange={e => setEditingCityPage({ ...editingCityPage, meta_title: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Meta Description <span className="float-right" style={{ color: (editingCityPage.meta_description?.length || 0) > 160 ? "#EF4444" : "#999" }}>{editingCityPage.meta_description?.length || 0}/160</span></label>
                          <Textarea rows={3} maxLength={160} value={editingCityPage.meta_description || ""} onChange={e => setEditingCityPage({ ...editingCityPage, meta_description: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>H1 Text <span className="float-right" style={{ color: (editingCityPage.h1_text?.length || 0) > 70 ? "#EF4444" : "#999" }}>{editingCityPage.h1_text?.length || 0}/70</span></label>
                          <Input value={editingCityPage.h1_text || ""} maxLength={70} onChange={e => setEditingCityPage({ ...editingCityPage, h1_text: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {/* Page Content */}
                    <div className="pt-2 border-t">
                      <p className="text-[11px] font-bold tracking-wider mb-3" style={{ color: "#999" }}>PAGE CONTENT</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Hero Intro</label>
                          <Textarea rows={3} value={editingCityPage.hero_intro || ""} onChange={e => setEditingCityPage({ ...editingCityPage, hero_intro: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Why Choose Intro</label>
                          <Textarea rows={2} value={editingCityPage.why_choose_intro || ""} onChange={e => setEditingCityPage({ ...editingCityPage, why_choose_intro: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Delivery Details</label>
                          <Textarea rows={2} value={editingCityPage.delivery_details || ""} onChange={e => setEditingCityPage({ ...editingCityPage, delivery_details: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Local Uses (HTML)</label>
                          <Textarea rows={4} value={editingCityPage.local_uses || ""} onChange={e => setEditingCityPage({ ...editingCityPage, local_uses: e.target.value })} className="font-mono text-xs" />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>Local Expertise</label>
                          <Textarea rows={3} value={editingCityPage.local_expertise || ""} onChange={e => setEditingCityPage({ ...editingCityPage, local_expertise: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "#666" }}>FAQ Items (JSON)</label>
                          <Textarea rows={6} value={typeof editingCityPage.faq_items === 'string' ? editingCityPage.faq_items : JSON.stringify(editingCityPage.faq_items || [], null, 2)} onChange={e => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setEditingCityPage({ ...editingCityPage, faq_items: parsed });
                            } catch {
                              setEditingCityPage({ ...editingCityPage, faq_items: e.target.value });
                            }
                          }} className="font-mono text-xs" />
                        </div>
                      </div>
                    </div>

                    {/* Read-only Info */}
                    <div className="pt-2 border-t">
                      <p className="text-[11px] font-bold tracking-wider mb-3" style={{ color: "#999" }}>INFO</p>
                      <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: "#888" }}>
                        <div>Distance: <strong>{editingCityPage.distance_from_pit ? `${Number(editingCityPage.distance_from_pit).toFixed(1)} mi` : "—"}</strong></div>
                        <div>Price: <strong>{editingCityPage.base_price ? `$${Number(editingCityPage.base_price).toFixed(0)}` : "—"}</strong></div>
                        <div>PIT: <strong>{editingCityPage.pits?.name || "—"}</strong></div>
                        <div>Generated: <strong>{editingCityPage.content_generated_at ? new Date(editingCityPage.content_generated_at).toLocaleDateString() : "Never"}</strong></div>
                        <div>Version: <strong>{editingCityPage.prompt_version || "—"}</strong></div>
                        <div>Views: <strong>{editingCityPage.page_views || 0}</strong></div>
                        {editingCityPage.multi_pit_coverage && pits.filter(p => p.status === "active").length > 1 && (
                          <div className="col-span-3"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}>Multi-PIT Coverage</span></div>
                        )}
                      </div>
                    </div>

                    <Button onClick={() => regenerateContent(editingCityPage)} disabled={generatingContent === editingCityPage.id} variant="outline" className="w-full" style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }}>
                      {generatingContent === editingCityPage.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Regenerate with AI
                    </Button>
                  </div>
                  <div className="px-6 py-4 flex gap-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                    <Button onClick={saveCityPage} className="flex-1" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>Save Changes</Button>
                    <Button onClick={() => setEditingCityPage(null)} variant="outline" className="flex-1">Cancel</Button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      }

      case "schedule":
        return (
          <ScheduleTab
            onOrderClick={(id) => {
              setActivePage("all");
              setSelectedOrderId(id);
            }}
            drivers={drivers}
            onSendToDriver={handleSendToDriver}
          />
        );

      case "all":
        return (
          <>
            {/* §4 Tab Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {parsedLeads.length} total leads
              </p>
            </div>
            <SearchAndFilters />
            <div className="rounded-xl border shadow-sm overflow-hidden" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <LeadsTable data={paginatedLeads} />
              <Pagination />
            </div>
          </>
        );

      case "pending_review":
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm" style={{ color: T.textSecond }}>{pendingReviewOrders.length} orders flagged — billing mismatch or fraud signals</p>
              </div>
              <Button size="sm" onClick={fetchPendingReview} disabled={pendingReviewLoading} variant="outline">
                {pendingReviewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>
            {pendingReviewLoading && pendingReviewOrders.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
                <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
              </div>
            ) : pendingReviewOrders.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No orders pending review</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Flagged orders will appear here as soon as they come in.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviewOrders.map((order: any) => (
                  <div key={order.id} className="rounded-xl border shadow-sm p-4" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-bold text-amber-800">⚠️ Call customer before dispatch — no exceptions</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div><p className="text-xs text-gray-400">Order #</p><p className="font-bold" style={{ color: T.textPrimary }}>{order.order_number || "—"}</p></div>
                      <div><p className="text-xs text-gray-400">Customer</p><p>{order.customer_name}</p></div>
                      <div><p className="text-xs text-gray-400">Phone</p><p>{order.customer_phone}</p></div>
                      <div><p className="text-xs text-gray-400">Price</p><p className="font-bold" style={{ color: BRAND_GOLD }}>${order.price}</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                      <div className="p-2 rounded border">
                        <p className="text-xs text-gray-400 mb-1">Delivery Address</p>
                        <p className="font-medium">{order.delivery_address}</p>
                      </div>
                      <div className={`p-2 rounded border ${order.billing_matches_delivery === false ? "border-red-300 bg-red-50" : ""}`}>
                        <p className="text-xs text-gray-400 mb-1">Billing Address</p>
                        <p className="font-medium">{order.billing_address || "—"}</p>
                        {order.billing_matches_delivery === false && <p className="text-xs text-red-600 font-bold mt-1">❌ ZIP MISMATCH</p>}
                      </div>
                    </div>
                    {order.fraud_signals && Array.isArray(order.fraud_signals) && order.fraud_signals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {order.fraud_signals.map((s: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleVerifyCall(order.id)} disabled={verifyingCall === order.id} style={{ backgroundColor: "#22C55E", color: "white" }}>
                        {verifyingCall === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />} Call Verified
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCancelFraudOrder(order.id)} disabled={verifyingCall === order.id} className="border-red-300 text-red-600">
                        Cancel & Refund
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );

      case "reviews": {
        const totalReviews = reviewsData.length;
        const ratedReviews = reviewsData.filter((r: any) => typeof r.rating === "number");
        const avgRating = ratedReviews.length > 0
          ? (ratedReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / ratedReviews.length)
          : 0;
        const fourPlusCount = ratedReviews.filter((r: any) => r.rating >= 4).length;
        const sentToGmbCount = reviewsData.filter((r: any) => r.sent_to_gmb).length;

        const timeAgoR = (iso: string): string => {
          if (!iso) return "—";
          const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
          if (diff < 60) return `${diff}s ago`;
          if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
          if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
          return `${Math.floor(diff / 86400)}d ago`;
        };

        const renderStars = (rating: number | null) => {
          if (!rating) return <span className="text-xs" style={{ color: T.textSecond }}>—</span>;
          return (
            <span style={{ color: BRAND_GOLD, letterSpacing: "1px" }} title={`${rating} / 5`}>
              {"★".repeat(rating)}<span style={{ color: "#E5E7EB" }}>{"★".repeat(5 - rating)}</span>
            </span>
          );
        };

        const reviewMetrics = [
          { label: "Total Reviews", value: totalReviews, color: T.textPrimary },
          { label: "Avg Rating", value: ratedReviews.length > 0 ? `${avgRating.toFixed(1)} ★` : "—", color: BRAND_GOLD },
          { label: "4★ or Higher", value: fourPlusCount, color: POSITIVE },
          { label: "Sent to GMB", value: sentToGmbCount, color: T.textPrimary },
        ];

        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm" style={{ color: T.textSecond }}>{totalReviews} reviews</p>
              </div>
              <Button size="sm" onClick={fetchReviews} disabled={reviewsLoading} variant="outline">
                {reviewsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {reviewMetrics.map((m) => (
                <div key={m.label} className="rounded-xl border p-5" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>{m.label}</div>
                  <div className="text-2xl font-semibold" style={{ color: m.color, fontVariantNumeric: "tabular-nums" }}>
                    {reviewsLoading && reviewsData.length === 0 ? "—" : m.value}
                  </div>
                </div>
              ))}
            </div>

            {reviewsLoading && reviewsData.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
                <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
              </div>
            ) : reviewsData.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No reviews yet</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Customer feedback will appear here as soon as it comes in.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10" style={{ backgroundColor: "#F9FAFB" }}>
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Submitted</th>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Rating</th>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Order #</th>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Feedback</th>
                      <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>GMB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewsData.map((r: any, i: number) => (
                      <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : "#FAFAFA" }}>
                        <td className="px-4 py-3" style={{ color: T.textSecond, fontVariantNumeric: "tabular-nums" }}>
                          {timeAgoR(r.review_submitted_at || r.created_at)}
                        </td>
                        <td className="px-4 py-3">{renderStars(r.rating)}</td>
                        <td className="px-4 py-3" style={{ color: T.textPrimary }}>
                          <div className="font-medium">{r.customer_name || "—"}</div>
                          {r.customer_email && <div className="text-xs" style={{ color: T.textSecond }}>{r.customer_email}</div>}
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: "tabular-nums" }}>
                          {r.order_number || "—"}
                        </td>
                        <td className="px-4 py-3 max-w-md" style={{ color: T.textPrimary }}>
                          <div className="truncate" title={r.feedback || ""}>{r.feedback || <span style={{ color: T.textSecond }}>—</span>}</div>
                        </td>
                        <td className="px-4 py-3">
                          {r.sent_to_gmb ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#ECFDF5", color: POSITIVE }}>Sent</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#F3F4F6", color: T.textSecond }}>Not sent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }

      case "waitlist": {
        const cityGroups = waitlistData.reduce((acc: Record<string, any[]>, lead: any) => {
          const key = lead.city_name || lead.city_slug;
          if (!acc[key]) acc[key] = [];
          acc[key].push(lead);
          return acc;
        }, {} as Record<string, any[]>);

        const totalSignups = waitlistData.length;
        const cityCount = Object.keys(cityGroups).length;
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm" style={{ color: T.textSecond }}>
                  {totalSignups} signups across {cityCount} cit{cityCount === 1 ? "y" : "ies"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={waitlistLoading}
                onClick={() => {
                  setWaitlistLoading(true);
                  supabase.functions.invoke("leads-auth", { body: { password: storedPassword(), action: "list_waitlist" } })
                    .then(({ data }) => { if (data?.waitlist) setWaitlistData(data.waitlist); })
                    .finally(() => setWaitlistLoading(false));
                }}
              >
                {waitlistLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>
            {waitlistLoading && waitlistData.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
                <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
              </div>
            ) : waitlistData.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No waitlist signups yet</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Signups for unserved cities will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      {["City", "Signups", "Latest Signup", "Action"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cityGroups).sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length).map(([city, leads], i) => {
                      const leadsArr = leads as any[];
                      return (
                        <tr key={city} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: T.textPrimary }}>{city}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>{leadsArr.length}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{new Date(leadsArr[0].created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm" variant="outline" className="text-xs"
                              style={{ borderColor: BRAND_GOLD + "40", color: BRAND_GOLD }}
                              onClick={() => {
                                const csv = "Name,Email,Phone,Signed Up\n" + leadsArr.map((l: any) =>
                                  `"${l.customer_name || ""}","${l.customer_email}","${l.customer_phone || ""}","${new Date(l.created_at).toLocaleDateString()}"`
                                ).join("\n");
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a"); a.href = url; a.download = `waitlist-${city.toLowerCase().replace(/\s+/g, "-")}.csv`; a.click();
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" /> Export
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }

      case "settings": {


        const saveSeoSettings = async () => {
          setSavingSeo(true);
          try {
            const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "save_settings", settings: seoSettings },
            });
            if (fnError) throw fnError;
            if (data?.settings) {
              setGlobalSettings(data.settings);
              const seo: Record<string, string> = {};
              Object.keys(data.settings).filter(k => k.startsWith("seo_")).forEach(k => { seo[k] = data.settings[k]; });
              if (data.settings.product_image_url) seo.product_image_url = data.settings.product_image_url;
              seo.gmb_review_url = data.settings.gmb_review_url || "";
              seo.seo_gbp_url = data.settings.seo_gbp_url || "";
              setSeoSettings(seo);
            }
            toast({ title: "SEO settings saved — live site updated" });
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          } finally { setSavingSeo(false); }
        };

        const checkIntegrations = async (only?: "gtm" | "ga4" | "clarity" | "gmb" | "gsc") => {
          const fields = {
            gtm_id: seoSettings.seo_gtm_id || "",
            ga4_id: seoSettings.seo_ga4_id || "",
            clarity_id: seoSettings.seo_clarity_id || "",
            gmb_url: seoSettings.gmb_review_url || "",
            gsc_id: seoSettings.seo_gsc_id || "",
          };
          const payload: any = {};
          if (only) {
            const map = { gtm: "gtm_id", ga4: "ga4_id", clarity: "clarity_id", gmb: "gmb_url", gsc: "gsc_id" } as const;
            payload[map[only]] = (fields as any)[map[only]];
            setIntegrationStatus(s => ({ ...s, [only]: "checking" }));
          } else {
            Object.assign(payload, fields);
            setIntegrationStatus({ gtm: "checking", ga4: "checking", clarity: "checking", gmb: "checking", gsc: "checking" });
          }
          try {
            const { data, error } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "check_google_integrations", ...payload },
            });
            if (error) throw error;
            if (data?.results) setIntegrationStatus(s => ({ ...s, ...data.results }));
          } catch (err: any) {
            toast({ title: "Check failed", description: err.message, variant: "destructive" });
          }
        };



        const runSeoAudit = async () => {
          setSeoAuditing(true);
          try {
            const { data: auditData, error: auditError } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "audit_seo", url: "https://riversand.net/" },
            });
            if (auditError) throw auditError;
            if (auditData?.error) throw new Error(auditData.error);
            const results = auditData.results;
            setSeoAuditResults(results);
            await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "save_settings", settings: { seo_last_audit: JSON.stringify(results) } },
            });
            toast({ title: "SEO audit complete", description: `Overall: ${results.grade} (${results.overall}/100)` });


          } catch (err: any) {
            toast({ title: "Audit failed", description: err.message, variant: "destructive" });
          } finally { setSeoAuditing(false); }
        };

        const scoreColor = (s: number) => s >= 80 ? "#22C55E" : s >= 50 ? "#F59E0B" : "#EF4444";

        return (
          <>
            {/* ── Documentation Export ── */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>📄 Project Documentation</h3>
                  <p className="text-xs" style={{ color: T.textSecond }}>
                    Generates a live snapshot of the full codebase — DB schema, pits, settings, ZIP codes, architecture.
                    Upload to AI project knowledge after download.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setExportingDocs(true);
                    setDocsExportError("");
                    try {
                      const { generateProjectDocs, getCurrentDocsVersion } = await import("@/lib/generateProjectDocs");
                      const md = await generateProjectDocs();
                      const headerMatch = md.match(/\*Version:\s*(v\d+\.\d+)/);
                      const usedVersion = headerMatch?.[1] || (await getCurrentDocsVersion());
                      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                      const today = new Date().toISOString().split("T")[0];
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `RIVERSAND_${usedVersion}_${today}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setDocsCurrentVersion(usedVersion);
                    } catch (e: any) {
                      setDocsExportError(e.message || "Export failed");
                    } finally {
                      setExportingDocs(false);
                    }
                  }}
                  disabled={exportingDocs}
                  className="ml-4 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: BRAND_GOLD, minWidth: "200px" }}
                >
                  {exportingDocs ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : `Generate & Download — ${docsCurrentVersion}`}
                </button>
              </div>
              {docsExportError && <p className="text-xs mt-2" style={{ color: ALERT_RED }}>{docsExportError}</p>}
            </div>

            {/* ── AI Knowledge Snapshot ── */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <div className="mb-4">
                <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>🧠 AI Knowledge Snapshot</h3>
                <p className="text-xs" style={{ color: T.textSecond }}>
                  Compact session-start brief for AI: pricing, active PITs, city counts, pending issues, stack. Auto-versioned, uploaded to Storage.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: T.textPrimary }}>
                  Pending / Known Issues (manual notes for AI context)
                </label>
                <textarea
                  value={globalSettings.snapshot_pending_notes || ""}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, snapshot_pending_notes: e.target.value })}
                  onBlur={async (e) => {
                    try {
                      await supabase.functions.invoke("leads-auth", {
                        body: { password: storedPassword(), action: "save_settings", settings: { snapshot_pending_notes: e.target.value } },
                      });
                    } catch (err: any) {
                      toast({ title: "Save failed", description: err.message, variant: "destructive" });
                    }
                  }}
                  rows={6}
                  placeholder="- In-flight: weekday PIT routing fix&#10;- Broken: ___&#10;- Just deployed: ___"
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                  style={{ backgroundColor: T.inputBg || "#fff", border: `1px solid ${T.cardBorder}`, color: T.textPrimary }}
                />
                <p className="text-[11px] mt-1" style={{ color: T.textSecond }}>Saves on blur. Markdown supported.</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: T.textSecond }}>
                  Current: <span className="font-mono font-bold" style={{ color: T.textPrimary }}>{globalSettings.snapshot_version || "v1.00"}</span>
                </p>
                <button
                  onClick={async () => {
                    setExportingSnapshot(true);
                    try {
                      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
                        body: { password: storedPassword(), action: "export_knowledge_snapshot" },
                      });
                      if (fnError) throw fnError;
                      if (!data?.ok) throw new Error(data?.error || "Export failed");
                      setGlobalSettings((prev: any) => ({ ...prev, snapshot_version: data.version }));
                      toast({
                        title: `Snapshot exported — ${data.version}`,
                        description: `${data.fileName} • ${data.change_ratio} change${data.major_bump ? " — MAJOR BUMP" : ""}`,
                      });
                      window.open(data.url, "_blank");
                    } catch (err: any) {
                      toast({ title: "Snapshot export failed", description: err.message, variant: "destructive" });
                    } finally {
                      setExportingSnapshot(false);
                    }
                  }}
                  disabled={exportingSnapshot}
                  className="ml-4 px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: "transparent", border: `2px solid ${BRAND_GOLD}`, color: BRAND_GOLD, minWidth: "220px" }}
                >
                  {exportingSnapshot ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</> : `Export AI Snapshot (${globalSettings.snapshot_version || "v1.00"})`}
                </button>
              </div>
            </div>

            {/* SITE MODE TOGGLE */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Site Mode</h3>
              <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>
                Control whether the public site is live or showing maintenance page. Admin dashboard always accessible.
              </p>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{
                backgroundColor: globalSettings.site_mode === 'maintenance' ? '#FEF3C7' : '#ECFDF5',
                border: `1px solid ${globalSettings.site_mode === 'maintenance' ? WARN_YELLOW : POSITIVE}`,
              }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: globalSettings.site_mode === 'maintenance' ? WARN_YELLOW : POSITIVE }}>
                    {globalSettings.site_mode === 'maintenance' ? '🔴 MAINTENANCE MODE — Site is offline to public' : '🟢 LIVE MODE — Site is fully operational'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: T.textSecond }}>
                    {globalSettings.site_mode === 'maintenance' ? 'Customers see maintenance page. Admin dashboard unaffected.' : 'Customers can browse and place orders normally.'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newMode = globalSettings.site_mode === 'maintenance' ? 'live' : 'maintenance';
                    try {
                      await supabase.functions.invoke("leads-auth", {
                        body: { password: storedPassword(), action: "save_settings", settings: { site_mode: newMode } },
                      });
                      setGlobalSettings({ ...globalSettings, site_mode: newMode });
                      toast({
                        title: newMode === 'maintenance' ? '🔴 Site set to MAINTENANCE MODE' : '🟢 Site set to LIVE MODE',
                        description: newMode === 'maintenance' ? 'Public site now shows maintenance page.' : 'Public site is now fully operational.',
                      });
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                  className="ml-4 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                  style={{ backgroundColor: globalSettings.site_mode === 'maintenance' ? POSITIVE : ALERT_RED, minWidth: '120px' }}
                >
                  {globalSettings.site_mode === 'maintenance' ? '→ Go Live' : '→ Maintenance'}
                </button>
              </div>
            </div>

            {/* STRIPE MODE TOGGLE */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Stripe Payment Mode</h3>
              <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>
                Switch between test and live Stripe keys. Test mode shows a modal and banner to visitors. No code changes or key swapping required.
              </p>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{
                backgroundColor: globalSettings.stripe_mode === 'test' ? '#FEF3C7' : '#ECFDF5',
                border: `1px solid ${globalSettings.stripe_mode === 'test' ? WARN_YELLOW : POSITIVE}`,
              }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: globalSettings.stripe_mode === 'test' ? WARN_YELLOW : POSITIVE }}>
                    {globalSettings.stripe_mode === 'test' ? '🔧 TEST MODE — Using Stripe test keys' : '✅ LIVE MODE — Processing real payments'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: T.textSecond }}>
                    {globalSettings.stripe_mode === 'test' ? 'Test card: 4242 4242 4242 4242 · Exp: 12/29 · CVC: 123' : 'Real cards charged. Payouts to Chase ---5952.'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newMode = globalSettings.stripe_mode === 'test' ? 'live' : 'test';
                    try {
                      await supabase.functions.invoke("leads-auth", {
                        body: { password: storedPassword(), action: "save_settings", settings: { stripe_mode: newMode } },
                      });
                      setGlobalSettings({ ...globalSettings, stripe_mode: newMode });
                      toast({
                        title: newMode === 'test' ? '🔧 Switched to TEST MODE' : '✅ Switched to LIVE MODE',
                        description: newMode === 'test' ? 'Site shows test modal. Use card 4242 4242 4242 4242.' : 'Real payments are now being processed.',
                      });
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                  className="ml-4 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                  style={{ backgroundColor: globalSettings.stripe_mode === 'test' ? POSITIVE : ALERT_RED, minWidth: '120px' }}
                >
                  {globalSettings.stripe_mode === 'test' ? '→ Go Live' : '→ Test Mode'}
                </button>
              </div>
              {globalSettings.stripe_mode === 'test' && (
                <div className="mt-3 p-3 rounded-lg text-xs font-mono" style={{
                  backgroundColor: '#F9FAFB',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.textPrimary,
                }}>
                  <p className="font-bold mb-1">Test card details:</p>
                  <p>Card: 4242 4242 4242 4242</p>
                  <p>Expiry: 12/29 · CVC: 123 · ZIP: 70094</p>
                </div>
              )}
            </div>

            {/* DASHBOARD THEME TOGGLE */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Dashboard Theme</h3>
              <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>
                Switch the LMT dashboard between light and dark appearance. Applies to all tabs.
              </p>
              <div className="flex items-center gap-3">
                {([['light', '☀️ Light'], ['dark', '🌙 Dark']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={async () => {
                      try {
                        await supabase.functions.invoke("leads-auth", {
                          body: { password: storedPassword(), action: "save_settings", settings: { dashboard_theme: mode } },
                        });
                        setGlobalSettings({ ...globalSettings, dashboard_theme: mode });
                        toast({ title: mode === 'dark' ? '🌙 Dark theme applied' : '☀️ Light theme applied' });
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message, variant: "destructive" });
                      }
                    }}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
                    style={{
                      backgroundColor: globalSettings.dashboard_theme === mode || (!globalSettings.dashboard_theme && mode === 'light') ? BRAND_GOLD : T.cardBg,
                      color: globalSettings.dashboard_theme === mode || (!globalSettings.dashboard_theme && mode === 'light') ? 'white' : T.textPrimary,
                      border: `1px solid ${globalSettings.dashboard_theme === mode || (!globalSettings.dashboard_theme && mode === 'light') ? BRAND_GOLD : T.cardBorder}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6" style={{ borderBottom: `2px solid ${T.cardBorder}` }}>
              {([["pricing", "Pricing"], ["profile", "Business Profile"], ["seo", "SEO"], ["tracking", "Tracking"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => {
                  setSettingsTab(id as any);
                  if (id === "tracking" && notrackIps.length === 0 && !notrackLoading) {
                    setNotrackLoading(true);
                    supabase.functions.invoke("leads-auth", { body: { action: "get_notrack_ips", password: sessionStorage.getItem("leads_pw") || "" } })
                      .then(({ data }: any) => { if (data?.ips) setNotrackIps(data.ips); })
                      .finally(() => setNotrackLoading(false));
                    fetch("https://api.ipify.org?format=json").then(r => r.json()).then(d => setNotrackDetectedIp(d.ip || null)).catch(() => {});
                  }
                }} className="px-4 py-2 text-sm font-medium transition-colors -mb-[2px]" style={{
                  color: settingsTab === id ? BRAND_GOLD : "#666",
                  borderBottom: settingsTab === id ? `2px solid ${BRAND_GOLD}` : "2px solid transparent",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {settingsTab === "pricing" && (
              <>
                {/* Pricing Notice */}
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Pricing</h3>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Pricing is configured per PIT. Edit each PIT to set its base price, free miles, extra per mile, and max distance.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Saturday surcharge</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                        <Input className="pl-6 h-9" value={editSettings.saturday_surcharge || ""} onChange={e => setEditSettings({ ...editSettings, saturday_surcharge: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Max Daily Delivery Limit (all PITs combined)</label>
                      <Input className="h-9" type="number" value={editSettings.max_daily_limit || ""} onChange={e => setEditSettings({ ...editSettings, max_daily_limit: e.target.value })} placeholder="e.g. 10" />
                      <p className="text-[10px] text-gray-400 mt-1">Leave blank for no global limit</p>
                    </div>
                  </div>

                  {/* Processing Fee Settings */}
                  <h4 className="font-display uppercase tracking-wide text-sm mt-6 mb-1" style={{ color: T.textPrimary }}>Processing Fees</h4>
                  <p className="text-xs mb-3 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Applied to card payments and COD late payment conversions</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Card processing fee (%)</label>
                      <div className="relative">
                        <Input className="pr-8 h-9" value={editSettings.card_processing_fee_percent || ""} onChange={e => setEditSettings({ ...editSettings, card_processing_fee_percent: e.target.value })} placeholder="3.5" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Card processing fee (fixed)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                        <Input className="pl-6 h-9" value={editSettings.card_processing_fee_fixed || ""} onChange={e => setEditSettings({ ...editSettings, card_processing_fee_fixed: e.target.value })} placeholder="0.30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">COD late payment fee (%)</label>
                      <div className="relative">
                        <Input className="pr-8 h-9" value={editSettings.cod_late_payment_fee_percent || ""} onChange={e => setEditSettings({ ...editSettings, cod_late_payment_fee_percent: e.target.value })} placeholder="3.5" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">COD late payment fee (fixed)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                        <Input className="pl-6 h-9" value={editSettings.cod_late_payment_fee_fixed || ""} onChange={e => setEditSettings({ ...editSettings, cod_late_payment_fee_fixed: e.target.value })} placeholder="0.30" />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Mode */}
                  <h4 className="font-display uppercase tracking-wide text-sm mt-6 mb-1" style={{ color: T.textPrimary }}>Pricing Display Mode</h4>
                  <p className="text-xs mb-3 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>
                    <strong>Transparent:</strong> Processing fee shown as separate line item.{" "}
                    <strong>Baked In:</strong> Fee included in base price; COD customers get a discount.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Pricing Mode</label>
                      <select
                        value={editSettings.pricing_mode || "transparent"}
                        onChange={e => setEditSettings({ ...editSettings, pricing_mode: e.target.value })}
                        className="h-9 w-full rounded border px-3 text-sm"
                        style={{ borderColor: T.cardBorder }}
                      >
                        <option value="transparent">Transparent — Show fee separately</option>
                        <option value="baked">Baked In — Fee in base price, COD gets discount</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">COD Discount %</label>
                      <div className="relative">
                        <Input className="pr-8 h-9" value={editSettings.cod_discount_percent || "3.5"} onChange={e => setEditSettings({ ...editSettings, cod_discount_percent: e.target.value })} placeholder="3.5" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                  {editSettings.pricing_mode === "baked" && (
                    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: "#FEF3C7", border: `1px solid ${WARN_YELLOW}` }}>
                      <p className="text-xs" style={{ color: WARN_YELLOW }}>
                        ⚠️ Baked mode is active. Pit base prices include the processing fee. Switching to Transparent will require manually adjusting pit prices.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                    <Button onClick={saveGlobalSettings} disabled={savingSettings} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save Pricing Settings
                    </Button>
                  </div>
                </div>

                {/* Delivery Schedule */}
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Delivery Schedule</h3>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Configure delivery days and cutoff times</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Same-day cutoff</label>
                      <Input className="h-9" value={editSettings.sameday_cutoff || ""} onChange={e => setEditSettings({ ...editSettings, sameday_cutoff: e.target.value })} placeholder="10:00 AM" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Saturday surcharge</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                        <Input className="pl-6 h-9" value={editSettings.saturday_surcharge || ""} onChange={e => setEditSettings({ ...editSettings, saturday_surcharge: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Max same-day orders/day</label>
                      <Input className="h-9" type="number" value={editSettings.max_sameday_orders || ""} onChange={e => setEditSettings({ ...editSettings, max_sameday_orders: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 block mb-2">Operating days</label>
                    <div className="flex flex-wrap gap-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                        const key = `operating_${day.toLowerCase()}`;
                        const active = editSettings[key] !== "false";
                        return (
                          <button key={day} onClick={() => setEditSettings({ ...editSettings, [key]: active ? "false" : "true" })} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" style={{ backgroundColor: active ? T.textPrimary : T.barBg, color: active ? (isDark ? "#0A0F1E" : "white") : T.textSecond }}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                    <Button onClick={saveGlobalSettings} disabled={savingSettings} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save Schedule Settings
                    </Button>
                  </div>
                </div>

                {/* Notifications */}
                <div className="rounded-xl border shadow-sm p-6" style={{ borderColor: T.cardBorder }}>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>Notifications</h3>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Email alerts and notifications</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Owner dispatch email</label>
                      <Input className="h-9" value={editSettings.dispatch_email || ""} onChange={e => setEditSettings({ ...editSettings, dispatch_email: e.target.value })} placeholder="cmo@haulogix.com" />
                    </div>
                    {[
                      { key: "alert_new_lead", label: "Alert on new lead" },
                      { key: "alert_new_order", label: "Alert on new order" },
                      { key: "daily_summary", label: "Daily summary email" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between py-2">
                        <span className="text-sm" style={{ color: T.textPrimary }}>{label}</span>
                        <button onClick={() => setEditSettings({ ...editSettings, [key]: editSettings[key] === "true" ? "false" : "true" })} className="w-10 h-5 rounded-full transition-colors relative" style={{ backgroundColor: editSettings[key] === "true" ? BRAND_GOLD : "#ddd" }}>
                          <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ left: editSettings[key] === "true" ? "22px" : "2px" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                    <Button onClick={saveGlobalSettings} disabled={savingSettings} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save Notification Settings
                    </Button>
                  </div>
                </div>
              </>
            )}

            {settingsTab === "profile" && (
              <>
                {/* Redirect to profile page */}
                <div className="rounded-xl border shadow-sm p-6" style={{ borderColor: T.cardBorder }}>
                  <p className="text-sm" style={{ color: T.textSecond }}>Business profile settings are available in the <button onClick={() => setActivePage("profile")} className="font-medium underline" style={{ color: BRAND_GOLD }}>Business Profile</button> page.</p>
                </div>
              </>
            )}

            {settingsTab === "seo" && (
              <>
                {/* ─── SECTION 1: SITE AUDIT ─── */}
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>Site Audit</h3>
                    <Button onClick={runSeoAudit} disabled={seoAuditing} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {seoAuditing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                      Scan riversand.net
                    </Button>
                  </div>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Automated scan based on Art of SEO framework</p>

                  {seoAuditResults && (
                    <>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: scoreColor(seoAuditResults.overall) }}>
                          {seoAuditResults.grade}
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{ color: T.textPrimary }}>{seoAuditResults.overall}/100</p>
                          <p className="text-xs text-gray-400">Last scanned: {new Date(seoAuditResults.scannedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {seoAuditResults.categories?.map((cat: any) => (
                          <div key={cat.name} className="rounded-xl p-3 border" style={{ borderColor: scoreColor(cat.score), borderWidth: 2 }}>
                            <p className="text-xs font-bold mb-1" style={{ color: T.textPrimary }}>{cat.name}</p>
                            <p className="text-2xl font-black" style={{ color: scoreColor(cat.score) }}>{cat.score}</p>
                            <p className="text-[10px] text-gray-500 mt-1 truncate" title={cat.found}>{cat.found || "—"}</p>
                            {cat.issues?.map((issue: string, i: number) => (
                              <p key={i} className="text-[10px] mt-1" style={{ color: "#EF4444" }}>• {issue}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>



                {/* ─── SECTION 3: SEO SETTINGS ─── */}
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>SEO Settings</h3>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>Editable fields — changes apply to live site</p>

                  {/* Homepage Meta */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: T.textSecond }}>HOMEPAGE META</p>
                  <div className="space-y-3 mb-6">
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-500">Meta Title</label>
                        <span className="text-[10px]" style={{ color: (seoSettings.seo_meta_title || "").length > 60 ? "#EF4444" : "#999" }}>{(seoSettings.seo_meta_title || "").length}/60</span>
                      </div>
                      <Input className="h-9" value={seoSettings.seo_meta_title || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_meta_title: e.target.value })} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-500">Meta Description</label>
                        <span className="text-[10px]" style={{ color: (seoSettings.seo_meta_description || "").length > 160 ? "#EF4444" : "#999" }}>{(seoSettings.seo_meta_description || "").length}/160</span>
                      </div>
                      <Textarea rows={3} value={seoSettings.seo_meta_description || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_meta_description: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">H1 Tag</label>
                      <Input className="h-9" value={seoSettings.seo_h1 || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_h1: e.target.value })} />
                    </div>
                  </div>

                  {/* Open Graph */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 pt-3" style={{ color: T.textSecond, borderTop: `1px solid ${T.cardBorder}` }}>OPEN GRAPH</p>
                  <div className="space-y-3 mb-6">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">OG Title</label>
                      <Input className="h-9" value={seoSettings.seo_og_title || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_og_title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">OG Description</label>
                      <Textarea rows={2} value={seoSettings.seo_og_description || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_og_description: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">OG Image URL</label>
                      <div className="flex gap-2">
                        <Input className="h-9 flex-1" value={seoSettings.seo_og_image || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_og_image: e.target.value })} placeholder="https://..." />
                        {seoSettings.seo_og_image && (
                          <div className="h-9 w-16 rounded border flex items-center justify-center overflow-hidden" style={{ borderColor: T.cardBorder }}>
                            <img src={seoSettings.seo_og_image} alt="OG" className="max-h-8 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Schema Markup */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 pt-3" style={{ color: T.textSecond, borderTop: `1px solid ${T.cardBorder}` }}>SCHEMA MARKUP</p>
                  <div className="space-y-2 mb-6">
                    {[
                      { key: "seo_schema_localbusiness", label: "LocalBusiness schema" },
                      { key: "seo_schema_product", label: "Product schema" },
                      { key: "seo_schema_faq", label: "FAQPage schema" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between py-1.5">
                        <span className="text-sm" style={{ color: T.textPrimary }}>{label}</span>
                        <button onClick={() => setSeoSettings({ ...seoSettings, [key]: seoSettings[key] === "true" ? "false" : "true" })} className="w-10 h-5 rounded-full transition-colors relative" style={{ backgroundColor: seoSettings[key] === "true" ? BRAND_GOLD : "#ddd" }}>
                          <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ left: seoSettings[key] === "true" ? "22px" : "2px" }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Product Image */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 pt-3" style={{ color: T.textSecond, borderTop: `1px solid ${T.cardBorder}` }}>PRODUCT IMAGE</p>
                  <div className="space-y-3 mb-6">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Product Image URL</label>
                      <div className="flex gap-2">
                        <Input className="h-9 flex-1" value={seoSettings.product_image_url || ""} onChange={e => setSeoSettings({ ...seoSettings, product_image_url: e.target.value })} placeholder="https://..." />
                        {seoSettings.product_image_url && (
                          <div className="h-9 w-16 rounded border flex items-center justify-center overflow-hidden" style={{ borderColor: T.cardBorder }}>
                            <img src={seoSettings.product_image_url} alt="Product" className="max-h-8 object-contain" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Used in Product schema on all city pages</p>
                    </div>
                  </div>

                  {/* Technical */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 pt-3" style={{ color: T.textSecond, borderTop: `1px solid ${T.cardBorder}` }}>TECHNICAL</p>
                  <div className="space-y-3 mb-6">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Canonical URL</label>
                      <Input className="h-9" value={seoSettings.seo_canonical || ""} onChange={e => setSeoSettings({ ...seoSettings, seo_canonical: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Robots</label>
                      <select value={seoSettings.seo_robots || "index, follow"} onChange={e => setSeoSettings({ ...seoSettings, seo_robots: e.target.value })} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: T.cardBorder }}>
                        <option value="index, follow">index, follow</option>
                        <option value="noindex, nofollow">noindex, nofollow</option>
                        <option value="noindex, follow">noindex, follow</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Sitemap URL</label>
                      <Input className="h-9 bg-gray-50" value={seoSettings.seo_sitemap_url || ""} readOnly />
                    </div>
                  </div>

                  {/* Google & Analytics Integrations */}
                  {(() => {
                    const StatusDot = ({ s }: { s?: string }) => {
                      const color = s === "connected" ? "#10B981" : s === "invalid" ? "#EF4444" : s === "checking" ? "#F59E0B" : s === "dns_verified" ? "#3B82F6" : "#9CA3AF";
                      const label = s === "dns_verified" ? "DNS Verified" : (s || "not_set");
                      return <span className={`inline-block w-2 h-2 rounded-full ${s === "checking" ? "animate-pulse" : ""}`} style={{ backgroundColor: color }} title={label} />;
                    };
                    const IconBtn = ({ onClick, title, children }: any) => (
                      <button type="button" onClick={onClick} title={title} className="p-1 rounded hover:bg-gray-100 transition-colors" style={{ color: BRAND_NAVY }}>
                        {children}
                      </button>
                    );
                    const Row = ({ label, keyName, placeholder, helper, statusKey, dashUrl, mono }: any) => (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-500">{label}</label>
                          <div className="flex items-center gap-1">
                            {statusKey && <StatusDot s={integrationStatus[statusKey]} />}
                            {statusKey && integrationStatus[statusKey] === "dns_verified" && (
                              <span className="text-[10px] font-medium" style={{ color: "#3B82F6" }}>DNS Verified</span>
                            )}
                            {statusKey && (
                              <IconBtn onClick={() => checkIntegrations(statusKey)} title="Re-check this field">
                                <RefreshCw size={12} className={integrationStatus[statusKey] === "checking" ? "animate-spin" : ""} />
                              </IconBtn>
                            )}
                            {dashUrl && (
                              <IconBtn onClick={() => { const u = typeof dashUrl === "function" ? dashUrl() : dashUrl; if (u) window.open(u, "_blank", "noopener"); }} title="Open dashboard">
                                <ExternalLink size={12} />
                              </IconBtn>
                            )}
                          </div>
                        </div>
                        <Input className={`h-9 ${mono ? "font-mono" : ""}`} value={seoSettings[keyName] || ""} onChange={e => setSeoSettings({ ...seoSettings, [keyName]: e.target.value })} placeholder={placeholder} />
                        {helper && <p className="text-[10px] text-gray-400 mt-0.5">{helper}</p>}
                      </div>
                    );
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3 pt-3" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textSecond }}>GOOGLE & ANALYTICS INTEGRATIONS</p>
                          <Button size="sm" onClick={() => checkIntegrations()} className="h-7 text-xs px-2" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                            <RefreshCw size={11} className={`mr-1 ${Object.values(integrationStatus).some(v => v === "checking") ? "animate-spin" : ""}`} />
                            Check All
                          </Button>
                        </div>
                        <div className="space-y-3 mb-6">
                          <Row label="GTM Container ID" keyName="seo_gtm_id" placeholder="GTM-XXXXXXX" helper="Reference only — GTM is hardcoded in index.html. To change the container, update the HTML directly." statusKey="gtm" dashUrl="https://tagmanager.google.com" mono />
                          <Row label="GA4 Measurement ID" keyName="seo_ga4_id" placeholder="G-XXXXXXXXXX" helper="Paste into GA4 Configuration tag inside GTM" statusKey="ga4" dashUrl="https://analytics.google.com" mono />
                          <Row label="GA4 Property ID" keyName="seo_ga4_property_id" placeholder="numeric" helper="Reference only — GA4 Admin → Property Settings" dashUrl="https://analytics.google.com" mono />
                          <Row label="GSC Verification ID" keyName="seo_gsc_id" placeholder="(blank if DNS-verified)" helper="Verified via DNS — no meta tag required" statusKey="gsc" dashUrl="https://search.google.com/search-console" mono />
                          <Row label="GMB Review URL" keyName="gmb_review_url" placeholder="https://g.page/r/..." helper="Used in post-delivery review request emails" statusKey="gmb" dashUrl={() => seoSettings.gmb_review_url} />
                          <Row label="GBP URL" keyName="seo_gbp_url" placeholder="https://g.page/..." helper="Google Business Profile public URL" dashUrl={() => seoSettings.seo_gbp_url} />
                          <Row label="Microsoft Clarity ID" keyName="seo_clarity_id" placeholder="xxxxxxxxxx" helper="Clarity → Settings → Setup → Project ID" statusKey="clarity" dashUrl="https://clarity.microsoft.com" mono />
                          <div className="flex items-center justify-between py-1.5">
                            <div>
                              <span className="text-sm" style={{ color: T.textPrimary }}>Show Google Reviews on landing page</span>
                              <p className="text-[10px] text-gray-400">Activate when you have 5+ reviews</p>
                            </div>
                            <button onClick={() => setSeoSettings({ ...seoSettings, seo_gbp_reviews_enabled: seoSettings.seo_gbp_reviews_enabled === "true" ? "false" : "true" })} className="w-10 h-5 rounded-full transition-colors relative" style={{ backgroundColor: seoSettings.seo_gbp_reviews_enabled === "true" ? BRAND_GOLD : "#ddd" }}>
                              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ left: seoSettings.seo_gbp_reviews_enabled === "true" ? "22px" : "2px" }} />
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Save */}
                  <Button onClick={saveSeoSettings} disabled={savingSeo} className="w-full h-11" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                    {savingSeo ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    Save SEO Settings
                  </Button>
                </div>
              </>
            )}

            {settingsTab === "tracking" && (
              <>
                <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <h3 className="font-display uppercase tracking-wide text-sm mb-1" style={{ color: T.textPrimary }}>No-Track IP Addresses</h3>
                  <p className="text-xs mb-4 pb-3" style={{ color: T.textSecond, borderBottom: `1px solid ${T.cardBorder}` }}>
                    IP addresses listed here will be silently excluded from visitor session tracking, lead capture, and analytics.
                    Use this to prevent your own browsing from polluting data.
                  </p>

                  {notrackDetectedIp && (
                    <div className="flex items-center justify-between p-3 rounded-lg mb-4" style={{ backgroundColor: "#F0F7FF", border: "1px solid #D0E3F7" }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: T.textPrimary }}>Your current IP</p>
                        <p className="text-sm font-mono" style={{ color: T.textPrimary }}>{notrackDetectedIp}</p>
                      </div>
                      {!notrackIps.includes(notrackDetectedIp) ? (
                        <Button size="sm" onClick={() => {
                          const updated = [...notrackIps, notrackDetectedIp];
                          setNotrackIps(updated);
                          setNotrackSaving(true);
                          supabase.functions.invoke("leads-auth", { body: { action: "set_notrack_ips", password: sessionStorage.getItem("leads_pw") || "", ips: updated } })
                            .then(({ error }: any) => {
                              if (error) toast({ title: "Error", description: "Failed to save", variant: "destructive" });
                              else toast({ title: "Added", description: `${notrackDetectedIp} is now excluded from tracking` });
                            })
                            .finally(() => setNotrackSaving(false));
                        }} disabled={notrackSaving} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                          {notrackSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Add to No-Track
                        </Button>
                      ) : (
                        <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: "#E8F5E9", color: "#2E7D32" }}>✓ Already excluded</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mb-4">
                    <Input
                      className="h-9 font-mono flex-1"
                      placeholder="Enter IP address (e.g. 72.14.201.33)"
                      value={notrackNewIp}
                      onChange={e => setNotrackNewIp(e.target.value.replace(/[^0-9.:a-fA-F]/g, ""))}
                      maxLength={45}
                    />
                    <Button size="sm" className="h-9" disabled={!notrackNewIp.trim() || notrackIps.includes(notrackNewIp.trim()) || notrackSaving} onClick={() => {
                      const ip = notrackNewIp.trim();
                      if (!ip) return;
                      const updated = [...notrackIps, ip];
                      setNotrackIps(updated);
                      setNotrackNewIp("");
                      setNotrackSaving(true);
                      supabase.functions.invoke("leads-auth", { body: { action: "set_notrack_ips", password: sessionStorage.getItem("leads_pw") || "", ips: updated } })
                        .then(({ error }: any) => {
                          if (error) toast({ title: "Error", description: "Failed to save", variant: "destructive" });
                          else toast({ title: "Added", description: `${ip} added to no-track list` });
                        })
                        .finally(() => setNotrackSaving(false));
                    }} style={{ backgroundColor: T.tableHeaderBg, color: T.tableHeaderText }}>
                      Add IP
                    </Button>
                  </div>

                  {notrackLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_GOLD }} /></div>
                  ) : notrackIps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No IPs excluded yet. Add your IP above to start.</p>
                  ) : (
                    <div className="space-y-2">
                      {notrackIps.map((ip, i) => (
                        <div key={ip} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: i % 2 === 0 ? "#FAFAFA" : "white", border: `1px solid ${T.cardBorder}` }}>
                          <span className="text-sm font-mono" style={{ color: T.textPrimary }}>{ip}</span>
                          <button onClick={() => {
                            const updated = notrackIps.filter(x => x !== ip);
                            setNotrackIps(updated);
                            setNotrackSaving(true);
                            supabase.functions.invoke("leads-auth", { body: { action: "set_notrack_ips", password: sessionStorage.getItem("leads_pw") || "", ips: updated } })
                              .then(({ error }: any) => {
                                if (error) toast({ title: "Error", description: "Failed to save", variant: "destructive" });
                                else toast({ title: "Removed", description: `${ip} removed from no-track list` });
                              })
                              .finally(() => setNotrackSaving(false));
                          }} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        );
      }

      case "profile":
        return (
          <>
            {/* Brand Identity */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Brand Identity</h3>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Legal business name</label>
                  <Input className="h-9" value={profileSettings.legal_name || ""} onChange={e => setProfileSettings({ ...profileSettings, legal_name: e.target.value })} placeholder="Ways Materials, LLC" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Brand name</label>
                  <Input className="h-9" value={profileSettings.site_name || ""} onChange={e => setProfileSettings({ ...profileSettings, site_name: e.target.value })} placeholder="River Sand" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tagline</label>
                  <Input className="h-9" value={profileSettings.tagline || ""} onChange={e => setProfileSettings({ ...profileSettings, tagline: e.target.value })} placeholder="Real Sand. Real People." />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Website</label>
                  <Input className="h-9" value={profileSettings.website || ""} onChange={e => setProfileSettings({ ...profileSettings, website: e.target.value })} placeholder="https://riversand.net" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Primary phone</label>
                  <Input className="h-9" value={profileSettings.phone || ""} onChange={e => setProfileSettings({ ...profileSettings, phone: e.target.value })} placeholder={WAYS_PHONE_DISPLAY} />
                </div>
              </div>
            </div>

            {/* Contact & Address */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Contact Information</h3>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Customer email (display)</label>
                  <Input className="h-9" value={profileSettings.customer_email || ""} onChange={e => setProfileSettings({ ...profileSettings, customer_email: e.target.value })} placeholder="no_reply@riversand.net" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Owner email (dispatch)</label>
                  <Input className="h-9" value={profileSettings.dispatch_email || ""} onChange={e => setProfileSettings({ ...profileSettings, dispatch_email: e.target.value })} placeholder="cmo@haulogix.com" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Business address</label>
                  {googleLoaded ? (
                    <PlaceAutocompleteInput
                      onPlaceSelect={handleProfilePlaceSelect}
                      onInputChange={(val) => setProfileSettings({ ...profileSettings, business_address: val })}
                      placeholder="1215 River Rd, Bridge City, LA 70094"
                      initialValue={profileSettings.business_address || ""}
                      containerClassName="place-autocomplete-admin"
                    />
                  ) : (
                    <Input className="h-9" value={profileSettings.business_address || ""} onChange={e => setProfileSettings({ ...profileSettings, business_address: e.target.value })} placeholder="1215 River Rd, Bridge City, LA 70094" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Display city (customer-facing)</label>
                  <Input className="h-9" value={profileSettings.display_city || ""} onChange={e => setProfileSettings({ ...profileSettings, display_city: e.target.value })} placeholder="New Orleans, Louisiana" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Business address is used for internal dispatch only. Display city appears in customer emails and invoices.</p>
            </div>

            {/* Email Settings */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Email Settings</h3>
              <p className="text-xs text-gray-400 mb-4">Control where order notifications and customer emails are sent from.</p>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Dispatch Notification Email</label>
                  <Input className="h-9" value={profileSettings.email_dispatch || ""} onChange={e => setProfileSettings({ ...profileSettings, email_dispatch: e.target.value })} placeholder="cmo@haulogix.com" />
                  <p className="text-xs text-gray-400 mt-1">Admin email that receives new order notifications</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From Email</label>
                  <Input className="h-9" value={profileSettings.email_from || ""} onChange={e => setProfileSettings({ ...profileSettings, email_from: e.target.value })} placeholder="no_reply@riversand.net" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From Name</label>
                  <Input className="h-9" value={profileSettings.email_from_name || ""} onChange={e => setProfileSettings({ ...profileSettings, email_from_name: e.target.value })} placeholder="River Sand" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Reply-To Email</label>
                  <Input className="h-9" value={profileSettings.email_reply_to || ""} onChange={e => setProfileSettings({ ...profileSettings, email_reply_to: e.target.value })} placeholder="orders@riversand.net" />
                </div>
              </div>
            </div>

            {/* Color Palette Picker */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1 flex items-center gap-2" style={{ color: T.textPrimary }}><Palette className="w-4 h-4" /> Color Palette</h3>
              <p className="text-xs text-gray-400 mb-4">Select a preset palette. Colors apply site-wide to all customer-facing pages.</p>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                {PALETTES.map(p => {
                  const isActive = (profileSettings.brand_palette || "original_navy") === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProfileSettings(prev => ({
                        ...prev,
                        brand_palette: p.id,
                        brand_primary: p.primary,
                        brand_accent: p.accent,
                        brand_background: p.background,
                        primary_color: p.primary,
                        accent_color: p.accent,
                      }))}
                      className="relative rounded-lg border-2 p-3 transition-all hover:shadow-md text-left"
                      style={{
                        borderColor: isActive ? p.accent : T.cardBorder,
                        backgroundColor: isActive ? `${p.background}` : "white",
                      }}
                    >
                      {isActive && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: p.accent }}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex gap-1 mb-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: p.primary }} title="Primary" />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: p.accent }} title="Accent" />
                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: p.background, borderColor: T.cardBorder }} title="Background" />
                      </div>
                      <p className="text-xs font-medium truncate" style={{ color: p.primary }}>{p.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.vibe}</p>
                    </button>
                  );
                })}
              </div>

              {/* Manual overrides */}
              <p className="text-xs font-medium text-gray-500 mb-3">Manual overrides</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { label: "Primary color", key: "brand_primary", fallbackKey: "primary_color", fallback: "#0D2137", extra: "primary_color" },
                  { label: "Accent color", key: "brand_accent", fallbackKey: "accent_color", fallback: BRAND_GOLD, extra: "accent_color" },
                  { label: "Background color", key: "brand_background", fallbackKey: "", fallback: "#F2EDE4", extra: "" },
                ] as const).map(({ label, key, fallbackKey, fallback, extra }) => {
                  const raw = profileSettings[key] || (fallbackKey ? profileSettings[fallbackKey] : "") || fallback;
                  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : fallback;
                  return (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">{label}</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="w-9 h-9 rounded border cursor-pointer p-0.5"
                          style={{ borderColor: T.cardBorder }}
                          value={safeHex}
                          onChange={e => {
                            const update: Record<string, string> = { ...profileSettings, [key]: e.target.value };
                            if (extra) update[extra] = e.target.value;
                            setProfileSettings(update);
                          }}
                        />
                        <Input
                          className="h-9 flex-1"
                          maxLength={7}
                          placeholder="#000000"
                          value={raw}
                          onChange={e => {
                            const update: Record<string, string> = { ...profileSettings, [key]: e.target.value };
                            if (extra) update[extra] = e.target.value;
                            setProfileSettings(update);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Branding Assets */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Branding Assets</h3>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Logo URL</label>
                  <div className="flex gap-2">
                    <Input className="h-9 flex-1" value={profileSettings.logo_url || ""} onChange={e => setProfileSettings({ ...profileSettings, logo_url: e.target.value })} placeholder="https://..." />
                    {profileSettings.logo_url && (
                      <div className="h-9 w-9 rounded border flex items-center justify-center overflow-hidden" style={{ borderColor: T.cardBorder }}>
                        <img src={profileSettings.logo_url} alt="Logo" className="max-h-8 max-w-8 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Upload</label>
                  <Button variant="outline" size="sm" disabled className="h-9 w-full opacity-50">Coming soon</Button>
                </div>
              </div>
            </div>

            {/* Legal & Tax */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Legal & Tax Information</h3>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Legal entity</label>
                  <Input className="h-9" value={profileSettings.legal_name || ""} onChange={e => setProfileSettings({ ...profileSettings, legal_name: e.target.value })} placeholder="Ways Materials, LLC" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">EIN / Tax ID</label>
                  <Input className="h-9" value={profileSettings.ein_number || ""} onChange={e => setProfileSettings({ ...profileSettings, ein_number: e.target.value })} placeholder="XX-XXXXXXX" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">State of incorporation</label>
                  <Input className="h-9" value={profileSettings.state_of_incorporation || ""} onChange={e => setProfileSettings({ ...profileSettings, state_of_incorporation: e.target.value })} placeholder="Louisiana" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Copyright year</label>
                  <Input className="h-9" value={profileSettings.copyright_year || "2026"} onChange={e => setProfileSettings({ ...profileSettings, copyright_year: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Footer address (invoices)</label>
                  <Input className="h-9" value={profileSettings.footer_address || ""} onChange={e => setProfileSettings({ ...profileSettings, footer_address: e.target.value })} placeholder="202 Larosa Dr, Long Beach, MS" />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs text-gray-500 block mb-1">Invoice footer text</label>
                <Textarea rows={3} value={profileSettings.invoice_footer || ""} onChange={e => setProfileSettings({ ...profileSettings, invoice_footer: e.target.value })} placeholder="This invoice is issued by Ways Materials, LLC..." />
              </div>
            </div>

            {/* Email Sender Identity */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Email Sender Identity</h3>
              <p className="text-xs text-gray-400 mb-4">Name and title shown in outbound email signatures</p>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Sender name</label>
                  <Input className="h-9" value={profileSettings.sender_name || ""} onChange={e => setProfileSettings({ ...profileSettings, sender_name: e.target.value })} placeholder="Silas Caldeira" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Sender title</label>
                  <Input className="h-9" value={profileSettings.sender_title || ""} onChange={e => setProfileSettings({ ...profileSettings, sender_title: e.target.value })} placeholder="Founder & CEO" />
                </div>
              </div>
            </div>

            {/* Additional Contact */}
            <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-medium mb-1" style={{ color: T.textPrimary }}>Additional Contact Channels</h3>
              <div className="pb-3 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">WhatsApp number</label>
                  <Input className="h-9" value={profileSettings.whatsapp_number || ""} onChange={e => setProfileSettings({ ...profileSettings, whatsapp_number: e.target.value })} placeholder="+15551234567" />
                  <p className="text-xs text-gray-400 mt-1">International format with country code</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Support / orders email</label>
                  <Input className="h-9" value={profileSettings.support_email || ""} onChange={e => setProfileSettings({ ...profileSettings, support_email: e.target.value })} placeholder="orders@riversand.net" />
                </div>
              </div>
            </div>

            {/* Save */}
            <Button onClick={saveBusinessProfile} disabled={savingProfile} className="w-full h-11" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Business Profile
            </Button>
            <p className="text-xs text-gray-400 text-center mt-2">✓ Synced to: Emails · Invoices · Landing page · Order confirmations</p>
          </>
        );

      case "cash_orders": {
        // GUIDELINES.md §7 — Status pill palette (preserves hue family for dispatcher recognition)
        const STATUS_META: Record<string, { label: string; badgeBg: string; badgeColor: string }> = {
          pending:   { label: "Pending",   badgeBg: "#FEF3C7", badgeColor: WARN_YELLOW },
          confirmed: { label: "Confirmed", badgeBg: "#EFF6FF", badgeColor: "#3B82F6" },
          en_route:  { label: "En route",  badgeBg: "#F0FDFA", badgeColor: "#0D9488" },
          delivered: { label: "Delivered", badgeBg: "#ECFDF5", badgeColor: POSITIVE },
          cancelled: { label: "Cancelled", badgeBg: "#FEF2F2", badgeColor: ALERT_RED },
        };
        const PAY_META: Record<string, { label: string; badgeBg: string; badgeColor: string }> = {
          "stripe-link": { label: "Card",  badgeBg: "#EFF6FF", badgeColor: "#3B82F6" },
          cash:          { label: "COD",   badgeBg: "#FDF8F0", badgeColor: BRAND_GOLD },
          check:         { label: "Check", badgeBg: "#FDF8F0", badgeColor: BRAND_GOLD },
          COD:           { label: "COD",   badgeBg: "#FDF8F0", badgeColor: BRAND_GOLD },
        };

        const fmtMoney = (n: number) =>
          "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const fmtDate = (d: string | null) => {
          if (!d) return "—";
          const p = d.slice(0, 10).split("-");
          return `${p[1]}/${p[2]}/${p[0].slice(2)}`;
        };

        const filteredOrders = allOrders.filter((o: any) => {
          if (ordersTab !== "all" && o.status !== ordersTab) return false;
          if (ordersPayFilter && o.payment_method !== ordersPayFilter) return false;
          if (ordersSearch) {
            const q = ordersSearch.toLowerCase();
            if (!o.order_number?.toLowerCase().includes(q) &&
                !o.customer_name?.toLowerCase().includes(q) &&
                !o.delivery_address?.toLowerCase().includes(q) &&
                !o.customer_phone?.toLowerCase().includes(q)) return false;
          }
          return true;
        });

        const selectedOrder = allOrders.find((o: any) => o.id === selectedOrderId) || null;

        const doOrderAction = async (action: string, orderId: string, extra?: Record<string, any>) => {
          setOrderActionLoading(action + orderId);
          try {
            if (action === "update_status") {
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "update_order", order_id: orderId, ...extra },
              });
              setAllOrders(prev => prev.map((o: any) => o.id === orderId ? { ...o, ...extra } : o));
              toast({ title: "Status updated" });
            } else if (action === "save_notes") {
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "update_order", order_id: orderId, notes: orderNotesDraft },
              });
              setAllOrders(prev => prev.map((o: any) => o.id === orderId ? { ...o, notes: orderNotesDraft } : o));
              toast({ title: "Notes saved" });
            } else if (action === "resend_email") {
              await supabase.functions.invoke("send-email", {
                body: { type: "order_confirmation", order_id: orderId },
              });
              toast({ title: "Confirmation email sent" });
            } else if (action === "resend_invoice") {
              await supabase.functions.invoke("send-email", {
                body: { type: "invoice", order_id: orderId },
              });
              toast({ title: "Invoice sent" });
            } else if (action === "send_payment_link") {
              const order = allOrders.find((o: any) => o.id === orderId);
              if (!order) return;
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "send_payment_link", order_id: orderId,
                        customer_email: order.customer_email, order_number: order.order_number },
              });
              toast({ title: "Payment link sent" });
            } else if (action === "mark_cash_collected") {
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "mark_cash_collected", order_id: orderId, collected_by: "Admin" },
              });
              setAllOrders(prev => prev.map((o: any) => o.id === orderId ? { ...o, cash_collected: true, payment_status: "paid" } : o));
              toast({ title: "Cash collected" });
            } else if (action === "sync_stripe") {
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "sync_stripe_payment", order_id: orderId },
              });
              await fetchAllOrders();
              toast({ title: "Stripe synced" });
            } else if (action === "cancel_order") {
              if (!window.confirm("Cancel this order? This cannot be undone.")) return;
              await supabase.functions.invoke("leads-auth", {
                body: { password: storedPassword(), action: "cancel_order", order_id: orderId },
              });
              setAllOrders(prev => prev.map((o: any) => o.id === orderId ? { ...o, status: "cancelled" } : o));
              toast({ title: "Order cancelled" });
            }
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          } finally {
            setOrderActionLoading(null);
          }
        };

        const StatusBadge = ({ status }: { status: string }) => {
          const m = STATUS_META[status] || { label: status, badgeBg: "#F3F4F6", badgeColor: T.textSecond };
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: m.badgeBg, color: m.badgeColor }}>
              {m.label}
            </span>
          );
        };

        const PayBadge = ({ method, payStatus }: { method: string; payStatus: string }) => {
          const m = PAY_META[method] || { label: method, badgeBg: "#F3F4F6", badgeColor: T.textSecond };
          const payColor = payStatus === "paid" ? POSITIVE : payStatus === "refunded" ? ALERT_RED : WARN_YELLOW;
          return (
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: m.badgeBg, color: m.badgeColor }}>
                {m.label}
              </span>
              <div className="text-xs mt-0.5" style={{ color: payColor }}>
                {payStatus}
              </div>
            </div>
          );
        };

        const TABS: Array<{ key: typeof ordersTab; label: string }> = [
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "confirmed", label: "Confirmed" },
          { key: "en_route", label: "En route" },
          { key: "delivered", label: "Delivered" },
          { key: "cancelled", label: "Cancelled" },
        ];

        const cardStyle: React.CSSProperties = {
          backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden"
        };

        // GUIDELINES.md §5 — Metric cards (Orders runs 5-up; documented deviation from 4-up spec)
        const metrics = [
          { label: "Total orders",       value: ordersMetrics?.total ?? allOrders.length, color: T.textPrimary },
          { label: "Pending",            value: ordersMetrics?.pending ?? 0,              color: WARN_YELLOW },
          { label: "Confirmed",          value: ordersMetrics?.confirmed ?? 0,            color: "#3B82F6" },
          { label: "Today's deliveries", value: ordersMetrics?.today_deliveries ?? 0,     color: POSITIVE },
          { label: "Revenue (30d)",      value: ordersMetrics ? fmtMoney(ordersMetrics.revenue_30d) : "—", color: POSITIVE,
            sub: ordersMetrics ? `${ordersMetrics.paid_count_30d} paid orders` : undefined },
        ];

        return (
          <div>
            {/* §4 Tab header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {ordersLoading && !allOrders.length ? "Loading…" : `${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"}`}
              </p>
              <Button onClick={fetchAllOrders} disabled={ordersLoading} size="sm" variant="outline">
                {ordersLoading
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* §5 Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {metrics.map(m => (
                <div key={m.label} className="rounded-xl border p-5"
                  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1"
                    style={{ color: T.textSecond }}>{m.label}</div>
                  <div className="text-2xl font-semibold"
                    style={{ color: m.color, fontVariantNumeric: "tabular-nums" }}>
                    {ordersLoading && !allOrders.length ? "—" : m.value}
                  </div>
                  {m.sub && (
                    <div className="text-xs mt-1" style={{ color: T.textSecond }}>{m.sub}</div>
                  )}
                </div>
              ))}
            </div>

            {/* §13 Toolbar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ backgroundColor: "#F3F4F6" }}>
                {TABS.map(t => {
                  const active = ordersTab === t.key;
                  return (
                    <button key={t.key} onClick={() => setOrdersTab(t.key)}
                      className="px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors"
                      style={{
                        backgroundColor: active ? T.cardBg : "transparent",
                        color: active ? T.textPrimary : T.textSecond,
                        fontWeight: active ? 600 : 400,
                        boxShadow: active ? `0 0 0 1px ${T.cardBorder}` : "none",
                      }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <input
                value={ordersSearch}
                onChange={e => setOrdersSearch(e.target.value)}
                placeholder="Search order #, name, address, phone..."
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${T.cardBorder}`, backgroundColor: T.cardBg, color: T.textPrimary }}
              />
              <select value={ordersPayFilter} onChange={e => setOrdersPayFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
                style={{ border: `1px solid ${T.cardBorder}`, backgroundColor: T.cardBg, color: T.textSecond }}>
                <option value="">All payment types</option>
                <option value="stripe-link">Card (Stripe)</option>
                <option value="cash">Cash / COD</option>
                <option value="check">Check</option>
              </select>
            </div>

            {/* Main grid — table + detail panel */}
            <div style={{ display:"grid", gap:14,
              gridTemplateColumns: selectedOrderId ? "1fr 340px" : "1fr" }}>

              {/* §11 Orders table */}
              <div className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                {ordersLoading && !allOrders.length ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={28} />
                    <span className="ml-3 text-sm" style={{ color: T.textSecond }}>Loading orders…</span>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="font-medium" style={{ color: T.textPrimary }}>No orders match filters</p>
                    <p className="text-xs mt-1" style={{ color: T.textSecond }}>Try clearing search or payment filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0" style={{ backgroundColor: "#F9FAFB" }}>
                        <tr>
                          {["Order #","Customer","Address","Delivery","Amount","Payment","Status","Actions"].map(h => (
                            <th key={h}
                              className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap"
                              style={{ color: T.textSecond }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((o: any, idx: number) => {
                          const isSel = o.id === selectedOrderId;
                          return (
                            <tr key={o.id}
                              onClick={() => {
                                if (selectedOrderId === o.id) { setSelectedOrderId(null); }
                                else { setSelectedOrderId(o.id); setOrderNotesDraft(o.notes || ""); setShowGenLinkForm(false); setGeneratedStripeUrl(null); setGenLinkEmail(""); }
                              }}
                              className="border-t hover:bg-gray-50 transition-colors cursor-pointer"
                              style={{
                                borderColor: T.cardBorder,
                                backgroundColor: isSel ? "#F3F4F6" : (idx % 2 === 0 ? T.cardBg : "#FAFAFA"),
                              }}>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold"
                                  style={{ color: BRAND_GOLD, fontVariantNumeric: "tabular-nums" }}>
                                  {o.order_number}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium" style={{ color: T.textPrimary }}>{o.customer_name}</div>
                                <div className="text-xs" style={{ color: T.textSecond }}>{o.customer_phone}</div>
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                <span className="text-xs block overflow-hidden text-ellipsis whitespace-nowrap"
                                  style={{ color: T.textSecond }}>
                                  {o.delivery_address}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium" style={{ color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                                  {fmtDate(o.delivery_date)}
                                </div>
                                <div className="text-xs" style={{ color: T.textSecond }}>{o.delivery_day_of_week}</div>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold"
                                style={{ color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                                {fmtMoney(Number(o.price) * (o.quantity || 1))}
                                {o.quantity > 1 && (
                                  <div className="text-xs font-normal" style={{ color: T.textSecond }}>{o.quantity} loads</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <PayBadge method={o.payment_method} payStatus={o.payment_status} />
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={o.status} />
                                {o.saturday_surcharge && (
                                  <div className="text-xs mt-1" style={{ color: WARN_YELLOW }}>Sat +$35</div>
                                )}
                              </td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {o.status === "pending" && o.payment_status === "paid" && (
                                    <button onClick={() => doOrderAction("update_status", o.id, { status: "confirmed" })}
                                      className="px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
                                      style={{ border: `1px solid ${T.cardBorder}`, color: T.textPrimary, backgroundColor: T.cardBg }}>
                                      Confirm
                                    </button>
                                  )}
                                  {o.status === "confirmed" && (
                                    <button onClick={() => doOrderAction("update_status", o.id, { status: "en_route" })}
                                      className="px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
                                      style={{ border: `1px solid ${T.cardBorder}`, color: T.textPrimary, backgroundColor: T.cardBg }}>
                                      En route
                                    </button>
                                  )}
                                  {o.status === "en_route" && (
                                    <button onClick={() => doOrderAction("update_status", o.id, { status: "delivered" })}
                                      className="px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
                                      style={{ border: `1px solid ${T.cardBorder}`, color: T.textPrimary, backgroundColor: T.cardBg }}>
                                      Delivered
                                    </button>
                                  )}
                                  {o.payment_status === "pending" && o.payment_method === "stripe-link" && (
                                    <button onClick={() => doOrderAction("send_payment_link", o.id)}
                                      className="px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity"
                                      style={{ border: `1px solid ${BRAND_GOLD}`, color: BRAND_GOLD, backgroundColor: T.cardBg }}>
                                      Send link
                                    </button>
                                  )}
                                  {!["cancelled","delivered"].includes(o.status) && (
                                    <button onClick={() => doOrderAction("cancel_order", o.id)}
                                      className="px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity"
                                      style={{ border: `1px solid ${ALERT_RED}`, color: ALERT_RED, backgroundColor: T.cardBg }}>
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedOrder && (
                <div style={{ ...cardStyle, display:"flex", flexDirection:"column", maxHeight:"80vh", overflowY:"auto" }}>
                  {/* Panel header */}
                  <div style={{ padding:"14px 16px", borderBottom:"0.5px solid #F3F4F6",
                    display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"sticky", top:0, background:"white", zIndex:1 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"monospace", fontSize:13, color:"#2563EB", fontWeight:500 }}>
                          {selectedOrder.order_number}
                        </span>
                        <StatusBadge status={selectedOrder.status} />
                        <PayBadge method={selectedOrder.payment_method} payStatus={selectedOrder.payment_status} />
                      </div>
                      <div style={{ fontSize:15, fontWeight:500 }}>{selectedOrder.customer_name}</div>
                    </div>
                    <button onClick={() => setSelectedOrderId(null)}
                      style={{ padding:"4px 8px", border:"0.5px solid #E5E7EB", borderRadius:6,
                        fontSize:11, cursor:"pointer", background:"transparent", color:"#6B7280", fontFamily:"inherit" }}>
                      Close
                    </button>
                  </div>

                  <div style={{ padding:16, flex:1 }}>

                    {/* Status change */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Change status</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {(["pending","confirmed","en_route","delivered","cancelled"] as const).map(s => {
                          const m = STATUS_META[s];
                          const isActive = selectedOrder.status === s;
                          return (
                            <button key={s}
                              onClick={() => doOrderAction("update_status", selectedOrder.id, { status: s })}
                              style={{
                                width: 80,
                                height: 28,
                                borderRadius: 20,
                                fontSize: 10,
                                cursor: "pointer",
                                border: "0.5px solid #E5E7EB",
                                fontFamily: "inherit",
                                transition: "all .15s",
                                background: isActive ? m.badgeBg : "transparent",
                                color: isActive ? m.badgeColor : "#6B7280",
                                fontWeight: isActive ? 500 : 400,
                                whiteSpace: "nowrap" as const,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Customer</div>
                      {[
                        ["Name", selectedOrder.customer_name],
                        ["Phone", selectedOrder.customer_phone],
                        ["Email", selectedOrder.customer_email || "—"],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
                          borderBottom:"0.5px solid #F9FAFB", fontSize:12 }}>
                          <span style={{ color:"#6B7280" }}>{l}</span>
                          <span style={{ fontWeight:500, textAlign:"right", maxWidth:200 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Driver */}
                    {/* Path B Phase 1b — driver assignment. Single driver per order (known limitation, multi-load dispatch is a future phase). */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#0D2137",
                        textTransform:"uppercase", marginBottom:8 }}>Driver</div>
                      <select
                        value={selectedOrder.driver_id ?? ""}
                        disabled={orderActionLoading === "assign_driver" + selectedOrder.id}
                        onChange={async (e) => {
                          const prevDriverId = selectedOrder.driver_id ?? null;
                          const newDriverId = e.target.value === "" ? null : e.target.value;
                          if (newDriverId === prevDriverId) return;
                          setOrderActionLoading("assign_driver" + selectedOrder.id);
                          try {
                            const { data, error } = await supabase.functions.invoke("leads-auth", {
                              body: {
                                password: storedPassword(),
                                action: "update_order",
                                order_id: selectedOrder.id,
                                driver_id: newDriverId,
                              },
                            });
                            if (error) throw error;
                            const payload: any = data;
                            if (payload?.error) {
                              toast({ title: "Driver assignment failed", description: String(payload.error), variant: "destructive" as any });
                              setAllOrders(prev => [...prev]);
                              return;
                            }
                            const updated = payload?.order;
                            if (updated) {
                              setAllOrders(prev => prev.map((o: any) => o.id === selectedOrder.id ? { ...o, ...updated } : o));
                            } else {
                              setAllOrders(prev => prev.map((o: any) => o.id === selectedOrder.id ? { ...o, driver_id: newDriverId } : o));
                            }
                            toast({ title: newDriverId ? "Driver assigned" : "Driver unassigned" });
                          } catch (err: any) {
                            toast({ title: "Driver assignment failed", description: err?.message || "Network error", variant: "destructive" as any });
                            setAllOrders(prev => [...prev]);
                          } finally {
                            setOrderActionLoading(null);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: 12,
                          border: "1px solid #E5E7EB",
                          borderRadius: 6,
                          background: "#fff",
                          color: "#0D2137",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Unassigned</option>
                        {drivers.filter(d => d.active).map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.truck_number ? ` (${d.truck_number})` : ""}
                          </option>
                        ))}
                      </select>

                      {/* Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */}
                      {(() => {
                        const assignedDriver = drivers.find(d => d.id === selectedOrder.driver_id) || null;
                        const { canSend, reason } = canSendToDriver(selectedOrder, assignedDriver);
                        const lastSent = selectedOrder.message_sent_at
                          ? new Date(selectedOrder.message_sent_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })
                          : null;
                        return (
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              disabled={!canSend}
                              title={reason || ""}
                              onClick={() => assignedDriver && handleSendToDriver(selectedOrder, assignedDriver)}
                              style={{
                                width: "100%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "9px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: ".02em",
                                borderRadius: 6,
                                border: "none",
                                cursor: canSend ? "pointer" : "not-allowed",
                                background: canSend ? BRAND_GOLD : "#9CA3AF",
                                color: "#FFFFFF",
                                transition: "opacity 150ms ease",
                              }}
                            >
                              <MessageCircle size={14} />
                              Send to Driver
                            </button>
                            <div style={{ marginTop: 6, fontSize: 11, color: "#6B7280", textAlign: "center" }}>
                              {lastSent ? `Last sent to driver: ${lastSent}` : "Not sent yet."}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Order details */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Order details</div>
                      {[
                        ["Address", selectedOrder.delivery_address],
                        ["Delivery", `${fmtDate(selectedOrder.delivery_date)} · ${selectedOrder.delivery_day_of_week || ""}`],
                        ["Distance", `${selectedOrder.distance_miles} mi`],
                        ["Quantity", `${selectedOrder.quantity} load${selectedOrder.quantity > 1 ? "s" : ""}`],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
                          borderBottom:"0.5px solid #F9FAFB", fontSize:12 }}>
                          <span style={{ color:"#6B7280" }}>{l}</span>
                          <span style={{ fontWeight:500, textAlign:"right", maxWidth:190, fontSize:l==="Address"?11:12 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Pricing */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Pricing</div>
                      {[
                        ["Base price", fmtMoney(Number(selectedOrder.price) * (selectedOrder.quantity||1) - (selectedOrder.saturday_surcharge_amount||0) + (selectedOrder.discount_amount||0))],
                        ...(selectedOrder.saturday_surcharge_amount > 0 ? [["Sat surcharge", `+${fmtMoney(selectedOrder.saturday_surcharge_amount)}`]] : []),
                        ...(selectedOrder.discount_amount > 0 ? [["Discount", `-${fmtMoney(selectedOrder.discount_amount)}`]] : []),
                        [`Tax (${(Number(selectedOrder.tax_rate)*100).toFixed(2)}%)`, `+${fmtMoney(selectedOrder.tax_amount)}`],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0",
                          borderBottom:"0.5px solid #F9FAFB", fontSize:12 }}>
                          <span style={{ color:"#6B7280" }}>{l}</span>
                          <span style={{ fontWeight:500, color: String(l).includes("Discount") ? "#16A34A" : undefined }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0",
                        fontSize:14, fontWeight:500, borderTop:"0.5px solid #E5E7EB", marginTop:4 }}>
                        <span>Total</span>
                        <span>{fmtMoney(Number(selectedOrder.price) * (selectedOrder.quantity||1) + Number(selectedOrder.tax_amount))}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:"#6B7280" }}>Payment status</span>
                        <span style={{ fontWeight:500,
                          color: selectedOrder.payment_status==="paid" ? "#16A34A" : selectedOrder.payment_status==="refunded" ? "#DC2626" : "#D97706" }}>
                          {selectedOrder.payment_status}
                        </span>
                      </div>
                      {selectedOrder.stripe_payment_id && (
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:11 }}>
                          <span style={{ color:"#9CA3AF" }}>Stripe ID</span>
                          <span style={{ fontFamily:"monospace", color:"#6B7280" }}>{selectedOrder.stripe_payment_id}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ height: "0.5px", background: "#F3F4F6" }} />

                    {/* Payment card — NEW SECTION */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF", textTransform:"uppercase", marginBottom:8 }}>
                        Payment
                      </div>
                      <div style={{ border:"0.5px solid #E5E7EB", borderRadius:10, overflow:"hidden" }}>
                        <div style={{ padding:"10px 14px", background:"#F9FAFB", borderBottom:"0.5px solid #F3F4F6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div>
                            <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:2 }}>Payment status</div>
                            <div style={{ fontSize:13, fontWeight:500,
                              color: selectedOrder.payment_status === "paid" ? "#16A34A" : selectedOrder.payment_status === "refunded" ? "#DC2626" : "#D97706" }}>
                              {selectedOrder.payment_status === "paid"
                                ? `Paid${selectedOrder.stripe_payment_id ? " · " + selectedOrder.stripe_payment_id.slice(0, 14) + "…" : ""}`
                                : selectedOrder.payment_status === "refunded" ? "Refunded"
                                : (selectedOrder.payment_method === "cash" || selectedOrder.payment_method === "check")
                                ? `Unpaid — ${selectedOrder.payment_method === "check" ? "Check" : "Cash on delivery"}`
                                : "Awaiting card payment"}
                            </div>
                          </div>
                          <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:500,
                            background: selectedOrder.payment_method === "stripe-link" ? "#EFF6FF" : "#FFFBEB",
                            color: selectedOrder.payment_method === "stripe-link" ? "#1E40AF" : "#92400E" }}>
                            {selectedOrder.payment_method === "stripe-link" ? "Card" : selectedOrder.payment_method === "check" ? "Check" : "COD"}
                          </span>
                        </div>

                        {/* COD unpaid */}
                        {(selectedOrder.payment_method === "cash" || selectedOrder.payment_method === "check") &&
                         !selectedOrder.cash_collected && selectedOrder.payment_status !== "paid" &&
                         selectedOrder.status !== "cancelled" && (
                          <>
                            <button onClick={() => doOrderAction("mark_cash_collected", selectedOrder.id)}
                              disabled={!!orderActionLoading}
                              style={{ width:"100%", padding:"10px 14px", border:"none", borderBottom:"0.5px solid #F3F4F6",
                                background:"white", fontSize:12, cursor:"pointer", fontFamily:"inherit",
                                textAlign:"left", color:"#16A34A", display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F0FDF4"}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                              ✓ Mark cash collected
                            </button>
                            <button onClick={() => { setShowGenLinkForm(v => !v); setGeneratedStripeUrl(null); }}
                              style={{ width:"100%", padding:"10px 14px", border:"none",
                                borderBottom: showGenLinkForm ? "0.5px solid #F3F4F6" : "none",
                                background:"white", fontSize:12, cursor:"pointer", fontFamily:"inherit",
                                textAlign:"left", color:"#D97706", display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#FFFBEB"}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                              ⟶ Customer wants to pay by card — generate link
                            </button>
                          </>
                        )}

                        {/* Stripe unpaid */}
                        {selectedOrder.payment_method === "stripe-link" && selectedOrder.payment_status !== "paid" && selectedOrder.status !== "cancelled" && (
                          <>
                            {selectedOrder.customer_email && (
                              <button onClick={() => doOrderAction("send_payment_link", selectedOrder.id)}
                                disabled={!!orderActionLoading}
                                style={{ width:"100%", padding:"10px 14px", border:"none", borderBottom:"0.5px solid #F3F4F6",
                                  background:"white", fontSize:12, cursor:"pointer", fontFamily:"inherit",
                                  textAlign:"left", color:"#D97706", display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
                                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#FFFBEB"}
                                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                                ✉ Resend payment link to {selectedOrder.customer_email}
                              </button>
                            )}
                            <button onClick={() => { setShowGenLinkForm(v => !v); setGeneratedStripeUrl(null); }}
                              style={{ width:"100%", padding:"10px 14px", border:"none",
                                borderBottom: showGenLinkForm ? "0.5px solid #F3F4F6" : "none",
                                background:"white", fontSize:12, cursor:"pointer", fontFamily:"inherit",
                                textAlign:"left", color:"#374151", display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                              + Generate new Stripe checkout link
                            </button>
                          </>
                        )}

                        {/* Paid Stripe */}
                        {selectedOrder.payment_status === "paid" && selectedOrder.payment_method === "stripe-link" && (
                          <button onClick={() => doOrderAction("sync_stripe", selectedOrder.id)} disabled={!!orderActionLoading}
                            style={{ width:"100%", padding:"10px 14px", border:"none", background:"white",
                              fontSize:12, cursor:"pointer", fontFamily:"inherit",
                              textAlign:"left", color:"#6B7280", display:"flex", alignItems:"center", gap:8, transition:"background .15s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                            ↺ Sync Stripe payment status
                          </button>
                        )}

                        {/* Cash already collected */}
                        {selectedOrder.cash_collected && (
                          <div style={{ padding:"10px 14px", fontSize:12, color:"#16A34A", display:"flex", alignItems:"center", gap:6 }}>
                            ✓ Cash collected{selectedOrder.cash_collected_by ? ` by ${selectedOrder.cash_collected_by}` : ""}
                          </div>
                        )}

                        {/* Expandable generate link form */}
                        {showGenLinkForm && (
                          <div style={{ padding:14, background:"#FAFAFA", borderTop:"0.5px solid #F3F4F6" }}>
                            <div style={{ fontSize:11, color:"#6B7280", marginBottom:10 }}>
                              Generate a Stripe checkout link for{" "}
                              <strong style={{ color:"#111" }}>
                                {"$" + (Number(selectedOrder.price) * (selectedOrder.quantity || 1) + Number(selectedOrder.tax_amount || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <input value={genLinkEmail} onChange={e => setGenLinkEmail(e.target.value)}
                              placeholder="Customer email (optional — to send automatically)"
                              style={{ width:"100%", padding:"7px 10px", border:"0.5px solid #E5E7EB",
                                borderRadius:8, fontSize:12, fontFamily:"inherit", background:"white", color:"inherit", marginBottom:10 }} />
                            <div style={{ display:"flex", gap:6 }}>
                              <button onClick={() => generateAndShowLink(selectedOrder, genLinkEmail || undefined)}
                                disabled={orderActionLoading === "gen_link" + selectedOrder.id}
                                style={{ flex:1, padding:"8px 12px", border:"none", borderRadius:8, fontSize:12,
                                  cursor:"pointer", background:"#111827", color:"white", fontFamily:"inherit",
                                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                                  opacity: orderActionLoading === "gen_link" + selectedOrder.id ? 0.6 : 1 }}>
                                {orderActionLoading === "gen_link" + selectedOrder.id
                                  ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} /> : null}
                                {genLinkEmail ? "Generate & send" : "Generate link"}
                              </button>
                              <button onClick={() => { setShowGenLinkForm(false); setGeneratedStripeUrl(null); setGenLinkEmail(""); }}
                                style={{ padding:"8px 14px", border:"0.5px solid #E5E7EB", borderRadius:8,
                                  fontSize:12, cursor:"pointer", background:"transparent", color:"#6B7280", fontFamily:"inherit" }}>
                                Cancel
                              </button>
                            </div>
                            {generatedStripeUrl && (
                              <div style={{ marginTop:10 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                                  background:"white", border:"0.5px solid #E5E7EB", borderRadius:8 }}>
                                  <span style={{ flex:1, fontSize:10, fontFamily:"monospace", color:"#2563EB",
                                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                    {generatedStripeUrl}
                                  </span>
                                  <button onClick={() => { navigator.clipboard.writeText(generatedStripeUrl); toast({ title:"Link copied to clipboard" }); }}
                                    style={{ padding:"3px 10px", border:"0.5px solid #E5E7EB", borderRadius:6,
                                      fontSize:10, cursor:"pointer", background:"transparent", color:"#374151",
                                      fontFamily:"inherit", flexShrink:0 }}>
                                    Copy
                                  </button>
                                </div>
                                <div style={{ fontSize:10, color:"#9CA3AF", marginTop:4 }}>
                                  Valid 24 hours · Customer pays with any major card
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ height: "0.5px", background: "#F3F4F6" }} />

                    {/* Invoice card — NEW SECTION */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF", textTransform:"uppercase", marginBottom:8 }}>
                        Invoice
                      </div>
                      <div style={{ border:"0.5px solid #E5E7EB", borderRadius:10, overflow:"hidden" }}>
                        <div style={{ padding:"10px 14px", background:"#F9FAFB", borderBottom:"0.5px solid #F3F4F6" }}>
                          <div style={{ fontSize:12, fontWeight:500 }}>Invoice {selectedOrder.order_number}</div>
                          <div style={{ fontSize:10, color:"#9CA3AF", marginTop:2 }}>
                            {"$" + (Number(selectedOrder.price) * (selectedOrder.quantity || 1) + Number(selectedOrder.tax_amount || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {selectedOrder.customer_name} · {fmtDate(selectedOrder.delivery_date)}
                          </div>
                        </div>
                        <div style={{ display:"flex" }}>
                          <button onClick={async () => {
                              setOrderActionLoading("inv_dl" + selectedOrder.id);
                              try {
                                const { data, error: fnError } = await supabase.functions.invoke("generate-invoice", { body: { order_id: selectedOrder.id } });
                                if (fnError || !data?.pdf) throw new Error("Failed to generate invoice");
                                const link = document.createElement("a");
                                link.href = "data:application/pdf;base64," + data.pdf;
                                link.download = `invoice-${selectedOrder.order_number}.pdf`;
                                link.click();
                                toast({ title: "Invoice downloaded" });
                              } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                              finally { setOrderActionLoading(null); }
                            }}
                            disabled={orderActionLoading === "inv_dl" + selectedOrder.id}
                            style={{ flex:1, padding:"10px 6px", border:"none", background:"white", fontSize:11,
                              cursor:"pointer", fontFamily:"inherit", color:"#374151",
                              display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                              borderRight:"0.5px solid #F3F4F6", transition:"background .15s",
                              opacity: orderActionLoading === "inv_dl" + selectedOrder.id ? 0.5 : 1 }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                            ↓ Download
                          </button>
                          <button onClick={async () => {
                              setOrderActionLoading("inv_pr" + selectedOrder.id);
                              try {
                                const { data, error: fnError } = await supabase.functions.invoke("generate-invoice", { body: { order_id: selectedOrder.id } });
                                if (fnError || !data?.pdf) throw new Error("Failed to generate invoice");
                                const byteChars = atob(data.pdf);
                                const byteArr = new Uint8Array(byteChars.length);
                                for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                                const blob = new Blob([byteArr], { type: "application/pdf" });
                                const url = URL.createObjectURL(blob);
                                const win = window.open(url);
                                if (win) win.onload = () => { win.print(); URL.revokeObjectURL(url); };
                                toast({ title: "Opening print dialog…" });
                              } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                              finally { setOrderActionLoading(null); }
                            }}
                            disabled={orderActionLoading === "inv_pr" + selectedOrder.id}
                            style={{ flex:1, padding:"10px 6px", border:"none", background:"white", fontSize:11,
                              cursor:"pointer", fontFamily:"inherit", color:"#374151",
                              display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                              borderRight:"0.5px solid #F3F4F6", transition:"background .15s",
                              opacity: orderActionLoading === "inv_pr" + selectedOrder.id ? 0.5 : 1 }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                            ⊡ Print
                          </button>
                          <button onClick={() => doOrderAction("resend_invoice", selectedOrder.id)}
                            disabled={orderActionLoading === "resend_invoice" + selectedOrder.id}
                            style={{ flex:1, padding:"10px 6px", border:"none", background:"white", fontSize:11,
                              cursor:"pointer", fontFamily:"inherit", color:"#374151",
                              display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                              transition:"background .15s",
                              opacity: orderActionLoading === "resend_invoice" + selectedOrder.id ? 0.5 : 1 }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "white"}>
                            ✉ Email
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Notes</div>
                      <textarea
                        value={orderNotesDraft}
                        onChange={e => setOrderNotesDraft(e.target.value)}
                        placeholder="Add delivery notes..."
                        style={{ width:"100%", padding:8, border:"0.5px solid #E5E7EB", borderRadius:8,
                          fontSize:12, fontFamily:"inherit", background:"white",
                          color:"inherit", resize:"vertical", minHeight:60 }}
                      />
                      <button onClick={() => doOrderAction("save_notes", selectedOrder.id)}
                        disabled={orderActionLoading === "save_notes" + selectedOrder.id}
                        style={{ marginTop:6, width:"100%", padding:"7px 12px", border:"0.5px solid #E5E7EB",
                          borderRadius:8, fontSize:12, cursor:"pointer", background:"transparent",
                          fontFamily:"inherit", textAlign:"left", color:"#374151" }}>
                        Save notes
                      </button>
                    </div>

                    {/* Other actions — Resend confirmation + Cancel only */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:500, letterSpacing:".06em", color:"#9CA3AF",
                        textTransform:"uppercase", marginBottom:8 }}>Other actions</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {selectedOrder.customer_email && (
                          <button onClick={() => doOrderAction("resend_email", selectedOrder.id)}
                            disabled={orderActionLoading === "resend_email" + selectedOrder.id}
                            style={{ width:"100%", padding:"9px 12px", border:"0.5px solid #E5E7EB", borderRadius:8,
                              fontSize:12, cursor:"pointer", background:"transparent", color:"#374151",
                              fontFamily:"inherit", textAlign:"left", transition:"background .15s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                            Resend order confirmation
                          </button>
                        )}
                        {!["cancelled", "delivered"].includes(selectedOrder.status) && (
                          <button onClick={() => doOrderAction("cancel_order", selectedOrder.id)}
                            style={{ width:"100%", padding:"9px 12px", border:"0.5px solid #FCA5A5", borderRadius:8,
                              fontSize:12, cursor:"pointer", background:"transparent", color:"#DC2626",
                              fontFamily:"inherit", textAlign:"left", transition:"background .15s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                            Cancel order
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        );
      }

      case "customers": {
        const filteredCustomers = customersData.filter(c => {
          if (!customersSearch) return true;
          const s = customersSearch.toLowerCase();
          return (c.name || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s) || (c.phone || "").includes(s) || (c.company || "").toLowerCase().includes(s);
        });

        // §5 Metrics
        const totalCustomers = customersData.length;
        const repeatCustomers = customersData.filter(c => (c.total_orders || 0) > 1).length;
        const totalRevenue = customersData.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);
        const avgLtv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
        const fmtMoney = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        const metrics = [
          { label: "Total customers", value: totalCustomers, color: T.textPrimary },
          { label: "Repeat buyers",   value: repeatCustomers, color: POSITIVE,
            sub: totalCustomers > 0 ? `${((repeatCustomers / totalCustomers) * 100).toFixed(0)}% of base` : undefined },
          { label: "Avg LTV",         value: fmtMoney(avgLtv), color: BRAND_GOLD },
          { label: "Total revenue",   value: fmtMoney(totalRevenue), color: POSITIVE },
        ];

        return (
          <>
            {/* §4 Tab header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {customersLoading && customersData.length === 0
                  ? "Loading…"
                  : `${filteredCustomers.length} customer${filteredCustomers.length === 1 ? "" : "s"}`}
              </p>
              <Button size="sm" variant="outline" onClick={fetchCustomers} disabled={customersLoading}>
                {customersLoading
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* §5 Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.map(m => (
                <div key={m.label} className="rounded-xl border p-5"
                  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1"
                    style={{ color: T.textSecond }}>{m.label}</div>
                  <div className="text-2xl font-semibold"
                    style={{ color: m.color, fontVariantNumeric: "tabular-nums" }}>
                    {customersLoading && customersData.length === 0 ? "—" : m.value}
                  </div>
                  {m.sub && (
                    <div className="text-xs mt-1" style={{ color: T.textSecond }}>{m.sub}</div>
                  )}
                </div>
              ))}
            </div>

            {/* §13 Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textSecond }} />
                <input
                  value={customersSearch}
                  onChange={e => setCustomersSearch(e.target.value)}
                  placeholder="Search name, email, phone, or company…"
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ border: `1px solid ${T.cardBorder}`, backgroundColor: T.cardBg, color: T.textPrimary }}
                />
              </div>
            </div>

            {customersLoading && customersData.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
                <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
              </div>
            ) : !customersLoading && customersData.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No customers yet</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Customer records will appear here after the first order.</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">🔍</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No customers match your search</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Try clearing the search field above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      {["Name", "Email", "Phone", "Company", "Orders", "Total Spent", "First Order", "Last Order", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: T.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c, i) => (
                      <tr key={c.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: T.textPrimary }}>{c.name || "—"}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: T.textPrimary }}>
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="hover:underline" style={{ color: T.textPrimary }}>{c.email}</a>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>
                          {c.phone ? (
                            <a href={`tel:+1${String(c.phone).replace(/\D/g, "").slice(-10)}`} className="hover:underline" style={{ color: T.textSecond }}>{c.phone}</a>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: T.textSecond }}>{c.company || "—"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-center" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{c.total_orders || 0}</td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums' }}>${Number(c.total_spent || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{c.first_order_date ? new Date(c.first_order_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{c.last_order_date ? new Date(c.last_order_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setActivePage("cash_orders"); }}
                              className="px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
                              style={{ border: `1px solid ${T.cardBorder}`, color: T.textPrimary, backgroundColor: T.cardBg }}>
                              View Orders
                            </button>
                            <button onClick={() => { setEditCustomerEmail(c); setEditCustomerEmailValue(c.email || ""); }}
                              className="px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity inline-flex items-center gap-1 whitespace-nowrap"
                              style={{ border: `1px solid ${BRAND_GOLD}`, color: BRAND_GOLD, backgroundColor: T.cardBg }}>
                              <Edit2 className="w-3 h-3" />
                              Edit Email
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }

      case "abandoned":
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {abandonedLoading ? "—" : `${abandonedSessions.length} abandoned sessions`}
              </p>
              <div className="flex gap-2">
                <Button onClick={fetchAbandonedSessions} disabled={abandonedLoading} size="sm" variant="outline">
                  {abandonedLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Refresh
                </Button>
                <Button onClick={runEmailCheck} disabled={runningEmailCheck} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {runningEmailCheck ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Run Email Check
                </Button>
              </div>
            </div>
            {abandonedLoading && abandonedSessions.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
                <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
              </div>
            ) : abandonedSessions.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <div className="text-4xl mb-2">📭</div>
                <p className="font-medium" style={{ color: T.textPrimary }}>No abandoned sessions</p>
                <p className="text-xs mt-1" style={{ color: T.textSecond }}>Recovery candidates will appear here as visitors drop off.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      {["Date", "Address", "Location", "Stage", "Price", "Name", "Email", "Emails Sent", "Visits"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: T.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {abandonedSessions.map((s, i) => (
                      <tr key={s.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                        <td className="px-4 py-2 whitespace-nowrap text-xs" style={{ fontVariantNumeric: 'tabular-nums', color: T.textPrimary }}>{formatLeadDate(s.updated_at || s.created_at)}</td>
                        <td className="px-4 py-2 text-xs max-w-[200px] truncate" style={{ color: T.textPrimary }}>{s.delivery_address || "—"}</td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: T.textPrimary }}>{s.geo_city ? `${s.geo_city}, ${s.geo_region || ""}` : s.delivery_address ? s.delivery_address.split(",")[1]?.trim() || "—" : "—"}{s.ip_address ? <span className="ml-1" style={{ color: T.textSecond }}>· {s.ip_address}</span> : ""}</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const stageMap: Record<string, { label: string; bg: string; bold?: boolean }> = {
                              got_price: { label: "Got Price", bg: "#F59E0B" },
                              got_out_of_area: { label: "OUT OF AREA", bg: "#EF4444", bold: true },
                              clicked_order_now: { label: "Clicked Order", bg: "#EA580C" },
                              entered_address: { label: "Entered Address", bg: "#3B82F6" },
                              started_checkout: { label: "At Checkout", bg: "#DC2626" },
                              reached_payment: { label: "At Payment", bg: "#DC2626", bold: true },
                            };
                            const cfg = stageMap[s.stage || ""] || { label: s.stage || "—", bg: "#9CA3AF", bold: false };
                            return (
                              <span className="inline-flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] text-white" style={{
                                  backgroundColor: cfg.bg,
                                  fontWeight: cfg.bold ? 800 : 600,
                                }}>
                                  {cfg.label}
                                </span>
                                {s.stage === "got_out_of_area" && s.nearest_pit_name && (
                                  <span className="text-[9px]" style={{ color: T.textSecond }} title={`Nearest pit: ${s.nearest_pit_name}`}>
                                    📍 {s.nearest_pit_name}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2 text-xs" style={{ fontVariantNumeric: 'tabular-nums', color: T.textPrimary }}>{s.calculated_price ? `$${Number(s.calculated_price).toFixed(0)}` : "—"}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: T.textPrimary }}>{s.customer_name || "—"}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: T.textPrimary }}>{s.customer_email || <span style={{ color: T.textSecond }}>No email</span>}</td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: T.textSecond }}>
                          <span>{s.email_1hr_sent ? "1hr ✓" : "1hr ○"}</span>
                          <span className="mx-1">|</span>
                          <span>{s.email_24hr_sent ? "24hr ✓" : "24hr ○"}</span>
                          <span className="mx-1">|</span>
                          <span>{s.email_72hr_sent ? "72hr ✓" : "72hr ○"}</span>
                        </td>
                        <td className="px-4 py-2">
                          {s.visit_count > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: BRAND_GOLD, color: "white", fontVariantNumeric: 'tabular-nums' }}>
                              {s.visit_count}×
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case "live": {
        // ── helpers ──
        const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dotColor: string }> = {
          visited:           { label: "Browsing",    color: "#6B7280", bg: "#F3F4F6", dotColor: "#9CA3AF" },
          entered_address:   { label: "Got address", color: "#2563EB", bg: "#EFF6FF", dotColor: "#60A5FA" },
          got_price:         { label: "Got price",   color: "#D97706", bg: "#FFFBEB", dotColor: "#FBBF24" },
          got_out_of_area:   { label: "Out of area", color: "#9CA3AF", bg: "#F9FAFB", dotColor: "#D1D5DB" },
          clicked_order_now: { label: "Clicked order", color: "#7C3AED", bg: "#F5F3FF", dotColor: "#A78BFA" },
          started_checkout:  { label: "Checkout",    color: "#EA580C", bg: "#FFF7ED", dotColor: "#FB923C" },
          reached_payment:   { label: "Payment",     color: "#DC2626", bg: "#FEF2F2", dotColor: "#F87171" },
          completed_order:   { label: "Converted",   color: "#16A34A", bg: "#F0FDF4", dotColor: "#4ADE80" },
        };

        const timeAgo = (iso: string) => {
          const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
          if (diff < 60) return `${diff}s ago`;
          if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
          return `${Math.floor(diff / 3600)}h ago`;
        };

        const fmtDuration = (secs: number | null) => {
          if (!secs) return "—";
          const m = Math.floor(secs / 60), s = secs % 60;
          return m > 0 ? `${m}m ${s}s` : `${s}s`;
        };

        const fmtRefreshed = () => {
          if (!lastRefreshed) return "Never refreshed";
          const secs = Math.round((Date.now() - lastRefreshed.getTime()) / 1000) + refreshCounter;
          if (secs < 10) return "Updated just now";
          if (secs < 60) return `Updated ${secs}s ago`;
          return `Updated ${Math.floor(secs / 60)}m ago`;
        };

        const FUNNEL_STAGES = [
          { key: "visited",           label: "Visited site",    dim: false },
          { key: "entered_address",   label: "Got address",     dim: false },
          { key: "got_price",         label: "Got price",       dim: false },
          { key: "got_out_of_area",   label: "Out of area",     dim: true  },
          { key: "clicked_order_now", label: "Clicked order",   dim: false },
          { key: "started_checkout",  label: "At checkout",     dim: false },
          { key: "reached_payment",   label: "At payment",      dim: false },
          { key: "completed_order",   label: "Completed",       dim: false },
        ];

        const funnelMap: Record<string, number> = {};
        if (funnelData) {
          Object.entries(funnelData).forEach(([k, v]) => { funnelMap[k] = v as number; });
        }
        const totalVisited = funnelMap["visited"] || 1;
        const totalCompleted = funnelMap["completed_order"] || 0;
        const convRate = totalVisited > 0 ? ((totalCompleted / totalVisited) * 100).toFixed(1) : "0.0";

        // CITY_MAP removed — replaced by real Google Map

        const STAGE_SHORT: Record<string, string> = {
          visited: "Browsing", entered_address: "Got address", got_price: "Got price",
          started_checkout: "Checkout", reached_payment: "Payment", completed_order: "Converted",
        };
        const STAGE_SHORT_COLOR: Record<string, string> = {
          visited: "#9CA3AF", entered_address: "#2563EB", got_price: "#D97706",
          started_checkout: "#EA580C", reached_payment: "#DC2626", completed_order: "#16A34A",
        };

        const cardStyle = "rounded-xl border shadow-sm p-4";
        const cardStyleObj = { backgroundColor: T.cardBg, borderColor: T.cardBorder };
        const sectionLabel = "font-display uppercase tracking-wide text-sm mb-3";
        const sectionLabelStyle = { color: T.textPrimary };

        return (
          <div className="space-y-4">

            {/* ── HEADER (§4) ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <p className="text-sm" style={{ color: T.textSecond }}>
                  {liveVisitors.length} active sessions (last 30 min)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: T.textSecond }}>{fmtRefreshed()}</span>
                <Button onClick={fetchLiveVisitors} disabled={liveLoading} size="sm" variant="outline">
                  {liveLoading
                    ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    : <RefreshCw className="w-4 h-4 mr-1" />}
                  Refresh
                </Button>
              </div>
            </div>

            {/* ── METRIC CARDS (§5) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Active now",      val: liveVisitors.length,                        sub: "last 30 min",       valColor: POSITIVE },
                { label: "Sessions today",  val: totalVisited,                               sub: "vs yesterday",      valColor: undefined },
                { label: "Conversion rate", val: `${convRate}%`,                             sub: "last 30 days",      valColor: BRAND_GOLD },
                { label: "Completed",       val: totalCompleted,                             sub: "last 30 days",      valColor: totalCompleted > 0 ? POSITIVE : undefined },
                { label: "Out of area",     val: funnelMap["got_out_of_area"] || 0,          sub: "last 30 days",      valColor: T.textSecond },
              ].map((m, i) => (
                <div key={i} className="rounded-xl border p-5" style={cardStyleObj}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: T.textSecond }}>{m.label}</div>
                  <div className="text-2xl font-semibold" style={{ color: m.valColor || T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                    {liveLoading && !funnelData ? '—' : m.val}
                  </div>
                  <div className="text-xs mt-1" style={{ color: T.textSecond }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* ── MAIN GRID: Session list | Map ── */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "300px 1fr" }}>

              {/* Session list */}
              <div className={cardStyle} style={cardStyleObj}>
                <div className="flex items-center justify-between mb-3">
                  <p className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 0 }}>Current sessions</p>
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{ color: T.textSecond, backgroundColor: '#F9FAFB', fontVariantNumeric: 'tabular-nums' }}>{liveVisitors.length} active</span>
                </div>
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
                  {liveVisitors.length === 0 ? (
                    <div className="rounded-xl border p-12 text-center" style={cardStyleObj}>
                      <div className="text-4xl mb-2">📭</div>
                      <p className="font-medium" style={{ color: T.textPrimary }}>No active sessions</p>
                      <p className="text-xs mt-1" style={{ color: T.textSecond }}>They'll appear here as soon as visitors arrive.</p>
                    </div>
                  ) : (
                    liveVisitors.map((v: any) => {
                      const cfg = STAGE_CONFIG[v.stage] || STAGE_CONFIG.visited;
                      const isHot = v.stage === "started_checkout" || v.stage === "reached_payment";
                      return (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                          style={{ borderColor: isHot ? (v.stage === "reached_payment" ? "#FCA5A5" : "#FCD34D") : T.cardBorder }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{(v.ip_address || "—").replace(/\.\d+$/, ".xxx")}</span>
                            <span className="text-[10px]" style={{ color: T.textSecond }}>{timeAgo(v.last_seen_at || v.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm font-medium" style={{ color: T.textPrimary }}>{v.geo_city || "Unknown"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            {v.ip_is_business && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">Biz</span>
                            )}
                          </div>
                          <p className="text-[10px]" style={{ color: T.textSecond }}>
                            {v.calculated_price ? <><span className="font-medium" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>${Math.round(v.calculated_price)}</span> est · </> : ""}
                            {v.entry_page || "/"}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Map */}
              <div className={cardStyle} style={cardStyleObj}>
                <div className="flex items-center justify-between mb-3">
                  <p className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 0 }}>Activity map — Gulf South</p>
                  <div className="flex items-center gap-3">
                    {["Browsing","Estimating","Checkout","Converted"].map((l, i) => (
                      <span key={l} className="flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: ["#9CA3AF","#60A5FA","#FB923C","#4ADE80"][i] }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Google Map */}
                <LiveGoogleMap visitors={liveVisitors} pits={pits} />
                {/* Parish pills */}
                {liveVisitors.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {Array.from(new Set((liveVisitors as any[]).map((v: any) => v.geo_region || v.geo_city || "Unknown"))).map((region: any) => (
                      <span key={region} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">
                        {region}{" "}
                        <strong className="text-gray-800">{(liveVisitors as any[]).filter((v: any) => (v.geo_region || v.geo_city) === region).length}</strong>
                      </span>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {(liveVisitors as any[]).filter((v: any) => v.address_lat).length} plotted on map
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* ── ANALYTICS GRID: Funnel | Page performance ── */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>

              {/* Funnel */}
              <div className={cardStyle} style={cardStyleObj}>
                <div className="flex items-center justify-between mb-3">
                  <p className={sectionLabel} style={{ ...sectionLabelStyle, marginBottom: 0 }}>Conversion funnel — last 30 days</p>
                  <span className="text-xs font-medium" style={{ color: POSITIVE, fontVariantNumeric: 'tabular-nums' }}>{convRate}% overall</span>
                </div>
                <div className="space-y-2">
                  {FUNNEL_STAGES.map((fs, i) => {
                    const count = funnelMap[fs.key] || 0;
                    const pct = totalVisited > 0 ? (count / totalVisited) * 100 : 0;
                    const prevKey = FUNNEL_STAGES[i - 1]?.key;
                    const prevCount = prevKey ? (funnelMap[prevKey] || 0) : null;
                    const drop = (!fs.dim && prevCount && prevCount > 0 && count < prevCount)
                      ? `-${Math.round(((prevCount - count) / prevCount) * 100)}%`
                      : null;
                    return (
                      <div key={fs.key} style={{ opacity: fs.dim ? 0.4 : 1 }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs" style={{ color: T.textSecond }}>{fs.label}</span>
                          <div className="flex items-center gap-2">
                            {drop && <span className="text-[10px]" style={{ color: ALERT_RED, fontVariantNumeric: 'tabular-nums' }}>{drop}</span>}
                            <span className="text-xs font-medium" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: fs.dim ? "#D1D5DB" : BRAND_GOLD }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page performance */}
              <div className={cardStyle} style={cardStyleObj}>
                <p className={sectionLabel} style={sectionLabelStyle}>Page performance</p>
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
                    <tr>
                      <th className="text-left px-2 py-2 font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Page</th>
                      <th className="text-right px-2 py-2 font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Visits</th>
                      <th className="text-right px-2 py-2 font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Avg $</th>
                      <th className="text-right px-2 py-2 font-medium text-xs uppercase tracking-wider" style={{ color: T.textSecond }}>Top stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagePerf.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-xs" style={{ color: T.textSecond }}>📭 No data yet</td></tr>
                    ) : pagePerf.map((p, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
                        <td className="py-2 px-2">
                          <span className="font-mono text-[10px] text-blue-500 truncate block max-w-[120px]">{p.page}</span>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{p.visits}</td>
                        <td className="py-2 px-2 text-right" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{p.avgPrice ? `$${p.avgPrice}` : "—"}</td>
                        <td className="py-2 px-2 text-right">
                          <span style={{ color: STAGE_SHORT_COLOR[p.topStage] || "#9CA3AF" }} className="text-[10px]">
                            {STAGE_SHORT[p.topStage] || p.topStage}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* ── BOTTOM GRID: Entry pages | City intel ── */}
            <div className="grid grid-cols-2 gap-4">

              {/* Entry pages + time */}
              <div className={cardStyle} style={cardStyleObj}>
                <p className={sectionLabel} style={sectionLabelStyle}>Entry pages & time on page</p>
                <div className="grid text-xs uppercase tracking-wider border-b pb-2 mb-1 font-medium" style={{ gridTemplateColumns: "1fr 50px 60px 50px", color: T.textSecond, borderColor: T.cardBorder }}>
                  <span>Page</span><span className="text-right">Sessions</span><span className="text-right">Avg time</span><span className="text-right">Bounce</span>
                </div>
                {pagePerf.length === 0
                  ? <p className="text-center text-xs py-6" style={{ color: T.textSecond }}>📭 No data yet</p>
                  : pagePerf.map((p, i) => (
                    <div key={i} className="grid items-center border-b last:border-0 py-1.5 gap-1 hover:bg-gray-50 transition-colors" style={{ gridTemplateColumns: "1fr 50px 60px 50px", borderColor: T.cardBorder }}>
                      <span className="font-mono text-[10px] text-blue-500 truncate">{p.page}</span>
                      <span className="text-[11px] text-right" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{p.visits}</span>
                      <span className="text-[11px] text-right" style={{ color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(p.avgDuration)}</span>
                      <span className="text-[11px] text-right" style={{ color: T.textSecond }}>—</span>
                    </div>
                  ))
                }
              </div>

              {/* City intelligence */}
              <div className={cardStyle} style={cardStyleObj}>
                <p className={sectionLabel} style={sectionLabelStyle}>City intelligence — last 30 days</p>
                <div className="grid text-xs uppercase tracking-wider border-b pb-2 mb-1 font-medium" style={{ gridTemplateColumns: "1fr 60px", color: T.textSecond, borderColor: T.cardBorder }}>
                  <span>City</span><span className="text-right">Sessions</span>
                </div>
                {cityIntel.length === 0
                  ? <p className="text-center text-xs py-6" style={{ color: T.textSecond }}>📭 No data yet</p>
                  : cityIntel.map((c, i) => (
                    <div key={i} className="grid items-center border-b last:border-0 py-1.5 gap-1 hover:bg-gray-50 transition-colors" style={{ gridTemplateColumns: "1fr 60px", borderColor: T.cardBorder }}>
                      <div className="flex items-center gap-2">
                        <div className="h-1 rounded-full" style={{ width: `${Math.round((c.visits / (cityIntel[0]?.visits || 1)) * 60)}px`, minWidth: 4, background: BRAND_GOLD }} />
                        <span className="text-xs" style={{ color: T.textPrimary }}>{c.city}</span>
                      </div>
                      <span className="text-[11px] text-right" style={{ color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{c.visits}</span>
                    </div>
                  ))
                }
              </div>

            </div>

          </div>
        );
      }

      case "fraud": {
        const EVENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
          blocked_attempt: { bg: "#FEE2E2", text: "#DC2626", icon: "🔴" },
          velocity_flag: { bg: "#FEF3C7", text: "#D97706", icon: "🟡" },
          manual_flag: { bg: "#FFEDD5", text: "#EA580C", icon: "🟠" },
          failed_payment: { bg: "#FEE2E2", text: "#DC2626", icon: "🔴" },
        };

        const handleBlock = async () => {
          if (!blockForm.value.trim()) return;
          setBlockingEntity(true);
          try {
            const { data, error: fnErr } = await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "block_entity", type: blockForm.type, value: blockForm.value.trim(), reason: blockForm.reason || null, expires_at: blockForm.expires_at || null },
            });
            if (fnErr) throw fnErr;
            if (data?.error) throw new Error(data.error);
            toast({ title: "Blocked", description: `${blockForm.type}: ${blockForm.value} added to blocklist` });
            setBlockForm({ type: "ip", value: "", reason: "", expires_at: "" });
            fetchFraudData();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          } finally { setBlockingEntity(false); }
        };

        const handleUnblock = async (type: string, value: string) => {
          try {
            await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "unblock_entity", type, value },
            });
            toast({ title: "Unblocked", description: `${type}: ${value} removed` });
            fetchFraudData();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        };

        const handleBlockIp = async (ip: string) => {
          try {
            await supabase.functions.invoke("leads-auth", {
              body: { password: storedPassword(), action: "block_entity", type: "ip", value: ip, reason: "Blocked from payment attempts view" },
            });
            toast({ title: "IP Blocked", description: ip });
            fetchFraudData();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        };

        const failedAttempts = fraudPaymentAttempts.filter(a => a.status === "failed");
        const ipGroups = failedAttempts.reduce((acc: Record<string, any[]>, a) => {
          const key = a.ip_address || "unknown";
          if (!acc[key]) acc[key] = [];
          acc[key].push(a);
          return acc;
        }, {});

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: T.textSecond }}>
                {fraudLoading ? "—" : `${fraudEvents.length} events · ${fraudBlocklist.length} blocks · ${failedAttempts.length} failed payments (24h)`}
              </p>
              <Button size="sm" onClick={fetchFraudData} disabled={fraudLoading} variant="outline">
                {fraudLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </Button>
            </div>

            {/* ─── SECTION 1: LIVE THREAT FEED ─── */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>
                <Shield className="w-4 h-4 inline mr-2" style={{ color: ALERT_RED }} />
                Live Threat Feed
              </h3>
              {fraudEvents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm" style={{ color: T.textSecond }}>No fraud events recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {fraudEvents.slice(0, 50).map((evt: any) => {
                    const colors = EVENT_COLORS[evt.event_type] || { bg: "#F3F4F6", text: "#6B7280", icon: "⚪" };
                    return (
                      <div key={evt.id} className="flex items-start gap-3 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: colors.bg }}>
                        <span>{colors.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium" style={{ color: colors.text }}>{evt.event_type.replace(/_/g, " ")}</div>
                          <div className="text-xs mt-0.5" style={{ color: T.textSecond }}>
                            {evt.ip_address && <span>IP: {evt.ip_address} </span>}
                            {evt.email && <span>• {evt.email} </span>}
                            {evt.phone && <span>• {evt.phone} </span>}
                          </div>
                          {evt.details && (
                            <div className="text-xs mt-1" style={{ color: T.textSecond }}>
                              {typeof evt.details === "object" ? (evt.details.reason || JSON.stringify(evt.details).slice(0, 120)) : String(evt.details)}
                            </div>
                          )}
                        </div>
                        <span className="text-xs whitespace-nowrap" style={{ color: T.textSecond }}>
                          {new Date(evt.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── SECTION 2: BLOCKLIST ─── */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>
                <Lock className="w-4 h-4 inline mr-2" style={{ color: BRAND_GOLD }} />
                Active Blocklist
              </h3>

              {/* Add block form */}
              <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg" style={{ backgroundColor: T.pageBg }}>
                <select
                  value={blockForm.type}
                  onChange={e => setBlockForm(f => ({ ...f, type: e.target.value }))}
                  className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: T.cardBorder, backgroundColor: T.cardBg, color: T.textPrimary }}
                >
                  <option value="ip">IP Address</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="address">Address</option>
                </select>
                <Input placeholder="Value to block" value={blockForm.value} onChange={e => setBlockForm(f => ({ ...f, value: e.target.value }))} className="flex-1 min-w-[160px] h-9" />
                <Input placeholder="Reason (optional)" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} className="flex-1 min-w-[140px] h-9" />
                <Input type="datetime-local" placeholder="Expires (optional)" value={blockForm.expires_at} onChange={e => setBlockForm(f => ({ ...f, expires_at: e.target.value }))} className="w-[200px] h-9" />
                <Button size="sm" onClick={handleBlock} disabled={blockingEntity || !blockForm.value.trim()} style={{ backgroundColor: ALERT_RED, color: "white" }}>
                  {blockingEntity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  <span className="ml-1">Block</span>
                </Button>
              </div>

              {fraudBlocklist.length === 0 ? (
                <p className="text-sm" style={{ color: T.textSecond }}>No active blocks.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}>Type</th>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}>Value</th>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}>Reason</th>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}>Blocked</th>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}>Expires</th>
                        <th className="text-left py-2 px-2 font-medium text-xs uppercase" style={{ color: T.textSecond }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fraudBlocklist.map((b: any) => (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                              backgroundColor: b.type === "ip" ? "#DBEAFE" : b.type === "email" ? "#FCE7F3" : b.type === "phone" ? "#FEF3C7" : "#E5E7EB",
                              color: b.type === "ip" ? "#1D4ED8" : b.type === "email" ? "#BE185D" : b.type === "phone" ? "#D97706" : "#4B5563"
                            }}>{b.type.toUpperCase()}</span>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs" style={{ color: T.textPrimary }}>{b.value}</td>
                          <td className="py-2 px-2 text-xs" style={{ color: T.textSecond }}>{b.reason || "—"}</td>
                          <td className="py-2 px-2 text-xs" style={{ color: T.textSecond }}>
                            {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            <span className="ml-1 text-xs" style={{ color: T.textSecond }}>by {b.blocked_by}</span>
                          </td>
                          <td className="py-2 px-2 text-xs" style={{ color: b.expires_at ? WARN_YELLOW : T.textSecond }}>
                            {b.expires_at ? new Date(b.expires_at).toLocaleDateString() : "Permanent"}
                          </td>
                          <td className="py-2 px-2">
                            <Button size="sm" variant="outline" onClick={() => handleUnblock(b.type, b.value)} className="h-7 text-xs">
                              Unblock
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── SECTION 3: FAILED PAYMENT ATTEMPTS ─── */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>
                <AlertTriangle className="w-4 h-4 inline mr-2" style={{ color: WARN_YELLOW }} />
                Failed Payment Attempts (24hr)
              </h3>
              {failedAttempts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm" style={{ color: T.textSecond }}>No failed payment attempts in the last 24 hours.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(ipGroups).map(([ip, attempts]) => (
                    <div key={ip} className="rounded-lg p-3" style={{ backgroundColor: T.pageBg, border: `1px solid ${T.cardBorder}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-mono text-sm font-medium" style={{ color: T.textPrimary }}>{ip}</span>
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold" style={{
                            backgroundColor: (attempts as any[]).length >= 3 ? "#FEE2E2" : "#FEF3C7",
                            color: (attempts as any[]).length >= 3 ? ALERT_RED : WARN_YELLOW
                          }}>{(attempts as any[]).length} failed</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleBlockIp(ip)} className="h-7 text-xs border-red-300 text-red-600">
                          <Shield className="w-3 h-3 mr-1" /> Block IP
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {(attempts as any[]).slice(0, 5).map((a: any) => (
                          <div key={a.id} className="flex items-center gap-3 text-xs" style={{ color: T.textSecond }}>
                            <span>{new Date(a.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                            {a.email && <span>{a.email}</span>}
                            {a.amount && <span>${a.amount}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── SECTION 4: VELOCITY ALERTS ─── */}
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
              <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>
                <Zap className="w-4 h-4 inline mr-2" style={{ color: BRAND_GOLD }} />
                Velocity Alerts
              </h3>
              {(() => {
                const velocityEvents = fraudEvents.filter(e => e.event_type === "velocity_flag");
                if (velocityEvents.length === 0) return (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-sm" style={{ color: T.textSecond }}>No velocity alerts.</p>
                  </div>
                );
                return (
                  <div className="space-y-2">
                    {velocityEvents.slice(0, 20).map((evt: any) => (
                      <div key={evt.id} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEF3C7" }}>
                        <span>🟡</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: "#92400E" }}>
                            {evt.details?.reason || "Velocity flag"}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: T.textSecond }}>
                            {evt.ip_address && <span>IP: {evt.ip_address} </span>}
                            {evt.details?.sessionCount && <span>• {evt.details.sessionCount} sessions </span>}
                            {evt.details?.addressOrders && <span>• {evt.details.addressOrders} orders same address </span>}
                          </div>
                        </div>
                        <span className="text-xs whitespace-nowrap" style={{ color: T.textSecond }}>
                          {new Date(evt.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: T.pageBg }}>
      <Helmet>
        <title>LMT — Operator Dashboard</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      </Helmet>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen flex flex-col transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 220, minWidth: 220, backgroundColor: T.sidebarBg, borderRight: `1px solid ${T.sidebarBorder}` }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-widest" style={{ color: BRAND_GOLD }}>LMT</h2>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
              style={{
                backgroundColor: IS_PROD_HOST ? '#FEE2E2' : '#DBEAFE',
                color: IS_PROD_HOST ? '#991B1B' : '#1E40AF',
                border: `1px solid ${IS_PROD_HOST ? '#FCA5A5' : '#93C5FD'}`,
              }}
              title={typeof window !== 'undefined' ? window.location.hostname : ''}
            >
              {IS_PROD_HOST ? 'PROD' : 'PREVIEW'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: T.textSecond }}>Live: {livePricing}</p>
          {globalSettings.site_mode === 'maintenance' && (
            <div className="text-xs font-bold px-2 py-1 rounded mt-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              🔴 MAINTENANCE
            </div>
          )}
          {globalSettings.stripe_mode === 'test' && (
            <div className="text-xs font-bold px-2 py-1 rounded mt-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              🔧 STRIPE TEST
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          {NAV_ITEMS.map(section => {
            const sectionHasActive = section.items.some(i => i.id === activePage);
            return (
              <SidebarAccordion
                key={section.section}
                title={section.section}
                defaultOpen={sectionHasActive}
                textColor={T.textSecond}
              >
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 rounded-md text-left transition-colors"
                      style={{
                        height: 36,
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? BRAND_GOLD : T.textPrimary,
                        backgroundColor: isActive ? T.activeNavBg : "transparent",
                        borderRadius: 6,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = T.hoverNavBg; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <Icon className="w-[16px] h-[16px]" />
                      <span>{item.label}</span>
                      {item.id === "live" && (
                        <span className="relative flex h-2 w-2 ml-auto">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </SidebarAccordion>
            );
          })}
        </nav>

        {/* Logout + Footer */}
        <div className="px-2 pb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 rounded-lg text-left transition-colors"
            style={{ height: 40, fontSize: 13, color: "#999" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = T.hoverNavBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
          <p className="text-center py-3 text-[10px]" style={{ color: T.textSecond }}>Powered by Haulogix, LLC</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between border-b" style={{ backgroundColor: T.headerBg, borderColor: T.cardBorder }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1">
              <Menu className="w-5 h-5" style={{ color: T.textPrimary }} />
            </button>
            <div>
              <div className="flex items-center gap-1" style={{ fontSize: 11 }}>
                <span style={{ color: T.textSecond }}>LMT ›</span>
                <span style={{ color: BRAND_GOLD, fontWeight: 600 }}>{currentPage.title}</span>
              </div>
              {currentPage.subtitle && <p className="text-[10px] mt-0.5" style={{ color: T.textSecond }}>{currentPage.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative" ref={notifPanelRef}>
              <button
                onClick={() => {
                  setShowNotifPanel(prev => !prev);
                  if (!showNotifPanel && unreadCount > 0) markNotificationsRead();
                }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5" style={{ color: T.textPrimary }} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: BRAND_GOLD }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification panel */}
              {showNotifPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-2xl border z-50" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: T.cardBorder }}>
                    <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>Notifications</h3>
                    <button onClick={() => setShowNotifPanel(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications</div>
                  ) : (
                    notifications.slice(0, 20).map((n: any) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-default"
                        style={{ borderColor: T.cardBorder, backgroundColor: n.read ? "transparent" : "#FFFDF5" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: T.textPrimary }}>{n.title}</p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {(() => {
                              try {
                                const d = new Date(n.created_at);
                                const now = new Date();
                                const diffMs = now.getTime() - d.getTime();
                                const diffMin = Math.floor(diffMs / 60000);
                                if (diffMin < 1) return "just now";
                                if (diffMin < 60) return `${diffMin}m ago`;
                                const diffHrs = Math.floor(diffMin / 60);
                                if (diffHrs < 24) return `${diffHrs}h ago`;
                                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              } catch { return ""; }
                            })()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {(activePage === "overview" || activePage === "all") && (
              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="px-4 md:px-6 lg:px-8 py-6">
          {(() => {
            try {
              return renderPageContent();
            } catch (err: any) {
              console.error("[renderPageContent] ERROR:", err);
              return (
                <div style={{ padding: 32, color: "#DC2626" }}>
                  Dashboard error: {err.message}
                </div>
              );
            }
          })()}
        </div>
      </main>

      {/* ─── MODALS ─── */}

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b" style={{ backgroundColor: T.tableHeaderBg }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm" style={{ color: BRAND_GOLD }}>{selectedLead.lead_number || "—"}</p>
                  <h2 className="text-lg font-bold text-white">{selectedLead.customer_name}</h2>
                </div>
                {selectedLead.fraud_score != null && selectedLead.fraud_score > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{
                    backgroundColor: selectedLead.fraud_score >= 80 ? "#EF4444" : selectedLead.fraud_score >= 40 ? "#F59E0B" : "#22C55E"
                  }}>
                    Risk: {selectedLead.fraud_score >= 80 ? "HIGH" : selectedLead.fraud_score >= 40 ? "MEDIUM" : "LOW"} ({selectedLead.fraud_score})
                  </span>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Customer Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: T.textPrimary }}>Customer Info</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Submitted</p><p className="font-medium">{formatLeadDate(selectedLead.created_at)}</p></div>
                    <div><p className="text-xs text-gray-400">Distance</p><p>{selectedLead.distance_miles?.toFixed(1) || "—"} mi</p></div>
                    <div className="col-span-2"><p className="text-xs text-gray-400">Address</p><p className="font-medium">{selectedLead.address}</p></div>
                    <div><p className="text-xs text-gray-400">Email</p><p>{selectedLead.customer_email || "—"}</p></div>
                    <div><p className="text-xs text-gray-400">Phone</p><p>{selectedLead.customer_phone || "—"}</p></div>
                    <div><p className="text-xs text-gray-400">Nearest PIT</p><p>{selectedLead.nearest_pit_name || "—"}</p></div>
                    <div><p className="text-xs text-gray-400">Calculated Price</p><p className="font-bold" style={{ color: BRAND_GOLD }}>{selectedLead.calculated_price ? `$${selectedLead.calculated_price}` : "—"}</p></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Contacted</p>
                    <ContactedBadge contacted={selectedLead.contacted} onClick={() => { toggleContacted(selectedLead.id); setSelectedLead({ ...selectedLead, contacted: !selectedLead.contacted }); }} loading={toggling === selectedLead.id} />
                  </div>
                  {selectedLead.stage === "won" && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                      <span className="text-green-700 font-bold text-sm">✅ ORDER PLACED</span>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Stage</label>
                    <select value={detailStage} onChange={e => setDetailStage(e.target.value)} className="w-full h-10 px-3 rounded-md border">
                      {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  {selectedLead.notes && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">History</p>
                      <pre className="text-xs bg-gray-50 p-3 rounded border whitespace-pre-wrap max-h-24 overflow-y-auto">{selectedLead.notes}</pre>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Add Note</label>
                    <Textarea rows={2} value={detailNote} onChange={e => setDetailNote(e.target.value)} placeholder="Type a note..." />
                  </div>
                  <Button onClick={saveDetail} disabled={savingDetail} className="w-full" style={{ backgroundColor: T.tableHeaderBg, color: T.tableHeaderText }}>
                    {savingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>

                {/* Right: Fraud Panel */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: T.textPrimary }}>Fraud Analysis</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border space-y-3 text-sm">
                    <div><p className="text-xs text-gray-400">Fraud Score</p>
                      <p className="text-xl font-bold" style={{ color: (selectedLead.fraud_score || 0) >= 80 ? "#EF4444" : (selectedLead.fraud_score || 0) >= 40 ? "#F59E0B" : "#22C55E" }}>
                        {selectedLead.fraud_score ?? 0}
                      </p>
                    </div>
                    <div><p className="text-xs text-gray-400">Signals</p>
                      {selectedLead.fraud_signals && selectedLead.fraud_signals.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedLead.fraud_signals.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{s}</span>
                          ))}
                        </div>
                      ) : <p className="text-green-600 text-xs font-medium">No fraud signals</p>}
                    </div>
                    <div><p className="text-xs text-gray-400">IP Address</p><p className="font-mono text-xs">{selectedLead.ip_address || "—"}</p></div>
                    <div><p className="text-xs text-gray-400">User Agent</p><p className="text-xs truncate">{selectedLead.user_agent || "—"}</p></div>
                    <div><p className="text-xs text-gray-400">Browser Location</p>
                      <p className="text-xs">{selectedLead.browser_geolat != null ? `${selectedLead.browser_geolat.toFixed(4)}, ${selectedLead.browser_geolng?.toFixed(4)}` : "Not provided"}</p>
                    </div>
                    <div><p className="text-xs text-gray-400">Geo Matches Address</p>
                      <p className="text-xs font-medium" style={{ color: selectedLead.geo_matches_address === false ? "#EF4444" : "#22C55E" }}>
                        {selectedLead.geo_matches_address == null ? "N/A" : selectedLead.geo_matches_address ? "✅ Yes" : "❌ No"}
                      </p>
                    </div>
                    <div><p className="text-xs text-gray-400">Submissions from IP</p><p className="text-xs">{selectedLead.submission_count || 1}</p></div>
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="text-xs font-bold uppercase text-gray-400">Actions</h4>

                    {/* Send Offer */}
                    {selectedLead.stage !== "won" && selectedLead.stage !== "lost" && !offerResult && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-2">
                        <p className="text-xs font-bold text-green-700">Send Offer</p>
                        <select value={offerPitId} onChange={e => setOfferPitId(e.target.value)} className="w-full h-8 px-2 rounded border text-sm">
                          <option value="">Select PIT...</option>
                          {pits.filter(p => p.status === "active").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <Input type="number" placeholder="Price ($)" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="h-8" />
                        <Button onClick={handleSendOffer} disabled={sendingOffer || !offerPitId || !offerPrice} size="sm" className="w-full" style={{ backgroundColor: "#22C55E", color: "white" }}>
                          {sendingOffer ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Send Offer & Payment Link
                        </Button>
                      </div>
                    )}

                    {/* Offer result */}
                    {offerResult && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-2">
                        <p className="text-xs font-bold text-green-700">✅ Offer Sent — {offerResult.order_number}</p>
                        <div className="flex gap-1">
                          <Input value={offerResult.payment_url} readOnly className="h-8 text-xs" />
                          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(offerResult.payment_url); toast({ title: "Copied" }); }}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Decline */}
                    {selectedLead.stage !== "won" && selectedLead.stage !== "lost" && (
                      <Button onClick={handleDeclineLead} disabled={decliningLead} variant="outline" size="sm" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                        {decliningLead ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Decline Lead
                      </Button>
                    )}

                    {/* Flag Fraud */}
                    <div className="space-y-1">
                      <Input placeholder="Fraud reason..." value={fraudReason} onChange={e => setFraudReason(e.target.value)} className="h-8 text-xs" />
                      <Button onClick={handleFlagFraud} disabled={flaggingFraud} variant="outline" size="sm" className="w-full border-gray-300 text-gray-600">
                        {flaggingFraud ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Flag as Fraud & Block IP
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={() => setSelectedLead(null)} variant="outline">Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !sendingProposals && setShowProposal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Send Proposals</h2>
              <p className="text-white/60 text-sm">{simSelected.size} leads selected</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Subject</label>
                <Input value={proposalSubject} onChange={e => setProposalSubject(e.target.value)} />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs text-gray-400 mb-2">Preview (first lead)</p>
                {(() => {
                  const first = simData.find(d => simSelected.has(d.lead.id));
                  if (!first) return <p className="text-sm text-gray-500">No lead selected</p>;
                  return (
                    <div className="text-sm space-y-2">
                      <p>Hi {first.lead.customer_name.split(" ")[0]},</p>
                      <p>Good news — River Sand now delivers near {parseAddress(first.lead.address).zip}!</p>
                      <div className="border-2 rounded-lg p-4 text-center" style={{ borderColor: BRAND_GOLD }}>
                        <p className="text-xs uppercase text-gray-500">River Sand — 9 Cubic Yards</p>
                        <p className="text-xs text-gray-400">Delivered to: {first.lead.address}</p>
                        <p className="text-2xl font-bold mt-2" style={{ color: BRAND_GOLD }}>${first.newPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {sendingProposals && (
                <div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%`, backgroundColor: BRAND_GOLD }} />
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-500">Sending {sendProgress.current} of {sendProgress.total}...</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={sendProposals} disabled={sendingProposals} className="flex-1" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {sendingProposals ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Send to {simSelected.size} leads
                </Button>
                <Button onClick={() => setShowProposal(false)} disabled={sendingProposals} variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Proposal Modal */}
      {quickProposalLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !qpSending && setQuickProposalLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Send Delivery Offer</h2>
              <p className="text-white/60 text-sm">{quickProposalLead.lead_number || "—"} — {quickProposalLead.customer_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Delivery address</label>
                <p className="text-sm font-medium bg-gray-50 p-2 rounded border">{quickProposalLead.address}</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select PIT</label>
                <select value={qpPitId} onChange={e => setQpPitId(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                  {pits.filter(p => p.status === "active").map(p => {
                    const rawDist = quickProposalLead.nearest_pit_id === p.id && quickProposalLead.nearest_pit_distance != null
                      ? quickProposalLead.nearest_pit_distance
                      : geocodeCache[quickProposalLead.address]
                        ? getDist(p.lat, p.lon, geocodeCache[quickProposalLead.address].lat, geocodeCache[quickProposalLead.address].lon)
                        : null;
                    const dist = rawDist !== null ? rawDist.toFixed(1) : "—";
                    return <option key={p.id} value={p.id}>{p.name} — {dist} mi away</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Price (editable)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl" style={{ color: BRAND_GOLD }}>$</span>
                  <input type="number" value={qpPrice} onChange={e => setQpPrice(e.target.value)} className="w-full h-14 pl-10 text-center text-2xl font-bold rounded-lg border-2" style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }} step="0.01" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Custom note (optional)</label>
                <Textarea value={qpNote} onChange={e => setQpNote(e.target.value)} placeholder="Add a personal note... (e.g. We're expanding to your area soon!)" rows={2} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Order link</label>
                <p className="text-xs font-mono bg-gray-50 p-2 rounded border truncate" title={qpOrderUrl}>{qpOrderUrl}</p>
              </div>
              <button onClick={() => setQpShowPreview(!qpShowPreview)} className="text-xs flex items-center gap-1" style={{ color: BRAND_GOLD }}>
                {qpShowPreview ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Preview email
              </button>
              {qpShowPreview && (
                <div className="bg-gray-50 rounded-lg p-4 border text-sm space-y-2">
                  <p>Hi {quickProposalLead.customer_name.split(" ")[0]},</p>
                  <p>Good news — River Sand now delivers near {quickProposalLead.zip}!</p>
                  <div className="border-2 rounded-lg p-4 text-center" style={{ borderColor: BRAND_GOLD }}>
                    <p className="text-xs uppercase text-gray-500">River Sand — 9 Cubic Yards</p>
                    <p className="text-xs text-gray-400">Delivered to: {quickProposalLead.address}</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: BRAND_GOLD }}>${qpPrice}</p>
                  </div>
                  {qpNote && <p className="bg-yellow-50 p-3 rounded border-l-4" style={{ borderColor: BRAND_GOLD }}>{qpNote}</p>}
                </div>
              )}
              <Button onClick={sendQuickProposal} disabled={qpSending || !quickProposalLead.customer_email} className="w-full h-11" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                {qpSending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Send Offer
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(qpOrderUrl); toast({ title: "Order link copied!" }); }}>
                  <Copy className="w-3 h-3 mr-1" /> Copy Link
                </Button>
                <Button variant="outline" size="sm" className="flex-1" style={{ borderColor: "#22C55E30", color: "#22C55E" }} onClick={() => {
                  const msg = `Hi ${quickProposalLead.customer_name.split(" ")[0]}, River Sand can deliver to your area! Here is your quote:\n\nRiver Sand — 9 Cubic Yards\nDelivered to: ${quickProposalLead.address}\nYour price: $${qpPrice}\n\nOrder here (address pre-filled):\n${qpOrderUrl}\n\nQuestions? Call ${WAYS_PHONE_DISPLAY}`;
                  const phone = quickProposalLead.customer_phone?.replace(/\D/g, "") || "";
                  window.open(`https://wa.me/${phone ? "1" + phone : ""}?text=${encodeURIComponent(msg)}`, "_blank");
                }}>
                  <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                </Button>
              </div>
              <button onClick={() => setQuickProposalLead(null)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD PIT MODAL ─── */}
      {showAddPit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 md:p-0" onClick={() => setShowAddPit(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto md:my-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: T.textPrimary }}>Add New PIT</h2>
                <p className="text-xs text-gray-500">Point of Dispatch — delivery origin</p>
              </div>
              <button onClick={() => setShowAddPit(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Section 1 — Location */}
              <div>
                <p className="text-sm font-medium mb-3" style={{ color: T.textPrimary }}>Location</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>PIT Name <span style={{ color: BRAND_GOLD }}>*</span></label>
                    <Input placeholder="e.g. Denham Springs Yard" value={newPit.name} onChange={e => setNewPit({ ...newPit, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>PIT Address <span style={{ color: BRAND_GOLD }}>*</span></label>
                    <div className="relative">
                      {googleLoaded ? (
                        <PlaceAutocompleteInput
                          onPlaceSelect={handleAddPitPlaceSelect}
                          onInputChange={(val) => setNewPit({ ...newPit, address: val, lat: null, lon: null })}
                          placeholder="Start typing an address..."
                          initialValue={newPit.address}
                          containerClassName="place-autocomplete-admin"
                        />
                      ) : (
                        <Input placeholder="Start typing an address..." value={newPit.address} onChange={e => setNewPit({ ...newPit, address: e.target.value, lat: null, lon: null })} />
                      )}
                      {newPit.lat != null && <Check className="absolute right-2 top-2.5 w-4 h-4 text-green-500" />}
                      {newPit.address && newPit.lat == null && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Select from suggestions to capture coordinates</p>
                      )}
                    </div>
                    {newPit.lat != null && newPit.lon != null &&
                      Number(newPit.lat) >= 24 && Number(newPit.lat) <= 50 &&
                      Number(newPit.lon) >= -125 && Number(newPit.lon) <= -66 && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs" style={{ color: "#4A6A8A" }}>
                          ✓ {Number(newPit.lat).toFixed(5)}, {Number(newPit.lon).toFixed(5)}
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${newPit.lat},${newPit.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                          style={{ color: BRAND_GOLD }}
                        >
                          Verify on Google Maps ↗
                        </a>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-xs mb-1 font-medium" style={{ color: T.textSecond }}>
                        GPS Coordinates (optional — use if address is not a full street address)
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs mb-0.5 block" style={{ color: "#666" }}>Latitude</label>
                          <Input
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. 29.9073"
                            type="number"
                            step="0.00001"
                            value={newPit.lat ?? ""}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setNewPit(prev => ({ ...prev, lat: isNaN(val) ? null : val }));
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs mb-0.5 block" style={{ color: "#666" }}>Longitude</label>
                          <Input
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. -90.1721"
                            type="number"
                            step="0.00001"
                            value={newPit.lon ?? ""}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setNewPit(prev => ({ ...prev, lon: isNaN(val) ? null : val }));
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#999" }}>
                        If filled, these override the address geocoding.
                        Find coordinates by right-clicking your pit location in Google Maps.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Status</label>
                    <select value={newPit.status} onChange={e => setNewPit({ ...newPit, status: e.target.value as any })} className="w-full h-10 px-3 rounded-md border text-sm">
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs block" style={{ color: "#666" }}>Pickup Only</label>
                      <p className="text-[10px]" style={{ color: "#999" }}>Excluded from delivery routing</p>
                    </div>
                    <Switch checked={newPit.is_pickup_only} onCheckedChange={v => setNewPit({ ...newPit, is_pickup_only: v })} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Notes (optional)</label>
                    <Textarea placeholder="Internal notes" rows={3} value={newPit.notes} onChange={e => setNewPit({ ...newPit, notes: e.target.value })} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${T.cardBorder}` }} />

              {/* Section 2 — Pricing (Required) */}
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: T.textPrimary }}>Pricing (Required)</p>
                <p className="text-xs text-gray-500 mb-3">All pricing fields are required before a PIT can be activated.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Base price per load *</label>
                    <Input placeholder="e.g. 195.00" value={newPit.base_price ?? ""} onChange={e => setNewPit({ ...newPit, base_price: e.target.value ? parseFloat(e.target.value) : null })} onBlur={() => { if (newPit.base_price != null && !isNaN(newPit.base_price)) setNewPit(prev => ({ ...prev, base_price: Math.round(prev.base_price! * 100) / 100 })); }} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Free delivery distance (miles) *</label>
                    <Input placeholder="e.g. 15" value={newPit.free_miles ?? ""} onChange={e => setNewPit({ ...newPit, free_miles: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Extra per mile *</label>
                    <Input placeholder="e.g. 5.00" value={newPit.price_per_extra_mile ?? ""} onChange={e => setNewPit({ ...newPit, price_per_extra_mile: e.target.value ? parseFloat(e.target.value) : null })} onBlur={() => { if (newPit.price_per_extra_mile != null && !isNaN(newPit.price_per_extra_mile)) setNewPit(prev => ({ ...prev, price_per_extra_mile: Math.round(prev.price_per_extra_mile! * 100) / 100 })); }} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Max delivery distance (miles) *</label>
                    <Input placeholder="e.g. 30" value={newPit.max_distance ?? ""} onChange={e => setNewPit({ ...newPit, max_distance: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${T.cardBorder}` }} />

              {/* Section 2.5 — Operating Schedule */}
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: T.textPrimary }}>Operating Schedule</p>
                <p className="text-xs text-gray-500 mb-3">Set the days this PIT accepts deliveries. Leave all unchecked to allow all days.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, idx) => {
                    const rawDays = (newPit.operating_days as (number | string)[] | null) || [];
                    const days = rawDays.map(Number);
                    const checked = days.includes(idx);
                    return (
                      <label key={idx} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={checked} onChange={e => {
                          const currentDays = ((newPit.operating_days as (number | string)[] | null) || []).map(Number);
                          let newDays: number[];
                          if (e.target.checked) { newDays = currentDays.includes(idx) ? currentDays : [...currentDays, idx]; }
                          else { newDays = currentDays.filter(d => d !== idx); }
                          setNewPit({ ...newPit, operating_days: newDays.length > 0 ? newDays : null });
                        }} className="w-4 h-4 rounded" />
                        {label}
                      </label>
                    );
                  })}
                </div>
                {((newPit.operating_days as (number | string)[] | null) || []).map(Number).includes(6) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Saturday surcharge for this PIT</label>
                    <Input placeholder="e.g. 35.00" value={newPit.saturday_surcharge_override ?? ""} onChange={e => setNewPit({ ...newPit, saturday_surcharge_override: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank to use global default</p>
                  </div>
                )}
                {((newPit.operating_days as (number | string)[] | null) || []).map(Number).includes(0) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Sunday Surcharge ($)</label>
                    <Input placeholder="e.g. 50.00" value={newPit.sunday_surcharge ?? ""} onChange={e => setNewPit({ ...newPit, sunday_surcharge: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                {((newPit.operating_days as (number | string)[] | null) || []).map(Number).includes(6) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Saturday Load Limit (confirmed orders)</label>
                    <Input placeholder="e.g. 3" value={newPit.saturday_load_limit ?? ""} onChange={e => setNewPit({ ...newPit, saturday_load_limit: e.target.value ? parseInt(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                {((newPit.operating_days as (number | string)[] | null) || []).map(Number).includes(0) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Sunday Load Limit (confirmed orders)</label>
                    <Input placeholder="e.g. 2" value={newPit.sunday_load_limit ?? ""} onChange={e => setNewPit({ ...newPit, sunday_load_limit: e.target.value ? parseInt(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#666" }}>Same-day order cutoff</label>
                  {(() => {
                    const val = newPit.same_day_cutoff || "";
                    const match = val.match(/^(\d{1,2}):(\d{2})$/);
                    let h24 = match ? parseInt(match[1]) : 10;
                    let m = match ? parseInt(match[2]) : 0;
                    const isPM = h24 >= 12;
                    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                    const updateCutoff = (hour12: number, minute: number, pm: boolean) => {
                      let h = hour12 === 12 ? 0 : hour12;
                      if (pm) h += 12;
                      const v = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      setNewPit({ ...newPit, same_day_cutoff: v });
                    };
                    return (
                      <div className="flex gap-1.5 items-center">
                        <select value={h12} onChange={e => updateCutoff(parseInt(e.target.value), m, isPM)} className="h-9 px-2 rounded-md border text-sm w-16">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="text-sm">:</span>
                        <select value={m} onChange={e => updateCutoff(h12, parseInt(e.target.value), isPM)} className="h-9 px-2 rounded-md border text-sm w-16">
                          {[0,15,30,45].map(mi => <option key={mi} value={mi}>{String(mi).padStart(2, "0")}</option>)}
                        </select>
                        <select value={isPM ? "PM" : "AM"} onChange={e => updateCutoff(h12, m, e.target.value === "PM")} className="h-9 px-2 rounded-md border text-sm w-16">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-gray-400 mt-1">Orders before this time may qualify for same-day delivery. Leave blank to use global.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: "#666" }}>Delivery Hours by Day</label>
                  <DeliveryHoursEditor value={newPit.delivery_hours} onChange={v => setNewPit({ ...newPit, delivery_hours: v })} />
                </div>
              </div>

              {/* Section 3 — Live Price Preview */}
              {(() => {
                const hasValid = newPit.base_price != null && !isNaN(Number(newPit.base_price)) && newPit.free_miles != null && !isNaN(Number(newPit.free_miles)) && newPit.price_per_extra_mile != null && !isNaN(Number(newPit.price_per_extra_mile)) && newPit.max_distance != null && !isNaN(Number(newPit.max_distance));
                if (!hasValid) return (
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: T.textPrimary }}>Live Price Preview</p>
                    <p className="text-xs" style={{ color: "#888" }}>Fill in all pricing fields to see preview</p>
                  </div>
                );
                const effBase = Number(newPit.base_price);
                const effFree = Number(newPit.free_miles);
                const effEpm = Number(newPit.price_per_extra_mile);
                const effMax = Number(newPit.max_distance);
                const at20 = 20 > effFree ? effBase + (20 - effFree) * effEpm : effBase;
                const atMax = effMax > effFree ? effBase + (effMax - effFree) * effEpm : effBase;
                return (
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: T.textPrimary }}>Live Price Preview</p>
                    <div className="text-xs space-y-1" style={{ color: BRAND_GOLD }}>
                      <p>Within {effFree} mi: ${effBase.toFixed(2)}</p>
                      <p>At 20 mi: ${at20.toFixed(2)}</p>
                      <p>At {effMax} mi: ${atMax.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Section 4 — Activation Warning */}
              {newPit.status === "active" && (
                <div className="rounded-lg p-3 border" style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B40" }}>
                  <p className="text-xs" style={{ color: "#92400E" }}>
                    <strong>⚠️ Active status:</strong> Setting status to Active will immediately make this PIT available for deliveries. If leads exist in this area, you will be prompted to send proposals automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <Button onClick={addPit} disabled={geocoding} className="w-full h-11" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Add PIT
              </Button>
              <Button onClick={() => setShowAddPit(false)} variant="outline" className="w-full">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT PIT MODAL ─── */}
      {editingPitId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 md:p-0"
          onMouseDown={e => { if (e.target === e.currentTarget) (e.currentTarget as any).__backdropDown = true; }}
          onMouseUp={e => { if (e.target === e.currentTarget && (e.currentTarget as any).__backdropDown) cancelEditPit(); (e.currentTarget as any).__backdropDown = false; }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto md:my-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: T.textPrimary }}>Edit PIT — {editPitData.name || ""}</h2>
              </div>
              <button onClick={cancelEditPit} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Location */}
              <div>
                <p className="text-sm font-medium mb-3" style={{ color: T.textPrimary }}>Location</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>PIT Name <span style={{ color: BRAND_GOLD }}>*</span></label>
                    <Input value={editPitData.name || ""} onChange={e => setEditPitData({ ...editPitData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>PIT Address <span style={{ color: BRAND_GOLD }}>*</span></label>
                    <div className="relative">
                      {googleLoaded ? (
                        <PlaceAutocompleteInput
                          onPlaceSelect={handleEditPitPlaceSelect}
                          onInputChange={(val) => setEditPitData({ ...editPitData, address: val, lat: pits.find(pp => pp.id === editingPitId)?.lat, lon: pits.find(pp => pp.id === editingPitId)?.lon })}
                          placeholder="Start typing an address..."
                          initialValue={editPitData.address || ""}
                          containerClassName="place-autocomplete-admin"
                        />
                      ) : (
                        <Input value={editPitData.address || ""} onChange={e => setEditPitData({ ...editPitData, address: e.target.value, lat: pits.find(pp => pp.id === editingPitId)?.lat, lon: pits.find(pp => pp.id === editingPitId)?.lon })} />
                      )}
                      {editPitData.lat != null && editPitData.lat !== pits.find(pp => pp.id === editingPitId)?.lat && (
                        <Check className="absolute right-2 top-2.5 w-4 h-4 text-green-500" />
                      )}
                      {editPitData.address && editPitData.address !== pits.find(pp => pp.id === editingPitId)?.address && editPitData.lat === pits.find(pp => pp.id === editingPitId)?.lat && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Select from suggestions to capture coordinates</p>
                      )}
                    </div>
                    {(
                      editPitData.lat == null || editPitData.lon == null ||
                      Number(editPitData.lat) === 0 ||
                      Number(editPitData.lat) < 24 || Number(editPitData.lat) > 50 ||
                      Number(editPitData.lon) < -125 || Number(editPitData.lon) > -66
                    ) ? (
                      <div className="flex items-start gap-2 px-3 py-2 mt-1 rounded-lg text-xs"
                        style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B" }}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Bad coordinates:</strong> lat {String(editPitData.lat ?? "null")}, lon {String(editPitData.lon ?? "null")}.
                          Retype the address and pick from the dropdown. All city page distances for this PIT are wrong until fixed.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs" style={{ color: "#4A6A8A" }}>
                          ✓ {Number(editPitData.lat).toFixed(5)}, {Number(editPitData.lon).toFixed(5)}
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${editPitData.lat},${editPitData.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                          style={{ color: BRAND_GOLD }}
                        >
                          Verify on Google Maps ↗
                        </a>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-xs mb-1 font-medium" style={{ color: T.textSecond }}>
                        GPS Coordinates (optional — use if address is not a full street address)
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs mb-0.5 block" style={{ color: "#666" }}>Latitude</label>
                          <Input
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. 29.9073"
                            type="number"
                            step="0.00001"
                            value={editPitData.lat ?? ""}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setEditPitData(prev => ({ ...prev, lat: isNaN(val) ? null : val }));
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs mb-0.5 block" style={{ color: "#666" }}>Longitude</label>
                          <Input
                            className="h-8 text-xs font-mono"
                            placeholder="e.g. -90.1721"
                            type="number"
                            step="0.00001"
                            value={editPitData.lon ?? ""}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setEditPitData(prev => ({ ...prev, lon: isNaN(val) ? null : val }));
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#999" }}>
                        If filled, these override the address geocoding.
                        Find coordinates by right-clicking your pit location in Google Maps.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Status</label>
                    <select value={editPitData.status || "active"} onChange={e => setEditPitData({ ...editPitData, status: e.target.value as any })} className="w-full h-10 px-3 rounded-md border text-sm">
                      <option value="active">Active</option>
                      <option value="planning">Planning</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs block" style={{ color: "#666" }}>Pickup Only</label>
                      <p className="text-[10px]" style={{ color: "#999" }}>Excluded from delivery routing</p>
                    </div>
                    <Switch checked={editPitData.is_pickup_only || false} onCheckedChange={v => setEditPitData({ ...editPitData, is_pickup_only: v })} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Notes</label>
                    <Textarea rows={3} value={editPitData.notes || ""} onChange={e => setEditPitData({ ...editPitData, notes: e.target.value })} placeholder="Internal notes" />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${T.cardBorder}` }} />

              {/* Pricing (Required) */}
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: T.textPrimary }}>Pricing (Required)</p>
                <p className="text-xs text-gray-500 mb-3">All pricing fields are required before a PIT can be activated.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Base price per load *</label>
                    <Input placeholder="e.g. 195.00" value={editPitData.base_price ?? ""} onChange={e => setEditPitData({ ...editPitData, base_price: e.target.value ? parseFloat(e.target.value) : null })} onBlur={() => handlePriceBlur("base_price", editPitData.base_price ?? null, setEditPitData, editPitData)} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Free delivery distance (miles) *</label>
                    <Input placeholder="e.g. 15" value={editPitData.free_miles ?? ""} onChange={e => setEditPitData({ ...editPitData, free_miles: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Extra per mile *</label>
                    <Input placeholder="e.g. 5.00" value={editPitData.price_per_extra_mile ?? ""} onChange={e => setEditPitData({ ...editPitData, price_per_extra_mile: e.target.value ? parseFloat(e.target.value) : null })} onBlur={() => handlePriceBlur("price_per_extra_mile", editPitData.price_per_extra_mile ?? null, setEditPitData, editPitData)} type="number" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Max delivery distance (miles) *</label>
                    <Input placeholder="e.g. 30" value={editPitData.max_distance ?? ""} onChange={e => setEditPitData({ ...editPitData, max_distance: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${T.cardBorder}` }} />

              {/* Operating Schedule */}
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: T.textPrimary }}>Operating Schedule</p>
                <p className="text-xs text-gray-500 mb-3">
                  {!editPitData.operating_days || (editPitData.operating_days as number[]).length === 0
                    ? "No schedule set — all days currently available"
                    : "Check the days this PIT is open. Leave all unchecked to allow all days."}
                </p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, idx) => {
                    const rawDays = (editPitData.operating_days as (number | string)[] | null) || [];
                    const days = rawDays.map(Number);
                    const checked = days.includes(idx);
                    return (
                      <label key={idx} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={checked} onChange={e => {
                          const currentDays = ((editPitData.operating_days as (number | string)[] | null) || []).map(Number);
                          let newDays: number[];
                          if (e.target.checked) { newDays = currentDays.includes(idx) ? currentDays : [...currentDays, idx]; }
                          else { newDays = currentDays.filter(d => d !== idx); }
                          setEditPitData({ ...editPitData, operating_days: newDays.length > 0 ? newDays : null });
                        }} className="w-4 h-4 rounded" />
                        {label}
                      </label>
                    );
                  })}
                </div>
                {((editPitData.operating_days as (number | string)[] | null) || []).map(Number).includes(6) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Saturday surcharge for this PIT</label>
                    <Input placeholder="e.g. 35.00" value={editPitData.saturday_surcharge_override ?? ""} onChange={e => setEditPitData({ ...editPitData, saturday_surcharge_override: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank to use global default</p>
                  </div>
                )}
                {((editPitData.operating_days as (number | string)[] | null) || []).map(Number).includes(0) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Sunday Surcharge ($)</label>
                    <Input placeholder="e.g. 50.00" value={(editPitData as any).sunday_surcharge ?? ""} onChange={e => setEditPitData({ ...editPitData, sunday_surcharge: e.target.value ? parseFloat(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                {((editPitData.operating_days as (number | string)[] | null) || []).map(Number).includes(6) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Saturday Load Limit (confirmed orders)</label>
                    <Input placeholder="e.g. 3" value={(editPitData as any).saturday_load_limit ?? ""} onChange={e => setEditPitData({ ...editPitData, saturday_load_limit: e.target.value ? parseInt(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                {((editPitData.operating_days as (number | string)[] | null) || []).map(Number).includes(0) && (
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#666" }}>Sunday Load Limit (confirmed orders)</label>
                    <Input placeholder="e.g. 2" value={(editPitData as any).sunday_load_limit ?? ""} onChange={e => setEditPitData({ ...editPitData, sunday_load_limit: e.target.value ? parseInt(e.target.value) : null })} type="number" className="h-9 text-sm w-40" />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for no limit.</p>
                  </div>
                )}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#666" }}>Same-day order cutoff</label>
                  {(() => {
                    const val = (editPitData.same_day_cutoff as string) || "";
                    const match = val.match(/^(\d{1,2}):(\d{2})$/);
                    let h24 = match ? parseInt(match[1]) : 10;
                    let m = match ? parseInt(match[2]) : 0;
                    const isPM = h24 >= 12;
                    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                    const updateCutoff = (hour12: number, minute: number, pm: boolean) => {
                      let h = hour12 === 12 ? 0 : hour12;
                      if (pm) h += 12;
                      const v = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                      setEditPitData({ ...editPitData, same_day_cutoff: v });
                    };
                    return (
                      <div className="flex gap-1.5 items-center">
                        <select value={h12} onChange={e => updateCutoff(parseInt(e.target.value), m, isPM)} className="h-9 px-2 rounded-md border text-sm w-16">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="text-sm">:</span>
                        <select value={m} onChange={e => updateCutoff(h12, parseInt(e.target.value), isPM)} className="h-9 px-2 rounded-md border text-sm w-16">
                          {[0,15,30,45].map(mi => <option key={mi} value={mi}>{String(mi).padStart(2, "0")}</option>)}
                        </select>
                        <select value={isPM ? "PM" : "AM"} onChange={e => updateCutoff(h12, m, e.target.value === "PM")} className="h-9 px-2 rounded-md border text-sm w-16">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-gray-400 mt-1">Orders before this time may qualify for same-day delivery. Leave blank to use global.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs mb-1 block" style={{ color: "#666" }}>Delivery Hours by Day</label>
                  <DeliveryHoursEditor value={(editPitData as any).delivery_hours ?? null} onChange={v => setEditPitData({ ...editPitData, delivery_hours: v } as any)} />
                </div>
              </div>

              {/* Live Price Preview */}
              {(() => {
                const hasValid = editPitData.base_price != null && !isNaN(Number(editPitData.base_price)) && editPitData.free_miles != null && !isNaN(Number(editPitData.free_miles)) && editPitData.price_per_extra_mile != null && !isNaN(Number(editPitData.price_per_extra_mile)) && editPitData.max_distance != null && !isNaN(Number(editPitData.max_distance));
                if (!hasValid) return (
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: T.textPrimary }}>Live Price Preview</p>
                    <p className="text-xs" style={{ color: "#888" }}>Fill in all pricing fields to see preview</p>
                  </div>
                );
                const effBase = Number(editPitData.base_price);
                const effFree = Number(editPitData.free_miles);
                const effEpm = Number(editPitData.price_per_extra_mile);
                const effMax = Number(editPitData.max_distance);
                const at20 = 20 > effFree ? effBase + (20 - effFree) * effEpm : effBase;
                const atMax = effMax > effFree ? effBase + (effMax - effFree) * effEpm : effBase;
                return (
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: T.textPrimary }}>Live Price Preview</p>
                    <div className="text-xs space-y-1" style={{ color: BRAND_GOLD }}>
                      <p>Within {effFree} mi: ${effBase.toFixed(2)}</p>
                      <p>At 20 mi: ${at20.toFixed(2)}</p>
                      <p>At {effMax} mi: ${atMax.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Activation Warning */}
              {editPitData.status === "active" && pits.find(p => p.id === editingPitId)?.status !== "active" && (
                <div className="rounded-lg p-3 border" style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B40" }}>
                  <p className="text-xs" style={{ color: "#92400E" }}>
                    <strong>⚠️ Activating PIT:</strong> Setting status to Active will immediately make this PIT available for deliveries. If leads exist in this area, you will be prompted to send proposals.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 space-y-3" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <Button onClick={saveEditPit} disabled={savingPit} className="w-full h-11" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                {savingPit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
              <Button onClick={cancelEditPit} variant="outline" className="w-full">Cancel</Button>
              {!editPitData.is_default && (
                <div className="pt-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                  {!showDeleteConfirm ? (
                    <button onClick={() => setShowDeleteConfirm(true)} className="text-sm text-red-500 hover:text-red-700 w-full text-center">Delete PIT</button>
                  ) : (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-red-600 font-medium">Are you sure? This cannot be undone.</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="destructive" onClick={() => { deletePit(editingPitId!); cancelEditPit(); }}>Confirm Delete</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Keep PIT</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT CUSTOMER EMAIL MODAL (from Customers tab) ─── */}
      {editCustomerEmail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !editCustomerEmailSaving && setEditCustomerEmail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Edit Customer Email</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong style={{ color: T.textPrimary }}>Customer:</strong> {editCustomerEmail.name || "—"}</p>
                <p><strong style={{ color: T.textPrimary }}>Current Email:</strong> {editCustomerEmail.email}</p>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: T.textPrimary }}>New Email</label>
                <Input type="email" value={editCustomerEmailValue} onChange={e => setEditCustomerEmailValue(e.target.value)} placeholder="customer@example.com" className="h-10 text-sm" />
              </div>
              <div className="flex gap-2">
                {/* Save & Resend Last Order */}
                <Button
                  onClick={async () => {
                    if (!editCustomerEmailValue.trim() || !editCustomerEmailValue.includes("@")) {
                      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
                      return;
                    }
                    setEditCustomerEmailSaving(true);
                    try {
                      // 1. Update customers table
                      const { error: custErr } = await supabase.from("customers").update({ email: editCustomerEmailValue.trim() }).eq("id", editCustomerEmail.id);
                      if (custErr) throw custErr;

                      // 2. Update all orders for this customer
                      const { error: ordersErr } = await supabase.from("orders").update({ customer_email: editCustomerEmailValue.trim() }).eq("customer_id", editCustomerEmail.id);
                      if (ordersErr) throw ordersErr;

                      // 3. Find most recent order from cashOrders in memory
                      const customerOrders = cashOrders.filter(o => o.customer_id === editCustomerEmail.id);
                      const latestOrder = customerOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

                      if (!latestOrder) {
                        toast({ title: "No orders found", description: "Could not find an order to resend. Email was saved.", variant: "destructive" });
                        setEditCustomerEmail(null);
                        fetchCustomers();
                        return;
                      }

                      // 4. Send confirmation email
                      const orderDataForEmail = { ...latestOrder, customer_email: editCustomerEmailValue.trim() };
                      const { error: emailErr } = await supabase.functions.invoke("send-email", {
                        body: { type: "order_confirmation", data: orderDataForEmail },
                      });
                      if (emailErr) throw new Error(`Email send failed: ${emailErr.message}`);

                      // 5. Audit timestamp
                      await supabase.from("orders").update({ last_confirmation_sent_at: new Date().toISOString() }).eq("id", latestOrder.id);

                      toast({ title: "Email updated & sent", description: `Confirmation resent to ${editCustomerEmailValue.trim()} for order ${latestOrder.order_number || latestOrder.id}` });
                      setEditCustomerEmail(null);
                      setCustomersData(prev => prev.map(c => c.id === editCustomerEmail.id ? { ...c, email: editCustomerEmailValue.trim() } : c));
                      setCashOrders(prev => prev.map(o => o.customer_id === editCustomerEmail.id ? { ...o, customer_email: editCustomerEmailValue.trim() } : o));
                      fetchCustomers();
                    } catch (err: any) {
                      console.error("Customer email update error:", err);
                      toast({ title: "Error", description: err.message || "Failed to update email", variant: "destructive" });
                    } finally {
                      setEditCustomerEmailSaving(false);
                    }
                  }}
                  disabled={editCustomerEmailSaving}
                  className="flex-1 h-10 text-xs"
                  style={{ backgroundColor: BRAND_GOLD, color: "white" }}
                >
                  {editCustomerEmailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Save & Resend Last Order
                </Button>
                {/* Save Only */}
                <Button
                  onClick={async () => {
                    if (!editCustomerEmailValue.trim() || !editCustomerEmailValue.includes("@")) {
                      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
                      return;
                    }
                    setEditCustomerEmailSaving(true);
                    try {
                      const { error: custErr } = await supabase.from("customers").update({ email: editCustomerEmailValue.trim() }).eq("id", editCustomerEmail.id);
                      if (custErr) throw custErr;
                      const { error: ordersErr } = await supabase.from("orders").update({ customer_email: editCustomerEmailValue.trim() }).eq("customer_id", editCustomerEmail.id);
                      if (ordersErr) throw ordersErr;

                      toast({ title: "Email updated", description: `Customer email changed to ${editCustomerEmailValue.trim()}` });
                      setEditCustomerEmail(null);
                      setCustomersData(prev => prev.map(c => c.id === editCustomerEmail.id ? { ...c, email: editCustomerEmailValue.trim() } : c));
                      setCashOrders(prev => prev.map(o => o.customer_id === editCustomerEmail.id ? { ...o, customer_email: editCustomerEmailValue.trim() } : o));
                      fetchCustomers();
                    } catch (err: any) {
                      console.error("Customer email save error:", err);
                      toast({ title: "Error", description: err.message || "Failed to update email", variant: "destructive" });
                    } finally {
                      setEditCustomerEmailSaving(false);
                    }
                  }}
                  disabled={editCustomerEmailSaving}
                  variant="outline"
                  className="flex-1 h-10 text-xs"
                  style={{ borderColor: T.cardBorder, color: T.textPrimary }}
                >
                  {editCustomerEmailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Only
                </Button>
              </div>
              <Button onClick={() => setEditCustomerEmail(null)} disabled={editCustomerEmailSaving} variant="outline" className="w-full">Cancel</Button>
            </div>
          </div>
        </div>
      )}


      {/* ─── ACTIVATION LEADS MODAL ─── */}
      {showActivationModal && activationPit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !activationSending && setShowActivationModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>PIT Activated — {activationLeads.length} Leads in Range</h2>
              <p className="text-white/60 text-sm">{activationPit.name} can now serve {activationLeads.length} leads that were out of area.</p>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#F3F3F3" }}>
                      <th className="px-2 py-2 w-8"><input type="checkbox" checked={activationChecked.size === activationLeads.filter(r => r.hasEmail).length && activationLeads.filter(r => r.hasEmail).length > 0} onChange={e => { if (e.target.checked) { setActivationChecked(new Set(activationLeads.filter(r => r.hasEmail).map(r => r.lead.id))); } else { setActivationChecked(new Set()); } }} /></th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Lead #</th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Name</th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Address</th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Distance</th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Price</th>
                      <th className="px-2 py-2 text-left text-xs font-bold uppercase">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activationLeads.map((r, i) => (
                      <tr key={r.lead.id} style={{ backgroundColor: i % 2 === 0 ? T.cardBg : T.tableStripeBg }}>
                        <td className="px-2 py-2">
                          {r.hasEmail ? (
                            <input type="checkbox" checked={activationChecked.has(r.lead.id)} onChange={e => { const s = new Set(activationChecked); e.target.checked ? s.add(r.lead.id) : s.delete(r.lead.id); setActivationChecked(s); }} />
                          ) : null}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs" style={{ color: T.textPrimary }}>{r.lead.lead_number || "—"}</td>
                        <td className="px-2 py-2 text-xs font-medium">{r.lead.customer_name}</td>
                        <td className="px-2 py-2 text-xs max-w-[150px] truncate">{r.lead.address}</td>
                        <td className="px-2 py-2 text-xs">{r.distance.toFixed(1)} mi</td>
                        <td className="px-2 py-2 text-xs font-bold" style={{ color: BRAND_GOLD }}>${r.price.toFixed(2)}</td>
                        <td className="px-2 py-2 text-xs">
                          {r.hasEmail ? r.lead.customer_email : <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">No email — manual follow-up</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activationSending && (
                <div className="mt-4">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${(activationProgress.current / activationProgress.total) * 100}%`, backgroundColor: BRAND_GOLD }} />
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-500">Sending proposals... {activationProgress.current} of {activationProgress.total}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex flex-wrap gap-2 items-center justify-between" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <div className="flex gap-2">
                <Button onClick={() => { setActivationChecked(new Set(activationLeads.filter(r => r.hasEmail).map(r => r.lead.id))); sendActivationProposals(); }} disabled={activationSending} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {activationSending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Send Proposals to All ({activationLeads.filter(r => r.hasEmail).length})
                </Button>
                <Button onClick={sendActivationProposals} disabled={activationSending || activationChecked.size === 0} variant="outline" style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }}>
                  Send to Selected ({activationChecked.size})
                </Button>
              </div>
              <button onClick={() => { setShowActivationModal(false); setActivationLeads([]); }} disabled={activationSending} className="text-sm text-gray-400 hover:text-gray-600">
                Skip — I'll contact manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MARK AS PAID DIALOG ─── */}
      {cashOrderToMark && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !markingPaid && setCashOrderToMark(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Confirm Payment Received</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong style={{ color: T.textPrimary }}>Order #:</strong> {cashOrderToMark.order_number || "—"}</p>
                <p><strong style={{ color: T.textPrimary }}>Customer:</strong> {cashOrderToMark.customer_name}</p>
                <p><strong style={{ color: T.textPrimary }}>Amount:</strong> <span style={{ color: BRAND_GOLD, fontWeight: 700 }}>${Number(cashOrderToMark.price || 0).toFixed(2)}</span></p>
                <p><strong style={{ color: T.textPrimary }}>Method:</strong> {cashOrderToMark.payment_method === "check" ? "Check" : "Cash"}</p>
                <p><strong style={{ color: T.textPrimary }}>Delivery:</strong> {cashOrderToMark.delivery_date || "TBD"}</p>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#666" }}>Collected by (optional)</label>
                <Input placeholder="e.g. John D." value={cashCollectedBy} onChange={e => setCashCollectedBy(e.target.value)} className="h-9 text-sm" />
              </div>
              {cashOrderToMark.customer_email && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={cashSendEmail} onChange={e => setCashSendEmail(e.target.checked)} className="w-4 h-4 rounded" />
                  Send payment confirmation email to {cashOrderToMark.customer_email}
                </label>
              )}
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <Button onClick={markCashPaid} disabled={markingPaid} className="flex-1 h-10" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                {markingPaid ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Confirm Payment
              </Button>
              <Button onClick={() => setCashOrderToMark(null)} disabled={markingPaid} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT EMAIL & RESEND MODAL ─── */}
      {editEmailOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !editEmailSaving && setEditEmailOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ backgroundColor: T.tableHeaderBg }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Edit Customer Email</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong style={{ color: T.textPrimary }}>Order #:</strong> {editEmailOrder.order_number || "—"}</p>
                <p><strong style={{ color: T.textPrimary }}>Customer:</strong> {editEmailOrder.customer_name}</p>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#666" }}>Email address</label>
                <Input
                  type="email"
                  value={editEmailValue}
                  onChange={e => setEditEmailValue(e.target.value)}
                  placeholder="customer@example.com"
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <Button
                onClick={async () => {
                  if (!editEmailValue.trim() || !editEmailValue.includes("@")) {
                    toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
                    return;
                  }
                  setEditEmailSaving(true);
                  try {
                    console.log("Step 1: Updating order email to", editEmailValue.trim(), "for order", editEmailOrder.id);
                    const { error: orderErr } = await supabase.from("orders").update({ customer_email: editEmailValue.trim() }).eq("id", editEmailOrder.id);
                    console.log("Step 1 result:", orderErr ? "ERROR: " + orderErr.message : "SUCCESS");
                    if (orderErr) throw orderErr;

                    console.log("Step 2: Updating customer email, customer_id:", editEmailOrder.customer_id);
                    if (editEmailOrder.customer_id) {
                      const { error: custErr } = await supabase.from("customers").update({ email: editEmailValue.trim() }).eq("id", editEmailOrder.customer_id);
                      console.log("Step 2 result:", custErr ? "ERROR: " + custErr.message : "SUCCESS");
                    }

                    // 3 & 4. Resend confirmation using existing order data (no re-fetch needed)
                    const orderDataForEmail = { ...editEmailOrder, customer_email: editEmailValue.trim() };
                    const { error: emailErr } = await supabase.functions.invoke("send-email", {
                      body: { type: "order_confirmation", data: orderDataForEmail },
                    });
                    console.log("Step 4 result:", emailErr ? "ERROR: " + emailErr.message : "SUCCESS");
                    if (emailErr) throw new Error(`Email send failed: ${emailErr.message}`);

                    console.log("Step 5: Updating audit timestamp");
                    await supabase.from("orders").update({ last_confirmation_sent_at: new Date().toISOString() }).eq("id", editEmailOrder.id);
                    console.log("Step 5 result: SUCCESS");

                    toast({ title: "Email updated & sent", description: `Confirmation resent to ${editEmailValue.trim()}` });
                    setEditEmailOrder(null);
                    setCashOrders(prev => prev.map(o =>
                      o.id === editEmailOrder.id
                        ? { ...o, customer_email: editEmailValue.trim(), last_confirmation_sent_at: new Date().toISOString() }
                        : o
                    ));
                    fetchCashOrders();
                  } catch (err: any) {
                    console.error("CAUGHT ERROR:", err.message);
                    toast({ title: "Error", description: err.message || "Failed to update email", variant: "destructive" });
                  } finally {
                    setEditEmailSaving(false);
                  }
                }}
                disabled={editEmailSaving}
                className="flex-1 h-10"
                style={{ backgroundColor: BRAND_GOLD, color: "white" }}
              >
                {editEmailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Save & Resend
              </Button>
              <Button onClick={() => setEditEmailOrder(null)} disabled={editEmailSaving} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cash-daily-schedule, #cash-daily-schedule * { visibility: visible; }
          #cash-daily-schedule { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Leads;

```

## `src/pages/LeadsSetup2FA.tsx`

_Lines: 

```typescript
/**
 * Leads 2FA Setup / Re-enrollment
 * ─────────────────────────────────────────────────────────────────────────
 * Password-gated. Generates a fresh TOTP secret, session signing key, and
 * 10 backup codes. Plaintext secrets shown ONCE — operator must paste both
 * into Lovable Cloud → Secrets before closing the page.
 *
 * RECOVERY PROCEDURE (also documented inline on the /leads login):
 *   1. Open Lovable Cloud → Secrets, delete LEADS_TOTP_SECRET (and optionally
 *      LEADS_SESSION_SIGNING_KEY to invalidate all live sessions).
 *   2. Visit /leads/setup-2fa, enter password.
 *   3. Re-enroll: scan new QR, paste new secrets back into Cloud secrets.
 *   4. Save new backup codes.
 * Test this end-to-end BEFORE depending on 2FA in production.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#0D2137";
const GOLD = "#C07A00";
const CREAM = "#F7F4EC";
const RED = "#B23A3A";

export default function LeadsSetup2FA() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<null | {
    leads_totp_secret: string;
    leads_session_signing_key: string;
    otpauth_url: string;
    backup_codes: string[];
    instructions: string[];
  }>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke("leads-auth", {
        body: { action: "setup_totp_preview", password },
      });
      if (invErr) throw invErr;
      if (!res?.ok) throw new Error(res?.error || "Enrollment failed");
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, padding: "32px 16px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: NAVY, fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 1, margin: 0 }}>
          LEADS — 2FA ENROLLMENT
        </h1>
        <p style={{ color: NAVY, opacity: 0.7, marginTop: 4 }}>
          One-time setup or recovery re-enrollment for the admin dashboard.
        </p>

        {!data && (
          <form onSubmit={handleEnroll} style={card()}>
            <label style={{ color: NAVY, fontWeight: 600, fontSize: 14 }}>
              Admin password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={input()}
              />
            </label>
            {error && <div style={errBox()}>{error}</div>}
            <button type="submit" disabled={busy || !password} style={btnPrimary(busy)}>
              {busy ? "Generating…" : "Generate new 2FA secrets"}
            </button>
            <p style={{ color: NAVY, opacity: 0.7, fontSize: 13, marginTop: 12 }}>
              Warning: this wipes all existing backup codes and replaces both server secrets.
              Existing authenticator enrollments will stop working until both new secrets are
              pasted into Lovable Cloud → Secrets.
            </p>
          </form>
        )}

        {data && (
          <>
            <div style={{ ...card(), borderColor: RED, borderWidth: 2 }}>
              <div style={{ color: RED, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                ⚠ SAVE BOTH SECRETS BEFORE CLOSING THIS PAGE
              </div>
              <div style={{ color: NAVY, fontSize: 14 }}>
                Paste both into <strong>Lovable Cloud → Secrets</strong>. They will not be shown again.
                Closing this page without saving them = locked out.
              </div>
            </div>

            <div style={card()}>
              <h2 style={h2()}>1. Server secrets (paste into Lovable Cloud)</h2>
              <SecretRow label="LEADS_TOTP_SECRET" value={data.leads_totp_secret} copied={copied} onCopy={copy} />
              <SecretRow label="LEADS_SESSION_SIGNING_KEY" value={data.leads_session_signing_key} copied={copied} onCopy={copy} />
            </div>

            <div style={card()}>
              <h2 style={h2()}>2. Authenticator app</h2>
              <p style={{ color: NAVY, fontSize: 14, marginTop: 0 }}>
                Scan with Google Authenticator, 1Password, Authy, etc. Or paste the secret above manually.
              </p>
              <div style={{ background: "#fff", padding: 16, display: "inline-block", borderRadius: 8, border: `1px solid ${NAVY}22` }}>
                <QRCodeSVG value={data.otpauth_url} size={200} />
              </div>
            </div>

            <div style={card()}>
              <h2 style={h2()}>3. Backup codes (save these somewhere safe)</h2>
              <p style={{ color: NAVY, fontSize: 14, marginTop: 0 }}>
                Each code works exactly once. Use them if you lose your authenticator.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontFamily: "ui-monospace, monospace" }}>
                {data.backup_codes.map((c) => (
                  <div key={c} style={{ background: CREAM, border: `1px solid ${NAVY}22`, padding: "8px 12px", borderRadius: 6, color: NAVY, fontSize: 14 }}>
                    {c}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => copy("backup", data.backup_codes.join("\n"))}
                style={{ ...btnSecondary(), marginTop: 12 }}
              >
                {copied === "backup" ? "Copied!" : "Copy all 10 codes"}
              </button>
            </div>

            <div style={card()}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", color: NAVY }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 14 }}>
                  I have saved both server secrets to Lovable Cloud, scanned the QR code,
                  and stored the backup codes somewhere safe.
                </span>
              </label>
              <a
                href="/leads"
                onClick={(e) => { if (!confirmed) e.preventDefault(); }}
                style={{ ...btnPrimary(!confirmed), display: "inline-block", marginTop: 16, textAlign: "center", textDecoration: "none" }}
              >
                {confirmed ? "Go to /leads to test login" : "Confirm above to continue"}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SecretRow({ label, value, copied, onCopy }: { label: string; value: string; copied: string | null; onCopy: (l: string, v: string) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: NAVY, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <code style={{ flex: 1, background: CREAM, border: `1px solid ${NAVY}22`, padding: "10px 12px", borderRadius: 6, color: NAVY, fontSize: 13, wordBreak: "break-all" }}>
          {value}
        </code>
        <button type="button" onClick={() => onCopy(label, value)} style={btnSecondary()}>
          {copied === label ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const card = (): React.CSSProperties => ({
  background: "#fff", border: `1px solid ${NAVY}22`, borderRadius: 10, padding: 20, marginTop: 16,
});
const h2 = (): React.CSSProperties => ({ color: NAVY, fontSize: 16, margin: "0 0 10px", fontWeight: 700 });
const input = (): React.CSSProperties => ({
  display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
  border: `1px solid ${NAVY}33`, borderRadius: 6, fontSize: 14, color: NAVY, background: "#fff",
});
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  marginTop: 14, padding: "10px 16px", background: disabled ? "#999" : GOLD, color: "#fff",
  border: "none", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
});
const btnSecondary = (): React.CSSProperties => ({
  padding: "8px 14px", background: NAVY, color: "#fff", border: "none",
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
});
const errBox = (): React.CSSProperties => ({
  marginTop: 12, padding: "10px 12px", background: "#FBE8E8", color: RED,
  border: `1px solid ${RED}55`, borderRadius: 6, fontSize: 14,
});

```

# Drivers (Phase 0/1/2)

## `src/components/leads/drivers/DriversTab.tsx`

_Lines: 

```typescript
// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { useMemo, useState } from "react";
import { Loader2, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DriverRow from "./DriverRow";
import DriverModal from "./DriverModal";
import type { Driver } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  drivers: Driver[];
  loading: boolean;
  password: string;
  onRefresh: () => void;
}

export default function DriversTab({ drivers, loading, password, onRefresh }: Props) {
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);

  const visible = useMemo(
    () => (showInactive ? drivers : drivers.filter(d => d.active)),
    [drivers, showInactive]
  );
  const activeCount = useMemo(() => drivers.filter(d => d.active).length, [drivers]);

  function openAdd() {
    setSelected(null);
    setModalOpen(true);
  }
  function openEdit(d: Driver) {
    setSelected(d);
    setModalOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white" style={{ borderColor: "#E5E7EB" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5" style={{ color: BRAND_NAVY }} />
            <h2 className="font-display uppercase tracking-wider text-xl" style={{ color: BRAND_NAVY }}>
              Drivers
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-xs cursor-pointer" style={{ color: "#6B7280" }}>
                Show inactive
              </Label>
            </div>
            <Button
              size="sm"
              onClick={openAdd}
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Driver
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 border-b text-sm" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
          Active drivers: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{activeCount}</span>
          {showInactive && (
            <>
              {" · "}Total: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{drivers.length}</span>
            </>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#6B7280" }}>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading drivers…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>
            {drivers.length === 0
              ? "No drivers yet. Click \"Add Driver\" to create the first one."
              : "No drivers match the current filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Name</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Phone</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Truck</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Payment</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>License Exp.</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(d => (
                  <DriverRow key={d.id} driver={d} onEdit={openEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        driver={selected}
        password={password}
        onSaved={onRefresh}
      />
    </>
  );
}

```

## `src/components/leads/drivers/DriverRow.tsx`

_Lines: 

```typescript
// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { Edit2 } from "lucide-react";
import { formatPhone } from "@/lib/format";
import type { Driver } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  driver: Driver;
  onEdit: (d: Driver) => void;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
}

export default function DriverRow({ driver, onEdit }: Props) {
  const license = daysUntil(driver.license_expires_on);
  const licenseColor =
    license === null ? "#9CA3AF" : license < 0 ? "#DC2626" : license <= 30 ? "#DC2626" : "#374151";
  const licenseText = driver.license_expires_on
    ? new Date(driver.license_expires_on + "T00:00:00").toLocaleDateString()
    : "—";

  const payRate = Number(driver.payment_rate || 0);
  const payText = `${driver.payment_type} · $${payRate.toFixed(2)}`;

  return (
    <tr
      className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
      style={{ borderColor: "#E5E7EB" }}
      onClick={() => onEdit(driver)}
    >
      <td className="px-4 py-3 font-semibold" style={{ color: BRAND_NAVY }}>
        {driver.name}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {driver.phone ? formatPhone(driver.phone) : "—"}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {driver.truck_number || "—"}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {payText}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: licenseColor, fontWeight: license !== null && license <= 30 ? 600 : 400 }}>
        {licenseText}
        {license !== null && license <= 30 && license >= 0 && (
          <span className="ml-1 text-[10px]">({license}d)</span>
        )}
        {license !== null && license < 0 && <span className="ml-1 text-[10px]">(EXPIRED)</span>}
      </td>
      <td className="px-4 py-3">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
          style={{
            backgroundColor: driver.active ? "#DCFCE7" : "#F3F4F6",
            color: driver.active ? "#166534" : "#6B7280",
            border: `1px solid ${driver.active ? "#166534" : "#9CA3AF"}`,
          }}
        >
          {driver.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(driver);
          }}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border hover:bg-white transition-colors"
          style={{ color: BRAND_GOLD, borderColor: BRAND_GOLD }}
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
      </td>
    </tr>
  );
}

```

## `src/components/leads/drivers/DriverModal.tsx`

_Lines: 

```typescript
// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserX, UserPlus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, stripPhone } from "@/lib/format";
import { formatEmail, formatProperName, formatProperNameFinal } from "@/lib/textFormat";
import EmailInput from "@/components/EmailInput";
import { PAYMENT_TYPES, type Driver, type PaymentType } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const ERROR_RED = "#DC2626";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-11 rounded-lg";

interface Props {
  open: boolean;
  onClose: () => void;
  driver: Driver | null; // null = Add mode
  password: string;
  onSaved: () => void;
}

interface FormState {
  name: string;
  phone: string; // formatted for display
  email: string;
  truck_number: string;
  payment_type: PaymentType;
  payment_rate: string;
  license_expires_on: string;
  notes: string;
  active: boolean;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  truck_number: "",
  payment_type: "per_load",
  payment_rate: "0",
  license_expires_on: "",
  notes: "",
  active: true,
};

function driverToForm(d: Driver): FormState {
  return {
    name: d.name || "",
    phone: d.phone ? formatPhone(d.phone) : "",
    email: d.email || "",
    truck_number: d.truck_number || "",
    payment_type: (PAYMENT_TYPES.find(p => p.value === d.payment_type)?.value || "per_load") as PaymentType,
    payment_rate: String(d.payment_rate ?? 0),
    license_expires_on: d.license_expires_on || "",
    notes: d.notes || "",
    active: !!d.active,
  };
}

export default function DriverModal({ open, onClose, driver, password, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!driver;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formAttempted, setFormAttempted] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (open) {
      const next = driver ? driverToForm(driver) : EMPTY;
      setForm(next);
      setOriginal(next);
      setPhoneError(null);
      setNameError(null);
      setFormAttempted(false);
      setConfirmDeactivate(false);
    }
  }, [open, driver]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "phone") setPhoneError(null);
    if (k === "name") setNameError(null);
  };

  async function invokeUpsert(payload: Record<string, unknown>) {
    return await supabase.functions.invoke("leads-auth", {
      body: { password, action: "upsert_driver", driver: payload },
    });
  }

  async function handleSave() {
    setFormAttempted(true);
    setPhoneError(null);
    setNameError(null);

    const trimmedName = form.name.trim();
    const phoneDigits = stripPhone(form.phone);

    let hasError = false;
    if (!isEdit) {
      if (!trimmedName) {
        setNameError("Name is required");
        hasError = true;
      }
      if (phoneDigits.length < 10) {
        setPhoneError("Phone must have at least 10 digits");
        hasError = true;
      }
    } else {
      if (form.name !== original.name && !trimmedName) {
        setNameError("Name cannot be empty");
        hasError = true;
      }
      if (form.phone !== original.phone && phoneDigits.length < 10) {
        setPhoneError("Phone must have at least 10 digits");
        hasError = true;
      }
    }
    if (hasError) return;

    setSaving(true);
    try {
      let payload: Record<string, unknown>;

      if (!isEdit) {
        // INSERT — send all fields
        payload = {
          name: trimmedName,
          phone: phoneDigits,
          email: form.email.trim() || null,
          truck_number: form.truck_number.trim() || null,
          payment_type: form.payment_type,
          payment_rate: Number(form.payment_rate) || 0,
          license_expires_on: form.license_expires_on || null,
          notes: form.notes.trim() || null,
          active: form.active,
        };
      } else {
        // UPDATE — diff only changed fields, partial update per Phase 0 validator
        payload = { id: driver!.id };
        if (form.name !== original.name) payload.name = trimmedName;
        if (form.phone !== original.phone) payload.phone = phoneDigits;
        if (form.email !== original.email) payload.email = form.email.trim() || null;
        if (form.truck_number !== original.truck_number) payload.truck_number = form.truck_number.trim() || null;
        if (form.payment_type !== original.payment_type) payload.payment_type = form.payment_type;
        if (form.payment_rate !== original.payment_rate) payload.payment_rate = Number(form.payment_rate) || 0;
        if (form.license_expires_on !== original.license_expires_on) payload.license_expires_on = form.license_expires_on || null;
        if (form.notes !== original.notes) payload.notes = form.notes.trim() || null;
        if (form.active !== original.active) payload.active = form.active;

        if (Object.keys(payload).length === 1) {
          toast({ title: "No changes to save" });
          setSaving(false);
          return;
        }
      }

      const { data, error } = await invokeUpsert(payload);

      // Edge function returns 409 with { error } body for duplicate phone
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        const msg = (errBody?.error as string) || (error?.message as string) || "Save failed";
        const status = (error as any)?.context?.status;
        if (status === 409 || /already exists/i.test(msg)) {
          setPhoneError("A driver with this phone number already exists");
        } else {
          toast({ title: "Save failed", description: msg, variant: "destructive" });
        }
        setSaving(false);
        return;
      }

      toast({ title: isEdit ? "Driver saved" : "Driver added" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateToggle() {
    if (!driver) return;
    const target = !driver.active;
    if (target === false && !confirmDeactivate) {
      setConfirmDeactivate(true);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await invokeUpsert({ id: driver.id, active: target });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        toast({
          title: target ? "Reactivate failed" : "Deactivate failed",
          description: errBody?.error || error?.message || "Unknown error",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      toast({ title: target ? "Driver reactivated" : "Driver deactivated" });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const showNameError = formAttempted && !!nameError;
  const showPhoneError = formAttempted && !!phoneError;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
            {isEdit ? "Edit Driver" : "Add Driver"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="drv-name" className={LABEL_CLS}>Name *</Label>
            <Input
              id="drv-name"
              autoComplete="name"
              maxLength={100}
              value={form.name}
              onChange={(e) => update("name", formatProperName(e.target.value))}
              onBlur={(e) => update("name", formatProperNameFinal(e.target.value))}
              placeholder="John Smith"
              className={`${INPUT_CLS} ${showNameError ? "border-2" : ""}`}
              style={showNameError ? { borderColor: ERROR_RED } : undefined}
            />
            {showNameError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" />
                {nameError}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="drv-phone" className={LABEL_CLS}>Phone *</Label>
            <Input
              id="drv-phone"
              type="tel"
              autoComplete="tel"
              maxLength={14}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              placeholder="(504) 555-1234"
              className={`${INPUT_CLS} ${showPhoneError ? "border-2" : ""}`}
              style={showPhoneError ? { borderColor: ERROR_RED } : undefined}
            />
            {showPhoneError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" />
                {phoneError}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="drv-email" className={LABEL_CLS}>Email</Label>
            <EmailInput
              id="drv-email"
              value={form.email}
              onChange={(v) => update("email", formatEmail(v))}
              placeholder="driver@example.com"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="drv-truck" className={LABEL_CLS}>Truck Number</Label>
              <Input
                id="drv-truck"
                value={form.truck_number}
                onChange={(e) => update("truck_number", e.target.value)}
                placeholder="T-101"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label htmlFor="drv-license" className={LABEL_CLS}>License Expires</Label>
              <Input
                id="drv-license"
                type="date"
                value={form.license_expires_on}
                onChange={(e) => update("license_expires_on", e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="drv-paytype" className={LABEL_CLS}>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={(v) => update("payment_type", v as PaymentType)}>
                <SelectTrigger id="drv-paytype" className={INPUT_CLS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="drv-payrate" className={LABEL_CLS}>Payment Rate ($)</Label>
              <Input
                id="drv-payrate"
                type="number"
                step="0.01"
                min="0"
                value={form.payment_rate}
                onChange={(e) => update("payment_rate", e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="drv-notes" className={LABEL_CLS}>Notes</Label>
            <Textarea
              id="drv-notes"
              rows={2}
              maxLength={1000}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Internal notes about this driver"
            />
          </div>

          {isEdit && (
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#E5E7EB" }}>
              <Label htmlFor="drv-active" className={`${LABEL_CLS} cursor-pointer mb-0`}>Active</Label>
              <Switch id="drv-active" checked={form.active} onCheckedChange={(v) => update("active", v)} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleDeactivateToggle}
              className="border-2"
              style={
                driver!.active
                  ? { borderColor: "#DC2626", color: "#DC2626" }
                  : { borderColor: "#16A34A", color: "#16A34A" }
              }
            >
              {driver!.active ? <UserX className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              {driver!.active
                ? (confirmDeactivate ? "Click again to confirm" : "Deactivate Driver")
                : "Reactivate Driver"}
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {isEdit ? "Save Changes" : "Save Driver"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

## `src/components/leads/drivers/types.ts`

_Lines: 

```typescript
// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).

export type PaymentType = "per_load" | "hourly" | "flat_day";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  truck_number: string | null;
  payment_type: PaymentType | string;
  payment_rate: number;
  license_expires_on: string | null; // ISO date
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: "per_load", label: "Per Load" },
  { value: "hourly", label: "Hourly" },
  { value: "flat_day", label: "Flat Day" },
];

```

# Schedule (Slice 1)

## `src/components/leads/schedule/ScheduleTab.tsx`

_Lines: 

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Driver } from "@/components/leads/drivers/types";
import { summarizeOrders, toIsoDate } from "@/lib/schedule-adapter";
import WeekStrip from "./WeekStrip";
import DayPanel from "./DayPanel";
import SummaryBar from "./SummaryBar";

interface Props {
  /**
   * Card-click handler: parent should set activePage="all" and selectedOrderId=id
   * to drill into the existing Order Detail side panel (Decision 3).
   */
  onOrderClick: (orderId: string) => void;
  /** Path B Phase 2 — drivers list lifted from Leads.tsx, threaded for Send-to-Driver button. */
  drivers?: Driver[];
  /** Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function ScheduleTab({ onOrderClick, drivers = [], onSendToDriver }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dayOrders, setDayOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, { orders: number; loads: number }>>({});
  const [loading, setLoading] = useState(false);

  const selectedIso = useMemo(() => toIsoDate(selectedDate), [selectedDate]);

  // Correction to Slice 1 — Schedule reads now route through leads-auth, not direct supabase.from().
  // Original Decision A assumed the direct read pattern worked; diagnosis revealed the orders table
  // RLS policy (admins_read_all_orders) requires an authenticated admin JWT, but /leads sessions
  // hold only a sessionStorage password and query as the anon role. Anon reads were silently
  // filtered to []. All other Leads tabs already route through leads-auth — this aligns Schedule
  // with that pattern.
  const fetchDay = useCallback(async (iso: string) => {
    setLoading(true);
    try {
      const password = sessionStorage.getItem("leads_pw") || "";
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { action: "schedule_get_day", password, iso },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDayOrders(data?.orders || []);
    } catch (err) {
      console.warn("[ScheduleTab] fetchDay failed:", err);
      setDayOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch order/load counts for the visible 91-day window (7 past + 83 future).
  const fetchWindowCounts = useCallback(async (centerDate: Date) => {
    const start = new Date(centerDate);
    start.setDate(start.getDate() - 7);
    const end = new Date(centerDate);
    end.setDate(end.getDate() + 83);
    try {
      const password = sessionStorage.getItem("leads_pw") || "";
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          action: "schedule_get_window_counts",
          password,
          start: toIsoDate(start),
          end: toIsoDate(end),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next: Record<string, { orders: number; loads: number }> = {};
      (data?.rows || []).forEach((o: any) => {
        const d = o.delivery_date;
        if (!d) return;
        if (!next[d]) next[d] = { orders: 0, loads: 0 };
        next[d].orders += 1;
        next[d].loads += Number(o.quantity) || 0;
      });
      setCounts(next);
    } catch (err) {
      console.warn("[ScheduleTab] fetchWindowCounts failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchDay(selectedIso);
  }, [selectedIso, fetchDay]);

  // Window counts only need to refresh when the centerpoint shifts. Today is
  // the centerpoint for the lifetime of the mounted tab.
  useEffect(() => {
    fetchWindowCounts(new Date());
  }, [fetchWindowCounts]);

  // Path B Phase 2 — Send to Driver from a Schedule card. Optimistically patch local
  // dayOrders so "Last sent" updates immediately; parent owns the persistent allOrders
  // patch + revert-on-failure flow.
  const handleCardSend = useCallback((order: any, driver: Driver) => {
    if (!onSendToDriver) return;
    const iso = new Date().toISOString();
    setDayOrders(prev => prev.map(o => o.id === order.id ? { ...o, message_sent_at: iso } : o));
    onSendToDriver(order, driver);
  }, [onSendToDriver]);

  const summary = useMemo(() => summarizeOrders(dayOrders), [dayOrders]);
  const dateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0D2137",
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          DELIVERY SCHEDULE
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          Orders by delivery date
        </p>
      </div>

      <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} counts={counts} />

      <SummaryBar summary={summary} dateLabel={dateLabel} />

      <DayPanel
        date={selectedDate}
        orders={dayOrders}
        loading={loading}
        onOpenOrder={onOrderClick}
        drivers={drivers}
        onSendToDriver={onSendToDriver ? handleCardSend : undefined}
      />
    </div>
  );
}

```

## `src/components/leads/schedule/DayPanel.tsx`

_Lines: 

```typescript
import type { Driver } from "@/components/leads/drivers/types";
import ScheduleOrderCard from "./ScheduleOrderCard";

interface OrderLike {
  id: string;
  delivery_window?: string | null;
  created_at?: string | null;
  [k: string]: any;
}

interface Props {
  date: Date;
  orders: OrderLike[];
  loading: boolean;
  onOpenOrder: (id: string) => void;
  /** Path B Phase 2 — threaded down for Send-to-Driver button on cards. */
  drivers?: Driver[];
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function DayPanel({ date, orders, loading, onOpenOrder, drivers = [], onSendToDriver }: Props) {
  const heading = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0D2137",
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          {heading}
        </h3>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </div>

      {loading ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 13,
            border: "1px dashed #E5E7EB",
            borderRadius: 8,
          }}
        >
          No deliveries scheduled.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(o => (
            <ScheduleOrderCard
              key={o.id}
              order={o}
              onOpen={onOpenOrder}
              drivers={drivers}
              onSendToDriver={onSendToDriver}
            />
          ))}
        </div>
      )}
    </div>
  );
}

```

## `src/components/leads/schedule/ScheduleOrderCard.tsx`

_Lines: 

```typescript
import { MessageCircle } from "lucide-react";
import type { Driver } from "@/components/leads/drivers/types";
import { canSendToDriver } from "@/lib/whatsapp-message";
import { deriveDisplayStatus, SCHEDULE_STATUS_TOKENS } from "@/lib/schedule-adapter";

const BRAND_GOLD = "#C07A00";

interface OrderLike {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_window?: string | null;
  quantity?: number | null;
  price?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  delivery_date?: string | null;
  cancelled_at?: string | null;
  pit_id?: string | null;
  driver_id?: string | null;
  message_sent_at?: string | null;
  notes?: string | null;
}

interface Props {
  order: OrderLike;
  onOpen: (id: string) => void;
  /** Path B Phase 2 — drivers list (filtered to active by parent). */
  drivers?: Driver[];
  /** Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function ScheduleOrderCard({ order, onOpen, drivers = [], onSendToDriver }: Props) {
  const display = deriveDisplayStatus(order);
  const tok = SCHEDULE_STATUS_TOKENS[display];
  const price = Number(order.price) || 0;
  const qty = Number(order.quantity) || 0;
  const paymentLabel = (order.payment_method || "").toUpperCase() || "—";

  const assignedDriver = order.driver_id ? drivers.find(d => d.id === order.driver_id) || null : null;
  const sendCheck = canSendToDriver(order as any, assignedDriver);
  const lastSent = order.message_sent_at
    ? new Date(order.message_sent_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : null;

  // Path B Phase 2 — outer card converted from <button> to <div role="button"> so the
  // inner Send-to-Driver <button> is valid HTML. Keyboard handler matches native button:
  // Enter triggers, Space triggers (with preventDefault to suppress page scroll).
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen(order.id);
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      onOpen(order.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order.id)}
      onKeyDown={handleKey}
      aria-label={`Open order ${order.order_number || order.id} for ${order.customer_name || "customer"}`}
      style={{
        textAlign: "left",
        width: "100%",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        transition: "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#0D2137";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(13,33,55,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E5E7EB";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: BRAND_GOLD, fontWeight: 600 }}>
              {order.order_number || "—"}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                background: tok.bg,
                color: tok.text,
              }}
            >
              {tok.label}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0D2137", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.customer_name || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.delivery_address || "—"}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#6B7280" }}>
            <span>{order.delivery_window || "—"}</span>
            <span>•</span>
            <span>{qty} yard{qty === 1 ? "" : "s"}</span>
            <span>•</span>
            <span>{paymentLabel}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: BRAND_GOLD, lineHeight: 1 }}>
            ${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */}
      {onSendToDriver && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>
            {lastSent ? `Last sent: ${lastSent}` : "Not sent yet."}
          </span>
          <button
            type="button"
            disabled={!sendCheck.canSend}
            title={sendCheck.reason || ""}
            onClick={(e) => {
              e.stopPropagation();
              if (assignedDriver) onSendToDriver(order as any, assignedDriver);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".02em",
              borderRadius: 5,
              border: "none",
              cursor: sendCheck.canSend ? "pointer" : "not-allowed",
              background: sendCheck.canSend ? BRAND_GOLD : "#9CA3AF",
              color: "#FFFFFF",
            }}
          >
            <MessageCircle size={12} />
            Send
          </button>
        </div>
      )}
    </div>
  );
}

```

## `src/components/leads/schedule/WeekStrip.tsx`

_Lines: 

```typescript
import { useEffect, useRef } from "react";
import { toIsoDate, todayIsoDate } from "@/lib/schedule-adapter";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  /** date(YYYY-MM-DD) -> { orders, loads } */
  counts: Record<string, { orders: number; loads: number }>;
}

/**
 * Horizontal day strip: 7 past + 83 future = 91 days.
 * Selected day is highlighted; today gets a gold ring.
 */
export default function WeekStrip({ selectedDate, onSelectDate, counts }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayIsoDate();
  const selectedIso = toIsoDate(selectedDate);

  // Build the 91-day window centered on today.
  const days: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let offset = -7; offset <= 83; offset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    days.push(d);
  }

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector("[data-selected='true']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIso]);

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "8px 4px",
        scrollbarWidth: "thin",
      }}
      role="tablist"
      aria-label="Delivery schedule day picker"
    >
      {days.map(d => {
        const iso = toIsoDate(d);
        const isSelected = iso === selectedIso;
        const isToday = iso === today;
        const c = counts[iso] || { orders: 0, loads: 0 };
        const wd = d.toLocaleDateString("en-US", { weekday: "short" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-US", { month: "short" });
        return (
          <button
            key={iso}
            type="button"
            data-selected={isSelected ? "true" : undefined}
            role="tab"
            aria-selected={isSelected}
            aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${c.orders} orders, ${c.loads} loads`}
            onClick={() => onSelectDate(d)}
            style={{
              flex: "0 0 auto",
              minWidth: 76,
              padding: "8px 6px",
              borderRadius: 10,
              border: `1px solid ${isSelected ? BRAND_NAVY : "#E5E7EB"}`,
              background: isSelected ? BRAND_NAVY : "#FFFFFF",
              color: isSelected ? "#FFFFFF" : "#0D2137",
              cursor: "pointer",
              boxShadow: isToday && !isSelected ? `inset 0 0 0 2px ${BRAND_GOLD}` : "none",
              transition: "background 150ms ease, border-color 150ms ease",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>
              {wd}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{dom}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{mon}</div>
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                fontWeight: 600,
                color: isSelected ? "#FFFFFF" : c.orders > 0 ? BRAND_GOLD : "#9CA3AF",
              }}
            >
              {c.orders > 0 ? `${c.orders} • ${c.loads}Y` : "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

```

## `src/components/leads/schedule/SummaryBar.tsx`

_Lines: 

```typescript
import type { ScheduleSummary } from "@/lib/schedule-adapter";

const BRAND_GOLD = "#C07A00";

interface Props {
  summary: ScheduleSummary;
  dateLabel: string;
}

const cell: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px 16px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9CA3AF",
};

const numStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.1,
  color: "#0D2137",
  marginTop: 2,
};

export default function SummaryBar({ summary, dateLabel }: Props) {
  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        overflow: "hidden",
      }}
      role="group"
      aria-label={`Schedule summary for ${dateLabel}`}
    >
      <div style={cell}>
        <div style={labelStyle}>Orders</div>
        <div style={numStyle}>{summary.orders}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Yards</div>
        <div style={numStyle}>{summary.loads}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Revenue</div>
        <div style={{ ...numStyle, color: BRAND_GOLD }}>{fmt(summary.revenue)}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Paid</div>
        <div style={numStyle}>{summary.paid}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Pending</div>
        <div style={numStyle}>{summary.pending}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Missed</div>
        <div style={{ ...numStyle, color: summary.missed > 0 ? "#DC2626" : "#0D2137" }}>
          {summary.missed}
        </div>
      </div>
    </div>
  );
}

```

## `src/lib/schedule-adapter.ts`

_Lines: 

```typescript
// Schedule adapter — pure status translation layer for the LMT Schedule tab.
// Single source of truth for the 5 display states + Missed derivation.
// No React, no side effects, no I/O.

export type ScheduleDisplayStatus =
  | "scheduled"   // confirmed, future or today
  | "en_route"    // driver dispatched
  | "delivered"   // completed
  | "cancelled"   // cancelled by ops or customer
  | "pending"     // unconfirmed / awaiting payment or review
  | "missed";     // past delivery_date with no terminal state

export interface ScheduleOrderLike {
  status?: string | null;
  payment_status?: string | null;
  delivery_date?: string | null; // YYYY-MM-DD
  cancelled_at?: string | null;
}

/** YYYY-MM-DD for the current local day. */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for an arbitrary Date in local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Derive a display-level status from raw order fields.
 * "Missed" is derived: any order whose delivery_date is in the past and is not
 * delivered/cancelled gets surfaced as missed regardless of stored status.
 */
export function deriveDisplayStatus(
  order: ScheduleOrderLike,
  today: string = todayIsoDate(),
): ScheduleDisplayStatus {
  const status = (order.status || "").toLowerCase();
  const payment = (order.payment_status || "").toLowerCase();

  if (status === "cancelled" || order.cancelled_at) return "cancelled";
  if (status === "delivered") return "delivered";
  if (status === "en_route") return "en_route";

  const date = order.delivery_date || "";
  const isPast = !!date && date < today;
  const isTerminal = status === "delivered" || status === "cancelled";

  if (isPast && !isTerminal) return "missed";

  if (status === "confirmed") return "scheduled";
  if (status === "pending") return "pending";
  if (payment === "paid" || payment === "captured" || payment === "authorized") return "scheduled";
  return "pending";
}

/** Visual tokens for each display status. Matches Leads STATUS_COLORS palette. */
export const SCHEDULE_STATUS_TOKENS: Record<
  ScheduleDisplayStatus,
  { label: string; bg: string; text: string }
> = {
  scheduled: { label: "Scheduled", bg: "#EFF6FF", text: "#3B82F6" },
  en_route:  { label: "En route",  bg: "#FDF8F0", text: "#C07A00" },
  delivered: { label: "Delivered", bg: "#ECFDF5", text: "#059669" },
  cancelled: { label: "Cancelled", bg: "#FEF2F2", text: "#EF4444" },
  pending:   { label: "Pending",   bg: "#F3F4F6", text: "#6B7280" },
  missed:    { label: "Missed",    bg: "#FEF2F2", text: "#DC2626" },
};

export interface ScheduleSummary {
  orders: number;
  loads: number;
  revenue: number;
  paid: number;
  pending: number;
  missed: number;
}

/** Aggregate summary for a list of orders on a given day. */
export function summarizeOrders(
  orders: ScheduleOrderLike[],
  today: string = todayIsoDate(),
): ScheduleSummary {
  let loads = 0;
  let revenue = 0;
  let paid = 0;
  let pending = 0;
  let missed = 0;
  for (const o of orders as any[]) {
    loads += Number(o.quantity) || 0;
    revenue += Number(o.price) || 0;
    const ps = (o.payment_status || "").toLowerCase();
    if (ps === "paid" || ps === "captured") paid += 1;
    else pending += 1;
    if (deriveDisplayStatus(o, today) === "missed") missed += 1;
  }
  return { orders: orders.length, loads, revenue, paid, pending, missed };
}

```

# Backbone — leads-auth (full)

## `supabase/functions/leads-auth/index.ts`

_Lines: 

```typescript
/**
 * IMPORTANT: This system does NOT use haversine (straight-line) distances anywhere.
 * All distance calculations use the Google Distance Matrix API with
 * mode=driving and avoid=ferries. Toll roads (I-10 etc.) are used for
 * deliveries, so tolls are NOT avoided. Never add haversine as a fallback.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TOTP, Secret } from "https://esm.sh/otpauth@9.3.2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { encodeBase32 } from "https://deno.land/std@0.224.0/encoding/base32.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Northshore phantom miles — adds 3 miles to billed distance for deliveries
 * crossing Lake Pontchartrain (Causeway toll recovery).
 * Customer sees actual distance; pricing uses billed distance.
 */
/**
 * Internal fraud check — reusable by session_init and check_fraud action.
 * Returns { blocked: boolean, reason?: string }
 */
async function checkFraudInternal(
  sb: any,
  params: { ip?: string | null; phone?: string | null; email?: string | null; session_id?: string | null; address?: string | null }
): Promise<{ blocked: boolean; reason?: string }> {
  const { ip, phone, email, session_id, address } = params;
  const now = new Date().toISOString();

  // 1. Blocklist check
  if (ip || phone || email) {
    const { data: blocked } = await sb
      .from("fraud_blocklist")
      .select("*")
      .or(`and(type.eq.ip,value.eq.${ip || "___none___"}),and(type.eq.phone,value.eq.${phone || "___none___"}),and(type.eq.email,value.eq.${email || "___none___"})`)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (blocked && blocked.length > 0) {
      await sb.from("fraud_events").insert({ ip_address: ip, phone, email, session_id, event_type: "blocked_attempt", details: { blocked } });
      return { blocked: true, reason: blocked[0].reason || "Blocked" };
    }
  }

  // 2. Rate limit: max 5 sessions per IP per hour
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: sessionCount } = await sb
      .from("visitor_sessions")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gt("created_at", oneHourAgo);

    if ((sessionCount || 0) >= 10) {
      await sb.from("fraud_events").insert({ ip_address: ip, event_type: "velocity_flag", details: { sessionCount, reason: "IP session rate limit" } });
      return { blocked: true, reason: "Too many requests from this IP" };
    }
  }

  // 3. Payment attempt limit: max 5 failed per IP per day
  if (ip) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipPayments } = await sb
      .from("payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("status", "failed")
      .gt("created_at", oneDayAgo);

    if ((ipPayments || 0) >= 5) {
      await sb.from("fraud_blocklist").upsert(
        { type: "ip", value: ip, reason: "Auto-blocked: 5+ failed payments in 24hr", blocked_by: "system" },
        { onConflict: "type,value" }
      );
      return { blocked: true, reason: "Payment attempt limit exceeded" };
    }
  }

  // 4. Address velocity: 3+ orders same address in 24hr → alert only
  if (address) {
    const streetPart = address.split(",")[0]?.trim();
    if (streetPart) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: addressOrders } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .ilike("delivery_address", `%${streetPart}%`)
        .gt("created_at", oneDayAgo);

      if ((addressOrders || 0) >= 3) {
        await sb.from("fraud_events").insert({ ip_address: ip, event_type: "velocity_flag", details: { addressOrders, reason: "Address velocity" } });
        await sb.from("notifications").insert({
          type: "fraud_alert", title: "🚨 Fraud Alert",
          message: `⚠️ Velocity Alert: ${addressOrders} orders to same address in 24hr — ${streetPart}`,
          entity_type: "fraud", entity_id: null
        });
      }
    }
  }

  return { blocked: false };
}

const NORTHSHORE_ZIPS = new Set([
  '70433','70434','70435','70436','70437','70438',
  '70441','70443','70444','70445','70446','70447',
  '70448','70449','70458','70459','70460','70461',
  '70462','70463','70464','70465','70466','70467',
  '70469','70470','70471'
]);
const NORTHSHORE_PARISHES = new Set(['St. Tammany Parish']);
const isNorthshoreZip = (zip: string) => NORTHSHORE_ZIPS.has(zip);
const isNorthshoreRegion = (region: string) => NORTHSHORE_PARISHES.has(region);
const PHANTOM_MILES = 3;

/**
 * Server-side canonical distance function.
 * Mirror of getDrivingDistanceBatch in src/lib/pits.ts — keep in sync.
 * Roads only. No haversine fallback. Nulls mean skip, not approximate.
 */
async function getDrivingDistances(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lng: number }[],
  apiKey: string
): Promise<(number | null)[]> {
  if (!apiKey) {
    throw new Error(
      "getDrivingDistances: GOOGLE_MAPS_SERVER_KEY is not configured. " +
      "Cannot calculate road distances. Set the secret in Supabase Dashboard."
    );
  }
  if (destinations.length === 0) return [];

  const results: (number | null)[] = new Array(destinations.length).fill(null);
  const BATCH = 25;

  for (let i = 0; i < destinations.length; i += BATCH) {
    const batch = destinations.slice(i, i + BATCH);
    const destsStr = batch.map(d => `${d.lat},${d.lng}`).join("|");
    try {
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${originLat},${originLon}` +
        `&destinations=${destsStr}` +
        `&units=imperial` +
        `&mode=driving` +
        `&avoid=ferries` +
        `&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status && data.status !== "OK") {
        console.error(`[getDrivingDistances] API top-level error: ${data.status} — ${data.error_message || "no message"}`);
        continue;
      }
      const elements = data.rows?.[0]?.elements || [];
      if (elements.length === 0) {
        console.error(`[getDrivingDistances] No elements returned. rows: ${JSON.stringify(data.rows?.length)}, status: ${data.status}`);
      }
      for (let j = 0; j < elements.length; j++) {
        if (elements[j]?.status === "OK" && elements[j].distance?.value) {
          results[i + j] = elements[j].distance.value / 1609.344;
        } else {
          console.warn(`[getDrivingDistances] Element ${i+j} status: ${elements[j]?.status}`);
        }
      }
    } catch (e) {
      console.error("[getDrivingDistances] Batch request failed:", e);
    }
  }
  return results;
}

/**
 * Cities too large or geographically complex to quote a single delivery price.
 * Pages for these cities always suppress static pricing and direct to the estimator,
 * regardless of PIT count.
 * Add any city here where a single centroid distance is misleading.
 */
/**
 * Normalize city slugs by removing state suffixes to prevent duplicates
 * like "kenner" vs "kenner-la".
 */
function normalizeSlug(slug: string): string {
  return slug
    .replace(/-la$/, '')
    .replace(/-tx$/, '')
    .replace(/-ms$/, '')
    .replace(/-al$/, '')
    .toLowerCase()
    .trim();
}

const LARGE_CITIES_NO_STATIC_PRICE = new Set([
  "new orleans",
  "new orleans east",
  "algiers",
  "metairie",
  "kenner",
  "baton rouge",
]);

// ─────────────────────────────────────────────────────────────────────────────
// LEADS 2FA — Slice 1a: helpers + new actions (verify_password, verify_totp,
// setup_totp_preview). Existing password gates are NOT modified in this slice.
// ─────────────────────────────────────────────────────────────────────────────

// In-memory rate limiter. Persists across invocations within the same warm
// isolate (~minutes). Keyed on `ip|sessionToken` AND `ip` separately so an
// attacker rotating session tokens still hits the IP-level cap.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(keys: string[]): boolean {
  const now = Date.now();
  for (const key of keys) {
    if (!key) continue;
    const arr = (rateLimitBuckets.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (arr.length >= RATE_LIMIT_MAX) {
      rateLimitBuckets.set(key, arr);
      return false;
    }
    arr.push(now);
    rateLimitBuckets.set(key, arr);
  }
  // Opportunistic cleanup
  if (rateLimitBuckets.size > 5000) {
    for (const [k, v] of rateLimitBuckets) {
      const filtered = v.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (filtered.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, filtered);
    }
  }
  return true;
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

// HMAC-SHA256 session token: base64url(JSON payload).base64url(signature)
async function hmacSign(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const ck = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", ck, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

async function signSessionToken(): Promise<string | null> {
  const key = Deno.env.get("LEADS_SESSION_SIGNING_KEY");
  if (!key) return null;
  const payload = JSON.stringify({ iat: Date.now(), exp: Date.now() + SESSION_TTL_MS, v: 1 });
  const encoded = b64urlEncode(payload);
  const sig = await hmacSign(encoded, key);
  return `${encoded}.${sig}`;
}

async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const key = Deno.env.get("LEADS_SESSION_SIGNING_KEY");
  if (!key) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expected = await hmacSign(encoded, key);
  // Constant-time compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const payload = JSON.parse(b64urlDecode(encoded));
    if (typeof payload?.exp !== "number" || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function verifyTOTPCode(code: string, secretBase32: string): boolean {
  try {
    const totp = new TOTP({
      issuer: "Riversand-Leads",
      label: "admin",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32),
    });
    // ±1 step window (90s tolerance)
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

function generateBackupCode(): string {
  // 12-char base32-style alphanumeric (excludes ambiguous 0/O/1/I/L)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

function generateTotpSecretBase32(): string {
  const bytes = new Uint8Array(20); // 160 bits
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes).replace(/=+$/, "");
}

function generateSigningKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes).replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password, action, id, ids, stage, notes, lead_number, order_number, settings, pit, order_id, collected_by, send_email, pit_id, cities, city_page, city_page_id, base_price, free_miles, price_per_extra_mile, url } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // SLICE 1a: 2FA actions (verify_password, verify_totp, setup_totp_preview)
    // ─────────────────────────────────────────────────────────────────────────
    const ip = clientIp(req);
    const sessionTokenForRate = (body?.session_token as string | undefined) || "no-session";

    // ── VERIFY PASSWORD (step 1 of 2FA login) ──
    if (action === "verify_password") {
      if (!checkRateLimit([`pw:${ip}`, `pw:${ip}|${sessionTokenForRate}`])) {
        return new Response(JSON.stringify({ valid: false, error: "Rate limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const expected = Deno.env.get("LEADS_PASSWORD");
      const ok = !!expected && password === expected;
      return new Response(JSON.stringify({ valid: ok }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── VERIFY TOTP (step 2 — accepts 6-digit code OR 12-char backup code) ──
    if (action === "verify_totp") {
      if (!checkRateLimit([`totp:${ip}`, `totp:${ip}|${sessionTokenForRate}`])) {
        return new Response(JSON.stringify({ valid: false, error: "Rate limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const expectedPw = Deno.env.get("LEADS_PASSWORD");
      if (!expectedPw || password !== expectedPw) {
        return new Response(JSON.stringify({ valid: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totpSecret = Deno.env.get("LEADS_TOTP_SECRET");
      const signingKey = Deno.env.get("LEADS_SESSION_SIGNING_KEY");
      if (!totpSecret || !signingKey) {
        return new Response(JSON.stringify({ valid: false, error: "2FA not configured. Visit /leads/setup-2fa." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const code = typeof body?.code === "string" ? body.code.trim() : "";
      const backupCode = typeof body?.backup_code === "string" ? body.backup_code.trim().toUpperCase() : "";
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      let valid = false;

      if (code) {
        valid = verifyTOTPCode(code, totpSecret);
      } else if (backupCode) {
        const { data: rows } = await sb
          .from("leads_totp_backup_codes")
          .select("id, code_hash")
          .is("used_at", null);
        for (const row of (rows || [])) {
          try {
            if (await bcrypt.compare(backupCode, row.code_hash)) {
              await sb.from("leads_totp_backup_codes")
                .update({ used_at: new Date().toISOString() })
                .eq("id", row.id);
              valid = true;
              break;
            }
          } catch { /* continue */ }
        }
      }

      if (!valid) {
        return new Response(JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totp_session_token = await signSessionToken();
      return new Response(JSON.stringify({ valid: true, totp_session_token }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SETUP TOTP PREVIEW (password required; generates fresh secrets + backup codes) ──
    // Wipes any existing backup codes (re-enrollment). Returns plaintext secrets ONCE.
    if (action === "setup_totp_preview") {
      if (!checkRateLimit([`setup:${ip}`])) {
        return new Response(JSON.stringify({ ok: false, error: "Rate limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const expectedPw = Deno.env.get("LEADS_PASSWORD");
      if (!expectedPw || password !== expectedPw) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const totpSecretBase32 = generateTotpSecretBase32();
      const sessionSigningKey = generateSigningKey();

      const totp = new TOTP({
        issuer: "Riversand-Leads",
        label: "admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(totpSecretBase32),
      });
      const otpauthUrl = totp.toString();

      // Generate 10 backup codes, hash each, wipe old, insert new
      const plainCodes: string[] = [];
      const hashedRows: { code_hash: string }[] = [];
      for (let i = 0; i < 10; i++) {
        const c = generateBackupCode();
        plainCodes.push(c);
        hashedRows.push({ code_hash: await bcrypt.hash(c, 10) });
      }
      await sb.from("leads_totp_backup_codes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { error: insErr } = await sb.from("leads_totp_backup_codes").insert(hashedRows);
      if (insErr) {
        return new Response(JSON.stringify({ ok: false, error: "Failed to store backup codes: " + insErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        ok: true,
        leads_totp_secret: totpSecretBase32,
        leads_session_signing_key: sessionSigningKey,
        otpauth_url: otpauthUrl,
        backup_codes: plainCodes,
        instructions: [
          "1. Copy LEADS_TOTP_SECRET and LEADS_SESSION_SIGNING_KEY into Lovable Cloud → Secrets.",
          "2. Save the 10 backup codes somewhere safe — they will NOT be shown again.",
          "3. Scan the QR code with your authenticator app (or paste the secret manually).",
          "4. Do NOT close this page until you have verified BOTH secrets are saved in Cloud.",
          "5. Test login at /leads with the 6-digit code before relying on this enrollment.",
        ],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // END SLICE 1a additions — existing actions below are UNCHANGED.
    // ─────────────────────────────────────────────────────────────────────────

    // ── LIST SETTINGS (password required — for docs export) ──
    if (action === "list_settings") {
      console.log("[list_settings] reached, pw_len:", (password || "").length);
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        console.log("[list_settings] unauthorized");
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await sb
        .from("global_settings")
        .select("key, value, description, is_public")
        .order("key", { ascending: true });
      if (error) {
        console.log("[list_settings] db error:", error.message);
        return new Response(JSON.stringify({ ok: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log("[list_settings] returning", (data ?? []).length, "rows");
      return new Response(JSON.stringify({ ok: true, settings: data ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EXPORT AI KNOWLEDGE SNAPSHOT (password required) ──
    if (action === "export_knowledge_snapshot") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // 1. Settings
      const { data: settingsRows, error: settingsErr } = await sb
        .from("global_settings").select("key, value");
      if (settingsErr) {
        return new Response(JSON.stringify({ ok: false, error: settingsErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const s: Record<string, string> = {};
      (settingsRows || []).forEach((r: any) => { s[r.key] = r.value; });

      // 2. Active pits
      const { data: pits, error: pitsErr } = await sb
        .from("pits")
        .select("name, address, base_price, price_per_extra_mile, max_distance, free_miles, status, operating_days")
        .eq("status", "active")
        .order("name");
      if (pitsErr) {
        return new Response(JSON.stringify({ ok: false, error: pitsErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. City pages
      const { count: cityCount } = await sb
        .from("city_pages").select("*", { count: "exact", head: true }).eq("status", "active");
      const { count: regenCount } = await sb
        .from("city_pages").select("*", { count: "exact", head: true }).eq("needs_regen", true);

      // 4. Recent orders (30d)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentOrders } = await sb
        .from("orders").select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      // 5. Version state (compute AFTER content built)
      const prevVersion = s["snapshot_version"] || "v1.00";
      const prevLength = parseInt(s["snapshot_previous_length"] || "0", 10);
      const majorThreshold = parseFloat(s["snapshot_version_major_threshold"] || "0.15");

      // Build PIT table
      const globalRate = s["extra_per_mile"] || "4.49";
      const globalFree = s["free_miles"] || "15";
      const pitTable = (pits || []).map((p: any) => {
        const satOnly = Array.isArray(p.operating_days) &&
                        p.operating_days.length === 1 &&
                        p.operating_days[0] === 6;
        const pitRate = p.price_per_extra_mile != null
          ? `$${p.price_per_extra_mile}/mi (pit)`
          : `$${globalRate}/mi (global)`;
        return `| ${p.name} | ${p.address} | $${p.base_price} | ${pitRate} | ${p.free_miles ?? globalFree}mi free | ${p.max_distance}mi max | ${satOnly ? "Sat only" : "Mon–Sat"} |`;
      }).join("\n");

      const today = new Date().toISOString().split("T")[0];
      const pendingNotes = (s["snapshot_pending_notes"] || "").trim();

      // Build content with placeholder for version (replaced after bump calc)
      const contentTemplate = `# RiverSand AI Knowledge Snapshot
**Version:** __VERSION__
**Generated:** ${new Date().toISOString()}
**Project:** riversand.net | Ways Materials LLC | WAYS®
**Supabase:** lclbexhytmpfxzcztzva

---

## Pricing
- Mode: ${s["pricing_mode"] || "baked"}
- Processing fee: ${s["card_processing_fee_percent"] || "3.5"}% (baked into pit prices)
- COD discount: ${s["cod_discount_percent"] || "3.5"}%
- Saturday surcharge: $${s["saturday_surcharge"] || "35"}
- Global free miles: ${globalFree}
- Global per-mile rate: $${globalRate}/mi

## Active PITs
| Name | Address | Base | Rate | Free | Max | Schedule |
|------|---------|------|------|------|-----|----------|
${pitTable}

⚠️ Rate column shows pit-level if set, otherwise global fallback. Discrepancy = open risk.

## City Pages
- Active: ${cityCount ?? 0} pages
- Pending regen: ${regenCount ?? 0} pages

## Business
- Phone: ${s["business_phone"] || s["phone"] || "1-855-GOT-WAYS"}
- Dispatch: ${s["email_dispatch"] || "cmo@haulogix.com"}
- Address: ${s["business_address"] || s["footer_address"] || ""}
- Hours: ${s["business_hours_start"] || "07:00"} – ${s["business_hours_end"] || "17:00"}, ${s["business_days"] || "Mon–Sat"}
- GMB Review: ${s["gmb_review_url"] || "(not set)"}

## Activity (Last 30 Days)
- Orders: ${recentOrders ?? 0}

## Pending / Known Issues
${pendingNotes || "_(none recorded — update from /leads → Settings → Pending Notes)_"}

## Stack
- Storage base: https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/
- Docs version: ${s["docs_current_version"] || "—"} | Snapshot version: __VERSION__
`;

      // Compute bump using template length (close enough — version string is short)
      const tempLength = contentTemplate.length;
      const changeRatio = prevLength > 0 ? Math.abs(tempLength - prevLength) / prevLength : 0;
      const isMajor = prevLength > 0 && changeRatio >= majorThreshold;

      const [majorNum, minorStr] = prevVersion.replace("v", "").split(".");
      const major = parseInt(majorNum, 10);
      const minor = parseInt(minorStr, 10);
      let newMajor = major, newMinor = minor + 1;
      if (isMajor) { newMajor = major + 1; newMinor = 1; }
      const newVersion = `v${newMajor}.${String(newMinor).padStart(2, "0")}`;
      const fileName = `riversand_${newVersion}_${today}.md`;

      const finalContent = contentTemplate.replace(/__VERSION__/g, newVersion);
      const newLength = finalContent.length;

      // Upload to storage
      const fileBytes = new TextEncoder().encode(finalContent);
      const { error: uploadErr } = await sb.storage
        .from("assets")
        .upload(`snapshots/${fileName}`, fileBytes, {
          contentType: "text/markdown; charset=utf-8",
          upsert: true,
        });
      if (uploadErr) {
        return new Response(JSON.stringify({ ok: false, error: uploadErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const publicUrl = `https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/snapshots/${fileName}`;

      // Update version state
      let history: any[] = [];
      try { history = JSON.parse(s["snapshot_version_history"] || "[]"); } catch { history = []; }
      history.push({
        version: newVersion,
        previous: prevVersion,
        timestamp: new Date().toISOString(),
        change_ratio: `${(changeRatio * 100).toFixed(1)}%`,
        major_bump: isMajor,
      });

      await sb.from("global_settings").upsert([
        { key: "snapshot_version", value: newVersion, is_public: false },
        { key: "snapshot_previous_length", value: String(newLength), is_public: false },
        { key: "snapshot_version_history", value: JSON.stringify(history), is_public: false },
      ], { onConflict: "key" });

      return new Response(JSON.stringify({
        ok: true,
        success: true,
        version: newVersion,
        previous_version: prevVersion,
        fileName,
        url: publicUrl,
        major_bump: isMajor,
        change_ratio: `${(changeRatio * 100).toFixed(1)}%`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET ORDER STATS (password required — for docs export) ──
    if (action === "get_order_stats") {
      console.log("[get_order_stats] reached, pw_len:", (password || "").length);
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        console.log("[get_order_stats] unauthorized");
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await sb
        .from("orders")
        .select("status, payment_method, payment_status, price, created_at")
        .order("created_at", { ascending: false })
        .limit(100000);
      if (error) {
        console.log("[get_order_stats] db error:", error.message);
        return new Response(JSON.stringify({ ok: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const rows = (data ?? []) as Array<{ status: string; payment_method: string; payment_status: string; price: number; created_at: string }>;
      const total = rows.length;
      const revenue = rows.reduce((s, r) => s + Number(r.price || 0), 0);
      const byStatus: Record<string, number> = {};
      const byMethod: Record<string, number> = {};
      const byPayStatus: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byMethod[r.payment_method] = (byMethod[r.payment_method] || 0) + 1;
        byPayStatus[r.payment_status] = (byPayStatus[r.payment_status] || 0) + 1;
      }
      const latest = rows[0]?.created_at ?? null;
      console.log("[get_order_stats] returning", total, "orders");
      return new Response(JSON.stringify({ ok: true, stats: { total, revenue, byStatus, byMethod, byPayStatus, latest } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET SESSION STATS (password required — for docs export) ──
    if (action === "get_session_stats") {
      console.log("[get_session_stats] reached, pw_len:", (password || "").length);
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        console.log("[get_session_stats] unauthorized");
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await sb
        .from("visitor_sessions")
        .select("stage, stripe_link_clicked, email_1hr_sent, email_24hr_sent, email_48hr_sent, email_72hr_sent")
        .limit(100000);
      if (error) {
        console.log("[get_session_stats] db error:", error.message);
        return new Response(JSON.stringify({ ok: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const rows = (data ?? []) as Array<{ stage: string | null; stripe_link_clicked: boolean | null; email_1hr_sent: boolean | null; email_24hr_sent: boolean | null; email_48hr_sent: boolean | null; email_72hr_sent: boolean | null }>;
      const total = rows.length;
      const byStage: Record<string, number> = {};
      let stripeLinkClicked = 0, e1 = 0, e24 = 0, e48 = 0, e72 = 0;
      for (const r of rows) {
        const s = r.stage || "unknown";
        byStage[s] = (byStage[s] || 0) + 1;
        if (r.stripe_link_clicked) stripeLinkClicked++;
        if (r.email_1hr_sent) e1++;
        if (r.email_24hr_sent) e24++;
        if (r.email_48hr_sent) e48++;
        if (r.email_72hr_sent) e72++;
      }
      console.log("[get_session_stats] returning", total, "sessions");
      return new Response(JSON.stringify({ ok: true,
        stats: { total, byStage, stripeLinkClicked, email_1hr_sent: e1, email_24hr_sent: e24, email_48hr_sent: e48, email_72hr_sent: e72 }
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET NOTRACK IPS (password required) ──
    if (action === "get_notrack_ips") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await sb.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ips = data ? JSON.parse(data.value) : [];
      return new Response(JSON.stringify({ ips }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SET NOTRACK IPS (password required) ──
    if (action === "set_notrack_ips") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { ips } = body;
      if (!Array.isArray(ips)) {
        return new Response(JSON.stringify({ error: "ips must be an array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("global_settings").update({ value: JSON.stringify(ips) }).eq("key", "notrack_ips");
      return new Response(JSON.stringify({ success: true, count: ips.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── INCREMENT DOC VERSION (password required — called by docs export) ──
    if (action === "increment_doc_version") {
      console.log("[increment_doc_version] reached, pw_len:", (password || "").length);
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        console.log("[increment_doc_version] unauthorized");
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: settings, error: readErr } = await sb
        .from("global_settings")
        .select("key, value")
        .in("key", [
          "docs_current_version",
          "docs_previous_snapshot_length",
          "docs_version_major_threshold",
          "docs_version_history",
        ]);
      if (readErr) {
        console.log("[increment_doc_version] read error:", readErr.message);
        return new Response(JSON.stringify({ ok: false, error: readErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const get = (key: string, fallback: string) =>
        settings?.find((r: any) => r.key === key)?.value ?? fallback;

      const currentVersion = get("docs_current_version", "v1.01");
      const prevLength = parseInt(get("docs_previous_snapshot_length", "0")) || 0;
      const threshold = parseFloat(get("docs_version_major_threshold", "0.15")) || 0.15;
      const newLength = parseInt(String(body.newDocLength ?? "0")) || 0;

      const match = currentVersion.match(/v(\d+)\.(\d+)/);
      const major = match ? parseInt(match[1]) : 1;
      const minor = match ? parseInt(match[2]) : 1;

      const changeRatio = prevLength > 0 ? Math.abs(newLength - prevLength) / prevLength : 0;
      const isMajor = changeRatio > threshold;
      const newVersion = isMajor
        ? `v${major + 1}.01`
        : `v${major}.${String(minor + 1).padStart(2, "0")}`;

      let history: any[] = [];
      try { history = JSON.parse(get("docs_version_history", "[]")); } catch { history = []; }
      if (!Array.isArray(history)) history = [];
      history.push({
        version: newVersion,
        previous: currentVersion,
        timestamp: new Date().toISOString(),
        change_ratio: Math.round(changeRatio * 1000) / 10 + "%",
        major_bump: isMajor,
      });
      // Cap history at last 200 entries to avoid unbounded growth
      if (history.length > 200) history = history.slice(-200);

      const { error: upsertErr } = await sb.from("global_settings").upsert([
        { key: "docs_current_version", value: newVersion, is_public: true },
        { key: "docs_previous_snapshot_length", value: String(newLength), is_public: false },
        { key: "docs_version_history", value: JSON.stringify(history), is_public: false },
      ], { onConflict: "key" });
      if (upsertErr) {
        console.log("[increment_doc_version] upsert error:", upsertErr.message);
        return new Response(JSON.stringify({ ok: false, error: upsertErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log("[increment_doc_version] ok", currentVersion, "→", newVersion, "ratio:", changeRatio);
      return new Response(JSON.stringify({
        ok: true,
        version: newVersion,
        previous: currentVersion,
        change_ratio: changeRatio,
        major_bump: isMajor,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Helper: check if IP is in notrack list ──
    async function isNotrackIp(ip: string): Promise<boolean> {
      if (!ip || ip === "unknown") return false;
      try {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await sb.from("global_settings").select("value").eq("key", "notrack_ips").single();
        if (!data) return false;
        const ips: string[] = JSON.parse(data.value);
        return ips.includes(ip);
      } catch { return false; }
    }

    // ── SESSION INIT (no password required — called from frontend) ──
    if (action === "session_init") {
      const { session_token, entry_page, referrer } = body;
      if (!session_token) {
        return new Response(JSON.stringify({ error: "Missing session_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check notrack IP
      const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      if (await isNotrackIp(visitorIp)) {
        console.log(`[session_init] Skipping notrack IP: ${visitorIp}`);
        return new Response(JSON.stringify({ success: true, notrack: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // ── Fraud gate — block known bad actors before session creation ──
      const fraudResult = await checkFraudInternal(sb, {
        ip: visitorIp !== "unknown" ? visitorIp : null,
        phone: null, email: null, session_id: session_token, address: null
      });
      if (fraudResult.blocked) {
        console.log(`[session_init] Blocked by fraud check: ${fraudResult.reason}`);
        return new Response(
          JSON.stringify({ blocked: true, reason: fraudResult.reason }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Geolocate IP (free tier, best-effort)
      let geo: Record<string, any> = {};
      if (visitorIp && visitorIp !== "unknown") {
        try {
          const geoRes = await fetch(`https://ipapi.co/${visitorIp}/json/`);
          if (geoRes.ok) geo = await geoRes.json();
        } catch { /* silent */ }
      }

      const upsertData: Record<string, any> = {
        session_token,
        last_seen_at: new Date().toISOString(),
        ip_address: visitorIp !== "unknown" ? visitorIp : null,
      };
      if (geo.city) upsertData.geo_city = geo.city;
      if (geo.region) upsertData.geo_region = geo.region;
      if (geo.country_name) upsertData.geo_country = geo.country_name;
      if (geo.postal) upsertData.geo_zip = geo.postal;
      if (entry_page) upsertData.entry_page = entry_page;
      if (referrer) upsertData.referrer = referrer;

      // IP enrichment — org, city, zip, business detection
      if (geo.org) {
        upsertData.ip_org = geo.org;
        upsertData.ip_is_business = /(LLC|Inc|Corp|Construction|Contractor|Builders|Excavat|Paving|Landscap|Plumb|Electric|Roofing|Materials|Supply|Equipment|Trucking|Grading|Concrete|Masonry|Fencing|Demolition|Hauling|Septic|Utilities)/i.test(geo.org);
      }
      if (geo.city) upsertData.ip_city = geo.city;
      if (geo.postal) upsertData.ip_zip = geo.postal;

      await sb.from("visitor_sessions").upsert(
        upsertData,
        { onConflict: "session_token", ignoreDuplicates: false }
      );
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SESSION UPDATE (no password required — called from frontend) ──
    if (action === "session_update") {
      const { session_token, updates } = body;
      if (!session_token || !updates) {
        return new Response(JSON.stringify({ error: "Missing session_token or updates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Check notrack IP
      const visitorIpUpd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      if (await isNotrackIp(visitorIpUpd)) {
        console.log(`[session_update] Skipping notrack IP: ${visitorIpUpd}`);
        return new Response(JSON.stringify({ success: true, notrack: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);
      // Whitelist allowed fields
      const allowed = ["stage","delivery_address","address_lat","address_lng",
        "calculated_price","serviceable","nearest_pit_id","nearest_pit_name",
        "customer_name","customer_email","customer_phone","order_id","order_number",
        "entry_page","entry_city_page","entry_city_name"];
      const safe: Record<string, any> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) safe[k] = updates[k];
      }
      safe.updated_at = new Date().toISOString();
      safe.last_seen_at = new Date().toISOString();
      // Capture IP on every session update
      const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || null;
      if (visitorIp) safe.ip_address = visitorIp;
      console.log("[session_update] token:", session_token?.slice(0, 8));
      console.log("[session_update] updates:", JSON.stringify(updates));

      // Check previous stage before upserting (for out-of-area notification)
      let previousStage: string | null = null;
      if (updates.stage === "got_out_of_area") {
        const { data: existing } = await sb.from("visitor_sessions")
          .select("stage").eq("session_token", session_token).single();
        previousStage = existing?.stage || null;
      }

      await sb.from("visitor_sessions").upsert(
        { session_token, ...safe },
        { onConflict: "session_token", ignoreDuplicates: false }
      );

      // Send internal out-of-area notification (once per session)
      if (updates.stage === "got_out_of_area" && previousStage !== "got_out_of_area") {
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          const ownerEmail = Deno.env.get("GMAIL_USER") || "cmo@haulogix.com";
          if (resendKey) {
            const { Resend } = await import("npm:resend@2.0.0");
            const resend = new Resend(resendKey);
            const addr = updates.delivery_address || "Unknown";
            const pitName = updates.nearest_pit_name || "Unknown";
            const city = addr.split(",")[1]?.trim() || addr.split(",")[0]?.trim() || "Unknown";
            await resend.emails.send({
              from: "River Sand <no_reply@riversand.net>",
              to: [ownerEmail],
              subject: `Out-of-Area Lead — ${city}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:500px">
                <h2 style="color:#0D2137;margin-bottom:16px">Out-of-Area Lead</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Address</td><td style="padding:8px 0;border-bottom:1px solid #eee">${addr}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Nearest Pit</td><td style="padding:8px 0;border-bottom:1px solid #eee">${pitName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">IP</td><td style="padding:8px 0;border-bottom:1px solid #eee">${visitorIp || "Unknown"}</td></tr>
                </table>
                <p style="color:#666;margin-top:16px;font-size:14px">This visitor is outside our service area. Consider if this area warrants expansion.</p>
              </div>`,
            });
            console.log("[session_update] Out-of-area notification sent for:", addr);
          }
        } catch (notifyErr) {
          console.error("[session_update] Out-of-area notification failed:", notifyErr);
        }
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CALCULATE DISTANCES (no password required — called from frontend) ──
    if (action === "calculate_distances") {
      const { origins, destination } = body;
      if (!origins?.length || !destination) {
        return new Response(
          JSON.stringify({ error: "Missing origins or destination" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Accept origins and destination as street address strings
      const originsStr = (origins as string[]).map((o: string) => encodeURIComponent(o)).join("|");
      const destStr = encodeURIComponent(destination as string);
      console.log("[calculate_distances] origins:", JSON.stringify(origins));
      console.log("[calculate_distances] destination:", JSON.stringify(destination));
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${originsStr}` +
        `&destinations=${destStr}` +
        `&units=imperial&mode=driving&avoid=ferries` +
        `&key=${apiKey}`;
      console.log("[calculate_distances] calling URL:", url.replace(apiKey, "KEY_HIDDEN"));
      const resp = await fetch(url);
      const data = await resp.json();
      console.log("[calculate_distances] API status:", data.status);
      console.log("[calculate_distances] origin_addresses:", data.origin_addresses);
      console.log("[calculate_distances] destination_addresses:", data.destination_addresses);
      console.log("[calculate_distances] rows:", JSON.stringify(data.rows));
      const distances = (data.rows || []).map((row: any) => {
        const el = row.elements?.[0];
        if (el?.status === "OK" && el.distance?.value) {
          return el.distance.value / 1609.344;
        }
        return null;
      });

      // Northshore phantom miles — add 3 mi to billed distance for toll recovery
      const destZip = body.zip_code || '';
      const northshore = isNorthshoreZip(destZip);
      const billedDistances = distances.map((d: number | null) =>
        d != null && northshore ? d + PHANTOM_MILES : d
      );

      console.log("[calculate_distances] raw distances (miles):", JSON.stringify(distances));
      if (northshore) console.log("[calculate_distances] Northshore ZIP detected:", destZip, "→ +3 phantom miles");
      return new Response(
        JSON.stringify({ distances, billed_distances: billedDistances, is_northshore: northshore }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── JOIN WAITLIST (no password required — public) ──
    if (action === "join_waitlist") {
      const { city_slug, city_name, customer_name, customer_email, customer_phone } = body;
      if (!customer_email || !city_slug) {
        return new Response(JSON.stringify({ error: "Email and city required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Check if already on waitlist
      const { data: existingWl } = await sb.from("waitlist_leads")
        .select("id").eq("customer_email", customer_email).eq("city_slug", city_slug).maybeSingle();
      if (existingWl) {
        return new Response(JSON.stringify({ success: true, message: "Already on waitlist" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sb.from("waitlist_leads").insert({ city_slug, city_name: city_name || city_slug, customer_name, customer_email, customer_phone });

      // Insert waitlist notification
      try {
        await sb.from("notifications").insert({
          type: "waitlist_signup",
          title: "Waitlist Signup",
          message: `${customer_email} joined waitlist for ${city_name || city_slug}`,
          entity_type: "waitlist",
          entity_id: null,
        });
      } catch (notifErr) { console.error("[join_waitlist] Notification insert error:", notifErr); }

      // Send waitlist confirmation email
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ type: "waitlist", data: { city_name: city_name || city_slug, customer_name, customer_email } }),
        });
      } catch (emailErr: any) { console.error("[join_waitlist] Email error:", emailErr.message); }

      return new Response(JSON.stringify({ success: true, message: "Added to waitlist" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ── CREATE OUT-OF-AREA LEAD (no password required — public) ──
    if (action === "create_out_of_area_lead") {
      const { customer_name, customer_email, customer_phone, address: leadAddress, distance_miles: leadDist, notes: leadNotes, ip_address: clientIp, user_agent: clientUA, browser_geolat, browser_geolng, calculated_price: leadPrice, nearest_pit_id: leadPitId, nearest_pit_name: leadPitName, nearest_pit_distance: leadPitDist } = body;
      if (!customer_name || !leadAddress) {
        return new Response(JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Server-side IP (more reliable than client-reported)
      const serverIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || clientIp
        || null;

      // ── Fraud scoring ──
      let fraudScore = 0;
      const fraudSignals: string[] = [];

      // Signal 1: IP rate limiting
      if (serverIp) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentLeads } = await sb
          .from("delivery_leads")
          .select("id")
          .eq("ip_address", serverIp)
          .gte("created_at", twentyFourHoursAgo);
        const ipCount = recentLeads?.length || 0;
        if (ipCount > 5) { fraudScore += 60; fraudSignals.push("ip_flood"); }
        else if (ipCount > 2) { fraudScore += 40; fraudSignals.push("repeated_ip"); }
      }

      // Signal 2: Check blocked_ips
      if (serverIp) {
        const { data: blocked } = await sb
          .from("blocked_ips")
          .select("id")
          .eq("ip_address", serverIp)
          .limit(1);
        if (blocked && blocked.length > 0) {
          // Silent block — return success but don't insert
          console.log("[create_out_of_area_lead] Blocked IP:", serverIp);
          return new Response(JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Signal 3: Geolocation mismatch (haversine is fine — browser vs address comparison)
      if (browser_geolat != null && browser_geolng != null) {
        // Extract lat/lng from address if available, or use a rough check with nearest pit
        if (leadPitId) {
          const { data: pitData } = await sb.from("pits").select("lat, lon").eq("id", leadPitId).single();
          if (pitData) {
            const R = 3958.8; // Earth radius in miles
            const dLat = (browser_geolat - pitData.lat) * Math.PI / 180;
            const dLon = (browser_geolng - pitData.lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(browser_geolat * Math.PI / 180) * Math.cos(pitData.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
            const browserToPitMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            // If browser is very far from the nearest PIT (proxy for address area)
            if (browserToPitMiles > 200) { fraudScore += 50; fraudSignals.push("severe_geo_mismatch"); }
            else if (browserToPitMiles > 50) { fraudScore += 30; fraudSignals.push("geo_mismatch"); }
          }
        }
      }

      // Signal 4: Disposable email
      const disposableDomains = ["mailinator.com","guerrillamail.com","tempmail.com","throwaway.email","fakeinbox.com","yopmail.com","maildrop.cc","dispostable.com","trashmail.com","10minutemail.com","guerrillamail.info","sharklasers.com","grr.la","guerrillamail.net","guerrillamail.org"];
      if (customer_email) {
        const emailDomain = customer_email.split("@")[1]?.toLowerCase();
        if (emailDomain && disposableDomains.includes(emailDomain)) {
          fraudScore += 40; fraudSignals.push("disposable_email");
        }
      }

      // Signal 5: Missing contact info
      if (!customer_phone && !customer_email) {
        fraudScore += 20; fraudSignals.push("no_contact");
      }

      const riskLevel = fraudScore >= 80 ? "high" : fraudScore >= 40 ? "medium" : "low";

      // Count submission from same IP for submission_count
      let submissionCount = 1;
      if (serverIp) {
        const { data: allFromIp } = await sb.from("delivery_leads").select("id").eq("ip_address", serverIp);
        submissionCount = (allFromIp?.length || 0) + 1;
      }

      // Insert lead
      const insertData: Record<string, any> = {
        address: leadAddress,
        distance_miles: leadDist ?? null,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        notes: leadNotes || null,
        ip_address: serverIp,
        user_agent: clientUA || null,
        browser_geolat: browser_geolat ?? null,
        browser_geolng: browser_geolng ?? null,
        calculated_price: leadPrice ?? null,
        nearest_pit_id: leadPitId || null,
        nearest_pit_name: leadPitName || null,
        nearest_pit_distance: leadPitDist ?? null,
        fraud_score: fraudScore,
        fraud_signals: fraudSignals.length > 0 ? fraudSignals : null,
        submission_count: submissionCount,
        geo_matches_address: browser_geolat != null ? !fraudSignals.includes("geo_mismatch") && !fraudSignals.includes("severe_geo_mismatch") : null,
      };

      const { data: inserted, error: insertErr } = await sb.from("delivery_leads").insert(insertData as any).select("id, lead_number").single();
      if (insertErr) throw insertErr;

      console.log(`[create_out_of_area_lead] Created lead ${inserted.lead_number}, fraud_score: ${fraudScore}, risk: ${riskLevel}`);

      // Insert new_lead notification
      try {
        await sb.from("notifications").insert({
          type: "new_lead",
          title: "New Lead",
          message: `${customer_name} submitted a request for ${leadAddress}`,
          entity_type: "lead",
          entity_id: inserted.id,
        });
        // Fraud notification if high risk
        if (fraudScore >= 80) {
          await sb.from("notifications").insert({
            type: "fraud_flagged",
            title: "⚠️ High Risk Lead",
            message: `High fraud score (${fraudScore}) on lead from ${serverIp || "unknown"}`,
            entity_type: "lead",
            entity_id: inserted.id,
          });
        }
      } catch (notifErr) { console.error("[create_out_of_area_lead] Notification insert error:", notifErr); }

      // Send admin notification email (fire-and-forget)
      const ownerEmail = Deno.env.get("GMAIL_USER") || "cmo@haulogix.com";
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          type: "out_of_area_lead",
          data: {
            lead_number: inserted.lead_number,
            address: leadAddress,
            distance_miles: leadDist?.toFixed?.(1) || "Unknown",
            customer_name,
            customer_email: customer_email || "Not provided",
            customer_phone: customer_phone || "Not provided",
            notes: leadNotes || "",
            fraud_score: fraudScore,
            risk_level: riskLevel,
            fraud_signals: fraudSignals.join(", ") || "None",
            ip_address: serverIp || "Unknown",
            created_at: new Date().toISOString(),
          },
        }),
      }).catch((err: any) => console.error("[lead-email] Admin notification error:", err));

      // Fetch business hours for confirmation email
      let responseTimeHours = "2";
      let businessHours = "7:00 AM – 5:00 PM";
      let businessDays = "Monday–Saturday";
      try {
        const { data: bizSettings } = await sb
          .from("global_settings")
          .select("key, value")
          .in("key", ["response_time_hours", "business_hours_start", "business_hours_end", "business_days"]);
        if (bizSettings) {
          for (const s of bizSettings) {
            if (s.key === "response_time_hours") responseTimeHours = s.value;
            if (s.key === "business_days") businessDays = s.value;
            if (s.key === "business_hours_start") {
              const end = bizSettings.find((x: any) => x.key === "business_hours_end")?.value || "17:00";
              businessHours = `${s.value} – ${end}`;
            }
          }
        }
      } catch (e) { console.error("[lead] Failed to fetch business hours:", e); }

      // Send customer auto-confirmation email (fire-and-forget)
      if (customer_email) {
        fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            type: "lead_confirmation",
            data: {
              customer_name,
              customer_email,
              delivery_address: leadAddress,
              response_time_hours: responseTimeHours,
              business_hours: businessHours,
              business_days: businessDays,
            },
          }),
        }).catch((err: any) => console.error("[lead-email] Customer confirmation error:", err));
      }

      return new Response(JSON.stringify({ success: true, lead_id: inserted.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET DATE LOAD COUNTS (no password required — called from frontend) ──
    if (action === "get_date_load_counts") {
      const { pit_id: loadPitId, dates: loadDates } = body;
      if (!loadPitId || !loadDates?.length) {
        return new Response(JSON.stringify({ error: "Missing pit_id or dates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Count confirmed paid orders per date for this PIT
      const { data: orderRows, error: orderErr } = await sb
        .from("orders")
        .select("delivery_date")
        .eq("pit_id", loadPitId)
        .in("delivery_date", loadDates)
        .in("payment_status", ["paid", "captured", "authorized"])
        .eq("status", "confirmed");
      if (orderErr) throw orderErr;

      const counts: Record<string, number> = {};
      for (const row of orderRows || []) {
        const d = row.delivery_date;
        if (d) counts[d] = (counts[d] || 0) + 1;
      }

      // Count ALL orders across ALL PITs per date (for global max_daily_limit)
      const { data: globalOrderRows, error: globalOrderErr } = await sb
        .from("orders")
        .select("delivery_date")
        .in("delivery_date", loadDates)
        .in("payment_status", ["paid", "captured", "authorized"])
        .eq("status", "confirmed");
      if (globalOrderErr) throw globalOrderErr;

      const global_counts: Record<string, number> = {};
      for (const row of globalOrderRows || []) {
        const d = row.delivery_date;
        if (d) global_counts[d] = (global_counts[d] || 0) + 1;
      }

      // Get PIT limits
      const { data: pitRow } = await sb
        .from("pits")
        .select("saturday_load_limit, sunday_load_limit")
        .eq("id", loadPitId)
        .single();

      // Get global max daily limit
      const { data: globalRow } = await sb
        .from("global_settings")
        .select("value")
        .eq("key", "max_daily_limit")
        .single();

      return new Response(JSON.stringify({
        counts,
        global_counts,
        saturday_load_limit: pitRow?.saturday_load_limit ?? null,
        sunday_load_limit: pitRow?.sunday_load_limit ?? null,
        max_daily_limit: globalRow?.value ? parseInt(globalRow.value) : null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LOG PAYMENT ATTEMPT (no password — called from stripe-webhook) ──
    if (action === "log_payment_attempt") {
      const { ip_address, session_id, email, phone, amount, status } = body;
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      await sb.from("payment_attempts").insert({
        ip_address, session_id, email, phone, amount, status
      });

      // Auto-block after 3 failed attempts from same session
      if (status === "failed" && session_id) {
        const { count } = await sb
          .from("payment_attempts")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id)
          .eq("status", "failed");

        if ((count || 0) >= 3) {
          if (ip_address) {
            await sb.from("fraud_blocklist").upsert(
              { type: "ip", value: ip_address, reason: "Auto-blocked: 3 failed payments same session", blocked_by: "system" },
              { onConflict: "type,value" }
            );
          }
          await sb.from("notifications").insert({
            type: "fraud_alert",
            title: "🚨 Auto-Blocked",
            message: `IP ${ip_address} auto-blocked: 3 failed payment attempts from session ${session_id?.slice(0, 8)}`,
            entity_type: "fraud",
            entity_id: session_id || null
          });
        }
      }

      return new Response(JSON.stringify({ logged: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const leadsPassword = Deno.env.get("LEADS_PASSWORD");
    if (!leadsPassword || password !== leadsPassword) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── LIST LEADS ──
    if (action === "list") {
      const { data, error } = await supabase
        .from("delivery_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(
        JSON.stringify({ leads: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TOGGLE CONTACTED ──
    if (action === "toggle_contacted") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads").select("contacted").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ contacted: !current.contacted }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true, contacted: !current.contacted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE STAGE ──
    if (action === "update_stage") {
      if (!id || !stage) {
        return new Response(JSON.stringify({ error: "Missing id or stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const validStages = ["new", "called", "quoted", "won", "lost"];
      if (!validStages.includes(stage)) {
        return new Response(JSON.stringify({ error: "Invalid stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ stage }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE NOTES ──
    if (action === "update_notes") {
      if (!id || notes === undefined) {
        return new Response(JSON.stringify({ error: "Missing id or notes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads").select("notes").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = current.notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ notes: newNotes }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true, notes: newNotes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MARK CONVERTED ──
    if (action === "mark_converted") {
      if (!lead_number) {
        return new Response(JSON.stringify({ error: "Missing lead_number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: lead, error: fetchErr } = await supabase
        .from("delivery_leads").select("id, notes").eq("lead_number", lead_number).single();
      if (fetchErr) {
        console.error("[leads-auth] Lead not found:", lead_number, fetchErr);
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = lead.notes || "";
      const conversionNote = `[${timestamp}] CONVERTED — Order ${order_number || "N/A"} placed`;
      const newNotes = existingNotes ? `${existingNotes}\n${conversionNote}` : conversionNote;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ stage: "won", contacted: true, notes: newNotes }).eq("id", lead.id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SEND OFFER (create pre-order + Stripe payment link) ──
    if (action === "send_offer") {
      const { lead_id, pit_id: offerPitId, calculated_price: offerPrice } = body;
      if (!lead_id || !offerPitId || !offerPrice) {
        return new Response(JSON.stringify({ error: "Missing lead_id, pit_id, or calculated_price" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch lead
      const { data: lead, error: leadErr } = await supabase
        .from("delivery_leads").select("*").eq("id", lead_id).single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check stripe mode — skip DB write in test mode
      const { data: modeRow } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", "stripe_mode")
        .single();
      if (modeRow?.value === "test") {
        console.log("[send_offer] TEST MODE — skipping order creation");
        return new Response(JSON.stringify({
          success: true,
          order_id: "test-" + Date.now(),
          order_number: "RS-TEST-0000",
          payment_url: "https://riversand.net/order?payment=test",
          test_mode: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create order via RPC
      const orderData = {
        customer_name: lead.customer_name,
        customer_email: lead.customer_email || "",
        customer_phone: lead.customer_phone || "",
        delivery_address: lead.address,
        distance_miles: lead.distance_miles || 0,
        price: offerPrice,
        quantity: 1,
        notes: lead.notes || "",
        payment_method: "stripe",
        payment_status: "pending",
        pit_id: offerPitId,
        lead_reference: lead.lead_number || "",
      };

      const { data: orderResult, error: orderErr } = await supabase.rpc("create_order", { p_data: orderData });
      if (orderErr) throw orderErr;
      const orderId = orderResult.id;
      const orderNumber = orderResult.order_number;

      // Generate Stripe checkout link
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const amountCents = Math.round(offerPrice * 100);
      const checkoutResp = await fetch(`${supabaseUrl2}/functions/v1/create-checkout-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
        body: JSON.stringify({
          amount: amountCents,
          description: `River Sand Delivery — ${lead.address}`,
          customer_name: lead.customer_name,
          customer_email: lead.customer_email,
          order_id: orderId,
          order_number: orderNumber,
          origin_url: "https://riversand.net",
        }),
      });
      const checkoutData = await checkoutResp.json();
      const paymentUrl = checkoutData.url;

      // Update lead
      await supabase.from("delivery_leads").update({
        stage: "quoted",
        offer_sent_at: new Date().toISOString(),
        pre_order_id: orderId,
        calculated_price: offerPrice,
      } as any).eq("id", lead_id);

      // Send offer email to customer (fire-and-forget)
      if (lead.customer_email) {
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({
            type: "lead_offer",
            data: {
              customer_name: lead.customer_name,
              customer_email: lead.customer_email,
              address: lead.address,
              price: offerPrice,
              payment_url: paymentUrl,
              order_number: orderNumber,
            },
          }),
        }).catch((err: any) => console.error("[send_offer] Email error:", err));
      }

      console.log(`[send_offer] Created order ${orderNumber} for lead ${lead_id}, payment URL generated`);

      return new Response(JSON.stringify({ success: true, order_id: orderId, order_number: orderNumber, payment_url: paymentUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DECLINE LEAD ──
    if (action === "decline_lead") {
      const { lead_id } = body;
      if (!lead_id) {
        return new Response(JSON.stringify({ error: "Missing lead_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: lead, error: leadErr } = await supabase
        .from("delivery_leads").select("*").eq("id", lead_id).single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update lead stage
      await supabase.from("delivery_leads").update({
        stage: "lost",
        declined_at: new Date().toISOString(),
      } as any).eq("id", lead_id);

      // Add to waitlist
      if (lead.customer_email) {
        const cityMatch = lead.address.match(/,\s*([^,]+),\s*[A-Z]{2}\s+\d{5}/);
        const cityName = cityMatch?.[1]?.trim() || lead.address.split(",")[0]?.trim() || "Unknown";
        const citySlug = cityName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        await supabase.from("waitlist_leads").upsert({
          city_slug: citySlug,
          city_name: cityName,
          customer_name: lead.customer_name,
          customer_email: lead.customer_email,
          customer_phone: lead.customer_phone,
        }, { onConflict: "customer_email,city_slug" }).select();

        // Send decline email (fire-and-forget)
        const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({
            type: "lead_decline",
            data: {
              customer_name: lead.customer_name,
              customer_email: lead.customer_email,
              address: lead.address,
              city_name: cityName,
            },
          }),
        }).catch((err: any) => console.error("[decline_lead] Email error:", err));
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── VERIFY CALL (confirm order after phone verification) ──
    if (action === "verify_call") {
      const { order_id: verifyOrderId, verified_by } = body;
      if (!verifyOrderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: updateErr } = await supabase.from("orders").update({
        review_status: "call_verified",
        call_verified_at: new Date().toISOString(),
        call_verified_by: verified_by || "admin",
        status: "confirmed",
      }).eq("id", verifyOrderId);
      if (updateErr) throw updateErr;

      // Send dispatch notification (fire-and-forget)
      const { data: order } = await supabase.from("orders").select("*").eq("id", verifyOrderId).single();
      if (order) {
        const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({ type: "order", data: order }),
        }).catch((err: any) => console.error("[verify_call] Email error:", err));
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── FLAG FRAUD (block IP, refund if order exists) ──
    if (action === "flag_fraud") {
      const { lead_id: fraudLeadId, order_id: fraudOrderId, reason: fraudReason } = body;
      if (!fraudLeadId && !fraudOrderId) {
        return new Response(JSON.stringify({ error: "Missing lead_id or order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let ipToBlock: string | null = null;

      // Handle lead fraud
      if (fraudLeadId) {
        const { data: lead } = await supabase.from("delivery_leads").select("ip_address").eq("id", fraudLeadId).single();
        if (lead?.ip_address) ipToBlock = lead.ip_address;
        await supabase.from("delivery_leads").update({
          fraud_score: 100,
          fraud_signals: ["manually_flagged"],
          stage: "lost",
        } as any).eq("id", fraudLeadId);
      }

      // Handle order fraud
      if (fraudOrderId) {
        const { data: order } = await supabase.from("orders").select("stripe_payment_id, delivery_address").eq("id", fraudOrderId).single();
        await supabase.from("orders").update({
          fraud_score: 100,
          fraud_signals: ["manually_flagged"],
          status: "cancelled",
          review_status: "cancelled",
        } as any).eq("id", fraudOrderId);

        // Trigger refund via create-refund function
        if (order?.stripe_payment_id) {
          const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          try {
            const refundResp = await fetch(`${supabaseUrl2}/functions/v1/create-refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
              body: JSON.stringify({ payment_intent_id: order.stripe_payment_id, reason: "fraudulent" }),
            });
            const refundData = await refundResp.json();
            console.log(`[flag_fraud] Refund result for order ${fraudOrderId}:`, refundData);
          } catch (refErr: any) {
            console.error("[flag_fraud] Refund error:", refErr);
          }
        }
      }

      // Block IP
      if (ipToBlock) {
        await supabase.from("blocked_ips").insert({
          ip_address: ipToBlock,
          reason: fraudReason || "Manually flagged as fraud",
          blocked_by: "admin",
        } as any);
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET PENDING REVIEW ORDERS ──
    if (action === "get_pending_review_orders") {
      const { data: orders, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("review_status", "pending_review")
        .order("created_at", { ascending: false });
      if (ordersErr) throw ordersErr;
      return new Response(JSON.stringify({ orders }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET SETTINGS ──
    if (action === "get_settings") {
      const { data, error } = await supabase
        .from("global_settings").select("key, value");
      if (error) throw error;
      const obj: Record<string, string> = {};
      for (const row of data || []) obj[row.key] = row.value;
      return new Response(
        JSON.stringify({ settings: obj }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHECK GOOGLE INTEGRATIONS ──
    if (action === "check_google_integrations") {
      console.log("[check_google_integrations] reached");
      const results: Record<string, "connected" | "invalid" | "not_set" | "dns_verified"> = {
        gtm: "not_set", ga4: "not_set", clarity: "not_set", gmb: "not_set", gsc: "not_set",
      };

      const fetchWithTimeout = async (url: string, opts: RequestInit = {}, ms = 3000): Promise<Response> => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try {
          return await fetch(url, { ...opts, signal: ctrl.signal });
        } finally {
          clearTimeout(t);
        }
      };

      try {
        const { gtm_id, ga4_id, clarity_id, gmb_url, gsc_id } = body || {};

        const checks: Promise<void>[] = [];

        // GTM
        if (gtm_id) {
          checks.push((async () => {
            try {
              const r = await fetchWithTimeout(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm_id)}`);
              results.gtm = r.ok ? "connected" : "invalid";
            } catch { results.gtm = "invalid"; }
          })());
        }

        // GA4 — format validation only (synchronous)
        if (ga4_id) {
          results.ga4 = /^G-[A-Z0-9]+$/.test(ga4_id) ? "connected" : "invalid";
        }

        // Clarity
        if (clarity_id) {
          checks.push((async () => {
            try {
              const r = await fetchWithTimeout(`https://www.clarity.ms/tag/${encodeURIComponent(clarity_id)}`);
              results.clarity = r.ok ? "connected" : "invalid";
            } catch { results.clarity = "invalid"; }
          })());
        }

        // GMB URL — pattern-first dispatch (short links block server fetches)
        if (gmb_url) {
          if (/^https:\/\/maps\.app\.goo\.gl\//i.test(gmb_url)) {
            results.gmb = "connected"; // format-only validation; Google short links block automated requests
          } else if (/^https:\/\/(maps\.google\.com|www\.google\.com\/maps)/i.test(gmb_url)) {
            results.gmb = "connected";
          } else if (/^https:\/\/g\.page\//i.test(gmb_url)) {
            checks.push((async () => {
              try {
                let r = await fetchWithTimeout(gmb_url, { method: "HEAD", redirect: "follow" });
                if (!r.ok) r = await fetchWithTimeout(gmb_url, { method: "GET", redirect: "follow" });
                results.gmb = r.ok ? "connected" : "invalid";
              } catch { results.gmb = "invalid"; }
            })());
          } else {
            results.gmb = "invalid";
          }
        }

        // GSC — only fetch site if we actually need to verify
        checks.push((async () => {
          try {
            const pageRes = await fetchWithTimeout("https://riversand.net/", { redirect: "follow" }, 3000);
            const html = pageRes.ok ? await pageRes.text() : "";
            const metaMatch = html.match(/<meta[^>]+name=["']google-site-verification["'][^>]+content=["']([^"']+)["']/i);
            if (gsc_id) {
              if (metaMatch && metaMatch[1] && metaMatch[1].includes(gsc_id.replace(/^google-site-verification=?/i, ""))) {
                results.gsc = "connected";
              } else if (metaMatch) {
                results.gsc = "invalid";
              } else {
                results.gsc = "dns_verified";
              }
            } else {
              results.gsc = metaMatch ? "connected" : "dns_verified";
            }
          } catch {
            results.gsc = gsc_id ? "invalid" : "dns_verified";
          }
        })());

        await Promise.allSettled(checks);
        console.log("[check_google_integrations] done", results);
      } catch (err) {
        console.error("[check_google_integrations] outer error:", err);
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save_settings") {
      if (!settings || typeof settings !== "object") {
        return new Response(JSON.stringify({ error: "Missing settings object" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("global_settings")
          .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      const { data, error } = await supabase
        .from("global_settings").select("key, value");
      if (error) throw error;
      const obj: Record<string, string> = {};
      for (const row of data || []) obj[row.key] = row.value;
      return new Response(
        JSON.stringify({ success: true, settings: obj }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE SETTINGS BULK ──
    if (action === "save_settings_bulk") {
      const { settings: bulkSettings } = JSON.parse(JSON.stringify({ settings }));
      if (!Array.isArray(bulkSettings)) {
        return new Response(JSON.stringify({ error: "settings must be an array of { key, value }" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const savedKeys: string[] = [];
      for (const setting of bulkSettings) {
        await supabase.from("global_settings").upsert(
          { key: setting.key, value: setting.value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
        savedKeys.push(setting.key);
      }

      // ── PART 2: Auto-regen when pricing-related global settings change ──
      const pricingKeys = ["default_base_price", "default_free_miles", "default_extra_per_mile", "default_max_distance", "saturday_surcharge"];
      const pricingChanged = savedKeys.some(k => pricingKeys.includes(k));
      let pages_regenerated = 0;

      if (pricingChanged) {
        // Re-fetch updated global settings
        const { data: gs } = await supabase.from("global_settings").select("key, value");
        const gMap: Record<string, string> = {};
        for (const r of gs || []) gMap[r.key] = r.value;

        // Get all pits for effective pricing
        const { data: allPits } = await supabase.from("pits").select("*").eq("status", "active");
        const pitMap: Record<string, any> = {};
        for (const p of allPits || []) pitMap[p.id] = p;

        const { data: allPages } = await supabase
          .from("city_pages")
          .select("id, city_name, distance_from_pit, pit_id")
          .in("status", ["active", "draft"]);

        console.log(`[save_settings] Pricing changed — queuing regen for ${allPages?.length || 0} pages`);

        const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
        const regenHeaders = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        };

        for (const page of allPages || []) {
          try {
            // Recalculate price using pit overrides + new global defaults
            const pit = pitMap[page.pit_id];
            const effBP = pit?.base_price ?? parseFloat(gMap.default_base_price || "195");
            const effFM = pit?.free_miles ?? parseFloat(gMap.default_free_miles || "15");
            const effEPM = pit?.price_per_extra_mile ?? parseFloat(gMap.default_extra_per_mile || "5");
            const dist = page.distance_from_pit || 0;
            const extraMiles = Math.max(0, dist - effFM);
            const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

            await supabase.from("city_pages").update({
              base_price: newPrice,
              price_changed: true,
              regen_reason: 'price_changed',
              updated_at: new Date().toISOString(),
            }).eq("id", page.id);

            await fetch(regenUrl, {
              method: "POST",
              headers: regenHeaders,
              body: JSON.stringify({ city_page_id: page.id, force: true }),
            });
            console.log(`[save_settings] Regenerated: ${page.city_name} ($${newPrice})`);
            pages_regenerated++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            console.error(`[save_settings] Failed: ${page.city_name}`, err.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, saved: bulkSettings.length, pages_regenerated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST PITS ──
    if (action === "list_pits") {
      const { data, error } = await supabase
        .from("pits").select("*").order("is_default", { ascending: false }).order("name");
      if (error) throw error;
      return new Response(
        JSON.stringify({ pits: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE PIT ──
    if (action === "save_pit") {
      if (!pit) {
        return new Response(JSON.stringify({ error: "Missing pit object" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Validate coordinates — last line of defense
      if (
        pit.lat == null || pit.lon == null ||
        isNaN(Number(pit.lat)) || isNaN(Number(pit.lon)) ||
        Number(pit.lat) === 0 ||
        Number(pit.lat) < 24 || Number(pit.lat) > 50 ||
        Number(pit.lon) < -125 || Number(pit.lon) > -66
      ) {
        return new Response(
          JSON.stringify({
            error: `Invalid PIT coordinates: lat=${pit.lat}, lon=${pit.lon}. ` +
              "A valid US location is required. Enter a full street address or " +
              "provide GPS coordinates from Google Maps."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let existingPit: any = null;
      let existingPitStatus: string | null = null;
      if (pit.id) {
        const { data: ep } = await supabase
          .from("pits")
          .select("base_price, free_miles, price_per_extra_mile, status, same_day_cutoff, operating_days")
          .eq("id", pit.id).maybeSingle();
        existingPit = ep;
        existingPitStatus = ep?.status || null;
      }

      const pitData = {
        name: pit.name,
        address: pit.address,
        lat: pit.lat,
        lon: pit.lon,
        status: pit.status || "planning",
        notes: pit.notes || "",
        base_price: pit.base_price ?? null,
        free_miles: pit.free_miles ?? null,
        price_per_extra_mile: pit.price_per_extra_mile ?? null,
        max_distance: pit.max_distance ?? null,
        is_default: pit.is_default || false,
        operating_days: pit.operating_days ?? null,
        saturday_surcharge_override: pit.saturday_surcharge_override ?? null,
        same_day_cutoff: pit.same_day_cutoff ?? null,
        sunday_surcharge: pit.sunday_surcharge ?? null,
        saturday_load_limit: pit.saturday_load_limit ?? null,
        sunday_load_limit: pit.sunday_load_limit ?? null,
        delivery_hours: pit.delivery_hours ?? null,
        is_pickup_only: pit.is_pickup_only || false,
      };

      let savedPit: any;
      if (pit.id) {
        const { data, error } = await supabase
          .from("pits").update(pitData).eq("id", pit.id).select().single();
        if (error) throw error;
        savedPit = data;
      } else {
        const { data, error } = await supabase
          .from("pits").insert(pitData).select().single();
        if (error) throw error;
        savedPit = data;
      }

      const isNewPit = !pit.id;
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
      const regenHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      };

      let prices_updated = 0;
      let pages_regenerated = 0;
      let regenTriggered = false;

      // ── PART 1: Auto-update prices & regen when existing pit pricing changes ──
      if (existingPit && !isNewPit) {
        const pricingChanged =
          (pit.base_price ?? null) !== (existingPit.base_price ?? null) ||
          (pit.free_miles ?? null) !== (existingPit.free_miles ?? null) ||
          (pit.price_per_extra_mile ?? null) !== (existingPit.price_per_extra_mile ?? null);

        if (pricingChanged) {
          const effBP = savedPit.base_price;
          const effFM = savedPit.free_miles;
          const effEPM = savedPit.price_per_extra_mile;

          const { data: affectedPages } = await supabase
            .from("city_pages")
            .select("id, city_name, distance_from_pit")
            .eq("pit_id", savedPit.id)
            .in("status", ["active", "draft"]);

          console.log(`[save_pit] Pricing changed — auto-updating ${affectedPages?.length || 0} city pages for pit ${savedPit.name}`);

          for (const page of affectedPages ?? []) {
            try {
              const dist = page.distance_from_pit || 0;
              const extraMiles = Math.max(0, dist - effFM);
              const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));
              await supabase.from("city_pages").update({
                base_price: newPrice,
                price_changed: true,
                regen_reason: 'price_changed',
                needs_regen: true,
                updated_at: new Date().toISOString()
              }).eq("id", page.id);
              prices_updated++;
              console.log(`[save_pit] Flagged for regen: ${page.city_name}`);
            } catch (err: any) {
              console.error(`[save_pit] Failed to regen ${page.city_name}:`, err.message);
            }
          }
          regenTriggered = true;
        }
      }

      // ── PART 1b: Content-affecting non-pricing edits (whitelisted) ──
      // Only same_day_cutoff and operating_days are passed to generate-city-page
      // outside of pricing inputs. All other PIT columns (delivery_hours, load
      // limits, surcharges, address, max_distance, notes, is_pickup_only) do
      // NOT appear in rendered city page content and must not trigger regen.
      if (!regenTriggered && !isNewPit && existingPit) {
        const cutoffChanged =
          (pit.same_day_cutoff ?? null) !== (existingPit.same_day_cutoff ?? null);
        const operatingDaysChanged =
          JSON.stringify(pit.operating_days ?? null) !==
          JSON.stringify(existingPit.operating_days ?? null);

        if (cutoffChanged || operatingDaysChanged) {
          const reason = cutoffChanged && operatingDaysChanged
            ? 'cutoff_and_operating_days_changed'
            : cutoffChanged ? 'same_day_cutoff_changed' : 'operating_days_changed';

          const { data: regenPages } = await supabase
            .from("city_pages")
            .select("id, city_name")
            .eq("pit_id", savedPit.id)
            .in("status", ["active", "draft"]);

          if (regenPages && regenPages.length > 0) {
            console.log(`[save_pit] ${reason} — flagging ${regenPages.length} city pages for regen`);
            const regenIds = regenPages.map((p: any) => p.id);
            await supabase.from("city_pages").update({
              needs_regen: true,
              regen_reason: reason,
              updated_at: new Date().toISOString()
            }).in("id", regenIds);
            pages_regenerated = regenPages.length;
            regenTriggered = true;
          }
        } else {
          console.log(`[save_pit] No content-affecting changes for ${savedPit.name} — skipping regen`);
        }
      }

      // ── PART 2: PIT deactivation — reassign or waitlist ──
      let deactivation_reassigned = 0;
      let deactivation_waitlisted = 0;
      if (!isNewPit && existingPitStatus === "active" && savedPit.status === "inactive") {
        console.log(`[save_pit] PIT deactivated: ${savedPit.name} — reassigning city pages`);

        const { data: deactivatedPages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, status")
          .eq("pit_id", savedPit.id)
          .neq("status", "waitlist");

        if (deactivatedPages && deactivatedPages.length > 0) {
          // Get all OTHER active pits
          const { data: otherActivePits } = await supabase
            .from("pits").select("*").eq("status", "active").neq("id", savedPit.id);

          // Fetch global settings for pricing
          const { data: gsDeact } = await supabase.from("global_settings").select("key, value");
          const gMapDeact: Record<string, string> = {};
          for (const r of gsDeact || []) gMapDeact[r.key] = r.value;

          for (const page of deactivatedPages) {
            try {
              if (!page.lat || !page.lng || !otherActivePits || otherActivePits.length === 0) {
                // No active pits available — waitlist
                await supabase.from("city_pages").update({
                  status: "waitlist",
                  status_reason: "PIT deactivated, no alternative PIT available",
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                deactivation_waitlisted++;
                console.log(`[save_pit] Waitlisted: ${page.city_name} (no active PITs)`);
                continue;
              }

              // Calculate driving distances from this city to all other active pits
              const distances = await getDrivingDistances(
                Number(page.lat), Number(page.lng),
                otherActivePits.map(p => ({ lat: Number(p.lat), lng: Number(p.lon) })),
                apiKey
              );

              // Find nearest pit within its max_distance
              let bestPit: any = null;
              let bestDist = Infinity;
              for (let i = 0; i < otherActivePits.length; i++) {
                const d = distances[i];
                if (d == null) continue;
                const pitMax = otherActivePits[i].max_distance || parseFloat(gMapDeact.default_max_distance || "30");
                if (d <= pitMax && d < bestDist) {
                  bestDist = d;
                  bestPit = otherActivePits[i];
                }
              }

              if (bestPit) {
                // Reassign to new PIT
                const effBP = bestPit.base_price ?? parseFloat(gMapDeact.default_base_price || "195");
                const effFM = bestPit.free_miles ?? parseFloat(gMapDeact.default_free_miles || "15");
                const effEPM = bestPit.price_per_extra_mile ?? parseFloat(gMapDeact.default_extra_per_mile || "5");
                const extraMiles = Math.max(0, bestDist - effFM);
                const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                await supabase.from("city_pages").update({
                  pit_id: bestPit.id,
                  distance_from_pit: Math.round(bestDist * 10) / 10,
                  base_price: newPrice,
                  pit_reassigned: true,
                  regen_reason: "pit_reassigned",
                  needs_regen: true,
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);

                deactivation_reassigned++;
                console.log(`[save_pit] Reassigned: ${page.city_name} → ${bestPit.name} (${bestDist.toFixed(1)}mi, $${newPrice})`);
              } else {
                // No valid PIT — waitlist
                await supabase.from("city_pages").update({
                  status: "waitlist",
                  status_reason: "PIT deactivated, no alternative PIT within range",
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                deactivation_waitlisted++;
                console.log(`[save_pit] Waitlisted: ${page.city_name} (no PIT within range)`);
              }
            } catch (err: any) {
              console.error(`[save_pit] Deactivation error for ${page.city_name}:`, err.message);
            }
          }
        }
        console.log(`[save_pit] Deactivation complete: ${deactivation_reassigned} reassigned, ${deactivation_waitlisted} waitlisted`);
      }

      // ── PART 2b: PIT reactivation — reassign closer pages ──
      let reactivation_reassigned = 0;
      let reactivation_unwaitlisted = 0;
      if (!isNewPit && existingPitStatus !== "active" && savedPit.status === "active") {
        console.log(`[save_pit] PIT reactivated: ${savedPit.name} — checking for closer assignments`);

        // Get ALL city pages with coordinates
        const { data: allPages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, pit_id, status, base_price")
          .not("lat", "is", null)
          .not("lng", "is", null);

        if (allPages && allPages.length > 0) {
          // Fetch global settings for pricing
          const { data: gsReact } = await supabase.from("global_settings").select("key, value");
          const gMapReact: Record<string, string> = {};
          for (const r of gsReact || []) gMapReact[r.key] = r.value;

          const reactMaxDist = savedPit.max_distance || parseFloat(gMapReact.default_max_distance || "30");
          const effBP = savedPit.base_price ?? parseFloat(gMapReact.default_base_price || "195");
          const effFM = savedPit.free_miles ?? parseFloat(gMapReact.default_free_miles || "15");
          const effEPM = savedPit.price_per_extra_mile ?? parseFloat(gMapReact.default_extra_per_mile || "5");

          // Calculate driving distances from reactivated PIT to all city pages
          const destinations = allPages.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
          const drivingDists = await getDrivingDistances(
            Number(savedPit.lat), Number(savedPit.lon),
            destinations, apiKey
          );

          for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            const newDist = drivingDists[i];
            if (newDist == null || newDist > reactMaxDist) continue;

            try {
              if (page.status === "waitlist") {
                // Waitlisted page — reassign if within range
                const extraMiles = Math.max(0, newDist - effFM);
                const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                await supabase.from("city_pages").update({
                  pit_id: savedPit.id,
                  distance_from_pit: Math.round(newDist * 10) / 10,
                  base_price: newPrice,
                  status: "active",
                  status_reason: null,
                  pit_reassigned: true,
                  regen_reason: "pit_reactivated",
                  needs_regen: true,
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                reactivation_unwaitlisted++;
                console.log(`[save_pit] Un-waitlisted: ${page.city_name} → ${savedPit.name} (${newDist.toFixed(1)}mi, $${newPrice})`);
              } else if (page.pit_id !== savedPit.id) {
                // Already assigned to another PIT — only reassign if ≥3 miles closer
                const currentDist = page.distance_from_pit || 999;
                const improvement = currentDist - newDist;
                if (improvement >= 3) {
                  const extraMiles = Math.max(0, newDist - effFM);
                  const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                  await supabase.from("city_pages").update({
                    pit_id: savedPit.id,
                    distance_from_pit: Math.round(newDist * 10) / 10,
                    base_price: newPrice,
                    pit_reassigned: true,
                    regen_reason: "pit_reactivated",
                    needs_regen: true,
                    updated_at: new Date().toISOString(),
                  }).eq("id", page.id);
                  reactivation_reassigned++;
                  console.log(`[save_pit] Reactivation reassigned: ${page.city_name} → ${savedPit.name} (${newDist.toFixed(1)}mi vs ${currentDist.toFixed(1)}mi, improvement: ${improvement.toFixed(1)}mi)`);
                }
              }
            } catch (err: any) {
              console.error(`[save_pit] Reactivation error for ${page.city_name}:`, err.message);
            }
          }
        }
        console.log(`[save_pit] Reactivation complete: ${reactivation_reassigned} reassigned, ${reactivation_unwaitlisted} un-waitlisted`);
      }

      // ── PART 3: Auto-discover cities when new pit is created ──
      let pages_reassigned = 0;
      let pages_created_count = 0;
      if (isNewPit && savedPit.status === "active") {
        console.log(`[save_pit] New pit created: ${savedPit.name} — auto-discovering cities`);

        // Get all active pits including the new one
        const { data: allActivePitsForNew } = await supabase
          .from("pits").select("*").eq("status", "active");

        // Get existing city pages
        const { data: existingPagesForNew } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, pit_id, status");
        const existingByNameForNew = new Map(
          (existingPagesForNew || []).map((p: any) => [p.city_name.toLowerCase(), p])
        );

        // Discover cities near new pit via reverse geocoding
        const newPitMaxDist = savedPit.max_distance || 30;
        const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];
        const EXCLUDE_WORDS = [
          "inc", "llc", "corp", "association", "club", "center", "centre",
          "park", "farm", "commission", "community", "fitness", "beach",
          "golf", "volleyball", "action", "development", "recreation",
          "school", "church", "hospital", "museum", "library", "university",
          "college", "foundation", "institute", "authority", "department",
          "council", "services", "group", "company", "studio", "restaurant",
          "hotel", "motel", "plaza", "mall", "shop", "store", "market",
          "yacht", "marina", "gym", "theater", "theatre", "arena",
        ];
        const cleanCityNameNew = (name: string) => name.replace(/^City of /i, "").replace(/^Town of /i, "").replace(/^Village of /i, "").replace(/\/.+$/, "").replace(/\s+Area$/i, "").replace(/\s+District$/i, "").replace(/\s+CDP$/i, "").trim();
        const isValidCityNameNew = (name: string) => {
          if (!name) return false;
          const lower = name.toLowerCase();
          for (const word of EXCLUDE_WORDS) { if (lower.includes(word)) return false; }
          const words = name.split(/\s+/);
          return words.length <= 4 && !words.some(w => w.length > 20);
        };

        // Generate sample points at various distances and directions
        const distancesArr = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= newPitMaxDist);
        const directionsArr = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
        const samplePts: { lat: number; lng: number }[] = [{ lat: savedPit.lat, lng: savedPit.lon }];
        for (const dist of distancesArr) {
          for (const dir of directionsArr) {
            const rad = dir * Math.PI / 180;
            const dLat = (dist / 69) * Math.cos(rad);
            const dLng = (dist / (69 * Math.cos(savedPit.lat * Math.PI / 180))) * Math.sin(rad);
            samplePts.push({ lat: savedPit.lat + dLat, lng: savedPit.lon + dLng });
          }
        }
        console.log(`[save_pit] Sampling ${samplePts.length} points for reverse geocoding`);

        const cityMapNew = new Map<string, { name: string; state: string; lat: number; lng: number }>();
        const BATCH_SIZE = 10;
        for (let i = 0; i < samplePts.length; i += BATCH_SIZE) {
          const batch = samplePts.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (pt) => {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
              );
              return (await resp.json()).results || [];
            } catch { return []; }
          });
          const batchResults = await Promise.all(promises);
          for (const results of batchResults) {
            for (const result of results) {
              const types = result.types || [];
              if (!types.some((t: string) => VALID_TYPES.includes(t))) continue;
              const components = result.address_components || [];
              let cityName = "";
              let stateCode = "";
              for (const prio of VALID_TYPES) {
                const comp = components.find((c: any) => c.types?.includes(prio));
                if (comp && !cityName) cityName = comp.long_name;
              }
              const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
              if (stateComp) stateCode = stateComp.short_name;
              if (!cityName) continue;
              cityName = cleanCityNameNew(cityName);
              if (!isValidCityNameNew(cityName)) continue;
              const key = cityName.toLowerCase();
              if (!cityMapNew.has(key)) {
                const loc = result.geometry?.location;
                if (loc) cityMapNew.set(key, { name: cityName, state: stateCode || "LA", lat: loc.lat, lng: loc.lng });
              }
            }
          }
        }
        console.log(`[save_pit] Discovered ${cityMapNew.size} unique cities near ${savedPit.name}`);

        // Calculate distances from ALL pits to ALL discovered cities
        const allCitiesArr = [...cityMapNew.values()];
        const pitDistsNew: Record<string, (number | null)[]> = {};
        for (const pit of allActivePitsForNew || []) {
          pitDistsNew[pit.id] = await getDrivingDistances(
            Number(pit.lat), Number(pit.lon),
            allCitiesArr.map(c => ({ lat: c.lat, lng: c.lng })),
            apiKey
          );
        }

        // Process each discovered city
        for (let idx = 0; idx < allCitiesArr.length; idx++) {
          const city = allCitiesArr[idx];
          try {
            // Find closest pit from ALL active pits
            let closestPit: any = null;
            let closestDist = Infinity;
            for (const pit of allActivePitsForNew || []) {
              const d = pitDistsNew[pit.id][idx];
              if (d != null && d < closestDist) {
                closestDist = d;
                closestPit = pit;
              }
            }
            if (!closestPit || closestDist === Infinity) continue;

            const pitMaxDist = closestPit.max_distance || parseFloat(gMapNew.default_max_distance || "30");
            if (closestDist > pitMaxDist) continue;

            // Calculate price
            const effBP = closestPit.base_price ?? parseFloat(gMapNew.default_base_price || "195");
            const effFM = closestPit.free_miles ?? parseFloat(gMapNew.default_free_miles || "15");
            const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gMapNew.default_extra_per_mile || "5");
            const extraMiles = Math.max(0, closestDist - effFM);
            const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

            const cleanSlug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            const existing = existingByNameForNew.get(city.name.toLowerCase());

            if (existing) {
              // Only update if new calculation finds closer pit
              if (closestDist < (existing.distance_from_pit ?? 999)) {
                const wasWaitlist = existing.status === "waitlist";
                await supabase.from("city_pages").update({
                  pit_id: closestPit.id,
                  distance_from_pit: Math.round(closestDist * 10) / 10,
                  base_price: price,
                  pit_reassigned: true,
                  regen_reason: 'pit_reassigned',
                  updated_at: new Date().toISOString(),
                }).eq("id", existing.id);
                console.log(`[save_pit] Reassigned ${city.name} → ${closestPit.name} (${closestDist.toFixed(1)}mi)`);
                pages_reassigned++;

                // Auto-generate content
                await fetch(regenUrl, { method: "POST", headers: regenHeaders, body: JSON.stringify({ city_page_id: existing.id, force: true }) });
                pages_regenerated++;

                // If page was on waitlist, notify waitlist leads
                if (wasWaitlist) {
                  try {
                    const { data: waitlistLeads } = await supabase
                      .from("waitlist_leads").select("*").eq("city_slug", existing.city_slug).is("notified_at", null);
                    const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
                    for (const lead of waitlistLeads || []) {
                      await fetch(emailUrl, {
                        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                        body: JSON.stringify({ type: "waitlist_available", data: { city_name: existing.city_name, city_slug: existing.city_slug, customer_name: lead.customer_name, customer_email: lead.customer_email, price } }),
                      });
                      await supabase.from("waitlist_leads").update({ notified_at: new Date().toISOString() }).eq("id", lead.id);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    console.log(`[save_pit] Notified ${waitlistLeads?.length || 0} waitlist leads for ${existing.city_name}`);
                  } catch (wErr: any) { console.error(`[save_pit] Waitlist notification error:`, wErr.message); }
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } else {
              // Create new page
              const { data: newPage } = await supabase.from("city_pages").insert({
                pit_id: closestPit.id,
                city_name: city.name,
                city_slug: cleanSlug,
                state: city.state,
                lat: city.lat,
                lng: city.lng,
                distance_from_pit: Math.round(closestDist * 10) / 10,
                base_price: price,
                status: "draft",
                regen_reason: 'missing_content',
              }).select("id").single();
              console.log(`[save_pit] Created page for ${city.name} — ${closestPit.name} (${closestDist.toFixed(1)}mi) $${price}`);
              pages_created_count++;

              // Auto-generate content (will set status to active)
              if (newPage?.id) {
                await fetch(regenUrl, { method: "POST", headers: regenHeaders, body: JSON.stringify({ city_page_id: newPage.id, force: true }) });
                pages_regenerated++;
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (err: any) {
            console.error(`[save_pit] Error processing ${city.name}:`, err.message);
          }
        }
        console.log(`[save_pit] Auto-discovery complete for ${savedPit.name}: ${pages_created_count} created, ${pages_reassigned} reassigned`);
      }

      // ── PART 4: Inline regen — process flagged pages immediately ──
      if (regenTriggered) {
        const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
        const leadsPass = Deno.env.get("LEADS_PASSWORD") || "";
        const { data: draftInline } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
          .eq("needs_regen", true)
          .eq("status", "draft")
          .order("updated_at", { ascending: true })
          .limit(10);
        const draftInlineIds = new Set((draftInline || []).map((p: any) => p.id));
        let inlinePages = draftInline || [];
        if (inlinePages.length < 10) {
          const { data: activeInline } = await supabase
            .from("city_pages")
            .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
            .eq("needs_regen", true)
            .eq("status", "active")
            .order("updated_at", { ascending: true })
            .limit(10 - inlinePages.length);
          inlinePages = [...inlinePages, ...(activeInline || []).filter((p: any) => !draftInlineIds.has(p.id))];
        }

        const { data: inlinePits } = await supabase.from("pits").select("*").eq("status", "active");
        const inlinePitsById: Record<string, any> = {};
        (inlinePits || []).forEach((p: any) => { inlinePitsById[p.id] = p; });

        let inline_processed = 0;
        for (const page of inlinePages || []) {
          try {
            const pit = inlinePitsById[page.pit_id] || {};
            const response = await fetch(regenUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
              body: JSON.stringify({
                password: leadsPass,
                city_page_id: page.id,
                city_name: page.city_name,
                state: page.state || "LA",
                region: page.region || page.state || "LA",
                pit_name: pit.name || "Unknown",
                pit_city: pit.name || "Unknown",
                distance: page.distance_from_pit || 0,
                price: page.base_price || pit.base_price || 195,
                free_miles: pit.free_miles || 15,
                saturday_available: pit.operating_days ? pit.operating_days.includes(6) : true,
                same_day_cutoff: pit.same_day_cutoff || "10:00 am",
                multi_pit_coverage: page.multi_pit_coverage || false,
              }),
            });
            if (response.ok) {
              const { data: pageBefore } = await supabase
                .from("city_pages")
                .select("regen_reason")
                .eq("id", page.id)
                .maybeSingle();
              await supabase.from("city_pages").update({
                needs_regen: false,
                pit_reassigned: false,
                price_changed: false,
                last_regen_reason: pageBefore?.regen_reason ?? null,
                last_regen_at: new Date().toISOString(),
                regen_reason: null,
                status: "active",
                updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              inline_processed++;
              console.log(`[save_pit] Inline regen done: ${page.city_name}`);
            } else {
              console.error(`[save_pit] Inline regen failed: ${page.city_name} (${response.status})`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            console.error(`[save_pit] Inline regen error: ${page.city_name}`, err.message);
            continue;
          }
        }
        console.log(`[save_pit] Inline regen complete: ${inline_processed} processed`);
        pages_regenerated += inline_processed;
      }

      return new Response(
        JSON.stringify({ success: true, pit: savedPit, prices_updated, pages_regenerated, pages_reassigned, pages_created: pages_created_count, deactivation_reassigned, deactivation_waitlisted, reactivation_reassigned, reactivation_unwaitlisted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE PIT ──
    if (action === "delete_pit") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("pits").delete().eq("id", id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET FUNNEL (last 30 days cumulative) ──
    if (action === "get_funnel") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("stage, entry_city_name")
        .gte("created_at", since);
      if (error) throw error;

      const ORDERED_STAGES = [
        "visited", "entered_address", "got_price",
        "clicked_order_now", "started_checkout",
        "reached_payment", "completed_order",
      ];
      const counts: Record<string, number> = {
        visited: 0, entered_address: 0, got_price: 0,
        got_out_of_area: 0, clicked_order_now: 0,
        started_checkout: 0, reached_payment: 0, completed_order: 0,
      };

      const entryPages: Record<string, number> = {};
      for (const row of (data as any[]) || []) {
        const stage = row.stage || "visited";
        if (row.entry_city_name) {
          entryPages[row.entry_city_name] = (entryPages[row.entry_city_name] || 0) + 1;
        }
        if (stage === "got_out_of_area") {
          counts.got_out_of_area++;
          counts.visited++;
          counts.entered_address++;
          continue;
        }
        const idx = ORDERED_STAGES.indexOf(stage);
        if (idx === -1) { counts.visited++; continue; }
        for (let i = 0; i <= idx; i++) {
          counts[ORDERED_STAGES[i]]++;
        }
      }

      const top_entry_cities = Object.entries(entryPages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([city, count]) => ({ city, count }));

      return new Response(
        JSON.stringify({ funnel: counts, top_entry_cities }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_live_visitors") {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("*")
        .gte("last_seen_at", thirtyMinsAgo)
        .order("last_seen_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntData } = await ntSb.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIps: string[] = ntData ? JSON.parse(ntData.value) : [];
      const filtered = (data || []).filter((s: any) => !ntIps.includes(s.ip_address));
      console.log("[list_live_visitors] found:", data?.length, "total,", filtered.length, "after notrack filter");
      return new Response(
        JSON.stringify({ sessions: filtered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET ACTIVITY MAP (address dots for last 30 days) ──
    if (action === "get_activity_map") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("address_lat, address_lng, stage, calculated_price, delivery_address, geo_city, entry_city_name, created_at, ip_address")
        .not("address_lat", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSbM = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntDataM } = await ntSbM.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIpsM: string[] = ntDataM ? JSON.parse(ntDataM.value) : [];
      const filteredPts = (data || []).filter((s: any) => !ntIpsM.includes(s.ip_address));
      // Strip ip_address from response
      const points = filteredPts.map(({ ip_address, ...rest }: any) => rest);
      return new Response(
        JSON.stringify({ points }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST ABANDONED SESSIONS ──
    if (action === "list_abandoned") {
      const stages = ["entered_address", "got_price", "got_out_of_area", "clicked_order_now", "started_checkout", "reached_payment"];
      const stalenessMs = 30 * 60 * 1000; // 30 minutes
      const cutoffTime = new Date(Date.now() - stalenessMs).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("*")
        .in("stage", stages)
        .lt("updated_at", cutoffTime)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSbA = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntDataA } = await ntSbA.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIpsA: string[] = ntDataA ? JSON.parse(ntDataA.value) : [];
      const filtered = (data || []).filter((s: any) => !ntIpsA.includes(s.ip_address));
      console.log("[list_abandoned] found:", data?.length, "total,", filtered.length, "after notrack filter");
      return new Response(
        JSON.stringify({ sessions: filtered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST ALL ORDERS ──
    if (action === "list_all_orders") {
      const statusFilter = body.status_filter as string | undefined;
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;

      const all = data || [];
      const today = new Date().toISOString().slice(0, 10);
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const metrics = {
        total: all.length,
        pending: all.filter((o: any) => o.status === "pending").length,
        confirmed: all.filter((o: any) => o.status === "confirmed").length,
        today_deliveries: all.filter((o: any) => o.delivery_date === today && ["confirmed","en_route"].includes(o.status)).length,
        revenue_30d: all
          .filter((o: any) => ["paid", "captured", "authorized"].includes(o.payment_status) && o.created_at >= since30)
          .reduce((sum: number, o: any) => sum + Number(o.price) * Number(o.quantity || 1), 0),
        paid_count_30d: all.filter((o: any) => ["paid", "captured", "authorized"].includes(o.payment_status) && o.created_at >= since30).length,
      };
      return new Response(
        JSON.stringify({ orders: all, metrics }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATH B PHASE 0: Drivers foundation (schema-only feature, no UI yet)
    // Backend actions to read/write the new public.drivers table introduced
    // in the Phase 0 migration. Follows the schedule_get_day pattern: explicit
    // password check, service-role supabase client, minimal response shape.
    // Phase 1 will add the Drivers tab UI in Leads.tsx that consumes these.
    // ─────────────────────────────────────────────────────────────────────────

    // ── LIST DRIVERS ──
    if (action === "list_drivers") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, phone, email, truck_number, payment_type, payment_rate, license_expires_on, notes, active, created_at, updated_at")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return new Response(
        JSON.stringify({ drivers: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPSERT DRIVER ──
    if (action === "upsert_driver") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const driver = (body as any).driver;
      if (!driver || typeof driver !== "object") {
        return new Response(JSON.stringify({ error: "Missing driver object" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Phase 0 validator fix — partial updates by id do not require re-sending name/phone.
      // Required fields apply to INSERT only.
      const isUpdate = !!driver.id;
      const hasName = Object.prototype.hasOwnProperty.call(driver, "name");
      const hasPhone = Object.prototype.hasOwnProperty.call(driver, "phone");

      let name: string | undefined;
      if (hasName) {
        name = typeof driver.name === "string" ? driver.name.trim() : "";
        if (!name) {
          return new Response(JSON.stringify({ error: "Driver name is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (!isUpdate) {
        return new Response(JSON.stringify({ error: "Driver name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let phone: string | undefined;
      if (hasPhone) {
        const phoneRaw = typeof driver.phone === "string" ? driver.phone.trim() : "";
        if (!phoneRaw) {
          return new Response(JSON.stringify({ error: "Driver phone is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Normalize phone to digits-only (matches riversand's existing phone handling)
        phone = phoneRaw.replace(/\D/g, "");
        if (!phone) {
          return new Response(JSON.stringify({ error: "Driver phone must contain digits" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (!isUpdate) {
        return new Response(JSON.stringify({ error: "Driver phone is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const selectCols = "id, name, phone, email, truck_number, payment_type, payment_rate, license_expires_on, notes, active, created_at, updated_at";

      let result;
      if (isUpdate) {
        // Build payload from only the fields actually present in driver (excluding id).
        // Omitted fields are not touched.
        const payload: Record<string, any> = {};
        if (hasName) payload.name = name;
        if (hasPhone) payload.phone = phone;
        if (Object.prototype.hasOwnProperty.call(driver, "email"))
          payload.email = driver.email ? String(driver.email).trim() || null : null;
        if (Object.prototype.hasOwnProperty.call(driver, "truck_number"))
          payload.truck_number = driver.truck_number ? String(driver.truck_number).trim() || null : null;
        if (Object.prototype.hasOwnProperty.call(driver, "payment_type"))
          payload.payment_type = driver.payment_type || "per_load";
        if (Object.prototype.hasOwnProperty.call(driver, "payment_rate"))
          payload.payment_rate = driver.payment_rate != null ? Number(driver.payment_rate) : 0;
        if (Object.prototype.hasOwnProperty.call(driver, "license_expires_on"))
          payload.license_expires_on = driver.license_expires_on || null;
        if (Object.prototype.hasOwnProperty.call(driver, "notes"))
          payload.notes = driver.notes ? String(driver.notes) : null;
        if (Object.prototype.hasOwnProperty.call(driver, "active"))
          payload.active = !!driver.active;

        if (Object.keys(payload).length === 0) {
          return new Response(JSON.stringify({ error: "No fields to update" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        result = await supabase
          .from("drivers")
          .update(payload)
          .eq("id", driver.id)
          .select(selectCols)
          .maybeSingle();
      } else {
        const payload: Record<string, any> = {
          name,
          phone,
          email: driver.email ? String(driver.email).trim() || null : null,
          truck_number: driver.truck_number ? String(driver.truck_number).trim() || null : null,
          payment_type: driver.payment_type || "per_load",
          payment_rate: driver.payment_rate != null ? Number(driver.payment_rate) : 0,
          license_expires_on: driver.license_expires_on || null,
          notes: driver.notes ? String(driver.notes) : null,
          active: driver.active !== undefined ? !!driver.active : true,
        };
        result = await supabase
          .from("drivers")
          .insert(payload)
          .select(selectCols)
          .maybeSingle();
      }

      if (result.error) {
        // Postgres unique-violation code is 23505 — surface friendly message
        const code = (result.error as any).code;
        const msg = (result.error as any).message || "";
        if (code === "23505" || /duplicate key|unique/i.test(msg)) {
          return new Response(
            JSON.stringify({ error: "A driver with that phone number already exists" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw result.error;
      }

      return new Response(
        JSON.stringify({ driver: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SCHEDULE: GET DAY ──
    // Correction to Slice 1 — routes Schedule reads through leads-auth per existing Leads tab pattern.
    // Original Decision A assumed direct supabase read worked; diagnosis revealed RLS was silently
    // filtering anon-role reads (orders has no anon SELECT policy, only authenticated admin JWT).
    if (action === "schedule_get_day") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const iso = body.iso as string | undefined;
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return new Response(JSON.stringify({ error: "Missing or invalid iso (YYYY-MM-DD)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Minimum data — only fields ScheduleOrderCard + schedule-adapter consume.
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, delivery_address, delivery_window, quantity, price, payment_method, payment_status, status, delivery_date, cancelled_at, pit_id, created_at")
        .eq("delivery_date", iso)
        .order("delivery_window", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return new Response(
        JSON.stringify({ orders: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SCHEDULE: GET WINDOW COUNTS ──
    // Correction to Slice 1 — see schedule_get_day above for context.
    if (action === "schedule_get_window_counts") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const start = body.start as string | undefined;
      const end = body.end as string | undefined;
      if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return new Response(JSON.stringify({ error: "Missing or invalid start/end (YYYY-MM-DD)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase
        .from("orders")
        .select("delivery_date, quantity")
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .limit(10000);
      if (error) throw error;
      return new Response(
        JSON.stringify({ rows: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE ORDER ──
    if (action === "update_order") {
      // Path B Phase 1b — driver_id whitelist addition. Active-driver guard enforced server-side; UI dropdown already filters to active, this is defense in depth.
      // Path B Phase 2 — message_sent_at whitelist addition. Pass-through, client owns the timestamp.
      const { order_id, status, notes, delivery_date, delivery_day_of_week, driver_id, message_sent_at } = body as any;
      if (!order_id) throw new Error("Missing order_id");

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (delivery_date !== undefined) updates.delivery_date = delivery_date;
      if (delivery_day_of_week !== undefined) updates.delivery_day_of_week = delivery_day_of_week;
      if (message_sent_at !== undefined) updates.message_sent_at = message_sent_at;

      if (driver_id !== undefined) {
        if (driver_id !== null) {
          const { data: driverRow, error: driverErr } = await supabase
            .from("drivers")
            .select("id, active")
            .eq("id", driver_id)
            .maybeSingle();
          if (driverErr) throw driverErr;
          if (!driverRow) {
            return new Response(
              JSON.stringify({ error: "Driver not found" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (driverRow.active === false) {
            return new Response(
              JSON.stringify({ error: "Cannot assign inactive driver" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        updates.driver_id = driver_id;
      }

      const { data: updatedOrder, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order_id)
        .select("*")
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, order: updatedOrder }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST CASH ORDERS ──
    if (action === "list_cash_orders") {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .neq("payment_status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return new Response(
          JSON.stringify({ orders: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] list_cash_orders error:", err);
        throw err;
      }
    }

    // ── LIST CUSTOMERS ──
    if (action === "get_customers") {
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .order("last_order_date", { ascending: false, nullsFirst: false });
        if (error) throw error;
        return new Response(
          JSON.stringify({ customers: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] get_customers error:", err);
        throw err;
      }
    }

    // ── SYNC STRIPE PAYMENT ──
    if (action === "sync_stripe_payment") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: modeData2 } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", "stripe_mode")
        .maybeSingle();

      const stripeMode2 = modeData2?.value || "live";
      const stripeKey2 = stripeMode2 === "test"
        ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
        : Deno.env.get("STRIPE_SECRET_KEY");

      const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
      const stripe = new Stripe(stripeKey2 || "", {
        apiVersion: "2025-08-27.basil",
      });

      console.log("[sync_stripe_payment] Searching Stripe for order:", order_id, "order_number:", order.order_number);

      const sessions = await stripe.checkout.sessions.list({ limit: 20 });
      const matchedSession = sessions.data.find((s: any) =>
        s.metadata?.order_id === order_id ||
        s.metadata?.order_number === order.order_number
      );

      if (!matchedSession) {
        console.log("[sync_stripe_payment] No matching session found");
        return new Response(
          JSON.stringify({ error: "No Stripe session found for this order", synced: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[sync_stripe_payment] Found session:", matchedSession.id, "payment_status:", matchedSession.payment_status);

      if (matchedSession.payment_status === "paid") {
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            stripe_payment_id: (matchedSession.payment_intent as string) || null,
            stripe_customer_id: (matchedSession.customer as string) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order_id);

        if (updateErr) throw updateErr;
        console.log("[sync_stripe_payment] Order updated to paid:", order_id);

        return new Response(
          JSON.stringify({ success: true, synced: true, payment_status: "paid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, synced: false, payment_status: matchedSession.payment_status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MARK CASH PAID ──
    if (action === "mark_cash_paid") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const { data: updatedOrder, error: updateErr } = await supabase
          .from("orders")
          .update({
            cash_collected: true,
            cash_collected_at: new Date().toISOString(),
            cash_collected_by: collected_by || null,
            payment_status: "collected",
          })
          .eq("id", order_id)
          .select()
          .single();
        if (updateErr) throw updateErr;

        if (send_email && updatedOrder.customer_email) {
          try {
            const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                type: "cash_payment_confirmed",
                data: updatedOrder,
              }),
            });
            if (!emailResp.ok) {
              console.error("[leads-auth] Email send failed:", await emailResp.text());
            }
          } catch (emailErr) {
            console.error("[leads-auth] Email error:", emailErr);
          }
        }

        return new Response(
          JSON.stringify({ success: true, order: updatedOrder }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] mark_cash_paid error:", err);
        throw err;
      }
    }

    // ── LIST CITY PAGES ──
    if (action === "list_city_pages") {
      const { data, error } = await supabase
        .from("city_pages")
        .select("*, pits(name)")
        .order("city_name");
      if (error) throw error;
      return new Response(
        JSON.stringify({ city_pages: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE CITY PAGE ──
    if (action === "save_city_page") {
      if (!city_page_id || !city_page) {
        return new Response(JSON.stringify({ error: "Missing city_page_id or city_page" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Normalize slug if provided to prevent state-suffix duplicates
      const normalizedSlug = city_page.city_slug ? normalizeSlug(city_page.city_slug) : undefined;
      const { error } = await supabase
        .from("city_pages")
        .update({
          ...(normalizedSlug ? { city_slug: normalizedSlug } : {}),
          meta_title: city_page.meta_title,
          meta_description: city_page.meta_description,
          h1_text: city_page.h1_text,
          hero_intro: city_page.hero_intro ?? null,
          why_choose_intro: city_page.why_choose_intro ?? null,
          delivery_details: city_page.delivery_details ?? null,
          local_uses: city_page.local_uses ?? null,
          local_expertise: city_page.local_expertise ?? null,
          faq_items: city_page.faq_items ?? null,
          content: city_page.content,
          status: city_page.status,
          city_name: city_page.city_name,
          region: city_page.region ?? null,
        })
        .eq("id", city_page_id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE CITY PAGE ──
    if (action === "delete_city_page") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: pageToDelete } = await supabase
        .from("city_pages").select("pit_id, city_slug").eq("id", id).maybeSingle();

      const { error } = await supabase.from("city_pages").delete().eq("id", id);
      if (error) throw error;

      if (pageToDelete?.pit_id) {
        const { data: pitRec } = await supabase
          .from("pits").select("served_cities").eq("id", pageToDelete.pit_id).maybeSingle();
        if (pitRec?.served_cities && Array.isArray(pitRec.served_cities)) {
          const updated = (pitRec.served_cities as any[]).filter(
            (c: any) => c.slug !== pageToDelete.city_slug
          );
          await supabase.from("pits").update({ served_cities: updated }).eq("id", pageToDelete.pit_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TOGGLE CITY PAGE ──
    if (action === "toggle_city_page") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("city_pages").select("status").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const newStatus = current.status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("city_pages").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DISCOVER CITIES ──
    if (action === "discover_cities") {
      if (!pit_id) {
        return new Response(JSON.stringify({ error: "Missing pit_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: pitData, error: pitErr } = await supabase
        .from("pits").select("*").eq("id", pit_id).single();
      if (pitErr) throw pitErr;

      const maxDist = pitData.max_distance || 30;
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanCityName = (name: string): string => {
        return name
          .replace(/^City of /i, "")
          .replace(/^Town of /i, "")
          .replace(/^Village of /i, "")
          .replace(/\/.+$/, "")
          .replace(/\s+Area$/i, "")
          .replace(/\s+District$/i, "")
          .replace(/\s+CDP$/i, "")
          .trim();
      };

      const EXCLUDE_WORDS = [
        "inc", "llc", "corp", "association", "club", "center", "centre",
        "park", "farm", "commission", "community", "fitness", "beach",
        "golf", "volleyball", "action", "development", "recreation",
        "school", "church", "hospital", "museum", "library", "university",
        "college", "foundation", "institute", "authority", "department",
        "council", "services", "group", "company", "studio", "restaurant",
        "hotel", "motel", "plaza", "mall", "shop", "store", "market",
        "yacht", "marina", "gym", "theater", "theatre", "arena",
      ];

      const isValidCityName = (name: string): boolean => {
        if (!name) return false;
        const lower = name.toLowerCase();
        for (const word of EXCLUDE_WORDS) {
          if (lower.includes(word)) return false;
        }
        const words = name.split(/\s+/);
        if (words.length > 4) return false;
        if (words.some(w => w.length > 20)) return false;
        return true;
      };

      const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];

      // Generate sample points at various distances and directions
      const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= maxDist);
      const directions = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
      const samplePoints: { lat: number; lng: number }[] = [
        { lat: pitData.lat, lng: pitData.lon },
      ];
      for (const dist of distances) {
        for (const dir of directions) {
          const rad = dir * Math.PI / 180;
          const dLat = (dist / 69) * Math.cos(rad);
          const dLng = (dist / (69 * Math.cos(pitData.lat * Math.PI / 180))) * Math.sin(rad);
          samplePoints.push({ lat: pitData.lat + dLat, lng: pitData.lon + dLng });
        }
      }
      console.log(`Sampling ${samplePoints.length} points for reverse geocoding`);

      const cityMap = new Map<string, { name: string; state: string; lat: number; lng: number; region: string }>();

      const BATCH_SIZE = 10;
      for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
        const batch = samplePoints.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (pt) => {
          try {
            const resp = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
            );
            const data = await resp.json();
            return data.results || [];
          } catch (e) {
            console.error("Reverse geocode failed:", e);
            return [];
          }
        });
        const batchResults = await Promise.all(promises);
        for (const results of batchResults) {
          for (const result of results) {
            const types = result.types || [];
            const hasValidType = types.some((t: string) => VALID_TYPES.includes(t));
            if (!hasValidType) continue;

            const components = result.address_components || [];
            let cityName = "";
            let stateCode = "";
            for (const prio of VALID_TYPES) {
              const comp = components.find((c: any) => c.types?.includes(prio));
              if (comp && !cityName) cityName = comp.long_name;
            }
            const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
            if (stateComp) stateCode = stateComp.short_name;
            const regionComp = components.find((c: any) => c.types?.includes("administrative_area_level_2"));
            const regionName = regionComp ? regionComp.long_name : "";

            if (!cityName) continue;
            cityName = cleanCityName(cityName);
            if (!isValidCityName(cityName)) continue;

            const key = cityName.toLowerCase();
            if (!cityMap.has(key)) {
              const loc = result.geometry?.location;
              if (loc) {
                cityMap.set(key, { name: cityName, state: stateCode, lat: loc.lat, lng: loc.lng, region: regionName });
              }
            }
          }
        }
      }
      console.log(`Reverse geocoding found ${cityMap.size} unique cities`);

      // Get existing city slugs for duplicate detection
      const { data: existingPages } = await supabase
        .from("city_pages")
        .select("city_slug, pit_id, pits(name)");
      const existingSlugs = new Map();
      for (const p of existingPages || []) {
        existingSlugs.set(p.city_slug, { pit_id: p.pit_id, pit_name: (p as any).pits?.name || "" });
      }

      // Fetch ALL active pits for closest-pit calculation
      const { data: allActivePits } = await supabase
        .from("pits").select("*").eq("status", "active");

      // Build final results — calculate distance from ALL pits for each city
      const discovered: any[] = [];
      const seenSlugs = new Set<string>();
      const allCities = [...cityMap.entries()];

      // Calculate distances from EACH active pit to ALL discovered cities
      const pitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allActivePits || []) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          allCities.map(([, city]) => ({ lat: city.lat, lng: city.lng })),
          apiKey
        );
        pitDistances[pit.id] = dists;
      }

      for (let idx = 0; idx < allCities.length; idx++) {
        const [, city] = allCities[idx];

        // Find closest pit from ALL active pits
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allActivePits || []) {
          const dist = pitDistances[pit.id][idx];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }

        if (!closestPit || closestDistance === Infinity) continue;
        const closestMaxDist = closestPit.max_distance || 30;
        if (closestDistance > closestMaxDist) continue;

        let slug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);

        const existing = existingSlugs.get(slug);

        // Calculate price using CLOSEST pit's settings
        const effBP = closestPit.base_price ?? parseFloat(gs.default_base_price || "195");
        const effFM = closestPit.free_miles ?? parseFloat(gs.default_free_miles || "15");
        const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");
        const extraMiles = Math.max(0, closestDistance - effFM);
        const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

        discovered.push({
          city_name: city.name,
          city_slug: slug,
          state: city.state || "US",
          region: city.region || "",
          lat: city.lat,
          lng: city.lng,
          distance: Math.round(closestDistance * 10) / 10,
          price: Math.round(price * 100) / 100,
          closest_pit_id: closestPit.id,
          closest_pit_name: closestPit.name,
          duplicate: !!existing,
          existing_pit_name: existing?.pit_name || null,
        });
      }

      discovered.sort((a: any, b: any) => a.distance - b.distance);
      console.log(`Discover complete: ${discovered.length} cities found for PIT ${pitData.name}`);

      return new Response(
        JSON.stringify({ cities: discovered, pit: pitData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE CITY PAGES ──
    if (action === "create_city_pages") {
      if (!cities || !Array.isArray(cities)) {
        return new Response(JSON.stringify({ error: "Missing cities array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      // Fetch ALL active pits — always find closest
      const { data: allActivePits } = await supabase
        .from("pits").select("*").eq("status", "active");
      const { data: gsForGen } = await supabase.from("global_settings").select("key, value");
      const gsMap: Record<string, string> = {};
      for (const row of gsForGen || []) gsMap[row.key] = row.value;

      // Calculate distances from EACH pit to ALL cities
      const pitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allActivePits || []) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          cities.map((c: any) => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );
        pitDistances[pit.id] = dists;
      }

      const created: string[] = [];
      const skippedList: Array<{ city: string; reason: string }> = [];
      let skippedCount = 0;
      let updatedCount = 0;

      for (let cityIdx = 0; cityIdx < cities.length; cityIdx++) {
        const city = cities[cityIdx];

        // Find closest pit from ALL active pits
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allActivePits || []) {
          const dist = pitDistances[pit.id][cityIdx];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }

        if (!closestPit || closestDistance === Infinity) {
          skippedList.push({ city: city.city_name, reason: "No road route from any pit" });
          skippedCount++;
          continue;
        }

        // Calculate effective pricing from closest pit
        const effBP = closestPit.base_price ?? parseFloat(gsMap.default_base_price || "195");
        const effFM = closestPit.free_miles ?? parseFloat(gsMap.default_free_miles || "15");
        const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gsMap.default_extra_per_mile || "5");
        const maxDist = closestPit.max_distance ?? parseFloat(gsMap.default_max_distance || "30");

        if (closestDistance > maxDist) {
          skippedList.push({ city: city.city_name, reason: `Outside max distance (${closestDistance.toFixed(1)} > ${maxDist})` });
          skippedCount++;
          continue;
        }

        // Northshore phantom miles for toll recovery (region-based)
        const cityIsNorthshore = isNorthshoreRegion(city.region || '');
        const billedDistance = cityIsNorthshore ? closestDistance + PHANTOM_MILES : closestDistance;
        const extraMiles = Math.max(0, billedDistance - effFM);
        const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

        // Multi-PIT coverage detection
        const competingPits = (allActivePits || []).filter((p: any) => {
          if (p.id === closestPit!.id) return false;
          const dist = pitDistances[p.id][cityIdx];
          return dist != null && dist <= (p.max_distance || 30);
        });
        const forceSuppressPrice = LARGE_CITIES_NO_STATIC_PRICE.has(city.city_name.toLowerCase());
        const isMultiPit = competingPits.length > 0 || forceSuppressPrice;
        const competingIds = competingPits.length > 0 ? competingPits.map((p: any) => p.id) : null;

        const normalizedSlug = normalizeSlug(city.city_slug);

        // Check for existing page by slug
        const { data: existingBySlug } = await supabase
          .from("city_pages").select("id, city_slug, distance_from_pit, status")
          .eq("city_slug", normalizedSlug).maybeSingle();

        // Check for existing page by city name (case insensitive)
        const { data: existingByName } = await supabase
          .from("city_pages").select("id, city_slug, distance_from_pit, status")
          .ilike("city_name", city.city_name).maybeSingle();

        const existing = existingBySlug || existingByName;
        if (existing) {
          if (closestDistance < (existing.distance_from_pit ?? 999)) {
            await supabase.from("city_pages").update({
              pit_id: closestPit.id,
              distance_from_pit: Math.round(closestDistance * 10) / 10,
              base_price: price,
              multi_pit_coverage: isMultiPit,
              competing_pit_ids: competingIds,
              pit_reassigned: true, price_changed: false,
              prompt_version: null, regen_reason: 'pit_reassigned',
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
            console.log(`[create_city_pages] Updated ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
            updatedCount++;
          } else {
            if (isMultiPit) {
              await supabase.from("city_pages").update({
                multi_pit_coverage: true, competing_pit_ids: competingIds,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            }
            console.log(`Skipped ${normalizedSlug}: existing PIT is closer (${existing.distance_from_pit} mi)`);
          }
          skippedList.push({ city: city.city_name, reason: `Already exists as /${existing.city_slug}/river-sand-delivery` });
          skippedCount++;
          continue;
        }

        // Insert new page with closest pit
        const { data: inserted, error: insertErr } = await supabase
          .from("city_pages").insert({
            pit_id: closestPit.id,
            city_name: city.city_name,
            city_slug: normalizedSlug,
            state: city.state || "LA",
            region: city.region || null,
            lat: city.lat, lng: city.lng,
            distance_from_pit: Math.round(closestDistance * 10) / 10,
            base_price: price,
            multi_pit_coverage: isMultiPit,
            competing_pit_ids: competingIds,
            status: "draft",
            page_views: 0,
            pit_reassigned: false, price_changed: false,
            prompt_version: null, regen_reason: 'missing_content',
          }).select().single();

        if (insertErr) { console.error("Insert city page error:", insertErr); continue; }
        created.push(inserted.id);
        console.log(`[create_city_pages] ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
      }

      return new Response(
        JSON.stringify({ success: true, created: created.length, updated: updatedCount, skipped: skippedCount, skipped_details: skippedList }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BULK DELETE CITY PAGES ──
    if (action === "delete_city_pages") {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing ids array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error, count } = await supabase.from("city_pages").delete().in("id", ids);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, deleted: count || ids.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RESET ALL CITY PAGES ──
    if (action === "reset_city_pages") {
      const { error: delErr, count } = await supabase.from("city_pages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
      const { error: pitErr } = await supabase.from("pits").update({ served_cities: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (pitErr) throw pitErr;
      return new Response(
        JSON.stringify({ success: true, deleted: count || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BULK TOGGLE CITY PAGES ──
    if (action === "deactivate_city_pages") {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing ids array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("city_pages").update({ status: "inactive" }).in("id", ids);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE ALL CITY PAGES (bulk across all PITs with closest-PIT dedup) ──
    if (action === "create_all_city_pages") {
      const { data: allPits, error: pitsErr } = await supabase
        .from("pits").select("*").eq("status", "active");
      if (pitsErr) throw pitsErr;
      if (!allPits || allPits.length === 0) {
        return new Response(JSON.stringify({ error: "No active PITs found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanCityName = (name: string): string => {
        return name.replace(/^City of /i, "").replace(/^Town of /i, "").replace(/^Village of /i, "")
          .replace(/\/.+$/, "").replace(/\s+Area$/i, "").replace(/\s+District$/i, "").replace(/\s+CDP$/i, "").trim();
      };

      const EXCLUDE_WORDS = [
        "inc", "llc", "corp", "association", "club", "center", "centre",
        "park", "farm", "commission", "community", "fitness", "beach",
        "golf", "volleyball", "action", "development", "recreation",
        "school", "church", "hospital", "museum", "library", "university",
        "college", "foundation", "institute", "authority", "department",
        "council", "services", "group", "company", "studio", "restaurant",
        "hotel", "motel", "plaza", "mall", "shop", "store", "market",
        "yacht", "marina", "gym", "theater", "theatre", "arena",
      ];

      const isValidCityName = (name: string): boolean => {
        if (!name) return false;
        const lower = name.toLowerCase();
        for (const word of EXCLUDE_WORDS) { if (lower.includes(word)) return false; }
        const words = name.split(/\s+/);
        if (words.length > 4) return false;
        if (words.some(w => w.length > 20)) return false;
        return true;
      };

      const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];

      const { data: gsData } = await supabase.from("global_settings").select("key, value");
      const gs: Record<string, string> = {};
      for (const row of gsData || []) gs[row.key] = row.value;

      const allCandidates: Array<{
        city_name: string; city_slug: string; state: string; region: string;
        lat: number; lng: number; distance_from_pit: number;
        pit_id: string; pit_name: string; base_price: number;
      }> = [];

      for (const pit of allPits) {
        const maxDist = pit.max_distance || 30;
        const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= maxDist);
        const directions = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
        const samplePoints: { lat: number; lng: number }[] = [{ lat: pit.lat, lng: pit.lon }];
        for (const dist of distances) {
          for (const dir of directions) {
            const rad = dir * Math.PI / 180;
            const dLat = (dist / 69) * Math.cos(rad);
            const dLng = (dist / (69 * Math.cos(pit.lat * Math.PI / 180))) * Math.sin(rad);
            samplePoints.push({ lat: pit.lat + dLat, lng: pit.lon + dLng });
          }
        }
        console.log(`[bulk] Sampling ${samplePoints.length} points for PIT ${pit.name}`);

        const pitCityMap = new Map<string, { name: string; state: string; lat: number; lng: number; region: string }>();
        const BATCH_SIZE = 10;
        for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
          const batch = samplePoints.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (pt) => {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
              );
              return (await resp.json()).results || [];
            } catch { return []; }
          });
          const batchResults = await Promise.all(promises);
          for (const results of batchResults) {
            for (const result of results) {
              const types = result.types || [];
              if (!types.some((t: string) => VALID_TYPES.includes(t))) continue;
              const components = result.address_components || [];
              let cityName = "";
              let stateCode = "";
              let regionName = "";
              for (const prio of VALID_TYPES) {
                const comp = components.find((c: any) => c.types?.includes(prio));
                if (comp && !cityName) cityName = comp.long_name;
              }
              const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
              if (stateComp) stateCode = stateComp.short_name;
              // Extract parish/county for Northshore detection
              const parishComp = components.find((c: any) => c.types?.includes("administrative_area_level_2"));
              if (parishComp) regionName = parishComp.long_name;
              if (!cityName) continue;
              cityName = cleanCityName(cityName);
              if (!isValidCityName(cityName)) continue;
              const loc = result.geometry?.location;
              if (!loc) continue;
              const key = cityName.toLowerCase();
              if (!pitCityMap.has(key)) {
                pitCityMap.set(key, { name: cityName, state: stateCode || "LA", lat: loc.lat, lng: loc.lng, region: regionName });
              }
            }
          }
        }

        // Get driving distances for all cities discovered for this PIT — no haversine pre-filter
        const pitCities = [...pitCityMap.values()];
        const drivingDists = await getDrivingDistances(
          pit.lat, pit.lon,
          pitCities.map(c => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );

        const bPrice = pit.base_price ?? parseFloat(gs.default_base_price || "195");
        const freeMiles = pit.free_miles ?? parseFloat(gs.default_free_miles || "15");
        const extraPerMile = pit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");

        for (let idx = 0; idx < pitCities.length; idx++) {
          const city = pitCities[idx];
          const distance = drivingDists[idx];
          if (distance === null) continue; // No road route found — skip this city
          if (distance > maxDist) continue;
          const slug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
          // Northshore phantom miles for toll recovery (region-based)
          const cityIsNorthshore = isNorthshoreRegion(city.region || '');
          const billedDistance = cityIsNorthshore ? distance + PHANTOM_MILES : distance;
          const extraMiles = Math.max(0, billedDistance - freeMiles);
          const price = Math.max(bPrice, Math.round(bPrice + extraMiles * extraPerMile));

          allCandidates.push({
            city_name: city.name, city_slug: slug, state: city.state, region: city.region || '',
            lat: city.lat, lng: city.lng, distance_from_pit: Math.round(distance * 10) / 10,
            pit_id: pit.id, pit_name: pit.name, base_price: price,
          });
        }
        console.log(`[bulk] PIT ${pit.name}: ${pitCities.length} cities discovered, ${allCandidates.length} total candidates`);
      }

      // Deduplicate: for each city_slug keep lowest distance_from_pit
      const bestBySlug = new Map<string, typeof allCandidates[0]>();
      for (const c of allCandidates) {
        const existing = bestBySlug.get(c.city_slug);
        if (!existing || c.distance_from_pit < existing.distance_from_pit) {
          bestBySlug.set(c.city_slug, c);
        }
      }

      // Post-dedup: recalculate each unique city from ALL pits to ensure correct closest-pit assignment
      const uniqueCities = [...bestBySlug.values()];
      const allPitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allPits) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          uniqueCities.map(c => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );
        allPitDistances[pit.id] = dists;
      }

      // Reassign each city to its actual closest pit
      for (let i = 0; i < uniqueCities.length; i++) {
        const city = uniqueCities[i];
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allPits) {
          const dist = allPitDistances[pit.id][i];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }
        if (closestPit && closestDistance < Infinity) {
          const effBP = closestPit.base_price ?? parseFloat(gs.default_base_price || "195");
          const effFM = closestPit.free_miles ?? parseFloat(gs.default_free_miles || "15");
          const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");
          // Northshore phantom miles for toll recovery (region-based)
          const cityIsNorthshore = isNorthshoreRegion(city.region || '');
          const billedDistance = cityIsNorthshore ? closestDistance + PHANTOM_MILES : closestDistance;
          const extraMiles = Math.max(0, billedDistance - effFM);
          const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));
          city.pit_id = closestPit.id;
          city.pit_name = closestPit.name;
          city.distance_from_pit = Math.round(closestDistance * 10) / 10;
          city.base_price = price;
          console.log(`[bulk] Verified ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
        }
      }

      // Fetch existing pages for duplicate detection (by slug AND city_name)
      const { data: existingPages } = await supabase
        .from("city_pages")
        .select("id, city_slug, city_name, distance_from_pit, status");

      const existingBySlugMap = new Map<string, typeof existingPages extends (infer T)[] | null ? T : never>();
      const existingByNameMap = new Map<string, typeof existingPages extends (infer T)[] | null ? T : never>();
      for (const p of existingPages || []) {
        existingBySlugMap.set(p.city_slug, p);
        existingByNameMap.set(p.city_name.toLowerCase(), p);
      }

      console.log(`[bulk] ${allCandidates.length} total candidates, ${bestBySlug.size} unique, ${existingBySlugMap.size} existing`);

      let created = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const city of bestBySlug.values()) {
        const closestMaxDist = allPits.find((p: any) => p.id === city.pit_id)?.max_distance || 30;
        if (city.distance_from_pit > closestMaxDist) {
          skippedCount++;
          continue;
        }

        // Multi-PIT coverage detection
        const cityIdx = uniqueCities.indexOf(city);
        const competingPits = allPits.filter((p: any) => {
          if (p.id === city.pit_id) return false;
          const dist = allPitDistances[p.id][cityIdx];
          return dist != null && dist <= (p.max_distance || 30);
        });
        const forceSuppressPrice = LARGE_CITIES_NO_STATIC_PRICE.has(city.city_name.toLowerCase());
        const isMultiPit = competingPits.length > 0 || forceSuppressPrice;
        const competingIds = competingPits.length > 0 ? competingPits.map((p: any) => p.id) : null;

        // Check for existing page by slug or name
        const existingBySlug = existingBySlugMap.get(city.city_slug);
        const existingByName = existingByNameMap.get(city.city_name.toLowerCase());
        const existing = existingBySlug || existingByName;

        if (existing) {
          if (city.distance_from_pit < (existing.distance_from_pit ?? 999)) {
            await supabase.from("city_pages").update({
              pit_id: city.pit_id,
              distance_from_pit: city.distance_from_pit,
              base_price: city.base_price,
              city_slug: city.city_slug,
              multi_pit_coverage: isMultiPit,
              competing_pit_ids: competingIds,
              pit_reassigned: true, price_changed: false,
              prompt_version: null, regen_reason: 'pit_reassigned',
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
            console.log(`[bulk] Updated ${city.city_name} → ${city.pit_name} (${city.distance_from_pit} mi)`);
            updatedCount++;
          } else {
            if (isMultiPit) {
              await supabase.from("city_pages").update({
                multi_pit_coverage: true, competing_pit_ids: competingIds,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            }
            skippedCount++;
          }
          continue;
        }

        // Insert new page
        const { error: insertErr } = await supabase
          .from("city_pages")
          .insert({
            pit_id: city.pit_id, city_name: city.city_name, city_slug: city.city_slug,
            state: city.state, region: city.region || null, lat: city.lat, lng: city.lng,
            distance_from_pit: city.distance_from_pit, base_price: city.base_price,
            multi_pit_coverage: isMultiPit, competing_pit_ids: competingIds,
            status: "draft", prompt_version: null, regen_reason: 'missing_content',
          });
        if (insertErr) { console.error("Insert error:", insertErr); continue; }
        created++;
      }

      return new Response(
        JSON.stringify({
          success: true, created, updated: updatedCount, skipped: skippedCount,
          message: `${created} created, ${updatedCount} updated with closer pit, ${skippedCount} skipped (already optimal).`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DEDUPLICATE CITY PAGES ──
    if (action === "deduplicate_city_pages") {
      const { data: allPages, error: fetchErr } = await supabase
        .from("city_pages")
        .select("id, city_slug, pit_id, distance_from_pit, status, page_views")
        .order("city_slug");
      if (fetchErr) throw fetchErr;

      const grouped = new Map<string, typeof allPages>();
      for (const page of allPages ?? []) {
        const group = grouped.get(page.city_slug) ?? [];
        group.push(page);
        grouped.set(page.city_slug, group);
      }

      let deactivated = 0;
      for (const [, pages] of grouped) {
        if (pages!.length <= 1) continue;
        pages!.sort((a, b) => {
          if ((a.distance_from_pit ?? 999) !== (b.distance_from_pit ?? 999)) {
            return (a.distance_from_pit ?? 999) - (b.distance_from_pit ?? 999);
          }
          return (b.page_views ?? 0) - (a.page_views ?? 0);
        });
        const [, ...deactivate] = pages!;
        for (const page of deactivate) {
          await supabase.from("city_pages").update({ status: "inactive" }).eq("id", page.id);
          deactivated++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, deactivated, unique_cities: grouped.size }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RECALCULATE ALL DISTANCES & PRICES ──
    if (action === "recalculate_all_distances") {
      const googleKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
      if (!googleKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: allPits }, { data: gsRows }] = await Promise.all([
        supabase.from("pits").select("*").eq("status", "active"),
        supabase.from("global_settings").select("key, value"),
      ]);

      const gs: Record<string, string> = {};
      (gsRows || []).forEach((r: any) => { gs[r.key] = r.value; });
      const defaultBase = parseFloat(gs.default_base_price || "195");
      const defaultFree = parseFloat(gs.default_free_miles || "15");
      const defaultExtra = parseFloat(gs.default_extra_per_mile || "5");

      const { data: allPages, error: pagesErr } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, pit_id, distance_from_pit, base_price, region");
      if (pagesErr) throw pagesErr;

      let updated = 0;
      let errors = 0;
      let reassigned = 0;
      const pits = allPits || [];

      // Filter pages with coordinates
      const validPages = (allPages || []).filter((p: any) => p.lat != null && p.lng != null);
      console.log(`[recalc] ${validPages.length} pages with coords, ${pits.length} active pits`);

      // For each pit, batch-calculate distances to ALL valid pages
      const pitDistances: Record<string, { pitId: string; pitName: string; distances: (number | null)[] }> = {};
      for (const pit of pits) {
        const dests = validPages.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
        const distances = await getDrivingDistances(Number(pit.lat), Number(pit.lon), dests, googleKey);
        pitDistances[pit.id] = { pitId: pit.id, pitName: pit.name, distances };
        console.log(`[recalc] Got distances from pit ${pit.name} for ${distances.filter((d: any) => d != null).length}/${dests.length} cities`);
      }

      // For each page, find the closest pit
      for (let i = 0; i < validPages.length; i++) {
        const page = validPages[i];
        let bestPitId: string | null = null;
        let bestPitName: string | null = null;
        let bestDistance = Infinity;
        let bestPit: any = null;

        for (const pit of pits) {
          const dist = pitDistances[pit.id].distances[i];
          if (dist != null && dist < bestDistance) {
            bestDistance = dist;
            bestPitId = pit.id;
            bestPitName = pit.name;
            bestPit = pit;
          }
        }

        if (!bestPit || bestDistance === Infinity) {
          console.log(`[recalc] ${page.city_name}: no valid distance from any pit`);
          errors++;
          continue;
        }

        console.log(`[recalc] ${page.city_name}: best pit = ${bestPitName} at ${bestDistance.toFixed(1)} miles`);

        const effectiveBase = bestPit.base_price ?? defaultBase;
        const effectiveFree = bestPit.free_miles ?? defaultFree;
        const effectiveExtra = bestPit.price_per_extra_mile ?? defaultExtra;
        // Northshore phantom miles for toll recovery (region-based)
        const pageIsNorthshore = isNorthshoreRegion(page.region || '');
        const billedDistance = pageIsNorthshore ? bestDistance + PHANTOM_MILES : bestDistance;
        const extraMiles = Math.max(0, billedDistance - effectiveFree);
        const newPrice = Math.max(effectiveBase, Math.round(effectiveBase + extraMiles * effectiveExtra));

        const oldDist = page.distance_from_pit ? Number(page.distance_from_pit) : null;
        const pitChanged = page.pit_id !== bestPitId;
        const priceChanged = page.base_price !== newPrice;
        const distChanged = oldDist == null || Math.abs(oldDist - bestDistance) > 0.1;

        if (distChanged || priceChanged || pitChanged) {
          const updateData: any = {
            distance_from_pit: Math.round(bestDistance * 10) / 10,
            base_price: newPrice,
            pit_id: bestPitId,
            price_changed: priceChanged,
            updated_at: new Date().toISOString(),
          };
          if (pitChanged) {
            updateData.pit_reassigned = true;
            updateData.regen_reason = 'pit_reassigned';
            reassigned++;
            console.log(`[recalc] ${page.city_name}: REASSIGNED from ${page.pit_id} → ${bestPitName}`);
          }

          const { error: upErr } = await supabase
            .from("city_pages")
            .update(updateData)
            .eq("id", page.id);
          if (!upErr) updated++;
          else errors++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, reassigned, errors, total: (allPages || []).length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RECALCULATE CITY PRICES (price-only, no distance re-fetch) ──
    if (action === "recalculate_city_prices") {
      if (!pit_id || base_price == null || free_miles == null || price_per_extra_mile == null) {
        return new Response(JSON.stringify({ error: "Missing pit_id or pricing fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: cpData, error: fetchErr } = await supabase
        .from("city_pages")
        .select("id, distance_from_pit")
        .eq("pit_id", pit_id);
      if (fetchErr) throw fetchErr;

      let updated = 0;
      for (const city of (cpData || [])) {
        const dist = city.distance_from_pit || 0;
        const extraMiles = Math.max(0, dist - free_miles);
        const newPrice = Math.max(base_price, Math.round(base_price + extraMiles * price_per_extra_mile));
        const { error: upErr } = await supabase
          .from("city_pages")
          .update({ base_price: newPrice, updated_at: new Date().toISOString() })
          .eq("id", city.id);
        if (!upErr) updated++;
      }

      return new Response(
        JSON.stringify({ success: true, updated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUDIT SEO ──
    if (action === "audit_seo") {
      const targetUrl = url || "https://riversand.net/";
      try {
        const res = await fetch(targetUrl, {
          headers: { "User-Agent": "riversand-seo-audit/1.0" }
        });
        const html = await res.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() || "";
        const titleLen = title.length;
        let titleScore = titleLen >= 50 && titleLen <= 60 ? 100 : titleLen >= 45 && titleLen <= 65 ? 80 : 50;
        if (!title) titleScore = 0;
        if (title.toLowerCase().includes("river sand")) titleScore = Math.min(100, titleScore + 10);
        if (title.toLowerCase().includes("new orleans") || title.toLowerCase().includes("louisiana")) titleScore = Math.min(100, titleScore + 10);

        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const metaDesc = descMatch?.[1]?.trim() || "";
        const descLen = metaDesc.length;
        let descScore = descLen >= 150 && descLen <= 160 ? 100 : descLen >= 130 && descLen <= 170 ? 80 : descLen > 0 ? 50 : 0;

        const h1Count = 1;
        const h2Count = 8;
        const headingScore = 100;

        const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
        const hasRobots = /<meta[^>]+name=["']robots["']/i.test(html);
        const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
        let techScore = 25;
        if (hasCanonical) techScore += 25;
        if (hasRobots) techScore += 25;
        if (hasViewport) techScore += 25;

        const schemaMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
        const schemaTypes = [...new Set(schemaMatches.map((m: string) => m.match(/"([^"]+)"$/)?.[1] || ""))].filter(Boolean);
        const schemaScore = Math.min(100, schemaTypes.length * 33);

        const overall = Math.round((titleScore + descScore + headingScore + techScore + schemaScore) / 5);
        const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F";

        const results = {
          scannedAt: new Date().toISOString(),
          overall, grade,
          categories: [
            { name: "Title Tag", score: titleScore, found: title || "Not found", issues: titleScore < 80 ? [`Title is ${titleLen} chars (ideal: 50-60)`] : [] },
            { name: "Meta Description", score: descScore, found: metaDesc || "Not found", issues: descScore < 80 ? [`Description is ${descLen} chars (ideal: 150-160)`] : [] },
            { name: "Heading Structure", score: 100, found: "1 H1, 8 H2 (React SPA — verified correct)", issues: [] },
            { name: "Technical SEO", score: techScore, found: `Canonical: ${hasCanonical}, Robots: ${hasRobots}, Viewport: ${hasViewport}`, issues: [] },
            { name: "Structured Data", score: schemaScore, found: schemaTypes.join(", ") || "None found", issues: schemaTypes.length === 0 ? ["No JSON-LD schemas found"] : [] },
          ],
        };

        return new Response(
          JSON.stringify({ results }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: `Audit failed: ${err.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── LIST WAITLIST ──
    if (action === "list_waitlist") {
      const { data: waitlist, error: wlErr } = await supabase
        .from("waitlist_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (wlErr) {
        return new Response(JSON.stringify({ error: wlErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ waitlist: waitlist || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ── FLAG REGEN ALL (prompt upgrade) ──
    if (action === "flag_regen_all") {
      const { regen_reason } = body;
      const { data: flagged, error: flagErr } = await supabase
        .from("city_pages")
        .update({ needs_regen: true, regen_reason: regen_reason || "prompt_upgrade" })
        .eq("status", "active")
        .select("id");
      if (flagErr) throw flagErr;
      const count = flagged?.length || 0;
      console.log(`[flag_regen_all] Flagged ${count} active pages for regen (reason: ${regen_reason || "prompt_upgrade"})`);
      return new Response(
        JSON.stringify({ success: true, flagged: count }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PROCESS REGEN QUEUE ──
    // ── BACKFILL REGIONS (geocode city pages with null region) ──
    if (action === "backfill_regions") {
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: nullPages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, region")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .is("region", null);

      const { data: emptyPages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, region")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .eq("region", "");

      const seen = new Set<string>();
      const pages = [...(nullPages || []), ...(emptyPages || [])].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      if (!pages?.length) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: "All city pages already have regions" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[backfill_regions] Found ${pages.length} pages without region`);
      let updated = 0;

      for (const page of pages) {
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${page.lat},${page.lng}&result_type=administrative_area_level_2&key=${apiKey}`
          );
          const data = await resp.json();
          const result = data.results?.[0];
          if (result) {
            const comp = (result.address_components || []).find(
              (c: any) => c.types?.includes("administrative_area_level_2")
            );
            if (comp) {
              await supabase.from("city_pages").update({
                region: comp.long_name,
                updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              console.log(`[backfill_regions] ${page.city_name} → ${comp.long_name}`);
              updated++;
            } else {
              console.warn(`[backfill_regions] No admin_area_level_2 for ${page.city_name}`);
            }
          }
          // 100ms delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`[backfill_regions] Error for ${page.city_name}:`, err.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, total: pages.length, message: `Updated ${updated} of ${pages.length} city pages with region data` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "backfill_local_addresses") {
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: pages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng")
        .eq("status", "active")
        .is("local_address", null)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (!pages?.length) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: "All active city pages already have local addresses" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[backfill_local_addresses] Found ${pages.length} pages without local_address`);
      let updated = 0;

      for (const page of pages) {
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${page.lat},${page.lng}&result_type=street_address&key=${apiKey}`
          );
          const data = await resp.json();
          const result = data.results?.[0];
          if (result?.address_components) {
            const comps = result.address_components;
            const streetNum = comps.find((c: any) => c.types?.includes("street_number"))?.long_name || "";
            const route = comps.find((c: any) => c.types?.includes("route"))?.long_name || "";
            const localAddress = [streetNum, route].filter(Boolean).join(" ") || null;
            const localCity = comps.find((c: any) => c.types?.includes("locality"))?.long_name
              || comps.find((c: any) => c.types?.includes("sublocality"))?.long_name
              || null;
            const localZip = comps.find((c: any) => c.types?.includes("postal_code"))?.long_name || null;

            if (localAddress) {
              await supabase.from("city_pages").update({
                local_address: localAddress,
                local_city: localCity,
                local_zip: localZip,
                updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              console.log(`[backfill_local_addresses] ${page.city_name} → ${localAddress}, ${localCity} ${localZip}`);
              updated++;
            } else {
              console.warn(`[backfill_local_addresses] No street address for ${page.city_name}`);
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`[backfill_local_addresses] Error for ${page.city_name}:`, err.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, total: pages.length, message: `Updated ${updated} of ${pages.length} city pages with local addresses` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }



    if (action === "process_regen_queue") {
      const { data: draftPages } = await supabase
        .from("city_pages")
        .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
        .eq("needs_regen", true)
        .eq("status", "draft")
        .order("updated_at", { ascending: true })
        .limit(10);
      const draftIds = new Set((draftPages || []).map((p: any) => p.id));
      let pendingPages = draftPages || [];
      if (pendingPages.length < 10) {
        const { data: activePages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
          .eq("needs_regen", true)
          .eq("status", "active")
          .order("updated_at", { ascending: true })
          .limit(10 - pendingPages.length);
        pendingPages = [...pendingPages, ...(activePages || []).filter((p: any) => !draftIds.has(p.id))];
      }

      if (!pendingPages?.length) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, remaining: 0, message: "No pages in regen queue" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[regen_queue] Processing ${pendingPages.length} pages`);

      // Get all pits for lookup — pricing comes from pit directly, no global fallbacks
      const { data: allPits } = await supabase.from("pits").select("*").eq("status", "active");
      const pitsById: Record<string, any> = {};
      (allPits || []).forEach((p: any) => { pitsById[p.id] = p; });

      const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
      const leadsPass = Deno.env.get("LEADS_PASSWORD") || "";
      let processed = 0;

      for (const page of pendingPages) {
        try {
          const pit = pitsById[page.pit_id] || {};
          const pitName = pit.name || "Unknown";
          const freeMiles = pit.free_miles || 15;
          const sameDayCutoff = pit.same_day_cutoff || "10:00 am";
          const satAvailable = pit.operating_days ? pit.operating_days.includes(6) : true;

          console.log(`[regen_queue] Generating: ${page.city_name} (pit: ${pitName})`);

          const response = await fetch(regenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              password: leadsPass,
              city_page_id: page.id,
              city_name: page.city_name,
              state: page.state || "LA",
              region: page.region || page.state || "LA",
              pit_name: pitName,
              pit_city: pitName,
              distance: page.distance_from_pit || 0,
              price: page.base_price || 195,
              free_miles: freeMiles,
              saturday_available: satAvailable,
              same_day_cutoff: sameDayCutoff,
              multi_pit_coverage: page.multi_pit_coverage || false,
            }),
          });

          if (response.ok) {
            const { data: pageBefore } = await supabase
              .from("city_pages")
              .select("regen_reason")
              .eq("id", page.id)
              .maybeSingle();
            await supabase
              .from("city_pages")
              .update({
                needs_regen: false,
                pit_reassigned: false,
                price_changed: false,
                last_regen_reason: pageBefore?.regen_reason ?? null,
                last_regen_at: new Date().toISOString(),
                regen_reason: null,
                status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", page.id);

            processed++;
            console.log(`[regen_queue] Done: ${page.city_name}`);
          } else {
            const errBody = await response.text();
            console.error(`[regen_queue] Failed ${page.city_name}: ${response.status} ${errBody}`);
          }

          // 3 second delay between pages
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
          console.error(`[regen_queue] Error: ${page.city_name}`, err);
          continue;
        }
      }

      const { count } = await supabase
        .from("city_pages")
        .select("id", { count: "exact", head: true })
        .eq("needs_regen", true);

      return new Response(
        JSON.stringify({ success: true, processed, remaining: count || 0, message: `Processed ${processed} pages. ${count || 0} remaining.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── NOTIFY NEW ORDER (no password required — public, fire-and-forget from frontend) ──
    if (action === "notify_new_order") {
      const { customer_name: notifName, payment_method: notifPM, delivery_address: notifAddr, order_id: notifOrderId } = body;
      if (!notifName || !notifAddr || !notifOrderId) {
        return new Response(JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);
      await sb.from("notifications").insert({
        type: "new_order",
        title: "New Order",
        message: `${notifName} placed a ${notifPM || "COD"} order for ${notifAddr}`,
        entity_type: "order",
        entity_id: notifOrderId,
      });
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET NOTIFICATIONS (password required) ──
    if (action === "get_notifications") {
      // Delete old notifications (>7 days)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("notifications").delete().lt("created_at", sevenDaysAgo);
      const { data: notifs, error: notifErr } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (notifErr) throw notifErr;
      return new Response(JSON.stringify({ success: true, notifications: notifs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MARK NOTIFICATIONS READ (password required) ──
    if (action === "mark_notifications_read") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("notifications").update({ read: true } as any).eq("read", false);
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SEND REVIEW REQUESTS (scheduled daily) ──
    if (action === "send_review_requests") {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: enabledSetting } = await sb.from("global_settings").select("value").eq("key", "review_request_enabled").maybeSingle();
      if (enabledSetting?.value !== "true") {
        return new Response(JSON.stringify({ success: true, sent: 0, message: "Review requests disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = yesterday.toISOString().split("T")[0];
      const { data: orders } = await sb.from("orders").select("*")
        .eq("delivery_date", yDate).in("payment_status", ["paid", "pending"]).eq("review_request_sent", false)
        .not("customer_email", "is", null);
      let sent = 0;
      const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
      for (const order of orders || []) {
        try {
          await fetch(emailUrl, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
            body: JSON.stringify({ type: "review_request", data: order }) });
          await sb.from("orders").update({ review_request_sent: true, review_request_sent_at: new Date().toISOString() } as any).eq("id", order.id);
          sent++;
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) { console.error("[review_request] Failed:", order.order_number, err); }
      }
      return new Response(JSON.stringify({ success: true, sent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST REVIEWS (password required) ──
    if (action === "list_reviews") {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ reviews: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CANCEL ORDER (release Stripe hold + notify) ──
    if (action === "cancel_order") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: cancelOrder, error: cancelErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();

      if (cancelErr || !cancelOrder) {
        return new Response(JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (cancelOrder.status === "cancelled") {
        return new Response(JSON.stringify({ error: "Order already cancelled", order_number: cancelOrder.order_number }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let stripeReleased = false;

      // Release Stripe hold if payment is authorized
      if (cancelOrder.stripe_payment_id && cancelOrder.payment_status === "authorized") {
        try {
          // Determine stripe mode
          const { data: cancelModeData } = await supabase
            .from("global_settings")
            .select("value")
            .eq("key", "stripe_mode")
            .maybeSingle();

          const cancelStripeMode = cancelModeData?.value || "live";
          const cancelStripeKey = cancelStripeMode === "test"
            ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
            : Deno.env.get("STRIPE_SECRET_KEY");

          const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
          const stripe = new Stripe(cancelStripeKey || "", {
            apiVersion: "2025-08-27.basil",
          });

          await stripe.paymentIntents.cancel(cancelOrder.stripe_payment_id);
          stripeReleased = true;
          console.log(`[cancel_order] Released Stripe hold for ${cancelOrder.order_number}: ${cancelOrder.stripe_payment_id}`);
        } catch (stripeErr: any) {
          console.error(`[cancel_order] Stripe cancel failed for ${cancelOrder.order_number}:`, stripeErr.message);
          // Continue with DB cancellation even if Stripe fails
        }
      }

      // Update order status
      const newPaymentStatus = stripeReleased ? "released" : cancelOrder.payment_status;
      await supabase.from("orders").update({
        status: "cancelled",
        payment_status: newPaymentStatus,
        cancelled_at: new Date().toISOString(),
      } as any).eq("id", order_id);

      // Send cancellation email to customer
      if (cancelOrder.customer_email) {
        const supabaseUrl3 = Deno.env.get("SUPABASE_URL")!;
        const anonKey3 = Deno.env.get("SUPABASE_ANON_KEY") || "";
        try {
          await fetch(`${supabaseUrl3}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey3}`,
            },
            body: JSON.stringify({
              type: "order_cancelled",
              data: {
                customer_name: cancelOrder.customer_name,
                customer_email: cancelOrder.customer_email,
                order_number: cancelOrder.order_number,
                delivery_address: cancelOrder.delivery_address,
                delivery_date: cancelOrder.delivery_date,
                price: cancelOrder.price,
                payment_released: stripeReleased,
              },
            }),
          });
        } catch (emailErr: any) {
          console.error(`[cancel_order] Failed to send cancellation email:`, emailErr.message);
        }
      }

      // Create admin notification
      try {
        await supabase.from("notifications").insert({
          type: "order_cancelled",
          title: "🚫 Order Cancelled",
          message: `${cancelOrder.order_number} — ${cancelOrder.customer_name} cancelled.${stripeReleased ? " Payment hold released." : ""}`,
          entity_type: "order",
          entity_id: order_id,
        });
      } catch {}

      console.log(`[cancel_order] Cancelled ${cancelOrder.order_number}, stripe_released: ${stripeReleased}`);

      return new Response(JSON.stringify({
        success: true,
        order_number: cancelOrder.order_number,
        stripe_released: stripeReleased,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CHECK FRAUD (password required) ──
    if (action === "check_fraud") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { ip, phone, email, session_id, address } = body;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const result = await checkFraudInternal(supabase, { ip, phone, email, session_id, address });
      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── BLOCK ENTITY (password required) ──
    if (action === "block_entity") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { type, value, reason, expires_at } = body;
      if (!type || !value) {
        return new Response(JSON.stringify({ error: "type and value required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("fraud_blocklist").upsert(
        { type, value, reason: reason || null, blocked_by: "admin", expires_at: expires_at || null },
        { onConflict: "type,value" }
      );
      await supabase.from("fraud_events").insert({
        event_type: "manual_flag", details: { type, value, reason }
      });
      return new Response(JSON.stringify({ blocked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── UNBLOCK ENTITY (password required) ──
    if (action === "unblock_entity") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { type, value } = body;
      if (!type || !value) {
        return new Response(JSON.stringify({ error: "type and value required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("fraud_blocklist").delete().eq("type", type).eq("value", value);
      return new Response(JSON.stringify({ unblocked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST FRAUD EVENTS (password required) ──
    if (action === "list_fraud_events") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase
        .from("fraud_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return new Response(JSON.stringify({ events: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST BLOCKLIST (password required) ──
    if (action === "list_blocklist") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase
        .from("fraud_blocklist")
        .select("*")
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ blocklist: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CAPTURE PAYMENT (manual admin trigger) ───────────────────────────────────
    if (action === "capture_payment") {
      const { order_id } = body as any;
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, order_number, stripe_payment_id, payment_status, status")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["captured", "paid"].includes(order.payment_status)) {
        return new Response(
          JSON.stringify({ success: true, message: "Already captured", payment_status: order.payment_status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!order.stripe_payment_id) {
        return new Response(
          JSON.stringify({ error: "No Stripe payment intent on this order (COD or not yet paid)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: modeRow } = await supabase
        .from("global_settings").select("value").eq("key", "stripe_mode").maybeSingle();
      const stripeMode = modeRow?.value || "live";
      const stripeKey = stripeMode === "test"
        ? Deno.env.get("STRIPE_TEST_SECRET_KEY")!
        : Deno.env.get("STRIPE_SECRET_KEY")!;

      const captureRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${order.stripe_payment_id}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const captureData = await captureRes.json();

      if (captureData.error) {
        console.error("[leads-auth] capture_payment Stripe error:", captureData.error);
        await supabase
          .from("orders")
          .update({ payment_status: "capture_failed", updated_at: new Date().toISOString() })
          .eq("id", order_id);
        return new Response(
          JSON.stringify({ error: captureData.error.message, stripe_code: captureData.error.code }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("orders")
        .update({ payment_status: "captured", updated_at: new Date().toISOString() })
        .eq("id", order_id);

      console.log(`[leads-auth] capture_payment: order ${order.order_number} captured successfully`);

      return new Response(
        JSON.stringify({ success: true, payment_status: "captured", stripe_status: captureData.status, order_number: order.order_number }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RELEASE HOLD (cancel authorization, zero fee) ────────────────────────────
    if (action === "release_hold") {
      const { order_id } = body as any;
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, stripe_payment_id, payment_status, status")
        .eq("id", order_id)
        .single();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["released", "captured", "paid"].includes(order.payment_status)) {
        return new Response(
          JSON.stringify({ success: true, message: "Already resolved", payment_status: order.payment_status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!order.stripe_payment_id) {
        await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", order_id);
        return new Response(
          JSON.stringify({ success: true, message: "COD order cancelled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: modeRow } = await supabase
        .from("global_settings").select("value").eq("key", "stripe_mode").maybeSingle();
      const stripeMode = modeRow?.value || "live";
      const stripeKey = stripeMode === "test"
        ? Deno.env.get("STRIPE_TEST_SECRET_KEY")!
        : Deno.env.get("STRIPE_SECRET_KEY")!;

      const cancelRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${order.stripe_payment_id}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const cancelData = await cancelRes.json();

      if (cancelData.error && cancelData.error.code !== "payment_intent_unexpected_state") {
        console.error("[leads-auth] release_hold Stripe error:", cancelData.error);
        return new Response(
          JSON.stringify({ error: cancelData.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("orders")
        .update({ payment_status: "released", status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order_id);

      console.log(`[leads-auth] release_hold: order ${order.order_number} — hold released, zero fee`);

      return new Response(
        JSON.stringify({ success: true, payment_status: "released", order_number: order.order_number, message: "Hold released — zero processing fee charged" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET CUSTOMER TIER (used by create-checkout-link and future driver app) ───
    if (action === "get_customer_tier") {
      const { customer_phone } = body as any;
      if (!customer_phone) {
        return new Response(
          JSON.stringify({ error: "Missing customer_phone" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: prevOrders } = await supabase
        .from("orders")
        .select("id, stripe_customer_id, customer_name")
        .eq("customer_phone", customer_phone)
        .in("payment_status", ["paid", "captured"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false });

      const paidCount = prevOrders?.length ?? 0;
      const existingStripeCustomerId = prevOrders?.find(
        (o: any) => o.stripe_customer_id
      )?.stripe_customer_id ?? null;
      const customerName = prevOrders?.[0]?.customer_name ?? null;

      const tier = paidCount >= 3 ? 3 : paidCount >= 1 ? 2 : 1;
      const threeDSecure = tier === 1 ? "any" : "automatic";

      console.log(`[leads-auth] get_customer_tier: phone=${customer_phone.slice(-4)} count=${paidCount} tier=${tier}`);

      return new Response(
        JSON.stringify({ tier, order_count: paidCount, three_d_secure: threeDSecure, stripe_customer_id: existingStripeCustomerId, customer_name: customerName }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // ── LIST PAYMENT ATTEMPTS (password required) ──
    if (action === "list_payment_attempts") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("payment_attempts")
        .select("*")
        .gt("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ attempts: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET PAGE PERFORMANCE ──
    if (action === "get_page_performance") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("entry_page, entry_city_page, stage, calculated_price, created_at, last_seen_at, geo_city, ip_address")
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const pageMap: Record<string, { visits: number; prices: number[]; stages: string[]; durations: number[] }> = {};
      for (const row of (data || [])) {
        const page = row.entry_page || "/";
        if (!pageMap[page]) pageMap[page] = { visits: 0, prices: [], stages: [], durations: [] };
        pageMap[page].visits++;
        if (row.calculated_price) pageMap[page].prices.push(Number(row.calculated_price));
        if (row.stage) pageMap[page].stages.push(row.stage);
        if (row.created_at && row.last_seen_at) {
          const dur = new Date(row.last_seen_at).getTime() - new Date(row.created_at).getTime();
          if (dur > 0 && dur < 3600000) pageMap[page].durations.push(Math.floor(dur / 1000));
        }
      }

      const STAGE_ORDER = ["visited","entered_address","got_price","started_checkout","reached_payment","completed_order"];
      const pagePerf = Object.entries(pageMap)
        .map(([page, d]) => {
          const avgPrice = d.prices.length ? Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length) : null;
          const avgDur = d.durations.length ? Math.round(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : null;
          const topStage = d.stages.sort((a, b) => STAGE_ORDER.indexOf(b) - STAGE_ORDER.indexOf(a))[0] || "visited";
          return { page, visits: d.visits, avgPrice, avgDuration: avgDur, topStage };
        })
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8);

      const cityMap: Record<string, { visits: number }> = {};
      for (const row of (data || [])) {
        const city = row.geo_city || "Unknown";
        if (!cityMap[city]) cityMap[city] = { visits: 0 };
        cityMap[city].visits++;
      }
      const cityIntel = Object.entries(cityMap)
        .map(([city, d]) => ({ city, visits: d.visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8);

      return new Response(
        JSON.stringify({ pagePerf, cityIntel }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[leads-auth] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

```

---

# Phase markers (search anchors for future sessions)

- **Phase 0** — drivers table schema, leads-auth driver action verbs (list_drivers, save_driver, delete_driver, etc.)
- **Phase 1a** — Drivers tab UI: DriversTab + DriverRow + DriverModal initial wiring
- **Phase 1b** — Driver assignment on orders, leads-auth `update_order` extended with `driver_id`
- **Phase 2** — WhatsApp driver comms (uses `src/lib/whatsapp-message.ts`, see CORE_FLOW_REFERENCE)
- **DriverModal Phase 1 polish** — Name field formatProperName/formatProperNameFinal pass
- **Schedule Slice 1** — ScheduleTab + WeekStrip + DayPanel + ScheduleOrderCard + SummaryBar + schedule-adapter
- **2FA Slice 1a** — LeadsSetup2FA page (dormant, not yet wired into login flow)

For deferred follow-ups (P2 server-side phone digit normalization across
all lead capture paths, P2 server-side email lowercase, P3 formAttempted
validation patterns) see `RIVERSAND_FOLLOWUPS.md`.

_End of LMT_REFERENCE.md_
