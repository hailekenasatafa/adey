
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ad_screen_blocked_dates": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"reason": string | null,"screen_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"reason"?: string | null,"screen_id": string,"start_date": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"reason"?: string | null,"screen_id"?: string,"start_date"?: string
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
                },"ad_screen_packages": {
                  Row: {
                    "created_at": string,"description": string | null,"duration_days": number,"id": string,"is_active": boolean,"name": string,"plays_per_day": number | null,"price_cents": number,"screen_id": string,"sort_order": number,"spot_seconds": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"duration_days": number,"id"?: string,"is_active"?: boolean,"name": string,"plays_per_day"?: number | null,"price_cents": number,"screen_id": string,"sort_order"?: number,"spot_seconds"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"plays_per_day"?: number | null,"price_cents"?: number,"screen_id"?: string,"sort_order"?: number,"spot_seconds"?: number | null
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
                },"ad_screen_private": {
                  Row: {
                    "auto_decline_below_min": boolean,"min_price_cents": number | null,"screen_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_decline_below_min"?: boolean,"min_price_cents"?: number | null,"screen_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_decline_below_min"?: boolean,"min_price_cents"?: number | null,"screen_id"?: string,"updated_at"?: string
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
                },"ad_screens": {
                  Row: {
                    "advertising_hours": NonNullable<Json>,"base_duration_days": number,"base_price_cents": number,"business_id": string,"created_at": string,"currency": Database["public"]['Enums']["currency"],"description": string | null,"estimated_daily_visitors": number | null,"formats": (Database["public"]['Enums']["ad_format"])[],"id": string,"images": (string)[],"max_video_seconds": number | null,"orientation": string | null,"placement": string | null,"rating_avg": number | null,"rating_count": number,"resolution": string | null,"screen_count": number,"screen_size_inches": number | null,"status": Database["public"]['Enums']["screen_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertising_hours"?: NonNullable<Json>,"base_duration_days"?: number,"base_price_cents": number,"business_id": string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"estimated_daily_visitors"?: number | null,"formats"?: (Database["public"]['Enums']["ad_format"])[],"id"?: string,"images"?: (string)[],"max_video_seconds"?: number | null,"orientation"?: string | null,"placement"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"resolution"?: string | null,"screen_count"?: number,"screen_size_inches"?: number | null,"status"?: Database["public"]['Enums']["screen_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "advertising_hours"?: NonNullable<Json>,"base_duration_days"?: number,"base_price_cents"?: number,"business_id"?: string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"estimated_daily_visitors"?: number | null,"formats"?: (Database["public"]['Enums']["ad_format"])[],"id"?: string,"images"?: (string)[],"max_video_seconds"?: number | null,"orientation"?: string | null,"placement"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"resolution"?: string | null,"screen_count"?: number,"screen_size_inches"?: number | null,"status"?: Database["public"]['Enums']["screen_status"],"title"?: string,"updated_at"?: string
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
                },"admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "business_id": string | null,"created_at": string,"event": Database["public"]['Enums']["analytics_event"],"id": number,"meta": NonNullable<Json>,"platform": string | null,"session_id": string | null,"target_id": string | null,"target_type": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id"?: string | null,"created_at"?: string,"event": Database["public"]['Enums']["analytics_event"],"id"?: never,"meta"?: NonNullable<Json>,"platform"?: string | null,"session_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "business_id"?: string | null,"created_at"?: string,"event"?: Database["public"]['Enums']["analytics_event"],"id"?: never,"meta"?: NonNullable<Json>,"platform"?: string | null,"session_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "accepted_at": string,"accepted_by": string | null,"advertiser_business_id": string,"agreed_price_cents": number,"campaign_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"commission_bps": number,"commission_cents": number,"completed_at": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency"],"delivery_status": Database["public"]['Enums']["delivery_status"],"end_date": string,"id": string,"monetized": boolean,"net_to_owner_cents": number,"payment_status": Database["public"]['Enums']["payment_status"],"request_id": string,"screen_business_id": string,"screen_id": string,"start_date": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"accepted_by"?: string | null,"advertiser_business_id": string,"agreed_price_cents": number,"campaign_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"commission_bps"?: number,"commission_cents"?: number,"completed_at"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"delivery_status"?: Database["public"]['Enums']["delivery_status"],"end_date": string,"id"?: string,"monetized"?: boolean,"net_to_owner_cents"?: number,"payment_status"?: Database["public"]['Enums']["payment_status"],"request_id": string,"screen_business_id": string,"screen_id": string,"start_date": string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string,"accepted_by"?: string | null,"advertiser_business_id"?: string,"agreed_price_cents"?: number,"campaign_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"commission_bps"?: number,"commission_cents"?: number,"completed_at"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"delivery_status"?: Database["public"]['Enums']["delivery_status"],"end_date"?: string,"id"?: string,"monetized"?: boolean,"net_to_owner_cents"?: number,"payment_status"?: Database["public"]['Enums']["payment_status"],"request_id"?: string,"screen_business_id"?: string,"screen_id"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_advertiser_business_id_fkey"
      columns: ["advertiser_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "campaign_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_screen_business_id_fkey"
      columns: ["screen_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_screen_id_fkey"
      columns: ["screen_id"]
isOneToOne: false
      referencedRelation: "ad_screens"
      referencedColumns: ["id"]
    }
                  ]
                },"business_members": {
                  Row: {
                    "business_id": string,"created_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"business_photos": {
                  Row: {
                    "business_id": string,"caption": string | null,"created_at": string,"id": string,"sort_order": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"caption"?: string | null,"created_at"?: string,"id"?: string,"sort_order"?: number,"storage_path": string
                  }
                  Update: {
                    "business_id"?: string,"caption"?: string | null,"created_at"?: string,"id"?: string,"sort_order"?: number,"storage_path"?: string
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
                },"business_verifications": {
                  Row: {
                    "approved_at": string,"approved_by": string | null,"business_id": string,"expires_at": string | null,"level": Database["public"]['Enums']["verification_level"],"request_id": string | null,"revoke_reason": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string,"approved_by"?: string | null,"business_id": string,"expires_at"?: string | null,"level": Database["public"]['Enums']["verification_level"],"request_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "approved_at"?: string,"approved_by"?: string | null,"business_id"?: string,"expires_at"?: string | null,"level"?: Database["public"]['Enums']["verification_level"],"request_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_verifications_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_verifications_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_verifications_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_verifications_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "verification_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"advertises": boolean,"category_id": string | null,"city": string | null,"country": string,"cover_url": string | null,"created_at": string,"description": string | null,"email": string | null,"featured_until": string | null,"hours": NonNullable<Json>,"id": string,"is_featured": boolean,"lat": number | null,"lng": number | null,"logo_url": string | null,"market": Database["public"]['Enums']["market"],"name": string,"name_am": string | null,"offers_ad_screens": boolean,"owner_user_id": string,"phone": string | null,"postal_code": string | null,"published_at": string | null,"rating_avg": number | null,"rating_count": number,"service_area": string | null,"slug": string,"state": string | null,"status": Database["public"]['Enums']["business_status"],"tagline": string | null,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"advertises"?: boolean,"category_id"?: string | null,"city"?: string | null,"country"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"email"?: string | null,"featured_until"?: string | null,"hours"?: NonNullable<Json>,"id"?: string,"is_featured"?: boolean,"lat"?: number | null,"lng"?: number | null,"logo_url"?: string | null,"market"?: Database["public"]['Enums']["market"],"name": string,"name_am"?: string | null,"offers_ad_screens"?: boolean,"owner_user_id": string,"phone"?: string | null,"postal_code"?: string | null,"published_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"service_area"?: string | null,"slug": string,"state"?: string | null,"status"?: Database["public"]['Enums']["business_status"],"tagline"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"advertises"?: boolean,"category_id"?: string | null,"city"?: string | null,"country"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"email"?: string | null,"featured_until"?: string | null,"hours"?: NonNullable<Json>,"id"?: string,"is_featured"?: boolean,"lat"?: number | null,"lng"?: number | null,"logo_url"?: string | null,"market"?: Database["public"]['Enums']["market"],"name"?: string,"name_am"?: string | null,"offers_ad_screens"?: boolean,"owner_user_id"?: string,"phone"?: string | null,"postal_code"?: string | null,"published_at"?: string | null,"rating_avg"?: number | null,"rating_count"?: number,"service_area"?: string | null,"slug"?: string,"state"?: string | null,"status"?: Database["public"]['Enums']["business_status"],"tagline"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_offers": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"expires_at": string | null,"id": string,"kind": Database["public"]['Enums']["offer_kind"],"message": string | null,"party": Database["public"]['Enums']["offer_party"],"price_cents": number | null,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["offer_kind"],"message"?: string | null,"party": Database["public"]['Enums']["offer_party"],"price_cents"?: number | null,"request_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["offer_kind"],"message"?: string | null,"party"?: Database["public"]['Enums']["offer_party"],"price_cents"?: number | null,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_offers_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_offers_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_offers_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "campaign_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_requests": {
                  Row: {
                    "advertiser_business_id": string,"campaign_id": string,"closed_at": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency"],"current_price_cents": number,"end_date": string,"expires_at": string | null,"id": string,"last_offer_by": Database["public"]['Enums']["offer_party"],"message": string | null,"negotiation_rounds": number,"package_id": string | null,"proposed_price_cents": number,"responded_at": string | null,"screen_business_id": string,"screen_id": string,"start_date": string,"status": Database["public"]['Enums']["request_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertiser_business_id": string,"campaign_id": string,"closed_at"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"current_price_cents": number,"end_date": string,"expires_at"?: string | null,"id"?: string,"last_offer_by"?: Database["public"]['Enums']["offer_party"],"message"?: string | null,"negotiation_rounds"?: number,"package_id"?: string | null,"proposed_price_cents": number,"responded_at"?: string | null,"screen_business_id": string,"screen_id": string,"start_date": string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Update: {
                    "advertiser_business_id"?: string,"campaign_id"?: string,"closed_at"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"current_price_cents"?: number,"end_date"?: string,"expires_at"?: string | null,"id"?: string,"last_offer_by"?: Database["public"]['Enums']["offer_party"],"message"?: string | null,"negotiation_rounds"?: number,"package_id"?: string | null,"proposed_price_cents"?: number,"responded_at"?: string | null,"screen_business_id"?: string,"screen_id"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_requests_advertiser_business_id_fkey"
      columns: ["advertiser_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_requests_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_requests_package_id_fkey"
      columns: ["package_id"]
isOneToOne: false
      referencedRelation: "ad_screen_packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_requests_screen_business_id_fkey"
      columns: ["screen_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_requests_screen_id_fkey"
      columns: ["screen_id"]
isOneToOne: false
      referencedRelation: "ad_screens"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "advertiser_business_id": string,"budget_total_cents": number | null,"created_at": string,"created_by": string,"creative_image_path": string | null,"creative_instructions": string | null,"creative_video_path": string | null,"duplicated_from": string | null,"duration_days": number | null,"end_date": string | null,"id": string,"max_price_per_location_cents": number | null,"name": string,"objective": string | null,"price_max_cents": number | null,"price_min_cents": number | null,"start_date": string | null,"status": Database["public"]['Enums']["campaign_status"],"submitted_at": string | null,"targeting": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertiser_business_id": string,"budget_total_cents"?: number | null,"created_at"?: string,"created_by": string,"creative_image_path"?: string | null,"creative_instructions"?: string | null,"creative_video_path"?: string | null,"duplicated_from"?: string | null,"duration_days"?: never,"end_date"?: string | null,"id"?: string,"max_price_per_location_cents"?: number | null,"name": string,"objective"?: string | null,"price_max_cents"?: number | null,"price_min_cents"?: number | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"submitted_at"?: string | null,"targeting"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "advertiser_business_id"?: string,"budget_total_cents"?: number | null,"created_at"?: string,"created_by"?: string,"creative_image_path"?: string | null,"creative_instructions"?: string | null,"creative_video_path"?: string | null,"duplicated_from"?: string | null,"duration_days"?: never,"end_date"?: string | null,"id"?: string,"max_price_per_location_cents"?: number | null,"name"?: string,"objective"?: string | null,"price_max_cents"?: number | null,"price_min_cents"?: number | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"submitted_at"?: string | null,"targeting"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_advertiser_business_id_fkey"
      columns: ["advertiser_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_duplicated_from_fkey"
      columns: ["duplicated_from"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"icon": string | null,"id": string,"is_active": boolean,"markets": (Database["public"]['Enums']["market"])[],"name_am": string | null,"name_en": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"markets"?: (Database["public"]['Enums']["market"])[],"name_am"?: string | null,"name_en": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"markets"?: (Database["public"]['Enums']["market"])[],"name_am"?: string | null,"name_en"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"conversation_participants": {
                  Row: {
                    "as_business_id": string | null,"conversation_id": string,"joined_at": string,"last_read_at": string | null,"muted": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "as_business_id"?: string | null,"conversation_id": string,"joined_at"?: string,"last_read_at"?: string | null,"muted"?: boolean,"user_id": string
                  }
                  Update: {
                    "as_business_id"?: string | null,"conversation_id"?: string,"joined_at"?: string,"last_read_at"?: string | null,"muted"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_as_business_id_fkey"
      columns: ["as_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "business_id": string | null,"context_id": string | null,"context_type": Database["public"]['Enums']["conversation_context"],"created_at": string,"created_by": string | null,"id": string,"last_message_at": string | null,"last_message_preview": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id"?: string | null,"context_id"?: string | null,"context_type"?: Database["public"]['Enums']["conversation_context"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string | null,"last_message_preview"?: string | null
                  }
                  Update: {
                    "business_id"?: string | null,"context_id"?: string | null,"context_type"?: Database["public"]['Enums']["conversation_context"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string | null,"last_message_preview"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_evidence": {
                  Row: {
                    "booking_id": string,"created_at": string,"device_id": string | null,"id": string,"kind": Database["public"]['Enums']["evidence_kind"],"media_paths": (string)[],"notes": string | null,"recorded_for_date": string | null,"submitted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"device_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["evidence_kind"],"media_paths"?: (string)[],"notes"?: string | null,"recorded_for_date"?: string | null,"submitted_by"?: string | null
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"device_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["evidence_kind"],"media_paths"?: (string)[],"notes"?: string | null,"recorded_for_date"?: string | null,"submitted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_evidence_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_evidence_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_evidence_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "booking_id": string,"created_at": string,"id": string,"opened_by": string,"opened_by_business_id": string,"reason": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["dispute_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"id"?: string,"opened_by": string,"opened_by_business_id": string,"reason": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"],"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"id"?: string,"opened_by"?: string,"opened_by_business_id"?: string,"reason"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_business_id_fkey"
      columns: ["opened_by_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inquiries": {
                  Row: {
                    "business_id": string,"contact_phone": string | null,"conversation_id": string | null,"created_at": string,"from_user_id": string,"id": string,"message": string,"product_id": string | null,"service_id": string | null,"status": Database["public"]['Enums']["inquiry_status"],"subject": string | null,"type": Database["public"]['Enums']["inquiry_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"contact_phone"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"from_user_id": string,"id"?: string,"message": string,"product_id"?: string | null,"service_id"?: string | null,"status"?: Database["public"]['Enums']["inquiry_status"],"subject"?: string | null,"type"?: Database["public"]['Enums']["inquiry_type"],"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"contact_phone"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"from_user_id"?: string,"id"?: string,"message"?: string,"product_id"?: string | null,"service_id"?: string | null,"status"?: Database["public"]['Enums']["inquiry_status"],"subject"?: string | null,"type"?: Database["public"]['Enums']["inquiry_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_from_user_id_fkey"
      columns: ["from_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_from_user_id_fkey"
      columns: ["from_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachments": NonNullable<Json>,"body": string | null,"conversation_id": string,"created_at": string,"id": string,"sender_business_id": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: NonNullable<Json>,"body"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"sender_business_id"?: string | null,"sender_id": string
                  }
                  Update: {
                    "attachments"?: NonNullable<Json>,"body"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"sender_business_id"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_business_id_fkey"
      columns: ["sender_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"pushed_at": string | null,"read_at": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_intents": {
                  Row: {
                    "amount_cents": number,"booking_id": string,"commission_cents": number,"created_at": string,"currency": Database["public"]['Enums']["currency"],"failure_reason": string | null,"id": string,"payer_business_id": string,"provider": Database["public"]['Enums']["payment_provider"],"provider_ref": string | null,"receipt_url": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"booking_id": string,"commission_cents"?: number,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"failure_reason"?: string | null,"id"?: string,"payer_business_id": string,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"receipt_url"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"booking_id"?: string,"commission_cents"?: number,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"failure_reason"?: string | null,"id"?: string,"payer_business_id"?: string,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"receipt_url"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_intents_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_intents_payer_business_id_fkey"
      columns: ["payer_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "amount_cents": number,"booking_id": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency"],"failure_reason": string | null,"id": string,"paid_at": string | null,"payee_business_id": string,"provider": Database["public"]['Enums']["payment_provider"],"provider_ref": string | null,"scheduled_for": string | null,"status": Database["public"]['Enums']["payout_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"booking_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"failure_reason"?: string | null,"id"?: string,"paid_at"?: string | null,"payee_business_id": string,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"scheduled_for"?: string | null,"status"?: Database["public"]['Enums']["payout_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"booking_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"failure_reason"?: string | null,"id"?: string,"paid_at"?: string | null,"payee_business_id"?: string,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"scheduled_for"?: string | null,"status"?: Database["public"]['Enums']["payout_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_payee_business_id_fkey"
      columns: ["payee_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "alt_currency": Database["public"]['Enums']["currency"] | null,"alt_price_cents": number | null,"availability": Database["public"]['Enums']["availability"],"business_id": string,"category_id": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency"],"description": string | null,"id": string,"images": (string)[],"is_active": boolean,"name": string,"price_cents": number | null,"return_policy": string | null,"shipping": NonNullable<Json>,"updated_at": string,"variants": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_currency"?: Database["public"]['Enums']["currency"] | null,"alt_price_cents"?: number | null,"availability"?: Database["public"]['Enums']["availability"],"business_id": string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"name": string,"price_cents"?: number | null,"return_policy"?: string | null,"shipping"?: NonNullable<Json>,"updated_at"?: string,"variants"?: NonNullable<Json>
                  }
                  Update: {
                    "alt_currency"?: Database["public"]['Enums']["currency"] | null,"alt_price_cents"?: number | null,"availability"?: Database["public"]['Enums']["availability"],"business_id"?: string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"name"?: string,"price_cents"?: number | null,"return_policy"?: string | null,"shipping"?: NonNullable<Json>,"updated_at"?: string,"variants"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"deletion_requested_at": string | null,"display_name": string | null,"id": string,"locale": string,"notification_prefs": NonNullable<Json>,"onboarding_completed": boolean,"phone": string | null,"platform_role": Database["public"]['Enums']["platform_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string | null,"id": string,"locale"?: string,"notification_prefs"?: NonNullable<Json>,"onboarding_completed"?: boolean,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string | null,"id"?: string,"locale"?: string,"notification_prefs"?: NonNullable<Json>,"onboarding_completed"?: boolean,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "app_version": string | null,"created_at": string,"device_name": string | null,"id": string,"invalid_reason": string | null,"is_valid": boolean,"last_seen_at": string,"platform": Database["public"]['Enums']["push_platform"],"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"created_at"?: string,"device_name"?: string | null,"id"?: string,"invalid_reason"?: string | null,"is_valid"?: boolean,"last_seen_at"?: string,"platform": Database["public"]['Enums']["push_platform"],"token": string,"user_id": string
                  }
                  Update: {
                    "app_version"?: string | null,"created_at"?: string,"device_name"?: string | null,"id"?: string,"invalid_reason"?: string | null,"is_valid"?: boolean,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["push_platform"],"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"reporter_id": string,"resolution": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"reporter_id": string,"resolution"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "author_business_id": string | null,"author_id": string,"body": string | null,"booking_id": string | null,"business_id": string,"created_at": string,"id": string,"is_verified_customer": boolean,"rating": number,"response": string | null,"response_at": string | null,"screen_id": string | null,"status": Database["public"]['Enums']["review_status"],"target_type": Database["public"]['Enums']["review_target"],"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_business_id"?: string | null,"author_id": string,"body"?: string | null,"booking_id"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"is_verified_customer"?: boolean,"rating": number,"response"?: string | null,"response_at"?: string | null,"screen_id"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"target_type"?: Database["public"]['Enums']["review_target"],"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "author_business_id"?: string | null,"author_id"?: string,"body"?: string | null,"booking_id"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"is_verified_customer"?: boolean,"rating"?: number,"response"?: string | null,"response_at"?: string | null,"screen_id"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"target_type"?: Database["public"]['Enums']["review_target"],"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_author_business_id_fkey"
      columns: ["author_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_screen_id_fkey"
      columns: ["screen_id"]
isOneToOne: false
      referencedRelation: "ad_screens"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_items": {
                  Row: {
                    "created_at": string,"target_id": string,"target_type": Database["public"]['Enums']["saved_target"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"target_id": string,"target_type": Database["public"]['Enums']["saved_target"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"target_id"?: string,"target_type"?: Database["public"]['Enums']["saved_target"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "business_id": string,"created_at": string,"currency": Database["public"]['Enums']["currency"],"description": string | null,"duration_minutes": number | null,"id": string,"is_active": boolean,"name": string,"price_cents": number | null,"price_note": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"price_cents"?: number | null,"price_note"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency"],"description"?: string | null,"duration_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"price_cents"?: number | null,"price_note"?: string | null,"updated_at"?: string
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
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_documents": {
                  Row: {
                    "business_id": string,"created_at": string,"doc_type": string,"id": string,"original_filename": string | null,"request_id": string,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"doc_type": string,"id"?: string,"original_filename"?: string | null,"request_id": string,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"doc_type"?: string,"id"?: string,"original_filename"?: string | null,"request_id"?: string,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_documents_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_documents_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "verification_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_internal_notes": {
                  Row: {
                    "author_id": string,"created_at": string,"id": string,"note": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"id"?: string,"note": string,"request_id": string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"id"?: string,"note"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_internal_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_internal_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_internal_notes_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "verification_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_requests": {
                  Row: {
                    "admin_notes": string | null,"applicant_notes": string | null,"business_id": string,"created_at": string,"id": string,"level": Database["public"]['Enums']["verification_level"],"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["verification_status"],"submitted_by": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"applicant_notes"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"level": Database["public"]['Enums']["verification_level"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"submitted_by": string,"updated_at"?: string
                  }
                  Update: {
                    "admin_notes"?: string | null,"applicant_notes"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"level"?: Database["public"]['Enums']["verification_level"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"submitted_by"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_requests_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
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
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null
                         }
                        Update: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "advertiser_stats":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"business_analytics":
{ Args: { "p_business_id": string,"p_days"?: number }; Returns: Json
                           },
"business_badges":
{ Args: { "p_business_id": string }; Returns: (Database["public"]['Enums']["verification_level"])[]
                           },
"business_overview":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"business_role":
{ Args: { "p_business_id": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"campaign_summary":
{ Args: { "p_campaign_id": string }; Returns: Json
                           },
"can_manage_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking_id": string,"p_reason": string }; Returns: {
              "accepted_at": string,
"accepted_by": string | null,
"advertiser_business_id": string,
"agreed_price_cents": number,
"campaign_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"commission_bps": number,
"commission_cents": number,
"completed_at": string | null,
"created_at": string,
"currency": Database["public"]['Enums']["currency"],
"delivery_status": Database["public"]['Enums']["delivery_status"],
"end_date": string,
"id": string,
"monetized": boolean,
"net_to_owner_cents": number,
"payment_status": Database["public"]['Enums']["payment_status"],
"request_id": string,
"screen_business_id": string,
"screen_id": string,
"start_date": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_booking":
{ Args: { "p_booking_id": string }; Returns: {
              "accepted_at": string,
"accepted_by": string | null,
"advertiser_business_id": string,
"agreed_price_cents": number,
"campaign_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"commission_bps": number,
"commission_cents": number,
"completed_at": string | null,
"created_at": string,
"currency": Database["public"]['Enums']["currency"],
"delivery_status": Database["public"]['Enums']["delivery_status"],
"end_date": string,
"id": string,
"monetized": boolean,
"net_to_owner_cents": number,
"payment_status": Database["public"]['Enums']["payment_status"],
"request_id": string,
"screen_business_id": string,
"screen_id": string,
"start_date": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"distance_km":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"duplicate_campaign":
{ Args: { "p_campaign_id": string,"p_end"?: string,"p_name"?: string,"p_start"?: string }; Returns: {
              "advertiser_business_id": string,
"budget_total_cents": number | null,
"created_at": string,
"created_by": string,
"creative_image_path": string | null,
"creative_instructions": string | null,
"creative_video_path": string | null,
"duplicated_from": string | null,
"duration_days": number | null,
"end_date": string | null,
"id": string,
"max_price_per_location_cents": number | null,
"name": string,
"objective": string | null,
"price_max_cents": number | null,
"price_min_cents": number | null,
"start_date": string | null,
"status": Database["public"]['Enums']["campaign_status"],
"submitted_at": string | null,
"targeting": NonNullable<Json>,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaigns"
        isOneToOne: true
        isSetofReturn: false
      } },
"effective_commission_bps":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"estimate_screen_price_cents":
{ Args: { "p_days": number,"p_package_id"?: string,"p_screen_id": string }; Returns: number
                           },
"expire_stale_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"home_feed":
{ Args: { "p_lat"?: number,"p_lng"?: number,"p_market"?: Database["public"]['Enums']["market"] }; Returns: Json
                           },
"internal_begin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"internal_end":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_business_member":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"is_service_context":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"monetization_enabled":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_businesses":
{ Args: Record<PropertyKey, never>; Returns: {
              "advertises": boolean,"badges": (Database["public"]['Enums']["verification_level"])[],"city": string,"id": string,"logo_url": string,"market": Database["public"]['Enums']["market"],"name": string,"offers_ad_screens": boolean,"role": Database["public"]['Enums']["member_role"],"screen_count": number,"slug": string,"state": string,"status": Database["public"]['Enums']["business_status"]
            }[]
                           },
"notify_business":
{ Args: { "p_body": string,"p_business_id": string,"p_data"?: Json,"p_pref_key"?: string,"p_title": string,"p_type": Database["public"]['Enums']["notification_type"] }; Returns: undefined
                           },
"notify_user":
{ Args: { "p_body": string,"p_data"?: Json,"p_pref_key"?: string,"p_title": string,"p_type": Database["public"]['Enums']["notification_type"],"p_user_id": string }; Returns: string
                           },
"open_conversation":
{ Args: { "p_business_id": string,"p_context"?: Database["public"]['Enums']["conversation_context"],"p_context_id"?: string,"p_first_message"?: string }; Returns: string
                           },
"open_request_conversation":
{ Args: { "p_request_id": string }; Returns: string
                           },
"owns_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"path_owner_uuid":
{ Args: { "p_name": string }; Returns: string
                           },
"payment_history":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"register_push_token":
{ Args: { "p_app_version"?: string,"p_device_name"?: string,"p_platform": Database["public"]['Enums']["push_platform"],"p_token": string }; Returns: undefined
                           },
"respond_to_request":
{ Args: { "p_action": string,"p_message"?: string,"p_price_cents"?: number,"p_request_id": string }; Returns: {
              "advertiser_business_id": string,
"campaign_id": string,
"closed_at": string | null,
"created_at": string,
"currency": Database["public"]['Enums']["currency"],
"current_price_cents": number,
"end_date": string,
"expires_at": string | null,
"id": string,
"last_offer_by": Database["public"]['Enums']["offer_party"],
"message": string | null,
"negotiation_rounds": number,
"package_id": string | null,
"proposed_price_cents": number,
"responded_at": string | null,
"screen_business_id": string,
"screen_id": string,
"start_date": string,
"status": Database["public"]['Enums']["request_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaign_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"screen_calendar":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"screen_is_available":
{ Args: { "p_end": string,"p_screen_id": string,"p_start": string }; Returns: boolean
                           },
"screen_owner_analytics":
{ Args: { "p_business_id": string,"p_days"?: number }; Returns: Json
                           },
"screen_owner_earnings":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"search_businesses":
{ Args: { "p_category_id"?: string,"p_city"?: string,"p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_market"?: Database["public"]['Enums']["market"],"p_min_rating"?: number,"p_offset"?: number,"p_postal_code"?: string,"p_query"?: string,"p_radius_km"?: number,"p_sort"?: string,"p_state"?: string,"p_verified_only"?: boolean }; Returns: Database["public"]['CompositeTypes']["business_card"][]
                          SetofOptions: {
        from: "*"
        to: "business_card"
        isOneToOne: false
        isSetofReturn: true
      } },
"search_products":
{ Args: { "p_business_id"?: string,"p_category_id"?: string,"p_currency"?: Database["public"]['Enums']["currency"],"p_limit"?: number,"p_market"?: Database["public"]['Enums']["market"],"p_max_price_cents"?: number,"p_offset"?: number,"p_query"?: string,"p_sort"?: string }; Returns: Database["public"]['CompositeTypes']["product_card"][]
                          SetofOptions: {
        from: "*"
        to: "product_card"
        isOneToOne: false
        isSetofReturn: true
      } },
"search_screens":
{ Args: { "p_category_id"?: string,"p_city"?: string,"p_end"?: string,"p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_min_daily_visitors"?: number,"p_min_size_inches"?: number,"p_offset"?: number,"p_price_max_cents"?: number,"p_price_min_cents"?: number,"p_query"?: string,"p_radius_km"?: number,"p_sort"?: string,"p_start"?: string,"p_state"?: string,"p_verified_only"?: boolean }; Returns: Database["public"]['CompositeTypes']["screen_card"][]
                          SetofOptions: {
        from: "*"
        to: "screen_card"
        isOneToOne: false
        isSetofReturn: true
      } },
"setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"slugify":
{ Args: { "input": string }; Returns: string
                           },
"submit_campaign_requests":
{ Args: { "p_campaign_id": string,"p_items": Json }; Returns: Json
                           },
"suggest_screens":
{ Args: { "p_budget_cents": number,"p_category_ids"?: (string)[],"p_cities"?: (string)[],"p_desired_count"?: number,"p_duration_days": number,"p_end"?: string,"p_exclude_business_id"?: string,"p_lat"?: number,"p_lng"?: number,"p_radius_km"?: number,"p_start"?: string,"p_state"?: string }; Returns: Json
                           },
"track_event":
{ Args: { "p_business_id"?: string,"p_event": Database["public"]['Enums']["analytics_event"],"p_meta"?: Json,"p_platform"?: string,"p_session_id"?: string,"p_target_id"?: string,"p_target_type"?: string }; Returns: undefined
                           },
"unread_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"update_booking_delivery":
{ Args: { "p_booking_id": string,"p_delivery": Database["public"]['Enums']["delivery_status"] }; Returns: {
              "accepted_at": string,
"accepted_by": string | null,
"advertiser_business_id": string,
"agreed_price_cents": number,
"campaign_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"commission_bps": number,
"commission_cents": number,
"completed_at": string | null,
"created_at": string,
"currency": Database["public"]['Enums']["currency"],
"delivery_status": Database["public"]['Enums']["delivery_status"],
"end_date": string,
"id": string,
"monetized": boolean,
"net_to_owner_cents": number,
"payment_status": Database["public"]['Enums']["payment_status"],
"request_id": string,
"screen_business_id": string,
"screen_id": string,
"start_date": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "ad_format": "video"|"image","analytics_event": "business_view"|"contact_click"|"call_click"|"directions_click"|"website_click"|"share_click"|"product_view"|"service_view"|"screen_view"|"screen_inquiry"|"campaign_request_sent"|"search"|"save","availability": "in_stock"|"out_of_stock"|"preorder"|"made_to_order","booking_status": "confirmed"|"in_progress"|"completed"|"cancelled"|"disputed","business_status": "draft"|"pending"|"published"|"suspended","campaign_status": "draft"|"submitted"|"active"|"completed"|"cancelled","conversation_context": "general"|"inquiry"|"product"|"campaign_request"|"booking","currency": "USD"|"ETB","delivery_status": "awaiting_creative"|"creative_received"|"scheduled"|"running"|"completed","dispute_status": "open"|"under_review"|"resolved"|"dismissed","evidence_kind": "owner_submitted"|"device_verified","inquiry_status": "new"|"read"|"replied"|"closed","inquiry_type": "contact"|"quote"|"advertising","market": "us"|"et","member_role": "owner"|"manager"|"staff","notification_type": "inquiry_new"|"ad_request_new"|"offer_accepted"|"offer_countered"|"request_declined"|"booking_confirmed"|"verification_update"|"payment_update"|"campaign_completed"|"dispute_opened"|"message_new"|"moderation"|"system","offer_kind": "initial"|"counter"|"accept"|"decline"|"withdraw"|"expire","offer_party": "advertiser"|"owner","payment_provider": "stripe"|"manual"|"none","payment_status": "not_required"|"unpaid"|"pending"|"paid"|"refunded"|"failed","payout_status": "scheduled"|"processing"|"paid"|"failed"|"cancelled","platform_role": "user"|"moderator"|"admin","push_platform": "ios"|"android"|"web","report_status": "open"|"reviewed"|"actioned"|"dismissed","request_status": "pending"|"countered"|"accepted"|"declined"|"expired"|"cancelled"|"withdrawn","review_status": "published"|"hidden"|"removed","review_target": "business"|"screen_owner"|"advertiser","saved_target": "business"|"product"|"screen","screen_status": "draft"|"active"|"paused"|"archived","verification_level": "identity"|"business"|"location"|"fulfillment","verification_status": "submitted"|"in_review"|"needs_info"|"approved"|"rejected"|"withdrawn"
          }
          CompositeTypes: {
            "business_card": {
                        "id": string | null,"slug": string | null,"name": string | null,"name_am": string | null,"tagline": string | null,"market": Database["public"]['Enums']["market"] | null,"category_id": string | null,"category_name": string | null,"category_slug": string | null,"city": string | null,"state": string | null,"postal_code": string | null,"country": string | null,"lat": number | null,"lng": number | null,"logo_url": string | null,"cover_url": string | null,"rating_avg": number | null,"rating_count": number | null,"badges": (Database["public"]['Enums']["verification_level"])[] | null,"is_featured": boolean | null,"offers_ad_screens": boolean | null,"distance_km": number | null,"published_at": string | null
                      },"product_card": {
                        "id": string | null,"business_id": string | null,"business_name": string | null,"business_slug": string | null,"business_city": string | null,"business_country": string | null,"name": string | null,"price_cents": number | null,"currency": Database["public"]['Enums']["currency"] | null,"alt_price_cents": number | null,"alt_currency": Database["public"]['Enums']["currency"] | null,"image": string | null,"availability": Database["public"]['Enums']["availability"] | null,"shipping": Json | null,"category_id": string | null,"badges": (Database["public"]['Enums']["verification_level"])[] | null,"created_at": string | null
                      },"screen_card": {
                        "id": string | null,"business_id": string | null,"business_name": string | null,"business_slug": string | null,"category_name": string | null,"city": string | null,"state": string | null,"postal_code": string | null,"lat": number | null,"lng": number | null,"title": string | null,"image": string | null,"screen_count": number | null,"screen_size_inches": number | null,"orientation": string | null,"formats": (Database["public"]['Enums']["ad_format"])[] | null,"base_price_cents": number | null,"base_duration_days": number | null,"currency": Database["public"]['Enums']["currency"] | null,"estimated_daily_visitors": number | null,"rating_avg": number | null,"rating_count": number | null,"badges": (Database["public"]['Enums']["verification_level"])[] | null,"distance_km": number | null,"available": boolean | null,"estimated_price_cents": number | null
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
            "ad_format": ["video", "image"],"analytics_event": ["business_view", "contact_click", "call_click", "directions_click", "website_click", "share_click", "product_view", "service_view", "screen_view", "screen_inquiry", "campaign_request_sent", "search", "save"],"availability": ["in_stock", "out_of_stock", "preorder", "made_to_order"],"booking_status": ["confirmed", "in_progress", "completed", "cancelled", "disputed"],"business_status": ["draft", "pending", "published", "suspended"],"campaign_status": ["draft", "submitted", "active", "completed", "cancelled"],"conversation_context": ["general", "inquiry", "product", "campaign_request", "booking"],"currency": ["USD", "ETB"],"delivery_status": ["awaiting_creative", "creative_received", "scheduled", "running", "completed"],"dispute_status": ["open", "under_review", "resolved", "dismissed"],"evidence_kind": ["owner_submitted", "device_verified"],"inquiry_status": ["new", "read", "replied", "closed"],"inquiry_type": ["contact", "quote", "advertising"],"market": ["us", "et"],"member_role": ["owner", "manager", "staff"],"notification_type": ["inquiry_new", "ad_request_new", "offer_accepted", "offer_countered", "request_declined", "booking_confirmed", "verification_update", "payment_update", "campaign_completed", "dispute_opened", "message_new", "moderation", "system"],"offer_kind": ["initial", "counter", "accept", "decline", "withdraw", "expire"],"offer_party": ["advertiser", "owner"],"payment_provider": ["stripe", "manual", "none"],"payment_status": ["not_required", "unpaid", "pending", "paid", "refunded", "failed"],"payout_status": ["scheduled", "processing", "paid", "failed", "cancelled"],"platform_role": ["user", "moderator", "admin"],"push_platform": ["ios", "android", "web"],"report_status": ["open", "reviewed", "actioned", "dismissed"],"request_status": ["pending", "countered", "accepted", "declined", "expired", "cancelled", "withdrawn"],"review_status": ["published", "hidden", "removed"],"review_target": ["business", "screen_owner", "advertiser"],"saved_target": ["business", "product", "screen"],"screen_status": ["draft", "active", "paused", "archived"],"verification_level": ["identity", "business", "location", "fulfillment"],"verification_status": ["submitted", "in_review", "needs_info", "approved", "rejected", "withdrawn"]
          }
        }
} as const
