export async function executarConsulta(connection, query, params = '') {
    if(params !== ''){
        return connection.query(query, params);
    }
    return connection.query(query);
}

export async function resetarTabela(connection, table) {
    await connection.query(`DELETE FROM ${table}`);
    await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 0`);
}

export async function inserir(connection, table, params) {
    await connection.query(`INSERT INTO ${table} SET ?`, params);
}
