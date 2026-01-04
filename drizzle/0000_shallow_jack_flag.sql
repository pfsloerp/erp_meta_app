CREATE TABLE "erp_meta_app" (
	"created_at" timestamp with time zone DEFAULT now(),
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "erp_meta_app_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp with time zone DEFAULT now()
);
