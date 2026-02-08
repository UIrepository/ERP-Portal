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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      active_classes: {
        Row: {
          batch: string
          is_active: boolean | null
          room_url: string
          started_at: string | null
          subject: string
          teacher_id: string | null
        }
        Insert: {
          batch: string
          is_active?: boolean | null
          room_url: string
          started_at?: string | null
          subject: string
          teacher_id?: string | null
        }
        Update: {
          batch?: string
          is_active?: boolean | null
          room_url?: string
          started_at?: string | null
          subject?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          batch: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          resource_id: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          batch?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          batch?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      available_options: {
        Row: {
          created_at: string
          id: number
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          type?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          batch: string | null
          created_at: string | null
          id: string
          message: string
          receiver_role: string | null
          sender_id: string
          sender_name: string | null
          subject: string | null
        }
        Insert: {
          batch?: string | null
          created_at?: string | null
          id?: string
          message: string
          receiver_role?: string | null
          sender_id: string
          sender_name?: string | null
          subject?: string | null
        }
        Update: {
          batch?: string | null
          created_at?: string | null
          id?: string
          message?: string
          receiver_role?: string | null
          sender_id?: string
          sender_name?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          batch: string
          class_date: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          joined_at: string | null
          left_at: string | null
          schedule_id: string | null
          subject: string
          user_id: string
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          batch: string
          class_date?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          schedule_id?: string | null
          subject: string
          user_id: string
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          batch?: string
          class_date?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          schedule_id?: string | null
          subject?: string
          user_id?: string
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          batch: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_deleted: boolean | null
          is_priority: boolean | null
          reply_to_id: string | null
          subject: string
          user_id: string
        }
        Insert: {
          batch: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_priority?: boolean | null
          reply_to_id?: string | null
          subject: string
          user_id: string
        }
        Update: {
          batch?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_priority?: boolean | null
          reply_to_id?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          created_at: string | null
          id: number
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          context: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
          subject_context: string | null
        }
        Insert: {
          content: string
          context?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
          subject_context?: string | null
        }
        Update: {
          content?: string
          context?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
          subject_context?: string | null
        }
        Relationships: []
      }
      doubt_answers: {
        Row: {
          answer_text: string
          created_at: string
          doubt_id: string
          id: string
          user_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          doubt_id: string
          id?: string
          user_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          doubt_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_answers_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubt_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      doubts: {
        Row: {
          batch: string | null
          created_at: string
          id: string
          question_text: string
          recording_id: string
          subject: string | null
          user_id: string
        }
        Insert: {
          batch?: string | null
          created_at?: string
          id?: string
          question_text: string
          recording_id: string
          subject?: string | null
          user_id: string
        }
        Update: {
          batch?: string | null
          created_at?: string
          id?: string
          question_text?: string
          recording_id?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dpp_content: {
        Row: {
          batch: string
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          is_active: boolean
          link: string
          subject: string
          title: string
          updated_at: string | null
        }
        Insert: {
          batch: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_active?: boolean
          link: string
          subject: string
          title: string
          updated_at?: string | null
        }
        Update: {
          batch?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_active?: boolean
          link?: string
          subject?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          batch: string
          created_at: string
          date: string
          id: string
          name: string
          subject: string
          type: Database["public"]["Enums"]["exam_type"]
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          date: string
          id?: string
          name: string
          subject: string
          type: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          subject?: string
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          batch: string
          comments: string
          concept_clarity: number
          created_at: string
          date: string
          dpp_quality: number
          id: string
          premium_content_usefulness: number
          subject: string
          submitted_by: string | null
          teacher_quality: number
        }
        Insert: {
          batch: string
          comments: string
          concept_clarity: number
          created_at?: string
          date?: string
          dpp_quality: number
          id?: string
          premium_content_usefulness: number
          subject: string
          submitted_by?: string | null
          teacher_quality: number
        }
        Update: {
          batch?: string
          comments?: string
          concept_clarity?: number
          created_at?: string
          date?: string
          dpp_quality?: number
          id?: string
          premium_content_usefulness?: number
          subject?: string
          submitted_by?: string | null
          teacher_quality?: number
        }
        Relationships: []
      }
      google_groups: {
        Row: {
          batch_name: string
          created_at: string | null
          group_email: string
          id: string
          is_active: boolean | null
          subject_name: string | null
          updated_at: string | null
        }
        Insert: {
          batch_name: string
          created_at?: string | null
          group_email: string
          id?: string
          is_active?: boolean | null
          subject_name?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_name?: string
          created_at?: string | null
          group_email?: string
          id?: string
          is_active?: boolean | null
          subject_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      maintenance_settings: {
        Row: {
          id: string
          is_maintenance_mode: boolean
          maintenance_message: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_maintenance_mode?: boolean
          maintenance_message?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_maintenance_mode?: boolean
          maintenance_message?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      managers: {
        Row: {
          assigned_batches: string[] | null
          created_at: string | null
          email: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          assigned_batches?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          assigned_batches?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_links: {
        Row: {
          batch: string
          created_at: string | null
          is_active: boolean
          link: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          batch: string
          created_at?: string | null
          is_active?: boolean
          link: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          batch?: string
          created_at?: string | null
          is_active?: boolean
          link?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_likes: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notes: {
        Row: {
          batch: string
          created_at: string
          file_url: string
          filename: string
          id: string
          subject: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          file_url: string
          filename: string
          id?: string
          subject: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          file_url?: string
          filename?: string
          id?: string
          subject?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          is_active: boolean
          message: string
          target_batch: string | null
          target_role: Database["public"]["Enums"]["user_role"] | null
          target_subject: string | null
          target_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_active?: boolean
          message: string
          target_batch?: string | null
          target_role?: Database["public"]["Enums"]["user_role"] | null
          target_subject?: string | null
          target_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_active?: boolean
          message?: string
          target_batch?: string | null
          target_role?: Database["public"]["Enums"]["user_role"] | null
          target_subject?: string | null
          target_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          order_id: string
          payment_id: string | null
          payment_mode: string | null
          raw_response: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          order_id: string
          payment_id?: string | null
          payment_mode?: string | null
          raw_response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          order_id?: string
          payment_id?: string | null
          payment_mode?: string | null
          raw_response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bank_details: Json | null
          batch: string[] | null
          created_at: string
          email: string
          exams: string[] | null
          id: string
          is_active: boolean
          name: string
          premium_access: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          subjects: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_details?: Json | null
          batch?: string[] | null
          created_at?: string
          email: string
          exams?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          premium_access?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_details?: Json | null
          batch?: string[] | null
          created_at?: string
          email?: string
          exams?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          premium_access?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          batch: string
          created_at: string
          date: string
          embed_link: string
          id: string
          subject: string
          topic: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          date: string
          embed_link: string
          id?: string
          subject: string
          topic: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          date?: string
          embed_link?: string
          id?: string
          subject?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_requests: {
        Row: {
          batch: string
          created_at: string | null
          id: string
          new_date: string
          new_end_time: string
          new_start_time: string
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["schedule_request_status"] | null
          subject: string
        }
        Insert: {
          batch: string
          created_at?: string | null
          id?: string
          new_date: string
          new_end_time: string
          new_start_time: string
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["schedule_request_status"] | null
          subject: string
        }
        Update: {
          batch?: string
          created_at?: string | null
          id?: string
          new_date?: string
          new_end_time?: string
          new_start_time?: string
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["schedule_request_status"] | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_requests_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          batch: string
          created_at: string
          date: string | null
          day_of_week: number
          end_time: string
          id: string
          link: string | null
          start_time: string
          stream_key: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          date?: string | null
          day_of_week: number
          end_time: string
          id?: string
          link?: string | null
          start_time: string
          stream_key?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          date?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          link?: string | null
          start_time?: string
          stream_key?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_activities: {
        Row: {
          activity_type: string
          batch: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          subject: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          batch?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          subject?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          batch?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          assigned_batches: string[] | null
          assigned_subjects: string[] | null
          created_at: string | null
          email: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          assigned_batches?: string[] | null
          assigned_subjects?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          assigned_batches?: string[] | null
          assigned_subjects?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ui_ki_padhai_content: {
        Row: {
          batch: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          link: string
          subject: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          batch?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link: string
          subject?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          batch?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link?: string
          subject?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_enrollments: {
        Row: {
          batch_name: string
          created_at: string
          email: string | null
          id: string
          subject_name: string
          user_id: string | null
        }
        Insert: {
          batch_name: string
          created_at?: string
          email?: string | null
          id?: string
          subject_name: string
          user_id?: string | null
        }
        Update: {
          batch_name?: string
          created_at?: string
          email?: string | null
          id?: string
          subject_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          device_info: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_activity: string | null
          login_time: string | null
          user_id: string | null
        }
        Insert: {
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          login_time?: string | null
          user_id?: string | null
        }
        Update: {
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          login_time?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      verified_maintenance_users: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          last_watched_at: string
          progress_seconds: number
          recording_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_watched_at?: string
          progress_seconds?: number
          recording_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_watched_at?: string
          progress_seconds?: number
          recording_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_is_admin: { Args: never; Returns: boolean }
      backfill_role_table_user_ids: {
        Args: never
        Returns: {
          email: string
          status: string
          table_name: string
          user_id: string
        }[]
      }
      check_is_admin_or_manager: { Args: never; Returns: boolean }
      check_user_role_sync: { Args: never; Returns: Json }
      delete_expired_chat_images: { Args: never; Returns: undefined }
      get_all_options: {
        Args: never
        Returns: {
          name: string
          type: string
        }[]
      }
      get_current_ongoing_class: {
        Args: { user_batch: string; user_subjects: string[] }
        Returns: {
          batch: string
          end_time: string
          meeting_link: string
          start_time: string
          subject: string
        }[]
      }
      get_current_user_batch: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_user_subjects: { Args: never; Returns: string[] }
      get_manager_batches: {
        Args: { check_user_id?: string }
        Returns: string[]
      }
      get_schedules_with_links_filtered_by_enrollment: {
        Args: {
          p_current_time?: string
          p_day_of_week?: number
          p_is_active_link?: boolean
          p_target_date?: string
          p_user_id: string
        }
        Returns: {
          batch: string
          created_at: string
          date: string
          day_of_week: number
          end_time: string
          id: string
          link: string
          meeting_link_url: string
          start_time: string
          subject: string
          updated_at: string
        }[]
      }
      get_teacher_batches: {
        Args: { check_user_id?: string }
        Returns: string[]
      }
      get_teacher_subjects: {
        Args: { check_user_id?: string }
        Returns: string[]
      }
      get_upcoming_classes_for_teacher: {
        Args: { p_user_id: string }
        Returns: {
          batch: string
          created_at: string
          date: string | null
          day_of_week: number
          end_time: string
          id: string
          link: string | null
          start_time: string
          stream_key: string | null
          subject: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_role_from_tables: {
        Args: { check_user_id?: string }
        Returns: string
      }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_manager: { Args: { check_user_id?: string }; Returns: boolean }
      is_teacher: { Args: { check_user_id?: string }; Returns: boolean }
      update_profile_allotment: {
        Args: {
          p_new_batches: string[]
          p_new_subjects: string[]
          p_user_email: string
        }
        Returns: undefined
      }
    }
    Enums: {
      exam_type: "mock" | "final" | "practice"
      schedule_request_status: "pending" | "approved" | "rejected"
      user_role: "student" | "super_admin" | "manager" | "admin"
      user_role_old: "student" | "teacher" | "super_admin"
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
      exam_type: ["mock", "final", "practice"],
      schedule_request_status: ["pending", "approved", "rejected"],
      user_role: ["student", "super_admin", "manager", "admin"],
      user_role_old: ["student", "teacher", "super_admin"],
    },
  },
} as const
