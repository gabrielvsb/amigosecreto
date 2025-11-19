const TABELAS_PERMITIDAS = new Set(['participantes', 'sorteio']);

function assertTabelaValida(table){
    if(!TABELAS_PERMITIDAS.has(table)){
        throw new Error(`Tabela não permitida: ${table}`);
    }
}

export async function executarConsulta(connection, query, params = []) {
    const [rows] = await connection.execute(query, Array.isArray(params) ? params : [params]);
    return rows;
}

export async function resetarTabela(connection, table, resetar_ai = true) {
    assertTabelaValida(table);
    // Evita TRUNCATE para manter semântica de transação previsível
    await connection.query(`DELETE FROM \`${table}\``);
    if (resetar_ai){
        await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }
}

export async function inserir(connection, table, params) {
    assertTabelaValida(table);
    // Usa prepared statement com colunas explícitas
    const keys = Object.keys(params);
    const placeholders = keys.map(()=> '?').join(',');
    const sql = `INSERT INTO \`${table}\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${placeholders})`;
    const values = keys.map(k=> params[k]);
    await connection.execute(sql, values);
}

export async function atualizar(connection, table, setParams, whereClause, whereParams = []){
    assertTabelaValida(table);
    const setKeys = Object.keys(setParams);
    const setSql = setKeys.map(k=>`\`${k}\` = ?`).join(', ');
    const sql = `UPDATE \`${table}\` SET ${setSql} ${whereClause ? 'WHERE ' + whereClause : ''}`;
    const values = [...setKeys.map(k=>setParams[k]), ...(Array.isArray(whereParams) ? whereParams : [whereParams])];
    const [result] = await connection.execute(sql, values);
    return result; // ResultSetHeader (affectedRows, changedRows, etc.)
}

export async function executarTransacao(connection, fn){
    await connection.beginTransaction();
    try {
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (e){
        await connection.rollback();
        throw e;
    }
}
