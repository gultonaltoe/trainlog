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
      block_sets: {
        Row: {
          block_id: string
          distance_m: number | null
          duration_seconds: number | null
          execution: string | null
          id: string
          is_pr: boolean | null
          movement_id: string | null
          movement_label: string
          notes: string | null
          pct_rm: number | null
          reps: number | null
          rpe_set: number | null
          set_number: number | null
          tempo: string | null
          weight_kg: number | null
        }
        Insert: {
          block_id: string
          distance_m?: number | null
          duration_seconds?: number | null
          execution?: string | null
          id?: string
          is_pr?: boolean | null
          movement_id?: string | null
          movement_label: string
          notes?: string | null
          pct_rm?: number | null
          reps?: number | null
          rpe_set?: number | null
          set_number?: number | null
          tempo?: string | null
          weight_kg?: number | null
        }
        Update: {
          block_id?: string
          distance_m?: number | null
          duration_seconds?: number | null
          execution?: string | null
          id?: string
          is_pr?: boolean | null
          movement_id?: string | null
          movement_label?: string
          notes?: string | null
          pct_rm?: number | null
          reps?: number | null
          rpe_set?: number | null
          set_number?: number | null
          tempo?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "block_sets_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "session_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_sets_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_sets_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_movement_progression"
            referencedColumns: ["movement_id"]
          },
        ]
      }
      body_metrics: {
        Row: {
          body_fat_pct: number | null
          created_at: string | null
          date: string
          hrv: number | null
          id: string
          notes: string | null
          resting_hr: number | null
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string | null
          date: string
          hrv?: number | null
          id?: string
          notes?: string | null
          resting_hr?: number | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string | null
          date?: string
          hrv?: number | null
          id?: string
          notes?: string | null
          resting_hr?: number | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      body_parts: {
        Row: {
          id: string
          name: string
          zone: string | null
        }
        Insert: {
          id?: string
          name: string
          zone?: string | null
        }
        Update: {
          id?: string
          name?: string
          zone?: string | null
        }
        Relationships: []
      }
      class_reservations: {
        Row: {
          created_at: string
          id: string
          member_plan_id: string | null
          notified_at: string | null
          occurrence_date: string
          organization_id: string
          schedule_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_plan_id?: string | null
          notified_at?: string | null
          occurrence_date: string
          organization_id: string
          schedule_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_plan_id?: string | null
          notified_at?: string | null
          occurrence_date?: string
          organization_id?: string
          schedule_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_reservations_member_plan_id_fkey"
            columns: ["member_plan_id"]
            isOneToOne: false
            referencedRelation: "member_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reservations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          active: boolean
          capacity: number
          coach_user_id: string | null
          created_at: string
          duration_min: number
          id: string
          organization_id: string
          session_type: string | null
          start_date: string
          start_time: string
          title: string
          waitlist_capacity: number | null
          weekday: number
        }
        Insert: {
          active?: boolean
          capacity: number
          coach_user_id?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          organization_id: string
          session_type?: string | null
          start_date?: string
          start_time: string
          title: string
          waitlist_capacity?: number | null
          weekday: number
        }
        Update: {
          active?: boolean
          capacity?: number
          coach_user_id?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          organization_id?: string
          session_type?: string | null
          start_date?: string
          start_time?: string
          title?: string
          waitlist_capacity?: number | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number | null
          coach_user_id: string | null
          created_at: string
          date: string
          duration_min: number
          id: string
          organization_id: string
          start_time: string
          title: string
        }
        Insert: {
          capacity?: number | null
          coach_user_id?: string | null
          created_at?: string
          date: string
          duration_min?: number
          id?: string
          organization_id: string
          start_time: string
          title: string
        }
        Update: {
          capacity?: number | null
          coach_user_id?: string | null
          created_at?: string
          date?: string
          duration_min?: number
          id?: string
          organization_id?: string
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string | null
          id: string
          message: string
          page: string | null
          rating: number | null
          type: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          page?: string | null
          rating?: number | null
          type?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          page?: string | null
          rating?: number | null
          type?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_plans: {
        Row: {
          created_at: string
          credits_remaining: number | null
          ends_on: string | null
          id: string
          organization_id: string
          plan_id: string
          starts_on: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number | null
          ends_on?: string | null
          id?: string
          organization_id: string
          plan_id: string
          starts_on?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number | null
          ends_on?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          starts_on?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          active: boolean
          created_at: string
          credits: number | null
          currency: string
          duration_days: number | null
          id: string
          kind: string
          name: string
          organization_id: string
          price_cents: number
          recurring: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits?: number | null
          currency?: string
          duration_days?: number | null
          id?: string
          kind?: string
          name: string
          organization_id: string
          price_cents?: number
          recurring?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number | null
          currency?: string
          duration_days?: number | null
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          price_cents?: number
          recurring?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          data_sharing: boolean
          employment_status: string | null
          id: string
          leave_end: string | null
          leave_start: string | null
          organization_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_sharing?: boolean
          employment_status?: string | null
          id?: string
          leave_end?: string | null
          leave_start?: string | null
          organization_id: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_sharing?: boolean
          employment_status?: string | null
          id?: string
          leave_end?: string | null
          leave_start?: string | null
          organization_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          category: string | null
          coaching_points: string[] | null
          common_mistakes: string[] | null
          created_at: string | null
          equipment: string[] | null
          id: string
          is_unilateral: boolean | null
          muscle_groups: string[] | null
          name: string
          notes: string | null
          subcategory: string | null
        }
        Insert: {
          category?: string | null
          coaching_points?: string[] | null
          common_mistakes?: string[] | null
          created_at?: string | null
          equipment?: string[] | null
          id?: string
          is_unilateral?: boolean | null
          muscle_groups?: string[] | null
          name: string
          notes?: string | null
          subcategory?: string | null
        }
        Update: {
          category?: string | null
          coaching_points?: string[] | null
          common_mistakes?: string[] | null
          created_at?: string | null
          equipment?: string[] | null
          id?: string
          is_unilateral?: boolean | null
          muscle_groups?: string[] | null
          name?: string
          notes?: string | null
          subcategory?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string | null
          date: string
          fat_g: number | null
          hydration_ml: number | null
          id: string
          notes: string | null
          protein_g: number | null
          user_id: string | null
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          date: string
          fat_g?: number | null
          hydration_ml?: number | null
          id?: string
          notes?: string | null
          protein_g?: number | null
          user_id?: string | null
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          date?: string
          fat_g?: number | null
          hydration_ml?: number | null
          id?: string
          notes?: string | null
          protein_g?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_code: string | null
          name: string
          owner_user_id: string
          settings: Json
          slug: string | null
          subscription_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string | null
          name: string
          owner_user_id: string
          settings?: Json
          slug?: string | null
          subscription_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string | null
          name?: string
          owner_user_id?: string
          settings?: Json
          slug?: string | null
          subscription_status?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_demo: boolean | null
          movement_id: string | null
          movement_name: string | null
          notes: string | null
          session_id: string | null
          unit: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_demo?: boolean | null
          movement_id?: string | null
          movement_name?: string | null
          notes?: string | null
          session_id?: string | null
          unit?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_demo?: boolean | null
          movement_id?: string | null
          movement_name?: string | null
          notes?: string | null
          session_id?: string | null
          unit?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_movement_progression"
            referencedColumns: ["movement_id"]
          },
          {
            foreignKeyName: "personal_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          day_number: number | null
          id: string
          notes: string | null
          program_id: string | null
          session_template: Json | null
          week_number: number | null
        }
        Insert: {
          day_number?: number | null
          id?: string
          notes?: string | null
          program_id?: string | null
          session_template?: Json | null
          week_number?: number | null
        }
        Update: {
          day_number?: number | null
          id?: string
          notes?: string | null
          program_id?: string | null
          session_template?: Json | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          description: string | null
          duration_weeks: number | null
          goal: string | null
          id: string
          is_public: boolean | null
          name: string
          sport: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          sport?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          sport?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      session_blocks: {
        Row: {
          block_order: number | null
          block_type: string | null
          complex_label: string | null
          id: string
          is_complex: boolean | null
          notes: string | null
          session_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          block_order?: number | null
          block_type?: string | null
          complex_label?: string | null
          id?: string
          is_complex?: boolean | null
          notes?: string | null
          session_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          block_order?: number | null
          block_type?: string | null
          complex_label?: string | null
          id?: string
          is_complex?: boolean | null
          notes?: string | null
          session_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      session_pain_alerts: {
        Row: {
          body_part_id: string | null
          body_part_label: string
          id: string
          notes: string | null
          session_id: string
          severity: number | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          body_part_id?: string | null
          body_part_label: string
          id?: string
          notes?: string | null
          session_id: string
          severity?: number | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body_part_id?: string | null
          body_part_label?: string
          id?: string
          notes?: string | null
          session_id?: string
          severity?: number | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_pain_alerts_body_part_id_fkey"
            columns: ["body_part_id"]
            isOneToOne: false
            referencedRelation: "body_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_pain_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_pain_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      session_types: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string | null
          date: string
          deleted_at: string | null
          duration_min: number | null
          energy_level: number | null
          feeling_post: number | null
          id: string
          is_competition: boolean | null
          is_demo: boolean | null
          location: string | null
          meta: Json | null
          notes: string | null
          rpe: number | null
          session_type_id: string
          sleep_hours: number | null
          sleep_quality: number | null
          start_time: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deleted_at?: string | null
          duration_min?: number | null
          energy_level?: number | null
          feeling_post?: number | null
          id?: string
          is_competition?: boolean | null
          is_demo?: boolean | null
          location?: string | null
          meta?: Json | null
          notes?: string | null
          rpe?: number | null
          session_type_id: string
          sleep_hours?: number | null
          sleep_quality?: number | null
          start_time?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          duration_min?: number | null
          energy_level?: number | null
          feeling_post?: number | null
          id?: string
          is_competition?: boolean | null
          is_demo?: boolean | null
          location?: string | null
          meta?: Json | null
          notes?: string | null
          rpe?: number | null
          session_type_id?: string
          sleep_hours?: number | null
          sleep_quality?: number | null
          start_time?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile: {
        Row: {
          birth_date: string | null
          box_name: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          goal: string | null
          height_cm: number | null
          id: string
          level: string | null
          notes: string | null
          sports: string[] | null
          theme_color: string | null
          updated_at: string | null
          user_id: string | null
          weekly_target: number | null
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          box_name?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          notes?: string | null
          sports?: string[] | null
          theme_color?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_target?: number | null
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          box_name?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          notes?: string | null
          sports?: string[] | null
          theme_color?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_target?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      wod_components: {
        Row: {
          calories: number | null
          component_order: number | null
          distance_m: number | null
          id: string
          movement_id: string
          movement_label: string
          notes: string | null
          reps: number | null
          unit: string | null
          weight_kg: number | null
          wod_id: string
        }
        Insert: {
          calories?: number | null
          component_order?: number | null
          distance_m?: number | null
          id?: string
          movement_id: string
          movement_label: string
          notes?: string | null
          reps?: number | null
          unit?: string | null
          weight_kg?: number | null
          wod_id: string
        }
        Update: {
          calories?: number | null
          component_order?: number | null
          distance_m?: number | null
          id?: string
          movement_id?: string
          movement_label?: string
          notes?: string | null
          reps?: number | null
          unit?: string | null
          weight_kg?: number | null
          wod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wod_components_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_components_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_movement_progression"
            referencedColumns: ["movement_id"]
          },
          {
            foreignKeyName: "wod_components_wod_id_fkey"
            columns: ["wod_id"]
            isOneToOne: false
            referencedRelation: "wods"
            referencedColumns: ["id"]
          },
        ]
      }
      wod_formats: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      wods: {
        Row: {
          description: string | null
          format_id: string | null
          format_label: string | null
          id: string
          interval_seconds: number | null
          is_rx: boolean | null
          notes: string | null
          result_detail: string | null
          result_extra_reps: number | null
          result_reps: number | null
          result_rounds: number | null
          result_time_sec: number | null
          result_type: string | null
          rounds: number | null
          scaled_notes: string | null
          session_id: string
          time_cap_min: number | null
          user_id: string | null
          wod_order: number | null
        }
        Insert: {
          description?: string | null
          format_id?: string | null
          format_label?: string | null
          id?: string
          interval_seconds?: number | null
          is_rx?: boolean | null
          notes?: string | null
          result_detail?: string | null
          result_extra_reps?: number | null
          result_reps?: number | null
          result_rounds?: number | null
          result_time_sec?: number | null
          result_type?: string | null
          rounds?: number | null
          scaled_notes?: string | null
          session_id: string
          time_cap_min?: number | null
          user_id?: string | null
          wod_order?: number | null
        }
        Update: {
          description?: string | null
          format_id?: string | null
          format_label?: string | null
          id?: string
          interval_seconds?: number | null
          is_rx?: boolean | null
          notes?: string | null
          result_detail?: string | null
          result_extra_reps?: number | null
          result_reps?: number | null
          result_rounds?: number | null
          result_time_sec?: number | null
          result_type?: string | null
          rounds?: number | null
          scaled_notes?: string | null
          session_id?: string
          time_cap_min?: number | null
          user_id?: string | null
          wod_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wods_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "wod_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wods_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wods_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_sessions_summary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_movement_progression: {
        Row: {
          category: string | null
          date: string | null
          is_pr: boolean | null
          movement: string | null
          movement_id: string | null
          reps: number | null
          tempo: string | null
          user_id: string | null
          weight_kg: number | null
        }
        Relationships: []
      }
      v_pain_timeline: {
        Row: {
          body_part_label: string | null
          date: string | null
          rpe: number | null
          session_type: string | null
          severity: number | null
          type: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_sessions_summary: {
        Row: {
          blocks_count: number | null
          date: string | null
          duration_min: number | null
          energy_level: number | null
          feeling_post: number | null
          id: string | null
          is_competition: boolean | null
          notes: string | null
          pain_alerts_count: number | null
          rpe: number | null
          session_type: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          type_color: string | null
          type_emoji: string | null
          user_id: string | null
          wods_count: number | null
        }
        Relationships: []
      }
      v_weekly_volume: {
        Row: {
          avg_energy: number | null
          avg_rpe: number | null
          avg_sleep: number | null
          sessions_count: number | null
          total_minutes: number | null
          user_id: string | null
          week: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_my_invites: { Args: never; Returns: number }
      book_class: {
        Args: { p_date: string; p_schedule_id: string }
        Returns: string
      }
      can_view_member_data: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cancel_class: {
        Args: { p_date: string; p_schedule_id: string }
        Returns: string
      }
      claim_waitlist_spot: {
        Args: { p_date: string; p_schedule_id: string }
        Returns: string
      }
      create_invite: {
        Args: { p_email: string; p_org_id: string; p_role?: string }
        Returns: string
      }
      get_bookings_in_range: {
        Args: { p_from: string; p_org_id: string; p_to: string }
        Returns: {
          booked_count: number
          my_notified: boolean
          my_position: number
          my_status: string
          occurrence_date: string
          schedule_id: string
          waitlist_count: number
        }[]
      }
      get_occurrence_attendees: {
        Args: { p_date: string; p_schedule_id: string }
        Returns: {
          first_name: string
          notified: boolean
          status: string
          user_id: string
          wl_position: number
        }[]
      }
      get_org_member_directory: {
        Args: { p_org_id: string }
        Returns: {
          data_sharing: boolean
          employment_status: string
          first_name: string
          leave_end: string
          leave_start: string
          membership_id: string
          role: string
          status: string
          user_id: string
        }[]
      }
      has_org_role: {
        Args: { allowed_roles: string[]; org_id: string }
        Returns: boolean
      }
      migrate_user_data: { Args: { old_uid: string }; Returns: undefined }
      normalize_email: { Args: { p_email: string }; Returns: string }
      occurrence_start: {
        Args: { p_date: string; p_schedule_id: string }
        Returns: string
      }
      pick_member_plan: {
        Args: { p_date: string; p_org: string; p_uid: string }
        Returns: {
          is_pack: boolean
          mp_id: string
        }[]
      }
      request_to_join_box: { Args: { p_code: string }; Returns: string }
      resa_setting: {
        Args: { p_default: Json; p_key: string; p_org_id: string }
        Returns: Json
      }
      set_data_sharing: {
        Args: { org_id: string; share: boolean }
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

