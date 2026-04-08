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
      delivery_leads: {
        Row: {
          address: string
          browser_geolat: number | null
          browser_geolng: number | null
          calculated_price: number | null
          contacted: boolean
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
          stage?: string | null
          submission_count?: number | null
          user_agent?: string | null
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
      orders: {
        Row: {
          billing_address: string | null
          billing_country: string | null
          billing_matches_delivery: boolean | null
          billing_name: string | null
          billing_zip: string | null
          call_verified_at: string | null
          call_verified_by: string | null
          capture_attempted_at: string | null
          capture_status: string | null
          card_authorization_accepted: boolean | null
          card_authorization_timestamp: string | null
          cash_collected: boolean | null
          cash_collected_at: string | null
          cash_collected_by: string | null
          company_name: string | null
          confirmation_token: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_date: string | null
          delivery_day_of_week: string | null
          delivery_terms_accepted: boolean | null
          delivery_terms_timestamp: string | null
          delivery_window: string
          discount_amount: number | null
          distance_miles: number
          fraud_score: number | null
          fraud_signals: Json | null
          id: string
          lead_reference: string | null
          lookup_token: string | null
          lookup_token_used: boolean
          notes: string | null
          order_number: string | null
          payment_attempts: number | null
          payment_method: string
          payment_status: string
          pit_id: string | null
          price: number
          quantity: number
          reschedule_token: string | null
          reschedule_token_used: boolean | null
          review_status: string | null
          same_day_requested: boolean
          saturday_surcharge: boolean
          saturday_surcharge_amount: number
          status: string
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          sunday_surcharge: boolean
          sunday_surcharge_amount: number
          tax_amount: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_country?: string | null
          billing_matches_delivery?: boolean | null
          billing_name?: string | null
          billing_zip?: string | null
          call_verified_at?: string | null
          call_verified_by?: string | null
          capture_attempted_at?: string | null
          capture_status?: string | null
          card_authorization_accepted?: boolean | null
          card_authorization_timestamp?: string | null
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          company_name?: string | null
          confirmation_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_terms_accepted?: boolean | null
          delivery_terms_timestamp?: string | null
          delivery_window?: string
          discount_amount?: number | null
          distance_miles: number
          fraud_score?: number | null
          fraud_signals?: Json | null
          id?: string
          lead_reference?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          notes?: string | null
          order_number?: string | null
          payment_attempts?: number | null
          payment_method?: string
          payment_status?: string
          pit_id?: string | null
          price: number
          quantity?: number
          reschedule_token?: string | null
          reschedule_token_used?: boolean | null
          review_status?: string | null
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          sunday_surcharge?: boolean
          sunday_surcharge_amount?: number
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_country?: string | null
          billing_matches_delivery?: boolean | null
          billing_name?: string | null
          billing_zip?: string | null
          call_verified_at?: string | null
          call_verified_by?: string | null
          capture_attempted_at?: string | null
          capture_status?: string | null
          card_authorization_accepted?: boolean | null
          card_authorization_timestamp?: string | null
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          company_name?: string | null
          confirmation_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_terms_accepted?: boolean | null
          delivery_terms_timestamp?: string | null
          delivery_window?: string
          discount_amount?: number | null
          distance_miles?: number
          fraud_score?: number | null
          fraud_signals?: Json | null
          id?: string
          lead_reference?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          notes?: string | null
          order_number?: string | null
          payment_attempts?: number | null
          payment_method?: string
          payment_status?: string
          pit_id?: string | null
          price?: number
          quantity?: number
          reschedule_token?: string | null
          reschedule_token_used?: boolean | null
          review_status?: string | null
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          sunday_surcharge?: boolean
          sunday_surcharge_amount?: number
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
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
      pits: {
        Row: {
          address: string
          base_price: number | null
          created_at: string
          free_miles: number | null
          id: string
          is_default: boolean
          is_pickup_only: boolean
          lat: number
          lon: number
          max_distance: number | null
          name: string
          notes: string | null
          operating_days: number[] | null
          price_per_extra_mile: number | null
          same_day_cutoff: string | null
          saturday_load_limit: number | null
          saturday_surcharge_override: number | null
          served_cities: Json | null
          status: string
          sunday_load_limit: number | null
          sunday_surcharge: number | null
          updated_at: string
        }
        Insert: {
          address: string
          base_price?: number | null
          created_at?: string
          free_miles?: number | null
          id?: string
          is_default?: boolean
          is_pickup_only?: boolean
          lat: number
          lon: number
          max_distance?: number | null
          name: string
          notes?: string | null
          operating_days?: number[] | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_load_limit?: number | null
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
          sunday_load_limit?: number | null
          sunday_surcharge?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          base_price?: number | null
          created_at?: string
          free_miles?: number | null
          id?: string
          is_default?: boolean
          is_pickup_only?: boolean
          lat?: number
          lon?: number
          max_distance?: number | null
          name?: string
          notes?: string | null
          operating_days?: number[] | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_load_limit?: number | null
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
          sunday_load_limit?: number | null
          sunday_surcharge?: number | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: { Args: { p_data: Json }; Returns: Json }
      get_own_session: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
