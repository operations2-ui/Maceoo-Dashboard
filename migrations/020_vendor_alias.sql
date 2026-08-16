alter table store_aliases drop constraint store_aliases_source_check;
alter table store_aliases add constraint store_aliases_source_check
  check (source in ('inventory', 'sheet', 'vendor'));
