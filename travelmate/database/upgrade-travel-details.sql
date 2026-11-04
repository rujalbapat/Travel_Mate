-- Upgrade an existing TravelMate database. This preserves booking rows and is safe to rerun.
USE travelmate_db;

DROP PROCEDURE IF EXISTS travelmate_upgrade_booking_fields;
DELIMITER $$
CREATE PROCEDURE travelmate_upgrade_booking_fields()
BEGIN
  DECLARE duplicate_name_groups INT DEFAULT 0;
  DECLARE unique_name_indexes INT DEFAULT 0;

  SELECT COUNT(*) INTO duplicate_name_groups
  FROM (
    SELECT name FROM packages GROUP BY name HAVING COUNT(*) > 1
  ) AS duplicate_names;

  IF duplicate_name_groups > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Migration stopped: packages contains duplicate names. Resolve them and rerun; no booking rows were changed.';
  END IF;

  SELECT COUNT(*) INTO unique_name_indexes
  FROM (
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'packages'
      AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME = 'name') = 1
  ) AS name_indexes;

  IF unique_name_indexes = 0 THEN
    ALTER TABLE packages ADD UNIQUE KEY uq_packages_name (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'country'
  ) THEN
    ALTER TABLE packages ADD COLUMN country VARCHAR(80) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'category'
  ) THEN
    ALTER TABLE packages ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'destination_country'
  ) THEN
    ALTER TABLE bookings ADD COLUMN destination_country VARCHAR(80) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'departure_city'
  ) THEN
    ALTER TABLE bookings ADD COLUMN departure_city VARCHAR(120) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'departure_location'
  ) THEN
    ALTER TABLE bookings ADD COLUMN departure_location VARCHAR(180) DEFAULT NULL;
  END IF;
END$$
DELIMITER ;

CALL travelmate_upgrade_booking_fields();
DROP PROCEDURE travelmate_upgrade_booking_fields;

UPDATE packages SET
  country = CASE name
    WHEN 'Goa Beach Holiday' THEN 'India'
    WHEN 'Manali Mountain Trip' THEN 'India'
    WHEN 'Jaipur Heritage Tour' THEN 'India'
    WHEN 'Kerala Nature Tour' THEN 'India'
    WHEN 'Kashmir Valley Escape' THEN 'India'
    WHEN 'Shimla Weekend Getaway' THEN 'India'
    WHEN 'Rishikesh Adventure Trip' THEN 'India'
    WHEN 'Udaipur Royal Heritage Tour' THEN 'India'
    WHEN 'Andaman Island Escape' THEN 'India'
    WHEN 'Ooty Hill Station Holiday' THEN 'India'
    WHEN 'Varanasi Spiritual Tour' THEN 'India'
    WHEN 'Coorg Nature Retreat' THEN 'India'
    WHEN 'Bali Island Escape' THEN 'Indonesia'
    WHEN 'Singapore City Explorer' THEN 'Singapore'
    WHEN 'Dubai City Highlights' THEN 'United Arab Emirates'
    WHEN 'Australia Highlights' THEN 'Australia'
    WHEN 'New Zealand Discovery' THEN 'New Zealand'
    WHEN 'Swiss Alps Discovery' THEN 'Switzerland'
    ELSE country END,
  category = CASE
    WHEN name IN ('Goa Beach Holiday','Manali Mountain Trip','Jaipur Heritage Tour','Kerala Nature Tour','Kashmir Valley Escape','Shimla Weekend Getaway','Rishikesh Adventure Trip','Udaipur Royal Heritage Tour','Andaman Island Escape','Ooty Hill Station Holiday','Varanasi Spiritual Tour','Coorg Nature Retreat') THEN 'Domestic'
    WHEN name IN ('Bali Island Escape','Singapore City Explorer','Dubai City Highlights','Australia Highlights','New Zealand Discovery','Swiss Alps Discovery') THEN 'International'
    ELSE category END,
  price_per_person = CASE name
    WHEN 'Goa Beach Holiday' THEN 18500.00
    WHEN 'Manali Mountain Trip' THEN 23500.00
    WHEN 'Jaipur Heritage Tour' THEN 16500.00
    WHEN 'Kerala Nature Tour' THEN 32000.00
    WHEN 'Kashmir Valley Escape' THEN 39000.00
    WHEN 'Shimla Weekend Getaway' THEN 15500.00
    WHEN 'Rishikesh Adventure Trip' THEN 14500.00
    WHEN 'Udaipur Royal Heritage Tour' THEN 17000.00
    WHEN 'Andaman Island Escape' THEN 43000.00
    WHEN 'Ooty Hill Station Holiday' THEN 21000.00
    WHEN 'Varanasi Spiritual Tour' THEN 14000.00
    WHEN 'Coorg Nature Retreat' THEN 23000.00
    WHEN 'Bali Island Escape' THEN 65000.00
    WHEN 'Singapore City Explorer' THEN 75000.00
    WHEN 'Dubai City Highlights' THEN 85000.00
    WHEN 'Australia Highlights' THEN 175000.00
    WHEN 'New Zealand Discovery' THEN 195000.00
    WHEN 'Swiss Alps Discovery' THEN 215000.00
    ELSE price_per_person END
WHERE name IN (
  'Goa Beach Holiday','Manali Mountain Trip','Jaipur Heritage Tour','Kerala Nature Tour','Kashmir Valley Escape','Shimla Weekend Getaway',
  'Rishikesh Adventure Trip','Udaipur Royal Heritage Tour','Andaman Island Escape','Ooty Hill Station Holiday','Varanasi Spiritual Tour','Coorg Nature Retreat',
  'Bali Island Escape','Singapore City Explorer','Dubai City Highlights','Australia Highlights','New Zealand Discovery','Swiss Alps Discovery'
);

UPDATE packages SET description = CASE
  WHEN category = 'Domestic' THEN 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'
  ELSE 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, other meals, insurance and personal expenses.'
END
WHERE name IN (
  'Goa Beach Holiday','Manali Mountain Trip','Jaipur Heritage Tour','Kerala Nature Tour','Kashmir Valley Escape','Shimla Weekend Getaway',
  'Rishikesh Adventure Trip','Udaipur Royal Heritage Tour','Andaman Island Escape','Ooty Hill Station Holiday','Varanasi Spiritual Tour','Coorg Nature Retreat',
  'Bali Island Escape','Singapore City Explorer','Dubai City Highlights','Australia Highlights','New Zealand Discovery','Swiss Alps Discovery'
);

UPDATE bookings SET destination_country = CASE destination
  WHEN 'Goa Beach Holiday' THEN 'India'
  WHEN 'Manali Mountain Trip' THEN 'India'
  WHEN 'Jaipur Heritage Tour' THEN 'India'
  WHEN 'Kerala Nature Tour' THEN 'India'
  WHEN 'Kashmir Valley Escape' THEN 'India'
  WHEN 'Shimla Weekend Getaway' THEN 'India'
  WHEN 'Rishikesh Adventure Trip' THEN 'India'
  WHEN 'Udaipur Royal Heritage Tour' THEN 'India'
  WHEN 'Andaman Island Escape' THEN 'India'
  WHEN 'Ooty Hill Station Holiday' THEN 'India'
  WHEN 'Varanasi Spiritual Tour' THEN 'India'
  WHEN 'Coorg Nature Retreat' THEN 'India'
  WHEN 'Bali Island Escape' THEN 'Indonesia'
  WHEN 'Singapore City Explorer' THEN 'Singapore'
  WHEN 'Dubai City Highlights' THEN 'United Arab Emirates'
  WHEN 'Australia Highlights' THEN 'Australia'
  WHEN 'New Zealand Discovery' THEN 'New Zealand'
  WHEN 'Swiss Alps Discovery' THEN 'Switzerland'
  ELSE destination_country END
WHERE destination_country = '';
