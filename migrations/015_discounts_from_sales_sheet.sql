-- The Sales sheet now carries discount usage directly (broken down per user
-- and discount-name combination per store/day), so there's no separate
-- Discounts sheet or order_id/pos_flag anymore. Re-key discounts on
-- (store, day, user, discount combo) instead of the old (store, day,
-- order_id, discount_name) key.
alter table discounts drop constraint if exists discounts_store_id_day_date_order_id_discount_name_key;
alter table discounts add constraint discounts_store_id_day_date_user_name_discount_name_key
  unique (store_id, day_date, user_name, discount_name);
