export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string | null
          created_at: string
          customer_id: string
          delivery_notes: string | null
          formatted_address: string
          id: string
          is_primary: boolean
          lat: number | null
          lng: number | null
          state: string | null
          street: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_id: string
          delivery_notes?: string | null
          formatted_address: string
          id?: string
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          state?: string | null
          street?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_id?: string
          delivery_notes?: string | null
          formatted_address?: string
          id?: string
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          state?: string | null
          street?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      app_configurations: {
        Row: {
          branding_meta: Json
          created_at: string
          free_miles: number
          id: string
          min_trip_charge: number | null
          per_mile_rate: number
          pit_ids: string[]
          pricing_mode: string
          processing_fee_pct: number
          product_ids: string[] | null
          saturday_surcharge: number
          storefront_id: string
          ui_flags: Json
          updated_at: string
        }
        Insert: {
          branding_meta?: Json
          created_at?: string
          free_miles?: number
          id?: string
          min_trip_charge?: number | null
          per_mile_rate: number
          pit_ids?: string[]
          pricing_mode?: string
          processing_fee_pct?: number
          product_ids?: string[] | null
          saturday_surcharge?: number
          storefront_id: string
          ui_flags?: Json
          updated_at?: string
        }
        Update: {
          branding_meta?: Json
          created_at?: string
          free_miles?: number
          id?: string
          min_trip_charge?: number | null
          per_mile_rate?: number
          pit_ids?: string[]
          pricing_mode?: string
          processing_fee_pct?: number
          product_ids?: string[] | null
          saturday_surcharge?: number
          storefront_id?: string
          ui_flags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_configurations_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: true
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_ips: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      city_pages: {
        Row: {
          base_price: number | null
          city_name: string
          city_slug: string
          competing_pit_ids: string[] | null
          content: string | null
          content_generated_at: string | null
          created_at: string | null
          delivery_details: string | null
          distance_from_pit: number | null
          faq_items: Json | null
          h1_text: string | null
          hero_intro: string | null
          id: string
          last_regen_at: string | null
          last_regen_reason: string | null
          last_viewed_at: string | null
          lat: number | null
          lng: number | null
          local_address: string | null
          local_city: string | null
          local_expertise: string | null
          local_uses: string | null
          local_zip: string | null
          meta_description: string | null
          meta_title: string | null
          multi_pit_coverage: boolean | null
          needs_regen: boolean | null
          page_views: number | null
          pit_id: string | null
          pit_reassigned: boolean | null
          price_changed: boolean | null
          prompt_version: string | null
          regen_reason: string | null
          region: string | null
          state: string
          status: string | null
          status_reason: string | null
          updated_at: string | null
          why_choose_intro: string | null
          zip_codes: string[] | null
        }
        Insert: {
          base_price?: number | null
          city_name: string
          city_slug: string
          competing_pit_ids?: string[] | null
          content?: string | null
          content_generated_at?: string | null
          created_at?: string | null
          delivery_details?: string | null
          distance_from_pit?: number | null
          faq_items?: Json | null
          h1_text?: string | null
          hero_intro?: string | null
          id?: string
          last_regen_at?: string | null
          last_regen_reason?: string | null
          last_viewed_at?: string | null
          lat?: number | null
          lng?: number | null
          local_address?: string | null
          local_city?: string | null
          local_expertise?: string | null
          local_uses?: string | null
          local_zip?: string | null
          meta_description?: string | null
          meta_title?: string | null
          multi_pit_coverage?: boolean | null
          needs_regen?: boolean | null
          page_views?: number | null
          pit_id?: string | null
          pit_reassigned?: boolean | null
          price_changed?: boolean | null
          prompt_version?: string | null
          regen_reason?: string | null
          region?: string | null
          state?: string
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
          why_choose_intro?: string | null
          zip_codes?: string[] | null
        }
        Update: {
          base_price?: number | null
          city_name?: string
          city_slug?: string
          competing_pit_ids?: string[] | null
          content?: string | null
          content_generated_at?: string | null
          created_at?: string | null
          delivery_details?: string | null
          distance_from_pit?: number | null
          faq_items?: Json | null
          h1_text?: string | null
          hero_intro?: string | null
          id?: string
          last_regen_at?: string | null
          last_regen_reason?: string | null
          last_viewed_at?: string | null
          lat?: number | null
          lng?: number | null
          local_address?: string | null
          local_city?: string | null
          local_expertise?: string | null
          local_uses?: string | null
          local_zip?: string | null
          meta_description?: string | null
          meta_title?: string | null
          multi_pit_coverage?: boolean | null
          needs_regen?: boolean | null
          page_views?: number | null
          pit_id?: string | null
          pit_reassigned?: boolean | null
          price_changed?: boolean | null
          prompt_version?: string | null
          regen_reason?: string | null
          region?: string | null
          state?: string
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
          why_choose_intro?: string | null
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "city_pages_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_change_events: {
        Row: {
          change_amount: number | null
          change_pct: number | null
          changed_at: string
          changed_by: string | null
          id: string
          new_cost: number
          old_cost: number | null
          pit_id: string
          pit_inventory_id: string
          product_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          change_amount?: number | null
          change_pct?: number | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost: number
          old_cost?: number | null
          pit_id: string
          pit_inventory_id: string
          product_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          change_amount?: number | null
          change_pct?: number | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number
          old_cost?: number | null
          pit_id?: string
          pit_inventory_id?: string
          product_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_change_events_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_change_events_pit_inventory_id_fkey"
            columns: ["pit_inventory_id"]
            isOneToOne: false
            referencedRelation: "pit_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_change_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cost_change_events_pit_id"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cost_change_events_pit_inventory_id"
            columns: ["pit_inventory_id"]
            isOneToOne: false
            referencedRelation: "pit_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cost_change_events_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          first_order_date: string | null
          id: string
          last_order_date: string | null
          name: string | null
          phone: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name?: string | null
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name?: string | null
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers_v2: {
        Row: {
          created_at: string
          email: string | null
          first_seen_at: string
          first_storefront: string | null
          id: string
          last_order_at: string | null
          name: string | null
          notes: string | null
          phone: string
          total_orders: number
          total_spent: number
          trust_score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          first_storefront?: string | null
          id?: string
          last_order_at?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          total_orders?: number
          total_spent?: number
          trust_score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          first_storefront?: string | null
          id?: string
          last_order_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          total_orders?: number
          total_spent?: number
          trust_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_leads: {
        Row: {
          address: string
          browser_geolat: number | null
          browser_geolng: number | null
          calculated_price: number | null
          contacted: boolean
          converted_order_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          declined_at: string | null
          distance_miles: number | null
          fraud_score: number | null
          fraud_signals: Json | null
          geo_matches_address: boolean | null
          id: string
          ip_address: string | null
          lead_number: string | null
          nearest_pit_distance: number | null
          nearest_pit_id: string | null
          nearest_pit_name: string | null
          notes: string | null
          offer_sent_at: string | null
          pre_order_id: string | null
          quote_accepted: boolean | null
          quote_sent_at: string | null
          quoted_price: number | null
          requested_product_id: string | null
          requested_quantity: number | null
          source_platform: string
          stage: string | null
          submission_count: number | null
          user_agent: string | null
        }
        Insert: {
          address: string
          browser_geolat?: number | null
          browser_geolng?: number | null
          calculated_price?: number | null
          contacted?: boolean
          converted_order_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          declined_at?: string | null
          distance_miles?: number | null
          fraud_score?: number | null
          fraud_signals?: Json | null
          geo_matches_address?: boolean | null
          id?: string
          ip_address?: string | null
          lead_number?: string | null
          nearest_pit_distance?: number | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          notes?: string | null
          offer_sent_at?: string | null
          pre_order_id?: string | null
          quote_accepted?: boolean | null
          quote_sent_at?: string | null
          quoted_price?: number | null
          requested_product_id?: string | null
          requested_quantity?: number | null
          source_platform?: string
          stage?: string | null
          submission_count?: number | null
          user_agent?: string | null
        }
        Update: {
          address?: string
          browser_geolat?: number | null
          browser_geolng?: number | null
          calculated_price?: number | null
          contacted?: boolean
          converted_order_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          declined_at?: string | null
          distance_miles?: number | null
          fraud_score?: number | null
          fraud_signals?: Json | null
          geo_matches_address?: boolean | null
          id?: string
          ip_address?: string | null
          lead_number?: string | null
          nearest_pit_distance?: number | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          notes?: string | null
          offer_sent_at?: string | null
          pre_order_id?: string | null
          quote_accepted?: boolean | null
          quote_sent_at?: string | null
          quoted_price?: number | null
          requested_product_id?: string | null
          requested_quantity?: number | null
          source_platform?: string
          stage?: string | null
          submission_count?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_leads_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_leads_requested_product_id_fkey"
            columns: ["requested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_compensation: {
        Row: {
          comp_type: string
          created_at: string
          driver_id: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          rate: number
        }
        Insert: {
          comp_type: string
          created_at?: string
          driver_id: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate: number
        }
        Update: {
          comp_type?: string
          created_at?: string
          driver_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_driver_compensation_driver_id"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_goals: {
        Row: {
          created_at: string
          driver_id: string
          goal_type: string
          id: string
          period_end: string
          period_start: string
          target_value: number
        }
        Insert: {
          created_at?: string
          driver_id: string
          goal_type: string
          id?: string
          period_end: string
          period_start: string
          target_value: number
        }
        Update: {
          created_at?: string
          driver_id?: string
          goal_type?: string
          id?: string
          period_end?: string
          period_start?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_driver_goals_driver_id"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_sessions: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string
          id: string
          ip_address: string | null
          last_active_at: string
          revoked_at: string | null
          session_token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          revoked_at?: string | null
          session_token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          revoked_at?: string | null
          session_token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_sessions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          employment_entity: string | null
          hire_date: string | null
          id: string
          last_login_at: string | null
          license_class: string | null
          license_expires_on: string | null
          license_number: string | null
          name: string
          notes: string | null
          payment_rate: number | null
          payment_type: string | null
          phone: string
          pin_hash: string | null
          pin_set_at: string | null
          primary_hub_id: string | null
          secondary_hub_ids: string[] | null
          status: string | null
          truck_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          employment_entity?: string | null
          hire_date?: string | null
          id?: string
          last_login_at?: string | null
          license_class?: string | null
          license_expires_on?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          payment_rate?: number | null
          payment_type?: string | null
          phone: string
          pin_hash?: string | null
          pin_set_at?: string | null
          primary_hub_id?: string | null
          secondary_hub_ids?: string[] | null
          status?: string | null
          truck_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          employment_entity?: string | null
          hire_date?: string | null
          id?: string
          last_login_at?: string | null
          license_class?: string | null
          license_expires_on?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          payment_rate?: number | null
          payment_type?: string | null
          phone?: string
          pin_hash?: string | null
          pin_set_at?: string | null
          primary_hub_id?: string | null
          secondary_hub_ids?: string[] | null
          status?: string | null
          truck_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_drivers_primary_hub_id"
            columns: ["primary_hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_blocklist: {
        Row: {
          blocked_by: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          reason: string | null
          type: string
          value: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          type: string
          value: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      fraud_events: {
        Row: {
          created_at: string | null
          details: Json | null
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          order_id: string | null
          phone: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          phone?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          phone?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          description: string | null
          id: string
          is_public: boolean
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_public?: boolean
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          is_public?: boolean
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          confirmation_token: string
          created_at: string
          customer_visible: boolean
          holiday_date: string
          id: string
          is_closed: boolean
          is_federal: boolean
          name: string
          notification_10day_sent: boolean
          notification_10day_sent_at: string | null
          notification_7day_sent: boolean
          notification_7day_sent_at: string | null
          operator_decision_at: string | null
          operator_decision_by: string | null
          surcharge_override: number | null
          updated_at: string
        }
        Insert: {
          confirmation_token?: string
          created_at?: string
          customer_visible?: boolean
          holiday_date: string
          id?: string
          is_closed?: boolean
          is_federal?: boolean
          name: string
          notification_10day_sent?: boolean
          notification_10day_sent_at?: string | null
          notification_7day_sent?: boolean
          notification_7day_sent_at?: string | null
          operator_decision_at?: string | null
          operator_decision_by?: string | null
          surcharge_override?: number | null
          updated_at?: string
        }
        Update: {
          confirmation_token?: string
          created_at?: string
          customer_visible?: boolean
          holiday_date?: string
          id?: string
          is_closed?: boolean
          is_federal?: boolean
          name?: string
          notification_10day_sent?: boolean
          notification_10day_sent_at?: string | null
          notification_7day_sent?: boolean
          notification_7day_sent_at?: string | null
          operator_decision_at?: string | null
          operator_decision_by?: string | null
          surcharge_override?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hub_pit_products: {
        Row: {
          created_at: string
          hub_id: string
          id: string
          is_available_in_hub: boolean
          is_featured: boolean
          notes: string | null
          pit_id: string
          price_per_unit: number
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hub_id: string
          id?: string
          is_available_in_hub?: boolean
          is_featured?: boolean
          notes?: string | null
          pit_id: string
          price_per_unit: number
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hub_id?: string
          id?: string
          is_available_in_hub?: boolean
          is_featured?: boolean
          notes?: string | null
          pit_id?: string
          price_per_unit?: number
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hpp_hub_id"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hpp_pit_id"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hpp_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_pit_products_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_pit_products_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_pit_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_pits: {
        Row: {
          created_at: string
          hub_id: string
          pit_id: string
          priority: number
          status: string
        }
        Insert: {
          created_at?: string
          hub_id: string
          pit_id: string
          priority?: number
          status?: string
        }
        Update: {
          created_at?: string
          hub_id?: string
          pit_id?: string
          priority?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hub_pits_hub_id"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hub_pits_pit_id"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_truck_class_rates: {
        Row: {
          base_delivery_fee: number
          created_at: string
          driver_extra_mile_bonus_pct: number
          hub_id: string
          per_mile_rate: number
          truck_class_id: string
          updated_at: string
        }
        Insert: {
          base_delivery_fee?: number
          created_at?: string
          driver_extra_mile_bonus_pct?: number
          hub_id: string
          per_mile_rate: number
          truck_class_id: string
          updated_at?: string
        }
        Update: {
          base_delivery_fee?: number
          created_at?: string
          driver_extra_mile_bonus_pct?: number
          hub_id?: string
          per_mile_rate?: number
          truck_class_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_htcr_hub_id"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_htcr_truck_class_id"
            columns: ["truck_class_id"]
            isOneToOne: false
            referencedRelation: "truck_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          address: string | null
          contact_email: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads_totp_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          pit_id: string | null
          price_per_unit: number
          product_id: string
          quantity: number
          subtotal: number
          unit: string
          weight_total: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          pit_id?: string | null
          price_per_unit: number
          product_id: string
          quantity: number
          subtotal: number
          unit: string
          weight_total?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          pit_id?: string | null
          price_per_unit?: number
          product_id?: string
          quantity?: number
          subtotal?: number
          unit?: string
          weight_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acknowledged_at: string | null
          at_pit_at: string | null
          base_unit_price: number | null
          billed_distance_miles: number | null
          billing_address: string | null
          billing_country: string | null
          billing_matches_delivery: boolean | null
          billing_name: string | null
          billing_zip: string | null
          call_verified_at: string | null
          call_verified_by: string | null
          cancelled_at: string | null
          capture_attempted_at: string | null
          capture_status: string | null
          card_authorization_accepted: boolean | null
          card_authorization_timestamp: string | null
          card_brand: string | null
          card_last4: string | null
          cash_collected: boolean | null
          cash_collected_at: string | null
          cash_collected_by: string | null
          company_name: string | null
          confirmation_token: string
          coupon_code: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          customer_tier: number
          delivery_address: string
          delivery_date: string | null
          delivery_day_of_week: string | null
          delivery_fee: number
          delivery_terms_accepted: boolean | null
          delivery_terms_timestamp: string | null
          delivery_window: string
          delivery_zip: string | null
          discount_amount: number | null
          discounts_total: number
          distance_fee: number | null
          distance_miles: number
          driver_collected_at: string | null
          driver_collected_card: number | null
          driver_collected_cash: number | null
          driver_collected_check: number | null
          driver_id: string | null
          driver_workflow_status: string | null
          fraud_score: number | null
          fraud_signals: Json | null
          fraud_window_cleared_at: string | null
          fuel_surcharge: number
          id: string
          is_northshore: boolean | null
          last_confirmation_sent_at: string | null
          lead_reference: string | null
          loaded_at: string | null
          lookup_token: string | null
          lookup_token_used: boolean
          material_total: number
          message_sent_at: string | null
          notes: string | null
          order_number: string | null
          parish_tax_amount: number | null
          parish_tax_rate: number | null
          payment_attempts: number | null
          payment_failure_id: string | null
          payment_method: string
          payment_status: string
          pit_id: string | null
          price: number
          processing_fee: number | null
          quantity: number
          reschedule_token: string | null
          reschedule_token_used: boolean | null
          review_request_sent: boolean | null
          review_request_sent_at: string | null
          review_status: string | null
          same_day_requested: boolean
          saturday_surcharge: boolean
          saturday_surcharge_amount: number
          source_platform: string
          state_tax_amount: number | null
          state_tax_rate: number | null
          status: string
          stripe_account_id: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          sunday_surcharge: boolean
          sunday_surcharge_amount: number
          tax_amount: number
          tax_rate: number
          truck_session_id: string | null
          trustlevel_fee: number
          updated_at: string
          workflow_delivered_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          at_pit_at?: string | null
          base_unit_price?: number | null
          billed_distance_miles?: number | null
          billing_address?: string | null
          billing_country?: string | null
          billing_matches_delivery?: boolean | null
          billing_name?: string | null
          billing_zip?: string | null
          call_verified_at?: string | null
          call_verified_by?: string | null
          cancelled_at?: string | null
          capture_attempted_at?: string | null
          capture_status?: string | null
          card_authorization_accepted?: boolean | null
          card_authorization_timestamp?: string | null
          card_brand?: string | null
          card_last4?: string | null
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          company_name?: string | null
          confirmation_token?: string
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          customer_tier?: number
          delivery_address: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_fee?: number
          delivery_terms_accepted?: boolean | null
          delivery_terms_timestamp?: string | null
          delivery_window?: string
          delivery_zip?: string | null
          discount_amount?: number | null
          discounts_total?: number
          distance_fee?: number | null
          distance_miles: number
          driver_collected_at?: string | null
          driver_collected_card?: number | null
          driver_collected_cash?: number | null
          driver_collected_check?: number | null
          driver_id?: string | null
          driver_workflow_status?: string | null
          fraud_score?: number | null
          fraud_signals?: Json | null
          fraud_window_cleared_at?: string | null
          fuel_surcharge?: number
          id?: string
          is_northshore?: boolean | null
          last_confirmation_sent_at?: string | null
          lead_reference?: string | null
          loaded_at?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          material_total?: number
          message_sent_at?: string | null
          notes?: string | null
          order_number?: string | null
          parish_tax_amount?: number | null
          parish_tax_rate?: number | null
          payment_attempts?: number | null
          payment_failure_id?: string | null
          payment_method?: string
          payment_status?: string
          pit_id?: string | null
          price: number
          processing_fee?: number | null
          quantity?: number
          reschedule_token?: string | null
          reschedule_token_used?: boolean | null
          review_request_sent?: boolean | null
          review_request_sent_at?: string | null
          review_status?: string | null
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          source_platform?: string
          state_tax_amount?: number | null
          state_tax_rate?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          sunday_surcharge?: boolean
          sunday_surcharge_amount?: number
          tax_amount?: number
          tax_rate?: number
          truck_session_id?: string | null
          trustlevel_fee?: number
          updated_at?: string
          workflow_delivered_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          at_pit_at?: string | null
          base_unit_price?: number | null
          billed_distance_miles?: number | null
          billing_address?: string | null
          billing_country?: string | null
          billing_matches_delivery?: boolean | null
          billing_name?: string | null
          billing_zip?: string | null
          call_verified_at?: string | null
          call_verified_by?: string | null
          cancelled_at?: string | null
          capture_attempted_at?: string | null
          capture_status?: string | null
          card_authorization_accepted?: boolean | null
          card_authorization_timestamp?: string | null
          card_brand?: string | null
          card_last4?: string | null
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          company_name?: string | null
          confirmation_token?: string
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_tier?: number
          delivery_address?: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_fee?: number
          delivery_terms_accepted?: boolean | null
          delivery_terms_timestamp?: string | null
          delivery_window?: string
          delivery_zip?: string | null
          discount_amount?: number | null
          discounts_total?: number
          distance_fee?: number | null
          distance_miles?: number
          driver_collected_at?: string | null
          driver_collected_card?: number | null
          driver_collected_cash?: number | null
          driver_collected_check?: number | null
          driver_id?: string | null
          driver_workflow_status?: string | null
          fraud_score?: number | null
          fraud_signals?: Json | null
          fraud_window_cleared_at?: string | null
          fuel_surcharge?: number
          id?: string
          is_northshore?: boolean | null
          last_confirmation_sent_at?: string | null
          lead_reference?: string | null
          loaded_at?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          material_total?: number
          message_sent_at?: string | null
          notes?: string | null
          order_number?: string | null
          parish_tax_amount?: number | null
          parish_tax_rate?: number | null
          payment_attempts?: number | null
          payment_failure_id?: string | null
          payment_method?: string
          payment_status?: string
          pit_id?: string | null
          price?: number
          processing_fee?: number | null
          quantity?: number
          reschedule_token?: string | null
          reschedule_token_used?: boolean | null
          review_request_sent?: boolean | null
          review_request_sent_at?: string | null
          review_status?: string | null
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          source_platform?: string
          state_tax_amount?: number | null
          state_tax_rate?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          sunday_surcharge?: boolean
          sunday_surcharge_amount?: number
          tax_amount?: number
          tax_rate?: number
          truck_session_id?: string | null
          trustlevel_fee?: number
          updated_at?: string
          workflow_delivered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_driver_id"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_pit_id"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_failure_id_fkey"
            columns: ["payment_failure_id"]
            isOneToOne: false
            referencedRelation: "payment_failures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number | null
          created_at: string | null
          email: string | null
          id: string
          ip_address: string | null
          phone: string | null
          session_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          session_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          session_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_failures: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          failure_reason: string | null
          id: string
          resolved_at: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          failure_reason?: string | null
          id?: string
          resolved_at?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          failure_reason?: string | null
          id?: string
          resolved_at?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: []
      }
      pit_inventory: {
        Row: {
          available: boolean
          cost_per_truck: number | null
          cost_per_unit: number | null
          created_at: string
          id: string
          max_quantity_per_load: number | null
          min_quantity: number
          notes: string | null
          pit_id: string
          price_per_unit: number
          product_id: string
          smart_offers_ref: string | null
          status: string
          updated_at: string
          wholesale_cost: number | null
        }
        Insert: {
          available?: boolean
          cost_per_truck?: number | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          max_quantity_per_load?: number | null
          min_quantity?: number
          notes?: string | null
          pit_id: string
          price_per_unit: number
          product_id: string
          smart_offers_ref?: string | null
          status?: string
          updated_at?: string
          wholesale_cost?: number | null
        }
        Update: {
          available?: boolean
          cost_per_truck?: number | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          max_quantity_per_load?: number | null
          min_quantity?: number
          notes?: string | null
          pit_id?: string
          price_per_unit?: number
          product_id?: string
          smart_offers_ref?: string | null
          status?: string
          updated_at?: string
          wholesale_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pit_inventory_pit_id"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pit_inventory_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_inventory_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pit_zip_distances: {
        Row: {
          driving_miles: number
          id: string
          last_calculated_at: string
          pit_id: string
          zip: string
        }
        Insert: {
          driving_miles: number
          id?: string
          last_calculated_at?: string
          pit_id: string
          zip: string
        }
        Update: {
          driving_miles?: number
          id?: string
          last_calculated_at?: string
          pit_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "pit_zip_distances_pit_id_fkey"
            columns: ["pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
        ]
      }
      pits: {
        Row: {
          address: string
          base_price: number | null
          closed_dates: string[] | null
          contact_email: string | null
          created_at: string
          delivery_hours: Json | null
          free_miles: number | null
          holiday_load_limit: number | null
          holiday_surcharge_override: number | null
          id: string
          is_default: boolean
          is_pickup_only: boolean
          lat: number
          lon: number
          max_distance: number | null
          min_distance: number | null
          min_trip_charge: number
          name: string
          notes: string | null
          operating_days: number[] | null
          operating_hours_end: string | null
          operating_hours_start: string | null
          phone: string | null
          price_per_extra_mile: number | null
          same_day_cutoff: string | null
          saturday_load_limit: number | null
          saturday_only: boolean
          saturday_surcharge_override: number | null
          served_cities: Json | null
          status: string
          sunday_load_limit: number | null
          sunday_surcharge: number | null
          updated_at: string
          vendor_notes: string | null
          vendor_relationship: string | null
        }
        Insert: {
          address: string
          base_price?: number | null
          closed_dates?: string[] | null
          contact_email?: string | null
          created_at?: string
          delivery_hours?: Json | null
          free_miles?: number | null
          holiday_load_limit?: number | null
          holiday_surcharge_override?: number | null
          id?: string
          is_default?: boolean
          is_pickup_only?: boolean
          lat: number
          lon: number
          max_distance?: number | null
          min_distance?: number | null
          min_trip_charge?: number
          name: string
          notes?: string | null
          operating_days?: number[] | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          phone?: string | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_load_limit?: number | null
          saturday_only?: boolean
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
          sunday_load_limit?: number | null
          sunday_surcharge?: number | null
          updated_at?: string
          vendor_notes?: string | null
          vendor_relationship?: string | null
        }
        Update: {
          address?: string
          base_price?: number | null
          closed_dates?: string[] | null
          contact_email?: string | null
          created_at?: string
          delivery_hours?: Json | null
          free_miles?: number | null
          holiday_load_limit?: number | null
          holiday_surcharge_override?: number | null
          id?: string
          is_default?: boolean
          is_pickup_only?: boolean
          lat?: number
          lon?: number
          max_distance?: number | null
          min_distance?: number | null
          min_trip_charge?: number
          name?: string
          notes?: string | null
          operating_days?: number[] | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          phone?: string | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_load_limit?: number | null
          saturday_only?: boolean
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
          sunday_load_limit?: number | null
          sunday_surcharge?: number | null
          updated_at?: string
          vendor_notes?: string | null
          vendor_relationship?: string | null
        }
        Relationships: []
      }
      pricing_overrides: {
        Row: {
          approved_by: string | null
          attempted_price: number
          cost_at_time: number
          created_at: string
          hub_pit_product_id: string
          id: string
          minimum_required: number
          override_reason: string | null
        }
        Insert: {
          approved_by?: string | null
          attempted_price: number
          cost_at_time: number
          created_at?: string
          hub_pit_product_id: string
          id?: string
          minimum_required: number
          override_reason?: string | null
        }
        Update: {
          approved_by?: string | null
          attempted_price?: number
          cost_at_time?: number
          created_at?: string
          hub_pit_product_id?: string
          id?: string
          minimum_required?: number
          override_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pricing_overrides_hpp_id"
            columns: ["hub_pit_product_id"]
            isOneToOne: false
            referencedRelation: "hub_pit_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_overrides_hub_pit_product_id_fkey"
            columns: ["hub_pit_product_id"]
            isOneToOne: false
            referencedRelation: "hub_pit_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alternatives: string[] | null
          category: string
          created_at: string
          default_price: number | null
          description: string | null
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          is_popular: boolean | null
          long_description_template: string | null
          min_quantity: number | null
          minimum_markup_dollars: number | null
          minimum_markup_pct: number | null
          name: string
          slug: string
          sub_category: string | null
          tag: string | null
          unit: string
          updated_at: string
          use_cases: string[] | null
          weight_per_unit: number | null
        }
        Insert: {
          alternatives?: string[] | null
          category: string
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_popular?: boolean | null
          long_description_template?: string | null
          min_quantity?: number | null
          minimum_markup_dollars?: number | null
          minimum_markup_pct?: number | null
          name: string
          slug: string
          sub_category?: string | null
          tag?: string | null
          unit: string
          updated_at?: string
          use_cases?: string[] | null
          weight_per_unit?: number | null
        }
        Update: {
          alternatives?: string[] | null
          category?: string
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_popular?: boolean | null
          long_description_template?: string | null
          min_quantity?: number | null
          minimum_markup_dollars?: number | null
          minimum_markup_pct?: number | null
          name?: string
          slug?: string
          sub_category?: string | null
          tag?: string | null
          unit?: string
          updated_at?: string
          use_cases?: string[] | null
          weight_per_unit?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          feedback: string | null
          id: string
          order_id: string | null
          order_number: string | null
          rating: number | null
          review_request_sent_at: string | null
          review_submitted_at: string | null
          sent_to_gmb: boolean | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          feedback?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          rating?: number | null
          review_request_sent_at?: string | null
          review_submitted_at?: string | null
          sent_to_gmb?: boolean | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          feedback?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          rating?: number | null
          review_request_sent_at?: string | null
          review_submitted_at?: string | null
          sent_to_gmb?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      storefronts: {
        Row: {
          active: boolean
          brand_name: string | null
          created_at: string
          domain: string
          id: string
          logo_url: string | null
          name: string
          stripe_account_id: string | null
          support_email: string | null
          support_phone: string | null
        }
        Insert: {
          active?: boolean
          brand_name?: string | null
          created_at?: string
          domain: string
          id: string
          logo_url?: string | null
          name: string
          stripe_account_id?: string | null
          support_email?: string | null
          support_phone?: string | null
        }
        Update: {
          active?: boolean
          brand_name?: string | null
          created_at?: string
          domain?: string
          id?: string
          logo_url?: string | null
          name?: string
          stripe_account_id?: string | null
          support_email?: string | null
          support_phone?: string | null
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          combined_rate: number
          county_parish: string
          effective_date: string
          id: string
          jurisdiction_type: string
          local_rate: number
          state_code: string
          state_name: string
          state_rate: number
          updated_at: string | null
        }
        Insert: {
          combined_rate: number
          county_parish: string
          effective_date: string
          id?: string
          jurisdiction_type?: string
          local_rate: number
          state_code: string
          state_name: string
          state_rate: number
          updated_at?: string | null
        }
        Update: {
          combined_rate?: number
          county_parish?: string
          effective_date?: string
          id?: string
          jurisdiction_type?: string
          local_rate?: number
          state_code?: string
          state_name?: string
          state_rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      truck_classes: {
        Row: {
          capacity_tons: number | null
          created_at: string
          description: string | null
          id: string
          max_tons: number | null
          max_yards: number | null
          name: string
          status: string
        }
        Insert: {
          capacity_tons?: number | null
          created_at?: string
          description?: string | null
          id?: string
          max_tons?: number | null
          max_yards?: number | null
          name: string
          status?: string
        }
        Update: {
          capacity_tons?: number | null
          created_at?: string
          description?: string | null
          id?: string
          max_tons?: number | null
          max_yards?: number | null
          name?: string
          status?: string
        }
        Relationships: []
      }
      truck_driver_assignments: {
        Row: {
          created_at: string
          driver_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          truck_id: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          truck_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_driver_assignments_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          mileage_at_service: number | null
          next_service_due: string | null
          notes: string | null
          parts_replaced: string[] | null
          performed_by: string | null
          service_date: string
          service_type: string
          truck_id: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mileage_at_service?: number | null
          next_service_due?: string | null
          notes?: string | null
          parts_replaced?: string[] | null
          performed_by?: string | null
          service_date: string
          service_type: string
          truck_id: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mileage_at_service?: number | null
          next_service_due?: string | null
          notes?: string | null
          parts_replaced?: string[] | null
          performed_by?: string | null
          service_date?: string
          service_type?: string
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_maintenance_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_sessions: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          truck_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          truck_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          truck_id?: string
        }
        Relationships: []
      }
      trucks: {
        Row: {
          class_id: string | null
          created_at: string
          dot_expiry: string | null
          dot_number: string | null
          hub_id: string | null
          id: string
          insurance_expiry: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_maintenance_date: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          name: string
          next_service_due_date: string | null
          notes: string | null
          registration_expiry: string | null
          registration_state: string | null
          status: string
          surecam_device_id: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          dot_expiry?: string | null
          dot_number?: string | null
          hub_id?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_maintenance_date?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name: string
          next_service_due_date?: string | null
          notes?: string | null
          registration_expiry?: string | null
          registration_state?: string | null
          status?: string
          surecam_device_id?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          dot_expiry?: string | null
          dot_number?: string | null
          hub_id?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_maintenance_date?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_due_date?: string | null
          notes?: string | null
          registration_expiry?: string | null
          registration_state?: string | null
          status?: string
          surecam_device_id?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_trucks_class_id"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "truck_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_trucks_hub_id"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_sessions: {
        Row: {
          address_lat: number | null
          address_lng: number | null
          calculated_price: number | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          email_1hr_sent: boolean | null
          email_1hr_sent_at: string | null
          email_24hr_sent: boolean | null
          email_24hr_sent_at: string | null
          email_48hr_sent: boolean | null
          email_48hr_sent_at: string | null
          email_72hr_sent: boolean | null
          email_72hr_sent_at: string | null
          entry_city_name: string | null
          entry_city_page: string | null
          entry_page: string | null
          geo_city: string | null
          geo_country: string | null
          geo_region: string | null
          geo_zip: string | null
          id: string
          ip_address: string | null
          ip_city: string | null
          ip_is_business: boolean | null
          ip_org: string | null
          ip_zip: string | null
          last_seen_at: string | null
          nearest_pit_id: string | null
          nearest_pit_name: string | null
          order_id: string | null
          order_number: string | null
          referrer: string | null
          serviceable: boolean | null
          session_token: string
          stage: string | null
          stripe_link_clicked: boolean | null
          stripe_link_clicked_at: string | null
          updated_at: string | null
          visit_count: number | null
        }
        Insert: {
          address_lat?: number | null
          address_lng?: number | null
          calculated_price?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          email_1hr_sent?: boolean | null
          email_1hr_sent_at?: string | null
          email_24hr_sent?: boolean | null
          email_24hr_sent_at?: string | null
          email_48hr_sent?: boolean | null
          email_48hr_sent_at?: string | null
          email_72hr_sent?: boolean | null
          email_72hr_sent_at?: string | null
          entry_city_name?: string | null
          entry_city_page?: string | null
          entry_page?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          geo_zip?: string | null
          id?: string
          ip_address?: string | null
          ip_city?: string | null
          ip_is_business?: boolean | null
          ip_org?: string | null
          ip_zip?: string | null
          last_seen_at?: string | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          order_id?: string | null
          order_number?: string | null
          referrer?: string | null
          serviceable?: boolean | null
          session_token: string
          stage?: string | null
          stripe_link_clicked?: boolean | null
          stripe_link_clicked_at?: string | null
          updated_at?: string | null
          visit_count?: number | null
        }
        Update: {
          address_lat?: number | null
          address_lng?: number | null
          calculated_price?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          email_1hr_sent?: boolean | null
          email_1hr_sent_at?: string | null
          email_24hr_sent?: boolean | null
          email_24hr_sent_at?: string | null
          email_48hr_sent?: boolean | null
          email_48hr_sent_at?: string | null
          email_72hr_sent?: boolean | null
          email_72hr_sent_at?: string | null
          entry_city_name?: string | null
          entry_city_page?: string | null
          entry_page?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          geo_zip?: string | null
          id?: string
          ip_address?: string | null
          ip_city?: string | null
          ip_is_business?: boolean | null
          ip_org?: string | null
          ip_zip?: string | null
          last_seen_at?: string | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          order_id?: string | null
          order_number?: string | null
          referrer?: string | null
          serviceable?: boolean | null
          session_token?: string
          stage?: string | null
          stripe_link_clicked?: boolean | null
          stripe_link_clicked_at?: string | null
          updated_at?: string | null
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_nearest_pit_id_fkey"
            columns: ["nearest_pit_id"]
            isOneToOne: false
            referencedRelation: "pits"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          city_name: string
          city_slug: string
          converted: boolean | null
          created_at: string | null
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notified_at: string | null
        }
        Insert: {
          city_name: string
          city_slug: string
          converted?: boolean | null
          created_at?: string | null
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notified_at?: string | null
        }
        Update: {
          city_name?: string
          city_slug?: string
          converted?: boolean | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notified_at?: string | null
        }
        Relationships: []
      }
      zip_tax_rates: {
        Row: {
          city: string | null
          combined_rate: number
          county: string | null
          created_at: string | null
          id: string
          in_service_pit_ids: string[] | null
          lat: number | null
          lng: number | null
          local_rate: number
          population: number | null
          state: string | null
          state_code: string
          state_rate: number
          tax_region_name: string
          zip_code: string
        }
        Insert: {
          city?: string | null
          combined_rate: number
          county?: string | null
          created_at?: string | null
          id?: string
          in_service_pit_ids?: string[] | null
          lat?: number | null
          lng?: number | null
          local_rate?: number
          population?: number | null
          state?: string | null
          state_code?: string
          state_rate?: number
          tax_region_name: string
          zip_code: string
        }
        Update: {
          city?: string | null
          combined_rate?: number
          county?: string | null
          created_at?: string | null
          id?: string
          in_service_pit_ids?: string[] | null
          lat?: number | null
          lng?: number | null
          local_rate?: number
          population?: number | null
          state?: string | null
          state_code?: string
          state_rate?: number
          tax_region_name?: string
          zip_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: { Args: { p_data: Json }; Returns: Json }
      get_own_session: { Args: { p_token: string }; Returns: Json }
      get_table_schema: {
        Args: { p_table: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hub_save_rates: {
        Args: { p_hub_id: string; p_rates: Json }
        Returns: Json
      }
      increment_city_page_views: {
        Args: { p_slug: string }
        Returns: undefined
      }
      increment_visit_count: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
