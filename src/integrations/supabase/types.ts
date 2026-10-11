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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: string
          created_at: string
          drive_file_id: string | null
          drive_folder: string | null
          drive_modified_at: string | null
          file_size: number | null
          height: number | null
          id: string
          import_status: string
          mime_type: string
          name: string
          protected_areas: Json
          safe_area: Json | null
          source: string
          storage_path: string | null
          tags: Json
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          asset_type?: string
          created_at?: string
          drive_file_id?: string | null
          drive_folder?: string | null
          drive_modified_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          import_status?: string
          mime_type?: string
          name: string
          protected_areas?: Json
          safe_area?: Json | null
          source?: string
          storage_path?: string | null
          tags?: Json
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          drive_file_id?: string | null
          drive_folder?: string | null
          drive_modified_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          import_status?: string
          mime_type?: string
          name?: string
          protected_areas?: Json
          safe_area?: Json | null
          source?: string
          storage_path?: string | null
          tags?: Json
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: []
      }
      card_asset_links: {
        Row: {
          background_asset_id: string | null
          background_manual: boolean
          card_image_asset_id: string | null
          composition: Json | null
          updated_at: string
          variant_key: string
        }
        Insert: {
          background_asset_id?: string | null
          background_manual?: boolean
          card_image_asset_id?: string | null
          composition?: Json | null
          updated_at?: string
          variant_key: string
        }
        Update: {
          background_asset_id?: string | null
          background_manual?: boolean
          card_image_asset_id?: string | null
          composition?: Json | null
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_asset_links_background_asset_id_fkey"
            columns: ["background_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_asset_links_card_image_asset_id_fkey"
            columns: ["card_image_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      card_registry: {
        Row: {
          card_image: string
          changed_fields: Json
          def: number | null
          dri: number | null
          fingerprint: string
          first_seen_at: string
          is_new_variant: boolean
          last_changed_at: string | null
          last_seen_at: string
          nation: string
          ovr: number | null
          pac: number | null
          pas: number | null
          perk: string
          phy: number | null
          player_name: string
          position: string
          row_id: string
          sho: number | null
          variant_key: string
        }
        Insert: {
          card_image?: string
          changed_fields?: Json
          def?: number | null
          dri?: number | null
          fingerprint: string
          first_seen_at?: string
          is_new_variant?: boolean
          last_changed_at?: string | null
          last_seen_at?: string
          nation?: string
          ovr?: number | null
          pac?: number | null
          pas?: number | null
          perk?: string
          phy?: number | null
          player_name?: string
          position?: string
          row_id: string
          sho?: number | null
          variant_key: string
        }
        Update: {
          card_image?: string
          changed_fields?: Json
          def?: number | null
          dri?: number | null
          fingerprint?: string
          first_seen_at?: string
          is_new_variant?: boolean
          last_changed_at?: string | null
          last_seen_at?: string
          nation?: string
          ovr?: number | null
          pac?: number | null
          pas?: number | null
          perk?: string
          phy?: number | null
          player_name?: string
          position?: string
          row_id?: string
          sho?: number | null
          variant_key?: string
        }
        Relationships: []
      }
      card_type_backgrounds: {
        Row: {
          background_asset_id: string | null
          card_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          background_asset_id?: string | null
          card_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          background_asset_id?: string | null
          card_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_type_backgrounds_background_asset_id_fkey"
            columns: ["background_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      card_type_registry: {
        Row: {
          card_count: number
          card_type: string
          first_seen_at: string
          last_seen_at: string
        }
        Insert: {
          card_count?: number
          card_type: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Update: {
          card_count?: number
          card_type?: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          categories: Json
          created_at: string
          description: string
          entry_date: string
          id: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          categories?: Json
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      drive_assets: {
        Row: {
          asset_id: string | null
          asset_type: string
          detected_at: string
          drive_file_id: string
          drive_modified_at: string | null
          error: string | null
          failed_at: string | null
          file_size: number | null
          folder: string
          match_group: string | null
          matched_variant_key: string | null
          mime_type: string
          name: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string
          detected_at?: string
          drive_file_id: string
          drive_modified_at?: string | null
          error?: string | null
          failed_at?: string | null
          file_size?: number | null
          folder?: string
          match_group?: string | null
          matched_variant_key?: string | null
          mime_type?: string
          name: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          detected_at?: string
          drive_file_id?: string
          drive_modified_at?: string | null
          error?: string | null
          failed_at?: string | null
          file_size?: number | null
          folder?: string
          match_group?: string | null
          matched_variant_key?: string | null
          mime_type?: string
          name?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_sync_state: {
        Row: {
          auto_sync_enabled: boolean
          counters: Json
          id: string
          import_mode: string
          last_error: string | null
          last_error_kind: string | null
          last_scheduler_run_at: string | null
          last_status: string | null
          last_sync_at: string | null
          last_trigger: string | null
          root_folder_id: string | null
          sync_running: boolean
          sync_started_at: string | null
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          counters?: Json
          id: string
          import_mode?: string
          last_error?: string | null
          last_error_kind?: string | null
          last_scheduler_run_at?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          last_trigger?: string | null
          root_folder_id?: string | null
          sync_running?: boolean
          sync_started_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean
          counters?: Json
          id?: string
          import_mode?: string
          last_error?: string | null
          last_error_kind?: string | null
          last_scheduler_run_at?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          last_trigger?: string | null
          root_folder_id?: string | null
          sync_running?: boolean
          sync_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduler_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      sheet_sync_state: {
        Row: {
          card_count: number
          id: string
          last_attempt_at: string | null
          last_change_count: number
          last_duration_ms: number | null
          last_error: string | null
          last_status: string | null
          last_success_at: string | null
          players: Json
          sync_running: boolean
          sync_started_at: string | null
          updated_at: string
        }
        Insert: {
          card_count?: number
          id: string
          last_attempt_at?: string | null
          last_change_count?: number
          last_duration_ms?: number | null
          last_error?: string | null
          last_status?: string | null
          last_success_at?: string | null
          players?: Json
          sync_running?: boolean
          sync_started_at?: string | null
          updated_at?: string
        }
        Update: {
          card_count?: number
          id?: string
          last_attempt_at?: string | null
          last_change_count?: number
          last_duration_ms?: number | null
          last_error?: string | null
          last_status?: string | null
          last_success_at?: string | null
          players?: Json
          sync_running?: boolean
          sync_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_drive_sync_lock: {
        Args: { _stale_seconds?: number }
        Returns: boolean
      }
      acquire_sync_lock: { Args: { _stale_seconds?: number }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
