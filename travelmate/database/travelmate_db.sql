CREATE DATABASE IF NOT EXISTS travelmate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE travelmate_db;

CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(80) NOT NULL,
  category VARCHAR(20) NOT NULL,
  duration VARCHAR(80) NOT NULL,
  price_per_person DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  UNIQUE KEY uq_packages_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  destination VARCHAR(150) NOT NULL,
  destination_country VARCHAR(80) NOT NULL DEFAULT '',
  package_category VARCHAR(30) NOT NULL,
  package_duration VARCHAR(80) NOT NULL,
  package_price DECIMAL(10,2) NOT NULL,
  travel_mode VARCHAR(20) DEFAULT NULL,
  departure_city VARCHAR(120) DEFAULT NULL,
  departure_location VARCHAR(180) DEFAULT NULL,
  travel_date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  nights INT NOT NULL DEFAULT 2,
  travellers INT NOT NULL,
  special_requests TEXT,
  estimated_total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO packages (name, country, category, duration, price_per_person, description) VALUES
('Goa Beach Holiday', 'India', 'Domestic', '3 days / 2 nights', 18500.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Manali Mountain Trip', 'India', 'Domestic', '4 days / 3 nights', 23500.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Jaipur Heritage Tour', 'India', 'Domestic', '3 days / 2 nights', 16500.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Kerala Nature Tour', 'India', 'Domestic', '5 days / 4 nights', 32000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Kashmir Valley Escape', 'India', 'Domestic', '5 days / 4 nights', 39000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Shimla Weekend Getaway', 'India', 'Domestic', '3 days / 2 nights', 15500.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Rishikesh Adventure Trip', 'India', 'Domestic', '3 days / 2 nights', 14500.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Udaipur Royal Heritage Tour', 'India', 'Domestic', '3 days / 2 nights', 17000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Andaman Island Escape', 'India', 'Domestic', '5 days / 4 nights', 43000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Ooty Hill Station Holiday', 'India', 'Domestic', '4 days / 3 nights', 21000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Varanasi Spiritual Tour', 'India', 'Domestic', '3 days / 2 nights', 14000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Coorg Nature Retreat', 'India', 'Domestic', '4 days / 3 nights', 23000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes travel to destination, other meals, insurance and personal expenses.'),
('Bali Island Escape', 'Indonesia', 'International', '5 days / 4 nights', 65000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.'),
('Singapore City Explorer', 'Singapore', 'International', '4 days / 3 nights', 75000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.'),
('Dubai City Highlights', 'United Arab Emirates', 'International', '5 days / 4 nights', 85000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.'),
('Australia Highlights', 'Australia', 'International', '7 days / 6 nights', 175000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.'),
('New Zealand Discovery', 'New Zealand', 'International', '8 days / 7 nights', 195000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.'),
('Swiss Alps Discovery', 'Switzerland', 'International', '7 days / 6 nights', 215000.00, 'Approximate per-person ground package, twin-share room. Includes accommodation, breakfast, local transfers and planned sightseeing allowance. Excludes international airfare, visa, insurance, other meals and personal expenses.')
ON DUPLICATE KEY UPDATE country = VALUES(country), category = VALUES(category), duration = VALUES(duration), price_per_person = VALUES(price_per_person), description = VALUES(description);
