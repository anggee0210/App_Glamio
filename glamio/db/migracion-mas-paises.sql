-- =========================================================
-- GLAMIO · Más países para la ficha personal de la alumna (24/11/2026)
-- Se añaden al lado de los 17 que ya había (migracion-ficha-alumna.sql).
-- El número de documento se guarda SIN espacios, puntos ni guiones y en MAYÚSCULAS,
-- por eso los patrones solo llevan letras y números.
-- En los documentos con formato muy variable, el patrón es flexible (letras y números).
-- ON CONFLICT ... DO UPDATE: se puede ejecutar más de una vez sin romper nada.
-- =========================================================
INSERT INTO paises (codigo, nombre, documento, patron, ejemplo, orden) VALUES
  -- Latinoamérica
  ('UY', 'Uruguay',          'Cédula de identidad',          '^[0-9]{7,8}$',               '1.234.567-8',        10),
  ('GT', 'Guatemala',        'DPI',                          '^[0-9]{13}$',                '2345 67890 0101',    10),
  ('SV', 'El Salvador',      'DUI',                          '^[0-9]{9}$',                 '01234567-8',         10),
  ('NI', 'Nicaragua',        'Cédula de identidad',          '^[0-9]{13}[A-Z]$',           '001-010190-0001A',   10),
  ('CR', 'Costa Rica',       'Cédula de identidad',          '^[0-9]{9}$',                 '1-1234-5678',        10),
  ('PA', 'Panamá',           'Cédula de identidad',          '^[A-Z0-9]{5,13}$',           '8-123-456',          10),
  ('PR', 'Puerto Rico',      'Pasaporte',                    '^[A-Z0-9]{6,9}$',            '123456789',          10),
  ('US', 'Estados Unidos',   'Pasaporte',                    '^[A-Z0-9]{6,9}$',            '123456789',          10),
  ('GQ', 'Guinea Ecuatorial','DIP',                          '^[A-Z0-9]{5,12}$',           '123456',             10),
  -- Europa
  ('PT', 'Portugal',         'Cartão de Cidadão',            '^[0-9]{8,9}([A-Z0-9]{3})?$', '12345678 9 ZZ1',     10),
  ('FR', 'Francia',          'Carte nationale d''identité',  '^[A-Z0-9]{9,12}$',           'X4RTBPFW4',          10),
  ('IT', 'Italia',           'Carta d''identità',            '^[A-Z0-9]{7,10}$',           'CA00000AA',          10),
  ('DE', 'Alemania',         'Personalausweis',              '^[A-Z0-9]{9,10}$',           'L01X00T47',          10),
  ('GB', 'Reino Unido',      'Pasaporte',                    '^[A-Z0-9]{9}$',              '123456789',          10),
  ('IE', 'Irlanda',          'Pasaporte',                    '^[A-Z0-9]{7,9}$',            'PA1234567',          10),
  ('NL', 'Países Bajos',     'Identiteitskaart',             '^[A-Z0-9]{9}$',              'SPECI2014',          10),
  ('BE', 'Bélgica',          'Carte d''identité',            '^[0-9]{12}$',                '000-0000000-00',     10),
  ('CH', 'Suiza',            'Carte d''identité',            '^[A-Z0-9]{8,9}$',            'C1234567',           10),
  ('PL', 'Polonia',          'Dowód osobisty',               '^[A-Z]{3}[0-9]{6}$',         'ABC123456',          10),
  ('BG', 'Bulgaria',         'EGN',                          '^[0-9]{10}$',                '8501011234',         10),
  ('UA', 'Ucrania',          'Pasaporte',                    '^[A-Z]{0,2}[0-9]{6,9}$',     'FA123456',           10),
  ('RU', 'Rusia',            'Pasaporte',                    '^[0-9]{9,10}$',              '4509 123456',        10),
  ('GE', 'Georgia',          'Documento de identidad',       '^[0-9]{11}$',                '01001012345',        10),
  ('MD', 'Moldavia',         'Buletin de identitate',        '^[0-9]{13}$',                '2001001234567',      10),
  -- África y Asia
  ('DZ', 'Argelia',          'Carte nationale d''identité',  '^[0-9]{9,18}$',              '123456789',          10),
  ('SN', 'Senegal',          'CNI CEDEAO',                   '^[0-9]{13,17}$',             '1234567890123',      10),
  ('NG', 'Nigeria',          'NIN',                          '^[0-9]{11}$',                '12345678901',        10),
  ('PK', 'Pakistán',         'CNIC',                         '^[0-9]{13}$',                '12345-1234567-1',    10),
  ('IN', 'India',            'Pasaporte',                    '^[A-Z][0-9]{7}$',            'A1234567',           10),
  ('CN', 'China',            'Documento de identidad',       '^[0-9]{17}[0-9X]$',          '11010519491231002X', 10),
  ('PH', 'Filipinas',        'PhilSys ID',                   '^[0-9]{12,16}$',             '1234-5678-9012-3456',10)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, documento = EXCLUDED.documento,
  patron = EXCLUDED.patron, ejemplo = EXCLUDED.ejemplo, orden = EXCLUDED.orden;
