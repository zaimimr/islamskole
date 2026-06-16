export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          age_max: number | null
          age_min: number | null
          capacity: number | null
          created_at: string
          curriculum_en: string | null
          curriculum_no: string | null
          description_en: string | null
          description_no: string | null
          id: string
          image_url: string | null
          name_en: string
          name_no: string
          price: number | null
          published: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string
          curriculum_en?: string | null
          curriculum_no?: string | null
          description_en?: string | null
          description_no?: string | null
          id?: string
          image_url?: string | null
          name_en: string
          name_no: string
          price?: number | null
          published?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string
          curriculum_en?: string | null
          curriculum_no?: string | null
          description_en?: string | null
          description_no?: string | null
          id?: string
          image_url?: string | null
          name_en?: string
          name_no?: string
          price?: number | null
          published?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          price_snapshot: number | null
          school_year_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          price_snapshot?: number | null
          school_year_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          price_snapshot?: number | null
          school_year_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          body_en: string | null
          body_no: string | null
          created_at: string
          ends_at: string | null
          excerpt_en: string | null
          excerpt_no: string | null
          id: string
          image_url: string | null
          location: string | null
          published: boolean
          slug: string
          starts_at: string | null
          title_en: string
          title_no: string
          updated_at: string
        }
        Insert: {
          body_en?: string | null
          body_no?: string | null
          created_at?: string
          ends_at?: string | null
          excerpt_en?: string | null
          excerpt_no?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          published?: boolean
          slug: string
          starts_at?: string | null
          title_en: string
          title_no: string
          updated_at?: string
        }
        Update: {
          body_en?: string | null
          body_no?: string | null
          created_at?: string
          ends_at?: string | null
          excerpt_en?: string | null
          excerpt_no?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          published?: boolean
          slug?: string
          starts_at?: string | null
          title_en?: string
          title_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      info_blocks: {
        Row: {
          body_en: string | null
          body_no: string | null
          id: string
          image_url: string | null
          key: string
          sort_order: number
          title_en: string | null
          title_no: string | null
          updated_at: string
        }
        Insert: {
          body_en?: string | null
          body_no?: string | null
          id?: string
          image_url?: string | null
          key: string
          sort_order?: number
          title_en?: string | null
          title_no?: string | null
          updated_at?: string
        }
        Update: {
          body_en?: string | null
          body_no?: string | null
          id?: string
          image_url?: string | null
          key?: string
          sort_order?: number
          title_en?: string | null
          title_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          captured_at: string | null
          created_at: string
          currency: string
          description: string | null
          enrollment_id: string | null
          id: string
          redirect_url: string | null
          reference: string
          school_year_id: string | null
          status: string
          student_id: string
          updated_at: string
          vipps_state: string | null
        }
        Insert: {
          amount: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          enrollment_id?: string | null
          id?: string
          redirect_url?: string | null
          reference: string
          school_year_id?: string | null
          status?: string
          student_id: string
          updated_at?: string
          vipps_state?: string | null
        }
        Update: {
          amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          enrollment_id?: string | null
          id?: string
          redirect_url?: string | null
          reference?: string
          school_year_id?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          vipps_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      school_years: {
        Row: {
          created_at: string
          ends_on: string | null
          fee: number | null
          id: string
          is_active: boolean
          label: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          fee?: number | null
          id?: string
          is_active?: boolean
          label: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          fee?: number | null
          id?: string
          is_active?: boolean
          label?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          address: string | null
          contact_email: string | null
          enroll_email: string | null
          facebook_url: string | null
          hours: string | null
          id: boolean
          instagram_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          enroll_email?: string | null
          facebook_url?: string | null
          hours?: string | null
          id?: boolean
          instagram_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          enroll_email?: string | null
          facebook_url?: string | null
          hours?: string | null
          id?: boolean
          instagram_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_applications: {
        Row: {
          birth_date: string | null
          child_age: number | null
          child_name: string
          created_at: string
          desired_class: string | null
          email: string
          guardian_name: string
          id: string
          level_arabic: string | null
          level_islam: string | null
          level_quran: string | null
          message: string | null
          phone: string | null
          status: string
        }
        Insert: {
          birth_date?: string | null
          child_age?: number | null
          child_name: string
          created_at?: string
          desired_class?: string | null
          email: string
          guardian_name: string
          id?: string
          level_arabic?: string | null
          level_islam?: string | null
          level_quran?: string | null
          message?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          birth_date?: string | null
          child_age?: number | null
          child_name?: string
          created_at?: string
          desired_class?: string | null
          email?: string
          guardian_name?: string
          id?: string
          level_arabic?: string | null
          level_islam?: string | null
          level_quran?: string | null
          message?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          application_id: string | null
          birth_date: string | null
          child_age: number | null
          created_at: string
          email: string | null
          full_name: string
          guardian_name: string
          guardian2_email: string | null
          guardian2_name: string | null
          guardian2_phone: string | null
          id: string
          level_arabic: string | null
          level_islam: string | null
          level_quran: string | null
          notes: string | null
          phone: string | null
          student_email: string | null
          student_phone: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          birth_date?: string | null
          child_age?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          guardian_name: string
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          id?: string
          level_arabic?: string | null
          level_islam?: string | null
          level_quran?: string | null
          notes?: string | null
          phone?: string | null
          student_email?: string | null
          student_phone?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          birth_date?: string | null
          child_age?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          guardian_name?: string
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          id?: string
          level_arabic?: string | null
          level_islam?: string | null
          level_quran?: string | null
          notes?: string | null
          phone?: string | null
          student_email?: string | null
          student_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_applications: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          status: string
          subjects: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: string
          subjects?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: string
          subjects?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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

