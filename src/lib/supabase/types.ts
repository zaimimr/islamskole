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
      families: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          display_name: string | null
          id: string
          origin: string
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          origin?: string
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          origin?: string
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      family_data_reviews: {
        Row: {
          category: string
          created_at: string
          details: Json
          family_id: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          source_entity: string | null
          source_entity_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json
          family_id: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_entity?: string | null
          source_entity_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json
          family_id?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_entity?: string | null
          source_entity_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_data_reviews_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_data_reviews_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_guardians: {
        Row: {
          created_at: string
          family_id: string
          guardian_id: string
          is_billing_contact: boolean
          is_primary_contact: boolean
          receives_communication: boolean
          relationship_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          guardian_id: string
          is_billing_contact?: boolean
          is_primary_contact?: boolean
          receives_communication?: boolean
          relationship_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          guardian_id?: string
          is_billing_contact?: boolean
          is_primary_contact?: boolean
          receives_communication?: boolean
          relationship_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_guardians_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "teacher_gift_report"
            referencedColumns: ["teacher_guardian_id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_teacher: boolean
          is_volunteer: boolean
          last_name: string | null
          phone: string | null
          source_application_id: string | null
          teacher_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_teacher?: boolean
          is_volunteer?: boolean
          last_name?: string | null
          phone?: string | null
          source_application_id?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_teacher?: boolean
          is_volunteer?: boolean
          last_name?: string | null
          phone?: string | null
          source_application_id?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_source_application_id_fkey"
            columns: ["source_application_id"]
            isOneToOne: false
            referencedRelation: "teacher_applications"
            referencedColumns: ["id"]
          },
        ]
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
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          note: string | null
          payment_id: string | null
          plan_id: string
          reminder_sent_at: string | null
          school_year_id: string
          sent_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          note?: string | null
          payment_id?: string | null
          plan_id: string
          reminder_sent_at?: string | null
          school_year_id: string
          sent_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          note?: string | null
          payment_id?: string | null
          plan_id?: string
          reminder_sent_at?: string | null
          school_year_id?: string
          sent_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          school_year_id: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          school_year_id: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          school_year_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_allocations_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          idempotency_key: string | null
          name: string
          occurred_at: string
          payment_id: string | null
          psp_reference: string | null
          reference: string
          success: boolean | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          name: string
          occurred_at: string
          payment_id?: string | null
          psp_reference?: string | null
          reference: string
          success?: boolean | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          name?: string
          occurred_at?: string
          payment_id?: string | null
          psp_reference?: string | null
          reference?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          monthly_amount: number | null
          note: string | null
          paused_at: string | null
          plan_type: string
          school_year_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          monthly_amount?: number | null
          note?: string | null
          paused_at?: string | null
          plan_type: string
          school_year_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          monthly_amount?: number | null
          note?: string | null
          paused_at?: string | null
          plan_type?: string
          school_year_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          authorized_amount: number
          captured_amount: number
          captured_at: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          duplicate_of_payment_id: string | null
          duplicate_reviewed_at: string | null
          duplicate_reviewed_by: string | null
          enrollment_id: string | null
          id: string
          last_synced_at: string | null
          method: string
          net_paid_amount: number | null
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          psp_reference: string | null
          redirect_url: string | null
          reference: string
          refunded_amount: number
          school_year_id: string | null
          status: string
          student_id: string | null
          updated_at: string
          vipps_payment_method: string | null
          vipps_state: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          authorized_amount?: number
          captured_amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          duplicate_of_payment_id?: string | null
          duplicate_reviewed_at?: string | null
          duplicate_reviewed_by?: string | null
          enrollment_id?: string | null
          id?: string
          last_synced_at?: string | null
          method?: string
          net_paid_amount?: number | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          psp_reference?: string | null
          redirect_url?: string | null
          reference: string
          refunded_amount?: number
          school_year_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          vipps_payment_method?: string | null
          vipps_state?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          authorized_amount?: number
          captured_amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          duplicate_of_payment_id?: string | null
          duplicate_reviewed_at?: string | null
          duplicate_reviewed_by?: string | null
          enrollment_id?: string | null
          id?: string
          last_synced_at?: string | null
          method?: string
          net_paid_amount?: number | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          psp_reference?: string | null
          redirect_url?: string | null
          reference?: string
          refunded_amount?: number
          school_year_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          vipps_payment_method?: string | null
          vipps_state?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_duplicate_of_payment_id_fkey"
            columns: ["duplicate_of_payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "payments_duplicate_of_payment_id_fkey"
            columns: ["duplicate_of_payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payments_duplicate_of_payment_id_fkey"
            columns: ["duplicate_of_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_duplicate_of_payment_id_fkey"
            columns: ["duplicate_of_payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
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
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string | null
          method: string
          payment_id: string
          psp_reference: string | null
          reason: string
          refund_group_id: string
          refunded_by: string
          refunded_on: string
          school_year_id: string | null
          student_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          method: string
          payment_id: string
          psp_reference?: string | null
          reason: string
          refund_group_id?: string
          refunded_by: string
          refunded_on?: string
          school_year_id?: string | null
          student_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          method?: string
          payment_id?: string
          psp_reference?: string | null
          reason?: string
          refund_group_id?: string
          refunded_by?: string
          refunded_on?: string
          school_year_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refunds_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          created_at: string
          ends_on: string | null
          enrollment_fee: number
          fee: number | null
          id: string
          is_active: boolean
          label: string
          monthly_due_day: number
          sem1_due_on: string | null
          sem2_due_on: string | null
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          enrollment_fee?: number
          fee?: number | null
          id?: string
          is_active?: boolean
          label: string
          monthly_due_day?: number
          sem1_due_on?: string | null
          sem2_due_on?: string | null
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          enrollment_fee?: number
          fee?: number | null
          id?: string
          is_active?: boolean
          label?: string
          monthly_due_day?: number
          sem1_due_on?: string | null
          sem2_due_on?: string | null
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sibling_discount_dismissals: {
        Row: {
          created_at: string
          dismissed_by: string
          family_id: string
          school_year_id: string
        }
        Insert: {
          created_at?: string
          dismissed_by: string
          family_id: string
          school_year_id: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string
          family_id?: string
          school_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sibling_discount_dismissals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sibling_discount_dismissals_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
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
          child_address: string | null
          child_birth_date: string | null
          child_city: string | null
          child_email: string | null
          child_first_name: string | null
          child_gender: string | null
          child_last_name: string | null
          child_level_arabic: string | null
          child_level_islam: string | null
          child_level_quran: string | null
          child_phone: string | null
          child_postal_code: string | null
          created_at: string
          desired_class: string | null
          family_id: string | null
          father_email: string | null
          father_first_name: string | null
          father_last_name: string | null
          father_phone: string | null
          id: string
          message: string | null
          mother_email: string | null
          mother_first_name: string | null
          mother_last_name: string | null
          mother_phone: string | null
          payment_id: string | null
          status: string
          terms_accepted: boolean
        }
        Insert: {
          child_address?: string | null
          child_birth_date?: string | null
          child_city?: string | null
          child_email?: string | null
          child_first_name?: string | null
          child_gender?: string | null
          child_last_name?: string | null
          child_level_arabic?: string | null
          child_level_islam?: string | null
          child_level_quran?: string | null
          child_phone?: string | null
          child_postal_code?: string | null
          created_at?: string
          desired_class?: string | null
          family_id?: string | null
          father_email?: string | null
          father_first_name?: string | null
          father_last_name?: string | null
          father_phone?: string | null
          id?: string
          message?: string | null
          mother_email?: string | null
          mother_first_name?: string | null
          mother_last_name?: string | null
          mother_phone?: string | null
          payment_id?: string | null
          status?: string
          terms_accepted?: boolean
        }
        Update: {
          child_address?: string | null
          child_birth_date?: string | null
          child_city?: string | null
          child_email?: string | null
          child_first_name?: string | null
          child_gender?: string | null
          child_last_name?: string | null
          child_level_arabic?: string | null
          child_level_islam?: string | null
          child_level_quran?: string | null
          child_phone?: string | null
          child_postal_code?: string | null
          created_at?: string
          desired_class?: string | null
          family_id?: string | null
          father_email?: string | null
          father_first_name?: string | null
          father_last_name?: string | null
          father_phone?: string | null
          id?: string
          message?: string | null
          mother_email?: string | null
          mother_first_name?: string | null
          mother_last_name?: string | null
          mother_phone?: string | null
          payment_id?: string | null
          status?: string
          terms_accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_applications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["matched_payment_id"]
          },
          {
            foreignKeyName: "student_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "duplicate_payment_candidates"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "student_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sadaqa_disbursements"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      student_fee_adjustments: {
        Row: {
          amount: number
          created_at: string
          granted_by: string
          id: string
          legacy_fee_id: string | null
          note: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          school_year_id: string
          student_id: string
          teacher_guardian_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          granted_by: string
          id?: string
          legacy_fee_id?: string | null
          note: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          school_year_id: string
          student_id: string
          teacher_guardian_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          granted_by?: string
          id?: string
          legacy_fee_id?: string | null
          note?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          school_year_id?: string
          student_id?: string
          teacher_guardian_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_adjustments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_adjustments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_adjustments_teacher_guardian_id_fkey"
            columns: ["teacher_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_adjustments_teacher_guardian_id_fkey"
            columns: ["teacher_guardian_id"]
            isOneToOne: false
            referencedRelation: "teacher_gift_report"
            referencedColumns: ["teacher_guardian_id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount: number
          created_at: string
          discount: number
          id: string
          note: string | null
          school_year_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          discount?: number
          id?: string
          note?: string | null
          school_year_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          discount?: number
          id?: string
          note?: string | null
          school_year_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          can_pick_up: boolean
          created_at: string
          family_id: string
          guardian_id: string
          has_legal_guardianship: boolean
          is_primary: boolean
          receives_communication: boolean
          relationship_label: string
          sort_order: number
          student_id: string
          updated_at: string
        }
        Insert: {
          can_pick_up?: boolean
          created_at?: string
          family_id: string
          guardian_id: string
          has_legal_guardianship?: boolean
          is_primary?: boolean
          receives_communication?: boolean
          relationship_label?: string
          sort_order?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          can_pick_up?: boolean
          created_at?: string
          family_id?: string
          guardian_id?: string
          has_legal_guardianship?: boolean
          is_primary?: boolean
          receives_communication?: boolean
          relationship_label?: string
          sort_order?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_family_guardian_fkey"
            columns: ["family_id", "guardian_id"]
            isOneToOne: false
            referencedRelation: "family_guardians"
            referencedColumns: ["family_id", "guardian_id"]
          },
          {
            foreignKeyName: "student_guardians_student_family_fkey"
            columns: ["student_id", "family_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      students: {
        Row: {
          application_id: string | null
          child_address: string | null
          child_birth_date: string | null
          child_city: string | null
          child_email: string | null
          child_first_name: string | null
          child_gender: string | null
          child_last_name: string | null
          child_level_arabic: string | null
          child_level_islam: string | null
          child_level_quran: string | null
          child_phone: string | null
          child_postal_code: string | null
          created_at: string
          family_id: string | null
          father_email: string | null
          father_first_name: string | null
          father_last_name: string | null
          father_phone: string | null
          id: string
          mother_email: string | null
          mother_first_name: string | null
          mother_last_name: string | null
          mother_phone: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          child_address?: string | null
          child_birth_date?: string | null
          child_city?: string | null
          child_email?: string | null
          child_first_name?: string | null
          child_gender?: string | null
          child_last_name?: string | null
          child_level_arabic?: string | null
          child_level_islam?: string | null
          child_level_quran?: string | null
          child_phone?: string | null
          child_postal_code?: string | null
          created_at?: string
          family_id?: string | null
          father_email?: string | null
          father_first_name?: string | null
          father_last_name?: string | null
          father_phone?: string | null
          id?: string
          mother_email?: string | null
          mother_first_name?: string | null
          mother_last_name?: string | null
          mother_phone?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          child_address?: string | null
          child_birth_date?: string | null
          child_city?: string | null
          child_email?: string | null
          child_first_name?: string | null
          child_gender?: string | null
          child_last_name?: string | null
          child_level_arabic?: string | null
          child_level_islam?: string | null
          child_level_quran?: string | null
          child_phone?: string | null
          child_postal_code?: string | null
          created_at?: string
          family_id?: string | null
          father_email?: string | null
          father_first_name?: string | null
          father_last_name?: string | null
          father_phone?: string | null
          id?: string
          mother_email?: string | null
          mother_first_name?: string | null
          mother_last_name?: string | null
          mother_phone?: string | null
          notes?: string | null
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
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
      duplicate_payment_candidates: {
        Row: {
          amount: number | null
          cited_reference: string | null
          description: string | null
          evidence: string | null
          matched_amount: number | null
          matched_created_at: string | null
          matched_payment_id: string | null
          matched_reference: string | null
          method: string | null
          paid_at: string | null
          payment_id: string | null
          school_year_id: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_adjustment_totals: {
        Row: {
          active_amount: number | null
          active_count: number | null
          revoked_amount: number | null
          revoked_count: number | null
          school_year_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_adjustments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      sadaqa_disbursements: {
        Row: {
          allocated_amount: number | null
          amount: number | null
          description: string | null
          disbursed_at: string | null
          net_paid_amount: number | null
          payment_id: string | null
          refunded_amount: number | null
          school_year_id: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      student_balances: {
        Row: {
          owed: number | null
          paid: number | null
          remaining: number | null
          school_year_id: string | null
          state: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_gift_report: {
        Row: {
          first_name: string | null
          last_name: string | null
          school_year_id: string | null
          student_count: number | null
          teacher_guardian_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_adjustments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_manual_family_student: {
        Args: { p_student: Json }
        Returns: string
      }
      create_public_family_enrollment: {
        Args: {
          p_address: string
          p_amount: number
          p_children: Json
          p_city: string
          p_description: string
          p_guardians: Json
          p_postal_code: string
          p_reference: string
          p_school_year_id: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      replace_payment_allocations: {
        Args: { p_allocations?: Json; p_payment_id: string }
        Returns: number
      }
      update_family_relationships: {
        Args: {
          p_family: Json
          p_family_id: string
          p_guardians: Json
          p_resolve_reviews?: boolean
        }
        Returns: undefined
      }
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

