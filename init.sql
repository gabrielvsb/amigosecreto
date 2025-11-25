USE db_amigo_secreto;

-- Usuários do sistema (para login)
CREATE TABLE IF NOT EXISTS users (
                                     id INT AUTO_INCREMENT PRIMARY KEY,
                                     name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Eventos criados por um usuário
CREATE TABLE IF NOT EXISTS events (
                                      id INT AUTO_INCREMENT PRIMARY KEY,
                                      user_id INT NOT NULL,
                                      name VARCHAR(255) NOT NULL,
    msg_template_draw TEXT,
    msg_template_test TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Participantes (opcionalmente vinculados a um usuário e evento)
CREATE TABLE IF NOT EXISTS participantes (
                                             id INT AUTO_INCREMENT PRIMARY KEY,
                                             nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    grupo VARCHAR(100),
    confirmacao_recebimento TINYINT(1) DEFAULT 0,
    user_id INT NULL,
    event_id INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

-- Resultado do sorteio (opcionalmente vinculado a um usuário e evento)
CREATE TABLE IF NOT EXISTS sorteio (
                                       id INT AUTO_INCREMENT PRIMARY KEY,
                                       id_participante INT NOT NULL,
                                       id_amigo INT NOT NULL,
                                       mensagem_enviada TINYINT(1) DEFAULT 0,
    user_id INT NULL,
    event_id INT NULL,
    FOREIGN KEY (id_participante) REFERENCES participantes(id) ON DELETE CASCADE,
    FOREIGN KEY (id_amigo) REFERENCES participantes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );