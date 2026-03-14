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
      event_photos: {
        Row: {
          created_at: string
          event_id: string
          height: number | null
          id: string
          is_indexed: boolean
          original_filename: string | null
          storage_path: string
          thumbnail_path: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          height?: number | null
          id?: string
          is_indexed?: boolean
          original_filename?: string | null
          storage_path: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          height?: number | null
          id?: string
          is_indexed?: boolean
          original_filename?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          admin_id: string
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_cedula: string | null
          bank_name: string | null
          code: string
          created_at: string
          currency: string
          date: string
          description: string | null
          free_photos: number
          id: string
          is_active: boolean
          location: string | null
          name: string
          price_per_photo: number
          sinpe_phone: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_cedula?: string | null
          bank_name?: string | null
          code: string
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          free_photos?: number
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          price_per_photo?: number
          sinpe_phone?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_cedula?: string | null
          bank_name?: string | null
          code?: string
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          free_photos?: number
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          price_per_photo?: number
          sinpe_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      face_descriptors: {
        Row: {
          created_at: string
          descriptor: string
          event_id: string
          face_index: number
          id: string
          photo_id: string
        }
        Insert: {
          created_at?: string
          descriptor: string
          event_id: string
          face_index?: number
          id?: string
          photo_id: string
        }
        Update: {
          created_at?: string
          descriptor?: string
          event_id?: string
          face_index?: number
          id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_descriptors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_descriptors_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "event_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          currency: string
          event_id: string
          id: string
          payment_method: string
          payment_proof_path: string | null
          payment_reference: string | null
          photo_ids: string[]
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          payment_method?: string
          payment_proof_path?: string | null
          payment_reference?: string | null
          photo_ids: string[]
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          payment_method?: string
          payment_proof_path?: string | null
          payment_reference?: string | null
          photo_ids?: string[]
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      search_rate_limits: {
        Row: {
          client_ip: string
          event_id: string
          first_search_at: string
          id: string
          last_search_at: string
          search_count: number
        }
        Insert: {
          client_ip: string
          event_id: string
          first_search_at?: string
          id?: string
          last_search_at?: string
          search_count?: number
        }
        Update: {
          client_ip?: string
          event_id?: string
          first_search_at?: string
          id?: string
          last_search_at?: string
          search_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "search_rate_limits_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      search_requests: {
        Row: {
          client_name: string | null
          client_phone: string | null
          created_at: string
          event_id: string
          id: string
          matched_photo_ids: string[] | null
          selfie_path: string | null
          status: string
        }
        Insert: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          event_id: string
          id?: string
          matched_photo_ids?: string[] | null
          selfie_path?: string | null
          status?: string
        }
        Update: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          event_id?: string
          id?: string
          matched_photo_ids?: string[] | null
          selfie_path?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      cleanup_old_search_requests: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
