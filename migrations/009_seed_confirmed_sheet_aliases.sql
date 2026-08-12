insert into store_aliases (store_id, source, alias_name)
select s.id, 'sheet', v.alias
from (values
  ('PR', 'Maceoo PR'),
  ('ARLV', 'Maceoo Aria'),
  ('LVCH', 'Maceoo Cosmo'),
  ('MGLV', 'Maceoo MGM'),
  ('BAAC', 'Maceoo Atlantic')
) as v(code, alias)
join stores s on s.code = v.code
on conflict (source, alias_name) do nothing;

select sa.alias_name, s.name from store_aliases sa join stores s on s.id = sa.store_id where sa.source = 'sheet' order by s.name;
