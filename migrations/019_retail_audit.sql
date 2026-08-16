-- All three tables are fully overwritten (truncate + reload) on every sync,
-- not incrementally upserted — PO statuses and quantities get corrected in
-- place over a PO's lifecycle rather than only ever appending, unlike sales.

create table if not exists po_raw_data (
  id bigint generated always as identity primary key,
  internal_id text,
  document_number text not null,
  po_date date,
  vendor_name text,
  location text,
  status text,
  mac_po_type text,
  mac_po_status text,
  po_start_date date,
  po_cancel_date date,
  due_date date,
  expected_receipt_date date,
  memo text,
  line_id text,
  item text,
  display_name text,
  quantity numeric,
  quantity_fulfilled_received numeric,
  inventory_location text,
  quantity_billed numeric,
  quantity_committed numeric
);
create index if not exists idx_po_raw_data_document_number on po_raw_data (document_number);

create table if not exists retail_audit_raw_data (
  id bigint generated always as identity primary key,
  vendor text,
  po_number text not null,
  purchasing_trans_type text,
  po_date date,
  sku text,
  item_name text,
  quantity_received numeric,
  quantity_billed numeric,
  customer text,
  sp_number text,
  sales_trans_type text,
  sales_trans_date date,
  quantity_shipped numeric,
  quantity_invoiced numeric
);
create index if not exists idx_retail_audit_raw_data_po_number on retail_audit_raw_data (po_number);

create table if not exists retail_audit_dashboard (
  id bigint generated always as identity primary key,
  po_number text not null,
  po_date date,
  po_status text,
  related_sp text,
  vendor_name text,
  ordered_quantity numeric,
  billed_quantity numeric,
  shipped_quantity numeric,
  received_quantity numeric,
  diff_shipped_received numeric,
  diff_received_billed numeric
);
create unique index if not exists idx_retail_audit_dashboard_po_number on retail_audit_dashboard (po_number);
