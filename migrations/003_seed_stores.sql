insert into stores (name, code) values
  ('ARLV Store', 'ARLV'),
  ('LVCH Store', 'LVCH'),
  ('PR Store', 'PR'),
  ('BAAC Store', 'BAAC'),
  ('MGLV Store', 'MGLV'),
  ('BRMS Store', 'BRMS'),
  ('LVRW Store', 'LVRW'),
  ('VELV Store', 'VELV'),
  ('HRHW Store', 'HRHW'),
  ('Paris Store', 'PARIS')
on conflict (name) do nothing;
