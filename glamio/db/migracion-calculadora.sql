-- Calculadora (24/11): cada material se apunta con lo que costó el producto entero
-- y para cuántos servicios da. El coste por sesión = precio_envase / servicios_envase.
-- Se puede ejecutar más de una vez (IF NOT EXISTS). Las mismas líneas están en schema.sql.

-- Lo que costó el producto entero (el bote, la caja...)
ALTER TABLE materiales_servicio ADD COLUMN IF NOT EXISTS precio_envase NUMERIC(8,2)
  CHECK (precio_envase >= 0);

-- Para cuántos servicios da ese producto
ALTER TABLE materiales_servicio ADD COLUMN IF NOT EXISTS servicios_envase INT
  CHECK (servicios_envase BETWEEN 1 AND 10000);

-- El coste por sesión puede tener céntimos partidos (12 € / 30 = 0,40; 5 € / 300 = 0,0167),
-- así que se guarda con 4 decimales para que no se redondee a 0,00.
ALTER TABLE materiales_servicio ALTER COLUMN coste TYPE NUMERIC(10,4);
