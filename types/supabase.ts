// Tipos generados del esquema Supabase (Fase 3). Regenerar tras cada migración:
//   connector Supabase → generate_typescript_types (proyecto jxmrhxlzjlxforvhxuuv).
// NO editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      aaf_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          paid_on: string;
          receipt_doc: string | null;
          tracking_id: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          paid_on: string;
          receipt_doc?: string | null;
          tracking_id: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          paid_on?: string;
          receipt_doc?: string | null;
          tracking_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aaf_payments_receipt_doc_fkey";
            columns: ["receipt_doc"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aaf_payments_tracking_id_fkey";
            columns: ["tracking_id"];
            isOneToOne: false;
            referencedRelation: "aaf_tracking";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aaf_payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      aaf_tracking: {
        Row: {
          active_pause: string | null;
          amount_cents: number | null;
          branch: Database["public"]["Enums"]["aaf_branch"] | null;
          case_id: string;
          days_until_due: number | null;
          filing_date: string | null;
          filing_date_confidence: string | null;
          fiscal_year: number | null;
          id: string;
          last_calculated_at: string | null;
          next_due_date: string | null;
          status: Database["public"]["Enums"]["aaf_status"];
          user_id: string;
        };
        Insert: {
          active_pause?: string | null;
          amount_cents?: number | null;
          branch?: Database["public"]["Enums"]["aaf_branch"] | null;
          case_id: string;
          days_until_due?: number | null;
          filing_date?: string | null;
          filing_date_confidence?: string | null;
          fiscal_year?: number | null;
          id?: string;
          last_calculated_at?: string | null;
          next_due_date?: string | null;
          status?: Database["public"]["Enums"]["aaf_status"];
          user_id: string;
        };
        Update: {
          active_pause?: string | null;
          amount_cents?: number | null;
          branch?: Database["public"]["Enums"]["aaf_branch"] | null;
          case_id?: string;
          days_until_due?: number | null;
          filing_date?: string | null;
          filing_date_confidence?: string | null;
          fiscal_year?: number | null;
          id?: string;
          last_calculated_at?: string | null;
          next_due_date?: string | null;
          status?: Database["public"]["Enums"]["aaf_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aaf_tracking_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: true;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aaf_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_embeddings: {
        Row: {
          content: string | null;
          embedding: string | null;
          id: string;
          source_ref: string | null;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          embedding?: string | null;
          id?: string;
          source_ref?: string | null;
          user_id: string;
        };
        Update: {
          content?: string | null;
          embedding?: string | null;
          id?: string;
          source_ref?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_embeddings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ai_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_threads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string | null;
          created_at: string;
          id: number;
          meta: Json | null;
          target: string | null;
          user_id: string | null;
        };
        Insert: {
          action?: string | null;
          created_at?: string;
          id?: never;
          meta?: Json | null;
          target?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string | null;
          created_at?: string;
          id?: never;
          meta?: Json | null;
          target?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      case_events: {
        Row: {
          case_id: string;
          created_at: string;
          id: string;
          kind: string;
          payload: Json;
          user_id: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          payload: Json;
          user_id: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          alien_number_enc: string | null;
          cooldown_until: string | null;
          created_at: string;
          id: string;
          last_result: Json | null;
          last_synced_at: string | null;
          nationality: string | null;
          nvc_case_number: string | null;
          receipt: string | null;
          source: Database["public"]["Enums"]["case_source"];
          status: Database["public"]["Enums"]["case_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alien_number_enc?: string | null;
          cooldown_until?: string | null;
          created_at?: string;
          id?: string;
          last_result?: Json | null;
          last_synced_at?: string | null;
          nationality?: string | null;
          nvc_case_number?: string | null;
          receipt?: string | null;
          source: Database["public"]["Enums"]["case_source"];
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alien_number_enc?: string | null;
          cooldown_until?: string | null;
          created_at?: string;
          id?: string;
          last_result?: Json | null;
          last_synced_at?: string | null;
          nationality?: string | null;
          nvc_case_number?: string | null;
          receipt?: string | null;
          source?: Database["public"]["Enums"]["case_source"];
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          case_id: string | null;
          created_at: string;
          deleted_at: string | null;
          filename: string | null;
          id: string;
          is_encrypted: boolean;
          kind: Database["public"]["Enums"]["doc_kind"];
          storage_path: string;
          user_id: string;
        };
        Insert: {
          case_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          filename?: string | null;
          id?: string;
          is_encrypted?: boolean;
          kind?: Database["public"]["Enums"]["doc_kind"];
          storage_path: string;
          user_id: string;
        };
        Update: {
          case_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          filename?: string | null;
          id?: string;
          is_encrypted?: boolean;
          kind?: Database["public"]["Enums"]["doc_kind"];
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_events: {
        Row: {
          aggregate: string | null;
          aggregate_id: string | null;
          created_at: string;
          id: string;
          payload: Json | null;
          published: boolean;
          type: string | null;
        };
        Insert: {
          aggregate?: string | null;
          aggregate_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          published?: boolean;
          type?: string | null;
        };
        Update: {
          aggregate?: string | null;
          aggregate_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json | null;
          published?: boolean;
          type?: string | null;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          endpoint: string | null;
          key: string;
          response: Json | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          endpoint?: string | null;
          key: string;
          response?: Json | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          endpoint?: string | null;
          key?: string;
          response?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["notif_kind"];
          read_at: string | null;
          title: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["notif_kind"];
          read_at?: string | null;
          title?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["notif_kind"];
          read_at?: string | null;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          consent_at: string | null;
          consent_version: string | null;
          created_at: string;
          deleted_at: string | null;
          full_name: string | null;
          id: string;
          language: string;
          plan: Database["public"]["Enums"]["plan_tier"];
          updated_at: string;
        };
        Insert: {
          consent_at?: string | null;
          consent_version?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string | null;
          id: string;
          language?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          updated_at?: string;
        };
        Update: {
          consent_at?: string | null;
          consent_version?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string | null;
          id?: string;
          language?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          updated_at?: string;
        };
        Relationships: [];
      };
      scrape_jobs: {
        Row: {
          attempts: number;
          case_id: string | null;
          created_at: string;
          error_kind: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          result: Json | null;
          scheduled_at: string;
          source: Database["public"]["Enums"]["case_source"];
          started_at: string | null;
          status: Database["public"]["Enums"]["scrape_status"];
          user_id: string;
        };
        Insert: {
          attempts?: number;
          case_id?: string | null;
          created_at?: string;
          error_kind?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          result?: Json | null;
          scheduled_at?: string;
          source: Database["public"]["Enums"]["case_source"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scrape_status"];
          user_id: string;
        };
        Update: {
          attempts?: number;
          case_id?: string | null;
          created_at?: string;
          error_kind?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          result?: Json | null;
          scheduled_at?: string;
          source?: Database["public"]["Enums"]["case_source"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scrape_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scrape_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          current_period_end: string | null;
          id: string;
          plan: Database["public"]["Enums"]["plan_tier"];
          status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          current_period_end?: string | null;
          id?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_period_end?: string | null;
          id?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      aaf_branch: "A" | "B" | "C" | "D";
      aaf_status: "not_due" | "due_soon" | "due_now" | "overdue" | "paid_current" | "case_closed";
      case_source: "eoir" | "uscis" | "nvc";
      case_status: "active" | "closed" | "unknown";
      doc_kind: "upload" | "aaf_motion" | "aaf_receipt" | "i94" | "other";
      notif_kind: "case_update" | "hearing" | "aaf_due" | "deadline" | "system";
      plan_tier: "free" | "pro";
      scrape_status: "queued" | "running" | "done" | "failed" | "dead";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
