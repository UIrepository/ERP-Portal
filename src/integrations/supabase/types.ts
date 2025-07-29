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
// ... (other types)
      feedback: {
        Row: {
          batch: string
          concept_clarity: number
          comments: string
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
          concept_clarity: number
          comments: string
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
          concept_clarity?: number
          comments?: string
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
// ... (other types remain the same)
      profiles: {
        Row: {
          bank_details: Json | null
          batch: string[] | null // Changed to string[]
          created_at: string
          email: string
          exams: string[] | null
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          subjects: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_details?: Json | null
          batch?: string[] | null // Changed to string[]
          created_at?: string
          email: string
          exams?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          subjects?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_details?: Json | null
          batch?: string[] | null // Changed to string[]
          created_at?: string
          email?: string
          exams?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          subjects?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
// ... (other types remain the same)
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
      dpp_content: {
        Row: {
          batch: string
          created_at: string
          id: string
          subject: string
          topic: string
          updated_at: string
          description?: string | null
          content?: string | null
          file_url?: string | null
        }
        Insert: {
          batch: string
          created_at?: string
          id?: string
          subject: string
          topic: string
          updated_at?: string
          description?: string | null
          content?: string | null
          file_url?: string | null
        }
        Update: {
          batch?: string
          created_at?: string
          id?: string
          subject?: string
          topic?: string
          updated_at?: string
          description?: string | null
          content?: string | null
          file_url?: string | null
        }
        Relationships: []
      }
      student_activities: {
        Row: {
          batch: string
          created_at: string
          id: string
          subject: string
          updated_at: string
          user_id: string
          activity_type: string
          description?: string | null
          metadata?: Json | null
        }
        Insert: {
          batch: string
          created_at?: string
          id?: string
          subject: string
          updated_at?: string
          user_id: string
          activity_type: string
          description?: string | null
          metadata?: Json | null
        }
        Update: {
          batch?: string
          created_at?: string
          id?: string
          subject?: string
          updated_at?: string
          user_id?: string
          activity_type?: string
          description?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
