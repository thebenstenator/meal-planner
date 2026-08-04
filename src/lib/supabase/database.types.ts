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
      ai_usage_counter: {
        Row: {
          count: number
          created_at: string
          household_id: string
          id: string
          period: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          household_id: string
          id?: string
          period: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          household_id?: string
          id?: string
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_counter_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_ingredient: {
        Row: {
          aliases: string[]
          category: string | null
          count_to_gram: number | null
          created_at: string
          default_unit: string | null
          density_g_per_ml: number | null
          household_id: string | null
          id: string
          merged_into_id: string | null
          name: string
          unit_size_quantity: number | null
          unit_size_unit: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          category?: string | null
          count_to_gram?: number | null
          created_at?: string
          default_unit?: string | null
          density_g_per_ml?: number | null
          household_id?: string | null
          id?: string
          merged_into_id?: string | null
          name: string
          unit_size_quantity?: number | null
          unit_size_unit?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          category?: string | null
          count_to_gram?: number | null
          created_at?: string
          default_unit?: string | null
          density_g_per_ml?: number | null
          household_id?: string | null
          id?: string
          merged_into_id?: string | null
          name?: string
          unit_size_quantity?: number | null
          unit_size_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_ingredient_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_ingredient_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "canonical_ingredient"
            referencedColumns: ["id"]
          },
        ]
      }
      household: {
        Row: {
          created_at: string
          default_store_id: string | null
          id: string
          monthly_budget_cents: number | null
          name: string
          price_stale_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_store_id?: string | null
          id?: string
          monthly_budget_cents?: number | null
          name: string
          price_stale_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_store_id?: string | null
          id?: string
          monthly_budget_cents?: number | null
          name?: string
          price_stale_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_default_store_fk"
            columns: ["default_store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
        ]
      }
      household_ingredient_map: {
        Row: {
          canonical_ingredient_id: string
          created_at: string
          household_id: string
          id: string
          raw_name: string
          updated_at: string
        }
        Insert: {
          canonical_ingredient_id: string
          created_at?: string
          household_id: string
          id?: string
          raw_name: string
          updated_at?: string
        }
        Update: {
          canonical_ingredient_id?: string
          created_at?: string
          household_id?: string
          id?: string
          raw_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_ingredient_map_canonical_ingredient_id_fkey"
            columns: ["canonical_ingredient_id"]
            isOneToOne: false
            referencedRelation: "canonical_ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_ingredient_map_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invite: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          household_id: string
          id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invite_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      household_member: {
        Row: {
          created_at: string
          household_id: string
          id: string
          invited_at: string | null
          joined_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          invited_at?: string | null
          joined_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          invited_at?: string | null
          joined_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_member_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entry: {
        Row: {
          created_at: string
          date: string
          household_id: string
          id: string
          kind: string
          leftovers_from_entry_id: string | null
          note: string | null
          position: number
          recipe_id: string | null
          servings_override: number | null
          slot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          household_id: string
          id?: string
          kind?: string
          leftovers_from_entry_id?: string | null
          note?: string | null
          position?: number
          recipe_id?: string | null
          servings_override?: number | null
          slot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          kind?: string
          leftovers_from_entry_id?: string | null
          note?: string | null
          position?: number
          recipe_id?: string | null
          servings_override?: number | null
          slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entry_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entry_leftovers_from_entry_id_fkey"
            columns: ["leftovers_from_entry_id"]
            isOneToOne: false
            referencedRelation: "plan_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entry_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      price_record: {
        Row: {
          canonical_ingredient_id: string
          created_at: string
          household_id: string
          id: string
          observed_on: string
          package_quantity: number
          package_unit: string
          price_cents: number
          source: string
          store_id: string
        }
        Insert: {
          canonical_ingredient_id: string
          created_at?: string
          household_id: string
          id?: string
          observed_on?: string
          package_quantity: number
          package_unit: string
          price_cents: number
          source?: string
          store_id: string
        }
        Update: {
          canonical_ingredient_id?: string
          created_at?: string
          household_id?: string
          id?: string
          observed_on?: string
          package_quantity?: number
          package_unit?: string
          price_cents?: number
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_record_canonical_ingredient_id_fkey"
            columns: ["canonical_ingredient_id"]
            isOneToOne: false
            referencedRelation: "canonical_ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_record_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_record_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe: {
        Row: {
          cook_minutes: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          household_id: string
          id: string
          image_path: string | null
          import_status: string
          instructions: string | null
          last_cooked_on: string | null
          meal_types: string[]
          notes: string | null
          prep_minutes: number | null
          rating: number | null
          servings: number
          source: string | null
          tags: string[]
          times_cooked: number
          title: string
          updated_at: string
        }
        Insert: {
          cook_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          household_id: string
          id?: string
          image_path?: string | null
          import_status?: string
          instructions?: string | null
          last_cooked_on?: string | null
          meal_types?: string[]
          notes?: string | null
          prep_minutes?: number | null
          rating?: number | null
          servings?: number
          source?: string | null
          tags?: string[]
          times_cooked?: number
          title: string
          updated_at?: string
        }
        Update: {
          cook_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          household_id?: string
          id?: string
          image_path?: string | null
          import_status?: string
          instructions?: string | null
          last_cooked_on?: string | null
          meal_types?: string[]
          notes?: string | null
          prep_minutes?: number | null
          rating?: number | null
          servings?: number
          source?: string | null
          tags?: string[]
          times_cooked?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredient: {
        Row: {
          canonical_ingredient_id: string | null
          created_at: string
          descriptor: string | null
          id: string
          is_optional: boolean
          needs_review: boolean
          parse_confidence: number | null
          position: number
          quantity: number | null
          raw_text: string
          recipe_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          canonical_ingredient_id?: string | null
          created_at?: string
          descriptor?: string | null
          id?: string
          is_optional?: boolean
          needs_review?: boolean
          parse_confidence?: number | null
          position?: number
          quantity?: number | null
          raw_text: string
          recipe_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          canonical_ingredient_id?: string | null
          created_at?: string
          descriptor?: string | null
          id?: string
          is_optional?: boolean
          needs_review?: boolean
          parse_confidence?: number | null
          position?: number
          quantity?: number | null
          raw_text?: string
          recipe_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredient_canonical_ingredient_id_fkey"
            columns: ["canonical_ingredient_id"]
            isOneToOne: false
            referencedRelation: "canonical_ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredient_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list: {
        Row: {
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          generated_at: string
          household_id: string
          id: string
          name: string
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          generated_at?: string
          household_id: string
          id?: string
          name: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          generated_at?: string
          household_id?: string
          id?: string
          name?: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_item: {
        Row: {
          ad_hoc_name: string | null
          canonical_ingredient_id: string | null
          category: string | null
          created_at: string
          display_name: string
          estimated_price_cents: number | null
          id: string
          is_checked: boolean
          is_manual: boolean
          no_quantity_count: number
          position: number
          price_is_stale: boolean
          purchase: Json | null
          shopping_list_id: string
          sub_totals: Json | null
          total_quantity: number | null
          unit: string | null
          unresolved: boolean
          updated_at: string
        }
        Insert: {
          ad_hoc_name?: string | null
          canonical_ingredient_id?: string | null
          category?: string | null
          created_at?: string
          display_name: string
          estimated_price_cents?: number | null
          id?: string
          is_checked?: boolean
          is_manual?: boolean
          no_quantity_count?: number
          position?: number
          price_is_stale?: boolean
          purchase?: Json | null
          shopping_list_id: string
          sub_totals?: Json | null
          total_quantity?: number | null
          unit?: string | null
          unresolved?: boolean
          updated_at?: string
        }
        Update: {
          ad_hoc_name?: string | null
          canonical_ingredient_id?: string | null
          category?: string | null
          created_at?: string
          display_name?: string
          estimated_price_cents?: number | null
          id?: string
          is_checked?: boolean
          is_manual?: boolean
          no_quantity_count?: number
          position?: number
          price_is_stale?: boolean
          purchase?: Json | null
          shopping_list_id?: string
          sub_totals?: Json | null
          total_quantity?: number | null
          unit?: string | null
          unresolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_item_canonical_ingredient_id_fkey"
            columns: ["canonical_ingredient_id"]
            isOneToOne: false
            referencedRelation: "canonical_ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_item_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_item_source: {
        Row: {
          contributed_quantity: number | null
          created_at: string
          id: string
          plan_entry_id: string | null
          recipe_ingredient_id: string | null
          shopping_list_item_id: string
        }
        Insert: {
          contributed_quantity?: number | null
          created_at?: string
          id?: string
          plan_entry_id?: string | null
          recipe_ingredient_id?: string | null
          shopping_list_item_id: string
        }
        Update: {
          contributed_quantity?: number | null
          created_at?: string
          id?: string
          plan_entry_id?: string | null
          recipe_ingredient_id?: string | null
          shopping_list_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_item_source_plan_entry_id_fkey"
            columns: ["plan_entry_id"]
            isOneToOne: false
            referencedRelation: "plan_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_item_source_recipe_ingredient_id_fkey"
            columns: ["recipe_ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_item_source_shopping_list_item_id_fkey"
            columns: ["shopping_list_item_id"]
            isOneToOne: false
            referencedRelation: "shopping_list_item"
            referencedColumns: ["id"]
          },
        ]
      }
      store: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invite: { Args: { p_code: string }; Returns: string }
      consume_ai_credit: {
        Args: { p_household_id: string; p_limit: number }
        Returns: number
      }
      create_household_invite: {
        Args: { p_household_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          household_id: string
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "household_invite"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_invite_code: { Args: never; Returns: string }
      generate_shopping_list: {
        Args: {
          p_end: string
          p_household_id: string
          p_items: Json
          p_list_id?: string
          p_name: string
          p_start: string
        }
        Returns: string
      }
      get_current_prices: {
        Args: { p_store_id: string }
        Returns: {
          canonical_ingredient_id: string
          observed_on: string
          package_quantity: number
          package_unit: string
          price_cents: number
        }[]
      }
      get_household_members: {
        Args: { p_household_id: string }
        Returns: {
          email: string
          joined_at: string
          role: string
          user_id: string
        }[]
      }
      is_household_member: {
        Args: { p_household_id: string }
        Returns: boolean
      }
      is_household_owner: { Args: { p_household_id: string }; Returns: boolean }
      match_canonical_ingredient: {
        Args: { p_household_id: string; p_raw: string; p_threshold?: number }
        Returns: {
          canonical_ingredient_id: string
          method: string
          name: string
          score: number
        }[]
      }
      resolve_canonical: { Args: { p_id: string }; Returns: string }
      save_recipe: {
        Args: { p_ingredients: Json; p_recipe: Json; p_recipe_id?: string }
        Returns: string
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

