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
      city_pages: {
        Row: {
          base_price: number | null
          city_name: string
          city_slug: string
          content: string | null
          content_generated_at: string | null
          created_at: string | null
          distance_from_pit: number | null
          h1_text: string | null
          id: string
          last_viewed_at: string | null
          lat: number | null
          lng: number | null
          meta_description: string | null
          meta_title: string | null
          page_views: number | null
          pit_id: string | null
          prompt_version: string | null
          region: string | null
          state: string
          status: string | null
          updated_at: string | null
          zip_codes: string[] | null
        }
        Insert: {
          base_price?: number | null
          city_name: string
          city_slug: string
          content?: string | null
          content_generated_at?: string | null
          created_at?: string | null
          distance_from_pit?: number | null
          h1_text?: string | null
          id?: string
          last_viewed_at?: string | null
          lat?: number | null
          lng?: number | null
          meta_description?: string | null
          meta_title?: string | null
          page_views?: number | null
          pit_id?: string | null
          prompt_version?: string | null
          region?: string | null
          state?: string
          status?: string | null
          updated_at?: string | null
          zip_codes?: string[] | null
        }
        Update: {
          base_price?: number | null
          city_name?: string
          city_slug?: string
          content?: string | null
          content_generated_at?: string | null
          created_at?: string | null
          distance_from_pit?: number | null
          h1_text?: string | null
          id?: string
          last_viewed_at?: string | null
          lat?: number | null
          lng?: number | null
          meta_description?: string | null
          meta_title?: string | null
          page_views?: number | null
          pit_id?: string | null
          prompt_version?: string | null
          region?: string | null
          state?: string
          status?: string | null
          updated_at?: string | null
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
          contacted: boolean
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          distance_miles: number | null
          id: string
          ip_address: string | null
          lead_number: string | null
          nearest_pit_distance: number | null
          nearest_pit_id: string | null
          nearest_pit_name: string | null
          notes: string | null
          stage: string | null
        }
        Insert: {
          address: string
          contacted?: boolean
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          distance_miles?: number | null
          id?: string
          ip_address?: string | null
          lead_number?: string | null
          nearest_pit_distance?: number | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          notes?: string | null
          stage?: string | null
        }
        Update: {
          address?: string
          contacted?: boolean
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          distance_miles?: number | null
          id?: string
          ip_address?: string | null
          lead_number?: string | null
          nearest_pit_distance?: number | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          notes?: string | null
          stage?: string | null
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          cash_collected: boolean | null
          cash_collected_at: string | null
          cash_collected_by: string | null
          confirmation_token: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_date: string | null
          delivery_day_of_week: string | null
          delivery_window: string
          discount_amount: number | null
          distance_miles: number
          id: string
          lead_reference: string | null
          lookup_token: string | null
          lookup_token_used: boolean
          notes: string | null
          order_number: string | null
          payment_method: string
          payment_status: string
          price: number
          quantity: number
          same_day_requested: boolean
          saturday_surcharge: boolean
          saturday_surcharge_amount: number
          status: string
          stripe_payment_id: string | null
          tax_amount: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          confirmation_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_window?: string
          discount_amount?: number | null
          distance_miles: number
          id?: string
          lead_reference?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          notes?: string | null
          order_number?: string | null
          payment_method?: string
          payment_status?: string
          price: number
          quantity?: number
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          status?: string
          stripe_payment_id?: string | null
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          cash_collected?: boolean | null
          cash_collected_at?: string | null
          cash_collected_by?: string | null
          confirmation_token?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_date?: string | null
          delivery_day_of_week?: string | null
          delivery_window?: string
          discount_amount?: number | null
          distance_miles?: number
          id?: string
          lead_reference?: string | null
          lookup_token?: string | null
          lookup_token_used?: boolean
          notes?: string | null
          order_number?: string | null
          payment_method?: string
          payment_status?: string
          price?: number
          quantity?: number
          same_day_requested?: boolean
          saturday_surcharge?: boolean
          saturday_surcharge_amount?: number
          status?: string
          stripe_payment_id?: string | null
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
          lat: number
          lon: number
          max_distance: number | null
          name: string
          notes: string | null
          operating_days: number[] | null
          price_per_extra_mile: number | null
          same_day_cutoff: string | null
          saturday_surcharge_override: number | null
          served_cities: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          base_price?: number | null
          created_at?: string
          free_miles?: number | null
          id?: string
          is_default?: boolean
          lat: number
          lon: number
          max_distance?: number | null
          name: string
          notes?: string | null
          operating_days?: number[] | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          base_price?: number | null
          created_at?: string
          free_miles?: number | null
          id?: string
          is_default?: boolean
          lat?: number
          lon?: number
          max_distance?: number | null
          name?: string
          notes?: string | null
          operating_days?: number[] | null
          price_per_extra_mile?: number | null
          same_day_cutoff?: string | null
          saturday_surcharge_override?: number | null
          served_cities?: Json | null
          status?: string
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
          id: string
          last_seen_at: string | null
          nearest_pit_id: string | null
          nearest_pit_name: string | null
          order_id: string | null
          order_number: string | null
          serviceable: boolean | null
          session_token: string
          stage: string | null
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
          id?: string
          last_seen_at?: string | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          order_id?: string | null
          order_number?: string | null
          serviceable?: boolean | null
          session_token: string
          stage?: string | null
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
          id?: string
          last_seen_at?: string | null
          nearest_pit_id?: string | null
          nearest_pit_name?: string | null
          order_id?: string | null
          order_number?: string | null
          serviceable?: boolean | null
          session_token?: string
          stage?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: { Args: { p_data: Json }; Returns: Json }
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
