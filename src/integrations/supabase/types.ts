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
      host_wallets: {
        Row: {
          id: string;
          host_id: string;
          available_balance: number;
          pending_balance: number;
          currency: string;
          is_frozen: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: unknown;
        Update: unknown;
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          wallet_id: string;
          type: string;
          amount: number;
          status: string;
          booking_id: string | null;
          disbursement_id: string | null;
          xendit_reference_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: unknown;
        Update: unknown;
        Relationships: [];
      };
      disbursement_requests: {
        Row: {
          id: string;
          wallet_id: string;
          amount: number;
          status: string;
          payout_method: string;
          account_details_enc: string;
          xendit_disbursement_id: string | null;
          xendit_reference_id: string | null;
          failure_reason: string | null;
          retry_count: number;
          retry_after: string | null;
          requested_at: string;
          processed_at: string | null;
          cycle_month: string;
        };
        Insert: unknown;
        Update: unknown;
        Relationships: [];
      };
      host_payout_accounts: {
        Row: {
          id: string;
          host_id: string;
          payout_method: string;
          account_holder_name: string;
          account_number_enc: string;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: unknown;
        Update: unknown;
        Relationships: [];
      };
      role_mutation_audit: {
        Row: {
          id: string;
          command_id: string;
          command_source: string;
          operation: string;
          target_user_id: string;
          reason_code: string;
          before_state: unknown;
          after_state: unknown;
          executed_by: string | null;
          created_at: string;
        };
        Insert: unknown;
        Update: unknown;
        Relationships: [];
      };
      ai_audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          decision: string
          id: string
          payload: Json
          prompt_version: string
          reason: string
          surface: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          decision: string
          id?: string
          payload?: Json
          prompt_version: string
          reason: string
          surface: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          payload?: Json
          prompt_version?: string
          reason?: string
          surface?: string
        }
        Relationships: []
      }
      booking_transitions: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          booking_id: string
          created_at: string
          from_state: string | null
          id: string
          metadata: Json
          reason: string | null
          to_state: string
        }
        Insert: {
          actor_role: string
          actor_user_id?: string | null
          booking_id: string
          created_at?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_state: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          booking_id?: string
          created_at?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_transitions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          approval_deadline_at: string | null
          booking_flow: string
          cancellation_reason: string | null
          cancelled_at: string | null
          check_in: string
          check_out: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          flow_state: string
          guest_id: string
          guest_message: string | null
          guests: number
          host_id: string
          host_notes: string | null
          id: string
          incidental_hold_required: boolean
          listing_id: string
          nights: number
          partial_refundable_until: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_ref: string | null
          payment_state: Database["public"]["Enums"]["payment_state"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          paymongo_payment_intent_id: string | null
          payout_release_on: string | null
          refundable_until: string | null
          status: Database["public"]["Enums"]["booking_status"]
          stay_type: string
          stripe_payment_intent_id: string | null
          total_php: number
          updated_at: string
        }
        Insert: {
          approval_deadline_at?: string | null
          booking_flow: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          check_in: string
          check_out: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          flow_state: string
          guest_id: string
          guest_message?: string | null
          guests?: number
          host_id: string
          host_notes?: string | null
          id?: string
          incidental_hold_required?: boolean
          listing_id: string
          nights: number
          partial_refundable_until?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_ref?: string | null
          payment_state?: Database["public"]["Enums"]["payment_state"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          paymongo_payment_intent_id?: string | null
          payout_release_on?: string | null
          refundable_until?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stay_type: string
          stripe_payment_intent_id?: string | null
          total_php: number
          updated_at?: string
        }
        Update: {
          approval_deadline_at?: string | null
          booking_flow?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          flow_state?: string
          guest_id?: string
          guest_message?: string | null
          guests?: number
          host_id?: string
          host_notes?: string | null
          id?: string
          incidental_hold_required?: boolean
          listing_id?: string
          nights?: number
          partial_refundable_until?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_ref?: string | null
          payment_state?: Database["public"]["Enums"]["payment_state"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          paymongo_payment_intent_id?: string | null
          payout_release_on?: string | null
          refundable_until?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          stay_type?: string
          stripe_payment_intent_id?: string | null
          total_php?: number
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
      card_holds: {
        Row: {
          authorized_at: string
          booking_id: string
          captured_at: string | null
          created_at: string
          expires_at: string
          id: string
          payment_intent_id: string
          provider: string
          reauth_sent_at: string | null
        }
        Insert: {
          authorized_at?: string
          booking_id: string
          captured_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          payment_intent_id: string
          provider?: string
          reauth_sent_at?: string | null
        }
        Update: {
          authorized_at?: string
          booking_id?: string
          captured_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payment_intent_id?: string
          provider?: string
          reauth_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_requests: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          prompt: string
          response: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          prompt: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          prompt?: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      github_command_registry: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          metadata: Json
          source: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id: string
          metadata?: Json
          source?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
        }
        Relationships: []
      }
      host_applications: {
        Row: {
          city: string
          created_at: string
          full_legal_name: string
          id: string
          id_front_path: string | null
          id_type: string
          phone: string
          property_description: string
          property_type: string
          province: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          full_legal_name: string
          id?: string
          id_front_path?: string | null
          id_type: string
          phone: string
          property_description: string
          property_type: string
          province: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          full_legal_name?: string
          id?: string
          id_front_path?: string | null
          id_type?: string
          phone?: string
          property_description?: string
          property_type?: string
          province?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      host_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          id_photo_url: string | null
          location: string | null
          phone: string | null
          response_rate: number | null
          selfie_url: string | null
          total_bookings: number | null
          total_listings: number | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["host_verification_status"]
          verified_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          id_photo_url?: string | null
          location?: string | null
          phone?: string | null
          response_rate?: number | null
          selfie_url?: string | null
          total_bookings?: number | null
          total_listings?: number | null
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["host_verification_status"]
          verified_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          id_photo_url?: string | null
          location?: string | null
          phone?: string | null
          response_rate?: number | null
          selfie_url?: string | null
          total_bookings?: number | null
          total_listings?: number | null
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["host_verification_status"]
          verified_at?: string | null
        }
        Relationships: []
      }
      incidental_reviews: {
        Row: {
          booking_id: string
          created_at: string
          evidence_urls: string[]
          guest_response: string | null
          host_id: string
          id: string
          manual_gate_approved: boolean
          status: string
          subjective_case: boolean
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          evidence_urls?: string[]
          guest_response?: string | null
          host_id: string
          id?: string
          manual_gate_approved?: boolean
          status?: string
          subjective_case?: boolean
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          evidence_urls?: string[]
          guest_response?: string | null
          host_id?: string
          id?: string
          manual_gate_approved?: boolean
          status?: string
          subjective_case?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidental_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
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
      listing_availability_windows: {
        Row: {
          declared_at: string
          declared_through: string
          id: string
          listing_id: string
          updated_at: string
        }
        Insert: {
          declared_at?: string
          declared_through: string
          id?: string
          listing_id: string
          updated_at?: string
        }
        Update: {
          declared_at?: string
          declared_through?: string
          id?: string
          listing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_availability_windows_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_blackout_dates: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          listing_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          listing_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          listing_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_blackout_dates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_house_rules: {
        Row: {
          created_at: string
          current_hash: string
          current_version: string
          id: string
          listing_id: string
          rules_json: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          current_hash: string
          current_version: string
          id?: string
          listing_id: string
          rules_json: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          current_hash?: string
          current_version?: string
          id?: string
          listing_id?: string
          rules_json?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_house_rules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_stay_instructions: {
        Row: {
          access_instructions: string
          check_in_window: string
          check_out_time: string
          created_at: string
          emergency_contact: string
          id: string
          listing_id: string
          updated_at: string
          wifi_details: string | null
        }
        Insert: {
          access_instructions: string
          check_in_window: string
          check_out_time: string
          created_at?: string
          emergency_contact: string
          id?: string
          listing_id: string
          updated_at?: string
          wifi_details?: string | null
        }
        Update: {
          access_instructions?: string
          check_in_window?: string
          check_out_time?: string
          created_at?: string
          emergency_contact?: string
          id?: string
          listing_id?: string
          updated_at?: string
          wifi_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_stay_instructions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          amenities: string[] | null
          avg_rating: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          host_id: string
          id: string
          images: Json | null
          instant_book: boolean
          is_owner_direct: boolean
          lat: number | null
          lng: number | null
          long_term_enabled: boolean
          max_guests: number | null
          max_nights: number | null
          min_nights: number | null
          nightly_php: number
          province: string
          review_count: number | null
          short_term_enabled: boolean
          slug: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          type: Database["public"]["Enums"]["listing_type"]
          updated_at: string
          video_url: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          host_id: string
          id?: string
          images?: Json | null
          instant_book?: boolean
          is_owner_direct?: boolean
          lat?: number | null
          lng?: number | null
          long_term_enabled?: boolean
          max_guests?: number | null
          max_nights?: number | null
          min_nights?: number | null
          nightly_php: number
          province: string
          review_count?: number | null
          short_term_enabled?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          type?: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          host_id?: string
          id?: string
          images?: Json | null
          instant_book?: boolean
          is_owner_direct?: boolean
          lat?: number | null
          lng?: number | null
          long_term_enabled?: boolean
          max_guests?: number | null
          max_nights?: number | null
          min_nights?: number | null
          nightly_php?: number
          province?: string
          review_count?: number | null
          short_term_enabled?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          type?: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      membership_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          paymongo_session_id: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          paymongo_session_id?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          paymongo_session_id?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          booking_updates: boolean
          check_in_updates: boolean
          created_at: string
          dispute_updates: boolean
          email_enabled: boolean
          evidence_updates: boolean
          host_status_updates: boolean
          in_app_enabled: boolean
          marketing_enabled: boolean
          payment_updates: boolean
          payout_updates: boolean
          push_enabled: boolean
          refund_updates: boolean
          safety_critical_updates: boolean
          support_updates: boolean
          updated_at: string
          user_id: string
          verification_updates: boolean
        }
        Insert: {
          booking_updates?: boolean
          check_in_updates?: boolean
          created_at?: string
          dispute_updates?: boolean
          email_enabled?: boolean
          evidence_updates?: boolean
          host_status_updates?: boolean
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          payment_updates?: boolean
          payout_updates?: boolean
          push_enabled?: boolean
          refund_updates?: boolean
          safety_critical_updates?: boolean
          support_updates?: boolean
          updated_at?: string
          user_id: string
          verification_updates?: boolean
        }
        Update: {
          booking_updates?: boolean
          check_in_updates?: boolean
          created_at?: string
          dispute_updates?: boolean
          email_enabled?: boolean
          evidence_updates?: boolean
          host_status_updates?: boolean
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          payment_updates?: boolean
          payout_updates?: boolean
          push_enabled?: boolean
          refund_updates?: boolean
          safety_critical_updates?: boolean
          support_updates?: boolean
          updated_at?: string
          user_id?: string
          verification_updates?: boolean
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body_template: string
          category: string
          created_at: string
          default_email: boolean
          default_in_app: boolean
          default_push: boolean
          key: string
          push_high_value_only: boolean
          title_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          category: string
          created_at?: string
          default_email?: boolean
          default_in_app?: boolean
          default_push?: boolean
          key: string
          push_high_value_only?: boolean
          title_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          category?: string
          created_at?: string
          default_email?: boolean
          default_in_app?: boolean
          default_push?: boolean
          key?: string
          push_high_value_only?: boolean
          title_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_holds: {
        Row: {
          booking_id: string
          created_at: string
          hold_until: string
          id: string
          reason: string
          released_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          hold_until: string
          id?: string
          reason: string
          released_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          hold_until?: string
          id?: string
          reason?: string
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      physiomni_devices: {
        Row: {
          device_name: string | null
          device_serial: string
          firmware_version: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          location_tag: string | null
          metadata: Json
          registered_at: string
          tenant_id: string
        }
        Insert: {
          device_name?: string | null
          device_serial: string
          firmware_version?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_tag?: string | null
          metadata?: Json
          registered_at?: string
          tenant_id: string
        }
        Update: {
          device_name?: string | null
          device_serial?: string
          firmware_version?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_tag?: string | null
          metadata?: Json
          registered_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      physiomni_telemetry: {
        Row: {
          captured_at: string
          device_serial: string
          id: string
          metadata: Json
          received_at: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Insert: {
          captured_at: string
          device_serial: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Update: {
          captured_at?: string
          device_serial?: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c?: number
          tenant_id?: string
          vibration_x?: number
          vibration_y?: number
          vibration_z?: number
        }
        Relationships: []
      }
      physiomni_telemetry_2026_05: {
        Row: {
          captured_at: string
          device_serial: string
          id: string
          metadata: Json
          received_at: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Insert: {
          captured_at: string
          device_serial: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Update: {
          captured_at?: string
          device_serial?: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c?: number
          tenant_id?: string
          vibration_x?: number
          vibration_y?: number
          vibration_z?: number
        }
        Relationships: []
      }
      physiomni_telemetry_2026_06: {
        Row: {
          captured_at: string
          device_serial: string
          id: string
          metadata: Json
          received_at: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Insert: {
          captured_at: string
          device_serial: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Update: {
          captured_at?: string
          device_serial?: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c?: number
          tenant_id?: string
          vibration_x?: number
          vibration_y?: number
          vibration_z?: number
        }
        Relationships: []
      }
      physiomni_telemetry_2026_07: {
        Row: {
          captured_at: string
          device_serial: string
          id: string
          metadata: Json
          received_at: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Insert: {
          captured_at: string
          device_serial: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Update: {
          captured_at?: string
          device_serial?: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c?: number
          tenant_id?: string
          vibration_x?: number
          vibration_y?: number
          vibration_z?: number
        }
        Relationships: []
      }
      physiomni_telemetry_2026_08: {
        Row: {
          captured_at: string
          device_serial: string
          id: string
          metadata: Json
          received_at: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Insert: {
          captured_at: string
          device_serial: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c: number
          tenant_id: string
          vibration_x: number
          vibration_y: number
          vibration_z: number
        }
        Update: {
          captured_at?: string
          device_serial?: string
          id?: string
          metadata?: Json
          received_at?: string
          temperature_c?: number
          tenant_id?: string
          vibration_x?: number
          vibration_y?: number
          vibration_z?: number
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
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          id: number
          identifier: string
          window_start: string
        }
        Insert: {
          count?: number
          id?: number
          identifier: string
          window_start?: string
        }
        Update: {
          count?: number
          id?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          booking_id: string
          created_at: string
          host_id: string
          id: string
          is_public: boolean | null
          listing_id: string
          rating: number
          reviewee_id: string | null
          reviewer_id: string
          reviewer_role: string
        }
        Insert: {
          body?: string | null
          booking_id: string
          created_at?: string
          host_id: string
          id?: string
          is_public?: boolean | null
          listing_id: string
          rating: number
          reviewee_id?: string | null
          reviewer_id: string
          reviewer_role?: string
        }
        Update: {
          body?: string | null
          booking_id?: string
          created_at?: string
          host_id?: string
          id?: string
          is_public?: boolean | null
          listing_id?: string
          rating?: number
          reviewee_id?: string | null
          reviewer_id?: string
          reviewer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_events: {
        Row: {
          booking_id: string | null
          event_id: string
          event_type: string
          id: string
          processed_at: string
          provider: string
        }
        Insert: {
          booking_id?: string | null
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
          provider: string
        }
        Update: {
          booking_id?: string | null
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_max_count: number
          p_window_start: string
        }
        Returns: {
          allowed: boolean
          current_count: number
        }[]
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      generate_listing_slug: {
        Args: { listing_id: string; title: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
          accepted_at: string
          eligible: boolean
          last_acceptance_id: string
          reason: string
          requires_full_scroll: boolean
        }[]
      }
      notify_user: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "host" | "member" | "user"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      host_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
      listing_status: "draft" | "active" | "inactive" | "suspended"
      listing_type:
        | "entire_place"
        | "private_room"
        | "shared_room"
        | "glamping"
        | "villa"
        | "resort"
      message_sender: "user" | "ai" | "admin" | "system"
      payment_method: "gcash" | "maya" | "card" | "bank_transfer" | "cash"
      payment_provider: "paymongo" | "stripe"
      payment_state:
        | "intent_created"
        | "authorized"
        | "capturing"
        | "captured"
        | "refunding"
        | "refunded"
        | "payout_on_hold"
        | "payout_released"
        | "failed"
        | "expired"
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
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      host_verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
      ],
      listing_status: ["draft", "active", "inactive", "suspended"],
      listing_type: [
        "entire_place",
        "private_room",
        "shared_room",
        "glamping",
        "villa",
        "resort",
      ],
      message_sender: ["user", "ai", "admin", "system"],
      payment_method: ["gcash", "maya", "card", "bank_transfer", "cash"],
      payment_provider: ["paymongo", "stripe"],
      payment_state: [
        "intent_created",
        "authorized",
        "capturing",
        "captured",
        "refunding",
        "refunded",
        "payout_on_hold",
        "payout_released",
        "failed",
        "expired",
      ],
      payment_status: ["unpaid", "pending", "paid", "failed", "refunded"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "resolved", "closed", "escalated"],
    },
  },
} as const
