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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string
          listing_id: string
          guest_id: string
          host_id: string
          check_in: string
          check_out: string
          nights: number
          guests: number
          total_php: number
          status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
          payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"
          payment_method: "gcash" | "maya" | "card" | "bank_transfer" | "cash" | null
          payment_ref: string | null
          paymongo_payment_intent_id: string | null
          guest_message: string | null
          host_notes: string | null
          confirmed_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          guest_id: string
          host_id: string
          check_in: string
          check_out: string
          nights: number
          guests?: number
          total_php: number
          status?: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
          payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded"
          payment_method?: "gcash" | "maya" | "card" | "bank_transfer" | "cash" | null
          payment_ref?: string | null
          paymongo_payment_intent_id?: string | null
          guest_message?: string | null
          host_notes?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          guest_id?: string
          host_id?: string
          check_in?: string
          check_out?: string
          nights?: number
          guests?: number
          total_php?: number
          status?: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
          payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded"
          payment_method?: "gcash" | "maya" | "card" | "bank_transfer" | "cash" | null
          payment_ref?: string | null
          paymongo_payment_intent_id?: string | null
          guest_message?: string | null
          host_notes?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          data: Json
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          data?: Json
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          data?: Json
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          listing_id: string
          reviewer_id: string
          host_id: string
          reviewee_id: string | null
          reviewer_role: string
          rating: number
          body: string | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          listing_id: string
          reviewer_id: string
          host_id: string
          reviewee_id?: string | null
          reviewer_role?: string
          rating: number
          body?: string | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          listing_id?: string
          reviewer_id?: string
          host_id?: string
          reviewee_id?: string | null
          reviewer_role?: string
          rating?: number
          body?: string | null
          is_public?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      host_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          bio: string | null
          phone: string | null
          location: string | null
          id_photo_url: string | null
          selfie_url: string | null
          verification_status: "unverified" | "pending" | "verified" | "rejected"
          verified_at: string | null
          response_rate: number | null
          total_listings: number | null
          total_bookings: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string | null
          bio?: string | null
          phone?: string | null
          location?: string | null
          id_photo_url?: string | null
          selfie_url?: string | null
          verification_status?: "unverified" | "pending" | "verified" | "rejected"
          verified_at?: string | null
          response_rate?: number | null
          total_listings?: number | null
          total_bookings?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string | null
          bio?: string | null
          phone?: string | null
          location?: string | null
          id_photo_url?: string | null
          selfie_url?: string | null
          verification_status?: "unverified" | "pending" | "verified" | "rejected"
          verified_at?: string | null
          response_rate?: number | null
          total_listings?: number | null
          total_bookings?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          id: string
          host_id: string
          title: string
          slug: string | null
          description: string
          type: string
          city: string
          province: string
          address: string | null
          lat: number | null
          lng: number | null
          bedrooms: number
          bathrooms: number
          max_guests: number
          nightly_php: number
          min_nights: number
          amenities: string[]
          images: string[]
          video_url: string | null
          is_owner_direct: boolean
          instant_book: boolean
          status: "draft" | "active" | "inactive" | "suspended"
          avg_rating: number | null
          review_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string
          title: string
          slug?: string | null
          description?: string
          type?: string
          city: string
          province: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          bedrooms?: number
          bathrooms?: number
          max_guests?: number
          nightly_php: number
          min_nights?: number
          amenities?: string[]
          images?: string[]
          video_url?: string | null
          is_owner_direct?: boolean
          instant_book?: boolean
          status?: "draft" | "active" | "inactive" | "suspended"
          avg_rating?: number | null
          review_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          title?: string
          slug?: string | null
          description?: string
          type?: string
          city?: string
          province?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          bedrooms?: number
          bathrooms?: number
          max_guests?: number
          nightly_php?: number
          min_nights?: number
          amenities?: string[]
          images?: string[]
          video_url?: string | null
          is_owner_direct?: boolean
          instant_book?: boolean
          status?: "draft" | "active" | "inactive" | "suspended"
          avg_rating?: number | null
          review_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          sender: Database["public"]["Enums"]["message_sender"]
          ticket_id: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          sender: Database["public"]["Enums"]["message_sender"]
          ticket_id: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          sender?: Database["public"]["Enums"]["message_sender"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_response: string | null
          category: string | null
          created_at: string
          escalated: boolean
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_num: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          category?: string | null
          created_at?: string
          escalated?: boolean
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_num?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_response?: string | null
          category?: string | null
          created_at?: string
          escalated?: boolean
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_num?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }

      legal_consent_acceptances: {
        Row: {
          accepted_at: string
          checkbox_label: string
          context_id: string
          created_at: string
          document_hash: string
          document_id: string
          document_version: string
          gate_opened_at: string
          id: string
          metadata: Json
          role: string
          scroll_completed_at: string | null
          scrolled_to_bottom: boolean
          user_id: string
        }
        Insert: {
          accepted_at?: string
          checkbox_label: string
          context_id: string
          created_at?: string
          document_hash: string
          document_id: string
          document_version: string
          gate_opened_at?: string
          id?: string
          metadata?: Json
          role: string
          scroll_completed_at?: string | null
          scrolled_to_bottom: boolean
          user_id: string
        }
        Update: {
          accepted_at?: string
          checkbox_label?: string
          context_id?: string
          created_at?: string
          document_hash?: string
          document_id?: string
          document_version?: string
          gate_opened_at?: string
          id?: string
          metadata?: Json
          role?: string
          scroll_completed_at?: string | null
          scrolled_to_bottom?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {

      legal_fast_accept_eligible: {
        Args: {
          p_changed_topics?: string[]
          p_context_id: string
          p_document_hash: string
          p_document_id: string
          p_document_version: string
          p_role: string
          p_user_id: string
        }
        Returns: {
          accepted_at: string | null
          eligible: boolean
          last_acceptance_id: string | null
          reason: string
          requires_full_scroll: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "host" | "member" | "user"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
      host_verification_status: "unverified" | "pending" | "verified" | "rejected"
      listing_type: "entire_place" | "private_room" | "shared_room" | "glamping" | "villa" | "resort"
      message_sender: "user" | "ai" | "admin" | "system"
      payment_method: "gcash" | "maya" | "card" | "bank_transfer" | "cash"
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "resolved" | "closed" | "escalated"
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
      app_role: ["admin", "host", "member", "user"],
      booking_status: ["pending", "confirmed", "cancelled", "completed", "no_show"],
      host_verification_status: ["unverified", "pending", "verified", "rejected"],
      listing_type: ["entire_place", "private_room", "shared_room", "glamping", "villa", "resort"],
      message_sender: ["user", "ai", "admin", "system"],
      payment_method: ["gcash", "maya", "card", "bank_transfer", "cash"],
      payment_status: ["unpaid", "pending", "paid", "failed", "refunded"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "resolved", "closed", "escalated"],
    },
  },
} as const
