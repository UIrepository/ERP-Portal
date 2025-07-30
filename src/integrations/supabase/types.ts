export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
      chat_logs: {
        Row: {
          batch: string
          id: string
          message: string
          receiver_id: string | null
          sender_id: string | null
          subject: string
          timestamp: string
        }
        Insert: {
          batch: string
          id?: string
          message: string
          receiver_id?: string | null
          sender_id?: string | null
          subject: string
          timestamp?: string
        }
        Update: {
          batch?: string
          id?: string
          message?: string
          receiver_id?: string | null
          sender_id?: string | null
          subject?: string
          timestamp?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          batch: string
          created_at: string
          id: string
          message: string
          receiver_role: string
          sender_id: string
          sender_name: string
          subject: string
        }
        Insert: {
          batch: string
          created_at?: string
          id?: string
          message: string
          receiver_role: string
          sender_id: string
          sender_name: string
          subject: string
        }
        Update: {
          batch?: string
          created_at?: string
          id?: string
          message?: string
          receiver_role?: string
          sender_id?: string
          sender_name?: string
          subject?: string
        }
        Relationships: []
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
      extra_classes: {
        Row: {
          batch: string
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          link: string | null
          reason: string | null
          start_time: string
          subject: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          link?: string | null
          reason?: string | null
          start_time: string
          subject: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          link?: string | null
          reason?: string | null
          start_time?: string
          subject?: string
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
      founder_chat_messages: {
        Row: {
          created_at: string
          id: string
          is_from_student: boolean
          message: string
          student_batch: string
          student_id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_from_student?: boolean
          message: string
          student_batch: string
          student_id: string
          student_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_from_student?: boolean
          message?: string
          student_batch?: string
          student_id?: string
          student_name?: string
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
          id: string
          is_active: boolean
          message: string
          target_batch: string | null
          target_role: Database["public"]["Enums"]["user_role"] | null
          target_subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          target_batch?: string | null
          target_role?: Database["public"]["Enums"]["user_role"] | null
          target_subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          target_batch?: string | null
          target_role?: Database["public"]["Enums"]["user_role"] | null
          target_subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["user_role"]
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
          role?: Database["public"]["Enums"]["user_role"]
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
          role?: Database["public"]["Enums"]["user_role"]
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
      schedules: {
        Row: {
          batch: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          link: string | null
          start_time: string
          subject: string
          updated_at: string
        }
        Insert: {
          batch: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          link?: string | null
          start_time: string
          subject: string
          updated_at?: string
        }
        Update: {
          batch?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          link?: string | null
          start_time?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_schedule_meeting_link"
            columns: ["link"]
            isOneToOne: false
            referencedRelation: "meeting_links"
            referencedColumns: ["link"]
          },
        ]
      }
      student_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ui_ki_padhai_content: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          link: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link?: string
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
          user_id: string
        }
        Insert: {
          batch_name: string
          created_at?: string
          email?: string | null
          id?: string
          subject_name: string
          user_id: string
        }
        Update: {
          batch_name?: string
          created_at?: string
          email?: string | null
          id?: string
          subject_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          device_info: string | null
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          last_activity: string | null
          login_time: string | null
          user_id: string | null
        }
        Insert: {
          device_info?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          login_time?: string | null
          user_id?: string | null
        }
        Update: {
          device_info?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          login_time?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_options: {
        Args: Record<PropertyKey, never>
        Returns: {
          type: string
          name: string
        }[]
      }
      get_current_ongoing_class: {
        Args: { user_batch: string; user_subjects: string[] }
        Returns: {
          subject: string
          batch: string
          start_time: string
          end_time: string
          meeting_link: string
        }[]
      }
      get_current_user_batch: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_user_subjects: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_schedules_with_links_filtered_by_enrollment: {
        Args: {
          p_user_id: string
          p_day_of_week?: number
          p_current_time?: string
          p_is_active_link?: boolean
        }
        Returns: {
          id: string
          subject: string
          batch: string
          day_of_week: number
          start_time: string
          end_time: string
          link: string
          created_at: string
          updated_at: string
          meeting_link_url: string
        }[]
      }
      update_profile_allotment: {
        Args: {
          p_user_email: string
          p_new_batches: string[]
          p_new_subjects: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      exam_type: "mock" | "final" | "practice"
      user_role: "student" | "teacher" | "super_admin"
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
      user_role: ["student", "teacher", "super_admin"],
    },
  },
} as const
