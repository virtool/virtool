CREATE TABLE "otu_promoted_accession_bases" (
	"otu_id" uuid NOT NULL,
	"accession_base" text NOT NULL,
	"promoted_to_base" text NOT NULL,
	"created_version" integer NOT NULL,
	CONSTRAINT "otu_promoted_accession_bases_pkey" PRIMARY KEY("otu_id","accession_base"),
	CONSTRAINT "otu_promoted_accession_bases_accession_base_check" CHECK ("otu_promoted_accession_bases"."accession_base" ~ '^[A-Z0-9_-]+$'),
	CONSTRAINT "otu_promoted_accession_bases_promoted_to_base_check" CHECK ("otu_promoted_accession_bases"."promoted_to_base" ~ '^[A-Z0-9_-]+$' and "otu_promoted_accession_bases"."promoted_to_base" <> "otu_promoted_accession_bases"."accession_base"),
	CONSTRAINT "otu_promoted_accession_bases_created_version_check" CHECK ("otu_promoted_accession_bases"."created_version" >= 2)
);
--> statement-breakpoint
ALTER TABLE "otu_promoted_accession_bases" ADD CONSTRAINT "otu_promoted_accession_bases_otu_id_fkey" FOREIGN KEY ("otu_id") REFERENCES "public"."otus"("id") ON DELETE no action ON UPDATE no action;