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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ambassadors: {
        Row: {
          created_at: string
          id: string
          onboarding_step: number | null
          referral_code: string | null
          social_posts_completed: number | null
          status: string | null
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_step?: number | null
          referral_code?: string | null
          social_posts_completed?: number | null
          status?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_step?: number | null
          referral_code?: string | null
          social_posts_completed?: number | null
          status?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: string
          content_url: string | null
          created_at: string | null
          deleted_at: string | null
          encryption_key_id: string | null
          generation_params: Json | null
          id: string
          job_id: string | null
          job_status: string | null
          metadata: Json | null
          parent_id: string | null
          prompt: string | null
          source_script_id: string | null
          source_voice_id: string | null
          system_prompt: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          asset_type: string
          content_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_id?: string | null
          generation_params?: Json | null
          id?: string
          job_id?: string | null
          job_status?: string | null
          metadata?: Json | null
          parent_id?: string | null
          prompt?: string | null
          source_script_id?: string | null
          source_voice_id?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          asset_type?: string
          content_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_id?: string | null
          generation_params?: Json | null
          id?: string
          job_id?: string | null
          job_status?: string | null
          metadata?: Json | null
          parent_id?: string | null
          prompt?: string | null
          source_script_id?: string | null
          source_voice_id?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_source_script_id_fkey"
            columns: ["source_script_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_source_voice_id_fkey"
            columns: ["source_voice_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bootcamp_progress: {
        Row: {
          bootcamp_id: string | null
          completed_at: string | null
          current_lesson_index: number | null
          id: string
          last_accessed_at: string | null
          lessons_completed: number | null
          lessons_skipped: number | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          bootcamp_id?: string | null
          completed_at?: string | null
          current_lesson_index?: number | null
          id?: string
          last_accessed_at?: string | null
          lessons_completed?: number | null
          lessons_skipped?: number | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          bootcamp_id?: string | null
          completed_at?: string | null
          current_lesson_index?: number | null
          id?: string
          last_accessed_at?: string | null
          lessons_completed?: number | null
          lessons_skipped?: number | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bootcamp_progress_bootcamp_id_fkey"
            columns: ["bootcamp_id"]
            isOneToOne: false
            referencedRelation: "bootcamps"
            referencedColumns: ["id"]
          },
        ]
      }
      bootcamps: {
        Row: {
          access_level: string | null
          bootcamp_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          lesson_count: number | null
          slug: string
          thumbnail_url: string | null
          title: string
          total_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          bootcamp_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          lesson_count?: number | null
          slug: string
          thumbnail_url?: string | null
          title: string
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          bootcamp_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          lesson_count?: number | null
          slug?: string
          thumbnail_url?: string | null
          title?: string
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_blueprints: {
        Row: {
          brand_tone: string | null
          business_name: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          industry_niche: string | null
          raw_genie_output: Json | null
          target_audience: string | null
          updated_at: string | null
          user_id: string | null
          uvp: string | null
        }
        Insert: {
          brand_tone?: string | null
          business_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          industry_niche?: string | null
          raw_genie_output?: Json | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
          uvp?: string | null
        }
        Update: {
          brand_tone?: string | null
          business_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          industry_niche?: string | null
          raw_genie_output?: Json | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
          uvp?: string | null
        }
        Relationships: []
      }
      cms_notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          ambassador_id: string
          amount: number
          created_at: string
          currency: string | null
          id: string
          referral_id: string | null
          status: string | null
          stripe_transfer_id: string | null
          type: string | null
        }
        Insert: {
          ambassador_id: string
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          referral_id?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          type?: string | null
        }
        Update: {
          ambassador_id?: string
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          referral_id?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      content_distribution_queue: {
        Row: {
          asset_id: string | null
          created_at: string | null
          id: string
          platform_targets: Json
          result_logs: Json | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          id?: string
          platform_targets: Json
          result_logs?: Json | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          id?: string
          platform_targets?: Json
          result_logs?: Json | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_distribution_queue_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_artifacts: {
        Row: {
          artifact_type: string
          content: Json
          created_at: string | null
          id: string
          metadata: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          artifact_type: string
          content: Json
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          artifact_type?: string
          content?: Json
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      engagement_logs: {
        Row: {
          created_at: string | null
          generation_id: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          generation_id: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          generation_id?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_logs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "prompt_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_logs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_logs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_logs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_week"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      general_storage: {
        Row: {
          category: string
          created_at: string | null
          data: Json
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          data?: Json
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          data?: Json
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      instructor_bootcamps: {
        Row: {
          created_at: string
          description: string | null
          featured_image_url: string | null
          id: string
          notify_enabled: boolean | null
          slug: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          featured_image_url?: string | null
          id?: string
          notify_enabled?: boolean | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          featured_image_url?: string | null
          id?: string
          notify_enabled?: boolean | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_content_progress: {
        Row: {
          content_id: string
          id: string
          is_completed: boolean | null
          lesson_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_id: string
          id?: string
          is_completed?: boolean | null
          lesson_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
          id?: string
          is_completed?: boolean | null
          lesson_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_content_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_contents: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          is_published: boolean | null
          lesson_id: string
          order_index: number
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id: string
          order_index?: number
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string
          order_index?: number
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_contents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          bootcamp_id: string | null
          completed_at: string | null
          created_at: string | null
          generation_id: string | null
          id: string
          lesson_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bootcamp_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          generation_id?: string | null
          id?: string
          lesson_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bootcamp_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          generation_id?: string | null
          id?: string
          lesson_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_bootcamp_id_fkey"
            columns: ["bootcamp_id"]
            isOneToOne: false
            referencedRelation: "bootcamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_video_progress: {
        Row: {
          id: string
          is_completed: boolean | null
          lesson_id: string
          updated_at: string | null
          user_id: string
          video_index: number
        }
        Insert: {
          id?: string
          is_completed?: boolean | null
          lesson_id: string
          updated_at?: string | null
          user_id: string
          video_index: number
        }
        Update: {
          id?: string
          is_completed?: boolean | null
          lesson_id?: string
          updated_at?: string | null
          user_id?: string
          video_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_video_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_videos: {
        Row: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean | null
          lesson_id: string
          order_index: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          lesson_id: string
          order_index?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string
          order_index?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_videos_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          auto_save_output: boolean | null
          bootcamp_id: string | null
          content_type: string | null
          create_action_description: string | null
          create_action_label: string | null
          create_action_payload: Json
          create_action_type: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          learning_objective: string | null
          order_index: number
          slug: string
          text_content: string | null
          title: string
          updated_at: string | null
          video_count: number | null
          video_url: string | null
        }
        Insert: {
          auto_save_output?: boolean | null
          bootcamp_id?: string | null
          content_type?: string | null
          create_action_description?: string | null
          create_action_label?: string | null
          create_action_payload?: Json
          create_action_type: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          learning_objective?: string | null
          order_index?: number
          slug: string
          text_content?: string | null
          title: string
          updated_at?: string | null
          video_count?: number | null
          video_url?: string | null
        }
        Update: {
          auto_save_output?: boolean | null
          bootcamp_id?: string | null
          content_type?: string | null
          create_action_description?: string | null
          create_action_label?: string | null
          create_action_payload?: Json
          create_action_type?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          learning_objective?: string | null
          order_index?: number
          slug?: string
          text_content?: string | null
          title?: string
          updated_at?: string | null
          video_count?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_bootcamp_id_fkey"
            columns: ["bootcamp_id"]
            isOneToOne: false
            referencedRelation: "bootcamps"
            referencedColumns: ["id"]
          },
        ]
      }
      media_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_video_asset_id: string | null
          input_voice_id: string | null
          job_type: string
          progress_percent: number | null
          provider: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_video_asset_id?: string | null
          input_voice_id?: string | null
          job_type: string
          progress_percent?: number | null
          provider: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_video_asset_id?: string | null
          input_voice_id?: string | null
          job_type?: string
          progress_percent?: number | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_jobs_input_voice_id_fkey"
            columns: ["input_voice_id"]
            isOneToOne: false
            referencedRelation: "voices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_events: {
        Row: {
          bootcamp_id: string | null
          created_at: string | null
          event_type: string
          generation_id: string | null
          id: string
          lesson_id: string | null
          payload: Json | null
          user_id: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          bootcamp_id?: string | null
          created_at?: string | null
          event_type: string
          generation_id?: string | null
          id?: string
          lesson_id?: string | null
          payload?: Json | null
          user_id: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          bootcamp_id?: string | null
          created_at?: string | null
          event_type?: string
          generation_id?: string | null
          id?: string
          lesson_id?: string | null
          payload?: Json | null
          user_id?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_events_bootcamp_id_fkey"
            columns: ["bootcamp_id"]
            isOneToOne: false
            referencedRelation: "bootcamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "notebook_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_chats: {
        Row: {
          created_at: string | null
          folder_id: string | null
          id: string
          summary: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_chats_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notebook_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notebook_notes: {
        Row: {
          content: string | null
          created_at: string | null
          folder_id: string | null
          id: string
          is_pinned: boolean | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_pinned?: boolean | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          folder_id?: string | null
          id?: string
          is_pinned?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pack_tag_map: {
        Row: {
          pack_id: string
          tag_id: string
        }
        Insert: {
          pack_id: string
          tag_id: string
        }
        Update: {
          pack_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_tag_map_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "template_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "pack_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      packs: {
        Row: {
          banner_image_url: string | null
          created_at: string
          featured_image_url: string | null
          featured_rank: number
          id: string
          industry: string | null
          is_featured: boolean
          long_description: string | null
          name: string
          outcomes: string[] | null
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          created_at?: string
          featured_image_url?: string | null
          featured_rank?: number
          id?: string
          industry?: string | null
          is_featured?: boolean
          long_description?: string | null
          name: string
          outcomes?: string[] | null
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          created_at?: string
          featured_image_url?: string | null
          featured_rank?: number
          id?: string
          industry?: string | null
          is_featured?: boolean
          long_description?: string | null
          name?: string
          outcomes?: string[] | null
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_recharge_enabled: boolean | null
          auto_recharge_pack_id: string | null
          auto_recharge_threshold: number | null
          created_at: string
          credits: number | null
          current_period_end: string | null
          discord_user_id: string | null
          email: string | null
          full_name: string | null
          intent: string | null
          is_approved: boolean
          last_activity_date: string | null
          metadata: Json | null
          onboarding_completed: boolean | null
          onboarding_responses: Json | null
          plan: string
          price_id: string | null
          profile_image: string | null
          role: string
          staff_approved: boolean
          staff_pro: boolean
          streak_days: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
          username: string | null
          xp: number | null
        }
        Insert: {
          auto_recharge_enabled?: boolean | null
          auto_recharge_pack_id?: string | null
          auto_recharge_threshold?: number | null
          created_at?: string
          credits?: number | null
          current_period_end?: string | null
          discord_user_id?: string | null
          email?: string | null
          full_name?: string | null
          intent?: string | null
          is_approved?: boolean
          last_activity_date?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_responses?: Json | null
          plan?: string
          price_id?: string | null
          profile_image?: string | null
          role?: string
          staff_approved?: boolean
          staff_pro?: boolean
          streak_days?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          xp?: number | null
        }
        Update: {
          auto_recharge_enabled?: boolean | null
          auto_recharge_pack_id?: string | null
          auto_recharge_threshold?: number | null
          created_at?: string
          credits?: number | null
          current_period_end?: string | null
          discord_user_id?: string | null
          email?: string | null
          full_name?: string | null
          intent?: string | null
          is_approved?: boolean
          last_activity_date?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_responses?: Json | null
          plan?: string
          price_id?: string | null
          profile_image?: string | null
          role?: string
          staff_approved?: boolean
          staff_pro?: boolean
          streak_days?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      prompt_favorites: {
        Row: {
          created_at: string | null
          folder_id: string | null
          generation_id: string | null
          id: string
          prompt_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          generation_id?: string | null
          id?: string
          prompt_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          generation_id?: string | null
          id?: string
          prompt_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_favorites_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "prompt_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_week"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_favorites_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_generations: {
        Row: {
          combined_prompt: string | null
          combined_prompt_text: string | null
          created_at: string
          favorites_count: number | null
          folder_id: string | null
          id: string
          image_url: string
          is_public: boolean | null
          original_prompt: string | null
          original_prompt_text: string | null
          parent_id: string | null
          prompt_id: string | null
          prompt_slug: string | null
          remix_additions: string | null
          remix_count: number | null
          remix_prompt_text: string | null
          settings: Json
          upvotes_count: number | null
          user_id: string
        }
        Insert: {
          combined_prompt?: string | null
          combined_prompt_text?: string | null
          created_at?: string
          favorites_count?: number | null
          folder_id?: string | null
          id?: string
          image_url: string
          is_public?: boolean | null
          original_prompt?: string | null
          original_prompt_text?: string | null
          parent_id?: string | null
          prompt_id?: string | null
          prompt_slug?: string | null
          remix_additions?: string | null
          remix_count?: number | null
          remix_prompt_text?: string | null
          settings?: Json
          upvotes_count?: number | null
          user_id: string
        }
        Update: {
          combined_prompt?: string | null
          combined_prompt_text?: string | null
          created_at?: string
          favorites_count?: number | null
          folder_id?: string | null
          id?: string
          image_url?: string
          is_public?: boolean | null
          original_prompt?: string | null
          original_prompt_text?: string | null
          parent_id?: string | null
          prompt_id?: string | null
          prompt_slug?: string | null
          remix_additions?: string | null
          remix_count?: number | null
          remix_prompt_text?: string | null
          settings?: Json
          upvotes_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "prompt_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "trending_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "trending_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "trending_week"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          access_level: string
          approved_by: string | null
          aspect_ratios: string[] | null
          author_id: string | null
          category: string | null
          content: string | null
          created_at: string
          description: string | null
          edit_mode: string | null
          editable_fields: Json | null
          editor_pick: boolean | null
          featured: boolean | null
          featured_image_url: string | null
          id: string
          image_url: string | null
          industry: string | null
          internal_template_recipe: string | null
          is_editors_choice: boolean
          is_featured: boolean | null
          is_published: boolean | null
          is_trending: boolean
          media_type: string
          media_url: string | null
          outcome: string | null
          pack_id: string | null
          pack_only: boolean | null
          pack_order_index: number | null
          preview_image_alt: string | null
          preview_image_storage_path: string | null
          prompt: string | null
          prompt_text: string
          public_prompt: string | null
          published_at: string | null
          remix_placeholder: string | null
          required_elements: string[] | null
          required_visual_elements: string[] | null
          reviewed_by: string | null
          slug: string
          status: string
          style_mode: string | null
          subject_mode: string | null
          submitted_at: string | null
          summary: string | null
          system_rules: string | null
          tags: string[] | null
          template_config_json: Json | null
          template_description: string | null
          template_id: string | null
          template_name: string | null
          template_pack_id: string | null
          title: string
          updated_at: string
          user_id: string | null
          view_count: number | null
          visibility: string | null
        }
        Insert: {
          access_level?: string
          approved_by?: string | null
          aspect_ratios?: string[] | null
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          edit_mode?: string | null
          editable_fields?: Json | null
          editor_pick?: boolean | null
          featured?: boolean | null
          featured_image_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          internal_template_recipe?: string | null
          is_editors_choice?: boolean
          is_featured?: boolean | null
          is_published?: boolean | null
          is_trending?: boolean
          media_type?: string
          media_url?: string | null
          outcome?: string | null
          pack_id?: string | null
          pack_only?: boolean | null
          pack_order_index?: number | null
          preview_image_alt?: string | null
          preview_image_storage_path?: string | null
          prompt?: string | null
          prompt_text?: string
          public_prompt?: string | null
          published_at?: string | null
          remix_placeholder?: string | null
          required_elements?: string[] | null
          required_visual_elements?: string[] | null
          reviewed_by?: string | null
          slug: string
          status?: string
          style_mode?: string | null
          subject_mode?: string | null
          submitted_at?: string | null
          summary?: string | null
          system_rules?: string | null
          tags?: string[] | null
          template_config_json?: Json | null
          template_description?: string | null
          template_id?: string | null
          template_name?: string | null
          template_pack_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Update: {
          access_level?: string
          approved_by?: string | null
          aspect_ratios?: string[] | null
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          edit_mode?: string | null
          editable_fields?: Json | null
          editor_pick?: boolean | null
          featured?: boolean | null
          featured_image_url?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          internal_template_recipe?: string | null
          is_editors_choice?: boolean
          is_featured?: boolean | null
          is_published?: boolean | null
          is_trending?: boolean
          media_type?: string
          media_url?: string | null
          outcome?: string | null
          pack_id?: string | null
          pack_only?: boolean | null
          pack_order_index?: number | null
          preview_image_alt?: string | null
          preview_image_storage_path?: string | null
          prompt?: string | null
          prompt_text?: string
          public_prompt?: string | null
          published_at?: string | null
          remix_placeholder?: string | null
          required_elements?: string[] | null
          required_visual_elements?: string[] | null
          reviewed_by?: string | null
          slug?: string
          status?: string
          style_mode?: string | null
          subject_mode?: string | null
          submitted_at?: string | null
          summary?: string | null
          system_rules?: string | null
          tags?: string[] | null
          template_config_json?: Json | null
          template_description?: string | null
          template_id?: string | null
          template_name?: string | null
          template_pack_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_template_pack_id_fkey"
            columns: ["template_pack_id"]
            isOneToOne: false
            referencedRelation: "template_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          ambassador_id: string
          conversion_date: string | null
          created_at: string
          id: string
          referred_user_id: string
          status: string | null
        }
        Insert: {
          ambassador_id: string
          conversion_date?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          status?: string | null
        }
        Update: {
          ambassador_id?: string
          conversion_date?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
        ]
      }
      remix_upvotes: {
        Row: {
          created_at: string | null
          generation_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remix_upvotes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "prompt_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remix_upvotes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remix_upvotes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remix_upvotes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "trending_week"
            referencedColumns: ["id"]
          },
        ]
      }
      remixes: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          id: string
          image_url: string
          prompt_id: string
          prompt_slug: string
          remix_text: string | null
          storage_path: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          image_url: string
          prompt_id: string
          prompt_slug: string
          remix_text?: string | null
          storage_path?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          image_url?: string
          prompt_id?: string
          prompt_slug?: string
          remix_text?: string | null
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remixes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remixes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remixes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string | null
          description: string | null
          downloads_count: number | null
          file_size_bytes: number | null
          id: string
          is_public: boolean | null
          title: string
          type: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          downloads_count?: number | null
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean | null
          title: string
          type?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          downloads_count?: number | null
          file_size_bytes?: number | null
          id?: string
          is_public?: boolean | null
          title?: string
          type?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          asset_id: string | null
          asset_url: string
          caption: string | null
          created_at: string
          id: string
          platform_responses: Json | null
          platforms: Json
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          asset_id?: string | null
          asset_url: string
          caption?: string | null
          created_at?: string
          id?: string
          platform_responses?: Json | null
          platforms?: Json
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          asset_id?: string | null
          asset_url?: string
          caption?: string | null
          created_at?: string
          id?: string
          platform_responses?: Json | null
          platforms?: Json
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string
          account_id: string
          account_name: string | null
          created_at: string
          id: string
          platform: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string | null
          created_at?: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string | null
          created_at?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      studio_prompts: {
        Row: {
          aspect_ratio: string | null
          combined_prompt_text: string | null
          created_at: string
          id: string
          media_type: string | null
          original_prompt_text: string | null
          preview_image_url: string | null
          prompt: string
          remix_prompt_text: string | null
          settings: Json | null
          title: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          combined_prompt_text?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          original_prompt_text?: string | null
          preview_image_url?: string | null
          prompt: string
          remix_prompt_text?: string | null
          settings?: Json | null
          title?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          combined_prompt_text?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          original_prompt_text?: string | null
          preview_image_url?: string | null
          prompt?: string
          remix_prompt_text?: string | null
          settings?: Json | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      template_pack_items: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          sort_index: number | null
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          sort_index?: number | null
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          sort_index?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "template_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_pack_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_pack_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_pack_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      template_packs: {
        Row: {
          access_level: string | null
          category: string | null
          created_at: string | null
          difficulty: string | null
          drop_announcement: Json | null
          featured_image_url: string | null
          id: string
          is_published: boolean | null
          pack_description: string | null
          pack_id: string
          pack_name: string
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          summary: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          access_level?: string | null
          category?: string | null
          created_at?: string | null
          difficulty?: string | null
          drop_announcement?: Json | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean | null
          pack_description?: string | null
          pack_id: string
          pack_name: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          access_level?: string | null
          category?: string | null
          created_at?: string | null
          difficulty?: string | null
          drop_announcement?: Json | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean | null
          pack_description?: string | null
          pack_id?: string
          pack_name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          asset_id: string | null
          created_at: string | null
          duration_seconds: number | null
          estimated_cost_usd: number | null
          id: string
          meta: Json | null
          model_name: string
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          estimated_cost_usd?: number | null
          id?: string
          meta?: Json | null
          model_name: string
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          estimated_cost_usd?: number | null
          id?: string
          meta?: Json | null
          model_name?: string
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_identities: {
        Row: {
          consent_granted_at: string | null
          created_at: string | null
          deleted_at: string | null
          face_vector_id: string | null
          id: string
          identity_type: string | null
          is_active: boolean | null
          is_primary: boolean | null
          metadata: Json | null
          ref_image_url: string
          user_id: string | null
        }
        Insert: {
          consent_granted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          face_vector_id?: string | null
          id?: string
          identity_type?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          metadata?: Json | null
          ref_image_url: string
          user_id?: string | null
        }
        Update: {
          consent_granted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          face_vector_id?: string | null
          id?: string
          identity_type?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          metadata?: Json | null
          ref_image_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      video_favorites: {
        Row: {
          created_at: string | null
          folder_id: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_favorites_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_generations: {
        Row: {
          created_at: string | null
          dialogue: string | null
          id: string
          is_public: boolean | null
          parent_generation_id: string | null
          prompt: string | null
          prompt_id: string | null
          source_image_id: string | null
          status: string | null
          thumbnail_url: string | null
          upvotes_count: number | null
          user_id: string
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          created_at?: string | null
          dialogue?: string | null
          id?: string
          is_public?: boolean | null
          parent_generation_id?: string | null
          prompt?: string | null
          prompt_id?: string | null
          source_image_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          upvotes_count?: number | null
          user_id: string
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          created_at?: string | null
          dialogue?: string | null
          id?: string
          is_public?: boolean | null
          parent_generation_id?: string | null
          prompt?: string | null
          prompt_id?: string | null
          source_image_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          upvotes_count?: number | null
          user_id?: string
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_generations_parent_generation_id_fkey"
            columns: ["parent_generation_id"]
            isOneToOne: false
            referencedRelation: "video_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "prompt_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "trending_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "trending_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "trending_week"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generations_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "voices"
            referencedColumns: ["id"]
          },
        ]
      }
      video_upvotes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_upvotes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      voices: {
        Row: {
          created_at: string
          id: string
          name: string
          preview_audio_url: string | null
          provider: string
          provider_voice_id: string
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          preview_audio_url?: string | null
          provider: string
          provider_voice_id: string
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          preview_audio_url?: string | null
          provider?: string
          provider_voice_id?: string
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      cms_prompt_queue: {
        Row: {
          author_id: string | null
          created_at: string | null
          id: string | null
          slug: string | null
          status: string | null
          submitted_at: string | null
          title: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          id?: string | null
          slug?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          id?: string | null
          slug?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      prompts_public: {
        Row: {
          access_level: string | null
          category: string | null
          created_at: string | null
          featured_image_url: string | null
          id: string | null
          image_url: string | null
          is_published: boolean | null
          media_url: string | null
          pack_name: string | null
          pack_order_index: number | null
          pack_slug: string | null
          slug: string | null
          status: string | null
          summary: string | null
          template_pack_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_template_pack_id_fkey"
            columns: ["template_pack_id"]
            isOneToOne: false
            referencedRelation: "template_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_generations: {
        Row: {
          created_at: string | null
          favorites_count: number | null
          id: string | null
          image_url: string | null
          prompt_id: string | null
          remix_count: number | null
          trending_score: number | null
          upvotes_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_today: {
        Row: {
          created_at: string | null
          favorites_count: number | null
          id: string | null
          image_url: string | null
          prompt_id: string | null
          remix_count: number | null
          trending_score: number | null
          upvotes_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_week: {
        Row: {
          created_at: string | null
          favorites_count: number | null
          id: string | null
          image_url: string | null
          prompt_id: string | null
          remix_count: number | null
          trending_score: number | null
          upvotes_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          favorites_count?: number | null
          id?: string | null
          image_url?: string | null
          prompt_id?: string | null
          remix_count?: number | null
          trending_score?: never
          upvotes_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "cms_prompt_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_publish: { Args: never; Returns: boolean }
      check_username_available: {
        Args: { requested_username: string }
        Returns: boolean
      }
      current_role: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      get_blueprint_context: { Args: { p_user_id: string }; Returns: string }
      is_admin_or_higher:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      is_admin_plus: { Args: never; Returns: boolean }
      is_editor_or_higher:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      is_editor_plus: { Args: never; Returns: boolean }
      is_staff_or_higher:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      is_staff_plus: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_has_pro_access: { Args: { uid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
