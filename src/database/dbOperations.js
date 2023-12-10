export async function executarConsulta(connection, query, params = '') {
    let rows;
    if(params !== ''){
        [rows] =  await connection.query(query, params);
    }else{
        [rows] = await connection.query(query);
    }
    return rows;
}

export async function resetarTabela(connection, table, resetar_ai = true) {
    await connection.query(`DELETE FROM ${table}`);
    if(resetar_ai){
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 0`);
    }
}

export async function inserir(connection, table, params) {
    await connection.query(`INSERT INTO ${table} SET ?`, params);
}
