


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_owner_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.memberships (organization_id, user_id, role, status, data_sharing)
  values (new.id, new.owner_user_id, 'owner', 'active', true)
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."add_owner_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_member_data"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships target
    join public.memberships viewer
      on viewer.organization_id = target.organization_id
    where target.user_id   = target_user_id
      and target.status    = 'active'
      and target.data_sharing = true
      and viewer.user_id   = (select auth.uid())
      and viewer.status    = 'active'
      and viewer.role in ('owner','coach')
  );
$$;


ALTER FUNCTION "public"."can_view_member_data"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_member_directory"("p_org_id" "uuid") RETURNS TABLE("membership_id" "uuid", "user_id" "uuid", "first_name" "text", "role" "text", "status" "text", "data_sharing" boolean, "employment_status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    m.id,
    m.user_id,
    p.first_name,
    m.role,
    m.status,
    m.data_sharing,
    m.employment_status
  from public.memberships m
  left join public.user_profile p on p.user_id = m.user_id
  where m.organization_id = p_org_id
    and m.status <> 'inactive'
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;


ALTER FUNCTION "public"."get_org_member_directory"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_role"("org_id" "uuid", "allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;


ALTER FUNCTION "public"."has_org_role"("org_id" "uuid", "allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_user_data"("old_uid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF old_uid = v_auth_uid THEN
    RETURN;
  END IF;
  UPDATE user_profile     SET user_id = v_auth_uid WHERE user_id = old_uid;
  UPDATE sessions         SET user_id = v_auth_uid WHERE user_id = old_uid;
  UPDATE personal_records SET user_id = v_auth_uid WHERE user_id = old_uid;
END;
$$;


ALTER FUNCTION "public"."migrate_user_data"("old_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_to_join_box"("p_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select id, name into v_id, v_name
    from public.organizations
    where join_code = upper(btrim(p_code));
  if v_id is null then raise exception 'Box introuvable'; end if;
  insert into public.memberships (organization_id, user_id, role, status)
    values (v_id, uid, 'member', 'pending')
    on conflict (organization_id, user_id) do nothing;
  return v_name;
end;
$$;


ALTER FUNCTION "public"."request_to_join_box"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_data_sharing"("org_id" "uuid", "share" boolean) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.memberships
     set data_sharing = share
   where organization_id = org_id
     and user_id = (select auth.uid());
$$;


ALTER FUNCTION "public"."set_data_sharing"("org_id" "uuid", "share" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_org_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.owner_user_id := auth.uid();
  if new.join_code is null then
    new.join_code := upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 6));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_org_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."block_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_id" "uuid" NOT NULL,
    "movement_id" "uuid",
    "movement_label" "text" NOT NULL,
    "set_number" integer,
    "reps" integer,
    "weight_kg" numeric(6,2),
    "distance_m" integer,
    "duration_seconds" integer,
    "tempo" "text",
    "is_pr" boolean DEFAULT false,
    "rpe_set" integer,
    "notes" "text",
    "pct_rm" integer,
    "execution" "text",
    CONSTRAINT "block_sets_rpe_set_check" CHECK ((("rpe_set" >= 1) AND ("rpe_set" <= 10)))
);


ALTER TABLE "public"."block_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "weight_kg" numeric(5,2),
    "body_fat_pct" numeric(4,1),
    "hrv" integer,
    "resting_hr" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."body_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "zone" "text",
    CONSTRAINT "body_parts_zone_check" CHECK (("zone" = ANY (ARRAY['upper'::"text", 'lower'::"text", 'core'::"text"])))
);


ALTER TABLE "public"."body_parts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "session_type" "text",
    "weekday" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "duration_min" integer DEFAULT 60 NOT NULL,
    "capacity" integer NOT NULL,
    "coach_user_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "class_schedules_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."class_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "duration_min" integer DEFAULT 60 NOT NULL,
    "capacity" integer,
    "coach_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_name" "text",
    "type" "text",
    "rating" integer,
    "message" "text" NOT NULL,
    "page" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'suggestion'::"text", 'question'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "data_sharing" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "employment_status" "text",
    CONSTRAINT "memberships_employment_status_check" CHECK (("employment_status" = ANY (ARRAY['active'::"text", 'on_leave'::"text", 'inactive'::"text"]))),
    CONSTRAINT "memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'coach'::"text", 'member'::"text"]))),
    CONSTRAINT "memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'pending'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "subcategory" "text",
    "equipment" "text"[],
    "muscle_groups" "text"[],
    "is_unilateral" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "coaching_points" "text"[],
    "common_mistakes" "text"[],
    CONSTRAINT "movements_category_check" CHECK (("category" = ANY (ARRAY['weightlifting'::"text", 'powerlifting'::"text", 'gymnastics'::"text", 'cardio'::"text", 'strongman'::"text", 'accessory'::"text", 'skill'::"text"])))
);


ALTER TABLE "public"."movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "calories" integer,
    "protein_g" integer,
    "carbs_g" integer,
    "fat_g" integer,
    "hydration_ml" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nutrition_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "owner_user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subscription_status" "text" DEFAULT 'trial'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "join_code" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "movement_id" "uuid",
    "session_id" "uuid",
    "date" "date" NOT NULL,
    "value" numeric(8,2) NOT NULL,
    "unit" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "movement_name" "text",
    "is_demo" boolean DEFAULT false
);


ALTER TABLE "public"."personal_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid",
    "week_number" integer,
    "day_number" integer,
    "session_template" "jsonb",
    "notes" "text"
);


ALTER TABLE "public"."program_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "sport" "text",
    "duration_weeks" integer,
    "goal" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "block_order" integer DEFAULT 1,
    "title" "text",
    "block_type" "text",
    "notes" "text",
    "is_complex" boolean DEFAULT false,
    "complex_label" "text",
    CONSTRAINT "session_blocks_block_type_check" CHECK (("block_type" = ANY (ARRAY['strength'::"text", 'skill'::"text", 'technique'::"text", 'accessory'::"text", 'warmup'::"text", 'cooldown'::"text"])))
);


ALTER TABLE "public"."session_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_pain_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "body_part_id" "uuid",
    "body_part_label" "text" NOT NULL,
    "severity" integer,
    "type" "text",
    "notes" "text",
    CONSTRAINT "session_pain_alerts_severity_check" CHECK ((("severity" >= 1) AND ("severity" <= 3))),
    CONSTRAINT "session_pain_alerts_type_check" CHECK (("type" = ANY (ARRAY['douleur'::"text", 'gêne'::"text", 'inconfort'::"text", 'blessure'::"text", 'crampe'::"text"])))
);


ALTER TABLE "public"."session_pain_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "color" "text",
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "session_types_category_check" CHECK (("category" = ANY (ARRAY['strength'::"text", 'cardio'::"text", 'skill'::"text", 'mixed'::"text", 'competition'::"text", 'recovery'::"text"])))
);


ALTER TABLE "public"."session_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "duration_min" integer,
    "location" "text",
    "is_competition" boolean DEFAULT false,
    "session_type_id" "uuid" NOT NULL,
    "sleep_hours" numeric(3,1),
    "sleep_quality" integer,
    "energy_level" integer,
    "rpe" integer,
    "feeling_post" integer,
    "notes" "text",
    "deleted_at" timestamp with time zone,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_demo" boolean DEFAULT false,
    CONSTRAINT "sessions_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 5))),
    CONSTRAINT "sessions_feeling_post_check" CHECK ((("feeling_post" >= 1) AND ("feeling_post" <= 5))),
    CONSTRAINT "sessions_location_check" CHECK (("location" = ANY (ARRAY['box'::"text", 'home'::"text", 'outdoor'::"text", 'gym'::"text", 'competition'::"text", 'other'::"text"]))),
    CONSTRAINT "sessions_rpe_check" CHECK ((("rpe" >= 1) AND ("rpe" <= 10))),
    CONSTRAINT "sessions_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 5)))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text",
    "birth_date" "date",
    "weight_kg" numeric(5,2),
    "height_cm" integer,
    "level" "text",
    "goal" "text",
    "weekly_target" integer,
    "box_name" "text",
    "sports" "text"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "theme_color" "text" DEFAULT '#F97316'::"text",
    "email" "text",
    CONSTRAINT "user_profile_goal_check" CHECK (("goal" = ANY (ARRAY['remise_en_forme'::"text", 'performance'::"text", 'compétition'::"text", 'santé'::"text"]))),
    CONSTRAINT "user_profile_level_check" CHECK (("level" = ANY (ARRAY['débutant'::"text", 'intermédiaire'::"text", 'avancé'::"text", 'élite'::"text", 'compétiteur'::"text"])))
);


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_movement_progression" WITH ("security_invoker"='on') AS
 SELECT "s"."user_id",
    "m"."id" AS "movement_id",
    "m"."name" AS "movement",
    "m"."category",
    "s"."date",
    "bs"."reps",
    "bs"."weight_kg",
    "bs"."is_pr",
    "bs"."tempo"
   FROM ((("public"."block_sets" "bs"
     JOIN "public"."session_blocks" "sb" ON (("sb"."id" = "bs"."block_id")))
     JOIN "public"."sessions" "s" ON (("s"."id" = "sb"."session_id")))
     JOIN "public"."movements" "m" ON (("m"."id" = "bs"."movement_id")))
  WHERE ("s"."deleted_at" IS NULL)
  ORDER BY "m"."name", "s"."date";


ALTER VIEW "public"."v_movement_progression" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pain_timeline" WITH ("security_invoker"='on') AS
 SELECT "spa"."user_id",
    "s"."date",
    "spa"."body_part_label",
    "spa"."severity",
    "spa"."type",
    "st"."name" AS "session_type",
    "s"."rpe"
   FROM (("public"."session_pain_alerts" "spa"
     JOIN "public"."sessions" "s" ON (("s"."id" = "spa"."session_id")))
     JOIN "public"."session_types" "st" ON (("st"."id" = "s"."session_type_id")))
  WHERE ("s"."deleted_at" IS NULL)
  ORDER BY "spa"."user_id", "s"."date" DESC;


ALTER VIEW "public"."v_pain_timeline" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sessions_summary" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "user_id",
    NULL::"date" AS "date",
    NULL::integer AS "duration_min",
    NULL::boolean AS "is_competition",
    NULL::"text" AS "session_type",
    NULL::"text" AS "type_color",
    NULL::"text" AS "type_emoji",
    NULL::integer AS "rpe",
    NULL::integer AS "feeling_post",
    NULL::numeric(3,1) AS "sleep_hours",
    NULL::integer AS "sleep_quality",
    NULL::integer AS "energy_level",
    NULL::"text" AS "notes",
    NULL::bigint AS "blocks_count",
    NULL::bigint AS "wods_count",
    NULL::bigint AS "pain_alerts_count";


ALTER VIEW "public"."v_sessions_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_weekly_volume" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "date_trunc"('week'::"text", ("date")::timestamp with time zone) AS "week",
    "count"(*) AS "sessions_count",
    "round"("avg"("rpe"), 1) AS "avg_rpe",
    "round"("avg"("sleep_hours"), 1) AS "avg_sleep",
    "round"("avg"("energy_level"), 1) AS "avg_energy",
    "sum"("duration_min") AS "total_minutes"
   FROM "public"."sessions"
  WHERE ("deleted_at" IS NULL)
  GROUP BY "user_id", ("date_trunc"('week'::"text", ("date")::timestamp with time zone))
  ORDER BY ("date_trunc"('week'::"text", ("date")::timestamp with time zone)) DESC;


ALTER VIEW "public"."v_weekly_volume" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wod_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wod_id" "uuid" NOT NULL,
    "component_order" integer,
    "movement_id" "uuid" NOT NULL,
    "movement_label" "text" NOT NULL,
    "reps" integer,
    "weight_kg" numeric(6,2),
    "distance_m" integer,
    "calories" integer,
    "unit" "text",
    "notes" "text",
    CONSTRAINT "wod_components_unit_check" CHECK (("unit" = ANY (ARRAY['reps'::"text", 'cal'::"text", 'm'::"text", 'km'::"text", 'min'::"text", 'sec'::"text"])))
);


ALTER TABLE "public"."wod_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wod_formats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."wod_formats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "wod_order" integer DEFAULT 1,
    "format_id" "uuid",
    "format_label" "text",
    "time_cap_min" integer,
    "rounds" integer,
    "interval_seconds" integer,
    "description" "text",
    "result_type" "text",
    "result_time_sec" integer,
    "result_reps" integer,
    "result_rounds" integer,
    "result_extra_reps" integer,
    "result_detail" "text",
    "is_rx" boolean DEFAULT true,
    "scaled_notes" "text",
    "notes" "text",
    CONSTRAINT "wods_result_type_check" CHECK (("result_type" = ANY (ARRAY['time'::"text", 'reps'::"text", 'rounds_reps'::"text", 'weight'::"text", 'distance'::"text", 'calories'::"text", 'score'::"text"])))
);


ALTER TABLE "public"."wods" OWNER TO "postgres";


ALTER TABLE ONLY "public"."block_sets"
    ADD CONSTRAINT "block_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_metrics"
    ADD CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_parts"
    ADD CONSTRAINT "body_parts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."body_parts"
    ADD CONSTRAINT "body_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."movements"
    ADD CONSTRAINT "movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_logs"
    ADD CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_sessions"
    ADD CONSTRAINT "program_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_blocks"
    ADD CONSTRAINT "session_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_pain_alerts"
    ADD CONSTRAINT "session_pain_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_types"
    ADD CONSTRAINT "session_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."session_types"
    ADD CONSTRAINT "session_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wod_components"
    ADD CONSTRAINT "wod_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wod_formats"
    ADD CONSTRAINT "wod_formats_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."wod_formats"
    ADD CONSTRAINT "wod_formats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wods"
    ADD CONSTRAINT "wods_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_blocks_session" ON "public"."session_blocks" USING "btree" ("session_id");



CREATE INDEX "idx_class_schedules_org" ON "public"."class_schedules" USING "btree" ("organization_id");



CREATE INDEX "idx_classes_org_date" ON "public"."classes" USING "btree" ("organization_id", "date");



CREATE INDEX "idx_memberships_org" ON "public"."memberships" USING "btree" ("organization_id");



CREATE INDEX "idx_memberships_user" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "idx_pain_session" ON "public"."session_pain_alerts" USING "btree" ("session_id");



CREATE INDEX "idx_pain_user" ON "public"."session_pain_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_personal_records_user_id" ON "public"."personal_records" USING "btree" ("user_id");



CREATE INDEX "idx_pr_user_movement" ON "public"."personal_records" USING "btree" ("user_id", "movement_id", "date" DESC);



CREATE INDEX "idx_sessions_meta" ON "public"."sessions" USING "gin" ("meta");



CREATE INDEX "idx_sessions_type" ON "public"."sessions" USING "btree" ("session_type_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sessions_user_date" ON "public"."sessions" USING "btree" ("user_id", "date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_sets_block" ON "public"."block_sets" USING "btree" ("block_id");



CREATE INDEX "idx_sets_movement" ON "public"."block_sets" USING "btree" ("movement_id");



CREATE INDEX "idx_user_profile_user_id" ON "public"."user_profile" USING "btree" ("user_id");



CREATE INDEX "idx_wods_session" ON "public"."wods" USING "btree" ("session_id");



CREATE OR REPLACE VIEW "public"."v_sessions_summary" WITH ("security_invoker"='on') AS
 SELECT "s"."id",
    "s"."user_id",
    "s"."date",
    "s"."duration_min",
    "s"."is_competition",
    "st"."name" AS "session_type",
    "st"."color" AS "type_color",
    "st"."emoji" AS "type_emoji",
    "s"."rpe",
    "s"."feeling_post",
    "s"."sleep_hours",
    "s"."sleep_quality",
    "s"."energy_level",
    "s"."notes",
    "count"(DISTINCT "sb"."id") AS "blocks_count",
    "count"(DISTINCT "w"."id") AS "wods_count",
    "count"(DISTINCT "spa"."id") AS "pain_alerts_count"
   FROM (((("public"."sessions" "s"
     LEFT JOIN "public"."session_types" "st" ON (("s"."session_type_id" = "st"."id")))
     LEFT JOIN "public"."session_blocks" "sb" ON (("sb"."session_id" = "s"."id")))
     LEFT JOIN "public"."wods" "w" ON (("w"."session_id" = "s"."id")))
     LEFT JOIN "public"."session_pain_alerts" "spa" ON (("spa"."session_id" = "s"."id")))
  WHERE ("s"."deleted_at" IS NULL)
  GROUP BY "s"."id", "st"."name", "st"."color", "st"."emoji"
  ORDER BY "s"."date" DESC;



CREATE OR REPLACE TRIGGER "trg_add_owner_membership" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."add_owner_membership"();



CREATE OR REPLACE TRIGGER "trg_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_org_owner" BEFORE INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_org_owner"();



ALTER TABLE ONLY "public"."block_sets"
    ADD CONSTRAINT "block_sets_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_sets"
    ADD CONSTRAINT "block_sets_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_coach_user_id_fkey" FOREIGN KEY ("coach_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_coach_user_id_fkey" FOREIGN KEY ("coach_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id");



ALTER TABLE ONLY "public"."personal_records"
    ADD CONSTRAINT "personal_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."program_sessions"
    ADD CONSTRAINT "program_sessions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_blocks"
    ADD CONSTRAINT "session_blocks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_pain_alerts"
    ADD CONSTRAINT "session_pain_alerts_body_part_id_fkey" FOREIGN KEY ("body_part_id") REFERENCES "public"."body_parts"("id");



ALTER TABLE ONLY "public"."session_pain_alerts"
    ADD CONSTRAINT "session_pain_alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_session_type_id_fkey" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id");



ALTER TABLE ONLY "public"."wod_components"
    ADD CONSTRAINT "wod_components_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id");



ALTER TABLE ONLY "public"."wod_components"
    ADD CONSTRAINT "wod_components_wod_id_fkey" FOREIGN KEY ("wod_id") REFERENCES "public"."wods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wods"
    ADD CONSTRAINT "wods_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "public"."wod_formats"("id");



ALTER TABLE ONLY "public"."wods"
    ADD CONSTRAINT "wods_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE "public"."block_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_read_block_sets" ON "public"."block_sets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."session_blocks" "sb"
     JOIN "public"."sessions" "s" ON (("s"."id" = "sb"."session_id")))
  WHERE (("sb"."id" = "block_sets"."block_id") AND "public"."can_view_member_data"("s"."user_id")))));



CREATE POLICY "coach_read_personal_records" ON "public"."personal_records" FOR SELECT USING ("public"."can_view_member_data"("user_id"));



CREATE POLICY "coach_read_session_blocks" ON "public"."session_blocks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_blocks"."session_id") AND "public"."can_view_member_data"("s"."user_id")))));



CREATE POLICY "coach_read_session_pain_alerts" ON "public"."session_pain_alerts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_pain_alerts"."session_id") AND "public"."can_view_member_data"("s"."user_id")))));



CREATE POLICY "coach_read_sessions" ON "public"."sessions" FOR SELECT USING ("public"."can_view_member_data"("user_id"));



CREATE POLICY "coach_read_wod_components" ON "public"."wod_components" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."wods" "w"
     JOIN "public"."sessions" "s" ON (("s"."id" = "w"."session_id")))
  WHERE (("w"."id" = "wod_components"."wod_id") AND "public"."can_view_member_data"("s"."user_id")))));



CREATE POLICY "coach_read_wods" ON "public"."wods" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "wods"."session_id") AND "public"."can_view_member_data"("s"."user_id")))));



CREATE POLICY "delete_class_schedules" ON "public"."class_schedules" FOR DELETE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "delete_classes" ON "public"."classes" FOR DELETE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "delete_memberships" ON "public"."memberships" FOR DELETE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'staff'::"text"]));



CREATE POLICY "delete_orgs" ON "public"."organizations" FOR DELETE USING ("public"."has_org_role"("id", ARRAY['owner'::"text"]));



CREATE POLICY "delete_program_sessions" ON "public"."program_sessions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "program_sessions"."program_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "delete_programs" ON "public"."programs" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_class_schedules" ON "public"."class_schedules" FOR INSERT WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "insert_classes" ON "public"."classes" FOR INSERT WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "insert_feedback" ON "public"."feedback" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "insert_memberships" ON "public"."memberships" FOR INSERT WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'staff'::"text"]));



CREATE POLICY "insert_orgs" ON "public"."organizations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "insert_program_sessions" ON "public"."program_sessions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "program_sessions"."program_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "insert_programs" ON "public"."programs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_block_sets" ON "public"."block_sets" USING ((EXISTS ( SELECT 1
   FROM ("public"."session_blocks" "sb"
     JOIN "public"."sessions" "s" ON (("s"."id" = "sb"."session_id")))
  WHERE (("sb"."id" = "block_sets"."block_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."session_blocks" "sb"
     JOIN "public"."sessions" "s" ON (("s"."id" = "sb"."session_id")))
  WHERE (("sb"."id" = "block_sets"."block_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "own_body_metrics" ON "public"."body_metrics" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_nutrition_logs" ON "public"."nutrition_logs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_personal_records" ON "public"."personal_records" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_session_blocks" ON "public"."session_blocks" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_blocks"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_blocks"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "own_session_pain_alerts" ON "public"."session_pain_alerts" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_pain_alerts"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_pain_alerts"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "own_sessions" ON "public"."sessions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_user_profile" ON "public"."user_profile" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_wod_components" ON "public"."wod_components" USING ((EXISTS ( SELECT 1
   FROM ("public"."wods" "w"
     JOIN "public"."sessions" "s" ON (("s"."id" = "w"."session_id")))
  WHERE (("w"."id" = "wod_components"."wod_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."wods" "w"
     JOIN "public"."sessions" "s" ON (("s"."id" = "w"."session_id")))
  WHERE (("w"."id" = "wod_components"."wod_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "own_wods" ON "public"."wods" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "wods"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "wods"."session_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."personal_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_body_parts" ON "public"."body_parts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "read_class_schedules" ON "public"."class_schedules" FOR SELECT USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text", 'member'::"text"]));



CREATE POLICY "read_classes" ON "public"."classes" FOR SELECT USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text", 'member'::"text"]));



CREATE POLICY "read_movements" ON "public"."movements" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "read_org_memberships" ON "public"."memberships" FOR SELECT USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "read_orgs" ON "public"."organizations" FOR SELECT USING ("public"."has_org_role"("id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text", 'member'::"text"]));



CREATE POLICY "read_own_memberships" ON "public"."memberships" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "read_program_sessions" ON "public"."program_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "program_sessions"."program_id") AND (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("p"."is_public" = true))))));



CREATE POLICY "read_programs" ON "public"."programs" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("is_public" = true)));



CREATE POLICY "read_session_types" ON "public"."session_types" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "read_wod_formats" ON "public"."wod_formats" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



ALTER TABLE "public"."session_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_pain_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_class_schedules" ON "public"."class_schedules" FOR UPDATE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"])) WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "update_classes" ON "public"."classes" FOR UPDATE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"])) WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "update_memberships" ON "public"."memberships" FOR UPDATE USING ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"])) WITH CHECK ("public"."has_org_role"("organization_id", ARRAY['owner'::"text", 'coach'::"text", 'staff'::"text"]));



CREATE POLICY "update_orgs" ON "public"."organizations" FOR UPDATE USING ("public"."has_org_role"("id", ARRAY['owner'::"text"])) WITH CHECK ("public"."has_org_role"("id", ARRAY['owner'::"text"]));



CREATE POLICY "update_program_sessions" ON "public"."program_sessions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "program_sessions"."program_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "program_sessions"."program_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "update_programs" ON "public"."programs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wod_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wod_formats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wods" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_owner_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_owner_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_owner_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_member_data"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_member_data"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_member_data"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_member_directory"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_member_directory"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_member_directory"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_role"("org_id" "uuid", "allowed_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_user_data"("old_uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_user_data"("old_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_user_data"("old_uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_to_join_box"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_to_join_box"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_to_join_box"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_data_sharing"("org_id" "uuid", "share" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_data_sharing"("org_id" "uuid", "share" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_data_sharing"("org_id" "uuid", "share" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_org_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_org_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_org_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."block_sets" TO "anon";
GRANT ALL ON TABLE "public"."block_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."block_sets" TO "service_role";



GRANT ALL ON TABLE "public"."body_metrics" TO "anon";
GRANT ALL ON TABLE "public"."body_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."body_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."body_parts" TO "anon";
GRANT ALL ON TABLE "public"."body_parts" TO "authenticated";
GRANT ALL ON TABLE "public"."body_parts" TO "service_role";



GRANT ALL ON TABLE "public"."class_schedules" TO "anon";
GRANT ALL ON TABLE "public"."class_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."class_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."movements" TO "anon";
GRANT ALL ON TABLE "public"."movements" TO "authenticated";
GRANT ALL ON TABLE "public"."movements" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_logs" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_logs" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."personal_records" TO "anon";
GRANT ALL ON TABLE "public"."personal_records" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_records" TO "service_role";



GRANT ALL ON TABLE "public"."program_sessions" TO "anon";
GRANT ALL ON TABLE "public"."program_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."program_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."session_blocks" TO "anon";
GRANT ALL ON TABLE "public"."session_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."session_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."session_pain_alerts" TO "anon";
GRANT ALL ON TABLE "public"."session_pain_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."session_pain_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."session_types" TO "anon";
GRANT ALL ON TABLE "public"."session_types" TO "authenticated";
GRANT ALL ON TABLE "public"."session_types" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



GRANT ALL ON TABLE "public"."v_movement_progression" TO "anon";
GRANT ALL ON TABLE "public"."v_movement_progression" TO "authenticated";
GRANT ALL ON TABLE "public"."v_movement_progression" TO "service_role";



GRANT ALL ON TABLE "public"."v_pain_timeline" TO "anon";
GRANT ALL ON TABLE "public"."v_pain_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pain_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."v_sessions_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_sessions_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sessions_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_weekly_volume" TO "anon";
GRANT ALL ON TABLE "public"."v_weekly_volume" TO "authenticated";
GRANT ALL ON TABLE "public"."v_weekly_volume" TO "service_role";



GRANT ALL ON TABLE "public"."wod_components" TO "anon";
GRANT ALL ON TABLE "public"."wod_components" TO "authenticated";
GRANT ALL ON TABLE "public"."wod_components" TO "service_role";



GRANT ALL ON TABLE "public"."wod_formats" TO "anon";
GRANT ALL ON TABLE "public"."wod_formats" TO "authenticated";
GRANT ALL ON TABLE "public"."wod_formats" TO "service_role";



GRANT ALL ON TABLE "public"."wods" TO "anon";
GRANT ALL ON TABLE "public"."wods" TO "authenticated";
GRANT ALL ON TABLE "public"."wods" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































