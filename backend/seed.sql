-- Fiktive testdata
INSERT INTO employee (name) VALUES ('Karen'), ('Morten'), ('Pia');

INSERT INTO item (name, type, quantity, min_quantity, supplier, location, updated_at) VALUES
  ('Urne model X (sort)', 'Urne', 7, 4, 'Nordisk Urne ApS', 'Lager A, hylde 1', '2026-09-26 10:15:00'),
  ('Bio-urne (nedbrydelig)', 'Urne', 2, 3, 'GreenRest', 'Lager A, hylde 1', '2026-09-24 14:00:00'),
  ('Keramikurne blå', 'Urne', 5, 2, 'Nordisk Urne ApS', 'Lager A, hylde 2', '2026-09-10 09:30:00'),
  ('Havurne (salt)', 'Urne', 0, 2, 'GreenRest', 'Lager A, hylde 2', '2026-09-20 11:00:00'),
  ('Kiste hvid, fyrretræ', 'Kiste', 4, 3, 'Dansk Kistefabrik', 'Kælder, plads 1-4', '2026-09-25 08:45:00'),
  ('Kiste eg, natur', 'Kiste', 1, 2, 'Dansk Kistefabrik', 'Kælder, plads 5', '2026-09-18 13:20:00'),
  ('Ligklæde, hvid', 'Tekstil', 18, 10, 'Tekstil & Co', 'Lager B, skab 1', '2026-09-22 10:00:00'),
  ('Pude og dyne sæt', 'Tekstil', 9, 6, 'Tekstil & Co', 'Lager B, skab 1', '2026-09-22 10:00:00'),
  ('Mindeprotokol', 'Tryksag', 25, 10, 'Trykkeriet', 'Kontor', '2026-09-01 12:00:00'),
  ('Sorgkort (pakke á 25)', 'Tryksag', 3, 5, 'Trykkeriet', 'Kontor', '2026-09-27 15:30:00'),
  ('Kistepynt – hvide roser', 'Pynt', 2, 1, 'Blomsterhuset', 'Kølerum', '2026-09-28 09:00:00');

INSERT INTO stock_change (item_id, changed_at, before, change, after, change_type, employee, case_ref, note) VALUES
  (1, '2026-09-02 10:00:00', 4, 6, 10, 'MODTAGET', 'Karen', NULL, 'Levering fra Nordisk Urne'),
  (1, '2026-09-08 11:20:00', 10, -1, 9, 'BRUGT', 'Morten', 'SAG-2026-311', NULL),
  (1, '2026-09-15 09:40:00', 9, -1, 8, 'BRUGT', 'Pia', 'SAG-2026-318', NULL),
  (1, '2026-09-26 10:15:00', 8, -1, 7, 'BRUGT', 'Karen', 'SAG-2026-327', NULL),
  (2, '2026-09-12 14:00:00', 4, -1, 3, 'BRUGT', 'Morten', 'SAG-2026-315', NULL),
  (2, '2026-09-24 14:00:00', 3, -1, 2, 'BRUGT', 'Pia', 'SAG-2026-325', NULL),
  (4, '2026-09-20 11:00:00', 1, -1, 0, 'BRUGT', 'Karen', 'SAG-2026-321', 'Sidste havurne'),
  (5, '2026-09-05 08:00:00', 3, 3, 6, 'MODTAGET', 'Morten', NULL, NULL),
  (5, '2026-09-19 08:30:00', 6, -1, 5, 'BRUGT', 'Pia', 'SAG-2026-320', NULL),
  (5, '2026-09-25 08:45:00', 5, -1, 4, 'BRUGT', 'Karen', 'SAG-2026-326', NULL),
  (6, '2026-09-18 13:20:00', 2, -1, 1, 'BRUGT', 'Morten', 'SAG-2026-319', NULL),
  (7, '2026-09-22 10:00:00', 20, -2, 18, 'KORREKTION', 'Pia', NULL, 'Optælling: 2 beskadigede'),
  (10, '2026-09-27 15:30:00', 5, -2, 3, 'BRUGT', 'Karen', NULL, 'Til to sager');
