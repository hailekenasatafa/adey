// Generated from supabase/migrations by `node supabase/tests/run_local.mjs --types`. Do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  "public": {
    Tables: {
      "ad_screen_blocked_dates": {
        Row: {
          "created_at": string
          "end_date": string
          "id": string
          "reason": string | null
          "screen_id": string
          "start_date": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "end_date": string
          "id"?: string
          "reason"?: string | null
          "screen_id": string
          "start_date": string
        }
        Update: {
          "created_at"?: string
          "end_date"?: string
          "id"?: string
          "reason"?: string | null
          "screen_id"?: string
          "start_date"?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_screen_blocked_dates_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "ad_screen_packages": {
        Row: {
          "created_at": string
          "description": string | null
          "duration_days": number
          "id": string
          "is_active": boolean
          "name": string
          "plays_per_day": number | null
          "price_cents": number
          "screen_id": string
          "sort_order": number
          "spot_seconds": number | null
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "description"?: string | null
          "duration_days": number
          "id"?: string
          "is_active"?: boolean
          "name": string
          "plays_per_day"?: number | null
          "price_cents": number
          "screen_id": string
          "sort_order"?: number
          "spot_seconds"?: number | null
        }
        Update: {
          "created_at"?: string
          "description"?: string | null
          "duration_days"?: number
          "id"?: string
          "is_active"?: boolean
          "name"?: string
          "plays_per_day"?: number | null
          "price_cents"?: number
          "screen_id"?: string
          "sort_order"?: number
          "spot_seconds"?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_screen_packages_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "ad_screen_private": {
        Row: {
          "auto_decline_below_min": boolean
          "min_price_cents": number | null
          "screen_id": string
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "auto_decline_below_min"?: boolean
          "min_price_cents"?: number | null
          "screen_id": string
          "updated_at"?: string
        }
        Update: {
          "auto_decline_below_min"?: boolean
          "min_price_cents"?: number | null
          "screen_id"?: string
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_screen_private_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: true
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "ad_screens": {
        Row: {
          "advertising_hours": NonNullable<Json>
          "base_duration_days": number
          "base_price_cents": number
          "business_id": string
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "description": string | null
          "estimated_daily_visitors": number | null
          "formats": (Database["public"]["Enums"]["ad_format"])[]
          "id": string
          "images": (string)[]
          "max_video_seconds": number | null
          "orientation": string | null
          "placement": string | null
          "rating_avg": number | null
          "rating_count": number
          "resolution": string | null
          "screen_count": number
          "screen_size_inches": number | null
          "status": Database["public"]["Enums"]["screen_status"]
          "title": string
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "advertising_hours"?: NonNullable<Json>
          "base_duration_days"?: number
          "base_price_cents": number
          "business_id": string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "estimated_daily_visitors"?: number | null
          "formats"?: (Database["public"]["Enums"]["ad_format"])[]
          "id"?: string
          "images"?: (string)[]
          "max_video_seconds"?: number | null
          "orientation"?: string | null
          "placement"?: string | null
          "rating_avg"?: number | null
          "rating_count"?: number
          "resolution"?: string | null
          "screen_count"?: number
          "screen_size_inches"?: number | null
          "status"?: Database["public"]["Enums"]["screen_status"]
          "title": string
          "updated_at"?: string
        }
        Update: {
          "advertising_hours"?: NonNullable<Json>
          "base_duration_days"?: number
          "base_price_cents"?: number
          "business_id"?: string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "estimated_daily_visitors"?: number | null
          "formats"?: (Database["public"]["Enums"]["ad_format"])[]
          "id"?: string
          "images"?: (string)[]
          "max_video_seconds"?: number | null
          "orientation"?: string | null
          "placement"?: string | null
          "rating_avg"?: number | null
          "rating_count"?: number
          "resolution"?: string | null
          "screen_count"?: number
          "screen_size_inches"?: number | null
          "status"?: Database["public"]["Enums"]["screen_status"]
          "title"?: string
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_screens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "admin_audit_log": {
        Row: {
          "action": string
          "actor_id": string | null
          "created_at": string
          "details": NonNullable<Json>
          "id": number
          "target_id": string | null
          "target_type": string | null
        }
        ComputedFields: never
        Insert: {
          "action": string
          "actor_id"?: string | null
          "created_at"?: string
          "details"?: NonNullable<Json>
          "id"?: never
          "target_id"?: string | null
          "target_type"?: string | null
        }
        Update: {
          "action"?: string
          "actor_id"?: string | null
          "created_at"?: string
          "details"?: NonNullable<Json>
          "id"?: never
          "target_id"?: string | null
          "target_type"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "analytics_events": {
        Row: {
          "business_id": string | null
          "created_at": string
          "event": Database["public"]["Enums"]["analytics_event"]
          "id": number
          "meta": NonNullable<Json>
          "platform": string | null
          "session_id": string | null
          "target_id": string | null
          "target_type": string | null
          "user_id": string | null
        }
        ComputedFields: never
        Insert: {
          "business_id"?: string | null
          "created_at"?: string
          "event": Database["public"]["Enums"]["analytics_event"]
          "id"?: never
          "meta"?: NonNullable<Json>
          "platform"?: string | null
          "session_id"?: string | null
          "target_id"?: string | null
          "target_type"?: string | null
          "user_id"?: string | null
        }
        Update: {
          "business_id"?: string | null
          "created_at"?: string
          "event"?: Database["public"]["Enums"]["analytics_event"]
          "id"?: never
          "meta"?: NonNullable<Json>
          "platform"?: string | null
          "session_id"?: string | null
          "target_id"?: string | null
          "target_type"?: string | null
          "user_id"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "announcements": {
        Row: {
          "audience": string
          "body": string
          "created_at": string
          "created_by": string | null
          "id": string
          "kind": string
          "recipient_count": number
          "route": string | null
          "title": string
        }
        ComputedFields: never
        Insert: {
          "audience": string
          "body": string
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "kind": string
          "recipient_count"?: number
          "route"?: string | null
          "title": string
        }
        Update: {
          "audience"?: string
          "body"?: string
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "kind"?: string
          "recipient_count"?: number
          "route"?: string | null
          "title"?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "bookings": {
        Row: {
          "accepted_at": string
          "accepted_by": string | null
          "advertiser_business_id": string
          "agreed_price_cents": number
          "campaign_id": string
          "cancel_reason": string | null
          "cancelled_at": string | null
          "commission_bps": number
          "commission_cents": number
          "completed_at": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "delivery_status": Database["public"]["Enums"]["delivery_status"]
          "end_date": string
          "id": string
          "monetized": boolean
          "net_to_owner_cents": number
          "payment_status": Database["public"]["Enums"]["payment_status"]
          "request_id": string
          "screen_business_id": string
          "screen_id": string
          "start_date": string
          "status": Database["public"]["Enums"]["booking_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "accepted_at"?: string
          "accepted_by"?: string | null
          "advertiser_business_id": string
          "agreed_price_cents": number
          "campaign_id": string
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "commission_bps"?: number
          "commission_cents"?: number
          "completed_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "delivery_status"?: Database["public"]["Enums"]["delivery_status"]
          "end_date": string
          "id"?: string
          "monetized"?: boolean
          "net_to_owner_cents"?: number
          "payment_status"?: Database["public"]["Enums"]["payment_status"]
          "request_id": string
          "screen_business_id": string
          "screen_id": string
          "start_date": string
          "status"?: Database["public"]["Enums"]["booking_status"]
          "updated_at"?: string
        }
        Update: {
          "accepted_at"?: string
          "accepted_by"?: string | null
          "advertiser_business_id"?: string
          "agreed_price_cents"?: number
          "campaign_id"?: string
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "commission_bps"?: number
          "commission_cents"?: number
          "completed_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "delivery_status"?: Database["public"]["Enums"]["delivery_status"]
          "end_date"?: string
          "id"?: string
          "monetized"?: boolean
          "net_to_owner_cents"?: number
          "payment_status"?: Database["public"]["Enums"]["payment_status"]
          "request_id"?: string
          "screen_business_id"?: string
          "screen_id"?: string
          "start_date"?: string
          "status"?: Database["public"]["Enums"]["booking_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_advertiser_business_id_fkey"
            columns: ["advertiser_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "campaign_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_screen_business_id_fkey"
            columns: ["screen_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "business_members": {
        Row: {
          "business_id": string
          "created_at": string
          "role": Database["public"]["Enums"]["member_role"]
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "created_at"?: string
          "role"?: Database["public"]["Enums"]["member_role"]
          "user_id": string
        }
        Update: {
          "business_id"?: string
          "created_at"?: string
          "role"?: Database["public"]["Enums"]["member_role"]
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "business_photos": {
        Row: {
          "business_id": string
          "caption": string | null
          "created_at": string
          "id": string
          "sort_order": number
          "storage_path": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "caption"?: string | null
          "created_at"?: string
          "id"?: string
          "sort_order"?: number
          "storage_path": string
        }
        Update: {
          "business_id"?: string
          "caption"?: string | null
          "created_at"?: string
          "id"?: string
          "sort_order"?: number
          "storage_path"?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "business_verifications": {
        Row: {
          "approved_at": string
          "approved_by": string | null
          "business_id": string
          "expires_at": string | null
          "level": Database["public"]["Enums"]["verification_level"]
          "request_id": string | null
          "revoke_reason": string | null
          "revoked_at": string | null
        }
        ComputedFields: never
        Insert: {
          "approved_at"?: string
          "approved_by"?: string | null
          "business_id": string
          "expires_at"?: string | null
          "level": Database["public"]["Enums"]["verification_level"]
          "request_id"?: string | null
          "revoke_reason"?: string | null
          "revoked_at"?: string | null
        }
        Update: {
          "approved_at"?: string
          "approved_by"?: string | null
          "business_id"?: string
          "expires_at"?: string | null
          "level"?: Database["public"]["Enums"]["verification_level"]
          "request_id"?: string | null
          "revoke_reason"?: string | null
          "revoked_at"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_verifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          }
        ]
      },
      "businesses": {
        Row: {
          "address_line1": string | null
          "address_line2": string | null
          "advertises": boolean
          "authenticity_avg": number | null
          "category_id": string | null
          "catalog_label": string | null
          "city": string | null
          "completed_orders": number
          "country": string
          "cover_url": string | null
          "created_at": string
          "description": string | null
          "email": string | null
          "featured_until": string | null
          "hours": NonNullable<Json>
          "id": string
          "is_featured": boolean
          "lat": number | null
          "lng": number | null
          "logo_url": string | null
          "loyalty_participating": boolean
          "market": Database["public"]["Enums"]["market"]
          "name": string
          "name_am": string | null
          "offers_ad_screens": boolean
          "owner_user_id": string
          "phone": string | null
          "postal_code": string | null
          "published_at": string | null
          "rating_avg": number | null
          "rating_count": number
          "search_tsv": unknown | null
          "selling_enabled": boolean
          "service_area": string | null
          "service_avg": number | null
          "slug": string
          "state": string | null
          "status": Database["public"]["Enums"]["business_status"]
          "tagline": string | null
          "trust_tier": string
          "updated_at": string
          "website": string | null
        }
        ComputedFields: never
        Insert: {
          "address_line1"?: string | null
          "address_line2"?: string | null
          "advertises"?: boolean
          "authenticity_avg"?: number | null
          "category_id"?: string | null
          "catalog_label"?: string | null
          "city"?: string | null
          "completed_orders"?: number
          "country"?: string
          "cover_url"?: string | null
          "created_at"?: string
          "description"?: string | null
          "email"?: string | null
          "featured_until"?: string | null
          "hours"?: NonNullable<Json>
          "id"?: string
          "is_featured"?: boolean
          "lat"?: number | null
          "lng"?: number | null
          "logo_url"?: string | null
          "loyalty_participating"?: boolean
          "market"?: Database["public"]["Enums"]["market"]
          "name": string
          "name_am"?: string | null
          "offers_ad_screens"?: boolean
          "owner_user_id": string
          "phone"?: string | null
          "postal_code"?: string | null
          "published_at"?: string | null
          "rating_avg"?: number | null
          "rating_count"?: number
          "search_tsv"?: unknown | null
          "selling_enabled"?: boolean
          "service_area"?: string | null
          "service_avg"?: number | null
          "slug"?: string
          "state"?: string | null
          "status"?: Database["public"]["Enums"]["business_status"]
          "tagline"?: string | null
          "trust_tier"?: string
          "updated_at"?: string
          "website"?: string | null
        }
        Update: {
          "address_line1"?: string | null
          "address_line2"?: string | null
          "advertises"?: boolean
          "authenticity_avg"?: number | null
          "category_id"?: string | null
          "catalog_label"?: string | null
          "city"?: string | null
          "completed_orders"?: number
          "country"?: string
          "cover_url"?: string | null
          "created_at"?: string
          "description"?: string | null
          "email"?: string | null
          "featured_until"?: string | null
          "hours"?: NonNullable<Json>
          "id"?: string
          "is_featured"?: boolean
          "lat"?: number | null
          "lng"?: number | null
          "logo_url"?: string | null
          "loyalty_participating"?: boolean
          "market"?: Database["public"]["Enums"]["market"]
          "name"?: string
          "name_am"?: string | null
          "offers_ad_screens"?: boolean
          "owner_user_id"?: string
          "phone"?: string | null
          "postal_code"?: string | null
          "published_at"?: string | null
          "rating_avg"?: number | null
          "rating_count"?: number
          "search_tsv"?: unknown | null
          "selling_enabled"?: boolean
          "service_area"?: string | null
          "service_avg"?: number | null
          "slug"?: string
          "state"?: string | null
          "status"?: Database["public"]["Enums"]["business_status"]
          "tagline"?: string | null
          "trust_tier"?: string
          "updated_at"?: string
          "website"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "campaign_offers": {
        Row: {
          "actor_id": string | null
          "created_at": string
          "expires_at": string | null
          "id": string
          "kind": Database["public"]["Enums"]["offer_kind"]
          "message": string | null
          "party": Database["public"]["Enums"]["offer_party"]
          "price_cents": number | null
          "request_id": string
        }
        ComputedFields: never
        Insert: {
          "actor_id"?: string | null
          "created_at"?: string
          "expires_at"?: string | null
          "id"?: string
          "kind": Database["public"]["Enums"]["offer_kind"]
          "message"?: string | null
          "party": Database["public"]["Enums"]["offer_party"]
          "price_cents"?: number | null
          "request_id": string
        }
        Update: {
          "actor_id"?: string | null
          "created_at"?: string
          "expires_at"?: string | null
          "id"?: string
          "kind"?: Database["public"]["Enums"]["offer_kind"]
          "message"?: string | null
          "party"?: Database["public"]["Enums"]["offer_party"]
          "price_cents"?: number | null
          "request_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_offers_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_offers_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "campaign_requests"
            referencedColumns: ["id"]
          }
        ]
      },
      "campaign_requests": {
        Row: {
          "advertiser_business_id": string
          "campaign_id": string
          "closed_at": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "current_price_cents": number
          "end_date": string
          "expires_at": string | null
          "id": string
          "last_offer_by": Database["public"]["Enums"]["offer_party"]
          "message": string | null
          "negotiation_rounds": number
          "package_id": string | null
          "proposed_price_cents": number
          "responded_at": string | null
          "screen_business_id": string
          "screen_id": string
          "start_date": string
          "status": Database["public"]["Enums"]["request_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "advertiser_business_id": string
          "campaign_id": string
          "closed_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "current_price_cents": number
          "end_date": string
          "expires_at"?: string | null
          "id"?: string
          "last_offer_by"?: Database["public"]["Enums"]["offer_party"]
          "message"?: string | null
          "negotiation_rounds"?: number
          "package_id"?: string | null
          "proposed_price_cents": number
          "responded_at"?: string | null
          "screen_business_id": string
          "screen_id": string
          "start_date": string
          "status"?: Database["public"]["Enums"]["request_status"]
          "updated_at"?: string
        }
        Update: {
          "advertiser_business_id"?: string
          "campaign_id"?: string
          "closed_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "current_price_cents"?: number
          "end_date"?: string
          "expires_at"?: string | null
          "id"?: string
          "last_offer_by"?: Database["public"]["Enums"]["offer_party"]
          "message"?: string | null
          "negotiation_rounds"?: number
          "package_id"?: string | null
          "proposed_price_cents"?: number
          "responded_at"?: string | null
          "screen_business_id"?: string
          "screen_id"?: string
          "start_date"?: string
          "status"?: Database["public"]["Enums"]["request_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_requests_advertiser_business_id_fkey"
            columns: ["advertiser_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ad_screen_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_screen_business_id_fkey"
            columns: ["screen_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "campaigns": {
        Row: {
          "advertiser_business_id": string
          "budget_total_cents": number | null
          "created_at": string
          "created_by": string
          "creative_image_path": string | null
          "creative_instructions": string | null
          "creative_video_path": string | null
          "duplicated_from": string | null
          "duration_days": number | null
          "end_date": string | null
          "id": string
          "max_price_per_location_cents": number | null
          "name": string
          "objective": string | null
          "price_max_cents": number | null
          "price_min_cents": number | null
          "start_date": string | null
          "status": Database["public"]["Enums"]["campaign_status"]
          "submitted_at": string | null
          "targeting": NonNullable<Json>
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "advertiser_business_id": string
          "budget_total_cents"?: number | null
          "created_at"?: string
          "created_by": string
          "creative_image_path"?: string | null
          "creative_instructions"?: string | null
          "creative_video_path"?: string | null
          "duplicated_from"?: string | null
          "duration_days"?: never
          "end_date"?: string | null
          "id"?: string
          "max_price_per_location_cents"?: number | null
          "name": string
          "objective"?: string | null
          "price_max_cents"?: number | null
          "price_min_cents"?: number | null
          "start_date"?: string | null
          "status"?: Database["public"]["Enums"]["campaign_status"]
          "submitted_at"?: string | null
          "targeting"?: NonNullable<Json>
          "updated_at"?: string
        }
        Update: {
          "advertiser_business_id"?: string
          "budget_total_cents"?: number | null
          "created_at"?: string
          "created_by"?: string
          "creative_image_path"?: string | null
          "creative_instructions"?: string | null
          "creative_video_path"?: string | null
          "duplicated_from"?: string | null
          "duration_days"?: never
          "end_date"?: string | null
          "id"?: string
          "max_price_per_location_cents"?: number | null
          "name"?: string
          "objective"?: string | null
          "price_max_cents"?: number | null
          "price_min_cents"?: number | null
          "start_date"?: string | null
          "status"?: Database["public"]["Enums"]["campaign_status"]
          "submitted_at"?: string | null
          "targeting"?: NonNullable<Json>
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_business_id_fkey"
            columns: ["advertiser_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_duplicated_from_fkey"
            columns: ["duplicated_from"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      },
      "cart_items": {
        Row: {
          "created_at": string
          "id": string
          "note": string | null
          "product_id": string
          "quantity": number
          "updated_at": string
          "user_id": string
          "variant_id": string | null
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "id"?: string
          "note"?: string | null
          "product_id": string
          "quantity": number
          "updated_at"?: string
          "user_id": string
          "variant_id"?: string | null
        }
        Update: {
          "created_at"?: string
          "id"?: string
          "note"?: string | null
          "product_id"?: string
          "quantity"?: number
          "updated_at"?: string
          "user_id"?: string
          "variant_id"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          }
        ]
      },
      "categories": {
        Row: {
          "created_at": string
          "icon": string | null
          "id": string
          "is_active": boolean
          "markets": (Database["public"]["Enums"]["market"])[]
          "name_am": string | null
          "name_en": string
          "slug": string
          "sort_order": number
          "tax_code": string | null
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "icon"?: string | null
          "id"?: string
          "is_active"?: boolean
          "markets"?: (Database["public"]["Enums"]["market"])[]
          "name_am"?: string | null
          "name_en": string
          "slug": string
          "sort_order"?: number
          "tax_code"?: string | null
        }
        Update: {
          "created_at"?: string
          "icon"?: string | null
          "id"?: string
          "is_active"?: boolean
          "markets"?: (Database["public"]["Enums"]["market"])[]
          "name_am"?: string | null
          "name_en"?: string
          "slug"?: string
          "sort_order"?: number
          "tax_code"?: string | null
        }
        Relationships: []
      },
      "checkouts": {
        Row: {
          "amount_paid_cents": number | null
          "buyer_id": string
          "cancel_reason": string | null
          "cancelled_at": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "discount_cents": number
          "expires_at": string
          "id": string
          "paid_at": string | null
          "points_redeemed": number
          "provider": Database["public"]["Enums"]["payment_provider"]
          "provider_ref": string | null
          "provider_session_ref": string | null
          "receipt_url": string | null
          "shipping_address": NonNullable<Json>
          "shipping_cents": number
          "status": Database["public"]["Enums"]["checkout_status"]
          "subtotal_cents": number
          "tax_cents": number
          "tax_pending": boolean
          "tax_provider": string
          "total_cents": number
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "amount_paid_cents"?: number | null
          "buyer_id": string
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "created_at"?: string
          "currency": Database["public"]["Enums"]["currency"]
          "discount_cents"?: number
          "expires_at": string
          "id"?: string
          "paid_at"?: string | null
          "points_redeemed"?: number
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "provider_session_ref"?: string | null
          "receipt_url"?: string | null
          "shipping_address": NonNullable<Json>
          "shipping_cents"?: number
          "status"?: Database["public"]["Enums"]["checkout_status"]
          "subtotal_cents"?: number
          "tax_cents"?: number
          "tax_pending"?: boolean
          "tax_provider"?: string
          "total_cents"?: number
          "updated_at"?: string
        }
        Update: {
          "amount_paid_cents"?: number | null
          "buyer_id"?: string
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "discount_cents"?: number
          "expires_at"?: string
          "id"?: string
          "paid_at"?: string | null
          "points_redeemed"?: number
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "provider_session_ref"?: string | null
          "receipt_url"?: string | null
          "shipping_address"?: NonNullable<Json>
          "shipping_cents"?: number
          "status"?: Database["public"]["Enums"]["checkout_status"]
          "subtotal_cents"?: number
          "tax_cents"?: number
          "tax_pending"?: boolean
          "tax_provider"?: string
          "total_cents"?: number
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "conversation_participants": {
        Row: {
          "as_business_id": string | null
          "conversation_id": string
          "joined_at": string
          "last_read_at": string | null
          "muted": boolean
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "as_business_id"?: string | null
          "conversation_id": string
          "joined_at"?: string
          "last_read_at"?: string | null
          "muted"?: boolean
          "user_id": string
        }
        Update: {
          "as_business_id"?: string | null
          "conversation_id"?: string
          "joined_at"?: string
          "last_read_at"?: string | null
          "muted"?: boolean
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_as_business_id_fkey"
            columns: ["as_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "conversations": {
        Row: {
          "business_id": string | null
          "context_id": string | null
          "context_type": Database["public"]["Enums"]["conversation_context"]
          "created_at": string
          "created_by": string | null
          "id": string
          "last_message_at": string | null
          "last_message_preview": string | null
        }
        ComputedFields: never
        Insert: {
          "business_id"?: string | null
          "context_id"?: string | null
          "context_type"?: Database["public"]["Enums"]["conversation_context"]
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "last_message_at"?: string | null
          "last_message_preview"?: string | null
        }
        Update: {
          "business_id"?: string | null
          "context_id"?: string | null
          "context_type"?: Database["public"]["Enums"]["conversation_context"]
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "last_message_at"?: string | null
          "last_message_preview"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "deal_claims": {
        Row: {
          "business_id": string
          "claimed_at": string
          "code": string
          "deal_id": string
          "id": string
          "redeemed_at": string | null
          "redeemed_by": string | null
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "claimed_at"?: string
          "code": string
          "deal_id": string
          "id"?: string
          "redeemed_at"?: string | null
          "redeemed_by"?: string | null
          "user_id": string
        }
        Update: {
          "business_id"?: string
          "claimed_at"?: string
          "code"?: string
          "deal_id"?: string
          "id"?: string
          "redeemed_at"?: string | null
          "redeemed_by"?: string | null
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_claims_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "deals": {
        Row: {
          "business_id": string
          "created_at": string
          "created_by": string | null
          "description": string | null
          "ended_at": string | null
          "id": string
          "image_path": string | null
          "status": Database["public"]["Enums"]["deal_status"]
          "terms": string | null
          "title": string
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "created_at"?: string
          "created_by"?: string | null
          "description"?: string | null
          "ended_at"?: string | null
          "id"?: string
          "image_path"?: string | null
          "status"?: Database["public"]["Enums"]["deal_status"]
          "terms"?: string | null
          "title": string
          "updated_at"?: string
        }
        Update: {
          "business_id"?: string
          "created_at"?: string
          "created_by"?: string | null
          "description"?: string | null
          "ended_at"?: string | null
          "id"?: string
          "image_path"?: string | null
          "status"?: Database["public"]["Enums"]["deal_status"]
          "terms"?: string | null
          "title"?: string
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "delivery_evidence": {
        Row: {
          "booking_id": string
          "created_at": string
          "device_id": string | null
          "id": string
          "kind": Database["public"]["Enums"]["evidence_kind"]
          "media_paths": (string)[]
          "notes": string | null
          "recorded_for_date": string | null
          "submitted_by": string | null
        }
        ComputedFields: never
        Insert: {
          "booking_id": string
          "created_at"?: string
          "device_id"?: string | null
          "id"?: string
          "kind"?: Database["public"]["Enums"]["evidence_kind"]
          "media_paths"?: (string)[]
          "notes"?: string | null
          "recorded_for_date"?: string | null
          "submitted_by"?: string | null
        }
        Update: {
          "booking_id"?: string
          "created_at"?: string
          "device_id"?: string | null
          "id"?: string
          "kind"?: Database["public"]["Enums"]["evidence_kind"]
          "media_paths"?: (string)[]
          "notes"?: string | null
          "recorded_for_date"?: string | null
          "submitted_by"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_evidence_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "disputes": {
        Row: {
          "booking_id": string
          "created_at": string
          "id": string
          "opened_by": string
          "opened_by_business_id": string
          "reason": string
          "resolution": string | null
          "resolved_at": string | null
          "resolved_by": string | null
          "status": Database["public"]["Enums"]["dispute_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "booking_id": string
          "created_at"?: string
          "id"?: string
          "opened_by": string
          "opened_by_business_id": string
          "reason": string
          "resolution"?: string | null
          "resolved_at"?: string | null
          "resolved_by"?: string | null
          "status"?: Database["public"]["Enums"]["dispute_status"]
          "updated_at"?: string
        }
        Update: {
          "booking_id"?: string
          "created_at"?: string
          "id"?: string
          "opened_by"?: string
          "opened_by_business_id"?: string
          "reason"?: string
          "resolution"?: string | null
          "resolved_at"?: string | null
          "resolved_by"?: string | null
          "status"?: Database["public"]["Enums"]["dispute_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_business_id_fkey"
            columns: ["opened_by_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "escrow_ledger": {
        Row: {
          "amount_cents": number
          "business_id": string
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "id": number
          "kind": string
          "note": string | null
          "order_id": string
          "provider_ref": string | null
        }
        ComputedFields: never
        Insert: {
          "amount_cents": number
          "business_id": string
          "created_at"?: string
          "currency": Database["public"]["Enums"]["currency"]
          "id"?: never
          "kind": string
          "note"?: string | null
          "order_id": string
          "provider_ref"?: string | null
        }
        Update: {
          "amount_cents"?: number
          "business_id"?: string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "id"?: never
          "kind"?: string
          "note"?: string | null
          "order_id"?: string
          "provider_ref"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_ledger_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      },
      "event_rsvps": {
        Row: {
          "created_at": string
          "event_id": string
          "status": Database["public"]["Enums"]["rsvp_status"]
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "event_id": string
          "status"?: Database["public"]["Enums"]["rsvp_status"]
          "user_id": string
        }
        Update: {
          "created_at"?: string
          "event_id"?: string
          "status"?: Database["public"]["Enums"]["rsvp_status"]
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "event_sources": {
        Row: {
          "auto_publish": boolean
          "config": NonNullable<Json>
          "created_at": string
          "created_by": string | null
          "default_category": Database["public"]["Enums"]["event_category"]
          "default_city": string | null
          "default_country": string
          "default_state": string | null
          "default_tags": (string)[]
          "default_timezone": string
          "id": string
          "is_active": boolean
          "kind": string
          "last_counts": Json | null
          "last_error": string | null
          "last_run_at": string | null
          "last_status": string | null
          "name": string
          "organizer_business_id": string | null
          "organizer_name": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "auto_publish"?: boolean
          "config"?: NonNullable<Json>
          "created_at"?: string
          "created_by"?: string | null
          "default_category"?: Database["public"]["Enums"]["event_category"]
          "default_city"?: string | null
          "default_country"?: string
          "default_state"?: string | null
          "default_tags"?: (string)[]
          "default_timezone"?: string
          "id"?: string
          "is_active"?: boolean
          "kind": string
          "last_counts"?: Json | null
          "last_error"?: string | null
          "last_run_at"?: string | null
          "last_status"?: string | null
          "name": string
          "organizer_business_id"?: string | null
          "organizer_name"?: string | null
          "updated_at"?: string
        }
        Update: {
          "auto_publish"?: boolean
          "config"?: NonNullable<Json>
          "created_at"?: string
          "created_by"?: string | null
          "default_category"?: Database["public"]["Enums"]["event_category"]
          "default_city"?: string | null
          "default_country"?: string
          "default_state"?: string | null
          "default_tags"?: (string)[]
          "default_timezone"?: string
          "id"?: string
          "is_active"?: boolean
          "kind"?: string
          "last_counts"?: Json | null
          "last_error"?: string | null
          "last_run_at"?: string | null
          "last_status"?: string | null
          "name"?: string
          "organizer_business_id"?: string | null
          "organizer_name"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sources_organizer_business_id_fkey"
            columns: ["organizer_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "events": {
        Row: {
          "address_line1": string | null
          "all_day": boolean
          "category": Database["public"]["Enums"]["event_category"]
          "city": string | null
          "contact_email": string | null
          "contact_phone": string | null
          "country": string
          "cover_path": string | null
          "cover_url": string | null
          "created_at": string
          "created_by": string
          "description": string | null
          "ends_at": string | null
          "external_id": string | null
          "external_url": string | null
          "going_count": number
          "id": string
          "import_locked": boolean
          "imported_at": string | null
          "interested_count": number
          "is_featured": boolean
          "is_free": boolean
          "is_online": boolean
          "lat": number | null
          "lng": number | null
          "online_url": string | null
          "organizer_business_id": string | null
          "organizer_name": string | null
          "postal_code": string | null
          "price_note": string | null
          "rejection_reason": string | null
          "reminder_sent_at": string | null
          "reviewed_at": string | null
          "reviewed_by": string | null
          "slug": string
          "source_id": string | null
          "source_kind": string | null
          "starts_at": string
          "state": string | null
          "status": Database["public"]["Enums"]["event_status"]
          "tags": (string)[]
          "ticket_url": string | null
          "timezone": string
          "title": string
          "title_am": string | null
          "updated_at": string
          "venue_name": string | null
        }
        ComputedFields: never
        Insert: {
          "address_line1"?: string | null
          "all_day"?: boolean
          "category"?: Database["public"]["Enums"]["event_category"]
          "city"?: string | null
          "contact_email"?: string | null
          "contact_phone"?: string | null
          "country"?: string
          "cover_path"?: string | null
          "cover_url"?: string | null
          "created_at"?: string
          "created_by": string
          "description"?: string | null
          "ends_at"?: string | null
          "external_id"?: string | null
          "external_url"?: string | null
          "going_count"?: number
          "id"?: string
          "import_locked"?: boolean
          "imported_at"?: string | null
          "interested_count"?: number
          "is_featured"?: boolean
          "is_free"?: boolean
          "is_online"?: boolean
          "lat"?: number | null
          "lng"?: number | null
          "online_url"?: string | null
          "organizer_business_id"?: string | null
          "organizer_name"?: string | null
          "postal_code"?: string | null
          "price_note"?: string | null
          "rejection_reason"?: string | null
          "reminder_sent_at"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "slug"?: string
          "source_id"?: string | null
          "source_kind"?: string | null
          "starts_at": string
          "state"?: string | null
          "status"?: Database["public"]["Enums"]["event_status"]
          "tags"?: (string)[]
          "ticket_url"?: string | null
          "timezone"?: string
          "title": string
          "title_am"?: string | null
          "updated_at"?: string
          "venue_name"?: string | null
        }
        Update: {
          "address_line1"?: string | null
          "all_day"?: boolean
          "category"?: Database["public"]["Enums"]["event_category"]
          "city"?: string | null
          "contact_email"?: string | null
          "contact_phone"?: string | null
          "country"?: string
          "cover_path"?: string | null
          "cover_url"?: string | null
          "created_at"?: string
          "created_by"?: string
          "description"?: string | null
          "ends_at"?: string | null
          "external_id"?: string | null
          "external_url"?: string | null
          "going_count"?: number
          "id"?: string
          "import_locked"?: boolean
          "imported_at"?: string | null
          "interested_count"?: number
          "is_featured"?: boolean
          "is_free"?: boolean
          "is_online"?: boolean
          "lat"?: number | null
          "lng"?: number | null
          "online_url"?: string | null
          "organizer_business_id"?: string | null
          "organizer_name"?: string | null
          "postal_code"?: string | null
          "price_note"?: string | null
          "rejection_reason"?: string | null
          "reminder_sent_at"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "slug"?: string
          "source_id"?: string | null
          "source_kind"?: string | null
          "starts_at"?: string
          "state"?: string | null
          "status"?: Database["public"]["Enums"]["event_status"]
          "tags"?: (string)[]
          "ticket_url"?: string | null
          "timezone"?: string
          "title"?: string
          "title_am"?: string | null
          "updated_at"?: string
          "venue_name"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_business_id_fkey"
            columns: ["organizer_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["id"]
          }
        ]
      },
      "events_feed_cache": {
        Row: {
          "generated_at": string
          "key": string
          "payload": NonNullable<Json>
          "version": number
        }
        ComputedFields: never
        Insert: {
          "generated_at"?: string
          "key": string
          "payload": NonNullable<Json>
          "version": number
        }
        Update: {
          "generated_at"?: string
          "key"?: string
          "payload"?: NonNullable<Json>
          "version"?: number
        }
        Relationships: []
      },
      "events_feed_state": {
        Row: {
          "changed_at": string
          "id": boolean
          "version": number
        }
        ComputedFields: never
        Insert: {
          "changed_at"?: string
          "id"?: boolean
          "version"?: number
        }
        Update: {
          "changed_at"?: string
          "id"?: boolean
          "version"?: number
        }
        Relationships: []
      },
      "exchange_rates": {
        Row: {
          "base": Database["public"]["Enums"]["currency"]
          "fetched_at": string
          "quote": Database["public"]["Enums"]["currency"]
          "rate": number
          "source": string
          "updated_by": string | null
        }
        ComputedFields: never
        Insert: {
          "base"?: Database["public"]["Enums"]["currency"]
          "fetched_at"?: string
          "quote": Database["public"]["Enums"]["currency"]
          "rate": number
          "source"?: string
          "updated_by"?: string | null
        }
        Update: {
          "base"?: Database["public"]["Enums"]["currency"]
          "fetched_at"?: string
          "quote"?: Database["public"]["Enums"]["currency"]
          "rate"?: number
          "source"?: string
          "updated_by"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "help_articles": {
        Row: {
          "audience": string
          "body": string
          "category": string
          "created_at": string
          "id": string
          "is_published": boolean
          "search_tsv": unknown | null
          "slug": string
          "sort_order": number
          "summary": string | null
          "title": string
          "updated_at": string
          "updated_by": string | null
        }
        ComputedFields: never
        Insert: {
          "audience"?: string
          "body": string
          "category"?: string
          "created_at"?: string
          "id"?: string
          "is_published"?: boolean
          "search_tsv"?: unknown | null
          "slug": string
          "sort_order"?: number
          "summary"?: string | null
          "title": string
          "updated_at"?: string
          "updated_by"?: string | null
        }
        Update: {
          "audience"?: string
          "body"?: string
          "category"?: string
          "created_at"?: string
          "id"?: string
          "is_published"?: boolean
          "search_tsv"?: unknown | null
          "slug"?: string
          "sort_order"?: number
          "summary"?: string | null
          "title"?: string
          "updated_at"?: string
          "updated_by"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "inquiries": {
        Row: {
          "business_id": string
          "contact_phone": string | null
          "conversation_id": string | null
          "created_at": string
          "from_user_id": string
          "id": string
          "message": string
          "product_id": string | null
          "service_id": string | null
          "status": Database["public"]["Enums"]["inquiry_status"]
          "subject": string | null
          "type": Database["public"]["Enums"]["inquiry_type"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "contact_phone"?: string | null
          "conversation_id"?: string | null
          "created_at"?: string
          "from_user_id": string
          "id"?: string
          "message": string
          "product_id"?: string | null
          "service_id"?: string | null
          "status"?: Database["public"]["Enums"]["inquiry_status"]
          "subject"?: string | null
          "type"?: Database["public"]["Enums"]["inquiry_type"]
          "updated_at"?: string
        }
        Update: {
          "business_id"?: string
          "contact_phone"?: string | null
          "conversation_id"?: string | null
          "created_at"?: string
          "from_user_id"?: string
          "id"?: string
          "message"?: string
          "product_id"?: string | null
          "service_id"?: string | null
          "status"?: Database["public"]["Enums"]["inquiry_status"]
          "subject"?: string | null
          "type"?: Database["public"]["Enums"]["inquiry_type"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      },
      "inventory_movements": {
        Row: {
          "actor_id": string | null
          "balance_after": number
          "business_id": string
          "created_at": string
          "delta": number
          "id": number
          "note": string | null
          "order_id": string | null
          "product_id": string
          "reason": Database["public"]["Enums"]["inventory_reason"]
          "variant_id": string | null
        }
        ComputedFields: never
        Insert: {
          "actor_id"?: string | null
          "balance_after": number
          "business_id": string
          "created_at"?: string
          "delta": number
          "id"?: never
          "note"?: string | null
          "order_id"?: string | null
          "product_id": string
          "reason": Database["public"]["Enums"]["inventory_reason"]
          "variant_id"?: string | null
        }
        Update: {
          "actor_id"?: string | null
          "balance_after"?: number
          "business_id"?: string
          "created_at"?: string
          "delta"?: number
          "id"?: never
          "note"?: string | null
          "order_id"?: string | null
          "product_id"?: string
          "reason"?: Database["public"]["Enums"]["inventory_reason"]
          "variant_id"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          }
        ]
      },
      "kyc_events": {
        Row: {
          "action": string
          "actor_id": string | null
          "business_id": string
          "created_at": string
          "details": NonNullable<Json>
          "id": number
        }
        ComputedFields: never
        Insert: {
          "action": string
          "actor_id"?: string | null
          "business_id": string
          "created_at"?: string
          "details"?: NonNullable<Json>
          "id"?: never
        }
        Update: {
          "action"?: string
          "actor_id"?: string | null
          "business_id"?: string
          "created_at"?: string
          "details"?: NonNullable<Json>
          "id"?: never
        }
        Relationships: [
          {
            foreignKeyName: "kyc_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "loyalty_accounts": {
        Row: {
          "created_at": string
          "last_activity_at": string | null
          "lifetime_points": number
          "points_balance": number
          "tier": string
          "updated_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "last_activity_at"?: string | null
          "lifetime_points"?: number
          "points_balance"?: number
          "tier"?: string
          "updated_at"?: string
          "user_id": string
        }
        Update: {
          "created_at"?: string
          "last_activity_at"?: string | null
          "lifetime_points"?: number
          "points_balance"?: number
          "tier"?: string
          "updated_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "loyalty_ledger": {
        Row: {
          "balance_after": number
          "business_id": string | null
          "checkout_id": string | null
          "created_at": string
          "created_by": string | null
          "delta": number
          "description": string | null
          "id": number
          "kind": string
          "order_id": string | null
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "balance_after": number
          "business_id"?: string | null
          "checkout_id"?: string | null
          "created_at"?: string
          "created_by"?: string | null
          "delta": number
          "description"?: string | null
          "id"?: never
          "kind": string
          "order_id"?: string | null
          "user_id": string
        }
        Update: {
          "balance_after"?: number
          "business_id"?: string | null
          "checkout_id"?: string | null
          "created_at"?: string
          "created_by"?: string | null
          "delta"?: number
          "description"?: string | null
          "id"?: never
          "kind"?: string
          "order_id"?: string | null
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "messages": {
        Row: {
          "attachments": NonNullable<Json>
          "body": string | null
          "conversation_id": string
          "created_at": string
          "id": string
          "sender_business_id": string | null
          "sender_id": string
        }
        ComputedFields: never
        Insert: {
          "attachments"?: NonNullable<Json>
          "body"?: string | null
          "conversation_id": string
          "created_at"?: string
          "id"?: string
          "sender_business_id"?: string | null
          "sender_id": string
        }
        Update: {
          "attachments"?: NonNullable<Json>
          "body"?: string | null
          "conversation_id"?: string
          "created_at"?: string
          "id"?: string
          "sender_business_id"?: string | null
          "sender_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_business_id_fkey"
            columns: ["sender_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "notifications": {
        Row: {
          "body": string | null
          "created_at": string
          "data": NonNullable<Json>
          "id": string
          "pushed_at": string | null
          "read_at": string | null
          "title": string
          "type": Database["public"]["Enums"]["notification_type"]
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "body"?: string | null
          "created_at"?: string
          "data"?: NonNullable<Json>
          "id"?: string
          "pushed_at"?: string | null
          "read_at"?: string | null
          "title": string
          "type": Database["public"]["Enums"]["notification_type"]
          "user_id": string
        }
        Update: {
          "body"?: string | null
          "created_at"?: string
          "data"?: NonNullable<Json>
          "id"?: string
          "pushed_at"?: string | null
          "read_at"?: string | null
          "title"?: string
          "type"?: Database["public"]["Enums"]["notification_type"]
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "order_disputes": {
        Row: {
          "category": string
          "created_at": string
          "description": string
          "evidence_paths": (string)[]
          "id": string
          "opened_by": string
          "order_id": string
          "refund_cents": number | null
          "resolution": string | null
          "resolution_note": string | null
          "resolved_at": string | null
          "resolved_by": string | null
          "seller_responded_at": string | null
          "seller_response": string | null
          "status": Database["public"]["Enums"]["dispute_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "category": string
          "created_at"?: string
          "description": string
          "evidence_paths"?: (string)[]
          "id"?: string
          "opened_by": string
          "order_id": string
          "refund_cents"?: number | null
          "resolution"?: string | null
          "resolution_note"?: string | null
          "resolved_at"?: string | null
          "resolved_by"?: string | null
          "seller_responded_at"?: string | null
          "seller_response"?: string | null
          "status"?: Database["public"]["Enums"]["dispute_status"]
          "updated_at"?: string
        }
        Update: {
          "category"?: string
          "created_at"?: string
          "description"?: string
          "evidence_paths"?: (string)[]
          "id"?: string
          "opened_by"?: string
          "order_id"?: string
          "refund_cents"?: number | null
          "resolution"?: string | null
          "resolution_note"?: string | null
          "resolved_at"?: string | null
          "resolved_by"?: string | null
          "seller_responded_at"?: string | null
          "seller_response"?: string | null
          "status"?: Database["public"]["Enums"]["dispute_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "order_events": {
        Row: {
          "actor_id": string | null
          "actor_role": string
          "created_at": string
          "details": NonNullable<Json>
          "event": string
          "id": number
          "is_internal": boolean
          "message": string | null
          "order_id": string
        }
        ComputedFields: never
        Insert: {
          "actor_id"?: string | null
          "actor_role": string
          "created_at"?: string
          "details"?: NonNullable<Json>
          "event": string
          "id"?: never
          "is_internal"?: boolean
          "message"?: string | null
          "order_id": string
        }
        Update: {
          "actor_id"?: string | null
          "actor_role"?: string
          "created_at"?: string
          "details"?: NonNullable<Json>
          "event"?: string
          "id"?: never
          "is_internal"?: boolean
          "message"?: string | null
          "order_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      },
      "order_items": {
        Row: {
          "created_at": string
          "id": string
          "image": string | null
          "is_authentic": boolean
          "line_total_cents": number
          "name": string
          "note": string | null
          "order_id": string
          "product_id": string | null
          "quantity": number
          "sku": string | null
          "tax_cents": number
          "tax_code": string | null
          "unit_price_cents": number
          "variant_id": string | null
          "variant_title": string | null
          "weight_grams": number | null
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "id"?: string
          "image"?: string | null
          "is_authentic"?: boolean
          "line_total_cents": number
          "name": string
          "note"?: string | null
          "order_id": string
          "product_id"?: string | null
          "quantity": number
          "sku"?: string | null
          "tax_cents"?: number
          "tax_code"?: string | null
          "unit_price_cents": number
          "variant_id"?: string | null
          "variant_title"?: string | null
          "weight_grams"?: number | null
        }
        Update: {
          "created_at"?: string
          "id"?: string
          "image"?: string | null
          "is_authentic"?: boolean
          "line_total_cents"?: number
          "name"?: string
          "note"?: string | null
          "order_id"?: string
          "product_id"?: string | null
          "quantity"?: number
          "sku"?: string | null
          "tax_cents"?: number
          "tax_code"?: string | null
          "unit_price_cents"?: number
          "variant_id"?: string | null
          "variant_title"?: string | null
          "weight_grams"?: number | null
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          }
        ]
      },
      "orders": {
        Row: {
          "accepted_at": string | null
          "auto_deliver_at": string | null
          "business_id": string
          "buyer_id": string
          "buyer_note": string | null
          "cancel_reason": string | null
          "cancelled_at": string | null
          "cancelled_by": string | null
          "checkout_id": string
          "commission_bps": number
          "commission_cents": number
          "completed_at": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "delivered_at": string | null
          "discount_cents": number
          "escrow_release_at": string | null
          "escrow_status": Database["public"]["Enums"]["escrow_status"]
          "fulfillment": Database["public"]["Enums"]["fulfillment_method"]
          "id": string
          "item_count": number
          "label_cost_cents": number
          "net_to_seller_cents": number
          "order_number": string
          "paid_at": string | null
          "points_earned": number
          "refunded_cents": number
          "shipped_at": string | null
          "shipping_address": NonNullable<Json>
          "shipping_cents": number
          "shipping_method": NonNullable<Json>
          "status": Database["public"]["Enums"]["order_status"]
          "status_before_dispute": Database["public"]["Enums"]["order_status"] | null
          "subtotal_cents": number
          "tax_breakdown": NonNullable<Json>
          "tax_cents": number
          "total_cents": number
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "accepted_at"?: string | null
          "auto_deliver_at"?: string | null
          "business_id": string
          "buyer_id": string
          "buyer_note"?: string | null
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "cancelled_by"?: string | null
          "checkout_id": string
          "commission_bps"?: number
          "commission_cents"?: number
          "completed_at"?: string | null
          "created_at"?: string
          "currency": Database["public"]["Enums"]["currency"]
          "delivered_at"?: string | null
          "discount_cents"?: number
          "escrow_release_at"?: string | null
          "escrow_status"?: Database["public"]["Enums"]["escrow_status"]
          "fulfillment"?: Database["public"]["Enums"]["fulfillment_method"]
          "id"?: string
          "item_count"?: number
          "label_cost_cents"?: number
          "net_to_seller_cents"?: number
          "order_number": string
          "paid_at"?: string | null
          "points_earned"?: number
          "refunded_cents"?: number
          "shipped_at"?: string | null
          "shipping_address": NonNullable<Json>
          "shipping_cents"?: number
          "shipping_method"?: NonNullable<Json>
          "status"?: Database["public"]["Enums"]["order_status"]
          "status_before_dispute"?: Database["public"]["Enums"]["order_status"] | null
          "subtotal_cents": number
          "tax_breakdown"?: NonNullable<Json>
          "tax_cents"?: number
          "total_cents": number
          "updated_at"?: string
        }
        Update: {
          "accepted_at"?: string | null
          "auto_deliver_at"?: string | null
          "business_id"?: string
          "buyer_id"?: string
          "buyer_note"?: string | null
          "cancel_reason"?: string | null
          "cancelled_at"?: string | null
          "cancelled_by"?: string | null
          "checkout_id"?: string
          "commission_bps"?: number
          "commission_cents"?: number
          "completed_at"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "delivered_at"?: string | null
          "discount_cents"?: number
          "escrow_release_at"?: string | null
          "escrow_status"?: Database["public"]["Enums"]["escrow_status"]
          "fulfillment"?: Database["public"]["Enums"]["fulfillment_method"]
          "id"?: string
          "item_count"?: number
          "label_cost_cents"?: number
          "net_to_seller_cents"?: number
          "order_number"?: string
          "paid_at"?: string | null
          "points_earned"?: number
          "refunded_cents"?: number
          "shipped_at"?: string | null
          "shipping_address"?: NonNullable<Json>
          "shipping_cents"?: number
          "shipping_method"?: NonNullable<Json>
          "status"?: Database["public"]["Enums"]["order_status"]
          "status_before_dispute"?: Database["public"]["Enums"]["order_status"] | null
          "subtotal_cents"?: number
          "tax_breakdown"?: NonNullable<Json>
          "tax_cents"?: number
          "total_cents"?: number
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          }
        ]
      },
      "payment_customers": {
        Row: {
          "created_at": string
          "customer_ref": string
          "provider": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "customer_ref": string
          "provider": string
          "user_id": string
        }
        Update: {
          "created_at"?: string
          "customer_ref"?: string
          "provider"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "payment_events": {
        Row: {
          "error": string | null
          "event_id": string
          "payload": NonNullable<Json>
          "processed_at": string | null
          "provider": string
          "received_at": string
          "type": string
        }
        ComputedFields: never
        Insert: {
          "error"?: string | null
          "event_id": string
          "payload"?: NonNullable<Json>
          "processed_at"?: string | null
          "provider": string
          "received_at"?: string
          "type": string
        }
        Update: {
          "error"?: string | null
          "event_id"?: string
          "payload"?: NonNullable<Json>
          "processed_at"?: string | null
          "provider"?: string
          "received_at"?: string
          "type"?: string
        }
        Relationships: []
      },
      "payment_intents": {
        Row: {
          "amount_cents": number
          "booking_id": string
          "commission_cents": number
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "failure_reason": string | null
          "id": string
          "payer_business_id": string
          "provider": Database["public"]["Enums"]["payment_provider"]
          "provider_ref": string | null
          "receipt_url": string | null
          "status": Database["public"]["Enums"]["payment_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "amount_cents": number
          "booking_id": string
          "commission_cents"?: number
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "payer_business_id": string
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "receipt_url"?: string | null
          "status"?: Database["public"]["Enums"]["payment_status"]
          "updated_at"?: string
        }
        Update: {
          "amount_cents"?: number
          "booking_id"?: string
          "commission_cents"?: number
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "payer_business_id"?: string
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "receipt_url"?: string | null
          "status"?: Database["public"]["Enums"]["payment_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payer_business_id_fkey"
            columns: ["payer_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "payouts": {
        Row: {
          "amount_cents": number
          "booking_id": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "failure_reason": string | null
          "id": string
          "order_id": string | null
          "paid_at": string | null
          "payee_business_id": string
          "provider": Database["public"]["Enums"]["payment_provider"]
          "provider_ref": string | null
          "scheduled_for": string | null
          "status": Database["public"]["Enums"]["payout_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "amount_cents": number
          "booking_id"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "order_id"?: string | null
          "paid_at"?: string | null
          "payee_business_id": string
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "scheduled_for"?: string | null
          "status"?: Database["public"]["Enums"]["payout_status"]
          "updated_at"?: string
        }
        Update: {
          "amount_cents"?: number
          "booking_id"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "order_id"?: string | null
          "paid_at"?: string | null
          "payee_business_id"?: string
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "scheduled_for"?: string | null
          "status"?: Database["public"]["Enums"]["payout_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_payee_business_id_fkey"
            columns: ["payee_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "platform_settings": {
        Row: {
          "description": string | null
          "is_public": boolean
          "key": string
          "updated_at": string
          "updated_by": string | null
          "value": NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          "description"?: string | null
          "is_public"?: boolean
          "key": string
          "updated_at"?: string
          "updated_by"?: string | null
          "value": NonNullable<Json>
        }
        Update: {
          "description"?: string | null
          "is_public"?: boolean
          "key"?: string
          "updated_at"?: string
          "updated_by"?: string | null
          "value"?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "product_certification_requests": {
        Row: {
          "admin_notes": string | null
          "business_id": string
          "created_at": string
          "evidence_paths": (string)[]
          "id": string
          "maker_name": string | null
          "materials": string | null
          "origin_country": string | null
          "origin_region": string | null
          "product_id": string
          "reviewed_at": string | null
          "reviewed_by": string | null
          "statement": string
          "status": Database["public"]["Enums"]["verification_status"]
          "submitted_by": string
          "technique": string | null
          "type": Database["public"]["Enums"]["certification_type"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "admin_notes"?: string | null
          "business_id": string
          "created_at"?: string
          "evidence_paths"?: (string)[]
          "id"?: string
          "maker_name"?: string | null
          "materials"?: string | null
          "origin_country"?: string | null
          "origin_region"?: string | null
          "product_id": string
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "statement": string
          "status"?: Database["public"]["Enums"]["verification_status"]
          "submitted_by": string
          "technique"?: string | null
          "type"?: Database["public"]["Enums"]["certification_type"]
          "updated_at"?: string
        }
        Update: {
          "admin_notes"?: string | null
          "business_id"?: string
          "created_at"?: string
          "evidence_paths"?: (string)[]
          "id"?: string
          "maker_name"?: string | null
          "materials"?: string | null
          "origin_country"?: string | null
          "origin_region"?: string | null
          "product_id"?: string
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "statement"?: string
          "status"?: Database["public"]["Enums"]["verification_status"]
          "submitted_by"?: string
          "technique"?: string | null
          "type"?: Database["public"]["Enums"]["certification_type"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_certification_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certification_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certification_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certification_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "product_certifications": {
        Row: {
          "approved_at": string
          "approved_by": string | null
          "business_id": string
          "content_hash": string
          "expires_at": string | null
          "product_id": string
          "request_id": string | null
          "revoke_reason": string | null
          "revoked_at": string | null
          "type": Database["public"]["Enums"]["certification_type"]
        }
        ComputedFields: never
        Insert: {
          "approved_at"?: string
          "approved_by"?: string | null
          "business_id": string
          "content_hash": string
          "expires_at"?: string | null
          "product_id": string
          "request_id"?: string | null
          "revoke_reason"?: string | null
          "revoked_at"?: string | null
          "type": Database["public"]["Enums"]["certification_type"]
        }
        Update: {
          "approved_at"?: string
          "approved_by"?: string | null
          "business_id"?: string
          "content_hash"?: string
          "expires_at"?: string | null
          "product_id"?: string
          "request_id"?: string | null
          "revoke_reason"?: string | null
          "revoked_at"?: string | null
          "type"?: Database["public"]["Enums"]["certification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "product_certifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_certifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "product_certification_requests"
            referencedColumns: ["id"]
          }
        ]
      },
      "product_variants": {
        Row: {
          "alt_price_cents": number | null
          "business_id": string
          "created_at": string
          "id": string
          "is_active": boolean
          "options": NonNullable<Json>
          "price_cents": number | null
          "product_id": string
          "sku": string | null
          "sort_order": number
          "stock_quantity": number
          "title": string
          "updated_at": string
          "weight_grams": number | null
        }
        ComputedFields: never
        Insert: {
          "alt_price_cents"?: number | null
          "business_id": string
          "created_at"?: string
          "id"?: string
          "is_active"?: boolean
          "options"?: NonNullable<Json>
          "price_cents"?: number | null
          "product_id": string
          "sku"?: string | null
          "sort_order"?: number
          "stock_quantity"?: number
          "title": string
          "updated_at"?: string
          "weight_grams"?: number | null
        }
        Update: {
          "alt_price_cents"?: number | null
          "business_id"?: string
          "created_at"?: string
          "id"?: string
          "is_active"?: boolean
          "options"?: NonNullable<Json>
          "price_cents"?: number | null
          "product_id"?: string
          "sku"?: string | null
          "sort_order"?: number
          "stock_quantity"?: number
          "title"?: string
          "updated_at"?: string
          "weight_grams"?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      },
      "products": {
        Row: {
          "alt_currency": Database["public"]["Enums"]["currency"] | null
          "alt_price_cents": number | null
          "authenticity_avg": number | null
          "availability": Database["public"]["Enums"]["availability"]
          "business_id": string
          "category_id": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "description": string | null
          "height_mm": number | null
          "id": string
          "images": (string)[]
          "is_active": boolean
          "is_authentic": boolean
          "is_handmade": boolean
          "length_mm": number | null
          "low_stock_threshold": number
          "materials": string | null
          "max_per_order": number | null
          "name": string
          "origin_country": string | null
          "origin_region": string | null
          "price_cents": number | null
          "purchasable": boolean
          "rating_avg": number | null
          "rating_count": number
          "return_policy": string | null
          "sales_count": number
          "search_tsv": unknown | null
          "shipping": NonNullable<Json>
          "shipping_profile_id": string | null
          "sku": string | null
          "stock_quantity": number
          "tags": (string)[]
          "tax_code": string | null
          "track_inventory": boolean
          "updated_at": string
          "variants": NonNullable<Json>
          "weight_grams": number | null
          "width_mm": number | null
        }
        ComputedFields: never
        Insert: {
          "alt_currency"?: Database["public"]["Enums"]["currency"] | null
          "alt_price_cents"?: number | null
          "authenticity_avg"?: number | null
          "availability"?: Database["public"]["Enums"]["availability"]
          "business_id": string
          "category_id"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "height_mm"?: number | null
          "id"?: string
          "images"?: (string)[]
          "is_active"?: boolean
          "is_authentic"?: boolean
          "is_handmade"?: boolean
          "length_mm"?: number | null
          "low_stock_threshold"?: number
          "materials"?: string | null
          "max_per_order"?: number | null
          "name": string
          "origin_country"?: string | null
          "origin_region"?: string | null
          "price_cents"?: number | null
          "purchasable"?: boolean
          "rating_avg"?: number | null
          "rating_count"?: number
          "return_policy"?: string | null
          "sales_count"?: number
          "search_tsv"?: unknown | null
          "shipping"?: NonNullable<Json>
          "shipping_profile_id"?: string | null
          "sku"?: string | null
          "stock_quantity"?: number
          "tags"?: (string)[]
          "tax_code"?: string | null
          "track_inventory"?: boolean
          "updated_at"?: string
          "variants"?: NonNullable<Json>
          "weight_grams"?: number | null
          "width_mm"?: number | null
        }
        Update: {
          "alt_currency"?: Database["public"]["Enums"]["currency"] | null
          "alt_price_cents"?: number | null
          "authenticity_avg"?: number | null
          "availability"?: Database["public"]["Enums"]["availability"]
          "business_id"?: string
          "category_id"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "height_mm"?: number | null
          "id"?: string
          "images"?: (string)[]
          "is_active"?: boolean
          "is_authentic"?: boolean
          "is_handmade"?: boolean
          "length_mm"?: number | null
          "low_stock_threshold"?: number
          "materials"?: string | null
          "max_per_order"?: number | null
          "name"?: string
          "origin_country"?: string | null
          "origin_region"?: string | null
          "price_cents"?: number | null
          "purchasable"?: boolean
          "rating_avg"?: number | null
          "rating_count"?: number
          "return_policy"?: string | null
          "sales_count"?: number
          "search_tsv"?: unknown | null
          "shipping"?: NonNullable<Json>
          "shipping_profile_id"?: string | null
          "sku"?: string | null
          "stock_quantity"?: number
          "tags"?: (string)[]
          "tax_code"?: string | null
          "track_inventory"?: boolean
          "updated_at"?: string
          "variants"?: NonNullable<Json>
          "weight_grams"?: number | null
          "width_mm"?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shipping_profile_id_fkey"
            columns: ["shipping_profile_id"]
            isOneToOne: false
            referencedRelation: "shipping_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "profiles": {
        Row: {
          "avatar_url": string | null
          "country": string | null
          "created_at": string
          "deletion_requested_at": string | null
          "display_name": string | null
          "id": string
          "locale": string
          "notification_prefs": NonNullable<Json>
          "onboarding_completed": boolean
          "phone": string | null
          "platform_role": Database["public"]["Enums"]["platform_role"]
          "preferred_currency": Database["public"]["Enums"]["currency"]
          "privacy": NonNullable<Json>
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "avatar_url"?: string | null
          "country"?: string | null
          "created_at"?: string
          "deletion_requested_at"?: string | null
          "display_name"?: string | null
          "id": string
          "locale"?: string
          "notification_prefs"?: NonNullable<Json>
          "onboarding_completed"?: boolean
          "phone"?: string | null
          "platform_role"?: Database["public"]["Enums"]["platform_role"]
          "preferred_currency"?: Database["public"]["Enums"]["currency"]
          "privacy"?: NonNullable<Json>
          "updated_at"?: string
        }
        Update: {
          "avatar_url"?: string | null
          "country"?: string | null
          "created_at"?: string
          "deletion_requested_at"?: string | null
          "display_name"?: string | null
          "id"?: string
          "locale"?: string
          "notification_prefs"?: NonNullable<Json>
          "onboarding_completed"?: boolean
          "phone"?: string | null
          "platform_role"?: Database["public"]["Enums"]["platform_role"]
          "preferred_currency"?: Database["public"]["Enums"]["currency"]
          "privacy"?: NonNullable<Json>
          "updated_at"?: string
        }
        Relationships: []
      },
      "push_tokens": {
        Row: {
          "app_version": string | null
          "created_at": string
          "device_name": string | null
          "id": string
          "invalid_reason": string | null
          "is_valid": boolean
          "last_seen_at": string
          "platform": Database["public"]["Enums"]["push_platform"]
          "token": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "app_version"?: string | null
          "created_at"?: string
          "device_name"?: string | null
          "id"?: string
          "invalid_reason"?: string | null
          "is_valid"?: boolean
          "last_seen_at"?: string
          "platform": Database["public"]["Enums"]["push_platform"]
          "token": string
          "user_id": string
        }
        Update: {
          "app_version"?: string | null
          "created_at"?: string
          "device_name"?: string | null
          "id"?: string
          "invalid_reason"?: string | null
          "is_valid"?: boolean
          "last_seen_at"?: string
          "platform"?: Database["public"]["Enums"]["push_platform"]
          "token"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "refunds": {
        Row: {
          "amount_cents": number
          "checkout_id": string
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "failure_reason": string | null
          "id": string
          "order_id": string | null
          "processed_at": string | null
          "provider": Database["public"]["Enums"]["payment_provider"]
          "provider_ref": string | null
          "reason": string | null
          "requested_by": string | null
          "source": string
          "status": Database["public"]["Enums"]["refund_status"]
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "amount_cents": number
          "checkout_id": string
          "created_at"?: string
          "currency": Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "order_id"?: string | null
          "processed_at"?: string | null
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "reason"?: string | null
          "requested_by"?: string | null
          "source": string
          "status"?: Database["public"]["Enums"]["refund_status"]
          "updated_at"?: string
        }
        Update: {
          "amount_cents"?: number
          "checkout_id"?: string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "failure_reason"?: string | null
          "id"?: string
          "order_id"?: string | null
          "processed_at"?: string | null
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "provider_ref"?: string | null
          "reason"?: string | null
          "requested_by"?: string | null
          "source"?: string
          "status"?: Database["public"]["Enums"]["refund_status"]
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "reports": {
        Row: {
          "created_at": string
          "id": string
          "reason": string
          "reporter_id": string
          "resolution": string | null
          "reviewed_at": string | null
          "reviewed_by": string | null
          "status": Database["public"]["Enums"]["report_status"]
          "target_id": string
          "target_type": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "id"?: string
          "reason": string
          "reporter_id": string
          "resolution"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["report_status"]
          "target_id": string
          "target_type": string
        }
        Update: {
          "created_at"?: string
          "id"?: string
          "reason"?: string
          "reporter_id"?: string
          "resolution"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["report_status"]
          "target_id"?: string
          "target_type"?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "reviews": {
        Row: {
          "authenticity_rating": number | null
          "author_business_id": string | null
          "author_id": string
          "body": string | null
          "booking_id": string | null
          "business_id": string
          "created_at": string
          "id": string
          "is_verified_customer": boolean
          "is_verified_purchase": boolean
          "order_id": string | null
          "photos": (string)[]
          "product_id": string | null
          "rating": number
          "response": string | null
          "response_at": string | null
          "screen_id": string | null
          "service_rating": number | null
          "status": Database["public"]["Enums"]["review_status"]
          "target_type": Database["public"]["Enums"]["review_target"]
          "title": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "authenticity_rating"?: number | null
          "author_business_id"?: string | null
          "author_id": string
          "body"?: string | null
          "booking_id"?: string | null
          "business_id": string
          "created_at"?: string
          "id"?: string
          "is_verified_customer"?: boolean
          "is_verified_purchase"?: boolean
          "order_id"?: string | null
          "photos"?: (string)[]
          "product_id"?: string | null
          "rating": number
          "response"?: string | null
          "response_at"?: string | null
          "screen_id"?: string | null
          "service_rating"?: number | null
          "status"?: Database["public"]["Enums"]["review_status"]
          "target_type"?: Database["public"]["Enums"]["review_target"]
          "title"?: string | null
          "updated_at"?: string
        }
        Update: {
          "authenticity_rating"?: number | null
          "author_business_id"?: string | null
          "author_id"?: string
          "body"?: string | null
          "booking_id"?: string | null
          "business_id"?: string
          "created_at"?: string
          "id"?: string
          "is_verified_customer"?: boolean
          "is_verified_purchase"?: boolean
          "order_id"?: string | null
          "photos"?: (string)[]
          "product_id"?: string | null
          "rating"?: number
          "response"?: string | null
          "response_at"?: string | null
          "screen_id"?: string | null
          "service_rating"?: number | null
          "status"?: Database["public"]["Enums"]["review_status"]
          "target_type"?: Database["public"]["Enums"]["review_target"]
          "title"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_business_id_fkey"
            columns: ["author_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "ad_screens"
            referencedColumns: ["id"]
          }
        ]
      },
      "saved_items": {
        Row: {
          "created_at": string
          "target_id": string
          "target_type": Database["public"]["Enums"]["saved_target"]
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "target_id": string
          "target_type": Database["public"]["Enums"]["saved_target"]
          "user_id": string
        }
        Update: {
          "created_at"?: string
          "target_id"?: string
          "target_type"?: Database["public"]["Enums"]["saved_target"]
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "seller_kyc_profiles": {
        Row: {
          "address_line1": string | null
          "address_line2": string | null
          "approved_at": string | null
          "attested_at": string | null
          "attested_by": string | null
          "business_id": string
          "city": string | null
          "country": string | null
          "created_at": string
          "date_of_birth": string | null
          "decision_reason": string | null
          "email": string | null
          "entity_type": Database["public"]["Enums"]["seller_entity_type"]
          "expires_at": string | null
          "id_document_country": string | null
          "id_document_expires_on": string | null
          "id_document_last4": string | null
          "id_document_secret": string | null
          "id_document_type": string | null
          "legal_name": string | null
          "phone": string | null
          "postal_code": string | null
          "region": string | null
          "registration_number_last4": string | null
          "registration_number_secret": string | null
          "representative_name": string | null
          "representative_title": string | null
          "reviewed_at": string | null
          "reviewed_by": string | null
          "status": Database["public"]["Enums"]["kyc_status"]
          "submitted_at": string | null
          "tax_id_last4": string | null
          "tax_id_secret": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "address_line1"?: string | null
          "address_line2"?: string | null
          "approved_at"?: string | null
          "attested_at"?: string | null
          "attested_by"?: string | null
          "business_id": string
          "city"?: string | null
          "country"?: string | null
          "created_at"?: string
          "date_of_birth"?: string | null
          "decision_reason"?: string | null
          "email"?: string | null
          "entity_type"?: Database["public"]["Enums"]["seller_entity_type"]
          "expires_at"?: string | null
          "id_document_country"?: string | null
          "id_document_expires_on"?: string | null
          "id_document_last4"?: string | null
          "id_document_secret"?: string | null
          "id_document_type"?: string | null
          "legal_name"?: string | null
          "phone"?: string | null
          "postal_code"?: string | null
          "region"?: string | null
          "registration_number_last4"?: string | null
          "registration_number_secret"?: string | null
          "representative_name"?: string | null
          "representative_title"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["kyc_status"]
          "submitted_at"?: string | null
          "tax_id_last4"?: string | null
          "tax_id_secret"?: string | null
          "updated_at"?: string
        }
        Update: {
          "address_line1"?: string | null
          "address_line2"?: string | null
          "approved_at"?: string | null
          "attested_at"?: string | null
          "attested_by"?: string | null
          "business_id"?: string
          "city"?: string | null
          "country"?: string | null
          "created_at"?: string
          "date_of_birth"?: string | null
          "decision_reason"?: string | null
          "email"?: string | null
          "entity_type"?: Database["public"]["Enums"]["seller_entity_type"]
          "expires_at"?: string | null
          "id_document_country"?: string | null
          "id_document_expires_on"?: string | null
          "id_document_last4"?: string | null
          "id_document_secret"?: string | null
          "id_document_type"?: string | null
          "legal_name"?: string | null
          "phone"?: string | null
          "postal_code"?: string | null
          "region"?: string | null
          "registration_number_last4"?: string | null
          "registration_number_secret"?: string | null
          "representative_name"?: string | null
          "representative_title"?: string | null
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["kyc_status"]
          "submitted_at"?: string | null
          "tax_id_last4"?: string | null
          "tax_id_secret"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_kyc_profiles_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_profiles_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "seller_kyc_reviews": {
        Row: {
          "business_id": string
          "checklist": NonNullable<Json>
          "created_at": string
          "decision": Database["public"]["Enums"]["kyc_status"]
          "id": string
          "internal_note": string | null
          "reviewer_id": string | null
          "risk_level": string | null
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "checklist"?: NonNullable<Json>
          "created_at"?: string
          "decision": Database["public"]["Enums"]["kyc_status"]
          "id"?: string
          "internal_note"?: string | null
          "reviewer_id"?: string | null
          "risk_level"?: string | null
        }
        Update: {
          "business_id"?: string
          "checklist"?: NonNullable<Json>
          "created_at"?: string
          "decision"?: Database["public"]["Enums"]["kyc_status"]
          "id"?: string
          "internal_note"?: string | null
          "reviewer_id"?: string | null
          "risk_level"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_kyc_reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "seller_payout_accounts": {
        Row: {
          "business_id": string
          "charges_enabled": boolean
          "created_at": string
          "details_submitted": boolean
          "manual_details_hint": string | null
          "manual_details_secret": string | null
          "manual_method": string | null
          "payouts_enabled": boolean
          "provider": Database["public"]["Enums"]["payment_provider"]
          "requirements": NonNullable<Json>
          "stripe_account_id": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "charges_enabled"?: boolean
          "created_at"?: string
          "details_submitted"?: boolean
          "manual_details_hint"?: string | null
          "manual_details_secret"?: string | null
          "manual_method"?: string | null
          "payouts_enabled"?: boolean
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "requirements"?: NonNullable<Json>
          "stripe_account_id"?: string | null
          "updated_at"?: string
        }
        Update: {
          "business_id"?: string
          "charges_enabled"?: boolean
          "created_at"?: string
          "details_submitted"?: boolean
          "manual_details_hint"?: string | null
          "manual_details_secret"?: string | null
          "manual_method"?: string | null
          "payouts_enabled"?: boolean
          "provider"?: Database["public"]["Enums"]["payment_provider"]
          "requirements"?: NonNullable<Json>
          "stripe_account_id"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "services": {
        Row: {
          "business_id": string
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "description": string | null
          "duration_minutes": number | null
          "id": string
          "image_path": string | null
          "is_active": boolean
          "is_signature": boolean
          "name": string
          "price_cents": number | null
          "price_note": string | null
          "section": string | null
          "sort_order": number
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "duration_minutes"?: number | null
          "id"?: string
          "image_path"?: string | null
          "is_active"?: boolean
          "is_signature"?: boolean
          "name": string
          "price_cents"?: number | null
          "price_note"?: string | null
          "section"?: string | null
          "sort_order"?: number
          "updated_at"?: string
        }
        Update: {
          "business_id"?: string
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "description"?: string | null
          "duration_minutes"?: number | null
          "id"?: string
          "image_path"?: string | null
          "is_active"?: boolean
          "is_signature"?: boolean
          "name"?: string
          "price_cents"?: number | null
          "price_note"?: string | null
          "section"?: string | null
          "sort_order"?: number
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "shipment_labels": {
        Row: {
          "business_id": string
          "cost_cents": number
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "label_format": string | null
          "label_url": string
          "shipment_id": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "cost_cents"?: number
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "label_format"?: string | null
          "label_url": string
          "shipment_id": string
        }
        Update: {
          "business_id"?: string
          "cost_cents"?: number
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "label_format"?: string | null
          "label_url"?: string
          "shipment_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_labels_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_labels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          }
        ]
      },
      "shipments": {
        Row: {
          "business_id": string
          "carrier": string | null
          "created_at": string
          "created_by": string | null
          "delivered_at": string | null
          "eta": string | null
          "events": NonNullable<Json>
          "id": string
          "order_id": string
          "provider": string
          "provider_rate_id": string | null
          "provider_shipment_id": string | null
          "provider_transaction_id": string | null
          "service": string | null
          "shipped_at": string | null
          "status": Database["public"]["Enums"]["shipment_status"]
          "tracking_number": string | null
          "tracking_url": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "carrier"?: string | null
          "created_at"?: string
          "created_by"?: string | null
          "delivered_at"?: string | null
          "eta"?: string | null
          "events"?: NonNullable<Json>
          "id"?: string
          "order_id": string
          "provider"?: string
          "provider_rate_id"?: string | null
          "provider_shipment_id"?: string | null
          "provider_transaction_id"?: string | null
          "service"?: string | null
          "shipped_at"?: string | null
          "status"?: Database["public"]["Enums"]["shipment_status"]
          "tracking_number"?: string | null
          "tracking_url"?: string | null
          "updated_at"?: string
        }
        Update: {
          "business_id"?: string
          "carrier"?: string | null
          "created_at"?: string
          "created_by"?: string | null
          "delivered_at"?: string | null
          "eta"?: string | null
          "events"?: NonNullable<Json>
          "id"?: string
          "order_id"?: string
          "provider"?: string
          "provider_rate_id"?: string | null
          "provider_shipment_id"?: string | null
          "provider_transaction_id"?: string | null
          "service"?: string | null
          "shipped_at"?: string | null
          "status"?: Database["public"]["Enums"]["shipment_status"]
          "tracking_number"?: string | null
          "tracking_url"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      },
      "shipping_profiles": {
        Row: {
          "allow_pickup": boolean
          "business_id": string
          "created_at": string
          "handling_days_max": number
          "handling_days_min": number
          "id": string
          "is_default": boolean
          "name": string
          "origin_city": string | null
          "origin_country": string | null
          "origin_line1": string | null
          "origin_line2": string | null
          "origin_name": string | null
          "origin_phone": string | null
          "origin_postal_code": string | null
          "origin_region": string | null
          "pickup_instructions": string | null
          "updated_at": string
          "use_carrier_rates": boolean
        }
        ComputedFields: never
        Insert: {
          "allow_pickup"?: boolean
          "business_id": string
          "created_at"?: string
          "handling_days_max"?: number
          "handling_days_min"?: number
          "id"?: string
          "is_default"?: boolean
          "name"?: string
          "origin_city"?: string | null
          "origin_country"?: string | null
          "origin_line1"?: string | null
          "origin_line2"?: string | null
          "origin_name"?: string | null
          "origin_phone"?: string | null
          "origin_postal_code"?: string | null
          "origin_region"?: string | null
          "pickup_instructions"?: string | null
          "updated_at"?: string
          "use_carrier_rates"?: boolean
        }
        Update: {
          "allow_pickup"?: boolean
          "business_id"?: string
          "created_at"?: string
          "handling_days_max"?: number
          "handling_days_min"?: number
          "id"?: string
          "is_default"?: boolean
          "name"?: string
          "origin_city"?: string | null
          "origin_country"?: string | null
          "origin_line1"?: string | null
          "origin_line2"?: string | null
          "origin_name"?: string | null
          "origin_phone"?: string | null
          "origin_postal_code"?: string | null
          "origin_region"?: string | null
          "pickup_instructions"?: string | null
          "updated_at"?: string
          "use_carrier_rates"?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shipping_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      },
      "shipping_quotes": {
        Row: {
          "amount_cents": number
          "business_id": string
          "carrier": string | null
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "destination": NonNullable<Json>
          "eta_max_days": number | null
          "eta_min_days": number | null
          "expires_at": string
          "id": string
          "items_hash": string
          "kind": string
          "name": string
          "provider": string | null
          "provider_rate_id": string | null
          "provider_shipment_id": string | null
          "service": string | null
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "amount_cents": number
          "business_id": string
          "carrier"?: string | null
          "created_at"?: string
          "currency": Database["public"]["Enums"]["currency"]
          "destination": NonNullable<Json>
          "eta_max_days"?: number | null
          "eta_min_days"?: number | null
          "expires_at": string
          "id"?: string
          "items_hash": string
          "kind": string
          "name": string
          "provider"?: string | null
          "provider_rate_id"?: string | null
          "provider_shipment_id"?: string | null
          "service"?: string | null
          "user_id": string
        }
        Update: {
          "amount_cents"?: number
          "business_id"?: string
          "carrier"?: string | null
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "destination"?: NonNullable<Json>
          "eta_max_days"?: number | null
          "eta_min_days"?: number | null
          "expires_at"?: string
          "id"?: string
          "items_hash"?: string
          "kind"?: string
          "name"?: string
          "provider"?: string | null
          "provider_rate_id"?: string | null
          "provider_shipment_id"?: string | null
          "service"?: string | null
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "shipping_rates": {
        Row: {
          "base_cents": number
          "business_id": string
          "countries": (string)[]
          "created_at": string
          "currency": Database["public"]["Enums"]["currency"]
          "eta_max_days": number | null
          "eta_min_days": number | null
          "free_over_cents": number | null
          "id": string
          "is_active": boolean
          "name": string
          "per_additional_item_cents": number
          "per_kg_cents": number
          "profile_id": string
          "sort_order": number
        }
        ComputedFields: never
        Insert: {
          "base_cents": number
          "business_id": string
          "countries": (string)[]
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "eta_max_days"?: number | null
          "eta_min_days"?: number | null
          "free_over_cents"?: number | null
          "id"?: string
          "is_active"?: boolean
          "name": string
          "per_additional_item_cents"?: number
          "per_kg_cents"?: number
          "profile_id": string
          "sort_order"?: number
        }
        Update: {
          "base_cents"?: number
          "business_id"?: string
          "countries"?: (string)[]
          "created_at"?: string
          "currency"?: Database["public"]["Enums"]["currency"]
          "eta_max_days"?: number | null
          "eta_min_days"?: number | null
          "free_over_cents"?: number | null
          "id"?: string
          "is_active"?: boolean
          "name"?: string
          "per_additional_item_cents"?: number
          "per_kg_cents"?: number
          "profile_id"?: string
          "sort_order"?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "shipping_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "support_messages": {
        Row: {
          "author_id": string | null
          "content": string
          "created_at": string
          "id": string
          "meta": NonNullable<Json>
          "role": string
          "thread_id": string
        }
        ComputedFields: never
        Insert: {
          "author_id"?: string | null
          "content": string
          "created_at"?: string
          "id"?: string
          "meta"?: NonNullable<Json>
          "role": string
          "thread_id": string
        }
        Update: {
          "author_id"?: string | null
          "content"?: string
          "created_at"?: string
          "id"?: string
          "meta"?: NonNullable<Json>
          "role"?: string
          "thread_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          }
        ]
      },
      "support_threads": {
        Row: {
          "assigned_to": string | null
          "created_at": string
          "handoff_at": string | null
          "handoff_reason": string | null
          "id": string
          "last_message_at": string | null
          "last_message_preview": string | null
          "order_id": string | null
          "status": Database["public"]["Enums"]["support_status"]
          "subject": string | null
          "updated_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "assigned_to"?: string | null
          "created_at"?: string
          "handoff_at"?: string | null
          "handoff_reason"?: string | null
          "id"?: string
          "last_message_at"?: string | null
          "last_message_preview"?: string | null
          "order_id"?: string | null
          "status"?: Database["public"]["Enums"]["support_status"]
          "subject"?: string | null
          "updated_at"?: string
          "user_id": string
        }
        Update: {
          "assigned_to"?: string | null
          "created_at"?: string
          "handoff_at"?: string | null
          "handoff_reason"?: string | null
          "id"?: string
          "last_message_at"?: string | null
          "last_message_preview"?: string | null
          "order_id"?: string | null
          "status"?: Database["public"]["Enums"]["support_status"]
          "subject"?: string | null
          "updated_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_threads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_threads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "tax_rules": {
        Row: {
          "applies_to_shipping": boolean
          "country": string
          "created_at": string
          "created_by": string | null
          "id": string
          "is_active": boolean
          "name": string
          "notes": string | null
          "rate_bps": number
          "region": string | null
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "applies_to_shipping"?: boolean
          "country": string
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "is_active"?: boolean
          "name": string
          "notes"?: string | null
          "rate_bps": number
          "region"?: string | null
          "updated_at"?: string
        }
        Update: {
          "applies_to_shipping"?: boolean
          "country"?: string
          "created_at"?: string
          "created_by"?: string | null
          "id"?: string
          "is_active"?: boolean
          "name"?: string
          "notes"?: string | null
          "rate_bps"?: number
          "region"?: string | null
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "user_addresses": {
        Row: {
          "city": string
          "country": string
          "created_at": string
          "full_name": string
          "id": string
          "is_default": boolean
          "label": string | null
          "line1": string
          "line2": string | null
          "phone": string | null
          "postal_code": string | null
          "region": string | null
          "updated_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "city": string
          "country": string
          "created_at"?: string
          "full_name": string
          "id"?: string
          "is_default"?: boolean
          "label"?: string | null
          "line1": string
          "line2"?: string | null
          "phone"?: string | null
          "postal_code"?: string | null
          "region"?: string | null
          "updated_at"?: string
          "user_id": string
        }
        Update: {
          "city"?: string
          "country"?: string
          "created_at"?: string
          "full_name"?: string
          "id"?: string
          "is_default"?: boolean
          "label"?: string | null
          "line1"?: string
          "line2"?: string | null
          "phone"?: string | null
          "postal_code"?: string | null
          "region"?: string | null
          "updated_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "user_blocks": {
        Row: {
          "blocked_id": string
          "blocker_id": string
          "created_at": string
        }
        ComputedFields: never
        Insert: {
          "blocked_id": string
          "blocker_id": string
          "created_at"?: string
        }
        Update: {
          "blocked_id"?: string
          "blocker_id"?: string
          "created_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "verification_documents": {
        Row: {
          "business_id": string
          "created_at": string
          "doc_type": string
          "id": string
          "original_filename": string | null
          "request_id": string
          "storage_path": string
          "uploaded_by": string
        }
        ComputedFields: never
        Insert: {
          "business_id": string
          "created_at"?: string
          "doc_type": string
          "id"?: string
          "original_filename"?: string | null
          "request_id": string
          "storage_path": string
          "uploaded_by": string
        }
        Update: {
          "business_id"?: string
          "created_at"?: string
          "doc_type"?: string
          "id"?: string
          "original_filename"?: string | null
          "request_id"?: string
          "storage_path"?: string
          "uploaded_by"?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      "verification_internal_notes": {
        Row: {
          "author_id": string
          "created_at": string
          "id": string
          "note": string
          "request_id": string
        }
        ComputedFields: never
        Insert: {
          "author_id": string
          "created_at"?: string
          "id"?: string
          "note": string
          "request_id": string
        }
        Update: {
          "author_id"?: string
          "created_at"?: string
          "id"?: string
          "note"?: string
          "request_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_internal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_internal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_internal_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          }
        ]
      },
      "verification_requests": {
        Row: {
          "admin_notes": string | null
          "applicant_notes": string | null
          "business_id": string
          "created_at": string
          "id": string
          "level": Database["public"]["Enums"]["verification_level"]
          "reviewed_at": string | null
          "reviewed_by": string | null
          "status": Database["public"]["Enums"]["verification_status"]
          "submitted_by": string
          "updated_at": string
        }
        ComputedFields: never
        Insert: {
          "admin_notes"?: string | null
          "applicant_notes"?: string | null
          "business_id": string
          "created_at"?: string
          "id"?: string
          "level": Database["public"]["Enums"]["verification_level"]
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["verification_status"]
          "submitted_by": string
          "updated_at"?: string
        }
        Update: {
          "admin_notes"?: string | null
          "applicant_notes"?: string | null
          "business_id"?: string
          "created_at"?: string
          "id"?: string
          "level"?: Database["public"]["Enums"]["verification_level"]
          "reviewed_at"?: string | null
          "reviewed_by"?: string | null
          "status"?: Database["public"]["Enums"]["verification_status"]
          "submitted_by"?: string
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      "public_profiles": {
        Row: {
          "avatar_url": string | null
          "created_at": string
          "display_name": string | null
          "id": string
        }
        ComputedFields: never
        Insert: {
          "avatar_url"?: string | null
          "created_at"?: string | null
          "display_name"?: string | null
          "id"?: string | null
        }
        Update: {
          "avatar_url"?: string | null
          "created_at"?: string | null
          "display_name"?: string | null
          "id"?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      "address_snapshot": {
        Args: { "p_address": Database["public"]["Tables"]["user_addresses"]["Row"] }
        Returns: Json
      },
      "adjust_inventory": {
        Args: { "p_delta": number; "p_note"?: string; "p_product_id": string; "p_reason"?: Database["public"]["Enums"]["inventory_reason"]; "p_variant_id"?: string }
        Returns: number
      },
      "admin_complete_payout": {
        Args: { "p_payout_id": string; "p_reference": string }
        Returns: undefined
      },
      "admin_complete_refund": {
        Args: { "p_reference": string; "p_refund_id": string }
        Returns: undefined
      },
      "admin_overview": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "advertiser_stats": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "auto_mark_delivered": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "auto_release_escrow": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "business_analytics": {
        Args: { "p_business_id": string; "p_days"?: number }
        Returns: Json
      },
      "business_badges": {
        Args: { "p_business_id": string }
        Returns: (Database["public"]["Enums"]["verification_level"])[]
      },
      "business_can": {
        Args: { "p_business_id": string; "p_permission": string }
        Returns: boolean
      },
      "business_deal_claims": {
        Args: { "p_business_id": string; "p_limit"?: number }
        Returns: Json
      },
      "business_deals": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "business_overview": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "business_permission_list": {
        Args: Record<PropertyKey, never>
        Returns: (string)[]
      },
      "business_role": {
        Args: { "p_business_id": string }
        Returns: Database["public"]["Enums"]["member_role"]
      },
      "business_signals": {
        Args: { "p_business_ids": string[] }
        Returns: { "business_id": string; "deal_count": number; "deal_title": string | null; "is_new": boolean; "is_trending": boolean; "review_author": string | null; "review_quote": string | null; "review_rating": number | null; "review_verified": boolean | null; "saves_count": number | null }[]
      },
      "buyer_update_order": {
        Args: { "p_action": string; "p_details"?: Json; "p_order_id": string }
        Returns: { "accepted_at": string | null; "auto_deliver_at": string | null; "business_id": string; "buyer_id": string; "buyer_note": string | null; "cancel_reason": string | null; "cancelled_at": string | null; "cancelled_by": string | null; "checkout_id": string; "commission_bps": number; "commission_cents": number; "completed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "delivered_at": string | null; "discount_cents": number; "escrow_release_at": string | null; "escrow_status": Database["public"]["Enums"]["escrow_status"]; "fulfillment": Database["public"]["Enums"]["fulfillment_method"]; "id": string; "item_count": number; "label_cost_cents": number; "net_to_seller_cents": number; "order_number": string; "paid_at": string | null; "points_earned": number; "refunded_cents": number; "shipped_at": string | null; "shipping_address": NonNullable<Json>; "shipping_cents": number; "shipping_method": NonNullable<Json>; "status": Database["public"]["Enums"]["order_status"]; "status_before_dispute": Database["public"]["Enums"]["order_status"] | null; "subtotal_cents": number; "tax_breakdown": NonNullable<Json>; "tax_cents": number; "total_cents": number; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "campaign_summary": {
        Args: { "p_campaign_id": string }
        Returns: Json
      },
      "can_manage_business": {
        Args: { "p_business_id": string }
        Returns: boolean
      },
      "can_view_order": {
        Args: { "p_order_id": string }
        Returns: boolean
      },
      "cancel_booking": {
        Args: { "p_booking_id": string; "p_reason": string }
        Returns: { "accepted_at": string; "accepted_by": string | null; "advertiser_business_id": string; "agreed_price_cents": number; "campaign_id": string; "cancel_reason": string | null; "cancelled_at": string | null; "commission_bps": number; "commission_cents": number; "completed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "delivery_status": Database["public"]["Enums"]["delivery_status"]; "end_date": string; "id": string; "monetized": boolean; "net_to_owner_cents": number; "payment_status": Database["public"]["Enums"]["payment_status"]; "request_id": string; "screen_business_id": string; "screen_id": string; "start_date": string; "status": Database["public"]["Enums"]["booking_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "cancel_checkout": {
        Args: { "p_checkout_id": string }
        Returns: Json
      },
      "cart_issue_text": {
        Args: { "p_issue": string }
        Returns: string
      },
      "cart_lines": {
        Args: { "p_currency": Database["public"]["Enums"]["currency"]; "p_user_id": string }
        Returns: { "available": number; "business_id": string; "cart_item_id": string; "image": string; "is_authentic": boolean; "issue": string; "line_total_cents": number; "name": string; "note": string; "pay_currency": Database["public"]["Enums"]["currency"]; "product_id": string; "quantity": number; "shipping_profile_id": string; "sku": string; "tax_code": string; "unit_price_cents": number; "variant_id": string; "variant_title": string; "weight_grams": number }[]
      },
      "cart_seller_hash": {
        Args: { "p_business_id": string; "p_currency": Database["public"]["Enums"]["currency"]; "p_user_id": string }
        Returns: string
      },
      "cart_set": {
        Args: { "p_mode"?: string; "p_note"?: string; "p_product_id": string; "p_quantity": number; "p_variant_id"?: string }
        Returns: Json
      },
      "cart_view": {
        Args: { "p_currency"?: Database["public"]["Enums"]["currency"] }
        Returns: Json
      },
      "checkout_cancel_internal": {
        Args: { "p_checkout_id": string; "p_reason": string; "p_status": Database["public"]["Enums"]["checkout_status"] }
        Returns: boolean
      },
      "checkout_mark_paid": {
        Args: { "p_amount_cents"?: number; "p_checkout_id": string; "p_provider": Database["public"]["Enums"]["payment_provider"]; "p_provider_ref": string; "p_receipt_url"?: string; "p_tax"?: Json }
        Returns: Json
      },
      "checkout_paid_internal": {
        Args: { "p_amount_cents": number; "p_checkout_id": string; "p_provider": Database["public"]["Enums"]["payment_provider"]; "p_provider_ref": string; "p_receipt_url": string; "p_tax": Json }
        Returns: Json
      },
      "checkout_plan": {
        Args: { "p_address_id": string; "p_currency": Database["public"]["Enums"]["currency"]; "p_points": number; "p_shipping": Json; "p_user_id": string }
        Returns: Json
      },
      "checkout_preview": {
        Args: { "p_address_id"?: string; "p_currency"?: Database["public"]["Enums"]["currency"]; "p_points"?: number; "p_shipping"?: Json }
        Returns: Json
      },
      "checkout_set_session": {
        Args: { "p_checkout_id": string; "p_expires_at"?: string; "p_provider": Database["public"]["Enums"]["payment_provider"]; "p_session_ref": string }
        Returns: undefined
      },
      "checkout_start": {
        Args: { "p_address_id": string; "p_currency"?: Database["public"]["Enums"]["currency"]; "p_notes"?: Json; "p_points"?: number; "p_shipping": Json }
        Returns: Json
      },
      "checkout_summary": {
        Args: { "p_checkout_id": string }
        Returns: Json
      },
      "claim_deal": {
        Args: { "p_deal_id": string }
        Returns: Json
      },
      "commerce_housekeeping": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "complete_booking": {
        Args: { "p_booking_id": string }
        Returns: { "accepted_at": string; "accepted_by": string | null; "advertiser_business_id": string; "agreed_price_cents": number; "campaign_id": string; "cancel_reason": string | null; "cancelled_at": string | null; "commission_bps": number; "commission_cents": number; "completed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "delivery_status": Database["public"]["Enums"]["delivery_status"]; "end_date": string; "id": string; "monetized": boolean; "net_to_owner_cents": number; "payment_status": Database["public"]["Enums"]["payment_status"]; "request_id": string; "screen_business_id": string; "screen_id": string; "start_date": string; "status": Database["public"]["Enums"]["booking_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "convert_cents": {
        Args: { "p_amount_cents": number; "p_from": Database["public"]["Enums"]["currency"]; "p_to": Database["public"]["Enums"]["currency"] }
        Returns: number
      },
      "daily_housekeeping": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "deals_feed": {
        Args: { "p_category_id"?: string; "p_city"?: string; "p_lat"?: number; "p_limit"?: number; "p_lng"?: number; "p_market"?: Database["public"]["Enums"]["market"]; "p_offset"?: number; "p_query"?: string; "p_state"?: string }
        Returns: Json
      },
      "distance_km": {
        Args: { "lat1": number; "lat2": number; "lng1": number; "lng2": number }
        Returns: number
      },
      "duplicate_campaign": {
        Args: { "p_campaign_id": string; "p_end"?: string; "p_name"?: string; "p_start"?: string }
        Returns: { "advertiser_business_id": string; "budget_total_cents": number | null; "created_at": string; "created_by": string; "creative_image_path": string | null; "creative_instructions": string | null; "creative_video_path": string | null; "duplicated_from": string | null; "duration_days": number | null; "end_date": string | null; "id": string; "max_price_per_location_cents": number | null; "name": string; "objective": string | null; "price_max_cents": number | null; "price_min_cents": number | null; "start_date": string | null; "status": Database["public"]["Enums"]["campaign_status"]; "submitted_at": string | null; "targeting": NonNullable<Json>; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "effective_commission_bps": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "ensure_shipping_profile": {
        Args: { "p_business_id": string }
        Returns: { "allow_pickup": boolean; "business_id": string; "created_at": string; "handling_days_max": number; "handling_days_min": number; "id": string; "is_default": boolean; "name": string; "origin_city": string | null; "origin_country": string | null; "origin_line1": string | null; "origin_line2": string | null; "origin_name": string | null; "origin_phone": string | null; "origin_postal_code": string | null; "origin_region": string | null; "pickup_instructions": string | null; "updated_at": string; "use_carrier_rates": boolean }
        SetofOptions: {
          from: "*"
          to: "shipping_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "escrow_release": {
        Args: { "p_order_id": string; "p_trigger": string }
        Returns: undefined
      },
      "estimate_screen_price_cents": {
        Args: { "p_days": number; "p_package_id"?: string; "p_screen_id": string }
        Returns: number
      },
      "estimate_shipping": {
        Args: { "p_country"?: string; "p_currency"?: Database["public"]["Enums"]["currency"]; "p_product_id": string; "p_quantity"?: number }
        Returns: Json
      },
      "event_rsvp": {
        Args: { "p_event_id": string; "p_status": string }
        Returns: Json
      },
      "events_can_submit": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "events_feed": {
        Args: { "p_business_id"?: string; "p_category"?: Database["public"]["Enums"]["event_category"]; "p_days"?: number; "p_region"?: string; "p_tag"?: string }
        Returns: Json
      },
      "events_import": {
        Args: { "p_error"?: string; "p_events"?: Json; "p_source_id": string }
        Returns: Json
      },
      "events_ingest_now": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      },
      "expire_seller_kyc": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "expire_stale_requests": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "expire_unpaid_checkouts": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "export_my_data": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "home_feed": {
        Args: { "p_lat"?: number; "p_lng"?: number; "p_market"?: Database["public"]["Enums"]["market"] }
        Returns: Json
      },
      "https_or_null": {
        Args: { "p_url": string }
        Returns: string
      },
      "internal_begin": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      },
      "internal_end": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      },
      "invoke_worker": {
        Args: { "p_function": string }
        Returns: undefined
      },
      "is_admin": {
        Args: Record<PropertyKey, never>
        Returns: boolean
      },
      "is_backend": {
        Args: Record<PropertyKey, never>
        Returns: boolean
      },
      "is_business_member": {
        Args: { "p_business_id": string }
        Returns: boolean
      },
      "is_conversation_participant": {
        Args: { "p_conversation_id": string }
        Returns: boolean
      },
      "is_service_context": {
        Args: Record<PropertyKey, never>
        Returns: boolean
      },
      "is_staff": {
        Args: Record<PropertyKey, never>
        Returns: boolean
      },
      "kyc_reveal_identifier": {
        Args: { "p_business_id": string; "p_field": string }
        Returns: string
      },
      "kyc_set_identifier": {
        Args: { "p_business_id": string; "p_field": string; "p_value": string }
        Returns: string
      },
      "loyalty_adjust": {
        Args: { "p_delta": number; "p_reason": string; "p_user_id": string }
        Returns: number
      },
      "loyalty_apply": {
        Args: { "p_business_id"?: string; "p_checkout_id"?: string; "p_delta": number; "p_description"?: string; "p_kind": string; "p_order_id"?: string; "p_user_id": string }
        Returns: number
      },
      "loyalty_earn_for_order": {
        Args: { "p_order_id": string }
        Returns: number
      },
      "loyalty_maintenance": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "loyalty_qualifying_points": {
        Args: { "p_user_id": string }
        Returns: number
      },
      "loyalty_quote": {
        Args: { "p_currency": Database["public"]["Enums"]["currency"]; "p_eligible_cents": number; "p_points": number; "p_user_id": string }
        Returns: Json
      },
      "loyalty_redeem": {
        Args: { "p_checkout_id": string; "p_points": number; "p_user_id": string }
        Returns: undefined
      },
      "loyalty_refresh_tier": {
        Args: { "p_user_id": string }
        Returns: string
      },
      "loyalty_restore": {
        Args: { "p_checkout_id": string }
        Returns: undefined
      },
      "loyalty_restore_for_order": {
        Args: { "p_order_id": string }
        Returns: undefined
      },
      "loyalty_summary": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "loyalty_tier_for": {
        Args: { "p_points": number }
        Returns: Json
      },
      "mark_conversation_read": {
        Args: { "p_conversation_id": string }
        Returns: undefined
      },
      "mark_notifications_read": {
        Args: { "p_ids"?: (string)[] }
        Returns: number
      },
      "monetization_enabled": {
        Args: Record<PropertyKey, never>
        Returns: boolean
      },
      "money_text": {
        Args: { "p_cents": number; "p_currency": Database["public"]["Enums"]["currency"] }
        Returns: string
      },
      "my_access": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "my_businesses": {
        Args: Record<PropertyKey, never>
        Returns: { "advertises": boolean; "badges": (Database["public"]["Enums"]["verification_level"])[]; "city": string; "id": string; "logo_url": string; "market": Database["public"]["Enums"]["market"]; "name": string; "offers_ad_screens": boolean; "role": Database["public"]["Enums"]["member_role"]; "screen_count": number; "slug": string; "state": string; "status": Database["public"]["Enums"]["business_status"] }[]
      },
      "my_deals": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "my_reviewable_items": {
        Args: { "p_order_id"?: string }
        Returns: Json
      },
      "new_order_number": {
        Args: Record<PropertyKey, never>
        Returns: string
      },
      "normalize_tags": {
        Args: { "p_tags": (string)[] }
        Returns: (string)[]
      },
      "notify_business": {
        Args: { "p_body": string; "p_business_id": string; "p_data"?: Json; "p_pref_key"?: string; "p_title": string; "p_type": Database["public"]["Enums"]["notification_type"] }
        Returns: undefined
      },
      "notify_user": {
        Args: { "p_body": string; "p_data"?: Json; "p_pref_key"?: string; "p_title": string; "p_type": Database["public"]["Enums"]["notification_type"]; "p_user_id": string }
        Returns: string
      },
      "open_conversation": {
        Args: { "p_business_id": string; "p_context"?: Database["public"]["Enums"]["conversation_context"]; "p_context_id"?: string; "p_first_message"?: string }
        Returns: string
      },
      "open_order_conversation": {
        Args: { "p_order_id": string }
        Returns: string
      },
      "open_order_dispute": {
        Args: { "p_category": string; "p_description": string; "p_evidence"?: (string)[]; "p_order_id": string }
        Returns: { "category": string; "created_at": string; "description": string; "evidence_paths": (string)[]; "id": string; "opened_by": string; "order_id": string; "refund_cents": number | null; "resolution": string | null; "resolution_note": string | null; "resolved_at": string | null; "resolved_by": string | null; "seller_responded_at": string | null; "seller_response": string | null; "status": Database["public"]["Enums"]["dispute_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "order_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "open_request_conversation": {
        Args: { "p_request_id": string }
        Returns: string
      },
      "order_cancel_refund": {
        Args: { "p_order_id": string; "p_reason": string; "p_source": string }
        Returns: undefined
      },
      "order_event": {
        Args: { "p_details"?: Json; "p_event": string; "p_internal"?: boolean; "p_message"?: string; "p_order_id": string; "p_role": string }
        Returns: undefined
      },
      "order_fulfilment_context": {
        Args: { "p_order_id": string }
        Returns: Json
      },
      "order_mark_delivered": {
        Args: { "p_order_id": string; "p_source": string }
        Returns: undefined
      },
      "order_restore_stock": {
        Args: { "p_order_id": string }
        Returns: undefined
      },
      "owner_deals": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "owns_business": {
        Args: { "p_business_id": string }
        Returns: boolean
      },
      "path_owner_uuid": {
        Args: { "p_name": string }
        Returns: string
      },
      "payment_event_begin": {
        Args: { "p_event_id": string; "p_payload"?: Json; "p_provider": string; "p_type": string }
        Returns: boolean
      },
      "payment_event_finish": {
        Args: { "p_error"?: string; "p_event_id": string; "p_provider": string }
        Returns: undefined
      },
      "payment_history": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "payment_work_queue": {
        Args: { "p_limit"?: number }
        Returns: Json
      },
      "payout_account_sync_stripe": {
        Args: { "p_account_id": string; "p_business_id": string; "p_charges_enabled": boolean; "p_details_submitted": boolean; "p_payouts_enabled": boolean; "p_requirements"?: Json }
        Returns: undefined
      },
      "payout_mark": {
        Args: { "p_failure"?: string; "p_payout_id": string; "p_provider_ref"?: string; "p_status": Database["public"]["Enums"]["payout_status"] }
        Returns: undefined
      },
      "payout_settle": {
        Args: { "p_failure": string; "p_payout_id": string; "p_provider_ref": string; "p_status": Database["public"]["Enums"]["payout_status"] }
        Returns: undefined
      },
      "product_available_quantity": {
        Args: { "p_product_id": string; "p_variant_id"?: string }
        Returns: number
      },
      "product_badges": {
        Args: { "p_product_id": string }
        Returns: (Database["public"]["Enums"]["certification_type"])[]
      },
      "product_content_hash": {
        Args: { "p_description": string; "p_images": (string)[]; "p_is_handmade": boolean; "p_materials": string; "p_name": string; "p_origin_country": string; "p_origin_region": string }
        Returns: string
      },
      "product_sync_availability": {
        Args: { "p_product_id": string }
        Returns: undefined
      },
      "quote_shipping": {
        Args: { "p_address_id": string; "p_currency"?: Database["public"]["Enums"]["currency"] }
        Returns: Json
      },
      "redeem_deal_code": {
        Args: { "p_business_id": string; "p_code": string }
        Returns: Json
      },
      "refresh_business_trust": {
        Args: { "p_business_id": string }
        Returns: string
      },
      "refund_mark": {
        Args: { "p_failure"?: string; "p_provider_ref"?: string; "p_refund_id": string; "p_status": Database["public"]["Enums"]["refund_status"] }
        Returns: undefined
      },
      "refund_settle": {
        Args: { "p_failure": string; "p_provider_ref": string; "p_refund_id": string; "p_status": Database["public"]["Enums"]["refund_status"] }
        Returns: undefined
      },
      "register_push_token": {
        Args: { "p_app_version"?: string; "p_device_name"?: string; "p_platform": Database["public"]["Enums"]["push_platform"]; "p_token": string }
        Returns: undefined
      },
      "reopen_seller_kyc": {
        Args: { "p_business_id": string }
        Returns: { "address_line1": string | null; "address_line2": string | null; "approved_at": string | null; "attested_at": string | null; "attested_by": string | null; "business_id": string; "city": string | null; "country": string | null; "created_at": string; "date_of_birth": string | null; "decision_reason": string | null; "email": string | null; "entity_type": Database["public"]["Enums"]["seller_entity_type"]; "expires_at": string | null; "id_document_country": string | null; "id_document_expires_on": string | null; "id_document_last4": string | null; "id_document_secret": string | null; "id_document_type": string | null; "legal_name": string | null; "phone": string | null; "postal_code": string | null; "region": string | null; "registration_number_last4": string | null; "registration_number_secret": string | null; "representative_name": string | null; "representative_title": string | null; "reviewed_at": string | null; "reviewed_by": string | null; "status": Database["public"]["Enums"]["kyc_status"]; "submitted_at": string | null; "tax_id_last4": string | null; "tax_id_secret": string | null; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "seller_kyc_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "require_backend": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      },
      "require_user": {
        Args: Record<PropertyKey, never>
        Returns: string
      },
      "resolve_order_dispute": {
        Args: { "p_dispute_id": string; "p_note"?: string; "p_refund_cents"?: number; "p_resolution": string }
        Returns: { "category": string; "created_at": string; "description": string; "evidence_paths": (string)[]; "id": string; "opened_by": string; "order_id": string; "refund_cents": number | null; "resolution": string | null; "resolution_note": string | null; "resolved_at": string | null; "resolved_by": string | null; "seller_responded_at": string | null; "seller_response": string | null; "status": Database["public"]["Enums"]["dispute_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "order_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "respond_order_dispute": {
        Args: { "p_dispute_id": string; "p_response": string }
        Returns: { "category": string; "created_at": string; "description": string; "evidence_paths": (string)[]; "id": string; "opened_by": string; "order_id": string; "refund_cents": number | null; "resolution": string | null; "resolution_note": string | null; "resolved_at": string | null; "resolved_by": string | null; "seller_responded_at": string | null; "seller_response": string | null; "status": Database["public"]["Enums"]["dispute_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "order_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "respond_to_request": {
        Args: { "p_action": string; "p_message"?: string; "p_price_cents"?: number; "p_request_id": string }
        Returns: { "advertiser_business_id": string; "campaign_id": string; "closed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "current_price_cents": number; "end_date": string; "expires_at": string | null; "id": string; "last_offer_by": Database["public"]["Enums"]["offer_party"]; "message": string | null; "negotiation_rounds": number; "package_id": string | null; "proposed_price_cents": number; "responded_at": string | null; "screen_business_id": string; "screen_id": string; "start_date": string; "status": Database["public"]["Enums"]["request_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "campaign_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "reveal_payout_details": {
        Args: { "p_business_id": string }
        Returns: string
      },
      "review_seller_kyc": {
        Args: { "p_business_id": string; "p_checklist"?: Json; "p_decision": Database["public"]["Enums"]["kyc_status"]; "p_internal_note"?: string; "p_reason"?: string; "p_risk_level"?: string }
        Returns: { "address_line1": string | null; "address_line2": string | null; "approved_at": string | null; "attested_at": string | null; "attested_by": string | null; "business_id": string; "city": string | null; "country": string | null; "created_at": string; "date_of_birth": string | null; "decision_reason": string | null; "email": string | null; "entity_type": Database["public"]["Enums"]["seller_entity_type"]; "expires_at": string | null; "id_document_country": string | null; "id_document_expires_on": string | null; "id_document_last4": string | null; "id_document_secret": string | null; "id_document_type": string | null; "legal_name": string | null; "phone": string | null; "postal_code": string | null; "region": string | null; "registration_number_last4": string | null; "registration_number_secret": string | null; "representative_name": string | null; "representative_title": string | null; "reviewed_at": string | null; "reviewed_by": string | null; "status": Database["public"]["Enums"]["kyc_status"]; "submitted_at": string | null; "tax_id_last4": string | null; "tax_id_secret": string | null; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "seller_kyc_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "screen_calendar": {
        Args: { "p_business_id": string; "p_from": string; "p_to": string }
        Returns: Json
      },
      "screen_is_available": {
        Args: { "p_end": string; "p_screen_id": string; "p_start": string }
        Returns: boolean
      },
      "screen_owner_analytics": {
        Args: { "p_business_id": string; "p_days"?: number }
        Returns: Json
      },
      "screen_owner_earnings": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "search_businesses": {
        Args: { "p_category_id"?: string; "p_city"?: string; "p_lat"?: number; "p_limit"?: number; "p_lng"?: number; "p_market"?: Database["public"]["Enums"]["market"]; "p_min_rating"?: number; "p_offset"?: number; "p_postal_code"?: string; "p_query"?: string; "p_radius_km"?: number; "p_selling_only"?: boolean; "p_sort"?: string; "p_state"?: string; "p_trusted_only"?: boolean; "p_verified_only"?: boolean }
        Returns: Database["public"]["CompositeTypes"]["business_card"][]
        SetofOptions: {
          from: "*"
          to: "business_card"
          isOneToOne: false
          isSetofReturn: true
        }
      },
      "search_catalog": {
        Args: { "p_lat"?: number; "p_limit"?: number; "p_lng"?: number; "p_market"?: Database["public"]["Enums"]["market"]; "p_query": string }
        Returns: Json
      },
      "search_events": {
        Args: { "p_business_id"?: string; "p_category"?: Database["public"]["Enums"]["event_category"]; "p_city"?: string; "p_country"?: string; "p_free_only"?: boolean; "p_from"?: string; "p_lat"?: number; "p_limit"?: number; "p_lng"?: number; "p_mine"?: boolean; "p_offset"?: number; "p_online"?: boolean; "p_query"?: string; "p_radius_km"?: number; "p_region"?: string; "p_sort"?: string; "p_state"?: string; "p_tag"?: string; "p_to"?: string }
        Returns: Database["public"]["CompositeTypes"]["event_card"][]
        SetofOptions: {
          from: "*"
          to: "event_card"
          isOneToOne: false
          isSetofReturn: true
        }
      },
      "search_help": {
        Args: { "p_audience"?: string; "p_limit"?: number; "p_query": string }
        Returns: { "body": string; "category": string; "rank": number; "slug": string; "summary": string; "title": string }[]
      },
      "search_products": {
        Args: { "p_authentic_only"?: boolean; "p_business_id"?: string; "p_category_id"?: string; "p_currency"?: Database["public"]["Enums"]["currency"]; "p_handmade_only"?: boolean; "p_in_stock_only"?: boolean; "p_limit"?: number; "p_market"?: Database["public"]["Enums"]["market"]; "p_max_price_cents"?: number; "p_min_price_cents"?: number; "p_min_rating"?: number; "p_offset"?: number; "p_purchasable_only"?: boolean; "p_query"?: string; "p_ships_to"?: string; "p_sort"?: string; "p_tag"?: string; "p_verified_only"?: boolean }
        Returns: Database["public"]["CompositeTypes"]["product_card"][]
        SetofOptions: {
          from: "*"
          to: "product_card"
          isOneToOne: false
          isSetofReturn: true
        }
      },
      "search_screens": {
        Args: { "p_category_id"?: string; "p_city"?: string; "p_end"?: string; "p_lat"?: number; "p_limit"?: number; "p_lng"?: number; "p_min_daily_visitors"?: number; "p_min_size_inches"?: number; "p_offset"?: number; "p_price_max_cents"?: number; "p_price_min_cents"?: number; "p_query"?: string; "p_radius_km"?: number; "p_sort"?: string; "p_start"?: string; "p_state"?: string; "p_verified_only"?: boolean }
        Returns: Database["public"]["CompositeTypes"]["screen_card"][]
        SetofOptions: {
          from: "*"
          to: "screen_card"
          isOneToOne: false
          isSetofReturn: true
        }
      },
      "search_suggestions": {
        Args: { "p_limit"?: number; "p_query": string }
        Returns: Json
      },
      "seller_can_sell": {
        Args: { "p_business_id": string }
        Returns: boolean
      },
      "seller_kyc_checklist": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "seller_overview": {
        Args: { "p_business_id": string }
        Returns: Json
      },
      "seller_sales_series": {
        Args: { "p_business_id": string; "p_days"?: number }
        Returns: Json
      },
      "seller_update_order": {
        Args: { "p_action": string; "p_details"?: Json; "p_order_id": string }
        Returns: { "accepted_at": string | null; "auto_deliver_at": string | null; "business_id": string; "buyer_id": string; "buyer_note": string | null; "cancel_reason": string | null; "cancelled_at": string | null; "cancelled_by": string | null; "checkout_id": string; "commission_bps": number; "commission_cents": number; "completed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "delivered_at": string | null; "discount_cents": number; "escrow_release_at": string | null; "escrow_status": Database["public"]["Enums"]["escrow_status"]; "fulfillment": Database["public"]["Enums"]["fulfillment_method"]; "id": string; "item_count": number; "label_cost_cents": number; "net_to_seller_cents": number; "order_number": string; "paid_at": string | null; "points_earned": number; "refunded_cents": number; "shipped_at": string | null; "shipping_address": NonNullable<Json>; "shipping_cents": number; "shipping_method": NonNullable<Json>; "status": Database["public"]["Enums"]["order_status"]; "status_before_dispute": Database["public"]["Enums"]["order_status"] | null; "subtotal_cents": number; "tax_breakdown": NonNullable<Json>; "tax_cents": number; "total_cents": number; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "send_announcement": {
        Args: { "p_audience"?: string; "p_body": string; "p_kind"?: string; "p_route"?: string; "p_title": string }
        Returns: number
      },
      "send_event_reminders": {
        Args: Record<PropertyKey, never>
        Returns: number
      },
      "set_exchange_rate": {
        Args: { "p_quote": Database["public"]["Enums"]["currency"]; "p_rate": number }
        Returns: undefined
      },
      "set_manual_payout_details": {
        Args: { "p_business_id": string; "p_details": string; "p_method": string }
        Returns: string
      },
      "setting": {
        Args: { "p_key": string }
        Returns: Json
      },
      "shipment_label_abort": {
        Args: { "p_order_id": string }
        Returns: undefined
      },
      "shipment_label_begin": {
        Args: { "p_actor": string; "p_order_id": string }
        Returns: string
      },
      "shipment_record_label": {
        Args: { "p_actor": string; "p_carrier": string; "p_cost_cents": number; "p_cost_currency": Database["public"]["Enums"]["currency"]; "p_label_url": string; "p_order_id": string; "p_provider_rate_id"?: string; "p_provider_shipment_id"?: string; "p_provider_transaction_id"?: string; "p_service": string; "p_tracking_number": string; "p_tracking_url": string }
        Returns: string
      },
      "shipment_tracking_update": {
        Args: { "p_eta"?: string; "p_event"?: Json; "p_status": Database["public"]["Enums"]["shipment_status"]; "p_tracking_number": string }
        Returns: boolean
      },
      "shipping_quote_context": {
        Args: { "p_address_id": string; "p_currency": Database["public"]["Enums"]["currency"]; "p_user_id": string }
        Returns: Json
      },
      "shipping_quotes_insert": {
        Args: { "p_quotes": Json; "p_user_id": string }
        Returns: number
      },
      "shipping_quotes_view": {
        Args: { "p_currency"?: Database["public"]["Enums"]["currency"] }
        Returns: Json
      },
      "shipping_rate_options": {
        Args: { "p_business_id": string; "p_country": string; "p_currency": Database["public"]["Enums"]["currency"]; "p_item_count": number; "p_profile_id": string; "p_subtotal_cents": number; "p_weight_grams": number }
        Returns: { "amount_cents": number; "eta_max_days": number; "eta_min_days": number; "name": string; "rate_id": string }[]
      },
      "slugify": {
        Args: { "input": string }
        Returns: string
      },
      "staff_can": {
        Args: { "p_permission": string }
        Returns: boolean
      },
      "staff_permission_list": {
        Args: Record<PropertyKey, never>
        Returns: (string)[]
      },
      "stock_apply": {
        Args: { "p_delta": number; "p_note"?: string; "p_order_id"?: string; "p_product_id": string; "p_reason": Database["public"]["Enums"]["inventory_reason"]; "p_variant_id": string }
        Returns: number
      },
      "submit_campaign_requests": {
        Args: { "p_campaign_id": string; "p_items": Json }
        Returns: Json
      },
      "submit_seller_kyc": {
        Args: { "p_attest": boolean; "p_business_id": string }
        Returns: { "address_line1": string | null; "address_line2": string | null; "approved_at": string | null; "attested_at": string | null; "attested_by": string | null; "business_id": string; "city": string | null; "country": string | null; "created_at": string; "date_of_birth": string | null; "decision_reason": string | null; "email": string | null; "entity_type": Database["public"]["Enums"]["seller_entity_type"]; "expires_at": string | null; "id_document_country": string | null; "id_document_expires_on": string | null; "id_document_last4": string | null; "id_document_secret": string | null; "id_document_type": string | null; "legal_name": string | null; "phone": string | null; "postal_code": string | null; "region": string | null; "registration_number_last4": string | null; "registration_number_secret": string | null; "representative_name": string | null; "representative_title": string | null; "reviewed_at": string | null; "reviewed_by": string | null; "status": Database["public"]["Enums"]["kyc_status"]; "submitted_at": string | null; "tax_id_last4": string | null; "tax_id_secret": string | null; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "seller_kyc_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "suggest_screens": {
        Args: { "p_budget_cents": number; "p_category_ids"?: (string)[]; "p_cities"?: (string)[]; "p_desired_count"?: number; "p_duration_days": number; "p_end"?: string; "p_exclude_business_id"?: string; "p_lat"?: number; "p_lng"?: number; "p_radius_km"?: number; "p_start"?: string; "p_state"?: string }
        Returns: Json
      },
      "support_add_reply": {
        Args: { "p_content": string; "p_meta"?: Json; "p_thread_id": string }
        Returns: string
      },
      "support_facts": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "support_request_human": {
        Args: { "p_reason"?: string; "p_thread_id": string }
        Returns: undefined
      },
      "support_send": {
        Args: { "p_content": string; "p_order_id"?: string; "p_thread_id"?: string }
        Returns: Json
      },
      "support_staff_reply": {
        Args: { "p_content": string; "p_resolve"?: boolean; "p_thread_id": string }
        Returns: string
      },
      "tax_manual": {
        Args: { "p_country": string; "p_goods_cents": number; "p_region": string; "p_shipping_cents": number }
        Returns: Json
      },
      "track_event": {
        Args: { "p_business_id"?: string; "p_event": Database["public"]["Enums"]["analytics_event"]; "p_meta"?: Json; "p_platform"?: string; "p_session_id"?: string; "p_target_id"?: string; "p_target_type"?: string }
        Returns: undefined
      },
      "try_uuid": {
        Args: { "p_text": string }
        Returns: string
      },
      "unread_counts": {
        Args: Record<PropertyKey, never>
        Returns: Json
      },
      "update_booking_delivery": {
        Args: { "p_booking_id": string; "p_delivery": Database["public"]["Enums"]["delivery_status"] }
        Returns: { "accepted_at": string; "accepted_by": string | null; "advertiser_business_id": string; "agreed_price_cents": number; "campaign_id": string; "cancel_reason": string | null; "cancelled_at": string | null; "commission_bps": number; "commission_cents": number; "completed_at": string | null; "created_at": string; "currency": Database["public"]["Enums"]["currency"]; "delivery_status": Database["public"]["Enums"]["delivery_status"]; "end_date": string; "id": string; "monetized": boolean; "net_to_owner_cents": number; "payment_status": Database["public"]["Enums"]["payment_status"]; "request_id": string; "screen_business_id": string; "screen_id": string; "start_date": string; "status": Database["public"]["Enums"]["booking_status"]; "updated_at": string }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      },
      "upsert_exchange_rates": {
        Args: { "p_rates": Json; "p_source": string }
        Returns: number
      },
      "verify_worker_secret": {
        Args: { "p_secret": string }
        Returns: boolean
      }
    }
    Enums: {
      "ad_format": "video" | "image"
      "analytics_event": "business_view" | "contact_click" | "call_click" | "directions_click" | "website_click" | "share_click" | "product_view" | "service_view" | "screen_view" | "screen_inquiry" | "campaign_request_sent" | "search" | "save" | "add_to_cart" | "checkout_started" | "order_placed" | "event_view" | "deal_view" | "deal_claim" | "deal_redeem"
      "availability": "in_stock" | "out_of_stock" | "preorder" | "made_to_order"
      "booking_status": "confirmed" | "in_progress" | "completed" | "cancelled" | "disputed"
      "business_status": "draft" | "pending" | "published" | "suspended"
      "campaign_status": "draft" | "submitted" | "active" | "completed" | "cancelled"
      "certification_type": "authentic_habesha" | "handmade" | "origin_verified"
      "checkout_status": "pending" | "paid" | "cancelled" | "expired" | "refund_due"
      "conversation_context": "general" | "inquiry" | "product" | "campaign_request" | "booking" | "order"
      "currency": "USD" | "ETB" | "EUR" | "GBP" | "CAD" | "AUD" | "AED" | "SEK" | "NOK" | "CHF" | "SAR"
      "deal_status": "active" | "paused" | "ended"
      "delivery_status": "awaiting_creative" | "creative_received" | "scheduled" | "running" | "completed"
      "dispute_status": "open" | "under_review" | "resolved" | "dismissed"
      "escrow_status": "none" | "held" | "released" | "refund_pending" | "refunded" | "partially_refunded"
      "event_category": "festival" | "holiday_market" | "live_music" | "religious" | "community" | "food_drink" | "arts_culture" | "business" | "family" | "sports" | "other"
      "event_status": "draft" | "pending" | "published" | "rejected" | "cancelled"
      "evidence_kind": "owner_submitted" | "device_verified"
      "fulfillment_method": "shipping" | "pickup"
      "inquiry_status": "new" | "read" | "replied" | "closed"
      "inquiry_type": "contact" | "quote" | "advertising"
      "inventory_reason": "restock" | "sale" | "sale_cancelled" | "return" | "adjustment" | "damage" | "correction"
      "kyc_status": "draft" | "submitted" | "in_review" | "needs_info" | "approved" | "rejected" | "suspended"
      "market": "us" | "et"
      "member_role": "owner" | "manager" | "staff"
      "notification_type": "inquiry_new" | "ad_request_new" | "offer_accepted" | "offer_countered" | "request_declined" | "booking_confirmed" | "verification_update" | "payment_update" | "campaign_completed" | "dispute_opened" | "message_new" | "moderation" | "system" | "order_new" | "order_update" | "shipment_update" | "escrow_released" | "payout_update" | "refund_update" | "order_dispute" | "kyc_update" | "certification_update" | "review_new" | "low_stock" | "event_reminder" | "event_update" | "rewards_update" | "support_reply" | "announcement" | "deal_new"
      "offer_kind": "initial" | "counter" | "accept" | "decline" | "withdraw" | "expire"
      "offer_party": "advertiser" | "owner"
      "order_status": "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded" | "disputed"
      "payment_provider": "stripe" | "manual" | "none"
      "payment_status": "not_required" | "unpaid" | "pending" | "paid" | "refunded" | "failed"
      "payout_status": "scheduled" | "processing" | "paid" | "failed" | "cancelled" | "on_hold"
      "platform_role": "user" | "moderator" | "admin"
      "push_platform": "ios" | "android" | "web"
      "refund_status": "approved" | "processing" | "succeeded" | "failed" | "cancelled"
      "report_status": "open" | "reviewed" | "actioned" | "dismissed"
      "request_status": "pending" | "countered" | "accepted" | "declined" | "expired" | "cancelled" | "withdrawn"
      "review_status": "published" | "hidden" | "removed"
      "review_target": "business" | "screen_owner" | "advertiser" | "product"
      "rsvp_status": "going" | "interested"
      "saved_target": "business" | "product" | "screen"
      "screen_status": "draft" | "active" | "paused" | "archived"
      "seller_entity_type": "individual" | "sole_proprietor" | "company" | "nonprofit"
      "shipment_status": "pending" | "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "returned" | "cancelled"
      "support_status": "open" | "waiting_staff" | "resolved"
      "verification_level": "identity" | "business" | "location" | "fulfillment"
      "verification_status": "submitted" | "in_review" | "needs_info" | "approved" | "rejected" | "withdrawn"
    }
    CompositeTypes: {
      "business_card": {
        "id": string | null
        "slug": string | null
        "name": string | null
        "name_am": string | null
        "tagline": string | null
        "market": Database["public"]["Enums"]["market"] | null
        "category_id": string | null
        "category_name": string | null
        "category_slug": string | null
        "city": string | null
        "state": string | null
        "postal_code": string | null
        "country": string | null
        "lat": number | null
        "lng": number | null
        "logo_url": string | null
        "cover_url": string | null
        "rating_avg": number | null
        "rating_count": number | null
        "badges": (Database["public"]["Enums"]["verification_level"])[] | null
        "is_featured": boolean | null
        "offers_ad_screens": boolean | null
        "distance_km": number | null
        "published_at": string | null
        "trust_tier": string | null
        "selling_enabled": boolean | null
        "authenticity_avg": number | null
        "product_count": number | null
      },
      "event_card": {
        "id": string | null
        "slug": string | null
        "title": string | null
        "title_am": string | null
        "category": Database["public"]["Enums"]["event_category"] | null
        "starts_at": string | null
        "ends_at": string | null
        "timezone": string | null
        "all_day": boolean | null
        "venue_name": string | null
        "city": string | null
        "state": string | null
        "country": string | null
        "lat": number | null
        "lng": number | null
        "is_online": boolean | null
        "cover_path": string | null
        "is_free": boolean | null
        "price_note": string | null
        "organizer_name": string | null
        "organizer_business_id": string | null
        "organizer_business_name": string | null
        "organizer_business_slug": string | null
        "is_featured": boolean | null
        "going_count": number | null
        "interested_count": number | null
        "distance_km": number | null
        "my_rsvp": Database["public"]["Enums"]["rsvp_status"] | null
        "tags": (string)[] | null
        "cover_url": string | null
        "source_kind": string | null
        "external_url": string | null
      },
      "product_card": {
        "id": string | null
        "business_id": string | null
        "business_name": string | null
        "business_slug": string | null
        "business_city": string | null
        "business_country": string | null
        "name": string | null
        "price_cents": number | null
        "currency": Database["public"]["Enums"]["currency"] | null
        "alt_price_cents": number | null
        "alt_currency": Database["public"]["Enums"]["currency"] | null
        "image": string | null
        "availability": Database["public"]["Enums"]["availability"] | null
        "shipping": Json | null
        "category_id": string | null
        "badges": (Database["public"]["Enums"]["verification_level"])[] | null
        "created_at": string | null
        "is_authentic": boolean | null
        "rating_avg": number | null
        "rating_count": number | null
        "in_stock": boolean | null
        "purchasable": boolean | null
        "trust_tier": string | null
        "sales_count": number | null
        "category_name": string | null
        "is_handmade": boolean | null
      },
      "screen_card": {
        "id": string | null
        "business_id": string | null
        "business_name": string | null
        "business_slug": string | null
        "category_name": string | null
        "city": string | null
        "state": string | null
        "postal_code": string | null
        "lat": number | null
        "lng": number | null
        "title": string | null
        "image": string | null
        "screen_count": number | null
        "screen_size_inches": number | null
        "orientation": string | null
        "formats": (Database["public"]["Enums"]["ad_format"])[] | null
        "base_price_cents": number | null
        "base_duration_days": number | null
        "currency": Database["public"]["Enums"]["currency"] | null
        "estimated_daily_visitors": number | null
        "rating_avg": number | null
        "rating_count": number | null
        "badges": (Database["public"]["Enums"]["verification_level"])[] | null
        "distance_km": number | null
        "available": boolean | null
        "estimated_price_cents": number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
    Enums: {
      "ad_format": ["video", "image"],
      "analytics_event": ["business_view", "contact_click", "call_click", "directions_click", "website_click", "share_click", "product_view", "service_view", "screen_view", "screen_inquiry", "campaign_request_sent", "search", "save", "add_to_cart", "checkout_started", "order_placed", "event_view", "deal_view", "deal_claim", "deal_redeem"],
      "availability": ["in_stock", "out_of_stock", "preorder", "made_to_order"],
      "booking_status": ["confirmed", "in_progress", "completed", "cancelled", "disputed"],
      "business_status": ["draft", "pending", "published", "suspended"],
      "campaign_status": ["draft", "submitted", "active", "completed", "cancelled"],
      "certification_type": ["authentic_habesha", "handmade", "origin_verified"],
      "checkout_status": ["pending", "paid", "cancelled", "expired", "refund_due"],
      "conversation_context": ["general", "inquiry", "product", "campaign_request", "booking", "order"],
      "currency": ["USD", "ETB", "EUR", "GBP", "CAD", "AUD", "AED", "SEK", "NOK", "CHF", "SAR"],
      "deal_status": ["active", "paused", "ended"],
      "delivery_status": ["awaiting_creative", "creative_received", "scheduled", "running", "completed"],
      "dispute_status": ["open", "under_review", "resolved", "dismissed"],
      "escrow_status": ["none", "held", "released", "refund_pending", "refunded", "partially_refunded"],
      "event_category": ["festival", "holiday_market", "live_music", "religious", "community", "food_drink", "arts_culture", "business", "family", "sports", "other"],
      "event_status": ["draft", "pending", "published", "rejected", "cancelled"],
      "evidence_kind": ["owner_submitted", "device_verified"],
      "fulfillment_method": ["shipping", "pickup"],
      "inquiry_status": ["new", "read", "replied", "closed"],
      "inquiry_type": ["contact", "quote", "advertising"],
      "inventory_reason": ["restock", "sale", "sale_cancelled", "return", "adjustment", "damage", "correction"],
      "kyc_status": ["draft", "submitted", "in_review", "needs_info", "approved", "rejected", "suspended"],
      "market": ["us", "et"],
      "member_role": ["owner", "manager", "staff"],
      "notification_type": ["inquiry_new", "ad_request_new", "offer_accepted", "offer_countered", "request_declined", "booking_confirmed", "verification_update", "payment_update", "campaign_completed", "dispute_opened", "message_new", "moderation", "system", "order_new", "order_update", "shipment_update", "escrow_released", "payout_update", "refund_update", "order_dispute", "kyc_update", "certification_update", "review_new", "low_stock", "event_reminder", "event_update", "rewards_update", "support_reply", "announcement", "deal_new"],
      "offer_kind": ["initial", "counter", "accept", "decline", "withdraw", "expire"],
      "offer_party": ["advertiser", "owner"],
      "order_status": ["pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded", "disputed"],
      "payment_provider": ["stripe", "manual", "none"],
      "payment_status": ["not_required", "unpaid", "pending", "paid", "refunded", "failed"],
      "payout_status": ["scheduled", "processing", "paid", "failed", "cancelled", "on_hold"],
      "platform_role": ["user", "moderator", "admin"],
      "push_platform": ["ios", "android", "web"],
      "refund_status": ["approved", "processing", "succeeded", "failed", "cancelled"],
      "report_status": ["open", "reviewed", "actioned", "dismissed"],
      "request_status": ["pending", "countered", "accepted", "declined", "expired", "cancelled", "withdrawn"],
      "review_status": ["published", "hidden", "removed"],
      "review_target": ["business", "screen_owner", "advertiser", "product"],
      "rsvp_status": ["going", "interested"],
      "saved_target": ["business", "product", "screen"],
      "screen_status": ["draft", "active", "paused", "archived"],
      "seller_entity_type": ["individual", "sole_proprietor", "company", "nonprofit"],
      "shipment_status": ["pending", "label_created", "in_transit", "out_for_delivery", "delivered", "exception", "returned", "cancelled"],
      "support_status": ["open", "waiting_staff", "resolved"],
      "verification_level": ["identity", "business", "location", "fulfillment"],
      "verification_status": ["submitted", "in_review", "needs_info", "approved", "rejected", "withdrawn"]
    }
  }
} as const
