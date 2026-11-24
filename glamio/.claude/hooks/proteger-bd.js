// =========================================
// Hook de Claude Code (PreToolUse): proteger la base de datos REAL
//
// db/schema.sql empieza con DROP TABLE: si se ejecuta en la BD "glamio",
// borra todas las usuarias, cursos y publicaciones. Este hook se ejecuta
// ANTES de cada orden de Bash o PowerShell y la bloquea si intenta eso.
// En la BD de pruebas (glamio_test) sí se permite.
//
// Claude Code le pasa la orden por la entrada estándar (stdin) en JSON:
//   { "tool_name": "Bash", "tool_input": { "command": "..." } }
// =========================================
let entrada = '';
process.stdin.on('data', (trozo) => { entrada += trozo; });
process.stdin.on('end', () => {
  let orden = '';
  try {
    orden = String(JSON.parse(entrada).tool_input?.command || '');
  } catch {
    return; // si no entiende la entrada, no bloquea nada
  }

  // ¿Ejecuta schema.sql con psql (o con -f), o usa "npm run db:crear"?
  const ejecutaSchema = /schema\.sql/i.test(orden) && /(psql|\s-f\s|--file)/i.test(orden);
  const usaDbCrear = /npm\s+run\s+db:crear/i.test(orden);
  const esPruebas = /glamio_test/i.test(orden);

  if ((ejecutaSchema || usaDbCrear) && !esPruebas) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'BLOQUEADO por el hook proteger-bd: schema.sql empieza con DROP TABLE y borraría ' +
          'todas las usuarias de la BD real "glamio". Para cambiar tablas, crea un ' +
          'db/migracion-*.sql que se pueda ejecutar varias veces (ver CLAUDE.md).'
      }
    }));
  }
});
