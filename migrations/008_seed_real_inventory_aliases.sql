insert into store_aliases (store_id, source, alias_name)
select s.id, 'inventory', v.alias
from (values
  ('ARLV', 'ARLV Store Daily Stock Report CSV'),
  ('BAAC', 'BAAC Store Daily stock Report CSV'),
  ('BRMS', 'BRMS Store Daily Report CSV'),
  ('HRHW', 'HRHW Store Daily Stock Report CSV'),
  ('LVCH', 'LVCH Store Daily Stock Report CSV'),
  ('LVRW', 'LVRW Store Daily Stock Report CSV'),
  ('MGLV', 'MGLV Store Daily Stock Report CSV'),
  ('PARIS', 'Paris Store Daily Report CSV'),
  ('PR', 'PR Store Daily Stock Report CSV'),
  ('VELV', 'VELV Store Daily Stock Report CSV')
) as v(code, alias)
join stores s on s.code = v.code
on conflict (source, alias_name) do nothing;

select sa.alias_name, s.name from store_aliases sa join stores s on s.id = sa.store_id where sa.source = 'inventory' order by s.name;
