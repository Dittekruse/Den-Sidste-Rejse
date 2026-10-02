-- Fiktive testdata til Den Sidste Rejse

INSERT INTO employee (name) VALUES
    ('Frank'),
    ('Mette');


INSERT INTO item
    (name, type, quantity, min_quantity, supplier, location, updated_at)
VALUES

    -- Urner
    ('Askerør til askespredning', 'Urne', 7, 4, 'Den Sidste Rejse', 'Lager A, hylde 1', '2026-09-26 10:15:00'),

    ('Barkurne', 'Urne', 2, 3, 'Den Sidste Rejse', 'Lager A, hylde 1', '2026-09-24 14:00:00'),

    ('Heimurne – plantefiber', 'Urne', 5, 2, 'Den Sidste Rejse', 'Lager A, hylde 2', '2026-09-10 09:30:00'),

    ('Ler- eller keramikurne', 'Urne', 4, 2, 'Den Sidste Rejse', 'Lager A, hylde 2', '2026-09-20 11:00:00'),

    ('Od-stone urne – plantefiber', 'Urne', 3, 2, 'Den Sidste Rejse', 'Lager A, hylde 3', '2026-09-22 10:00:00'),

    ('Sfera søkugle – presset sandsten', 'Urne', 2, 2, 'Den Sidste Rejse', 'Lager A, hylde 3', '2026-09-22 10:00:00'),


    -- Kister
    ('Begravelseskiste med perlebort', 'Kiste', 3, 2, 'Den Sidste Rejse', 'Kælder, plads 1-4', '2026-09-25 08:45:00'),

    ('Farvet kiste til kremering', 'Kiste', 4, 3, 'Den Sidste Rejse', 'Kælder, plads 5-8', '2026-09-25 08:45:00'),

    ('Egetræskiste', 'Kiste', 2, 2, 'Den Sidste Rejse', 'Kælder, plads 9-10', '2026-09-18 13:20:00'),

    ('Mahognikiste', 'Kiste', 1, 2, 'Den Sidste Rejse', 'Kælder, plads 11', '2026-09-18 13:20:00'),

    ('Klassisk hvid begravelseskiste', 'Kiste', 5, 3, 'Den Sidste Rejse', 'Kælder, plads 12-16', '2026-09-25 08:45:00'),

    ('Fyrretræskiste', 'Kiste', 4, 3, 'Den Sidste Rejse', 'Kælder, plads 17-20', '2026-09-25 08:45:00'),

    ('Klassisk hvid kiste til kremering m guirlande', 'Kiste', 3, 2, 'Den Sidste Rejse', 'Kælder, plads 21-23', '2026-09-25 08:45:00'),

    ('Klassisk hvid kiste til kremering', 'Kiste', 4, 3, 'Den Sidste Rejse', 'Kælder, plads 24-27', '2026-09-25 08:45:00'),


    -- Øvrige varer
    ('Ligklæde, hvid', 'Tekstil', 18, 10, 'Tekstil & Co', 'Lager B, skab 1', '2026-09-22 10:00:00'),

    ('Pude og dyne sæt', 'Tekstil', 9, 6, 'Tekstil & Co', 'Lager B, skab 1', '2026-09-22 10:00:00'),

    ('Mindeprotokol', 'Tryksag', 25, 10, 'Trykkeriet', 'Kontor', '2026-09-01 12:00:00'),

    ('Sorgkort (pakke á 25)', 'Tryksag', 3, 5, 'Trykkeriet', 'Kontor', '2026-09-27 15:30:00'),

    ('Kistepynt – hvide roser', 'Pynt', 2, 1, 'Blomsterhuset', 'Kølerum', '2026-09-28 09:00:00');

-- ------------------------------------------------------------
-- Produktvarianter
-- ------------------------------------------------------------

UPDATE item
SET
    variant_type = 'motif',
    variant_options = '["Solnedgang","Blå himmel","Fugl","Nattehimmel","Sommerfugl","Skov","Andet motiv"]'
WHERE name = 'Askerør til askespredning';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Sort","Hvid","Blå","Rød","Grøn","Anden farve"]'
WHERE name = 'Barkurne';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Sort","Rød","Hvid","Grøn","Blå","Anden farve"]'
WHERE name = 'Heimurne – plantefiber';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Sort","Grå","Mørkerød","Beige","Brun","Hvid","Blå","Grøn","Gul","Rød","Anden farve"]'
WHERE name = 'Ler- eller keramikurne';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Grå","Blå","Beige","Anden farve"]'
WHERE name = 'Od-stone urne – plantefiber';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Rød","Brun","Grå","Blå","Grøn","Anden farve"]'
WHERE name = 'Sfera søkugle – presset sandsten';


UPDATE item
SET
    variant_type = 'color',
    variant_options = '["Sort","Hvid","Rød","Blå","Grøn","Anden farve"]'
WHERE name = 'Farvet kiste til kremering';

INSERT INTO stock_change
    (item_id, changed_at, before, change, after, change_type, employee, case_ref, note)
VALUES

    -- Askerør
    (1, '2026-09-02 10:00:00', 4, 6, 10, 'MODTAGET', 'Frank', NULL, 'Levering af askerør'),

    (1, '2026-09-08 11:20:00', 10, -1, 9, 'BRUGT', 'Mette', 'SAG-2026-311', NULL),

    (1, '2026-09-15 09:40:00', 9, -1, 8, 'BRUGT', 'Frank', 'SAG-2026-318', NULL),

    (1, '2026-09-26 10:15:00', 8, -1, 7, 'BRUGT', 'Mette', 'SAG-2026-327', NULL),


    -- Barkurne
    (2, '2026-09-12 14:00:00', 4, -1, 3, 'BRUGT', 'Frank', 'SAG-2026-315', NULL),

    (2, '2026-09-24 14:00:00', 3, -1, 2, 'BRUGT', 'Mette', 'SAG-2026-325', NULL),


    -- Heimurne
    (3, '2026-09-05 09:30:00', 6, 1, 7, 'MODTAGET', 'Frank', NULL, 'Levering af Heimurner'),

    (3, '2026-09-10 09:30:00', 7, -2, 5, 'BRUGT', 'Mette', 'SAG-2026-314', NULL),


    -- Ler- eller keramikurne
    (4, '2026-09-05 10:00:00', 5, 2, 7, 'MODTAGET', 'Frank', NULL, 'Levering af keramikurner'),

    (4, '2026-09-20 11:00:00', 7, -3, 4, 'BRUGT', 'Mette', 'SAG-2026-321', NULL),


    -- Od-stone urne
    (5, '2026-09-12 10:30:00', 5, 2, 7, 'MODTAGET', 'Frank', NULL, 'Levering af Od-stone urner'),

    (5, '2026-09-18 12:00:00', 7, -2, 5, 'BRUGT', 'Mette', 'SAG-2026-319', NULL),

    (5, '2026-09-22 10:00:00', 5, -2, 3, 'BRUGT', 'Frank', 'SAG-2026-323', NULL),


    -- Sfera søkugle
    (6, '2026-09-15 09:00:00', 3, 2, 5, 'MODTAGET', 'Mette', NULL, 'Levering af Sfera søkugler'),

    (6, '2026-09-22 10:00:00', 5, -3, 2, 'BRUGT', 'Frank', 'SAG-2026-324', NULL),


    -- Begravelseskiste med perlebort
    (7, '2026-09-05 08:00:00', 2, 3, 5, 'MODTAGET', 'Frank', NULL, 'Levering af kister'),

    (7, '2026-09-18 08:30:00', 5, -1, 4, 'BRUGT', 'Mette', 'SAG-2026-320', NULL),

    (7, '2026-09-25 08:45:00', 4, -1, 3, 'BRUGT', 'Frank', 'SAG-2026-326', NULL),


    -- Farvet kiste til kremering
    (8, '2026-09-08 09:00:00', 2, 4, 6, 'MODTAGET', 'Mette', NULL, 'Levering af farvede kister'),

    (8, '2026-09-20 10:00:00', 6, -2, 4, 'BRUGT', 'Frank', 'SAG-2026-322', NULL),


    -- Egetræskiste
    (9, '2026-09-10 08:30:00', 3, 1, 4, 'MODTAGET', 'Frank', NULL, 'Levering af egetræskister'),

    (9, '2026-09-18 13:20:00', 4, -2, 2, 'BRUGT', 'Mette', 'SAG-2026-319', NULL),


    -- Mahognikiste
    (10, '2026-09-18 13:20:00', 2, -1, 1, 'BRUGT', 'Frank', 'SAG-2026-319', NULL),


    -- Klassisk hvid begravelseskiste
    (11, '2026-09-12 08:00:00', 3, 4, 7, 'MODTAGET', 'Mette', NULL, 'Levering af hvide kister'),

    (11, '2026-09-20 08:30:00', 7, -2, 5, 'BRUGT', 'Frank', 'SAG-2026-322', NULL),


    -- Fyrretræskiste
    (12, '2026-09-05 08:00:00', 3, 3, 6, 'MODTAGET', 'Frank', NULL, 'Levering af fyrretræskister'),

    (12, '2026-09-19 08:30:00', 6, -2, 4, 'BRUGT', 'Mette', 'SAG-2026-320', NULL),


    -- Hvid kiste med guirlande
    (13, '2026-09-14 09:00:00', 2, 2, 4, 'MODTAGET', 'Mette', NULL, 'Levering af kister med guirlande'),

    (13, '2026-09-23 11:00:00', 4, -1, 3, 'BRUGT', 'Frank', 'SAG-2026-325', NULL),


    -- Klassisk hvid kiste til kremering
    (14, '2026-09-16 08:30:00', 3, 3, 6, 'MODTAGET', 'Frank', NULL, 'Levering af hvide kremeringskister'),

    (14, '2026-09-25 09:30:00', 6, -2, 4, 'BRUGT', 'Mette', 'SAG-2026-327', NULL),


    -- Ligklæde
    (15, '2026-09-22 10:00:00', 20, -2, 18, 'KORREKTION', 'Frank', NULL, 'Optælling: 2 beskadigede'),


    -- Sorgkort
    (18, '2026-09-27 15:30:00', 5, -2, 3, 'BRUGT', 'Mette', NULL, 'Til to sager');