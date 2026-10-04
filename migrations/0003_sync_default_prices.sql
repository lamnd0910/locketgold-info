-- Sửa giá seed cũ; giữ nguyên các mức giá đã tùy chỉnh qua quản trị.
UPDATE plans SET price = 69000, updated_at = CURRENT_TIMESTAMP
WHERE id = 'ios-year' AND price = 60000 AND old_price IS NULL;

UPDATE plans SET price = 139000, updated_at = CURRENT_TIMESTAMP
WHERE id = 'ios-lifetime' AND price = 149000 AND old_price IS NULL;

UPDATE plans SET price = 99000, updated_at = CURRENT_TIMESTAMP
WHERE id = 'android-lifetime' AND price = 180000 AND old_price IS NULL;
