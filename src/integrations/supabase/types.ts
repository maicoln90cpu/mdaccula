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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_generated_posts: {
        Row: {
          blog_post_id: string | null
          generated_at: string | null
          id: string
          image_tokens: number | null
          input_tokens: number | null
          model_used: string | null
          output_tokens: number | null
          prompt_used: string | null
          source_urls: string[] | null
          template_id: string | null
          total_tokens: number | null
        }
        Insert: {
          blog_post_id?: string | null
          generated_at?: string | null
          id?: string
          image_tokens?: number | null
          input_tokens?: number | null
          model_used?: string | null
          output_tokens?: number | null
          prompt_used?: string | null
          source_urls?: string[] | null
          template_id?: string | null
          total_tokens?: number | null
        }
        Update: {
          blog_post_id?: string | null
          generated_at?: string | null
          id?: string
          image_tokens?: number | null
          input_tokens?: number | null
          model_used?: string | null
          output_tokens?: number | null
          prompt_used?: string | null
          source_urls?: string[] | null
          template_id?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_posts_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_posts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          is_default: boolean | null
          name: string
          required_fields: Json
          system_prompt: string
          updated_at: string | null
          user_prompt_template: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          name: string
          required_fields?: Json
          system_prompt: string
          updated_at?: string | null
          user_prompt_template: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          name?: string
          required_fields?: Json
          system_prompt?: string
          updated_at?: string | null
          user_prompt_template?: string
        }
        Relationships: []
      }
      application_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          level: string
          logged_at: string
          message: string
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          level: string
          logged_at?: string
          message: string
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          level?: string
          logged_at?: string
          message?: string
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      blog_post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          likes: number | null
          published: boolean
          published_at: string | null
          search_vector: unknown
          slug: string
          title: string
          updated_at: string
          views: number | null
        }
        Insert: {
          author_id?: string | null
          category: string
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          likes?: number | null
          published?: boolean
          published_at?: string | null
          search_vector?: unknown
          slug: string
          title: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          likes?: number | null
          published?: boolean
          published_at?: string | null
          search_vector?: unknown
          slug?: string
          title?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: []
      }
      blog_view_events: {
        Row: {
          id: string
          ip_hash: string | null
          post_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          post_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          post_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_view_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_links: {
        Row: {
          card_height: number | null
          card_width: number | null
          clicks: number | null
          color_gradient: string | null
          created_at: string | null
          display_order: number | null
          enabled: boolean | null
          event_id: string | null
          group_id: string | null
          icon: string | null
          id: string
          is_featured: boolean | null
          is_internal: boolean | null
          manual_order_override: boolean | null
          override_date: string | null
          override_time: string | null
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          card_height?: number | null
          card_width?: number | null
          clicks?: number | null
          color_gradient?: string | null
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean | null
          event_id?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_internal?: boolean | null
          manual_order_override?: boolean | null
          override_date?: string | null
          override_time?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          card_height?: number | null
          card_width?: number | null
          clicks?: number | null
          color_gradient?: string | null
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean | null
          event_id?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_internal?: boolean | null
          manual_order_override?: boolean | null
          override_date?: string | null
          override_time?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "link_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      egoi_config: {
        Row: {
          created_at: string
          default_event_template_id: string | null
          id: string
          is_enabled: boolean
          list_id: number | null
          mode: string
          scheduled_days_before: number | null
          segment_id: number | null
          sender_id: number | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_event_template_id?: string | null
          id?: string
          is_enabled?: boolean
          list_id?: number | null
          mode?: string
          scheduled_days_before?: number | null
          segment_id?: number | null
          sender_id?: number | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_event_template_id?: string | null
          id?: string
          is_enabled?: boolean
          list_id?: number | null
          mode?: string
          scheduled_days_before?: number | null
          segment_id?: number | null
          sender_id?: number | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "egoi_config_default_event_template_id_fkey"
            columns: ["default_event_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      egoi_resources_cache: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string
          lists: Json
          senders: Json
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string
          lists?: Json
          senders?: Json
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string
          lists?: Json
          senders?: Json
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      egress_metrics: {
        Row: {
          api_path: string
          cache_hits: number
          cache_misses: number
          created_at: string
          egress_bytes: number
          id: string
          period_start: string
          source: string
        }
        Insert: {
          api_path: string
          cache_hits?: number
          cache_misses?: number
          created_at?: string
          egress_bytes?: number
          id?: string
          period_start: string
          source?: string
        }
        Update: {
          api_path?: string
          cache_hits?: number
          cache_misses?: number
          created_at?: string
          egress_bytes?: number
          id?: string
          period_start?: string
          source?: string
        }
        Relationships: []
      }
      email_template_settings: {
        Row: {
          accent_color: string
          background_color: string
          brand_name: string
          created_at: string
          cta_label: string
          custom_html_footer: string | null
          custom_html_header: string | null
          footer_text: string
          id: string
          instagram_url: string | null
          logo_url: string | null
          primary_color: string
          secondary_link_label: string
          show_description: boolean
          show_secondary_link: boolean
          show_socials: boolean
          show_subtitle: boolean
          singleton: boolean
          tiktok_url: string | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string
          background_color?: string
          brand_name?: string
          created_at?: string
          cta_label?: string
          custom_html_footer?: string | null
          custom_html_header?: string | null
          footer_text?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_link_label?: string
          show_description?: boolean
          show_secondary_link?: boolean
          show_socials?: boolean
          show_subtitle?: boolean
          singleton?: boolean
          tiktok_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string
          background_color?: string
          brand_name?: string
          created_at?: string
          cta_label?: string
          custom_html_footer?: string | null
          custom_html_header?: string | null
          footer_text?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_link_label?: string
          show_description?: boolean
          show_secondary_link?: boolean
          show_socials?: boolean
          show_subtitle?: boolean
          singleton?: boolean
          tiktok_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          preheader_template: string | null
          subject_template: string | null
          type: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          preheader_template?: string | null
          subject_template?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          preheader_template?: string | null
          subject_template?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_email_campaigns: {
        Row: {
          created_at: string
          egoi_campaign_id: string | null
          error_message: string | null
          event_id: string
          id: string
          mode: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          egoi_campaign_id?: string | null
          error_message?: string | null
          event_id: string
          id?: string
          mode?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          egoi_campaign_id?: string | null
          error_message?: string | null
          event_id?: string
          id?: string
          mode?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_email_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slug_redirects: {
        Row: {
          created_at: string
          event_id: string
          old_slug: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          old_slug: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          old_slug?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_slug_redirects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          genres: string[] | null
          id: string
          image_url: string | null
          location_city: string
          location_state: string
          name: string
          subtitle: string | null
          ticket_link: string | null
          time: string | null
          title: string | null
          updated_at: string | null
          venue: string
          vip_link: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          location_city: string
          location_state: string
          name: string
          subtitle?: string | null
          ticket_link?: string | null
          time?: string | null
          title?: string | null
          updated_at?: string | null
          venue: string
          vip_link?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          location_city?: string
          location_state?: string
          name?: string
          subtitle?: string | null
          ticket_link?: string | null
          time?: string | null
          title?: string | null
          updated_at?: string | null
          venue?: string
          vip_link?: string | null
        }
        Relationships: []
      }
      event_view_events: {
        Row: {
          event_id: string
          id: string
          ip_hash: string | null
          viewed_at: string
        }
        Insert: {
          event_id: string
          id?: string
          ip_hash?: string | null
          viewed_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          ip_hash?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_view_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          ai_context: string | null
          blog_post_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          dispatch_email_on_save: boolean
          email_campaign_dispatched_at: string | null
          end_date: string | null
          end_time: string | null
          genres: string[]
          id: string
          image_url: string | null
          lineup: string[] | null
          location_city: string
          location_state: string
          merged_at: string | null
          merged_into_id: string | null
          pix_button_enabled: boolean
          schedule: Json | null
          slug: string
          status: string
          subtitle: string | null
          ticket_link: string | null
          tickets_per_day: boolean
          time: string | null
          title: string
          updated_at: string
          venue: string
          views: number | null
          vip_link: string | null
        }
        Insert: {
          address?: string | null
          ai_context?: string | null
          blog_post_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          dispatch_email_on_save?: boolean
          email_campaign_dispatched_at?: string | null
          end_date?: string | null
          end_time?: string | null
          genres?: string[]
          id?: string
          image_url?: string | null
          lineup?: string[] | null
          location_city: string
          location_state: string
          merged_at?: string | null
          merged_into_id?: string | null
          pix_button_enabled?: boolean
          schedule?: Json | null
          slug: string
          status?: string
          subtitle?: string | null
          ticket_link?: string | null
          tickets_per_day?: boolean
          time?: string | null
          title: string
          updated_at?: string
          venue: string
          views?: number | null
          vip_link?: string | null
        }
        Update: {
          address?: string | null
          ai_context?: string | null
          blog_post_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          dispatch_email_on_save?: boolean
          email_campaign_dispatched_at?: string | null
          end_date?: string | null
          end_time?: string | null
          genres?: string[]
          id?: string
          image_url?: string | null
          lineup?: string[] | null
          location_city?: string
          location_state?: string
          merged_at?: string | null
          merged_into_id?: string | null
          pix_button_enabled?: boolean
          schedule?: Json | null
          slug?: string
          status?: string
          subtitle?: string | null
          ticket_link?: string | null
          tickets_per_day?: boolean
          time?: string | null
          title?: string
          updated_at?: string
          venue?: string
          views?: number | null
          vip_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      image_hashes: {
        Row: {
          bucket: string
          created_at: string
          file_size: number | null
          hash: string
          url: string
        }
        Insert: {
          bucket: string
          created_at?: string
          file_size?: number | null
          hash: string
          url: string
        }
        Update: {
          bucket?: string
          created_at?: string
          file_size?: number | null
          hash?: string
          url?: string
        }
        Relationships: []
      }
      link_click_events: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          link_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          link_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_click_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "custom_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_groups: {
        Row: {
          created_at: string | null
          display_order: number | null
          enabled: boolean | null
          id: string
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      metrics_snapshots: {
        Row: {
          bunny: Json
          captured_at: string
          day: string
          supabase: Json
        }
        Insert: {
          bunny?: Json
          captured_at?: string
          day: string
          supabase?: Json
        }
        Update: {
          bunny?: Json
          captured_at?: string
          day?: string
          supabase?: Json
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          last_checked_at: string | null
          name: string
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_checked_at?: string | null
          name: string
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_checked_at?: string | null
          name?: string
          url?: string
        }
        Relationships: []
      }
      newsletter_popup_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          session_id: string | null
          user_fingerprint: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          session_id?: string | null
          user_fingerprint?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          session_id?: string | null
          user_fingerprint?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_popup_analytics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "newsletter_popup_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_popup_variants: {
        Row: {
          created_at: string | null
          delay_seconds: number | null
          description: string
          enabled: boolean | null
          id: string
          name: string
          scroll_percentage: number | null
          title: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          delay_seconds?: number | null
          description: string
          enabled?: boolean | null
          id?: string
          name: string
          scroll_percentage?: number | null
          title: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          delay_seconds?: number | null
          description?: string
          enabled?: boolean | null
          id?: string
          name?: string
          scroll_percentage?: number | null
          title?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmation_token: string | null
          confirmed: boolean | null
          email: string
          id: string
          source: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          confirmation_token?: string | null
          confirmed?: boolean | null
          email: string
          id?: string
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          confirmation_token?: string | null
          confirmed?: boolean | null
          email?: string
          id?: string
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          context: Json | null
          created_at: string
          duration_ms: number
          id: string
          measured_at: string
          name: string
          session_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          duration_ms: number
          id?: string
          measured_at?: string
          name: string
          session_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          duration_ms?: number
          id?: string
          measured_at?: string
          name?: string
          session_id?: string | null
        }
        Relationships: []
      }
      podcast_submissions: {
        Row: {
          admin_notes: string | null
          city: string
          created_at: string
          email: string
          full_name: string
          genre: string
          has_original_track: boolean | null
          id: string
          instagram: string | null
          notification_sent: boolean | null
          original_track_link: string | null
          phone: string
          project_age: string
          project_description: string
          project_name: string
          soundcloud: string | null
          spotify: string | null
          status: string
          tiktok: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          city: string
          created_at?: string
          email: string
          full_name: string
          genre: string
          has_original_track?: boolean | null
          id?: string
          instagram?: string | null
          notification_sent?: boolean | null
          original_track_link?: string | null
          phone: string
          project_age: string
          project_description: string
          project_name: string
          soundcloud?: string | null
          spotify?: string | null
          status?: string
          tiktok?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          genre?: string
          has_original_track?: boolean | null
          id?: string
          instagram?: string | null
          notification_sent?: boolean | null
          original_track_link?: string | null
          phone?: string
          project_age?: string
          project_description?: string
          project_name?: string
          soundcloud?: string | null
          spotify?: string | null
          status?: string
          tiktok?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_event_configs: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          end_time: string | null
          genres: string[] | null
          id: string
          image_url: string | null
          link_group_id: string | null
          location_city: string
          location_state: string
          name: string
          subtitle: string | null
          ticket_link: string | null
          time: string
          title: string
          updated_at: string | null
          venue: string
          vip_link: string | null
          weekday: number
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          end_time?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          link_group_id?: string | null
          location_city: string
          location_state: string
          name: string
          subtitle?: string | null
          ticket_link?: string | null
          time: string
          title: string
          updated_at?: string | null
          venue: string
          vip_link?: string | null
          weekday: number
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          end_time?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          link_group_id?: string | null
          location_city?: string
          location_state?: string
          name?: string
          subtitle?: string | null
          ticket_link?: string | null
          time?: string
          title?: string
          updated_at?: string | null
          venue?: string
          vip_link?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_event_configs_link_group_id_fkey"
            columns: ["link_group_id"]
            isOneToOne: false
            referencedRelation: "link_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      redirect_click_events: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          redirect_link_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          redirect_link_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          redirect_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirect_click_events_redirect_link_id_fkey"
            columns: ["redirect_link_id"]
            isOneToOne: false
            referencedRelation: "redirect_links"
            referencedColumns: ["id"]
          },
        ]
      }
      redirect_links: {
        Row: {
          clicks: number
          created_at: string
          description: string | null
          destination_url: string
          enabled: boolean
          id: string
          slug: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicks?: number
          created_at?: string
          description?: string | null
          destination_url: string
          enabled?: boolean
          id?: string
          slug: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicks?: number
          created_at?: string
          description?: string | null
          destination_url?: string
          enabled?: boolean
          id?: string
          slug?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      share_analytics: {
        Row: {
          id: string
          platform: string
          referrer: string | null
          shared_at: string | null
          url: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          platform: string
          referrer?: string | null
          shared_at?: string | null
          url: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          platform?: string
          referrer?: string | null
          shared_at?: string | null
          url?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          errors: Json | null
          id: string
          started_at: string
          status: string
          storage_files_synced: number | null
          tables_synced: Json | null
          total_records: number | null
          triggered_by: string | null
          warnings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          errors?: Json | null
          id?: string
          started_at?: string
          status: string
          storage_files_synced?: number | null
          tables_synced?: Json | null
          total_records?: number | null
          triggered_by?: string | null
          warnings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          errors?: Json | null
          id?: string
          started_at?: string
          status?: string
          storage_files_synced?: number | null
          tables_synced?: Json | null
          total_records?: number | null
          triggered_by?: string | null
          warnings?: Json | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean | null
          bio: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          instagram_url: string | null
          name: string
          position: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          name: string
          position: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          name?: string
          position?: string
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_egress: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      generate_slug: { Args: { text_input: string }; Returns: string }
      get_db_size: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_event_views: { Args: { event_id: string }; Returns: undefined }
      increment_link_clicks: { Args: { link_id: string }; Returns: undefined }
      increment_post_views: { Args: { post_id: string }; Returns: undefined }
      increment_redirect_clicks: {
        Args: { redirect_slug: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      is_valid_email: { Args: { email: string }; Returns: boolean }
      search_blog_posts: {
        Args: {
          category_filter?: string
          limit_results?: number
          offset_results?: number
          search_query: string
        }
        Returns: {
          category: string
          excerpt: string
          headline: string
          id: string
          image_url: string
          published_at: string
          rank: number
          slug: string
          title: string
        }[]
      }
      toggle_post_like: { Args: { post_id: string }; Returns: Json }
      user_liked_post: { Args: { post_id: string }; Returns: boolean }
      validate_slug: { Args: { input_slug: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
